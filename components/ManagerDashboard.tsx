import React, { useState, useMemo } from 'react';
import { 
    Users, 
    Headphones, 
    Award, 
    TrendingUp, 
    CheckCircle2, 
    XCircle, 
    PhoneOff, 
    Clock, 
    Sparkles, 
    Store as StoreIcon, 
    Building2,
    ShieldCheck, 
    ArrowRight, 
    Search, 
    Filter, 
    Plus, 
    Edit2, 
    MessageSquare, 
    Zap, 
    BarChart3, 
    CheckSquare, 
    PhoneCall, 
    RefreshCw, 
    ExternalLink,
    Send,
    Bot,
    ChevronDown,
    SlidersHorizontal,
    Percent,
    DollarSign,
    Layers,
    Share2,
    Database,
    Phone,
    Mail,
    Check
} from 'lucide-react';
import { User, Order, OrderStatus, Role, AgentPerformanceMetrics } from '../types';
import { normalizeRole, normalizeStatus } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import UserAvatar from './UserAvatar';
import { apiClient } from '../lib/apiClient';

interface ManagerDashboardProps {
    orders: Order[];
    allUsers: User[];
    onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus, reason?: string, note?: string) => Promise<void>;
    onSelectOrder?: (order: Order) => void;
    onOpenAddUserModal?: () => void;
    onOpenEditUserModal?: (user: User) => void;
    onNavigateToCallCenter?: (storeId?: string) => void;
    onNavigateToMessages?: (storeId?: string, recipientId?: string) => void;
    adminSelectedStoreId?: string;
    onSelectStore?: (storeId: string) => void;
}

