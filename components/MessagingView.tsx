import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Send, 
    MessageSquare, 
    Search, 
    Check, 
    CheckCheck, 
    User, 
    Store as StoreIcon, 
    Headphones, 
    Shield, 
    Package, 
    RefreshCw, 
    Trash2, 
    X,
    Sparkles,
    ChevronRight,
    ArrowLeft,
    Users,
    Info,
    CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PlatformMessage, Role, Order, User as UserType } from '../types';
import { db } from '../lib/db';

interface MessagingViewProps {
    orders?: Order[];
    onOrderClick?: (order: Order) => void;
    initialSelectedStoreId?: string;
    initialOrderRefId?: string;
}

export const MessagingView: React.FC<MessagingViewProps> = ({
    orders = [],
    onOrderClick,
    initialSelectedStoreId,
    initialOrderRefId
}) => {
    const { currentUser, users } = useAuth();
    const { t } = useLanguage();

    const [messages, setMessages] = useState<PlatformMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [inputContent, setInputContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrderRef, setSelectedOrderRef] = useState<string>(initialOrderRefId || '');
    const [showOrderSelector, setShowOrderSelector] = useState(false);
    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [mobileActiveThread, setMobileActiveThread] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // List of stores / channels accessible for the current user
    // Rule:
    // - Client: ONLY their own store
    // - Agent: ONLY client stores assigned to them
    // - Admin: All client stores
    const clientStores = useMemo(() => {
        if (!users || !currentUser) return [];
        if (currentUser.role === Role.Client) {
            return users.filter(u => u.role === Role.Client && u.id === currentUser.id);
        }
        if (currentUser.role === Role.Agent) {
            const assignedIds = Array.isArray(currentUser.assignedClientIds) ? currentUser.assignedClientIds : [];
            return users.filter(u => u.role === Role.Client && assignedIds.includes(u.id));
        }
        // Admin sees all client stores
        return users.filter(u => u.role === Role.Client);
    }, [users, currentUser]);

    // Current active store ID
    const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
        if (currentUser?.role === Role.Client) {
            return currentUser.id;
        }
        if (initialSelectedStoreId) {
            return initialSelectedStoreId;
        }
        return clientStores[0]?.id || 'store-1';
    });

    // Keep selectedStoreId in sync with permitted stores
    useEffect(() => {
        if (currentUser?.role === Role.Client) {
            setSelectedStoreId(currentUser.id);
        } else if (clientStores.length > 0 && !clientStores.some(s => s.id === selectedStoreId)) {
            setSelectedStoreId(clientStores[0].id);
        }
    }, [currentUser, clientStores, selectedStoreId]);

    const activeStore = useMemo(() => {
        if (currentUser?.role === Role.Client) {
            return currentUser;
        }
        return clientStores.find(s => s.id === selectedStoreId) || clientStores[0] || {
            id: selectedStoreId || 'store-1',
            name: 'Boutique E-commerce',
            email: 'store@callnet.ma',
            role: Role.Client
        };
    }, [clientStores, selectedStoreId, currentUser]);

    // Assigned confirmation agents for this store
    const storeAgents = useMemo(() => {
        if (!users || !selectedStoreId) return [];
        return users.filter(u => 
            u.role === Role.Agent && 
            Array.isArray(u.assignedClientIds) && 
            u.assignedClientIds.includes(selectedStoreId)
        );
    }, [users, selectedStoreId]);

    // Admin team members (always present for support)
    const storeAdmins = useMemo(() => {
        if (!users) return [];
        return users.filter(u => u.role === Role.Admin);
    }, [users]);

    // Fetch messages for current store
    const fetchMessages = async (silent = false) => {
        if (!selectedStoreId) return;
        if (!silent) setIsLoading(true);
        try {
            const data = await db.messages.getAll({ storeId: selectedStoreId });
            setMessages(data);

            // Mark unread as read for current user
            if (currentUser && data.length > 0) {
                const unreadForUser = data.filter(m => !m.readBy?.includes(currentUser.id)).map(m => m.id);
                if (unreadForUser.length > 0) {
                    await db.messages.markRead({ messageIds: unreadForUser, storeId: selectedStoreId });
                }
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(() => {
            fetchMessages(true);
        }, 6000);
        return () => clearInterval(interval);
    }, [selectedStoreId, currentUser?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedStoreId]);

    // Filtered orders for this store (for linking to messages)
    const storeOrders = useMemo(() => {
        return orders.filter(o => !o.archived && (!o.clientId || o.clientId === selectedStoreId));
    }, [orders, selectedStoreId]);

    // Role-specific quick reply shortcuts
    const quickReplies = useMemo(() => {
        if (currentUser?.role === Role.Client) {
            return [
                "Bonjour, pourriez-vous relancer ce client svp ?",
                "Le stock de ce produit est réapprovisionné.",
                "Client demande l'heure exacte de livraison.",
                "Merci d'accorder une remise de 10% si besoin.",
                "Adresse corrigée par le client."
            ];
        } else if (currentUser?.role === Role.Agent) {
            return [
                "Client injoignable après 3 tentatives d'appel aujourd'hui.",
                "Commande confirmée avec succès ! Programmée pour expédition.",
                "Le client demande un report de livraison.",
                "Numéro erroné, pouvez-vous vérifier avec le client ?",
                "Variante / taille modifiée à la demande du client."
            ];
        } else {
            return [
                "Message de l'administration CallNet : équipe à votre disposition.",
                "Mise à jour des règles de confirmation effectuée.",
                "Support CallNet : suivi en cours."
            ];
        }
    }, [currentUser?.role]);

    // Filtered messages
    const filteredMessages = useMemo(() => {
        return messages.filter(msg => {
            const matchesStore = msg.storeId === selectedStoreId || msg.conversationId === selectedStoreId;
            if (!matchesStore) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                msg.content.toLowerCase().includes(q) ||
                msg.senderName.toLowerCase().includes(q) ||
                (msg.orderRefId && msg.orderRefId.toLowerCase().includes(q)) ||
                (msg.orderCustomerName && msg.orderCustomerName.toLowerCase().includes(q))
            );
        });
    }, [messages, selectedStoreId, searchQuery]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputContent.trim() || isSending || !currentUser) return;

        setIsSending(true);
        const selectedOrder = storeOrders.find(o => o.id === selectedOrderRef);

        const newMsgPayload: Partial<PlatformMessage> = {
            conversationId: selectedStoreId,
            storeId: selectedStoreId,
            storeName: activeStore.name,
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderRole: currentUser.role,
            senderAvatar: currentUser.avatarUrl || currentUser.logoData || undefined,
            content: inputContent.trim(),
            orderRefId: selectedOrderRef || undefined,
            orderCustomerName: selectedOrder ? selectedOrder.customerName : undefined,
            readBy: [currentUser.id]
        };

        try {
            const created = await db.messages.create(newMsgPayload);
            setMessages(prev => [...prev, created]);
            setInputContent('');
            setSelectedOrderRef('');
            setShowOrderSelector(false);
            if (inputRef.current) inputRef.current.focus();
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (window.confirm("Voulez-vous supprimer ce message ?")) {
            await db.messages.delete(msgId);
            setMessages(prev => prev.filter(m => m.id !== msgId));
        }
    };

    const getRoleBadge = (role: Role) => {
        switch (role) {
            case Role.Admin:
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        <Shield className="w-2.5 h-2.5" /> Admin
                    </span>
                );
            case Role.Agent:
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-[#3C50E0] dark:text-blue-400 border border-blue-500/20">
                        <Headphones className="w-2.5 h-2.5" /> Agent Confirmateur
                    </span>
                );
            case Role.Client:
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <StoreIcon className="w-2.5 h-2.5" /> Boutique
                    </span>
                );
        }
    };

    return (
        <div className="flex-1 min-h-0 w-full flex flex-col bg-base-200 overflow-hidden animate-in fade-in duration-200">
            {/* Main Chat Layout */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Channels / Interlocutors Sidebar */}
                <div className={`w-full md:w-64 lg:w-72 border-r border-base-300 bg-base-100 flex flex-col min-h-0 overflow-hidden shrink-0 ${mobileActiveThread ? 'hidden md:flex' : 'flex'}`}>
                    {/* Search inside conversation */}
                    <div className="p-2.5 border-b border-base-300 shrink-0">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filtrer les messages..."
                                className="w-full pl-8 pr-2.5 py-1.5 bg-base-200 border border-base-300 rounded-[4px] text-xs text-text-primary placeholder:text-text-secondary focus:border-[#3C50E0] outline-none font-mono"
                            />
                        </div>
                    </div>

                    {/* Section Label */}
                    <div className="px-3 py-2 border-b border-base-300 bg-base-200/50 flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                            {currentUser?.role === Role.Client 
                                ? "Membres de la Discussion" 
                                : currentUser?.role === Role.Agent
                                    ? "Mes Boutiques Assignées"
                                    : "Boutiques Clients"}
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono">
                            {currentUser?.role === Role.Client ? `${storeAgents.length + storeAdmins.length} membres` : `${clientStores.length} canaux`}
                        </span>
                    </div>

                    {/* Store or Team list */}
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-base-300">
                        {currentUser?.role === Role.Client ? (
                            /* Client View: List of assigned agents and admins communicating in this space */
                            <div className="p-3 space-y-3">
                                {/* Active Store Identity Card */}
                                <div className="p-3 bg-[#3C50E0]/5 border border-[#3C50E0]/20 rounded-[4px]">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold border border-emerald-500/30 shrink-0">
                                            {activeStore.avatarUrl || activeStore.logoData ? (
                                                <img src={(activeStore.avatarUrl || activeStore.logoData) || undefined} alt={activeStore.name} className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <StoreIcon className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-xs font-bold text-text-primary truncate">{activeStore.name}</h4>
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Canal Actif & Connecté
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Assigned Agents Section */}
                                <div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase mb-2">
                                        <Headphones className="w-3 h-3 text-[#3C50E0]" />
                                        <span>Vos Agents Confirmateurs Dédiés</span>
                                    </div>
                                    {storeAgents.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {storeAgents.map(ag => (
                                                <div key={ag.id} className="p-2 bg-base-200/70 border border-base-300 rounded-[4px] flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="relative shrink-0">
                                                            <div className="w-7 h-7 rounded-full bg-[#3C50E0]/10 text-[#3C50E0] font-bold flex items-center justify-center text-xs overflow-hidden border border-base-300">
                                                                {ag.avatarUrl || ag.logoData ? (
                                                                    <img src={(ag.avatarUrl || ag.logoData) || undefined} alt={ag.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span>{ag.name ? ag.name.charAt(0).toUpperCase() : 'A'}</span>
                                                                )}
                                                            </div>
                                                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-base-100" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-text-primary truncate">{ag.name}</div>
                                                            <div className="text-[10px] text-text-secondary truncate font-mono">{ag.email}</div>
                                                        </div>
                                                    </div>
                                                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-[#3C50E0] text-[9px] font-bold rounded">
                                                        Assigné
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-[4px] text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                                            <div className="font-bold flex items-center gap-1">
                                                <Info className="w-3.5 h-3.5" /> En cours d'affectation
                                            </div>
                                            <p className="text-[10px] leading-tight opacity-90">
                                                L'administrateur CallNet assignera un téléopérateur à votre boutique sous peu. Vos messages sont directement reçus et traités par l'administration.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* CallNet Admins Section */}
                                <div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase mb-2">
                                        <Shield className="w-3 h-3 text-purple-500" />
                                        <span>Supervision & Administration</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {storeAdmins.map(adm => (
                                            <div key={adm.id} className="p-2 bg-base-200/50 border border-base-300 rounded-[4px] flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 font-bold flex items-center justify-center text-xs overflow-hidden border border-purple-500/20 shrink-0">
                                                        {adm.avatarUrl || adm.logoData ? (
                                                            <img src={(adm.avatarUrl || adm.logoData) || undefined} alt={adm.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{adm.name ? adm.name.charAt(0).toUpperCase() : 'A'}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-text-primary truncate">{adm.name}</div>
                                                        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Administration CallNet</div>
                                                    </div>
                                                </div>
                                                <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-600 text-[9px] font-bold rounded">
                                                    Support
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-2 bg-base-200 border border-base-300 rounded-[4px] text-[10px] text-text-secondary flex items-start gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>
                                        Tous vos échanges ici sont sécurisés et partagés exclusivement avec vos téléopérateurs dédiés et l'administration CallNet.
                                    </span>
                                </div>
                            </div>
                        ) : (
                            /* Admin & Agent View: Store Channel Selectors */
                            clientStores.map(store => {
                                const isSelected = store.id === selectedStoreId;
                                const storeMsgs = messages.filter(m => m.storeId === store.id || m.conversationId === store.id);
                                const lastMsg = storeMsgs[storeMsgs.length - 1];
                                const unreadCount = storeMsgs.filter(m => currentUser && !m.readBy?.includes(currentUser.id)).length;

                                return (
                                    <button
                                        key={store.id}
                                        onClick={() => {
                                            setSelectedStoreId(store.id);
                                            setMobileActiveThread(true);
                                        }}
                                        className={`w-full text-left p-2.5 transition-all flex items-start gap-2.5 hover:bg-base-200 cursor-pointer ${
                                            isSelected ? 'bg-[#3C50E0]/10 border-l-3 border-[#3C50E0]' : ''
                                        }`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center font-bold text-text-primary overflow-hidden border border-base-300 text-xs">
                                                {store.avatarUrl || store.logoData ? (
                                                    <img src={(store.avatarUrl || store.logoData) || undefined} alt={store.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <StoreIcon className="w-4 h-4 text-text-secondary" />
                                                )}
                                            </div>
                                            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-base-100" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <h4 className="text-xs font-bold text-text-primary truncate">
                                                    {store.name}
                                                </h4>
                                                {lastMsg && (
                                                    <span className="text-[9px] text-text-secondary whitespace-nowrap font-mono">
                                                        {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-[11px] text-text-secondary truncate flex items-center gap-1">
                                                {lastMsg ? (
                                                    <>
                                                        <span className="font-semibold text-text-primary truncate shrink-0">
                                                            {lastMsg.senderId === currentUser?.id ? 'Vous: ' : `${lastMsg.senderName.split(' ')[0]}: `}
                                                        </span>
                                                        <span className="truncate">{lastMsg.content}</span>
                                                    </>
                                                ) : (
                                                    <span className="italic text-text-muted">Aucun message</span>
                                                )}
                                            </div>

                                            {unreadCount > 0 && (
                                                <div className="mt-1">
                                                    <span className="px-1.5 py-0.2 bg-[#3C50E0] text-white text-[9px] font-bold rounded-full">
                                                        {unreadCount} new
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}

                        {!isLoading && clientStores.length === 0 && currentUser?.role !== Role.Client && (
                            <div className="p-4 text-center text-xs text-text-secondary space-y-2">
                                <Users className="w-6 h-6 mx-auto text-text-secondary opacity-50" />
                                <p className="font-bold">Aucune boutique assignée</p>
                                <p className="text-[11px]">
                                    L'administrateur doit vous assigner des boutiques pour activer vos canaux de messagerie.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Conversation Box */}
                <div className={`flex-1 min-h-0 flex flex-col bg-base-200 overflow-hidden ${mobileActiveThread ? 'flex' : 'hidden md:flex'}`}>
                    {/* Active Channel Top Bar */}
                    <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-base-100 border-b border-base-300 flex items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button 
                                onClick={() => setMobileActiveThread(false)}
                                className="md:hidden p-1 hover:bg-base-200 rounded text-text-primary shrink-0"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div className="w-7 h-7 rounded-full bg-[#3C50E0]/10 text-[#3C50E0] flex items-center justify-center font-bold text-xs shrink-0">
                                <StoreIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5 truncate">
                                    <span className="truncate">{activeStore.name}</span>
                                    <span className="text-[9px] text-emerald-500 font-semibold flex items-center gap-1 shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> En Ligne
                                    </span>
                                </h3>
                                <p className="text-[10px] text-text-secondary truncate">
                                    {storeAgents.length > 0 ? (
                                        <span>{storeAgents.map(a => a.name).join(', ')} • CallNet Support</span>
                                    ) : (
                                        <span>Support CallNet actif</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Top Bar Actions: Refresh & Order Link */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button 
                                onClick={() => fetchMessages()} 
                                disabled={isLoading}
                                className="px-2 py-1 bg-base-200 hover:bg-base-300 border border-base-300 rounded-[4px] text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Actualiser les messages"
                            >
                                <RefreshCw className={`w-3 h-3 text-[#3C50E0] ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline text-[11px]">Actualiser</span>
                            </button>

                            {/* Order Link Badge Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowOrderSelector(!showOrderSelector)}
                                    className={`px-2 py-1 border rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        selectedOrderRef 
                                            ? 'bg-[#3C50E0]/10 border-[#3C50E0] text-[#3C50E0]' 
                                            : 'bg-base-200 hover:bg-base-300 border-base-300 text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    <Package className="w-3 h-3" />
                                    <span className="font-mono text-[11px]">{selectedOrderRef ? `#${selectedOrderRef}` : 'Lier commande'}</span>
                                    {selectedOrderRef && (
                                        <span 
                                            onClick={(e) => { e.stopPropagation(); setSelectedOrderRef(''); }}
                                            className="ml-0.5 hover:text-red-500 cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </span>
                                    )}
                                </button>

                            {/* Dropdown Order Selector */}
                            {showOrderSelector && (
                                <div className="absolute right-0 top-full mt-1.5 w-72 bg-base-100 border border-base-300 rounded-[4px] shadow-xl p-2 z-50 animate-in fade-in duration-150">
                                    <div className="mb-2">
                                        <input 
                                            type="text"
                                            value={orderSearchTerm}
                                            onChange={(e) => setOrderSearchTerm(e.target.value)}
                                            placeholder="Rechercher nom client ou ID..."
                                            className="w-full px-2 py-1 bg-base-200 border border-base-300 rounded text-xs text-text-primary outline-none focus:border-[#3C50E0]"
                                        />
                                    </div>
                                    <div className="max-h-44 overflow-y-auto custom-scrollbar divide-y divide-base-300">
                                        {storeOrders
                                            .filter(o => !orderSearchTerm || o.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase()) || o.id.toLowerCase().includes(orderSearchTerm.toLowerCase()))
                                            .slice(0, 15)
                                            .map(order => (
                                                <button
                                                    key={order.id}
                                                    onClick={() => {
                                                        setSelectedOrderRef(order.id);
                                                        setShowOrderSelector(false);
                                                    }}
                                                    className="w-full text-left p-1.5 hover:bg-base-200 text-xs transition-colors rounded cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between font-bold text-text-primary">
                                                        <span className="font-mono">#{order.id}</span>
                                                        <span className="text-[#3C50E0] font-mono">{order.price} DH</span>
                                                    </div>
                                                    <div className="text-[10px] text-text-secondary truncate">{order.customerName} • {order.product}</div>
                                                </button>
                                            ))}
                                        {storeOrders.length === 0 && (
                                            <div className="p-3 text-center text-xs text-text-secondary">Aucune commande</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages Body */}
                    <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto custom-scrollbar space-y-3">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-text-secondary gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin text-[#3C50E0]" />
                                <span className="text-xs font-semibold">Synchronisation des messages...</span>
                            </div>
                        ) : filteredMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                                <div className="w-12 h-12 rounded-full bg-base-300 flex items-center justify-center text-text-secondary mx-auto">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <h4 className="text-xs sm:text-sm font-bold text-text-primary">
                                    {currentUser?.role === Role.Client 
                                        ? "Bienvenue sur votre messagerie dédiée" 
                                        : "Canal de communication prêt"}
                                </h4>
                                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                                    {currentUser?.role === Role.Client
                                        ? "Écrivez ici pour poser vos questions à vos agents confirmateurs, donner des consignes sur les commandes ou échanger avec l'administration CallNet."
                                        : "Communiquez les statuts d'appels, les reports ou les remarques directement à la boutique."}
                                </p>
                            </div>
                        ) : (
                            filteredMessages.map((msg) => {
                                const isMe = msg.senderId === currentUser?.id;
                                const relatedOrder = orders.find(o => o.id === msg.orderRefId);

                                return (
                                    <div 
                                        key={msg.id}
                                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                                    >
                                        <div className={`flex items-start gap-2 max-w-[90%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {/* Avatar */}
                                            <div className="w-7 h-7 rounded-full bg-base-300 shrink-0 flex items-center justify-center font-bold text-[11px] text-text-primary overflow-hidden border border-base-300 mt-1">
                                                {msg.senderAvatar ? (
                                                    <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-3.5 h-3.5 text-text-secondary" />
                                                )}
                                            </div>

                                            {/* Bubble Container */}
                                            <div className="flex flex-col min-w-0">
                                                {/* Header meta */}
                                                <div className={`flex items-center gap-1.5 mb-1 text-[10px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    <span className="font-bold text-text-primary">{isMe ? 'Vous' : msg.senderName}</span>
                                                    {getRoleBadge(msg.senderRole)}
                                                    <span className="text-text-secondary font-mono text-[9px]">
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Bubble Body */}
                                                <div 
                                                    className={`p-2.5 sm:p-3 rounded-[4px] shadow-2xs text-xs leading-relaxed ${
                                                        isMe 
                                                            ? 'bg-[#3C50E0] text-white rounded-tr-none' 
                                                            : 'bg-base-100 text-text-primary border border-base-300 rounded-tl-none'
                                                    }`}
                                                >
                                                    {/* Order Attachment Box inside message */}
                                                    {msg.orderRefId && (
                                                        <div 
                                                            onClick={() => relatedOrder && onOrderClick && onOrderClick(relatedOrder)}
                                                            className={`mb-2 p-1.5 rounded-[3px] border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                                                isMe 
                                                                    ? 'bg-white/15 border-white/25 hover:bg-white/25 text-white' 
                                                                    : 'bg-base-200 border-base-300 hover:bg-base-300 text-text-primary'
                                                            }`}
                                                            title="Voir la commande"
                                                        >
                                                            <div className="flex items-center gap-1.5 truncate">
                                                                <Package className="w-3.5 h-3.5 shrink-0" />
                                                                <div className="truncate font-mono text-[11px]">
                                                                    <span className="font-bold">Commande #{msg.orderRefId}</span>
                                                                    {msg.orderCustomerName && (
                                                                        <span className="opacity-80 ml-1">({msg.orderCustomerName})</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                                        </div>
                                                    )}

                                                    {/* Message Content */}
                                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                                </div>

                                                {/* Actions / Read Status */}
                                                <div className={`flex items-center gap-2 mt-0.5 text-[9px] text-text-secondary ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    {isMe && (
                                                        <div className="flex items-center gap-1">
                                                            {msg.readBy && msg.readBy.length > 1 ? (
                                                                <span className="flex items-center gap-0.5 text-blue-500 font-semibold" title="Vu par l'équipe">
                                                                    <CheckCheck className="w-3 h-3" /> Lu
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-0.5 text-text-muted" title="Envoyé">
                                                                    <Check className="w-3 h-3" /> Envoyé
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {(currentUser?.role === Role.Admin || isMe) && (
                                                        <button
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Replies Carousel */}
                    <div className="px-3 py-1 bg-base-100 border-t border-base-300 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                        <span className="text-[10px] font-bold text-text-secondary whitespace-nowrap flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#3C50E0]" /> Réponse rapide:
                        </span>
                        {quickReplies.map((reply, index) => (
                            <button
                                key={index}
                                onClick={() => setInputContent(reply)}
                                className="px-2 py-0.5 bg-base-200 hover:bg-base-300 border border-base-300 text-[10px] text-text-primary rounded-full whitespace-nowrap transition-colors cursor-pointer"
                            >
                                {reply}
                            </button>
                        ))}
                    </div>

                    {/* Message Input Box */}
                    <div className="p-2 sm:p-2.5 bg-base-100 border-t border-base-300 shrink-0">
                        {selectedOrderRef && (
                            <div className="mb-1.5 flex items-center justify-between bg-[#3C50E0]/10 border border-[#3C50E0]/30 px-2.5 py-0.5 rounded-[3px] text-xs text-[#3C50E0]">
                                <span className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                                    <Package className="w-3 h-3" /> Lié à la commande #{selectedOrderRef}
                                </span>
                                <button onClick={() => setSelectedOrderRef('')} className="hover:text-red-500 cursor-pointer">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={inputContent}
                                onChange={(e) => setInputContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    currentUser?.role === Role.Client 
                                        ? "Écrire un message à vos agents confirmateurs & l'admin... (Entrée pour envoyer)"
                                        : `Écrire un message pour ${activeStore.name}... (Entrée pour envoyer)`
                                }
                                className="flex-1 px-3 py-2 bg-base-200 border border-base-300 rounded-[4px] text-xs text-text-primary placeholder:text-text-secondary focus:border-[#3C50E0] outline-none resize-none max-h-20 min-h-[38px]"
                            />
                            <button
                                type="submit"
                                disabled={!inputContent.trim() || isSending}
                                className="h-[38px] px-3.5 bg-[#3C50E0] hover:bg-[#3243be] disabled:opacity-40 text-white rounded-[4px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Envoyer</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessagingView;
