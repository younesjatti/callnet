
import { OrderStatus, Role, Order } from './types';

export const normalizeKey = (key: string): string => {
    const lower = key.toLowerCase().trim();
    
    // ID variations
    if (lower === 'id' || lower === 'ref' || lower === 'reference' || lower === 'order id' || lower.includes('id commande') || lower === 'n°' || lower === 'code') return 'id';
    
    // Customer Name variations - prioritize explicit name fields over generic 'client'
    if (lower === 'nom' || lower === 'nom complet' || lower.includes('customer') || lower.includes('full name') || lower.includes('nom du client') || lower.includes('acheteur') || lower === 'destinataire') return 'customerName';
    
    // Phone variations
    if (lower === 'tél' || lower === 'tel' || lower.includes('phone') || lower.includes('mobile') || lower.includes('gsm') || lower.includes('téléphone') || lower === 'whatsapp') return 'phone';
    
    // Product variations
    if (lower === 'produit' || lower === 'article' || lower.includes('product') || lower.includes('item') || lower === 'désignation') return 'product';
    
    // Price variations
    if (lower === 'prix' || lower === 'montant' || lower === 'total' || lower.includes('price') || lower.includes('amount') || lower === 'ttc') return 'price';
    
    // Date variations
    if (lower.includes('date')) return 'date';
    
    // City variations
    if (lower === 'ville' || lower === 'city' || lower === 'town' || lower === 'province') return 'city';
    
    // District / Quartier variations
    if (lower === 'quartier' || lower === 'district' || lower === 'secteur' || lower === 'zone' || lower === 'hay' || lower === 'arrondissement' || lower === 'neighborhood' || lower.includes('quartier') || lower.includes('district') || lower.includes('secteur') || lower.includes('hay ')) return 'district';

    // Address variations
    if (lower === 'adresse' || lower === 'address' || lower.includes('adresse') || lower.includes('address') || lower === 'lieu') return 'address';
    
    // Tracking number variations
    if (
        lower === 'tracking' ||
        lower === 'trackingnumber' ||
        lower === 'tracking_number' ||
        lower === 'tracking number' ||
        lower === 'tracking-number' ||
        lower === 'track_num' ||
        lower === 'tracknum' ||
        lower === 'suivi' ||
        lower === 'code suivi' ||
        lower === 'codesuivi' ||
        lower === 'numéro de suivi' ||
        lower === 'numero de suivi' ||
        lower === 'numero suivi' ||
        lower === 'numéro suivi' ||
        lower === 'n° suivi' ||
        lower === 'n° de suivi' ||
        lower === 'bordereau' ||
        lower === 'code d\'envoi' ||
        lower === 'code envoi' ||
        lower === 'numéro d\'envoi' ||
        lower === 'numero d\'envoi' ||
        lower === 'awb' ||
        lower === 'awb_number' ||
        lower === 'parcel_code' ||
        lower === 'parcelcode'
    ) return 'trackingNumber';

    // Courier / transporteur variations
    if (
        lower === 'transporteur' ||
        lower === 'société de livraison' ||
        lower === 'societe de livraison' ||
        lower === 'livreur' ||
        lower === 'courier' ||
        lower === 'courier_name' ||
        lower === 'couriername' ||
        lower === 'agence' ||
        lower.includes('transporteur')
    ) return 'courierName';

    // Courier status variations
    if (
        lower === 'statut livraison' ||
        lower === 'statut transporteur' ||
        lower === 'statut colis' ||
        lower === 'statut_livraison' ||
        lower === 'courier_status' ||
        lower === 'courierstatus'
    ) return 'courierStatus';

    // Additional fields
    if (lower === 'qty' || lower === 'qte' || lower === 'qté' || lower.includes('quantité') || lower.includes('quantity')) return 'quantity';
    if (lower.includes('variant') || lower.includes('variante') || lower === 'type' || lower === 'color' || lower === 'size') return 'variant';
    if (lower.includes('note') || lower.includes('comment') || lower.includes('remarque') || lower.includes('obs')) return 'note';
    
    // Admin specific fields (preserve these)
    if (lower === 'clientid' || lower === 'client_id' || lower === 'client id' || lower === 'owner') return 'clientId';
    if (
        lower === 'status' || 
        lower === 'statut' || 
        lower.includes('statut') || 
        lower.includes('status') || 
        lower === 'confirmation' || 
        lower.includes('confirmation') || 
        lower === 'etat' || 
        lower === 'état'
    ) return 'status';
    
    // If it's just 'client', map to customerName as a last resort
    if (lower === 'client') return 'customerName';
    
    return key;
};

