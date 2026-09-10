import React, { useState, useMemo, useEffect } from 'react';
import { 
    Send, 
    Truck, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    Search, 
    RefreshCw, 
    Copy, 
    Check, 
    ExternalLink, 
    Package, 
    Building2, 
    ShieldCheck, 
    ChevronRight, 
    MapPin, 
    Phone, 
    FileText, 
    CheckSquare, 
    Square, 
    SlidersHorizontal, 
    Printer, 
    Settings2, 
    Sparkles, 
    AlertTriangle,
    X,
    ArrowRight,
    HelpCircle,
    Info,
    Calendar,
    DollarSign,
    Filter
} from 'lucide-react';
import { Order, OrderStatus, Role, CourierApiConfig, CourierProvider } from '../types';
import { COURIER_LABELS, OZON_EXPRESS_LOGO, DIGYLOG_LOGO } from '../lib/courierCities';
import { 
    DELIVERY_COMPANIES, 
    DeliveryCompanyDef 
} from './DeliveryCompaniesView';
import { 
    OzonExpressLogo, 
    KargoExpressLogo, 
    DigylogLogo, 
    AmeexLogo, 
    CathedisLogo, 
    SenditLogo, 
    IrsaliyatLogo, 
    OnesstaLogo, 
    ForcelogLogo, 
    ChronoDialiLogo 
} from './CourierCompanyLogos';
import { PackingSlipModal } from './PackingSlipModal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient } from '../lib/apiClient';
import { getWhatsAppUrl, formatCallOrSmsPhone } from '../utils';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { PhoneIcon } from './icons/PhoneIcon';

interface OrderEntryViewProps {
    orders: Order[];
    onUpdateOrder?: (orderId: string, updates: Partial<Order>) => void | Promise<void>;
    onSelectOrder?: (order: Order) => void;
    onNavigateToExpeditions?: () => void;
    onNavigateToTracking?: () => void;
    storeName?: string;
    onSync?: () => void;
}

