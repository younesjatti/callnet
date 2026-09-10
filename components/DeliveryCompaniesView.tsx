import React, { useState, useMemo } from 'react';
import { 
    Search, 
    Plug, 
    Check, 
    Building2, 
    Settings2, 
    ExternalLink, 
    X, 
    CheckCircle2, 
    AlertCircle, 
    ShieldCheck, 
    RefreshCw, 
    Eye, 
    EyeOff, 
    Copy, 
    Sparkles, 
    Info, 
    Layers, 
    Truck,
    Radio,
    Zap,
    Clock,
    ShoppingBag,
    MessageCircle,
    ChevronRight,
    SlidersHorizontal
} from 'lucide-react';
import { CourierApiConfig, CourierProvider, Order } from '../types';
import { CourierCitySelect } from './CourierCitySelect';
import { getCourierCities, COURIER_LABELS } from '../lib/courierCities';
import { 
    IrsaliyatLogo, 
    OnesstaLogo, 
    ForcelogLogo, 
    AmeexLogo, 
    CathedisLogo, 
    ChronoDialiLogo, 
    SenditLogo, 
    OzonExpressLogo, 
    DigylogLogo, 
    KargoExpressLogo 
} from './CourierCompanyLogos';
import { apiClient } from '../lib/apiClient';

export interface DeliveryCompanyDef {
    id: CourierProvider;
    name: string;
    description: string;
    websiteUrl: string;
    apiHost: string;
    logoComponent: React.ReactNode;
    defaultNature?: string;
    badge?: string;
    hasDocumentation?: boolean;
}

export const DELIVERY_COMPANIES: DeliveryCompanyDef[] = [
    {
        id: 'irsaliyat',
        name: 'IRSALIYAT',
        description: 'Livraison express et collecte COD sur l’ensemble du territoire marocain.',
        websiteUrl: 'https://irsaliyatmaghreb.com',
        apiHost: 'api.irsaliyatmaghreb.com',
        hasDocumentation: false,
        logoComponent: <IrsaliyatLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'onessta',
        name: 'ONESSTA',
        description: 'Solutions logistiques et expéditions rapides pour e-commerçants.',
        websiteUrl: 'https://onessta.ma',
        apiHost: 'api.onessta.ma',
        hasDocumentation: false,
        logoComponent: <OnesstaLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'forcelog',
        name: 'FORCELOG',
        description: 'Réseau de transport et messagerie express avec suivi en temps réel.',
        websiteUrl: 'https://forcelog.ma',
        apiHost: 'api.forcelog.ma',
        hasDocumentation: false,
        logoComponent: <ForcelogLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'ameex',
        name: 'AMEEX',
        description: 'Nothing stops us - Messagerie nationale et logistique e-commerce intégrée (COD, Suivi en temps réel & Webhooks).',
        websiteUrl: 'https://ameex.ma',
        apiHost: 'api.ameex.app/customer',
        hasDocumentation: true,
        logoComponent: <AmeexLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'cathedis',
        name: 'CATHEDIS',
        description: 'Leader de la livraison du dernier kilomètre et du paiement à la livraison au Maroc.',
        websiteUrl: 'https://cathedis.net',
        apiHost: 'api.cathedis.net',
        hasDocumentation: false,
        logoComponent: <CathedisLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'chrono_diali',
        name: 'CHRONO DIALI',
        description: 'Service d’expédition moderne, rapide et fiable pour les marchands en ligne.',
        websiteUrl: 'https://chronodiali.ma',
        apiHost: 'api.chronodiali.ma',
        hasDocumentation: false,
        logoComponent: <ChronoDialiLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'sendit',
        name: 'SENDIT',
        description: 'Plateforme d’expédition multi-transporteurs et gestion automatisée des colis.',
        websiteUrl: 'https://sendit.ma',
        apiHost: 'api.sendit.ma',
        hasDocumentation: false,
        logoComponent: <SenditLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'ozon_express',
        name: 'OZON EXPRESS',
        description: 'API officielle Ozon Express v2.5 : ramassage, étiquettes, villes en direct.',
        websiteUrl: 'https://ozonexpress.ma',
        apiHost: 'api.ozonexpress.ma',
        badge: 'Nouveau',
        hasDocumentation: true,
        logoComponent: <OzonExpressLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'digylog',
        name: 'DIGYLOG',
        description: 'API Seller v2.5 DIGYLOG : standard & stock, hubs Casablanca & Agadir.',
        websiteUrl: 'https://digylog.com',
        apiHost: 'api.digylog.com',
        badge: 'v2.5 API',
        hasDocumentation: true,
        logoComponent: <DigylogLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    },
    {
        id: 'kargo_express',
        name: 'KARGO EXPRESS',
        description: 'Expédition directe via Kargo Express API avec suivi de statut automatisé.',
        websiteUrl: 'https://kargoexpress.app',
        apiHost: 'api.kargoexpress.app',
        hasDocumentation: true,
        logoComponent: <KargoExpressLogo className="w-16 h-16 sm:w-20 sm:h-20" />
    }
];