/**
 * Normalise les chaînes de caractères de statut provenant de l'importation (Google Sheets, Excel, etc.)
 * pour correspondre aux valeurs de l'énumération OrderStatus.
 *
 * RÈGLES STRICTES :
 * 1. SEULES les cellules vides (undefined, null, chaîne vide ou espaces)
 *    sont mises à "En cours de confirmation" (OrderStatus.EnAttend).
 * 2. Si la cellule contient un statut reconnu (ex: "Confirmé", "Annulé", "Pas de rep 1", etc.),
 *    il est mappé vers son statut correspondant.
 * 3. Si la cellule contient un statut hors de la liste reconnue, il est OBLIGATOIREMENT
 *    marqué comme "inconnu" (OrderStatus.Inconnu).
 */
export const normalizeStatus = (status: any): OrderStatus => {
    // 1. Seules les cellules vides sont mises en cours de confirmation
    if (status === undefined || status === null || String(status).trim() === '') {
        return OrderStatus.EnAttend;
    }
    
    // Normalisation Unicode : Décomposition des caractères accentués et suppression des diacritiques
    let s = String(status)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    if (!s) return OrderStatus.EnAttend;

    // Handle specific mappings
    const statusMap: Record<string, OrderStatus> = {
        'confirme': OrderStatus.Confirme,
        'confirmed': OrderStatus.Confirme,
        'confirm': OrderStatus.Confirme,
        'confir': OrderStatus.Confirme,
        
        'expider': OrderStatus.Expider,
        'expedie': OrderStatus.Expider,
        'shipped': OrderStatus.Expider,
        'shipping': OrderStatus.Expider,
        
        'en attend': OrderStatus.EnAttend,
        'en attente': OrderStatus.EnAttend,
        'en cours': OrderStatus.EnAttend,
        'en cours de confirmation': OrderStatus.EnAttend,
        'en cours confirmation': OrderStatus.EnAttend,
        'cours de confirmation': OrderStatus.EnAttend,
        'en cours de traitement': OrderStatus.EnAttend,
        'processing': OrderStatus.EnAttend,
        'proccessing': OrderStatus.EnAttend,
        'in processing': OrderStatus.EnAttend,
        'in confirmation': OrderStatus.EnAttend,
        'pending': OrderStatus.EnAttend,
        'a confirmer': OrderStatus.EnAttend,
        'a traiter': OrderStatus.EnAttend,
        'في الانتظار': OrderStatus.EnAttend,
        'قيد التأكيد': OrderStatus.EnAttend,
        
        'reporter': OrderStatus.Reportee,
        'reporte': OrderStatus.Reportee,
        'reportee': OrderStatus.Reportee,
        'postponed': OrderStatus.Reportee,
        
        'non commandee': OrderStatus.NonCommandee,
        'non commande': OrderStatus.NonCommandee,
        'not ordered': OrderStatus.NonCommandee,
        
        'whatsapp': OrderStatus.Whatsapp,
        
        'annule': OrderStatus.Annule,
        'annulee': OrderStatus.Annule,
        'cancelled': OrderStatus.Annule,
        'cancel': OrderStatus.Annule,
        
        'faux numero': OrderStatus.FauxNumero,
        'faux num': OrderStatus.FauxNumero,
        'num incorect': OrderStatus.FauxNumero,
        'num incorrect': OrderStatus.FauxNumero,
        'numero incorrect': OrderStatus.FauxNumero,
        'numero faux': OrderStatus.FauxNumero,
        'wrong number': OrderStatus.FauxNumero,
        
        'personne incorrecte': OrderStatus.PersonneIncorrecte,
        'mauvaise personne': OrderStatus.PersonneIncorrecte,
        'wrong person': OrderStatus.PersonneIncorrecte,
        
        'expire': OrderStatus.Expire,
        'expired': OrderStatus.Expire,
        
        'en double': OrderStatus.EnDouble,
        'doublon': OrderStatus.EnDouble,
        'duplicate': OrderStatus.EnDouble,
        
        'hors zone': OrderStatus.HorsZone,
        'out of zone': OrderStatus.HorsZone,

        'inconnu': OrderStatus.Inconnu,
        'unknown': OrderStatus.Inconnu,
    };

    const pdrRegex = /(pas de rep|pdr|no answer|non rep|sans rep|aucune rep|ne repond pas)\s*([1-5])?/i;
    const injRegex = /(injoignable|unreachable|pas joinable)\s*([1-4])?/i;

    const pdrMatch = s.match(pdrRegex);
    if (pdrMatch) {
        const num = pdrMatch[2];
        if (num === '1') return OrderStatus.PasDeRep1;
        if (num === '2') return OrderStatus.PasDeRep2;
        if (num === '3') return OrderStatus.PasDeRep3;
        if (num === '4') return OrderStatus.PasDeRep4;
        if (num === '5') return OrderStatus.PasDeRep5;
        return OrderStatus.PasDeRep1;
    }

    const injMatch = s.match(injRegex);
    if (injMatch) {
        const num = injMatch[2];
        if (num === '1') return OrderStatus.Injoignable1;
        if (num === '2') return OrderStatus.Injoignable2;
        if (num === '3') return OrderStatus.Injoignable3;
        if (num === '4') return OrderStatus.Injoignable4;
        return OrderStatus.Injoignable1;
    }

    if (statusMap[s]) return statusMap[s];
    
    // Case-insensitive direct comparison with enum values
    const found = Object.values(OrderStatus).find(v => {
        const normalizedEnum = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return normalizedEnum === s;
    });

    if (found) return found as OrderStatus;

    // Statut hors de la liste : écrit "inconnu"
    return OrderStatus.Inconnu;
};

