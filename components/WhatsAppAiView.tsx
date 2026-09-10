import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    QrCode, 
    Smartphone, 
    Bot, 
    Send, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    RefreshCw, 
    Sparkles, 
    ShieldCheck, 
    AlertCircle, 
    Copy, 
    Check, 
    Settings, 
    ExternalLink, 
    MessageSquare, 
    Zap, 
    Sliders, 
    FileText, 
    Users, 
    Phone, 
    HelpCircle, 
    Search,
    ArrowRight,
    Play,
    Calendar,
    MapPin,
    Trash2,
    Key
} from 'lucide-react';
import { Order, OrderStatus, Role, User, WhatsAppConfig, WhatsAppLog } from '../types';

interface WhatsAppAiViewProps {
    orders: Order[];
    currentUser: User;
    onUpdateOrder: (order: Order) => Promise<void>;
    onBulkUpdateOrders?: (orders: Order[]) => Promise<void>;
    onRefreshOrders?: () => Promise<void>;
}

export const WhatsAppAiView: React.FC<WhatsAppAiViewProps> = ({
    orders,
    currentUser,
    onUpdateOrder,
    onBulkUpdateOrders,
    onRefreshOrders
}) => {
    // Tabs: 'qr', 'settings', 'simulator', 'orders', 'logs'
    const [activeTab, setActiveTab] = useState<'qr' | 'settings' | 'simulator' | 'orders' | 'logs'>('qr');

    // Config state
    const [config, setConfig] = useState<WhatsAppConfig>({
        isConnected: false,
        gatewayType: 'qr_gateway',
        instanceName: 'callnet-main',
        autoSendOnNewOrder: true,
        autoConfirmWithAi: true,
        syncToSheetsOnConfirm: true,
        messageTemplate: `Salam {customerName} ! 👋
C'est la boutique CallNet au sujet de votre commande :
📦 Produit : {product} (Qté : {quantity})
💰 Total : {price} MAD (Paiement à la livraison)
📍 Ville : {city}
🏠 Adresse : {address}

👉 Répondez "OUI" ou "1" pour CONFIRMER
👉 Répondez "NON" ou "2" pour ANNULER
👉 Ou écrivez-nous pour modifier votre adresse ou la date de livraison.`,
        replyOnConfirm: `Parfait {customerName} ! ✅ Votre commande de {product} est bien confirmée. Notre livreur vous contactera très bientôt. Merci !`,
        replyOnCancel: `C'est bien noté {customerName}, votre commande a été annulée. Merci et à une prochaine fois !`,
        replyOnReschedule: `Bien reçu {customerName} ! 📅 Votre livraison a été reportée. Le livreur vous contactera à la date souhaitée.`
    });

    // QR & Pairing state
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [pairingCode, setPairingCode] = useState<string>('');
    const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false);
    const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
    const [qrCountdown, setQrCountdown] = useState<number>(45);
    const [pairingPhoneInput, setPairingPhoneInput] = useState<string>('');
    const [isRequestingPairingCode, setIsRequestingPairingCode] = useState<boolean>(false);
    const [pairingMode, setPairingMode] = useState<'qr' | 'code'>('qr');

    // Logs state
    const [logs, setLogs] = useState<WhatsAppLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
    const [logFilter, setLogFilter] = useState<string>('all');
    const [logSearch, setLogSearch] = useState<string>('');

    // Simulator state
    const [simOrderInput, setSimOrderInput] = useState<string>('');
    const [simMessageText, setSimMessageText] = useState<string>('salam khoya confirmi lia l commande');
    const [simIsAnalyzing, setSimIsAnalyzing] = useState<boolean>(false);
    const [simResult, setSimResult] = useState<any>(null);
    const [simSendToWhatsApp, setSimSendToWhatsApp] = useState<boolean>(true);

    // Queue / Orders state
    const [orderSearch, setOrderSearch] = useState<string>('');
    const [orderStatusFilter, setOrderStatusFilter] = useState<string>('En attente');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [isSendingBulk, setIsSendingBulk] = useState<boolean>(false);
    const [singleSendingId, setSingleSendingId] = useState<string | null>(null);

    // Notification toast
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [copiedText, setCopiedText] = useState<boolean>(false);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // Load initial config and logs
    useEffect(() => {
        loadConfig();
        loadLogs();
    }, []);

    // Background auto-polling for incoming customer responses and WhatsApp logs every 4 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/whatsapp/logs?limit=40', {
                    headers: {
                        'Authorization': `Bearer ${token || ''}`,
                        'x-user-id': currentUser.id
                    }
                });
                const data = await res.json();
                if (data && data.logs && Array.isArray(data.logs)) {
                    setLogs(prevLogs => {
                        if (prevLogs.length > 0 && data.logs.length > 0 && data.logs[0].id !== prevLogs[0].id) {
                            const latest = data.logs[0];
                            if (latest.type === 'inbound' || latest.type === 'ai_decision') {
                                showToast(`💬 Réponse WhatsApp reçue de ${latest.customerName || latest.phone} : "${latest.message}"`, 'info');
                                onRefreshOrders?.();
                            }
                        }
                        return data.logs;
                    });
                }
            } catch (_) {}
        }, 4000);

        return () => clearInterval(interval);
    }, [currentUser.id]);

    // QR Code countdown and reload timer
    useEffect(() => {
        let timer: any = null;
        if (activeTab === 'qr' && !config.isConnected) {
            timer = setInterval(() => {
                setQrCountdown(prev => {
                    if (prev <= 1) {
                        fetchQrCode();
                        return 45;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [activeTab, config.isConnected]);

    const loadConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/config', {
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                }
            });
            const data = await res.json();
            if (data && data.config) {
                setConfig(prev => ({ ...prev, ...data.config }));
                if (!data.config.isConnected) {
                    fetchQrCode();
                }
            }
        } catch (e) {
            console.warn('Error loading whatsapp config:', e);
        }
    };

    const fetchQrCode = async () => {
        setIsLoadingQr(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/qr', {
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                }
            });
            const data = await res.json();
            if (data.qrCode) {
                setQrCodeDataUrl(data.qrCode);
                setPairingCode(data.pairingCode || '');
                setQrCountdown(45);
            }
            if (data.isConnected) {
                setConfig(prev => ({ ...prev, isConnected: true, connectedNumber: data.connectedNumber }));
            }
        } catch (e) {
            console.error('Failed to load QR code:', e);
        } finally {
            setIsLoadingQr(false);
        }
    };

    const loadLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/logs', {
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                }
            });
            const data = await res.json();
            if (data && data.logs) {
                setLogs(data.logs);
            }
        } catch (e) {
            console.warn('Failed to load WhatsApp logs:', e);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const handleSaveConfig = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSavingConfig(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (data.success) {
                showToast('Paramètres WhatsApp IA enregistrés avec succès !', 'success');
            } else {
                showToast(data.error || 'Erreur lors de la sauvegarde', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur réseau', 'error');
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleSimulateScan = async (action: 'connect' | 'disconnect') => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/simulate-scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({
                    action,
                    phone: '+212 661-889922',
                    instanceName: config.instanceName || 'callnet-main'
                })
            });
            const data = await res.json();
            if (data.success) {
                setConfig(prev => ({
                    ...prev,
                    isConnected: action === 'connect',
                    connectedNumber: action === 'connect' ? '+212 661-889922' : undefined,
                    connectedAt: action === 'connect' ? new Date().toISOString() : undefined
                }));
                showToast(data.message || (action === 'connect' ? 'Passerelle connectée !' : 'Déconnecté'), 'success');
                loadLogs();
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur de connexion', 'error');
        }
    };

    const handleRequestPairingCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const rawPhone = pairingPhoneInput.trim();
        if (!rawPhone) {
            showToast('Veuillez renseigner votre numéro WhatsApp (ex: 0661123456)', 'error');
            return;
        }
        setIsRequestingPairingCode(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/pairing-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({ phoneNumber: rawPhone })
            });
            const data = await res.json();
            if (data.success && data.pairingCode) {
                setPairingCode(data.pairingCode);
                setPairingMode('code');
                showToast('Code de jumelage généré ! Entrez ce code dans WhatsApp sur votre téléphone.', 'success');
            } else {
                showToast(data.error || 'Erreur lors de la génération du code', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur réseau', 'error');
        } finally {
            setIsRequestingPairingCode(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/disconnect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                }
            });
            const data = await res.json();
            if (data.success) {
                setConfig(prev => ({
                    ...prev,
                    isConnected: false,
                    connectedNumber: undefined,
                    connectedAt: undefined
                }));
                setPairingCode('');
                setQrCodeDataUrl('');
                showToast('Session WhatsApp déconnectée avec succès', 'info');
                fetchQrCode();
                loadLogs();
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur lors de la déconnexion', 'error');
        }
    };

    // Send WhatsApp message to single order
    const handleSendOrder = async (orderId: string) => {
        setSingleSendingId(orderId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/send-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({ orderId })
            });
            const data = await res.json();
            if (data.success && data.order) {
                await onUpdateOrder(data.order);
                showToast(`Message WhatsApp envoyé à ${data.order.customerName} !`, 'success');
                loadLogs();
            } else {
                showToast(data.error || 'Erreur lors de l\'envoi', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur envoi WhatsApp', 'error');
        } finally {
            setSingleSendingId(null);
        }
    };

    // Bulk send
    const handleSendBulk = async () => {
        if (selectedOrderIds.length === 0) return;
        setIsSendingBulk(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/send-bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({ orderIds: selectedOrderIds })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                if (onBulkUpdateOrders) {
                    await onBulkUpdateOrders(data.orders);
                } else {
                    for (const ord of data.orders) {
                        await onUpdateOrder(ord);
                    }
                }
                showToast(`${data.sentCount} message(s) WhatsApp envoyé(s) avec succès !`, 'success');
                setSelectedOrderIds([]);
                loadLogs();
            } else {
                showToast(data.error || 'Erreur envoi groupé', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur lors de l\'envoi groupé', 'error');
        } finally {
            setIsSendingBulk(false);
        }
    };

    // AI Intent Simulator
    const handleRunAiSimulator = async () => {
        if (!simMessageText.trim()) return;
        setSimIsAnalyzing(true);
        setSimResult(null);
        try {
            const token = localStorage.getItem('token');
            const targetOrder = orders.find(o => String(o.id) === simOrderInput) || orders[0] || null;

            const res = await fetch('/api/whatsapp/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({
                    orderId: targetOrder?.id,
                    customerPhone: targetOrder?.phone || '+212 600-000000',
                    incomingMessageText: simMessageText,
                    applyAction: true,
                    sendToWhatsApp: simSendToWhatsApp && config.isConnected
                })
            });
            const data = await res.json();
            if (data.success) {
                setSimResult(data);
                if (data.updatedOrder) {
                    await onUpdateOrder(data.updatedOrder);
                }
                showToast(`Analyse terminée : ${data.aiDecision?.decision}`, 'success');
                loadLogs();
            } else {
                showToast(data.error || 'Erreur analyse IA', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur lors de l\'analyse IA', 'error');
        } finally {
            setSimIsAnalyzing(false);
        }
    };

    // Quick test customer reply directly for any order
    const handleQuickSimulate = async (order: Order, answerText: string) => {
        try {
            showToast(`Traitement réponse client "${answerText}" pour #${order.id}...`, 'info');
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                },
                body: JSON.stringify({
                    orderId: order.id,
                    customerPhone: order.phone,
                    incomingMessageText: answerText,
                    applyAction: true,
                    sendToWhatsApp: config.isConnected
                })
            });
            const data = await res.json();
            if (data.success) {
                if (data.updatedOrder) {
                    await onUpdateOrder(data.updatedOrder);
                }
                showToast(`Réponse client traitée : ${data.aiDecision?.decision} -> Statut : ${data.updatedOrder?.status}`, 'success');
                loadLogs();
            } else {
                showToast(data.error || 'Erreur simulation réponse', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erreur réseau', 'error');
        }
    };

    // Clear logs
    const handleClearLogs = async () => {
        if (!window.confirm('Voulez-vous vraiment effacer l\'historique des messages WhatsApp ?')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch('/api/whatsapp/logs', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token || ''}`,
                    'x-user-id': currentUser.id
                }
            });
            setLogs([]);
            showToast('Logs réinitialisés', 'info');
        } catch (e) {
            showToast('Erreur suppression logs', 'error');
        }
    };

    // KPI Metrics calculation
    const stats = useMemo(() => {
        const totalSent = orders.filter(o => o.whatsappStatus === 'sent' || o.whatsappStatus === 'confirmed' || o.whatsappStatus === 'cancelled').length;
        const totalConfirmed = orders.filter(o => o.whatsappStatus === 'confirmed' || (o.status === OrderStatus.Confirme && o.whatsappResponseAt)).length;
        const totalCancelled = orders.filter(o => o.whatsappStatus === 'cancelled' || (o.status === OrderStatus.Annule && o.whatsappResponseAt)).length;
        const rate = totalSent > 0 ? Math.round((totalConfirmed / totalSent) * 100) : 0;
        const pendingCount = orders.filter(o => o.status === OrderStatus.EnAttend).length;
        return { totalSent, totalConfirmed, totalCancelled, rate, pendingCount };
    }, [orders]);

    // Filtered orders for the Queue Tab
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            const matchesSearch = !orderSearch.trim() || 
                (o.customerName && o.customerName.toLowerCase().includes(orderSearch.toLowerCase())) ||
                (o.phone && o.phone.includes(orderSearch)) ||
                (o.city && o.city.toLowerCase().includes(orderSearch.toLowerCase())) ||
                (o.product && o.product.toLowerCase().includes(orderSearch.toLowerCase()));

            const matchesStatus = orderStatusFilter === 'all' || 
                (orderStatusFilter === 'En attente' && o.status === OrderStatus.EnAttend) ||
                (orderStatusFilter === 'not_sent' && (!o.whatsappStatus || o.whatsappStatus === 'not_sent')) ||
                (orderStatusFilter === 'sent' && o.whatsappStatus === 'sent') ||
                (orderStatusFilter === 'confirmed' && o.whatsappStatus === 'confirmed') ||
                (orderStatusFilter === 'cancelled' && o.whatsappStatus === 'cancelled');

            return matchesSearch && matchesStatus;
        });
    }, [orders, orderSearch, orderStatusFilter]);

    // Filtered logs
    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            const matchesType = logFilter === 'all' || l.type === logFilter || l.status === logFilter;
            const matchesSearch = !logSearch.trim() ||
                (l.customerName && l.customerName.toLowerCase().includes(logSearch.toLowerCase())) ||
                (l.phone && l.phone.includes(logSearch)) ||
                (l.message && l.message.toLowerCase().includes(logSearch.toLowerCase()));
            return matchesType && matchesSearch;
        });
    }, [logs, logFilter, logSearch]);

    const samplePrompts = [
        { label: 'Confirmation Darija', text: 'salam khoya confirmi lia l commande barak allaho fik' },
        { label: 'Oui / Chiffre 1', text: '1' },
        { label: 'Changement d\'adresse', text: 'wakha confirmiha mais badlou lia l\'adresse siftouha l maarouf casablanca 3afak' },
        { label: 'Annulation Darija', text: 'non ma bqitch baghiha smheli bzaf annuler' },
        { label: 'Report de date', text: 'khalliw lia tal nhar sebt 3afak ana mamsalix daba' },
        { label: 'Question sur le prix', text: 'salam chhal taman dialha ? wach livraison gratuite ?' }
    ];

    const copyPairingCode = () => {
        if (!pairingCode) return;
        navigator.clipboard.writeText(pairingCode);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
    };

    return (
        <div className="space-y-6 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
            {/* Toast Notification */}
            {toastMessage && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold border ${
                    toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800' :
                    toastMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800' :
                    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-800'
                }`}>
                    {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    {toastMessage.type === 'error' && <XCircle className="w-5 h-5 text-rose-600" />}
                    {toastMessage.type === 'info' && <AlertCircle className="w-5 h-5 text-sky-600" />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-lg border border-emerald-800/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-1 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30 text-emerald-300">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">WhatsApp IA - Confirmation Automatique</h1>
                            <p className="text-emerald-200/80 text-xs sm:text-sm">Passerelle WhatsApp QR Code & Détection d'intention Gemini 3.8 Flash (Darija, Français, Arabe)</p>
                        </div>
                    </div>
                </div>

                {/* Gateway Status Badge */}
                <div className="flex items-center gap-3 self-start sm:self-center relative z-10">
                    <div className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border ${
                        config.isConnected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${config.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        {config.isConnected ? (
                            <span>Connecté : <strong className="font-mono text-white">{config.connectedNumber || '+212 661-889922'}</strong></span>
                        ) : (
                            <span>Passerelle Déconnectée</span>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                        <span>Messages WhatsApp Envoyés</span>
                        <Send className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalSent}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{stats.pendingCount} commandes en attente</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                        <span>Confirmées par l'IA</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalConfirmed}</div>
                    <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">Synchronisées avec Google Sheets</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                        <span>Taux de Confirmation IA</span>
                        <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.rate}%</div>
                    <div className="text-[11px] text-slate-400 mt-1">{stats.totalCancelled} annulation(s) détectée(s)</div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
                        <span>Modèle d'Intelligence</span>
                        <Bot className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 truncate">Gemini 3.8 Flash</div>
                    <div className="text-[11px] text-slate-400 mt-1">Support Darija / Arabe / FR</div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <button
                    onClick={() => setActiveTab('qr')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'qr'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <QrCode className="w-4 h-4" />
                    <span>Passerelle QR Code</span>
                    {config.isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                </button>

                <button
                    onClick={() => setActiveTab('simulator')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'simulator'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Simulateur IA (Playground Darija)</span>
                </button>

                <button
                    onClick={() => setActiveTab('orders')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'orders'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <Send className="w-4 h-4" />
                    <span>File d'Envoi WhatsApp</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold">
                        {stats.pendingCount}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'settings'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <Settings className="w-4 h-4" />
                    <span>Modèles & Règles IA</span>
                </button>

                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        activeTab === 'logs'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    <span>Journal des Messages ({logs.length})</span>
                </button>
            </div>

            {/* TAB 1: QR CODE & GATEWAY */}
            {activeTab === 'qr' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: QR Code & Pairing Card */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center text-center">
                        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 mb-4">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Passerelle WhatsApp Directe (Protocole Officiel)</span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                            {config.isConnected ? 'WhatsApp est Connecté !' : 'Connectez votre WhatsApp'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
                            {config.isConnected
                                ? `Votre session est active sur le numéro ${config.connectedNumber}. Vos confirmations fonctionnent en temps réel.`
                                : 'Scannez le QR Code ou utilisez le code de jumelage à 8 caractères.'}
                        </p>

                        {/* Mode switcher pills when not connected */}
                        {!config.isConnected && (
                            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-4 w-full max-w-[300px] text-xs font-medium border border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setPairingMode('qr')}
                                    className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                                        pairingMode === 'qr'
                                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Smartphone className="w-3.5 h-3.5" />
                                    <span>QR Code</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPairingMode('code')}
                                    className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                                        pairingMode === 'code'
                                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Key className="w-3.5 h-3.5" />
                                    <span>Code 8 Chiffres</span>
                                </button>
                            </div>
                        )}

                        {/* QR Container or Connected or Code Container */}
                        <div className="relative p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center min-h-[300px] w-full max-w-[300px] shadow-inner mb-4">
                            {config.isConnected ? (
                                <div className="space-y-4 py-8">
                                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                                        <Smartphone className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">Appareil Jumelé</p>
                                        <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{config.connectedNumber || '+212 661-889922'}</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Instance : {config.instanceName || 'callnet-main'}</p>
                                    </div>
                                    <div className="pt-2">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500 text-white font-medium">
                                            <Check className="w-3.5 h-3.5" /> Service En Ligne
                                        </span>
                                    </div>
                                </div>
                            ) : pairingMode === 'code' ? (
                                <div className="w-full space-y-4 py-2">
                                    <div className="text-left">
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                                            Votre numéro WhatsApp :
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"
                                                value={pairingPhoneInput}
                                                onChange={e => setPairingPhoneInput(e.target.value)}
                                                placeholder="0661123456 ou +2126..."
                                                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                                            />
                                            <button
                                                type="button"
                                                disabled={isRequestingPairingCode}
                                                onClick={handleRequestPairingCode}
                                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                                            >
                                                {isRequestingPairingCode ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    'Générer'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {pairingCode ? (
                                        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 text-center">
                                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-semibold mb-1">
                                                Votre code de jumelage officiel :
                                            </span>
                                            <span className="font-mono text-2xl font-black text-emerald-800 dark:text-emerald-200 tracking-widest block select-all my-1">
                                                {pairingCode}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={copyPairingCode}
                                                className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold mt-1"
                                            >
                                                {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedText ? 'Copié dans le presse-papier !' : 'Copier le code'}</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-slate-500 text-[11px] text-left leading-relaxed">
                                            💡 <strong>Astuce :</strong> Entrez le numéro de téléphone de la carte SIM insérée dans votre smartphone. Un code à 8 chiffres apparaîtra ici.
                                        </div>
                                    )}

                                    <div className="text-[11px] text-left text-slate-500 dark:text-slate-400 space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                                        <p className="font-semibold text-slate-700 dark:text-slate-300">Sur votre téléphone :</p>
                                        <p>1. WhatsApp &gt; <strong>Appareils connectés</strong> &gt; <strong>Connecter un appareil</strong></p>
                                        <p>2. En bas : touchez <strong>"Connecter plutôt avec un numéro de téléphone"</strong></p>
                                        <p>3. Entrez le code affiché ci-dessus.</p>
                                    </div>
                                </div>
                            ) : isLoadingQr ? (
                                <div className="flex flex-col items-center gap-3 py-12">
                                    <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                                    <p className="text-xs text-slate-500">Génération du QR Code officiel WhatsApp...</p>
                                </div>
                            ) : qrCodeDataUrl ? (
                                <div className="space-y-3">
                                    <img 
                                        src={qrCodeDataUrl} 
                                        alt="WhatsApp Pairing QR Code" 
                                        className="w-56 h-56 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2"
                                    />
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                                        <span>Expire dans : <strong className="text-emerald-600 font-mono">{qrCountdown}s</strong></span>
                                        <button 
                                            onClick={fetchQrCode}
                                            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Recharger
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Génération du QR Code en cours...</p>
                                    <button 
                                        onClick={fetchQrCode}
                                        className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                                    >
                                        Charger le QR Code
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col w-full max-w-[300px] gap-2">
                            {config.isConnected ? (
                                <button
                                    onClick={handleDisconnect}
                                    className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-medium text-xs flex items-center justify-center gap-2 transition"
                                >
                                    <XCircle className="w-4 h-4 text-rose-500" />
                                    <span>Déconnecter cette session WhatsApp</span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleSimulateScan('connect')}
                                        className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                                    >
                                        <Smartphone className="w-4 h-4 text-emerald-400" />
                                        <span>Tester sans scanner (Mode Simulation Démo)</span>
                                    </button>
                                    {pairingMode === 'qr' && (
                                        <button
                                            onClick={fetchQrCode}
                                            className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            <span>Régénérer le QR Code</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Step-by-Step Instructions & Gateway Config */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* How it works card */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <Smartphone className="w-5 h-5 text-emerald-600" />
                                <span>Guide de Connexion Mobile (Moins de 30 secondes)</span>
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                        1
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Ouvrez WhatsApp sur votre smartphone</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Utilisez le numéro officiel de votre boutique ou de votre centre d'appel.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                        2
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Accédez aux "Appareils connectés"</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Sur Android : appuyez sur les 3 points <strong className="text-slate-700 dark:text-slate-300">⋮</strong> en haut à droite. Sur iPhone : appuyez sur <strong className="text-slate-700 dark:text-slate-300">Réglages ⚙️</strong> &gt; <strong>Appareils connectés</strong>.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                        3
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Deux méthodes de jumelage au choix :</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            • <strong>Option A (QR Code) :</strong> Touchez "Connecter un appareil" et scannez le QR code affiché à gauche.<br />
                                            • <strong>Option B (Code 8 chiffres) :</strong> Si le scan échoue, touchez <em>"Connecter plutôt avec un numéro de téléphone"</em> en bas de l'écran WhatsApp, et entrez le code à 8 chiffres généré !
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                        4
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Confirmation IA automatique en Darija & Français</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Dès que le client répond, Gemini 3.8 Flash comprend son intention, passe la commande en <span className="font-semibold text-emerald-600 dark:text-emerald-400">Confirmé</span> ou <span className="font-semibold text-rose-600 dark:text-rose-400">Annulé</span>, et met à jour Google Sheets en temps réel !
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gateway Technical Config (Evolution API / Local Baileys) */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-emerald-600" />
                                    <span>Configuration Avancée de la Passerelle</span>
                                </h3>
                                <span className="text-[11px] text-slate-400">Optionnel (Mode zéro-config actif par défaut)</span>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                Par défaut, CallNet utilise la passerelle intégrée sans configuration externe requise. Si vous disposez d'un serveur Evolution API ou Baileys dédié (Docker/VPS), vous pouvez renseigner son URL ci-dessous.
                            </p>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'instance WhatsApp</label>
                                    <input
                                        type="text"
                                        value={config.instanceName || 'callnet-main'}
                                        onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="callnet-main"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">URL Passerelle Externe (ex: Evolution API)</label>
                                        <input
                                            type="text"
                                            value={config.gatewayUrl || ''}
                                            onChange={(e) => setConfig({ ...config, gatewayUrl: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="https://whatsapp.votredomaine.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Clé API de la passerelle</label>
                                        <input
                                            type="password"
                                            value={config.apiKey || ''}
                                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Clé secrète API"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <button
                                        onClick={() => handleSaveConfig()}
                                        disabled={isSavingConfig}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                                    >
                                        {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        <span>Enregistrer les paramètres</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: AI SIMULATOR PLAYGROUND */}
            {activeTab === 'simulator' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Simulator Controls */}
                    <div className="lg:col-span-6 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-amber-500" />
                                    <span>Simulateur d'Intention Client (Darija / FR)</span>
                                </h3>
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    Gemini 3.8 Flash
                                </span>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Testez comment l'IA réagit face aux réponses réelles des clients marocains (expressions populaires, arabizi, annulations, reports, changements d'adresse).
                            </p>

                            {/* Order Selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Associer à une commande existante :
                                </label>
                                <select
                                    value={simOrderInput}
                                    onChange={(e) => setSimOrderInput(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="">Sélectionner une commande ({orders.length} disponibles)...</option>
                                    {orders.slice(0, 50).map(o => (
                                        <option key={o.id} value={o.id}>
                                            #{o.id} - {o.customerName} | {o.product} ({o.price} MAD) | {o.city} ({o.status})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Quick Darija Preset Buttons */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Exemples de messages typiques à tester :
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {samplePrompts.map((p, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSimMessageText(p.text)}
                                            className="px-2.5 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Customer Message Input */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Message WhatsApp reçu du client :
                                </label>
                                <textarea
                                    rows={3}
                                    value={simMessageText}
                                    onChange={(e) => setSimMessageText(e.target.value)}
                                    placeholder="Tapez un message en Darija, Français ou Arabe..."
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-medium"
                                />
                            </div>

                            {/* Option to send response to customer if WhatsApp is connected */}
                            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={simSendToWhatsApp}
                                    onChange={(e) => setSimSendToWhatsApp(e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                />
                                <div className="text-xs">
                                    <span className="font-semibold text-slate-800 dark:text-white block">
                                        Expédier aussi la réponse automatique au client sur WhatsApp
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {config.isConnected 
                                            ? '🟢 Session active : le message sera envoyé au numéro de la commande.' 
                                            : '⚪ WhatsApp non connecté (seule la simulation et mise à jour commande seront appliquées).'}
                                    </span>
                                </div>
                            </label>

                            {/* Submit button */}
                            <button
                                onClick={handleRunAiSimulator}
                                disabled={simIsAnalyzing || !simMessageText.trim()}
                                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                            >
                                {simIsAnalyzing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Analyse par Gemini 3.8 Flash en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-white" />
                                        <span>Analyser avec Gemini 3.8 Flash</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Simulator Result Preview */}
                    <div className="lg:col-span-6 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Bot className="w-5 h-5 text-indigo-500" />
                                <span>Décision & Explication de l'IA</span>
                            </h3>

                            {simResult ? (
                                <div className="space-y-4">
                                    {/* Decision Badge Card */}
                                    <div className={`p-4 rounded-xl border flex items-center justify-between ${
                                        simResult.aiDecision?.decision === 'CONFIRMED' || simResult.aiDecision?.decision === 'ADDRESS_CHANGE'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                            : simResult.aiDecision?.decision === 'CANCELLED'
                                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                                            : simResult.aiDecision?.decision === 'RESCHEDULED'
                                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                            : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                                    }`}>
                                        <div>
                                            <div className="text-[11px] font-medium opacity-80">Intention détectée</div>
                                            <div className="text-lg font-extrabold tracking-tight">
                                                {simResult.aiDecision?.decision === 'CONFIRMED' && 'CONFIRMATION (OUI)'}
                                                {simResult.aiDecision?.decision === 'ADDRESS_CHANGE' && 'CONFIRMÉ AVEC NOUVELLE ADRESSE'}
                                                {simResult.aiDecision?.decision === 'CANCELLED' && 'ANNULATION (NON)'}
                                                {simResult.aiDecision?.decision === 'RESCHEDULED' && 'REPORT DE DATE'}
                                                {simResult.aiDecision?.decision === 'QUESTION' && 'QUESTION CLIENT'}
                                                {simResult.aiDecision?.decision === 'UNRECOGNIZED' && 'NON RECONNU'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[11px] font-medium opacity-80">Confiance</div>
                                            <div className="text-base font-bold">
                                                {Math.round((simResult.aiDecision?.confidence || 0.95) * 100)}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Extracted Info */}
                                    {(simResult.aiDecision?.extractedInfo?.newAddress || simResult.aiDecision?.extractedInfo?.newCity || simResult.aiDecision?.extractedInfo?.rescheduleDate) && (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                                            <div className="font-semibold text-slate-700 dark:text-slate-300">Données extraites par l'IA :</div>
                                            {simResult.aiDecision?.extractedInfo?.newAddress && (
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span>Nouvelle adresse : <strong>{simResult.aiDecision?.extractedInfo?.newAddress}</strong></span>
                                                </div>
                                            )}
                                            {simResult.aiDecision?.extractedInfo?.newCity && (
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span>Nouvelle ville : <strong>{simResult.aiDecision?.extractedInfo?.newCity}</strong></span>
                                                </div>
                                            )}
                                            {simResult.aiDecision?.extractedInfo?.rescheduleDate && (
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                                    <span>Date de report : <strong>{simResult.aiDecision?.extractedInfo?.rescheduleDate}</strong></span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* AI Explanation */}
                                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Raisonnement du modèle :</span>
                                        {simResult.aiDecision?.explanation}
                                    </div>

                                    {/* WhatsApp Chat Bubble Mockup */}
                                    <div>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                                            Aperçu de la réponse WhatsApp générée :
                                        </span>
                                        <div className="p-4 rounded-xl bg-[#e5ddd5] dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 space-y-3">
                                            {/* Client message bubble */}
                                            <div className="flex justify-start">
                                                <div className="max-w-[85%] bg-white dark:bg-slate-800 text-slate-800 dark:text-white p-2.5 rounded-2xl rounded-tl-none shadow-sm text-xs">
                                                    <p>{simMessageText}</p>
                                                    <div className="text-[9px] text-slate-400 text-right mt-1">14:02 ✓✓</div>
                                                </div>
                                            </div>

                                            {/* Automated Bot reply bubble */}
                                            <div className="flex justify-end">
                                                <div className="max-w-[85%] bg-[#dcf8c6] dark:bg-emerald-950 text-slate-800 dark:text-emerald-100 p-2.5 rounded-2xl rounded-tr-none shadow-sm text-xs">
                                                    <p className="whitespace-pre-line">{simResult.automatedReply}</p>
                                                    <div className="text-[9px] text-slate-500 dark:text-emerald-400 text-right mt-1">14:02 ✓✓</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Target Order Impact */}
                                    {simResult.updatedOrder && (
                                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-xs flex items-center justify-between">
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Commande #{simResult.updatedOrder.id}</span>
                                                <span className="font-bold text-slate-800 dark:text-white">{simResult.updatedOrder.customerName}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">Statut :</span>
                                                <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                                    {simResult.updatedOrder.status}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-16 text-slate-400 space-y-2">
                                    <Bot className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                                    <p className="text-xs">Tapez ou choisissez un message à gauche et cliquez sur "Analyser" pour visualiser la décision de l'IA en direct.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ORDER QUEUE & BULK SEND */}
            {activeTab === 'orders' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    {/* Filter & Action bar */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative w-full">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    placeholder="Rechercher client, téléphone, produit..."
                                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <select
                                value={orderStatusFilter}
                                onChange={(e) => setOrderStatusFilter(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shrink-0"
                            >
                                <option value="En attente">Commandes En attente</option>
                                <option value="not_sent">Non envoyées via WhatsApp</option>
                                <option value="sent">WhatsApp Envoyé (En attente réponse)</option>
                                <option value="confirmed">Confirmées par WhatsApp</option>
                                <option value="all">Toutes les commandes</option>
                            </select>
                        </div>

                        {/* Bulk Send Button */}
                        <div className="flex items-center gap-2">
                            {selectedOrderIds.length > 0 && (
                                <button
                                    onClick={handleSendBulk}
                                    disabled={isSendingBulk}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                                >
                                    {isSendingBulk ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    <span>Envoyer WhatsApp ({selectedOrderIds.length})</span>
                                </button>
                            )}

                            <button
                                onClick={onRefreshOrders}
                                className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                                title="Actualiser la liste"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold">
                                    <th className="p-3 w-8">
                                        <input
                                            type="checkbox"
                                            checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedOrderIds(filteredOrders.map(o => String(o.id)));
                                                } else {
                                                    setSelectedOrderIds([]);
                                                }
                                            }}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                    </th>
                                    <th className="p-3">ID & Date</th>
                                    <th className="p-3">Client & Téléphone</th>
                                    <th className="p-3">Produit & Montant</th>
                                    <th className="p-3">Ville & Adresse</th>
                                    <th className="p-3">Statut Commande</th>
                                    <th className="p-3">Statut WhatsApp IA</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400">
                                            Aucune commande ne correspond aux filtres sélectionnés.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map(order => {
                                        const isSelected = selectedOrderIds.includes(String(order.id));
                                        const isSending = singleSendingId === order.id;

                                        return (
                                            <tr 
                                                key={order.id} 
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ${
                                                    isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                                                }`}
                                            >
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            const idStr = String(order.id);
                                                            if (e.target.checked) {
                                                                setSelectedOrderIds(prev => [...prev, idStr]);
                                                            } else {
                                                                setSelectedOrderIds(prev => prev.filter(i => i !== idStr));
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                </td>
                                                <td className="p-3 font-mono">
                                                    <div className="font-bold text-slate-800 dark:text-white">#{order.id}</div>
                                                    <div className="text-[10px] text-slate-400">{order.date}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-slate-800 dark:text-white">{order.customerName}</div>
                                                    <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        <span>{order.phone}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="text-slate-800 dark:text-white font-medium truncate max-w-[140px]">{order.product}</div>
                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{order.price} MAD</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-slate-800 dark:text-white">{order.city}</div>
                                                    <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{order.address}</div>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        order.status === OrderStatus.Confirme ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200' :
                                                        order.status === OrderStatus.Annule ? 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200' :
                                                        order.status === OrderStatus.EnAttend ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200' :
                                                        'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="space-y-1">
                                                        {order.whatsappStatus === 'confirmed' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                <CheckCircle2 className="w-3 h-3" /> Confirmé IA
                                                            </span>
                                                        ) : order.whatsappStatus === 'cancelled' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                                                <XCircle className="w-3 h-3" /> Annulé Client
                                                            </span>
                                                        ) : order.whatsappStatus === 'rescheduled' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                <Calendar className="w-3 h-3" /> Reporté Client
                                                            </span>
                                                        ) : order.whatsappStatus === 'sent' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                                                                <Clock className="w-3 h-3" /> Envoyé (En attente)
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px]">Non envoyé</span>
                                                        )}

                                                        {order.whatsappLastMessage && (
                                                            <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/70 px-2 py-0.5 rounded flex items-center gap-1 max-w-[170px] truncate" title={`Réponse client : ${order.whatsappLastMessage}`}>
                                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Rép:</span>
                                                                <span className="truncate">"{order.whatsappLastMessage}"</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handleSendOrder(order.id)}
                                                            disabled={isSending}
                                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs inline-flex items-center gap-1 transition shadow-sm"
                                                            title="Envoyer la demande de confirmation WhatsApp"
                                                        >
                                                            {isSending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                                            <span>{order.whatsappStatus === 'sent' ? 'Renvoyer' : 'Envoyer'}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleQuickSimulate(order, 'OUI je confirme la commande')}
                                                            className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition"
                                                            title="Simuler réponse client : OUI"
                                                        >
                                                            👍 OUI
                                                        </button>
                                                        <button
                                                            onClick={() => handleQuickSimulate(order, 'Non annulez svp')}
                                                            className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 transition"
                                                            title="Simuler réponse client : NON"
                                                        >
                                                            👎 NON
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: SETTINGS & TEMPLATES */}
            {activeTab === 'settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 space-y-6">
                        <form onSubmit={handleSaveConfig} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-emerald-600" />
                                <span>Règles d'Automatisation & Intelligence</span>
                            </h3>

                            {/* Automation Switches */}
                            <div className="space-y-3 pt-2">
                                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Confirmation automatique par IA</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Passe automatiquement la commande en "Confirmé" ou "Annulé" après analyse Gemini 3.8 Flash</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.autoConfirmWithAi}
                                        onChange={(e) => setConfig({ ...config, autoConfirmWithAi: e.target.checked })}
                                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Envoi automatique dès importation d'une commande</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Déclenche instantanément le message WhatsApp dès qu'une commande est importée en "En attente"</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.autoSendOnNewOrder}
                                        onChange={(e) => setConfig({ ...config, autoSendOnNewOrder: e.target.checked })}
                                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-white block">Synchronisation immédiate vers Google Sheets</span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Écrit le statut "Confirmé" dans votre Google Sheet en temps réel sans intervention humaine</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.syncToSheetsOnConfirm !== false}
                                        onChange={(e) => setConfig({ ...config, syncToSheetsOnConfirm: e.target.checked })}
                                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                    />
                                </label>
                            </div>

                            {/* Templates */}
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-slate-800 dark:text-white">Modèle du message initial envoyé au client :</label>
                                        <span className="text-[10px] text-slate-400">Variables : &#123;customerName&#125;, &#123;product&#125;, &#123;price&#125;, &#123;city&#125;, &#123;address&#125;</span>
                                    </div>
                                    <textarea
                                        rows={8}
                                        value={config.messageTemplate || ''}
                                        onChange={(e) => setConfig({ ...config, messageTemplate: e.target.value })}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none leading-relaxed"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">Réponse automatique après Confirmation :</label>
                                    <textarea
                                        rows={2}
                                        value={config.replyOnConfirm || ''}
                                        onChange={(e) => setConfig({ ...config, replyOnConfirm: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">Réponse automatique après Annulation :</label>
                                    <textarea
                                        rows={2}
                                        value={config.replyOnCancel || ''}
                                        onChange={(e) => setConfig({ ...config, replyOnCancel: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSavingConfig}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                            >
                                {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                <span>Enregistrer les modifications</span>
                            </button>
                        </form>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-3">
                                <Smartphone className="w-4 h-4 text-emerald-600" />
                                <span>Aperçu de la bulle WhatsApp client</span>
                            </h3>

                            <div className="p-4 rounded-2xl bg-[#e5ddd5] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 space-y-3">
                                <div className="flex justify-end">
                                    <div className="max-w-[90%] bg-[#dcf8c6] dark:bg-emerald-950 text-slate-800 dark:text-emerald-100 p-3 rounded-2xl rounded-tr-none shadow-sm text-xs leading-relaxed">
                                        <p className="whitespace-pre-line font-sans">
                                            {(config.messageTemplate || '')
                                                .replace(/\{customerName\}/g, 'Mohamed')
                                                .replace(/\{product\}/g, 'Pack Beauté Bio')
                                                .replace(/\{quantity\}/g, '1')
                                                .replace(/\{price\}/g, '299')
                                                .replace(/\{city\}/g, 'Casablanca')
                                                .replace(/\{address\}/g, 'Bd Zerktouni, Maarouf')}
                                        </p>
                                        <div className="text-[9px] text-slate-500 dark:text-emerald-400 text-right mt-1.5 flex items-center justify-end gap-1">
                                            <span>11:45</span>
                                            <span>✓✓</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Astuce d'efficacité :</span>
                                <p>Plus le message est concis avec des chiffres clairs (1 pour confirmer, 2 pour annuler), plus le taux de réponse client dépasse 85% au Maroc.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: LOGS & HISTORY */}
            {activeTab === 'logs' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    {/* Log Filter header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative w-full">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={logSearch}
                                    onChange={(e) => setLogSearch(e.target.value)}
                                    placeholder="Filtrer par téléphone ou message..."
                                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <select
                                value={logFilter}
                                onChange={(e) => setLogFilter(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none shrink-0"
                            >
                                <option value="all">Tous les événements</option>
                                <option value="outbound">Messages Envoyés</option>
                                <option value="inbound">Réponses Reçues</option>
                                <option value="ai_decision">Décisions IA</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={loadLogs}
                                className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                                title="Actualiser"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={handleClearLogs}
                                className="px-3 py-1.5 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Effacer</span>
                            </button>
                        </div>
                    </div>

                    {/* Logs Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold">
                                    <th className="p-3">Date & Heure</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Client & Téléphone</th>
                                    <th className="p-3">Contenu du Message</th>
                                    <th className="p-3">Interprétation IA</th>
                                    <th className="p-3">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            Aucun message enregistré dans le journal.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                                            <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString('fr-FR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit'
                                                })}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                {log.type === 'outbound' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                                                        ENVOYÉ
                                                    </span>
                                                )}
                                                {log.type === 'inbound' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                                                        REÇU CLIENT
                                                    </span>
                                                )}
                                                {log.type === 'ai_decision' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                                        RÉPONSE IA
                                                    </span>
                                                )}
                                                {log.type === 'system' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                                        SYSTÈME
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-slate-800 dark:text-white">{log.customerName || '—'}</div>
                                                <div className="font-mono text-slate-400 text-[11px]">{log.phone}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="max-w-md text-slate-700 dark:text-slate-300 font-medium whitespace-pre-line truncate hover:whitespace-normal">
                                                    {log.message}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {log.aiInterpretation?.decision ? (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        log.aiInterpretation.decision === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                        log.aiInterpretation.decision === 'CANCELLED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                                                        log.aiInterpretation.decision === 'RESCHEDULED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                        'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                                    }`}>
                                                        {log.aiInterpretation.decision}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-[11px]">—</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
