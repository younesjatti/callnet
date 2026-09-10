import React, { useState, useEffect, useMemo } from 'react';
import { 
    LayoutDashboard, 
    ShoppingCart, 
    Headphones, 
    Truck, 
    Store as StoreIcon, 
    Users, 
    Database, 
    Settings, 
    LogOut,
    Building2,
    Package,
    MessageSquare,
    X,
    ChevronDown,
    ChevronRight,
    UserCheck,
    Circle,
    Plug,
    Send,
    Smartphone
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../contexts/AuthContext';
import { Order, OrderStatus, Role } from '../types';
import { normalizeRole } from '../utils';
import UserAvatar from './UserAvatar';
import { LogoIcon } from './icons/LogoIcon';

export type View = 'dashboard' | 'orders' | 'order-entry' | 'customers' | 'expeditions' | 'livraison' | 'users' | 'database' | 'settings' | 'stores' | 'store' | 'callcenter' | 'products' | 'messages' | 'manager' | 'tracking' | 'whatsapp';

interface SidebarProps {
    currentView: View;
    setView: (view: View) => void;
    pendingOrdersCount?: number;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
    currentStatusFilter?: string;
    onSelectStatusFilter?: (status: string) => void;
    orders?: Order[];
}

interface NavItem {
    id: View;
    label: string;
    icon: React.ReactNode;
    roles: Role[];
    badge?: number;
    category: 'main' | 'operations' | 'admin';
    hasSubMenu?: boolean;
    isIntegrationsGroup?: boolean;
    subGroupItems?: { id: View; label: string; icon: React.ReactNode }[];
}

export interface StatusSubItem {
    id: string;
    label: string;
    dotColor: string;
}

const ORDER_SUB_ITEMS: StatusSubItem[] = [
    { id: 'All', label: 'Toutes les commandes', dotColor: '#94A3B8' },
    { id: OrderStatus.EnAttend, label: 'En cours de confirmation', dotColor: '#F59E0B' },
    { id: OrderStatus.Confirme, label: 'Confirmé', dotColor: '#10B981' },
    { id: 'pas_de_reponse', label: 'Pas de réponse', dotColor: '#F97316' },
    { id: 'injoignable', label: 'Injoignable', dotColor: '#A855F7' },
    { id: OrderStatus.Expider, label: 'Expédié', dotColor: '#2563EB' },
    { id: OrderStatus.Annule, label: 'Annulé', dotColor: '#EF4444' },
];

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    setView, 
    pendingOrdersCount = 0,
    isMobileOpen = false,
    onCloseMobile,
    currentStatusFilter = 'All',
    onSelectStatusFilter,
    orders = []
}) => {
    const { t } = useLanguage();
    const { currentUser, logout } = useAuth();
    const [isOrdersSubmenuOpen, setIsOrdersSubmenuOpen] = useState(true);
    const [isIntegrationsSubmenuOpen, setIsIntegrationsSubmenuOpen] = useState(true);

    const shippedOrdersCount = useMemo(() => {
        if (!orders || orders.length === 0) return 0;
        return orders.filter(o => {
            const s = String(o.status || '').toLowerCase().trim();
            return (
                s === OrderStatus.Expider ||
                s === OrderStatus.Expedie ||
                s === 'expedie' ||
                s === 'expédié' ||
                s === 'expider' ||
                Boolean(o.trackingNumber && o.trackingNumber.trim() !== '') ||
                Boolean(o.shippedAt) ||
                Boolean(o.courierStatus && o.courierStatus.trim() !== '')
            );
        }).length;
    }, [orders]);

    const confirmedOrdersToShipCount = useMemo(() => {
        if (!orders || orders.length === 0) return 0;
        return orders.filter(o => {
            if (o.archived) return false;
            const s = String(o.status || '').toLowerCase().trim();
            const isConfirmed = s.includes('confir') || s === OrderStatus.Confirme;
            const hasTracking = Boolean(o.trackingNumber && o.trackingNumber.trim() !== '');
            const isShipped = s.includes('expid') || s.includes('exped') || hasTracking;
            return isConfirmed && !isShipped;
        }).length;
    }, [orders]);

    useEffect(() => {
        if (currentView === 'orders' || currentView === 'callcenter' || currentView === 'tracking' || currentView === 'order-entry') {
            setIsOrdersSubmenuOpen(true);
        }
        if (currentView === 'store' || currentView === 'stores' || currentView === 'expeditions' || currentView === 'livraison') {
            setIsIntegrationsSubmenuOpen(true);
        }
    }, [currentView]);

    const getSubItemCount = (subId: string): number => {
        if (!orders || orders.length === 0) return 0;
        if (subId === 'All') return orders.length;
        if (subId === 'pas_de_reponse') {
            return orders.filter(o => String(o.status || '').startsWith('pas de rep')).length;
        }
        if (subId === 'injoignable') {
            return orders.filter(o => String(o.status || '').startsWith('injoignable')).length;
        }
        return orders.filter(o => o.status === subId).length;
    };

    const navItems: NavItem[] = [
        { 
            id: 'dashboard', 
            label: t('dashboard') || 'Tableau de Bord', 
            icon: <LayoutDashboard className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager, Role.Client, Role.Agent],
            category: 'main'
        },
        { 
            id: 'manager', 
            label: 'Supervision & Opérateurs', 
            icon: <UserCheck className="w-4 h-4" />, 
            roles: [Role.Manager, Role.Admin],
            category: 'operations'
        },
        { 
            id: 'callcenter', 
            label: t('callCenterOrders') || 'Call Center', 
            icon: <Headphones className="w-4 h-4" />, 
            roles: [Role.Agent, Role.Manager],
            badge: pendingOrdersCount,
            category: 'operations',
            hasSubMenu: true
        },
        { 
            id: 'orders', 
            label: t('orders') || 'Commandes', 
            icon: <ShoppingCart className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager, Role.Client, Role.Agent],
            badge: pendingOrdersCount,
            category: 'operations',
            hasSubMenu: true
        },
        { 
            id: 'order-entry', 
            label: t('orderEntry') || 'Saisie des commandes', 
            icon: <Send className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager, Role.Client, Role.Agent],
            badge: confirmedOrdersToShipCount,
            category: 'operations'
        },
        { 
            id: 'tracking', 
            label: t('tracking') || 'Suivi des Colis', 
            icon: <Truck className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager, Role.Client, Role.Agent],
            badge: shippedOrdersCount,
            category: 'operations'
        },
        { 
            id: 'products', 
            label: t('products') || 'Produits & Scripts', 
            icon: <Package className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager, Role.Client, Role.Agent],
            category: 'operations'
        },
        { 
            id: 'customers', 
            label: t('customers') || 'Base Clients (Marketing)', 
            icon: <Users className="w-4 h-4" />, 
            roles: [Role.Client, Role.Manager, Role.Admin],
            category: 'operations'
        },
        { 
            id: 'store', 
            label: 'Intégrations', 
            icon: <Plug className="w-4 h-4" />, 
            roles: [Role.Client, Role.Admin, Role.Manager],
            category: 'operations',
            hasSubMenu: true,
            isIntegrationsGroup: true,
            subGroupItems: [
                { id: 'store', label: 'Boutiques', icon: <StoreIcon className="w-3.5 h-3.5" /> },
                { id: 'whatsapp', label: 'WhatsApp IA (QR Code)', icon: <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> },
                { id: 'expeditions', label: 'Sociétés de Livraison', icon: <Truck className="w-3.5 h-3.5" /> }
            ]
        },
        { 
            id: 'whatsapp', 
            label: 'WhatsApp IA (Auto)', 
            icon: <Smartphone className="w-4 h-4 text-emerald-500" />, 
            roles: [Role.Client, Role.Admin, Role.Manager, Role.Agent],
            category: 'operations'
        },
        { 
            id: 'messages', 
            label: 'Messagerie Interne', 
            icon: <MessageSquare className="w-4 h-4" />, 
            roles: [Role.Manager, Role.Client, Role.Agent],
            category: 'operations'
        },
        { 
            id: 'stores', 
            label: t('stores') || 'Toutes les Boutiques', 
            icon: <Building2 className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager],
            category: 'admin'
        },
        { 
            id: 'users', 
            label: t('userManagement') || 'Utilisateurs & Équipes', 
            icon: <Users className="w-4 h-4" />, 
            roles: [Role.Admin],
            category: 'admin'
        },
        { 
            id: 'database', 
            label: 'Base de Données', 
            icon: <Database className="w-4 h-4 text-emerald-500" />, 
            roles: [Role.Admin],
            category: 'admin'
        },
        { 
            id: 'settings', 
            label: t('settings') || 'Paramètres', 
            icon: <Settings className="w-4 h-4" />, 
            roles: [Role.Admin, Role.Manager, Role.Client, Role.Agent],
            category: 'admin'
        },
    ];

    const availableNavItems = navItems.filter(item => currentUser && item.roles.includes(currentUser.role));

    const handleNavClick = (item: NavItem) => {
        if (item.isIntegrationsGroup) {
            setIsIntegrationsSubmenuOpen(prev => !prev);
            return;
        }
        if (item.hasSubMenu) {
            if (currentView === item.id) {
                setIsOrdersSubmenuOpen(prev => !prev);
            } else {
                setView(item.id);
                setIsOrdersSubmenuOpen(true);
                if (onCloseMobile) onCloseMobile();
            }
        } else {
            setView(item.id);
            if (onCloseMobile) onCloseMobile();
        }
    };

    const handleSubItemClick = (parentViewId: View, statusId: string) => {
        if (currentView !== parentViewId) {
            setView(parentViewId);
        }
        if (onSelectStatusFilter) {
            onSelectStatusFilter(statusId);
        }
        if (onCloseMobile) onCloseMobile();
    };

    const sidebarContent = (
        <div className="flex flex-col h-full w-full bg-base-200 border-r border-base-300 font-montserrat select-none overflow-hidden transition-colors">
            {/* Brand Logo Header */}
            <div className="flex items-center justify-between px-6 h-18 border-b border-base-300 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-300 p-1.5 flex items-center justify-center shadow-xs shrink-0">
                        <LogoIcon className="w-full h-full object-contain" />
                    </div>
                    <div className="flex items-center min-w-0 tracking-tight">
                        <span className="font-extrabold text-base text-text-primary">CALLNET</span>
                        <span className="font-extrabold text-base text-accent">.MA</span>
                    </div>
                </div>

                {onCloseMobile && (
                    <button
                        onClick={onCloseMobile}
                        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-base-300 md:hidden transition-colors shrink-0 cursor-pointer"
                        title="Fermer le menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navigation List */}
            <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary px-3 mb-3">
                    Menu
                </div>

                {availableNavItems.map(item => {
                    if (item.isIntegrationsGroup) {
                        const isChildActive = currentView === 'store' || currentView === 'stores' || currentView === 'expeditions' || currentView === 'livraison';
                        return (
                            <div key="integrations-group" className="space-y-1">
                                <button
                                    onClick={() => handleNavClick(item)}
                                    className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                                        isChildActive
                                            ? 'bg-base-300/80 text-text-primary shadow-xs'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-base-300/60'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`${isChildActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary transition-colors'}`}>
                                            {item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                    </div>

                                    <span className="p-0.5 text-text-secondary group-hover:text-text-primary transition-colors">
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isIntegrationsSubmenuOpen ? 'rotate-180 text-text-primary' : ''}`} />
                                    </span>
                                </button>

                                {/* Submenu for Integrations: Boutiques & Sociétés de Livraison */}
                                {isIntegrationsSubmenuOpen && (
                                    <div className="pl-3 pr-1 py-1 my-1 ml-4 border-l border-base-300 space-y-0.5 animate-in fade-in duration-150">
                                        <button
                                            onClick={() => {
                                                setView('store');
                                                if (onCloseMobile) onCloseMobile();
                                            }}
                                            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                                (currentView === 'store' || currentView === 'stores')
                                                    ? 'bg-accent text-white font-semibold shadow-xs'
                                                    : 'text-text-secondary hover:text-text-primary hover:bg-base-300/40'
                                            }`}
                                        >
                                            <StoreIcon className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">Boutiques</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setView('expeditions');
                                                if (onCloseMobile) onCloseMobile();
                                            }}
                                            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                                (currentView === 'expeditions' || currentView === 'livraison')
                                                    ? 'bg-accent text-white font-semibold shadow-xs'
                                                    : 'text-text-secondary hover:text-text-primary hover:bg-base-300/40'
                                            }`}
                                        >
                                            <Truck className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">Sociétés de Livraison</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const isActive = currentView === item.id;
                    const showSubMenu = item.hasSubMenu && (isActive || isOrdersSubmenuOpen);

                    return (
                        <div key={item.id} className="space-y-1">
                            <button
                                onClick={() => handleNavClick(item)}
                                className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-accent text-white shadow-xs'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-base-300/60'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`${isActive ? 'text-white' : 'text-text-secondary group-hover:text-text-primary transition-colors'}`}>
                                        {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                                                isActive
                                                    ? 'bg-white text-accent'
                                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                            }`}
                                        >
                                            {item.badge}
                                        </span>
                                    )}

                                    {item.hasSubMenu && (
                                        <span 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsOrdersSubmenuOpen(prev => !prev);
                                            }}
                                            className={`p-0.5 transition-colors ${isActive ? 'text-white/80 hover:text-white' : 'text-text-secondary hover:text-text-primary'}`}
                                        >
                                            {showSubMenu ? (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            )}
                                        </span>
                                    )}
                                </div>
                            </button>

                            {/* Submenu for Orders Statuses */}
                            {showSubMenu && (
                                <div className="pl-3 pr-1 py-1 my-1 ml-4 border-l border-base-300 space-y-0.5 animate-in fade-in duration-150">
                                    {ORDER_SUB_ITEMS.map(sub => {
                                        const isSubActive = isActive && (
                                            currentStatusFilter === sub.id || 
                                            (sub.id === 'All' && (!currentStatusFilter || currentStatusFilter === 'All'))
                                        );
                                        const count = getSubItemCount(sub.id);

                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSubItemClick(item.id, sub.id);
                                                }}
                                                className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                                    isSubActive
                                                        ? 'bg-base-300 text-text-primary font-semibold'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-base-300/40'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span 
                                                        className="w-2 h-2 rounded-full shrink-0" 
                                                        style={{ backgroundColor: sub.dotColor }}
                                                    />
                                                    <span className="truncate">{sub.label}</span>
                                                </div>
                                                {count > 0 && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                        isSubActive 
                                                            ? 'bg-accent text-white' 
                                                            : 'text-text-secondary bg-base-300/60'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {/* Dedicated Submenu Action Buttons */}
                                    <div className="pt-1.5 mt-1 border-t border-base-300 space-y-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setView('order-entry');
                                                if (onCloseMobile) onCloseMobile();
                                            }}
                                            className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                currentView === 'order-entry'
                                                    ? 'bg-accent text-white shadow-xs'
                                                    : 'text-text-primary hover:bg-base-300/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Send className={`w-3.5 h-3.5 shrink-0 ${currentView === 'order-entry' ? 'text-white' : 'text-emerald-500'}`} />
                                                <span className="truncate">{t('orderEntry') || 'Saisie des commandes'}</span>
                                            </div>
                                            {confirmedOrdersToShipCount > 0 && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                    currentView === 'order-entry'
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                }`}>
                                                    {confirmedOrdersToShipCount}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setView('tracking');
                                                if (onCloseMobile) onCloseMobile();
                                            }}
                                            className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                currentView === 'tracking'
                                                    ? 'bg-accent text-white shadow-xs'
                                                    : 'text-text-primary hover:bg-base-300/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Truck className={`w-3.5 h-3.5 shrink-0 ${currentView === 'tracking' ? 'text-white' : 'text-blue-500'}`} />
                                                <span className="truncate">{t('tracking') || 'Suivi des Colis'}</span>
                                            </div>
                                            {shippedOrdersCount > 0 && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                    currentView === 'tracking'
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                                }`}>
                                                    {shippedOrdersCount}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* User Profile & Logout Footer */}
            <div className="p-4 border-t border-base-300 bg-base-200">
                <div className="flex items-center gap-3 mb-3">
                    <UserAvatar 
                        user={currentUser} 
                        role={currentUser?.role} 
                        name={currentUser?.name} 
                        size="md" 
                        showRoleBadge={true} 
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-text-primary truncate">{currentUser?.name}</p>
                        <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                            {normalizeRole(currentUser?.role) === Role.Client ? 'Seller / Client' : normalizeRole(currentUser?.role) === Role.Admin ? 'Administrateur' : 'Téléopérateur'}
                        </p>
                    </div>
                </div>

                <div className="mb-2">
                    <PWAInstallButton className="w-full text-center" />
                </div>

                <button
                    onClick={logout}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-3 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer active:scale-98"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('logout') || 'Se déconnecter'}</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Static Sidebar */}
            <aside className="hidden md:flex w-64 xl:w-68 h-full shrink-0 flex-col overflow-hidden">
                {sidebarContent}
            </aside>

            {/* Mobile Drawer */}
            {isMobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div 
                        className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
                        onClick={onCloseMobile}
                    />
                    <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
                        {sidebarContent}
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
