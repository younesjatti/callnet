import React, { useMemo, useState } from 'react';
import { 
    TrendingUp, 
    ShoppingCart, 
    CheckCircle2, 
    Clock, 
    Truck, 
    AlertCircle, 
    PhoneCall, 
    FileSpreadsheet, 
    ArrowUpRight, 
    ArrowDownRight,
    DollarSign,
    Sparkles,
    ChevronRight,
    PlusCircle,
    Headphones,
    UserCheck,
    Phone,
    Mail,
    MessageCircle,
    MessageSquare,
    Shield,
    Users
} from 'lucide-react';
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Order, OrderStatus, Role, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge, { getStatusConfig } from './StatusBadge';
import { PIE_CHART_COLORS } from '../constants';
import { normalizeRole } from '../utils';
import { isAgentAssignedToStore, resolveUserAvatar } from '../lib/avatarUtils';
import UserAvatar from './UserAvatar';
import OperatorDashboard from './OperatorDashboard';

interface DashboardProps {
    orders: Order[];
    onNavigate?: (view: string, statusFilter?: string) => void;
    onOrderClick?: (order: Order) => void;
    onAddOrderClick?: () => void;
    onUpdateOrderStatus?: (orderId: string, newStatus: OrderStatus, reason?: string, note?: string) => Promise<void>;
    onSync?: () => void;
}

type Period = 'today' | '7d' | '30d' | 'all';

