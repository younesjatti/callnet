
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { GlobeIcon } from './icons/GlobeIcon';

const LanguageSelector: React.FC = () => {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleLanguageChange = (lang: 'en' | 'fr' | 'ar') => {
        setLanguage(lang);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [wrapperRef]);

    const languageLabels: Record<string, string> = {
        en: 'English',
        fr: 'Français',
        ar: 'العربية'
    };

    return (
        <div className="relative font-mono" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 p-1.5 rounded-[2px] text-text-secondary hover:bg-base-300/50 hover:text-text-primary transition-all duration-150 border border-transparent hover:border-base-300"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label="Select language"
            >
                <GlobeIcon className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{language}</span>
            </button>
            {isOpen && (
                <div 
                    className={`absolute mt-1 w-32 bg-base-200 border border-base-300 rounded-[2px] shadow-xl z-[60] py-1 ${
                        language === 'ar' ? 'left-0' : 'right-0'
                    }`} 
                    role="menu"
                >
                    {(['fr', 'en', 'ar'] as const).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => handleLanguageChange(lang)}
                            className={`flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors ${
                                language === lang 
                                    ? 'bg-accent/10 text-accent font-bold' 
                                    : 'text-text-primary hover:bg-base-300/50'
                            }`}
                            role="menuitem"
                        >
                            <span className="font-mono text-xs">{languageLabels[lang]}</span>
                            {language === lang && (
                                <div className="w-1.5 h-1.5 rounded-[1px] bg-accent" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSelector;
