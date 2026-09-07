
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Menu, MessageSquare } from 'lucide-react';
import { Order, OrderStatus, Role, Product } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdersView from './components/OrdersView';
import LivraisonView from './components/LivraisonView';
import Store from './components/Store';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import { ViewModeProvider, useViewMode } from './contexts/ViewModeContext';
import ViewModeToggle from './components/ViewModeToggle';
import Login from './components/Login';
import Home from './components/Home';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';
import AdminStoresView from './components/AdminStoresView';
import AdminDatabaseSettings from './components/AdminDatabaseSettings';
import CallCenterOrdersView from './components/CallCenterOrdersView';
import ManagerDashboard from './components/ManagerDashboard';
import { ProductManagement } from './components/ProductManagement';
import { MessagingView } from './components/MessagingView';
import CustomerMarketingView from './components/CustomerMarketingView';
import ExpeditionsView from './components/ExpeditionsView';
import OrderDetailModal from './components/OrderDetailModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { normalizeKey, normalizeStatus, generateShortStableOrderId, isOrderWithData, stableSortOrders } from './utils';
import { db } from './lib/db';
import { apiClient } from './lib/apiClient';
import { mapUnknownStatusesWithAI } from './lib/gemini';

type View = 'dashboard' | 'orders' | 'customers' | 'expeditions' | 'livraison' | 'users' | 'database' | 'settings' | 'stores' | 'store' | 'callcenter' | 'products' | 'messages' | 'manager';
type SyncStatus = 'synced' | 'syncing' | 'error';

