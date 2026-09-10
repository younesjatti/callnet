import React, { useState, useMemo, useEffect } from 'react';
import { 
    Truck, 
    Search, 
    RefreshCw, 
    Eye, 
    Copy, 
    Check, 
    Phone, 
    ExternalLink, 
    Calendar, 
    MapPin, 
    User as UserIcon, 
    Package, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    RotateCcw, 
    AlertTriangle, 
    ArrowRight, 
    X, 
    Filter, 
    Sparkles, 
    MessageSquare, 
    Download, 
    Layers,
    ChevronRight,
    HelpCircle,
    Plus,
    Edit3,
    Barcode
} from 'lucide-react';
import { Order, OrderStatus, Role } from '../types';
import { AmeexLogo, IrsaliyatLogo, OnesstaLogo, ForcelogLogo } from './CourierCompanyLogos';
import { OZON_EXPRESS_LOGO, DIGYLOG_LOGO } from '../lib/courierCities';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient } from '../lib/apiClient';

interface ParcelTrackingViewProps {
    orders: Order[];
    onUpdateOrder?: (orderId: string, updates: Partial<Order>) => void | Promise<void>;
    onSelectOrder?: (order: Order) => void;
    onNavigateToExpeditions?: () => void;
    storeName?: string;
}

interface TrackingStep {
    status: string;
    date: string;
    location?: string;
    done: boolean;
    note?: string;
}

interface TrackingDetail {
    orderId?: string;
    trackingNumber: string;
    courierName: string;
    courierStatus: string;
    history: TrackingStep[];
    lastSync?: string;
    remoteData?: any;
}

export type ParcelCategory = 'NOT_TRANSMITTED' | 'AWAITING_SCAN' | 'IN_TRANSIT' | 'DISTRIBUTION' | 'DELIVERED' | 'ISSUES';

