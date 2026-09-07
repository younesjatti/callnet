import { Order, User, Role, OrderStatus, Product, PlatformMessage } from '../types';
import { normalizeRole, normalizeStatus, isOrderWithData, stableSortOrders } from '../utils';
import { apiClient } from './apiClient';

// Local cache persistence for offline resilience and hot-reload survival
const USERS_CACHE_KEY = 'callnet_users_cache_v3';
const ORDERS_CACHE_KEY = 'callnet_orders_cache_v3';
const PRODUCTS_CACHE_KEY = 'callnet_products_cache_v3';

export const INITIAL_USERS: User[] = [];
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_PRODUCTS: Product[] = [];

// Initialize in-memory runtime cache from localStorage if available
let runtimeUsersCache: User[] = (() => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(USERS_CACHE_KEY);
            if (raw) return JSON.parse(raw);
        }
    } catch (_) {}
    return [];
})();

let runtimeOrdersCache: Order[] = (() => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(ORDERS_CACHE_KEY);
            if (raw) return JSON.parse(raw);
        }
    } catch (_) {}
    return [];
})();

let runtimeProductsCache: Product[] = (() => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(PRODUCTS_CACHE_KEY);
            if (raw) return JSON.parse(raw);
        }
    } catch (_) {}
    return [];
})();

let runtimeMessagesCache: PlatformMessage[] = [];

export const getStoredUsers = (): User[] => {
    return runtimeUsersCache.map(u => ({ ...u, role: normalizeRole(u.role) }));
};

export const saveStoredUsers = (users: User[]) => {
    runtimeUsersCache = users.map(u => ({ ...u, role: normalizeRole(u.role) }));
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(runtimeUsersCache));
        }
    } catch (_) {}
};

export const getStoredOrders = (): Order[] => {
    return runtimeOrdersCache.filter(isOrderWithData);
};

export const saveStoredOrders = (orders: Order[]) => {
    runtimeOrdersCache = orders.filter(isOrderWithData);
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(runtimeOrdersCache));
        }
    } catch (_) {}
};

export const getStoredProducts = (clientId?: string): Product[] => {
    if (clientId) {
        const clean = String(clientId).trim().toLowerCase();
        return runtimeProductsCache.filter(p => String(p.clientId || '').trim().toLowerCase() === clean);
    }
    return runtimeProductsCache;
};

export const clearStoredProductsCache = () => {
    runtimeProductsCache = [];
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(PRODUCTS_CACHE_KEY);
        }
    } catch (_) {}
};

export const saveStoredProducts = (products: Product[], forClientId?: string) => {
    if (forClientId) {
        const cleanClient = String(forClientId).trim().toLowerCase();
        const otherProducts = runtimeProductsCache.filter(p => String(p.clientId || '').trim().toLowerCase() !== cleanClient);
        runtimeProductsCache = [...products.map(p => ({ ...p, clientId: p.clientId || forClientId })), ...otherProducts];
    } else {
        runtimeProductsCache = products;
    }
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(runtimeProductsCache));
        }
    } catch (_) {}
};

export const getStoredMessages = (): PlatformMessage[] => {
    return runtimeMessagesCache;
};

export const saveStoredMessages = (messages: PlatformMessage[]) => {
    runtimeMessagesCache = messages;
};

