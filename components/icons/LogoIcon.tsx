import React, { useState } from 'react';

export const CALLNET_MAIN_LOGO = 'https://ywycwjkkjmlxrwohkgas.supabase.co/storage/v1/object/public/callnet%20assets/logo_whit_bg-removebg-preview.png';

interface LogoIconProps {
  className?: string;
  alt?: string;
}

export const LogoIcon: React.FC<LogoIconProps> = ({ 
  className = 'w-6 h-6', 
  alt = 'Callnet' 
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <svg viewBox="0 0 68 68" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path
          d="M 54,14 A 28 28 0 1 0 24 57"
          fill="none"
          stroke="#65B32E"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path d="M 24 57 L 42 62 L 34 46 Z" fill="#65B32E" />
        <path
          d="M 48,22 A 16 16 0 1 1 24 46"
          fill="none"
          stroke="#EF4444"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path d="M 24 46 L 16 32 L 32 36 Z" fill="#EF4444" />
        <circle cx="33" cy="34" r="3" fill="#65B32E" />
        <circle cx="41" cy="34" r="3" fill="#65B32E" />
        <circle cx="49" cy="34" r="3" fill="#65B32E" />
      </svg>
    );
  }

  return (
    <img
      src={CALLNET_MAIN_LOGO}
      alt={alt}
      className={`object-contain inline-block ${className}`}
      onError={() => setHasError(true)}
      referrerPolicy="no-referrer"
    />
  );
};
