
import React, { createContext, useState, useEffect, useCallback, useContext, useMemo } from 'react';

type ViewPreference = 'auto' | 'mobile-force' | 'desktop-force';
type ActiveView = 'mobile' | 'desktop';

interface ViewModeContextType {
    viewPreference: ViewPreference;
    setViewPreference: (preference: ViewPreference) => void;
    currentActiveView: ActiveView;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const getInitialViewPreference = (): ViewPreference => {
    try {
        const savedPreference = localStorage.getItem('viewPreference');
        if (savedPreference === 'auto' || savedPreference === 'mobile-force' || savedPreference === 'desktop-force') {
            return savedPreference;
        }
    } catch (e) {
        console.warn("Error reading view preference:", e);
    }
    return 'auto'; // Default to auto
};

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [viewPreference, setViewPreference] = useState<ViewPreference>(getInitialViewPreference);
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);

    useEffect(() => {
        try {
            localStorage.setItem('viewPreference', viewPreference);
        } catch (e) {
            console.warn("Failed to save view preference:", e);
        }
    }, [viewPreference]);

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const currentActiveView = useMemo(() => {
        if (viewPreference === 'mobile-force') return 'mobile';
        if (viewPreference === 'desktop-force') return 'desktop';
        // For 'auto', use a breakpoint (e.g., Tailwind's 'md' breakpoint is 768px)
        return screenWidth < 768 ? 'mobile' : 'desktop';
    }, [viewPreference, screenWidth]);

    return (
        <ViewModeContext.Provider value={{ viewPreference, setViewPreference, currentActiveView }}>
            {children}
        </ViewModeContext.Provider>
    );
};

export const useViewMode = () => {
    const context = useContext(ViewModeContext);
    if (context === undefined) {
        throw new Error('useViewMode must be used within a ViewModeProvider');
    }
    return context;
};