export function normalizeRole(inputRole: string | undefined): Role {
    if (!inputRole) return Role.Client;
    const lowerCaseRole = String(inputRole).toLowerCase().trim();
    if (lowerCaseRole === 'admin' || lowerCaseRole === 'administrateur') return Role.Admin;
    if (lowerCaseRole === 'manager' || lowerCaseRole === 'superviseur' || lowerCaseRole === 'responsable') return Role.Manager;
    if (lowerCaseRole === 'agent' || lowerCaseRole === 'callcenter' || lowerCaseRole === 'operateur' || lowerCaseRole === 'opérateur') return Role.Agent;
    return Role.Client;
}

const stringToHash = (s: string) => {
    let hash = 0;
    if (s.length === 0) return hash;
    for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
};

export const generateShortStableOrderId = (orderData: Partial<Order>, storeName: string, rowIndex?: any): string => {
    if (orderData.id && String(orderData.id).trim().length > 0) {
        return String(orderData.id).trim();
    }
    const { customerName, phone, product, price, date, city, district } = orderData;
    const normalizedCustomerName = (customerName || '').trim().toLowerCase();
    const normalizedProduct = (product || '').trim().toLowerCase();
    const normalizedPhone = (phone || '').replace(/\D/g, '').trim();
    const normalizedPrice = Number(price || 0).toFixed(2);
    const normalizedCity = (city || district || '').trim().toLowerCase();
    const normalizedRow = rowIndex !== undefined && rowIndex !== null ? String(rowIndex).trim() : '';

    const ts = parseOrderDateTimestamp(date);
    const dateString = ts > 0 ? new Date(ts).toISOString().split('T')[0] : 'NODATE';

    const baseString = `${normalizedCustomerName}|${normalizedPhone}|${normalizedProduct}|${normalizedPrice}|${normalizedCity}|${dateString}|${normalizedRow}`;
    const uniqueHash = stringToHash(baseString).toString(36).toUpperCase().substring(0, 6);
    const compactStoreName = (storeName || 'CN').split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4) || 'CN';
    const compactDate = dateString !== 'NODATE' ? dateString.replace(/-/g, '').substring(2) : '00';
    return `CN-${compactStoreName}-${compactDate}-${uniqueHash}`;
};

export function forcePrimitiveValue<T>(value: any, targetType: 'string' | 'number' | 'boolean'): T {
    if (value === null || value === undefined) {
        return (targetType === 'string' ? '' : (targetType === 'number' ? 0 : false)) as T;
    }

    if (targetType === 'string') {
        if (typeof value === 'object') {
            if (value instanceof Date) {
                return value.toISOString().split('T')[0] as T;
            }
            try {
                const stringified = JSON.stringify(value);
                if (stringified === '{}' || stringified === '[]') {
                    return '' as T;
                }
                return stringified as T;
            } catch (jsonError) {
                return String(value) as T;
            }
        }
        return String(value) as T;
    }

    if (targetType === 'number') {
        const num = Number(value);
        return (isNaN(num) ? 0 : num) as T;
    }

    if (targetType === 'boolean') {
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            if (lower === 'true' || lower === '1') return true as T;
            if (lower === 'false' || lower === '0') return false as T;
        }
        if (typeof value === 'number') {
            if (value === 1) return true as T;
            if (value === 0) return false as T;
        }
        return Boolean(value) as T;
    }

    return value as T;
}

