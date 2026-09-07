
import React, { useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { SmsIcon } from './icons/SmsIcon';
import { useViewMode } from '../contexts/ViewModeContext';
import CallCenterOrderCard from './CallCenterOrderCard';
import { getWhatsAppUrl, formatCallOrSmsPhone, stableSortOrders } from '../utils';
import { getStatusConfig } from './StatusBadge';

interface CallCenterOrderTableProps {
    orders: Order[];
    onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
    onDeleteOrder: (orderId: string) => void;
    onOrderClick: (order: Order) => void;
}

const CallCenterOrderTable: React.FC<CallCenterOrderTableProps> = ({ orders, onUpdateOrderStatus, onDeleteOrder, onOrderClick }) => {
    const { t } = useLanguage();
    const { currentActiveView } = useViewMode();
    
    // Tri ultra-stable : "En attente" en premier, puis par date décroissante et ID déterministe
    const sortedOrders = useMemo(() => {
        return stableSortOrders(orders, true);
    }, [orders]);

    if (currentActiveView === 'mobile') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedOrders.map((order) => (
                    <CallCenterOrderCard
                        key={order.id}
                        order={order}
                        onUpdateOrderStatus={onUpdateOrderStatus}
                        onDeleteOrder={onDeleteOrder}
                        onOrderClick={onOrderClick}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="bg-base-200/80 rounded-[4px] overflow-hidden border border-base-300 font-mono shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[860px]">
                    <thead className="bg-base-300/70 text-[10px] text-text-secondary uppercase font-bold tracking-wider select-none">
                        <tr>
                            <th className="py-2.5 px-3 border-b border-base-300 w-[100px]">{t('orderId')}</th>
                            <th className="py-2.5 px-3 border-b border-base-300 w-[180px]">{t('customer')} & Contact</th>
                            <th className="py-2.5 px-3 border-b border-base-300 w-[240px]">{t('product')}</th>
                            <th className="py-2.5 px-3 border-b border-base-300 w-[95px]">{t('price')}</th>
                            <th className="py-2.5 px-3 border-b border-base-300 w-[160px]">{t('status')}</th>
                            <th className="py-2.5 px-3 border-b border-base-300 text-center w-[110px]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300/60 bg-base-100/20">
                        {sortedOrders.map((order) => {
                            const isPending = order.status === OrderStatus.EnAttend;
                            const statusStyle = getStatusConfig(order.status);

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
                                    {/* 1. ID COMMANDE & DATE */}
                                    <td className="py-2 px-3 align-top whitespace-nowrap">
                                        <div className="font-bold text-text-primary text-[11.5px] flex items-center gap-1">
                                            <span>#{order.id}</span>
                                            {isPending && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" title="En cours de confirmation"></span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-text-secondary/80 font-mono mt-0.5">
                                            {order.date ? new Date(order.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }) : '—'}
                                        </div>
                                    </td>

                                    {/* 2. CLIENT & TÉL & VILLE */}
                                    <td className="py-2 px-3 align-top overflow-hidden">
                                        <div className="font-bold text-text-primary uppercase tracking-tight text-[12px] truncate" title={order.customerName}>
                                            {order.customerName}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <a 
                                                href={`tel:${formatCallOrSmsPhone(order.phone)}`} 
                                                onClick={(e) => e.stopPropagation()}
                                                className="font-mono text-text-secondary hover:text-accent font-semibold text-[11px] transition-colors"
                                                title={`Appeler ${order.phone}`}
                                            >
                                                {order.phone}
                                            </a>
                                            {order.city && (
                                                <span className="text-[10px] text-text-secondary/80 truncate max-w-[80px]" title={`${order.city}${order.district ? ` • ${order.district}` : ''}`}>
                                                    • {order.city}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 3. PRODUIT & VARIANTES (COMPACT & TRUNCATED) */}
                                    <td className="py-2 px-3 align-top overflow-hidden">
                                        <div 
                                            className="font-medium text-text-primary text-[11.5px] truncate leading-snug" 
                                            title={order.product}
                                        >
                                            {order.product}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            {order.quantity && order.quantity > 1 && (
                                                <span className="px-1 py-0.2 bg-base-300 text-text-primary font-bold rounded-[2px] text-[9.5px]">
                                                    x{order.quantity}
                                                </span>
                                            )}
                                            {order.variant ? (
                                                <span 
                                                    className="px-1.5 py-0.2 bg-base-200 border border-base-300 text-text-secondary uppercase rounded-[2px] text-[9.5px] truncate max-w-[150px]" 
                                                    title={order.variant}
                                                >
                                                    {order.variant}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>

                                    {/* 4. PRIX */}
                                    <td className="py-2 px-3 align-top whitespace-nowrap">
                                        <div className="font-bold text-accent text-[12px]">
                                            {order.price} <span className="text-[10px] text-accent/80 font-normal">MAD</span>
                                        </div>
                                    </td>

                                    {/* 5. STATUT SELECT */}
                                    <td className="py-2 px-3 align-top whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <div className="relative">
                                            <select
                                                value={order.status}
                                                onChange={(e) => {
                                                    onUpdateOrderStatus(order.id, e.target.value as OrderStatus);
                                                }}
                                                className={`w-full py-1 px-2 pe-6 rounded-[3px] text-[10.5px] font-bold font-mono uppercase tracking-wider cursor-pointer border appearance-none transition-all ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} focus:outline-none focus:ring-1 focus:ring-accent`}
                                                aria-label={t('status')}
                                            >
                                                {Object.values(OrderStatus).map(status => (
                                                    <option key={status} value={status} className="bg-base-100 text-text-primary text-xs normal-case font-mono py-1">
                                                        {t(status as OrderStatus)}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-1.5 opacity-60">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 6. ACTIONS RAPIDES */}
                                    <td className="py-2 px-3 align-top text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                            <a 
                                                href={`tel:${formatCallOrSmsPhone(order.phone)}`} 
                                                className="p-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 hover:border-emerald-500 rounded-[2px] transition-all shadow-sm flex items-center justify-center"
                                                title={`${t('call')} (${order.phone})`}
                                            >
                                                <PhoneIcon className="w-3.5 h-3.5" />
                                            </a>
                                            <a 
                                                href={`sms:${formatCallOrSmsPhone(order.phone)}`} 
                                                className="p-1.5 bg-sky-600/15 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30 hover:border-sky-500 rounded-[2px] transition-all shadow-sm flex items-center justify-center"
                                                title={`${t('sms')} (${order.phone})`}
                                            >
                                                <SmsIcon className="w-3.5 h-3.5" />
                                            </a>
                                            <a 
                                                href={getWhatsAppUrl(order)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 hover:border-emerald-400 rounded-[2px] transition-all shadow-sm flex items-center justify-center"
                                                title={`WhatsApp (${order.customerName})`}
                                            >
                                                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400" />
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CallCenterOrderTable;

