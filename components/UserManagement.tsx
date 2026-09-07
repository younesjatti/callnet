import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { PlusIcon } from './icons/PlusIcon';
import UserModal from './UserModal';
import { EditIcon } from './icons/EditIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { normalizeRole } from '../utils';
import UserAvatar from './UserAvatar';
import { isAgentAssignedToStore } from '../lib/avatarUtils';
import { Headphones, Shield, ShoppingBag, Trash2, AlertTriangle } from 'lucide-react';

const UserManagement: React.FC = () => {
    const { 
        currentUser,
        users, 
        updateUserAssignments, 
        deleteUser,
        deleteAllUsers,
        refreshUsers,
        isSyncing
    } = useAuth();
    const { t } = useLanguage();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);

    // Filter clients for assignment dropdowns
    const clients = useMemo(() => {
        return users.filter(u => normalizeRole(u.role) === Role.Client);
    }, [users]);

    // Ensure ALL users are included and sorted cleanly
    const sortedUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        
        return [...users]
            .filter(u => {
                if (!u) return false;
                const normRole = normalizeRole(u.role);
                if (roleFilter !== 'ALL' && normRole !== roleFilter) return false;
                if (!q) return true;
                const nameMatch = (u.name || '').toLowerCase().includes(q);
                const emailMatch = (u.email || '').toLowerCase().includes(q);
                const phoneMatch = (u.phone || '').toLowerCase().includes(q);
                const roleMatch = normRole.toLowerCase().includes(q);
                return nameMatch || emailMatch || phoneMatch || roleMatch;
            })
            .sort((a, b) => {
                const priority = (role: any) => {
                    const r = normalizeRole(role);
                    if (r === Role.Admin) return 1;
                    if (r === Role.Manager) return 2;
                    if (r === Role.Client) return 3;
                    if (r === Role.Agent) return 4;
                    return 5;
                };
                const pDiff = priority(a.role) - priority(b.role);
                if (pDiff !== 0) return pDiff;
                return (a.name || a.email || '').localeCompare(b.name || b.email || '');
            });
    }, [users, searchQuery, roleFilter]);

    // Role stats
    const stats = useMemo(() => {
        let adminCount = 0;
        let managerCount = 0;
        let clientCount = 0;
        let agentCount = 0;
        users.forEach(u => {
            const r = normalizeRole(u.role);
            if (r === Role.Admin) adminCount++;
            else if (r === Role.Manager) managerCount++;
            else if (r === Role.Client) clientCount++;
            else if (r === Role.Agent) agentCount++;
        });
        return { total: users.length, adminCount, managerCount, clientCount, agentCount };
    }, [users]);

    const handleRefresh = async () => {
        setIsManualSyncing(true);
        try {
            await refreshUsers();
        } finally {
            setTimeout(() => setIsManualSyncing(false), 500);
        }
    };

    const handleOpenAddModal = () => {
        setUserToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };
    
    const handleAssignmentChange = (agent: User, selectedClientIds: string[]) => {
        updateUserAssignments(agent.id, selectedClientIds);
    };

    const getRoleBadge = (rawRole: any) => {
        const role = normalizeRole(rawRole);
        switch (role) {
            case Role.Admin:
                return <span className="px-3 py-1 text-xs font-black rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">{role}</span>;
            case Role.Manager:
                return <span className="px-3 py-1 text-xs font-black rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">👔 {role} (Superviseur)</span>;
            case Role.Agent:
                return <span className="px-3 py-1 text-xs font-black rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">🎧 {role} (Call Center)</span>;
            case Role.Client:
            default:
                return <span className="px-3 py-1 text-xs font-black rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">🛍️ {role}</span>;
        }
    };

    const handleDeleteAll = async () => {
        setIsDeletingAll(true);
        try {
            await deleteAllUsers();
            setShowDeleteAllModal(false);
            await refreshUsers();
        } finally {
            setIsDeletingAll(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with Title and Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-text-primary">
                        {t('usersTitle')}
                    </h2>
                    <p className="text-xs text-text-secondary font-medium">
                        Gérez les utilisateurs, rôles et affectations de boutiques enregistrés dans la base de données.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleRefresh}
                        disabled={isSyncing || isManualSyncing}
                        className="flex items-center gap-2 bg-base-200 hover:bg-base-300 border border-base-300 text-text-primary font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 text-xs uppercase tracking-wider disabled:opacity-50"
                        title="Synchroniser avec la base de données"
                    >
                        <svg className={`w-4 h-4 text-primary ${(isSyncing || isManualSyncing) ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{isSyncing || isManualSyncing ? 'Sync...' : 'Actualiser'}</span>
                    </button>
                    {currentUser?.role === Role.Admin && (
                        <button
                            onClick={() => setShowDeleteAllModal(true)}
                            disabled={isSyncing || isDeletingAll}
                            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                            title="Supprimer tous les utilisateurs sauf l'administrateur"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Supprimer Tous</span>
                        </button>
                    )}
                    <button
                        onClick={handleOpenAddModal}
                        className="flex items-center gap-2 bg-primary hover:bg-opacity-90 text-white font-black py-2.5 px-5 rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-wider"
                        aria-label={t('addUser')}
                    >
                        <PlusIcon />
                        <span>{t('addUser')}</span>
                    </button>
                </div>
            </div>

            {/* Stats summary & Quick filter cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button 
                    onClick={() => setRoleFilter('ALL')}
                    className={`p-3 rounded-2xl border text-left transition-all ${roleFilter === 'ALL' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-base-200 border-base-300 hover:border-text-secondary/30'}`}
                >
                    <span className="text-[11px] font-bold text-text-secondary block uppercase">Total Utilisateurs</span>
                    <span className="text-xl font-black text-text-primary">{stats.total}</span>
                </button>
                <button 
                    onClick={() => setRoleFilter(roleFilter === Role.Admin ? 'ALL' : Role.Admin)}
                    className={`p-3 rounded-2xl border text-left transition-all ${roleFilter === Role.Admin ? 'bg-purple-500/10 border-purple-500 shadow-sm' : 'bg-base-200 border-base-300 hover:border-purple-500/40'}`}
                >
                    <span className="text-[11px] font-bold text-purple-600 block uppercase">Administrateurs</span>
                    <span className="text-xl font-black text-text-primary">{stats.adminCount}</span>
                </button>
                <button 
                    onClick={() => setRoleFilter(roleFilter === Role.Manager ? 'ALL' : Role.Manager)}
                    className={`p-3 rounded-2xl border text-left transition-all ${roleFilter === Role.Manager ? 'bg-amber-500/10 border-amber-500 shadow-sm' : 'bg-base-200 border-base-300 hover:border-amber-500/40'}`}
                >
                    <span className="text-[11px] font-bold text-amber-600 block uppercase">Managers</span>
                    <span className="text-xl font-black text-text-primary">{stats.managerCount}</span>
                </button>
                <button 
                    onClick={() => setRoleFilter(roleFilter === Role.Client ? 'ALL' : Role.Client)}
                    className={`p-3 rounded-2xl border text-left transition-all ${roleFilter === Role.Client ? 'bg-emerald-500/10 border-emerald-500 shadow-sm' : 'bg-base-200 border-base-300 hover:border-emerald-500/40'}`}
                >
                    <span className="text-[11px] font-bold text-emerald-600 block uppercase">Boutiques</span>
                    <span className="text-xl font-black text-text-primary">{stats.clientCount}</span>
                </button>
                <button 
                    onClick={() => setRoleFilter(roleFilter === Role.Agent ? 'ALL' : Role.Agent)}
                    className={`p-3 rounded-2xl border text-left transition-all ${roleFilter === Role.Agent ? 'bg-blue-500/10 border-blue-500 shadow-sm' : 'bg-base-200 border-base-300 hover:border-blue-500/40'}`}
                >
                    <span className="text-[11px] font-bold text-blue-600 block uppercase">Agents Call Center</span>
                    <span className="text-xl font-black text-text-primary">{stats.agentCount}</span>
                </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-200 p-3 rounded-2xl border border-base-300">
                <div className="relative w-full sm:w-80">
                    <svg className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par nom, email, tél..."
                        className="w-full bg-base-100 border border-base-300 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-bold text-text-secondary">
                    <span>Affichage :</span>
                    <span className="bg-base-100 px-2.5 py-1 rounded-lg border border-base-300 text-text-primary">
                        {sortedUsers.length} sur {users.length}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-base-200 shadow-xl rounded-2xl border border-base-300 min-h-[420px] pb-32 overflow-x-auto">
                <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-base-300/60 text-text-primary uppercase text-xs">
                        <tr>
                            <th className="py-3.5 px-5 font-black tracking-wider">{t('userName')}</th>
                            <th className="py-3.5 px-5 font-black tracking-wider">{t('email')}</th>
                            <th className="py-3.5 px-5 font-black tracking-wider">{t('role')}</th>
                            <th className="py-3.5 px-5 font-black tracking-wider">{t('assignments')}</th>
                            <th className="py-3.5 px-5 font-black tracking-wider text-center">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-text-secondary divide-y divide-base-300">
                        {sortedUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-text-secondary font-medium">
                                    <p className="text-sm font-bold text-text-primary">Aucun utilisateur trouvé</p>
                                    <p className="text-xs text-text-secondary/70 mt-1">
                                        {searchQuery ? 'Aucun résultat ne correspond à votre recherche.' : 'Aucun utilisateur enregistré dans la base de données.'}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            sortedUsers.map(user => {
                                const normRole = normalizeRole(user.role);
                                return (
                                    <tr key={user.id} className="hover:bg-base-100/50 transition-colors">
                                        <td className="py-4 px-5 font-bold text-text-primary">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar 
                                                    user={user} 
                                                    role={user.role} 
                                                    name={user.name} 
                                                    size="sm" 
                                                    showRoleBadge={true} 
                                                />
                                                <div>
                                                    <span className="block leading-tight">{user.name || 'Sans nom'}</span>
                                                    {user.phone ? (
                                                        <span className="text-[10px] text-text-secondary font-mono block">{user.phone}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-text-secondary/50 font-mono block">ID: {user.id}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 font-medium">
                                            <span className="font-mono text-xs">{user.email}</span>
                                        </td>
                                        <td className="py-4 px-5 font-medium">{getRoleBadge(user.role)}</td>
                                        <td className="py-4 px-5 min-w-[240px]">
                                            {normRole === Role.Agent ? (
                                                <AssignmentSelector
                                                    agent={user}
                                                    clients={clients}
                                                    onAssignmentChange={handleAssignmentChange}
                                                />
                                            ) : normRole === Role.Client ? (
                                                <span className="text-xs text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                    Boutique autonome
                                                </span>
                                            ) : (
                                                <span className="text-text-secondary/40 font-bold">—</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            {normRole !== Role.Admin && (
                                                <div className="flex justify-center items-center gap-1.5">
                                                    <button 
                                                        onClick={() => handleOpenEditModal(user)} 
                                                        className="p-2 text-text-secondary hover:text-primary rounded-xl hover:bg-base-300 transition-all" 
                                                        title={t('editUser')}
                                                    >
                                                        <EditIcon />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm(`${t('deleteUser')} : ${user.name || user.email} ?`)) {
                                                                deleteUser(user.id);
                                                            }
                                                        }}
                                                        className="p-2 text-text-secondary hover:text-secondary rounded-xl hover:bg-red-500/10 transition-all" 
                                                        title={t('deleteUser')}
                                                    >
                                                        <DeleteIcon />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {isModalOpen && (
                <UserModal
                    userToEdit={userToEdit}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            {/* Modal Confirmation - Supprimer tous les utilisateurs */}
            {showDeleteAllModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-base-100 border-2 border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-text-primary uppercase tracking-tight">
                                    Confirmation Requise
                                </h4>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                    Suppression de tous les utilisateurs
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-text-secondary leading-relaxed bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                            Êtes-vous sûr de vouloir <strong>supprimer tous les utilisateurs</strong> (agents, superviseurs, boutiques) de la base de données ? Votre compte administrateur actuel restera actif.
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteAllModal(false)}
                                disabled={isDeletingAll}
                                className="px-5 py-2.5 rounded-xl border border-base-300 font-bold text-xs text-text-primary hover:bg-base-200 transition-all cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAll}
                                disabled={isDeletingAll}
                                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-50"
                            >
                                {isDeletingAll ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Suppression en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Confirmer la suppression</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


interface AssignmentSelectorProps {
    agent: User;
    clients: User[];
    onAssignmentChange: (agent: User, selectedClientIds: string[]) => void;
}

const AssignmentSelector: React.FC<AssignmentSelectorProps> = ({ agent, clients, onAssignmentChange }) => {
    const { t } = useLanguage();
    const rawAssigned = (agent.assignedClientIds || []).map(id => String(id).trim().toLowerCase());
    const isGlobalAccess = rawAssigned.includes('all') || rawAssigned.includes('*');
    
    const assignedClients = useMemo(() => {
        if (isGlobalAccess) return clients;
        return clients.filter(c => isAgentAssignedToStore(agent, c, clients));
    }, [agent, clients, isGlobalAccess]);
    
    const [isOpen, setIsOpen] = useState(false);

    const handleCheckboxChange = (client: User, isChecked: boolean) => {
        let currentAssignedList: string[] = [];
        if (isGlobalAccess) {
            // Passer d'un accès global à une sélection explicite
            currentAssignedList = clients.map(c => c.id);
        } else {
            currentAssignedList = [...(agent.assignedClientIds || [])];
        }

        const currentAssigned = new Set(currentAssignedList.map(s => String(s).trim()));
        const cleanId = String(client.id).trim();
        const cleanName = String(client.name).trim();
        const cleanEmail = String(client.email).trim();

        if (isChecked) {
            currentAssigned.add(cleanId);
        } else {
            currentAssigned.delete(cleanId);
            currentAssigned.delete(cleanName);
            currentAssigned.delete(cleanEmail);
            // Nettoyage insensible à la casse
            Array.from(currentAssigned).forEach(item => {
                const itemLower = item.toLowerCase();
                if (itemLower === cleanId.toLowerCase() || itemLower === cleanName.toLowerCase() || itemLower === cleanEmail.toLowerCase()) {
                    currentAssigned.delete(item);
                }
            });
        }
        onAssignmentChange(agent, Array.from(currentAssigned));
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 p-2.5 border border-base-300 rounded-xl bg-base-100 hover:bg-base-300/40 transition-all text-xs font-semibold shadow-sm text-left"
            >
                <div className="truncate flex-1">
                    {isGlobalAccess ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-black text-[11px] border border-blue-500/20">
                            🌐 {t('allStores') || "Toutes les boutiques"}
                        </span>
                    ) : assignedClients.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {assignedClients.map(c => (
                                <span key={c.id} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[11px] border border-primary/20">
                                    {c.name || c.email}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-text-secondary/60 italic">{t('noClientsAssigned')}</span>
                    )}
                </div>
                <svg className={`w-4 h-4 text-text-secondary transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close when clicking outside */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    
                    {/* Popover Menu */}
                    <div className="absolute left-0 top-full mt-2 w-72 bg-base-100 border border-base-300 rounded-2xl shadow-2xl z-50 p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                         <div className="flex items-center justify-between pb-2 border-b border-base-300">
                            <div>
                                <h4 className="font-black text-xs uppercase tracking-wider text-text-primary">
                                    {t('assignClients')}
                                </h4>
                                <span className="text-[10px] font-bold text-text-secondary">
                                    {isGlobalAccess ? `${clients.length} (Global)` : `${assignedClients.length} sélectionnée(s)`}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => onAssignmentChange(agent, clients.map(c => c.id))}
                                    className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold text-[10px] hover:bg-primary/20 transition-colors"
                                >
                                    {t('assignAll') || "Tout"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onAssignmentChange(agent, [])}
                                    className="px-2 py-0.5 rounded-lg bg-base-300 text-text-secondary font-bold text-[10px] hover:bg-base-300/80 transition-colors"
                                >
                                    {t('unassignAll') || "Aucun"}
                                </button>
                            </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {clients.length === 0 ? (
                                <p className="text-xs text-text-secondary p-2 italic text-center">
                                    Aucune boutique créée
                                </p>
                            ) : (
                                clients.map(client => {
                                    const isChecked = isGlobalAccess || isAgentAssignedToStore(agent, client, clients);
                                    return (
                                        <label key={client.id} className={`flex items-center gap-3 p-2 rounded-xl hover:bg-base-200 cursor-pointer transition-colors text-xs font-bold ${isChecked ? 'bg-primary/5 text-primary' : 'text-text-primary'}`}>
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-base-300 text-primary focus:ring-primary cursor-pointer"
                                                checked={isChecked}
                                                onChange={e => handleCheckboxChange(client, e.target.checked)}
                                            />
                                            <span className="truncate">{client.name || client.email}</span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default UserManagement;