export const isValidDate = (d: any): boolean => {
    if (!d) return false;
    const date = new Date(d);
    return !isNaN(date.getTime());
};

export const isOrderWithData = (o: Partial<Order>): boolean => {
    if (!o) return false;
    const phone = String(o.phone || '').trim();
    const customerName = String(o.customerName || '').trim();
    const product = String(o.product || '').trim();
    const address = String(o.address || '').trim();
    const city = String(o.city || '').trim();
    const district = String(o.district || '').trim();
    const note = String(o.note || '').trim();
    const price = Number(o.price || 0);

    const isNameValid = customerName !== '' && customerName.toLowerCase() !== 'inconnu';
    const isProductValid = product !== '' && product.toLowerCase() !== 'inconnu' && product.toLowerCase() !== 'produit';
    const isPhoneValid = phone !== '';
    const isAddressValid = address !== '' || city !== '' || district !== '';
    const isPriceValid = price > 0;
    const isNoteValid = note !== '';

    return isPhoneValid || isNameValid || isProductValid || isAddressValid || isPriceValid || isNoteValid;
};

export const formatWhatsAppPhone = (phone: string | number): string => {
    let clean = String(phone || '').replace(/[^0-9]/g, '');
    if (clean.startsWith('00212')) {
        clean = clean.slice(2);
    } else if (clean.startsWith('0') && clean.length >= 10) {
        clean = '212' + clean.slice(1);
    } else if (clean.length === 9 && !clean.startsWith('212')) {
        clean = '212' + clean;
    } else if (!clean.startsWith('212') && clean.length > 0) {
        clean = '212' + clean;
    }
    return clean;
};

/**
 * Formate un numéro de téléphone pour les actions Appeler (tel:) et SMS (sms:).
 * - Supprime les espaces et caractères parasites.
 * - Si le numéro commence par 0 (ex: 0612345678), le convertit en format international +212612345678.
 * - Si le numéro ne commence ni par 0 ni par 212 (ex: 612345678), ajoute l'indicatif +212612345678.
 * - Préserve et normalise les préfixes 212 / +212 / 00212.
 */
export const formatCallOrSmsPhone = (phone: string | number): string => {
    if (!phone) return '';
    let raw = String(phone).trim();
    // Nettoyer les espaces, tirets, parenthèses, points
    let clean = raw.replace(/[^\d+]/g, '');

    if (!clean) return '';

    // Si commence déjà par +212
    if (clean.startsWith('+212')) {
        return clean;
    }
    // Si commence par 00212
    if (clean.startsWith('00212')) {
        return '+212' + clean.slice(5);
    }
    // Si commence par 212 sans +
    if (clean.startsWith('212')) {
        return '+' + clean;
    }
    // Si commence par 0 (ex: 06XXXXXXXX, 07XXXXXXXX, 05XXXXXXXX)
    if (clean.startsWith('0')) {
        return '+212' + clean.replace(/^0+/, '');
    }
    // Si ne commence pas par 0 et est un numéro sans indicatif (ex: 6XXXXXXXX ou 7XXXXXXXX)
    if (!clean.startsWith('+')) {
        return '+212' + clean;
    }

    return clean;
};

export const getWhatsAppUrl = (order: Partial<Order>): string => {
    const cleanPhone = formatWhatsAppPhone(order.phone || '');
    const greeting = order.customerName ? `Bonjour ${order.customerName}` : 'Bonjour';
    const orderId = order.id ? ` #${order.id}` : '';
    const productInfo = order.product ? `\n📦 *Produit* : ${order.product}${order.variant ? ` (${order.variant})` : ''}` : '';
    const quantityInfo = order.quantity && order.quantity > 1 ? `\n🔢 *Quantité* : ${order.quantity}` : '';
    const priceInfo = order.price ? `\n💰 *Total* : ${order.price} MAD` : '';
    const locationInfo = (order.city || order.district) ? `\n📍 *Destination* : ${[order.city, order.district].filter(Boolean).join(' - ')}` : '';
    
    const message = encodeURIComponent(
        `${greeting},\n\nNous vous contactons concernant votre commande${orderId} :${productInfo}${quantityInfo}${priceInfo}${locationInfo}\n\nMerci de nous confirmer la livraison.`
    );
    
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${message}` : `https://wa.me/?text=${message}`;
};

