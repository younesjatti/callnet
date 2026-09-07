import React, { useState, useRef, useEffect } from 'react';
import { 
    Search, 
    RefreshCw, 
    Database, 
    Store as StoreIcon, 
    ChevronDown, 
    Check, 
    ShieldCheck, 
    Headphones, 
    ShoppingBag, 
    LogOut, 
    Bell,
    Menu,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role, User } from '../types';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import UserAvatar from './UserAvatar';

interface HeaderProps {
    currentView: string;
    onViewChange: (view: any) => void;
    onSync: () => Promise<void> | void;
    isSyncing: boolean;
    syncStatus: 'synced' | 'syncing' | 'error';
    adminSelectedStoreId: string | null;
    onSelectStore: (storeId: string | null) => void;
    onToggleMobileMenu?: () => void;
    onOpenGlobalSearch?: () => void;
    searchQuery?: string;
    onSearchChange?: (q: string) => void;
    totalOrdersCount?: number;
    pendingOrdersCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
    currentView,
    onViewChange,
    onSync,
    isSyncing,
    syncStatus,
    adminSelectedStoreId,
    onSelectStore,
    onToggleMobileMenu,
    searchQuery = '',
    onSearchChange,
    pendingOrdersCount = 0
}) => {
    const { currentUser, users, logout } = useAuth();
    const { t } = useLanguage();
    const [storeMenuOpen, setStoreMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const storeDropdownRef = useRef<HTMLDivElement>(null);
    const userDropdownRef = useRef<HTMLDivElement>(null);

    const clientStores = users.filter(u => u.role === Role.Client);
    const activeStore = clientStores.find(s => s.id === adminSelectedStoreId);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
                setStoreMenuOpen(false);
            }
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getRoleBadge = (role: Role) => {
        switch (role) {
            case Role.Admin:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Admin
                    </span>
                );
            case Role.Manager:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        Manager
                    </span>
                );
            case Role.Agent:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Headphones className="w-3 h-3" />
                        Téléopérateur
                    </span>
                );
            case Role.Client:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <ShoppingBag className="w-3 h-3" />
                        Boutique
                    </span>
                );
        }
    };

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-base-200/90 backdrop-blur-md border-b border-base-300 transition-colors">
            {/* Left: Mobile menu toggle + Context Title & Breadcrumbs */}
            <div className="flex items-center gap-3 md:gap-4">
                {onToggleMobileMenu && (
                    <button
                        onClick={onToggleMobileMenu}
                        className="p-2 -ml-2 rounded text-text-secondary hover:text-text-primary hover:bg-base-300/50 md:hidden transition-colors"
                        title="Ouvrir le menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}

                <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-secondary">
                        Node / Management
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <h2 className="font-syne font-extrabold text-base md:text-lg text-text-primary uppercase tracking-tight">
                            {currentView === 'dashboard' ? 'Tableau de Bord' :
                             currentView === 'manager' ? 'Supervision & Opérateurs' :
                             currentView === 'orders' ? 'Gestion des Commandes' :
                             currentView === 'callcenter' ? 'Centre d\'Appels' :
                             currentView === 'livraison' ? 'Livraisons & Transporteurs' :
                             currentView === 'stores' ? 'Boutiques Partenaires' :
                             currentView === 'store' ? 'Intégration Boutique' :
                             currentView === 'users' ? 'Gestion des Équipes' :
                             currentView === 'database' ? 'Base de Données (Supabase)' :
                             currentView === 'messages' ? 'Messagerie Interne' :
                             currentView === 'products' ? 'Produits & Scripts' :
                             currentView === 'settings' ? 'Paramètres' : currentView}
                        </h2>

                        {pendingOrdersCount > 0 && (
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 uppercase">
                                ● {pendingOrdersCount} en attente
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Middle: Store Switcher for Admin/Manager & Search Bar */}
            <div className="hidden lg:flex items-center gap-3 max-w-md w-full mx-4">
                {/* Store Selector (for Admin or Manager with multiple stores) */}
                {(currentUser?.role === Role.Admin || currentUser?.role === Role.Manager) && (
                    <div className="relative" ref={storeDropdownRef}>
                        <button
                            onClick={() => setStoreMenuOpen(!storeMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-base-100 hover:bg-base-300/60 border border-base-300 rounded-xl text-xs font-bold text-text-primary transition-all shadow-sm"
                        >
                            <StoreIcon className="w-3.5 h-3.5 text-primary" />
                            <span className="max-w-[120px] truncate">
                                {activeStore ? activeStore.name : 'Toutes les boutiques'}
                            </span>
                            <ChevronDown className="w-3 h-3 text-text-secondary" />
                        </button>

                        {storeMenuOpen && (
                            <div className="absolute left-0 mt-2 w-64 bg-base-200 border border-base-300 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-text-secondary border-b border-base-300">
                                    Filtrer par boutique
                                </div>
                                <button
                                    onClick={() => {
                                        onSelectStore(null);
                                        setStoreMenuOpen(false);
                                    }}
                                    className={`flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-left hover:bg-base-300/50 transition-colors ${
                                        !adminSelectedStoreId ? 'text-primary bg-primary/10' : 'text-text-primary'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <StoreIcon className="w-3.5 h-3.5" />
                                        Toutes les boutiques
                                    </span>
                                    {!adminSelectedStoreId && <Check className="w-3.5 h-3.5 text-primary" />}
                                </button>
                                {clientStores.map(store => (
                                    <button
                                        key={store.id}
                                        onClick={() => {
                                            onSelectStore(store.id);
                                            setStoreMenuOpen(false);
                                        }}
                                        className={`flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-left hover:bg-base-300/50 transition-colors ${
                                            adminSelectedStoreId === store.id ? 'text-primary bg-primary/10' : 'text-text-primary'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {store.logoData ? (
                                                <img src={store.logoData} alt="" className="w-4 h-4 rounded object-contain" />
                                            ) : (
                                                <div className="w-4 h-4 rounded bg-primary/20 text-primary flex items-center justify-center text-[9px] font-black">
                                                    {store.name.charAt(0)}
                                                </div>
                                            )}
                                            <span className="truncate">{store.name}</span>
                                        </div>
                                        {adminSelectedStoreId === store.id && <Check className="w-3.5 h-3.5 text-primary" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Search */}
                {onSearchChange && (
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Recherche client, tél, ID..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-base-100 border border-base-300 rounded-xl text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                    </div>
                )}
            </div>

            {/* Right: Cloud SQL Status + Sync Button + Theme + Lang + User Profile */}
            <div className="flex items-center gap-2 md:gap-3">
                {/* Supabase Live Status Indicator */}
                <button
                    onClick={() => onViewChange('database')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-base-100 hover:bg-base-300/60 border border-base-300 rounded-xl text-[11px] font-bold text-text-secondary hover:text-text-primary transition-all shadow-sm"
                    title="Statut de la base Supabase (PostgreSQL)"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <Database className="w-3 h-3 text-emerald-500" />
                    <span className="font-mono text-[10px]">Supabase</span>
                </button>

                {/* Live Sync Trigger */}
                <button
                    onClick={() => onSync()}
                    disabled={isSyncing}
                    className={`p-2 rounded-xl border border-base-300 bg-base-100 hover:bg-base-300/60 text-text-secondary hover:text-text-primary transition-all shadow-sm ${
                        isSyncing ? 'cursor-wait opacity-80' : ''
                    }`}
                    title="Actualiser les commandes"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                </button>

                <div className="hidden sm:flex items-center gap-1">
                    <ThemeToggle />
                    <LanguageSelector />
                </div>

                {/* User Dropdown */}
                <div className="relative" ref={userDropdownRef}>
                    <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-base-100 hover:bg-base-300/60 border border-base-300 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                        <UserAvatar 
                            user={currentUser} 
                            role={currentUser?.role} 
                            name={currentUser?.name} 
                            size="sm" 
                            showRoleBadge={true} 
                        />
                        <div className="hidden md:flex flex-col text-left">
                            <span className="text-xs font-bold text-text-primary max-w-[120px] truncate leading-tight">
                                {currentUser?.name}
                            </span>
                            <span className="text-[10px] text-text-secondary font-medium truncate">
                                {currentUser?.email}
                            </span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-text-secondary hidden sm:block" />
                    </button>

                    {userMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-base-200 border border-base-300 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="px-4 py-3 border-b border-base-300 flex items-center gap-3">
                                <UserAvatar 
                                    user={currentUser} 
                                    role={currentUser?.role} 
                                    name={currentUser?.name} 
                                    size="md" 
                                    showRoleBadge={true} 
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-text-primary truncate">{currentUser?.name}</p>
                                    <p className="text-[11px] text-text-secondary truncate mt-0.5">{currentUser?.email}</p>
                                    <div className="mt-1">
                                        {currentUser && getRoleBadge(currentUser.role)}
                                    </div>
                                </div>
                            </div>

                            <div className="py-1">
                                {currentUser?.role === Role.Client && (
                                    <button
                                        onClick={() => {
                                            onViewChange('store');
                                            setUserMenuOpen(false);
                                        }}
                                        className="flex items-center gap-2.5 w-full px-4 py-2 text-xs font-bold text-text-primary hover:bg-base-300/50 transition-colors"
                                    >
                                        <ShoppingBag className="w-4 h-4 text-primary" />
                                        Configuration Boutique
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        onViewChange('settings');
                                        setUserMenuOpen(false);
                                    }}
                                    className="flex items-center gap-2.5 w-full px-4 py-2 text-xs font-bold text-text-primary hover:bg-base-300/50 transition-colors"
                                >
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Paramètres du Compte
                                </button>
                            </div>

                            <div className="pt-1 border-t border-base-300">
                                <button
                                    onClick={logout}
                                    className="flex items-center gap-2.5 w-full px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Se déconnecter
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
