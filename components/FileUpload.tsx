import React, { useRef, useState } from 'react';
import { Order } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { normalizeKey } from '../utils';

interface FileUploadProps {
    onDataLoaded: (data: Partial<Order>[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLanguage();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setError(null);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // The script from the CDN attaches XLSX to the window object.
                const XLSX = (window as any).XLSX;
                if (!XLSX) {
                    throw new Error(t('xlsxLoadError'));
                }

                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet);

                if (Array.isArray(rawData)) {
                     const jsonData = rawData.map((row: any) => {
                        const newRow: any = {};
                        Object.keys(row).forEach(key => {
                            const normalizedKey = normalizeKey(key);
                            let value = row[key];
                            
                            // Robust sanitization: convert all problematic types to string representations
                            if (typeof value === 'object' && value !== null) {
                                if (value instanceof Date) {
                                    // Convert Date objects to YYYY-MM-DD string
                                    value = value.toISOString().split('T')[0];
                                } else {
                                    // For any other object, try JSON.stringify or fallback to empty string
                                    try {
                                        const stringified = JSON.stringify(value);
                                        // Treat empty objects/arrays as empty strings
                                        if (stringified === '{}' || stringified === '[]') {
                                            value = '';
                                        } else {
                                            value = stringified;
                                        }
                                    } catch (jsonError) {
                                        // Fallback for non-JSON-serializable objects (e.g., circular references)
                                        value = '';
                                    }
                                }
                            }
                            // Ensure non-finite numbers (NaN, Infinity) are also converted to empty string
                            if (typeof value === 'number' && !Number.isFinite(value)) {
                                value = '';
                            }
                            
                            // Finally, ensure every value is explicitly a string for consistency
                            newRow[normalizedKey] = String(value || ''); 
                        });
                        return newRow;
                     }) as Partial<Order>[];

                     // Check if at least one row looks roughly like an order (has id or customerName)
                     if (jsonData.length > 0 && (jsonData[0].id !== undefined || jsonData[0].customerName !== undefined || jsonData[0].price !== undefined)) {
                        onDataLoaded(jsonData);
                    } else if (jsonData.length === 0) {
                        onDataLoaded([]);
                    }
                    else {
                        throw new Error(t('missingColumnsError'));
                    }
                } else {
                   throw new Error(t('couldNotParseError'));
                }
            } catch (err) {
                console.error("Error parsing Excel file:", err);
                let message = t('fileParseError');
                if (err instanceof Error) {
                    message = err.message;
                }
                setError(message);
                setFileName(null);
            }
        };
        reader.onerror = () => {
             setError(t('fileReadError'));
             setFileName(null);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div>
            <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
            />
            <button
                onClick={handleButtonClick}
                className="flex items-center gap-2 bg-accent hover:brightness-110 text-[#111113] font-mono font-bold text-xs uppercase tracking-wider py-2 px-3.5 rounded-[2px] shadow-sm shadow-accent/20 transition-all active:scale-95"
            >
                <UploadIcon />
                <span>{fileName ? t('loadedFile', fileName) : t('uploadOrders')}</span>
            </button>
            {error && <p className="text-rose-400 font-mono text-[11px] mt-1.5 max-w-xs">{error}</p>}
        </div>
    );
};

export default FileUpload;