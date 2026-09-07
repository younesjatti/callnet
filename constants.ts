
import { OrderStatus } from './types';

export const STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.Confirme]: 'bg-green-100 text-green-800 border-green-200',
  [OrderStatus.Expedie]: 'bg-purple-100 text-purple-800 border-purple-200',
  [OrderStatus.Expider]: 'bg-purple-100 text-purple-800 border-purple-200',
  [OrderStatus.PasDeRep1]: 'bg-red-50 text-red-600 border-red-100',
  [OrderStatus.PasDeRep2]: 'bg-red-50 text-red-600 border-red-100',
  [OrderStatus.PasDeRep3]: 'bg-red-50 text-red-600 border-red-100',
  [OrderStatus.PasDeRep4]: 'bg-red-50 text-red-600 border-red-100',
  [OrderStatus.PasDeRep5]: 'bg-red-50 text-red-600 border-red-100',
  [OrderStatus.Injoignable1]: 'bg-orange-50 text-orange-600 border-orange-100',
  [OrderStatus.Injoignable2]: 'bg-orange-50 text-orange-600 border-orange-100',
  [OrderStatus.Injoignable3]: 'bg-orange-50 text-orange-600 border-orange-100',
  [OrderStatus.Injoignable4]: 'bg-orange-50 text-orange-600 border-orange-100',
  [OrderStatus.EnAttend]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  [OrderStatus.Reporter]: 'bg-blue-50 text-blue-600 border-blue-100',
  [OrderStatus.Reportee]: 'bg-blue-50 text-blue-600 border-blue-100',
  [OrderStatus.NonCommandee]: 'bg-slate-100 text-slate-800 border-slate-200',
  [OrderStatus.Whatsapp]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  [OrderStatus.Annule]: 'bg-red-100 text-red-800 border-red-200',
  [OrderStatus.NumIncorect]: 'bg-red-100 text-red-800 border-red-200',
  [OrderStatus.FauxNumero]: 'bg-red-100 text-red-800 border-red-200',
  [OrderStatus.PersonneIncorrecte]: 'bg-red-100 text-red-800 border-red-200',
  [OrderStatus.Expire]: 'bg-[#F3E5AB] text-[#8B4513] border-[#D2B48C]', // Brownish
  [OrderStatus.EnDouble]: 'bg-gray-200 text-gray-800 border-gray-300',
  [OrderStatus.HorsZone]: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

export const PIE_CHART_COLORS: Record<OrderStatus, string> = {
    [OrderStatus.Confirme]: '#10b981', // emerald-500
    [OrderStatus.Expedie]: '#8b5cf6', // violet-500
    [OrderStatus.Expider]: '#8b5cf6', // violet-500
    [OrderStatus.PasDeRep1]: '#fecaca', // red-200
    [OrderStatus.PasDeRep2]: '#fecaca',
    [OrderStatus.PasDeRep3]: '#fecaca',
    [OrderStatus.PasDeRep4]: '#fecaca',
    [OrderStatus.PasDeRep5]: '#fecaca',
    [OrderStatus.Injoignable1]: '#fed7aa', // orange-200
    [OrderStatus.Injoignable2]: '#fed7aa',
    [OrderStatus.Injoignable3]: '#fed7aa',
    [OrderStatus.Injoignable4]: '#fed7aa',
    [OrderStatus.EnAttend]: '#ddd6fe', // violet-200
    [OrderStatus.Reporter]: '#3b82f6', // blue-500
    [OrderStatus.Reportee]: '#3b82f6', // blue-500
    [OrderStatus.NonCommandee]: '#64748b', // slate-500
    [OrderStatus.Whatsapp]: '#fbbf24', // amber-400
    [OrderStatus.Annule]: '#ef4444', // red-500
    [OrderStatus.NumIncorect]: '#ef4444',
    [OrderStatus.FauxNumero]: '#ef4444',
    [OrderStatus.PersonneIncorrecte]: '#ef4444',
    [OrderStatus.Expire]: '#8b4513', // saddle brown
    [OrderStatus.EnDouble]: '#4b5563', // gray-600
    [OrderStatus.HorsZone]: '#06b6d4', // cyan-500
};
