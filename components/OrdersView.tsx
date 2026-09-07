
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Role } from '../types';
import FileUpload from './FileUpload';
import OrderTable from './OrderTable';
import AddOrderModal from './AddOrderModal';
import { PlusIcon } from './icons/PlusIcon';
import DownloadTemplateButton from './DownloadTemplateButton';
import { SearchIcon } from './icons/SearchIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { DownloadIcon } from './icons/DownloadIcon';
import { ArchiveIcon } from './icons/ArchiveIcon';
import { DeleteIcon } from './icons/DeleteIcon';

interface OrdersViewProps {
    orders: Order[];
    onDataImport: (orders: Partial<Order>[]) => void;
    onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
    onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
    onAddOrder: (orderData: Omit<Order, 'status' | 'clientId'>) => void;
    onDeleteOrder: (orderId: string) => void;
    onDeleteAllOrders: () => void;
    onAutoArchive: () => void;
    viewingClientId?: string; 
    onOrderClick: (order: Order) => void; 
    onSmartStatusFix?: (visibleOrders: Order[]) => Promise<void>; // NEW
    activeStatusFilter?: string;
    onStatusFilterChange?: (status: string) => void;
}

const OrdersView: React.FC<OrdersViewProps> = ({ 
    orders, 
    onDataImport, 
    onUpdateOrderStatus, 
    onUpdateOrder, 
    onAddOrder, 
    onDeleteOrder, 
    onDeleteAllOrders, 
    onAutoArchive, 
    viewingClientId, 
    onOrderClick, 
    onSmartStatusFix,
    activeStatusFilter = 'All',
    onStatusFilterChange
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>(activeStatusFilter);
    const [showArchived, setShowArchived] = useState(false);
    const [isFixing, setIsFixing] = useState(false); // NEW
    const { t } = useLanguage();
    const { currentUser } = useAuth();

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

    const handleAddOrderAndCloseModal = (orderData: Omit<Order, 'status' | 'clientId'>) => {
        onAddOrder(orderData);
        setIsAddModalOpen(false);
    };

    const filteredByArchived = useMemo(() => {
        return orders.filter(order => !!order.archived === showArchived);
    }, [orders, showArchived]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { All: filteredByArchived.length };
        Object.values(OrderStatus).forEach(status => {
            counts[status] = filteredByArchived.filter(o => o.status === status).length;
        });
        return counts;
    }, [filteredByArchived]);

    const filteredOrders = useMemo(() => {
        return filteredByArchived.filter(order => {
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
                (order.district && order.district.toLowerCase().includes(query)) ||
                order.product.toLowerCase().includes(query) ||
                (order.note && order.note.toLowerCase().includes(query))
            );
            return matchesStatus && matchesSearch;
        });
    }, [filteredByArchived, searchQuery, statusFilter]);

    const handleSmartFix = async () => {
        if (!onSmartStatusFix) return;
        setIsFixing(true);
        try {
            await onSmartStatusFix(filteredOrders);
        } finally {
            setIsFixing(false);
        }
    };

    const handleExportCSV = () => {
        const XLSX = (window as any).XLSX;
        if (!XLSX) return;

        const dataToExport = filteredOrders.map(order => ({
            [t('date')]: new Date(order.date).toLocaleDateString(),
            [t('customer')]: order.customerName,
            [t('city')]: order.city,
            [t('district') || 'Quartier']: order.district || '',
            [t('address')]: order.address,
            [t('phoneLabel')]: order.phone,
            [t('product')]: order.product,
            [t('quantity')]: order.quantity,
            [t('variant')]: order.variant || '',
            [t('price')]: order.price,
            [t('note')]: order.note || '',
            [t('status')]: t(order.status),
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
        XLSX.writeFile(workbook, `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleArchiveClick = () => {
        if (window.confirm(t('archiveConfirm'))) {
            onAutoArchive();
        }
    }

    const handleDeleteAllClick = () => {
        if (window.confirm(t('deleteAllOrdersConfirm'))) {
            onDeleteAllOrders();
        }
    }

    return (
        <div className="space-y-6 pb-16">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                 <div className="flex-grow flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                    <div className="bg-base-200/80 p-1 border border-base-300 rounded-[4px] inline-flex font-mono text-xs">
                        <button
                            onClick={() => setShowArchived(false)}
                            className={`px-4 py-2 rounded-[2px] font-bold uppercase tracking-wider transition-all ${!showArchived ? 'bg-accent text-[#111113] shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            {t('activeOrders')}
                        </button>
                        <button
                            onClick={() => setShowArchived(true)}
                            className={`px-4 py-2 rounded-[2px] font-bold uppercase tracking-wider transition-all ${showArchived ? 'bg-accent text-[#111113] shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            {t('archivedOrders')}
                        </button>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto xl:justify-end font-mono text-xs">
                    {currentUser?.role !== Role.Agent && (
                         <button
                            onClick={handleArchiveClick}
                            className="flex items-center gap-2 bg-base-200/80 border border-base-300 hover:bg-base-300 text-text-secondary hover:text-text-primary font-bold py-2.5 px-4 rounded-[4px] uppercase tracking-wider transition-all"
                            title={t('archiveOldOrders')}
                        >
                            <ArchiveIcon />
                            <span className="hidden sm:inline">{t('archiveOldOrders')}</span>
                        </button>
                    )}
                    {(currentUser?.role === Role.Client || currentUser?.role === Role.Admin) && orders.length > 0 && (
                        <button
                            onClick={handleDeleteAllClick}
                            className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-bold py-2.5 px-4 rounded-[4px] uppercase tracking-wider transition-all"
                            title={t('deleteAllOrders')}
                        >
                            <DeleteIcon />
                            <span className="hidden sm:inline">{t('deleteAllOrders')}</span>
                        </button>
                    )}
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 bg-base-200/80 border border-base-300 hover:bg-base-300 text-text-secondary hover:text-text-primary font-bold py-2.5 px-4 rounded-[4px] uppercase tracking-wider transition-all"
                        title={t('exportCSV')}
                    >
                        <DownloadIcon />
                        <span className="hidden sm:inline">{t('exportCSV')}</span>
                    </button>
                    {(currentUser?.role === Role.Client || currentUser?.role === Role.Admin) && (
                        <>
                            <DownloadTemplateButton />
                            <FileUpload onDataLoaded={onDataImport} />
                            
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
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 bg-accent hover:brightness-110 text-[#111113] font-bold py-2.5 px-5 rounded-[4px] uppercase tracking-wider shadow-lg shadow-accent/20 transition-all"
                                aria-label={t('addOrder')}
                            >
                                <PlusIcon />
                                <span className="hidden sm:inline">{t('addOrder')}</span>
                            </button>
                        </>
                    )}
                 </div>
            </div>

            <div className="sticky top-[-1.5rem] z-30 bg-[#111113]/90 backdrop-blur-md pb-2 pt-1">
                <div className="bg-base-200/90 p-3 rounded-[4px] space-y-3 border border-base-300">
                    <div className="relative">
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
                    
                    <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 font-mono text-xs">
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
            </div>

            {filteredOrders.length > 0 ? (
                <OrderTable 
                    orders={filteredOrders} 
                    onUpdateStatus={onUpdateOrderStatus} 
                    onUpdateOrder={onUpdateOrder} 
                    onDeleteOrder={onDeleteOrder}
                    onOrderClick={onOrderClick}
                />
            ) : (
                <div className="text-center p-12 bg-base-200/60 rounded-[4px] border border-dashed border-base-300 mt-6 font-mono">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-text-secondary block mb-1">Status Query Empty</span>
                    <h2 className="font-syne font-extrabold text-xl text-text-primary mb-2 uppercase">{t('noOrdersFound')}</h2>
                    <p className="text-xs text-text-secondary">
                        {orders.length > 0
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

export default OrdersView;
