import React from 'react';
import { OrderStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface StatusBadgeProps {
    status: OrderStatus;
    size?: 'sm' | 'md' | 'lg';
    showDot?: boolean;
}

interface StatusConfig {
    label: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
}

export const getStatusConfig = (status: OrderStatus): StatusConfig => {
    switch (status) {
        case OrderStatus.Confirme:
            return {
                label: 'Confirmé',
                bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
                text: 'text-emerald-700 dark:text-emerald-400',
                border: 'border-emerald-500/30',
                dot: 'bg-emerald-500'
            };
        case OrderStatus.Expider:
            return {
                label: 'Expédié',
                bg: 'bg-purple-500/10 dark:bg-purple-500/20',
                text: 'text-purple-700 dark:text-purple-400',
                border: 'border-purple-500/30',
                dot: 'bg-purple-500'
            };
        case OrderStatus.EnAttend:
            return {
                label: 'En cours de confirmation',
                bg: 'bg-amber-500/10 dark:bg-amber-500/20',
                text: 'text-amber-700 dark:text-amber-400',
                border: 'border-amber-500/30',
                dot: 'bg-amber-500'
            };
        case OrderStatus.PasDeRep1:
            return {
                label: 'Pas de rep 1',
                bg: 'bg-rose-500/10 dark:bg-rose-500/20',
                text: 'text-rose-700 dark:text-rose-400',
                border: 'border-rose-500/30',
                dot: 'bg-rose-500'
            };
        case OrderStatus.PasDeRep2:
            return {
                label: 'Pas de rep 2',
                bg: 'bg-rose-500/10 dark:bg-rose-500/20',
                text: 'text-rose-700 dark:text-rose-400',
                border: 'border-rose-500/30',
                dot: 'bg-rose-500'
            };
        case OrderStatus.PasDeRep3:
            return {
                label: 'Pas de rep 3',
                bg: 'bg-rose-500/15 dark:bg-rose-500/25',
                text: 'text-rose-800 dark:text-rose-300',
                border: 'border-rose-500/40',
                dot: 'bg-rose-600'
            };
        case OrderStatus.PasDeRep4:
            return {
                label: 'Pas de rep 4',
                bg: 'bg-rose-500/20 dark:bg-rose-500/30',
                text: 'text-rose-900 dark:text-rose-200',
                border: 'border-rose-500/50',
                dot: 'bg-rose-700'
            };
        case OrderStatus.PasDeRep5:
            return {
                label: 'Pas de rep 5',
                bg: 'bg-rose-500/25 dark:bg-rose-500/35',
                text: 'text-rose-950 dark:text-rose-100',
                border: 'border-rose-500/60',
                dot: 'bg-rose-800'
            };
        case OrderStatus.Injoignable1:
        case OrderStatus.Injoignable2:
        case OrderStatus.Injoignable3:
        case OrderStatus.Injoignable4:
            return {
                label: status.replace('injoignable', 'Injoignable'),
                bg: 'bg-orange-500/10 dark:bg-orange-500/20',
                text: 'text-orange-700 dark:text-orange-400',
                border: 'border-orange-500/30',
                dot: 'bg-orange-500'
            };
        case OrderStatus.Reporter:
        case OrderStatus.Reportee:
            return {
                label: 'Reporté',
                bg: 'bg-blue-500/10 dark:bg-blue-500/20',
                text: 'text-blue-700 dark:text-blue-400',
                border: 'border-blue-500/30',
                dot: 'bg-blue-500'
            };
        case OrderStatus.Whatsapp:
            return {
                label: 'WhatsApp',
                bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
                text: 'text-emerald-800 dark:text-emerald-300',
                border: 'border-emerald-500/30',
                dot: 'bg-emerald-600'
            };
        case OrderStatus.Annule:
            return {
                label: 'Annulé',
                bg: 'bg-red-500/10 dark:bg-red-500/20',
                text: 'text-red-700 dark:text-red-400',
                border: 'border-red-500/30',
                dot: 'bg-red-500'
            };
        case OrderStatus.NumIncorect:
        case OrderStatus.FauxNumero:
            return {
                label: 'Faux Numéro',
                bg: 'bg-red-500/10 dark:bg-red-500/20',
                text: 'text-red-700 dark:text-red-400',
                border: 'border-red-500/30',
                dot: 'bg-red-600'
            };
        case OrderStatus.EnDouble:
            return {
                label: 'Doublon',
                bg: 'bg-slate-500/10 dark:bg-slate-500/20',
                text: 'text-slate-700 dark:text-slate-400',
                border: 'border-slate-500/30',
                dot: 'bg-slate-500'
            };
        case OrderStatus.HorsZone:
            return {
                label: 'Hors Zone',
                bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
                text: 'text-cyan-700 dark:text-cyan-400',
                border: 'border-cyan-500/30',
                dot: 'bg-cyan-500'
            };
        case OrderStatus.NonCommandee:
            return {
                label: 'Non Commandé',
                bg: 'bg-slate-500/10 dark:bg-slate-500/20',
                text: 'text-slate-700 dark:text-slate-400',
                border: 'border-slate-500/30',
                dot: 'bg-slate-400'
            };
        case OrderStatus.Expire:
            return {
                label: 'Expiré',
                bg: 'bg-amber-900/10 dark:bg-amber-900/20',
                text: 'text-amber-800 dark:text-amber-300',
                border: 'border-amber-900/30',
                dot: 'bg-amber-800'
            };
        default:
            return {
                label: String(status || 'Inconnu'),
                bg: 'bg-slate-500/10 dark:bg-slate-500/20',
                text: 'text-slate-700 dark:text-slate-400',
                border: 'border-slate-500/30',
                dot: 'bg-slate-400'
            };
    }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showDot = true }) => {
    const { t } = useLanguage();
    const config = getStatusConfig(status);
    const translatedText = t(status as OrderStatus) || config.label;

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[10px] gap-1',
        md: 'px-2.5 py-1 text-xs gap-1.5',
        lg: 'px-3.5 py-1.5 text-sm gap-2'
    }[size];

    return (
        <span
            className={`inline-flex items-center font-mono font-bold uppercase tracking-wider rounded-[2px] border ${config.bg} ${config.text} ${config.border} ${sizeClasses} transition-all duration-150 select-none whitespace-nowrap`}
        >
            {showDot && (
                <span className={`w-1.5 h-1.5 rounded-[1px] ${config.dot} shrink-0 animate-pulse`} />
            )}
            <span>{translatedText}</span>
        </span>
    );
};

export default StatusBadge;
