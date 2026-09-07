import React from 'react';

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        <path d="M9.5 9.5c.3-.3.8-.3 1.1 0l1.2 1.2c.3.3.3.8 0 1.1l-.6.6c-.2.2-.2.5-.1.8.4.9 1.1 1.6 2 2 .3.1.6.1.8-.1l.6-.6c.3-.3.8-.3 1.1 0l1.2 1.2c.3.3.3.8 0 1.1l-.8.8c-.6.6-1.5.8-2.3.4-2.5-1.1-4.5-3.1-5.6-5.6-.4-.8-.2-1.7.4-2.3l.8-.8z" fill="currentColor" stroke="none" />
    </svg>
);
