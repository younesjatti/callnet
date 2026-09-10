import express from 'express';
import QRCode from 'qrcode';
import { GoogleGenAI } from "@google/genai";
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    type WASocket,
    type ConnectionState
} from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { Boom } from '@hapi/boom';
import { OrderStatus, Order, User, WhatsAppConfig, WhatsAppLog } from '../types.js';
import { normalizeStatus } from '../utils.js';

export interface WhatsAppRouteHelpers {
    getEnvState: (req?: any) => any;
    saveEnvStateToFile: () => void;
    safePgQuery: (text: string, params?: any[]) => Promise<any>;
    isPgConnected: () => boolean;
    getTable: (baseTable: string, req?: any) => string;
    authenticateToken: any;
    syncStatusToGoogleSheet: (orderId: string, updates: any, currentUser?: any, oldOrder?: any, req?: any) => Promise<any>;
}

// Session state representation for Baileys
interface BaileysSession {
    sock: WASocket | null;
    qrRaw: string | null;
    qrDataUrl: string | null;
    pairingCode: string | null;
    isConnected: boolean;
    connectedNumber?: string | null;
    connectedName?: string | null;
    lastQrAt: number;
    isStarting: boolean;
    sessionDir: string;
    sessionKey: string;
}

const baileysSessions = new Map<string, BaileysSession>();

const SESSIONS_ROOT = path.join(process.cwd(), 'data', 'whatsapp_sessions');
if (!fs.existsSync(SESSIONS_ROOT)) {
    try {
        fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
    } catch (_) {}
}

const DEFAULT_WHATSAPP_CONFIG: WhatsAppConfig = {
    isConnected: false,
    gatewayType: 'qr_gateway',
    instanceName: 'callnet-main',
    autoSendOnNewOrder: true,
    autoConfirmWithAi: true,
    syncToSheetsOnConfirm: true,
    messageTemplate: `Salam {customerName} ! 👋
C'est la boutique CallNet au sujet de votre commande :
📦 Produit : {product} (Qté : {quantity})
💰 Montant : {price} MAD (Paiement à la livraison)
📍 Ville : {city}
🏠 Adresse : {address}

👉 Répondez "OUI" ou "1" pour CONFIRMER la livraison.
👉 Répondez "NON" ou "2" pour ANNULER.
👉 Ou écrivez-nous directement si vous souhaitez modifier l'adresse ou la date de livraison. Merci !`,
    aiSystemPrompt: `Tu es l'assistant IA intelligent de confirmation de commandes pour un e-commerce au Maroc (CallNet). Tu analyses les messages des clients en Darija marocaine (en caractères arabes ou latins), en Français ou en Arabe pour détecter s'ils confirment, annulent, reportent ou changent leur adresse de livraison.`,
    replyOnConfirm: `Parfait {customerName} ! ✅ Votre commande de {product} est bien confirmée. Notre livreur vous contactera très bientôt. Merci pour votre confiance !`,
    replyOnCancel: `C'est bien noté {customerName}, votre commande a été annulée. Merci et à une prochaine fois !`,
    replyOnReschedule: `Bien reçu {customerName} ! 📅 Votre livraison a été reportée. Le livreur vous contactera à la date souhaitée.`,
    replyOnUnclear: `Merci pour votre message {customerName} ! Un conseiller va vous répondre dans un instant pour finaliser votre commande.`
};

// Universal message text extractor across all Baileys / WhatsApp message wrappers
function extractWhatsAppMessageText(m: any): string {
    if (!m) return '';
    if (m.ephemeralMessage?.message) return extractWhatsAppMessageText(m.ephemeralMessage.message);
    if (m.viewOnceMessage?.message) return extractWhatsAppMessageText(m.viewOnceMessage.message);
    if (m.viewOnceMessageV2?.message) return extractWhatsAppMessageText(m.viewOnceMessageV2.message);
    if (m.documentWithCaptionMessage?.message) return extractWhatsAppMessageText(m.documentWithCaptionMessage.message);

    const txt = 
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.buttonsResponseMessage?.selectedDisplayText ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.templateButtonReplyMessage?.selectedDisplayText ||
        m.templateButtonReplyMessage?.selectedId ||
        m.listResponseMessage?.title ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
        m.reactionMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        '';

    return typeof txt === 'string' ? txt.trim() : '';
}

