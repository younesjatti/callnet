
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { extractOrderFromText } from '../lib/gemini';
import { Order } from '../types';

interface AIOrderExtractorProps {
    onExtracted: (order: Partial<Order>) => void;
    onClose: () => void;
}

const AIOrderExtractor: React.FC<AIOrderExtractorProps> = ({ onExtracted, onClose }) => {
    const { t } = useLanguage();
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleExtract = async () => {
        if (!text.trim()) return;
        setIsLoading(true);
        const result = await extractOrderFromText(text);
        setIsLoading(false);
        if (result) {
            onExtracted(result);
        } else {
            alert("Impossible d'extraire les données. Vérifiez votre texte.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-base-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-base-300 flex justify-between items-center bg-base-100">
                    <h2 className="text-xl font-black text-text-primary uppercase tracking-tighter flex items-center gap-2">
                        <span className="p-1.5 bg-primary/20 rounded-lg">✨</span>
                        Smart Add (AI)
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-base-300 transition-colors">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-xs text-text-secondary font-medium">
                        Collez un message (WhatsApp, Email, etc.) pour extraire automatiquement les informations de la commande.
                    </p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ex: Bonjour, je voudrais commander 2x Produit A. Je m'appelle Ahmed, j'habite à Casablanca, rue 123. Mon numéro est 0612345678. Prix total 200 MAD."
                        className="w-full h-48 p-4 text-sm border border-base-300 rounded-xl bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary shadow-inner resize-none"
                    />
                </div>
                <div className="p-6 bg-base-100 flex justify-end gap-3 border-t border-base-300">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-text-secondary hover:bg-base-200 rounded-lg transition-colors">
                        Annuler
                    </button>
                    <button 
                        onClick={handleExtract}
                        disabled={isLoading || !text.trim()}
                        className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white font-black rounded-lg shadow-lg hover:bg-opacity-90 disabled:bg-gray-400 transition-all active:scale-95"
                    >
                        {isLoading ? (
                            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyse...</>
                        ) : "Extraire"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIOrderExtractor;
