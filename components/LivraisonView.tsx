import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, OrderStatus, ShippingTemplate, StaticColumn, ORDER_FIELDS, Role } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { DownloadIcon } from './icons/DownloadIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ShippingIcon } from './icons/ShippingIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { PlusIcon } from './icons/PlusIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { UploadIcon } from './icons/UploadIcon';
import { EditIcon } from './icons/EditIcon';
import { CheckIcon } from './icons/CheckIcon';
import { suggestColumnMapping } from '../lib/gemini';
import { apiClient } from '../lib/apiClient';

export const DEFAULT_SHIPPING_TEMPLATES: ShippingTemplate[] = [
    {
        id: 'standard',
        name: 'Standard (CallNet)',
        companyName: 'Standard',
        description: 'Modèle complet avec toutes les coordonnées de livraison',
        filenamePrefix: 'livraison_standard',
        sheetName: 'Livraisons',
        enabledKeys: ['id', 'date', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'quantity', 'variant', 'price', 'note'],
        mapping: {
            id: 'ID',
            date: 'Date',
            customerName: 'Client',
            phone: 'Telephone',
            city: 'Ville',
            district: 'Quartier',
            address: 'Adresse',
            product: 'Produit',
            quantity: 'Quantité',
            variant: 'Variante',
            price: 'Prix (MAD)',
            note: 'Note'
        },
        columnOrder: ['id', 'date', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'quantity', 'variant', 'price', 'note'],
        staticColumns: []
    },
    {
        id: 'catlogistics',
        name: 'Cat Logistics',
        companyName: 'Cat Logistics',
        description: 'Modèle officiel Cat Logistics avec CRBT et instructions',
        filenamePrefix: 'livraison_catlogistics',
        sheetName: 'Expéditions',
        enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'quantity', 'price', 'note'],
        mapping: {
            id: 'Code Envoi',
            customerName: 'Destinataire',
            phone: 'Téléphone 1',
            city: 'Ville Destination',
            district: 'Quartier / Secteur',
            address: 'Adresse de livraison',
            product: 'Désignation Produit',
            quantity: 'Nbre Pièces',
            price: 'Montant CRBT',
            note: 'Instructions Livraison'
        },
        columnOrder: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'quantity', 'price', 'note'],
        staticColumns: [
            { id: 'sc-cat-1', header: 'Type Envoi', defaultValue: 'Livraison' },
            { id: 'sc-cat-2', header: 'Ouvrir Colis', defaultValue: 'OUI' }
        ]
    },
    {
        id: 'ameex',
        name: 'Ameex Express',
        companyName: 'Ameex',
        description: 'Format standard Ameex pour e-commerce COD',
        filenamePrefix: 'livraison_ameex',
        sheetName: 'Feuille1',
        enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        mapping: {
            id: 'N° Commande',
            customerName: 'Nom & Prénom',
            phone: 'Téléphone Client',
            city: 'Ville',
            district: 'Quartier',
            address: 'Adresse Complète',
            product: 'Désignation',
            price: 'Prix Total (MAD)',
            note: 'Remarque'
        },
        columnOrder: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        staticColumns: [
            { id: 'sc-amx-1', header: 'Fragile', defaultValue: 'NON' },
            { id: 'sc-amx-2', header: 'Ouvrir Colis', defaultValue: 'OUI' }
        ]
    },
    {
        id: 'ecoexpress',
        name: 'Eco-Express',
        companyName: 'Eco-Express',
        description: 'Modèle optimisé pour l\'importation Eco-Express',
        filenamePrefix: 'livraison_ecoexpress',
        sheetName: 'Colis',
        enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        mapping: {
            id: 'Référence',
            customerName: 'Nom Destinataire',
            phone: 'Téléphone',
            city: 'Ville',
            district: 'Quartier',
            address: 'Adresse',
            product: 'Marchandise',
            price: 'Montant',
            note: 'Commentaire'
        },
        columnOrder: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        staticColumns: [
            { id: 'sc-eco-1', header: 'Type', defaultValue: 'Colis' },
            { id: 'sc-eco-2', header: 'Ouvrir Colis', defaultValue: 'OUI' }
        ]
    },
    {
        id: 'ozdelivery',
        name: 'Oz-Delivery',
        companyName: 'Oz-Delivery',
        description: 'Modèle d\'importation pour Oz-Delivery COD',
        filenamePrefix: 'livraison_ozdelivery',
        sheetName: 'Sheet1',
        enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        mapping: {
            id: 'Order_No',
            customerName: 'Customer_Full_Name',
            phone: 'Contact_Number',
            city: 'Dest_City',
            district: 'District_Area',
            address: 'Shipping_Address',
            product: 'Item_Description',
            price: 'COD_Value',
            note: 'Note'
        },
        columnOrder: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        staticColumns: []
    },
    {
        id: 'sendit',
        name: 'Sendit',
        companyName: 'Sendit',
        description: 'Modèle pour plateforme Sendit Maroc',
        filenamePrefix: 'livraison_sendit',
        sheetName: 'Orders',
        enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        mapping: {
            id: 'Code_Barre',
            customerName: 'Nom_Client',
            phone: 'Telephone_Client',
            city: 'Ville_Livraison',
            district: 'Quartier',
            address: 'Adresse_Client',
            product: 'Articles',
            price: 'Prix_Total',
            note: 'Note_Livreur'
        },
        columnOrder: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        staticColumns: [
            { id: 'sc-snd-1', header: 'Service', defaultValue: 'Livraison' }
        ]
    },
    {
        id: 'ctm',
        name: 'CTM Messagerie',
        companyName: 'CTM',
        description: 'Format d\'expédition CTM Messagerie',
        filenamePrefix: 'livraison_ctm',
        sheetName: 'CTM',
        enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        mapping: {
            id: 'Réf Expéditeur',
            customerName: 'Destinataire',
            phone: 'GSM',
            city: 'Destination',
            district: 'Quartier',
            address: 'Adresse',
            product: 'Contenu',
            price: 'Valeur Déclarée',
            note: 'Observations'
        },
        columnOrder: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'price', 'note'],
        staticColumns: []
    }
];