const Dashboard: React.FC<DashboardProps> = ({ 
    orders, 
    onNavigate, 
    onOrderClick, 
    onAddOrderClick,
    onUpdateOrderStatus,
    onSync 
}) => {
    const { t } = useLanguage();
    const { currentUser, users } = useAuth();
    const [selectedClientId, setSelectedClientId] = useState<string>('all');
    const [period, setPeriod] = useState<Period>('all');
    // For Admins/Managers, allow toggling between global store analytics and live operator dashboard
    const [activeDashboardMode, setActiveDashboardMode] = useState<'analytics' | 'operator'>(
        currentUser?.role === Role.Agent ? 'operator' : 'analytics'
    );

    // Determine target client for assigned agents display
    const targetClientOrId = useMemo(() => {
        const normRole = currentUser?.role ? normalizeRole(currentUser.role) : null;
        if (normRole === Role.Client) {
            return currentUser;
        }
        if (normRole === Role.Admin && selectedClientId !== 'all') {
            const found = users.find(u => u.id === selectedClientId || (u.email && u.email.toLowerCase() === selectedClientId.toLowerCase()));
            return found || selectedClientId;
        }
        return null;
    }, [currentUser, selectedClientId, users]);

    // Compute assigned agents for the current client store (or selected store)
    const assignedAgents = useMemo(() => {
        const agentUsers = users.filter(u => normalizeRole(u.role) === Role.Agent);
        if (!targetClientOrId) {
            // Admin viewing all stores -> show all call center agents
            return agentUsers;
        }
        return agentUsers.filter(agent => isAgentAssignedToStore(agent, targetClientOrId, users));
    }, [users, targetClientOrId]);

    // Filter by store for Admin
    const storeFilteredOrders = useMemo(() => {
        if (currentUser?.role === Role.Admin && selectedClientId !== 'all') {
            return orders.filter(o => o.clientId === selectedClientId);
        }
        return orders;
    }, [orders, currentUser, selectedClientId]);

    // Filter by period
    const filteredOrders = useMemo(() => {
        if (period === 'all') return storeFilteredOrders;
        const now = new Date();
        const cutoff = new Date();
        if (period === 'today') {
            cutoff.setHours(0, 0, 0, 0);
        } else if (period === '7d') {
            cutoff.setDate(now.getDate() - 7);
        } else if (period === '30d') {
            cutoff.setDate(now.getDate() - 30);
        }
        return storeFilteredOrders.filter(o => {
            if (!o.date) return false;
            const d = new Date(o.date);
            return !isNaN(d.getTime()) && d >= cutoff;
        });
    }, [storeFilteredOrders, period]);

    // KPI Metrics calculation
    const stats = useMemo(() => {
        const total = filteredOrders.length;
        const confirmed = filteredOrders.filter(o => o.status === OrderStatus.Confirme);
        const shipped = filteredOrders.filter(o => o.status === OrderStatus.Expider);
        const pending = filteredOrders.filter(o => o.status === OrderStatus.EnAttend);
        const canceled = filteredOrders.filter(o => o.status === OrderStatus.Annule || o.status === OrderStatus.NumIncorect || o.status === OrderStatus.FauxNumero);
        const noAnswer = filteredOrders.filter(o => 
            o.status === OrderStatus.PasDeRep1 || o.status === OrderStatus.PasDeRep2 || 
            o.status === OrderStatus.PasDeRep3 || o.status === OrderStatus.PasDeRep4 ||
            o.status === OrderStatus.PasDeRep5 ||
            o.status === OrderStatus.Injoignable1 || o.status === OrderStatus.Injoignable2
        );

        const decided = confirmed.length + shipped.length + canceled.length + noAnswer.length;
        const confirmedTotal = confirmed.length + shipped.length;
        const confirmationRate = total > 0 ? (confirmedTotal / total) * 100 : 0;
        const processedConfirmationRate = decided > 0 ? (confirmedTotal / decided) * 100 : confirmationRate;

        const revenue = [...confirmed, ...shipped].reduce((sum, o) => sum + (Number(o.price) || 0), 0);
        const potentialRevenue = filteredOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);

        return {
            total,
            confirmed: confirmed.length,
            shipped: shipped.length,
            confirmedTotal,
            pending: pending.length,
            canceled: canceled.length,
            noAnswer: noAnswer.length,
            confirmationRate,
            processedConfirmationRate,
            revenue,
            potentialRevenue
        };
    }, [filteredOrders]);

    // Chart: Daily timeline data (last 7 days or aggregated)
    const timelineData = useMemo(() => {
        const map: Record<string, { date: string; total: number; confirmed: number; revenue: number }> = {};
        
        filteredOrders.forEach(o => {
            const dateKey = o.date ? (o.date.includes('T') ? o.date.split('T')[0] : o.date.slice(0, 10)) : 'Inconnu';
            if (!map[dateKey]) {
                map[dateKey] = { date: dateKey, total: 0, confirmed: 0, revenue: 0 };
            }
            map[dateKey].total += 1;
            if (o.status === OrderStatus.Confirme || o.status === OrderStatus.Expider) {
                map[dateKey].confirmed += 1;
                map[dateKey].revenue += Number(o.price) || 0;
            }
        });

        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    }, [filteredOrders]);

    // Status breakdown for Pie Chart
    const statusPieData = useMemo(() => {
        const counts: Record<string, { name: string; value: number; originalStatus: OrderStatus }> = {};
        filteredOrders.forEach(o => {
            const st = o.status || OrderStatus.EnAttend;
            if (!counts[st]) {
                counts[st] = { name: t(st) || st, value: 0, originalStatus: st };
            }
            counts[st].value += 1;
        });
        return Object.values(counts).filter(c => c.value > 0);
    }, [filteredOrders, t]);

    const recentOrders = useMemo(() => {
        return [...filteredOrders].slice(0, 7);
    }, [filteredOrders]);

    // If logged in user is an Operator/Agent, render OperatorDashboard directly
    if (currentUser?.role === Role.Agent || activeDashboardMode === 'operator') {
        return (
            <div className="space-y-4">
                {/* Admin/Manager Mode Switcher Banner */}
                {currentUser?.role !== Role.Agent && (
                    <div className="flex items-center justify-between bg-base-200 border border-base-300 px-4 py-2.5 rounded-xl font-montserrat text-xs">
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Headphones className="w-4 h-4 text-[#3C50E0]" />
                            <span>Vous visualisez actuellement le <strong>Dashboard Opérateur</strong> (Mode Call Center direct).</span>
                        </div>
                        <button
                            onClick={() => setActiveDashboardMode('analytics')}
                            className="px-3 py-1.5 bg-base-100 hover:bg-base-300 border border-base-300 text-text-primary rounded-lg font-bold transition-all cursor-pointer shadow-xs"
                        >
                            ← Revenir à la Vue Analytique Globale
                        </button>
                    </div>
                )}
                <OperatorDashboard 
                    orders={orders}
                    onNavigate={onNavigate}
                    onOrderClick={onOrderClick}
                    onUpdateOrderStatus={onUpdateOrderStatus}
                    onSync={onSync}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-16">
            {/* Top Toolbar: Store Filter + Time Period Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Vue d'ensemble analytique</span>
                    <p className="text-[13px] text-text-secondary mt-0.5">
                        Node Access: <strong className="text-text-primary">{currentUser?.name}</strong>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {currentUser?.role === Role.Admin && (
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="px-3 py-1.5 bg-base-200 border border-base-300 rounded-[4px] text-xs font-semibold text-text-primary focus:border-[#3C50E0] outline-none"
                            >
                                <option value="all">Toutes les boutiques ({orders.length})</option>
                                {users.filter(u => u.role === Role.Client).map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Switch to Operator Dashboard view */}
                    <button
                        onClick={() => setActiveDashboardMode('operator')}
                        className="px-3 py-1.5 bg-[#3C50E0]/10 hover:bg-[#3C50E0] text-[#3C50E0] hover:text-white border border-[#3C50E0]/30 rounded-[4px] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Ouvrir la vue opérateur call center (action immédiate, quota 30 conf., commissions)"
                    >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>Vue Opérateur (Action & Quota)</span>
                    </button>

                    {/* Period Pills */}
                    <div className="flex items-center bg-[#F7F9FC] dark:bg-[#1C2434] p-1 rounded-[4px] border border-base-300">
                        {[
                            { id: 'today', label: "Aujourd'hui" },
                            { id: '7d', label: '7 jours' },
                            { id: '30d', label: '30 jours' },
                            { id: 'all', label: 'Global' },
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id as Period)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
                                    period === p.id 
                                        ? 'bg-base-200 text-text-primary shadow-sm font-bold' 
                                        : 'text-text-secondary hover:text-text-primary'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Net Revenue */}
                <div className="bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="w-11 h-11 bg-[#EFF2F7] dark:bg-[#333A48] rounded-full flex items-center justify-center text-[#3C50E0] mb-4">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-bold text-[#3C50E0] mb-1 font-mono">
                            {stats.revenue.toLocaleString('fr-FR')} MAD
                        </div>
                        <div className="text-[13px] text-text-secondary font-medium">
                            Total Revenue COD
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between text-xs text-text-secondary">
                        <span>{stats.confirmed + stats.shipped} livrables</span>
                        <span className="text-[#10B981] font-semibold">● Actif</span>
                    </div>
                </div>

                {/* Confirmation Rate */}
                <div className="bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="w-11 h-11 bg-[#EFF2F7] dark:bg-[#333A48] rounded-full flex items-center justify-center text-[#3C50E0] mb-4">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-bold text-text-primary mb-1 font-mono">
                            {stats.confirmationRate.toFixed(1)}%
                        </div>
                        <div className="text-[13px] text-text-secondary font-medium">
                            Confirmation Rate
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between text-xs text-text-secondary">
                        <span className="text-[#10B981] font-semibold">{stats.confirmedTotal} validées ({stats.confirmed} conf. + {stats.shipped} exp.)</span>
                        <span>{stats.canceled} annulées</span>
                    </div>
                </div>

                {/* Pending Call Center */}
                <div className="bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="w-11 h-11 bg-[#EFF2F7] dark:bg-[#333A48] rounded-full flex items-center justify-center text-[#FFBA45] mb-4">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-bold text-[#FFBA45] mb-1 font-mono">
                            {stats.pending}
                        </div>
                        <div className="text-[13px] text-text-secondary font-medium">
                            Pending Confirmation
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between text-xs text-text-secondary">
                        <span>{stats.noAnswer} sans réponse</span>
                        {onNavigate && (
                            <button 
                                onClick={() => onNavigate(currentUser?.role === Role.Agent ? 'callcenter' : 'orders')}
                                className="text-[#3C50E0] font-semibold hover:underline flex items-center gap-1 text-xs"
                            >
                                Traiter →
                            </button>
                        )}
                    </div>
                </div>

                {/* Shipped & Delivered */}
                <div className="bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="w-11 h-11 bg-[#EFF2F7] dark:bg-[#333A48] rounded-full flex items-center justify-center text-[#3C50E0] mb-4">
                            <Truck className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-bold text-text-primary mb-1 font-mono">
                            {stats.shipped}
                        </div>
                        <div className="text-[13px] text-text-secondary font-medium">
                            Shipped Units
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-base-300 flex items-center justify-between text-xs text-text-secondary">
                        <span>Total: {stats.total} cmd</span>
                        {onNavigate && (
                            <button 
                                onClick={() => onNavigate('livraison')}
                                className="text-[#3C50E0] font-semibold hover:underline flex items-center gap-1 text-xs"
                            >
                                Export →
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Action Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {onAddOrderClick && (
                    <button
                        onClick={onAddOrderClick}
                        className="flex items-center justify-center gap-2 p-3 bg-[#3C50E0] hover:bg-[#3243be] text-white rounded-[4px] font-semibold text-xs transition-all shadow-sm cursor-pointer"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Nouvelle Commande</span>
                    </button>
                )}

                {onNavigate && (
                    <button
                        onClick={() => onNavigate('messages')}
                        className="flex items-center justify-center gap-2 p-3 bg-[#3C50E0]/10 hover:bg-[#3C50E0]/20 border border-[#3C50E0]/30 text-[#3C50E0] rounded-[4px] font-semibold text-xs transition-all shadow-sm cursor-pointer"
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span>Messagerie Interne</span>
                    </button>
                )}

                {onNavigate && (
                    <button
                        onClick={() => onNavigate(currentUser?.role === Role.Agent ? 'callcenter' : 'orders')}
                        className="flex items-center justify-center gap-2 p-3 bg-base-200 hover:bg-base-300 border border-base-300 text-text-primary rounded-[4px] font-semibold text-xs transition-all shadow-sm cursor-pointer"
                    >
                        <PhoneCall className="w-4 h-4 text-[#FFBA45]" />
                        <span>Centre d'Appels</span>
                    </button>
                )}

                {onNavigate && (
                    <button
                        onClick={() => onNavigate('livraison')}
                        className="flex items-center justify-center gap-2 p-3 bg-base-200 hover:bg-base-300 border border-base-300 text-text-primary rounded-[4px] font-semibold text-xs transition-all shadow-sm cursor-pointer"
                    >
                        <Truck className="w-4 h-4 text-[#3C50E0]" />
                        <span>Bons & Export</span>
                    </button>
                )}

                {onSync && (
                    <button
                        onClick={onSync}
                        className="flex items-center justify-center gap-2 p-3 bg-base-200 hover:bg-base-300 border border-base-300 text-text-primary rounded-[4px] font-semibold text-xs transition-all shadow-sm cursor-pointer"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                        <span>Sync Google Sheets</span>
                    </button>
                )}
            </div>

            {/* Assigned Agents Section for Seller / Store View */}
            {(currentUser?.role === Role.Client || currentUser?.role === Role.Admin) && (
                <div className="bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-300 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#3C50E0]/10 text-[#3C50E0] flex items-center justify-center shrink-0">
                                <Headphones className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                                    <span>
                                        {currentUser?.role === Role.Client 
                                            ? "Vos Agents de Confirmation Dédiés" 
                                            : selectedClientId !== 'all'
                                                ? `Agents Assignés à : ${users.find(u => u.id === selectedClientId)?.name || 'Boutique'}`
                                                : "Équipe Téléopérateurs Call Center"}
                                    </span>
                                </h2>
                                <p className="text-xs text-text-secondary">
                                    {currentUser?.role === Role.Client
                                        ? "Agents CallNet en charge des appels, de la qualification et de la confirmation des commandes de votre boutique."
                                        : "Agents affectés au traitement opérationnel des commandes."}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold font-mono">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {assignedAgents.length} {assignedAgents.length > 1 ? 'Agents Actifs' : 'Agent Actif'}
                            </span>
                            {currentUser?.role === Role.Admin && onNavigate && (
                                <button
                                    onClick={() => onNavigate('users')}
                                    className="px-3 py-1 bg-base-100 hover:bg-base-300 border border-base-300 text-xs font-bold text-text-primary rounded-[4px] transition-all cursor-pointer"
                                >
                                    Gérer les Affectations →
                                </button>
                            )}
                        </div>
                    </div>

                    {assignedAgents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                            {assignedAgents.map((agent) => (
                                <div 
                                    key={agent.id}
                                    className="bg-base-100/70 border border-base-300 p-4 rounded-xl shadow-xs hover:border-[#3C50E0]/50 transition-all flex flex-col justify-between gap-3 group"
                                >
                                    <div className="flex items-start gap-3.5">
                                        {/* Avatar with headset badge and live status dot */}
                                        <UserAvatar 
                                            user={agent} 
                                            role={Role.Agent} 
                                            name={agent.name} 
                                            size="lg" 
                                            showRoleBadge={true} 
                                            showStatusDot={true} 
                                            className="shrink-0"
                                        />

                                        {/* Agent Details */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-text-primary truncate">
                                                    {agent.name}
                                                </h3>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3C50E0] bg-[#3C50E0]/10 px-2 py-0.5 rounded-md mt-0.5">
                                                <Headphones className="w-3 h-3 shrink-0" />
                                                <span>Téléopérateur Confirmateur</span>
                                            </span>
                                            <p className="text-xs text-text-secondary truncate mt-1 font-mono">
                                                {agent.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Message Interne strictly for Clients (No direct phone calling allowed for clients) */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-base-300/80">
                                        {onNavigate && (
                                            <button 
                                                onClick={() => onNavigate('messages')}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#3C50E0] hover:bg-[#3243be] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                                                title={`Envoyer un message interne à ${agent.name}`}
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                                <span>Échanger par Message Interne</span>
                                            </button>
                                        )}
                                        {currentUser?.role === Role.Admin && (
                                            agent.phone ? (
                                                <a 
                                                    href={`tel:${agent.phone.replace(/\s+/g, '')}`}
                                                    className="flex items-center justify-center p-2 bg-base-200 hover:bg-base-300 text-text-primary border border-base-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                    title={`[Admin] Appeler ${agent.name}`}
                                                >
                                                    <Phone className="w-3.5 h-3.5" />
                                                </a>
                                            ) : (
                                                <a 
                                                    href={`mailto:${agent.email}`}
                                                    className="flex items-center justify-center p-2 bg-base-200 hover:bg-base-300 text-text-primary border border-base-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                    title={`[Admin] Envoyer un email à ${agent.name}`}
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                </a>
                                            )
                                        )}

                                        <div className="text-[11px] text-text-secondary font-semibold px-2 py-1 bg-base-200 rounded-lg shrink-0">
                                            {stats.pending > 0 ? (
                                                <span className="text-[#FFBA45] font-bold font-mono">{stats.pending} en attente</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">À jour</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 rounded-xl bg-base-100/50 border border-dashed border-base-300 text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                                <Headphones className="w-5 h-5" />
                            </div>
                            <p className="text-sm font-bold text-text-primary">
                                Aucun agent n'est actuellement assigné à cette boutique.
                            </p>
                            <p className="text-xs text-text-secondary max-w-md mx-auto">
                                {currentUser?.role === Role.Client 
                                    ? "L'administrateur CallNet configurera votre équipe d'agents sous peu pour prendre en charge vos commandes."
                                    : "Vous pouvez affecter des agents à cette boutique dans la section Gestion des Équipes."}
                            </p>
                            {currentUser?.role === Role.Admin && onNavigate && (
                                <button
                                    onClick={() => onNavigate('users')}
                                    className="mt-2 px-4 py-2 bg-[#3C50E0] text-white rounded-lg text-xs font-bold hover:bg-[#3243be] transition-all cursor-pointer inline-flex items-center gap-2"
                                >
                                    <Users className="w-4 h-4" />
                                    <span>Assigner un agent maintenant</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Charts Section: Layout Grid with Col 8 + Col 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Activity Chart (8 cols) */}
                <div className="lg:col-span-8 bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-text-primary">
                            Activity Chart
                        </h2>
                        <span className="text-xs text-text-secondary font-mono">
                            Volume & Confirmations
                        </span>
                    </div>

                    <div className="h-64 sm:h-72 w-full">
                        {timelineData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#80CAEE" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#80CAEE" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3C50E0" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#3C50E0" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.6} />
                                    <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} fontFamily="monospace" />
                                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} fontFamily="monospace" />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#1C2434', 
                                            borderColor: '#2E3A47', 
                                            borderRadius: '4px',
                                            color: '#FFFFFF',
                                            fontSize: '12px',
                                            fontFamily: 'Inter, sans-serif'
                                        }}
                                    />
                                    <Area type="monotone" dataKey="total" name="Total Commandes" stroke="#80CAEE" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                                    <Area type="monotone" dataKey="confirmed" name="Confirmées" stroke="#3C50E0" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConfirmed)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-text-secondary">
                                Aucune donnée temporelle pour cette période
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Ratio (4 cols) */}
                <div className="lg:col-span-4 bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-text-primary">
                                Status Ratio
                            </h2>
                            <span className="text-xs text-text-secondary font-mono">{filteredOrders.length} Total</span>
                        </div>

                        {/* Multi-segment Ratio Bar */}
                        <div className="py-2">
                            <div className="h-2.5 w-full bg-[#EFF2F7] dark:bg-[#333A48] rounded-[10px] overflow-hidden flex shadow-inner">
                                <div 
                                    style={{ width: `${stats.total > 0 ? (stats.shipped / stats.total) * 100 : 0}%` }} 
                                    className="bg-[#3C50E0] h-full transition-all"
                                    title={`Expédié: ${stats.shipped}`}
                                />
                                <div 
                                    style={{ width: `${stats.total > 0 ? (stats.confirmed / stats.total) * 100 : 0}%` }} 
                                    className="bg-[#10B981] h-full transition-all"
                                    title={`Confirmé: ${stats.confirmed}`}
                                />
                                <div 
                                    style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }} 
                                    className="bg-[#FFBA45] h-full transition-all"
                                    title={`En Attente: ${stats.pending}`}
                                />
                                <div 
                                    style={{ width: `${stats.total > 0 ? (stats.canceled / stats.total) * 100 : 0}%` }} 
                                    className="bg-[#FB4444] h-full transition-all"
                                    title={`Annulé: ${stats.canceled}`}
                                />
                            </div>

                            {/* Status Metrics list */}
                            <div className="mt-6 space-y-3 font-sans">
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-base-300">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#3C50E0]" />
                                        <span className="text-text-primary font-medium">Expédié</span>
                                    </div>
                                    <strong className="font-mono text-text-primary">{stats.shipped}</strong>
                                </div>
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-base-300">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                                        <span className="text-text-primary font-medium">Confirmé</span>
                                    </div>
                                    <strong className="font-mono text-text-primary">{stats.confirmed}</strong>
                                </div>
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-base-300">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBA45]" />
                                        <span className="text-text-primary font-medium">En Attente</span>
                                    </div>
                                    <strong className="font-mono text-text-primary">{stats.pending}</strong>
                                </div>
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-base-300">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#FB4444]" />
                                        <span className="text-text-primary font-medium">Annulé / Erreur</span>
                                    </div>
                                    <strong className="font-mono text-text-primary">{stats.canceled}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Orders Table (12 cols) */}
            <div className="bg-base-200 border border-base-300 p-6 rounded-[4px] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-text-primary">
                        Recent Orders
                    </h2>

                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('orders')}
                            className="px-3 py-1.5 bg-base-100 hover:bg-base-300 border border-base-300 text-text-primary text-xs font-semibold rounded-[4px] transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <span>Voir tout</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-base-300 text-text-muted text-[11px] font-mono uppercase tracking-wider">
                                <th className="pb-3 px-3">Ref</th>
                                <th className="pb-3 px-3">Client</th>
                                <th className="pb-3 px-3">Product</th>
                                <th className="pb-3 px-3 text-right">Price</th>
                                <th className="pb-3 px-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300">
                            {recentOrders.map(order => (
                                <tr 
                                    key={order.id}
                                    onClick={() => onOrderClick && onOrderClick(order)}
                                    className="hover:bg-[#3C50E0]/5 cursor-pointer transition-colors"
                                >
                                    <td className="py-3.5 px-3 font-mono font-bold text-text-secondary text-xs">
                                        #{order.id.slice(-6)}
                                    </td>
                                    <td className="py-3.5 px-3">
                                        <div className="font-semibold text-text-main">{order.customerName}</div>
                                        <div className="text-[11px] text-text-muted font-mono">{order.phone}</div>
                                    </td>
                                    <td className="py-3.5 px-3 font-medium text-text-main max-w-[200px] truncate">
                                        {order.product}
                                    </td>
                                    <td className="py-3.5 px-3 text-right font-bold text-[#3C50E0] font-mono">
                                        {order.price} DH
                                    </td>
                                    <td className="py-3.5 px-3 text-center">
                                        <StatusBadge status={order.status} size="sm" />
                                    </td>
                                </tr>
                            ))}
                            {recentOrders.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-text-secondary">
                                        Aucune commande récente à afficher.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
