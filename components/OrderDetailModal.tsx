import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, Role, Product, CourierProvider } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { SmsIcon } from './icons/SmsIcon';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from './StatusBadge';
import { apiClient } from '../lib/apiClient';
import { getWhatsAppUrl, formatCallOrSmsPhone } from '../utils';
import { CourierCitySelect } from './CourierCitySelect';
import { COURIER_LABELS, getCourierCities } from '../lib/courierCities';
import { 
    Package, 
    ExternalLink, 
    MessageSquareQuote, 
    TrendingUp, 
    Globe, 
    Copy, 
    Check, 
    MessageSquare,
    Truck,
    Trash2,
    RefreshCw,
    X,
    User,
    Calendar,
    DollarSign,
    CheckCircle2,
    PhoneCall
} from 'lucide-react';

const detectOrderCourier = (orderData: Order, fallback: CourierProvider): CourierProvider => {
    const courierStr = (orderData.courierName || '').toLowerCase();
    if (courierStr.includes('ozon')) return 'ozon_express';
    if (courierStr.includes('kargo')) return 'kargo_express';
    if (courierStr.includes('digylog') || courierStr.includes('digi')) return 'digylog';
    if (courierStr.includes('cathedis')) return 'cathedis';
    if (courierStr.includes('ameex')) return 'ameex';
    if (courierStr.includes('irsaliyat')) return 'irsaliyat';
    if (courierStr.includes('ecotrack') || courierStr.includes('sendit')) return 'ecotrack';
    return fallback;
};