/**
 * Parse any date format into a reliable numeric timestamp (ms).
 * Returns 0 instead of NaN if date is invalid or missing, preventing random array reordering.
 */
export const parseOrderDateTimestamp = (dateInput: any): number => {
    if (!dateInput) return 0;
    if (typeof dateInput === 'number') {
        return isNaN(dateInput) ? 0 : dateInput;
    }
    if (dateInput instanceof Date) {
        const time = dateInput.getTime();
        return isNaN(time) ? 0 : time;
    }
    const str = String(dateInput).trim();
    if (!str) return 0;

    // Check if pure numeric timestamp as string
    if (/^\d{10,14}$/.test(str)) {
        const num = Number(str);
        if (!isNaN(num)) return num;
    }

    // Match DD/MM/YYYY or DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss
    const frSlashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (frSlashMatch) {
        const day = parseInt(frSlashMatch[1], 10);
        const month = parseInt(frSlashMatch[2], 10) - 1;
        const year = parseInt(frSlashMatch[3], 10);
        const hour = frSlashMatch[4] ? parseInt(frSlashMatch[4], 10) : 0;
        const min = frSlashMatch[5] ? parseInt(frSlashMatch[5], 10) : 0;
        const sec = frSlashMatch[6] ? parseInt(frSlashMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, min, sec);
        const time = d.getTime();
        return isNaN(time) ? 0 : time;
    }

    // Match DD-MM-YYYY
    const frDashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (frDashMatch) {
        const day = parseInt(frDashMatch[1], 10);
        const month = parseInt(frDashMatch[2], 10) - 1;
        const year = parseInt(frDashMatch[3], 10);
        const hour = frDashMatch[4] ? parseInt(frDashMatch[4], 10) : 0;
        const min = frDashMatch[5] ? parseInt(frDashMatch[5], 10) : 0;
        const sec = frDashMatch[6] ? parseInt(frDashMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, min, sec);
        const time = d.getTime();
        return isNaN(time) ? 0 : time;
    }

    const parsed = new Date(str).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Tri déterministe et stable à 100% pour les commandes.
 * Empêche les commandes de sauter de haut en bas lors des synchronisations automatiques (10s).
 *
 * Ordre de tri :
 * 1. Priorité aux statuts "En attente" (si priorityPending = true)
 * 2. Date décroissante (la plus récente en premier)
 * 3. En cas d'égalité de date : Tri alphanumérique déterministe sur l'ID de commande (décroissant)
 * 4. En cas d'égalité d'ID : Nom du client
 */
export const stableSortOrders = (orders: Order[], priorityPending: boolean = true): Order[] => {
    if (!Array.isArray(orders) || orders.length === 0) return [];

    return [...orders].sort((a, b) => {
        // 1. Priorité "En attente"
        if (priorityPending) {
            const aPending = a.status === OrderStatus.EnAttend;
            const bPending = b.status === OrderStatus.EnAttend;
            if (aPending && !bPending) return -1;
            if (!aPending && bPending) return 1;
        }

        // 2. Date la plus récente en premier (décroissante)
        const timeA = parseOrderDateTimestamp(a.date);
        const timeB = parseOrderDateTimestamp(b.date);
        if (timeB !== timeA) {
            return timeB - timeA;
        }

        // 3. Clé de départage déterministe principale : ID de commande (tri naturel alphanumérique décroissant)
        const idA = String(a.id || '').trim();
        const idB = String(b.id || '').trim();
        if (idA !== idB) {
            return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
        }

        // 4. Clé de départage secondaire : Nom client
        const nameA = String(a.customerName || '').trim();
        const nameB = String(b.customerName || '').trim();
        if (nameA !== nameB) {
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        }

        // 5. Clé tertiaire : Téléphone
        const phoneA = String(a.phone || '').trim();
        const phoneB = String(b.phone || '').trim();
        return phoneA.localeCompare(phoneB);
    });
};