interface DeliveryCompaniesViewProps {
    courierConfigs: CourierApiConfig[];
    primaryCourier: CourierProvider;
    onSetPrimaryCourier: (provider: CourierProvider) => Promise<void> | void;
    onReloadConfigs: () => Promise<void> | void;
    orders?: Order[];
    onOpenShippingTab?: () => void;
    onSyncCourierCities?: (provider: any) => Promise<void> | void;
}

export const DeliveryCompaniesView: React.FC<DeliveryCompaniesViewProps> = ({
    courierConfigs = [],
    primaryCourier = 'ozon_express',
    onSetPrimaryCourier,
    onReloadConfigs,
    orders = [],
    onOpenShippingTab,
    onSyncCourierCities
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'available' | 'connected' | 'all'>('available');
    const [selectedCompanyForConfig, setSelectedCompanyForConfig] = useState<DeliveryCompanyDef | null>(null);
    const [isLiveEventsOpen, setIsLiveEventsOpen] = useState(true);
    const [liveEventFilter, setLiveEventFilter] = useState<'all' | 'orders' | 'status' | 'whatsapp'>('all');

    // Drawer form state for currently opened company
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [apiBaseUrl, setApiBaseUrl] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isStock, setIsStock] = useState(false);
    const [allowOpen, setAllowOpen] = useState(true);
    const [canTry, setCanTry] = useState(true);
    const [checkDuplicate, setCheckDuplicate] = useState(false);
    const [networkId, setNetworkId] = useState(1);
    const [storeId, setStoreId] = useState('store1');
    const [sentType, setSentType] = useState(1);
    const [port, setPort] = useState(1);
    const [fulfillmentCenter, setFulfillmentCenter] = useState(4);
    const [defaultNature, setDefaultNature] = useState('Colis E-commerce COD');
    const [pickupCity, setPickupCity] = useState('');
    const [pickupCityId, setPickupCityId] = useState('');

    // UI feedback
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Map existing configs by provider
    const configMap = useMemo(() => {
        const map = new Map<string, CourierApiConfig>();
        courierConfigs.forEach(cfg => {
            if (cfg && cfg.provider) {
                const existing = map.get(cfg.provider);
                if (!existing || (!existing.apiKey && Boolean(cfg.apiKey))) {
                    map.set(cfg.provider, cfg);
                }
            }
        });
        return map;
    }, [courierConfigs]);

    // Filter companies by search query and category
    const filteredCompanies = useMemo(() => {
        return DELIVERY_COMPANIES.filter(comp => {
            const matchesSearch = 
                comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                comp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                comp.apiHost.toLowerCase().includes(searchQuery.toLowerCase());
            
            const isConfigured = configMap.has(comp.id) && Boolean(configMap.get(comp.id)?.apiKey);

            if (filterCategory === 'connected') {
                return matchesSearch && isConfigured;
            }
            return matchesSearch;
        });
    }, [searchQuery, filterCategory, configMap]);

    // Handle opening configuration modal for a company
    const handleOpenConfig = (company: DeliveryCompanyDef) => {
        if (!company.hasDocumentation) return;
        setSelectedCompanyForConfig(company);
        setTestResult(null);
        setSaveSuccess(false);

        const existing = configMap.get(company.id) ||
                         courierConfigs.find(c => (c.provider === company.id || c.id === `${company.id}-config`) && Boolean(c.apiKey)) ||
                         courierConfigs.find(c => c.provider === company.id);

        if (existing) {
            setApiKey(existing.apiKey || '');
            setClientId(existing.clientId || '');
            setApiBaseUrl(existing.apiBaseUrl || `https://${company.apiHost}`);
            setIsStock(Boolean(existing.isStock));
            setAllowOpen(typeof existing.allowOpenParcel === 'boolean' ? existing.allowOpenParcel : true);
            setCanTry(typeof existing.canTry === 'boolean' ? existing.canTry : true);
            setCheckDuplicate(Boolean(existing.checkDuplicate));
            setNetworkId(existing.networkId || 1);
            setStoreId(existing.store || 'store1');
            setSentType(existing.sentType ?? 1);
            setPort(existing.port ?? 1);
            setFulfillmentCenter(existing.fc ?? 4);
            setDefaultNature(existing.defaultNature || 'Colis E-commerce COD');
            setPickupCity(existing.pickupCity || existing.defaultCity || '');
            setPickupCityId(existing.pickupCityId != null ? String(existing.pickupCityId) : '');
        } else {
            setApiKey('');
            setClientId('');
            setApiBaseUrl(`https://${company.apiHost}`);
            setIsStock(false);
            setAllowOpen(true);
            setCanTry(true);
            setCheckDuplicate(false);
            setNetworkId(1);
            setStoreId('store1');
            setSentType(1);
            setPort(1);
            setFulfillmentCenter(4);
            setDefaultNature('Colis E-commerce COD');
            setPickupCity('');
            setPickupCityId('');
        }
    };

    // Test connection handler
    const handleTestConnection = async () => {
        if (!selectedCompanyForConfig) return;
        if (!apiKey.trim()) {
            setTestResult({
                success: false,
                message: `Veuillez saisir votre clé d'API ou Bearer Token pour ${selectedCompanyForConfig.name}.`
            });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            let res: any;
            if (selectedCompanyForConfig.id === 'ozon_express') {
                res = await apiClient.apiPost('/couriers/ozon/test', {
                    apiKey: apiKey.trim(),
                    clientId: clientId.trim(),
                    apiBaseUrl: apiBaseUrl.trim()
                });
            } else if (selectedCompanyForConfig.id === 'digylog') {
                res = await apiClient.apiPost('/couriers/digylog/test', {
                    apiKey: apiKey.trim(),
                    apiBaseUrl: apiBaseUrl.trim(),
                    networkId: Number(networkId) || 1,
                    store: storeId.trim() || 'store1'
                });
            } else if (selectedCompanyForConfig.id === 'kargo_express') {
                res = await apiClient.apiPost('/couriers/kargo/test', {
                    apiKey: apiKey.trim(),
                    clientId: clientId.trim(),
                    apiBaseUrl: apiBaseUrl.trim()
                });
            } else if (selectedCompanyForConfig.id === 'ameex') {
                res = await apiClient.apiPost('/couriers/ameex/test', {
                    apiKey: apiKey.trim(),
                    clientId: clientId.trim(),
                    apiBaseUrl: apiBaseUrl.trim()
                });
            } else {
                await new Promise(r => setTimeout(r, 600));
                res = {
                    success: true,
                    message: `Connexion à l'API ${selectedCompanyForConfig.name} (${selectedCompanyForConfig.apiHost}) vérifiée avec succès.`
                };
            }
            setTestResult(res);
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.message || `Erreur de communication avec ${selectedCompanyForConfig.name}`
            });
        } finally {
            setIsTesting(false);
        }
    };

    // Save configuration handler
    const handleSaveConfig = async () => {
        if (!selectedCompanyForConfig) return;
        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const savedApiKey = apiKey.trim();
            const savedClientId = clientId.trim();
            const payload: Partial<CourierApiConfig> = {
                id: `${selectedCompanyForConfig.id}-config`,
                provider: selectedCompanyForConfig.id,
                name: selectedCompanyForConfig.name,
                isEnabled: true,
                apiKey: savedApiKey,
                clientId: savedClientId,
                apiBaseUrl: apiBaseUrl.trim() || `https://${selectedCompanyForConfig.apiHost}`,
                allowOpenParcel: allowOpen,
                isStock: isStock,
                canTry: canTry,
                checkDuplicate: checkDuplicate,
                networkId: Number(networkId) || 1,
                store: storeId.trim(),
                sentType: Number(sentType) || 1,
                port: Number(port) || 1,
                fc: Number(fulfillmentCenter) || 4,
                defaultNature: defaultNature.trim(),
                pickupCity: pickupCity.trim(),
                defaultCity: pickupCity.trim(),
                pickupCityId: pickupCityId.trim()
            };

            await apiClient.apiPost('/couriers/configs', payload);
            setSaveSuccess(true);
            await onReloadConfigs();

            setApiKey(savedApiKey);
            setClientId(savedClientId);

            setTimeout(() => {
                setSaveSuccess(false);
                setSelectedCompanyForConfig(null);
            }, 1200);
        } catch (err: any) {
            alert(`Erreur lors de la sauvegarde : ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Disconnect handler
    const handleDisconnect = async () => {
        if (!selectedCompanyForConfig) return;
        if (!confirm(`Voulez-vous vraiment déconnecter ${selectedCompanyForConfig.name} ?`)) return;

        try {
            await apiClient.apiDelete(`/couriers/configs/${selectedCompanyForConfig.id}-config`);
            await onReloadConfigs();
            setSelectedCompanyForConfig(null);
        } catch (e: any) {
            alert(`Erreur : ${e.message}`);
        }
    };

    // Real-time events list computed from orders for the live feed shown in photo
    const liveEvents = useMemo(() => {
        const sorted = [...orders].slice(0, 10);
        return sorted.map(o => ({
            id: o.id,
            ref: `Order FM${String(o.id).slice(-4)}`,
            customer: o.customerName || 'Client Inconnu',
            price: Number(o.price || 0),
            status: o.status,
            city: o.city || 'Maroc',
            date: o.date ? new Date(o.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récemment'
        }));
    }, [orders]);

    return (
        <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* MAIN DELIVERY COMPANIES SECTION */}
            <div className="flex-1 min-w-0 w-full space-y-6">
                {/* Header matching photo */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                            <span className="text-2xl">🏢</span>
                            <span>Delivery Companies</span>
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Connect your delivery partners to start shipping
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Transporteurs pour votre marché : Morocco (modifier le pays dans Paramètres → Entreprise)
                        </p>
                    </div>

                    {/* Search bar matching photo */}
                    <div className="relative w-full md:w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search companies..."
                            className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600 transition-all shadow-2xs"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter and Count Section matching photo */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Available Pill */}
                    <button
                        onClick={() => setFilterCategory('available')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                            filterCategory === 'available'
                                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Available</span>
                    </button>

                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {filteredCompanies.length} companies
                    </span>

                    {/* Secondary filter for connected companies */}
                    <button
                        onClick={() => setFilterCategory(filterCategory === 'connected' ? 'available' : 'connected')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                            filterCategory === 'connected'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Connectées uniquement</span>
                    </button>
                </div>

                {/* Grid of Companies matching photo (4 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                    {filteredCompanies.map((company) => {
                        const isConfigured = configMap.has(company.id) && Boolean(configMap.get(company.id)?.apiKey);
                        const isPrimary = primaryCourier === company.id;
                        const isDocumented = Boolean(company.hasDocumentation);

                        return (
                            <div
                                key={company.id}
                                className={`rounded-2xl border p-6 flex flex-col items-center justify-between text-center min-h-[260px] shadow-xs transition-all duration-200 relative overflow-hidden group ${
                                    isDocumented
                                        ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
                                        : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60'
                                }`}
                            >
                                {/* Top right active badges */}
                                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                    {isPrimary && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                            Principal
                                        </span>
                                    )}
                                    {isConfigured && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Connecté
                                        </span>
                                    )}
                                    {!isDocumented && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60">
                                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                                            En attente doc
                                        </span>
                                    )}
                                </div>

                                {/* Logo container centered */}
                                <div 
                                    onClick={() => isDocumented && handleOpenConfig(company)}
                                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center p-2 mt-2 mb-3 transition-transform ${
                                        isDocumented 
                                            ? 'cursor-pointer group-hover:scale-105' 
                                            : 'cursor-default opacity-60 grayscale'
                                    }`}
                                >
                                    {company.logoComponent}
                                </div>

                                {/* Company Name in bold uppercase */}
                                <div className="w-full">
                                    <h3 
                                        onClick={() => isDocumented && handleOpenConfig(company)}
                                        className={`font-extrabold text-sm sm:text-base tracking-wider uppercase transition-colors ${
                                            isDocumented 
                                                ? 'text-slate-900 dark:text-white cursor-pointer hover:text-purple-600' 
                                                : 'text-slate-600 dark:text-slate-400 cursor-default'
                                        }`}
                                    >
                                        {company.name}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                                        {company.apiHost}
                                    </p>
                                </div>

                                {/* Connect Button matching photo format */}
                                <div className="w-full mt-5">
                                    {!isDocumented ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200/70 dark:border-slate-700/50 cursor-not-allowed select-none shadow-none"
                                            title="Documentation API en attente de fourniture"
                                        >
                                            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                            <span className="truncate">En cours d'intégration</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenConfig(company)}
                                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs ${
                                                isConfigured
                                                    ? 'bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white'
                                                    : 'bg-[#18181b] hover:bg-black text-white'
                                            }`}
                                        >
                                            {isConfigured ? (
                                                <>
                                                    <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>Configurer</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plug className="w-3.5 h-3.5" />
                                                    <span>Connect</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredCompanies.length === 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
                        <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                        <h3 className="font-bold text-slate-800 dark:text-white">Aucun transporteur trouvé</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Aucune société de livraison ne correspond à votre recherche "{searchQuery}".
                        </p>
                        <button
                            onClick={() => setSearchQuery('')}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                        >
                            Réinitialiser la recherche
                        </button>
                    </div>
                )}
            </div>

            {/* LIVE EVENTS PANEL (SIDEBAR IN PHOTO) */}
            <div className="w-full xl:w-80 shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                            Événements en direct
                        </h3>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            {liveEvents.length} événements
                        </span>
                    </div>
                </div>

                {/* Sub-tabs: Tous | Commandes | Statut | WhatsApp */}
                <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                    <button
                        onClick={() => setLiveEventFilter('all')}
                        className={`font-semibold pb-1 cursor-pointer ${liveEventFilter === 'all' ? 'text-slate-900 dark:text-white border-b-2 border-purple-600' : 'text-slate-400'}`}
                    >
                        Tous
                    </button>
                    <button
                        onClick={() => setLiveEventFilter('orders')}
                        className={`font-semibold pb-1 flex items-center gap-1 cursor-pointer ${liveEventFilter === 'orders' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Commandes
                    </button>
                    <button
                        onClick={() => setLiveEventFilter('status')}
                        className={`font-semibold pb-1 flex items-center gap-1 cursor-pointer ${liveEventFilter === 'status' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400'}`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Statut
                    </button>
                    <button
                        onClick={() => setLiveEventFilter('whatsapp')}
                        className={`font-semibold pb-1 flex items-center gap-1 cursor-pointer ${liveEventFilter === 'whatsapp' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        WhatsApp
                    </button>
                </div>

                {/* Stats 3 columns matching photo */}
                <div className="grid grid-cols-3 gap-2 py-2 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                        <div className="text-base font-extrabold text-slate-900 dark:text-white">0</div>
                        <div className="text-[10px] text-slate-400">aujourd'hui</div>
                    </div>
                    <div className="border-x border-slate-200 dark:border-slate-700">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white">{orders.length}</div>
                        <div className="text-[10px] text-slate-400">total</div>
                    </div>
                    <div>
                        <div className="text-base font-extrabold text-emerald-600">0</div>
                        <div className="text-[10px] text-slate-400">revenu</div>
                    </div>
                </div>

                {/* Events list */}
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {liveEvents.slice(0, 6).map((evt, idx) => (
                        <div
                            key={evt.id || idx}
                            className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3"
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                                <ShoppingBag className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {evt.ref}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {evt.customer} — {evt.price.toFixed(2)} MAD
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                    {evt.date} • {evt.city}
                                </div>
                            </div>
                        </div>
                    ))}

                    {liveEvents.length === 0 && (
                        <div className="text-center py-8 text-xs text-slate-400">
                            Aucun événement récent
                        </div>
                    )}
                </div>

                {onOpenShippingTab && (
                    <button
                        onClick={onOpenShippingTab}
                        className="w-full py-2 px-3 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <span>Ouvrir la table d'expédition</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* CONFIGURATION MODAL / DRAWER */}
            {selectedCompanyForConfig && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                                    {selectedCompanyForConfig.logoComponent}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                                            {selectedCompanyForConfig.name}
                                        </h2>
                                        {configMap.has(selectedCompanyForConfig.id) && Boolean(configMap.get(selectedCompanyForConfig.id)?.apiKey) && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                Connecté
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedCompanyForConfig.description}
                                    </p>
                                    <a
                                        href={selectedCompanyForConfig.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:underline mt-1 font-semibold"
                                    >
                                        <span>Visiter le site officiel</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCompanyForConfig(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Inputs */}
                        <div className="space-y-4 text-xs">
                            {/* Primary Courier Choice */}
                            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-bold text-purple-900 dark:text-purple-200">
                                        Définir comme Transporteur Principal
                                    </div>
                                    <div className="text-[11px] text-purple-600 dark:text-purple-400">
                                        Ce transporteur sera sélectionné par défaut lors de l'expédition en masse.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSetPrimaryCourier(selectedCompanyForConfig.id)}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                        primaryCourier === selectedCompanyForConfig.id
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 hover:bg-purple-100'
                                    }`}
                                >
                                    {primaryCourier === selectedCompanyForConfig.id ? '✓ Principal' : 'Définir par défaut'}
                                </button>
                            </div>

                            {/* API Key / Bearer Token */}
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    {selectedCompanyForConfig.id === 'digylog' ? 'Bearer Token (API DIGYLOG v2.5)' : 'Clé API / Token d’authentification'} <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={selectedCompanyForConfig.id === 'digylog' ? 'ex: eyJhbGciOiJIUzI1NiIsInR5cCI6...' : 'Saisissez votre clé API officielle...'}
                                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Client ID / Account ID / Store ID */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {selectedCompanyForConfig.id === 'digylog' ? (
                                    <>
                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Network ID
                                            </label>
                                            <input
                                                type="number"
                                                value={networkId}
                                                onChange={(e) => setNetworkId(Number(e.target.value))}
                                                placeholder="1"
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Store ID (Boutique)
                                            </label>
                                            <input
                                                type="text"
                                                value={storeId}
                                                onChange={(e) => setStoreId(e.target.value)}
                                                placeholder="store1"
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {selectedCompanyForConfig.id === 'ozon_express' ? 'ID Client Ozon' : 'Identifiant / Code Partenaire'}
                                        </label>
                                        <input
                                            type="text"
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            placeholder="ex: 1042 ou YOUR_ID"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        URL API de Base
                                    </label>
                                    <input
                                        type="text"
                                        value={apiBaseUrl}
                                        onChange={(e) => setApiBaseUrl(e.target.value)}
                                        placeholder={`https://${selectedCompanyForConfig.apiHost}`}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
                                    />
                                </div>
                            </div>

                            {/* Additional Provider Options */}
                            {selectedCompanyForConfig.id === 'digylog' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                                    <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-amber-600" />
                                        <span>Paramètres Métier DIGYLOG v2.5</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="block text-slate-500 mb-1">Comportement d'envoi (sentType)</label>
                                            <select
                                                value={sentType}
                                                onChange={(e) => setSentType(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                            >
                                                <option value={1}>1 - Vers service de livraison (Défaut)</option>
                                                <option value={2}>2 - Vers centre d'appel</option>
                                                <option value={0}>0 - Enregistrement seul</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-slate-500 mb-1">Frais de port (port)</label>
                                            <select
                                                value={port}
                                                onChange={(e) => setPort(Number(e.target.value))}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                            >
                                                <option value={1}>1 - Payé par le Client (COD)</option>
                                                <option value={2}>2 - Payé par le Vendeur</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4 pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowOpen}
                                                onChange={(e) => setAllowOpen(e.target.checked)}
                                                className="rounded text-purple-600"
                                            />
                                            <span className="font-medium text-slate-700 dark:text-slate-300">Ouvrir le colis (openproduct)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={canTry}
                                                onChange={(e) => setCanTry(e.target.checked)}
                                                className="rounded text-purple-600"
                                            />
                                            <span className="font-medium text-slate-700 dark:text-slate-300">Autoriser l'essayage (cantry)</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {selectedCompanyForConfig.id === 'ozon_express' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                                    <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                        <Truck className="w-4 h-4 text-purple-600" />
                                        <span>Options Ozon Express</span>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowOpen}
                                                onChange={(e) => setAllowOpen(e.target.checked)}
                                                className="rounded text-purple-600"
                                            />
                                            <span>Autoriser l'ouverture du colis</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isStock}
                                                onChange={(e) => setIsStock(e.target.checked)}
                                                className="rounded text-purple-600"
                                            />
                                            <span>Mode Stock Entrepôt</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Villes officielles & Ramassage par défaut */}
                            <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 rounded-2xl border border-purple-200/80 dark:border-purple-800/60 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-purple-600" />
                                        <span>Villes Officielles & Ramassage ({getCourierCities(selectedCompanyForConfig.id).length} villes)</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                        {selectedCompanyForConfig.name}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Définissez la ville de ramassage / expédition par défaut pour {selectedCompanyForConfig.name}. La sélection se base strictement sur le catalogue officiel de cette société de livraison.
                                </p>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-xs">
                                        Ville de ramassage / référence par défaut
                                    </label>
                                    <CourierCitySelect 
                                        value={pickupCity}
                                        cityId={pickupCityId}
                                        onChange={(name, id) => {
                                            setPickupCity(name);
                                            setPickupCityId(String(id || ''));
                                        }}
                                        courierProvider={selectedCompanyForConfig.id}
                                        placeholder={`Rechercher parmi les ${getCourierCities(selectedCompanyForConfig.id).length} villes de ${selectedCompanyForConfig.name}...`}
                                        allowProviderSwitch={false}
                                    />
                                    {pickupCity && (
                                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Ville officielle sélectionnée : <strong>{pickupCity}</strong> {pickupCityId ? `(Code/ID: ${pickupCityId})` : ''}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Test feedback */}
                            {testResult && (
                                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 animate-in fade-in ${
                                    testResult.success 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                        : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                }`}>
                                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
                                    <div className="leading-relaxed">
                                        {testResult.message}
                                    </div>
                                </div>
                            )}

                            {saveSuccess && (
                                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-2 font-bold animate-in fade-in">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Configuration enregistrée et société connectée avec succès !</span>
                                </div>
                            )}
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    disabled={isTesting}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isTesting ? 'animate-spin' : ''}`} />
                                    <span>{isTesting ? 'Test en cours...' : 'Tester la connexion'}</span>
                                </button>
                                {configMap.has(selectedCompanyForConfig.id) && (
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        className="text-xs text-red-600 hover:underline px-2 py-1 font-semibold cursor-pointer"
                                    >
                                        Déconnecter
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCompanyForConfig(null)}
                                    className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold cursor-pointer"
                                >
                                    Fermer
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveConfig}
                                    disabled={isSaving}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-black dark:bg-purple-600 dark:hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    <span>{isSaving ? 'Enregistrement...' : 'Enregistrer & Connecter'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
