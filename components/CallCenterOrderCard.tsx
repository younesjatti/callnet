
import React, { useState } from 'react';
import { Order, OrderStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { PhoneIcon } from './icons/PhoneIcon';
import { SmsIcon } from './icons/SmsIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { STATUS_COLORS } from '../constants';
import StatusBadge from './StatusBadge';
import { db } from '../lib/db';
import { getWhatsAppUrl, formatCallOrSmsPhone } from '../utils';

interface CallCenterOrderCardProps {
    order: Order;
    onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
    onDeleteOrder: (orderId: string) => void;
    onOrderClick: (order: Order) => void;
}

const CallCenterOrderCard: React.FC<CallCenterOrderCardProps> = ({ order, onUpdateOrderStatus, onDeleteOrder, onOrderClick }) => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const isPending = order.status === OrderStatus.EnAttend;
    const [syncInfo, setSyncInfo] = useState<{ status: 'idle' | 'syncing' | 'success' | 'error'; message?: string }>({ status: 'idle' });

    const handleManualSync = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setSyncInfo({ status: 'syncing' });
        try {
            const res = await db.orders.syncGoogleSheet(order.id, {
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
            if (res.success) {
                setSyncInfo({ status: 'success', message: res.message || 'Synchronisé !' });
                setTimeout(() => setSyncInfo({ status: 'idle' }), 5000);
            } else {
                setSyncInfo({ status: 'error', message: res.message || 'Échec de synchronisation' });
            }
        } catch (err: any) {
            setSyncInfo({ status: 'error', message: err.message || 'Erreur' });
        }
    };

    return (
        <div 
            className={`bg-base-200 rounded-xl shadow-md border group cursor-pointer transition-all ${
                isPending 
                    ? 'border-primary/50 hover:bg-primary/5' 
                    : 'border-base-300 hover:bg-base-100'
            }`}
            onClick={() => onOrderClick(order)}
            role="listitem"
            aria-label={`Order ${order.id} for ${order.customerName}`}
        >
            <div className="p-4 border-b border-base-300 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="font-black text-text-primary text-sm uppercase tracking-tighter">
                        #{order.id}
                    </span>
                    {isPending && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-primary animate-pulse" title={t('pendingOrders')}></span>}
                </div>
                <div className="flex items-center gap-2">
                    {syncInfo.status === 'success' && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                            {syncInfo.message || 'Sync OK'}
                        </span>
                    )}
                    {syncInfo.status === 'error' && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded" title={syncInfo.message}>
                            {syncInfo.message || 'Erreur'}
                        </span>
                    )}
                    <StatusBadge status={order.status} />
                </div>
            </div>

            <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-text-primary">{order.customerName}</span>
                    <span className="text-xs text-text-secondary font-medium">{order.city}{order.district ? ` (${order.district})` : ''}</span>
                </div>
                <p className="text-sm text-text-secondary truncate">{order.product} {order.variant && `(${order.variant})`}</p>
                <div className="flex justify-between items-center text-primary font-black text-lg">
                    <span>{order.price} MAD</span>
                    <span className="text-sm text-text-secondary">{order.date ? new Date(order.date).toLocaleDateString() : ''}</span>
                </div>
            </div>

            <div className="p-4 bg-base-100/50 border-t border-base-300 flex justify-between items-center gap-2">
                <select
                    value={order.status}
                    onChange={(e) => {
                        e.stopPropagation(); // Prevent card click from firing
                        onUpdateOrderStatus(order.id, e.target.value as OrderStatus);
                    }}
                    className={`flex-grow p-2 rounded-lg text-xs font-semibold appearance-none cursor-pointer border border-base-300 focus:ring-2 focus:ring-primary focus:outline-none ${STATUS_COLORS[order.status]} hover:opacity-80 transition-opacity`}
                    aria-label={t('status')}
                >
                    {Object.values(OrderStatus).map(status => (
                        <option key={status} value={status}>
                            {t(status as OrderStatus)}
                        </option>
                    ))}
                </select>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleManualSync}
                        disabled={syncInfo.status === 'syncing'}
                        className={`p-2 rounded-lg border transition-all text-xs font-bold flex items-center gap-1 ${
                            syncInfo.status === 'syncing'
                                ? 'bg-primary/20 text-primary cursor-wait border-primary/30'
                                : syncInfo.status === 'success'
                                ? 'bg-green-100 text-green-700 border-green-300'
                                : syncInfo.status === 'error'
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-base-200 text-text-secondary hover:text-primary hover:bg-base-300 border-base-300'
                        }`}
                        title="Synchroniser ce statut sur Google Sheet"
                    >
                        <svg className={`w-3.5 h-3.5 ${syncInfo.status === 'syncing' ? 'animate-spin text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <a 
                        href={`tel:${formatCallOrSmsPhone(order.phone)}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md active:scale-95"
                        title={t('call')}
                        aria-label={`${t('call')} ${order.customerName}`}
                    >
                        <PhoneIcon className="w-4 h-4" />
                    </a>
                    <a 
                        href={`sms:${formatCallOrSmsPhone(order.phone)}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md active:scale-95"
                        title={t('sms')}
                        aria-label={`${t('sms')} ${order.customerName}`}
                    >
                        <SmsIcon className="w-4 h-4" />
                    </a>
                    <a 
                        href={getWhatsAppUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                        title={`WhatsApp (${order.customerName})`}
                        aria-label={`WhatsApp ${order.customerName}`}
                    >
                        <WhatsAppIcon className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default CallCenterOrderCard;