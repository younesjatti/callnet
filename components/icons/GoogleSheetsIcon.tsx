

import React from 'react';

interface GoogleSheetsIconProps {
  className?: string;
}

export const GoogleSheetsIcon: React.FC<GoogleSheetsIconProps> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 87.3 115" fill="none">
        <path d="M5.9 83.3C2.4 83.3 0 81.3 0 77.9V5.4C0 2 2.4 0 5.9 0H56.5L87.2 30.7V77.9C87.2 81.3 84.8 83.3 81.3 83.3H5.9Z" fill="#1DA462"/>
        <path d="M56.5 0V30.7H87.2" fill="#188038"/>
        <path d="M60.6 62.1H26.7V52.8H60.6V45.4H26.7V36.2H60.6V45.4ZM26.7 78.8H48.1V69.5H26.7V78.8Z" fill="#FFFFFF"/>
    </svg>
);