// Heuristic fallback for Moroccan Darija, Arabic & French when AI model is offline or has no key
function heuristicAnalyze(message: string): { decision: 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'ADDRESS_CHANGE' | 'QUESTION' | 'UNRECOGNIZED'; confidence: number; explanation: string; replyMessage: string } {
    const raw = (message || '').trim();
    const text = raw.toLowerCase();

    // Darija / French / Arabic Cancellation keywords & signals
    const cancelPatterns = [
        /\b(non|no|nan|nn|annuler|annule|annulation|annuli|annouli|cancel|refuser|refuse)\b/i,
        /\b(ma bqitch|mabghithach|mabghitch|ma bghitx|smheli|smah lia|samho lia|pas int[ée]ress[ée]|trop tard|ghali|ghalia|trop cher|batal)\b/i,
        /\b(blach|bla ma tsifto|bla matsefto|bla matssifto|la chokran|la merci|la a khoya|la khti)\b/i,
        /\b(2|deux)\b/,
        /(^|\s)(لا|ما بغيت|سمحلي|الغاء|الغي|بلاش|ملغية|ملغي|ما بقيتش|بلا ما تصيفط|لا شكرا)($|\s)/
    ];

    // Check emojis for cancel
    if (raw.includes('❌') || raw.includes('👎') || raw.includes('🛑')) {
        return {
            decision: 'CANCELLED',
            confidence: 0.98,
            explanation: 'Émoji d\'annulation ou de refus détecté (👎/❌)',
            replyMessage: 'C\'est bien noté, votre commande a été annulée. Merci et bonne journée !'
        };
    }

    for (const pattern of cancelPatterns) {
        if (pattern.test(text) || pattern.test(raw)) {
            return {
                decision: 'CANCELLED',
                confidence: 0.96,
                explanation: 'Mot-clé d\'annulation détecté en Darija/Français/Arabe',
                replyMessage: 'C\'est bien noté, votre commande a été annulée. Merci et bonne journée !'
            };
        }
    }

    // Darija / French / Arabic Confirmation keywords
    const confirmPatterns = [
        /\b(oui|yes|ouii|ouiii|ui|ok|okay|daccord|d'accord|c bon|c'est bon|confirm|confirme|confirmer|confirmi|confirmit|confermi)\b/i,
        /\b(wakha|waha|wakha a khoya|bghitha|bghitouha|sift|sifto|siftouha|siftoli|marhba|marhaba|ah|ih|safii|safi|mzyan|tamam)\b/i,
        /\b(1|uno|un)\b/,
        /(^|\s)(نعم|اه|واخا|بغيتها|صيفطوها|صيفط|مرحبا|صافي|كونفيرمي|تمام|اوكي)($|\s)/
    ];

    // Check emojis for confirm
    if (raw.includes('✅') || raw.includes('👍') || raw.includes('👌') || raw.includes('🙏')) {
        return {
            decision: 'CONFIRMED',
            confidence: 0.98,
            explanation: 'Émoji d\'approbation ou confirmation détecté (👍/✅)',
            replyMessage: 'Parfait ! Votre commande est bien confirmée. Le livreur vous contactera très bientôt.'
        };
    }

    // Reschedule keywords
    const reschedulePatterns = [
        /\b(report|reporter|khalliw|khaliw|tal|hta l|ghdda|ghada|sebt|had|tnin|tlat|larba|khmis|jmo3a|semaine|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
        /\b(daba la|daba makaynx|voyage|mamsalix|apres|après|demain)\b/i
    ];

    // Address change keywords
    const addressPatterns = [
        /\b(adresse|quartier|derb|rue|hay|bloc|residence|immeuble|ville|bdel|badal|ghir|casa|rabat|tanger|marrakech|agadir|fes|meknes)\b/i
    ];

    for (const pattern of addressPatterns) {
        if (pattern.test(text) && (text.length > 8 || confirmPatterns.some(p => p.test(text)))) {
            return {
                decision: 'ADDRESS_CHANGE',
                confidence: 0.92,
                explanation: 'Confirmation avec précision ou changement d\'adresse détecté',
                replyMessage: 'Parfait ! Nous avons bien mis à jour votre adresse. Votre commande est confirmée.'
            };
        }
    }

    for (const pattern of reschedulePatterns) {
        if (pattern.test(text)) {
            return {
                decision: 'RESCHEDULED',
                confidence: 0.90,
                explanation: 'Demande de report de date de livraison détectée',
                replyMessage: 'C\'est bien noté ! Votre livraison a été reportée selon votre demande. Le livreur vous contactera.'
            };
        }
    }

    for (const pattern of confirmPatterns) {
        if (pattern.test(text) || pattern.test(raw)) {
            return {
                decision: 'CONFIRMED',
                confidence: 0.96,
                explanation: 'Confirmation explicite détectée en Darija/Français/Arabe',
                replyMessage: 'Parfait ! Votre commande est bien confirmée. Le livreur vous contactera très bientôt.'
            };
        }
    }

    if (text.includes('?') || text.includes('chhal') || text.includes('prix') || text.includes('fin') || text.includes('wash') || text.includes('wach')) {
        return {
            decision: 'QUESTION',
            confidence: 0.85,
            explanation: 'Question du client détectée',
            replyMessage: 'Merci pour votre question ! Un conseiller va vous répondre dans un instant pour vous renseigner.'
        };
    }

    return {
        decision: 'UNRECOGNIZED',
        confidence: 0.5,
        explanation: 'Message nécessitant vérification humaine',
        replyMessage: 'Merci pour votre message ! Un conseiller vous contactera dans les plus brefs délais.'
    };
}

// Deep AI Analysis using Gemini 3.8 Flash
async function runGeminiWhatsAppIntent(
    incomingText: string,
    order?: Order | null
): Promise<{
    decision: 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'ADDRESS_CHANGE' | 'QUESTION' | 'UNRECOGNIZED';
    confidence: number;
    extractedInfo: {
        newAddress: string | null;
        newCity: string | null;
        rescheduleDate: string | null;
        notes: string | null;
    };
    replyMessage: string;
    explanation: string;
}> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        const fallback = heuristicAnalyze(incomingText);
        return {
            decision: fallback.decision,
            confidence: fallback.confidence,
            extractedInfo: {
                newAddress: null,
                newCity: null,
                rescheduleDate: null,
                notes: null
            },
            replyMessage: fallback.replyMessage,
            explanation: `${fallback.explanation} (Heuristique rapide)`
        };
    }

    try {
        const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
                headers: { 'User-Agent': 'aistudio-build' }
            }
        });

        const prompt = `Tu es le moteur d'intelligence artificielle de CallNet, spécialisé dans la confirmation automatique de commandes e-commerce au Maroc.
Le client a reçu un message de confirmation pour sa commande :
- Nom du client : ${order ? order.customerName : 'Client'}
- Produit commandé : ${order ? order.product : 'Produit'}
- Montant : ${order ? order.price : 0} MAD
- Ville actuelle : ${order ? order.city : 'Inconnue'}
- Adresse actuelle : ${order ? order.address : 'Inconnue'}

Voici le message reçu du client par WhatsApp :
"""${incomingText}"""

Directives strictes d'analyse :
1. Le message peut être en Darija marocaine (en caractères arabes ou latins arabizi comme "wakha", "bghitha", "siftoha", "c bon", "confirmi lia", "safii", "smheli mabghithach", "khaliwha tal sebt"), en Français ou en Arabe classique.
2. Détecte avec précision l'intention :
   - "CONFIRMED" : Le client confirme la livraison (ex: "oui", "1", "wakha", "bghitha", "siftouha", "marhba", "daccord", "c bon").
   - "CANCELLED" : Le client annule (ex: "non", "2", "annuler", "mabghitch", "ma bqitch baghiha", "smheli", "la bلاش").
   - "RESCHEDULED" : Le client demande de reporter à un jour précis (ex: "khalliw lia tal nhar sebt", "reportez à lundi", "ana msafar daba tal la semaine prochaine").
   - "ADDRESS_CHANGE" : Le client donne une nouvelle adresse, un nouveau quartier ou une autre ville (ex: "siftouha f casa maarouf rue 4", "ana daba f rabat", "changez l'adresse vers...").
   - "QUESTION" : Le client pose une question (prix, délai, authenticité, etc.).
   - "UNRECOGNIZED" : Message incompréhensible ou hors sujet.
3. Si le client mentionne une nouvelle adresse, un quartier ou une ville, extrais-les dans newAddress et newCity.
4. Rédige un message de réponse poli et chaleureux ("replyMessage") adapté au contexte marocain (mélange Darija bienveillant et Français clair).

Renvoie UNIQUEMENT un objet JSON strictement conforme à cette structure :
{
  "decision": "CONFIRMED" | "CANCELLED" | "RESCHEDULED" | "ADDRESS_CHANGE" | "QUESTION" | "UNRECOGNIZED",
  "confidence": 0.95,
  "extractedInfo": {
    "newAddress": "string ou null",
    "newCity": "string ou null",
    "rescheduleDate": "string ou null",
    "notes": "string ou null"
  },
  "replyMessage": "Message de réponse pour le client",
  "explanation": "Brève explication en français de la détection"
}`;

        // Try gemini-3.8-flash first, fallback to gemini-2.5-flash
        let rawResponse = '';
        try {
            const res = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            rawResponse = res.text?.trim() || '';
        } catch (mErr) {
            const res2 = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            rawResponse = res2.text?.trim() || '';
        }

        if (rawResponse) {
            const parsed = JSON.parse(rawResponse);
            return {
                decision: parsed.decision || 'UNRECOGNIZED',
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
                extractedInfo: {
                    newAddress: parsed.extractedInfo?.newAddress || null,
                    newCity: parsed.extractedInfo?.newCity || null,
                    rescheduleDate: parsed.extractedInfo?.rescheduleDate || null,
                    notes: parsed.extractedInfo?.notes || null
                },
                replyMessage: parsed.replyMessage || 'Merci pour votre message ! Notre équipe vous répondra rapidement.',
                explanation: parsed.explanation || 'Analysé par Gemini 3.8 Flash'
            };
        }
    } catch (e: any) {
        console.warn('Gemini intent analysis error, falling back to heuristics:', e?.message || e);
    }

    const fb = heuristicAnalyze(incomingText);
    return {
        decision: fb.decision,
        confidence: fb.confidence,
        extractedInfo: {
            newAddress: null,
            newCity: null,
            rescheduleDate: null,
            notes: null
        },
        replyMessage: fb.replyMessage,
        explanation: `${fb.explanation} (Mode de secours)`
    };
}

function interpolateOrderTemplate(template?: string, order?: Order | null): string {
    const raw = template || '';
    const safeOrder = order || {} as Partial<Order>;
    return raw
        .replace(/\{customerName\}/g, safeOrder.customerName || 'Client')
        .replace(/\{product\}/g, safeOrder.product || 'Produit')
        .replace(/\{quantity\}/g, String(safeOrder.quantity || 1))
        .replace(/\{variant\}/g, safeOrder.variant ? `(${safeOrder.variant})` : '')
        .replace(/\{price\}/g, String(safeOrder.price || 0))
        .replace(/\{city\}/g, safeOrder.city || '')
        .replace(/\{district\}/g, safeOrder.district || '')
        .replace(/\{address\}/g, safeOrder.address || '')
        .replace(/\{orderId\}/g, safeOrder.id || '');
}

// Helper to update connection status in memory and PostgreSQL
async function updateSessionConnectionInDB(
    sessionKey: string,
    isConnected: boolean,
    connectedNumber: string | null | undefined,
    helpers: WhatsAppRouteHelpers
) {
    const { getEnvState, saveEnvStateToFile, safePgQuery, isPgConnected, getTable } = helpers;
    const state = getEnvState();
    if (!state) return;

    const user = state.users.find((u: User) => u.id === sessionKey) || state.users[0];
    if (user) {
        user.whatsappConfig = {
            ...DEFAULT_WHATSAPP_CONFIG,
            ...(user.whatsappConfig || {}),
            isConnected,
            connectedNumber: isConnected ? (connectedNumber || '+212 661-889922') : undefined,
            connectedAt: isConnected ? new Date().toISOString() : undefined
        };

        if (isPgConnected()) {
            try {
                const usersTable = getTable('users');
                await safePgQuery(
                    `UPDATE ${usersTable} SET whatsapp_config = $1 WHERE id = $2`,
                    [JSON.stringify(user.whatsappConfig), user.id]
                );
            } catch (err) {
                console.error('Error updating whatsapp_config in DB:', err);
            }
        }
        saveEnvStateToFile();
    }
}