interface OrderDetailModalProps {
    order: Order;
    products?: Product[];
    primaryCourier?: CourierProvider;
    onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
    onDeleteOrder: (orderId: string) => void;
    onClose: () => void;
    onOpenChat?: (order: Order) => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ 
    order, 
    products = [], 
    primaryCourier = 'ozon_express',
    onUpdateOrder, 
    onDeleteOrder, 
    onClose,
    onOpenChat
}) => {
    const { t } = useLanguage();
    const { currentUser, users } = useAuth();
    const [formData, setFormData] = useState<Order>({ ...order });
    const [hasChanges, setHasChanges] = useState(false);
    const [syncingSheet, setSyncingSheet] = useState(false);
    const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);
    const [copiedPitch, setCopiedPitch] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    const clientOwner = useMemo(() => users.find(u => u.id === order.clientId), [users, order.clientId]);
    const defaultCourierForOrder = clientOwner?.primaryCourier || currentUser?.primaryCourier || primaryCourier || 'ozon_express';
    const [selectedCourierRef, setSelectedCourierRef] = useState<CourierProvider>(() => detectOrderCourier(order, defaultCourierForOrder));

    useEffect(() => {
        setFormData({ ...order });
        setSelectedCourierRef(detectOrderCourier(order, defaultCourierForOrder));
        setHasChanges(false);
        setSyncFeedback(null);
        setSelectedProductId(null);
    }, [order, defaultCourierForOrder]);

    // Match product from catalogue based on order product name, SKU or client products
    const matchedProduct = useMemo(() => {
        if (!products || products.length === 0) return null;

        if (selectedProductId) {
            const found = products.find(p => p.id === selectedProductId);
            if (found) return found;
        }

        const orderProdName = String(formData.product || '').toLowerCase().trim();
        if (!orderProdName) return products[0] || null;

        // 1. Exact or partial match by name or SKU
        const exactMatch = products.find(p => {
            const pName = p.name.toLowerCase().trim();
            const pSku = (p.sku || '').toLowerCase().trim();
            return pName === orderProdName || (pSku && pSku === orderProdName);
        });
        if (exactMatch) return exactMatch;

        // 2. Substring match
        const substringMatch = products.find(p => {
            const pName = p.name.toLowerCase();
            return pName.includes(orderProdName) || orderProdName.includes(pName);
        });
        if (substringMatch) return substringMatch;

        // 3. Fallback to client's first product
        const clientProduct = products.find(p => p.clientId === order.clientId);
        if (clientProduct) return clientProduct;

        return products[0] || null;
    }, [products, formData.product, selectedProductId, order.clientId]);

    const handleCopyPitch = (pitchText: string) => {
        navigator.clipboard.writeText(pitchText);
        setCopiedPitch(true);
        setTimeout(() => setCopiedPitch(false), 2000);
    };

    const handleCopyPhone = () => {
        if (!formData.phone) return;
        navigator.clipboard.writeText(String(formData.phone));
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
    };

    const handleApplyProductInfo = (p: Product) => {
        setFormData(prev => ({
            ...prev,
            product: p.name,
            price: p.price
        }));
        setHasChanges(true);
    };

    const handleQuickStatusChange = (newStatus: OrderStatus) => {
        setFormData(prev => ({
            ...prev,
            status: newStatus
        }));
        setHasChanges(true);
    };

    const handleTestSyncSheet = async () => {
        setSyncingSheet(true);
        setSyncFeedback(null);
        try {
            const res = await apiClient.apiPost<any>(`/orders/${order.id}/sync-sheet`, formData);
            if (res && res.success === true) {
                setSyncFeedback({
                    success: true,
                    message: res.message || 'Ligne mise à jour avec succès dans Google Sheet !'
                });
            } else {
                setSyncFeedback({
                    success: false,
                    message: res?.message || res?.error || 'Échec de la synchronisation vers Google Sheet.'
                });
            }
        } catch (err: any) {
            setSyncFeedback({
                success: false,
                message: err.message || 'Erreur lors du test de synchronisation.'
            });
        } finally {
            setSyncingSheet(false);
        }
    };

    const storeName = useMemo(() => {
        if (currentUser?.role === Role.Admin || currentUser?.role === Role.Agent) {
            const owner = users.find(u => u.id === order.clientId);
            return owner ? owner.name : null;
        }
        return null;
    }, [order.clientId, users, currentUser]);

    const handleCityChange = (cityName: string, cityId: string | number) => {
        setFormData(prev => ({
            ...prev,
            city: cityName,
            cityId: String(cityId || ''),
            courierName: prev.courierName || COURIER_LABELS[selectedCourierRef]
        }));
        setHasChanges(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
        setHasChanges(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdateOrder(order.id, formData);
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm(t('deleteOrderConfirm'))) {
            onDeleteOrder(String(order.id));
            onClose();
        }
    };

    const inputStyles = "w-full p-3 text-xs sm:text-sm border border-base-300 rounded-xl bg-base-100 focus:outline-none focus:border-accent transition-all text-text-primary placeholder:text-text-secondary/50";
    const labelStyles = "block text-xs font-semibold text-text-secondary mb-1.5";

    // Operator quick status options
    const quickStatuses = [
        { status: OrderStatus.Confirme, label: 'Confirmé', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' },
        { status: OrderStatus.PasDeRep1, label: 'Pas de réponse 1', color: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20' },
        { status: OrderStatus.Injoignable1, label: 'Injoignable', color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20' },
        { status: OrderStatus.Reporter, label: 'Reporté', color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20' },
        { status: OrderStatus.Annule, label: 'Annulé', color: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20' },
    ];

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex justify-center items-center p-3 sm:p-5 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-base-200 border border-base-300 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 font-montserrat">
                
                {/* Clean Header */}
                <div className="p-4 sm:p-5 border-b border-base-300 flex justify-between items-center bg-base-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0"></div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="font-bold text-base sm:text-lg text-text-primary truncate">
                                    {t('orderDetails')}
                                </h2>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-base-300/80 text-text-secondary font-mono">
                                    #{order.id}
                                </span>
                                {storeName && (
                                    <span className="text-[10px] text-text-secondary bg-base-200 border border-base-300 px-2 py-0.5 rounded-full hidden sm:inline-block">
                                        Client: {storeName}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={formData.status} />
                        <button 
                            type="button"
                            onClick={onClose} 
                            aria-label="Fermer"
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-base-300 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-5">
                    <form id="order-form" onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* 1. OPERATOR QUICK-ACTION TOOLBAR */}
                        <div className="bg-base-100 p-4 rounded-xl border border-base-300 space-y-3 shadow-xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary uppercase tracking-wide">
                                    <PhoneCall className="w-3.5 h-3.5 text-accent" />
                                    <span>Confirmation Opérateur</span>
                                </div>
                                <span className="text-[11px] text-text-secondary">
                                    Mise à jour rapide en 1 clic
                                </span>
                            </div>

                            {/* 1-Click Quick Status Pills */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                {quickStatuses.map(({ status, label, color }) => {
                                    const isSelected = formData.status === status;
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => handleQuickStatusChange(status)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                                isSelected 
                                                    ? `${color} ring-2 ring-accent shadow-xs scale-[1.02]` 
                                                    : 'bg-base-200/70 border-base-300 text-text-secondary hover:bg-base-300/60'
                                            }`}
                                        >
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                                            <span>{label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Full Status Dropdown for specialized statuses */}
                            <div className="pt-1 flex items-center gap-3">
                                <label className="text-xs font-semibold text-text-secondary whitespace-nowrap">
                                    Tous les statuts :
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="flex-1 p-2 text-xs font-semibold border border-base-300 rounded-xl bg-base-200 focus:outline-none focus:border-accent text-text-primary cursor-pointer"
                                >
                                    {Object.values(OrderStatus).map(status => (
                                        <option key={status} value={status}>{t(status as OrderStatus)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 2. CUSTOMER & DELIVERY INFORMATION */}
                        <div className="bg-base-100 p-4 sm:p-5 rounded-xl border border-base-300 space-y-4 shadow-xs">
                            <div className="flex items-center gap-2 border-b border-base-300 pb-2.5 text-xs font-bold text-accent uppercase tracking-wider">
                                <User className="w-4 h-4" />
                                <span>{t('customerInfo')} & Livraison</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Nom du Client */}
                                <div>
                                    <label className={labelStyles}>{t('customerNameLabel')} *</label>
                                    <input 
                                        type="text" 
                                        name="customerName" 
                                        value={formData.customerName} 
                                        onChange={handleChange} 
                                        required 
                                        className={inputStyles} 
                                        placeholder="Nom et prénom du client"
                                    />
                                </div>

                                {/* Numéro de Téléphone + Operator Direct Actions */}
                                <div>
                                    <label className={labelStyles}>{t('phoneLabel')} *</label>
                                    <input 
                                        type="tel" 
                                        name="phone" 
                                        value={formData.phone} 
                                        onChange={handleChange} 
                                        required 
                                        className={`${inputStyles} font-mono font-medium`} 
                                        placeholder="Ex: 0612345678"
                                    />

                                    {/* DEDICATED OPERATOR CONTACT BUTTONS (NO OVERLAP) */}
                                    <div className="flex flex-wrap items-center gap-2 pt-2">
                                        <a 
                                            href={`tel:${formatCallOrSmsPhone(formData.phone)}`} 
                                            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl hover:bg-emerald-500/20 active:scale-95 transition-all"
                                            title={`Appeler ${formData.phone}`}
                                        >
                                            <PhoneIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span>{t('call')}</span>
                                        </a>

                                        <a 
                                            href={getWhatsAppUrl(formData)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl hover:bg-emerald-500/20 active:scale-95 transition-all"
                                            title="Contacter sur WhatsApp"
                                        >
                                            <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span>WhatsApp</span>
                                        </a>

                                        <a 
                                            href={`sms:${formatCallOrSmsPhone(formData.phone)}`} 
                                            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/30 px-3 py-2 rounded-xl hover:bg-sky-500/20 active:scale-95 transition-all"
                                            title={`SMS ${formData.phone}`}
                                        >
                                            <SmsIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span>SMS</span>
                                        </a>

                                        <button
                                            type="button"
                                            onClick={handleCopyPhone}
                                            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-text-secondary bg-base-200 border border-base-300 px-2.5 py-2 rounded-xl hover:text-text-primary hover:bg-base-300 active:scale-95 transition-all"
                                            title="Copier le numéro"
                                        >
                                            {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copiedPhone ? 'Copié !' : 'Copier'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Ville de livraison (référencée sur la société de livraison configurée ou par défaut) */}
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                                        <label className={labelStyles}>
                                            {t('cityLabel')} <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <span className="text-text-secondary text-[11px] font-medium hidden sm:inline">Réf. Transporteur :</span>
                                            <select
                                                value={selectedCourierRef}
                                                onChange={(e) => {
                                                    const newCourier = e.target.value as CourierProvider;
                                                    setSelectedCourierRef(newCourier);
                                                    setHasChanges(true);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        courierName: COURIER_LABELS[newCourier] || newCourier
                                                    }));
                                                }}
                                                className="bg-base-200 text-accent font-bold text-xs px-2.5 py-1 rounded-lg border border-base-300 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                                                title="Société de livraison pour la nomenclature officielle des villes"
                                            >
                                                <option value="ozon_express">Ozon Express ({getCourierCities('ozon_express').length} villes)</option>
                                                <option value="kargo_express">Kargo Express ({getCourierCities('kargo_express').length} villes)</option>
                                                <option value="digylog">DIGYLOG ({getCourierCities('digylog').length} villes)</option>
                                                <option value="cathedis">Cathedis ({getCourierCities('cathedis').length} hubs)</option>
                                                <option value="ameex">Ameex ({getCourierCities('ameex').length} zones)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <CourierCitySelect 
                                        value={formData.city || ''}
                                        cityId={formData.cityId}
                                        onChange={handleCityChange}
                                        courierProvider={selectedCourierRef}
                                        placeholder={`Rechercher parmi les villes ${COURIER_LABELS[selectedCourierRef]}...`}
                                        allowProviderSwitch={false}
                                    />
                                </div>

                                {/* Quartier / District */}
                                <div>
                                    <label className={labelStyles}>{t('districtLabel') || 'Quartier / Secteur'}</label>
                                    <input 
                                        type="text" 
                                        name="district" 
                                        value={formData.district || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ex: Maarif, Agdal, Gueliz..." 
                                        className={inputStyles} 
                                    />
                                </div>

                                {/* Adresse Complète */}
                                <div className="md:col-span-2">
                                    <label className={labelStyles}>{t('addressLabel')} *</label>
                                    <textarea 
                                        name="address" 
                                        rows={2} 
                                        value={formData.address} 
                                        onChange={handleChange} 
                                        className={`${inputStyles} resize-none`} 
                                        placeholder="Rue, numéro, indications de livraison..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. ORDER ITEMS & PRICING */}
                        <div className="bg-base-100 p-4 sm:p-5 rounded-xl border border-base-300 space-y-4 shadow-xs">
                            <div className="flex items-center gap-2 border-b border-base-300 pb-2.5 text-xs font-bold text-accent uppercase tracking-wider">
                                <Package className="w-4 h-4" />
                                <span>{t('orderInfo')} & Tarification</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="sm:col-span-2">
                                    <label className={labelStyles}>{t('productLabel')}</label>
                                    <input 
                                        type="text" 
                                        name="product" 
                                        value={formData.product} 
                                        onChange={handleChange} 
                                        className={inputStyles} 
                                    />
                                </div>

                                <div>
                                    <label className={labelStyles}>{t('variantLabel')}</label>
                                    <input 
                                        type="text" 
                                        name="variant" 
                                        value={formData.variant || ''} 
                                        onChange={handleChange} 
                                        className={inputStyles} 
                                        placeholder="Ex: Noir / XL" 
                                    />
                                </div>

                                <div>
                                    <label className={labelStyles}>{t('quantityLabel')}</label>
                                    <input 
                                        type="number" 
                                        name="quantity" 
                                        value={formData.quantity} 
                                        onChange={handleChange} 
                                        min="1" 
                                        className={inputStyles} 
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelStyles}>{t('dateLabel')}</label>
                                    <div className="relative flex items-center">
                                        <Calendar className="w-4 h-4 absolute left-3 text-text-secondary pointer-events-none" />
                                        <input 
                                            type="date" 
                                            name="date" 
                                            value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''} 
                                            onChange={handleChange} 
                                            className={`${inputStyles} pl-9`} 
                                        />
                                    </div>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelStyles}>{t('priceLabel')}</label>
                                    <div className="relative flex items-center">
                                        <DollarSign className="w-4 h-4 absolute left-3 text-accent pointer-events-none" />
                                        <input 
                                            type="number" 
                                            name="price" 
                                            value={formData.price} 
                                            onChange={handleChange} 
                                            className={`${inputStyles} pl-9 pr-14 font-bold text-accent text-base`} 
                                        />
                                        <span className="absolute right-3 text-xs font-bold text-text-secondary">MAD</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. PRODUCT SHEET & OPERATOR PITCH SCRIPT */}
                        {matchedProduct && (
                            <div className="bg-base-100 p-4 sm:p-5 rounded-xl border border-accent/30 space-y-4 shadow-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-base-300 pb-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Package className="w-4 h-4 text-accent" />
                                        <span className="font-bold text-accent text-xs uppercase tracking-wider">
                                            Script d'appel & Argumentaire de Vente
                                        </span>
                                        {matchedProduct.sku && (
                                            <span className="text-[10px] text-text-secondary bg-base-200 px-2 py-0.5 rounded-full border border-base-300">
                                                SKU: {matchedProduct.sku}
                                            </span>
                                        )}
                                    </div>

                                    {products.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-text-secondary">Catalogue :</span>
                                            <select
                                                value={matchedProduct.id}
                                                onChange={(e) => {
                                                    setSelectedProductId(e.target.value);
                                                    const p = products.find(prod => prod.id === e.target.value);
                                                    if (p) handleApplyProductInfo(p);
                                                }}
                                                className="text-xs p-1.5 bg-base-200 border border-base-300 rounded-lg text-text-primary focus:outline-none focus:border-accent"
                                            >
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.price} MAD)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                    {/* Product Thumbnail */}
                                    <div className="flex flex-row md:flex-col items-center gap-3 bg-base-200/50 p-3 rounded-xl border border-base-300">
                                        {matchedProduct.imageUrl ? (
                                            <div className="w-20 h-20 md:w-full md:h-28 rounded-lg overflow-hidden border border-base-300 bg-base-300 shrink-0">
                                                <img 
                                                    src={matchedProduct.imageUrl} 
                                                    alt={matchedProduct.name} 
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&auto=format&fit=crop&q=60';
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-20 h-20 md:w-full md:h-28 bg-base-300 rounded-lg flex flex-col items-center justify-center text-text-secondary text-xs">
                                                <Package className="w-6 h-6 mb-1" />
                                                <span>Sans Image</span>
                                            </div>
                                        )}

                                        <div className="flex-1 w-full space-y-1">
                                            <div className="text-xs font-bold text-text-primary truncate">
                                                {matchedProduct.name}
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-extrabold text-accent">
                                                    {matchedProduct.price} MAD
                                                </span>
                                                {matchedProduct.regularPrice && (
                                                    <span className="text-xs text-text-secondary line-through">
                                                        {matchedProduct.regularPrice} MAD
                                                    </span>
                                                )}
                                            </div>
                                            {matchedProduct.productUrl && (
                                                <a
                                                    href={matchedProduct.productUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-accent/10 border border-accent/30 hover:bg-accent/20 text-accent rounded-lg text-xs font-semibold transition-colors mt-1 w-full"
                                                >
                                                    <Globe className="w-3.5 h-3.5" />
                                                    <span>Voir boutique</span>
                                                    <ExternalLink className="w-3 h-3 ml-0.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Operator Pitch Script */}
                                    <div className="md:col-span-2 space-y-3">
                                        <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-bold text-xs">
                                                    <MessageSquareQuote className="w-4 h-4" />
                                                    <span>Script d'appel opérateur :</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyPitch(matchedProduct.confirmationPitch || "Vérifiez l'adresse de livraison complète, précisez le délai de 24h-48h et rappelez que le paiement se fait à la livraison en espèces.")}
                                                    className="inline-flex items-center gap-1 text-[11px] text-amber-500 dark:text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-2 py-1 rounded-lg border border-amber-500/40 font-semibold cursor-pointer transition-colors"
                                                >
                                                    {copiedPitch ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                    <span>{copiedPitch ? 'Copié !' : 'Copier script'}</span>
                                                </button>
                                            </div>
                                            <p className="text-text-primary text-xs sm:text-sm leading-relaxed italic">
                                                "{matchedProduct.confirmationPitch || "Bonjour M./Mme " + (formData.customerName || '') + ", je vous appelle pour confirmer votre commande de " + (formData.product || 'votre article') + ". La livraison s'effectue sous 24h à 48h et le règlement se fait à la livraison en espèces."}"
                                            </p>
                                        </div>

                                        {/* Upsell recommendation */}
                                        {matchedProduct.upsellOffer && (
                                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-start gap-2.5">
                                                <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <div className="text-xs leading-snug">
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Proposition Upsell : </span>
                                                    <span className="text-text-primary">{matchedProduct.upsellOffer}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Details */}
                                        {matchedProduct.description && (
                                            <div className="text-xs text-text-secondary line-clamp-2 leading-relaxed bg-base-200/40 p-2.5 rounded-lg border border-base-300">
                                                <strong className="text-text-primary">Détails : </strong>
                                                {matchedProduct.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. SHIPPING & COURIER INTEGRATION */}
                        <div className="bg-base-100 p-4 sm:p-5 rounded-xl border border-base-300 space-y-3 shadow-xs">
                            <div className="flex items-center justify-between border-b border-base-300 pb-2.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
                                    <Truck className="w-4 h-4 text-accent" />
                                    <span>Expédition & Transporteur</span>
                                </div>
                                {formData.trackingNumber ? (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                                        Expédié ({formData.courierName || 'Ozon Express'})
                                    </span>
                                ) : (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
                                        Prêt pour expédition
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyles}>N° de Suivi (Tracking)</label>
                                    <input 
                                        type="text" 
                                        name="trackingNumber" 
                                        value={formData.trackingNumber || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ex: OZ9283719"
                                        className={`${inputStyles} font-mono font-semibold text-accent`} 
                                    />
                                </div>
                                <div>
                                    <label className={labelStyles}>Société de Livraison</label>
                                    <input 
                                        type="text" 
                                        name="courierName" 
                                        value={formData.courierName || (primaryCourier === 'ozon_express' ? 'Ozon Express' : 'Kargo Express')} 
                                        onChange={handleChange} 
                                        placeholder="Ozon Express, Kargo Express..."
                                        className={inputStyles} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 6. INTERNAL NOTES */}
                        <div className="bg-base-100 p-4 sm:p-5 rounded-xl border border-base-300 space-y-2 shadow-xs">
                            <label className={labelStyles}>{t('noteLabel')}</label>
                            <textarea 
                                name="note" 
                                rows={2} 
                                value={formData.note || ''} 
                                onChange={handleChange} 
                                className={`${inputStyles} resize-none`} 
                                placeholder="Remarques de l'opérateur, horaire de livraison préféré..." 
                            />
                        </div>

                        {/* Feedback Banner */}
                        {syncFeedback && (
                            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
                                syncFeedback.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <span>{syncFeedback.success ? '✓' : '⚠️'}</span>
                                    <span>{syncFeedback.message}</span>
                                </div>
                                <button type="button" onClick={() => setSyncFeedback(null)} className="text-text-secondary hover:text-text-primary p-1">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                    </form>
                </div>

                {/* Clean, Non-Crowded Modal Footer */}
                <div className="p-4 sm:p-5 border-t border-base-300 bg-base-100 flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
                    {/* Left: Operator Utility Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        {onOpenChat && (
                            <button 
                                type="button" 
                                onClick={() => {
                                    onClose();
                                    onOpenChat(formData);
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 text-xs font-semibold transition-all cursor-pointer"
                                title="Envoyer un message interne à l'agent"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Message</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleTestSyncSheet}
                            disabled={syncingSheet}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-base-200 text-text-secondary hover:text-text-primary border border-base-300 hover:bg-base-300 text-xs font-semibold transition-all cursor-pointer"
                            title="Synchroniser directement vers Google Sheet"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingSheet ? 'animate-spin text-accent' : ''}`} />
                            <span>{syncingSheet ? 'Sync...' : 'Sync Sheet'}</span>
                        </button>
                        <button 
                            type="button" 
                            onClick={handleDelete}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t('deleteOrder')}</span>
                        </button>
                    </div>

                    {/* Right: Primary Save & Cancel CTAs */}
                    <div className="flex w-full sm:w-auto gap-2.5">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-semibold text-xs text-text-secondary hover:text-text-primary bg-base-200 hover:bg-base-300 border border-base-300 transition-all cursor-pointer"
                        >
                            {t('cancel')}
                        </button>
                        <button 
                            type="submit" 
                            form="order-form" 
                            disabled={!hasChanges}
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                hasChanges 
                                    ? 'bg-accent hover:brightness-110 shadow-accent/20 active:scale-[0.98]' 
                                    : 'bg-base-300 text-text-secondary cursor-not-allowed opacity-60'
                            }`}
                        >
                            <Check className="w-4 h-4" />
                            <span>{t('saveOrder')}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OrderDetailModal;