type ManagerTab = 'performance' | 'operators' | 'stores' | 'confirmation' | 'ai-coach';

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
    orders = [],
    allUsers = [],
    onUpdateOrderStatus,
    onSelectOrder,
    onOpenAddUserModal,
    onOpenEditUserModal,
    onNavigateToCallCenter,
    onNavigateToMessages,
    adminSelectedStoreId = 'all',
    onSelectStore
}) => {
    const { currentUser, updateUserAssignments, refreshUsers } = useAuth();
    const { t, language } = useLanguage();

    const [activeTab, setActiveTab] = useState<ManagerTab>('performance');
    const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7days' | '30days' | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>(adminSelectedStoreId || 'all');
    const [operatorSearchQuery, setOperatorSearchQuery] = useState('');
    const [storeSearchQuery, setStoreSearchQuery] = useState('');
    const [syncingStoreId, setSyncingStoreId] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<{ storeId: string; text: string; success: boolean } | null>(null);

    // Quick Store Assignment editing state
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [tempAssignedStores, setTempAssignedStores] = useState<string[]>([]);
    const [isSavingAssignments, setIsSavingAssignments] = useState(false);

    // AI Coach State
    const [aiActionType, setAiActionType] = useState<'team-audit' | 'pitch-generator' | 'workload-balance' | 'daily-briefing'>('team-audit');
    const [aiPitchProduct, setAiPitchProduct] = useState('');
    const [aiPitchObjection, setAiPitchObjection] = useState('Hésitation sur le prix ou la qualité');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);

    // Quick Confirmation Filter in Tab 3
    const [confirmationStatusFilter, setConfirmationStatusFilter] = useState<string>(OrderStatus.EnAttend);
    const [confirmationSearch, setConfirmationSearch] = useState('');

    // 1. List of all stores (Role.Client)
    const stores = useMemo(() => {
        return allUsers.filter(u => normalizeRole(u.role) === Role.Client);
    }, [allUsers]);

    // 2. List of all Call Center Operators (Role.Agent)
    const operators = useMemo(() => {
        return allUsers.filter(u => normalizeRole(u.role) === Role.Agent);
    }, [allUsers]);

    // 2.5 Detailed stats per store
    const storeStatsList = useMemo(() => {
        return stores.map(store => {
            const storeOrders = orders.filter(o => {
                const cId = String(o.clientId || '').toLowerCase().trim();
                const sId = String(store.id || '').toLowerCase().trim();
                const sEmail = String(store.email || '').toLowerCase().trim();
                const sName = String(store.name || '').toLowerCase().trim();
                return cId === sId || cId === sEmail || cId === sName;
            });

            let pending = 0;
            let confirmed = 0;
            let cancelled = 0;
            let unreachable = 0;
            let totalRevenue = 0;

            storeOrders.forEach(o => {
                const st = normalizeStatus(o.status);
                const rawSt = String(o.status || '').toLowerCase();
                const price = Number(o.price || 0);

                if (st === OrderStatus.Confirme || st === OrderStatus.Expider || rawSt.includes('livr')) {
                    confirmed++;
                    totalRevenue += price;
                } else if (st === OrderStatus.Annule) {
                    cancelled++;
                } else if (rawSt.includes('injoign') || rawSt.includes('pas de rep') || rawSt.includes('sans rep')) {
                    unreachable++;
                } else {
                    pending++;
                }
            });

            const totalProcessed = confirmed + cancelled + unreachable;
            const confirmRate = totalProcessed > 0 ? Math.round((confirmed / totalProcessed) * 100) : 0;

            // Find assigned operators for this store
            const assignedOps = operators.filter(op => {
                const list = Array.isArray(op.assignedClientIds) ? op.assignedClientIds : [];
                return list.length === 0 || list.includes('all') || list.includes('*') || list.some(id => 
                    String(id).toLowerCase() === String(store.id).toLowerCase() || 
                    String(id).toLowerCase() === String(store.email).toLowerCase() ||
                    String(id).toLowerCase() === String(store.name).toLowerCase()
                );
            });

            return {
                store,
                totalOrders: storeOrders.length,
                pending,
                confirmed,
                cancelled,
                unreachable,
                confirmRate,
                totalRevenue,
                assignedOperators: assignedOps
            };
        });
    }, [stores, orders, operators]);

    // Handle quick store sync
    const handleSyncStore = async (storeId: string) => {
        setSyncingStoreId(storeId);
        setSyncMessage(null);
        try {
            const res = await apiClient.apiPost<{ success: boolean; message?: string }>(`/sync/store/${storeId}`, {});
            if (res) {
                setSyncMessage({ storeId, text: 'Synchronisation réussie !', success: true });
                if (refreshUsers) refreshUsers();
            }
        } catch (err: any) {
            setSyncMessage({ storeId, text: err?.message || 'Erreur lors de la synchronisation', success: false });
        } finally {
            setSyncingStoreId(null);
            setTimeout(() => setSyncMessage(null), 4000);
        }
    };

    // 3. Filter orders by Period & Selected Store
    const filteredOrders = useMemo(() => {
        let result = [...orders];

        // Store filter
        if (selectedStoreFilter && selectedStoreFilter !== 'all') {
            const cleanTarget = selectedStoreFilter.toLowerCase().trim();
            result = result.filter(o => {
                const cId = String(o.clientId || '').toLowerCase().trim();
                return cId === cleanTarget;
            });
        }

        // Period filter
        if (selectedPeriod !== 'all') {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            result = result.filter(o => {
                if (!o.date) return false;
                const orderTime = new Date(o.date).getTime();
                if (isNaN(orderTime)) return true;

                if (selectedPeriod === 'today') {
                    return orderTime >= startOfToday;
                } else if (selectedPeriod === '7days') {
                    return orderTime >= (now.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (selectedPeriod === '30days') {
                    return orderTime >= (now.getTime() - 30 * 24 * 60 * 60 * 1000);
                }
                return true;
            });
        }

        return result;
    }, [orders, selectedStoreFilter, selectedPeriod]);

    // 4. Calculate detailed performance metrics per operator
    const operatorPerformanceList = useMemo((): AgentPerformanceMetrics[] => {
        if (operators.length === 0) return [];

        const list: AgentPerformanceMetrics[] = operators.map(agent => {
            const assignedStores = Array.isArray(agent.assignedClientIds) ? agent.assignedClientIds : [];
            const isAllStores = assignedStores.length === 0 || assignedStores.includes('all') || assignedStores.includes('*');

            // Find orders assigned to this agent's stores
            const agentOrders = filteredOrders.filter(o => {
                if (isAllStores) return true;
                const cId = String(o.clientId || '').toLowerCase();
                return assignedStores.some(s => String(s).toLowerCase() === cId);
            });

            const totalAssignedOrders = agentOrders.length;
            
            // Status counts
            let confirmedCount = 0;
            let cancelledCount = 0;
            let unreachableCount = 0;
            let pendingCount = 0;
            let totalConfirmedRevenue = 0;

            agentOrders.forEach(o => {
                const st = normalizeStatus(o.status);
                const rawSt = String(o.status || '').toLowerCase();
                const price = Number(o.price || 0);

                if (st === OrderStatus.Confirme || st === OrderStatus.Expider || rawSt.includes('livr')) {
                    confirmedCount++;
                    totalConfirmedRevenue += price;
                } else if (st === OrderStatus.Annule) {
                    cancelledCount++;
                } else if (rawSt.includes('injoignable') || rawSt.includes('pas de rep') || rawSt.includes('injoign') || rawSt.includes('sans rep')) {
                    unreachableCount++;
                } else {
                    pendingCount++;
                }
            });

            const totalProcessed = confirmedCount + cancelledCount + unreachableCount;
            const confirmedRate = totalProcessed > 0 ? Math.round((confirmedCount / totalProcessed) * 100) : 0;
            const cancelledRate = totalProcessed > 0 ? Math.round((cancelledCount / totalProcessed) * 100) : 0;
            const unreachableRate = totalProcessed > 0 ? Math.round((unreachableCount / totalProcessed) * 100) : 0;
            const averageBasketConfirmed = confirmedCount > 0 ? Math.round(totalConfirmedRevenue / confirmedCount) : 0;

            let performanceBadge = '⚡ Actif';
            if (confirmedRate >= 80 && totalProcessed >= 5) {
                performanceBadge = '🏆 Top Performer';
            } else if (confirmedRate >= 70) {
                performanceBadge = '🎯 Expert Confirmation';
            } else if (unreachableRate > 35) {
                performanceBadge = '⚠️ Attention Injoignables';
            }

            return {
                agentId: agent.id,
                agentName: agent.name || 'Opérateur',
                agentEmail: agent.email || '',
                agentAvatar: agent.avatarUrl,
                phone: agent.phone,
                assignedClientIds: assignedStores,
                totalAssignedOrders,
                totalProcessedOrders: totalProcessed,
                confirmedCount,
                confirmedRate,
                cancelledCount,
                cancelledRate,
                unreachableCount,
                unreachableRate,
                pendingCount,
                totalConfirmedRevenue,
                averageBasketConfirmed,
                performanceBadge
            };
        });

        // Sort by confirmed count & rate descending
        list.sort((a, b) => {
            if (b.confirmedRate !== a.confirmedRate) {
                return b.confirmedRate - a.confirmedRate;
            }
            return b.confirmedCount - a.confirmedCount;
        });

        // Add Rank
        return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }, [operators, filteredOrders]);

    // 5. Global Team KPIs
    const teamKPIs = useMemo(() => {
        const totalOrders = filteredOrders.length;
        let confirmed = 0;
        let cancelled = 0;
        let unreachable = 0;
        let pending = 0;
        let totalRevenue = 0;

        filteredOrders.forEach(o => {
            const st = normalizeStatus(o.status);
            const rawSt = String(o.status || '').toLowerCase();
            const price = Number(o.price || 0);

            if (st === OrderStatus.Confirme || st === OrderStatus.Expider || rawSt.includes('livr')) {
                confirmed++;
                totalRevenue += price;
            } else if (st === OrderStatus.Annule) {
                cancelled++;
            } else if (rawSt.includes('injoignable') || rawSt.includes('pas de rep')) {
                unreachable++;
            } else {
                pending++;
            }
        });

        const totalProcessed = confirmed + cancelled + unreachable;
        const globalConfirmRate = totalProcessed > 0 ? Math.round((confirmed / totalProcessed) * 100) : 0;
        const globalCancelRate = totalProcessed > 0 ? Math.round((cancelled / totalProcessed) * 100) : 0;
        const avgBasket = confirmed > 0 ? Math.round(totalRevenue / confirmed) : 0;

        return {
            totalOrders,
            confirmed,
            cancelled,
            unreachable,
            pending,
            totalProcessed,
            globalConfirmRate,
            globalCancelRate,
            totalRevenue,
            avgBasket
        };
    }, [filteredOrders]);

    // Quick Store Assignment Handlers
    const handleStartEditingAssignments = (agent: User) => {
        setEditingAgentId(agent.id);
        const current = Array.isArray(agent.assignedClientIds) ? agent.assignedClientIds : [];
        if (current.length === 0) {
            // By default, if empty, select all stores
            setTempAssignedStores(stores.map(s => s.id));
        } else {
            setTempAssignedStores([...current]);
        }
    };

    const handleToggleStoreInAssignment = (storeId: string) => {
        setTempAssignedStores(prev => {
            if (prev.includes(storeId)) {
                return prev.filter(id => id !== storeId);
            } else {
                return [...prev, storeId];
            }
        });
    };

    const handleSaveAssignments = async (agentId: string) => {
        setIsSavingAssignments(true);
        try {
            await updateUserAssignments(agentId, tempAssignedStores);
            setEditingAgentId(null);
        } catch (e) {
            console.error("Failed to save assignments:", e);
        } finally {
            setIsSavingAssignments(false);
        }
    };

    const handleAssignAllToAgent = async (agentId: string) => {
        setIsSavingAssignments(true);
        try {
            const allStoreIds = stores.map(s => s.id);
            await updateUserAssignments(agentId, allStoreIds);
            setEditingAgentId(null);
        } finally {
            setIsSavingAssignments(false);
        }
    };

    const handleUnassignAllFromAgent = async (agentId: string) => {
        setIsSavingAssignments(true);
        try {
            await updateUserAssignments(agentId, []);
            setEditingAgentId(null);
        } finally {
            setIsSavingAssignments(false);
        }
    };

    // AI Coach Execution
    const handleRunAiCoach = async (type: 'team-audit' | 'pitch-generator' | 'workload-balance' | 'daily-briefing') => {
        setIsAiLoading(true);
        setAiActionType(type);
        setAiResult(null);

        let payload: any = {};
        if (type === 'team-audit') {
            payload = {
                teamMetrics: teamKPIs,
                operatorRankings: operatorPerformanceList.map(op => ({
                    name: op.agentName,
                    confirmedRate: `${op.confirmedRate}%`,
                    confirmedCount: op.confirmedCount,
                    cancelledRate: `${op.cancelledRate}%`,
                    unreachableRate: `${op.unreachableRate}%`,
                    storesCount: op.assignedClientIds.length
                }))
            };
        } else if (type === 'pitch-generator') {
            payload = {
                product: aiPitchProduct.trim() || 'Produit Phare E-commerce',
                objection: aiPitchObjection.trim() || 'Hésitation sur le prix ou la qualité',
                category: 'Général E-com COD'
            };
        } else if (type === 'workload-balance') {
            payload = {
                operators: operators.map(op => ({ id: op.id, name: op.name, currentAssigned: op.assignedClientIds })),
                stores: stores.map(st => ({ id: st.id, name: st.name, pendingOrders: orders.filter(o => o.clientId === st.id && normalizeStatus(o.status) === OrderStatus.EnAttend).length }))
            };
        } else {
            payload = {
                date: new Date().toLocaleDateString('fr-FR'),
                pendingOrdersTotal: teamKPIs.pending,
                topPerformerName: operatorPerformanceList[0]?.agentName || 'Équipe Callnet',
                confirmationRateCurrent: `${teamKPIs.globalConfirmRate}%`
            };
        }

        try {
            const res = await apiClient.apiPost<any>('/gemini/manager-coach', {
                actionType: type,
                payload
            });
            setAiResult(res);
        } catch (err: any) {
            console.error("AI Coach Error:", err);
            setAiResult({
                error: "Impossible de joindre l'assistant IA. Vérifiez votre connexion.",
                summary: "Conseil de repli : Priorisez les appels sur les commandes reçues il y a moins de 30 minutes pour maximiser le taux de confirmation."
            });
        } finally {
            setIsAiLoading(false);
        }
    };

    // Filtered orders for Quick Confirmation Tab
    const confirmationOrdersList = useMemo(() => {
        let list = [...filteredOrders];

        if (confirmationStatusFilter !== 'all') {
            list = list.filter(o => {
                const norm = normalizeStatus(o.status);
                if (confirmationStatusFilter === OrderStatus.EnAttend) {
                    return norm === OrderStatus.EnAttend;
                }
                if (confirmationStatusFilter === 'unreachable') {
                    const raw = String(o.status || '').toLowerCase();
                    return raw.includes('injoignable') || raw.includes('pas de rep');
                }
                return norm === confirmationStatusFilter;
            });
        }

        if (confirmationSearch.trim()) {
            const q = confirmationSearch.toLowerCase().trim();
            list = list.filter(o => 
                (o.customerName || '').toLowerCase().includes(q) ||
                (o.phone || '').toLowerCase().includes(q) ||
                (o.id || '').toLowerCase().includes(q) ||
                (o.product || '').toLowerCase().includes(q) ||
                (o.city || '').toLowerCase().includes(q)
            );
        }

        return list;
    }, [filteredOrders, confirmationStatusFilter, confirmationSearch]);

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Superviseur Header */}
            <div className="bg-[#1C2434] border border-[#2E3A47] rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden shadow-xl">
                {/* Ambient glow */}
                <div className="absolute -right-10 -top-10 w-72 h-72 bg-[#3C50E0]/15 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                    <div className="flex items-start sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner text-amber-400">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-syne text-white">
                                    Hub de Supervision Call Center
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    👔 Rôle Manager Actif
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-[#8A99AF] mt-0.5 font-medium">
                                Pilotage des téléconseillers, affectation multi-boutiques et optimisation du taux de confirmation en temps réel.
                            </p>
                        </div>
                    </div>

                    {/* Quick Filters: Store & Period */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Store Selector */}
                        <div className="flex items-center gap-2 bg-[#24303F] border border-[#2E3A47] px-3 py-1.5 rounded-xl text-xs font-semibold">
                            <StoreIcon className="w-3.5 h-3.5 text-[#3C50E0]" />
                            <select
                                value={selectedStoreFilter}
                                onChange={(e) => {
                                    setSelectedStoreFilter(e.target.value);
                                    if (onSelectStore) onSelectStore(e.target.value);
                                }}
                                className="bg-transparent text-white border-none focus:outline-none text-xs font-bold cursor-pointer pr-2"
                            >
                                <option value="all" className="bg-[#24303F] text-white">Toutes les Boutiques ({stores.length})</option>
                                {stores.map(st => (
                                    <option key={st.id} value={st.id} className="bg-[#24303F] text-white">
                                        {st.name || st.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Period Selector */}
                        <div className="flex items-center bg-[#24303F] border border-[#2E3A47] p-1 rounded-xl text-xs font-bold">
                            <button
                                onClick={() => setSelectedPeriod('today')}
                                className={`px-2.5 py-1 rounded-lg transition-all ${selectedPeriod === 'today' ? 'bg-[#3C50E0] text-white shadow-sm' : 'text-[#8A99AF] hover:text-white'}`}
                            >
                                Aujourd'hui
                            </button>
                            <button
                                onClick={() => setSelectedPeriod('7days')}
                                className={`px-2.5 py-1 rounded-lg transition-all ${selectedPeriod === '7days' ? 'bg-[#3C50E0] text-white shadow-sm' : 'text-[#8A99AF] hover:text-white'}`}
                            >
                                7 Jours
                            </button>
                            <button
                                onClick={() => setSelectedPeriod('30days')}
                                className={`px-2.5 py-1 rounded-lg transition-all ${selectedPeriod === '30days' ? 'bg-[#3C50E0] text-white shadow-sm' : 'text-[#8A99AF] hover:text-white'}`}
                            >
                                30 Jours
                            </button>
                            <button
                                onClick={() => setSelectedPeriod('all')}
                                className={`px-2.5 py-1 rounded-lg transition-all ${selectedPeriod === 'all' ? 'bg-[#3C50E0] text-white shadow-sm' : 'text-[#8A99AF] hover:text-white'}`}
                            >
                                Tout
                            </button>
                        </div>
                    </div>
                </div>

                {/* Team Quick Overview Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-[#2E3A47]">
                    <div className="bg-[#24303F]/60 p-3 rounded-xl border border-[#2E3A47]/60">
                        <span className="text-[11px] font-bold text-[#8A99AF] uppercase block">Opérateurs</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xl font-black text-white">{operators.length}</span>
                            <span className="text-[10px] text-[#10B981] font-bold">Actifs</span>
                        </div>
                    </div>

                    <div className="bg-[#24303F]/60 p-3 rounded-xl border border-[#2E3A47]/60">
                        <span className="text-[11px] font-bold text-[#8A99AF] uppercase block">Boutiques</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xl font-black text-white">{stores.length}</span>
                            <span className="text-[10px] text-[#3C50E0] font-bold">Connectées</span>
                        </div>
                    </div>

                    <div className="bg-[#24303F]/60 p-3 rounded-xl border border-[#2E3A47]/60">
                        <span className="text-[11px] font-bold text-amber-400 uppercase block">En Attente</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xl font-black text-amber-400">{teamKPIs.pending}</span>
                            <span className="text-[10px] text-[#8A99AF]">à traiter</span>
                        </div>
                    </div>

                    <div className="bg-[#24303F]/60 p-3 rounded-xl border border-[#2E3A47]/60">
                        <span className="text-[11px] font-bold text-[#10B981] uppercase block">Taux Confirmation</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xl font-black text-[#10B981]">{teamKPIs.globalConfirmRate}%</span>
                            <span className="text-[10px] text-[#8A99AF]">({teamKPIs.confirmed})</span>
                        </div>
                    </div>

                    <div className="bg-[#24303F]/60 p-3 rounded-xl border border-[#2E3A47]/60">
                        <span className="text-[11px] font-bold text-[#FB4444] uppercase block">Annulations</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xl font-black text-[#FB4444]">{teamKPIs.globalCancelRate}%</span>
                            <span className="text-[10px] text-[#8A99AF]">({teamKPIs.cancelled})</span>
                        </div>
                    </div>

                    <div className="bg-[#24303F]/60 p-3 rounded-xl border border-[#2E3A47]/60">
                        <span className="text-[11px] font-bold text-[#3C50E0] uppercase block">CA Confirmé</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-lg font-black text-[#3C50E0] truncate">{teamKPIs.totalRevenue.toLocaleString()}</span>
                            <span className="text-[10px] text-white/70">MAD</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-base-300 pb-2">
                <button
                    onClick={() => setActiveTab('performance')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'performance'
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'bg-base-200 text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    <span>Tableau de Performance</span>
                </button>

                <button
                    onClick={() => setActiveTab('operators')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'operators'
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'bg-base-200 text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Gestion des Opérateurs ({operators.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('stores')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'stores'
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'bg-base-200 text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <Building2 className="w-4 h-4" />
                    <span>Boutiques Partenaires ({stores.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('confirmation')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'confirmation'
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'bg-base-200 text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <CheckSquare className="w-4 h-4" />
                    <span>Confirmation Rapide Multi-Boutiques ({teamKPIs.pending})</span>
                </button>

                <button
                    onClick={() => setActiveTab('ai-coach')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'ai-coach'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                            : 'bg-base-200 text-purple-600 hover:bg-purple-500/10'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>Assistant &amp; Coach IA Superviseur</span>
                </button>
            </div>

            {/* TAB 1: Performance Dashboard */}
            {activeTab === 'performance' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    {/* Top Performer Card & Quick Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Top Performer Spotlight */}
                        <div className="bg-gradient-to-br from-[#1C2434] to-[#24303F] border border-[#2E3A47] rounded-2xl p-5 text-white flex flex-col justify-between shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Award className="w-4 h-4" />
                                    🏆 Leader Confirmation du Moment
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                                    N°1 de l'Équipe
                                </span>
                            </div>

                            {operatorPerformanceList[0] ? (
                                <div className="my-4 flex items-center gap-4">
                                    <div className="relative">
                                        <UserAvatar 
                                            avatarUrl={operatorPerformanceList[0].agentAvatar} 
                                            name={operatorPerformanceList[0].agentName} 
                                            role={Role.Agent} 
                                            size="lg" 
                                        />
                                        <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-black rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                                            1
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-base text-white truncate">
                                            {operatorPerformanceList[0].agentName}
                                        </h3>
                                        <p className="text-xs text-[#8A99AF] truncate">
                                            {operatorPerformanceList[0].agentEmail}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-lg font-black text-[#10B981]">
                                                {operatorPerformanceList[0].confirmedRate}%
                                            </span>
                                            <span className="text-xs text-[#8A99AF]">
                                                ({operatorPerformanceList[0].confirmedCount} confirmées)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-[#8A99AF] my-4">Aucun opérateur assigné pour le moment.</p>
                            )}

                            <div className="pt-3 border-t border-[#2E3A47] flex items-center justify-between text-xs text-[#8A99AF]">
                                <span>CA Généré : <strong className="text-white">{operatorPerformanceList[0]?.totalConfirmedRevenue.toLocaleString() || 0} MAD</strong></span>
                                <button
                                    onClick={() => handleRunAiCoach('team-audit')}
                                    className="text-[#3C50E0] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    Audit IA
                                </button>
                            </div>
                        </div>

                        {/* Conversion Funnel Breakdown */}
                        <div className="bg-base-200 border border-base-300 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" />
                                Entonnoir de Traitement Téléphonique
                            </h3>

                            <div className="space-y-3 flex-1 justify-center flex flex-col">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-text-primary">Confirmées</span>
                                        <span className="text-emerald-600 font-black">{teamKPIs.confirmed} ({teamKPIs.globalConfirmRate}%)</span>
                                    </div>
                                    <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${teamKPIs.globalConfirmRate}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-text-primary">Injoignables / Pas de réponse</span>
                                        <span className="text-amber-500 font-black">{teamKPIs.unreachable}</span>
                                    </div>
                                    <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${teamKPIs.totalProcessed > 0 ? (teamKPIs.unreachable / teamKPIs.totalProcessed) * 100 : 0}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-text-primary">Annulées (Refus client)</span>
                                        <span className="text-red-500 font-black">{teamKPIs.cancelled} ({teamKPIs.globalCancelRate}%)</span>
                                    </div>
                                    <div className="w-full bg-base-300 h-2 rounded-full overflow-hidden">
                                        <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${teamKPIs.globalCancelRate}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-[11px] text-text-secondary mt-3 pt-2 border-t border-base-300 flex justify-between">
                                <span>Panier Moyen Confirmé :</span>
                                <strong className="text-text-primary">{teamKPIs.avgBasket} MAD</strong>
                            </div>
                        </div>

                        {/* Quick Supervision Actions */}
                        <div className="bg-base-200 border border-base-300 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    Actions Rapides Superviseur
                                </h3>
                                <p className="text-xs text-text-secondary font-medium mb-4">
                                    Déclenchez les outils de management et les consoles de confirmation.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={() => onNavigateToCallCenter ? onNavigateToCallCenter(selectedStoreFilter !== 'all' ? selectedStoreFilter : undefined) : setActiveTab('confirmation')}
                                    className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-between shadow-sm cursor-pointer"
                                >
                                    <span className="flex items-center gap-2">
                                        <Headphones className="w-3.5 h-3.5" />
                                        Ouvrir Console Call Center
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>

                                <button
                                    onClick={() => handleRunAiCoach('daily-briefing')}
                                    className="w-full py-2.5 px-3 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 border border-purple-500/20 font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer"
                                >
                                    <span className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                        Générer Briefing du Jour (IA)
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>

                                <button
                                    onClick={() => setActiveTab('operators')}
                                    className="w-full py-2.5 px-3 rounded-xl bg-base-100 hover:bg-base-300 text-text-primary border border-base-300 font-syne font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer"
                                >
                                    <span className="flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        Réaffecter les Boutiques
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Operator Performance Table */}
                    <div className="bg-base-200 border border-base-300 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-4 sm:p-5 border-b border-base-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight text-text-primary flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-primary" />
                                    Classement &amp; Métriques Détaillées par Opérateur
                                </h3>
                                <p className="text-xs text-text-secondary font-medium">
                                    Comparatif de rentabilité, taux de transformation et charge de travail par téléconseiller.
                                </p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={operatorSearchQuery}
                                    onChange={(e) => setOperatorSearchQuery(e.target.value)}
                                    placeholder="Filtrer opérateur..."
                                    className="w-full bg-base-100 border border-base-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-max text-left text-xs">
                                <thead className="bg-base-300/60 uppercase text-[11px] font-black text-text-secondary border-b border-base-300">
                                    <tr>
                                        <th className="py-3 px-4">Rang</th>
                                        <th className="py-3 px-4">Opérateur</th>
                                        <th className="py-3 px-4">Boutiques Assignées</th>
                                        <th className="py-3 px-4 text-center">Traitées</th>
                                        <th className="py-3 px-4 text-center">Confirmées</th>
                                        <th className="py-3 px-4 text-center">Taux Conf.</th>
                                        <th className="py-3 px-4 text-center">Annulées</th>
                                        <th className="py-3 px-4 text-center">Injoignables</th>
                                        <th className="py-3 px-4 text-right">CA Confirmé</th>
                                        <th className="py-3 px-4 text-center">Actions Manager</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base-300/40">
                                    {operatorPerformanceList
                                        .filter(op => !operatorSearchQuery || op.agentName.toLowerCase().includes(operatorSearchQuery.toLowerCase()) || op.agentEmail.toLowerCase().includes(operatorSearchQuery.toLowerCase()))
                                        .map((op) => {
                                            const matchedUser = allUsers.find(u => u.id === op.agentId);
                                            return (
                                                <tr key={op.agentId} className="hover:bg-base-100/60 transition-colors">
                                                    <td className="py-3 px-4 font-black">
                                                        {op.rank === 1 ? (
                                                            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-sm">1</span>
                                                        ) : op.rank === 2 ? (
                                                            <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-900 flex items-center justify-center font-black text-xs">2</span>
                                                        ) : op.rank === 3 ? (
                                                            <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs">3</span>
                                                        ) : (
                                                            <span className="text-text-secondary font-bold pl-2">#{op.rank}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <UserAvatar avatarUrl={op.agentAvatar} name={op.agentName} role={Role.Agent} size="sm" />
                                                            <div>
                                                                <span className="font-bold text-text-primary block">{op.agentName}</span>
                                                                <span className="text-[10px] text-text-secondary font-mono block">{op.agentEmail}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {op.assignedClientIds.length === 0 ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                                                🌐 Toutes les Boutiques
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-base-300 text-text-primary">
                                                                    {op.assignedClientIds.length} boutique(s)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-bold text-text-primary">
                                                        {op.totalProcessedOrders}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-black text-emerald-600">
                                                        {op.confirmedCount}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                                            op.confirmedRate >= 75 
                                                                ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' 
                                                                : op.confirmedRate >= 60 
                                                                ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                                                                : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                                        }`}>
                                                            {op.confirmedRate}%
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-red-500 font-bold">
                                                        {op.cancelledCount} <span className="text-[10px] text-text-secondary">({op.cancelledRate}%)</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-amber-500 font-bold">
                                                        {op.unreachableCount} <span className="text-[10px] text-text-secondary">({op.unreachableRate}%)</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-text-primary">
                                                        {op.totalConfirmedRevenue.toLocaleString()} MAD
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    if (matchedUser) handleStartEditingAssignments(matchedUser);
                                                                    setActiveTab('operators');
                                                                }}
                                                                className="p-1.5 rounded-lg bg-base-300 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                                                                title="Ajuster affectation des boutiques"
                                                            >
                                                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => onNavigateToMessages ? onNavigateToMessages(undefined, op.agentId) : null}
                                                                className="p-1.5 rounded-lg bg-base-300 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                                                                title="Envoyer un message interne à l'opérateur"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    {operatorPerformanceList.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="py-8 text-center text-text-secondary">
                                                Aucun opérateur Call Center enregistré.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Gestion des Opérateurs & Affectations */}
            {activeTab === 'operators' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-base-200 p-4 rounded-2xl border border-base-300">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-text-primary flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Répertoire des Téléconseillers &amp; Dispatching des Boutiques
                            </h3>
                            <p className="text-xs text-text-secondary font-medium">
                                Configurez quelles boutiques chaque opérateur est habilité à traiter et confirmer.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {onOpenAddUserModal && (
                                <button
                                    onClick={onOpenAddUserModal}
                                    className="bg-primary hover:bg-primary/90 text-white font-syne font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Ajouter un Opérateur</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Operators Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {operators.map(agent => {
                            const isEditing = editingAgentId === agent.id;
                            const currentAssigned = Array.isArray(agent.assignedClientIds) ? agent.assignedClientIds : [];
                            const isAllStores = currentAssigned.length === 0 || currentAssigned.includes('all') || currentAssigned.includes('*');

                            return (
                                <div 
                                    key={agent.id}
                                    className="bg-base-200 border border-base-300 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all"
                                >
                                    <div>
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar 
                                                    avatarUrl={agent.avatarUrl} 
                                                    name={agent.name} 
                                                    role={Role.Agent} 
                                                    size="md" 
                                                />
                                                <div>
                                                    <h4 className="font-black text-sm text-text-primary">{agent.name}</h4>
                                                    <span className="text-[11px] text-text-secondary font-mono block">{agent.email}</span>
                                                    {agent.phone && (
                                                        <span className="text-[10px] text-primary font-bold flex items-center gap-1 mt-0.5">
                                                            <PhoneCall className="w-3 h-3" />
                                                            {agent.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {onOpenEditUserModal && (
                                                    <button
                                                        onClick={() => onOpenEditUserModal(agent)}
                                                        className="p-1.5 rounded-lg bg-base-100 hover:bg-base-300 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                                        title="Modifier le compte"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Assigned Stores Badge & Edit Panel */}
                                        <div className="mt-4 pt-3 border-t border-base-300">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-text-secondary uppercase">
                                                    Boutiques Assignées :
                                                </span>
                                                {!isEditing ? (
                                                    <button
                                                        onClick={() => handleStartEditingAssignments(agent)}
                                                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                                                    >
                                                        <SlidersHorizontal className="w-3 h-3" />
                                                        Modifier
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingAgentId(null)}
                                                        className="text-[11px] font-bold text-text-secondary hover:underline cursor-pointer"
                                                    >
                                                        Annuler
                                                    </button>
                                                )}
                                            </div>

                                            {!isEditing ? (
                                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                                    {isAllStores ? (
                                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                                                            <StoreIcon className="w-3 h-3" />
                                                            Accès Global (Toutes les {stores.length} boutiques)
                                                        </span>
                                                    ) : (
                                                        stores
                                                            .filter(s => currentAssigned.includes(s.id) || currentAssigned.includes(s.email) || currentAssigned.includes(s.name))
                                                            .map(s => (
                                                                <span key={s.id} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-base-100 border border-base-300 text-text-primary">
                                                                    🛍️ {s.name || s.email}
                                                                </span>
                                                            ))
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-2 bg-base-100 p-3 rounded-xl border border-base-300 animate-in fade-in duration-150">
                                                    <div className="flex items-center justify-between text-[11px] font-bold pb-1 border-b border-base-300">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setTempAssignedStores(stores.map(s => s.id))}
                                                            className="text-primary hover:underline cursor-pointer"
                                                        >
                                                            Tout cocher
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setTempAssignedStores([])}
                                                            className="text-text-secondary hover:underline cursor-pointer"
                                                        >
                                                            Tout décocher
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                        {stores.map(st => {
                                                            const isChecked = tempAssignedStores.includes(st.id);
                                                            return (
                                                                <label 
                                                                    key={st.id}
                                                                    className="flex items-center gap-2 text-xs font-semibold text-text-primary p-1 rounded hover:bg-base-200 cursor-pointer"
                                                                >
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => handleToggleStoreInAssignment(st.id)}
                                                                        className="rounded border-base-300 text-primary focus:ring-primary accent-primary"
                                                                    />
                                                                    <span className="truncate">{st.name || st.email}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        disabled={isSavingAssignments}
                                                        onClick={() => handleSaveAssignments(agent.id)}
                                                        className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {isSavingAssignments ? 'Enregistrement...' : 'Valider Affectation'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom action */}
                                    <div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between text-xs">
                                        <button
                                            onClick={() => onNavigateToCallCenter ? onNavigateToCallCenter(agent.assignedClientIds?.[0]) : null}
                                            className="text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                            <Headphones className="w-3.5 h-3.5" />
                                            Superviser son flux
                                        </button>
                                        <button
                                            onClick={() => onNavigateToMessages ? onNavigateToMessages(undefined, agent.id) : null}
                                            className="text-text-secondary hover:text-text-primary font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            Message
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB: Boutiques Partenaires */}
            {activeTab === 'stores' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    {/* Header Controls for Stores */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200 p-4 rounded-2xl border border-base-300">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight text-text-primary">
                                    Boutiques &amp; Clients Partenaires ({stores.length})
                                </h3>
                                <p className="text-xs text-text-secondary">
                                    Supervision globale des boutiques, flux Google Sheets et affectations des téléopérateurs.
                                </p>
                            </div>
                        </div>

                        {/* Search & Actions */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="text"
                                    placeholder="Rechercher une boutique..."
                                    value={storeSearchQuery}
                                    onChange={(e) => setStoreSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-base-100 border border-base-300 rounded-xl text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-primary"
                                />
                            </div>

                            {onOpenAddUserModal && (
                                <button
                                    onClick={onOpenAddUserModal}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Ajouter Boutique</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sync Global Notification */}
                    {syncMessage && (
                        <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${syncMessage.success ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'} animate-in fade-in`}>
                            <span>{syncMessage.text}</span>
                            <button onClick={() => setSyncMessage(null)} className="text-text-secondary hover:text-text-primary">✕</button>
                        </div>
                    )}

                    {/* Stores Grid */}
                    {stores.length === 0 ? (
                        <div className="p-12 text-center bg-base-200 rounded-2xl border border-base-300">
                            <Building2 className="w-12 h-12 mx-auto text-text-secondary/40 mb-3" />
                            <h4 className="text-base font-bold text-text-primary">Aucune boutique connectée</h4>
                            <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
                                Les comptes boutiques créés ou synchronisés apparaîtront ici avec leurs statistiques détaillées.
                            </p>
                            {onOpenAddUserModal && (
                                <button
                                    onClick={onOpenAddUserModal}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90"
                                >
                                    <Plus className="w-4 h-4" />
                                    Créer un profil boutique
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {storeStatsList
                                .filter(s => {
                                    if (!storeSearchQuery) return true;
                                    const q = storeSearchQuery.toLowerCase();
                                    return (
                                        (s.store.name && s.store.name.toLowerCase().includes(q)) ||
                                        (s.store.email && s.store.email.toLowerCase().includes(q)) ||
                                        (s.store.phone && s.store.phone.toLowerCase().includes(q))
                                    );
                                })
                                .map((item) => {
                                    const { store, totalOrders, pending, confirmed, cancelled, confirmRate, totalRevenue, assignedOperators } = item;
                                    const isSyncing = syncingStoreId === store.id;

                                    return (
                                        <div
                                            key={store.id}
                                            className="bg-base-200 border border-base-300 hover:border-primary/40 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md"
                                        >
                                            <div>
                                                {/* Store Header */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {store.logoData ? (
                                                            <img 
                                                                src={store.logoData} 
                                                                alt={store.name} 
                                                                className="w-12 h-12 rounded-xl object-contain bg-base-100 border border-base-300 p-1 shrink-0" 
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-base shrink-0">
                                                                {store.name ? store.name.charAt(0).toUpperCase() : 'B'}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-sm text-text-primary truncate">
                                                                {store.name || 'Boutique Sans Nom'}
                                                            </h4>
                                                            <p className="text-[11px] text-text-secondary truncate">
                                                                {store.email}
                                                            </p>
                                                            {store.phone && (
                                                                <p className="text-[10px] text-text-secondary/80 flex items-center gap-1 mt-0.5">
                                                                    <Phone className="w-2.5 h-2.5" />
                                                                    {store.phone}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                                        Boutique
                                                    </span>
                                                </div>

                                                {/* Google Sheet Sync Status */}
                                                <div className="mt-4 p-2.5 rounded-xl bg-base-100 border border-base-300 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase text-text-secondary flex items-center gap-1">
                                                            <Database className="w-3 h-3 text-primary" />
                                                            Google Sheet
                                                        </span>
                                                        {store.googleSheetUrl ? (
                                                            <button
                                                                onClick={() => handleSyncStore(store.id)}
                                                                disabled={isSyncing}
                                                                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                title="Synchroniser les commandes"
                                                            >
                                                                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                                                {isSyncing ? 'Sync...' : 'Synchroniser'}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-amber-500 font-semibold">Non configuré</span>
                                                        )}
                                                    </div>
                                                    {store.googleSheetUrl && (
                                                        <div className="mt-1 text-[10px] text-text-secondary truncate flex items-center gap-1">
                                                            <span>Feuille: {store.selectedSheet || 'Par défaut'}</span>
                                                            {store.autoSync && <span className="text-emerald-500 font-bold">● Auto-sync</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Assigned Teleoperators */}
                                                <div className="mt-3">
                                                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
                                                        Opérateurs d'appels assignés ({assignedOperators.length})
                                                    </span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {assignedOperators.length === 0 ? (
                                                            <span className="text-[10px] text-amber-500 font-medium">Aucun opérateur assigné</span>
                                                        ) : (
                                                            assignedOperators.slice(0, 3).map(op => (
                                                                <span key={op.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-base-100 border border-base-300 text-text-primary">
                                                                    <Headphones className="w-2.5 h-2.5 text-primary" />
                                                                    {op.name || op.email.split('@')[0]}
                                                                </span>
                                                            ))
                                                        )}
                                                        {assignedOperators.length > 3 && (
                                                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-base-100 text-text-secondary">
                                                                +{assignedOperators.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Store Metrics Summary */}
                                                <div className="grid grid-cols-4 gap-1.5 mt-4 p-2.5 bg-base-100 rounded-xl border border-base-300 text-center">
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase text-text-secondary block">Total</span>
                                                        <span className="text-xs font-black text-text-primary">{totalOrders}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase text-amber-500 block">Attente</span>
                                                        <span className="text-xs font-black text-amber-500">{pending}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase text-emerald-500 block">Confirmé</span>
                                                        <span className="text-xs font-black text-emerald-500">{confirmed}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase text-primary block">Taux</span>
                                                        <span className="text-xs font-black text-primary">{confirmRate}%</span>
                                                    </div>
                                                </div>

                                                {/* Revenue */}
                                                <div className="mt-2.5 flex items-center justify-between text-xs px-1">
                                                    <span className="text-[11px] text-text-secondary font-medium">CA Confirmé:</span>
                                                    <span className="font-mono font-bold text-text-primary">{totalRevenue.toLocaleString()} MAD</span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between gap-2">
                                                <button
                                                    onClick={() => onNavigateToCallCenter ? onNavigateToCallCenter(store.id) : null}
                                                    className="flex-1 py-1.5 px-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                                >
                                                    <Headphones className="w-3 h-3" />
                                                    <span>Call Center</span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        if (onSelectStore) onSelectStore(store.id);
                                                        setSelectedStoreFilter(store.id);
                                                        setActiveTab('confirmation');
                                                    }}
                                                    className="py-1.5 px-2.5 bg-base-100 hover:bg-base-300 text-text-primary border border-base-300 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                                                    title="Confirmer les commandes de cette boutique"
                                                >
                                                    <CheckSquare className="w-3 h-3 text-emerald-500" />
                                                    <span>Traiter</span>
                                                </button>

                                                {onNavigateToMessages && (
                                                    <button
                                                        onClick={() => onNavigateToMessages(store.id)}
                                                        className="p-1.5 bg-base-100 hover:bg-base-300 text-text-secondary hover:text-text-primary border border-base-300 rounded-lg transition-all cursor-pointer"
                                                        title="Envoyer un message"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                {onOpenEditUserModal && (
                                                    <button
                                                        onClick={() => onOpenEditUserModal(store)}
                                                        className="p-1.5 bg-base-100 hover:bg-base-300 text-text-secondary hover:text-text-primary border border-base-300 rounded-lg transition-all cursor-pointer"
                                                        title="Paramètres de la boutique"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: Confirmation Rapide Multi-Boutiques */}
            {activeTab === 'confirmation' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="bg-base-200 border border-base-300 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight text-text-primary flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                                Console de Confirmation Multi-Boutiques (Privilège Manager)
                            </h3>
                            <p className="text-xs text-text-secondary font-medium">
                                En tant que Manager, vous pouvez confirmer ou mettre à jour les commandes de n'importe quelle boutique.
                            </p>
                        </div>

                        {/* Status Filter Chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                onClick={() => setConfirmationStatusFilter(OrderStatus.EnAttend)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${confirmationStatusFilter === OrderStatus.EnAttend ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-base-100 text-text-secondary hover:text-text-primary'}`}
                            >
                                En Attente ({teamKPIs.pending})
                            </button>
                            <button
                                onClick={() => setConfirmationStatusFilter('unreachable')}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${confirmationStatusFilter === 'unreachable' ? 'bg-purple-600 text-white shadow-sm' : 'bg-base-100 text-text-secondary hover:text-text-primary'}`}
                            >
                                Injoignables / Pas de rép ({teamKPIs.unreachable})
                            </button>
                            <button
                                onClick={() => setConfirmationStatusFilter(OrderStatus.Confirme)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${confirmationStatusFilter === OrderStatus.Confirme ? 'bg-emerald-600 text-white shadow-sm' : 'bg-base-100 text-text-secondary hover:text-text-primary'}`}
                            >
                                Confirmées ({teamKPIs.confirmed})
                            </button>
                            <button
                                onClick={() => setConfirmationStatusFilter('all')}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${confirmationStatusFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-base-100 text-text-secondary hover:text-text-primary'}`}
                            >
                                Toutes
                            </button>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-base-200 border border-base-300 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-3 border-b border-base-300 flex items-center justify-between">
                            <div className="relative w-full sm:w-80">
                                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={confirmationSearch}
                                    onChange={(e) => setConfirmationSearch(e.target.value)}
                                    placeholder="Recherche client, téléphone, produit..."
                                    className="w-full bg-base-100 border border-base-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <span className="text-xs font-bold text-text-secondary">
                                {confirmationOrdersList.length} commande(s) affichée(s)
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-max text-left text-xs">
                                <thead className="bg-base-300/60 uppercase text-[11px] font-black text-text-secondary border-b border-base-300">
                                    <tr>
                                        <th className="py-3 px-4">Réf &amp; Date</th>
                                        <th className="py-3 px-4">Boutique</th>
                                        <th className="py-3 px-4">Client &amp; Téléphone</th>
                                        <th className="py-3 px-4">Produit &amp; Montant</th>
                                        <th className="py-3 px-4">Ville &amp; Adresse</th>
                                        <th className="py-3 px-4 text-center">Statut Actuel</th>
                                        <th className="py-3 px-4 text-center">Confirmation Directe</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base-300/40">
                                    {confirmationOrdersList.slice(0, 50).map(order => {
                                        const matchedStore = stores.find(s => s.id === order.clientId);
                                        const cleanPhone = String(order.phone || '').replace(/[^0-9]/g, '');

                                        return (
                                            <tr key={order.id} className="hover:bg-base-100/60 transition-colors">
                                                <td className="py-3 px-4 font-mono">
                                                    <span className="font-bold text-text-primary block">{order.id}</span>
                                                    <span className="text-[10px] text-text-secondary block">
                                                        {order.date ? new Date(order.date).toLocaleDateString('fr-FR') : '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-base-300 text-text-primary">
                                                        🛍️ {matchedStore?.name || order.clientId || 'Boutique'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-bold text-text-primary block">{order.customerName}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="font-mono text-[11px] text-text-secondary">{order.phone || 'Non renseigné'}</span>
                                                        {cleanPhone && (
                                                            <a
                                                                href={`https://wa.me/${cleanPhone.startsWith('0') ? '212' + cleanPhone.slice(1) : cleanPhone}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-emerald-500 hover:text-emerald-600"
                                                                title="Ouvrir WhatsApp"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-bold text-text-primary block truncate max-w-[150px]">{order.product}</span>
                                                    <span className="text-xs font-black text-primary block">{order.price || 0} MAD</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-bold text-text-primary block">{order.city || '-'}</span>
                                                    <span className="text-[10px] text-text-secondary block truncate max-w-[180px]">{order.address || '-'}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                        {order.status || OrderStatus.EnAttend}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => onUpdateOrderStatus(order.id, OrderStatus.Confirme, 'Confirmation Manager')}
                                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                                            title="Confirmer la commande"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span>Confirmer</span>
                                                        </button>

                                                        <button
                                                            onClick={() => onUpdateOrderStatus(order.id, 'pas_de_reponse_1' as any, 'Pas de réponse client')}
                                                            className="px-2 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 font-bold text-[11px] transition-all cursor-pointer"
                                                            title="Pas de réponse (1er appel)"
                                                        >
                                                            Pas de rép
                                                        </button>

                                                        <button
                                                            onClick={() => onUpdateOrderStatus(order.id, OrderStatus.Annule, 'Annulation Manager')}
                                                            className="px-2 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-600 font-bold text-[11px] transition-all cursor-pointer"
                                                            title="Annuler la commande"
                                                        >
                                                            Annuler
                                                        </button>

                                                        {onSelectOrder && (
                                                            <button
                                                                onClick={() => onSelectOrder(order)}
                                                                className="p-1.5 rounded-lg bg-base-300 hover:bg-base-100 text-text-secondary cursor-pointer"
                                                                title="Ouvrir détails de la commande"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {confirmationOrdersList.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-text-secondary">
                                                Aucune commande trouvée pour ce filtre.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: Assistant & Coach IA Superviseur */}
            {activeTab === 'ai-coach' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <button
                            onClick={() => handleRunAiCoach('team-audit')}
                            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                aiActionType === 'team-audit'
                                    ? 'bg-purple-600/15 border-purple-500 shadow-md'
                                    : 'bg-base-200 border-base-300 hover:border-purple-500/40'
                            }`}
                        >
                            <div>
                                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center mb-2">
                                    <BarChart3 className="w-4 h-4" />
                                </div>
                                <h4 className="font-bold text-sm text-text-primary">Audit IA d'Équipe</h4>
                                <p className="text-[11px] text-text-secondary mt-1">
                                    Diagnostic complet des performances, forces et faiblesses des opérateurs.
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-purple-600 mt-3 flex items-center gap-1">
                                Lancer Diagnostic &rarr;
                            </span>
                        </button>

                        <button
                            onClick={() => handleRunAiCoach('pitch-generator')}
                            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                aiActionType === 'pitch-generator'
                                    ? 'bg-purple-600/15 border-purple-500 shadow-md'
                                    : 'bg-base-200 border-base-300 hover:border-purple-500/40'
                            }`}
                        >
                            <div>
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-2">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <h4 className="font-bold text-sm text-text-primary">Pitchs &amp; Objections (Darija)</h4>
                                <p className="text-[11px] text-text-secondary mt-1">
                                    Scripts d'appels percutants en Darija marocaine &amp; Français pour contrer les refus.
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-amber-500 mt-3 flex items-center gap-1">
                                Générer Scripts &rarr;
                            </span>
                        </button>

                        <button
                            onClick={() => handleRunAiCoach('workload-balance')}
                            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                aiActionType === 'workload-balance'
                                    ? 'bg-purple-600/15 border-purple-500 shadow-md'
                                    : 'bg-base-200 border-base-300 hover:border-purple-500/40'
                            }`}
                        >
                            <div>
                                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center mb-2">
                                    <Users className="w-4 h-4" />
                                </div>
                                <h4 className="font-bold text-sm text-text-primary">Équilibrage IA des Charges</h4>
                                <p className="text-[11px] text-text-secondary mt-1">
                                    Algorithme d'optimisation de l'affectation des boutiques selon la charge.
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-blue-500 mt-3 flex items-center gap-1">
                                Optimiser Affectations &rarr;
                            </span>
                        </button>

                        <button
                            onClick={() => handleRunAiCoach('daily-briefing')}
                            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                aiActionType === 'daily-briefing'
                                    ? 'bg-purple-600/15 border-purple-500 shadow-md'
                                    : 'bg-base-200 border-base-300 hover:border-purple-500/40'
                            }`}
                        >
                            <div>
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-2">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <h4 className="font-bold text-sm text-text-primary">Briefing Quotidien</h4>
                                <p className="text-[11px] text-text-secondary mt-1">
                                    Note de motivation et objectifs du jour prête à envoyer sur le groupe téléconseillers.
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-500 mt-3 flex items-center gap-1">
                                Rédiger Briefing &rarr;
                            </span>
                        </button>
                    </div>

                    {/* Inputs for Pitch Generator */}
                    {aiActionType === 'pitch-generator' && (
                        <div className="bg-base-200 border border-base-300 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
                                    Produit ou Thème de l'Appel
                                </label>
                                <input
                                    type="text"
                                    value={aiPitchProduct}
                                    onChange={(e) => setAiPitchProduct(e.target.value)}
                                    placeholder="ex: Montre Connectée Ultra ou Pack Cosmétique"
                                    className="w-full bg-base-100 border border-base-300 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
                                    Objection Client Fréquente à Contrer
                                </label>
                                <input
                                    type="text"
                                    value={aiPitchObjection}
                                    onChange={(e) => setAiPitchObjection(e.target.value)}
                                    placeholder="ex: Je veux voir avant de payer / C'est trop cher / Pas dispo"
                                    className="w-full bg-base-100 border border-base-300 rounded-xl px-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <button
                                    onClick={() => handleRunAiCoach('pitch-generator')}
                                    disabled={isAiLoading}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-syne font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <span>Générer Scripts Darija &amp; Français</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* AI Coach Output Display */}
                    <div className="bg-gradient-to-br from-[#1C2434] to-[#24303F] border border-[#2E3A47] rounded-2xl p-6 text-white shadow-2xl relative min-h-[220px]">
                        <div className="flex items-center justify-between pb-4 border-b border-[#2E3A47]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-base text-white">
                                        Rapport IA Superviseur : {aiActionType === 'team-audit' ? "Audit d'Équipe" : aiActionType === 'pitch-generator' ? "Scripts d'Appels & Darija" : aiActionType === 'workload-balance' ? "Optimisation des Charges" : "Briefing du Jour"}
                                    </h3>
                                    <span className="text-[11px] text-[#8A99AF]">Modèle Gemini 3.7 Flash spécialisé Call Center COD</span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleRunAiCoach(aiActionType)}
                                disabled={isAiLoading}
                                className="px-3 py-1.5 rounded-lg bg-[#2E3A47] hover:bg-[#3C50E0] text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                                <span>Régénérer</span>
                            </button>
                        </div>

                        {isAiLoading ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                                <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                <p className="text-xs font-mono text-[#8A99AF]">
                                    Analyse approfondie des métriques d'appels en cours...
                                </p>
                            </div>
                        ) : aiResult ? (
                            <div className="pt-5 space-y-4 animate-in fade-in duration-200">
                                {aiResult.summary && (
                                    <div className="bg-[#1A222C] p-4 rounded-xl border border-[#2E3A47]">
                                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                                            Synthèse Superviseur
                                        </h4>
                                        <p className="text-xs text-white/90 leading-relaxed font-sans">{aiResult.summary}</p>
                                    </div>
                                )}

                                {aiResult.strengths && Array.isArray(aiResult.strengths) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Points Forts de l'Équipe
                                            </h4>
                                            <ul className="space-y-1 text-xs text-white/80 list-disc list-inside">
                                                {aiResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>

                                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <XCircle className="w-3.5 h-3.5" />
                                                Axes d'Amélioration Prioritaires
                                            </h4>
                                            <ul className="space-y-1 text-xs text-white/80 list-disc list-inside">
                                                {aiResult.weaknesses?.map((w: string, i: number) => <li key={i}>{w}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {aiResult.actionPlan && Array.isArray(aiResult.actionPlan) && (
                                    <div className="bg-purple-600/10 border border-purple-500/20 p-4 rounded-xl">
                                        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5" />
                                            Plan d'Action Immédiat
                                        </h4>
                                        <div className="space-y-1.5">
                                            {aiResult.actionPlan.map((act: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-white/90">
                                                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    <span>{act}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pitch Specific Layout */}
                                {aiResult.hookDarija && (
                                    <div className="space-y-3">
                                        <div className="bg-[#1A222C] p-4 rounded-xl border border-amber-500/30">
                                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                🇲🇦 Accroche Téléphonique en Darija
                                            </h4>
                                            <p className="text-sm font-semibold text-white/95 leading-relaxed bg-[#24303F] p-3 rounded-lg mt-1 font-mono">
                                                « {aiResult.hookDarija} »
                                            </p>
                                            <p className="text-xs text-[#8A99AF] mt-2">
                                                🇫🇷 Version Française : {aiResult.hookFrench}
                                            </p>
                                        </div>

                                        <div className="bg-[#1A222C] p-4 rounded-xl border border-emerald-500/30">
                                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                🎯 Réponse à l'Objection (Darija &amp; Assurance)
                                            </h4>
                                            <p className="text-sm font-semibold text-emerald-300 leading-relaxed bg-[#24303F] p-3 rounded-lg mt-1 font-mono">
                                                « {aiResult.objectionResponseDarija} »
                                            </p>
                                            <p className="text-xs text-[#8A99AF] mt-2">
                                                💡 Astuce Upsell Panier Moyen : {aiResult.upsellTip}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Briefing Specific Layout */}
                                {aiResult.morningDebrief && (
                                    <div className="bg-[#1A222C] p-4 rounded-xl border border-[#2E3A47] space-y-3">
                                        <p className="text-sm text-white/95 leading-relaxed italic">
                                            "{aiResult.morningDebrief}"
                                        </p>
                                        {aiResult.keyGoals && (
                                            <div>
                                                <h5 className="text-xs font-bold text-amber-400 uppercase mb-1">Objectifs Clés :</h5>
                                                <ul className="list-disc list-inside text-xs text-white/80 space-y-0.5">
                                                    {aiResult.keyGoals.map((g: string, i: number) => <li key={i}>{g}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {aiResult.dailyTip && (
                                            <div className="p-2.5 rounded-lg bg-[#3C50E0]/15 border border-[#3C50E0]/30 text-xs text-[#3C50E0] font-bold">
                                                💡 Conseil du jour : {aiResult.dailyTip}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-10 text-center space-y-3">
                                <Sparkles className="w-8 h-8 text-purple-400 mx-auto animate-bounce" />
                                <p className="text-xs text-[#8A99AF] max-w-md mx-auto">
                                    Sélectionnez un outil ci-dessus pour lancer l'audit IA ou générer des scripts d'appels Darija pour vos téléconseillers.
                                </p>
                                <button
                                    onClick={() => handleRunAiCoach('team-audit')}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-syne font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Démarrer l'Audit d'Équipe
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerDashboard;