export const OrderEntryView: React.FC<OrderEntryViewProps> = ({
    orders = [],
    onUpdateOrder,
    onSelectOrder,
    onNavigateToExpeditions,
    onNavigateToTracking,
    storeName,
    onSync
}) => {
    const { currentUser } = useAuth();
    const { t } = useLanguage();

    // Courier configs state
    const [courierConfigs, setCourierConfigs] = useState<CourierApiConfig[]>([]);
    const [primaryCourier, setPrimaryCourier] = useState<CourierProvider>('ozon_express');
    const [isLoadingConfigs, setIsLoadingConfigs] = useState<boolean>(true);

    // Selected orders for bulk operations
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

    // Per-order assigned courier: maps orderId -> courierProvider
    const [orderCourierSelections, setOrderCourierSelections] = useState<Record<string, CourierProvider>>({});

    // Bulk courier choice to apply to all selected
    const [bulkCourierChoice, setBulkCourierChoice] = useState<CourierProvider>('ozon_express');

    // Filter & Search states
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'ready' | 'shipped' | 'all'>('ready');
    const [courierFilter, setCourierFilter] = useState<string>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');

    // Execution & Loading states
    const [dispatchingOrderIds, setDispatchingOrderIds] = useState<Set<string>>(new Set());
    const [isBatchDispatching, setIsBatchDispatching] = useState<boolean>(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; successCount: number; failCount: number } | null>(null);
    const [batchResults, setBatchResults] = useState<Array<{ orderId: string; customerName: string; courierName: string; trackingNumber: string; success: boolean; error?: string }> | null>(null);

    // Manual shipping modal
    const [manualShipOrder, setManualShipOrder] = useState<Order | null>(null);
    const [manualTrackingInput, setManualTrackingInput] = useState<string>('');
    const [manualCourierInput, setManualCourierInput] = useState<string>('');

    // Packing slip modal
    const [showPackingSlipModal, setShowPackingSlipModal] = useState<boolean>(false);

    // Copy tracking state
    const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

    // Feedback notification
    const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

    // Load courier configurations
    const loadCourierConfigs = async () => {
        setIsLoadingConfigs(true);
        try {
            const configs = await apiClient.apiFetch<CourierApiConfig[]>('/couriers/configs');
            if (Array.isArray(configs)) {
                setCourierConfigs(configs);
                const primary = configs.find(c => c.isPrimary && c.isEnabled);
                if (primary) {
                    setPrimaryCourier(primary.provider);
                    setBulkCourierChoice(primary.provider);
                } else if (configs.length > 0) {
                    const firstActive = configs.find(c => c.isEnabled && Boolean(c.apiKey));
                    if (firstActive) {
                        setPrimaryCourier(firstActive.provider);
                        setBulkCourierChoice(firstActive.provider);
                    }
                }
            }
        } catch (e) {
            console.error('Erreur chargement configs transporteurs:', e);
        } finally {
            setIsLoadingConfigs(false);
        }
    };

    useEffect(() => {
        loadCourierConfigs();
    }, []);

    // Check which couriers have valid credentials configured
    const configuredCouriersMap = useMemo(() => {
        const map: Record<string, CourierApiConfig> = {};
        courierConfigs.forEach(cfg => {
            const hasKey = Boolean(cfg.apiKey && cfg.apiKey.trim() !== '' && !cfg.apiKey.toLowerCase().includes('demo') && !cfg.apiKey.toLowerCase().includes('dummy'));
            if (hasKey && cfg.isEnabled) {
                map[cfg.provider] = cfg;
            }
        });
        return map;
    }, [courierConfigs]);

    const configuredCount = Object.keys(configuredCouriersMap).length;

    // Helper to detect courier provider from order
    const detectOrderCourier = (order: Order): CourierProvider => {
        // If explicitly set in local selections, use that
        if (orderCourierSelections[order.id]) {
            return orderCourierSelections[order.id];
        }
        // If already set on order
        const courierStr = (order.courierName || '').toLowerCase();
        if (courierStr.includes('ozon')) return 'ozon_express';
        if (courierStr.includes('kargo')) return 'kargo_express';
        if (courierStr.includes('digylog') || courierStr.includes('digi')) return 'digylog';
        if (courierStr.includes('ameex')) return 'ameex';
        if (courierStr.includes('cathedis')) return 'cathedis';
        if (courierStr.includes('irsaliyat')) return 'irsaliyat';
        if (courierStr.includes('onessta')) return 'onessta';
        if (courierStr.includes('forcelog')) return 'forcelog';
        if (courierStr.includes('chrono')) return 'chrono_diali';
        if (courierStr.includes('sendit') || courierStr.includes('ecotrack')) return 'sendit';

        // Fallback to primary courier or first configured courier
        if (configuredCouriersMap[primaryCourier]) return primaryCourier;
        const firstConfigured = Object.keys(configuredCouriersMap)[0] as CourierProvider;
        return firstConfigured || primaryCourier || 'ozon_express';
    };

    // Filter confirmed orders
    const confirmedOrders = useMemo(() => {
        return orders.filter(o => {
            if (o.archived) return false;
            const statusStr = String(o.status || '').toLowerCase();
            const isConfirmed = statusStr.includes('confir') || statusStr === OrderStatus.Confirme;
            const isShipped = Boolean(o.trackingNumber) || statusStr.includes('expid') || statusStr.includes('exped');
            return isConfirmed || isShipped;
        });
    }, [orders]);

    // Statistics
    const stats = useMemo(() => {
        const readyOrders = confirmedOrders.filter(o => !o.trackingNumber && !String(o.status).toLowerCase().includes('expid') && !String(o.status).toLowerCase().includes('exped'));
        const shippedOrders = confirmedOrders.filter(o => Boolean(o.trackingNumber));
        const totalAmountReady = readyOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

        return {
            readyCount: readyOrders.length,
            shippedCount: shippedOrders.length,
            totalCount: confirmedOrders.length,
            totalAmountReady
        };
    }, [confirmedOrders]);

    // Unique cities in confirmed orders
    const uniqueCities = useMemo(() => {
        const set = new Set<string>();
        confirmedOrders.forEach(o => {
            if (o.city && o.city.trim()) set.add(o.city.trim());
        });
        return Array.from(set).sort();
    }, [confirmedOrders]);

    // Filtered orders to display
    const displayedOrders = useMemo(() => {
        return confirmedOrders.filter(order => {
            const hasTracking = Boolean(order.trackingNumber);
            const isShipped = hasTracking || String(order.status).toLowerCase().includes('expid') || String(order.status).toLowerCase().includes('exped');

            // Tab filter
            if (activeTab === 'ready' && isShipped) return false;
            if (activeTab === 'shipped' && !hasTracking) return false;

            // Courier filter
            if (courierFilter !== 'all') {
                const assigned = detectOrderCourier(order);
                if (assigned !== courierFilter) return false;
            }

            // City filter
            if (cityFilter !== 'all') {
                if ((order.city || '').toLowerCase() !== cityFilter.toLowerCase()) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchId = String(order.id || '').toLowerCase().includes(q);
                const matchName = String(order.customerName || '').toLowerCase().includes(q);
                const matchPhone = String(order.phone || '').toLowerCase().includes(q);
                const matchCity = String(order.city || '').toLowerCase().includes(q);
                const matchProduct = String(order.product || '').toLowerCase().includes(q);
                const matchTracking = String(order.trackingNumber || '').toLowerCase().includes(q);
                if (!matchId && !matchName && !matchPhone && !matchCity && !matchProduct && !matchTracking) {
                    return false;
                }
            }

            return true;
        });
    }, [confirmedOrders, activeTab, courierFilter, cityFilter, searchQuery, orderCourierSelections]);

    // Handle selecting all visible orders
    const handleSelectAll = () => {
        if (selectedOrderIds.size === displayedOrders.length && displayedOrders.length > 0) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(displayedOrders.map(o => o.id)));
        }
    };

    // Toggle single order selection
    const handleToggleOrder = (orderId: string) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    // Change assigned courier for a specific order
    const handleOrderCourierChange = async (orderId: string, newCourier: CourierProvider) => {
        setOrderCourierSelections(prev => ({
            ...prev,
            [orderId]: newCourier
        }));

        const courierLabel = COURIER_LABELS[newCourier] || newCourier;
        if (onUpdateOrder) {
            await onUpdateOrder(orderId, {
                courierName: courierLabel
            });
        }
    };

    // Bulk apply courier to selected orders
    const handleApplyBulkCourier = async () => {
        if (selectedOrderIds.size === 0) return;

        const courierLabel = COURIER_LABELS[bulkCourierChoice] || bulkCourierChoice;
        const newMap = { ...orderCourierSelections };
        selectedOrderIds.forEach(id => {
            newMap[id] = bulkCourierChoice;
        });
        setOrderCourierSelections(newMap);

        if (onUpdateOrder) {
            for (const id of Array.from(selectedOrderIds)) {
                await onUpdateOrder(id, { courierName: courierLabel });
            }
        }

        setFeedback({
            type: 'success',
            message: `✓ Société de livraison [${courierLabel}] attribuée à ${selectedOrderIds.size} commande(s) avec succès !`
        });
        setTimeout(() => setFeedback(null), 4000);
    };

    // Copy tracking helper
    const handleCopyTracking = (tracking: string) => {
        navigator.clipboard.writeText(tracking);
        setCopiedTracking(tracking);
        setTimeout(() => setCopiedTracking(null), 2500);
    };

    // Execute single dispatch
    const handleShipOrder = async (order: Order) => {
        const chosenCourier = detectOrderCourier(order);
        const courierConfig = configuredCouriersMap[chosenCourier];
        const courierLabel = COURIER_LABELS[chosenCourier] || chosenCourier;

        // If this courier API is not configured, offer manual entry or redirect to configuration
        if (!courierConfig && (chosenCourier === 'ozon_express' || chosenCourier === 'kargo_express' || chosenCourier === 'digylog' || chosenCourier === 'ameex')) {
            setManualCourierInput(courierLabel);
            setManualTrackingInput('');
            setManualShipOrder(order);
            return;
        }

        setDispatchingOrderIds(prev => new Set(prev).add(order.id));
        setFeedback(null);

        try {
            let res: any = null;

            if (chosenCourier === 'ozon_express') {
                res = await apiClient.apiPost('/couriers/ozon/add-parcel', {
                    orderId: order.id,
                    order,
                    apiKey: courierConfig?.apiKey,
                    clientId: courierConfig?.clientId,
                    apiBaseUrl: courierConfig?.apiBaseUrl
                });
            } else if (chosenCourier === 'kargo_express') {
                res = await apiClient.apiPost('/couriers/kargo/add-parcel', {
                    orderId: order.id,
                    order,
                    apiKey: courierConfig?.apiKey,
                    clientId: courierConfig?.clientId,
                    apiBaseUrl: courierConfig?.apiBaseUrl
                });
            } else if (chosenCourier === 'digylog') {
                res = await apiClient.apiPost('/couriers/digylog/add-parcel', {
                    orderId: order.id,
                    order,
                    apiKey: courierConfig?.apiKey,
                    networkId: courierConfig?.clientId,
                    store: courierConfig?.apiSecret || 'store1',
                    apiBaseUrl: courierConfig?.apiBaseUrl
                });
            } else if (chosenCourier === 'ameex') {
                res = await apiClient.apiPost('/couriers/ameex/add-parcel', {
                    orderId: order.id,
                    order,
                    apiKey: courierConfig?.apiKey,
                    clientId: courierConfig?.clientId,
                    apiBaseUrl: courierConfig?.apiBaseUrl
                });
            } else {
                // Non-API courier: open manual modal
                setManualCourierInput(courierLabel);
                setManualTrackingInput('');
                setManualShipOrder(order);
                return;
            }

            if (res && (res.success || res.trackingNumber)) {
                const generatedTracking = res.trackingNumber || res.parcel?.tracking || res.tracking || `TRK-${Date.now()}`;
                
                if (onUpdateOrder) {
                    await onUpdateOrder(order.id, {
                        status: OrderStatus.Expedie,
                        courierName: courierLabel,
                        trackingNumber: generatedTracking,
                        courierStatus: "En cours d'acheminement",
                        shippedAt: new Date().toISOString()
                    });
                }

                setFeedback({
                    type: 'success',
                    message: `✓ Colis créé avec succès auprès de ${courierLabel} ! N° de suivi : ${generatedTracking}`
                });

                if (onSync) onSync();
            } else {
                setFeedback({
                    type: 'error',
                    message: `Échec d'expédition (${courierLabel}) : ${res?.message || 'Erreur inconnue retournée par l\'API transporteur'}`
                });
            }
        } catch (err: any) {
            setFeedback({
                type: 'error',
                message: `Erreur lors de l'expédition : ${err.message || 'Impossible de contacter le transporteur'}`
            });
        } finally {
            setDispatchingOrderIds(prev => {
                const next = new Set(prev);
                next.delete(order.id);
                return next;
            });
        }
    };

    // Execute bulk dispatch for all selected orders
    const handleBatchDispatch = async () => {
        const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
        if (selectedOrders.length === 0) return;

        setIsBatchDispatching(true);
        setBatchProgress({
            current: 0,
            total: selectedOrders.length,
            successCount: 0,
            failCount: 0
        });

        const results: Array<{ orderId: string; customerName: string; courierName: string; trackingNumber: string; success: boolean; error?: string }> = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedOrders.length; i++) {
            const ord = selectedOrders[i];
            const chosenCourier = detectOrderCourier(ord);
            const courierConfig = configuredCouriersMap[chosenCourier];
            const courierLabel = COURIER_LABELS[chosenCourier] || chosenCourier;

            setBatchProgress({
                current: i + 1,
                total: selectedOrders.length,
                successCount,
                failCount
            });

            try {
                let res: any = null;

                if (chosenCourier === 'ozon_express') {
                    res = await apiClient.apiPost('/couriers/ozon/add-parcel', {
                        orderId: ord.id,
                        order: ord,
                        apiKey: courierConfig?.apiKey,
                        clientId: courierConfig?.clientId,
                        apiBaseUrl: courierConfig?.apiBaseUrl
                    });
                } else if (chosenCourier === 'kargo_express') {
                    res = await apiClient.apiPost('/couriers/kargo/add-parcel', {
                        orderId: ord.id,
                        order: ord,
                        apiKey: courierConfig?.apiKey,
                        clientId: courierConfig?.clientId,
                        apiBaseUrl: courierConfig?.apiBaseUrl
                    });
                } else if (chosenCourier === 'digylog') {
                    res = await apiClient.apiPost('/couriers/digylog/add-parcel', {
                        orderId: ord.id,
                        order: ord,
                        apiKey: courierConfig?.apiKey,
                        networkId: courierConfig?.clientId,
                        store: courierConfig?.apiSecret || 'store1',
                        apiBaseUrl: courierConfig?.apiBaseUrl
                    });
                } else if (chosenCourier === 'ameex') {
                    res = await apiClient.apiPost('/couriers/ameex/add-parcel', {
                        orderId: ord.id,
                        order: ord,
                        apiKey: courierConfig?.apiKey,
                        clientId: courierConfig?.clientId,
                        apiBaseUrl: courierConfig?.apiBaseUrl
                    });
                } else {
                    // Manual or fallback tracking
                    res = { success: true, trackingNumber: `LIV-${ord.id}-${Math.floor(1000 + Math.random() * 9000)}` };
                }

                if (res && (res.success || res.trackingNumber)) {
                    const generatedTracking = res.trackingNumber || res.parcel?.tracking || res.tracking;
                    if (onUpdateOrder) {
                        await onUpdateOrder(ord.id, {
                            status: OrderStatus.Expedie,
                            courierName: courierLabel,
                            trackingNumber: generatedTracking,
                            courierStatus: "En cours d'acheminement",
                            shippedAt: new Date().toISOString()
                        });
                    }
                    successCount++;
                    results.push({
                        orderId: ord.id,
                        customerName: ord.customerName,
                        courierName: courierLabel,
                        trackingNumber: generatedTracking,
                        success: true
                    });
                } else {
                    failCount++;
                    results.push({
                        orderId: ord.id,
                        customerName: ord.customerName,
                        courierName: courierLabel,
                        trackingNumber: '',
                        success: false,
                        error: res?.message || 'Erreur API'
                    });
                }
            } catch (err: any) {
                failCount++;
                results.push({
                    orderId: ord.id,
                    customerName: ord.customerName,
                    courierName: courierLabel,
                    trackingNumber: '',
                    success: false,
                    error: err.message || 'Échec de connexion'
                });
            }
        }

        setIsBatchDispatching(false);
        setBatchResults(results);
        setSelectedOrderIds(new Set());
        if (onSync) onSync();
    };

    // Confirm manual shipping
    const handleConfirmManualShip = async () => {
        if (!manualShipOrder) return;
        const tracking = manualTrackingInput.trim() || `MAN-${Date.now()}`;
        const courier = manualCourierInput.trim() || manualShipOrder.courierName || 'Transporteur Partenaire';

        if (onUpdateOrder) {
            await onUpdateOrder(manualShipOrder.id, {
                status: OrderStatus.Expedie,
                courierName: courier,
                trackingNumber: tracking,
                courierStatus: "En cours d'acheminement",
                shippedAt: new Date().toISOString()
            });
        }

        setFeedback({
            type: 'success',
            message: `✓ Commande #${manualShipOrder.id} marquée comme expédiée avec ${courier} (N° ${tracking})`
        });

        setManualShipOrder(null);
        setManualTrackingInput('');
        setManualCourierInput('');
        if (onSync) onSync();
    };

    // Helper to render courier badge with mini icon
    const renderCourierBadge = (provider: CourierProvider) => {
        const isConfigured = Boolean(configuredCouriersMap[provider]);
        const label = COURIER_LABELS[provider] || provider;

        return (
            <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isConfigured ? 'bg-emerald-500 shadow-xs' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span>{label}</span>
            </span>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header / Banner */}
            <div className="bg-base-200 border border-base-300 rounded-[4px] p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#3C50E0]/10 text-[#3C50E0] rounded-[4px]">
                                <Send className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                                    <span>Saisie des Commandes (Expédition)</span>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] font-semibold border border-[#10B981]/20">
                                        Commandes Confirmées
                                    </span>
                                </h1>
                                <p className="text-xs text-text-secondary">
                                    Choisissez la société de livraison configurée pour chaque commande confirmée et expédiez en un clic (Push API automatique & N° de suivi).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Top Right Quick Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {onSync && (
                            <button
                                onClick={onSync}
                                className="px-3 py-2 bg-base-100 hover:bg-base-300 border border-base-300 text-text-primary rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                title="Actualiser les commandes"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Actualiser</span>
                            </button>
                        )}

                        {onNavigateToExpeditions && (
                            <button
                                onClick={onNavigateToExpeditions}
                                className="px-3 py-2 bg-base-100 hover:bg-base-300 border border-base-300 text-text-primary rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                title="Configurer les clés d'API des transporteurs"
                            >
                                <Settings2 className="w-3.5 h-3.5 text-[#3C50E0]" />
                                <span>Gérer les Sociétés ({configuredCount})</span>
                            </button>
                        )}

                        {onNavigateToTracking && (
                            <button
                                onClick={onNavigateToTracking}
                                className="px-3 py-2 bg-[#3C50E0]/10 hover:bg-[#3C50E0]/20 text-[#3C50E0] border border-[#3C50E0]/30 rounded-[4px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                            >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Suivi Colis Live</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-base-300">
                    <div className="bg-base-100 p-3.5 rounded-[4px] border border-base-300">
                        <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                            À Expédier (Prêtes)
                        </div>
                        <div className="text-xl font-bold text-[#3C50E0] mt-1 flex items-baseline gap-1.5">
                            <span>{stats.readyCount}</span>
                            <span className="text-xs font-normal text-text-secondary">colis confirmés</span>
                        </div>
                    </div>

                    <div className="bg-base-100 p-3.5 rounded-[4px] border border-base-300">
                        <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                            Montant CRBT à Encaisser
                        </div>
                        <div className="text-xl font-bold text-[#10B981] mt-1">
                            {stats.totalAmountReady.toLocaleString('fr-FR')} MAD
                        </div>
                    </div>

                    <div className="bg-base-100 p-3.5 rounded-[4px] border border-base-300">
                        <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                            Sociétés Configurées
                        </div>
                        <div className="text-xl font-bold text-text-primary mt-1 flex items-baseline gap-1.5">
                            <span>{configuredCount}</span>
                            <span className="text-xs font-normal text-text-secondary">actives</span>
                        </div>
                    </div>

                    <div className="bg-base-100 p-3.5 rounded-[4px] border border-base-300">
                        <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                            Déjà Expédiées
                        </div>
                        <div className="text-xl font-bold text-[#8B5CF6] mt-1 flex items-baseline gap-1.5">
                            <span>{stats.shippedCount}</span>
                            <span className="text-xs font-normal text-text-secondary">avec tracking</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification / Feedback Banner */}
            {feedback && (
                <div className={`p-4 rounded-[4px] border flex items-center justify-between text-xs font-medium animate-in fade-in ${
                    feedback.type === 'success'
                        ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
                        : feedback.type === 'warning'
                        ? 'bg-[#FFBA45]/10 text-[#FFBA45] border-[#FFBA45]/30'
                        : 'bg-[#FF4560]/10 text-[#FF4560] border-[#FF4560]/30'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{feedback.message}</span>
                    </div>
                    <button
                        onClick={() => setFeedback(null)}
                        className="p-1 hover:opacity-75 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Configured Couriers Alert if None */}
            {configuredCount === 0 && !isLoadingConfigs && (
                <div className="bg-[#FFBA45]/10 border border-[#FFBA45]/30 p-4 rounded-[4px] flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#FFBA45] shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                        <div className="font-bold text-[#FFBA45]">
                            Aucune clé API transporteur n'a encore été configurée
                        </div>
                        <p className="text-text-secondary mt-0.5">
                            Pour expédier automatiquement vos colis via Ozon Express, Kargo Express, DIGYLOG ou Ameex, rendez-vous dans la section Sociétés de Livraison pour enregistrer vos clés d'API. Vous pouvez néanmoins sélectionner le transporteur voulu et renseigner les numéros de suivi manuellement.
                        </p>
                        {onNavigateToExpeditions && (
                            <button
                                onClick={onNavigateToExpeditions}
                                className="mt-2.5 px-3 py-1.5 bg-[#FFBA45] hover:bg-[#e6a337] text-slate-900 rounded-[4px] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                <span>Configurer mes transporteurs maintenant</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Main Action and Filter Bar */}
            <div className="bg-base-200 border border-base-300 rounded-[4px] p-4 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Left: Search & Filter Tabs */}
                    <div className="flex items-center gap-3 flex-wrap flex-1">
                        {/* Search Input */}
                        <div className="relative min-w-[240px] max-w-sm flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                placeholder="Rechercher nom, téléphone, ville, réf..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-[4px] border border-base-300 bg-base-100 text-text-primary focus:outline-none focus:border-[#3C50E0]"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center bg-base-100 p-1 rounded-[4px] border border-base-300 text-xs">
                            <button
                                onClick={() => setActiveTab('ready')}
                                className={`px-3 py-1 rounded-[3px] font-bold transition-all cursor-pointer ${
                                    activeTab === 'ready'
                                        ? 'bg-[#3C50E0] text-white shadow-2xs'
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                À Expédier ({stats.readyCount})
                            </button>
                            <button
                                onClick={() => setActiveTab('shipped')}
                                className={`px-3 py-1 rounded-[3px] font-bold transition-all cursor-pointer ${
                                    activeTab === 'shipped'
                                        ? 'bg-[#3C50E0] text-white shadow-2xs'
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Déjà Expédiées ({stats.shippedCount})
                            </button>
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`px-3 py-1 rounded-[3px] font-bold transition-all cursor-pointer ${
                                    activeTab === 'all'
                                        ? 'bg-[#3C50E0] text-white shadow-2xs'
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                Toutes ({stats.totalCount})
                            </button>
                        </div>

                        {/* Filter by Courier */}
                        <select
                            value={courierFilter}
                            onChange={e => setCourierFilter(e.target.value)}
                            className="text-xs py-1.5 px-2.5 rounded-[4px] border border-base-300 bg-base-100 text-text-primary focus:outline-none focus:border-[#3C50E0]"
                        >
                            <option value="all">Tous les transporteurs</option>
                            {DELIVERY_COMPANIES.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {configuredCouriersMap[c.id] ? '✓ (Configuré)' : ''}
                                </option>
                            ))}
                        </select>

                        {/* Filter by City */}
                        {uniqueCities.length > 0 && (
                            <select
                                value={cityFilter}
                                onChange={e => setCityFilter(e.target.value)}
                                className="text-xs py-1.5 px-2.5 rounded-[4px] border border-base-300 bg-base-100 text-text-primary focus:outline-none focus:border-[#3C50E0]"
                            >
                                <option value="all">Toutes les villes ({uniqueCities.length})</option>
                                {uniqueCities.map(city => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Right: Print / Slip Action */}
                    <div className="flex items-center gap-2">
                        {selectedOrderIds.size > 0 && (
                            <button
                                onClick={() => setShowPackingSlipModal(true)}
                                className="px-3 py-1.5 bg-base-100 hover:bg-base-300 border border-base-300 text-text-primary rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Imprimer les bons de livraison pour la sélection"
                            >
                                <Printer className="w-3.5 h-3.5 text-text-secondary" />
                                <span>Bons ({selectedOrderIds.size})</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Courier Assignment Toolbar (When orders are selected) */}
                {selectedOrderIds.size > 0 && (
                    <div className="bg-[#3C50E0]/10 border border-[#3C50E0]/30 p-3 rounded-[4px] flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in">
                        <div className="flex items-center gap-2 text-xs text-[#3C50E0] font-bold">
                            <CheckSquare className="w-4 h-4 text-[#3C50E0]" />
                            <span>{selectedOrderIds.size} commande(s) sélectionnée(s)</span>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Choose Courier to apply in bulk */}
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-text-secondary font-medium">Attribuer :</span>
                                <select
                                    value={bulkCourierChoice}
                                    onChange={e => setBulkCourierChoice(e.target.value as CourierProvider)}
                                    className="text-xs py-1 px-2.5 rounded-[3px] border border-base-300 bg-base-100 text-text-primary font-bold focus:outline-none focus:border-[#3C50E0]"
                                >
                                    {DELIVERY_COMPANIES.map(c => {
                                        const isConfig = Boolean(configuredCouriersMap[c.id]);
                                        return (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {isConfig ? '🟢 (API active)' : '⚙️ (Non configuré)'}
                                            </option>
                                        );
                                    })}
                                </select>
                                <button
                                    onClick={handleApplyBulkCourier}
                                    className="px-2.5 py-1 bg-base-100 hover:bg-base-300 border border-base-300 text-text-primary rounded-[3px] font-bold text-xs transition-all cursor-pointer"
                                >
                                    Appliquer
                                </button>
                            </div>

                            {/* Batch Dispatch Button */}
                            <button
                                onClick={handleBatchDispatch}
                                disabled={isBatchDispatching}
                                className="px-3.5 py-1.5 bg-[#10B981] hover:bg-[#0ea372] disabled:opacity-50 text-white rounded-[3px] font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                                {isBatchDispatching ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Expédition en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Expédier les {selectedOrderIds.size} commandes</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Orders Table Container */}
            <div className="bg-base-200 border border-base-300 rounded-[4px] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-base-300/40 border-b border-base-300 text-text-secondary font-bold uppercase tracking-wider text-[11px]">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedOrderIds.size === displayedOrders.length && displayedOrders.length > 0}
                                        onChange={handleSelectAll}
                                        className="rounded-[2px] text-[#3C50E0] cursor-pointer"
                                    />
                                </th>
                                <th className="p-3">Réf / Date</th>
                                <th className="p-3">Destinataire</th>
                                <th className="p-3">Ville & Adresse</th>
                                <th className="p-3">Article & Montant</th>
                                <th className="p-3 min-w-[200px]">
                                    <div className="flex items-center gap-1.5 text-[#3C50E0]">
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>Société de Livraison</span>
                                    </div>
                                </th>
                                <th className="p-3">Statut / Suivi</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300">
                            {displayedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-text-secondary">
                                        <Package className="w-8 h-8 mx-auto mb-2 text-text-secondary/40" />
                                        <div className="font-semibold text-sm text-text-primary">
                                            Aucune commande confirmée trouvée
                                        </div>
                                        <p className="text-xs mt-1">
                                            {searchQuery || courierFilter !== 'all' || cityFilter !== 'all'
                                                ? 'Aucune commande ne correspond aux filtres sélectionnés.'
                                                : 'Les commandes ayant le statut "Confirmé" apparaîtront automatiquement ici pour être expédiées.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                displayedOrders.map(order => {
                                    const isSelected = selectedOrderIds.has(order.id);
                                    const isDispatching = dispatchingOrderIds.has(order.id);
                                    const assignedCourier = detectOrderCourier(order);
                                    const isCourierConfigured = Boolean(configuredCouriersMap[assignedCourier]);
                                    const hasTracking = Boolean(order.trackingNumber);
                                    const phoneFormatted = formatCallOrSmsPhone(order.phone);
                                    const waUrl = getWhatsAppUrl(order);

                                    return (
                                        <tr 
                                            key={order.id}
                                            className={`hover:bg-base-100/60 transition-colors ${
                                                isSelected ? 'bg-[#3C50E0]/5' : ''
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleOrder(order.id)}
                                                    className="rounded-[2px] text-[#3C50E0] cursor-pointer"
                                                />
                                            </td>

                                            {/* ID & Date */}
                                            <td className="p-3">
                                                <div className="font-mono font-bold text-text-primary">
                                                    #{order.id}
                                                </div>
                                                <div className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                                                    <Calendar className="w-3 h-3 text-text-secondary/70" />
                                                    <span>{order.date || 'Aujourd\'hui'}</span>
                                                </div>
                                            </td>

                                            {/* Client Info */}
                                            <td className="p-3">
                                                <div className="font-bold text-text-primary">
                                                    {order.customerName || 'Client Inconnu'}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px]">
                                                    <span className="text-text-secondary">{order.phone}</span>
                                                    {phoneFormatted && (
                                                        <a 
                                                            href={`tel:${phoneFormatted}`}
                                                            className="text-text-secondary hover:text-[#3C50E0] p-0.5"
                                                            title="Appeler"
                                                        >
                                                            <PhoneIcon className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                    {waUrl && (
                                                        <a 
                                                            href={waUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-emerald-500 hover:text-emerald-600 p-0.5"
                                                            title="WhatsApp"
                                                        >
                                                            <WhatsAppIcon className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Destination */}
                                            <td className="p-3">
                                                <div className="font-semibold text-text-primary flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-[#FF4560] shrink-0" />
                                                    <span>{order.city || 'Non spécifiée'}</span>
                                                </div>
                                                <div className="text-[11px] text-text-secondary truncate max-w-[170px] mt-0.5" title={order.address}>
                                                    {order.address || order.district || 'Adresse standard'}
                                                </div>
                                            </td>

                                            {/* Product & Price */}
                                            <td className="p-3">
                                                <div className="font-medium text-text-primary truncate max-w-[150px]" title={order.product}>
                                                    {order.product || 'Produit'}
                                                </div>
                                                <div className="text-[11px] text-text-secondary mt-0.5 flex items-center gap-2">
                                                    <span>Qté : {order.quantity || 1}</span>
                                                    <span className="font-bold text-text-primary">{order.price || 0} MAD</span>
                                                </div>
                                            </td>

                                            {/* SOCIÉTÉ DE LIVRAISON DROPDOWN (CORE USER INTENT) */}
                                            <td className="p-3">
                                                <div className="space-y-1">
                                                    <div className="relative">
                                                        <select
                                                            value={assignedCourier}
                                                            onChange={e => handleOrderCourierChange(order.id, e.target.value as CourierProvider)}
                                                            disabled={hasTracking}
                                                            className={`w-full text-xs font-bold py-1.5 px-2 rounded-[3px] border transition-all cursor-pointer ${
                                                                hasTracking
                                                                    ? 'bg-base-300/40 border-base-300 text-text-secondary cursor-not-allowed'
                                                                    : isCourierConfigured
                                                                    ? 'bg-base-100 border-[#10B981]/50 text-text-primary hover:border-[#10B981]'
                                                                    : 'bg-base-100 border-base-300 text-text-secondary hover:border-text-primary'
                                                            }`}
                                                        >
                                                            {DELIVERY_COMPANIES.map(company => {
                                                                const isConfig = Boolean(configuredCouriersMap[company.id]);
                                                                return (
                                                                    <option key={company.id} value={company.id}>
                                                                        {company.name} {isConfig ? '🟢 (Configuré)' : '⚙️ (Non configuré)'}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[10px]">
                                                        {isCourierConfigured ? (
                                                            <span className="text-[#10B981] font-semibold flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                                                API active
                                                            </span>
                                                        ) : (
                                                            <span className="text-text-secondary flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                                Saisie manuelle
                                                            </span>
                                                        )}

                                                        {order.courierName && (
                                                            <span className="text-text-secondary font-mono text-[10px] truncate max-w-[100px]">
                                                                {order.courierName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status / Tracking */}
                                            <td className="p-3">
                                                {hasTracking ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 font-mono font-bold text-xs bg-[#3C50E0]/10 text-[#3C50E0] px-2 py-0.5 rounded-[3px] w-fit">
                                                            <span>{order.trackingNumber}</span>
                                                            <button
                                                                onClick={() => handleCopyTracking(order.trackingNumber!)}
                                                                className="text-text-secondary hover:text-[#3C50E0] cursor-pointer"
                                                                title="Copier le N° de suivi"
                                                            >
                                                                {copiedTracking === order.trackingNumber ? (
                                                                    <Check className="w-3 h-3 text-[#10B981]" />
                                                                ) : (
                                                                    <Copy className="w-3 h-3" />
                                                                )}
                                                            </button>
                                                        </div>
                                                        <div className="text-[10px] text-text-secondary font-medium">
                                                            {order.courierStatus || "En acheminement"}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] font-bold text-[11px] border border-[#10B981]/20">
                                                        Confirmé
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {hasTracking ? (
                                                        <button
                                                            onClick={onNavigateToTracking}
                                                            className="p-1.5 rounded-[3px] text-[#3C50E0] hover:bg-[#3C50E0]/10 transition-colors cursor-pointer"
                                                            title="Consulter le suivi en direct"
                                                        >
                                                            <Truck className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleShipOrder(order)}
                                                            disabled={isDispatching}
                                                            className={`px-3 py-1.5 rounded-[3px] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                                                isCourierConfigured
                                                                    ? 'bg-[#3C50E0] hover:bg-[#3243be] text-white'
                                                                    : 'bg-base-300 hover:bg-base-200 text-text-primary'
                                                            }`}
                                                            title={isCourierConfigured ? `Expédier via ${COURIER_LABELS[assignedCourier]}` : 'Renseigner le suivi'}
                                                        >
                                                            {isDispatching ? (
                                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Send className="w-3.5 h-3.5" />
                                                            )}
                                                            <span>Expédier</span>
                                                        </button>
                                                    )}

                                                    {onSelectOrder && (
                                                        <button
                                                            onClick={() => onSelectOrder(order)}
                                                            className="p-1.5 rounded-[3px] text-text-secondary hover:bg-base-300 hover:text-text-primary transition-colors cursor-pointer"
                                                            title="Détails de la commande"
                                                        >
                                                            <ChevronRight className="w-4 h-4" />
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

            {/* Manual Shipping Modal (For non-API couriers or unconfigured credentials) */}
            {manualShipOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-base-200 border border-base-300 rounded-[4px] max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-base-300 pb-3">
                            <div className="flex items-center gap-2">
                                <Truck className="w-5 h-5 text-[#3C50E0]" />
                                <h3 className="font-bold text-sm text-text-primary">
                                    Saisie d'Expédition - Commande #{manualShipOrder.id}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setManualShipOrder(null)}
                                className="text-text-secondary hover:text-text-primary"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="text-xs text-text-secondary">
                            Client : <strong className="text-text-primary">{manualShipOrder.customerName}</strong> ({manualShipOrder.city}) - Total : <strong className="text-text-primary">{manualShipOrder.price} MAD</strong>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="font-semibold text-text-primary block mb-1">
                                    Société de Livraison :
                                </label>
                                <input
                                    type="text"
                                    value={manualCourierInput}
                                    onChange={e => setManualCourierInput(e.target.value)}
                                    placeholder="Ex : Ozon Express, Ameex, Kargo, ou Livreur interne"
                                    className="w-full px-3 py-2 rounded-[3px] border border-base-300 bg-base-100 text-text-primary focus:outline-none focus:border-[#3C50E0]"
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-text-primary block mb-1">
                                    Numéro de Suivi / Bordereau (Facultatif) :
                                </label>
                                <input
                                    type="text"
                                    value={manualTrackingInput}
                                    onChange={e => setManualTrackingInput(e.target.value)}
                                    placeholder="Ex : OZON-839483, AMEEX-38493..."
                                    className="w-full px-3 py-2 rounded-[3px] border border-base-300 bg-base-100 text-text-primary font-mono focus:outline-none focus:border-[#3C50E0]"
                                />
                                <p className="text-[11px] text-text-secondary mt-1">
                                    Si laissé vide, un numéro de suivi interne sera généré automatiquement.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-300">
                            <button
                                onClick={() => setManualShipOrder(null)}
                                className="px-3 py-1.5 bg-base-100 hover:bg-base-300 border border-base-300 text-text-secondary rounded-[3px] font-semibold text-xs transition-all cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleConfirmManualShip}
                                className="px-4 py-1.5 bg-[#3C50E0] hover:bg-[#3243be] text-white rounded-[3px] font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirmer l'Expédition</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Results Modal */}
            {batchResults && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-base-200 border border-base-300 rounded-[4px] max-w-xl w-full max-h-[80vh] flex flex-col p-6 shadow-2xl space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-base-300 pb-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                                <h3 className="font-bold text-sm text-text-primary">
                                    Résultat de l'Expédition Groupée ({batchResults.length} commandes)
                                </h3>
                            </div>
                            <button 
                                onClick={() => setBatchResults(null)}
                                className="text-text-secondary hover:text-text-primary"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 divide-y divide-base-300 text-xs pr-1">
                            {batchResults.map((item, idx) => (
                                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-bold text-text-primary">
                                            #{item.orderId} - {item.customerName}
                                        </div>
                                        <div className="text-[11px] text-text-secondary">
                                            Transporteur : {item.courierName}
                                        </div>
                                        {item.error && (
                                            <div className="text-[11px] text-[#FF4560] mt-0.5">
                                                {item.error}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        {item.success ? (
                                            <div className="flex items-center gap-1.5 font-mono font-bold text-xs bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded-[3px]">
                                                <span>{item.trackingNumber}</span>
                                                <button
                                                    onClick={() => handleCopyTracking(item.trackingNumber)}
                                                    className="hover:text-emerald-700"
                                                >
                                                    {copiedTracking === item.trackingNumber ? (
                                                        <Check className="w-3 h-3 text-[#10B981]" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-[#FF4560] font-bold">
                                                Échec
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-end pt-3 border-t border-base-300">
                            <button
                                onClick={() => setBatchResults(null)}
                                className="px-4 py-1.5 bg-[#3C50E0] hover:bg-[#3243be] text-white rounded-[3px] font-bold text-xs transition-all cursor-pointer"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Packing Slip Modal */}
            {showPackingSlipModal && (
                <PackingSlipModal
                    orders={orders.filter(o => selectedOrderIds.has(o.id))}
                    onClose={() => setShowPackingSlipModal(false)}
                />
            )}
        </div>
    );
};

export default OrderEntryView;
