import React, { useState, useMemo, useEffect } from 'react';
import { 
    Truck, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    Search, 
    Send, 
    Key, 
    Settings2, 
    RefreshCw, 
    Eye, 
    EyeOff, 
    Check, 
    Copy, 
    ExternalLink, 
    Package, 
    Building2, 
    ShieldCheck, 
    ChevronRight, 
    Code2, 
    MapPin, 
    Phone, 
    User as UserIcon, 
    FileText, 
    Filter,
    CheckSquare,
    Square,
    Sparkles,
    AlertTriangle,
    Layers,
    ShieldAlert,
    RotateCcw,
    Zap,
    LayoutGrid,
    SlidersHorizontal,
    Download
} from 'lucide-react';
import { Order, OrderStatus, Role, CourierApiConfig, CourierCity, ParcelShipmentResult, CourierProvider } from '../types';
import { OZON_EXPRESS_LOGO, DIGYLOG_LOGO, DIGYLOG_CITIES } from '../lib/courierCities';
import { AmeexLogo } from './CourierCompanyLogos';
import { DeliveryCompaniesView } from './DeliveryCompaniesView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient } from '../lib/apiClient';

interface ExpeditionsViewProps {
    orders: Order[];
    onUpdateOrder?: (orderId: string, updates: Partial<Order>) => void | Promise<void>;
    onSelectOrder?: (order: Order) => void;
    storeName?: string;
}

