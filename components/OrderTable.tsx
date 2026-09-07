

import React, { useMemo, useState } from 'react';
import { Order, OrderStatus, Role } from '../types';
import StatusBadge from './StatusBadge';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { getWhatsAppUrl, formatCallOrSmsPhone, stableSortOrders } from '../utils';
import { db } from '../lib/db';

interface OrderTableProps {
    orders: Order[];
    onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void;
    onUpdateOrder: (orderId: string, updates: Partial<Order>) => void;
    onDeleteOrder: (orderId: string) => void;
    onOrderClick: (order: Order) => void;
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, onDeleteOrder, onOrderClick }) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const isClient = currentUser?.role === Role.Client;
    const [syncState, setSyncState] = useState<Record<string, { status: 'idle' | 'syncing' | 'success' | 'error'; message?: string }>>({});
    const [viewDensity, setViewDensity] = useState<'compact' | 'standard'>('compact');

    const handleManualSync = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        setSyncState(prev => ({ ...prev, [order.id]: { status: 'syncing' } }));

        try {
            const result = await db.orders.syncGoogleSheet(order.id, {
                status: order.status,
                customerName: order.customerName,
                phone: order.phone,
                product: order.product,
                address: order.address,
                city: order.city,
                district: order.district,
                price: order.price,
                quantity: order.quantity,
                note: order.note,
                variant: order.variant,
                clientId: order.clientId,
                googleSheetUrl: currentUser?.googleSheetUrl,
                selectedSheet: currentUser?.selectedSheet,
                columnMapping: currentUser?.columnMapping
            });

            if (result.success) {
                setSyncState(prev => ({ ...prev, [order.id]: { status: 'success', message: result.message || 'Synchronisé !' } }));
                setTimeout(() => {
                    setSyncState(prev => {
                        const copy = { ...prev };
                        delete copy[order.id];
                        return copy;
                    });
                }, 6000);
            } else {
                setSyncState(prev => ({ ...prev, [order.id]: { status: 'error', message: result.message || 'Échec de synchronisation' } }));
            }
        } catch (err: any) {
            setSyncState(prev => ({ ...prev, [order.id]: { status: 'error', message: err.message || 'Erreur lors de la synchronisation' } }));
        }
    };
    
    // Tri ultra-stable : "En attente" en premier, puis par date décroissante et ID déterministe
    const sortedOrders = useMemo(() => {
        return stableSortOrders(orders, true);
    }, [orders]);

    return (
        <div className="bg-base-200/80 rounded-[4px] overflow-hidden border border-base-300 font-mono shadow-sm">
            {/* Table Control Bar */}
            <div className="px-3.5 py-2 bg-base-300/40 border-b border-base-300 flex items-center justify-between text-[11px] text-text-secondary">
                <div className="flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-text-primary">
                        {sortedOrders.length} {sortedOrders.length > 1 ? 'Commandes' : 'Commande'}
                    </span>
                    <span className="text-base-300">|</span>
                    <span className="text-[10px] text-text-secondary/70 hidden sm:inline">Vue compacte unifiée (toutes colonnes visibles)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setViewDensity('compact')}
                        className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase transition-all ${
                            viewDensity === 'compact' 
                                ? 'bg-accent text-[#111113]' 
                                : 'bg-base-100/70 hover:bg-base-100 text-text-secondary'
                        }`}
                        title="Affichage ultra-compact"
                    >
                        Ultra Compact
                    </button>
                    <button
                        onClick={() => setViewDensity('standard')}
                        className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase transition-all ${
                            viewDensity === 'standard' 
                                ? 'bg-accent text-[#111113]' 
                                : 'bg-base-100/70 hover:bg-base-100 text-text-secondary'
                        }`}
                        title="Affichage aéré"
                    >
                        Standard
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[860px]">
                    <thead className="bg-base-300/70 text-[10px] text-text-secondary uppercase font-bold tracking-wider select-none">
                        <tr>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[85px]">{t('date')}</th>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[170px]">{t('customer')} & {t('phoneLabel')}</th>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[190px]">{t('product')}</th>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[85px]">{t('price')}</th>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[170px]">{t('city')} / {t('address')}</th>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[130px]">{t('status')}</th>
                            <th className="py-2.5 px-2.5 border-b border-base-300 w-[120px]">{t('note')}</th>
                            {!isClient && (
                                <th className="py-2.5 px-2.5 border-b border-base-300 text-right w-[90px]">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300/60 bg-base-100/20">
                        {sortedOrders.map((order) => {
                            const isPending = order.status === OrderStatus.EnAttend;
                            const syncInfo = syncState[order.id];
                            const pyClass = viewDensity === 'compact' ? 'py-2' : 'py-3.5';

                            return (
                                <tr 
                                    key={order.id} 
                                    onClick={() => onOrderClick(order)}
                                    className={`group transition-all cursor-pointer relative ${
                                        isPending 
                                            ? 'bg-accent/5 hover:bg-accent/15 border-l-2 border-l-accent' 
                                            : 'hover:bg-base-300/40'
                                    }`}
                                >
                                    {/* 1. Date & ID */}
                                    <td className={`${pyClass} px-3 align-top whitespace-nowrap`}>
                                        <div className="font-bold text-text-primary text-[11px]">
                                            {new Date(order.date).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: '2-digit' })}
                                        </div>
                                        <div className="text-[10px] text-text-secondary/80 font-mono mt-0.5 truncate max-w-[85px]" title={order.id}>
                                            #{order.id.slice(0, 8)}
                                        </div>
                                    </td>

                                    {/* 2. Client & Téléphone */}
                                    <td className={`${pyClass} px-3 align-top`}>
                                        <div className="flex items-center gap-1.5">
                                            <div className="font-bold text-text-primary uppercase tracking-tight text-[12px] truncate" title={order.customerName}>
                                                {order.customerName}
                                            </div>
                                            {isPending && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" title="En cours de confirmation"></span>
                                            )}
                                        </div>
                                        <div className="font-mono text-text-secondary hover:text-accent font-semibold text-[11px] mt-0.5 flex items-center gap-1">
                                            <a 
                                                href={`tel:${formatCallOrSmsPhone(order.phone)}`} 
                                                onClick={(e) => e.stopPropagation()} 
                                                className="hover:underline"
                                                title={`Appeler ${order.phone}`}
                                            >
                                                {order.phone}
                                            </a>
                                        </div>
                                    </td>

                                    {/* 3. Produit & Variante & Qté */}
                                    <td className={`${pyClass} px-3 align-top`}>
                                        <div 
                                            className="font-medium text-text-primary text-[12px] truncate hover:text-clip" 
                                            title={order.product}
                                        >
                                            {order.product}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            {order.quantity && order.quantity > 1 && (
                                                <span className="px-1.5 py-0.2 bg-base-300 text-text-primary font-bold rounded-[2px] text-[10px]">
                                                    x{order.quantity}
                                                </span>
                                            )}
                                            {order.variant ? (
                                                <span className="px-1.5 py-0.2 bg-base-200 border border-base-300 text-text-secondary uppercase rounded-[2px] text-[10px] truncate max-w-[120px]" title={order.variant}>
                                                    {order.variant}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>

                                    {/* 4. Prix */}
                                    <td className={`${pyClass} px-3 align-top whitespace-nowrap`}>
                                        <div className="font-bold text-accent text-[12px]">
                                            {order.price} <span className="text-[10px] text-accent/80 font-normal">MAD</span>
                                        </div>
                                    </td>

                                    {/* 5. Destination (Ville + Quartier + Adresse) */}
                                    <td className={`${pyClass} px-3 align-top`}>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-text-primary text-[11px] uppercase tracking-tight">
                                                {order.city || '—'}
                                            </span>
                                            {order.district && (
                                                <span className="px-1.5 py-0.2 bg-base-200 border border-base-300 text-text-secondary text-[10px] rounded-[2px] truncate max-w-[95px]" title={order.district}>
                                                    {order.district}
                                                </span>
                                            )}
                                        </div>
                                        {order.address && (
                                            <div 
                                                className="text-[10.5px] text-text-secondary/90 truncate mt-0.5" 
                                                title={order.address}
                                            >
                                                {order.address}
                                            </div>
                                        )}
                                    </td>

                                    {/* 6. Statut */}
                                    <td className={`${pyClass} px-3 align-top whitespace-nowrap`}>
                                        <StatusBadge status={order.status} size="sm" />
                                    </td>

                                    {/* 7. Note */}
                                    <td className={`${pyClass} px-3 align-top`}>
                                        {order.note ? (
                                            <div 
                                                className="text-[11px] text-text-secondary bg-base-200/50 px-2 py-1 rounded-[2px] border border-base-300/60 truncate" 
                                                title={order.note}
                                            >
                                                {order.note}
                                            </div>
                                        ) : (
                                            <span className="text-text-secondary/40 text-[11px]">—</span>
                                        )}
                                    </td>

                                    {/* 8. Actions (Uniquement pour Admin / Agent) */}
                                    {!isClient && (
                                        <td className={`${pyClass} px-3 align-top text-right whitespace-nowrap`}>
                                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                {syncInfo?.status === 'success' && (
                                                    <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/30 px-1.5 py-0.5 rounded-[2px] flex items-center gap-1" title={syncInfo.message}>
                                                        <span>✓</span>
                                                    </span>
                                                )}
                                                {syncInfo?.status === 'error' && (
                                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded-[2px] flex items-center gap-1" title={syncInfo.message}>
                                                        <span>✕</span>
                                                    </span>
                                                )}

                                                <button
                                                    onClick={(e) => handleManualSync(e, order)}
                                                    disabled={syncInfo?.status === 'syncing'}
                                                    className={`p-1.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center border ${
                                                        syncInfo?.status === 'syncing'
                                                            ? 'bg-accent/10 text-accent border-accent/40 cursor-wait'
                                                            : syncInfo?.status === 'success'
                                                            ? 'bg-accent/20 text-accent border-accent/50'
                                                            : syncInfo?.status === 'error'
                                                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                                                            : 'bg-base-100 hover:bg-base-300 text-text-secondary hover:text-text-primary border-base-300'
                                                    }`}
                                                    title="Synchroniser vers Google Sheet"
                                                >
                                                    <svg 
                                                        className={`w-3.5 h-3.5 ${syncInfo?.status === 'syncing' ? 'animate-spin text-accent' : ''}`} 
                                                        fill="none" 
                                                        viewBox="0 0 24 24" 
                                                        stroke="currentColor" 
                                                        strokeWidth={2.2}
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>

                                                <a 
                                                    href={getWhatsAppUrl(order)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-400 rounded-[2px] transition-all flex items-center justify-center"
                                                    title={`Envoyer WhatsApp à ${order.customerName} (${order.phone})`}
                                                >
                                                    <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                </a>

                                                {currentUser?.role === Role.Admin && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`Voulez-vous vraiment supprimer définitivement la commande #${order.id} ?`)) {
                                                                onDeleteOrder(order.id);
                                                            }
                                                        }}
                                                        className="p-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 rounded-[2px] transition-all flex items-center justify-center"
                                                        title="Supprimer la commande"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrderTable;