
import React from 'react';
import { useViewMode } from '../contexts/ViewModeContext';
import { MobileIcon } from './icons/MobileIcon';
import { DesktopIcon } from './icons/DesktopIcon';
import { useLanguage } from '../contexts/LanguageContext';

const ViewModeToggle: React.FC = () => {
    const { viewPreference, setViewPreference, currentActiveView } = useViewMode();
    const { t } = useLanguage();

    const cycleViewPreference = () => {
        if (viewPreference === 'auto') {
            setViewPreference('mobile-force');
        } else if (viewPreference === 'mobile-force') {
            setViewPreference('desktop-force');
        } else {
            setViewPreference('auto');
        }
    };

    const getIcon = () => {
        if (viewPreference === 'mobile-force') {
            return <MobileIcon className="w-5 h-5 text-primary" />;
        }
        if (viewPreference === 'desktop-force') {
            return <DesktopIcon className="w-5 h-5 text-primary" />;
        }
        // For 'auto', show icon based on actual active view
        return currentActiveView === 'mobile' ? <MobileIcon className="w-5 h-5" /> : <DesktopIcon className="w-5 h-5" />;
    };

    const getTitle = () => {
        if (viewPreference === 'mobile-force') return t('forceMobileView');
        if (viewPreference === 'desktop-force') return t('forceDesktopView');
        return t('autoView');
    };

    return (
        <button
            onClick={cycleViewPreference}
            className={`p-2 rounded-full text-text-secondary transition-colors ${
                viewPreference === 'auto' ? 'hover:bg-base-300/50 hover:text-text-primary' : 'bg-primary/10 hover:bg-primary/20 text-primary'
            }`}
            aria-label={getTitle()}
            title={getTitle()}
        >
            {getIcon()}
        </button>
    );
};

export default ViewModeToggle;
