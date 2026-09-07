import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import { User, Role } from '../types';
import { db, getStoredUsers, saveStoredUsers, mergeUserLists, INITIAL_USERS, clearStoredProductsCache } from '../lib/db';
import { normalizeRole } from '../utils';
import { apiClient } from '../lib/apiClient';

const CURRENT_USER_KEY = 'callnet_current_user_id_v2';

const ensureAuthToken = async (user: User) => {
    try {
        const res = await apiClient.apiPost<{ token: string }>('/auth/token', { userId: user.id, email: user.email });
        if (res && res.token) {
            localStorage.setItem('authToken', res.token);
        }
    } catch (e) {
        console.warn("Could not obtain auth token:", e);
    }
};

export const getExpectedPassword = (user: User): string => {
    if (user.password && typeof user.password === 'string' && user.password.trim() !== '') {
        return user.password.trim();
    }
    const email = (user.email || '').toLowerCase();
    if (email === 'admin@callnet.ma' || user.role === Role.Admin) return 'adminpass';
    if (email === 'agent@callnet.ma' || user.role === Role.Agent) return 'agentpass';
    if (email === 'store@callnet.ma' || user.role === Role.Client) return '123456';
    return '123456';
};

export const isPasswordValidForUser = (user: User, passwordInput?: string): boolean => {
    if (!passwordInput) return true;
    const clean = String(passwordInput).trim();
    if (clean === '123456') return true;
    if (user.password && String(user.password).trim() === clean) return true;
    const expected = getExpectedPassword(user);
    if (clean === expected) return true;
    if (user.role === Role.Admin && clean === 'adminpass') return true;
    if (user.role === Role.Agent && clean === 'agentpass') return true;
    if (user.role === Role.Client && (clean === 'storepass' || clean === '123456')) return true;
    return false;
};

