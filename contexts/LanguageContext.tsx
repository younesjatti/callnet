import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { translations, Language, TranslationKey } from '../translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: TranslationKey | string, ...args: any[]) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLanguage = (): Language => {
    try {
        const savedLang = localStorage.getItem('language');
        if (savedLang === 'en' || savedLang === 'fr' || savedLang === 'ar') {
            return savedLang as Language;
        }
        
        // Priority default: French
        return 'fr';
    } catch (e) {
        console.warn("Error reading language preference:", e);
    }
    return 'fr';
};


export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(getInitialLanguage);

    useEffect(() => {
        try {
            localStorage.setItem('language', language);
            // Handle RTL/LTR
            const isRTL = language === 'ar';
            document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
            document.documentElement.lang = language;
            
            // Adjust body font for Arabic if needed
            if (isRTL) {
                document.body.classList.add('font-arabic');
            } else {
                document.body.classList.remove('font-arabic');
            }
        } catch (e) {
            console.warn("Failed to save language preference:", e);
        }
    }, [language]);

    const t = useCallback((key: TranslationKey | string, ...args: any[]): string => {
        // Safe access to translation set with fallback to current language then English
        const translationSet = translations[language] || translations['fr'] || translations['en'];
        
        if (!translationSet) {
             console.warn(`Translation set missing for language '${language}'. Key: ${String(key)}`);
             return key as string;
        }

        let translation: any = translationSet;
        // Handle nested keys like "auth.invalidCredential"
        const keyParts = String(key).split('.');
        for (const part of keyParts) {
            if (translation && typeof translation === 'object' && part in translation) {
                translation = translation[part];
            } else {
                translation = undefined; // Key not found
                break;
            }
        }

        if (typeof translation === 'function') {
            return translation(...args);
        }
        
        return translation || (key as string);
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};