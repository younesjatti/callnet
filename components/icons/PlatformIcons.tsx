import React from 'react';

interface IconProps {
  className?: string;
}

export const GoogleSheetsIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 87.3 115" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.9 83.3C2.4 83.3 0 81.3 0 77.9V5.4C0 2 2.4 0 5.9 0H56.5L87.2 30.7V77.9C87.2 81.3 84.8 83.3 81.3 83.3H5.9Z" fill="#1DA462"/>
    <path d="M56.5 0V30.7H87.2" fill="#188038"/>
    <path d="M60.6 62.1H26.7V52.8H60.6V45.4H26.7V36.2H60.6V45.4ZM26.7 78.8H48.1V69.5H26.7V78.8Z" fill="#FFFFFF"/>
  </svg>
);

export const ShopifyIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.78 6.46l-2.07-.63c-.05-.44-.22-1.28-.73-1.89-.9-1.07-2.31-1.12-2.73-1.12-.13 0-.25 0-.35.03-.23-.62-.73-1.13-1.42-1.42C11.53 1.03 10.45 1.15 9.7 1.7c-.89.65-1.4 1.77-1.57 2.87L5.05 5.51C4.83 5.58 4.7 5.8 4.74 6.03l2.25 15.22c.04.25.25.43.5.43h11.96c.26 0 .48-.19.51-.45l1.62-14.36c.03-.24-.13-.47-.36-.54z" fill="#95BF47"/>
    <path d="M14.28 3.82c-.38 0-1.18.06-1.82.72-.61.64-.78 1.48-.83 1.95l3.22.98c-.06-.5-.24-1.78-.57-2.39-.4-.76-1.15-1.26-2.07-1.26z" fill="#5E8E3E"/>
    <path d="M11.69 9.88c-.62-.12-1.25.2-1.45.82-.2.62.15 1.25.77 1.45l2.09.66c1.17.37 1.83 1.63 1.46 2.8-.37 1.17-1.63 1.83-2.8 1.46-.94-.3-1.54-1.15-1.53-2.12" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const YouCanIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#E6007E"/>
    <path d="M8 10L14 18V24H18V18L24 10H19.5L16 15.2L12.5 10H8Z" fill="#FFFFFF"/>
  </svg>
);

export const StoreepIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#0066FF"/>
    <path d="M8 11C8 9.89543 8.89543 9 10 9H22C23.1046 9 24 9.89543 24 11V21C24 22.1046 23.1046 23 22 23H10C8.89543 23 8 22.1046 8 21V11Z" fill="#FFFFFF" fillOpacity="0.2"/>
    <path d="M12 13H20M12 16H20M12 19H16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const WoocommerceIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#96588A"/>
    <path d="M6 10C6 8.89543 6.89543 8 8 8H24C25.1046 8 26 8.89543 26 10V18C26 21.3137 23.3137 24 20 24H12L8 26V24H8C6.89543 24 6 23.1046 6 22V10Z" fill="#FFFFFF"/>
    <text x="16" y="17" fill="#96588A" fontSize="9" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">WOO</text>
  </svg>
);

export const LightfunnelsIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#0F172A"/>
    <path d="M16 6L25 12V20L16 26L7 20V12L16 6Z" fill="#2563EB"/>
    <path d="M16 6L25 12L16 18L7 12L16 6Z" fill="#3B82F6"/>
    <path d="M16 18V26L25 20V12L16 18Z" fill="#EF4444"/>
  </svg>
);

export const StoreinoIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" fill="#0088FF"/>
    <path d="M19.5 11C18.8 10.4 17.8 10 16.5 10C13.5 10 12 11.8 12 14C12 18 20 16.5 20 20C20 22 18.2 23 16 23C14 23 12.8 22.2 12 21.4" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

export const EasyOrdersIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#10B981"/>
    <path d="M10 16L15 21L23 11" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ApiIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#1E293B"/>
    <path d="M8 12L12 16L8 20M14 20H20" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const MagentoIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 4L26 10V22L16 28L6 22V10L16 4Z" fill="#F26322"/>
    <path d="M16 8L22 11.5V19.5L19 18V13.5L16 11.8L13 13.5V18L10 19.5V11.5L16 8Z" fill="#FFFFFF"/>
    <path d="M14.5 17L16 16L17.5 17V23L16 24L14.5 23V17Z" fill="#FFFFFF"/>
  </svg>
);
