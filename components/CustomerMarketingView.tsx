import React, { useState, useMemo, useCallback } from 'react';
import { 
    Users, 
    Search, 
    Filter, 
    Phone, 
    MessageSquare, 
    Share2, 
    Download, 
    Copy, 
    Check, 
    ExternalLink, 
    Sparkles, 
    TrendingUp, 
    ShoppingBag, 
    Calendar, 
    MapPin, 
    Award, 
    ChevronRight, 
    Tag, 
    Send, 
    FileSpreadsheet, 
    ArrowUpDown, 
    Eye,
    X,
    UserCheck,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    SlidersHorizontal,
    Crown,
    Flame
} from 'lucide-react';
import { Order, OrderStatus, Role, User, CustomerProfile, CustomerSegment, CustomerProductSummary } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from './StatusBadge';
import { normalizeStatus } from '../utils';

interface CustomerMarketingViewProps {
    orders: Order[];
    onSelectOrder?: (order: Order) => void;
    storeName?: string;
}

// Clean and normalize phone numbers, especially Moroccan formats
export function normalizePhoneNumber(rawPhone: string): { displayPhone: string; whatsappPhone: string; rawClean: string } {
    if (!rawPhone) return { displayPhone: '', whatsappPhone: '', rawClean: '' };
    
    // Remove all non-digit characters except leading plus
    let clean = String(rawPhone).trim().replace(/[^\d+]/g, '');
    
    // If starts with 00212, convert to +212
    if (clean.startsWith('00212')) {
        clean = '+212' + clean.slice(5);
    }
    
    let whatsapp = clean;
    // Moroccan numbers formatting
    if (clean.startsWith('+212')) {
        whatsapp = clean.replace('+', '');
    } else if (clean.startsWith('212')) {
        whatsapp = clean;
    } else if (clean.startsWith('06') || clean.startsWith('07') || clean.startsWith('05')) {
        whatsapp = '212' + clean.slice(1);
    } else if (clean.length === 9 && (clean.startsWith('6') || clean.startsWith('7') || clean.startsWith('5'))) {
        whatsapp = '212' + clean;
    }

    // Nice display phone format
    let display = rawPhone.trim();
    if (clean.startsWith('+212') && clean.length >= 13) {
        display = `${clean.slice(0, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)} ${clean.slice(8, 10)} ${clean.slice(10)}`;
    } else if (clean.startsWith('0') && clean.length === 10) {
        display = `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 6)} ${clean.slice(6, 8)} ${clean.slice(8, 10)}`;
    }

    return {
        displayPhone: display || rawPhone,
        whatsappPhone: whatsapp,
        rawClean: clean.replace(/\D/g, '')
    };
}

