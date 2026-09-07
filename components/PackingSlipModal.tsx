import React, { useRef } from 'react';
import { Order } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Printer, X, Download, Package, Phone, MapPin, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface PackingSlipModalProps {
    orders: Order[];
    onClose: () => void;
}

export const PackingSlipModal: React.FC<PackingSlipModalProps> = ({ orders, onClose }) => {
    const { currentUser, users } = useAuth();
    const printAreaRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        window.print();
    };

    const getStoreName = (clientId: string) => {
        const found = users.find(u => u.id === clientId);
        return found ? found.name : (currentUser?.name || 'CallNet Store');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111113]/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
            <div className="bg-base-200 rounded-[4px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-base-300 overflow-hidden print:max-w-none print:w-full print:max-h-none print:border-none print:shadow-none print:rounded-none">
                
                {/* Header Toolbar (Hidden during Print) */}
                <div className="flex items-center justify-between p-4 md:p-5 bg-base-300/30 border-b border-base-300 print:hidden font-mono">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                        <div>
                            <h3 className="font-syne font-extrabold text-base md:text-lg text-text-primary uppercase tracking-tight flex items-center gap-2">
                                <FileText className="w-4 h-4 text-accent" />
                                Bordereaux & Bons ({orders.length})
                            </h3>
                            <p className="text-[10px] text-text-secondary mt-0.5 uppercase tracking-wider font-mono">
                                Format A4 & Étiquettes thermiques transporteur
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-accent hover:brightness-110 text-[#111113] font-bold uppercase tracking-wider rounded-[2px] shadow-lg shadow-accent/20 transition-all"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimer ({orders.length})</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-[2px] bg-base-100 hover:bg-base-300 text-text-secondary hover:text-text-primary border border-base-300 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Slips Content */}
                <div ref={printAreaRef} className="flex-1 p-6 overflow-y-auto space-y-6 print:p-0 print:space-y-0 print:overflow-visible custom-scrollbar">
                    {orders.map((order, index) => {
                        const storeName = getStoreName(order.clientId);
                        return (
                            <div 
                                key={order.id} 
                                className="bg-white text-slate-900 border-2 border-slate-900 rounded-[4px] p-6 shadow-sm print:shadow-none print:border-2 print:border-black print:rounded-none print:page-break-after-always print:my-0 mb-6 font-sans"
                            >
                                {/* Header: Store Name + BL Reference */}
                                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        {currentUser?.logoData ? (
                                            <img src={currentUser.logoData} alt="" className="h-10 max-w-[120px] object-contain" />
                                        ) : (
                                            <div className="w-9 h-9 bg-slate-900 text-white font-mono font-bold rounded-[2px] flex items-center justify-center text-xs tracking-wider">
                                                COD
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-syne font-extrabold text-lg text-slate-900 tracking-tight uppercase">
                                                {storeName}
                                            </h4>
                                            <p className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                                                Bon de Livraison & Envoi COD
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="font-mono font-bold text-xl text-slate-900">
                                            #{order.id}
                                        </div>
                                        <div className="text-xs font-mono text-slate-600 font-medium">
                                            Date: {order.date ? (order.date.includes('T') ? order.date.split('T')[0] : order.date) : new Date().toISOString().split('T')[0]}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Details 2-Column Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    {/* Destinataire Client */}
                                    <div className="p-3 bg-slate-50 border border-slate-300 rounded-[2px]">
                                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                            Destinataire :
                                        </span>
                                        <p className="font-bold text-sm text-slate-900">
                                            {order.customerName}
                                        </p>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 font-mono mt-1">
                                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                                            <span>{order.phone}</span>
                                        </div>
                                        <div className="flex items-start gap-1.5 text-xs text-slate-600 mt-1">
                                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                            <span>
                                                {order.city} {order.district ? `(${order.district})` : ''} - {order.address}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Montant COD & Transport */}
                                    <div className="p-3 bg-emerald-50 border border-emerald-600 rounded-[2px] flex flex-col justify-between">
                                        <div>
                                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-800 block mb-0.5">
                                                Montant à Encaisser (COD) :
                                            </span>
                                            <div className="flex items-baseline gap-1 text-2xl font-mono font-bold text-emerald-800">
                                                <span>{order.price}</span>
                                                <span className="text-xs font-bold font-mono">MAD</span>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-mono font-bold text-emerald-900 mt-1">
                                            ✓ À percevoir auprès du destinataire
                                        </div>
                                    </div>
                                </div>

                                {/* Products Table */}
                                <table className="w-full text-xs text-left border border-slate-300 mb-4 font-mono">
                                    <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                        <tr>
                                            <th className="p-2 border-b border-slate-300">Désignation</th>
                                            <th className="p-2 border-b border-slate-300 text-center">Variante</th>
                                            <th className="p-2 border-b border-slate-300 text-center">Qté</th>
                                            <th className="p-2 border-b border-slate-300 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="p-2 border-b border-slate-200 font-bold text-slate-900 font-sans">
                                                {order.product}
                                            </td>
                                            <td className="p-2 border-b border-slate-200 text-center text-slate-600">
                                                {order.variant || '—'}
                                            </td>
                                            <td className="p-2 border-b border-slate-200 text-center font-bold text-slate-900">
                                                {order.quantity || 1}
                                            </td>
                                            <td className="p-2 border-b border-slate-200 text-right font-bold text-slate-900">
                                                {order.price} MAD
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {order.note && (
                                    <div className="p-2 bg-amber-50 border border-amber-300 rounded-[2px] text-xs mb-4 font-mono">
                                        <span className="font-bold text-amber-900">Instructions: </span>
                                        <span className="text-amber-800">{order.note}</span>
                                    </div>
                                )}

                                {/* Barcode-like visual + Signature Footer */}
                                <div className="flex items-end justify-between pt-2 border-t border-slate-200">
                                    {/* Barcode Mock Visual */}
                                    <div className="flex flex-col items-start">
                                        <div className="flex items-center gap-0.5 h-8">
                                            {[3,1,2,4,1,3,1,2,1,4,2,1,3,2,1,3,1,2,4,1,2,3,1,2,4,1,3].map((w, i) => (
                                                <div 
                                                    key={i} 
                                                    className="bg-black h-full" 
                                                    style={{ width: `${w}px` }} 
                                                />
                                            ))}
                                        </div>
                                        <span className="font-mono text-[9px] text-slate-500 tracking-widest mt-0.5">
                                            *{order.id}*
                                        </span>
                                    </div>

                                    {/* Signature boxes */}
                                    <div className="flex gap-6 text-[10px] font-mono text-slate-500 font-bold uppercase text-center">
                                        <div>
                                            <div className="w-24 h-10 border border-dashed border-slate-300 rounded-[2px] mb-1"></div>
                                            <span>Signature Livreur</span>
                                        </div>
                                        <div>
                                            <div className="w-24 h-10 border border-dashed border-slate-300 rounded-[2px] mb-1"></div>
                                            <span>Signature Client</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PackingSlipModal;