const AppContent: React.FC = () => {
    const [view, setView] = useState<View>('dashboard');
    const [isLoginPortalActive, setIsLoginPortalActive] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [adminSelectedStoreId, setAdminSelectedStoreId] = useState<string | null>(null);
    const [messagingStoreId, setMessagingStoreId] = useState<string | undefined>(undefined);
    const [messagingOrderRefId, setMessagingOrderRefId] = useState<string | undefined>(undefined);
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
    const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
    const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'warning' | 'error', message: string } | null>(null);

    const { t } = useLanguage();
    const { currentUser, users, initialSyncDone, backendConnectionError, reinitializePlatform } = useAuth();

    const showToast = useCallback((type: 'success' | 'warning' | 'error', message: string) => {
        setToastNotification({ type, message });
        setTimeout(() => setToastNotification(null), 6000);
    }, []);

    const forcePrimitiveString = useCallback((value: any): string => {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'object') {
            if (value instanceof Date) {
                return value.toISOString().split('T')[0];
            }
            try {
                const stringified = JSON.stringify(value);
                if (stringified === '{}' || stringified === '[]') {
                    return '';
                }
                return stringified;
            } catch (jsonError) {
                return String(value);
            }
        }
        return String(value);
    }, []);

    const setOrdersSafely = useCallback((newOrders: Order[]) => {
        setOrders(prevOrders => {
            if (!newOrders || !Array.isArray(newOrders)) return prevOrders;
            const sorted = stableSortOrders(newOrders, true);
            if (prevOrders.length === sorted.length) {
                let isIdentical = true;
                for (let i = 0; i < sorted.length; i++) {
                    const a = prevOrders[i];
                    const b = sorted[i];
                    if (
                        a.id !== b.id ||
                        a.status !== b.status ||
                        a.customerName !== b.customerName ||
                        a.phone !== b.phone ||
                        a.price !== b.price ||
                        a.date !== b.date ||
                        a.archived !== b.archived ||
                        a.note !== b.note ||
                        a.city !== b.city ||
                        a.district !== b.district ||
                        a.product !== b.product ||
                        a.variant !== b.variant ||
                        a.clientId !== b.clientId
                    ) {
                        isIdentical = false;
                        break;
                    }
                }
                if (isIdentical) {
                    return prevOrders;
                }
            }

            // Reconcile object references by order ID to preserve React component memoization
            const prevMap = new Map<string, Order>();
            prevOrders.forEach(o => {
                if (o && o.id) prevMap.set(String(o.id), o);
            });

            const reconciled = sorted.map(newO => {
                const oldO = prevMap.get(String(newO.id));
                if (!oldO) return newO;
                if (
                    oldO.status === newO.status &&
                    oldO.customerName === newO.customerName &&
                    oldO.phone === newO.phone &&
                    oldO.price === newO.price &&
                    oldO.date === newO.date &&
                    oldO.archived === newO.archived &&
                    oldO.note === newO.note &&
                    oldO.city === newO.city &&
                    oldO.district === newO.district &&
                    oldO.product === newO.product &&
                    oldO.variant === newO.variant &&
                    oldO.clientId === newO.clientId
                ) {
                    return oldO;
                }
                return newO;
            });

            return reconciled;
        });
    }, []);

    const fetchOrders = useCallback(async (isSilent = false) => {
        if (!isSilent) setSyncStatus('syncing');
        try {
            const clientIdParam = currentUser?.role === Role.Client ? currentUser.id : (adminSelectedStoreId || undefined);
            const [ordersData, productsData] = await Promise.all([
                db.orders.getAll(),
                db.products.getAll(clientIdParam).catch(() => [])
            ]);
            setOrdersSafely(ordersData);
            if (productsData && Array.isArray(productsData)) {
                setProducts(productsData);
            }
            setSyncStatus('synced');
            setLastSyncTime(new Date());
        } catch (e) {
            console.warn("Sync fetch notice:", e);
            setSyncStatus('error');
        }
    }, [setOrdersSafely, currentUser, adminSelectedStoreId]);

    useEffect(() => {
        if (initialSyncDone && !backendConnectionError) {
            fetchOrders();
            // Regular sync with Google Cloud SQL backend
            const interval = setInterval(() => fetchOrders(true), 12000);
            return () => clearInterval(interval);
        }
    }, [initialSyncDone, backendConnectionError, fetchOrders, currentUser?.id]);

    const handleSyncStoreOrders = useCallback(async (clientId: string, isSilent: boolean = false) => {
        const store = users.find(u => u.id === clientId);
        if (!store) return;
        
        if (!store.googleSheetUrl || !store.selectedSheet) {
            if (!isSilent) alert(t('storeNotConfigured' as any) || "Store integration not fully configured.");
            return;
        }

        try {
            setSyncStatus('syncing');
            const res = await apiClient.apiPost<{ count: number; orders?: Order[] }>('/google-sheets/sync-orders', {
                sheetUrl: store.googleSheetUrl,
                sheetName: store.selectedSheet,
                columnMapping: store.columnMapping,
                storeName: store.name,
                clientId: store.id
            });
            if (res.orders) {
                await db.orders.replaceForClient(store.id, res.orders);
            }
            await fetchOrders(true);
            setSyncStatus('synced');
            if (!isSilent) {
                showToast('success', `✓ Synchronisation miroir réussie pour ${store.name} : ${res.count || 0} commande(s) synchronisée(s) directement.`);
            }
        } catch (error: any) {
            console.error("Manual sync failed:", error);
            setSyncStatus('error');
            if (!isSilent) alert(`Sync Error: ${error.message}`);
        }
    }, [users, fetchOrders, t, showToast]);

    // Store sync is triggered explicitly by the user from the Store view, not automatically on mount
    const handleDataImport = useCallback(async (importedOrders: any[]) => {
        if (!currentUser) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        
        const preparedOrders: Order[] = importedOrders
            .map((rawIncoming) => {
                const incoming: any = {};
                if (currentUser.columnMapping) {
                    (Object.entries(currentUser.columnMapping) as [string, string][]).forEach(([systemKey, sheetHeader]) => {
                        if (rawIncoming[sheetHeader] !== undefined) incoming[systemKey] = forcePrimitiveString(rawIncoming[sheetHeader]);
                    });
                }
                Object.keys(rawIncoming).forEach(k => {
                    const normalizedKey = normalizeKey(k);
                    if (incoming[normalizedKey] === undefined) incoming[normalizedKey] = forcePrimitiveString(rawIncoming[k]);
                });

                const orderDate = forcePrimitiveString(incoming.date ?? new Date().toISOString().split('T')[0]);
                const customerName = forcePrimitiveString(incoming.customerName ?? '').trim() || 'Inconnu';
                const product = forcePrimitiveString(incoming.product ?? '').trim() || 'Inconnu';
                const price = Number(incoming.price ?? 0);
                const phone = forcePrimitiveString(incoming.phone ?? '').trim();
                const address = forcePrimitiveString(incoming.address ?? '').trim();
                const city = forcePrimitiveString(incoming.city ?? '').trim();
                const note = forcePrimitiveString(incoming.note ?? '').trim();

                const orderId = forcePrimitiveString(incoming.id && forcePrimitiveString(incoming.id).trim() !== ''
                    ? forcePrimitiveString(incoming.id).trim()
                    : generateShortStableOrderId({
                        customerName,
                        phone,
                        product,
                        price,
                        date: orderDate
                      }, currentUser.name));

                return {
                    id: orderId,
                    customerName: customerName,
                    product: product,
                    quantity: Number(incoming.quantity ?? 1),
                    variant: forcePrimitiveString(incoming.variant ?? '').trim(),
                    price: price,
                    date: orderDate,
                    phone: phone,
                    address: address,
                    city: city,
                    note: note,
                    status: normalizeStatus(incoming.status) || OrderStatus.EnAttend,
                    clientId: forcePrimitiveString(incoming.clientId || currentUser.id),
                    archived: Boolean(incoming.archived ?? false)
                };
            })
            .filter(isOrderWithData);

        if (preparedOrders.length === 0) {
            setSyncStatus('synced');
            return;
        }

        try {
            const success = await db.orders.bulkCreate(preparedOrders);
            setSyncStatus(success ? 'synced' : 'error');
            if (success) {
                await fetchOrders();
                showToast('success', `✓ ${preparedOrders.length} commande(s) importée(s) directement dans la base de données`);
            }
        } catch (err: any) {
            console.error("Bulk import failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de l'importation : ${err.message || 'Erreur réseau ou base de données'}`);
            await fetchOrders(true);
        }
    }, [currentUser, fetchOrders, forcePrimitiveString, showToast]);

    const handleUpdateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus, reason?: string, note?: string) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        try {
            const updates: any = {
                status: newStatus,
                googleSheetUrl: currentUser?.googleSheetUrl,
                selectedSheet: currentUser?.selectedSheet,
                columnMapping: currentUser?.columnMapping
            };
            if (note) updates.note = note;
            if (reason) updates.cancellationReason = reason;

            const res = await db.orders.update(orderId, updates);
            setSyncStatus(res.success ? 'synced' : 'error');
            if (res.syncResult) {
                if (res.syncResult.success) {
                    showToast('success', `✓ Statut mis à jour sur Callnet et Google Sheet (${res.syncResult.message})`);
                } else {
                    showToast('warning', `⚠️ Mis à jour sur Callnet, mais avertissement Google Sheet : ${res.syncResult.message}`);
                }
            } else {
                showToast('success', `✓ Statut mis à jour sur Callnet`);
            }
            await fetchOrders(true);
        } catch (err: any) {
            console.error("Order status update failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de mise à jour : ${err.message || 'Erreur réseau ou base de données'}`);
            await fetchOrders(true);
        }
    }, [currentUser, fetchOrders, showToast]);

    const handleUpdateOrder = useCallback(async (orderId: string, updates: Partial<Order>) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        try {
            const res = await db.orders.update(orderId, {
                ...updates,
                googleSheetUrl: currentUser?.googleSheetUrl,
                selectedSheet: currentUser?.selectedSheet,
                columnMapping: currentUser?.columnMapping
            } as any);
            setSyncStatus(res.success ? 'synced' : 'error');
            if (res.syncResult) {
                if (res.syncResult.success) {
                    showToast('success', `✓ Informations de la commande mises à jour sur Callnet et Google Sheet (${res.syncResult.message})`);
                } else {
                    showToast('warning', `⚠️ Informations modifiées sur Callnet, mais avertissement Google Sheet : ${res.syncResult.message}`);
                }
            } else {
                showToast('success', `✓ Informations de la commande enregistrées sur Callnet`);
            }
            await fetchOrders(true);
        } catch (err: any) {
            console.error("Order update failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de mise à jour : ${err.message || 'Erreur réseau ou base de données'}`);
            await fetchOrders(true);
        }
    }, [currentUser, fetchOrders, showToast]);

    const handleAddOrder = useCallback(async (newOrderData: Omit<Order, 'status' | 'clientId'>) => {
        if (!currentUser) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        try {
            const targetClientId = (currentUser.role === Role.Admin && adminSelectedStoreId) ? adminSelectedStoreId : currentUser.id;
            const newOrder: Order = { ...newOrderData, status: OrderStatus.EnAttend, clientId: targetClientId, archived: false };
            const res = await db.orders.create(newOrder);
            setSyncStatus(res.success ? 'synced' : 'error');
            if (res.syncResult) {
                if (res.syncResult.success) {
                    showToast('success', `✓ Nouvelle commande créée et ajoutée à Google Sheet (${res.syncResult.message})`);
                } else {
                    showToast('warning', `⚠️ Commande créée sur Callnet, mais non ajoutée à Google Sheet : ${res.syncResult.message}`);
                }
            } else {
                showToast('success', `✓ Commande ajoutée sur Callnet`);
            }
            await fetchOrders(true);
        } catch (err: any) {
            console.error("Add order failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de création : ${err.message || 'Erreur réseau ou base de données'}`);
            await fetchOrders(true);
        }
    }, [currentUser, adminSelectedStoreId, fetchOrders, showToast]);

    const handleDeleteOrder = useCallback(async (id: string) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        try {
            const cleanId = String(id).trim().toLowerCase();
            setOrders(prev => prev.filter(o => String(o.id).trim().toLowerCase() !== cleanId));
            
            await db.orders.delete(id);
            setSyncStatus('synced');
            await fetchOrders(true);
            showToast('success', `Commande #${id} supprimée avec succès`);
        } catch (err: any) {
            console.error("Delete order failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de suppression : ${err.message || 'Erreur réseau ou base de données'}`);
            await fetchOrders(true);
        }
    }, [fetchOrders, showToast]);

    const handleDeleteAllOrders = useCallback(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        try {
            const targetClientId = currentUser?.role === Role.Client ? currentUser.id : (adminSelectedStoreId || undefined);
            if (targetClientId) {
                const targetLower = String(targetClientId).trim().toLowerCase();
                setOrders(prev => prev.filter(o => String(o.clientId || '').trim().toLowerCase() !== targetLower));
            } else {
                setOrders([]);
            }
            await db.orders.deleteAll(targetClientId);
            setSyncStatus('synced');
            await fetchOrders(true);
            showToast('success', 'Toutes les commandes ont été supprimées avec succès');
        } catch (err: any) {
            console.error("Delete all orders failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de suppression : ${err.message || 'Erreur réseau ou base de données'}`);
            await fetchOrders(true);
        }
    }, [currentUser, adminSelectedStoreId, fetchOrders, showToast]);

    const handleAutoArchive = useCallback(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('error', 'Action impossible : vous êtes hors ligne. Toutes les modifications doivent être effectuées en ligne.');
            return;
        }
        setSyncStatus('syncing');
        try {
            const targetId = (currentUser?.role === Role.Admin && adminSelectedStoreId) ? adminSelectedStoreId : undefined;
            const success = await db.orders.archiveOld(targetId);
            setSyncStatus(success ? 'synced' : 'error');
            await fetchOrders();
        } catch (err: any) {
            console.error("Archive failed:", err);
            setSyncStatus('error');
            showToast('error', `Échec de l'archivage : ${err.message || 'Erreur réseau ou base de données'}`);
        }
    }, [currentUser, adminSelectedStoreId, fetchOrders, showToast]);

    const handleOrderClickForDetail = useCallback((order: Order) => {
        setSelectedOrderForDetail(order);
    }, []);

    const handleOpenChatForOrder = useCallback((order: Order) => {
        setMessagingStoreId(order.clientId || (currentUser?.role === Role.Client ? currentUser.id : 'store-1'));
        setMessagingOrderRefId(order.id);
        setView('messages');
    }, [currentUser]);

    const handleCloseDetailModal = useCallback(() => {
        setSelectedOrderForDetail(null);
    }, []);

    const handleUpdateFromDetailModal = useCallback((orderId: string, updates: Partial<Order>) => {
        handleUpdateOrder(orderId, updates);
        setSelectedOrderForDetail(prev => prev ? { ...prev, ...updates } : null);
    }, [handleUpdateOrder]);

    const handleSmartStatusFix = useCallback(async (visibleOrders: Order[]) => {
        if (visibleOrders.length === 0) return;
        setSyncStatus('syncing');
        
        try {
            const unknownCandidates = visibleOrders.filter(o => o.status === OrderStatus.EnAttend);
            if (unknownCandidates.length === 0) {
                alert("Aucune commande 'En cours de confirmation' à analyser.");
                setSyncStatus('synced');
                return;
            }

            const inputs = unknownCandidates.map(o => ({
                id: o.id,
                text: `${o.note || ''} ${o.product}`.trim()
            })).filter(i => i.text.length > 3);

            if (inputs.length === 0) {
                alert("Pas assez d'informations dans les notes pour auto-détecter les statuts.");
                setSyncStatus('synced');
                return;
            }

            const rawTexts = inputs.map(i => i.text);
            const mapping = await mapUnknownStatusesWithAI(rawTexts);
            
            let updatedCount = 0;
            // Execute updates in a batch-like manner or concurrently to be faster
            const updatePromises = inputs.map(async (input) => {
                const rawSuggested = mapping[input.text];
                // CRITICAL: Normalize the suggestion to ensure it matches exact enum strings
                const normalizedSuggested = normalizeStatus(rawSuggested);
                
                if (normalizedSuggested) {
                    await db.orders.update(input.id, { status: normalizedSuggested });
                    return true;
                }
                return false;
            });

            const results = await Promise.all(updatePromises);
            updatedCount = results.filter(Boolean).length;

            if (updatedCount > 0) {
                alert(`${updatedCount} statuts mis à jour via l'IA !`);
                await fetchOrders(true);
            } else {
                alert("L'IA n'a pas pu déterminer de nouveaux statuts précis pour ces commandes.");
            }
        } catch (e: any) {
            console.error("Smart Status Fix Error:", e);
            alert("Une erreur est survenue lors de l'analyse IA.");
        } finally {
            setSyncStatus('synced');
        }
    }, [fetchOrders]);

    const visibleOrders = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === Role.Admin || currentUser.role === Role.Manager) {
            return adminSelectedStoreId ? orders.filter(o => String(o.clientId || '').toLowerCase() === String(adminSelectedStoreId).toLowerCase()) : orders; 
        }
        if (currentUser.role === Role.Client) {
            const clientMatch = new Set([
                String(currentUser.id || '').toLowerCase(),
                String(currentUser.email || '').toLowerCase(),
                String(currentUser.name || '').toLowerCase()
            ]);
            return orders.filter(o => clientMatch.has(String(o.clientId || '').toLowerCase()));
        }
        if (currentUser.role === Role.Agent) {
            let rawAssigned = currentUser.assignedClientIds || [];
            
            // Fallback: If agent has no explicit stores yet, grant access to all available stores
            if (rawAssigned.length === 0) {
                const clientUsers = users.filter(u => u.role === Role.Client);
                rawAssigned = clientUsers.length > 0 ? clientUsers.map(c => c.id) : ['store-1'];
            }

            const rawAssignedClean = rawAssigned.map(id => String(id).trim().toLowerCase());

            const assignedClientObjects = users.filter(u => {
                const uId = String(u.id || '').trim().toLowerCase();
                const uName = String(u.name || '').trim().toLowerCase();
                const uEmail = String(u.email || '').trim().toLowerCase();
                return rawAssignedClean.includes(uId) || rawAssignedClean.includes(uName) || rawAssignedClean.includes(uEmail);
            });
            
            const validClientIdentifiers = new Set<string>([
                ...rawAssignedClean,
                ...assignedClientObjects.map(c => String(c.id).trim().toLowerCase()),
                ...assignedClientObjects.map(c => String(c.name).trim().toLowerCase()),
                ...assignedClientObjects.map(c => String(c.email).trim().toLowerCase())
            ]);

            return orders.filter(o => {
                const rawOrderClientId = String(o.clientId || '').trim().toLowerCase();
                const orderClientId = rawOrderClientId || 'store-1';
                return validClientIdentifiers.has(orderClientId) || validClientIdentifiers.has(rawOrderClientId) || validClientIdentifiers.has('store-1');
            });
        }
        return [];
    }, [orders, currentUser, adminSelectedStoreId, users]);

    const visibleProducts = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === Role.Admin || currentUser.role === Role.Manager) {
            return adminSelectedStoreId 
                ? products.filter(p => String(p.clientId || '').toLowerCase() === String(adminSelectedStoreId).toLowerCase())
                : products;
        }
        if (currentUser.role === Role.Client) {
            const clientMatch = new Set([
                String(currentUser.id || '').toLowerCase(),
                String(currentUser.email || '').toLowerCase(),
                String(currentUser.name || '').toLowerCase()
            ]);
            return products.filter(p => clientMatch.has(String(p.clientId || '').toLowerCase()));
        }
        if (currentUser.role === Role.Agent) {
            let rawAssigned = currentUser.assignedClientIds || [];
            if (rawAssigned.length === 0) {
                const clientUsers = users.filter(u => u.role === Role.Client);
                rawAssigned = clientUsers.length > 0 ? clientUsers.map(c => c.id) : [];
            }
            const cleanAssigned = new Set(rawAssigned.map(id => String(id).trim().toLowerCase()));
            return products.filter(p => cleanAssigned.has(String(p.clientId || '').trim().toLowerCase()));
        }
        return [];
    }, [products, currentUser, adminSelectedStoreId, users]);

    const pendingCount = useMemo(() => {
        return visibleOrders.filter(o => o.status === OrderStatus.EnAttend && !o.archived).length;
    }, [visibleOrders]);

    const handleResetStoreSelection = useCallback(() => {
        setAdminSelectedStoreId(null);
    }, []);

    if (!initialSyncDone) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 font-montserrat p-6 text-center">
                <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin mb-5"></div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight mb-1.5">
                    Chargement de Callnet...
                </h2>
                <p className="text-xs text-text-secondary font-medium tracking-wide">
                    Initialisation de l'espace de travail sécurisé
                </p>
            </div>
        );
    }

    if (backendConnectionError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 font-montserrat p-6">
                <div className="p-8 sm:p-10 bg-base-200 border border-base-300 rounded-2xl text-center shadow-lg max-w-md w-full space-y-5">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-lg font-bold text-text-primary">Erreur de Connexion</h2>
                        <p className="text-xs text-text-secondary leading-relaxed">
                            {t('backendConnectionError')}
                        </p>
                    </div>
                    <button
                        onClick={reinitializePlatform}
                        className="w-full py-3 px-4 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                    >
                        Réessayer la Connexion
                    </button>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="h-screen w-full overflow-y-auto overflow-x-hidden bg-base-100 scroll-smooth">
                {isLoginPortalActive ? <Login onBack={() => setIsLoginPortalActive(false)} /> : <Home onLogin={() => setIsLoginPortalActive(true)} />}
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-base-100 text-text-primary font-montserrat overflow-hidden transition-colors">
            <Sidebar 
                currentView={view} 
                setView={setView} 
                pendingOrdersCount={pendingCount} 
                isMobileOpen={isMobileMenuOpen}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
                currentStatusFilter={statusFilter}
                onSelectStatusFilter={setStatusFilter}
                orders={currentUser.role === Role.Admin ? orders.filter(o => !o.archived) : visibleOrders.filter(o => !o.archived)}
            />
            <main className={`flex-1 min-w-0 min-h-0 h-full flex flex-col ${
                view === 'messages' 
                    ? 'p-0 overflow-hidden' 
                    : 'px-3.5 py-4 sm:px-8 sm:py-6 lg:px-10 lg:py-8 overflow-y-auto'
            }`}>
                <header className={`flex justify-between items-center gap-2.5 sm:gap-3 shrink-0 ${
                    view === 'messages' 
                        ? 'px-4 py-3 bg-base-200 border-b border-base-300' 
                        : 'mb-5 sm:mb-8 pb-3.5 sm:pb-4 border-b border-base-300'
                }`}>
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        {/* Mobile Hamburger Menu */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 sm:p-2.5 md:hidden bg-base-200 hover:bg-base-300 border border-base-300 text-text-primary rounded-xl shadow-xs flex items-center justify-center transition-all shrink-0 active:scale-95 cursor-pointer"
                            title="Ouvrir le menu"
                            aria-label="Ouvrir le menu de navigation"
                        >
                            <Menu className="w-5 h-5 text-accent" />
                        </button>

                        {currentUser.role === Role.Admin && adminSelectedStoreId && (view === 'orders' || view === 'callcenter' || view === 'livraison') && (
                            <button 
                                onClick={handleResetStoreSelection}
                                className="p-2 bg-base-200 hover:bg-base-300 border border-base-300 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                                title={t('changeStore')}
                            >
                                <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </button>
                        )}

                        <div className="min-w-0 flex items-center gap-2 sm:gap-2.5 flex-1">
                            {view === 'messages' && (
                                <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <h1 className={`${view === 'messages' ? 'text-sm sm:text-base font-bold' : 'text-base sm:text-2xl font-bold sm:font-extrabold'} text-text-primary tracking-tight truncate`}>
                                    {view === 'dashboard' ? "Tableau de Bord" : t(`${view}Title` as any) || t(`${view}` as any) || view}
                                </h1>
                                {view !== 'messages' && (
                                    <div className="flex items-center gap-1.5 sm:gap-3 mt-0.5 sm:mt-1 flex-wrap">
                                        <p className="text-[11px] sm:text-xs font-semibold text-text-secondary uppercase tracking-wider truncate max-w-[120px] sm:max-w-none">
                                            {currentUser.role === Role.Admin && adminSelectedStoreId 
                                                ? `${currentUser.name} • ${users.find(u => u.id === adminSelectedStoreId)?.name || '...'}`
                                                : currentUser.name
                                            }
                                        </p>
                                        <button 
                                            onClick={() => fetchOrders()}
                                            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer shrink-0 ${
                                                syncStatus === 'synced' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 
                                                syncStatus === 'syncing' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse' :
                                                'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                            }`}
                                            title="État de la synchronisation"
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                                            <span>{syncStatus === 'synced' ? 'Connecté' : syncStatus === 'syncing' ? 'Sync...' : 'Hors ligne'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <PWAInstallButton compact />
                        <ViewModeToggle />
                        <ThemeToggle />
                        <div className="scale-95 hidden sm:block">
                            <LanguageSelector />
                        </div>
                    </div>
                </header>
                
                {toastNotification && (
                    <div className={`fixed top-5 right-5 z-[9999] p-4 rounded-xl shadow-xl border flex items-center gap-3 max-w-sm w-full animate-in slide-in-from-top-3 fade-in duration-200 ${
                        toastNotification.type === 'success' ? 'bg-emerald-600 text-white border-emerald-700' :
                        toastNotification.type === 'warning' ? 'bg-amber-600 text-white border-amber-700' :
                        'bg-red-600 text-white border-red-700'
                    }`}>
                        <div className="flex-1 text-xs font-semibold leading-relaxed">
                            {toastNotification.message}
                        </div>
                        <button onClick={() => setToastNotification(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                {syncStatus === 'error' && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center justify-between animate-in fade-in slide-in-from-top-2 shadow-sm">
                        <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div>
                                <h4 className="text-sm font-black uppercase">Connexion Backend Perdue</h4>
                                <p className="text-xs">Impossible de synchroniser avec le serveur. Vérifiez votre internet.</p>
                            </div>
                        </div>
                        <button onClick={() => fetchOrders()} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold transition-colors">
                            Réessayer
                        </button>
                    </div>
                )}

                <div className={`flex-grow ${view === 'messages' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : ''}`}>
                    {view === 'dashboard' && (
                        <Dashboard 
                            orders={currentUser.role === Role.Admin ? orders.filter(o => !o.archived) : visibleOrders.filter(o => !o.archived)} 
                            onNavigate={(targetView, targetFilter) => {
                                if (targetFilter) setStatusFilter(targetFilter);
                                setView(targetView as View);
                            }}
                            onOrderClick={handleOrderClickForDetail}
                            onUpdateOrderStatus={handleUpdateOrderStatus}
                            onSync={fetchOrders}
                        />
                    )}
                    
                    {view === 'manager' && (
                        <ManagerDashboard
                            orders={orders}
                            allUsers={users}
                            onUpdateOrderStatus={handleUpdateOrderStatus}
                            onSelectOrder={handleOrderClickForDetail}
                            onOpenAddUserModal={() => setView('users')}
                            onOpenEditUserModal={() => setView('users')}
                            onNavigateToCallCenter={(storeId) => {
                                if (storeId) setAdminSelectedStoreId(storeId);
                                setView('callcenter');
                            }}
                            onNavigateToMessages={(storeId, recipientId) => {
                                setMessagingStoreId(storeId);
                                setView('messages');
                            }}
                            adminSelectedStoreId={adminSelectedStoreId || 'all'}
                            onSelectStore={(storeId) => setAdminSelectedStoreId(storeId === 'all' ? null : storeId)}
                        />
                    )}

                    {view === 'orders' && (
                        currentUser.role === Role.Admin && !adminSelectedStoreId ? (
                            <AdminStoresView orders={orders} onSelectStore={setAdminSelectedStoreId} onSyncStore={(cid) => handleSyncStoreOrders(cid, false)} title={t('selectStoreToManageOrders')} />
                        ) : (
                            <OrdersView 
                                orders={visibleOrders} onDataImport={handleDataImport} onUpdateOrderStatus={handleUpdateOrderStatus} 
                                onUpdateOrder={handleUpdateOrder} onAddOrder={handleAddOrder} onDeleteOrder={handleDeleteOrder}
                                onDeleteAllOrders={handleDeleteAllOrders} onAutoArchive={handleAutoArchive}
                                onOrderClick={handleOrderClickForDetail} viewingClientId={adminSelectedStoreId || undefined}
                                onSmartStatusFix={handleSmartStatusFix}
                                activeStatusFilter={statusFilter}
                                onStatusFilterChange={setStatusFilter}
                            />
                        )
                    )}

                    {view === 'callcenter' && (
                        currentUser.role === Role.Admin && !adminSelectedStoreId ? (
                            <AdminStoresView orders={orders} onSelectStore={setAdminSelectedStoreId} onSyncStore={(cid) => handleSyncStoreOrders(cid, false)} title={t('selectStoreToManageCallCenter')} />
                        ) : (
                            <CallCenterOrdersView
                                orders={visibleOrders}
                                onUpdateOrderStatus={handleUpdateOrderStatus}
                                onUpdateOrder={handleUpdateOrder}
                                onAddOrder={handleAddOrder}
                                onDeleteOrder={handleDeleteOrder}
                                onOrderClick={handleOrderClickForDetail}
                                onSync={fetchOrders}
                                onSmartStatusFix={handleSmartStatusFix}
                                activeStatusFilter={statusFilter}
                                onStatusFilterChange={setStatusFilter}
                            />
                        )
                    )}

                    {view === 'livraison' && (
                        currentUser.role === Role.Admin && !adminSelectedStoreId ? (
                            <AdminStoresView orders={orders} onSelectStore={setAdminSelectedStoreId} title={t('selectStoreToManageLivraison')} />
                        ) : (
                            <LivraisonView orders={visibleOrders} />
                        )
                    )}

                    {view === 'stores' && (currentUser.role === Role.Admin || currentUser.role === Role.Manager) && (
                        adminSelectedStoreId ? (
                            <div className="space-y-4">
                                <button onClick={() => setAdminSelectedStoreId(null)} className="px-4 py-2 rounded-xl bg-base-200 hover:bg-base-300 font-bold mb-4 flex items-center gap-2 transition-all">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                    {t('backToStores')}
                                </button>
                                <OrdersView 
                                    orders={visibleOrders} onDataImport={handleDataImport} onUpdateOrderStatus={handleUpdateOrderStatus} 
                                    onUpdateOrder={handleUpdateOrder} onAddOrder={handleAddOrder} onDeleteOrder={handleDeleteOrder}
                                    onDeleteAllOrders={handleDeleteAllOrders} onAutoArchive={handleAutoArchive} viewingClientId={adminSelectedStoreId}
                                    onOrderClick={handleOrderClickForDetail}
                                    onSmartStatusFix={handleSmartStatusFix}
                                />
                            </div>
                        ) : <AdminStoresView orders={orders} onSelectStore={setAdminSelectedStoreId} onSyncStore={handleSyncStoreOrders} />
                    )}

                    {view === 'messages' && (
                        <MessagingView 
                            orders={orders} 
                            onOrderClick={handleOrderClickForDetail} 
                            initialSelectedStoreId={messagingStoreId} 
                            initialOrderRefId={messagingOrderRefId} 
                        />
                    )}
                    {view === 'customers' && (
                        <CustomerMarketingView 
                            orders={currentUser.role === Role.Admin && !adminSelectedStoreId ? orders : visibleOrders} 
                            onSelectOrder={handleOrderClickForDetail} 
                            storeName={currentUser.role === Role.Client ? currentUser.name : (adminSelectedStoreId ? (users.find(u => u.id === adminSelectedStoreId)?.name || adminSelectedStoreId) : undefined)} 
                        />
                    )}
                    {view === 'expeditions' && (
                        <ExpeditionsView 
                            orders={currentUser.role === Role.Admin && !adminSelectedStoreId ? orders : visibleOrders} 
                            onUpdateOrder={handleUpdateOrder}
                            onSelectOrder={handleOrderClickForDetail}
                            storeName={currentUser.role === Role.Client ? currentUser.name : (adminSelectedStoreId ? (users.find(u => u.id === adminSelectedStoreId)?.name || adminSelectedStoreId) : undefined)}
                        />
                    )}
                    {view === 'store' && <Store onSync={fetchOrders} selectedClientId={adminSelectedStoreId || undefined} />}
                    {view === 'products' && (
                        <ProductManagement 
                            products={visibleProducts} 
                            orders={visibleOrders} 
                            onUpdateProducts={(newProducts) => {
                                if (typeof newProducts === 'function') {
                                    setProducts(prev => (newProducts as any)(prev));
                                } else {
                                    setProducts(newProducts);
                                }
                            }} 
                        />
                    )}
                    {view === 'users' && (currentUser.role === Role.Admin || currentUser.role === Role.Manager) && <UserManagement />}
                    {view === 'database' && currentUser.role === Role.Admin && <AdminDatabaseSettings />}
                    {view === 'settings' && <Settings />}
                </div>
            </main>

            {selectedOrderForDetail && (
                <OrderDetailModal 
                    order={selectedOrderForDetail}
                    products={visibleProducts}
                    primaryCourier={
                        users.find(u => u.id === selectedOrderForDetail.clientId)?.primaryCourier ||
                        currentUser?.primaryCourier ||
                        'ozon_express'
                    }
                    onUpdateOrder={handleUpdateFromDetailModal}
                    onDeleteOrder={handleDeleteOrder}
                    onClose={handleCloseDetailModal}
                    onOpenChat={handleOpenChatForOrder}
                />
            )}
            <OfflineIndicator />
        </div>
    );
};

const App: React.FC = () => (
    <LanguageProvider>
        <ThemeProvider>
            <AuthProvider>
                <ViewModeProvider>
                    <AppContent />
                </ViewModeProvider>
            </AuthProvider>
        </ThemeProvider>
    </LanguageProvider>
);

export default App;