interface LivraisonViewProps {
    orders: Order[];
}

const LivraisonView: React.FC<LivraisonViewProps> = ({ orders }) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set<string>());
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [initialEditingTemplateId, setInitialEditingTemplateId] = useState<string | null>(null);

    const [templates, setTemplates] = useState<ShippingTemplate[]>(() => DEFAULT_SHIPPING_TEMPLATES);

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
        return DEFAULT_SHIPPING_TEMPLATES[0]?.id || 'standard';
    });
    const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

    // Initial load and sync with backend API / local storage
    useEffect(() => {
        let isMounted = true;
        const loadTemplatesFromDb = async () => {
            try {
                // 1. Load from Backend API
                try {
                    const apiTemplates = await apiClient.apiFetch<ShippingTemplate[]>('/shipping-templates');
                    if (apiTemplates && apiTemplates.length > 0) {
                        if (isMounted) {
                            setTemplates(apiTemplates);
                            setIsCloudSynced(true);
                        }
                        return;
                    }
                } catch (apiErr) {
                    console.warn("API shipping templates note:", apiErr);
                }

                // 2. Check LocalStorage fallback
                try {
                    const local = localStorage.getItem('callnet_shipping_templates');
                    if (local) {
                        const parsed = JSON.parse(local);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            if (isMounted) {
                                setTemplates(parsed);
                                setIsCloudSynced(true);
                            }
                            return;
                        }
                    }
                } catch (_) {}

                // 3. Fallback to default shipping templates
                if (isMounted) {
                    setTemplates(DEFAULT_SHIPPING_TEMPLATES);
                    setIsCloudSynced(true);
                }
                try {
                    await apiClient.apiPost('/shipping-templates/bulk', { templates: DEFAULT_SHIPPING_TEMPLATES });
                } catch (_) {}
            } catch (e) {
                console.warn("Error loading shipping templates:", e);
            }
        };

        loadTemplatesFromDb();

        return () => {
            isMounted = false;
        };
    }, []);

    // Save templates to LocalStorage and Backend API
    const handleSaveTemplates = async (updated: ShippingTemplate[]) => {
        setTemplates(updated);
        setIsCloudSynced(true);

        try {
            localStorage.setItem('callnet_shipping_templates', JSON.stringify(updated));
        } catch (_) {}

        try {
            await apiClient.apiPost('/shipping-templates/bulk', { templates: updated });
        } catch (apiErr) {
            console.error("Error saving templates to API:", apiErr);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        try {
            await apiClient.apiDelete(`/shipping-templates/${id}`);
        } catch (_) {}
        try {
            const updated = templates.filter(t => t.id !== id);
            localStorage.setItem('callnet_shipping_templates', JSON.stringify(updated));
        } catch (_) {}
    };

    const activeTemplate = useMemo(() => {
        return templates.find(t => t.id === selectedTemplateId) || templates[0] || DEFAULT_SHIPPING_TEMPLATES[0];
    }, [templates, selectedTemplateId]);

    const confirmedOrders = useMemo(() => {
        return orders.filter(o => o.status === OrderStatus.Confirme && !o.archived);
    }, [orders]);

    const filteredOrders = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return confirmedOrders.filter(o => 
            String(o.id).toLowerCase().includes(query) ||
            String(o.customerName || '').toLowerCase().includes(query) ||
            String(o.phone || '').toLowerCase().includes(query) ||
            String(o.city || '').toLowerCase().includes(query)
        );
    }, [confirmedOrders, searchQuery]);

    const toggleOrderSelection = (id: string) => {
        const newSelection = new Set(selectedOrderIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedOrderIds(newSelection);
    };

    const toggleAllSelection = () => {
        if (selectedOrderIds.size === filteredOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
        }
    };

    const handleExport = () => {
        const ordersToExport = confirmedOrders.filter(o => 
            selectedOrderIds.size === 0 || selectedOrderIds.has(o.id)
        );

        if (ordersToExport.length === 0) return;

        const XLSX = (window as any).XLSX;
        if (!XLSX) return;

        const prefix = activeTemplate.filenamePrefix || `livraison_${activeTemplate.id}`;
        const filename = `${prefix}_${new Date().toISOString().split('T')[0]}`;
        const sheetTitle = activeTemplate.sheetName || "Livraisons";

        const enabledKeys = activeTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key as string);
        const orderKeys = (activeTemplate.columnOrder || ORDER_FIELDS.map(f => f.key as string))
            .filter(k => enabledKeys.includes(k));

        const staticCols = activeTemplate.staticColumns || [];

        const data = ordersToExport.map(o => {
            const row: any = {};
            
            orderKeys.forEach(key => {
                const header = activeTemplate.mapping[key] || key;
                let val = (o as any)[key];
                if (key === 'date' && val) {
                    try {
                        val = new Date(val).toLocaleDateString();
                    } catch {
                        val = String(val);
                    }
                } else if (key === 'price') {
                    val = Number(val || 0);
                } else if (val === undefined || val === null) {
                    val = '';
                }
                row[header] = val;
            });

            staticCols.forEach(sc => {
                if (sc.header) {
                    row[sc.header] = sc.defaultValue || '';
                }
            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    };

    const handleOpenParamForCurrent = () => {
        setInitialEditingTemplateId(activeTemplate.id);
        setIsManageModalOpen(true);
    };

    const handleOpenParamNew = () => {
        setInitialEditingTemplateId('__NEW__');
        setIsManageModalOpen(true);
    };

    const handleDownloadBlankTemplate = (tpl: ShippingTemplate) => {
        const XLSX = (window as any).XLSX;
        if (!XLSX) return;

        const enabledKeys = tpl.enabledKeys || ORDER_FIELDS.map(f => f.key as string);
        const orderKeys = (tpl.columnOrder || ORDER_FIELDS.map(f => f.key as string))
            .filter(k => enabledKeys.includes(k));
        const staticCols = tpl.staticColumns || [];

        const sampleRow: any = {};
        orderKeys.forEach(key => {
            const header = tpl.mapping[key] || key;
            if (key === 'id') sampleRow[header] = 'CMD-1001';
            else if (key === 'customerName') sampleRow[header] = 'Youssef El Amrani';
            else if (key === 'phone') sampleRow[header] = '0661234567';
            else if (key === 'city') sampleRow[header] = 'Casablanca';
            else if (key === 'district') sampleRow[header] = 'Gauthier';
            else if (key === 'address') sampleRow[header] = '12 Rue Zerktouni';
            else if (key === 'product') sampleRow[header] = 'Pack Cosmétique Bio';
            else if (key === 'quantity') sampleRow[header] = 1;
            else if (key === 'variant') sampleRow[header] = 'Standard';
            else if (key === 'price') sampleRow[header] = 450;
            else if (key === 'date') sampleRow[header] = new Date().toISOString().split('T')[0];
            else if (key === 'note') sampleRow[header] = 'Livrer l\'après-midi';
            else if (key === 'status') sampleRow[header] = 'confirme';
            else sampleRow[header] = '';
        });

        staticCols.forEach(sc => {
            if (sc.header) {
                sampleRow[sc.header] = sc.defaultValue || '';
            }
        });

        const worksheet = XLSX.utils.json_to_sheet([sampleRow]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, tpl.sheetName || "Modèle");
        XLSX.writeFile(workbook, `modele_${tpl.name.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary/10 p-6 rounded-xl border border-primary/20 flex items-center gap-4">
                    <div className="p-3 bg-primary text-white rounded-lg shadow-sm">
                        <ShippingIcon />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-text-secondary uppercase">{t('readyToShip')}</h4>
                        <p className="text-3xl font-black text-text-primary">{confirmedOrders.length}</p>
                    </div>
                </div>

                {/* Delivery Template Configuration Banner */}
                <div className="md:col-span-2 bg-base-200 p-5 rounded-xl border border-base-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/20 text-primary rounded-lg">
                            <SettingsIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t('deliveryCompany')}</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-primary text-white">
                                    {activeTemplate.name}
                                </span>
                                {isCloudSynced && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" title="Synchronisé dans la base de données">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Base de données
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5">
                                {(activeTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key)).length} colonnes actives
                                {activeTemplate.staticColumns && activeTemplate.staticColumns.length > 0 && ` • ${activeTemplate.staticColumns.length} colonnes fixes`}
                                {activeTemplate.description && ` • ${activeTemplate.description}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleOpenParamForCurrent}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-base-100 hover:bg-base-300 border border-base-300 rounded-lg text-xs font-bold text-text-primary transition-all shadow-sm"
                            title="Paramétrer les colonnes et le format de ce transporteur"
                        >
                            <EditIcon className="h-4 w-4 text-primary" />
                            <span>{t('parameterizeCurrentModel')}</span>
                        </button>
                        
                        <button
                            onClick={() => { setInitialEditingTemplateId(null); setIsManageModalOpen(true); }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-xs font-bold text-primary transition-all shadow-sm"
                        >
                            <SettingsIcon className="h-4 w-4" />
                            <span>{t('parameterizeDeliveryModel')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-base-200 p-4 rounded-xl shadow-sm border border-base-300 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-grow w-full">
                    <span className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                        <SearchIcon />
                    </span>
                    <input
                        type="text"
                        placeholder={t('searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-2.5 ps-10 border border-base-300 rounded-lg bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                    {/* Delivery Company / Template Selector */}
                    <div className="flex items-center gap-1.5 flex-grow sm:flex-grow-0 sm:w-72">
                        <div className="relative w-full">
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full p-2.5 pe-8 border border-base-300 rounded-lg bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary font-bold text-sm text-text-primary truncate"
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        🚚 {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button 
                            onClick={handleOpenParamForCurrent}
                            className="p-2.5 bg-base-100 hover:bg-base-300 border border-base-300 rounded-lg transition-colors text-primary"
                            title={t('parameterizeCurrentModel')}
                        >
                            <EditIcon className="h-5 w-5" />
                        </button>

                        <button 
                            onClick={handleOpenParamNew}
                            className="p-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors text-primary"
                            title="Ajouter une nouvelle société de livraison"
                        >
                            <PlusIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Export Action Button */}
                    <button
                        onClick={handleExport}
                        disabled={confirmedOrders.length === 0}
                        className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-md transition-all whitespace-nowrap ${
                            confirmedOrders.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-opacity-90 active:scale-95'
                        }`}
                    >
                        <DownloadIcon />
                        <span>{t('exportForDelivery')}</span>
                        {selectedOrderIds.size > 0 && <span>({selectedOrderIds.size})</span>}
                    </button>
                </div>
            </div>

            {/* Table of Confirmed Orders */}
            {filteredOrders.length > 0 ? (
                <div className="bg-base-200 shadow-md rounded-lg overflow-x-auto border border-base-300">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-base-300/60 text-text-primary uppercase">
                            <tr>
                                <th className="py-3 px-4 w-10">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                                        onChange={toggleAllSelection}
                                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                    />
                                </th>
                                <th className="py-3 px-4 font-semibold w-32">{t('orderId')}</th>
                                <th className="py-3 px-4 font-semibold">{t('customer')}</th>
                                <th className="py-3 px-4 font-semibold w-40">{t('phoneLabel')}</th>
                                <th className="py-3 px-4 font-semibold w-32">{t('city')}</th>
                                <th className="py-3 px-4 font-semibold">{t('address')}</th>
                                <th className="py-3 px-4 font-semibold text-right w-24">{t('price')}</th>
                            </tr>
                        </thead>
                        <tbody className="text-text-secondary divide-y divide-base-300/50">
                            {filteredOrders.map(order => (
                                <tr 
                                    key={order.id} 
                                    className={`hover:bg-base-100 transition-colors cursor-pointer ${selectedOrderIds.has(order.id) ? 'bg-primary/5' : ''}`}
                                    onClick={() => toggleOrderSelection(order.id)}
                                >
                                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedOrderIds.has(order.id)}
                                            onChange={() => toggleOrderSelection(order.id)}
                                            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                        />
                                    </td>
                                    <td className="py-3 px-4 font-bold text-text-primary">#{order.id}</td>
                                    <td className="py-3 px-4 font-medium">{order.customerName}</td>
                                    <td className="py-3 px-4 font-mono">{order.phone}</td>
                                    <td className="py-3 px-4">{order.city}</td>
                                    <td className="py-3 px-4 truncate max-w-xs" title={order.address}>{order.address}</td>
                                    <td className="py-3 px-4 text-right font-black text-primary">{Number(order.price).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-20 bg-base-200 rounded-xl border-2 border-dashed border-base-300">
                    <div className="flex justify-center mb-4 text-gray-400">
                         <ShippingIcon className="h-16 w-16" />
                    </div>
                    <p className="text-text-secondary font-medium">{t('noConfirmedOrders')}</p>
                </div>
            )}

            {/* Template Parameterization Modal */}
            {isManageModalOpen && (
                <TemplateManagerModal 
                    templates={templates} 
                    initialTemplateId={initialEditingTemplateId}
                    onSave={(updated) => {
                        handleSaveTemplates(updated);
                        if (!updated.some(t => t.id === selectedTemplateId)) {
                            setSelectedTemplateId(updated[0]?.id || 'standard');
                        }
                    }} 
                    onDelete={(id) => {
                        handleDeleteTemplate(id);
                    }}
                    onDownloadBlank={handleDownloadBlankTemplate}
                    onClose={() => {
                        setIsManageModalOpen(false);
                        setInitialEditingTemplateId(null);
                    }} 
                />
            )}
        </div>
    );
};

// --- Template Management Modal Component ---

interface TemplateManagerModalProps {
    templates: ShippingTemplate[];
    initialTemplateId: string | null;
    onSave: (ts: ShippingTemplate[]) => void;
    onDelete?: (id: string) => void;
    onDownloadBlank: (tpl: ShippingTemplate) => void;
    onClose: () => void;
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ 
    templates, 
    initialTemplateId, 
    onSave, 
    onDelete,
    onDownloadBlank,
    onClose 
}) => {
    const { t } = useLanguage();
    const [editingTemplate, setEditingTemplate] = useState<ShippingTemplate | null>(() => {
        if (initialTemplateId === '__NEW__') {
            return {
                id: `template-${Date.now()}`,
                name: 'Nouveau Transporteur',
                companyName: '',
                description: '',
                mapping: ORDER_FIELDS.reduce((acc, f) => {
                    acc[f.key] = f.label;
                    return acc;
                }, {} as Record<string, string>),
                columnOrder: ORDER_FIELDS.map(f => f.key as string),
                enabledKeys: ORDER_FIELDS.map(f => f.key as string),
                staticColumns: [],
                filenamePrefix: 'livraison_export',
                sheetName: 'Livraisons'
            };
        }
        if (initialTemplateId) {
            const found = templates.find(t => t.id === initialTemplateId);
            if (found) return JSON.parse(JSON.stringify(found));
        }
        return templates[0] ? JSON.parse(JSON.stringify(templates[0])) : null;
    });

    const [isAILoading, setIsAILoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'columns' | 'static' | 'preview'>('columns');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSelectTemplate = (tpl: ShippingTemplate) => {
        setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
    };

    const handleNewTemplate = () => {
        setEditingTemplate({
            id: `template-${Date.now()}`,
            name: 'Nouveau Transporteur',
            companyName: '',
            description: '',
            mapping: {
                id: 'ID / Réf',
                customerName: 'Destinataire',
                phone: 'Téléphone',
                city: 'Ville',
                district: 'Quartier',
                address: 'Adresse',
                product: 'Produit',
                quantity: 'Qté',
                price: 'Prix (MAD)',
                note: 'Commentaire'
            },
            columnOrder: ORDER_FIELDS.map(f => f.key as string),
            enabledKeys: ['id', 'customerName', 'phone', 'city', 'district', 'address', 'product', 'quantity', 'price', 'note'],
            staticColumns: [],
            filenamePrefix: 'livraison_export',
            sheetName: 'Livraisons'
        });
    };

    const handleDuplicate = (tpl: ShippingTemplate) => {
        const copy: ShippingTemplate = {
            ...JSON.parse(JSON.stringify(tpl)),
            id: `template-${Date.now()}`,
            name: `${tpl.name} (Copie)`,
            filenamePrefix: `${tpl.filenamePrefix || 'livraison'}_copie`
        };
        setEditingTemplate(copy);
    };

    const handleLoadPreset = (preset: ShippingTemplate) => {
        const newId = editingTemplate?.id || `template-${Date.now()}`;
        setEditingTemplate({
            ...JSON.parse(JSON.stringify(preset)),
            id: newId
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const XLSX = (window as any).XLSX;
            if (!XLSX) return;

            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            if (json.length > 0) {
                const headers = json[0] as string[];
                const validHeaders = headers.filter(h => !!h && String(h).trim() !== '');
                
                const newId = editingTemplate?.id || `template-${Date.now()}`;
                const baseName = editingTemplate?.name || file.name.split('.')[0];
                
                setIsAILoading(true);
                try {
                    const suggestions = await suggestColumnMapping(
                        validHeaders, 
                        ORDER_FIELDS.map(f => ({ key: f.key, label: f.label }))
                    );
                    
                    const newMapping: Record<string, string> = {};
                    const enabled: string[] = [];

                    ORDER_FIELDS.forEach(f => {
                        const matchedHeader = suggestions[f.key];
                        if (matchedHeader && validHeaders.includes(matchedHeader)) {
                            newMapping[f.key] = matchedHeader;
                            enabled.push(f.key);
                        } else {
                            newMapping[f.key] = f.label;
                        }
                    });

                    // Check for headers that might be static columns
                    const matchedHeaderValues = Object.values(newMapping);
                    const unmatchedHeaders = validHeaders.filter(h => !matchedHeaderValues.includes(h));
                    const detectedStaticColumns: StaticColumn[] = unmatchedHeaders.map((h, i) => ({
                        id: `sc-auto-${Date.now()}-${i}`,
                        header: h,
                        defaultValue: ''
                    }));
                    
                    setEditingTemplate({
                        id: newId,
                        name: baseName,
                        companyName: baseName,
                        description: `Modèle importé depuis ${file.name}`,
                        mapping: newMapping,
                        columnOrder: ORDER_FIELDS.map(f => f.key as string),
                        enabledKeys: enabled.length > 0 ? enabled : ORDER_FIELDS.map(f => f.key as string),
                        staticColumns: detectedStaticColumns,
                        filenamePrefix: `livraison_${baseName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                        sheetName: sheetName || 'Livraisons'
                    });
                } catch (err) {
                    console.error("AI Mapping failed", err);
                    setEditingTemplate({
                        id: newId,
                        name: baseName,
                        companyName: baseName,
                        description: `Modèle importé depuis ${file.name}`,
                        mapping: ORDER_FIELDS.reduce((acc, f) => {
                            acc[f.key] = f.label;
                            return acc;
                        }, {} as Record<string, string>),
                        columnOrder: ORDER_FIELDS.map(f => f.key as string),
                        enabledKeys: ORDER_FIELDS.map(f => f.key as string),
                        staticColumns: [],
                        filenamePrefix: `livraison_${baseName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                        sheetName: sheetName || 'Livraisons'
                    });
                } finally {
                    setIsAILoading(false);
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSaveCurrent = () => {
        if (!editingTemplate || !editingTemplate.name.trim()) return;
        
        const exists = templates.some(t => t.id === editingTemplate.id);
        let updated: ShippingTemplate[];
        if (exists) {
            updated = templates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
        } else {
            updated = [...templates, editingTemplate];
        }
        onSave(updated);
        onClose();
    };

    const handleDelete = (id: string) => {
        if (templates.length <= 1) {
            alert("Vous devez conserver au moins un modèle de livraison.");
            return;
        }
        if (window.confirm(t('confirmDeleteTemplate'))) {
            const updated = templates.filter(t => t.id !== id);
            onSave(updated);
            if (onDelete) {
                onDelete(id);
            }
            if (editingTemplate?.id === id) {
                setEditingTemplate(updated[0] || null);
            }
        }
    };

    const toggleFieldEnabled = (fieldKey: string) => {
        if (!editingTemplate) return;
        const currentEnabled = editingTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key as string);
        let nextEnabled: string[];
        if (currentEnabled.includes(fieldKey)) {
            nextEnabled = currentEnabled.filter(k => k !== fieldKey);
        } else {
            nextEnabled = [...currentEnabled, fieldKey];
        }
        setEditingTemplate({
            ...editingTemplate,
            enabledKeys: nextEnabled
        });
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (!editingTemplate) return;
        const order = [...(editingTemplate.columnOrder || ORDER_FIELDS.map(f => f.key as string))];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex < 0 || targetIndex >= order.length) return;
        
        const temp = order[index];
        order[index] = order[targetIndex];
        order[targetIndex] = temp;
        
        setEditingTemplate({ ...editingTemplate, columnOrder: order });
    };

    const addStaticColumn = () => {
        if (!editingTemplate) return;
        const newCol: StaticColumn = {
            id: `sc-${Date.now()}`,
            header: 'Type Envoi',
            defaultValue: 'Livraison'
        };
        setEditingTemplate({
            ...editingTemplate,
            staticColumns: [...(editingTemplate.staticColumns || []), newCol]
        });
    };

    const updateStaticColumn = (id: string, updates: Partial<StaticColumn>) => {
        if (!editingTemplate) return;
        const updated = (editingTemplate.staticColumns || []).map(sc => 
            sc.id === id ? { ...sc, ...updates } : sc
        );
        setEditingTemplate({ ...editingTemplate, staticColumns: updated });
    };

    const removeStaticColumn = (id: string) => {
        if (!editingTemplate) return;
        const updated = (editingTemplate.staticColumns || []).filter(sc => sc.id !== id);
        setEditingTemplate({ ...editingTemplate, staticColumns: updated });
    };

    const orderedFields = useMemo(() => {
        if (!editingTemplate) return [];
        const order = [...(editingTemplate.columnOrder || ORDER_FIELDS.map(f => f.key as string))];
        ORDER_FIELDS.forEach(f => {
            if (!order.includes(f.key as string)) {
                if (f.key === 'district') {
                    const cityIdx = order.indexOf('city');
                    if (cityIdx !== -1) order.splice(cityIdx + 1, 0, 'district');
                    else order.push('district');
                } else {
                    order.push(f.key as string);
                }
            }
        });
        return order.map(key => ORDER_FIELDS.find(f => f.key === key)).filter(Boolean);
    }, [editingTemplate]);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-base-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-base-300 animate-in fade-in zoom-in duration-200">
                {/* Modal Header */}
                <div className="p-5 border-b border-base-300 flex justify-between items-center bg-base-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary text-white rounded-xl shadow-sm">
                            <ShippingIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">
                                {t('parameterizeDeliveryModel')}
                            </h2>
                            <p className="text-xs text-text-secondary">
                                Personnalisez les en-têtes, l'ordre et les colonnes fixes pour chaque transporteur
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full hover:bg-base-200 text-text-secondary transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left Sidebar: Templates List & Presets */}
                    <div className="w-full md:w-72 bg-base-200/80 border-r border-base-300 p-4 flex flex-col gap-3 overflow-y-auto">
                        <div className="flex gap-2">
                            <button 
                                onClick={handleNewTemplate}
                                className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-sm active:scale-95"
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span>{t('addTemplate')}</span>
                            </button>

                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm active:scale-95"
                                title="Importer un fichier modèle Excel (.xlsx)"
                            >
                                <UploadIcon className="h-4 w-4" />
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                accept=".xlsx, .xls, .csv" 
                                className="hidden" 
                            />
                        </div>

                        {/* Presets dropdown / Quick load */}
                        <div className="p-3 bg-base-100 rounded-xl border border-base-300 space-y-2">
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-wider block">
                                {t('quickPresets')}
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                                {DEFAULT_SHIPPING_TEMPLATES.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleLoadPreset(p)}
                                        className="p-1.5 text-[11px] font-bold bg-base-200 hover:bg-primary hover:text-white rounded-md text-left truncate transition-colors"
                                        title={`Charger le préréglage ${p.name}`}
                                    >
                                        {p.name.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List of active templates */}
                        <div className="space-y-1.5 flex-1 overflow-y-auto">
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-wider block px-1">
                                {t('deliveryModels')} ({templates.length})
                            </span>
                            {templates.map(t => {
                                const isSelected = editingTemplate?.id === t.id;
                                return (
                                    <div 
                                        key={t.id} 
                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                                                : 'bg-base-100 border-base-300 hover:border-primary/40 text-text-primary'
                                        }`}
                                        onClick={() => handleSelectTemplate(t)}
                                    >
                                        <div className="min-w-0 flex-1 pe-2">
                                            <p className="font-black text-xs truncate uppercase tracking-tight">{t.name}</p>
                                            <p className="text-[10px] text-text-secondary truncate mt-0.5">
                                                {(t.enabledKeys || ORDER_FIELDS.map(f => f.key)).length} cols
                                                {t.staticColumns && t.staticColumns.length > 0 && ` • ${t.staticColumns.length} fixes`}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }}
                                                className="p-1 text-text-secondary hover:text-primary rounded hover:bg-base-200 transition-colors"
                                                title="Dupliquer"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                                className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                                title="Supprimer"
                                            >
                                                <DeleteIcon />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Main Editor Area */}
                    <div className="flex-1 bg-base-100 flex flex-col overflow-hidden relative">
                        {isAILoading && (
                            <div className="absolute inset-0 bg-base-100/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4 animate-in fade-in">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="font-black text-primary uppercase tracking-widest text-xs animate-pulse">
                                    Analyse IA du fichier modèle en cours...
                                </p>
                            </div>
                        )}

                        {editingTemplate ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Top template info fields */}
                                <div className="p-4 border-b border-base-300 bg-base-200/50 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-black text-text-secondary mb-1 uppercase tracking-wider">
                                                {t('deliveryCompanyLabel')} *
                                            </label>
                                            <input 
                                                type="text" 
                                                value={editingTemplate.name}
                                                onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                                className="w-full p-2 border border-base-300 rounded-lg bg-base-100 font-bold text-sm text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
                                                placeholder="Ex: Ameex Express, Cat Logistics..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-black text-text-secondary mb-1 uppercase tracking-wider">
                                                {t('filenamePrefixLabel')}
                                            </label>
                                            <input 
                                                type="text" 
                                                value={editingTemplate.filenamePrefix || ''}
                                                onChange={e => setEditingTemplate({...editingTemplate, filenamePrefix: e.target.value})}
                                                className="w-full p-2 border border-base-300 rounded-lg bg-base-100 text-xs font-mono text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
                                                placeholder="livraison_nom"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-black text-text-secondary mb-1 uppercase tracking-wider">
                                                {t('sheetNameLabel')}
                                            </label>
                                            <input 
                                                type="text" 
                                                value={editingTemplate.sheetName || ''}
                                                onChange={e => setEditingTemplate({...editingTemplate, sheetName: e.target.value})}
                                                className="w-full p-2 border border-base-300 rounded-lg bg-base-100 text-xs font-mono text-text-primary focus:ring-2 focus:ring-primary focus:outline-none"
                                                placeholder="Livraisons"
                                            />
                                        </div>
                                    </div>

                                    {/* Navigation Tabs */}
                                    <div className="flex items-center gap-2 pt-1 border-t border-base-300/60">
                                        <button
                                            onClick={() => setActiveTab('columns')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                                                activeTab === 'columns' 
                                                    ? 'bg-primary text-white shadow-sm' 
                                                    : 'bg-base-100 text-text-secondary hover:text-text-primary'
                                            }`}
                                        >
                                            1. En-têtes & Ordre des Colonnes ({(editingTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key)).length})
                                        </button>

                                        <button
                                            onClick={() => setActiveTab('static')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                                                activeTab === 'static' 
                                                    ? 'bg-primary text-white shadow-sm' 
                                                    : 'bg-base-100 text-text-secondary hover:text-text-primary'
                                            }`}
                                        >
                                            2. Colonnes Fixes / Statiques ({(editingTemplate.staticColumns || []).length})
                                        </button>

                                        <button
                                            onClick={() => setActiveTab('preview')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                                                activeTab === 'preview' 
                                                    ? 'bg-primary text-white shadow-sm' 
                                                    : 'bg-base-100 text-text-secondary hover:text-text-primary'
                                            }`}
                                        >
                                            3. {t('exportPreview')}
                                        </button>
                                    </div>
                                </div>

                                {/* Tab Content Area */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {activeTab === 'columns' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <span className="text-xs font-bold text-text-secondary">
                                                    Cochez les colonnes à inclure et nommez chaque en-tête tel qu'exigé par votre transporteur :
                                                </span>
                                                <span className="text-[11px] text-text-secondary font-mono">
                                                    {(editingTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key)).length} / {ORDER_FIELDS.length} sélectionnées
                                                </span>
                                            </div>

                                            <div className="space-y-2 max-h-[48vh] overflow-y-auto pe-2">
                                                {orderedFields.map((field, index) => {
                                                    if (!field) return null;
                                                    const isEnabled = (editingTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key as string)).includes(field.key as string);
                                                    const customHeader = editingTemplate.mapping[field.key] || '';

                                                    return (
                                                        <div 
                                                            key={field.key} 
                                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                                                isEnabled 
                                                                    ? 'bg-base-200 border-base-300 hover:border-primary/40' 
                                                                    : 'bg-base-200/40 border-dashed border-base-300 opacity-60'
                                                            }`}
                                                        >
                                                            {/* Enable checkbox */}
                                                            <input 
                                                                type="checkbox"
                                                                checked={isEnabled}
                                                                onChange={() => toggleFieldEnabled(field.key as string)}
                                                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                                                title="Activer/Désactiver cette colonne dans l'export"
                                                            />

                                                            {/* Move Up/Down */}
                                                            <div className="flex flex-col gap-1">
                                                                <button 
                                                                    disabled={index === 0}
                                                                    onClick={() => moveField(index, 'up')}
                                                                    className="text-text-secondary hover:text-primary disabled:opacity-20 transition-colors"
                                                                    title={t('moveUp')}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
                                                                    </svg>
                                                                </button>
                                                                <button 
                                                                    disabled={index === orderedFields.length - 1}
                                                                    onClick={() => moveField(index, 'down')}
                                                                    className="text-text-secondary hover:text-primary disabled:opacity-20 transition-colors"
                                                                    title={t('moveDown')}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </button>
                                                            </div>

                                                            {/* Index and system label */}
                                                            <div className="w-40 flex-shrink-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-mono font-bold bg-base-300 px-1.5 py-0.5 rounded text-text-secondary">
                                                                        #{index + 1}
                                                                    </span>
                                                                    <span className="text-xs font-bold text-text-primary truncate">
                                                                        {field.label}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-mono text-text-secondary">
                                                                    system: {field.key}
                                                                </span>
                                                            </div>

                                                            {/* Arrow */}
                                                            <span className="text-text-secondary text-xs">➔</span>

                                                            {/* Custom Excel Header input */}
                                                            <div className="flex-1">
                                                                <input 
                                                                    type="text" 
                                                                    value={customHeader}
                                                                    onChange={e => setEditingTemplate({
                                                                        ...editingTemplate,
                                                                        mapping: {
                                                                            ...editingTemplate.mapping,
                                                                            [field.key]: e.target.value
                                                                        }
                                                                    })}
                                                                    placeholder={`Nom de colonne dans l'Excel (${field.label})`}
                                                                    className={`w-full p-2 text-xs border rounded-lg bg-base-100 focus:outline-none focus:ring-1 focus:ring-primary ${
                                                                        customHeader ? 'font-bold text-text-primary border-base-300' : 'border-dashed border-gray-300 text-gray-400'
                                                                    }`}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'static' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
                                                <div>
                                                    <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">
                                                        Colonnes Fixes / Statiques demandées par le transporteur
                                                    </h4>
                                                    <p className="text-xs text-text-secondary mt-0.5">
                                                        Ces colonnes seront ajoutées à chaque ligne de l'Excel avec une valeur constante (ex: Type Envoi = "Livraison", Ouvrir = "OUI", etc.)
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={addStaticColumn}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-sm"
                                                >
                                                    <PlusIcon className="h-4 w-4" />
                                                    <span>{t('addStaticColumn')}</span>
                                                </button>
                                            </div>

                                            {editingTemplate.staticColumns && editingTemplate.staticColumns.length > 0 ? (
                                                <div className="space-y-2">
                                                    {editingTemplate.staticColumns.map((sc, i) => (
                                                        <div key={sc.id} className="flex items-center gap-3 p-3 bg-base-200 rounded-xl border border-base-300">
                                                            <span className="text-xs font-mono font-bold text-text-secondary w-6">
                                                                +{i + 1}
                                                            </span>

                                                            <div className="flex-1">
                                                                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                                                                    {t('staticColumnHeader')}
                                                                </label>
                                                                <input 
                                                                    type="text" 
                                                                    value={sc.header}
                                                                    onChange={e => updateStaticColumn(sc.id, { header: e.target.value })}
                                                                    placeholder="Ex: Type Envoi, Fragile, Ouvrir Colis"
                                                                    className="w-full p-2 text-xs font-bold border border-base-300 rounded-lg bg-base-100 focus:ring-1 focus:ring-primary focus:outline-none"
                                                                />
                                                            </div>

                                                            <div className="flex-1">
                                                                <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                                                                    {t('staticColumnValue')}
                                                                </label>
                                                                <input 
                                                                    type="text" 
                                                                    value={sc.defaultValue}
                                                                    onChange={e => updateStaticColumn(sc.id, { defaultValue: e.target.value })}
                                                                    placeholder="Ex: Livraison, OUI, NON"
                                                                    className="w-full p-2 text-xs font-semibold border border-base-300 rounded-lg bg-base-100 focus:ring-1 focus:ring-primary focus:outline-none"
                                                                />
                                                            </div>

                                                            <button
                                                                onClick={() => removeStaticColumn(sc.id)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-4"
                                                                title="Supprimer cette colonne fixe"
                                                            >
                                                                <DeleteIcon />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 bg-base-200/50 rounded-xl border-2 border-dashed border-base-300">
                                                    <p className="text-xs text-text-secondary">
                                                        Aucune colonne fixe configurée pour ce modèle.
                                                    </p>
                                                    <button
                                                        onClick={addStaticColumn}
                                                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-base-100 hover:bg-base-300 border border-base-300 rounded-lg text-xs font-bold text-primary transition-colors"
                                                    >
                                                        <PlusIcon className="h-4 w-4" />
                                                        <span>Ajouter une première colonne fixe</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'preview' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-base-200 p-3 rounded-xl border border-base-300">
                                                <div>
                                                    <p className="text-xs font-bold text-text-primary">
                                                        Aperçu des en-têtes et du format du fichier Excel généré
                                                    </p>
                                                    <p className="text-[11px] text-text-secondary">
                                                        Fichier: <span className="font-mono">{editingTemplate.filenamePrefix || 'livraison'}_{new Date().toISOString().split('T')[0]}.xlsx</span> • Feuille: <span className="font-mono">{editingTemplate.sheetName || 'Livraisons'}</span>
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => onDownloadBlank(editingTemplate)}
                                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                                >
                                                    <DownloadIcon className="h-4 w-4" />
                                                    <span>{t('downloadTestTemplate')}</span>
                                                </button>
                                            </div>

                                            {/* Live Preview Table */}
                                            <div className="border border-base-300 rounded-xl overflow-x-auto shadow-inner bg-base-100">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-primary/10 text-primary font-black uppercase tracking-wider border-b border-base-300">
                                                        <tr>
                                                            {(editingTemplate.columnOrder || ORDER_FIELDS.map(f => f.key as string))
                                                                .filter(k => (editingTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key as string)).includes(k))
                                                                .map(k => (
                                                                    <th key={k} className="p-3 whitespace-nowrap border-r border-base-300/50">
                                                                        {editingTemplate.mapping[k] || k}
                                                                    </th>
                                                                ))}
                                                            {(editingTemplate.staticColumns || []).map(sc => (
                                                                <th key={sc.id} className="p-3 whitespace-nowrap bg-emerald-500/10 text-emerald-700 font-black border-r border-base-300/50">
                                                                    {sc.header} <span className="text-[9px] lowercase font-normal">(fixe)</span>
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-base-300/50 font-mono text-[11px] text-text-secondary">
                                                        <tr className="hover:bg-base-200/50">
                                                            {(editingTemplate.columnOrder || ORDER_FIELDS.map(f => f.key as string))
                                                                .filter(k => (editingTemplate.enabledKeys || ORDER_FIELDS.map(f => f.key as string)).includes(k))
                                                                .map(k => {
                                                                    let val = 'Exemple';
                                                                    if (k === 'id') val = 'CMD-1001';
                                                                    else if (k === 'customerName') val = 'Youssef El Amrani';
                                                                    else if (k === 'phone') val = '0661234567';
                                                                    else if (k === 'city') val = 'Casablanca';
                                                                    else if (k === 'district') val = 'Gauthier';
                                                                    else if (k === 'address') val = '12 Rue Zerktouni';
                                                                    else if (k === 'product') val = 'Pack Cosmétique Bio';
                                                                    else if (k === 'quantity') val = '1';
                                                                    else if (k === 'variant') val = 'Standard';
                                                                    else if (k === 'price') val = '450.00';
                                                                    else if (k === 'date') val = new Date().toISOString().split('T')[0];
                                                                    else if (k === 'note') val = 'Livrer l\'après-midi';
                                                                    else if (k === 'status') val = 'confirme';
                                                                    return (
                                                                        <td key={k} className="p-3 whitespace-nowrap border-r border-base-300/50">
                                                                            {val}
                                                                        </td>
                                                                    );
                                                                })}
                                                            {(editingTemplate.staticColumns || []).map(sc => (
                                                                <td key={sc.id} className="p-3 whitespace-nowrap font-bold text-emerald-700 bg-emerald-50/40 border-r border-base-300/50">
                                                                    {sc.defaultValue || '—'}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Modal Footer with Actions */}
                                <div className="p-4 border-t border-base-300 bg-base-200/60 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => onDownloadBlank(editingTemplate)}
                                            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-base-100 hover:bg-base-300 border border-base-300 rounded-lg text-xs font-bold text-text-primary transition-colors"
                                        >
                                            <DownloadIcon className="h-4 w-4" />
                                            <span>{t('downloadTestTemplate')}</span>
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={onClose} 
                                            className="px-5 py-2 rounded-lg text-xs font-bold text-text-secondary hover:bg-base-300 transition-colors"
                                        >
                                            {t('cancel')}
                                        </button>
                                        <button 
                                            onClick={handleSaveCurrent}
                                            className="flex items-center gap-2 px-6 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-opacity-90 shadow-md transition-all active:scale-95"
                                        >
                                            <CheckIcon className="h-4 w-4" />
                                            <span>{t('saveTemplate')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-secondary">
                                <ShippingIcon className="h-16 w-16 opacity-30 mb-4" />
                                <h3 className="text-base font-black text-text-primary uppercase tracking-tight">
                                    Sélectionnez ou créez un modèle de transporteur
                                </h3>
                                <p className="text-xs text-text-secondary max-w-sm mt-1">
                                    Choisissez un modèle dans la liste à gauche ou cliquez sur "+ Ajouter un Modèle" pour paramétrer les colonnes Excel de votre société de livraison.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LivraisonView;