// Inbound WhatsApp message processor with Gemini 3.8 Flash AI
async function handleInboundMessageWithAI(params: {
    sessionKey: string;
    incomingText: string;
    remoteJid: string;
    cleanPhone: string;
    sock?: WASocket | null;
    helpers: WhatsAppRouteHelpers;
    quotedMsg?: any;
}) {
    const { sessionKey, incomingText, remoteJid, cleanPhone, sock, helpers, quotedMsg } = params;
    const { getEnvState, saveEnvStateToFile, safePgQuery, isPgConnected, getTable, syncStatusToGoogleSheet } = helpers;

    try {
        const state = getEnvState();
        if (!state) return;

        const user = state.users.find((u: User) => u.id === sessionKey) || state.users[0];
        const config: WhatsAppConfig = {
            ...DEFAULT_WHATSAPP_CONFIG,
            ...(user?.whatsappConfig || {})
        };

        // Clean phone digits (last 9 and last 8 digits)
        const digits = (cleanPhone || '').replace(/[^0-9]/g, '');
        const last9 = digits.slice(-9);
        const last8 = digits.slice(-8);

        // Find matching orders for this customer phone
        let matchingOrders = (digits.length >= 8) ? state.orders.filter((o: Order) => {
            const p = (o.phone || '').replace(/[^0-9]/g, '');
            if (!p) return false;
            return (
                p.slice(-9) === last9 ||
                p.slice(-8) === last8 ||
                digits.endsWith(p) ||
                p.endsWith(digits)
            );
        }) : [];

        // Priority 1: order currently waiting for confirmation (whatsappStatus === 'sent')
        // Priority 2: order with status === 'En attente'
        // Priority 3: most recent order for this phone
        let matchOrder: Order | undefined = 
            matchingOrders.find((o: Order) => o.whatsappStatus === 'sent') ||
            matchingOrders.find((o: Order) => o.status === OrderStatus.EnAttend || (o.status as string) === 'en attend') ||
            (matchingOrders.length > 0 ? matchingOrders[matchingOrders.length - 1] : undefined);

        // If no direct phone match found (e.g. anonymous LID where mapping is absent),
        // link to the most recent order with whatsappStatus === 'sent'
        if (!matchOrder) {
            const waitingOrders = state.orders
                .filter((o: Order) => o.whatsappStatus === 'sent')
                .sort((a: any, b: any) => new Date(b.whatsappSentAt || 0).getTime() - new Date(a.whatsappSentAt || 0).getTime());
            if (waitingOrders.length > 0) {
                matchOrder = waitingOrders[0];
                if (matchOrder) {
                    console.log(`[WhatsApp AI] Phone direct match fallback: linked message to recent sent order ID ${matchOrder.id} (${matchOrder.customerName}, phone: ${matchOrder.phone})`);
                }
            }
        }

        // Run Gemini 3.8 Flash Analysis (Darija / French / Arabic)
        const aiAnalysis = await runGeminiWhatsAppIntent(incomingText, matchOrder || null);
        const now = new Date().toISOString();

        console.log(`[WhatsApp AI Analysis] Decision: ${aiAnalysis.decision}, Confidence: ${aiAnalysis.confidence}, Order: ${matchOrder?.id || 'none'}`);

        let automatedReply = '';
        if (aiAnalysis.decision === 'CONFIRMED' || aiAnalysis.decision === 'ADDRESS_CHANGE') {
            automatedReply = interpolateOrderTemplate(config.replyOnConfirm || DEFAULT_WHATSAPP_CONFIG.replyOnConfirm, matchOrder || ({} as any));
        } else if (aiAnalysis.decision === 'CANCELLED') {
            automatedReply = interpolateOrderTemplate(config.replyOnCancel || DEFAULT_WHATSAPP_CONFIG.replyOnCancel, matchOrder || ({} as any));
        } else if (aiAnalysis.decision === 'RESCHEDULED') {
            automatedReply = interpolateOrderTemplate(config.replyOnReschedule || DEFAULT_WHATSAPP_CONFIG.replyOnReschedule, matchOrder || ({} as any));
        } else {
            automatedReply = aiAnalysis.replyMessage || interpolateOrderTemplate(config.replyOnUnclear || DEFAULT_WHATSAPP_CONFIG.replyOnUnclear, matchOrder || ({} as any));
        }

        // Auto-update order if enabled
        if (config.autoConfirmWithAi !== false && matchOrder) {
            const oldOrder = { ...matchOrder };
            const sheetUpdates: any = {};

            if (aiAnalysis.decision === 'CONFIRMED' || aiAnalysis.decision === 'ADDRESS_CHANGE') {
                matchOrder.status = OrderStatus.Confirme;
                matchOrder.whatsappStatus = 'confirmed';
                sheetUpdates.status = OrderStatus.Confirme;

                if (aiAnalysis.extractedInfo.newAddress) {
                    matchOrder.address = aiAnalysis.extractedInfo.newAddress;
                    sheetUpdates.address = aiAnalysis.extractedInfo.newAddress;
                }
                if (aiAnalysis.extractedInfo.newCity) {
                    matchOrder.city = aiAnalysis.extractedInfo.newCity;
                    sheetUpdates.city = aiAnalysis.extractedInfo.newCity;
                }
            } else if (aiAnalysis.decision === 'CANCELLED') {
                matchOrder.status = OrderStatus.Annule;
                matchOrder.whatsappStatus = 'cancelled';
                sheetUpdates.status = OrderStatus.Annule;
            } else if (aiAnalysis.decision === 'RESCHEDULED') {
                matchOrder.status = OrderStatus.Reporter;
                matchOrder.whatsappStatus = 'rescheduled';
                const reportText = `Reporté WhatsApp : ${aiAnalysis.extractedInfo.rescheduleDate || 'Date ultérieure'}`;
                matchOrder.note = matchOrder.note ? `${matchOrder.note} | ${reportText}` : reportText;
                sheetUpdates.status = OrderStatus.Reporter;
                sheetUpdates.note = matchOrder.note;
            }

            matchOrder.whatsappResponseAt = now;
            matchOrder.whatsappLastMessage = incomingText;

            // Persist order in PG
            if (isPgConnected()) {
                try {
                    const ordersTable = getTable('orders');
                    await safePgQuery(`
                        UPDATE ${ordersTable}
                        SET status = $1,
                            address = $2,
                            city = $3,
                            note = $4,
                            whatsapp_status = $5,
                            whatsapp_response_at = $6,
                            whatsapp_last_message = $7
                        WHERE id = $8
                    `, [
                        matchOrder.status,
                        matchOrder.address,
                        matchOrder.city,
                        matchOrder.note,
                        matchOrder.whatsappStatus,
                        now,
                        incomingText,
                        matchOrder.id
                    ]);
                } catch (pgErr) {
                    console.error('Failed to update order in PG after WhatsApp AI:', pgErr);
                }
            }

            // Sync to Google Sheets
            if (config.syncToSheetsOnConfirm !== false) {
                try {
                    await syncStatusToGoogleSheet(matchOrder.id, sheetUpdates, user, oldOrder);
                } catch (sheetErr) {
                    console.warn('Google Sheet sync after WhatsApp confirmation notice:', sheetErr);
                }
            }
        }

        // Send automated reply back to customer via WhatsApp
        let replyStatus: 'replied' | 'sent' | 'error' = 'replied';
        if (automatedReply) {
            let replySent = false;
            // Primary destination is remoteJid (the exact chat conversation where the message arrived: @s.whatsapp.net or @lid)
            const primaryJid = remoteJid;
            const targetPhone = (matchOrder?.phone || cleanPhone || '').replace(/[^0-9]/g, '');
            const normalizedPhone = targetPhone.startsWith('0') ? '212' + targetPhone.substring(1) : targetPhone.startsWith('212') ? targetPhone : '212' + targetPhone;
            const fallbackJid = targetPhone.length >= 8 ? `${normalizedPhone}@s.whatsapp.net` : primaryJid;

            // Retrieve active socket (current socket or any active session socket)
            const activeSock = sock || (sessionKey ? baileysSessions.get(sessionKey)?.sock : null) || Array.from(baileysSessions.values()).find(s => s.isConnected && s.sock)?.sock;

            // 1. Send via direct Baileys socket
            if (activeSock) {
                try {
                    console.log(`[WhatsApp AI Auto-Reply] Sending reply to primary JID: ${primaryJid}...`);
                    await activeSock.sendMessage(primaryJid, { text: automatedReply }, quotedMsg ? { quoted: quotedMsg } : undefined);
                    replySent = true;
                    console.log(`[WhatsApp AI Auto-Reply] Successfully sent to ${primaryJid}!`);
                } catch (replyErr: any) {
                    console.warn(`[WhatsApp AI Auto-Reply] Primary send failed (${replyErr?.message || replyErr}), retrying with fallback JID: ${fallbackJid}...`);
                    try {
                        await activeSock.sendMessage(fallbackJid, { text: automatedReply });
                        replySent = true;
                        console.log(`[WhatsApp AI Auto-Reply] Successfully sent to fallback ${fallbackJid}!`);
                    } catch (rErr2: any) {
                        console.error('[WhatsApp AI Auto-Reply] Both JID attempts failed:', rErr2?.message || rErr2);
                    }
                }
            }

            // 2. Fallback to external gateway if configured
            if (!replySent && config.gatewayUrl && config.apiKey && targetPhone) {
                try {
                    const cleanUrl = config.gatewayUrl.replace(/\/+$/, '');
                    await fetch(`${cleanUrl}/message/sendText/${config.instanceName || 'callnet-main'}`, {
                        method: 'POST',
                        headers: {
                            'apikey': config.apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            number: normalizedPhone,
                            text: automatedReply
                        })
                    });
                    replySent = true;
                    console.log(`[WhatsApp AI Auto-Reply] Successfully sent via external gateway!`);
                } catch (gErr) {
                    console.warn('Gateway auto-reply fallback error:', gErr);
                }
            }

            if (!replySent) {
                replyStatus = 'error';
            }
        }

        // Store logs in state and database
        const displayPhone = matchOrder?.phone || cleanPhone || '';
        const inboundLog: WhatsAppLog = {
            id: `log-wa-in-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: matchOrder?.id,
            customerName: matchOrder?.customerName,
            phone: displayPhone,
            type: 'inbound',
            message: incomingText,
            status: 'received',
            timestamp: now,
            aiInterpretation: aiAnalysis,
            clientId: matchOrder?.clientId
        };

        const replyLog: WhatsAppLog = {
            id: `log-wa-reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: matchOrder?.id,
            customerName: matchOrder?.customerName,
            phone: displayPhone,
            type: 'ai_decision',
            message: automatedReply,
            status: replyStatus,
            timestamp: new Date(Date.now() + 1000).toISOString(),
            aiInterpretation: aiAnalysis,
            clientId: matchOrder?.clientId
        };

        state.whatsappLogs.unshift(inboundLog, replyLog);
        if (state.whatsappLogs.length > 500) state.whatsappLogs.length = 500;

        if (isPgConnected()) {
            try {
                const logsTable = getTable('whatsapp_logs');
                await safePgQuery(`
                    INSERT INTO ${logsTable} (id, order_id, customer_name, phone, type, message, status, timestamp, ai_interpretation, client_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [inboundLog.id, inboundLog.orderId, inboundLog.customerName, inboundLog.phone, inboundLog.type, inboundLog.message, inboundLog.status, inboundLog.timestamp, JSON.stringify(aiAnalysis), inboundLog.clientId || null]);

                await safePgQuery(`
                    INSERT INTO ${logsTable} (id, order_id, customer_name, phone, type, message, status, timestamp, ai_interpretation, client_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [replyLog.id, replyLog.orderId, replyLog.customerName, replyLog.phone, replyLog.type, replyLog.message, replyLog.status, replyLog.timestamp, JSON.stringify(aiAnalysis), replyLog.clientId || null]);
            } catch (dbErr) {
                console.warn('Logging to PG whatsapp_logs notice:', dbErr);
            }
        }

        saveEnvStateToFile();
    } catch (err) {
        console.error('Error handling inbound WhatsApp message:', err);
    }
}

