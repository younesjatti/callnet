import React, { useState } from 'react';
import { Role, User } from '../types';
import { normalizeRole } from '../utils';
import { resolveUserAvatar } from '../lib/avatarUtils';
import { Headphones, Shield, ShoppingBag, User as UserIcon } from 'lucide-react';

interface UserAvatarProps {
    user?: Partial<User> | null;
    role?: Role | string;
    name?: string;
    avatarUrl?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    showRoleBadge?: boolean;
    showStatusDot?: boolean;
    className?: string;
    alt?: string;
}

const SIZE_MAP = {
    xs: { container: 'w-6 h-6 text-[10px]', icon: 'w-3 h-3', badge: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5', dot: 'w-1.5 h-1.5' },
    sm: { container: 'w-8 h-8 text-xs', icon: 'w-4 h-4', badge: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5', dot: 'w-2 h-2' },
    md: { container: 'w-10 h-10 text-sm', icon: 'w-5 h-5', badge: 'w-4 h-4 -bottom-1 -right-1', dot: 'w-2.5 h-2.5' },
    lg: { container: 'w-12 h-12 text-base', icon: 'w-6 h-6', badge: 'w-4.5 h-4.5 -bottom-1 -right-1', dot: 'w-3 h-3' },
    xl: { container: 'w-16 h-16 text-xl', icon: 'w-8 h-8', badge: 'w-5 h-5 -bottom-1 -right-1', dot: 'w-3.5 h-3.5' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
    user,
    role: explicitRole,
    name: explicitName,
    avatarUrl: explicitAvatar,
    size = 'md',
    showRoleBadge = false,
    showStatusDot = false,
    className = '',
    alt
}) => {
    const role = normalizeRole(explicitRole || user?.role);
    const name = explicitName || user?.name || user?.email || 'Utilisateur';
    const resolvedUrl = explicitAvatar || resolveUserAvatar(user || { role, name });
    const [imageError, setImageError] = useState(false);

    const dims = SIZE_MAP[size] || SIZE_MAP.md;

    // Role specific colors & icons for fallback
    const isAgent = role === Role.Agent;
    const isClient = role === Role.Client;
    const isAdmin = role === Role.Admin;

    const bgGradient = isAgent
        ? 'from-[#3C50E0] to-[#5065F6] text-white'
        : isClient
        ? 'from-amber-500 to-amber-600 text-white'
        : 'from-slate-700 to-slate-900 text-white';

    const renderFallbackIcon = () => {
        if (isAgent) return <Headphones className={dims.icon} />;
        if (isClient) return <ShoppingBag className={dims.icon} />;
        if (isAdmin) return <Shield className={dims.icon} />;
        return <UserIcon className={dims.icon} />;
    };

    return (
        <div className={`relative inline-flex shrink-0 ${className}`}>
            <div 
                className={`${dims.container} rounded-full overflow-hidden border-2 border-base-300 shadow-sm bg-gradient-to-tr ${bgGradient} flex items-center justify-center font-bold select-none`}
            >
                {!imageError && resolvedUrl ? (
                    <img 
                        src={resolvedUrl} 
                        alt={alt || name} 
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="flex items-center justify-center w-full h-full">
                        {renderFallbackIcon()}
                    </div>
                )}
            </div>

            {/* Optional Role Badge (e.g., Mini Headset for Agent) */}
            {showRoleBadge && (
                <div 
                    className={`absolute ${dims.badge} rounded-full flex items-center justify-center p-0.5 border border-white dark:border-slate-800 shadow-sm ${
                        isAgent ? 'bg-[#3C50E0] text-white' : isClient ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'
                    }`}
                    title={isAgent ? 'Agent de confirmation (Casque)' : isClient ? 'Boutique Client' : 'Administrateur'}
                >
                    {isAgent ? (
                        <Headphones className="w-full h-full" />
                    ) : isClient ? (
                        <ShoppingBag className="w-full h-full" />
                    ) : (
                        <Shield className="w-full h-full" />
                    )}
                </div>
            )}

            {/* Optional Live Status Dot */}
            {showStatusDot && (
                <span 
                    className={`absolute bottom-0 right-0 ${dims.dot} bg-emerald-500 border-2 border-base-100 rounded-full`} 
                    title="En ligne & actif" 
                />
            )}
        </div>
    );
};

export default UserAvatar;