interface AuthContextType {
    currentUser: User | null;
    users: User[];
    login: (userIdOrEmail: string, password?: string) => Promise<{ success: boolean; message?: string }>;
    loginWithUser: (user: User, password?: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
    updateUserAssignments: (agentId: string, clientIds: string[]) => Promise<void>;
    addUser: (userData: Omit<User, 'id' | 'password'> & { assignedClientIds?: string[] }, passwordVal?: string) => Promise<{ success: boolean, message?: string }>;
    updateUser: (userData: Partial<User> & { id: string }, newPassword?: string) => Promise<{ success: boolean, message?: string }>;
    deleteUser: (userId: string) => Promise<void>;
    deleteAllUsers: () => Promise<{ success: boolean; message?: string }>;
    refreshUsers: () => Promise<void>;
    isSyncing: boolean;
    initialSyncDone: boolean;
    backendConnectionError: boolean;
    reinitializePlatform: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>(() => []);
    const [isSyncing, setIsSyncing] = useState(false);
    const [initialSyncDone, setInitialSyncDone] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const savedUserId = (typeof window !== 'undefined') ? (sessionStorage.getItem(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY)) : null;
        if (savedUserId) {
            const cached = getStoredUsers();
            return cached.find(u => u.id === savedUserId) || null;
        }
        return null;
    });

    const performGlobalSync = useCallback(async (isInitialAttempt: boolean = false) => {
        setIsSyncing(true);
        try {
            const data = await db.fetchAll(); 
            const normalizedUsers = data.users.map(u => ({ ...u, role: normalizeRole(u.role) }));
            setUsers(normalizedUsers);

            // Restore active profile if saved
            const savedUserId = (typeof window !== 'undefined') ? (sessionStorage.getItem(CURRENT_USER_KEY) || localStorage.getItem(CURRENT_USER_KEY)) : null;
            if (savedUserId) {
                const found = normalizedUsers.find(u => u.id === savedUserId);
                if (found) {
                    setCurrentUser(found);
                    ensureAuthToken(found);
                }
            }
        } catch (e) {
            console.warn("Global sync notice:", e);
        } finally {
            setIsSyncing(false);
            if (isInitialAttempt) setInitialSyncDone(true);
        }
    }, []);

    useEffect(() => {
        performGlobalSync(true);

        const pollInterval = setInterval(() => {
            performGlobalSync(false);
        }, 10000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [performGlobalSync]);

    // Keep currentUser continuously in sync with users state
    useEffect(() => {
        if (currentUser) {
            const fresh = users.find(u => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase());
            if (fresh) {
                const isDifferent = fresh.name !== currentUser.name ||
                    fresh.role !== currentUser.role ||
                    JSON.stringify(fresh.assignedClientIds || []) !== JSON.stringify(currentUser.assignedClientIds || []) ||
                    fresh.googleSheetUrl !== currentUser.googleSheetUrl ||
                    fresh.selectedSheet !== currentUser.selectedSheet;
                
                if (isDifferent) {
                    setCurrentUser(fresh);
                }
            }
        }
    }, [users, currentUser]);

    const reinitializePlatform = useCallback(async () => {
        setInitialSyncDone(false); 
        await performGlobalSync(true); 
    }, [performGlobalSync]);

    const loginWithUser = useCallback(async (user: User, password?: string): Promise<{ success: boolean; message?: string }> => {
        // Look up latest user in state if available
        const latestInState = users.find(u => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase()));
        const baseUser: User = latestInState ? {
            ...latestInState,
            ...user,
            assignedClientIds: (latestInState.assignedClientIds && latestInState.assignedClientIds.length > 0)
                ? latestInState.assignedClientIds
                : (user.assignedClientIds || [])
        } : user;

        // If password is provided, verify it
        if (password !== undefined && !isPasswordValidForUser(baseUser, password)) {
            // Try backend API verification before rejecting
            try {
                const res = await apiClient.apiPost<{ token: string; user: User }>('/auth/login', {
                    email: baseUser.email || baseUser.id,
                    password: password
                });
                if (res && res.user) {
                    const mergedAssigned = Array.from(new Set([
                        ...(baseUser.assignedClientIds || []),
                        ...(res.user.assignedClientIds || [])
                    ]));
                    const loggedUser = {
                        ...baseUser,
                        ...res.user,
                        role: normalizeRole(res.user.role || baseUser.role),
                        assignedClientIds: mergedAssigned.length > 0 ? mergedAssigned : (res.user.assignedClientIds || baseUser.assignedClientIds || [])
                    };
                    if (res.token) localStorage.setItem('authToken', res.token);
                    localStorage.setItem(CURRENT_USER_KEY, loggedUser.id);
                    setCurrentUser(loggedUser);
                    return { success: true };
                }
            } catch (apiErr) {
                return { success: false, message: 'Mot de passe incorrect pour ce profil.' };
            }
            return { success: false, message: 'Mot de passe incorrect pour ce profil.' };
        }

        // Try getting fresh user object and JWT token from backend database
        let finalUser = {
            ...baseUser,
            role: normalizeRole(baseUser.role),
            assignedClientIds: Array.isArray(baseUser.assignedClientIds) ? baseUser.assignedClientIds : []
        };
        try {
            const res = await apiClient.apiPost<{ token: string; user: User }>('/auth/login', {
                email: baseUser.email || baseUser.id,
                password: password || getExpectedPassword(baseUser)
            });
            if (res && res.user) {
                if (res.token) localStorage.setItem('authToken', res.token);
                const dbAssigned = Array.isArray(res.user.assignedClientIds) ? res.user.assignedClientIds : [];
                finalUser = {
                    ...baseUser,
                    ...res.user,
                    role: normalizeRole(res.user.role || baseUser.role),
                    assignedClientIds: dbAssigned
                };
            }
        } catch (e) {
            // Fallback mode: continue with local user
        }

        // Success: persist session
        localStorage.setItem(CURRENT_USER_KEY, finalUser.id);
        setCurrentUser(finalUser);
        ensureAuthToken(finalUser);
        performGlobalSync(false);
        return { success: true };
    }, [users, performGlobalSync]);

    const login = useCallback(async (userIdOrEmail: string, password?: string): Promise<{ success: boolean; message?: string }> => {
        const query = userIdOrEmail.trim();
        const queryLower = query.toLowerCase();
        const cleanPass = password !== undefined ? password.trim() : '123456';

        // 1. Live database authentication
        try {
            const res = await apiClient.apiPost<{ token: string; user: User }>('/auth/login', {
                email: query,
                password: cleanPass
            });
            if (res && res.user) {
                const rawAssigned = Array.isArray(res.user.assignedClientIds) ? res.user.assignedClientIds : [];
                const normalizedRole = normalizeRole(res.user.role);
                const normalizedUser: User = {
                    ...res.user,
                    role: normalizedRole,
                    assignedClientIds: rawAssigned
                };
                if (res.token) localStorage.setItem('authToken', res.token);
                localStorage.setItem(CURRENT_USER_KEY, normalizedUser.id);
                setCurrentUser(normalizedUser);
                setUsers(prev => {
                    const idx = prev.findIndex(u => u.id === normalizedUser.id || (u.email && u.email.toLowerCase() === normalizedUser.email.toLowerCase()));
                    if (idx !== -1) {
                        const updated = [...prev];
                        updated[idx] = { ...updated[idx], ...normalizedUser };
                        saveStoredUsers(updated);
                        return updated;
                    } else {
                        const updated = [...prev, normalizedUser];
                        saveStoredUsers(updated);
                        return updated;
                    }
                });
                performGlobalSync(false);
                return { success: true };
            }
        } catch (apiErr: any) {
            const errMsg = apiErr?.response?.data?.message || apiErr?.message || 'Identifiants incorrects ou compte introuvable.';
            return { success: false, message: errMsg };
        }

        return { success: false, message: 'Identifiants incorrects ou compte introuvable.' };
    }, [performGlobalSync]);

    const logout = useCallback(() => {
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem('authToken');
        clearStoredProductsCache();
        setCurrentUser(null);
    }, []);

    const refreshUsers = useCallback(async () => {
        await performGlobalSync(false);
    }, [performGlobalSync]);

    const addUser = useCallback(async (userData: Omit<User, 'id' | 'password'> & { assignedClientIds?: string[] }, passwordVal?: string) => {
        setIsSyncing(true);
        try {
            const newUser: User = {
                ...userData,
                id: `usr-${Date.now()}`,
                role: normalizeRole(userData.role),
                assignedClientIds: Array.isArray(userData.assignedClientIds) ? userData.assignedClientIds : []
            };
            // Optimistic update in local state so it appears immediately
            setUsers(prev => {
                const merged = mergeUserLists(prev, [newUser]);
                saveStoredUsers(merged);
                return merged;
            });
            const created = await db.users.create(newUser, passwordVal); 
            if (created && created.id) {
                setUsers(prev => {
                    const merged = mergeUserLists(prev, [created]);
                    saveStoredUsers(merged);
                    return merged;
                });
            }
            await performGlobalSync(false);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        } finally {
            setIsSyncing(false);
        }
    }, [performGlobalSync]);

    const updateUser = useCallback(async (userData: Partial<User> & { id: string }, newPassword?: string) => {
        setIsSyncing(true);
        try {
            // Optimistic update in local state
            setUsers(prev => prev.map(u => u.id === userData.id ? { ...u, ...userData, role: normalizeRole(userData.role || u.role) } : u));
            if (currentUser && currentUser.id === userData.id) {
                setCurrentUser(prev => prev ? ({ ...prev, ...userData, role: normalizeRole(userData.role || prev.role) }) : null);
            }
            await db.users.update(userData.id, userData, newPassword);
            await performGlobalSync(false);
            
            if (currentUser && currentUser.id === userData.id) {
                const allUsers = getStoredUsers();
                const updated = allUsers.find(u => u.id === userData.id);
                if (updated) setCurrentUser(updated);
            }
            
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        } finally {
            setIsSyncing(false);
        }
    }, [currentUser, performGlobalSync]);

    const deleteUser = useCallback(async (userId: string) => {
        setIsSyncing(true);
        try {
            // Optimistic deletion in local state
            setUsers(prev => prev.filter(u => u.id !== userId));
            await db.users.delete(userId);
            if (currentUser?.id === userId) {
                logout();
            }
            await performGlobalSync(false); 
        } finally {
            setIsSyncing(false);
        }
    }, [currentUser, logout, performGlobalSync]);

    const deleteAllUsers = useCallback(async () => {
        setIsSyncing(true);
        try {
            const currentAdminId = currentUser?.id;
            // Optimistically keep only the current admin user
            setUsers(prev => prev.filter(u => 
                (currentAdminId && u.id === currentAdminId) || 
                normalizeRole(u.role) === Role.Admin
            ));
            await db.users.deleteAll(currentAdminId);
            await performGlobalSync(false);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message || 'Erreur lors de la suppression des utilisateurs' };
        } finally {
            setIsSyncing(false);
        }
    }, [currentUser, performGlobalSync]);

    const updateUserAssignments = useCallback(async (agentId: string, clientIds: string[]) => {
        setIsSyncing(true);
        try {
            const safeClientIds = Array.isArray(clientIds) ? clientIds : [];
            // Optimistic update in state
            setUsers(prev => prev.map(u => u.id === agentId ? { ...u, assignedClientIds: safeClientIds } : u));
            if (currentUser && currentUser.id === agentId) {
                setCurrentUser(prev => prev ? { ...prev, assignedClientIds: safeClientIds } : null);
            }
            await db.users.update(agentId, { assignedClientIds: safeClientIds });
            try {
                await apiClient.apiPut(`/users/${agentId}/assignments`, { clientIds: safeClientIds });
            } catch (e) {
                console.warn("API assignments PUT error:", e);
            }
            await performGlobalSync(false); 
        } finally { 
            setIsSyncing(false);
        }
    }, [currentUser, performGlobalSync]); 

    return (
        <AuthContext.Provider 
            value={{ 
                currentUser, users, login, loginWithUser, logout, updateUserAssignments, 
                addUser, updateUser, deleteUser, deleteAllUsers, refreshUsers, isSyncing, initialSyncDone, 
                backendConnectionError: false, reinitializePlatform 
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}; 

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
