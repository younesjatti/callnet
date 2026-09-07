

import React from 'react';

// Define an interface for the props
interface PlusIconProps {
  className?: string;
}

// Added className prop to match usage in LivraisonView and prevent IntrinsicAttributes error
export const PlusIcon: React.FC<PlusIconProps> = ({ className = "h-5 w-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
);