export const ExpeditionsView: React.FC<ExpeditionsViewProps> = ({
    orders = [],
    onUpdateOrder,
    onSelectOrder,
    storeName
}) => {
    const { currentUser } = useAuth();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<'configs' | 'ship' | 'tracking' | 'cities'>('configs');
    const [configViewMode, setConfigViewMode] = useState<'grid' | 'detailed'>('grid');
    const [selectedCourier, setSelectedCourier] = useState<'ozon_express' | 'kargo_express' | 'digylog' | 'cathedis' | 'ameex' | 'custom_api'>('ozon_express');
    const [targetDispatchCourier, setTargetDispatchCourier] = useState<'ozon_express' | 'kargo_express' | 'digylog' | 'ameex'>('ozon_express');
    
    // Config state
    const [courierConfigs, setCourierConfigs] = useState<CourierApiConfig[]>([]);
    const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
    const [primaryCourier, setPrimaryCourier] = useState<CourierProvider>('ozon_express');
    const [isSettingPrimary, setIsSettingPrimary] = useState(false);
    const [isSyncingCities, setIsSyncingCities] = useState(false);
    const [isNormalizingOrders, setIsNormalizingOrders] = useState(false);
    const [isNormalizingPhones, setIsNormalizingPhones] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);
    const [normalizeFeedback, setNormalizeFeedback] = useState<{ success: boolean; message: string; updatedCount?: number } | null>(null);
    const [phoneNormalizeFeedback, setPhoneNormalizeFeedback] = useState<{ success: boolean; message: string; updatedCount?: number } | null>(null);

    // Ozon Express Config Form State
    const [ozonApiKey, setOzonApiKey] = useState('');
    const [ozonClientId, setOzonClientId] = useState('');
    const [ozonBaseUrl, setOzonBaseUrl] = useState('https://api.ozonexpress.ma');
    const [ozonIsStock, setOzonIsStock] = useState(false);
    const [ozonAllowOpen, setOzonAllowOpen] = useState(true);
    const [ozonIsFragile, setOzonIsFragile] = useState(false);
    const [ozonIsReplace, setOzonIsReplace] = useState(false);
    const [ozonDefaultNature, setOzonDefaultNature] = useState('Colis E-commerce COD');
    const [isSavingOzon, setIsSavingOzon] = useState(false);
    const [ozonSaveSuccess, setOzonSaveSuccess] = useState(false);
    const [ozonTestResult, setOzonTestResult] = useState<{ success: boolean; message: string; simulated?: boolean } | null>(null);
    const [isTestingOzon, setIsTestingOzon] = useState(false);
    const [showOzonApiKey, setShowOzonApiKey] = useState(false);
    const [ozonDocTab, setOzonDocTab] = useState<'add_parcel' | 'parcel_info' | 'tracking' | 'cities'>('add_parcel');

    // Kargo Express Config Form State
    const [kargoApiKey, setKargoApiKey] = useState('');
    const [kargoClientId, setKargoClientId] = useState('');
    const [kargoBaseUrl, setKargoBaseUrl] = useState('https://api.kargoexpress.app');
    const [kargoIsStock, setKargoIsStock] = useState(false);
    const [kargoAllowOpen, setKargoAllowOpen] = useState(true);
    const [kargoDefaultNature, setKargoDefaultNature] = useState('Colis E-commerce COD');
    const [isSavingKargo, setIsSavingKargo] = useState(false);
    const [kargoSaveSuccess, setKargoSaveSuccess] = useState(false);
    const [kargoTestResult, setKargoTestResult] = useState<{ success: boolean; message: string; simulated?: boolean } | null>(null);
    const [isTestingKargo, setIsTestingKargo] = useState(false);
    const [showKargoApiKey, setShowKargoApiKey] = useState(false);
    const [kargoDocTab, setKargoDocTab] = useState<'new_parcel' | 'tracking' | 'cities'>('new_parcel');

    // DIGYLOG Express Config Form State
    const [digylogApiKey, setDigylogApiKey] = useState('');
    const [digylogNetworkId, setDigylogNetworkId] = useState(1);
    const [digylogStoreId, setDigylogStoreId] = useState('store1');
    const [digylogSentType, setDigylogSentType] = useState(1);
    const [digylogPort, setDigylogPort] = useState(1);
    const [digylogAllowOpen, setDigylogAllowOpen] = useState(true);
    const [digylogCanTry, setDigylogCanTry] = useState(true);
    const [digylogCheckDuplicate, setDigylogCheckDuplicate] = useState(false);
    const [digylogBaseUrl, setDigylogBaseUrl] = useState('https://api.digylog.com/api/v2/seller');
    const [isSavingDigylog, setIsSavingDigylog] = useState(false);
    const [digylogSaveSuccess, setDigylogSaveSuccess] = useState(false);
    const [digylogTestResult, setDigylogTestResult] = useState<{ success: boolean; message: string; simulated?: boolean } | null>(null);
    const [isTestingDigylog, setIsTestingDigylog] = useState(false);
    const [digylogOrderType, setDigylogOrderType] = useState<'standard' | 'stock'>('standard');
    const [digylogFulfillmentCenter, setDigylogFulfillmentCenter] = useState<number>(4);
    const [showDigylogApiKey, setShowDigylogApiKey] = useState(false);
    const [digylogDocTab, setDigylogDocTab] = useState<'standard' | 'stock' | 'cities' | 'statuses'>('standard');

    // Cathedis Config Form
    const [cathedisApiKey, setCathedisApiKey] = useState('');
    const [cathedisClientId, setCathedisClientId] = useState('');

    // Ameex Delivery Config Form State
    const [ameexApiKey, setAmeexApiKey] = useState('');
    const [ameexClientId, setAmeexClientId] = useState('');
    const [ameexBaseUrl, setAmeexBaseUrl] = useState('https://api.ameex.app/customer');
    const [ameexWebhookSecret, setAmeexWebhookSecret] = useState('');
    const [isSavingAmeex, setIsSavingAmeex] = useState(false);
    const [ameexSaveSuccess, setAmeexSaveSuccess] = useState(false);
    const [ameexTestResult, setAmeexTestResult] = useState<{ success: boolean; message: string; simulated?: boolean; isSandbox?: boolean } | null>(null);
    const [isTestingAmeex, setIsTestingAmeex] = useState(false);
    const [showAmeexApiKey, setShowAmeexApiKey] = useState(false);
    const [showAmeexWebhookSecret, setShowAmeexWebhookSecret] = useState(false);
    const [ameexDocTab, setAmeexDocTab] = useState<'add_parcel' | 'tracking' | 'cities' | 'webhook'>('add_parcel');
    const [isSyncingAmeexCities, setIsSyncingAmeexCities] = useState(false);
    const [ameexCitiesCount, setAmeexCitiesCount] = useState<number | null>(null);

    // Shipping orders selection
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ready' | 'all' | 'shipped'>('ready');
    const [cityFilter, setCityFilter] = useState<string>('all');

    // Dispatch execution state
    const [isDispatching, setIsDispatching] = useState(false);
    const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number } | null>(null);
    const [dispatchResults, setDispatchResults] = useState<ParcelShipmentResult[] | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Tracking state
    const [trackingQuery, setTrackingQuery] = useState('');
    const [activeTrackingData, setActiveTrackingData] = useState<any>(null);
    const [isSearchingTracking, setIsSearchingTracking] = useState(false);

    // Cities state
    const [cities, setCities] = useState<CourierCity[]>([]);
    const [citySearch, setCitySearch] = useState('');
    const [cityProvider, setCityProvider] = useState<'ozon' | 'kargo' | 'digylog' | 'ameex'>('ozon');

    // Copy notification
    const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

    // Load configs and cities on mount
    useEffect(() => {
        loadCourierConfigs();
        loadCities('ozon');
    }, []);

    const loadCourierConfigs = async () => {
        setIsLoadingConfigs(true);
        try {
            const data = await apiClient.apiFetch<CourierApiConfig[]>('/couriers/configs');
            if (Array.isArray(data)) {
                setCourierConfigs(data);

                // Detect primary courier
                const primary = data.find(c => Boolean((c as any).is_primary || (c as any).isPrimary));
                if (primary && (primary.provider === 'ozon_express' || primary.provider === 'kargo_express' || primary.provider === 'digylog' || primary.provider === 'ameex')) {
                    setPrimaryCourier(primary.provider as any);
                    setTargetDispatchCourier(primary.provider as any);
                }

                // Ozon config
                const ozon = data.find(c => c.provider === 'ozon_express');
                if (ozon) {
                    setOzonApiKey(ozon.apiKey || '');
                    setOzonClientId(ozon.clientId || '');
                    setOzonBaseUrl(ozon.apiBaseUrl || 'https://api.ozonexpress.ma');
                    setOzonIsStock(Boolean(ozon.isStock));
                    setOzonAllowOpen(ozon.allowOpenParcel !== false);
                    setOzonIsFragile(Boolean(ozon.isFragile));
                    setOzonIsReplace(Boolean(ozon.isReplace));
                    setOzonDefaultNature(ozon.defaultNature || 'Colis E-commerce COD');
                }

                // Kargo config
                const kargo = data.find(c => c.provider === 'kargo_express');
                if (kargo) {
                    setKargoApiKey(kargo.apiKey || '');
                    setKargoClientId(kargo.clientId || '');
                    setKargoBaseUrl(kargo.apiBaseUrl || 'https://api.kargoexpress.app');
                    setKargoIsStock(Boolean(kargo.isStock));
                    setKargoAllowOpen(kargo.allowOpenParcel !== false);
                    setKargoDefaultNature(kargo.defaultNature || 'Colis E-commerce COD');
                }

                // DIGYLOG config
                const digylog = data.find(c => c.provider === 'digylog');
                if (digylog) {
                    setDigylogApiKey(digylog.apiKey || '');
                    setDigylogBaseUrl(digylog.apiBaseUrl || 'https://api.digylog.com/api/v2/seller');
                    if (digylog.networkId) setDigylogNetworkId(Number(digylog.networkId));
                    if (digylog.store) setDigylogStoreId(digylog.store);
                    if (digylog.sentType) setDigylogSentType(Number(digylog.sentType));
                    if (digylog.port) setDigylogPort(Number(digylog.port));
                    if (typeof digylog.allowOpenParcel === 'boolean') setDigylogAllowOpen(digylog.allowOpenParcel);
                    if (typeof digylog.canTry === 'boolean') setDigylogCanTry(digylog.canTry);
                    if (typeof digylog.checkDuplicate === 'boolean') setDigylogCheckDuplicate(digylog.checkDuplicate);
                }

                // Cathedis config
                const cathedis = data.find(c => c.provider === 'cathedis');
                if (cathedis) {
                    setCathedisApiKey(cathedis.apiKey || '');
                    setCathedisClientId(cathedis.clientId || '');
                }

                // Ameex config
                const ameex = data.find(c => c.provider === 'ameex');
                if (ameex) {
                    setAmeexApiKey(ameex.apiKey || '');
                    setAmeexClientId(ameex.clientId || '');
                    setAmeexBaseUrl(ameex.apiBaseUrl || 'https://api.ameex.app/customer');
                    if (ameex.webhookSecret) setAmeexWebhookSecret(ameex.webhookSecret);
                }
            }
        } catch (e) {
            console.error("Error loading courier configs:", e);
        } finally {
            setIsLoadingConfigs(false);
        }
    };

    const handleSetPrimaryCourier = async (provider: CourierProvider) => {
        setIsSettingPrimary(true);
        try {
            const res = await apiClient.apiPut<any>('/couriers/primary', { provider });
            if (res && res.success) {
                setPrimaryCourier(provider);
                if (provider === 'ozon_express' || provider === 'kargo_express' || provider === 'digylog' || provider === 'ameex') {
                    setTargetDispatchCourier(provider);
                }
                const courierLabel = provider === 'ozon_express' ? 'Ozon Express' : (provider === 'kargo_express' ? 'Kargo Express' : (provider === 'digylog' ? 'DIGYLOG Express' : (provider === 'ameex' ? 'Ameex Delivery' : provider.toUpperCase())));
                setSyncFeedback({
                    success: true,
                    message: `Société de livraison principale mise à jour avec succès : ${courierLabel}`
                });
                setTimeout(() => setSyncFeedback(null), 4000);
                await loadCourierConfigs();
            }
        } catch (err: any) {
            alert(`Erreur lors du choix du transporteur principal : ${err.message}`);
        } finally {
            setIsSettingPrimary(false);
        }
    };

    const handleSyncCourierCities = async (provider: CourierProvider) => {
        setIsSyncingCities(true);
        setSyncFeedback(null);
        try {
            if (provider === 'ameex') {
                await handleSyncAmeexCities();
                return;
            }

            if (provider === 'digylog') {
                const list = await apiClient.apiFetch<CourierCity[]>('/couriers/digylog/cities');
                if (Array.isArray(list)) {
                    setCities(list);
                    setSyncFeedback({
                        success: true,
                        message: `${list.length} villes officielles DIGYLOG Express synchronisées avec succès !`
                    });
                }
                return;
            }

            const isOzon = provider === 'ozon_express';
            const payload = {
                provider: (provider === 'kargo_express' || provider === 'ozon_express') ? provider : 'ozon_express',
                apiKey: isOzon ? ozonApiKey : kargoApiKey,
                clientId: isOzon ? ozonClientId : kargoClientId,
                apiBaseUrl: isOzon ? ozonBaseUrl : kargoBaseUrl
            };
            const res = await apiClient.apiPost<any>('/couriers/sync-cities', payload);
            if (res && res.success) {
                setSyncFeedback({
                    success: true,
                    message: res.message || `${res.count} villes officielles importées et synchronisées pour ${isOzon ? 'Ozon Express' : 'Kargo Express'} !`
                });
                await loadCities(isOzon ? 'ozon' : 'kargo');
            } else {
                setSyncFeedback({
                    success: false,
                    message: res?.error || 'Erreur lors de la synchronisation des villes'
                });
            }
        } catch (err: any) {
            setSyncFeedback({
                success: false,
                message: err.message || 'Échec de synchronisation'
            });
        } finally {
            setIsSyncingCities(false);
        }
    };

    const handleNormalizeStoreOrders = async (provider: CourierProvider) => {
        setIsNormalizingOrders(true);
        setNormalizeFeedback(null);
        try {
            const res = await apiClient.apiPost<any>('/couriers/normalize-orders', { provider });
            if (res && res.success) {
                const courierName = provider === 'ozon_express' ? 'Ozon' : (provider === 'kargo_express' ? 'Kargo' : (provider === 'digylog' ? 'DIGYLOG' : provider));
                setNormalizeFeedback({
                    success: true,
                    message: res.message || `${res.updatedCount} commandes normalisées avec les villes officielles ${courierName} !`,
                    updatedCount: res.updatedCount
                });
                // If local order updater provided, reload or inform user
                if (Array.isArray(res.updatedOrders) && onUpdateOrder) {
                    res.updatedOrders.forEach((uo: any) => {
                        onUpdateOrder(uo.id, {
                            city: uo.city,
                            cityId: uo.cityId || uo.city_id
                        });
                    });
                }
            } else {
                setNormalizeFeedback({
                    success: false,
                    message: res?.error || 'Erreur lors de la normalisation'
                });
            }
        } catch (err: any) {
            setNormalizeFeedback({
                success: false,
                message: err.message || 'Échec de la normalisation'
            });
        } finally {
            setIsNormalizingOrders(false);
        }
    };

    const handleNormalizePhones = async (orderIds?: string[]) => {
        setIsNormalizingPhones(true);
        setPhoneNormalizeFeedback(null);
        try {
            const res = await apiClient.apiPost<any>('/couriers/normalize-phones', {
                orderIds: orderIds || (selectedOrderIds.size > 0 ? Array.from(selectedOrderIds) : undefined)
            });
            if (res && res.success) {
                setPhoneNormalizeFeedback({
                    success: true,
                    message: res.message || `${res.updatedCount} numéro(s) de téléphone formaté(s) en 06/07 !`,
                    updatedCount: res.updatedCount
                });
                if (Array.isArray(res.updatedOrders) && onUpdateOrder) {
                    res.updatedOrders.forEach((uo: any) => {
                        onUpdateOrder(uo.id, {
                            phone: uo.newPhone
                        });
                    });
                }
            } else {
                setPhoneNormalizeFeedback({
                    success: false,
                    message: res?.error || 'Erreur lors du formatage des téléphones'
                });
            }
        } catch (err: any) {
            setPhoneNormalizeFeedback({
                success: false,
                message: err.message || 'Échec du formatage des téléphones'
            });
        } finally {
            setIsNormalizingPhones(false);
        }
    };

    const loadCities = async (provider: 'ozon' | 'kargo' | 'digylog' | 'ameex' = 'ozon') => {
        setCityProvider(provider);
        try {
            let endpoint = '/couriers/ozon/cities';
            if (provider === 'kargo') endpoint = '/couriers/kargo/cities';
            if (provider === 'digylog') endpoint = '/couriers/digylog/cities';
            if (provider === 'ameex') endpoint = '/couriers/ameex/cities';
            const list = await apiClient.apiFetch<CourierCity[]>(endpoint);
            if (Array.isArray(list)) setCities(list);
        } catch (e) {
            console.error(`Error loading ${provider} cities:`, e);
            if (provider === 'digylog') {
                setCities(DIGYLOG_CITIES);
            }
        }
    };

    const handleSaveOzonConfig = async () => {
        setIsSavingOzon(true);
        setOzonSaveSuccess(false);
        try {
            const payload: Partial<CourierApiConfig> = {
                id: 'ozon-express-config',
                provider: 'ozon_express',
                name: 'Ozon Express',
                isEnabled: true,
                apiKey: ozonApiKey.trim(),
                clientId: ozonClientId.trim(),
                apiBaseUrl: ozonBaseUrl.trim(),
                isStock: ozonIsStock,
                allowOpenParcel: ozonAllowOpen,
                isFragile: ozonIsFragile,
                isReplace: ozonIsReplace,
                defaultNature: ozonDefaultNature.trim()
            };
            await apiClient.apiPost('/couriers/configs', payload);
            setOzonSaveSuccess(true);
            setTimeout(() => setOzonSaveSuccess(false), 3500);
            loadCourierConfigs();
        } catch (err: any) {
            alert(`Erreur lors de l'enregistrement Ozon Express : ${err.message}`);
        } finally {
            setIsSavingOzon(false);
        }
    };

    const handleTestOzonConnection = async () => {
        if (!ozonClientId.trim() || !ozonApiKey.trim()) {
            setOzonTestResult({
                success: false,
                message: 'Veuillez saisir votre CLIENT_ID ({YOUR_ID}) et votre API_KEY ({YOUR_API_KEY}) Ozon Express avant de lancer le test.'
            });
            return;
        }
        setIsTestingOzon(true);
        setOzonTestResult(null);
        try {
            const res = await apiClient.apiPost<{ success: boolean; message: string; simulated?: boolean }>('/couriers/ozon/test', {
                apiKey: ozonApiKey.trim(),
                clientId: ozonClientId.trim(),
                apiBaseUrl: ozonBaseUrl.trim()
            });
            setOzonTestResult(res);
        } catch (err: any) {
            setOzonTestResult({
                success: false,
                message: err.message || 'Erreur lors du test de connexion Ozon Express'
            });
        } finally {
            setIsTestingOzon(false);
        }
    };

    const handleSaveKargoConfig = async () => {
        setIsSavingKargo(true);
        setKargoSaveSuccess(false);
        try {
            const payload: Partial<CourierApiConfig> = {
                id: 'kargo-express-config',
                provider: 'kargo_express',
                name: 'Kargo Express',
                isEnabled: true,
                apiKey: kargoApiKey.trim(),
                clientId: kargoClientId.trim(),
                apiBaseUrl: kargoBaseUrl.trim(),
                isStock: kargoIsStock,
                allowOpenParcel: kargoAllowOpen,
                defaultNature: kargoDefaultNature.trim()
            };
            await apiClient.apiPost('/couriers/configs', payload);
            setKargoSaveSuccess(true);
            setTimeout(() => setKargoSaveSuccess(false), 3500);
            loadCourierConfigs();
        } catch (err: any) {
            alert(`Erreur lors de l'enregistrement Kargo Express : ${err.message}`);
        } finally {
            setIsSavingKargo(false);
        }
    };

    const handleTestKargoConnection = async () => {
        if (!kargoClientId.trim() || !kargoApiKey.trim()) {
            setKargoTestResult({
                success: false,
                message: 'Veuillez saisir votre CLIENT_ID et votre API_KEY Kargo Express avant de lancer le test.'
            });
            return;
        }
        setIsTestingKargo(true);
        setKargoTestResult(null);
        try {
            const res = await apiClient.apiPost<{ success: boolean; message: string; simulated?: boolean }>('/couriers/kargo/test', {
                apiKey: kargoApiKey.trim(),
                clientId: kargoClientId.trim(),
                apiBaseUrl: kargoBaseUrl.trim()
            });
            setKargoTestResult(res);
        } catch (err: any) {
            setKargoTestResult({
                success: false,
                message: err.message || 'Erreur lors du test de connexion Kargo Express'
            });
        } finally {
            setIsTestingKargo(false);
        }
    };

    const handleSaveDigylogConfig = async () => {
        setIsSavingDigylog(true);
        setDigylogSaveSuccess(false);
        try {
            const payload: Partial<CourierApiConfig> = {
                id: 'digylog-default',
                provider: 'digylog',
                name: 'DIGYLOG Express',
                isEnabled: true,
                apiKey: digylogApiKey.trim(),
                apiBaseUrl: digylogBaseUrl.trim(),
                networkId: Number(digylogNetworkId) || 1,
                store: digylogStoreId.trim() || 'store1',
                sentType: Number(digylogSentType) || 1,
                port: Number(digylogPort) || 1,
                allowOpenParcel: digylogAllowOpen,
                canTry: digylogCanTry,
                checkDuplicate: digylogCheckDuplicate
            };
            await apiClient.apiPost('/couriers/configs', payload);
            setDigylogSaveSuccess(true);
            setTimeout(() => setDigylogSaveSuccess(false), 3500);
            loadCourierConfigs();
        } catch (err: any) {
            alert(`Erreur lors de l'enregistrement DIGYLOG Express : ${err.message}`);
        } finally {
            setIsSavingDigylog(false);
        }
    };

    const handleTestDigylogConnection = async () => {
        if (!digylogApiKey.trim()) {
            setDigylogTestResult({
                success: false,
                message: 'Veuillez renseigner votre Bearer Token API DIGYLOG Express avant de lancer le test.'
            });
            return;
        }
        setIsTestingDigylog(true);
        setDigylogTestResult(null);
        try {
            const res = await apiClient.apiPost<{ success: boolean; message: string; simulated?: boolean }>('/couriers/digylog/test', {
                apiKey: digylogApiKey.trim(),
                apiBaseUrl: digylogBaseUrl.trim(),
                networkId: Number(digylogNetworkId) || 1,
                store: digylogStoreId.trim() || 'store1'
            });
            setDigylogTestResult(res);
        } catch (err: any) {
            setDigylogTestResult({
                success: false,
                message: err.message || 'Erreur lors du test de connexion DIGYLOG Express'
            });
        } finally {
            setIsTestingDigylog(false);
        }
    };

    const handleSaveAmeexConfig = async () => {
        setIsSavingAmeex(true);
        setAmeexSaveSuccess(false);
        try {
            const payload: Partial<CourierApiConfig> = {
                id: 'ameex-config',
                provider: 'ameex',
                name: 'Ameex Delivery',
                isEnabled: true,
                apiKey: ameexApiKey.trim(),
                clientId: ameexClientId.trim(),
                apiBaseUrl: ameexBaseUrl.trim() || 'https://api.ameex.app/customer',
                webhookSecret: ameexWebhookSecret.trim()
            };
            await apiClient.apiPost('/couriers/configs', payload);
            setAmeexSaveSuccess(true);
            setTimeout(() => setAmeexSaveSuccess(false), 3500);
            loadCourierConfigs();
        } catch (err: any) {
            alert(`Erreur lors de l'enregistrement Ameex Delivery : ${err.message}`);
        } finally {
            setIsSavingAmeex(false);
        }
    };

    const handleTestAmeexConnection = async () => {
        if (!ameexApiKey.trim() || !ameexClientId.trim()) {
            setAmeexTestResult({
                success: false,
                message: 'Veuillez renseigner votre Identifiant (C-Api-Id) et votre Clé API (C-Api-Key) Ameex avant de lancer le test.'
            });
            return;
        }
        setIsTestingAmeex(true);
        setAmeexTestResult(null);
        try {
            const res = await apiClient.apiPost<{ success: boolean; message: string; simulated?: boolean; isSandbox?: boolean }>('/couriers/ameex/test', {
                apiKey: ameexApiKey.trim(),
                clientId: ameexClientId.trim(),
                apiBaseUrl: ameexBaseUrl.trim()
            });
            setAmeexTestResult(res);
        } catch (err: any) {
            setAmeexTestResult({
                success: false,
                message: err.message || 'Erreur lors du test de connexion Ameex Delivery'
            });
        } finally {
            setIsTestingAmeex(false);
        }
    };

    const handleSyncAmeexCities = async () => {
        setIsSyncingAmeexCities(true);
        try {
            const res = await apiClient.apiPost<any>('/couriers/ameex/sync-cities', {
                apiKey: ameexApiKey.trim(),
                clientId: ameexClientId.trim(),
                apiBaseUrl: ameexBaseUrl.trim()
            });
            if (res && res.success) {
                if (Array.isArray(res.cities)) {
                    setCities(res.cities);
                }
                setAmeexCitiesCount(res.count || (res.cities ? res.cities.length : 0));
                setSyncFeedback({
                    success: true,
                    message: res.message || `${res.count} villes officielles Ameex Delivery synchronisées avec succès !`
                });
                setTimeout(() => setSyncFeedback(null), 5000);
            } else {
                alert(res?.error || 'Erreur lors de la synchronisation des villes Ameex');
            }
        } catch (err: any) {
            alert(`Erreur lors de la synchronisation Ameex : ${err.message}`);
        } finally {
            setIsSyncingAmeexCities(false);
        }
    };

    // Filtered orders for shipping
    const candidateOrders = useMemo(() => {
        return orders.filter(o => {
            if (statusFilter === 'ready') {
                const s = String(o.status || '').toLowerCase();
                const isConfirmed = s === 'confirme' || s === 'confirmé';
                const hasNoTracking = !o.trackingNumber;
                return isConfirmed && hasNoTracking;
            }
            if (statusFilter === 'shipped') {
                return Boolean(o.trackingNumber) || String(o.status || '').toLowerCase() === 'expedie' || String(o.status || '').toLowerCase() === 'expidé';
            }
            return true;
        }).filter(o => {
            if (cityFilter !== 'all' && (o.city || 'Inconnue') !== cityFilter) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
                (o.customerName || '').toLowerCase().includes(q) ||
                (o.phone || '').toLowerCase().includes(q) ||
                (o.id || '').toLowerCase().includes(q) ||
                (o.city || '').toLowerCase().includes(q) ||
                (o.product || '').toLowerCase().includes(q) ||
                (o.trackingNumber || '').toLowerCase().includes(q)
            );
        });
    }, [orders, statusFilter, cityFilter, searchQuery]);

    // Unique cities in orders
    const uniqueOrderCities = useMemo(() => {
        const set = new Set<string>();
        orders.forEach(o => {
            if (o.city && o.city.trim()) set.add(o.city.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [orders]);

    // Summary stats
    const stats = useMemo(() => {
        const totalShipped = orders.filter(o => Boolean(o.trackingNumber) || String(o.status || '').toLowerCase() === 'expedie').length;
        const readyToShip = orders.filter(o => {
            const s = String(o.status || '').toLowerCase();
            return (s === 'confirme' || s === 'confirmé') && !o.trackingNumber;
        }).length;
        const isOzonConfigured = Boolean(ozonApiKey && ozonClientId);
        const isKargoConfigured = Boolean(kargoApiKey && kargoClientId);
        const isDigylogConfigured = Boolean(digylogApiKey);
        const isAmeexConfigured = Boolean(ameexApiKey && ameexClientId);

        return {
            totalShipped,
            readyToShip,
            isOzonConfigured,
            isKargoConfigured,
            isDigylogConfigured,
            isAmeexConfigured,
            totalOrders: orders.length
        };
    }, [orders, ozonApiKey, ozonClientId, kargoApiKey, kargoClientId, digylogApiKey, ameexApiKey, ameexClientId]);

    const handleSelectAll = () => {
        if (selectedOrderIds.size === candidateOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(candidateOrders.map(o => o.id)));
        }
    };

    const handleToggleOrder = (orderId: string) => {
        const next = new Set(selectedOrderIds);
        if (next.has(orderId)) next.delete(orderId);
        else next.add(orderId);
        setSelectedOrderIds(next);
    };

    const handleExecuteDispatch = async () => {
        const selectedList = orders.filter(o => selectedOrderIds.has(o.id));
        if (selectedList.length === 0) return;

        setIsDispatching(true);
        setDispatchProgress({ current: 0, total: selectedList.length });
        setShowConfirmModal(false);

        let endpoint = '/couriers/ozon/batch-add';
        let courierName = 'Ozon Express';
        let payload: any = {};

        if (targetDispatchCourier === 'ozon_express') {
            endpoint = '/couriers/ozon/batch-add';
            courierName = 'Ozon Express';
            payload = {
                apiKey: ozonApiKey.trim(),
                clientId: ozonClientId.trim(),
                apiBaseUrl: ozonBaseUrl.trim(),
                isStock: ozonIsStock,
                allowOpenParcel: ozonAllowOpen,
                isFragile: ozonIsFragile,
                isReplace: ozonIsReplace,
                defaultNature: ozonDefaultNature.trim(),
                orders: selectedList
            };
        } else if (targetDispatchCourier === 'kargo_express') {
            endpoint = '/couriers/kargo/batch-add';
            courierName = 'Kargo Express';
            payload = {
                apiKey: kargoApiKey.trim(),
                clientId: kargoClientId.trim(),
                apiBaseUrl: kargoBaseUrl.trim(),
                isStock: kargoIsStock,
                allowOpenParcel: kargoAllowOpen,
                defaultNature: kargoDefaultNature.trim(),
                orders: selectedList
            };
        } else if (targetDispatchCourier === 'digylog') {
            endpoint = '/couriers/digylog/batch-add';
            courierName = 'DIGYLOG Express';
            payload = {
                apiKey: digylogApiKey.trim(),
                networkId: Number(digylogNetworkId) || 1,
                store: digylogStoreId.trim() || 'store1',
                sentType: Number(digylogSentType) || 1,
                port: Number(digylogPort) || 1,
                allowOpenParcel: digylogAllowOpen,
                canTry: digylogCanTry,
                checkDuplicate: digylogCheckDuplicate,
                apiBaseUrl: digylogBaseUrl.trim(),
                orders: selectedList
            };
        } else if (targetDispatchCourier === 'ameex') {
            endpoint = '/couriers/ameex/batch-add';
            courierName = 'Ameex Delivery';
            payload = {
                apiKey: ameexApiKey.trim(),
                clientId: ameexClientId.trim(),
                apiBaseUrl: ameexBaseUrl.trim(),
                orders: selectedList
            };
        }

        try {
            const res = await apiClient.apiPost<{ success: boolean; count: number; results: ParcelShipmentResult[] }>(endpoint, payload);

            if (res && Array.isArray(res.results)) {
                setDispatchResults(res.results);
                // Update local orders if onUpdateOrder provided
                if (onUpdateOrder) {
                    res.results.forEach(r => {
                        onUpdateOrder(r.orderId, {
                            status: 'expedie' as OrderStatus,
                            trackingNumber: r.trackingNumber,
                            courierName: courierName,
                            courierStatus: 'Nouveau Colis Créé',
                            shippedAt: r.timestamp
                        });
                    });
                }
                setSelectedOrderIds(new Set());
            }
        } catch (err: any) {
            alert(`Erreur lors de l'expédition (${courierName}) : ${err.message}`);
        } finally {
            setIsDispatching(false);
            setDispatchProgress(null);
        }
    };

    const handleSearchTracking = async (numberToSearch?: string) => {
        const targetNumber = (numberToSearch || trackingQuery).trim();
        if (!targetNumber) return;

        setIsSearchingTracking(true);
        setActiveTrackingData(null);

        let endpoint = '/couriers/ozon/tracking';
        let payload: any = {};

        const upper = targetNumber.toUpperCase();
        if (upper.startsWith('DL') || targetDispatchCourier === 'digylog') {
            endpoint = '/couriers/digylog/tracking';
            payload = {
                trackingNumber: targetNumber,
                apiKey: digylogApiKey.trim(),
                apiBaseUrl: digylogBaseUrl.trim()
            };
        } else if (upper.startsWith('OZE') || targetDispatchCourier === 'ozon_express') {
            endpoint = '/couriers/ozon/tracking';
            payload = {
                trackingNumber: targetNumber,
                apiKey: ozonApiKey.trim(),
                clientId: ozonClientId.trim(),
                apiBaseUrl: ozonBaseUrl.trim()
            };
        } else {
            endpoint = '/couriers/kargo/tracking';
            payload = {
                trackingNumber: targetNumber,
                apiKey: kargoApiKey.trim(),
                clientId: kargoClientId.trim(),
                apiBaseUrl: kargoBaseUrl.trim()
            };
        }

        try {
            const res = await apiClient.apiPost(endpoint, payload);
            setActiveTrackingData(res);
            setActiveTab('tracking');
        } catch (e: any) {
            alert(`Erreur de suivi : ${e.message}`);
        } finally {
            setIsSearchingTracking(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedTracking(text);
        setTimeout(() => setCopiedTracking(null), 2500);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
                                <Truck className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {t('expeditionsTitle') || 'Intégrations Transporteurs & Expéditions'}
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {storeName ? `Boutique : ${storeName} • ` : ''}
                                    Connectez <strong>Ozon Express</strong>, <strong>Kargo Express</strong>, Cathedis, Ameex et expédiez vos colis en 1 clic via API.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Badges & Primary Selector */}
                    <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transporteur Principal :</span>
                            <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700 text-xs">
                                <button
                                    onClick={() => handleSetPrimaryCourier('ozon_express')}
                                    disabled={isSettingPrimary}
                                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                        primaryCourier === 'ozon_express'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'
                                    }`}
                                >
                                    <img 
                                        src={OZON_EXPRESS_LOGO} 
                                        alt="Ozon Express" 
                                        className="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0 shadow-2xs" 
                                        referrerPolicy="no-referrer"
                                    />
                                    <span>Ozon Express</span>
                                    {primaryCourier === 'ozon_express' && <span className="text-[10px] bg-white/20 px-1 rounded">Par défaut</span>}
                                </button>
                                <button
                                    onClick={() => handleSetPrimaryCourier('kargo_express')}
                                    disabled={isSettingPrimary}
                                    className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        primaryCourier === 'kargo_express'
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
                                    }`}
                                >
                                    <span>Kargo Express</span>
                                    {primaryCourier === 'kargo_express' && <span className="text-[10px] bg-white/20 px-1 rounded">Par défaut</span>}
                                </button>
                                <button
                                    onClick={() => handleSetPrimaryCourier('digylog')}
                                    disabled={isSettingPrimary}
                                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                        primaryCourier === 'digylog'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                                    }`}
                                >
                                    <img 
                                        src={DIGYLOG_LOGO} 
                                        alt="DIGYLOG" 
                                        className="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0 shadow-2xs" 
                                        referrerPolicy="no-referrer"
                                    />
                                    <span>DIGYLOG</span>
                                    {primaryCourier === 'digylog' && <span className="text-[10px] bg-white/20 px-1 rounded">Par défaut</span>}
                                </button>
                                <button
                                    onClick={() => handleSetPrimaryCourier('ameex')}
                                    disabled={isSettingPrimary}
                                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                        primaryCourier === 'ameex'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                                    }`}
                                >
                                    <div className="w-4 h-4 rounded bg-white p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                                        <AmeexLogo className="w-full h-full" />
                                    </div>
                                    <span>Ameex</span>
                                    {primaryCourier === 'ameex' && <span className="text-[10px] bg-white/20 px-1 rounded">Par défaut</span>}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => handleSyncCourierCities(primaryCourier)}
                                disabled={isSyncingCities}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Importer et mettre à jour la liste des villes de la société de livraison"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isSyncingCities ? 'animate-spin' : ''}`} />
                                <span>Importer les Villes {primaryCourier === 'ozon_express' ? 'Ozon' : (primaryCourier === 'kargo_express' ? 'Kargo' : (primaryCourier === 'digylog' ? 'DIGYLOG' : 'Ameex'))}</span>
                            </button>

                            <button
                                onClick={() => handleNormalizeStoreOrders(primaryCourier)}
                                disabled={isNormalizingOrders}
                                className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 cursor-pointer"
                                title="Faire correspondre les villes des commandes aux noms et IDs officiels du transporteur"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>Normaliser Villes Commandes</span>
                            </button>

                            <button
                                onClick={() => handleNormalizePhones()}
                                disabled={isNormalizingPhones}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Formater tous les numéros de téléphone au format valide 06/07 exigé par les transporteurs"
                            >
                                <Phone className={`w-3.5 h-3.5 text-emerald-600 ${isNormalizingPhones ? 'animate-spin' : ''}`} />
                                <span>{isNormalizingPhones ? 'Formatage...' : 'Formater Téléphones (06/07)'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Sync / Normalization Feedback Notification */}
                    {syncFeedback && (
                        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in border ${
                            syncFeedback.success 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-2 font-semibold">
                                {syncFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                                <span>{syncFeedback.message}</span>
                            </div>
                            <button onClick={() => setSyncFeedback(null)} className="text-slate-400 hover:text-slate-600 text-[11px] font-bold">✕</button>
                        </div>
                    )}

                    {normalizeFeedback && (
                        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in border ${
                            normalizeFeedback.success 
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-2 font-semibold">
                                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                                <span>{normalizeFeedback.message}</span>
                            </div>
                            <button onClick={() => setNormalizeFeedback(null)} className="text-slate-400 hover:text-slate-600 text-[11px] font-bold">✕</button>
                        </div>
                    )}

                    {phoneNormalizeFeedback && (
                        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in border ${
                            phoneNormalizeFeedback.success 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                        }`}>
                            <div className="flex items-center gap-2 font-semibold">
                                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{phoneNormalizeFeedback.message}</span>
                            </div>
                            <button onClick={() => setPhoneNormalizeFeedback(null)} className="text-slate-400 hover:text-slate-600 text-[11px] font-bold">✕</button>
                        </div>
                    )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Prêts à expédier</div>
                        <div className="text-2xl font-bold text-purple-600 mt-1">{stats.readyToShip}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Commandes confirmées</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Colis expédiés</div>
                        <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalShipped}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Avec N° de suivi généré</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Transporteur principal</div>
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-1.5 flex items-center gap-1.5">
                            <span>{primaryCourier === 'ozon_express' ? 'Ozon Express' : (primaryCourier === 'kargo_express' ? 'Kargo Express' : 'DIGYLOG Express')}</span>
                        </div>
                        <div className="text-[11px] text-purple-500 mt-0.5">
                            {primaryCourier === 'ozon_express' ? 'api.ozonexpress.ma' : (primaryCourier === 'kargo_express' ? 'api.kargoexpress.app' : 'api.digylog.com')}
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Délai moyen livraison</div>
                        <div className="text-2xl font-bold text-indigo-600 mt-1">24h - 48h</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Toutes villes Maroc</div>
                    </div>
                </div>

                {/* Tabs navigation */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mt-6 -mb-6 pb-px overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('ship')}
                        className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'ship'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        Expédier les Colis (Push API)
                        {stats.readyToShip > 0 && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
                                {stats.readyToShip}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('configs')}
                        className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'configs'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Settings2 className="w-4 h-4" />
                        Configuration APIs Transporteurs (Ozon, Kargo, DIGYLOG & Ameex)
                        {!stats.isOzonConfigured && !stats.isKargoConfigured && !stats.isDigylogConfigured && !stats.isAmeexConfigured && (
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('tracking')}
                        className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'tracking'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <MapPin className="w-4 h-4" />
                        Suivi & Tracking Live
                    </button>

                    <button
                        onClick={() => setActiveTab('cities')}
                        className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === 'cities'
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <Building2 className="w-4 h-4" />
                        Répertoire des Villes ({cities.length})
                    </button>
                </div>
            </div>

            {/* TAB 1: EXPÉDIER LES COMMANDES (PUSH API) */}
            {activeTab === 'ship' && (
                <div className="space-y-6">
                    {/* Results of last dispatch batch */}
                    {dispatchResults && dispatchResults.length > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 animate-in fade-in">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    <span>{dispatchResults.length} Colis créés avec succès via API !</span>
                                </div>
                                <button
                                    onClick={() => setDispatchResults(null)}
                                    className="text-xs text-emerald-700 hover:underline font-semibold"
                                >
                                    Fermer
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {dispatchResults.map((res, i) => (
                                    <div
                                        key={i}
                                        className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center justify-between text-xs"
                                    >
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">{res.receiver}</div>
                                            <div className="text-[11px] text-slate-400">{res.city} • {res.price} MAD</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-1 rounded-lg">
                                            <span>{res.trackingNumber}</span>
                                            <button
                                                onClick={() => handleCopy(res.trackingNumber)}
                                                title="Copier le N° de suivi"
                                                className="text-slate-400 hover:text-purple-600"
                                            >
                                                {copiedTracking === res.trackingNumber ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Filter & Action Bar */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 flex-wrap">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[200px] max-w-md">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher par nom, tél, ville, réf..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                {/* Status filter buttons */}
                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                                    <button
                                        onClick={() => setStatusFilter('ready')}
                                        className={`px-3 py-1.5 rounded-lg transition-all ${
                                            statusFilter === 'ready'
                                                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        Prêts ({stats.readyToShip})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('shipped')}
                                        className={`px-3 py-1.5 rounded-lg transition-all ${
                                            statusFilter === 'shipped'
                                                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        Expédiés ({stats.totalShipped})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg transition-all ${
                                            statusFilter === 'all'
                                                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        Tous ({stats.totalOrders})
                                    </button>
                                </div>

                                {/* City filter */}
                                {uniqueOrderCities.length > 0 && (
                                    <select
                                        value={cityFilter}
                                        onChange={e => setCityFilter(e.target.value)}
                                        className="text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    >
                                        <option value="all">Toutes les villes ({uniqueOrderCities.length})</option>
                                        {uniqueOrderCities.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Transporteur & Dispatch Action Button */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                                    <span className="text-[11px] text-slate-500 pl-2 font-medium">Transporteur :</span>
                                    <button
                                        onClick={() => setTargetDispatchCourier('ozon_express')}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                                            targetDispatchCourier === 'ozon_express'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <img 
                                            src={OZON_EXPRESS_LOGO} 
                                            alt="Ozon" 
                                            className="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0 shadow-2xs" 
                                            referrerPolicy="no-referrer"
                                        />
                                        Ozon Express
                                    </button>
                                    <button
                                        onClick={() => setTargetDispatchCourier('kargo_express')}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                                            targetDispatchCourier === 'kargo_express'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                        Kargo Express
                                    </button>
                                    <button
                                        onClick={() => setTargetDispatchCourier('digylog')}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                                            targetDispatchCourier === 'digylog'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <img 
                                            src={DIGYLOG_LOGO} 
                                            alt="DIGYLOG" 
                                            className="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0 shadow-2xs" 
                                            referrerPolicy="no-referrer"
                                        />
                                        DIGYLOG Express
                                    </button>
                                    <button
                                        onClick={() => setTargetDispatchCourier('ameex')}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                                            targetDispatchCourier === 'ameex'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <div className="w-4 h-4 rounded bg-white p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                                            <AmeexLogo className="w-full h-full" />
                                        </div>
                                        Ameex Delivery
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowConfirmModal(true)}
                                    disabled={selectedOrderIds.size === 0 || isDispatching}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all ${
                                        selectedOrderIds.size > 0 && !isDispatching
                                            ? targetDispatchCourier === 'ozon_express'
                                                ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer hover:shadow-md'
                                                : targetDispatchCourier === 'kargo_express'
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer hover:shadow-md'
                                                    : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer hover:shadow-md'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    <Send className="w-4 h-4" />
                                    <span>
                                        Transmettre à {targetDispatchCourier === 'ozon_express' ? 'Ozon Express' : (targetDispatchCourier === 'kargo_express' ? 'Kargo Express' : (targetDispatchCourier === 'digylog' ? 'DIGYLOG Express' : 'Ameex Delivery'))} ({selectedOrderIds.size})
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Quick Selection Toolbar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={handleSelectAll}
                                    className="font-medium text-purple-600 hover:underline flex items-center gap-1.5 cursor-pointer"
                                >
                                    {selectedOrderIds.size === candidateOrders.length && candidateOrders.length > 0 ? (
                                        <>
                                            <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                                            Tout désélectionner
                                        </>
                                    ) : (
                                        <>
                                            <Square className="w-3.5 h-3.5 text-slate-400" />
                                            Tout sélectionner ({candidateOrders.length})
                                        </>
                                    )}
                                </button>
                                <span>•</span>
                                <span>{selectedOrderIds.size} commande(s) cochée(s)</span>

                                <button
                                    onClick={() => handleNormalizePhones(selectedOrderIds.size > 0 ? Array.from(selectedOrderIds) : undefined)}
                                    disabled={isNormalizingPhones}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 font-bold cursor-pointer transition-all text-[11px]"
                                    title="Convertir les numéros de téléphone au format 06/07"
                                >
                                    <Phone className={`w-3 h-3 text-emerald-600 ${isNormalizingPhones ? 'animate-spin' : ''}`} />
                                    <span>{isNormalizingPhones ? 'Formatage...' : (selectedOrderIds.size > 0 ? `Formater Tél Sélection (${selectedOrderIds.size}) en 06/07` : 'Formater Tous les Tél en 06/07')}</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-3 text-slate-400">
                                <span>Passerelle active : <strong className="text-slate-700 dark:text-slate-200">{targetDispatchCourier === 'ozon_express' ? 'Ozon Express (POST /add-parcel)' : (targetDispatchCourier === 'kargo_express' ? 'Kargo Express (API)' : 'DIGYLOG Express (POST /orders/standard)')}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                                        <th className="p-3.5 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={candidateOrders.length > 0 && selectedOrderIds.size === candidateOrders.length}
                                                onChange={handleSelectAll}
                                                className="rounded text-purple-600"
                                            />
                                        </th>
                                        <th className="p-3.5">Réf Commande</th>
                                        <th className="p-3.5">Client & Contact</th>
                                        <th className="p-3.5">Ville & Adresse</th>
                                        <th className="p-3.5">Produit & Qté</th>
                                        <th className="p-3.5">Montant CRBT</th>
                                        <th className="p-3.5">Statut Actuel</th>
                                        <th className="p-3.5">Transporteur & Tracking</th>
                                        <th className="p-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {candidateOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-400">
                                                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                Aucune commande correspondante aux critères de filtrage.
                                            </td>
                                        </tr>
                                    ) : (
                                        candidateOrders.map(order => {
                                            const isSelected = selectedOrderIds.has(order.id);
                                            const hasTracking = Boolean(order.trackingNumber);

                                            return (
                                                <tr
                                                    key={order.id}
                                                    className={`hover:bg-purple-50/40 dark:hover:bg-slate-800/40 transition-colors ${
                                                        isSelected ? 'bg-purple-50/60 dark:bg-purple-950/20' : ''
                                                    }`}
                                                >
                                                    <td className="p-3.5 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleOrder(order.id)}
                                                            className="rounded text-purple-600"
                                                        />
                                                    </td>
                                                    <td className="p-3.5 font-mono font-medium text-slate-900 dark:text-slate-200">
                                                        #{order.id}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-semibold text-slate-900 dark:text-white">
                                                            {order.customerName}
                                                        </div>
                                                        <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                                                            <Phone className="w-3 h-3 text-slate-400" />
                                                            {order.phone}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-medium text-slate-800 dark:text-slate-300 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                                                            {order.city || 'Non spécifiée'}
                                                        </div>
                                                        <div className="text-slate-400 text-[11px] truncate max-w-[180px]">
                                                            {order.address || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                                                            {order.product}
                                                        </div>
                                                        <div className="text-slate-400 text-[11px]">
                                                            Qté : {order.quantity || 1} {order.variant ? `(${order.variant})` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                                                        {order.price} MAD
                                                    </td>
                                                    <td className="p-3.5">
                                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                                            String(order.status).toLowerCase().includes('confir')
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                : String(order.status).toLowerCase().includes('expid') || String(order.status).toLowerCase().includes('exped')
                                                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        {hasTracking ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5 font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-md w-fit">
                                                                    <span>{order.trackingNumber}</span>
                                                                    <button
                                                                        onClick={() => handleCopy(order.trackingNumber!)}
                                                                        title="Copier le N° de suivi"
                                                                        className="text-slate-400 hover:text-purple-600"
                                                                    >
                                                                        {copiedTracking === order.trackingNumber ? (
                                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                                        ) : (
                                                                            <Copy className="w-3 h-3" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {order.courierName || 'Ozon Express'}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Non expédié</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {hasTracking ? (
                                                                <button
                                                                    onClick={() => handleSearchTracking(order.trackingNumber)}
                                                                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                                                    title="Voir le suivi en direct"
                                                                >
                                                                    <MapPin className="w-3.5 h-3.5 text-purple-600" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedOrderIds(new Set([order.id]));
                                                                        setShowConfirmModal(true);
                                                                    }}
                                                                    className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 font-semibold cursor-pointer"
                                                                >
                                                                    Expédier
                                                                </button>
                                                            )}
                                                            {onSelectOrder && (
                                                                <button
                                                                    onClick={() => onSelectOrder(order)}
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                                                    title="Détail commande"
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
                </div>
            )}

            {/* TAB 2: CONFIGURATION APIS TRANSPORTEURS */}
            {activeTab === 'configs' && (
                <div className="space-y-6">
                    {/* View mode toggle */}
                    <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setConfigViewMode('grid')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                                    configViewMode === 'grid'
                                        ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                }`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span>Format Cartes (Delivery Companies)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfigViewMode('detailed')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                                    configViewMode === 'detailed'
                                        ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                }`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Vue Formulaire Avancée & Documentation</span>
                            </button>
                        </div>
                    </div>

                    {configViewMode === 'grid' ? (
                        <DeliveryCompaniesView
                            courierConfigs={courierConfigs}
                            primaryCourier={primaryCourier}
                            onSetPrimaryCourier={handleSetPrimaryCourier}
                            onReloadConfigs={loadCourierConfigs}
                            orders={orders}
                            onOpenShippingTab={() => setActiveTab('ship')}
                            onSyncCourierCities={handleSyncCourierCities}
                        />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Carrier selection sidebar */}
                    <div className="space-y-3">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3">
                                Sociétés de Livraison (Maroc)
                            </h3>
                            <div className="space-y-2">
                                {/* Ozon Express */}
                                <button
                                    onClick={() => setSelectedCourier('ozon_express')}
                                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                                        selectedCourier === 'ozon_express'
                                            ? 'bg-purple-50 dark:bg-purple-950/50 border-2 border-purple-600 text-purple-900 dark:text-purple-200 shadow-xs'
                                            : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                                            <img
                                                src={OZON_EXPRESS_LOGO}
                                                alt="Ozon Express"
                                                className="w-full h-full object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs flex items-center gap-1.5">
                                                Ozon Express
                                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200 font-bold">
                                                    Nouveau
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-400">api.ozonexpress.ma</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        stats.isOzonConfigured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {stats.isOzonConfigured ? 'Actif' : 'À configurer'}
                                    </span>
                                </button>

                                {/* Kargo Express */}
                                <button
                                    onClick={() => setSelectedCourier('kargo_express')}
                                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                                        selectedCourier === 'kargo_express'
                                            ? 'bg-blue-50 dark:bg-blue-950/50 border-2 border-blue-600 text-blue-900 dark:text-blue-200 shadow-xs'
                                            : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                                            KG
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs">Kargo Express</div>
                                            <div className="text-[11px] text-slate-400">api.kargoexpress.app</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        stats.isKargoConfigured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {stats.isKargoConfigured ? 'Actif' : 'Supporté'}
                                    </span>
                                </button>

                                {/* DIGYLOG Express */}
                                <button
                                    onClick={() => setSelectedCourier('digylog')}
                                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                                        selectedCourier === 'digylog'
                                            ? 'bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-600 text-amber-900 dark:text-amber-200 shadow-xs'
                                            : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center shrink-0">
                                            <img
                                                src={DIGYLOG_LOGO}
                                                alt="DIGYLOG"
                                                className="w-full h-full object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs">DIGYLOG Express</div>
                                            <div className="text-[11px] text-slate-400">api.digylog.com</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        stats.isDigylogConfigured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {stats.isDigylogConfigured ? 'Actif' : 'Supporté'}
                                    </span>
                                </button>

                                {/* Cathedis */}
                                <button
                                    onClick={() => setSelectedCourier('cathedis')}
                                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                                        selectedCourier === 'cathedis'
                                            ? 'bg-red-50 dark:bg-red-950/50 border-2 border-red-600 text-red-900 dark:text-red-200'
                                            : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-red-600 text-white font-bold flex items-center justify-center text-xs">
                                            CAT
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs">Cathedis Express</div>
                                            <div className="text-[11px] text-slate-400">api.cathedis.net</div>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500">
                                        Supporté
                                    </span>
                                </button>

                                {/* Ameex */}
                                <button
                                    onClick={() => setSelectedCourier('ameex')}
                                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                                        selectedCourier === 'ameex'
                                            ? 'bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-600 text-amber-900 dark:text-amber-200'
                                            : 'border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white p-1 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                                            <AmeexLogo className="w-full h-full" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-xs">Ameex Delivery</div>
                                            <div className="text-[11px] text-slate-400">api.ameex.app</div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        stats.isAmeexConfigured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {stats.isAmeexConfigured ? 'Actif' : 'Supporté'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Info help box */}
                        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 text-xs text-purple-900 dark:text-purple-300 space-y-2">
                            <div className="font-bold flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                Synchronisation Cloud & API
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                Vos identifiants <strong>Ozon Express</strong>, <strong>Kargo Express</strong> et <strong>DIGYLOG Express</strong> sont enregistrés de façon permanente dans votre base de données Google Cloud SQL.
                            </p>
                        </div>
                    </div>

                    {/* Main Config Form & Interactive Doc */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* OZON EXPRESS FORM */}
                        {selectedCourier === 'ozon_express' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white p-1.5 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                                            <img
                                                src={OZON_EXPRESS_LOGO}
                                                alt="Ozon Express"
                                                className="w-full h-full object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-base text-slate-900 dark:text-white">
                                                Configuration API Ozon Express
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Intégration directe avec <code className="font-mono text-purple-600">https://api.ozonexpress.ma</code>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleTestOzonConnection}
                                            disabled={isTestingOzon}
                                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isTestingOzon ? 'animate-spin' : ''}`} />
                                            Tester la connexion
                                        </button>
                                        <button
                                            onClick={handleSaveOzonConfig}
                                            disabled={isSavingOzon}
                                            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                        >
                                            {ozonSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {ozonSaveSuccess ? 'Enregistré !' : 'Sauvegarder'}
                                        </button>
                                    </div>
                                </div>

                                {/* Test Result Alert */}
                                {ozonTestResult && (
                                    <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                                        ozonTestResult.success
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                    }`}>
                                        {ozonTestResult.success ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <div className="font-bold">
                                                {ozonTestResult.success ? 'Succès de l\'intégration Ozon Express' : 'Échec de connexion'}
                                            </div>
                                            <div>{ozonTestResult.message}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Credentials Form */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Identifiant Client &#123;YOUR_ID&#125; *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 5120 ou OZN-CUSTOMER-ID"
                                            value={ozonClientId}
                                            onChange={e => setOzonClientId(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Votre ID client fourni par Ozon Express
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Clé Secrète API &#123;YOUR_API_KEY&#125; *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showOzonApiKey ? "text" : "password"}
                                                placeholder="Ex: ozn_sec_9918a7c2b3d..."
                                                value={ozonApiKey}
                                                onChange={e => setOzonApiKey(e.target.value)}
                                                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowOzonApiKey(!showOzonApiKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showOzonApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Générée depuis votre compte Ozon Express &gt; Paramètres API
                                        </p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Endpoint API Base URL
                                        </label>
                                        <input
                                            type="text"
                                            value={ozonBaseUrl}
                                            onChange={e => setOzonBaseUrl(e.target.value)}
                                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Default Shipment Settings for Ozon */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <h4 className="font-bold text-xs text-slate-900 dark:text-white mb-3">
                                        Options d'expédition Ozon Express (Mapping Form-Data)
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        {/* parcel-stock */}
                                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                                            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                <span>Type de Colis</span>
                                                <input
                                                    type="checkbox"
                                                    checked={ozonIsStock}
                                                    onChange={e => setOzonIsStock(e.target.checked)}
                                                    className="rounded text-purple-600"
                                                />
                                            </label>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {ozonIsStock ? 'Stock (1)' : 'Ramassage (0)'}
                                            </div>
                                        </div>

                                        {/* parcel-open */}
                                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                                            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                <span>Ouvrir Colis</span>
                                                <input
                                                    type="checkbox"
                                                    checked={ozonAllowOpen}
                                                    onChange={e => setOzonAllowOpen(e.target.checked)}
                                                    className="rounded text-purple-600"
                                                />
                                            </label>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {ozonAllowOpen ? 'Autoriser ouverture (1)' : 'Ne pas ouvrir (2)'}
                                            </div>
                                        </div>

                                        {/* parcel-fragile */}
                                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                                            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                <span>Colis Fragile</span>
                                                <input
                                                    type="checkbox"
                                                    checked={ozonIsFragile}
                                                    onChange={e => setOzonIsFragile(e.target.checked)}
                                                    className="rounded text-purple-600"
                                                />
                                            </label>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {ozonIsFragile ? 'Oui (1) - Fragile' : 'Non (0)'}
                                            </div>
                                        </div>

                                        {/* parcel-replace */}
                                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                                            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                <span>Échange / Rempl.</span>
                                                <input
                                                    type="checkbox"
                                                    checked={ozonIsReplace}
                                                    onChange={e => setOzonIsReplace(e.target.checked)}
                                                    className="rounded text-purple-600"
                                                />
                                            </label>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {ozonIsReplace ? 'Oui (1) - Remplacement' : 'Non (0)'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Default nature */}
                                    <div className="mt-3">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Nature du Colis par défaut (<code>parcel-nature</code>)
                                        </label>
                                        <input
                                            type="text"
                                            value={ozonDefaultNature}
                                            onChange={e => setOzonDefaultNature(e.target.value)}
                                            className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                        />
                                    </div>
                                </div>

                                {/* Embedded Interactive Ozon Express API Documentation */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                        <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <Code2 className="w-4 h-4 text-purple-600" />
                                            Documentation API Ozon Express (Référence Fournie)
                                        </h4>
                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[11px] flex-wrap">
                                            <button
                                                onClick={() => setOzonDocTab('add_parcel')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ozonDocTab === 'add_parcel' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                1. Ajouter Nouveau Colis
                                            </button>
                                            <button
                                                onClick={() => setOzonDocTab('parcel_info')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ozonDocTab === 'parcel_info' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                2. Infos du Colis
                                            </button>
                                            <button
                                                onClick={() => setOzonDocTab('tracking')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ozonDocTab === 'tracking' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                3. Tracking Colis
                                            </button>
                                            <button
                                                onClick={() => setOzonDocTab('cities')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ozonDocTab === 'cities' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                4. Liste des Villes
                                            </button>
                                        </div>
                                    </div>

                                    {/* Code preview block */}
                                    <div className="bg-[#181824] text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
                                        {ozonDocTab === 'add_parcel' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#ff79c6] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#ff79c6]/20 text-[#ff79c6]">POST</span>
                                                    <span>https://api.ozonexpress.ma/customers/&#123;YOUR_ID&#125;/&#123;YOUR_API_KEY&#125;/add-parcel</span>
                                                </div>
                                                <pre className="text-[#50fa7b] leading-relaxed text-[11px]">
{`Paramètres (form-data) :
• tracking-number (optionnel) - Numéro de suivi personnalisé
• parcel-receiver (requis)    - Nom complet du destinataire
• parcel-phone    (requis)    - Téléphone du destinataire
• parcel-city     (requis)    - ID de la ville
• parcel-address  (requis)    - Adresse complète
• parcel-note     (optionnel) - Instructions spéciales
• parcel-price    (requis)    - Prix du colis en MAD
• parcel-nature   (optionnel) - Description du contenu
• parcel-stock    (requis)    - 1 = stock, 0 = ramassage
• parcel-open     (optionnel) - 1 = Ouvrir le colis, 2 = Ne pas ouvrir (default = 1)
• parcel-fragile  (optionnel) - 1 = Oui, 0 = Non (default = 0)
• parcel-replace  (optionnel) - 1 = Oui, 0 = Non (default = 0)
• products        (optionnel) - Format JSON : [{"ref": "PROD1", "qnty": 1}]

Exemple de Réponse JSON :
{
  "TRACKING-NUMBER": "OZE982147320",
  "RECEIVER": "Mohammed Alami",
  "PHONE": "0612345678",
  "CITY_ID": "1",
  "CITY_NAME": "Casablanca",
  "ADDRESS": "123 Rue Hassan II",
  "PRICE": "250",
  "DELIVERED-PRICE": "25",
  "RETURNED-PRICE": "15",
  "REFUSED-PRICE": "15"
}`}
                                                </pre>
                                            </div>
                                        )}

                                        {ozonDocTab === 'parcel_info' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#8be9fd] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#8be9fd]/20 text-[#8be9fd]">POST</span>
                                                    <span>https://api.ozonexpress.ma/customers/&#123;YOUR_ID&#125;/&#123;YOUR_API_KEY&#125;/parcel-info</span>
                                                </div>
                                                <pre className="text-[#8be9fd] leading-relaxed text-[11px]">
{`Paramètres (form-data) :
• tracking-number (requis) - Numéro de suivi Ozon Express

Exemple de réponse retournée :
{
  "TRACKING-NUMBER": "OZE982147320",
  "STATUS": "En cours de distribution",
  "PRICE": "250",
  "FEES": "25",
  "RECEIVER": "Mohammed Alami",
  "PHONE": "0612345678",
  "CITY": "Casablanca"
}`}
                                                </pre>
                                            </div>
                                        )}

                                        {ozonDocTab === 'tracking' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#ffb86c] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#ffb86c]/20 text-[#ffb86c]">POST</span>
                                                    <span>https://api.ozonexpress.ma/customers/&#123;YOUR_ID&#125;/&#123;YOUR_API_KEY&#125;/tracking</span>
                                                </div>
                                                <pre className="text-[#ffb86c] leading-relaxed text-[11px]">
{`Suivi Unique (form-data) :
• tracking-number : OZE982147320

Suivi Multiple (JSON Body) :
{
  "tracking-number": [
    "OZE982147320",
    "OZE982147321",
    "OZE982147322"
  ]
}`}
                                                </pre>
                                            </div>
                                        )}

                                        {ozonDocTab === 'cities' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#50fa7b] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#50fa7b]/20 text-[#50fa7b]">GET</span>
                                                    <span>https://api.ozonexpress.ma/cities</span>
                                                </div>
                                                <pre className="text-[#f1fa8c] leading-relaxed text-[11px]">
{`Retourne la liste officielle des IDs et Noms de villes Ozon Express.`}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* KARGO EXPRESS FORM */}
                        {selectedCourier === 'kargo_express' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center">
                                            KG
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-base text-slate-900 dark:text-white">
                                                Configuration API Kargo Express
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Intégration directe avec <code className="font-mono text-blue-600">api.kargoexpress.app</code>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleTestKargoConnection}
                                            disabled={isTestingKargo}
                                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isTestingKargo ? 'animate-spin' : ''}`} />
                                            Tester la connexion
                                        </button>
                                        <button
                                            onClick={handleSaveKargoConfig}
                                            disabled={isSavingKargo}
                                            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                        >
                                            {kargoSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {kargoSaveSuccess ? 'Enregistré !' : 'Sauvegarder'}
                                        </button>
                                    </div>
                                </div>

                                {/* Test Result Alert */}
                                {kargoTestResult && (
                                    <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                                        kargoTestResult.success
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                    }`}>
                                        {kargoTestResult.success ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <div className="font-bold">
                                                {kargoTestResult.success ? 'Succès du test API' : 'Échec de connexion'}
                                            </div>
                                            <div>{kargoTestResult.message}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Credentials Form */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            CLIENT_ID (Votre Identifiant Kargo) *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 14820 ou Goldenknot"
                                            value={kargoClientId}
                                            onChange={e => setKargoClientId(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            API_KEY (Votre Clé Secrète) *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showKargoApiKey ? "text" : "password"}
                                                placeholder="Ex: kg_sec_a87f19b2c3d4e5f6..."
                                                value={kargoApiKey}
                                                onChange={e => setKargoApiKey(e.target.value)}
                                                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKargoApiKey(!showKargoApiKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showKargoApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Endpoint API Base URL
                                        </label>
                                        <input
                                            type="text"
                                            value={kargoBaseUrl}
                                            onChange={e => setKargoBaseUrl(e.target.value)}
                                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DIGYLOG EXPRESS FORM */}
                        {selectedCourier === 'digylog' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white p-1.5 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                                            <img
                                                src={DIGYLOG_LOGO}
                                                alt="DIGYLOG Express"
                                                className="w-full h-full object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                                                Configuration API DIGYLOG Express
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono">
                                                    Api DigyLog v2.5
                                                </span>
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Intégration directe avec <code className="font-mono text-amber-600">https://api.digylog.com/api/v2/seller</code>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleTestDigylogConnection}
                                            disabled={isTestingDigylog}
                                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isTestingDigylog ? 'animate-spin' : ''}`} />
                                            Tester la connexion
                                        </button>
                                        <button
                                            onClick={handleSaveDigylogConfig}
                                            disabled={isSavingDigylog}
                                            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                        >
                                            {digylogSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {digylogSaveSuccess ? 'Enregistré !' : 'Sauvegarder'}
                                        </button>
                                    </div>
                                </div>

                                {/* Test Result Alert */}
                                {digylogTestResult && (
                                    <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                                        digylogTestResult.success
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                    }`}>
                                        {digylogTestResult.success ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <div className="font-bold">
                                                {digylogTestResult.success ? 'Succès de l\'intégration DIGYLOG Express' : 'Échec de connexion DIGYLOG'}
                                            </div>
                                            <div>{digylogTestResult.message}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Credentials Form */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Token d'Autorisation Bearer (Bearer Token) *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showDigylogApiKey ? "text" : "password"}
                                                placeholder="Ex: eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs... ou votre Bearer Token de collectionApi Seller V3"
                                                value={digylogApiKey}
                                                onChange={e => setDigylogApiKey(e.target.value)}
                                                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowDigylogApiKey(!showDigylogApiKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showDigylogApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Transmis dans le header HTTP : <code className="text-amber-600">Authorization: Bearer &lt;Token&gt;</code>
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Network ID (Réseau) *
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="1"
                                            value={digylogNetworkId}
                                            onChange={e => setDigylogNetworkId(Number(e.target.value) || 1)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Identifiant réseau obtenu depuis l'endpoint <code className="text-amber-600">/networks</code>
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Store ID ou Nom de la Boutique *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="store1"
                                            value={digylogStoreId}
                                            onChange={e => setDigylogStoreId(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Nom ou ID de la boutique obtenu depuis l'endpoint <code className="text-amber-600">/stores</code>
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Comportement d'envoi (sentType) *
                                        </label>
                                        <select
                                            value={digylogSentType}
                                            onChange={e => setDigylogSentType(Number(e.target.value))}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value={1}>1 - Envoyer au service de livraison (Recommandé)</option>
                                            <option value={2}>2 - Envoyer au centre d'appel</option>
                                            <option value={0}>0 - Ne pas envoyer (Création enregistrée uniquement)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Frais de port payés par (port) *
                                        </label>
                                        <select
                                            value={digylogPort}
                                            onChange={e => setDigylogPort(Number(e.target.value))}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value={1}>1 - Client (Paiement à la livraison)</option>
                                            <option value={2}>2 - Vendeur (Frais offerts)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Type d'expédition DIGYLOG
                                        </label>
                                        <select
                                            value={digylogOrderType}
                                            onChange={e => setDigylogOrderType(e.target.value as any)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="standard">Standard (/orders/standard)</option>
                                            <option value="stock">Stock (/orders/stock - Centre Logistique)</option>
                                        </select>
                                    </div>

                                    {digylogOrderType === 'stock' && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Centre Logistique Fulfillment Center (fc) *
                                            </label>
                                            <select
                                                value={digylogFulfillmentCenter}
                                                onChange={e => setDigylogFulfillmentCenter(Number(e.target.value))}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            >
                                                <option value={4}>4 - Casablanca Hub</option>
                                                <option value={6}>6 - Agadir Hub</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Options de livraison DIGYLOG
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={digylogAllowOpen}
                                                    onChange={e => setDigylogAllowOpen(e.target.checked)}
                                                    className="rounded text-amber-600 focus:ring-amber-500"
                                                />
                                                <span>Ouvrir le colis (openproduct: 1)</span>
                                            </label>

                                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={digylogCanTry && digylogAllowOpen}
                                                    disabled={!digylogAllowOpen}
                                                    onChange={e => setDigylogCanTry(e.target.checked)}
                                                    className="rounded text-amber-600 focus:ring-amber-500 disabled:opacity-40"
                                                />
                                                <span>Essayer le produit (cantry: 1)</span>
                                            </label>

                                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={digylogCheckDuplicate}
                                                    onChange={e => setDigylogCheckDuplicate(e.target.checked)}
                                                    className="rounded text-amber-600 focus:ring-amber-500"
                                                />
                                                <span>Bloquer les doublons (checkDuplicate: 1)</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Endpoint API Base URL
                                        </label>
                                        <input
                                            type="text"
                                            value={digylogBaseUrl}
                                            onChange={e => setDigylogBaseUrl(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                                        />
                                    </div>
                                </div>

                                {/* Interactive Documentation Api DigyLog v2.5 */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                                <Code2 className="w-4 h-4 text-amber-600" />
                                                Documentation Interactive API DIGYLOG v2.5
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                Spécifications des endpoints et formats JSON transmis par la plateforme CallNet
                                            </p>
                                        </div>

                                        {/* Doc Tabs */}
                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
                                            <button
                                                type="button"
                                                onClick={() => setDigylogDocTab('standard')}
                                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                                    digylogDocTab === 'standard' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                }`}
                                            >
                                                1. Standard (/orders/standard)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDigylogDocTab('stock')}
                                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                                    digylogDocTab === 'stock' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                }`}
                                            >
                                                2. Stock (/orders/stock)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDigylogDocTab('cities')}
                                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                                    digylogDocTab === 'cities' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                }`}
                                            >
                                                3. Villes (/cities)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDigylogDocTab('statuses')}
                                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                                    digylogDocTab === 'statuses' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                }`}
                                            >
                                                4. Statuts (/statuses)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Code preview block */}
                                    <div className="bg-[#181824] text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
                                        {digylogDocTab === 'standard' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#ffb86c] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#ffb86c]/20 text-[#ffb86c]">POST</span>
                                                    <span>https://api.digylog.com/api/v2/seller/orders/standard</span>
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    Headers requis :
                                                    <div className="text-slate-300 ml-2 font-mono">
                                                        Authorization: Bearer &lt;Token&gt;<br />
                                                        Referer: https://apiseller.digylog.com<br />
                                                        Content-Type: application/json<br />
                                                        Accept: application/json
                                                    </div>
                                                </div>
                                                <pre className="text-[#50fa7b] leading-relaxed text-[11px]">
{`Exemple de Payload JSON :
{
    "network": ${digylogNetworkId}, // Get from /networks
    "store": "${digylogStoreId}", // name or id Get from /stores
    "sentType": ${digylogSentType}, // 0 not send orders, 1 send to delivery service , 2 send to call center
    "checkDuplicate": ${digylogCheckDuplicate ? 1 : 0}, // block if another order with the same num exists
    "orders": [
        {
            "num": "WP808208863DL",
            "name": "Bilal",
            "phone": "0608278001",
            "address": "Skoura ouarzazate",
            "city": "Agadir", // name or id
            "price": 200,
            "openproduct": ${digylogAllowOpen ? 1 : 0}, // allow open product,
            "cantry": ${digylogCanTry && digylogAllowOpen ? 1 : 0}, // allow open try product set only if openproduct=1,
            "port": ${digylogPort}, // shipping cost paid by — 1: Customer, 2: Seller.
            "note": "Colis fragile, vérifier avec le client",
            "refs": [
                {
                    "ref": "REF-ROSE-01",
                    "designation": "وردة الحب الأبدية تحت قبة زجاجية هدية رومانسية",
                    "quantity": 1
                }
            ]
        }
    ]
}`}
                                                </pre>
                                            </div>
                                        )}

                                        {digylogDocTab === 'stock' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#8be9fd] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#8be9fd]/20 text-[#8be9fd]">POST</span>
                                                    <span>https://api.digylog.com/api/v2/seller/orders/stock</span>
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    Headers requis :
                                                    <div className="text-slate-300 ml-2 font-mono">
                                                        Authorization: Bearer &lt;Token&gt;<br />
                                                        Referer: https://apiseller.digylog.com<br />
                                                        Content-Type: application/json<br />
                                                        Accept: application/json
                                                    </div>
                                                </div>
                                                <pre className="text-[#8be9fd] leading-relaxed text-[11px]">
{`Exemple de Payload JSON :
{
    "fc": ${digylogFulfillmentCenter}, // required 4 for casa, 6 for agadir get from /fcs
    "store": "${digylogStoreId}", // name or id Get from /stores
    "sentType": ${digylogSentType}, // 0 not send orders, 1 send to delivery service , 2 send to call center
    "checkDuplicate": ${digylogCheckDuplicate ? 1 : 0}, // block if another order with the same num exists
    "orders": [
        {
            "num": "WP808208863DL",
            "name": "Bilal",
            "phone": "0608278001",
            "address": "Skoura ouarzazate",
            "city": "Agadir", // name or id
            "price": 200,
            "openproduct": ${digylogAllowOpen ? 1 : 0}, // allow customer to open product,
            "cantry": ${digylogCanTry && digylogAllowOpen ? 1 : 0}, // allow open try product set only if openproduct=1,
            "note": "",
            "refs": [
                {
                    "ref": "6FCD7A", // required
                    "designation": "ABDO2026",
                    "quantity": 1
                }
            ]
        }
    ]
}`}
                                                </pre>
                                            </div>
                                        )}

                                        {digylogDocTab === 'cities' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#50fa7b] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#50fa7b]/20 text-[#50fa7b]">GET</span>
                                                    <span>https://api.digylog.com/api/v2/seller/cities</span>
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    Headers requis :
                                                    <div className="text-slate-300 ml-2 font-mono">
                                                        Authorization: Bearer &lt;Token&gt;<br />
                                                        Referer: https://apiseller.digylog.com<br />
                                                        Accept: application/json
                                                    </div>
                                                </div>
                                                <pre className="text-[#f1fa8c] leading-relaxed text-[11px]">
{`Exemple de réponse retournée :
[
    { "id": 1, "name": "Casablanca", "code": "CAS" },
    { "id": 2, "name": "Rabat", "code": "RAB" },
    { "id": 3, "name": "Marrakech", "code": "RAK" },
    { "id": 4, "name": "Tanger", "code": "TNG" },
    { "id": 5, "name": "Agadir", "code": "AGA" }
]`}
                                                </pre>
                                            </div>
                                        )}

                                        {digylogDocTab === 'statuses' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#ff79c6] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#ff79c6]/20 text-[#ff79c6]">GET</span>
                                                    <span>https://api.digylog.com/api/v2/seller/statuses</span>
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    Headers requis :
                                                    <div className="text-slate-300 ml-2 font-mono">
                                                        Authorization: Bearer &lt;Token&gt;<br />
                                                        Referer: https://apiseller.digylog.com<br />
                                                        Accept: application/json
                                                    </div>
                                                </div>
                                                <pre className="text-[#ff79c6] leading-relaxed text-[11px]">
{`Exemple de statuts retournés :
[
    { "id": 1, "name": "Nouveau", "code": "NEW" },
    { "id": 2, "name": "En cours d'acheminement", "code": "IN_TRANSIT" },
    { "id": 3, "name": "Expédié", "code": "DISPATCHED" },
    { "id": 4, "name": "En cours de distribution", "code": "OUT_FOR_DELIVERY" },
    { "id": 5, "name": "Livré & Encaissé (COD)", "code": "DELIVERED" },
    { "id": 6, "name": "Reporté", "code": "POSTPONED" },
    { "id": 7, "name": "Refusé", "code": "REFUSED" },
    { "id": 8, "name": "Annulé", "code": "CANCELLED" }
]`}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {selectedCourier === 'cathedis' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Cathedis Express Connect
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Connectez votre compte client Cathedis avec vos identifiants d'accès Web API.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Code Client Cathedis</label>
                                        <input
                                            type="text"
                                            value={cathedisClientId}
                                            onChange={e => setCathedisClientId(e.target.value)}
                                            placeholder="Ex: CAT-9812"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Token API</label>
                                        <input
                                            type="password"
                                            value={cathedisApiKey}
                                            onChange={e => setCathedisApiKey(e.target.value)}
                                            placeholder="Ex: cath_live_xxx..."
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* AMEEX DELIVERY FORM */}
                        {selectedCourier === 'ameex' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white p-1.5 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                                            <AmeexLogo className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                                                Configuration API Ameex Delivery
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-mono">
                                                    REST API v1
                                                </span>
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Intégration directe avec <code className="font-mono text-amber-600">https://api.ameex.app/customer</code>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={handleSyncAmeexCities}
                                            disabled={isSyncingAmeexCities}
                                            title="Télécharger la liste officielle des villes et hubs Ameex"
                                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer"
                                        >
                                            <Download className={`w-3.5 h-3.5 ${isSyncingAmeexCities ? 'animate-bounce' : ''}`} />
                                            <span>{ameexCitiesCount ? `${ameexCitiesCount} Villes` : 'Sync Villes'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleTestAmeexConnection}
                                            disabled={isTestingAmeex}
                                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isTestingAmeex ? 'animate-spin' : ''}`} />
                                            Tester la connexion
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveAmeexConfig}
                                            disabled={isSavingAmeex}
                                            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                                        >
                                            {ameexSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            {ameexSaveSuccess ? 'Enregistré !' : 'Sauvegarder'}
                                        </button>
                                    </div>
                                </div>

                                {/* Test Result Alert */}
                                {ameexTestResult && (
                                    <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                                        ameexTestResult.success
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                                    }`}>
                                        {ameexTestResult.success ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        )}
                                        <div>
                                            <div className="font-bold">
                                                {ameexTestResult.success ? 'Succès de l\'intégration Ameex Delivery' : 'Échec du test Ameex'}
                                            </div>
                                            <div>{ameexTestResult.message}</div>
                                            {ameexTestResult.isSandbox && (
                                                <div className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                                    Mode Sandbox actif (préfixe clé test_)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Credentials Form */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Identifiant Client Ameex (En-tête <code>C-Api-Id</code>) *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: AMX-4421 ou votre ID client"
                                            value={ameexClientId}
                                            onChange={e => setAmeexClientId(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Votre ID client fourni par Ameex Delivery
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Clé API Ameex (En-tête <code>C-Api-Key</code>) *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showAmeexApiKey ? "text" : "password"}
                                                placeholder="Ex: test_xxx... ou clé live de production"
                                                value={ameexApiKey}
                                                onChange={e => setAmeexApiKey(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono pr-10 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAmeexApiKey(!showAmeexApiKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showAmeexApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Avec une clé <code>test_</code>, l'API répond depuis le sandbox. Passez la clé live en production.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            URL API Base
                                        </label>
                                        <input
                                            type="text"
                                            value={ameexBaseUrl}
                                            onChange={e => setAmeexBaseUrl(e.target.value)}
                                            placeholder="https://api.ameex.app/customer"
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Clé Secrète Webhook (HMAC-SHA256)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showAmeexWebhookSecret ? "text" : "password"}
                                                placeholder="Ex: amx_webhook_secret_..."
                                                value={ameexWebhookSecret}
                                                onChange={e => setAmeexWebhookSecret(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono pr-10 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAmeexWebhookSecret(!showAmeexWebhookSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                {showAmeexWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Vérifie automatiquement la signature <code>X-Ameex-Signature</code> envoyée par Ameex.
                                        </p>
                                    </div>

                                    <div className="md:col-span-2 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                URL Webhook Ameex (À configurer dans votre dashboard Ameex) :
                                            </div>
                                            <code className="text-[11px] font-mono text-amber-700 dark:text-amber-300 break-all">
                                                {window.location.origin}/api/webhooks/ameex
                                            </code>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/ameex`);
                                                alert('URL Webhook Ameex copiée dans le presse-papier !');
                                            }}
                                            className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copier URL
                                        </button>
                                    </div>
                                </div>

                                {/* Embedded Interactive Ameex API Documentation */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                        <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <Code2 className="w-4 h-4 text-amber-600" />
                                            Documentation Officielle Ameex Delivery
                                        </h4>
                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[11px] flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setAmeexDocTab('add_parcel')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ameexDocTab === 'add_parcel' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                1. Créer un colis
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAmeexDocTab('tracking')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ameexDocTab === 'tracking' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                2. Suivi de colis
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAmeexDocTab('cities')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ameexDocTab === 'cities' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                3. Villes & Statuts
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAmeexDocTab('webhook')}
                                                className={`px-2.5 py-1 rounded transition-all font-semibold cursor-pointer ${
                                                    ameexDocTab === 'webhook' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-xs' : 'text-slate-500'
                                                }`}
                                            >
                                                4. Webhook sécurisé
                                            </button>
                                        </div>
                                    </div>

                                    {/* Code preview block */}
                                    <div className="bg-[#181824] text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
                                        {ameexDocTab === 'add_parcel' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#ff79c6] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#ff79c6]/20 text-[#ff79c6]">POST</span>
                                                    <span>https://api.ameex.app/customer/Delivery/Parcels/Action/Type/Add</span>
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    En-têtes HTTP requis :
                                                    <div className="text-slate-300 ml-2 font-mono">
                                                        C-Api-Id: {ameexClientId || '&lt;votre_id&gt;'}<br />
                                                        C-Api-Key: {ameexApiKey ? ameexApiKey.substring(0, 10) + '...' : '&lt;votre_cle_api&gt;'}<br />
                                                        Content-Type: application/json
                                                    </div>
                                                </div>
                                                <pre className="text-[#50fa7b] leading-relaxed text-[11px]">
{`Exemple de Payload JSON envoyé :
{
    "type": "SIMPLE",         // Requis : toujours SIMPLE
    "receiver": "Fatima Zahra",// Requis : Nom complet du destinataire
    "phone": "0612345678",     // Requis : Téléphone (9 chiffres min.)
    "city": 1,                 // Requis : ID de la ville (obtenu via Delivery/Cities)
    "cod": 350,                // Requis : Montant à encaisser en MAD (COD)
    "address": "Bd d'Anfa, Résidence Al Manar", // Adresse de livraison
    "product": "Robe Caftan Soie",              // Produit(s)
    "comment": "Appeler avant la livraison",     // Instructions
    "order_num": "CMD-8839"                     // N° de commande interne CallNet
}`}
                                                </pre>
                                            </div>
                                        )}

                                        {ameexDocTab === 'tracking' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#8be9fd] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#8be9fd]/20 text-[#8be9fd]">GET</span>
                                                    <span>https://api.ameex.app/customer/Delivery/Parcels/Tracking/ParcelCode/&#123;code&#125;</span>
                                                </div>
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#50fa7b] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#50fa7b]/20 text-[#50fa7b]">POST</span>
                                                    <span>https://api.ameex.app/customer/Delivery/Parcels/MassTracking</span>
                                                </div>
                                                <div className="text-slate-400 text-[11px]">
                                                    MassTracking (Jusqu'à 100 codes colis séparés par des virgules) :
                                                </div>
                                                <pre className="text-[#8be9fd] leading-relaxed text-[11px]">
{`Payload POST :
{
    "codes": "AMX100234,AMX100235,AMX100236"
}

Réponse retournée :
[
    {
        "code": "AMX100234",
        "status": "LIVRÉ",
        "statut_id": 4,
        "date": "2026-09-07 14:30:00",
        "history": [...]
    }
]`}
                                                </pre>
                                            </div>
                                        )}

                                        {ameexDocTab === 'cities' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#50fa7b] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#50fa7b]/20 text-[#50fa7b]">GET</span>
                                                    <span>https://api.ameex.app/customer/Delivery/Cities</span>
                                                </div>
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#f1fa8c] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#f1fa8c]/20 text-[#f1fa8c]">GET</span>
                                                    <span>https://api.ameex.app/customer/Delivery/Parcels/Statuts</span>
                                                </div>
                                                <pre className="text-[#f1fa8c] leading-relaxed text-[11px]">
{`Exemple de villes retournées (/Delivery/Cities) :
[
    { "id": 1, "name": "Casablanca", "ref": "CAS" },
    { "id": 2, "name": "Rabat", "ref": "RAB" },
    { "id": 3, "name": "Marrakech", "ref": "RAK" },
    { "id": 4, "name": "Tanger", "ref": "TNG" },
    { "id": 5, "name": "Fès", "ref": "FEZ" },
    { "id": 6, "name": "Agadir", "ref": "AGA" }
]`}
                                                </pre>
                                            </div>
                                        )}

                                        {ameexDocTab === 'webhook' && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-[#ff79c6] font-bold">
                                                    <span className="px-2 py-0.5 rounded bg-[#ff79c6]/20 text-[#ff79c6]">WEBHOOK</span>
                                                    <span>POST /api/webhooks/ameex</span>
                                                </div>
                                                <p className="text-slate-400 text-[11px]">
                                                    CallNet vérifie l'en-tête de signature HMAC-SHA256 <code>X-Ameex-Signature</code> avec votre clé secrète configurée.
                                                </p>
                                                <pre className="text-[#50fa7b] leading-relaxed text-[11px]">
{`Exemple d'événement Webhook reçu en temps réel :
{
    "event": "parcel.status_changed",
    "parcel_code": "AMX991204",
    "order_num": "CMD-8839",
    "new_status": "LIVRÉ",
    "timestamp": "2026-09-07T16:20:00Z"
}`}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                    )}
                </div>
            )}

            {/* TAB 3: SUIVI & TRACKING LIVE */}
            {activeTab === 'tracking' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                    {/* Search Bar */}
                    <div className="max-w-xl mx-auto text-center space-y-3">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Suivi des Colis en Temps Réel
                        </h2>
                        <p className="text-xs text-slate-500">
                            Saisissez un numéro de suivi <strong>Ozon Express (OZE...)</strong> ou <strong>Kargo Express (KG...)</strong> pour interroger l'API et visualiser les étapes.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Ex: OZE982147320, KG829104, CMD-1049..."
                                    value={trackingQuery}
                                    onChange={e => setTrackingQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearchTracking()}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <button
                                onClick={() => handleSearchTracking()}
                                disabled={isSearchingTracking || !trackingQuery.trim()}
                                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSearchingTracking ? 'animate-spin' : ''}`} />
                                Suivre
                            </button>
                        </div>
                    </div>

                    {/* Tracking Results View */}
                    {activeTrackingData && (
                        <div className="max-w-2xl mx-auto bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                                <div>
                                    <div className="text-xs text-slate-500 font-mono">
                                        N° de Suivi {activeTrackingData.courier || 'Transporteur'}
                                    </div>
                                    <div className="text-xl font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                                        {activeTrackingData.trackingNumber}
                                        <button onClick={() => handleCopy(activeTrackingData.trackingNumber)} className="text-slate-400 hover:text-purple-600 cursor-pointer">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                        {activeTrackingData.currentStatus}
                                    </span>
                                </div>
                            </div>

                            {activeTrackingData.order && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div>
                                        <div className="text-slate-400">Destinataire</div>
                                        <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{activeTrackingData.order.customerName}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400">Téléphone</div>
                                        <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{activeTrackingData.order.phone}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400">Ville</div>
                                        <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{activeTrackingData.order.city}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400">Montant COD</div>
                                        <div className="font-bold text-emerald-600 mt-0.5">{activeTrackingData.order.price} MAD</div>
                                    </div>
                                </div>
                            )}

                            {/* Timeline steps */}
                            <div className="space-y-4 pt-2">
                                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                    Historique des étapes de livraison
                                </h4>
                                <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                                    {activeTrackingData.history?.map((step: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-4 relative">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                                step.done 
                                                    ? 'bg-emerald-500 text-white shadow-xs' 
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                            }`}>
                                                {step.done ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-900 dark:text-white">{step.status}</span>
                                                    <span className="text-[11px] text-slate-400 font-mono">{step.date}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                    {step.location}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: VILLES & HUBS DE LIVRAISON */}
            {activeTab === 'cities' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Top control header */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            Répertoire Officiel des Villes & Zones de Livraison
                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono">
                                                {cities.length} villes
                                            </span>
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Consultez la liste des villes desservies avec leurs <strong>identifiants officiels</strong> requis par l'API Ozon Express (<code className="font-mono text-purple-600 dark:text-purple-400">parcel-city</code>).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Provider selector */}
                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => loadCities('ozon')}
                                        className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                                            cityProvider === 'ozon'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <img
                                            src={OZON_EXPRESS_LOGO}
                                            alt="Ozon"
                                            className="w-3.5 h-3.5 rounded object-contain bg-white p-0.5 shrink-0"
                                            referrerPolicy="no-referrer"
                                        />
                                        <span>Ozon Express</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => loadCities('kargo')}
                                        className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                                            cityProvider === 'kargo'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        Kargo Express
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => loadCities('digylog')}
                                        className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 ${
                                            cityProvider === 'digylog'
                                                ? 'bg-amber-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        <img
                                            src={DIGYLOG_LOGO}
                                            alt="DIGYLOG"
                                            className="w-3.5 h-3.5 rounded object-contain bg-white p-0.5 shrink-0"
                                            referrerPolicy="no-referrer"
                                        />
                                        <span>DIGYLOG</span>
                                    </button>
                                </div>

                                {/* Live Sync button */}
                                <button
                                    type="button"
                                    onClick={() => handleSyncCourierCities(cityProvider === 'ozon' ? 'ozon_express' : (cityProvider === 'kargo' ? 'kargo_express' : 'digylog'))}
                                    disabled={isSyncingCities}
                                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCities ? 'animate-spin' : ''}`} />
                                    {isSyncingCities ? 'Synchronisation...' : `Actualiser API ${cityProvider === 'ozon' ? 'Ozon' : (cityProvider === 'kargo' ? 'Kargo' : 'DIGYLOG')}`}
                                </button>

                                {/* Normalize Cities button */}
                                <button
                                    type="button"
                                    onClick={() => handleNormalizeStoreOrders(cityProvider === 'ozon' ? 'ozon_express' : (cityProvider === 'kargo' ? 'kargo_express' : 'digylog'))}
                                    disabled={isNormalizingOrders}
                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                    {isNormalizingOrders ? 'Normalisation...' : 'Normaliser Villes'}
                                </button>

                                {/* Normalize Phone numbers to 06/07 button */}
                                <button
                                    type="button"
                                    onClick={() => handleNormalizePhones()}
                                    disabled={isNormalizingPhones}
                                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                                    title="Formater tous les numéros en 06/07 pour les sociétés de livraison"
                                >
                                    <Phone className={`w-3.5 h-3.5 text-white ${isNormalizingPhones ? 'animate-spin' : ''}`} />
                                    {isNormalizingPhones ? 'Formatage...' : 'Formater Téléphones (06/07)'}
                                </button>
                            </div>
                        </div>

                        {/* Feedback messages */}
                        {syncFeedback && (
                            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                                syncFeedback.success 
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}>
                                {syncFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                                <span>{syncFeedback.message}</span>
                            </div>
                        )}

                        {normalizeFeedback && (
                            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                                normalizeFeedback.success 
                                ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}>
                                {normalizeFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                                <span>{normalizeFeedback.message}</span>
                            </div>
                        )}

                        {phoneNormalizeFeedback && (
                            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                                phoneNormalizeFeedback.success 
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}>
                                {phoneNormalizeFeedback.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                                <span>{phoneNormalizeFeedback.message}</span>
                            </div>
                        )}

                        {/* Search & Stats bar */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                            <div className="md:col-span-2 relative">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher une ville, un code (ex: Casablanca, RAK, ID 1)..."
                                    value={citySearch}
                                    onChange={e => setCitySearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                                />
                                {citySearch && (
                                    <button
                                        type="button"
                                        onClick={() => setCitySearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                                    >
                                        Effacer
                                    </button>
                                )}
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-xs text-slate-500">Livraison Express 24h</span>
                                <span className="text-xs font-bold text-emerald-600 font-mono">
                                    {cities.filter(c => Number(c.id) <= 30).length} hubs
                                </span>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-xs text-slate-500">Couverture Nationale</span>
                                <span className="text-xs font-bold text-purple-600 font-mono">100% Maroc</span>
                            </div>
                        </div>
                    </div>

                    {/* Cities Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {cities
                            .filter(c => {
                                if (!citySearch.trim()) return true;
                                const q = citySearch.toLowerCase().trim();
                                return (
                                    c.name.toLowerCase().includes(q) ||
                                    String(c.id).includes(q) ||
                                    (c.code && c.code.toLowerCase().includes(q)) ||
                                    (c.aliases && c.aliases.some(a => a.toLowerCase().includes(q)))
                                );
                            })
                            .map(city => {
                                const matchingOrdersCount = orders.filter(o => 
                                    o.cityId === String(city.id) || 
                                    (o.city && o.city.toLowerCase() === city.name.toLowerCase())
                                ).length;

                                return (
                                    <div
                                        key={city.id}
                                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-700 transition-all shadow-xs flex flex-col justify-between gap-3 group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 ${
                                                    cityProvider === 'ozon'
                                                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                                                        : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                                                }`}>
                                                    {city.code || city.id}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                                                        {city.name}
                                                    </div>
                                                    {city.aliases && city.aliases.length > 0 && (
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                                            {city.aliases.slice(0, 2).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleCopy(String(city.id))}
                                                title="Copier l'identifiant API"
                                                className="p-1 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 cursor-pointer"
                                            >
                                                {copiedTracking === String(city.id) ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                            <div className="flex items-center gap-1 font-mono text-purple-600 dark:text-purple-400 font-bold">
                                                <span>ID API :</span>
                                                <span className="bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded">
                                                    {city.id}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {matchingOrdersCount > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                                                        {matchingOrdersCount} cmd
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[10px]">
                                                    {Number(city.id) <= 30 ? '24h' : '48h'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* CONFIRMATION DISPATCH MODAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-5">
                        <div className="flex items-start gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                                targetDispatchCourier === 'ozon_express'
                                    ? 'bg-white p-1 border border-purple-200 dark:border-purple-800 shadow-xs'
                                    : targetDispatchCourier === 'ameex'
                                        ? 'bg-white p-1 border border-amber-200 dark:border-amber-800 shadow-xs'
                                        : targetDispatchCourier === 'digylog'
                                            ? 'bg-white p-1 border border-slate-200 dark:border-slate-800 shadow-xs'
                                            : 'bg-blue-600/10 text-blue-600'
                            }`}>
                                {targetDispatchCourier === 'ozon_express' ? (
                                    <img
                                        src={OZON_EXPRESS_LOGO}
                                        alt="Ozon Express"
                                        className="w-full h-full object-contain"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : targetDispatchCourier === 'ameex' ? (
                                    <AmeexLogo className="w-full h-full object-contain" />
                                ) : targetDispatchCourier === 'digylog' ? (
                                    <img
                                        src={DIGYLOG_LOGO}
                                        alt="DIGYLOG"
                                        className="w-full h-full object-contain"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                                    Confirmer l'expédition vers {targetDispatchCourier === 'ozon_express' ? 'Ozon Express API' : (targetDispatchCourier === 'kargo_express' ? 'Kargo Express API' : (targetDispatchCourier === 'digylog' ? 'DIGYLOG Express API' : 'Ameex Delivery API'))}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Vous êtes sur le point de transmettre <strong>{selectedOrderIds.size} commande(s)</strong> à la plateforme de livraison.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs space-y-2 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Transporteur cible :</span>
                                <strong className={targetDispatchCourier === 'ozon_express' ? 'text-purple-600' : (targetDispatchCourier === 'ameex' ? 'text-amber-600' : 'text-blue-600')}>
                                    {targetDispatchCourier === 'ozon_express' ? 'Ozon Express (Maroc)' : (targetDispatchCourier === 'kargo_express' ? 'Kargo Express (Maroc)' : (targetDispatchCourier === 'digylog' ? 'DIGYLOG Express (Maroc)' : 'Ameex Delivery (Maroc)'))}
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Type de colis (parcel-stock) :</span>
                                <span>{targetDispatchCourier === 'ozon_express' ? (ozonIsStock ? 'Stock (1)' : 'Ramassage (0)') : (kargoIsStock ? 'Stock (1)' : 'Ramassage (0)')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Autoriser ouverture (parcel-open) :</span>
                                <span>{targetDispatchCourier === 'ozon_express' ? (ozonAllowOpen ? 'Oui (1)' : 'Non (2)') : (kargoAllowOpen ? 'Oui' : 'Non')}</span>
                            </div>
                            {targetDispatchCourier === 'ozon_express' && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Colis fragile (parcel-fragile) :</span>
                                        <span>{ozonIsFragile ? 'Oui (1)' : 'Non (0)'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Échange / Remplacement (parcel-replace) :</span>
                                        <span>{ozonIsReplace ? 'Oui (1)' : 'Non (0)'}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500">Total CRBT cumulé :</span>
                                <strong className="text-emerald-600 font-bold">
                                    {orders
                                        .filter(o => selectedOrderIds.has(o.id))
                                        .reduce((sum, o) => sum + Number(o.price || 0), 0)}{' '}
                                    MAD
                                </strong>
                            </div>
                        </div>

                        {((targetDispatchCourier === 'ozon_express' && !stats.isOzonConfigured) ||
                          (targetDispatchCourier === 'kargo_express' && !stats.isKargoConfigured) ||
                          (targetDispatchCourier === 'digylog' && !stats.isDigylogConfigured) ||
                          (targetDispatchCourier === 'ameex' && !stats.isAmeexConfigured)) && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Mode simulation :</strong> Clé API non renseignée. Des numéros de suivi valides ({targetDispatchCourier === 'ozon_express' ? 'OZE...' : (targetDispatchCourier === 'ameex' ? 'AMX...' : 'KG...')}) seront générés automatiquement pour vous permettre de tester tout le cycle.
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteDispatch}
                                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer ${
                                    targetDispatchCourier === 'ozon_express'
                                        ? 'bg-purple-600 hover:bg-purple-700'
                                        : targetDispatchCourier === 'ameex'
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                <Send className="w-4 h-4" />
                                Confirmer et Envoyer ({selectedOrderIds.size})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpeditionsView;
