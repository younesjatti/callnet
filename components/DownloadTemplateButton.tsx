
import React from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { useLanguage } from '../contexts/LanguageContext';

const DownloadTemplateButton: React.FC = () => {
    const { t } = useLanguage();
    const handleDownload = () => {
        const XLSX = (window as any).XLSX;

        if (!XLSX) {
            console.error("XLSX library not found. Make sure it's loaded from the CDN.");
            alert("Could not download template. The spreadsheet library failed to load.");
            return;
        }

        const headers = [
            'id',
            'customerName',
            'phone',
            'city',
            'district',
            'address',
            'product',
            'quantity',
            'variant',
            'price',
            'date',
            'note'
        ];

        const sampleData = [{
            id: '1001',
            customerName: 'Youssef El Amrani',
            phone: '0661234567',
            city: 'Casablanca',
            district: 'Maârif',
            address: '12 Rue Zerktouni',
            product: 'Pack Cosmétique Bio',
            quantity: 1,
            variant: 'Standard',
            price: 299,
            date: new Date().toISOString().split('T')[0],
            note: 'Livraison express avant 18h'
        }];

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
        XLSX.writeFile(workbook, 'Order_Template.xlsx');
    };

    return (
        <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-base-100 hover:bg-base-300 border border-base-300 text-text-secondary hover:text-text-primary font-mono font-bold text-xs uppercase tracking-wider py-2 px-3.5 rounded-[2px] transition-all active:scale-95"
            aria-label="Download order template"
        >
            <DownloadIcon />
            <span className="hidden sm:inline">{t('downloadTemplate')}</span>
        </button>
    );
};

export default DownloadTemplateButton;