export const CustomerMarketingView: React.FC<CustomerMarketingViewProps> = ({
    orders,
    onSelectOrder,
    storeName
}) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();

    // Filters & Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSegment, setSelectedSegment] = useState<CustomerSegment>('all');
    const [selectedCity, setSelectedCity] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'spend' | 'orders' | 'recent' | 'name'>('spend');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

    // Selection for bulk marketing
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

    // Modals state
    const [activeCustomerDetail, setActiveCustomerDetail] = useState<CustomerProfile | null>(null);
    const [whatsappModalCustomer, setWhatsappModalCustomer] = useState<CustomerProfile | null>(null);
    const [isBulkToolsOpen, setIsBulkToolsOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [copiedPhoneType, setCopiedPhoneType] = useState<string | null>(null);

    // Custom WhatsApp Template message builder state
    const [templateType, setTemplateType] = useState<'promo' | 'new_product' | 'repeat' | 'followup' | 'cart_recovery' | 'custom'>('promo');
    const [customPromoDiscount, setCustomPromoDiscount] = useState('-15%');
    const [customPromoCode, setCustomPromoCode] = useState('VIP15');
    const [customMessageBody, setCustomMessageBody] = useState('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // 1. EXTRACTION & AGGREGATION OF UNIQUE CUSTOMERS FROM ORDERS
    const customerProfiles = useMemo<CustomerProfile[]>(() => {
        if (!orders || orders.length === 0) return [];

        const customerMap = new Map<string, {
            name: string;
            phone: string;
            city: string;
            district?: string;
            address?: string;
            orders: Order[];
        }>();

        orders.forEach(order => {
            if (!order) return;
            const name = String(order.customerName || '').trim();
            const phone = String(order.phone || '').trim();
            const { rawClean } = normalizePhoneNumber(phone);

            // Group key: Prefer normalized phone, fallback to lowercase clean name
            let groupKey = rawClean;
            if (!groupKey || groupKey.length < 6) {
                if (!name) return; // Skip completely empty orders
                groupKey = `name_${name.toLowerCase().replace(/\s+/g, '_')}`;
            }

            if (!customerMap.has(groupKey)) {
                customerMap.set(groupKey, {
                    name: name || 'Client sans nom',
                    phone: phone,
                    city: String(order.city || '').trim(),
                    district: String(order.district || '').trim(),
                    address: String(order.address || '').trim(),
                    orders: []
                });
            }

            const entry = customerMap.get(groupKey)!;
            // Update name or phone if current order has more complete data
            if (name && (entry.name === 'Client sans nom' || name.length > entry.name.length)) {
                entry.name = name;
            }
            if (phone && (!entry.phone || phone.length > entry.phone.length)) {
                entry.phone = phone;
            }
            if (order.city && !entry.city) entry.city = String(order.city).trim();
            if (order.district && !entry.district) entry.district = String(order.district).trim();
            if (order.address && !entry.address) entry.address = String(order.address).trim();

            entry.orders.push(order);
        });

        // Convert Map to full CustomerProfile objects
        const profiles: CustomerProfile[] = [];

        customerMap.forEach((data, groupKey) => {
            const custOrders = data.orders.sort((a, b) => {
                const dateA = new Date(a.date || 0).getTime();
                const dateB = new Date(b.date || 0).getTime();
                return dateB - dateA; // Most recent first
            });

            const { displayPhone, whatsappPhone, rawClean } = normalizePhoneNumber(data.phone);

            let confirmed = 0;
            let delivered = 0;
            let cancelled = 0;
            let unreachable = 0;
            let pending = 0;
            let totalSpend = 0;

            const productMap = new Map<string, { count: number; totalAmount: number; lastDate: string; variant?: string }>();

            custOrders.forEach(o => {
                const status = normalizeStatus(o.status);
                const price = Number(o.price || 0);

                if (status === OrderStatus.Confirme) confirmed++;
                else if (status === OrderStatus.Expider) {
                    delivered++;
                    confirmed++; // Count delivered as confirmed success
                } else if (status === OrderStatus.Annule || status === OrderStatus.NonCommandee) {
                    cancelled++;
                } else if (String(status || '').includes('injoignable') || String(status || '').includes('pas de rep')) {
                    unreachable++;
                } else if (status === OrderStatus.EnAttend) {
                    pending++;
                }

                // Add to spend if not cancelled
                if (status !== OrderStatus.Annule && status !== OrderStatus.NonCommandee && status !== OrderStatus.NumIncorect && status !== OrderStatus.FauxNumero) {
                    totalSpend += price;
                }

                // Product extraction
                const prodName = String(o.product || '').trim();
                if (prodName) {
                    const existingProd = productMap.get(prodName);
                    const qty = Number(o.quantity || 1);
                    if (existingProd) {
                        existingProd.count += qty;
                        existingProd.totalAmount += price;
                        if (!existingProd.lastDate || (o.date && o.date > existingProd.lastDate)) {
                            existingProd.lastDate = o.date;
                        }
                    } else {
                        productMap.set(prodName, {
                            count: qty,
                            totalAmount: price,
                            lastDate: o.date || '',
                            variant: o.variant
                        });
                    }
                }
            });

            const productsList: CustomerProductSummary[] = Array.from(productMap.entries()).map(([name, p]) => ({
                name,
                count: p.count,
                totalAmount: p.totalAmount,
                lastPurchasedDate: p.lastDate,
                variant: p.variant
            }));

            const totalOrders = custOrders.length;
            const avgSpend = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;
            const firstOrderDate = custOrders[custOrders.length - 1]?.date || '';
            const lastOrderDate = custOrders[0]?.date || '';

            // Segment definition
            let segment: 'vip' | 'repeat' | 'new' | 'prospect' | 'high_value' = 'new';
            if (confirmed >= 3 || totalSpend >= 1000) {
                segment = 'vip';
            } else if (totalOrders >= 2 && confirmed >= 1) {
                segment = 'repeat';
            } else if (totalSpend >= 600) {
                segment = 'high_value';
            } else if (confirmed === 0 && (cancelled > 0 || unreachable > 0 || pending > 0)) {
                segment = 'prospect';
            } else {
                segment = 'new';
            }

            profiles.push({
                id: groupKey,
                name: data.name,
                phone: displayPhone,
                normalizedPhone: rawClean,
                whatsappPhone: whatsappPhone,
                city: data.city || 'Non spécifiée',
                district: data.district,
                address: data.address,
                totalOrders,
                confirmedOrders: confirmed,
                deliveredOrders: delivered,
                cancelledOrders: cancelled,
                unreachableOrders: unreachable,
                pendingOrders: pending,
                totalSpend,
                averageSpend: avgSpend,
                firstOrderDate,
                lastOrderDate,
                products: productsList,
                orders: custOrders,
                segment
            });
        });

        return profiles;
    }, [orders]);

    // Unique cities & products for dropdown filters
    const availableCities = useMemo(() => {
        const set = new Set<string>();
        customerProfiles.forEach(c => {
            if (c.city && c.city !== 'Non spécifiée') set.add(c.city);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [customerProfiles]);

    const availableProducts = useMemo(() => {
        const set = new Set<string>();
        customerProfiles.forEach(c => {
            c.products.forEach(p => set.add(p.name));
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [customerProfiles]);

    // 2. FILTERING & SORTING
    const filteredCustomers = useMemo(() => {
        return customerProfiles.filter(c => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = c.name.toLowerCase().includes(q);
                const matchPhone = c.phone.replace(/\s+/g, '').includes(q) || c.whatsappPhone.includes(q);
                const matchCity = c.city.toLowerCase().includes(q);
                const matchDistrict = (c.district || '').toLowerCase().includes(q);
                const matchProduct = c.products.some(p => p.name.toLowerCase().includes(q));

                if (!matchName && !matchPhone && !matchCity && !matchDistrict && !matchProduct) {
                    return false;
                }
            }

            // Segment filter
            if (selectedSegment !== 'all') {
                if (selectedSegment === 'vip' && c.segment !== 'vip') return false;
                if (selectedSegment === 'repeat' && c.segment !== 'repeat' && c.segment !== 'vip') return false;
                if (selectedSegment === 'new' && c.segment !== 'new') return false;
                if (selectedSegment === 'prospect' && c.segment !== 'prospect') return false;
                if (selectedSegment === 'high_value' && c.totalSpend < 500) return false;
            }

            // City filter
            if (selectedCity !== 'all' && c.city.toLowerCase() !== selectedCity.toLowerCase()) {
                return false;
            }

            // Product filter
            if (selectedProduct !== 'all') {
                const hasProd = c.products.some(p => p.name.toLowerCase() === selectedProduct.toLowerCase());
                if (!hasProd) return false;
            }

            return true;
        }).sort((a, b) => {
            let res = 0;
            if (sortBy === 'spend') res = b.totalSpend - a.totalSpend;
            else if (sortBy === 'orders') res = b.totalOrders - a.totalOrders;
            else if (sortBy === 'recent') res = new Date(b.lastOrderDate || 0).getTime() - new Date(a.lastOrderDate || 0).getTime();
            else if (sortBy === 'name') res = a.name.localeCompare(b.name);

            return sortDirection === 'desc' ? res : -res;
        });
    }, [customerProfiles, searchQuery, selectedSegment, selectedCity, selectedProduct, sortBy, sortDirection]);

    // Overall KPI statistics
    const stats = useMemo(() => {
        const totalCustomers = customerProfiles.length;
        const repeatCustomers = customerProfiles.filter(c => c.totalOrders >= 2).length;
        const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
        const totalRevenue = customerProfiles.reduce((acc, c) => acc + c.totalSpend, 0);
        const avgBasket = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
        const vipCount = customerProfiles.filter(c => c.segment === 'vip').length;
        const prospectCount = customerProfiles.filter(c => c.segment === 'prospect').length;

        return {
            totalCustomers,
            repeatCustomers,
            repeatRate,
            totalRevenue,
            avgBasket,
            vipCount,
            prospectCount
        };
    }, [customerProfiles]);

    // Handle Selection toggles
    const handleToggleSelectAll = () => {
        if (selectedCustomerIds.size === filteredCustomers.length) {
            setSelectedCustomerIds(new Set());
        } else {
            setSelectedCustomerIds(new Set(filteredCustomers.map(c => c.id)));
        }
    };

    const handleToggleSelectCustomer = (id: string) => {
        setSelectedCustomerIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // 3. MARKETING ACTIONS & MESSAGES GENERATOR
    const effectiveStoreName = storeName || currentUser?.name || 'Notre Boutique';

    const generateWhatsAppMessage = useCallback((customer: CustomerProfile): string => {
        const firstName = customer.name.split(' ')[0] || 'Cher client';
        const primaryProduct = customer.products[0]?.name || 'nos articles';
        const totalSpend = customer.totalSpend;

        if (templateType === 'promo') {
            return `Bonjour ${firstName} 👋,\n\nMerci pour votre fidélité chez *${effectiveStoreName}* ! 🎁\n\nPour vous remercier, nous vous offrons une remise spéciale de *${customPromoDiscount}* sur tout le catalogue avec votre code promo exclusif : *${customPromoCode}*.\n\n👉 Répondez à ce message pour découvrir nos nouvelles offres ou commander !`;
        }

        if (templateType === 'new_product') {
            return `Salam ${firstName} ✨,\n\nUne nouveauté exclusive vient d'arriver chez *${effectiveStoreName}* qui pourrait beaucoup vous intéresser !\n\nNos stocks sont limités pour ce lancement. Souhaitez-vous recevoir les photos et détails en avant-première ? 📦`;
        }

        if (templateType === 'repeat') {
            return `Bonjour ${firstName} 👋,\n\nNous espérons que vous êtes très satisfait(e) de votre commande pour *${primaryProduct}* chez *${effectiveStoreName}* !\n\nAvez-vous besoin d'un réassort ou souhaitez-vous profiter d'une offre spéciale réachat ? 🛍️`;
        }

        if (templateType === 'cart_recovery') {
            return `Bonjour ${firstName} 👋,\n\nNous avons bien noté votre commande pour *${primaryProduct}*.\n\nSouhaitez-vous que nous confirmions votre livraison rapidement pour la recevoir à *${customer.city || 'votre adresse'}* ?\n\nNous restons à votre entière disposition ! 🙏`;
        }

        if (templateType === 'followup') {
            return `Salam ${firstName} ⭐,\n\nVotre satisfaction est notre priorité absolue chez *${effectiveStoreName}*.\n\nComment s'est passée votre expérience avec notre produit *${primaryProduct}* ? Votre retour nous est très précieux ! 😊`;
        }

        if (templateType === 'custom' && customMessageBody.trim()) {
            return customMessageBody
                .replace(/{nom}/g, firstName)
                .replace(/{nom_complet}/g, customer.name)
                .replace(/{ville}/g, customer.city || 'votre ville')
                .replace(/{produit}/g, primaryProduct)
                .replace(/{boutique}/g, effectiveStoreName)
                .replace(/{montant}/g, `${totalSpend} MAD`);
        }

        return `Bonjour ${firstName}, découvrez les offres exclusives de ${effectiveStoreName} !`;
    }, [templateType, customPromoDiscount, customPromoCode, customMessageBody, effectiveStoreName]);

    // Send single WhatsApp
    const handleOpenWhatsApp = (customer: CustomerProfile) => {
        const message = generateWhatsAppMessage(customer);
        const encoded = encodeURIComponent(message);
        const url = `https://wa.me/${customer.whatsappPhone}?text=${encoded}`;
        window.open(url, '_blank');
    };

    // Send single SMS
    const handleOpenSMS = (customer: CustomerProfile) => {
        const message = generateWhatsAppMessage(customer);
        const encoded = encodeURIComponent(message);
        window.location.href = `sms:${customer.whatsappPhone}?body=${encoded}`;
    };

    // Copy Phone numbers to clipboard
    const handleCopyPhones = (separator: ',' | ';' | '\n', filteredOnly = true) => {
        const listToUse = selectedCustomerIds.size > 0 
            ? filteredCustomers.filter(c => selectedCustomerIds.has(c.id))
            : (filteredOnly ? filteredCustomers : customerProfiles);

        const phones = listToUse
            .map(c => c.whatsappPhone || c.normalizedPhone)
            .filter(p => Boolean(p) && p.length >= 8);

        if (phones.length === 0) {
            showToast('Aucun numéro de téléphone valide à copier.');
            return;
        }

        const text = phones.join(separator);
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPhoneType(separator);
            showToast(`✓ ${phones.length} numéros copiés dans le presse-papier !`);
            setTimeout(() => setCopiedPhoneType(null), 2500);
        }).catch(() => {
            showToast('Erreur lors de la copie.');
        });
    };

    // Export CSV / Excel Format
    const handleExportCSV = (audienceFormat: 'standard' | 'meta_ads') => {
        const listToUse = selectedCustomerIds.size > 0 
            ? filteredCustomers.filter(c => selectedCustomerIds.has(c.id))
            : filteredCustomers;

        if (listToUse.length === 0) {
            showToast('Aucun client à exporter.');
            return;
        }

        let csvContent = '';
        let fileName = '';

        if (audienceFormat === 'meta_ads') {
            // Facebook Meta Ads Custom Audience format (Phone, First Name, Last Name, City, Country, Value)
            fileName = `meta_custom_audience_${new Date().toISOString().split('T')[0]}.csv`;
            csvContent = 'phone,fn,ct,country,value\n';
            listToUse.forEach(c => {
                const phone = c.whatsappPhone.startsWith('+') ? c.whatsappPhone : `+${c.whatsappPhone}`;
                const nameParts = c.name.split(' ');
                const fn = nameParts[0] || '';
                const city = c.city.replace(/,/g, '');
                csvContent += `"${phone}","${fn}","${city}","MA",${c.totalSpend}\n`;
            });
        } else {
            // Standard full Excel / CRM export
            fileName = `base_clients_marketing_${new Date().toISOString().split('T')[0]}.csv`;
            csvContent = 'Nom,Telephone,Ville,Quartier,Segment,Total_Commandes,Commandes_Confirmees,Total_Depense_MAD,Panier_Moyen_MAD,Premier_Achat,Dernier_Achat,Produits_Achetes\n';
            listToUse.forEach(c => {
                const prodSummary = c.products.map(p => `${p.name} (x${p.count})`).join(' | ').replace(/"/g, '""');
                csvContent += `"${c.name}","${c.phone}","${c.city}","${c.district || ''}","${c.segment}",${c.totalOrders},${c.confirmedOrders},${c.totalSpend},${c.averageSpend},"${c.firstOrderDate}","${c.lastOrderDate}","${prodSummary}"\n`;
            });
        }

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`✓ Export de ${listToUse.length} clients réussi (${fileName})`);
    };

    return (
        <div className="space-y-6 pb-12 animate-fade-in">
            {/* Top Toast Alert */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-[#1C2434] text-white px-5 py-3 rounded-xl shadow-2xl border border-[#3C50E0] flex items-center gap-3 animate-bounce">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-semibold">{toastMessage}</span>
                </div>
            )}

            {/* Header with Title & Quick Global Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
                        <Users className="w-4 h-4" />
                        <span>{t('customersTitle') || 'Base Clients & Marketing'}</span>
                        {storeName && <span className="text-text-secondary font-normal">({storeName})</span>}
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-text-primary">
                        Fichier Clients & Relances Marketing
                    </h1>
                    <p className="text-xs md:text-sm text-text-secondary mt-1 max-w-2xl">
                        Extraction automatique des acheteurs uniques depuis vos commandes pour envoyer vos offres WhatsApp, SMS et exporter vos audiences publicitaires.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setIsBulkToolsOpen(true)}
                        className="btn btn-sm md:btn-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 rounded-xl shadow-sm transition-all"
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span>Campagne WhatsApp / SMS</span>
                    </button>

                    <div className="dropdown dropdown-end">
                        <button tabIndex={0} className="btn btn-sm md:btn-md bg-base-200 hover:bg-base-300 text-text-primary font-bold flex items-center gap-2 rounded-xl border border-base-300">
                            <Download className="w-4 h-4" />
                            <span>Exporter</span>
                        </button>
                        <ul tabIndex={0} className="dropdown-content z-[20] menu p-2 shadow-2xl bg-base-100 rounded-2xl w-60 border border-base-300 text-xs font-semibold mt-2">
                            <li>
                                <button onClick={() => handleExportCSV('standard')} className="flex items-center gap-2 py-2.5">
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                    <span>Export Excel / CSV Complet</span>
                                </button>
                            </li>
                            <li>
                                <button onClick={() => handleExportCSV('meta_ads')} className="flex items-center gap-2 py-2.5">
                                    <Share2 className="w-4 h-4 text-blue-500" />
                                    <span>Format Meta / Facebook Ads</span>
                                </button>
                            </li>
                            <div className="divider my-1"></div>
                            <li>
                                <button onClick={() => handleCopyPhones(',')} className="flex items-center gap-2 py-2">
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copier numéros (virgules)</span>
                                </button>
                            </li>
                            <li>
                                <button onClick={() => handleCopyPhones('\n')} className="flex items-center gap-2 py-2">
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copier numéros (1 par ligne)</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Clients */}
                <div className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Clients Uniques</span>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-text-primary">{stats.totalCustomers}</div>
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Extraits des {orders.length} commandes</span>
                    </div>
                </div>

                {/* 2. Clients Fidèles / Récurrents */}
                <div className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Acheteurs Fidèles (2+)</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center">
                            <Crown className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-text-primary">{stats.repeatCustomers}</div>
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-text-secondary">
                        <span>Taux de réachat : </span>
                        <span className="font-bold text-amber-600">{stats.repeatRate}%</span>
                    </div>
                </div>

                {/* 3. Chiffre d'Affaires Cumulé */}
                <div className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">CA Total Clients</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-emerald-600">{stats.totalRevenue.toLocaleString()} <span className="text-sm font-bold">MAD</span></div>
                    <div className="text-[11px] text-text-secondary mt-2">
                        Commandes confirmées & livrées
                    </div>
                </div>

                {/* 4. Panier Moyen */}
                <div className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Panier Moyen Client</span>
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                            <ShoppingBag className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-text-primary">{stats.avgBasket} <span className="text-sm font-bold">MAD</span></div>
                    <div className="text-[11px] text-text-secondary mt-2">
                        Dépense moyenne par client
                    </div>
                </div>
            </div>

            {/* Segment Selector Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                <button
                    onClick={() => setSelectedSegment('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                        selectedSegment === 'all'
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-base-100 hover:bg-base-200 text-text-secondary border-base-300'
                    }`}
                >
                    <span>Tous les clients</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${selectedSegment === 'all' ? 'bg-white/20 text-white' : 'bg-base-300 text-text-primary'}`}>
                        {customerProfiles.length}
                    </span>
                </button>

                <button
                    onClick={() => setSelectedSegment('vip')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                        selectedSegment === 'vip'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                            : 'bg-base-100 hover:bg-base-200 text-text-secondary border-base-300'
                    }`}
                >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Clients VIP (3+ commandes)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${selectedSegment === 'vip' ? 'bg-white/20 text-white' : 'bg-base-300 text-text-primary'}`}>
                        {stats.vipCount}
                    </span>
                </button>

                <button
                    onClick={() => setSelectedSegment('repeat')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                        selectedSegment === 'repeat'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-base-100 hover:bg-base-200 text-text-secondary border-base-300'
                    }`}
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Fidèles & Récurents (2+)</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${selectedSegment === 'repeat' ? 'bg-white/20 text-white' : 'bg-base-300 text-text-primary'}`}>
                        {stats.repeatCustomers}
                    </span>
                </button>

                <button
                    onClick={() => setSelectedSegment('new')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                        selectedSegment === 'new'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-base-100 hover:bg-base-200 text-text-secondary border-base-300'
                    }`}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nouveaux Acheteurs</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${selectedSegment === 'new' ? 'bg-white/20 text-white' : 'bg-base-300 text-text-primary'}`}>
                        {customerProfiles.filter(c => c.segment === 'new').length}
                    </span>
                </button>

                <button
                    onClick={() => setSelectedSegment('prospect')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                        selectedSegment === 'prospect'
                            ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                            : 'bg-base-100 hover:bg-base-200 text-text-secondary border-base-300'
                    }`}
                >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Prospects à Relancer</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${selectedSegment === 'prospect' ? 'bg-white/20 text-white' : 'bg-base-300 text-text-primary'}`}>
                        {stats.prospectCount}
                    </span>
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    {/* Search Input */}
                    <div className="lg:col-span-5 relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher par nom, téléphone, ville, produit..."
                            className="input input-sm md:input-md w-full pl-10 bg-base-200/60 border-base-300 rounded-xl text-xs md:text-sm font-medium focus:bg-base-100"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* City filter */}
                    <div className="lg:col-span-3">
                        <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="select select-sm md:select-md w-full bg-base-200/60 border-base-300 rounded-xl text-xs font-semibold"
                        >
                            <option value="all">Toutes les villes ({availableCities.length})</option>
                            {availableCities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    {/* Product filter */}
                    <div className="lg:col-span-2">
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="select select-sm md:select-md w-full bg-base-200/60 border-base-300 rounded-xl text-xs font-semibold"
                        >
                            <option value="all">Tous les produits</option>
                            {availableProducts.map(p => (
                                <option key={p} value={p}>{p.length > 20 ? p.slice(0, 20) + '...' : p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort by */}
                    <div className="lg:col-span-2 flex items-center gap-1.5">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="select select-sm md:select-md flex-1 bg-base-200/60 border-base-300 rounded-xl text-xs font-semibold"
                        >
                            <option value="spend">Total Achat (MAD)</option>
                            <option value="orders">Nb Commandes</option>
                            <option value="recent">Plus Récent</option>
                            <option value="name">Nom (A-Z)</option>
                        </select>
                        <button
                            onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="btn btn-sm md:btn-md btn-square bg-base-200 border-base-300 rounded-xl"
                            title="Changer l'ordre de tri"
                        >
                            <ArrowUpDown className="w-4 h-4 text-text-secondary" />
                        </button>
                    </div>
                </div>

                {/* Batch Action Toolbar when items are selected */}
                {selectedCustomerIds.size > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-semibold animate-fade-in">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{selectedCustomerIds.size} client(s) sélectionné(s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleCopyPhones(',', true)}
                                className="btn btn-xs bg-base-100 hover:bg-base-200 border border-base-300 rounded-lg text-text-primary"
                            >
                                <Copy className="w-3 h-3" />
                                Copier les numéros
                            </button>
                            <button
                                onClick={() => setIsBulkToolsOpen(true)}
                                className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            >
                                <MessageSquare className="w-3 h-3" />
                                WhatsApp aux sélectionnés
                            </button>
                            <button
                                onClick={() => setSelectedCustomerIds(new Set())}
                                className="btn btn-xs btn-ghost text-text-secondary"
                            >
                                Désélectionner
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Customers Table / Card List */}
            <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-base-300 flex items-center justify-between text-xs font-bold text-text-secondary">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={filteredCustomers.length > 0 && selectedCustomerIds.size === filteredCustomers.length}
                            onChange={handleToggleSelectAll}
                            className="checkbox checkbox-xs checkbox-primary rounded"
                        />
                        <span>Affichage de {filteredCustomers.length} client(s)</span>
                    </div>
                    <span>Trié par {sortBy === 'spend' ? 'Chiffre d\'affaires' : sortBy === 'orders' ? 'Commandes' : sortBy === 'recent' ? 'Récence' : 'Nom'}</span>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-base-200 text-text-secondary flex items-center justify-center mx-auto">
                            <Users className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-text-primary">Aucun client trouvé</h3>
                        <p className="text-xs text-text-secondary max-w-sm mx-auto">
                            Aucun acheteur ne correspond aux critères de recherche ou de filtre sélectionnés.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table w-full text-left">
                            <thead className="bg-base-200/50 text-[11px] font-bold text-text-secondary uppercase tracking-wider border-b border-base-300">
                                <tr>
                                    <th className="w-10"></th>
                                    <th>Client</th>
                                    <th>Contact & Actions Directes</th>
                                    <th>Ville</th>
                                    <th>Commandes & Statuts</th>
                                    <th>Total Dépensé</th>
                                    <th>Dernier Achat</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200 text-xs">
                                {filteredCustomers.map(customer => {
                                    const isSelected = selectedCustomerIds.has(customer.id);
                                    const primaryProduct = customer.products[0];

                                    return (
                                        <tr key={customer.id} className={`hover:bg-base-200/40 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectCustomer(customer.id)}
                                                    className="checkbox checkbox-xs checkbox-primary rounded"
                                                />
                                            </td>

                                            {/* Customer Name & Segment Tag */}
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                                                        customer.segment === 'vip' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300' :
                                                        customer.segment === 'repeat' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                                        customer.segment === 'prospect' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' :
                                                        'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                    }`}>
                                                        {customer.name.slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-text-primary flex items-center gap-1.5">
                                                            <span>{customer.name}</span>
                                                            {customer.segment === 'vip' && (
                                                                <span className="badge badge-xs bg-amber-500 text-white font-bold border-none gap-1 py-1">
                                                                    <Crown className="w-2.5 h-2.5" /> VIP
                                                                </span>
                                                            )}
                                                            {customer.segment === 'repeat' && (
                                                                <span className="badge badge-xs bg-blue-600 text-white font-bold border-none py-1">
                                                                    Fidèle (x{customer.totalOrders})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                                                            {customer.district ? (
                                                                <span>{customer.district} • {customer.city}</span>
                                                            ) : (
                                                                <span>{customer.city}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Phone & Instant Contact */}
                                            <td>
                                                <div className="space-y-1">
                                                    <div className="font-mono font-semibold text-text-primary text-xs flex items-center gap-1.5">
                                                        <span>{customer.phone || 'Non renseigné'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {customer.whatsappPhone && (
                                                            <button
                                                                onClick={() => {
                                                                    setWhatsappModalCustomer(customer);
                                                                }}
                                                                className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors border border-emerald-200 dark:border-emerald-800"
                                                                title="Envoyer une offre WhatsApp"
                                                            >
                                                                <MessageSquare className="w-3 h-3" />
                                                                WhatsApp
                                                            </button>
                                                        )}
                                                        {customer.phone && (
                                                            <a
                                                                href={`tel:${customer.phone}`}
                                                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors border border-blue-200 dark:border-blue-800"
                                                                title="Appeler directement"
                                                            >
                                                                <Phone className="w-3 h-3" />
                                                                Appel
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* City */}
                                            <td>
                                                <div className="flex items-center gap-1 text-text-primary font-medium">
                                                    <MapPin className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                                                    <span>{customer.city}</span>
                                                </div>
                                            </td>

                                            {/* Orders Count & Status Breakdown */}
                                            <td>
                                                <div className="space-y-1">
                                                    <div className="font-bold text-text-primary">
                                                        {customer.totalOrders} commande{customer.totalOrders > 1 ? 's' : ''}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {customer.confirmedOrders > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                                                {customer.confirmedOrders} confirmée{customer.confirmedOrders > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {customer.pendingOrders > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                                                {customer.pendingOrders} en attente
                                                            </span>
                                                        )}
                                                        {customer.cancelledOrders > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                                                {customer.cancelledOrders} annulée{customer.cancelledOrders > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Total Spend */}
                                            <td>
                                                <div>
                                                    <div className="font-black text-sm text-emerald-600">
                                                        {customer.totalSpend.toLocaleString()} <span className="text-[10px]">MAD</span>
                                                    </div>
                                                    <div className="text-[10px] text-text-secondary">
                                                        Moyenne : {customer.averageSpend} MAD
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Last Purchase & Product */}
                                            <td>
                                                <div className="space-y-0.5">
                                                    <div className="font-medium text-text-primary text-[11px] flex items-center gap-1">
                                                        <Calendar className="w-3 h-3 text-text-secondary" />
                                                        <span>{customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('fr-FR') : 'Non datée'}</span>
                                                    </div>
                                                    {primaryProduct && (
                                                        <div className="text-[10px] text-text-secondary truncate max-w-[150px]" title={primaryProduct.name}>
                                                            {primaryProduct.name} {primaryProduct.variant ? `(${primaryProduct.variant})` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setActiveCustomerDetail(customer)}
                                                        className="btn btn-xs btn-ghost text-text-secondary hover:text-text-primary"
                                                        title="Voir l'historique complet des commandes"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        Détails
                                                    </button>
                                                    <button
                                                        onClick={() => setWhatsappModalCustomer(customer)}
                                                        className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                                                        title="Envoyer un message WhatsApp ciblé"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* WHATSAPP MARKETING MODAL (SINGLE OR GROUP TEMPLATES) */}
            {whatsappModalCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-base-100 w-full max-w-xl rounded-3xl shadow-2xl border border-base-300 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-base-300 flex items-center justify-between bg-emerald-600 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black">Offre WhatsApp Marketing</h3>
                                    <p className="text-xs text-white/80">
                                        Destinataire : <span className="font-bold">{whatsappModalCustomer.name}</span> ({whatsappModalCustomer.phone})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setWhatsappModalCustomer(null)}
                                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">
                                    Choisir un modèle de message :
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTemplateType('promo')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            templateType === 'promo'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                                                : 'bg-base-200/50 border-base-300 text-text-secondary hover:bg-base-200'
                                        }`}
                                    >
                                        <div className="text-xs">🎁 Offre Promo & Réduction</div>
                                        <div className="text-[10px] opacity-75 mt-0.5">Code promo fidélité</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTemplateType('new_product')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            templateType === 'new_product'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                                                : 'bg-base-200/50 border-base-300 text-text-secondary hover:bg-base-200'
                                        }`}
                                    >
                                        <div className="text-xs">🚀 Nouveauté Produit</div>
                                        <div className="text-[10px] opacity-75 mt-0.5">Arrivage exclusif</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTemplateType('repeat')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            templateType === 'repeat'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                                                : 'bg-base-200/50 border-base-300 text-text-secondary hover:bg-base-200'
                                        }`}
                                    >
                                        <div className="text-xs">🔁 Relance Réachat</div>
                                        <div className="text-[10px] opacity-75 mt-0.5">Renouvellement stock</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTemplateType('cart_recovery')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            templateType === 'cart_recovery'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                                                : 'bg-base-200/50 border-base-300 text-text-secondary hover:bg-base-200'
                                        }`}
                                    >
                                        <div className="text-xs">🛒 Relance Commande</div>
                                        <div className="text-[10px] opacity-75 mt-0.5">Confirmation livraison</div>
                                    </button>
                                </div>
                            </div>

                            {/* Template options if promo */}
                            {templateType === 'promo' && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-base-200/50 rounded-xl border border-base-300">
                                    <div>
                                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Remise :</label>
                                        <input
                                            type="text"
                                            value={customPromoDiscount}
                                            onChange={(e) => setCustomPromoDiscount(e.target.value)}
                                            className="input input-sm w-full bg-base-100 border-base-300 rounded-lg text-xs"
                                            placeholder="-15% ou 50 MAD"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Code Promo :</label>
                                        <input
                                            type="text"
                                            value={customPromoCode}
                                            onChange={(e) => setCustomPromoCode(e.target.value)}
                                            className="input input-sm w-full bg-base-100 border-base-300 rounded-lg text-xs"
                                            placeholder="VIP15"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Live Message Preview */}
                            <div>
                                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
                                    Aperçu du message WhatsApp :
                                </label>
                                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl text-xs text-text-primary whitespace-pre-line font-sans leading-relaxed">
                                    {generateWhatsAppMessage(whatsappModalCustomer)}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-base-300 bg-base-200/40 flex items-center justify-between">
                            <button
                                onClick={() => {
                                    const text = generateWhatsAppMessage(whatsappModalCustomer);
                                    navigator.clipboard.writeText(text);
                                    showToast('✓ Message copié !');
                                }}
                                className="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-300 text-text-primary text-xs font-bold gap-1.5"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copier le texte
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setWhatsappModalCustomer(null)}
                                    className="btn btn-sm btn-ghost text-xs"
                                >
                                    Fermer
                                </button>
                                <button
                                    onClick={() => handleOpenWhatsApp(whatsappModalCustomer)}
                                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs rounded-xl shadow-md"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Ouvrir WhatsApp Web / App
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BULK MARKETING TOOLS & BROADCAST MODAL */}
            {isBulkToolsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-base-100 w-full max-w-2xl rounded-3xl shadow-2xl border border-base-300 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-base-300 flex items-center justify-between bg-[#1C2434] text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#3C50E0] flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black">Campagne & Diffusion Marketing</h3>
                                    <p className="text-xs text-[#8A99AF]">
                                        Exportation & diffusion groupée vers vos {filteredCustomers.length} clients
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBulkToolsOpen(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Fast Copy numbers section */}
                            <div className="p-4 bg-base-200/50 rounded-2xl border border-base-300 space-y-3">
                                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                                    <Copy className="w-4 h-4 text-primary" />
                                    <span>Copier les numéros de téléphone pour campagne</span>
                                </h4>
                                <p className="text-xs text-text-secondary">
                                    Collez directement vos numéros dans vos outils d'envoi SMS groupé, listes de diffusion WhatsApp ou CRM.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        onClick={() => handleCopyPhones(',')}
                                        className="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-300 text-xs font-bold gap-1.5 rounded-xl"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-primary" />
                                        Séparés par virgules (,)
                                    </button>
                                    <button
                                        onClick={() => handleCopyPhones(';')}
                                        className="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-300 text-xs font-bold gap-1.5 rounded-xl"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-primary" />
                                        Séparés par points-virgules (;)
                                    </button>
                                    <button
                                        onClick={() => handleCopyPhones('\n')}
                                        className="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-300 text-xs font-bold gap-1.5 rounded-xl"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-primary" />
                                        1 numéro par ligne
                                    </button>
                                </div>
                            </div>

                            {/* Audience CSV for Meta Ads */}
                            <div className="p-4 bg-base-200/50 rounded-2xl border border-base-300 space-y-3">
                                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                                    <Share2 className="w-4 h-4 text-blue-500" />
                                    <span>Exportation Meta / Facebook Custom Audience</span>
                                </h4>
                                <p className="text-xs text-text-secondary">
                                    Téléchargez le fichier CSV pré-formaté pour Meta Ads Manager (Retargeting, Lookalike / Audiences Similaires).
                                </p>
                                <button
                                    onClick={() => handleExportCSV('meta_ads')}
                                    className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-2 rounded-xl"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Télécharger l'audience Meta Ads (.csv)
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-base-300 bg-base-200/40 flex justify-end">
                            <button
                                onClick={() => setIsBulkToolsOpen(false)}
                                className="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-300 text-xs font-bold px-6 rounded-xl"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMER COMPLETE HISTORY MODAL */}
            {activeCustomerDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-base-100 w-full max-w-3xl rounded-3xl shadow-2xl border border-base-300 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-base-300 flex items-center justify-between bg-base-200/80">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm uppercase">
                                    {activeCustomerDetail.name.slice(0, 2)}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-text-primary flex items-center gap-2">
                                        <span>{activeCustomerDetail.name}</span>
                                        {activeCustomerDetail.segment === 'vip' && (
                                            <span className="badge badge-xs bg-amber-500 text-white font-bold border-none">VIP</span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-text-secondary flex items-center gap-2">
                                        <span>{activeCustomerDetail.phone}</span>
                                        <span>•</span>
                                        <span>{activeCustomerDetail.city} {activeCustomerDetail.district ? `(${activeCustomerDetail.district})` : ''}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveCustomerDetail(null)}
                                className="p-2 rounded-full hover:bg-base-300 text-text-secondary transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Customer Metrics Strip */}
                        <div className="grid grid-cols-3 gap-2 p-4 bg-base-200/30 border-b border-base-300 text-center">
                            <div className="p-2.5 bg-base-100 rounded-xl border border-base-300">
                                <div className="text-[10px] font-bold uppercase text-text-secondary">Commandes</div>
                                <div className="text-lg font-black text-text-primary">{activeCustomerDetail.totalOrders}</div>
                            </div>
                            <div className="p-2.5 bg-base-100 rounded-xl border border-base-300">
                                <div className="text-[10px] font-bold uppercase text-text-secondary">Total Dépensé</div>
                                <div className="text-lg font-black text-emerald-600">{activeCustomerDetail.totalSpend} MAD</div>
                            </div>
                            <div className="p-2.5 bg-base-100 rounded-xl border border-base-300">
                                <div className="text-[10px] font-bold uppercase text-text-secondary">Panier Moyen</div>
                                <div className="text-lg font-black text-text-primary">{activeCustomerDetail.averageSpend} MAD</div>
                            </div>
                        </div>

                        {/* Order Timeline History */}
                        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                                Historique des commandes ({activeCustomerDetail.orders.length}) :
                            </h4>

                            <div className="space-y-2">
                                {activeCustomerDetail.orders.map((order, idx) => (
                                    <div
                                        key={order.id || idx}
                                        onClick={() => {
                                            if (onSelectOrder) {
                                                onSelectOrder(order);
                                            }
                                        }}
                                        className="p-3.5 bg-base-200/40 hover:bg-base-200 rounded-2xl border border-base-300 flex items-center justify-between gap-4 transition-all cursor-pointer group"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                                                    #{order.id}
                                                </span>
                                                <StatusBadge status={order.status} />
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                <span className="font-medium text-text-primary">{order.product}</span>
                                                {order.variant && <span> ({order.variant})</span>}
                                                {order.quantity && <span> • Qté: {order.quantity}</span>}
                                            </div>
                                            {order.note && (
                                                <div className="text-[11px] text-text-secondary italic">
                                                    Note: {order.note}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-black text-emerald-600">{order.price} MAD</div>
                                            <div className="text-[10px] text-text-secondary">
                                                {order.date ? new Date(order.date).toLocaleDateString('fr-FR') : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer with instant trigger buttons */}
                        <div className="p-4 border-t border-base-300 bg-base-200/40 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const c = activeCustomerDetail;
                                        setActiveCustomerDetail(null);
                                        setWhatsappModalCustomer(c);
                                    }}
                                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-1.5 text-xs"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Offre WhatsApp
                                </button>
                                {activeCustomerDetail.phone && (
                                    <a
                                        href={`tel:${activeCustomerDetail.phone}`}
                                        className="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-300 text-xs font-bold rounded-xl gap-1.5"
                                    >
                                        <Phone className="w-3.5 h-3.5" />
                                        Appeler
                                    </a>
                                )}
                            </div>

                            <button
                                onClick={() => setActiveCustomerDetail(null)}
                                className="btn btn-sm btn-ghost text-xs"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerMarketingView;
