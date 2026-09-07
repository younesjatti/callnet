
import React from 'react';

interface DesktopIconProps {
  className?: string;
}

export const DesktopIcon: React.FC<DesktopIconProps> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9.75 15H8.25L8.25 17H6.75V15H5.25V17L3 17V7L21 7V17H18.75V15H17.25V17H15.75V15H14.25V17L12 17V15H10.5V17L9.75 17Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5V7H21Z" />
    </svg>
);