export const ParcelTrackingView: React.FC<ParcelTrackingViewProps> = ({
    orders = [],
    onUpdateOrder,
    onSelectOrder,
    onNavigateToExpeditions,
    storeName
}) => {
    const { currentUser } = useAuth();
    const { t } = useLanguage();

    // Omni-search input state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusTab, setSelectedStatusTab] = useState<'ALL' | 'NOT_TRANSMITTED' | 'AWAITING_SCAN' | 'IN_TRANSIT' | 'DISTRIBUTION' | 'DELIVERED' | 'ISSUES'>('ALL');
    const [selectedCourier, setSelectedCourier] = useState<string>('ALL');
    
    // Courier configs & primary default courier
    const [courierConfigs, setCourierConfigs] = useState<any[]>([]);
    const [primaryCourier, setPrimaryCourier] = useState<string | null>(null);
    const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(true);
    const [isSwitchingPrimary, setIsSwitchingPrimary] = useState(false);

    // Sync & loading states
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
    const [loadingOrderIds, setLoadingOrderIds] = useState<Set<string>>(new Set());
    const [isDirectSearching, setIsDirectSearching] = useState(false);

    // Tracking detail cache & Modal state
    const [trackingCache, setTrackingCache] = useState<Record<string, TrackingDetail>>({});
    const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Manual Tracking Assignment Modal State
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualOrderTarget, setManualOrderTarget] = useState<Order | null>(null);
    const [manualSelectedOrderId, setManualSelectedOrderId] = useState<string>('');
    const [manualTrackingNumber, setManualTrackingNumber] = useState('');
    const [manualCourierName, setManualCourierName] = useState('Ozon Express');
    const [manualCourierStatus, setManualCourierStatus] = useState('Nouveau Colis Créé');
    const [manualShippedAt, setManualShippedAt] = useState('');
    const [manualCourierNote, setManualCourierNote] = useState('');
    const [manualOrderSearch, setManualOrderSearch] = useState('');
    const [isSavingManual, setIsSavingManual] = useState(false);

    const openManualModal = (order?: Order) => {
        if (order) {
            setManualOrderTarget(order);
            setManualSelectedOrderId(order.id);
            setManualTrackingNumber(order.trackingNumber || '');
            setManualCourierName(order.courierName || 'Ozon Express');
            setManualCourierStatus(order.courierStatus || 'Nouveau Colis Créé');
            setManualShippedAt(order.shippedAt ? order.shippedAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
            setManualCourierNote(order.courierNote || '');
        } else {
            const defaultOrder = orders.find(o => !o.trackingNumber) || orders[0] || null;
            setManualOrderTarget(defaultOrder);
            setManualSelectedOrderId(defaultOrder?.id || '');
            setManualTrackingNumber('');
            setManualCourierName('Ozon Express');
            setManualCourierStatus('Nouveau Colis Créé');
            setManualShippedAt(new Date().toISOString().slice(0, 10));
            setManualCourierNote('');
        }
        setManualOrderSearch('');
        setManualModalOpen(true);
    };

    const handleSaveManualTracking = async () => {
        const targetOrder = orders.find(o => String(o.id) === String(manualSelectedOrderId)) || manualOrderTarget;
        if (!targetOrder) {
            setFeedbackToast({ type: 'error', message: 'Veuillez sélectionner une commande cible.' });
            return;
        }

        const cleanTracking = manualTrackingNumber.trim();
        if (!cleanTracking) {
            setFeedbackToast({ type: 'error', message: 'Veuillez renseigner un numéro de suivi valide.' });
            return;
        }

        setIsSavingManual(true);
        try {
            const updates: Partial<Order> = {
                trackingNumber: cleanTracking,
                courierName: manualCourierName.trim() || 'Transporteur Express',
                courierStatus: manualCourierStatus.trim() || 'Nouveau Colis Créé',
                shippedAt: manualShippedAt ? new Date(manualShippedAt).toISOString() : new Date().toISOString(),
                courierNote: manualCourierNote.trim() || undefined,
                status: OrderStatus.Expedie
            };

            if (onUpdateOrder) {
                await onUpdateOrder(targetOrder.id, updates);
            }

            setFeedbackToast({
                type: 'success',
                message: `N° de suivi ${cleanTracking} (${manualCourierName}) enregistré avec succès pour #${targetOrder.id}`
            });
            setManualModalOpen(false);
        } catch (err: any) {
            setFeedbackToast({
                type: 'error',
                message: `Erreur lors de l'enregistrement : ${err.message || 'Erreur inconnue'}`
            });
        } finally {
            setIsSavingManual(false);
        }
    };

    // Load Courier Configurations & Primary Provider
    const loadCouriers = async () => {
        setIsLoadingConfigs(true);
        try {
            const [configsRes, primaryRes]: any = await Promise.allSettled([
                apiClient.apiFetch('/couriers/configs'),
                apiClient.apiFetch('/couriers/primary')
            ]);

            if (configsRes.status === 'fulfilled' && Array.isArray(configsRes.value)) {
                setCourierConfigs(configsRes.value);
            }
            if (primaryRes.status === 'fulfilled' && primaryRes.value?.primaryCourier) {
                setPrimaryCourier(primaryRes.value.primaryCourier);
            }
        } catch (e) {
            console.warn("Failed to load courier configs:", e);
        } finally {
            setIsLoadingConfigs(false);
        }
    };

    useEffect(() => {
        loadCouriers();
    }, []);

    // Helper to verify if credentials are real (non-dummy)
    const isDummy = (val: any) => {
        if (!val) return true;
        const s = String(val).trim().toLowerCase();
        return s === '' || 
               s.includes('test') || 
               s.includes('dummy') || 
               s.includes('fake') || 
               s.includes('demo') || 
               s.includes('mock') || 
               s.includes('placeholder') || 
               s.includes('0123456789') || 
               s.startsWith('token_') || 
               s === 'your_token_here' || 
               s === 'your_api_key' || 
               s === 'secret_token';
    };

    const isCourierConfigured = (cfg: any): boolean => {
        if (!cfg) return false;
        if (cfg.provider === 'digylog') {
            return Boolean(cfg.apiKey && !isDummy(cfg.apiKey));
        }
        return Boolean(cfg.apiKey && cfg.clientId && !isDummy(cfg.apiKey) && !isDummy(cfg.clientId));
    };

    // List of properly configured couriers (strictly deduplicated by provider)
    const configuredCouriers = useMemo(() => {
        const seen = new Set<string>();
        const list: typeof courierConfigs = [];
        for (const cfg of courierConfigs) {
            if (!cfg || !cfg.provider) continue;
            const prov = String(cfg.provider).toLowerCase().trim();
            if (!seen.has(prov) && isCourierConfigured(cfg)) {
                seen.add(prov);
                list.push({ ...cfg, provider: prov as any });
            }
        }
        return list;
    }, [courierConfigs]);

    // The active default primary courier
    const activePrimary = useMemo(() => {
        if (primaryCourier) {
            const found = courierConfigs.find(c => c.provider === primaryCourier);
            if (found && isCourierConfigured(found)) return found;
        }
        return configuredCouriers[0] || null;
    }, [courierConfigs, primaryCourier, configuredCouriers]);

    const hasAnyConfiguredCourier = configuredCouriers.length > 0;

    // Change default courier handler
    const handleSetPrimaryCourier = async (provider: string) => {
        setIsSwitchingPrimary(true);
        try {
            await apiClient.apiPut('/couriers/primary', { provider });
            setPrimaryCourier(provider);
            setFeedbackToast({
                type: 'success',
                message: `Société de livraison par défaut définie sur ${
                    provider === 'ozon_express' ? 'Ozon Express' : 
                    provider === 'digylog' ? 'DIGYLOG Express' : 
                    provider === 'ameex' ? 'Ameex Express' : 'Kargo Express'
                } !`
            });
        } catch (err: any) {
            setFeedbackToast({
                type: 'error',
                message: err.message || 'Impossible de changer la société par défaut.'
            });
        } finally {
            setIsSwitchingPrimary(false);
        }
    };

    // Auto dismiss toasts
    useEffect(() => {
        if (feedbackToast) {
            const timer = setTimeout(() => setFeedbackToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [feedbackToast]);

    // Copy to clipboard helper
    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedCode(text);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    // Filter all shipped orders
    const shippedOrders = useMemo(() => {
        return orders.filter(o => {
            const s = String(o.status || '').toLowerCase().trim();
            return (
                s === OrderStatus.Expider ||
                s === OrderStatus.Expedie ||
                s === 'expedie' ||
                s === 'expédié' ||
                s === 'expider' ||
                Boolean(o.trackingNumber && o.trackingNumber.trim() !== '') ||
                Boolean(o.shippedAt) ||
                (o.courierStatus && o.courierStatus.trim() !== '')
            );
        });
    }, [orders]);

    // Helper to categorize courier delivery statuses based on real tracking state
    const getOrderParcelCategory = (order: Order): ParcelCategory => {
        if (!order.trackingNumber || order.trackingNumber.trim() === '') {
            return 'NOT_TRANSMITTED';
        }
        const cached = trackingCache[order.id] || (order.trackingNumber ? trackingCache[order.trackingNumber] : null);
        const s = String(cached?.courierStatus || order.courierStatus || '').toLowerCase().trim();
        if (!s || s === 'non synchronisé' || s === 'en attente' || s === 'créé' || s.startsWith('nouveau colis')) {
            return 'AWAITING_SCAN';
        }
        if (/livr|delivered|payé|paye|encaiss|reçu client/i.test(s)) return 'DELIVERED';
        if (/distrib|tourn|cours de livr|en cours de livraison|avec le livreur/i.test(s)) return 'DISTRIBUTION';
        if (/refus|report|annul|injoignable|pas de reponse|pas de réponse|retour|avarie|échec/i.test(s)) return 'ISSUES';
        return 'IN_TRANSIT';
    };

    // Metrics counters
    const metrics = useMemo(() => {
        let notTransmitted = 0;
        let awaitingScan = 0;
        let inTransit = 0;
        let inDistribution = 0;
        let delivered = 0;
        let deliveredAmount = 0;
        let issues = 0;

        shippedOrders.forEach(o => {
            const cat = getOrderParcelCategory(o);
            if (cat === 'NOT_TRANSMITTED') {
                notTransmitted++;
            } else if (cat === 'AWAITING_SCAN') {
                awaitingScan++;
            } else if (cat === 'DELIVERED') {
                delivered++;
                deliveredAmount += Number(o.price || 0);
            } else if (cat === 'DISTRIBUTION') {
                inDistribution++;
            } else if (cat === 'ISSUES') {
                issues++;
            } else {
                inTransit++;
            }
        });

        return {
            total: shippedOrders.length,
            notTransmitted,
            awaitingScan,
            inTransit,
            inDistribution,
            delivered,
            deliveredAmount,
            issues
        };
    }, [shippedOrders, trackingCache]);

    // Filtered orders according to Omni-Search and filters
    const filteredOrders = useMemo(() => {
        const rawQ = searchQuery.trim();
        const cleanDigits = rawQ.replace(/\D/g, '');
        const normQ = rawQ.toLowerCase();

        return shippedOrders.filter(o => {
            // 1. Status Filter
            if (selectedStatusTab !== 'ALL') {
                const cat = getOrderParcelCategory(o);
                if (cat !== selectedStatusTab) return false;
            }

            // 2. Courier Filter
            if (selectedCourier !== 'ALL') {
                const cName = String(o.courierName || '').toLowerCase();
                if (selectedCourier === 'ameex' && !cName.includes('ameex')) return false;
                if (selectedCourier === 'ozon' && !cName.includes('ozon')) return false;
                if (selectedCourier === 'kargo' && !cName.includes('kargo')) return false;
                if (selectedCourier === 'digylog' && !cName.includes('digylog')) return false;
            }

            // 3. Omni-Search matching: Phone, Customer Name, Tracking Number, Order ID, City
            if (!rawQ) return true;

            // Phone search (flexible: matches last digits or exact Moroccan numbers)
            if (cleanDigits.length >= 4 && o.phone) {
                const oDigits = o.phone.replace(/\D/g, '');
                if (oDigits.includes(cleanDigits) || cleanDigits.includes(oDigits.slice(-8))) {
                    return true;
                }
            }

            // Customer Name search
            if (o.customerName && o.customerName.toLowerCase().includes(normQ)) {
                return true;
            }

            // Tracking Number search
            if (o.trackingNumber && o.trackingNumber.toLowerCase().includes(normQ)) {
                return true;
            }

            // Order ID search
            if (o.id && String(o.id).toLowerCase().includes(normQ)) {
                return true;
            }

            // City or Product
            if (o.city && o.city.toLowerCase().includes(normQ)) {
                return true;
            }
            if (o.product && o.product.toLowerCase().includes(normQ)) {
                return true;
            }

            return false;
        });
    }, [shippedOrders, searchQuery, selectedStatusTab, selectedCourier, trackingCache]);

    // Live track single parcel via backend
    const trackOrderLive = async (order: Order, openModal = false) => {
        const hasTracking = Boolean(order.trackingNumber && order.trackingNumber.trim());
        const hasPhone = Boolean(order.phone && order.phone.trim());
        const hasName = Boolean(order.customerName && order.customerName.trim());

        if (!hasTracking && !hasPhone && !hasName) {
            if (openModal) {
                setActiveModalOrder(order);
                return;
            }
            setFeedbackToast({
                type: 'info',
                message: "Cette commande n'a ni numéro de suivi, ni téléphone, ni nom pour interroger le transporteur."
            });
            return;
        }

        if (!hasAnyConfiguredCourier) {
            setFeedbackToast({
                type: 'error',
                message: "Action bloquée : Aucune société de livraison n'est configurée avec des identifiants valides. Le mode simulation est désactivé."
            });
            return;
        }

        const effCourierName = order.courierName || activePrimary?.name || '';
        const isOzon = effCourierName.toLowerCase().includes('ozon') || (!order.courierName && activePrimary?.provider === 'ozon_express');

        // Ozon Express strictly requires tracking number. If not present yet, guide the user cleanly
        if (!hasTracking && isOzon) {
            if (openModal) {
                setActiveModalOrder(order);
            }
            setFeedbackToast({
                type: 'info',
                message: `Pour Ozon Express, le numéro de suivi (ex: OZE...) est requis. Vous pouvez l'expédier depuis l'onglet Expéditions ou lui assigner un numéro manuellement.`
            });
            return;
        }

        setLoadingOrderIds(prev => new Set(prev).add(order.id));
        try {
            const res: any = await apiClient.apiPost('/couriers/live-track', {
                orderId: order.id,
                trackingNumber: order.trackingNumber,
                phone: order.phone,
                customerName: order.customerName,
                courierName: effCourierName
            });

            if (res && res.success) {
                const recoveredTracking = res.trackingNumber || order.trackingNumber || '';
                const detail: TrackingDetail = {
                    orderId: order.id,
                    trackingNumber: recoveredTracking,
                    courierName: res.courierName || effCourierName || 'Transporteur',
                    courierStatus: res.courierStatus || 'En cours d\'acheminement',
                    history: res.history || [],
                    lastSync: res.lastSync || new Date().toISOString(),
                    remoteData: res.remoteData
                };

                setTrackingCache(prev => ({
                    ...prev,
                    [order.id]: detail,
                    ...(recoveredTracking ? { [recoveredTracking]: detail } : {})
                }));

                const updatedOrderObj = {
                    ...order,
                    courierStatus: res.courierStatus,
                    trackingNumber: recoveredTracking,
                    courierName: res.courierName || effCourierName
                };

                // Update order in parent state if status changed or tracking was recovered
                if (onUpdateOrder && (order.courierStatus !== res.courierStatus || !order.trackingNumber || res.orderUpdated)) {
                    await onUpdateOrder(order.id, {
                        courierStatus: res.courierStatus,
                        trackingNumber: recoveredTracking,
                        courierName: res.courierName || effCourierName
                    });
                }

                if (openModal) {
                    setActiveModalOrder(updatedOrderObj);
                }

                setFeedbackToast({
                    type: 'success',
                    message: (res.orderUpdated && !order.trackingNumber)
                        ? `N° de suivi ${recoveredTracking} récupéré auprès de ${res.courierName} ! Statut : ${res.courierStatus}`
                        : `Statut actualisé pour ${order.customerName}: ${res.courierStatus}`
                });
            } else {
                if (openModal) {
                    setActiveModalOrder(order);
                }
                setFeedbackToast({
                    type: 'info',
                    message: res?.message || 'Aucun suivi trouvé auprès du transporteur pour le moment.'
                });
            }
        } catch (err: any) {
            setFeedbackToast({
                type: 'error',
                message: err?.message || 'Impossible d\'actualiser le suivi.'
            });
        } finally {
            setLoadingOrderIds(prev => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
        }
    };

    // Direct search by phone / name / tracking code in carrier system
    const handleDirectSearch = async () => {
        const query = searchQuery.trim();
        if (!query) return;

        if (!hasAnyConfiguredCourier) {
            setFeedbackToast({
                type: 'error',
                message: "Recherche bloquée : Aucune société de livraison n'est configurée avec des identifiants valides. Le mode simulation est désactivé."
            });
            return;
        }

        setIsDirectSearching(true);
        try {
            const res: any = await apiClient.apiPost('/couriers/live-track', {
                phone: query,
                customerName: query,
                trackingNumber: query,
                courierName: activePrimary?.name || ''
            });

            if (res && res.success) {
                const detail: TrackingDetail = {
                    orderId: res.order?.id,
                    trackingNumber: res.trackingNumber,
                    courierName: res.courierName || activePrimary?.name || 'Transporteur',
                    courierStatus: res.courierStatus,
                    history: res.history || [],
                    lastSync: res.lastSync || new Date().toISOString(),
                    remoteData: res.remoteData
                };

                if (res.order) {
                    setTrackingCache(prev => ({
                        ...prev,
                        [res.order.id]: detail,
                        [res.trackingNumber]: detail
                    }));
                    if (onUpdateOrder && (res.orderUpdated || !res.order.trackingNumber)) {
                        await onUpdateOrder(res.order.id, {
                            trackingNumber: res.trackingNumber,
                            courierStatus: res.courierStatus,
                            courierName: res.courierName
                        });
                    }
                    setActiveModalOrder({
                        ...res.order,
                        trackingNumber: res.trackingNumber,
                        courierStatus: res.courierStatus,
                        courierName: res.courierName
                    });
                }

                setFeedbackToast({
                    type: 'success',
                    message: res.orderUpdated
                        ? `Colis trouvé chez ${res.courierName} ! N° de suivi ${res.trackingNumber} enregistré sur la commande.`
                        : `Colis trouvé (${res.courierName}): ${res.courierStatus}`
                });
            } else {
                setFeedbackToast({
                    type: 'info',
                    message: res?.message || 'Aucun suivi trouvé via l\'API pour cette recherche.'
                });
            }
        } catch (err: any) {
            setFeedbackToast({
                type: 'error',
                message: err?.message || 'Erreur de recherche en direct.'
            });
        } finally {
            setIsDirectSearching(false);
        }
    };

    // Bulk sync all shipped orders in one click
    const handleSyncAllOrders = async () => {
        if (shippedOrders.length === 0) return;

        if (!hasAnyConfiguredCourier) {
            setFeedbackToast({
                type: 'error',
                message: "Synchronisation bloquée : Aucune société de livraison n'est configurée avec des identifiants valides. Le mode simulation est désactivé."
            });
            return;
        }

        setIsSyncingAll(true);
        setSyncProgress({ current: 0, total: shippedOrders.length });

        try {
            const res: any = await apiClient.apiPost('/couriers/bulk-track', {
                orderIds: shippedOrders.map(o => o.id)
            });

            if (res && res.success) {
                if (Array.isArray(res.updatedOrders)) {
                    const cacheUpdates: Record<string, TrackingDetail> = {};
                    for (const uo of res.updatedOrders) {
                        const detail: TrackingDetail = {
                            orderId: uo.id,
                            trackingNumber: uo.trackingNumber,
                            courierName: uo.courierName || 'Transporteur',
                            courierStatus: uo.courierStatus || 'En cours',
                            history: uo.history || [],
                            lastSync: new Date().toISOString()
                        };
                        cacheUpdates[uo.id] = detail;
                        if (uo.trackingNumber) {
                            cacheUpdates[uo.trackingNumber] = detail;
                        }
                    }
                    setTrackingCache(prev => ({ ...prev, ...cacheUpdates }));

                    if (onUpdateOrder) {
                        for (const uo of res.updatedOrders) {
                            onUpdateOrder(uo.id, {
                                trackingNumber: uo.trackingNumber,
                                courierStatus: uo.courierStatus,
                                courierName: uo.courierName
                            });
                        }
                    }
                }

                setFeedbackToast({
                    type: 'success',
                    message: res.recoveredTrackingCount > 0
                        ? `${res.updatedCount} colis actualisés (${res.recoveredTrackingCount} nouveaux numéros de suivi récupérés auprès du transporteur) !`
                        : `Synchronisation terminée ! ${res.updatedCount || shippedOrders.length} colis actualisés.`
                });
            } else {
                throw new Error(res?.message || 'Erreur de synchronisation en masse.');
            }
        } catch (err: any) {
            console.error('Bulk tracking sync error:', err);
            setFeedbackToast({
                type: 'error',
                message: err?.message || 'Erreur lors de la synchronisation des statuts.'
            });
        } finally {
            setIsSyncingAll(false);
            setSyncProgress(null);
        }
    };

    // Render courier logo / icon
    const renderCourierBadge = (courierName: string | undefined, trackingNumber: string | undefined, order?: Order) => {
        if (!trackingNumber && !courierName) {
            return (
                <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-base-200 text-text-secondary border border-base-300">
                        <Package className="w-3 h-3 text-text-secondary/70" />
                        <span>Non assigné</span>
                    </span>
                    {activePrimary?.name && (
                        <div className="text-[10px] text-text-secondary">
                            Prévu : {activePrimary.name}
                        </div>
                    )}
                    {order && (
                        <div>
                            <button
                                onClick={() => openManualModal(order)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-accent hover:underline cursor-pointer"
                                title="Assigner manuellement un transporteur et un numéro de suivi"
                            >
                                <Plus className="w-2.5 h-2.5" />
                                <span>Assigner N° suivi</span>
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        const effectiveName = courierName || activePrimary?.name || '';
        const cName = String(effectiveName).toLowerCase();
        const track = String(trackingNumber || '').toUpperCase();
        const isDefault = !courierName && Boolean(activePrimary?.name);

        let iconNode = null;
        let label = effectiveName || 'Transporteur Express';

        if (cName.includes('ameex') || track.startsWith('AMX')) {
            label = 'Ameex Express';
            iconNode = <AmeexLogo className="w-5 h-5 shrink-0" size={20} />;
        } else if (cName.includes('ozon') || track.startsWith('OZE')) {
            label = 'Ozon Express';
            iconNode = (
                <div className="w-5 h-5 rounded bg-purple-600 flex items-center justify-center text-white font-black text-[9px] shrink-0 shadow-xs">
                    OZ
                </div>
            );
        } else if (cName.includes('kargo') || track.startsWith('KG')) {
            label = 'Kargo Express';
            iconNode = (
                <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-white font-black text-[9px] shrink-0 shadow-xs">
                    KG
                </div>
            );
        } else if (cName.includes('digylog') || track.startsWith('DGL') || track.startsWith('DL')) {
            label = 'DIGYLOG';
            iconNode = (
                <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white font-black text-[9px] shrink-0 shadow-xs">
                    DG
                </div>
            );
        } else {
            iconNode = (
                <div className="w-5 h-5 rounded bg-slate-500/20 text-text-secondary flex items-center justify-center text-xs shrink-0">
                    <Truck className="w-3 h-3" />
                </div>
            );
        }

        return (
            <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {iconNode}
                    <span className="font-semibold text-xs text-text-primary">{label}</span>
                    {isDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-base-200 text-text-secondary font-medium" title="Assigné par défaut à la société configurée">
                            (Défaut)
                        </span>
                    )}
                </div>
                {order && (
                    <button
                        onClick={() => openManualModal(order)}
                        className="inline-flex items-center gap-1 text-[10px] text-text-secondary hover:text-accent font-medium cursor-pointer"
                        title="Modifier le numéro de suivi ou le transporteur"
                    >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Modifier</span>
                    </button>
                )}
            </div>
        );
    };

    // Render Status Badge based on order state
    const renderStatusBadge = (order: Order) => {
        const cat = getOrderParcelCategory(order);
        const statusText = order.courierStatus;

        if (cat === 'NOT_TRANSMITTED') {
            return (
                <div className="space-y-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Non transmis (Sans N° suivi)</span>
                    </span>
                    <p className="text-[10px] text-text-secondary">En attente d'expédition vers le transporteur</p>
                </div>
            );
        }
        if (cat === 'AWAITING_SCAN') {
            return (
                <div className="space-y-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{statusText || 'En attente 1er scan'}</span>
                    </span>
                    <p className="text-[10px] text-text-secondary">Transmis, non encore scanné au Hub</p>
                </div>
            );
        }
        if (cat === 'DELIVERED') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{statusText || 'Livré & Encaissé'}</span>
                </span>
            );
        }
        if (cat === 'DISTRIBUTION') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
                    <Truck className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    <span>{statusText || 'En cours de distribution'}</span>
                </span>
            );
        }
        if (cat === 'ISSUES') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{statusText || 'Incident / Refus'}</span>
                </span>
            );
        }

        // Default IN_TRANSIT
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{statusText || 'En cours d\'acheminement'}</span>
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Toast Feedback */}
            {feedbackToast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border backdrop-blur-md animate-in slide-in-from-bottom-5 ${
                    feedbackToast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
                    feedbackToast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' :
                    'bg-slate-900 text-white border-slate-800'
                }`}>
                    {feedbackToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{feedbackToast.message}</span>
                    <button onClick={() => setFeedbackToast(null)} className="ml-2 hover:opacity-80">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Top Header Card */}
            <div className="bg-base-100 border border-base-300 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-xs">
                                <Truck className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight flex items-center gap-2">
                                    Suivi des Colis en Temps Réel
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        API Live
                                    </span>
                                </h1>
                                <p className="text-xs text-text-secondary">
                                    {storeName ? `Boutique : ${storeName} • ` : ''}
                                    Suivi en direct et synchronisation des étapes de livraison auprès des sociétés de livraison (Ameex, Ozon, Kargo, Digylog)
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                        <button
                            onClick={() => openManualModal()}
                            className="px-4 py-2.5 rounded-xl bg-base-200 hover:bg-base-300 text-text-primary text-xs font-bold flex items-center gap-2 transition-all border border-base-300 cursor-pointer shadow-xs"
                            title="Ajouter ou modifier manuellement le numéro de suivi d'une commande"
                        >
                            <Plus className="w-4 h-4 text-accent" />
                            <span>Ajouter N° de suivi</span>
                        </button>

                        <button
                            onClick={handleSyncAllOrders}
                            disabled={isSyncingAll || shippedOrders.length === 0}
                            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                            title="Synchroniser le statut de toutes les commandes expédiées avec l'API transporteur"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                            <span>
                                {isSyncingAll 
                                    ? (syncProgress ? `Sync ${syncProgress.current}/${syncProgress.total}...` : 'Synchronisation...') 
                                    : 'Actualiser Tous les Statuts'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Omni Search Bar (Supports: Phone, Customer Name, Tracking Code, Order ID) */}
                <div className="pt-2 border-t border-base-200">
                    <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleDirectSearch()}
                                placeholder="Rechercher par numéro de téléphone (06...), nom du client, n° de suivi ou commande..."
                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-base-300 bg-base-200/60 focus:bg-base-100 text-xs font-medium text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent transition-all shadow-inner"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleDirectSearch}
                            disabled={isDirectSearching || !searchQuery.trim()}
                            className="px-5 py-3 rounded-xl bg-base-200 hover:bg-base-300 text-text-primary border border-base-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                        >
                            <Sparkles className={`w-3.5 h-3.5 text-accent ${isDirectSearching ? 'animate-spin' : ''}`} />
                            <span>Rechercher via API</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 px-1 text-[11px] text-text-secondary">
                        <div className="flex items-center gap-2">
                            <span>💡 Recherche : retrouvez une commande par <strong>téléphone (06/07)</strong>, nom ou n° de commande. Pour <strong>Ozon Express</strong>, l&apos;API de suivi en direct requiert obligatoirement le <strong>numéro de suivi</strong> (ex: OZE...).</span>
                        </div>
                        <div>
                            <span>{filteredOrders.length} colis affiché(s) sur {shippedOrders.length} expédié(s)</span>
                        </div>
                    </div>
                </div>

                {/* Courier Configuration & Default Provider Status Banner */}
                {!isLoadingConfigs && (
                    <div className="pt-3 border-t border-base-200">
                        {hasAnyConfiguredCourier ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <Truck className="w-4 h-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-emerald-900 dark:text-emerald-200">
                                                Société de livraison configurée par défaut :
                                            </span>
                                            <span className="font-black text-text-primary px-2 py-0.5 rounded-md bg-base-100 border border-emerald-500/30">
                                                {activePrimary?.name || 'Ameex Express'}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold">
                                                Active & Connectée
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90">
                                            Par défaut, les colis expédiés sont transmis et leurs statuts de livraison sont synchronisés en direct auprès de cette société.
                                        </p>
                                    </div>
                                </div>

                                {configuredCouriers.length > 1 && (
                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <span className="text-[11px] font-semibold text-text-secondary">Changer le défaut :</span>
                                        <select
                                            value={activePrimary?.provider || ''}
                                            onChange={e => handleSetPrimaryCourier(e.target.value)}
                                            disabled={isSwitchingPrimary}
                                            className="px-2.5 py-1.5 rounded-lg border border-base-300 bg-base-100 text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                                        >
                                            {configuredCouriers.map((c, idx) => (
                                                <option key={`courier-opt-${c.provider}-${c.id || idx}`} value={c.provider}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-amber-900 dark:text-amber-100">
                                            Mode simulation désactivé : Aucune société de livraison configurée
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                                            Transmission & Statuts Bloqués
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                                        Si la société de livraison n'est pas configurée avec des identifiants réels valides, la transmission des commandes et la récupération des statuts de livraison sont strictement bloquées. Veuillez renseigner vos identifiants API dans Paramètres &gt; Transporteurs.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs space-y-1">
                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span>Total Expédiés</span>
                        <Truck className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-text-primary tracking-tight">
                        {metrics.total}
                    </div>
                    <div className="text-[10px] text-text-secondary">
                        Toutes commandes
                    </div>
                </div>

                <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs space-y-1">
                    <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Non Transmis</span>
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                        {metrics.notTransmitted}
                    </div>
                    <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium">
                        Sans N° de suivi
                    </div>
                </div>

                <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs space-y-1">
                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span>En Transit / Hub</span>
                        <Clock className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                        {metrics.inTransit}
                    </div>
                    <div className="text-[10px] text-text-secondary">
                        Acheminement actif
                    </div>
                </div>

                <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs space-y-1">
                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span>En Distribution</span>
                        <Truck className="w-4 h-4 text-blue-600 animate-pulse" />
                    </div>
                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                        {metrics.inDistribution}
                    </div>
                    <div className="text-[10px] text-text-secondary">
                        Avec le livreur
                    </div>
                </div>

                <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs space-y-1">
                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span>Livrés & Encaissés</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                        {metrics.delivered}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                        {metrics.deliveredAmount.toLocaleString('fr-FR')} MAD
                    </div>
                </div>

                <div className="bg-base-100 border border-base-300 rounded-2xl p-4 shadow-xs space-y-1">
                    <div className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span>Incidents / Retours</span>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                        {metrics.issues}
                    </div>
                    <div className="text-[10px] text-rose-500 font-medium truncate">
                        Refus, reportés...
                    </div>
                </div>
            </div>

            {/* Quick Filter Tabs & Carrier Selector */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-base-100 border border-base-300 p-2.5 rounded-2xl shadow-xs">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                    <button
                        onClick={() => setSelectedStatusTab('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedStatusTab === 'ALL'
                                ? 'bg-accent text-white shadow-xs'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-200'
                        }`}
                    >
                        Tous ({shippedOrders.length})
                    </button>
                    <button
                        onClick={() => setSelectedStatusTab('NOT_TRANSMITTED')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedStatusTab === 'NOT_TRANSMITTED'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-200'
                        }`}
                    >
                        Non Transmis ({metrics.notTransmitted})
                    </button>
                    <button
                        onClick={() => setSelectedStatusTab('IN_TRANSIT')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedStatusTab === 'IN_TRANSIT'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-200'
                        }`}
                    >
                        Transit / Hub ({metrics.inTransit})
                    </button>
                    <button
                        onClick={() => setSelectedStatusTab('DISTRIBUTION')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedStatusTab === 'DISTRIBUTION'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-200'
                        }`}
                    >
                        En Distribution ({metrics.inDistribution})
                    </button>
                    <button
                        onClick={() => setSelectedStatusTab('DELIVERED')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedStatusTab === 'DELIVERED'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-200'
                        }`}
                    >
                        Livrés ({metrics.delivered})
                    </button>
                    <button
                        onClick={() => setSelectedStatusTab('ISSUES')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedStatusTab === 'ISSUES'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-text-secondary hover:text-text-primary hover:bg-base-200'
                        }`}
                    >
                        Incidents / Retours ({metrics.issues})
                    </button>
                </div>

                {/* Carrier Filter */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-secondary font-medium">Transporteur :</span>
                    <select
                        value={selectedCourier}
                        onChange={e => setSelectedCourier(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-base-300 bg-base-200 text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                    >
                        <option value="ALL">Tous les transporteurs</option>
                        <option value="ameex">Ameex Express</option>
                        <option value="ozon">Ozon Express</option>
                        <option value="kargo">Kargo Express</option>
                        <option value="digylog">DIGYLOG Express</option>
                    </select>
                </div>
            </div>

            {/* Informational banner when orders are marked shipped but not yet sent to carrier */}
            {metrics.notTransmitted > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                            <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="font-bold text-amber-900 dark:text-amber-100">
                                {metrics.notTransmitted} commande(s) en attente de transmission transporteur
                            </div>
                            <p className="text-[11px] text-amber-800 dark:text-amber-300">
                                Ces commandes sont validées dans CallNet mais n'ont pas encore été envoyées à l'API de livraison (aucun N° de suivi attribué). Leurs statuts en temps réel s'afficheront dès leur transmission effective.
                            </p>
                        </div>
                    </div>
                    {onNavigateToExpeditions && (
                        <button
                            onClick={onNavigateToExpeditions}
                            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
                        >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Transmettre les colis</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {/* Shipped Parcels Table */}
            <div className="bg-base-100 border border-base-300 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-base-300 bg-base-200/50 font-bold text-text-secondary uppercase tracking-wider text-[10px]">
                                <th className="py-3 px-4">Colis & N° Suivi</th>
                                <th className="py-3 px-4">Destinataire</th>
                                <th className="py-3 px-4">Commande & COD</th>
                                <th className="py-3 px-4">Société de Livraison</th>
                                <th className="py-3 px-4">Statut Live (API)</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-200">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-text-secondary">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="w-12 h-12 rounded-2xl bg-base-200 flex items-center justify-center text-text-secondary">
                                                <Truck className="w-6 h-6 opacity-40" />
                                            </div>
                                            <p className="font-bold text-sm text-text-primary">
                                                Aucun colis expédié ne correspond à vos critères.
                                            </p>
                                            <p className="text-xs text-text-secondary max-w-sm">
                                                Vérifiez le numéro de téléphone, le nom du client ou réinitialisez vos filtres pour afficher l'ensemble des colis.
                                            </p>
                                            {searchQuery && (
                                                <button
                                                    onClick={() => setSearchQuery('')}
                                                    className="mt-2 px-3 py-1.5 rounded-lg bg-base-200 hover:bg-base-300 text-xs font-bold text-text-primary transition-colors cursor-pointer"
                                                >
                                                    Effacer la recherche
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => {
                                    const isLoadingThis = loadingOrderIds.has(order.id);
                                    const cached = trackingCache[order.id];

                                    return (
                                        <tr key={order.id} className="hover:bg-base-200/40 transition-colors group">
                                            {/* Colis & Suivi */}
                                            <td className="py-3.5 px-4 align-top">
                                                <div className="space-y-1">
                                                    <div className="font-mono font-extrabold text-xs text-text-primary flex items-center gap-1.5">
                                                        <span>{order.trackingNumber || 'En attente n°'}</span>
                                                        {order.trackingNumber && (
                                                            <button
                                                                onClick={() => handleCopy(order.trackingNumber!)}
                                                                className="text-text-secondary hover:text-accent p-0.5 rounded transition-colors cursor-pointer"
                                                                title="Copier le numéro de suivi"
                                                            >
                                                                {copiedCode === order.trackingNumber ? (
                                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                                ) : (
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-text-secondary font-mono">
                                                        ID: {order.id}
                                                    </div>
                                                    {order.shippedAt && (
                                                        <div className="text-[10px] text-text-secondary flex items-center gap-1">
                                                            <Calendar className="w-3 h-3 text-text-secondary/60" />
                                                            <span>Expédié le {new Date(order.shippedAt).toLocaleDateString('fr-FR')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Destinataire */}
                                            <td className="py-3.5 px-4 align-top">
                                                <div className="space-y-1 min-w-[160px]">
                                                    <div className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                                                        <UserIcon className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                                                        <span className="truncate">{order.customerName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={`tel:${order.phone}`}
                                                            className="text-[11px] font-mono font-medium text-text-secondary hover:text-accent flex items-center gap-1"
                                                        >
                                                            <Phone className="w-3 h-3 text-text-secondary shrink-0" />
                                                            <span>{order.phone}</span>
                                                        </a>
                                                        <a
                                                            href={`https://wa.me/212${order.phone.replace(/\D/g, '').replace(/^0/, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-0.5"
                                                            title="Écrire sur WhatsApp"
                                                        >
                                                            WA
                                                        </a>
                                                    </div>
                                                    <div className="text-[11px] text-text-secondary flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-text-secondary shrink-0" />
                                                        <span className="font-medium text-text-primary truncate">{order.city || 'Maroc'}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Commande & COD */}
                                            <td className="py-3.5 px-4 align-top">
                                                <div className="space-y-1">
                                                    <div className="font-bold text-xs text-text-primary truncate max-w-[180px]">
                                                        {order.product}
                                                    </div>
                                                    <div className="text-[11px] text-text-secondary">
                                                        Qté : <strong>{order.quantity}</strong> {order.variant ? `(${order.variant})` : ''}
                                                    </div>
                                                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                        {order.price} MAD (COD)
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Transporteur */}
                                            <td className="py-3.5 px-4 align-top">
                                                {renderCourierBadge(order.courierName, order.trackingNumber, order)}
                                            </td>

                                            {/* Statut Live */}
                                            <td className="py-3.5 px-4 align-top">
                                                <div className="space-y-1.5">
                                                    <div>{renderStatusBadge(order)}</div>
                                                    {cached?.lastSync && (
                                                        <div className="text-[10px] text-text-secondary flex items-center gap-1">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            <span>Sync {new Date(cached.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 align-top text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => openManualModal(order)}
                                                        className="p-2 rounded-xl bg-base-200 hover:bg-base-300 text-text-secondary hover:text-accent transition-colors cursor-pointer"
                                                        title="Ajouter ou modifier manuellement le numéro de suivi"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>

                                                    <button
                                                        onClick={() => trackOrderLive(order, false)}
                                                        disabled={isLoadingThis}
                                                        className="p-2 rounded-xl bg-base-200 hover:bg-base-300 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                                        title="Actualiser le statut via l'API transporteur"
                                                    >
                                                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingThis ? 'animate-spin text-accent' : ''}`} />
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            trackOrderLive(order, true);
                                                        }}
                                                        className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent hover:text-white text-accent font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                                        title="Voir les étapes détaillées du suivi"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Suivre</span>
                                                    </button>

                                                    {onSelectOrder && (
                                                        <button
                                                            onClick={() => onSelectOrder(order)}
                                                            className="p-2 rounded-xl bg-base-200 hover:bg-base-300 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                                            title="Ouvrir la fiche de commande complète"
                                                        >
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
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

            {/* Manual Tracking Assignment Modal */}
            {manualModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-base-100 border border-base-300 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-base-200 pb-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold">
                                        <Barcode className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-text-primary">
                                            Assigner un numéro de suivi
                                        </h3>
                                        <p className="text-[11px] text-text-secondary">
                                            Lier manuellement un colis et son transporteur à la commande
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setManualModalOpen(false)}
                                className="p-1.5 rounded-xl hover:bg-base-200 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Order Selector / Info Card */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-text-primary">
                                Commande ciblée
                            </label>

                            {manualOrderTarget ? (
                                <div className="p-3.5 rounded-2xl bg-base-200/70 border border-base-300 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs font-bold text-accent">
                                            #{manualOrderTarget.id}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setManualOrderTarget(null)}
                                            className="text-[11px] text-text-secondary hover:text-accent font-semibold underline cursor-pointer"
                                        >
                                            Changer de commande
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-text-secondary text-[11px]">Client : </span>
                                            <strong className="text-text-primary">{manualOrderTarget.customerName}</strong>
                                        </div>
                                        <div>
                                            <span className="text-text-secondary text-[11px]">Téléphone : </span>
                                            <strong className="text-text-primary">{manualOrderTarget.phone}</strong>
                                        </div>
                                        <div>
                                            <span className="text-text-secondary text-[11px]">Ville : </span>
                                            <strong className="text-text-primary">{manualOrderTarget.city || 'Non spécifiée'}</strong>
                                        </div>
                                        <div>
                                            <span className="text-text-secondary text-[11px]">Montant COD : </span>
                                            <strong className="text-emerald-600 dark:text-emerald-400">{manualOrderTarget.price} MAD</strong>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-text-secondary truncate border-t border-base-300/50 pt-1.5">
                                        Produit : <strong className="text-text-primary">{manualOrderTarget.product}</strong> ({manualOrderTarget.quantity}x)
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={manualOrderSearch}
                                        onChange={e => setManualOrderSearch(e.target.value)}
                                        placeholder="Rechercher une commande par ID, client ou téléphone..."
                                        className="w-full px-3 py-2 rounded-xl border border-base-300 bg-base-100 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                                    />
                                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-base-300 p-1 bg-base-200/40">
                                        {orders
                                            .filter(o => {
                                                if (!manualOrderSearch.trim()) return true;
                                                const s = manualOrderSearch.toLowerCase();
                                                return String(o.id).toLowerCase().includes(s) ||
                                                       o.customerName.toLowerCase().includes(s) ||
                                                       o.phone.includes(s) ||
                                                       (o.city && o.city.toLowerCase().includes(s));
                                            })
                                            .slice(0, 15)
                                            .map(o => (
                                                <div
                                                    key={o.id}
                                                    onClick={() => {
                                                        setManualOrderTarget(o);
                                                        setManualSelectedOrderId(o.id);
                                                        if (o.trackingNumber) setManualTrackingNumber(o.trackingNumber);
                                                        if (o.courierName) setManualCourierName(o.courierName);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-accent/10 cursor-pointer flex items-center justify-between text-xs transition-colors"
                                                >
                                                    <div>
                                                        <span className="font-mono font-bold text-accent mr-2">#{o.id}</span>
                                                        <span className="font-medium text-text-primary">{o.customerName}</span>
                                                        <span className="text-text-secondary text-[11px] ml-2">({o.phone})</span>
                                                    </div>
                                                    <span className="text-[11px] text-text-secondary font-mono">{o.price} MAD</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tracking Number Input */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-text-primary">
                                    Numéro de suivi (Tracking Number) <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) {
                                                const clean = text.trim();
                                                setManualTrackingNumber(clean);
                                                const up = clean.toUpperCase();
                                                if (up.startsWith('OZE')) setManualCourierName('Ozon Express');
                                                else if (up.startsWith('AMX')) setManualCourierName('Ameex Express');
                                                else if (up.startsWith('KG')) setManualCourierName('Kargo Express');
                                                else if (up.startsWith('DL') || up.startsWith('DGL')) setManualCourierName('DIGYLOG');
                                            }
                                        } catch {
                                            // Clipboard read permission might not be available
                                        }
                                    }}
                                    className="text-[11px] text-accent hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                    <Copy className="w-3 h-3" />
                                    <span>Coller depuis presse-papier</span>
                                </button>
                            </div>
                            <div className="relative">
                                <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="text"
                                    value={manualTrackingNumber}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setManualTrackingNumber(val);
                                        const up = val.trim().toUpperCase();
                                        if (up.startsWith('OZE')) setManualCourierName('Ozon Express');
                                        else if (up.startsWith('AMX')) setManualCourierName('Ameex Express');
                                        else if (up.startsWith('KG')) setManualCourierName('Kargo Express');
                                        else if (up.startsWith('DL') || up.startsWith('DGL')) setManualCourierName('DIGYLOG');
                                    }}
                                    placeholder="Ex: OZE8392182, AMX492019, KG918239, DL10928..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-base-300 bg-base-100 text-xs font-mono font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                            </div>
                        </div>

                        {/* Courier Company Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-primary">
                                Société de livraison (Transporteur)
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { id: 'Ozon Express', label: 'Ozon Express', color: 'bg-purple-600' },
                                    { id: 'Ameex Express', label: 'Ameex Express', color: 'bg-amber-600' },
                                    { id: 'Kargo Express', label: 'Kargo Express', color: 'bg-amber-500' },
                                    { id: 'DIGYLOG', label: 'DIGYLOG Express', color: 'bg-blue-600' },
                                    { id: 'Cathedis', label: 'Cathedis', color: 'bg-emerald-600' },
                                    { id: 'Autre', label: 'Autre société', color: 'bg-slate-600' }
                                ].map(c => (
                                    <button
                                        type="button"
                                        key={c.id}
                                        onClick={() => setManualCourierName(c.id === 'Autre' ? '' : c.id)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 cursor-pointer ${
                                            (c.id === 'Autre' && !['Ozon Express', 'Ameex Express', 'Kargo Express', 'DIGYLOG', 'Cathedis'].includes(manualCourierName)) ||
                                            manualCourierName === c.id
                                                ? 'border-accent bg-accent/10 text-accent'
                                                : 'border-base-300 bg-base-100 hover:bg-base-200 text-text-primary'
                                        }`}
                                    >
                                        <span className={`w-2.5 h-2.5 rounded-full ${c.color} shrink-0`} />
                                        <span className="truncate">{c.label}</span>
                                    </button>
                                ))}
                            </div>
                            {!['Ozon Express', 'Ameex Express', 'Kargo Express', 'DIGYLOG', 'Cathedis'].includes(manualCourierName) && (
                                <input
                                    type="text"
                                    value={manualCourierName}
                                    onChange={e => setManualCourierName(e.target.value)}
                                    placeholder="Nom du transporteur personnalisé..."
                                    className="w-full mt-2 px-3 py-2 rounded-xl border border-base-300 bg-base-100 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                            )}
                        </div>

                        {/* Status Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-primary">
                                Statut initial du colis
                            </label>
                            <select
                                value={manualCourierStatus}
                                onChange={e => setManualCourierStatus(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-base-300 bg-base-100 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                            >
                                <option value="Nouveau Colis Créé">Nouveau Colis Créé (Prêt au ramassage)</option>
                                <option value="En attente 1er scan">En attente 1er scan (Au Hub)</option>
                                <option value="En cours d'acheminement">En cours d'acheminement</option>
                                <option value="En cours de distribution">En cours de distribution (Avec le livreur)</option>
                                <option value="Livré & Encaissé">Livré & Encaissé (Succès)</option>
                                <option value="Incident / Refus">Incident / Refus / Retour</option>
                            </select>
                        </div>

                        {/* Optional Shipped Date & Note */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-primary">
                                    Date d'expédition
                                </label>
                                <input
                                    type="date"
                                    value={manualShippedAt}
                                    onChange={e => setManualShippedAt(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-base-300 bg-base-100 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-primary">
                                    Note transporteur (Optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={manualCourierNote}
                                    onChange={e => setManualCourierNote(e.target.value)}
                                    placeholder="Ex: Expédié depuis stock..."
                                    className="w-full px-3 py-2 rounded-xl border border-base-300 bg-base-100 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-base-200">
                            <button
                                type="button"
                                onClick={() => setManualModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-text-primary transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveManualTracking}
                                disabled={isSavingManual || !manualTrackingNumber.trim() || !manualOrderTarget}
                                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                {isSavingManual ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Enregistrement...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Enregistrer le suivi</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline Detail Modal */}
            {activeModalOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-base-100 border border-base-300 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-base-200 pb-4">
                            <div className="space-y-1">
                                <div className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">
                                    Historique d'acheminement en direct (API Réelle)
                                </div>
                                <div className="text-lg font-black text-text-primary flex items-center gap-2">
                                    <span>Colis {activeModalOrder.trackingNumber ? `N° ${activeModalOrder.trackingNumber}` : `(Commande #${activeModalOrder.id})`}</span>
                                    {activeModalOrder.trackingNumber && (
                                        <button
                                            onClick={() => handleCopy(activeModalOrder.trackingNumber!)}
                                            className="text-text-secondary hover:text-accent p-1 cursor-pointer"
                                        >
                                            {copiedCode === activeModalOrder.trackingNumber ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                    {renderCourierBadge(activeModalOrder.courierName, activeModalOrder.trackingNumber)}
                                </div>
                            </div>

                            <button
                                onClick={() => setActiveModalOrder(null)}
                                className="p-2 rounded-xl bg-base-200 hover:bg-base-300 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Recipient & Package Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-base-200/60 p-3.5 rounded-2xl border border-base-300 text-xs">
                            <div>
                                <div className="text-[10px] text-text-secondary uppercase font-semibold">Client</div>
                                <div className="font-bold text-text-primary truncate mt-0.5">{activeModalOrder.customerName}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-secondary uppercase font-semibold">Téléphone</div>
                                <div className="font-mono font-bold text-text-primary truncate mt-0.5">{activeModalOrder.phone}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-secondary uppercase font-semibold">Ville</div>
                                <div className="font-bold text-text-primary truncate mt-0.5">{activeModalOrder.city || 'Maroc'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-secondary uppercase font-semibold">Montant COD</div>
                                <div className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeModalOrder.price} MAD</div>
                            </div>
                        </div>

                        {/* Current Status Highlight */}
                        <div className="p-4 rounded-2xl bg-base-200/40 border border-base-300 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Statut Actuel</div>
                                <div className="font-extrabold text-sm text-text-primary">
                                    {activeModalOrder.courierStatus || (activeModalOrder.trackingNumber ? 'En cours d\'acheminement' : 'Non transmis au transporteur')}
                                </div>
                            </div>
                            <div>
                                {renderStatusBadge(activeModalOrder)}
                            </div>
                        </div>

                        {/* Chronological Timeline Steps */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-xs uppercase tracking-wider text-text-secondary">
                                    Étapes de Livraison (API Réelle)
                                </h3>
                                {activeModalOrder.trackingNumber && (
                                    <button
                                        onClick={() => trackOrderLive(activeModalOrder, false)}
                                        className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Actualiser le suivi
                                    </button>
                                )}
                            </div>

                            {!activeModalOrder.trackingNumber ? (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                                    <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span>Colis non encore transmis au transporteur</span>
                                    </div>
                                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                                        Cette commande n'a pas encore été envoyée à l'API de votre société de livraison. Pour obtenir un numéro de suivi réel et suivre son acheminement en direct, transmettez-la depuis l'onglet Expéditions.
                                    </p>
                                    {onNavigateToExpeditions && (
                                        <button
                                            onClick={() => {
                                                setActiveModalOrder(null);
                                                onNavigateToExpeditions();
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <Truck className="w-3.5 h-3.5" />
                                            <span>Aller aux Expéditions</span>
                                        </button>
                                    )}
                                </div>
                            ) : (trackingCache[activeModalOrder.id]?.history && trackingCache[activeModalOrder.id].history.length > 0) ? (
                                <div className="space-y-4 relative pl-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-base-300">
                                    {trackingCache[activeModalOrder.id].history.map((step, idx) => (
                                        <div key={idx} className="flex items-start gap-3.5 relative">
                                            <div className={`w-5 h-5 rounded-full -ml-[19px] flex items-center justify-center shrink-0 z-10 ${
                                                step.done 
                                                    ? 'bg-emerald-500 text-white shadow-xs' 
                                                    : 'bg-base-300 text-text-secondary'
                                            }`}>
                                                {step.done ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                            </div>

                                            <div className="flex-1 bg-base-200/50 p-3 rounded-xl border border-base-300 text-xs space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-text-primary">{step.status}</span>
                                                    <span className="text-[10px] text-text-secondary font-mono">{step.date}</span>
                                                </div>
                                                {step.location && (
                                                    <div className="text-[11px] text-text-secondary flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 shrink-0 opacity-70" />
                                                        <span>{step.location}</span>
                                                    </div>
                                                )}
                                                {step.note && (
                                                    <div className="text-[11px] text-text-secondary/90 italic pt-0.5">
                                                        {step.note}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-base-200/50 border border-base-300 text-xs space-y-2 text-center py-6">
                                    <Clock className="w-8 h-8 text-text-secondary mx-auto opacity-40" />
                                    <p className="font-bold text-text-primary">
                                        {activeModalOrder.courierStatus || 'En attente du premier scan au Hub'}
                                    </p>
                                    <p className="text-[11px] text-text-secondary max-w-sm mx-auto">
                                        Le numéro de suivi est <strong>{activeModalOrder.trackingNumber}</strong>. Les étapes détaillées apparaîtront dès que le transporteur scannera le colis.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-base-200">
                            <button
                                onClick={() => setActiveModalOrder(null)}
                                className="px-4 py-2 rounded-xl bg-base-200 hover:bg-base-300 text-xs font-bold text-text-primary transition-colors cursor-pointer"
                            >
                                Fermer
                            </button>

                            {onSelectOrder && (
                                <button
                                    onClick={() => {
                                        const ord = activeModalOrder;
                                        setActiveModalOrder(null);
                                        onSelectOrder(ord);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                                >
                                    <span>Voir Fiche Complète</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ParcelTrackingView;
