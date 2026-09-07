
import React from 'react';

interface StatCardProps {
    title: string;
    value: string;
    description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description }) => {
    return (
        <div className="bg-base-200/80 border border-base-300 p-5 rounded-[4px] shadow-sm relative overflow-hidden group hover:border-accent/50 transition-all">
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-accent/40 rounded-none"></div>
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-secondary">{title}</h3>
            <p className="text-3xl font-syne font-extrabold text-text-primary mt-2 tracking-tight">{value}</p>
            {description && <p className="text-[11px] font-mono text-text-secondary mt-1">{description}</p>}
        </div>
    );
};

export default StatCard;
