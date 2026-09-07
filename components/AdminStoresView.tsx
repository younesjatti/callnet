
import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Order, OrderStatus, Role, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { StoreIcon } from './icons/StoreIcon';
import { Headphones, Users } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { isAgentAssignedToStore } from '../lib/avatarUtils';
import { normalizeRole } from '../utils';

interface AdminStoresViewProps {
    orders: Order[];
    onSelectStore: (clientId: string) => void;
    onSyncStore?: (clientId: string) => Promise<void>;
    title?: string; // Custom title for context
}

const AdminStoresView: React.FC<AdminStoresViewProps> = ({ orders, onSelectStore, onSyncStore, title }) => {
    const { users } = useAuth();
    const { t } = useLanguage();
    const [syncingStoreIds, setSyncingStoreIds] = useState<Set<string>>(new Set());

    const clients = useMemo(() => users.filter(u => normalizeRole(u.role) === Role.Client), [users]);
    const agents = useMemo(() => users.filter(u => normalizeRole(u.role) === Role.Agent), [users]);

    const storeStats = useMemo(() => {
        const stats: Record<string, { total: number; pending: number; confirmed: number }> = {};
        
        clients.forEach(client => {
            const clientOrders = orders.filter(o => o.clientId === client.id);
            stats[client.id] = {
                total: clientOrders.length,
                pending: clientOrders.filter(o => o.status === OrderStatus.EnAttend).length,
                confirmed: clientOrders.filter(o => o.status === OrderStatus.Confirme || o.status === OrderStatus.Expider).length,
            };
        });
        
        return stats;
    }, [clients, orders]);

    const handleSync = async (e: React.MouseEvent, clientId: string) => {
        e.stopPropagation();
        if (!onSyncStore) return;

        setSyncingStoreIds(prev => new Set(prev).add(clientId));
        try {
            await onSyncStore(clientId);
        } finally {
            setSyncingStoreIds(prev => {
                const next = new Set(prev);
                next.delete(clientId);
                return next;
            });
        }
    };

    return (
        <div className="space-y-6">
            {title && (
                <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-xl mb-6">
                    <h3 className="text-lg font-black text-primary uppercase tracking-tighter">{title}</h3>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map(client => {
                    const stat = storeStats[client.id] || { total: 0, pending: 0, confirmed: 0 };
                    const isSyncing = syncingStoreIds.has(client.id);
                    const assignedToStore = agents.filter(agent => isAgentAssignedToStore(agent, client, users));

                    return (
                        <div 
                            key={client.id}
                            className="bg-base-200 rounded-2xl shadow-md border border-base-300 overflow-hidden hover:shadow-lg transition-all group flex flex-col"
                        >
                            <div className="p-6 flex-grow flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="flex items-center gap-3.5">
                                            <UserAvatar 
                                                user={client} 
                                                role={Role.Client} 
                                                size="md" 
                                                showRoleBadge={true} 
                                            />
                                            <div>
                                                <h3 className="text-lg font-black text-text-primary uppercase tracking-tighter truncate max-w-[170px]">{client.name}</h3>
                                                <p className="text-xs font-medium text-text-secondary truncate max-w-[170px]">{client.email}</p>
                                            </div>
                                        </div>
                                        {onSyncStore && (
                                            <button
                                                onClick={(e) => handleSync(e, client.id)}
                                                disabled={isSyncing}
                                                className={`p-2 rounded-xl transition-all border cursor-pointer ${
                                                    isSyncing 
                                                    ? 'bg-blue-100 text-blue-600 border-blue-200 animate-pulse' 
                                                    : 'bg-base-100 text-text-secondary border-base-300 hover:border-primary/50 hover:text-primary'
                                                }`}
                                                title={t('syncNow')}
                                            >
                                                <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2 text-center mb-5">
                                        <div className="bg-base-100/50 p-2.5 rounded-xl border border-base-300">
                                            <div className="text-[9px] text-text-secondary uppercase font-black tracking-widest mb-0.5">{t('totalOrders')}</div>
                                            <div className="text-lg font-black text-text-primary">{stat.total}</div>
                                        </div>
                                        <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                                            <div className="text-[9px] text-[#FFBA45] uppercase font-black tracking-widest mb-0.5">{t('pendingOrders')}</div>
                                            <div className="text-lg font-black text-[#FFBA45]">{stat.pending}</div>
                                        </div>
                                        <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                                            <div className="text-[9px] text-emerald-600 uppercase font-black tracking-widest mb-0.5">{t('confirmedOrders')}</div>
                                            <div className="text-lg font-black text-emerald-600">{stat.confirmed}</div>
                                        </div>
                                    </div>

                                    {/* Assigned Agents Mini List */}
                                    <div className="bg-base-100/70 p-3 rounded-xl border border-base-300/80 mb-5 space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                                            <span className="flex items-center gap-1.5 text-text-secondary text-[11px] font-mono">
                                                <Headphones className="w-3.5 h-3.5 text-[#3C50E0]" />
                                                Agents Assignés ({assignedToStore.length})
                                            </span>
                                            {assignedToStore.length > 0 && (
                                                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                    Actifs
                                                </span>
                                            )}
                                        </div>

                                        {assignedToStore.length > 0 ? (
                                            <div className="flex items-center gap-2 overflow-x-auto py-1">
                                                {assignedToStore.slice(0, 4).map(ag => (
                                                    <div 
                                                        key={ag.id} 
                                                        className="flex items-center gap-1.5 bg-base-200 px-2 py-1 rounded-lg border border-base-300 text-xs shrink-0"
                                                        title={`${ag.name} (${ag.email})`}
                                                    >
                                                        <UserAvatar user={ag} role={Role.Agent} size="xs" showRoleBadge={false} />
                                                        <span className="text-text-primary font-medium text-[11px] truncate max-w-[90px]">{ag.name}</span>
                                                    </div>
                                                ))}
                                                {assignedToStore.length > 4 && (
                                                    <span className="text-[10px] font-bold text-text-secondary px-1.5 py-0.5 bg-base-200 rounded-md">
                                                        +{assignedToStore.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-amber-500/90 font-medium">
                                                Aucun agent assigné spécifiquement
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => onSelectStore(client.id)}
                                    className="w-full py-3.5 bg-primary text-white font-black rounded-xl shadow-md hover:bg-opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-tighter cursor-pointer text-xs"
                                >
                                    <span>{t('viewStore')}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })}
                {clients.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-base-200 rounded-3xl border-4 border-dashed border-base-300">
                        <div className="mb-4 text-gray-300 flex justify-center">
                            <StoreIcon className="w-16 h-16" />
                        </div>
                        <p className="text-text-secondary font-black uppercase tracking-tighter">{t('noClientsFound' as any) || "Aucune boutique trouvée"}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminStoresView;