export const mergeProductLists = (...lists: Array<Product[] | undefined | null>): Product[] => {
    const productMap = new Map<string, Product>();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const prod of list) {
            if (!prod || !prod.id) continue;
            const key = prod.id.trim();
            const existing = productMap.get(key);
            if (!existing) {
                productMap.set(key, { ...prod, clientId: prod.clientId || '' });
            } else {
                productMap.set(key, { ...existing, ...prod, clientId: prod.clientId || existing.clientId || '' });
            }
        }
    }
    return Array.from(productMap.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

export const mergeUserLists = (...lists: Array<User[] | undefined | null>): User[] => {
    const userMap = new Map<string, User>();

    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const user of list) {
            if (!user || (!user.id && !user.email)) continue;
            const normalizedEmail = (user.email || '').toLowerCase().trim();
            const normalizedId = (user.id || '').toLowerCase().trim();
            
            let existingKey: string | null = null;
            if (normalizedId && userMap.has(normalizedId)) {
                existingKey = normalizedId;
            } else if (normalizedEmail) {
                for (const [k, v] of userMap.entries()) {
                    if (v.email && v.email.toLowerCase().trim() === normalizedEmail) {
                        existingKey = k;
                        break;
                    }
                }
            }

            const existing = existingKey ? userMap.get(existingKey) : null;
            const parseAssigned = (val: any): string[] => {
                if (!val) return [];
                if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        try {
                            const p = JSON.parse(trimmed);
                            if (Array.isArray(p)) return p.map(String).map(s => s.trim()).filter(Boolean);
                        } catch (_) {}
                    }
                    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                        const inner = trimmed.slice(1, -1).trim();
                        if (!inner) return [];
                        return inner.split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
                    }
                    if (trimmed.includes(',')) return trimmed.split(',').map(s => s.trim()).filter(Boolean);
                    return [trimmed];
                }
                return [];
            };

            const incomingAssigned = user.assignedClientIds !== undefined ? parseAssigned(user.assignedClientIds) : null;
            const existingAssigned = existing ? parseAssigned(existing.assignedClientIds) : [];

            if (!existing) {
                const targetKey = normalizedId || normalizedEmail;
                userMap.set(targetKey, {
                    ...user,
                    id: String(user.id || `usr-${Date.now()}`),
                    role: normalizeRole(user.role),
                    assignedClientIds: incomingAssigned !== null ? incomingAssigned : [],
                    avatarUrl: user.avatarUrl || undefined,
                    phone: user.phone || undefined
                });
            } else {
                const updatedAssigned = incomingAssigned !== null ? incomingAssigned : existingAssigned;

                const mergedUser: User = {
                    ...existing,
                    ...user,
                    id: String(user.id || existing.id),
                    name: user.name || existing.name,
                    email: user.email || existing.email,
                    role: normalizeRole(user.role || existing.role),
                    assignedClientIds: updatedAssigned,
                    googleSheetUrl: user.googleSheetUrl || existing.googleSheetUrl || '',
                    selectedSheet: user.selectedSheet || existing.selectedSheet || '',
                    columnMapping: user.columnMapping && Object.keys(user.columnMapping).length > 0 ? user.columnMapping : (existing.columnMapping || {}),
                    logoData: user.logoData || existing.logoData || null,
                    logoScale: user.logoScale || existing.logoScale || 1,
                    avatarUrl: user.avatarUrl || existing.avatarUrl || undefined,
                    phone: user.phone || existing.phone || undefined
                };

                userMap.set(existingKey!, mergedUser);
            }
        }
    }

    return Array.from(userMap.values());
};

export const mergeOrderLists = (...lists: Array<Order[] | undefined | null>): Order[] => {
    const orderMap = new Map<string, Order>();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const ord of list) {
            if (!ord || !ord.id || !isOrderWithData(ord)) continue;
            const key = ord.id.trim();
            const existing = orderMap.get(key);
            if (!existing) {
                orderMap.set(key, {
                    ...ord,
                    status: normalizeStatus(ord.status) || OrderStatus.EnAttend,
                    clientId: ord.clientId || ''
                });
            } else {
                orderMap.set(key, {
                    ...existing,
                    ...ord,
                    status: normalizeStatus(ord.status) || existing.status || OrderStatus.EnAttend,
                    clientId: ord.clientId || existing.clientId || ''
                });
            }
        }
    }
    const mergedList = Array.from(orderMap.values());
    return stableSortOrders(mergedList, false);
};

