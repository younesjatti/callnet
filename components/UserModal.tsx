import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role, User } from '../types';
import { normalizeRole } from '../utils';
import { ROLE_AVATAR_PRESETS, getAvatarPresetsForRole, getDefaultAvatarForRole, isAgentAssignedToStore } from '../lib/avatarUtils';
import UserAvatar from './UserAvatar';
import { Headphones, Shield, ShoppingBag, Sparkles, Image as ImageIcon } from 'lucide-react';

interface UserModalProps {
    userToEdit: User | null;
    onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ userToEdit, onClose }) => {
    const { t } = useLanguage();
    const { addUser, updateUser, users } = useAuth();
    
    const isEditMode = userToEdit !== null;

    // Available client stores for assignment
    const availableClients = useMemo<User[]>(() => {
        return users.filter((u: User) => normalizeRole(u.role) === Role.Client);
    }, [users]);

    const initialAssigned = userToEdit?.assignedClientIds && userToEdit.assignedClientIds.length > 0 
        ? userToEdit.assignedClientIds 
        : (userToEdit ? [] : availableClients.map((c: User) => c.id));

    const initialRole = userToEdit?.role ? normalizeRole(userToEdit.role) : (isEditMode ? Role.Client : Role.Agent);
    const initialAvatar = userToEdit?.avatarUrl || userToEdit?.logoData || getDefaultAvatarForRole(initialRole);

    const [formData, setFormData] = useState({
        name: userToEdit?.name || '',
        email: userToEdit?.email || '',
        phone: userToEdit?.phone || '',
        avatarUrl: initialAvatar,
        password: '',
        role: initialRole,
        assignedClientIds: initialAssigned,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showPresets, setShowPresets] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            // If changing role to Agent and no stores selected, default to all stores
            if (name === 'role') {
                const normVal = normalizeRole(value);
                if (normVal === Role.Agent && prev.assignedClientIds.length === 0) {
                    next.assignedClientIds = availableClients.map((c: User) => c.id);
                }
                // If avatar is currently default or empty, switch to new role default
                if (!prev.avatarUrl || prev.avatarUrl === getDefaultAvatarForRole(prev.role)) {
                    next.avatarUrl = getDefaultAvatarForRole(normVal);
                }
            }
            return next;
        });
        if (error) setError('');
    };

    const handleSelectPreset = (url: string) => {
        setFormData(prev => ({ ...prev, avatarUrl: url }));
        setShowPresets(false);
    };

    const handleApplyDefaultAvatar = () => {
        setFormData(prev => ({ ...prev, avatarUrl: getDefaultAvatarForRole(formData.role) }));
    };

    const handleStoreToggle = (storeId: string) => {
        setFormData(prev => {
            const client = availableClients.find((c: User) => c.id === storeId);
            const isCurrentlySelected = isAgentAssignedToStore(
                { ...(userToEdit || {}), assignedClientIds: prev.assignedClientIds, role: Role.Agent } as User, 
                client || storeId, 
                availableClients
            );

            const current = new Set(prev.assignedClientIds);
            if (isCurrentlySelected) {
                current.delete(storeId);
                if (client) {
                    if (client.name) current.delete(client.name);
                    if (client.email) current.delete(client.email);
                }
            } else {
                current.add(storeId);
            }
            return { ...prev, assignedClientIds: Array.from(current) };
        });
    };

    const handleSelectAllStores = () => {
        setFormData(prev => ({
            ...prev,
            assignedClientIds: availableClients.map((c: User) => c.id)
        }));
    };

    const handleDeselectAllStores = () => {
        setFormData(prev => ({
            ...prev,
            assignedClientIds: []
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim() || !formData.email.trim() || !formData.role) {
            setError(t('userFormError') || 'Veuillez remplir tous les champs obligatoires.');
            return;
        }

        // In creation mode, if no password is provided, assign a role-based default
        let passwordToSave = formData.password.trim();
        if (!isEditMode && !passwordToSave) {
            if (formData.role === Role.Admin) passwordToSave = 'adminpass';
            else if (formData.role === Role.Manager) passwordToSave = 'managerpass';
            else if (formData.role === Role.Agent) passwordToSave = 'agentpass';
            else passwordToSave = 'storepass';
        }

        // Ensure avatar fallback if empty
        const finalAvatar = formData.avatarUrl.trim() || getDefaultAvatarForRole(formData.role);

        // For agent, save selected stores
        const finalAssigned = formData.role === Role.Agent 
            ? formData.assignedClientIds
            : [];

        setIsSubmitting(true);

        try {
            let result;
            if (isEditMode) {
                result = await updateUser(
                    {
                        id: userToEdit!.id,
                        name: formData.name.trim(),
                        email: formData.email.trim(),
                        phone: formData.phone.trim(),
                        avatarUrl: finalAvatar,
                        role: formData.role as Role,
                        assignedClientIds: finalAssigned
                    },
                    passwordToSave || undefined
                );
            } else {
                result = await addUser(
                    {
                        name: formData.name.trim(),
                        email: formData.email.trim(),
                        phone: formData.phone.trim(),
                        avatarUrl: finalAvatar,
                        role: formData.role as Role,
                        assignedClientIds: finalAssigned
                    },
                    passwordToSave
                );
            }
            
            if (result.success) {
                onClose();
            } else if (result.message) {
                 setError(t(result.message) || result.message);
            }
        } catch (e: any) {
            console.error("User Modal submission error:", e);
            setError(t(e.message) || t('userFormError') || e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputStyles = "w-full p-3 border border-base-300 rounded-xl bg-base-100 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium transition-all text-text-primary placeholder:text-text-secondary/40";

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
        >
            <div className="bg-base-200 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-base-300 my-auto">
                <form onSubmit={handleSubmit} noValidate className="flex flex-col h-full max-h-[90vh] overflow-hidden">
                    <div className="shrink-0 p-5 sm:p-6 border-b border-base-300 flex justify-between items-center bg-base-100/60">
                        <div>
                            <h2 id="user-modal-title" className="text-lg sm:text-xl font-black uppercase tracking-tight text-text-primary">
                                {isEditMode ? t('editUser') || "Modifier l'utilisateur" : t('addUser') || "Ajouter un utilisateur"}
                            </h2>
                            <p className="text-xs text-text-secondary font-medium mt-0.5">
                                {isEditMode ? "Mettez à jour les informations du profil" : "Créez un nouveau profil avec identifiants d'accès"}
                            </p>
                        </div>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            aria-label="Fermer" 
                            className="p-2 rounded-xl hover:bg-base-300 text-text-secondary transition-colors cursor-pointer"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
                                {t('userName') || "Nom d'utilisateur"} *
                            </label>
                            <input 
                                type="text" 
                                name="name" 
                                id="name" 
                                value={formData.name} 
                                onChange={handleChange} 
                                required 
                                className={inputStyles} 
                                placeholder="ex: Mehdi Benani" 
                            />
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
                                {t('email') || "Adresse Email"} *
                            </label>
                            <input 
                                type="email" 
                                name="email" 
                                id="email" 
                                value={formData.email} 
                                onChange={handleChange} 
                                required 
                                className={`${inputStyles} ${isEditMode ? 'bg-base-300/50 cursor-not-allowed opacity-80' : ''}`} 
                                readOnly={isEditMode}
                                placeholder="utilisateur@callnet.ma"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-text-secondary">
                                    {t('passwordLabel') || "Mot de passe"} {!isEditMode && "*"}
                                </label>
                                {isEditMode && (
                                    <span className="text-[10px] text-text-secondary/60 font-mono">
                                        Optionnel
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <input 
                                    type={showPassword ? 'text' : 'password'} 
                                    name="password" 
                                    id="password" 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    className={`${inputStyles} pr-11`} 
                                    placeholder={
                                        isEditMode 
                                            ? "Laisser vide pour conserver l'actuel" 
                                            : "Définir le mot de passe (ex: 123456)"
                                    } 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary/60 hover:text-text-primary transition-colors"
                                    title={showPassword ? 'Masquer' : 'Afficher'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {!isEditMode && (
                                <p className="text-[11px] text-text-secondary/60 mt-1 font-mono">
                                    💡 Si laissé vide, le mot de passe par défaut du rôle sera appliqué automatiquement.
                                </p>
                            )}
                        </div>

                        {/* Phone Field */}
                        <div>
                            <label htmlFor="phone" className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
                                Numéro de Téléphone / WhatsApp
                            </label>
                            <input 
                                type="text" 
                                name="phone" 
                                id="phone" 
                                value={formData.phone} 
                                onChange={handleChange} 
                                className={inputStyles} 
                                placeholder="+212 6 XX XX XX XX" 
                            />
                        </div>

                        {/* Role Field */}
                        <div>
                            <label htmlFor="role" className="block text-xs font-black uppercase tracking-wider text-text-secondary mb-1.5">
                                {t('role') || "Rôle du compte"} *
                            </label>
                            <select name="role" id="role" value={formData.role} onChange={handleChange} className={inputStyles}>
                                <option value={Role.Client}>{Role.Client} (Boutique E-commerce)</option>
                                <option value={Role.Agent}>{Role.Agent} (Opérateur Call Center / Téléconseiller)</option>
                                <option value={Role.Manager}>{Role.Manager} (Manager / Superviseur Call Center)</option>
                                <option value={Role.Admin}>{Role.Admin} (Administrateur Général)</option>
                            </select>
                        </div>

                        {/* Avatar Picker & Preview */}
                        <div className="bg-base-100 p-4 rounded-2xl border border-base-300 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                                    Avatar / Photo de Profil
                                </label>
                                <button
                                    type="button"
                                    onClick={handleApplyDefaultAvatar}
                                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    Avatar par défaut ({formData.role === Role.Agent ? 'Avec Casque 🎧' : formData.role})
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="shrink-0">
                                    <UserAvatar 
                                        avatarUrl={formData.avatarUrl} 
                                        name={formData.name || 'User'} 
                                        role={formData.role} 
                                        size="lg" 
                                        showRoleBadge={true} 
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <input 
                                        type="url" 
                                        name="avatarUrl" 
                                        id="avatarUrl" 
                                        value={formData.avatarUrl} 
                                        onChange={handleChange} 
                                        className={inputStyles} 
                                        placeholder="https://images.unsplash.com/..." 
                                    />
                                </div>
                            </div>

                            {/* Preset avatars by role */}
                            <div>
                                <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary mb-1.5">
                                    <span>Avatars recommandés ({formData.role === Role.Agent ? 'Agents avec casque' : formData.role}) :</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPresets(!showPresets)}
                                        className="text-primary hover:underline cursor-pointer"
                                    >
                                        {showPresets ? 'Masquer' : 'Voir tout'}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto py-1">
                                    {getAvatarPresetsForRole(formData.role).map((preset, idx) => (
                                        <button
                                            key={preset.id || idx}
                                            type="button"
                                            onClick={() => handleSelectPreset(preset.url)}
                                            className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                                                formData.avatarUrl === preset.url 
                                                    ? 'border-primary ring-2 ring-primary/40 scale-105' 
                                                    : 'border-base-300 hover:border-primary/60 opacity-80 hover:opacity-100'
                                            }`}
                                            title={preset.name}
                                        >
                                            <img 
                                                src={preset.url} 
                                                alt={preset.name} 
                                                className="w-full h-full object-cover" 
                                                referrerPolicy="no-referrer"
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Store assignment for Agent */}
                        {formData.role === Role.Agent && (
                            <div className="p-4 rounded-2xl bg-base-100 border border-base-300 space-y-3 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-text-primary">
                                            {t('assignClients') || "Boutiques assignées"} *
                                        </label>
                                        <p className="text-[11px] text-text-secondary font-medium mt-0.5">
                                            Sélectionnez les boutiques dont cet agent gère les commandes
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                        <button
                                            type="button"
                                            onClick={handleSelectAllStores}
                                            className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
                                        >
                                            {t('assignAll') || "Tout"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeselectAllStores}
                                            className="px-2 py-0.5 rounded-lg bg-base-300 text-text-secondary font-bold hover:bg-base-300/80 transition-colors"
                                        >
                                            {t('unassignAll') || "Aucun"}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {availableClients.map((client: User) => {
                                        const isSelected = isAgentAssignedToStore(
                                            { ...(userToEdit || {}), assignedClientIds: formData.assignedClientIds, role: Role.Agent } as User,
                                            client,
                                            availableClients
                                        );
                                        return (
                                            <label
                                                key={client.id}
                                                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all text-xs font-bold ${
                                                    isSelected
                                                        ? 'bg-primary/10 border-primary/30 text-primary'
                                                        : 'bg-base-200/50 border-base-300 text-text-secondary hover:border-primary/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 truncate">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleStoreToggle(client.id)}
                                                        className="h-4 w-4 rounded border-base-300 text-primary focus:ring-primary cursor-pointer"
                                                    />
                                                    <span className="truncate">{client.name || client.email}</span>
                                                </div>
                                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-base-100 text-text-secondary border border-base-300">
                                                    {client.id}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>

                                {formData.assignedClientIds.length === 0 && (
                                    <p className="text-[11px] text-amber-500 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                                        ⚠️ Si aucune boutique n'est sélectionnée, toutes les boutiques disponibles seront affectées par défaut pour permettre à l'agent de travailler.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {error && (
                        <div className="shrink-0 mx-5 sm:mx-6 my-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}
                    
                    <div className="shrink-0 p-4 bg-base-100/60 border-t border-base-300 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSubmitting}
                            className="py-2.5 px-5 rounded-xl bg-base-300 hover:bg-base-300/80 text-text-primary font-bold text-sm transition-colors cursor-pointer"
                        >
                            {t('cancel') || "Annuler"}
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="py-2.5 px-5 rounded-xl bg-primary hover:bg-opacity-90 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Enregistrement...
                                </>
                            ) : (
                                <span>{t('saveUser') || "Enregistrer"}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