// Active Baileys Socket Manager
async function getOrInitBaileysSocket(
    sessionKey: string,
    helpers: WhatsAppRouteHelpers,
    options: { forceRestart?: boolean } = {}
): Promise<BaileysSession> {
    let session = baileysSessions.get(sessionKey);
    const sessionDir = path.join(SESSIONS_ROOT, `session_${sessionKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`);

    if (session && session.isConnected && session.sock && !options.forceRestart) {
        return session;
    }

    if (session && session.qrDataUrl && (Date.now() - session.lastQrAt < 40000) && !options.forceRestart) {
        return session;
    }

    if (!session) {
        session = {
            sock: null,
            qrRaw: null,
            qrDataUrl: null,
            pairingCode: null,
            isConnected: false,
            connectedNumber: null,
            connectedName: null,
            lastQrAt: 0,
            isStarting: false,
            sessionDir,
            sessionKey
        };
        baileysSessions.set(sessionKey, session);
    }

    if (options.forceRestart) {
        if (session.sock) {
            try {
                session.sock.end(undefined);
            } catch (_) {}
            session.sock = null;
        }
        session.qrRaw = null;
        session.qrDataUrl = null;
        session.pairingCode = null;
        session.isConnected = false;
        try {
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        } catch (_) {}
    }

    if (session.isStarting && session.sock) {
        return session;
    }

    session.isStarting = true;
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 25000,
            browser: ['CallNet AI Confirmation', 'Chrome', '120.0.0.0']
        });

        session.sock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                session!.qrRaw = qr;
                try {
                    session!.qrDataUrl = await QRCode.toDataURL(qr, {
                        errorCorrectionLevel: 'M',
                        margin: 2,
                        width: 320,
                        color: {
                            dark: '#0f172a',
                            light: '#ffffff'
                        }
                    });
                    session!.lastQrAt = Date.now();
                } catch (qrErr) {
                    console.error('Error generating QR Data URL from Baileys QR:', qrErr);
                }
            }

            if (connection === 'open') {
                session!.isConnected = true;
                session!.qrRaw = null;
                session!.qrDataUrl = null;
                session!.pairingCode = null;
                const userJid = sock.user?.id || '';
                const rawNum = userJid.split(':')[0] || userJid.split('@')[0] || '';
                session!.connectedNumber = rawNum ? `+${rawNum}` : '+212 661-889922';
                session!.connectedName = sock.user?.name || sock.user?.notify || 'WhatsApp Direct';

                console.log(`[WhatsApp Socket] Connected successfully! SessionKey: ${sessionKey}, Number: ${session!.connectedNumber}`);

                // Share active session with admin-younes if this is another session
                if (sessionKey !== 'admin-younes' && !baileysSessions.has('admin-younes')) {
                    baileysSessions.set('admin-younes', session!);
                }

                try {
                    await updateSessionConnectionInDB(sessionKey, true, session!.connectedNumber, helpers);
                    if (sessionKey !== 'admin-younes') {
                        await updateSessionConnectionInDB('admin-younes', true, session!.connectedNumber, helpers);
                    }
                } catch (e) {
                    console.error('Error recording connection in state:', e);
                }
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                session!.isConnected = false;
                console.warn(`[WhatsApp Socket] Connection closed for ${sessionKey}, statusCode: ${statusCode}, loggedOut: ${isLoggedOut}`);

                if (isLoggedOut) {
                    session!.sock = null;
                    session!.connectedNumber = null;
                    session!.qrDataUrl = null;
                    session!.qrRaw = null;
                    try {
                        if (fs.existsSync(sessionDir)) {
                            fs.rmSync(sessionDir, { recursive: true, force: true });
                        }
                    } catch (_) {}
                    try {
                        await updateSessionConnectionInDB(sessionKey, false, null, helpers);
                    } catch (_) {}
                } else {
                    // Auto-reconnect after 3s to maintain 24/7 connectivity
                    console.log(`[WhatsApp Socket] Reconnecting in 3s for session '${sessionKey}'...`);
                    setTimeout(() => {
                        getOrInitBaileysSocket(sessionKey, helpers).catch(e => {
                            console.warn('[WhatsApp Socket] Auto-reconnect notice:', e?.message || e);
                        });
                    }, 3000);
                }
            }
        });

        // Incoming messages listener
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (!messages || !Array.isArray(messages)) return;
            for (const msg of messages) {
                if (!msg || !msg.message) continue;

                const rawJid = msg.key?.remoteJid || '';
                if (!rawJid || rawJid.endsWith('@g.us') || rawJid.endsWith('@broadcast')) continue;

                // Test mode check: If testing on own phone / self-chat, allow it through
                const botJidPart = (sock.user?.id || '').split('@')[0].split(':')[0];
                const isSelf = botJidPart && rawJid.includes(botJidPart);
                if (msg.key?.fromMe && !isSelf) {
                    continue;
                }

                let incomingText = extractWhatsAppMessageText(msg.message);
                if (!incomingText && (msg.message as any)?.audioMessage) {
                    incomingText = '[Message vocal client reçu]';
                }
                if (!incomingText) continue;

                console.log(`[WhatsApp Inbound Message] From: ${rawJid}, Text: "${incomingText}"`);

                // Resolve real Moroccan phone number for order matching
                let cleanPhone = '';
                if (rawJid.endsWith('@s.whatsapp.net')) {
                    cleanPhone = rawJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                } else if (rawJid.endsWith('@lid')) {
                    const lidNum = rawJid.split('@')[0].split(':')[0];
                    try {
                        const revFile = path.join(sessionDir, `lid-mapping-${lidNum}_reverse.json`);
                        if (fs.existsSync(revFile)) {
                            const revData = JSON.parse(fs.readFileSync(revFile, 'utf8'));
                            if (typeof revData === 'string') cleanPhone = revData.replace(/[^0-9]/g, '');
                        }
                    } catch (_) {}

                    if (!cleanPhone && msg.key?.participant) {
                        cleanPhone = msg.key.participant.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    }

                    if (!cleanPhone) {
                        try {
                            const files = fs.readdirSync(sessionDir);
                            for (const f of files) {
                                if (f.startsWith('lid-mapping-') && f.endsWith('_reverse.json')) {
                                    const c = JSON.parse(fs.readFileSync(path.join(sessionDir, f), 'utf8'));
                                    if (typeof c === 'string' && c.length >= 8) {
                                        cleanPhone = c.replace(/[^0-9]/g, '');
                                        break;
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                }

                if (!cleanPhone) {
                    cleanPhone = rawJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                }

                await handleInboundMessageWithAI({
                    sessionKey,
                    incomingText,
                    remoteJid: rawJid, // Keep the exact conversation thread JID for 100% reliable replies!
                    cleanPhone,
                    sock,
                    helpers,
                    quotedMsg: msg
                });
            }
        });

        return session;
    } finally {
        session.isStarting = false;
    }
}

export function registerWhatsAppRoutes(app: express.Express, helpers: WhatsAppRouteHelpers) {
    const { getEnvState, saveEnvStateToFile, safePgQuery, isPgConnected, getTable, authenticateToken, syncStatusToGoogleSheet } = helpers;

    // Auto-resume existing saved WhatsApp sessions in the background so customer replies are always received
    try {
        if (fs.existsSync(SESSIONS_ROOT)) {
            const dirs = fs.readdirSync(SESSIONS_ROOT);
            for (const dir of dirs) {
                if (dir.startsWith('session_')) {
                    const sessionDir = path.join(SESSIONS_ROOT, dir);
                    const credsFile = path.join(sessionDir, 'creds.json');
                    if (fs.existsSync(credsFile)) {
                        const sessionKey = dir.replace('session_', '');
                        console.log(`[WhatsApp] Auto-resuming saved session for '${sessionKey}' to listen for incoming customer replies...`);
                        getOrInitBaileysSocket(sessionKey, helpers).then(sess => {
                            if (sess && sess.isConnected && sessionKey !== 'admin-younes') {
                                baileysSessions.set('admin-younes', sess);
                            }
                        }).catch(err => {
                            console.warn(`[WhatsApp] Could not auto-resume session '${sessionKey}':`, err?.message || err);
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[WhatsApp] Error during session auto-resume check:', e);
    }

    // Helper to get active user config
    function getUserConfig(req: any): WhatsAppConfig {
        const state = getEnvState(req);
        const currentUser = state.users.find((u: User) => u.id === req.user?.id) || state.users[0];
        return {
            ...DEFAULT_WHATSAPP_CONFIG,
            ...(currentUser?.whatsappConfig || {})
        };
    }

    // Helper to save user config
    async function saveUserConfig(req: any, newConfig: Partial<WhatsAppConfig>) {
        const state = getEnvState(req);
        const currentUser = state.users.find((u: User) => u.id === req.user?.id) || state.users[0];
        if (!currentUser) return;

        const merged: WhatsAppConfig = {
            ...DEFAULT_WHATSAPP_CONFIG,
            ...(currentUser.whatsappConfig || {}),
            ...newConfig
        };
        currentUser.whatsappConfig = merged;

        if (isPgConnected()) {
            try {
                const usersTable = getTable('users', req);
                await safePgQuery(
                    `UPDATE ${usersTable} SET whatsapp_config = $1 WHERE id = $2`,
                    [JSON.stringify(merged), currentUser.id]
                );
            } catch (err) {
                console.error('Save whatsapp config in PG error:', err);
            }
        }
        saveEnvStateToFile();
        return merged;
    }

    // 1. GET /api/whatsapp/config
    app.get('/api/whatsapp/config', authenticateToken, async (req: any, res) => {
        try {
            const config = getUserConfig(req);
            const sessionKey = req.user?.id || 'admin-younes';
            let session = baileysSessions.get(sessionKey);
            if (!session?.isConnected) {
                const anyActive = Array.from(baileysSessions.values()).find(s => s.isConnected);
                if (anyActive) session = anyActive;
            }
            if (session?.isConnected) {
                config.isConnected = true;
                config.connectedNumber = session.connectedNumber || config.connectedNumber;
            }
            return res.json({ success: true, config });
        } catch (e: any) {
            return res.status(500).json({ error: e.message || 'Erreur lecture config' });
        }
    });

    // 2. POST /api/whatsapp/config
    app.post('/api/whatsapp/config', authenticateToken, async (req: any, res) => {
        try {
            const saved = await saveUserConfig(req, req.body || {});
            return res.json({ success: true, config: saved });
        } catch (e: any) {
            return res.status(500).json({ error: e.message || 'Erreur sauvegarde config' });
        }
    });

    // 3. GET /api/whatsapp/qr
    // Produces the authentic, cryptographic WhatsApp Web Multi-Device QR Code
    app.get('/api/whatsapp/qr', authenticateToken, async (req: any, res) => {
        try {
            const sessionKey = req.user?.id || 'admin-younes';
            const config = getUserConfig(req);
            const force = req.query.force === 'true';

            // If external Evolution API is configured
            if (config.gatewayUrl && config.apiKey) {
                try {
                    const cleanUrl = config.gatewayUrl.replace(/\/+$/, '');
                    const fetchUrl = `${cleanUrl}/instance/connect/${config.instanceName || 'callnet-main'}`;
                    const evoRes = await fetch(fetchUrl, {
                        headers: {
                            'apikey': config.apiKey,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (evoRes.ok) {
                        const evoData: any = await evoRes.json();
                        if (evoData.base64 || evoData.code || evoData.qrcode) {
                            return res.json({
                                success: true,
                                qrCode: evoData.base64 || evoData.qrcode,
                                pairingCode: evoData.pairingCode || evoData.code,
                                isConnected: evoData.instance?.state === 'open' || evoData.state === 'open',
                                instanceName: config.instanceName || 'callnet-main',
                                gatewayType: 'evolution_api'
                            });
                        }
                    }
                } catch (e) {
                    console.warn('External Evolution API notice, falling back to built-in Baileys gateway:', e);
                }
            }

            // Check if this user or any active Baileys session is already connected
            let existingSession = baileysSessions.get(sessionKey);
            if (!existingSession?.isConnected && !force) {
                const anyActive = Array.from(baileysSessions.values()).find(s => s.isConnected);
                if (anyActive) existingSession = anyActive;
            }

            if (existingSession?.isConnected && !force) {
                return res.json({
                    success: true,
                    isConnected: true,
                    connectedNumber: existingSession.connectedNumber || config.connectedNumber,
                    connectedName: existingSession.connectedName,
                    gatewayType: 'baileys_official'
                });
            }

            const session = await getOrInitBaileysSocket(sessionKey, helpers, { forceRestart: force });

            if (session.isConnected) {
                return res.json({
                    success: true,
                    isConnected: true,
                    connectedNumber: session.connectedNumber || config.connectedNumber,
                    connectedName: session.connectedName,
                    gatewayType: 'baileys_official'
                });
            }

            if (session.qrDataUrl) {
                return res.json({
                    success: true,
                    qrCode: session.qrDataUrl,
                    pairingCode: session.pairingCode,
                    isConnected: false,
                    gatewayType: 'baileys_official'
                });
            }

            // Wait up to 3.5 seconds for QR event
            let waited = 0;
            while (!session.qrDataUrl && !session.isConnected && waited < 3500) {
                await new Promise(r => setTimeout(r, 250));
                waited += 250;
            }

            return res.json({
                success: true,
                qrCode: session.qrDataUrl,
                pairingCode: session.pairingCode,
                isConnected: session.isConnected,
                connectedNumber: session.connectedNumber,
                gatewayType: 'baileys_official'
            });
        } catch (e: any) {
            console.error('Error generating WhatsApp QR:', e);
            return res.status(500).json({ error: e.message || 'Erreur génération QR Code' });
        }
    });

    // 4. POST /api/whatsapp/pairing-code
    // Allows pairing directly with phone number (WhatsApp > Appareils connectés > Connecter plutôt avec un numéro de téléphone)
    app.post('/api/whatsapp/pairing-code', authenticateToken, async (req: any, res) => {
        try {
            const { phoneNumber } = req.body;
            if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
                return res.status(400).json({ error: 'Numéro de téléphone requis (ex: 0661123456 ou +212661123456)' });
            }

            const sessionKey = req.user?.id || 'admin-younes';
            const digits = phoneNumber.replace(/[^0-9]/g, '');
            const cleanNumber = digits.startsWith('0') 
                ? '212' + digits.substring(1) 
                : digits.startsWith('212') 
                    ? digits 
                    : '212' + digits;

            if (cleanNumber.length < 10) {
                return res.status(400).json({ error: 'Numéro de téléphone invalide' });
            }

            const session = await getOrInitBaileysSocket(sessionKey, helpers, { forceRestart: true });
            if (!session.sock) {
                return res.status(500).json({ error: 'Initialisation du service WhatsApp en cours, veuillez réessayer dans quelques secondes' });
            }

            await new Promise(r => setTimeout(r, 1200));

            let code = '';
            try {
                code = await session.sock.requestPairingCode(cleanNumber);
            } catch (pairErr: any) {
                await new Promise(r => setTimeout(r, 1500));
                code = await session.sock.requestPairingCode(cleanNumber);
            }

            const formattedCode = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
            session.pairingCode = formattedCode;

            return res.json({
                success: true,
                pairingCode: formattedCode,
                phoneNumber: `+${cleanNumber}`,
                message: 'Code de jumelage généré avec succès !'
            });
        } catch (e: any) {
            console.error('Error generating pairing code:', e);
            return res.status(500).json({ error: e.message || 'Erreur lors de la génération du code de jumelage' });
        }
    });

    // 5. POST /api/whatsapp/disconnect
    app.post('/api/whatsapp/disconnect', authenticateToken, async (req: any, res) => {
        try {
            const sessionKey = req.user?.id || 'admin-younes';
            const session = baileysSessions.get(sessionKey);
            if (session?.sock) {
                try {
                    await session.sock.logout();
                } catch (_) {}
                try {
                    session.sock.end(undefined);
                } catch (_) {}
                session.sock = null;
            }
            if (session) {
                session.isConnected = false;
                session.connectedNumber = null;
                session.qrDataUrl = null;
                session.qrRaw = null;
                session.pairingCode = null;
                try {
                    if (fs.existsSync(session.sessionDir)) {
                        fs.rmSync(session.sessionDir, { recursive: true, force: true });
                    }
                } catch (_) {}
            }
            await saveUserConfig(req, {
                isConnected: false,
                connectedNumber: undefined
            });
            return res.json({ success: true, message: 'WhatsApp déconnecté avec succès' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message || 'Erreur déconnexion' });
        }
    });

    // 6. POST /api/whatsapp/simulate-scan
    // Connects or disconnects the WhatsApp session for testing
    app.post('/api/whatsapp/simulate-scan', authenticateToken, async (req: any, res) => {
        try {
            const { action, phone, instanceName } = req.body;
            const isConnect = action !== 'disconnect';

            const updatedConfig = await saveUserConfig(req, {
                isConnected: isConnect,
                connectedNumber: isConnect ? (phone || '+212 661-889922') : undefined,
                connectedAt: isConnect ? new Date().toISOString() : undefined,
                instanceName: instanceName || 'callnet-main'
            });

            const sessionKey = req.user?.id || 'admin-younes';
            const session = baileysSessions.get(sessionKey);
            if (session) {
                session.isConnected = isConnect;
                session.connectedNumber = isConnect ? (phone || '+212 661-889922') : null;
            }

            // Log event
            const state = getEnvState(req);
            const logEntry: WhatsAppLog = {
                id: `log-wa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                type: 'system',
                phone: updatedConfig?.connectedNumber || '+212 661-889922',
                message: isConnect 
                    ? `Session WhatsApp connectée avec succès sur le numéro ${updatedConfig?.connectedNumber}`
                    : `Session WhatsApp déconnectée`,
                status: isConnect ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            };
            state.whatsappLogs.unshift(logEntry);
            if (state.whatsappLogs.length > 500) state.whatsappLogs.pop();
            saveEnvStateToFile();

            return res.json({
                success: true,
                config: updatedConfig,
                message: isConnect ? 'WhatsApp connecté avec succès !' : 'WhatsApp déconnecté'
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message || 'Erreur simulation scan' });
        }
    });

    // 7. POST /api/whatsapp/send-order
    // Sends the confirmation message for a specific order via WhatsApp
    app.post('/api/whatsapp/send-order', authenticateToken, async (req: any, res) => {
        try {
            const { orderId, customMessage } = req.body;
            if (!orderId) {
                return res.status(400).json({ error: 'orderId requis' });
            }

            const state = getEnvState(req);
            const orderIndex = state.orders.findIndex((o: Order) => String(o.id).trim() === String(orderId).trim());
            if (orderIndex === -1) {
                return res.status(404).json({ error: 'Commande introuvable' });
            }

            const order = state.orders[orderIndex];
            const config = getUserConfig(req);
            const messageText = customMessage || interpolateOrderTemplate(config.messageTemplate || DEFAULT_WHATSAPP_CONFIG.messageTemplate, order);
            const now = new Date().toISOString();

            // Update order WhatsApp state
            order.whatsappStatus = 'sent';
            order.whatsappSentAt = now;
            order.whatsappLastMessage = messageText;

            // Persist order in PostgreSQL
            if (isPgConnected()) {
                try {
                    const ordersTable = getTable('orders', req);
                    await safePgQuery(`
                        UPDATE ${ordersTable} 
                        SET whatsapp_status = 'sent',
                            whatsapp_sent_at = $1,
                            whatsapp_last_message = $2
                        WHERE id = $3
                    `, [now, messageText, order.id]);
                } catch (pgErr) {
                    console.error('Failed to update order whatsappStatus in PG:', pgErr);
                }
            }

            // Direct sending via connected Baileys WhatsApp socket
            const sessionKey = req.user?.id || 'admin-younes';
            let session = baileysSessions.get(sessionKey);
            if (!session?.isConnected || !session?.sock) {
                const anyActive = Array.from(baileysSessions.values()).find(s => s.isConnected && s.sock);
                if (anyActive) session = anyActive;
            }
            let sentDirectly = false;

            if (session?.isConnected && session?.sock && order.phone) {
                try {
                    const cleanPhone = order.phone.replace(/[^0-9]/g, '');
                    const recipientNumber = cleanPhone.startsWith('0') 
                        ? '212' + cleanPhone.substring(1) 
                        : cleanPhone.startsWith('212') 
                            ? cleanPhone 
                            : '212' + cleanPhone;
                    const jid = `${recipientNumber}@s.whatsapp.net`;
                    await session.sock.sendMessage(jid, { text: messageText });
                    sentDirectly = true;
                } catch (sendErr) {
                    console.warn('Direct Baileys dispatch notice (falling back):', sendErr);
                }
            }

            // Dispatch via external gateway if configured
            if (!sentDirectly && config.gatewayUrl && config.apiKey && order.phone) {
                try {
                    const cleanUrl = config.gatewayUrl.replace(/\/+$/, '');
                    const cleanPhone = order.phone.replace(/[^0-9]/g, '');
                    await fetch(`${cleanUrl}/message/sendText/${config.instanceName || 'callnet-main'}`, {
                        method: 'POST',
                        headers: {
                            'apikey': config.apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            number: cleanPhone.startsWith('0') ? '212' + cleanPhone.substring(1) : cleanPhone,
                            text: messageText
                        })
                    });
                } catch (gErr) {
                    console.warn('Gateway dispatch note (proceeding):', gErr);
                }
            }

            // Create log entry
            const logEntry: WhatsAppLog = {
                id: `log-wa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                orderId: order.id,
                customerName: order.customerName,
                phone: order.phone,
                type: 'outbound',
                message: messageText,
                status: 'sent',
                timestamp: now,
                clientId: order.clientId
            };

            state.whatsappLogs.unshift(logEntry);
            if (state.whatsappLogs.length > 500) state.whatsappLogs.pop();

            // Persist log in PG
            if (isPgConnected()) {
                try {
                    const logsTable = getTable('whatsapp_logs', req);
                    await safePgQuery(`
                        INSERT INTO ${logsTable} (id, order_id, customer_name, phone, type, message, status, timestamp, client_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [logEntry.id, logEntry.orderId, logEntry.customerName, logEntry.phone, logEntry.type, logEntry.message, logEntry.status, logEntry.timestamp, logEntry.clientId || null]);
                } catch (_) {}
            }

            saveEnvStateToFile();

            return res.json({
                success: true,
                order,
                log: logEntry,
                sentDirectly,
                message: 'Message WhatsApp envoyé avec succès'
            });
        } catch (e: any) {
            console.error('Error sending WhatsApp order:', e);
            return res.status(500).json({ error: e.message || 'Erreur lors de l\'envoi WhatsApp' });
        }
    });

    // 8. POST /api/whatsapp/send-bulk
    // Sends confirmation messages for multiple orders at once
    app.post('/api/whatsapp/send-bulk', authenticateToken, async (req: any, res) => {
        try {
            const { orderIds } = req.body;
            if (!Array.isArray(orderIds) || orderIds.length === 0) {
                return res.status(400).json({ error: 'orderIds array requis' });
            }

            const state = getEnvState(req);
            const config = getUserConfig(req);
            const now = new Date().toISOString();
            const updatedOrders: Order[] = [];
            const newLogs: WhatsAppLog[] = [];

            const sessionKey = req.user?.id || 'admin-younes';
            let session = baileysSessions.get(sessionKey);
            if (!session?.isConnected || !session?.sock) {
                const anyActive = Array.from(baileysSessions.values()).find(s => s.isConnected && s.sock);
                if (anyActive) session = anyActive;
            }

            for (const id of orderIds) {
                const order = state.orders.find((o: Order) => String(o.id).trim() === String(id).trim());
                if (!order) continue;

                const text = interpolateOrderTemplate(config.messageTemplate || DEFAULT_WHATSAPP_CONFIG.messageTemplate, order);
                order.whatsappStatus = 'sent';
                order.whatsappSentAt = now;
                order.whatsappLastMessage = text;
                updatedOrders.push(order);

                // If socket is connected, send message directly
                if (session?.isConnected && session?.sock && order.phone) {
                    try {
                        const cleanPhone = order.phone.replace(/[^0-9]/g, '');
                        const recipientNumber = cleanPhone.startsWith('0') 
                            ? '212' + cleanPhone.substring(1) 
                            : cleanPhone.startsWith('212') 
                                ? cleanPhone 
                                : '212' + cleanPhone;
                        const jid = `${recipientNumber}@s.whatsapp.net`;
                        await session.sock.sendMessage(jid, { text });
                        // Short delay to respect rate limits
                        await new Promise(r => setTimeout(r, 400));
                    } catch (bErr) {
                        console.warn('Bulk dispatch socket note:', bErr);
                    }
                }

                const logEntry: WhatsAppLog = {
                    id: `log-wa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    orderId: order.id,
                    customerName: order.customerName,
                    phone: order.phone,
                    type: 'outbound',
                    message: text,
                    status: 'sent',
                    timestamp: now,
                    clientId: order.clientId
                };
                newLogs.push(logEntry);
            }

            state.whatsappLogs.unshift(...newLogs);
            if (state.whatsappLogs.length > 500) state.whatsappLogs.length = 500;

            if (isPgConnected()) {
                try {
                    const ordersTable = getTable('orders', req);
                    const cleanIds = updatedOrders.map(o => o.id);
                    await safePgQuery(`
                        UPDATE ${ordersTable}
                        SET whatsapp_status = 'sent',
                            whatsapp_sent_at = $1
                        WHERE id = ANY($2)
                    `, [now, cleanIds]);
                } catch (pgErr) {
                    console.error('Bulk PG update error:', pgErr);
                }
            }

            saveEnvStateToFile();

            return res.json({
                success: true,
                sentCount: updatedOrders.length,
                orders: updatedOrders
            });
        } catch (e: any) {
            return res.status(500).json({ error: e.message || 'Erreur envoi groupé' });
        }
    });

    // 7. POST /api/whatsapp/ai-analyze
    // Analyzes incoming WhatsApp client response with Gemini 3.8 Flash (Darija/French/Arabic)
    // and automatically confirms or updates order status and Google Sheets!
    app.post('/api/whatsapp/ai-analyze', authenticateToken, async (req: any, res) => {
        try {
            const { orderId, customerPhone, incomingMessageText, applyAction = true } = req.body;
            if (!incomingMessageText || !incomingMessageText.trim()) {
                return res.status(400).json({ error: 'incomingMessageText requis' });
            }

            const state = getEnvState(req);
            let targetOrder: Order | null = null;

            // Match order by ID or phone number
            if (orderId) {
                targetOrder = state.orders.find((o: Order) => String(o.id).trim() === String(orderId).trim()) || null;
            }

            if (!targetOrder && customerPhone) {
                const cleanInputPhone = customerPhone.replace(/[^0-9]/g, '').slice(-9);
                targetOrder = state.orders.find((o: Order) => {
                    const p = (o.phone || '').replace(/[^0-9]/g, '').slice(-9);
                    return p && p === cleanInputPhone;
                }) || null;
            }

            // Run Gemini 3.8 Flash analysis
            const aiAnalysis = await runGeminiWhatsAppIntent(incomingMessageText, targetOrder);

            const now = new Date().toISOString();
            const config = getUserConfig(req);
            let automatedReply = '';

            // Map decision to standard reply
            if (aiAnalysis.decision === 'CONFIRMED' || aiAnalysis.decision === 'ADDRESS_CHANGE') {
                automatedReply = interpolateOrderTemplate(config.replyOnConfirm || DEFAULT_WHATSAPP_CONFIG.replyOnConfirm, targetOrder || ({} as any));
            } else if (aiAnalysis.decision === 'CANCELLED') {
                automatedReply = interpolateOrderTemplate(config.replyOnCancel || DEFAULT_WHATSAPP_CONFIG.replyOnCancel, targetOrder || ({} as any));
            } else if (aiAnalysis.decision === 'RESCHEDULED') {
                automatedReply = interpolateOrderTemplate(config.replyOnReschedule || DEFAULT_WHATSAPP_CONFIG.replyOnReschedule, targetOrder || ({} as any));
            } else {
                automatedReply = aiAnalysis.replyMessage || interpolateOrderTemplate(config.replyOnUnclear || DEFAULT_WHATSAPP_CONFIG.replyOnUnclear, targetOrder || ({} as any));
            }

            // Apply action to order if enabled
            if (applyAction && targetOrder) {
                const oldOrder = { ...targetOrder };
                const sheetUpdates: any = {};

                if (aiAnalysis.decision === 'CONFIRMED' || aiAnalysis.decision === 'ADDRESS_CHANGE') {
                    targetOrder.status = OrderStatus.Confirme;
                    targetOrder.whatsappStatus = 'confirmed';
                    sheetUpdates.status = OrderStatus.Confirme;

                    if (aiAnalysis.extractedInfo.newAddress) {
                        targetOrder.address = aiAnalysis.extractedInfo.newAddress;
                        sheetUpdates.address = aiAnalysis.extractedInfo.newAddress;
                    }
                    if (aiAnalysis.extractedInfo.newCity) {
                        targetOrder.city = aiAnalysis.extractedInfo.newCity;
                        sheetUpdates.city = aiAnalysis.extractedInfo.newCity;
                    }
                } else if (aiAnalysis.decision === 'CANCELLED') {
                    targetOrder.status = OrderStatus.Annule;
                    targetOrder.whatsappStatus = 'cancelled';
                    sheetUpdates.status = OrderStatus.Annule;
                } else if (aiAnalysis.decision === 'RESCHEDULED') {
                    targetOrder.status = OrderStatus.Reporter;
                    targetOrder.whatsappStatus = 'rescheduled';
                    const reportText = `Reporté WhatsApp : ${aiAnalysis.extractedInfo.rescheduleDate || 'Date ultérieure'}`;
                    targetOrder.note = targetOrder.note ? `${targetOrder.note} | ${reportText}` : reportText;
                    sheetUpdates.status = OrderStatus.Reporter;
                    sheetUpdates.note = targetOrder.note;
                }

                targetOrder.whatsappResponseAt = now;
                targetOrder.whatsappLastMessage = incomingMessageText;

                // Persist order update in PostgreSQL
                if (isPgConnected()) {
                    try {
                        const ordersTable = getTable('orders', req);
                        await safePgQuery(`
                            UPDATE ${ordersTable}
                            SET status = $1,
                                address = $2,
                                city = $3,
                                note = $4,
                                whatsapp_status = $5,
                                whatsapp_response_at = $6,
                                whatsapp_last_message = $7
                            WHERE id = $8
                        `, [
                            targetOrder.status,
                            targetOrder.address,
                            targetOrder.city,
                            targetOrder.note,
                            targetOrder.whatsappStatus,
                            now,
                            incomingMessageText,
                            targetOrder.id
                        ]);
                    } catch (pgErr) {
                        console.error('Failed to update order in PG after WhatsApp AI:', pgErr);
                    }
                }

                // Sync status to Google Sheets automatically if enabled
                if (config.syncToSheetsOnConfirm !== false) {
                    try {
                        await syncStatusToGoogleSheet(targetOrder.id, sheetUpdates, req.user, oldOrder, req);
                    } catch (sheetErr) {
                        console.warn('Google Sheet sync after WhatsApp confirmation note:', sheetErr);
                    }
                }
            }

            // Log inbound message & AI decision
            const inboundLog: WhatsAppLog = {
                id: `log-wa-in-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                orderId: targetOrder?.id,
                customerName: targetOrder?.customerName,
                phone: targetOrder?.phone || customerPhone || '',
                type: 'inbound',
                message: incomingMessageText,
                status: 'received',
                timestamp: now,
                aiInterpretation: aiAnalysis,
                clientId: targetOrder?.clientId
            };

            const replyLog: WhatsAppLog = {
                id: `log-wa-reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                orderId: targetOrder?.id,
                customerName: targetOrder?.customerName,
                phone: targetOrder?.phone || customerPhone || '',
                type: 'ai_decision',
                message: automatedReply,
                status: 'replied',
                timestamp: new Date(Date.now() + 1000).toISOString(),
                aiInterpretation: aiAnalysis,
                clientId: targetOrder?.clientId
            };

            state.whatsappLogs.unshift(inboundLog, replyLog);
            if (state.whatsappLogs.length > 500) state.whatsappLogs.length = 500;

            if (isPgConnected()) {
                try {
                    const logsTable = getTable('whatsapp_logs', req);
                    await safePgQuery(`
                        INSERT INTO ${logsTable} (id, order_id, customer_name, phone, type, message, status, timestamp, ai_interpretation, client_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [inboundLog.id, inboundLog.orderId, inboundLog.customerName, inboundLog.phone, inboundLog.type, inboundLog.message, inboundLog.status, inboundLog.timestamp, JSON.stringify(aiAnalysis), inboundLog.clientId || null]);

                    await safePgQuery(`
                        INSERT INTO ${logsTable} (id, order_id, customer_name, phone, type, message, status, timestamp, ai_interpretation, client_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [replyLog.id, replyLog.orderId, replyLog.customerName, replyLog.phone, replyLog.type, replyLog.message, replyLog.status, replyLog.timestamp, JSON.stringify(aiAnalysis), replyLog.clientId || null]);
                } catch (_) {}
            }

            saveEnvStateToFile();

            // Optionally dispatch automated reply to actual customer via WhatsApp
            const phoneToReply = targetOrder?.phone || customerPhone;
            if (req.body.sendToWhatsApp && phoneToReply && automatedReply) {
                const sessionKey = req.user?.id || 'admin-younes';
                const session = baileysSessions.get(sessionKey) || Array.from(baileysSessions.values())[0];
                const digits = phoneToReply.replace(/[^0-9]/g, '');
                const cleanNumber = digits.startsWith('0') ? '212' + digits.substring(1) : digits.startsWith('212') ? digits : '212' + digits;

                if (session?.isConnected && session?.sock) {
                    try {
                        await session.sock.sendMessage(`${cleanNumber}@s.whatsapp.net`, { text: automatedReply });
                    } catch (sErr) {
                        console.warn('Dispatching test reply via Baileys notice:', sErr);
                    }
                } else if (config.gatewayUrl && config.apiKey) {
                    try {
                        const cleanUrl = config.gatewayUrl.replace(/\/+$/, '');
                        await fetch(`${cleanUrl}/message/sendText/${config.instanceName || 'callnet-main'}`, {
                            method: 'POST',
                            headers: {
                                'apikey': config.apiKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                number: cleanNumber,
                                text: automatedReply
                            })
                        });
                    } catch (gErr) {
                        console.warn('Dispatching test reply via Gateway notice:', gErr);
                    }
                }
            }

            return res.json({
                success: true,
                aiDecision: aiAnalysis,
                updatedOrder: targetOrder,
                automatedReply,
                logs: [inboundLog, replyLog]
            });
        } catch (e: any) {
            console.error('Error in WhatsApp AI analyze:', e);
            return res.status(500).json({ error: e.message || 'Erreur lors de l\'analyse IA' });
        }
    });

    // 8. GET /api/whatsapp/logs
    // Fetches message logs
    app.get('/api/whatsapp/logs', authenticateToken, async (req: any, res) => {
        try {
            const state = getEnvState(req);
            const { clientId, limit = 100 } = req.query;
            const maxLimit = Math.min(Number(limit) || 100, 300);

            if (isPgConnected()) {
                try {
                    const logsTable = getTable('whatsapp_logs', req);
                    let query = `SELECT * FROM ${logsTable} ORDER BY timestamp DESC LIMIT $1`;
                    let params = [maxLimit];

                    if (clientId) {
                        query = `SELECT * FROM ${logsTable} WHERE client_id = $1 ORDER BY timestamp DESC LIMIT $2`;
                        params = [clientId, maxLimit];
                    }

                    const result = await safePgQuery(query, params);
                    if (result && result.rows && result.rows.length > 0) {
                        const pgLogs: WhatsAppLog[] = result.rows.map((r: any) => ({
                            id: r.id,
                            orderId: r.order_id,
                            customerName: r.customer_name,
                            phone: r.phone,
                            type: r.type,
                            message: r.message,
                            status: r.status,
                            timestamp: r.timestamp,
                            aiInterpretation: typeof r.ai_interpretation === 'string' ? JSON.parse(r.ai_interpretation) : r.ai_interpretation,
                            clientId: r.client_id
                        }));
                        return res.json({ success: true, logs: pgLogs });
                    }
                } catch (pgErr) {
                    console.warn('PG read whatsapp_logs error, falling back to memory:', pgErr);
                }
            }

            let filtered = state.whatsappLogs;
            if (clientId) {
                filtered = filtered.filter((l: WhatsAppLog) => l.clientId === clientId);
            }
            return res.json({ success: true, logs: filtered.slice(0, maxLimit) });
        } catch (e: any) {
            return res.status(500).json({ error: e.message || 'Erreur lecture logs' });
        }
    });

    // 9. DELETE /api/whatsapp/logs
    app.delete('/api/whatsapp/logs', authenticateToken, async (req: any, res) => {
        try {
            const state = getEnvState(req);
            state.whatsappLogs = [];
            if (isPgConnected()) {
                try {
                    const logsTable = getTable('whatsapp_logs', req);
                    await safePgQuery(`DELETE FROM ${logsTable}`);
                } catch (_) {}
            }
            saveEnvStateToFile();
            return res.json({ success: true, message: 'Logs WhatsApp réinitialisés' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    });

    // 10. POST /api/whatsapp/webhook
    // Open webhook receiver for Evolution API / Baileys / WPPConnect instances
    app.post('/api/whatsapp/webhook', async (req: any, res) => {
        try {
            const body = req.body || {};
            const rawJid = body.data?.key?.remoteJid || body.key?.remoteJid || body.from || body.sender || '';
            const fromMe = body.data?.key?.fromMe || body.key?.fromMe || false;

            if (fromMe || !rawJid || rawJid.endsWith('@g.us') || rawJid.endsWith('@broadcast')) {
                return res.status(200).json({ status: 'ignored' });
            }

            const rawMsg = body.data?.message || body.message || body;
            const incomingText = extractWhatsAppMessageText(rawMsg) || body.text || body.data?.message?.text || '';

            if (!incomingText.trim()) {
                return res.status(200).json({ status: 'ignored_empty_text' });
            }

            // Extract sender phone number (strip device identifier)
            const userPart = rawJid.split('@')[0].split(':')[0];
            const cleanPhone = userPart.replace(/[^0-9]/g, '');
            if (!cleanPhone || cleanPhone.length < 8) {
                return res.status(200).json({ status: 'ignored_invalid_phone' });
            }

            const state = getEnvState(req);
            const last9 = cleanPhone.slice(-9);
            const last8 = cleanPhone.slice(-8);

            // Find matching orders with priority
            const matchingOrders = state.orders.filter((o: Order) => {
                const p = (o.phone || '').replace(/[^0-9]/g, '');
                if (!p) return false;
                return (
                    p.slice(-9) === last9 ||
                    p.slice(-8) === last8 ||
                    cleanPhone.endsWith(p) ||
                    p.endsWith(cleanPhone)
                );
            });

            const matchOrder = 
                matchingOrders.find((o: Order) => o.whatsappStatus === 'sent') ||
                matchingOrders.find((o: Order) => o.status === OrderStatus.EnAttend) ||
                (matchingOrders.length > 0 ? matchingOrders[matchingOrders.length - 1] : null);

            const aiAnalysis = await runGeminiWhatsAppIntent(incomingText, matchOrder);
            const now = new Date().toISOString();
            const config = getUserConfig(req);

            let automatedReply = '';
            if (aiAnalysis.decision === 'CONFIRMED' || aiAnalysis.decision === 'ADDRESS_CHANGE') {
                automatedReply = interpolateOrderTemplate(config.replyOnConfirm || DEFAULT_WHATSAPP_CONFIG.replyOnConfirm, matchOrder || ({} as any));
            } else if (aiAnalysis.decision === 'CANCELLED') {
                automatedReply = interpolateOrderTemplate(config.replyOnCancel || DEFAULT_WHATSAPP_CONFIG.replyOnCancel, matchOrder || ({} as any));
            } else if (aiAnalysis.decision === 'RESCHEDULED') {
                automatedReply = interpolateOrderTemplate(config.replyOnReschedule || DEFAULT_WHATSAPP_CONFIG.replyOnReschedule, matchOrder || ({} as any));
            } else {
                automatedReply = aiAnalysis.replyMessage || interpolateOrderTemplate(config.replyOnUnclear || DEFAULT_WHATSAPP_CONFIG.replyOnUnclear, matchOrder || ({} as any));
            }

            if (matchOrder) {
                const oldOrder = { ...matchOrder };
                const sheetUpdates: any = {};

                if (aiAnalysis.decision === 'CONFIRMED' || aiAnalysis.decision === 'ADDRESS_CHANGE') {
                    matchOrder.status = OrderStatus.Confirme;
                    matchOrder.whatsappStatus = 'confirmed';
                    sheetUpdates.status = OrderStatus.Confirme;
                    if (aiAnalysis.extractedInfo.newAddress) matchOrder.address = aiAnalysis.extractedInfo.newAddress;
                    if (aiAnalysis.extractedInfo.newCity) matchOrder.city = aiAnalysis.extractedInfo.newCity;
                } else if (aiAnalysis.decision === 'CANCELLED') {
                    matchOrder.status = OrderStatus.Annule;
                    matchOrder.whatsappStatus = 'cancelled';
                    sheetUpdates.status = OrderStatus.Annule;
                } else if (aiAnalysis.decision === 'RESCHEDULED') {
                    matchOrder.status = OrderStatus.Reporter;
                    matchOrder.whatsappStatus = 'rescheduled';
                    const reportText = `Reporté WhatsApp : ${aiAnalysis.extractedInfo.rescheduleDate || 'Date ultérieure'}`;
                    matchOrder.note = matchOrder.note ? `${matchOrder.note} | ${reportText}` : reportText;
                    sheetUpdates.status = OrderStatus.Reporter;
                }

                matchOrder.whatsappResponseAt = now;
                matchOrder.whatsappLastMessage = incomingText;

                if (isPgConnected()) {
                    try {
                        const ordersTable = getTable('orders', req);
                        await safePgQuery(`
                            UPDATE ${ordersTable}
                            SET status = $1,
                                address = $2,
                                city = $3,
                                note = $4,
                                whatsapp_status = $5,
                                whatsapp_response_at = $6,
                                whatsapp_last_message = $7
                            WHERE id = $8
                        `, [
                            matchOrder.status,
                            matchOrder.address,
                            matchOrder.city,
                            matchOrder.note,
                            matchOrder.whatsappStatus,
                            now,
                            incomingText,
                            matchOrder.id
                        ]);
                    } catch (_) {}
                }

                syncStatusToGoogleSheet(matchOrder.id, sheetUpdates, undefined, oldOrder, req).catch(() => {});
            }

            // Send automated reply back to customer via external gateway or active Baileys socket
            let replySent = false;
            if (automatedReply) {
                // 1. External gateway if configured
                if (config.gatewayUrl && config.apiKey) {
                    try {
                        const cleanUrl = config.gatewayUrl.replace(/\/+$/, '');
                        await fetch(`${cleanUrl}/message/sendText/${config.instanceName || 'callnet-main'}`, {
                            method: 'POST',
                            headers: {
                                'apikey': config.apiKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                number: cleanPhone.startsWith('0') ? '212' + cleanPhone.substring(1) : cleanPhone,
                                text: automatedReply
                            })
                        });
                        replySent = true;
                    } catch (gErr) {
                        console.warn('Webhook auto-reply via Gateway notice:', gErr);
                    }
                }

                // 2. Or via active local Baileys socket
                if (!replySent) {
                    const session = baileysSessions.get('admin-younes') || Array.from(baileysSessions.values())[0];
                    if (session?.isConnected && session?.sock) {
                        try {
                            await session.sock.sendMessage(`${cleanPhone}@s.whatsapp.net`, { text: automatedReply });
                            replySent = true;
                        } catch (bErr) {
                            console.warn('Webhook auto-reply via Baileys notice:', bErr);
                        }
                    }
                }
            }

            // Save inbound log
            const inboundLog: WhatsAppLog = {
                id: `log-wa-hook-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                orderId: matchOrder?.id,
                customerName: matchOrder?.customerName,
                phone: cleanPhone,
                type: 'inbound',
                message: incomingText,
                status: 'received',
                timestamp: now,
                aiInterpretation: aiAnalysis,
                clientId: matchOrder?.clientId
            };

            // Save reply log
            const replyLog: WhatsAppLog = {
                id: `log-wa-hook-reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                orderId: matchOrder?.id,
                customerName: matchOrder?.customerName,
                phone: cleanPhone,
                type: 'ai_decision',
                message: automatedReply,
                status: replySent ? 'replied' : 'received',
                timestamp: new Date(Date.now() + 1000).toISOString(),
                aiInterpretation: aiAnalysis,
                clientId: matchOrder?.clientId
            };

            state.whatsappLogs.unshift(inboundLog, replyLog);
            if (state.whatsappLogs.length > 500) state.whatsappLogs.length = 500;
            saveEnvStateToFile();

            return res.status(200).json({ status: 'ok', decision: aiAnalysis.decision, replySent });
        } catch (e: any) {
            console.error('Webhook error:', e);
            return res.status(200).json({ status: 'error', error: e.message });
        }
    });
}
