
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Role } from '../types';
import CallCenterOrderTable from './CallCenterOrderTable';
import AddOrderModal from './AddOrderModal';
import { PlusIcon } from './icons/PlusIcon';
import { SearchIcon } from './icons/SearchIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface CallCenterOrdersViewProps {
    orders: Order[];
    onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
    onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
    onAddOrder: (orderData: Omit<Order, 'status' | 'clientId'>) => void;
    onDeleteOrder: (orderId: string) => void;
    onOrderClick: (order: Order) => void; 
    onSync?: () => Promise<void>; 
    onSmartStatusFix?: (visibleOrders: Order[]) => Promise<void>;
    activeStatusFilter?: string;
    onStatusFilterChange?: (status: string) => void;
}

const CallCenterOrdersView: React.FC<CallCenterOrdersViewProps> = ({ 
    orders, 
    onUpdateOrderStatus, 
    onUpdateOrder, 
    onAddOrder, 
    onDeleteOrder, 
    onOrderClick, 
    onSmartStatusFix,
    activeStatusFilter = 'All',
    onStatusFilterChange
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(activeStatusFilter);
    const [isFixing, setIsFixing] = useState(false);
    const { t } = useLanguage();
    const { currentUser, users } = useAuth();

    // Sync if parent filter changes
    React.useEffect(() => {
        if (activeStatusFilter !== undefined) {
            setStatusFilter(activeStatusFilter);
        }
    }, [activeStatusFilter]);

    const handleFilterChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        if (onStatusFilterChange) {
            onStatusFilterChange(newStatus);
        }
    };

    const assignedStores = useMemo(() => {
        if (!currentUser || currentUser.role !== Role.Agent) return [];
        let rawAssigned = currentUser.assignedClientIds || [];
        
        // Fallback: If agent has no explicit stores yet, grant access to all available stores
        if (rawAssigned.length === 0) {
            const clientUsers = users.filter(u => u.role === Role.Client);
            rawAssigned = clientUsers.length > 0 ? clientUsers.map(c => c.id) : ['store-1'];
        }

        const rawAssignedClean = rawAssigned.map(s => String(s).trim());
        const rawAssignedLower = rawAssignedClean.map(s => s.toLowerCase());

        // 1. Find matching client users in state
        const matchedUsers = users.filter(u => {
            const uId = String(u.id || '').trim().toLowerCase();
            const uName = String(u.name || '').trim().toLowerCase();
            const uEmail = String(u.email || '').trim().toLowerCase();
            return rawAssignedLower.includes(uId) || rawAssignedLower.includes(uName) || rawAssignedLower.includes(uEmail);
        });

        // 2. Build complete list of store representations
        const result: { id: string; name: string }[] = [];
        const addedKeys = new Set<string>();

        matchedUsers.forEach(u => {
            const key = String(u.id || u.name).toLowerCase();
            if (!addedKeys.has(key)) {
                result.push({ id: u.id, name: u.name || u.email || u.id });
                addedKeys.add(key);
            }
        });

        // 3. For any assigned ID that wasn't represented by a user object, add it directly
        rawAssignedClean.forEach(rawId => {
            const rawLower = rawId.toLowerCase();
            const alreadyAdded = Array.from(addedKeys).some(k => k === rawLower);
            if (!alreadyAdded) {
                const displayName = rawId === 'store-1' ? 'Boutique E-commerce' : rawId;
                result.push({ id: rawId, name: displayName });
                addedKeys.add(rawLower);
            }
        });

        return result;
    }, [currentUser, users]);

    const handleAddOrderAndCloseModal = (orderData: Omit<Order, 'status' | 'clientId'>) => {
        onAddOrder(orderData);
        setIsAddModalOpen(false);
    };

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: orders.length };
        Object.values(OrderStatus).forEach(status => {
            counts[status] = orders.filter(o => o.status === status).length;
        });
        return counts;
    }, [orders]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            let matchesStatus = true;
            if (statusFilter === 'All') {
                matchesStatus = true;
            } else if (statusFilter === 'pas_de_reponse') {
                matchesStatus = String(order.status || '').startsWith('pas de rep');
            } else if (statusFilter === 'injoignable') {
                matchesStatus = String(order.status || '').startsWith('injoignable');
            } else {
                matchesStatus = order.status === statusFilter;
            }

            const query = searchQuery.toLowerCase();
            const matchesSearch = !query || (
                String(order.id).toLowerCase().includes(query) ||
                order.customerName.toLowerCase().includes(query) ||
                order.phone.toLowerCase().includes(query) ||
                order.city.toLowerCase().includes(query) ||
                order.product.toLowerCase().includes(query) ||
                (order.note && order.note.toLowerCase().includes(query))
            );
            return matchesStatus && matchesSearch;
        });
    }, [orders, searchQuery, statusFilter]);

    const handleSmartFix = async () => {
        if (!onSmartStatusFix) return;
        setIsFixing(true);
        try {
            await onSmartStatusFix(filteredOrders);
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <div className="space-y-6 pb-16">
            {currentUser?.role === Role.Agent && (
                <div className="p-4 bg-base-200/80 border border-base-300 rounded-[4px] flex flex-wrap items-center justify-between gap-3 font-mono">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                            Boutiques assignées :
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {assignedStores.length > 0 ? (
                                assignedStores.map(store => (
                                    <span key={store.id} className="px-2.5 py-1 bg-accent/10 text-accent border border-accent/30 rounded-[2px] text-xs font-bold uppercase">
                                        {store.name}
                                    </span>
                                ))
                            ) : (
                                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-[2px] text-xs font-bold">
                                    Aucune boutique assignée
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        {orders.length} commande{orders.length > 1 ? 's' : ''} au total
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center gap-4 font-mono text-xs">
                <div className="relative flex-grow">
                    <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none z-10 text-text-secondary">
                        <SearchIcon />
                    </span>
                    <input
                        type="text"
                        placeholder={t('searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-2.5 ps-10 border border-base-300 rounded-[4px] bg-base-100 text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent font-mono text-xs transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSmartFix}
                        disabled={isFixing || filteredOrders.length === 0}
                        className={`flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/50 hover:bg-indigo-600/30 text-indigo-300 font-bold py-2.5 px-4 rounded-[4px] uppercase tracking-wider transition-all ${isFixing ? 'opacity-70 animate-pulse cursor-wait' : ''}`}
                        title={t('smartStatusFix')}
                    >
                        <span>{isFixing ? '⏳' : '✨'}</span>
                        <span className="hidden sm:inline">{isFixing ? 'Fixing...' : t('smartStatusFix')}</span>
                    </button>
                    <button
                        onClick={() => { setIsAddModalOpen(true); }}
                        className="flex items-center gap-2 bg-accent hover:brightness-110 text-[#111113] font-bold py-2.5 px-5 rounded-[4px] uppercase tracking-wider shadow-lg shadow-accent/20 transition-all"
                        aria-label={t('addOrder')}
                    >
                        <PlusIcon />
                        <span className="hidden sm:inline">{t('addOrder')}</span>
                    </button>
                </div>
            </div>

            <div className="bg-base-200/90 p-3 rounded-[4px] space-y-3 border border-base-300 font-mono text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                    <button
                        onClick={() => handleFilterChange('All')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-[2px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer ${
                            statusFilter === 'All' 
                                ? 'bg-accent text-[#111113] border-accent shadow-sm' 
                                : 'bg-base-100 text-text-secondary border-base-300 hover:border-accent/40'
                        }`}
                    >
                        <span>{t('allStatuses')}</span>
                        <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] ${statusFilter === 'All' ? 'bg-black/20 text-[#111113] font-bold' : 'bg-base-300 text-text-secondary'}`}>
                            {statusCounts.All}
                        </span>
                    </button>
                    
                    {Object.values(OrderStatus).map(status => (
                        <button
                            key={status}
                            onClick={() => handleFilterChange(status)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-[2px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer ${
                                statusFilter === status 
                                ? 'bg-accent text-[#111113] border-accent shadow-sm' 
                                : 'bg-base-100 text-text-secondary border-base-300 hover:border-accent/40'
                            }`}
                        >
                            <span>{t(status as OrderStatus)}</span>
                            <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] ${statusFilter === status ? 'bg-black/20 text-[#111113] font-bold' : 'bg-base-300 text-text-secondary'}`}>
                                {statusCounts[status]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {filteredOrders.length > 0 ? (
                <CallCenterOrderTable 
                    orders={filteredOrders} 
                    onUpdateOrderStatus={onUpdateOrderStatus} 
                    onDeleteOrder={onDeleteOrder}
                    onOrderClick={onOrderClick}
                />
            ) : (
                <div className="text-center p-12 bg-base-200/60 rounded-[4px] border border-dashed border-base-300 mt-6 font-mono">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-text-secondary block mb-1">Queue Empty</span>
                    <h2 className="font-syne font-extrabold text-xl text-text-primary mb-2 uppercase">{t('noOrdersFound')}</h2>
                    <p className="text-xs text-text-secondary max-w-md mx-auto">
                        {currentUser?.role === Role.Agent && (currentUser.assignedClientIds?.length || 0) === 0
                            ? "Aucune boutique n'est actuellement affectée à votre profil d'agent. Demandez à l'administrateur de vous affecter des boutiques dans l'onglet Utilisateurs."
                            : orders.length > 0
                                ? t('noOrdersMatchFilters')
                                : t('uploadOrAddOrders')
                        }
                    </p>
                </div>
            )}
            
            {isAddModalOpen && (
                <AddOrderModal 
                    onAddOrder={handleAddOrderAndCloseModal} 
                    onClose={() => setIsAddModalOpen(false)} 
                />
            )}
        </div>
    );
};

export default CallCenterOrdersView;
