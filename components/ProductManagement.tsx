import React, { useState, useMemo } from 'react';
import { 
    Package, 
    Plus, 
    Search, 
    ExternalLink, 
    Edit2, 
    Trash2, 
    CheckCircle2, 
    AlertCircle, 
    TrendingUp, 
    MessageSquareQuote, 
    Sparkles, 
    Globe, 
    Image as ImageIcon, 
    Layers, 
    DollarSign, 
    Tag, 
    Info, 
    X,
    Eye,
    FileText,
    Copy,
    Check,
    Bot,
    Zap,
    RefreshCw,
    CheckSquare,
    Square,
    Loader2,
    Sliders,
    ShoppingBag,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Product, Role, Order } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, getStoredOrders } from '../lib/db';
import { smartScanProductsWithAI, ScannedProductItem } from '../lib/gemini';

interface ProductManagementProps {
    products: Product[];
    orders?: Order[];
    onUpdateProducts: (products: Product[]) => void;
}

const PRESET_SAMPLE_IMAGES = [
    { label: 'Beauté / Cosmétique', url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80' },
    { label: 'Montre / Accessoire', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80' },
    { label: 'High-Tech / Audio', url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80' },
    { label: 'Maison / Déco', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80' },
    { label: 'Vêtements / Mode', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80' },
];

export const ProductManagement: React.FC<ProductManagementProps> = ({
    products,
    orders = [],
    onUpdateProducts
}) => {
    const { currentUser } = useAuth();
    const { t } = useLanguage();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Smart Scan AI state
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isSavingScanned, setIsSavingScanned] = useState(false);
    const [scannedItems, setScannedItems] = useState<ScannedProductItem[]>([]);
    const [scanMeta, setScanMeta] = useState<{
        totalOrdersScanned: number;
        alreadyExistingCount: number;
        source: 'gemini' | 'heuristic';
    } | null>(null);
    const [scanSearchTerm, setScanSearchTerm] = useState('');
    const [expandedPitchIndex, setExpandedPitchIndex] = useState<number | null>(null);

    const isClient = currentUser?.role === Role.Client;
    const isAgent = currentUser?.role === Role.Agent;
    const isAdmin = currentUser?.role === Role.Admin;
    const canEdit = isClient || isAdmin;

    // Form state
    const [formName, setFormName] = useState('');
    const [formSku, setFormSku] = useState('');
    const [formPrice, setFormPrice] = useState<string>('');
    const [formRegularPrice, setFormRegularPrice] = useState<string>('');
    const [formProductUrl, setFormProductUrl] = useState('');
    const [formImageUrl, setFormImageUrl] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formConfirmationPitch, setFormConfirmationPitch] = useState('');
    const [formUpsellOffer, setFormUpsellOffer] = useState('');
    const [formStock, setFormStock] = useState<string>('50');
    const [formCategory, setFormCategory] = useState('');

    // Available categories from existing products
    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => {
            if (p.category && p.category.trim()) set.add(p.category.trim());
        });
        return Array.from(set);
    }, [products]);

    // Filtered products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = 
                !searchTerm ||
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategory]);

    // Filtered scanned items
    const filteredScannedItems = useMemo(() => {
        if (!scanSearchTerm) return scannedItems;
        return scannedItems.filter(item => 
            item.name.toLowerCase().includes(scanSearchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(scanSearchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(scanSearchTerm.toLowerCase())
        );
    }, [scannedItems, scanSearchTerm]);

    const selectedScannedCount = useMemo(() => {
        return scannedItems.filter(item => item.selected !== false).length;
    }, [scannedItems]);

    // --- Smart Scan AI Handlers ---
    const handleOpenSmartScan = async () => {
        setIsScanModalOpen(true);
        await runSmartScan();
    };

    const runSmartScan = async () => {
        setIsScanning(true);
        setScannedItems([]);
        setScanMeta(null);
        setScanSearchTerm('');

        try {
            // Determine order source (from props or local DB)
            let ordersToScan = orders;
            if (!ordersToScan || ordersToScan.length === 0) {
                const stored = getStoredOrders();
                ordersToScan = stored;
            }

            // Filter for current client if applicable
            if (isClient && currentUser?.id) {
                ordersToScan = ordersToScan.filter(o => !o.clientId || o.clientId === currentUser.id);
            }

            const result = await smartScanProductsWithAI(
                ordersToScan,
                products,
                currentUser?.name
            );

            setScannedItems(result.scannedProducts);
            setScanMeta({
                totalOrdersScanned: result.totalOrdersScanned,
                alreadyExistingCount: result.alreadyExistingCount,
                source: result.source
            });
        } catch (err: any) {
            console.error("Smart scan failed:", err);
            setStatusMessage({ type: 'error', text: 'Erreur lors de l\'analyse des commandes par l\'IA.' });
        } finally {
            setIsScanning(false);
        }
    };

    const handleToggleSelectAllScanned = (select: boolean) => {
        setScannedItems(prev => prev.map(item => ({ ...item, selected: select })));
    };

    const handleToggleScannedItem = (index: number) => {
        setScannedItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], selected: !next[index].selected };
            return next;
        });
    };

    const handleUpdateScannedItem = (index: number, field: keyof ScannedProductItem, value: any) => {
        setScannedItems(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleConfirmImportScanned = async () => {
        const toImport = scannedItems.filter(item => item.selected !== false);
        if (toImport.length === 0) {
            alert('Veuillez sélectionner au moins un produit à importer.');
            return;
        }

        setIsSavingScanned(true);
        try {
            const defaultClientId = isClient && currentUser ? currentUser.id : 'store-1';
            const defaultClientName = isClient && currentUser ? currentUser.name : 'Boutique Principale';

            const newProductsToSave: Product[] = toImport.map((item, idx) => ({
                id: item.id || `PRD-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                name: item.name.trim(),
                sku: item.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                price: Number(item.price) || 0,
                regularPrice: item.regularPrice ? Number(item.regularPrice) : undefined,
                productUrl: item.productUrl || '',
                imageUrl: item.imageUrl || '',
                description: item.description || '',
                confirmationPitch: item.confirmationPitch || '',
                upsellOffer: item.upsellOffer || '',
                stock: Number(item.stock !== undefined ? item.stock : 50),
                category: item.category || 'Général',
                clientId: defaultClientId,
                clientName: defaultClientName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));

            // Save in bulk to backend & local storage
            const savedList = await db.products.saveBulk(newProductsToSave);
            
            // Merge with existing products state
            const existingMap = new Map(products.map(p => [p.id, p]));
            savedList.forEach(p => existingMap.set(p.id, p));
            const mergedList = Array.from(existingMap.values());

            onUpdateProducts(mergedList);
            setIsScanModalOpen(false);
            setStatusMessage({
                type: 'success',
                text: `✨ ${savedList.length} produit(s) scanné(s) et ajouté(s) au catalogue avec succès !`
            });
        } catch (err: any) {
            console.error("Error saving scanned products:", err);
            setStatusMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement des produits.' });
        } finally {
            setIsSavingScanned(false);
        }
    };

    const openCreateModal = () => {
        setEditingProduct(null);
        setFormName('');
        setFormSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
        setFormPrice('');
        setFormRegularPrice('');
        setFormProductUrl('');
        setFormImageUrl('');
        setFormDescription('');
        setFormConfirmationPitch('');
        setFormUpsellOffer('');
        setFormStock('50');
        setFormCategory('Général');
        setIsModalOpen(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormName(product.name);
        setFormSku(product.sku || '');
        setFormPrice(String(product.price || ''));
        setFormRegularPrice(product.regularPrice ? String(product.regularPrice) : '');
        setFormProductUrl(product.productUrl || '');
        setFormImageUrl(product.imageUrl || '');
        setFormDescription(product.description || '');
        setFormConfirmationPitch(product.confirmationPitch || '');
        setFormUpsellOffer(product.upsellOffer || '');
        setFormStock(String(product.stock !== undefined ? product.stock : 50));
        setFormCategory(product.category || 'Général');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            setStatusMessage({ type: 'error', text: 'Le nom du produit est obligatoire.' });
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        const priceNum = parseFloat(formPrice) || 0;
        const regPriceNum = formRegularPrice ? parseFloat(formRegularPrice) : undefined;
        const stockNum = parseInt(formStock, 10) || 0;

        const productData: Product = {
            id: editingProduct ? editingProduct.id : `PRD-${Date.now()}`,
            name: formName.trim(),
            sku: formSku.trim() || undefined,
            price: priceNum,
            regularPrice: regPriceNum,
            productUrl: formProductUrl.trim() || undefined,
            imageUrl: formImageUrl.trim() || undefined,
            description: formDescription.trim() || undefined,
            confirmationPitch: formConfirmationPitch.trim() || undefined,
            upsellOffer: formUpsellOffer.trim() || undefined,
            stock: stockNum,
            category: formCategory.trim() || 'Général',
            clientId: isClient && currentUser ? currentUser.id : (editingProduct?.clientId || 'store-1'),
            clientName: isClient && currentUser ? currentUser.name : (editingProduct?.clientName || 'Boutique'),
            createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await db.products.save(productData);
            
            let updatedList: Product[];
            if (editingProduct) {
                updatedList = products.map(p => p.id === productData.id ? productData : p);
            } else {
                updatedList = [productData, ...products];
            }

            onUpdateProducts(updatedList);
            setIsModalOpen(false);
            setStatusMessage({ 
                type: 'success', 
                text: editingProduct ? 'Produit mis à jour avec succès !' : 'Nouveau produit ajouté au catalogue !' 
            });
        } catch (err: any) {
            console.error("Save product error:", err);
            setStatusMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement du produit.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (productId: string, productName: string) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le produit "${productName}" ?`)) {
            return;
        }

        try {
            await db.products.delete(productId);
            const updated = products.filter(p => p.id !== productId);
            onUpdateProducts(updated);
            if (previewProduct?.id === productId) setPreviewProduct(null);
            setStatusMessage({ type: 'success', text: `Produit "${productName}" supprimé.` });
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: 'Erreur lors de la suppression.' });
        }
    };

    const copyToClipboard = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Header Banner */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Package className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">
                                    {isAgent ? 'Catalogue Produits & Scripts d\'Appel' : 'Gestion des Produits & Liens Boutique'}
                                </h1>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {isAgent 
                                        ? 'Consultez les informations complètes, images, liens du site web et scripts de confirmation pour chaque produit.'
                                        : 'Gérez vos articles, fiches de vente, scripts de confirmation et utilisez le Smart Scan AI pour extraire automatiquement les produits des commandes.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {canEdit && (
                            <>
                                <button
                                    id="btn-smart-scan-ai"
                                    onClick={handleOpenSmartScan}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm shadow-indigo-200 transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                                    title="Scanner la liste des commandes pour détecter et ajouter automatiquement tous les produits trouvés"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                                    <span>Smart Scan AI</span>
                                    <span className="text-[10px] bg-white/20 text-white font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        Auto
                                    </span>
                                </button>

                                <button
                                    id="btn-add-product"
                                    onClick={openCreateModal}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Ajouter un produit</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Quick KPI stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-500 font-medium">Total Produits</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{products.length}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-500 font-medium">Avec Liens Site Web</div>
                        <div className="text-lg font-bold text-indigo-600 mt-0.5">
                            {products.filter(p => Boolean(p.productUrl)).length}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-500 font-medium">Avec Scripts d'Appel</div>
                        <div className="text-lg font-bold text-amber-600 mt-0.5">
                            {products.filter(p => Boolean(p.confirmationPitch)).length}
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-xs text-slate-500 font-medium">Offres Upsell Renseignées</div>
                        <div className="text-lg font-bold text-emerald-600 mt-0.5">
                            {products.filter(p => Boolean(p.upsellOffer)).length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification alert */}
            {statusMessage && (
                <div className={`p-4 rounded-xl flex items-center justify-between border ${
                    statusMessage.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                        <span>{statusMessage.text}</span>
                    </div>
                    <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-black/5 rounded">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Search & Category Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, SKU, catégorie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    <button
                        onClick={() => setSelectedCategory('ALL')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                            selectedCategory === 'ALL'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Toutes les catégories ({products.length})
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                                selectedCategory === cat
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">Aucun produit trouvé</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                        {searchTerm 
                            ? 'Aucun résultat ne correspond à votre recherche. Essayez un autre terme.'
                            : 'Commencez par importer automatiquement vos produits depuis les commandes grâce au Smart Scan AI ou ajoutez-les manuellement.'}
                    </p>
                    {canEdit && (
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={handleOpenSmartScan}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm"
                            >
                                <Sparkles className="w-4 h-4 text-amber-300" />
                                <span>Smart Scan AI (Analyser les commandes)</span>
                            </button>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-lg"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Ajout manuel</span>
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProducts.map(product => (
                        <div 
                            key={product.id}
                            id={`product-card-${product.id}`}
                            className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col overflow-hidden group"
                        >
                            {/* Product Header & Image */}
                            <div className="relative h-48 bg-slate-100 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                                {product.imageUrl ? (
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60';
                                        }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                                        <span className="text-xs mt-1">Sans image</span>
                                    </div>
                                )}

                                {/* Floating SKU & Category tags */}
                                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[80%]">
                                    {product.category && (
                                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium rounded-md">
                                            {product.category}
                                        </span>
                                    )}
                                    {product.sku && (
                                        <span className="px-2 py-0.5 bg-white/90 backdrop-blur-md text-slate-800 text-[11px] font-mono font-semibold rounded-md border border-slate-200/50">
                                            {product.sku}
                                        </span>
                                    )}
                                </div>

                                {/* Stock badge */}
                                <div className="absolute bottom-3 right-3">
                                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md backdrop-blur-md ${
                                        (product.stock || 0) > 20 
                                            ? 'bg-emerald-500/90 text-white'
                                            : (product.stock || 0) > 0 
                                                ? 'bg-amber-500/90 text-white' 
                                                : 'bg-rose-500/90 text-white'
                                    }`}>
                                        Stock: {product.stock || 0}
                                    </span>
                                </div>
                            </div>

                            {/* Product Info Body */}
                            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">
                                            {product.name}
                                        </h3>
                                        <div className="text-right shrink-0">
                                            <div className="text-base font-extrabold text-indigo-600">
                                                {product.price} MAD
                                            </div>
                                            {product.regularPrice && product.regularPrice > product.price && (
                                                <div className="text-xs text-slate-400 line-through">
                                                    {product.regularPrice} MAD
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {product.description && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                            {product.description}
                                        </p>
                                    )}
                                </div>

                                {/* Confirmation Pitch Preview */}
                                {product.confirmationPitch ? (
                                    <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5">
                                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px] mb-1">
                                            <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            <span>Script d'appel Agent :</span>
                                        </div>
                                        <p className="text-xs text-amber-950 line-clamp-2 italic">
                                            "{product.confirmationPitch}"
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center text-[11px] text-slate-400">
                                        Aucun argumentaire d'appel renseigné
                                    </div>
                                )}

                                {/* Upsell Banner */}
                                {product.upsellOffer && (
                                    <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <div className="text-[11px] text-emerald-900 font-medium truncate">
                                            <strong className="font-semibold text-emerald-950">Upsell: </strong>
                                            {product.upsellOffer}
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        {product.productUrl && (
                                            <a
                                                href={product.productUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Ouvrir la page du produit sur le site web"
                                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                            >
                                                <Globe className="w-4 h-4" />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => setPreviewProduct(product)}
                                            title="Fiche détaillée & Script d'appel"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1.5 rounded-md transition-colors"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Fiche d'appel</span>
                                        </button>
                                    </div>

                                    {canEdit && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                id={`btn-edit-${product.id}`}
                                                onClick={() => openEditModal(product)}
                                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                id={`btn-delete-${product.id}`}
                                                onClick={() => handleDelete(product.id, product.name)}
                                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Smart Scan AI */}
            {isScanModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-amber-300 border border-white/10">
                                    <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-bold text-white tracking-wide">
                                            Smart Scan AI — Extraction des Produits
                                        </h2>
                                        <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                            Auto-Catalog
                                        </span>
                                    </div>
                                    <p className="text-xs text-indigo-200 mt-0.5">
                                        L'intelligence artificielle analyse toutes les lignes de commandes pour détecter les produits, prix moyens et générer les scripts de confirmation.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsScanModalOpen(false)}
                                className="p-1.5 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
                            {/* Scanning State */}
                            {isScanning ? (
                                <div className="py-16 text-center space-y-4">
                                    <div className="relative w-20 h-20 mx-auto">
                                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                                        <div className="relative w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                            <Bot className="w-10 h-10 animate-bounce" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">
                                            Scan & Analyse IA en cours...
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                                            Analyse des intitulés de commandes, normalisation des désignations, calcul des prix unitaires et génération automatique des argumentaires d'appel.
                                        </p>
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                        <span>Modèle Gemini 3.7 Flash & Moteur Sémantique</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Scan Summary Chips */}
                                    {scanMeta && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="space-y-0.5">
                                                <div className="text-[11px] font-medium text-slate-500">Commandes Scannées</div>
                                                <div className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                                                    <ShoppingBag className="w-4 h-4 text-indigo-600" />
                                                    <span>{scanMeta.totalOrdersScanned}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-[11px] font-medium text-slate-500">Nouveaux Détectés</div>
                                                <div className="text-lg font-bold text-emerald-600 flex items-center gap-1.5">
                                                    <Sparkles className="w-4 h-4 text-emerald-500" />
                                                    <span>{scannedItems.length}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-[11px] font-medium text-slate-500">Déjà au Catalogue</div>
                                                <div className="text-lg font-bold text-slate-600 flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                                    <span>{scanMeta.alreadyExistingCount}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-[11px] font-medium text-slate-500">Moteur Détection</div>
                                                <div className="text-xs font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded-md border border-violet-100 inline-block mt-0.5">
                                                    {scanMeta.source === 'gemini' ? '🤖 Gemini 3.7 AI' : '⚡ Algorithme Sémantique'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Results List */}
                                    {scannedItems.length === 0 ? (
                                        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
                                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800">
                                                Tous les produits des commandes sont déjà dans votre catalogue !
                                            </h4>
                                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                                Aucun nouveau produit non répertorié n'a été détecté dans vos commandes actuelles.
                                            </p>
                                            <button
                                                onClick={runSmartScan}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                <span>Relancer le scan</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {/* Action bar for selection & search */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleToggleSelectAllScanned(true)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                                                    >
                                                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                                                        <span>Tout sélectionner ({scannedItems.length})</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleSelectAllScanned(false)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                                                    >
                                                        <Square className="w-3.5 h-3.5 text-slate-400" />
                                                        <span>Désélectionner</span>
                                                    </button>
                                                </div>

                                                <div className="relative w-full sm:w-64">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrer les résultats scannés..."
                                                        value={scanSearchTerm}
                                                        onChange={(e) => setScanSearchTerm(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Product Cards List */}
                                            <div className="space-y-3">
                                                {filteredScannedItems.map((item, originalIndex) => {
                                                    const isSelected = item.selected !== false;
                                                    const isPitchExpanded = expandedPitchIndex === originalIndex;

                                                    return (
                                                        <div
                                                            key={originalIndex}
                                                            className={`bg-white rounded-xl border transition-all ${
                                                                isSelected 
                                                                    ? 'border-indigo-300 ring-1 ring-indigo-200/50 shadow-sm' 
                                                                    : 'border-slate-200 opacity-60'
                                                            }`}
                                                        >
                                                            <div className="p-4 space-y-3">
                                                                {/* Top Row: Checkbox, Name, Sku, Category, Price */}
                                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                                    <div className="flex items-start gap-3 flex-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleScannedItem(originalIndex)}
                                                                            className="mt-0.5 text-indigo-600 hover:text-indigo-800 transition-colors shrink-0"
                                                                        >
                                                                            {isSelected ? (
                                                                                <CheckSquare className="w-5 h-5 fill-indigo-600 text-white" />
                                                                            ) : (
                                                                                <Square className="w-5 h-5 text-slate-300" />
                                                                            )}
                                                                        </button>

                                                                        <div className="flex-1 space-y-1">
                                                                            <input
                                                                                type="text"
                                                                                value={item.name}
                                                                                onChange={(e) => handleUpdateScannedItem(originalIndex, 'name', e.target.value)}
                                                                                className="font-bold text-sm text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white px-1.5 py-0.5 -ml-1.5 rounded border border-transparent focus:border-indigo-300 focus:outline-none w-full"
                                                                                placeholder="Nom du produit"
                                                                            />

                                                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-semibold rounded text-[11px]">
                                                                                    {item.sku}
                                                                                </span>
                                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-medium rounded text-[11px]">
                                                                                    {item.category}
                                                                                </span>
                                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-medium rounded text-[11px] flex items-center gap-1">
                                                                                    <ShoppingBag className="w-3 h-3" />
                                                                                    {item.matchedOrdersCount} commande(s)
                                                                                </span>
                                                                                {item.variantsFound && item.variantsFound.length > 0 && (
                                                                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-medium rounded text-[11px]">
                                                                                        Variantes: {item.variantsFound.join(', ')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Pricing Input */}
                                                                    <div className="flex items-center gap-2 sm:self-center shrink-0 pl-8 sm:pl-0">
                                                                        <div className="text-right">
                                                                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                                                Prix Vente
                                                                            </label>
                                                                            <div className="flex items-center gap-1">
                                                                                <input
                                                                                    type="number"
                                                                                    value={item.price}
                                                                                    onChange={(e) => handleUpdateScannedItem(originalIndex, 'price', parseFloat(e.target.value) || 0)}
                                                                                    className="w-20 px-2 py-1 text-sm font-bold text-indigo-600 border border-slate-200 rounded-md text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                                />
                                                                                <span className="text-xs font-bold text-slate-500">MAD</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* AI Generated Pitch & Upsell (Collapsible) */}
                                                                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs space-y-2">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1.5 text-indigo-900 font-semibold text-[11px]">
                                                                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                                            <span>Script d'Appel & Upsell générés par l'IA</span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setExpandedPitchIndex(isPitchExpanded ? null : originalIndex)}
                                                                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                                        >
                                                                            <span>{isPitchExpanded ? 'Masquer' : 'Voir / Modifier'}</span>
                                                                            {isPitchExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                    </div>

                                                                    {isPitchExpanded && (
                                                                        <div className="space-y-2.5 pt-2 border-t border-slate-200/60 animate-in fade-in duration-150">
                                                                            <div>
                                                                                <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                                                                                    Script de confirmation Téléopérateur :
                                                                                </label>
                                                                                <textarea
                                                                                    rows={2}
                                                                                    value={item.confirmationPitch}
                                                                                    onChange={(e) => handleUpdateScannedItem(originalIndex, 'confirmationPitch', e.target.value)}
                                                                                    className="w-full p-2 text-xs text-amber-950 bg-amber-50/60 border border-amber-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                                                />
                                                                            </div>

                                                                            <div>
                                                                                <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                                                                                    Offre Upsell Recommandée :
                                                                                </label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.upsellOffer}
                                                                                    onChange={(e) => handleUpdateScannedItem(originalIndex, 'upsellOffer', e.target.value)}
                                                                                    className="w-full px-2 py-1 text-xs text-emerald-950 bg-emerald-50/60 border border-emerald-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">
                                {!isScanning && scannedItems.length > 0 && (
                                    <span>
                                        <strong className="text-indigo-600 font-bold">{selectedScannedCount}</strong> sur {scannedItems.length} produit(s) sélectionné(s) pour ajout au catalogue
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 justify-end">
                                <button
                                    type="button"
                                    onClick={runSmartScan}
                                    disabled={isScanning || isSavingScanned}
                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                                    <span>Relancer</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsScanModalOpen(false)}
                                    disabled={isSavingScanned}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Annuler
                                </button>

                                <button
                                    type="button"
                                    onClick={handleConfirmImportScanned}
                                    disabled={isScanning || isSavingScanned || selectedScannedCount === 0}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isSavingScanned ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Enregistrement...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Ajouter {selectedScannedCount} produit(s) au catalogue</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Create / Edit Product */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">
                                        {editingProduct ? 'Modifier le Produit' : 'Nouveau Produit'}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Les agents assignés à la confirmation utiliseront ces informations lors des appels.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Row 1: Name & SKU */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Nom du Produit <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Pack Cosmétique Bio Éclat"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Référence SKU
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: BIO-01"
                                        value={formSku}
                                        onChange={(e) => setFormSku(e.target.value)}
                                        className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Price, Regular Price, Stock, Category */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Prix de Vente (MAD) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="any"
                                        placeholder="299"
                                        value={formPrice}
                                        onChange={(e) => setFormPrice(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Prix Barré (MAD)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="399"
                                        value={formRegularPrice}
                                        onChange={(e) => setFormRegularPrice(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Stock Estimé
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="50"
                                        value={formStock}
                                        onChange={(e) => setFormStock(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Catégorie
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Cosmétique"
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Product URL on Shopify / YouCan / WooCommerce */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Lien de la page produit (Site Web / Boutique)
                                </label>
                                <div className="relative">
                                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="url"
                                        placeholder="https://maboutique.ma/products/pack-bio-eclat"
                                        value={formProductUrl}
                                        onChange={(e) => setFormProductUrl(e.target.value)}
                                        className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Ce lien s'affichera directement dans l'interface de l'agent lors de la confirmation d'une commande.
                                </p>
                            </div>

                            {/* Row 4: Image URL with Preset Samples */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Image du Produit (URL)
                                </label>
                                <div className="relative">
                                    <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="url"
                                        placeholder="https://... image.jpg"
                                        value={formImageUrl}
                                        onChange={(e) => setFormImageUrl(e.target.value)}
                                        className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                    <span className="text-[11px] text-slate-500 font-medium">Exemples rapides :</span>
                                    {PRESET_SAMPLE_IMAGES.map((sample, idx) => (
                                        <button
                                            type="button"
                                            key={idx}
                                            onClick={() => setFormImageUrl(sample.url)}
                                            className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded border border-slate-200 transition-colors"
                                        >
                                            {sample.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Row 5: Call Center Script / Confirmation Pitch */}
                            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <MessageSquareQuote className="w-4 h-4 text-amber-600" />
                                    <label className="text-xs font-bold text-amber-900">
                                        Script d'Appel & Argumentaire de Confirmation (Pour les Téléconseillers)
                                    </label>
                                </div>
                                <textarea
                                    rows={3}
                                    placeholder="Ex: Bienvenue chez BioMaroc. Confirmez la commande du Pack Éclat. Rappelez au client que le sérum s'applique matin et soir..."
                                    value={formConfirmationPitch}
                                    onChange={(e) => setFormConfirmationPitch(e.target.value)}
                                    className="w-full p-2.5 text-xs bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none leading-relaxed text-slate-800"
                                />
                                <p className="text-[11px] text-amber-700/80 mt-1">
                                    Ces instructions s'afficheront au téléconseiller pour guider son discours téléphonique.
                                </p>
                            </div>

                            {/* Row 6: Upsell Offer */}
                            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <label className="text-xs font-bold text-emerald-900">
                                        Offre Spéciale Upsell / Cross-Sell (Lors de l'appel)
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Ex: 2ème Pack à -40% (total 449 MAD au lieu de 598 MAD) avec livraison offerte"
                                    value={formUpsellOffer}
                                    onChange={(e) => setFormUpsellOffer(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>

                            {/* Row 7: Description */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Description & Fiche Produit
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Détails du produit, composition, avantages clients..."
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Enregistrement...</span>
                                        </>
                                    ) : (
                                        <span>{editingProduct ? 'Mettre à jour' : 'Créer le Produit'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Preview Product Details / Call Sheet for Agents */}
            {previewProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <FileText className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <h3 className="font-bold text-sm text-white">Fiche Produit & Script Téléopérateur</h3>
                                    <span className="text-xs text-slate-400">{previewProduct.sku || 'Sans SKU'}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setPreviewProduct(null)}
                                className="p-1 text-slate-400 hover:text-white rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            {/* Product Header Card */}
                            <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                {previewProduct.imageUrl ? (
                                    <img
                                        src={previewProduct.imageUrl}
                                        alt={previewProduct.name}
                                        className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400">
                                        <Package className="w-8 h-8" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                                        {previewProduct.category || 'Général'}
                                    </span>
                                    <h2 className="text-base font-bold text-slate-900 mt-1 truncate">
                                        {previewProduct.name}
                                    </h2>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-lg font-extrabold text-indigo-600">
                                            {previewProduct.price} MAD
                                        </span>
                                        {previewProduct.regularPrice && (
                                            <span className="text-xs text-slate-400 line-through">
                                                {previewProduct.regularPrice} MAD
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-500 ml-auto">
                                            Stock: <strong>{previewProduct.stock || 0}</strong>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Website Link if present */}
                            {previewProduct.productUrl && (
                                <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs text-indigo-900 font-medium truncate">
                                        <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                                        <span className="truncate">{previewProduct.productUrl}</span>
                                    </div>
                                    <a
                                        href={previewProduct.productUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shrink-0 shadow-sm"
                                    >
                                        <span>Visiter</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            )}

                            {/* Pitch de confirmation */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                                        <MessageSquareQuote className="w-4 h-4 text-amber-600" />
                                        <span>Script d'Appel & Arguments de Confirmation :</span>
                                    </div>
                                    {previewProduct.confirmationPitch && (
                                        <button
                                            onClick={() => copyToClipboard(previewProduct.confirmationPitch!, 'pitch')}
                                            className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 font-medium px-2 py-0.5 bg-amber-100 rounded"
                                        >
                                            {copiedField === 'pitch' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                            <span>{copiedField === 'pitch' ? 'Copié !' : 'Copier'}</span>
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-amber-950 leading-relaxed font-medium">
                                    {previewProduct.confirmationPitch || "Aucun script spécifique rédigé pour ce produit. Validez l'adresse et confirmez le total."}
                                </p>
                            </div>

                            {/* Upsell Offer */}
                            {previewProduct.upsellOffer && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs mb-1.5">
                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                        <span>Offre Upsell Recommandée lors de l'Appel :</span>
                                    </div>
                                    <p className="text-xs text-emerald-950 font-semibold">
                                        {previewProduct.upsellOffer}
                                    </p>
                                </div>
                            )}

                            {/* Description */}
                            {previewProduct.description && (
                                <div className="space-y-1">
                                    <h4 className="text-xs font-semibold text-slate-700">Détails & Fiche Technique :</h4>
                                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                                        {previewProduct.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setPreviewProduct(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
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