export const db = {
    async fetchAll(): Promise<{ users: User[]; orders: Order[]; products: Product[] }> {
        let apiUsers: User[] = [];
        let apiOrders: Order[] = [];
        let apiProducts: Product[] = [];
        let usersFetched = false;
        let ordersFetched = false;
        let productsFetched = false;

        await Promise.allSettled([
            apiClient.apiFetch<User[]>('/users').then(res => {
                if (Array.isArray(res) && res.length > 0) {
                    apiUsers = res;
                    usersFetched = true;
                }
            }).catch(e => console.warn("API users fetch notice:", e?.message || e)),
            apiClient.apiFetch<User[]>('/auth/profiles').then(res => {
                if (Array.isArray(res) && res.length > 0 && apiUsers.length === 0) {
                    apiUsers = res;
                    usersFetched = true;
                }
            }).catch(e => console.warn("API profiles fetch notice:", e?.message || e)),
            apiClient.apiFetch<Order[]>('/orders').then(res => {
                if (Array.isArray(res)) {
                    apiOrders = res;
                    ordersFetched = true;
                }
            }).catch(e => console.warn("API orders fetch notice:", e?.message || e)),
            apiClient.apiFetch<Product[]>('/products').then(res => {
                if (Array.isArray(res)) {
                    apiProducts = res;
                    productsFetched = true;
                }
            }).catch(e => console.warn("API products fetch notice:", e?.message || e))
        ]);

        const finalUsers = usersFetched && apiUsers.length > 0
            ? apiUsers.map(u => ({ ...u, role: normalizeRole(u.role), assignedClientIds: Array.isArray(u.assignedClientIds) ? u.assignedClientIds : [] }))
            : getStoredUsers();
        const finalOrders = ordersFetched ? apiOrders.filter(isOrderWithData) : getStoredOrders();
        const finalProducts = productsFetched ? apiProducts : getStoredProducts();

        if (usersFetched && finalUsers.length > 0) saveStoredUsers(finalUsers);
        if (ordersFetched && finalOrders.length > 0) saveStoredOrders(finalOrders);
        if (productsFetched && finalProducts.length > 0) saveStoredProducts(finalProducts);

        return {
            users: finalUsers,
            orders: finalOrders,
            products: finalProducts
        };
    },

    users: {
        async getAll(): Promise<User[]> {
            let apiUsers: User[] = [];
            let usersFetched = false;

            await Promise.allSettled([
                apiClient.apiFetch<User[]>('/users').then(res => {
                    if (Array.isArray(res) && res.length > 0) {
                        apiUsers = res;
                        usersFetched = true;
                    }
                }).catch(e => console.warn("API users err notice:", e?.message || e)),
                apiClient.apiFetch<User[]>('/auth/profiles').then(res => {
                    if (Array.isArray(res) && res.length > 0 && apiUsers.length === 0) {
                        apiUsers = res;
                        usersFetched = true;
                    }
                }).catch(e => console.warn("API profiles err notice:", e?.message || e))
            ]);

            const finalUsers = usersFetched && apiUsers.length > 0
                ? apiUsers.map(u => ({ ...u, role: normalizeRole(u.role), assignedClientIds: Array.isArray(u.assignedClientIds) ? u.assignedClientIds : [] }))
                : getStoredUsers();
            if (usersFetched && finalUsers.length > 0) saveStoredUsers(finalUsers);
            return finalUsers;
        },

        async create(newUser: User, password?: string): Promise<User> {
            const userWithPass: User = {
                ...newUser,
                password: password || newUser.password
            };
            
            // Persist to server backend API
            let created: User | null = null;
            try {
                created = await apiClient.apiPost<User>('/users', userWithPass);
            } catch (err) {
                console.warn("Backend user creation warning, saving locally:", err);
            }
            const finalUser = created && created.id ? { ...userWithPass, ...created } : userWithPass;

            const users = getStoredUsers();
            const idx = users.findIndex(u => u.id === finalUser.id || (u.email && u.email.toLowerCase() === finalUser.email.toLowerCase()));
            if (idx !== -1) users[idx] = finalUser;
            else users.push(finalUser);
            saveStoredUsers(users);
            return finalUser;
        },

        async update(id: string, updates: Partial<User>, newPassword?: string): Promise<boolean> {
            const users = getStoredUsers();
            const idx = users.findIndex(u => u.id === id || (u.email && updates.email && u.email.toLowerCase() === updates.email.toLowerCase()));
            if (idx !== -1) {
                users[idx] = { 
                    ...users[idx], 
                    ...updates, 
                    role: normalizeRole(updates.role || users[idx].role),
                    ...(newPassword ? { password: newPassword } : {}) 
                };
                saveStoredUsers(users);
            }

            const payload = { ...updates, password: newPassword };
            await apiClient.apiPut(`/users/${encodeURIComponent(id)}`, payload);
            return true;
        },

        async delete(id: string): Promise<boolean> {
            await apiClient.apiDelete(`/users/${encodeURIComponent(id)}`);

            const users = getStoredUsers().filter(u => u.id !== id && (u.email ? u.email.toLowerCase() !== id.toLowerCase() : true));
            saveStoredUsers(users);
            return true;
        },

        async deleteAll(keepAdminUserId?: string): Promise<boolean> {
            try {
                await apiClient.apiDelete('/users/all');
            } catch (e) {
                console.warn("Backend users deletion warning:", e);
            }
            const users = getStoredUsers();
            const remaining = users.filter(u => 
                (keepAdminUserId && u.id === keepAdminUserId) || 
                normalizeRole(u.role) === Role.Admin
            );
            saveStoredUsers(remaining);
            return true;
        }
    },

    orders: {
        async getAll(): Promise<Order[]> {
            let apiOrders: Order[] = [];

            try {
                const res = await apiClient.apiFetch<Order[]>('/orders');
                if (Array.isArray(res)) apiOrders = res;
            } catch (e) {
                console.warn("API /orders fetch error:", e);
                // Return current runtime cache in memory without pushing anything to DB
                return getStoredOrders();
            }

            const cleanOrders = apiOrders.filter(isOrderWithData);
            saveStoredOrders(cleanOrders);
            return cleanOrders;
        },

        async create(order: Order): Promise<{ success: boolean; syncResult?: any }> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise. Impossible d'enregistrer la commande hors ligne.");
            }
            // Strict online modification directly to database
            const resData = await apiClient.apiPost<any>('/orders', order);
            const orders = getStoredOrders();
            const idx = orders.findIndex(o => o.id === order.id);
            if (idx !== -1) orders[idx] = order;
            else orders.unshift(order);
            saveStoredOrders(orders);
            return { success: true, syncResult: resData?.sheetSyncResult };
        },

        async bulkCreate(newOrders: Order[]): Promise<boolean> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise. Impossible d'importer des commandes hors ligne.");
            }
            // Strict online modification directly to database
            await apiClient.apiPost('/orders/bulk', { orders: newOrders });
            const orders = getStoredOrders();
            newOrders.forEach(o => {
                const idx = orders.findIndex(m => m.id === o.id);
                if (idx !== -1) {
                    orders[idx] = { ...orders[idx], ...o };
                } else {
                    orders.unshift(o);
                }
            });
            saveStoredOrders(orders);
            return true;
        },

        async replaceForClient(clientId: string, freshOrders: Order[]): Promise<boolean> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise pour synchroniser le magasin.");
            }
            const cleanClientId = String(clientId || '').trim().toLowerCase();
            const allOrders = getStoredOrders();
            const filteredOrders = cleanClientId
                ? allOrders.filter(o => String(o.clientId || '').trim().toLowerCase() !== cleanClientId)
                : [];
            
            const updated = stableSortOrders([...freshOrders, ...filteredOrders], false);
            saveStoredOrders(updated);
            return true;
        },

        async update(id: string, updates: Partial<Order>): Promise<{ success: boolean; syncResult?: any }> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise. Impossible de modifier la commande hors ligne.");
            }
            // Strict online modification directly to database
            const resData = await apiClient.apiPut<any>(`/orders/${id}`, updates);

            const orders = getStoredOrders();
            const idx = orders.findIndex(o => String(o.id) === String(id));
            const mergedOrder: Order = idx !== -1 ? { ...orders[idx], ...updates } : ({ id, ...updates } as Order);

            if (idx !== -1) {
                orders[idx] = mergedOrder;
            } else {
                orders.unshift(mergedOrder);
            }
            saveStoredOrders(orders);
            return { success: true, syncResult: resData?.syncResult };
        },

        async delete(id: string): Promise<boolean> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise. Impossible de supprimer la commande hors ligne.");
            }
            const cleanId = String(id).trim();
            const cleanLower = cleanId.toLowerCase();

            // Strict online deletion directly on database
            await apiClient.apiDelete(`/orders/${encodeURIComponent(cleanId)}`);
            const orders = getStoredOrders().filter(o => String(o.id).trim().toLowerCase() !== cleanLower);
            saveStoredOrders(orders);
            return true;
        },

        async deleteAll(clientId?: string): Promise<boolean> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise. Impossible de supprimer les commandes hors ligne.");
            }
            const cleanClientId = clientId ? String(clientId).trim() : undefined;
            const endpoint = cleanClientId ? `/orders/all?clientId=${encodeURIComponent(cleanClientId)}` : '/orders/all';
            // Strict online deletion directly on database
            await apiClient.apiDelete(endpoint);

            const orders = getStoredOrders();
            if (cleanClientId) {
                const targetClean = cleanClientId.toLowerCase();
                const filtered = orders.filter(o => String(o.clientId || '').trim().toLowerCase() !== targetClean);
                saveStoredOrders(filtered);
            } else {
                saveStoredOrders([]);
            }
            return true;
        },

        async archiveOld(clientId?: string): Promise<boolean> {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error("Connexion Internet requise pour archiver les commandes.");
            }
            await apiClient.apiPost('/orders/archive-old', { clientId });
            const orders = getStoredOrders();
            const threshold = new Date();
            threshold.setDate(threshold.getDate() - 30);

            orders.forEach(o => {
                if (new Date(o.date) < threshold && (o.status === OrderStatus.Confirme || o.status === OrderStatus.Annule)) {
                    if (!clientId || o.clientId === clientId) {
                        o.archived = true;
                    }
                }
            });
            saveStoredOrders(orders);
            return true;
        },

        async syncGoogleSheet(id: string, updates?: any): Promise<{ success: boolean; message?: string }> {
            try {
                const res = await apiClient.apiPost<{ success: boolean; message?: string; details?: any }>(`/orders/${id}/sync-sheet`, updates || {});
                return res;
            } catch (e: any) {
                console.warn("Manual sync error:", e);
                return { success: false, message: e.message || "Erreur de connexion" };
            }
        }
    },

    products: {
        async getAll(clientId?: string): Promise<Product[]> {
            let apiProducts: Product[] = [];
            const url = clientId ? `/products?clientId=${encodeURIComponent(clientId)}` : '/products';
            try {
                const res = await apiClient.apiFetch<Product[]>(url);
                if (Array.isArray(res)) apiProducts = res;
            } catch (e) {
                console.warn("API /products fetch error:", e);
            }

            if (apiProducts.length > 0) {
                saveStoredProducts(apiProducts, clientId);
                return apiProducts;
            }

            return getStoredProducts(clientId);
        },

        async save(product: Product): Promise<Product> {
            let savedProduct = product;
            try {
                const res = await apiClient.apiPost<Product>('/products', product);
                if (res && res.id) savedProduct = res;
            } catch (e) {
                console.warn("Backend product creation/save error:", e);
            }

            const products = getStoredProducts();
            const idx = products.findIndex(p => p.id === savedProduct.id);
            if (idx !== -1) {
                products[idx] = savedProduct;
            } else {
                products.unshift(savedProduct);
            }
            saveStoredProducts(products, savedProduct.clientId);
            return savedProduct;
        },

        async saveBulk(productsToSave: Product[]): Promise<Product[]> {
            if (!productsToSave || productsToSave.length === 0) return [];
            let returnedProducts: Product[] = [];
            try {
                const res = await apiClient.apiPost<{ saved: number; products: Product[] }>('/products/bulk', { products: productsToSave });
                if (res && Array.isArray(res.products) && res.products.length > 0) {
                    returnedProducts = res.products;
                }
            } catch (e) {
                console.warn("Backend bulk products save error:", e);
            }

            const current = getStoredProducts();
            const items = returnedProducts.length > 0 ? returnedProducts : productsToSave;
            const updated = mergeProductLists(current, items);
            saveStoredProducts(updated);
            return items;
        },

        async create(product: Product): Promise<{ success: boolean; product?: Product }> {
            let savedProduct = product;
            try {
                const res = await apiClient.apiPost<Product>('/products', product);
                if (res && res.id) savedProduct = res;
            } catch (e) {
                console.warn("Backend product creation error:", e);
            }

            const products = getStoredProducts();
            const idx = products.findIndex(p => p.id === savedProduct.id);
            if (idx !== -1) {
                products[idx] = savedProduct;
            } else {
                products.unshift(savedProduct);
            }
            saveStoredProducts(products, savedProduct.clientId);
            return { success: true, product: savedProduct };
        },

        async update(id: string, updates: Partial<Product>): Promise<{ success: boolean; product?: Product }> {
            const products = getStoredProducts();
            const idx = products.findIndex(p => p.id === id);
            const mergedProduct: Product = idx !== -1
                ? { ...products[idx], ...updates, updatedAt: new Date().toISOString() }
                : ({ id, ...updates, updatedAt: new Date().toISOString() } as Product);

            try {
                await apiClient.apiPut(`/products/${id}`, updates);
            } catch (e) {
                console.warn("Backend product update error:", e);
            }

            if (idx !== -1) {
                products[idx] = mergedProduct;
            } else {
                products.unshift(mergedProduct);
            }
            saveStoredProducts(products, mergedProduct.clientId);
            return { success: true, product: mergedProduct };
        },

        async delete(id: string): Promise<boolean> {
            try {
                await apiClient.apiDelete(`/products/${id}`);
            } catch (e) {
                console.warn("Backend product delete error:", e);
            }

            const products = getStoredProducts().filter(p => p.id !== id);
            saveStoredProducts(products);
            return true;
        }
    },

    messages: {
        async getAll(filters?: { storeId?: string; conversationId?: string }): Promise<PlatformMessage[]> {
            let backendMessages: PlatformMessage[] = [];
            try {
                const params = new URLSearchParams();
                if (filters?.storeId) params.append('storeId', filters.storeId);
                if (filters?.conversationId) params.append('conversationId', filters.conversationId);
                const query = params.toString() ? `?${params.toString()}` : '';
                backendMessages = await apiClient.apiFetch<PlatformMessage[]>(`/messages${query}`);
            } catch (e) {
                console.warn("Backend fetch messages fallback to local:", e);
            }

            if (backendMessages && Array.isArray(backendMessages) && backendMessages.length > 0) {
                const current = getStoredMessages();
                const map = new Map<string, PlatformMessage>();
                current.forEach(m => map.set(m.id, m));
                backendMessages.forEach(m => map.set(m.id, m));
                const merged = Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                saveStoredMessages(merged);
                return merged;
            }

            let stored = getStoredMessages();
            if (filters?.storeId) stored = stored.filter(m => m.storeId === filters.storeId);
            if (filters?.conversationId) stored = stored.filter(m => m.conversationId === filters.conversationId);
            return stored.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        },

        async create(message: Partial<PlatformMessage>): Promise<PlatformMessage> {
            const fullMessage: PlatformMessage = {
                id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                conversationId: message.conversationId || message.storeId || 'store-1',
                senderId: message.senderId || 'user',
                senderName: message.senderName || 'Utilisateur',
                senderRole: message.senderRole || Role.Client,
                senderAvatar: message.senderAvatar,
                recipientId: message.recipientId,
                recipientName: message.recipientName,
                storeId: message.storeId || 'store-1',
                storeName: message.storeName,
                content: String(message.content || '').trim(),
                orderRefId: message.orderRefId,
                orderCustomerName: message.orderCustomerName,
                createdAt: message.createdAt || new Date().toISOString(),
                readBy: message.readBy || [message.senderId || 'user']
            };

            let createdFromBackend: PlatformMessage | null = null;
            try {
                createdFromBackend = await apiClient.apiPost<PlatformMessage>('/messages', fullMessage);
            } catch (e) {
                console.warn("Backend create message error, saving locally:", e);
            }

            const finalMsg = createdFromBackend || fullMessage;
            const current = getStoredMessages();
            const idx = current.findIndex(m => m.id === finalMsg.id);
            if (idx !== -1) current[idx] = finalMsg;
            else current.push(finalMsg);
            saveStoredMessages(current);
            return finalMsg;
        },

        async markRead(options: { messageIds?: string[]; conversationId?: string; storeId?: string }): Promise<boolean> {
            try {
                await apiClient.apiPost('/messages/mark-read', options);
            } catch (e) {
                console.warn("Backend mark-read error:", e);
            }

            const current = getStoredMessages();
            current.forEach(m => {
                if (options.messageIds && options.messageIds.includes(m.id)) {
                    if (!m.readBy.includes('current-user')) m.readBy.push('current-user');
                } else if (options.conversationId && m.conversationId === options.conversationId) {
                    if (!m.readBy.includes('current-user')) m.readBy.push('current-user');
                } else if (options.storeId && m.storeId === options.storeId) {
                    if (!m.readBy.includes('current-user')) m.readBy.push('current-user');
                }
            });
            saveStoredMessages(current);
            return true;
        },

        async delete(id: string): Promise<boolean> {
            try {
                await apiClient.apiDelete(`/messages/${id}`);
            } catch (e) {
                console.warn("Backend delete message error:", e);
            }
            const current = getStoredMessages().filter(m => m.id !== id);
            saveStoredMessages(current);
            return true;
        }
    }
};
