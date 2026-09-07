
import React, { useState, useEffect } from 'react';
import { Order, CourierProvider } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CourierCitySelect } from './CourierCitySelect';
import { COURIER_LABELS, getCourierCities } from '../lib/courierCities';

interface AddOrderModalProps {
    onAddOrder: (orderData: Omit<Order, 'status' | 'clientId'>) => void;
    onClose: () => void;
    preFillData?: Partial<Order>;
    primaryCourier?: CourierProvider;
}

const AddOrderModal: React.FC<AddOrderModalProps> = ({ onAddOrder, onClose, preFillData, primaryCourier = 'ozon_express' }) => {
    const { t } = useLanguage();
    const [selectedCourierRef, setSelectedCourierRef] = useState<CourierProvider>(primaryCourier);
    const [formData, setFormData] = useState<Omit<Order, 'status' | 'clientId'>>({
        id: preFillData?.id || '',
        customerName: preFillData?.customerName || '',
        product: preFillData?.product || '',
        quantity: preFillData?.quantity || 1,
        variant: preFillData?.variant || '',
        price: preFillData?.price || 0,
        date: preFillData?.date || new Date().toISOString().split('T')[0],
        phone: preFillData?.phone || '',
        address: preFillData?.address || '',
        city: preFillData?.city || '',
        cityId: preFillData?.cityId || '',
        district: preFillData?.district || '',
        note: preFillData?.note || ''
    });

    useEffect(() => {
        if (primaryCourier) {
            setSelectedCourierRef(primaryCourier);
        }
    }, [primaryCourier]);

    useEffect(() => {
        if (preFillData) {
            setFormData(prev => ({
                ...prev,
                ...preFillData,
                // Ensure ID is generated if missing
                id: preFillData.id || prev.id || `gen-${Date.now()}`
            }));
        }
    }, [preFillData]);

    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };

    const handleCityChange = (cityName: string, cityId: string | number) => {
        setFormData(prev => ({
            ...prev,
            city: cityName,
            cityId: String(cityId || '')
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.id || !formData.customerName || !formData.product || formData.price < 0 || !formData.phone || !formData.address) {
            setError(t('formError'));
            return;
        }
        setError('');
        onAddOrder(formData);
    };

    const inputStyles = "w-full p-2.5 border border-base-300 rounded-[2px] bg-base-100 text-text-primary focus:outline-none focus:border-accent font-mono text-xs transition-all";

    return (
        <div 
            className="fixed inset-0 bg-[#111113]/80 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-order-title"
        >
            <div className="bg-base-200 border border-base-300 rounded-[4px] shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-6 border-b border-base-300 flex justify-between items-center bg-base-300/30">
                        <div className="flex items-center gap-3">
                             <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                             <h2 id="add-order-title" className="font-syne font-extrabold text-xl text-text-primary uppercase tracking-tight">{t('addNewOrder')}</h2>
                             {preFillData && <span className="bg-accent/10 border border-accent/30 text-accent text-[10px] font-mono font-bold px-2 py-0.5 rounded-[2px] uppercase">AI Prefilled</span>}
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close modal" className="p-1 rounded-[2px] hover:bg-base-300 text-text-secondary hover:text-text-primary transition-all">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 font-mono text-xs">
                        <div>
                            <label htmlFor="id" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('orderIdLabel')}</label>
                            <input type="text" name="id" id="id" value={formData.id} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div>
                            <label htmlFor="customerName" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('customerNameLabel')}</label>
                            <input type="text" name="customerName" id="customerName" value={formData.customerName} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                                <label htmlFor="city" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary">
                                    {t('cityLabel')} <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-1 text-[11px]">
                                    <span className="text-text-secondary text-[10px] hidden sm:inline">Réf :</span>
                                    <select
                                        value={selectedCourierRef}
                                        onChange={(e) => setSelectedCourierRef(e.target.value as CourierProvider)}
                                        className="bg-base-200 text-accent font-bold text-[10px] px-2 py-0.5 rounded border border-base-300 focus:outline-none cursor-pointer"
                                        title="Société de livraison pour la liste officielle des villes"
                                    >
                                        <option value="ozon_express">Ozon Express ({getCourierCities('ozon_express').length} villes)</option>
                                        <option value="kargo_express">Kargo Express ({getCourierCities('kargo_express').length} villes)</option>
                                        <option value="digylog">DIGYLOG ({getCourierCities('digylog').length} villes)</option>
                                        <option value="cathedis">Cathedis ({getCourierCities('cathedis').length} hubs)</option>
                                        <option value="ameex">Ameex ({getCourierCities('ameex').length} zones)</option>
                                    </select>
                                </div>
                            </div>
                            <CourierCitySelect 
                                value={formData.city || ''}
                                cityId={formData.cityId}
                                onChange={handleCityChange}
                                courierProvider={selectedCourierRef}
                                placeholder={`Rechercher parmi les villes ${COURIER_LABELS[selectedCourierRef]}...`}
                                allowProviderSwitch={false}
                            />
                        </div>
                        <div>
                            <label htmlFor="district" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('districtLabel') || 'Quartier'}</label>
                            <input type="text" name="district" id="district" value={formData.district || ''} onChange={handleChange} className={inputStyles} placeholder="Ex: Maarif, Agdal..." />
                        </div>
                         <div className="md:col-span-2">
                            <label htmlFor="phone" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('phoneLabel')} *</label>
                            <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="address" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('addressLabel')} *</label>
                            <input type="text" name="address" id="address" value={formData.address} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="product" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('productLabel')}</label>
                            <input type="text" name="product" id="product" value={formData.product} onChange={handleChange} required className={inputStyles} />
                        </div>
                        <div>
                            <label htmlFor="quantity" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('quantityLabel')}</label>
                            <input type="number" name="quantity" id="quantity" value={formData.quantity} onChange={handleChange} className={inputStyles} min="1"/>
                        </div>
                        <div>
                            <label htmlFor="variant" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('variantLabel')}</label>
                            <input type="text" name="variant" id="variant" value={formData.variant} onChange={handleChange} className={inputStyles} placeholder="e.g. Size, Color"/>
                        </div>
                        
                         <div>
                            <label htmlFor="price" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('priceLabel')}</label>
                            <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} required className={inputStyles} min="0" step="0.01"/>
                        </div>
                        <div>
                            <label htmlFor="date" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('dateLabel')}</label>
                            <input type="date" name="date" id="date" value={formData.date} onChange={handleChange} className={inputStyles} />
                        </div>
                        
                        <div className="md:col-span-2">
                            <label htmlFor="note" className="block text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1.5">{t('noteLabel')}</label>
                            <textarea name="note" id="note" value={formData.note} onChange={handleChange} className={inputStyles} rows={2}/>
                        </div>
                    </div>
                    
                    {error && <p className="px-6 pb-2 text-rose-400 font-mono text-xs font-bold">{error}</p>}
                    
                    <div className="p-4 bg-base-300/30 border-t border-base-300 flex justify-end gap-3 rounded-b-[4px] font-mono text-xs">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-[2px] bg-base-100 hover:bg-base-300 text-text-secondary hover:text-text-primary font-bold uppercase tracking-wider transition-colors border border-base-300">{t('cancel')}</button>
                        <button type="submit" className="py-2 px-5 rounded-[2px] bg-accent hover:brightness-110 text-[#111113] font-bold uppercase tracking-wider shadow-lg shadow-accent/20 transition-all">{t('saveOrder')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddOrderModal;
