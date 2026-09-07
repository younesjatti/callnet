import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role } from '../types';
import AdminDatabaseSettings from './AdminDatabaseSettings';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { 
    Camera, 
    Upload, 
    Link as LinkIcon, 
    Trash2, 
    Check, 
    User as UserIcon, 
    Sparkles, 
    Phone, 
    ShieldCheck, 
    ShoppingBag, 
    Headphones,
    Image as ImageIcon,
    AlertTriangle,
    Users,
    PackageX,
    Database,
    RefreshCw
} from 'lucide-react';
import { getDefaultAvatarForRole, ROLE_AVATAR_PRESETS } from '../lib/avatarUtils';
import { normalizeRole } from '../utils';
import { db } from '../lib/db';

interface SettingsProps {
    initialTab?: 'profile' | 'database';
}

const PRESET_AVATARS = [
    {
        name: 'Agent Téléconseillère avec Casque',
        url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80',
        category: 'agent'
    },
    {
        name: 'Agent Support Casque Pro',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        category: 'agent'
    },
    {
        name: 'Agent Confirmation Casque',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        category: 'agent'
    },
    {
        name: 'Opérateur Call Center Micro-Casque',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        category: 'agent'
    },
    {
        name: 'Vendeur Élégant',
        url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80',
        category: 'client'
    },
    {
        name: 'Boutique Mode & Vêtements',
        url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        category: 'client'
    },
    {
        name: 'Boutique Cosmétiques & Beauté',
        url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
        category: 'client'
    },
    {
        name: 'Manager & Superviseur',
        url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
        category: 'admin'
    }
];

const Settings: React.FC<SettingsProps> = ({ initialTab = 'profile' }) => {
    const { currentUser, updateUser, deleteAllUsers, refreshUsers } = useAuth();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<'profile' | 'database'>(
        currentUser?.role === Role.Admin ? initialTab : 'profile'
    );

    const [profileData, setProfileData] = useState({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        avatarUrl: currentUser?.avatarUrl || currentUser?.logoData || '',
        password: '',
    });

    const [avatarTab, setAvatarTab] = useState<'upload' | 'url' | 'presets'>('upload');
    const [customUrlInput, setCustomUrlInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Database Cleanup State
    const [isDeletingOrders, setIsDeletingOrders] = useState(false);
    const [isDeletingUsers, setIsDeletingUsers] = useState(false);
    const [showConfirmOrdersModal, setShowConfirmOrdersModal] = useState(false);
    const [showConfirmUsersModal, setShowConfirmUsersModal] = useState(false);
    const [dangerFeedback, setDangerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handleDeleteAllOrders = async () => {
        setIsDeletingOrders(true);
        setDangerFeedback(null);
        try {
            await db.orders.deleteAll();
            setDangerFeedback({
                type: 'success',
                message: 'Toutes les commandes ont été supprimées avec succès de la base de données.'
            });
            setShowConfirmOrdersModal(false);
        } catch (e: any) {
            setDangerFeedback({
                type: 'error',
                message: e.message || 'Erreur lors de la suppression des commandes.'
            });
        } finally {
            setIsDeletingOrders(false);
        }
    };

    const handleDeleteAllUsers = async () => {
        setIsDeletingUsers(true);
        setDangerFeedback(null);
        try {
            const res = await deleteAllUsers();
            if (res.success) {
                setDangerFeedback({
                    type: 'success',
                    message: 'Tous les utilisateurs ont été supprimés avec succès (votre profil administrateur a été conservé).'
                });
                setShowConfirmUsersModal(false);
                await refreshUsers();
            } else {
                setDangerFeedback({
                    type: 'error',
                    message: res.message || 'Erreur lors de la suppression des utilisateurs.'
                });
            }
        } catch (e: any) {
            setDangerFeedback({
                type: 'error',
                message: e.message || 'Erreur lors de la suppression des utilisateurs.'
            });
        } finally {
            setIsDeletingUsers(false);
        }
    };

    // Update local state when currentUser changes
    React.useEffect(() => {
        if (currentUser) {
            setProfileData(prev => ({
                ...prev,
                name: currentUser.name || '',
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                avatarUrl: currentUser.avatarUrl || currentUser.logoData || '',
            }));
        }
    }, [currentUser]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setSaveFeedback({ type: 'error', message: 'Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const rawBase64 = event.target?.result as string;
            // Compress image to reasonable resolution (max 256x256)
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 256;
                const MAX_HEIGHT = 256;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                    setProfileData(prev => ({ ...prev, avatarUrl: compressedBase64 }));
                    setSaveFeedback({ type: 'success', message: 'Photo chargée ! Cliquez sur "Enregistrer les modifications" pour valider.' });
                }
            };
            img.src = rawBase64;
        };
        reader.readAsDataURL(file);
    };

    const handleApplyUrl = () => {
        if (!customUrlInput.trim()) return;
        setProfileData(prev => ({ ...prev, avatarUrl: customUrlInput.trim() }));
        setCustomUrlInput('');
        setSaveFeedback({ type: 'success', message: 'URL d\'avatar appliquée ! N\'oubliez pas d\'enregistrer.' });
    };

    const handleSelectPreset = (url: string) => {
        setProfileData(prev => ({ ...prev, avatarUrl: url }));
        setSaveFeedback({ type: 'success', message: 'Avatar sélectionné ! Cliquez sur Enregistrer pour valider.' });
    };

    const handleRemoveAvatar = () => {
        setProfileData(prev => ({ ...prev, avatarUrl: '' }));
        setSaveFeedback({ type: 'success', message: 'Avatar supprimé. Cliquez sur Enregistrer pour confirmer.' });
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        setIsSaving(true);
        setSaveFeedback(null);

        try {
            const res = await updateUser({
                id: currentUser.id,
                name: profileData.name.trim(),
                email: profileData.email.trim(),
                phone: profileData.phone.trim(),
                avatarUrl: profileData.avatarUrl,
                logoData: profileData.avatarUrl // keep in sync with legacy logoData field
            }, profileData.password ? profileData.password : undefined);

            if (res.success) {
                setSaveFeedback({ type: 'success', message: 'Profil et avatar mis à jour avec succès !' });
                setProfileData(prev => ({ ...prev, password: '' }));
            } else {
                setSaveFeedback({ type: 'error', message: res.message || 'Erreur lors de la sauvegarde.' });
            }
        } catch (err: any) {
            setSaveFeedback({ type: 'error', message: err.message || 'Erreur inattendue' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {currentUser?.role === Role.Admin && (
                <div className="flex items-center gap-3 p-1.5 bg-base-200 rounded-2xl border border-base-300 w-fit">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'profile'
                                ? 'bg-primary text-white shadow-md'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <SettingsIcon className="w-4 h-4" />
                        <span>Profil & Sécurité</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('database')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'database'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        <DatabaseIcon className="w-4 h-4" />
                        <span>Base de Données Google Sheets</span>
                    </button>
                </div>
            )}

            {activeTab === 'database' && currentUser?.role === Role.Admin ? (
                <AdminDatabaseSettings />
            ) : (
                <div className="max-w-4xl space-y-8">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-text-primary uppercase tracking-tighter">Mon Espace & Profil</h2>
                            <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-black uppercase tracking-wider">
                                {currentUser?.role === Role.Client ? 'Espace Vendeur' : currentUser?.role === Role.Agent ? 'Espace Téléopérateur' : 'Espace Administrateur'}
                            </span>
                        </div>
                        <p className="text-text-secondary font-medium">
                            Personnalisez votre avatar, coordonnées de contact et informations de sécurité.
                        </p>
                    </div>

                    {/* Feedback Alert */}
                    {saveFeedback && (
                        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in text-sm font-bold ${
                            saveFeedback.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                        }`}>
                            {saveFeedback.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <ShieldCheck className="w-5 h-5 shrink-0" />}
                            <span>{saveFeedback.message}</span>
                        </div>
                    )}

                    {/* SECTION 1: AVATAR MANAGEMENT */}
                    <div className="bg-base-200 p-6 sm:p-8 rounded-3xl shadow-sm border border-base-300 space-y-6">
                        <div className="flex items-center justify-between border-b border-base-300 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-primary" />
                                    <span>Photo de Profil & Avatar</span>
                                </h3>
                                <p className="text-xs text-text-secondary font-medium mt-0.5">
                                    Votre avatar s'affiche sur le tableau de bord, la barre supérieure et auprès de votre équipe.
                                </p>
                            </div>
                            {profileData.avatarUrl && (
                                <button
                                    type="button"
                                    onClick={handleRemoveAvatar}
                                    className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Supprimer</span>
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                            {/* Avatar Preview */}
                            <div className="flex flex-col items-center gap-3 shrink-0">
                                <div className="relative group">
                                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-base-100 shadow-xl bg-gradient-to-tr from-primary/30 to-emerald-400/30 flex items-center justify-center">
                                        {profileData.avatarUrl ? (
                                            <img 
                                                src={profileData.avatarUrl} 
                                                alt={profileData.name || 'Avatar'} 
                                                className="w-full h-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <span className="text-3xl font-black text-primary uppercase">
                                                {profileData.name ? profileData.name.charAt(0) : 'U'}
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-1 right-1 p-2 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                                        title="Changer la photo"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                </div>
                                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                                    Aperçu en direct
                                </span>
                            </div>

                            {/* Avatar Selector Modes */}
                            <div className="flex-1 w-full space-y-4">
                                <div className="flex items-center gap-2 p-1 bg-base-100 rounded-xl border border-base-300 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setAvatarTab('upload')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            avatarTab === 'upload' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Téléverser un fichier</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAvatarTab('presets')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            avatarTab === 'presets' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Avatars Suggestions</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAvatarTab('url')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            avatarTab === 'url' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <LinkIcon className="w-3.5 h-3.5" />
                                        <span>Lien URL</span>
                                    </button>
                                </div>

                                {/* Tab 1: Upload File */}
                                {avatarTab === 'upload' && (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-base-300 hover:border-primary/60 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-base-100/60 flex flex-col items-center justify-center gap-2 group"
                                    >
                                        <input 
                                            ref={fileInputRef}
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleFileUpload} 
                                            className="hidden" 
                                        />
                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        <p className="text-xs font-bold text-text-primary">
                                            Cliquez ou glissez une photo ici pour l'ajouter
                                        </p>
                                        <p className="text-[11px] text-text-secondary">
                                            JPG, PNG, GIF ou WebP (optimisé automatiquement)
                                        </p>
                                    </div>
                                )}

                                {/* Tab 2: Presets */}
                                {avatarTab === 'presets' && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-text-secondary font-medium">Sélectionnez un modèle d'avatar pré-configuré :</p>
                                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                                            {PRESET_AVATARS.map((preset, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleSelectPreset(preset.url)}
                                                    className={`relative rounded-xl overflow-hidden border-2 aspect-square group transition-all cursor-pointer ${
                                                        profileData.avatarUrl === preset.url 
                                                            ? 'border-primary ring-2 ring-primary/40 scale-105' 
                                                            : 'border-base-300 hover:border-primary/50'
                                                    }`}
                                                    title={preset.name}
                                                >
                                                    <img 
                                                        src={preset.url} 
                                                        alt={preset.name} 
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    {profileData.avatarUrl === preset.url && (
                                                        <div className="absolute inset-0 bg-primary/40 flex items-center justify-center text-white">
                                                            <Check className="w-4 h-4 stroke-[3]" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tab 3: URL */}
                                {avatarTab === 'url' && (
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            placeholder="https://exemple.com/mon-avatar.jpg"
                                            value={customUrlInput}
                                            onChange={e => setCustomUrlInput(e.target.value)}
                                            className="flex-1 p-3 border border-base-300 rounded-xl bg-base-100 text-xs font-semibold focus:ring-2 focus:ring-primary outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleApplyUrl}
                                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-opacity-90 transition-all cursor-pointer"
                                        >
                                            Appliquer
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: PERSONAL INFORMATION & SECURITY */}
                    <div className="bg-base-200 p-6 sm:p-8 rounded-3xl shadow-sm border border-base-300">
                        <form onSubmit={handleProfileSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-text-secondary mb-1.5 uppercase tracking-wider">
                                        Nom de la Boutique / Nom Complet *
                                    </label>
                                    <div className="relative">
                                        <UserIcon className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input 
                                            type="text" 
                                            value={profileData.name} 
                                            onChange={e => setProfileData({...profileData, name: e.target.value})} 
                                            className="w-full pl-10 pr-3.5 py-3 border border-base-300 rounded-2xl bg-base-100 focus:ring-2 focus:ring-primary outline-none font-bold text-sm" 
                                            placeholder="Nom ou enseigne"
                                            required 
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-text-secondary mb-1.5 uppercase tracking-wider">
                                        Numéro de Téléphone / WhatsApp
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input 
                                            type="text" 
                                            value={profileData.phone} 
                                            onChange={e => setProfileData({...profileData, phone: e.target.value})} 
                                            className="w-full pl-10 pr-3.5 py-3 border border-base-300 rounded-2xl bg-base-100 focus:ring-2 focus:ring-primary outline-none font-bold text-sm" 
                                            placeholder="+212 6 XX XX XX XX"
                                        />
                                    </div>
                                    <p className="text-[10px] text-text-secondary mt-1">Facilite la coordination directe avec vos téléopérateurs dédiés.</p>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-text-secondary mb-1.5 uppercase tracking-wider">
                                        Email de Connexion (Identifiant)
                                    </label>
                                    <input 
                                        type="email" 
                                        value={profileData.email} 
                                        disabled 
                                        className="w-full p-3.5 border border-base-300 rounded-2xl bg-base-100 opacity-60 cursor-not-allowed font-bold text-sm" 
                                    />
                                    <p className="text-[10px] text-text-secondary mt-1">L'adresse email sert d'identifiant unique et ne peut être modifiée que par l'administrateur.</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-base-300">
                                <label className="block text-xs font-black text-text-secondary mb-1.5 uppercase tracking-wider">
                                    Nouveau mot de passe (Optionnel)
                                </label>
                                <input 
                                    type="password" 
                                    value={profileData.password} 
                                    onChange={e => setProfileData({...profileData, password: e.target.value})} 
                                    className="w-full p-3.5 border border-base-300 rounded-2xl bg-base-100 focus:ring-2 focus:ring-primary outline-none text-sm" 
                                    placeholder="••••••••" 
                                />
                                <p className="text-[10px] text-text-secondary mt-1.5">Laissez vide si vous ne souhaitez pas modifier votre mot de passe actuel.</p>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-base-300">
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-8 py-3.5 bg-primary text-white rounded-2xl font-black hover:bg-opacity-90 shadow-xl transition-all active:scale-95 uppercase tracking-tight flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Enregistrement...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Enregistrer les modifications</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Account Status Badge */}
                    <div className="bg-gradient-to-br from-indigo-600 via-primary to-emerald-600 p-8 rounded-3xl text-white shadow-xl overflow-hidden relative group">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight mb-1 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5" />
                                    <span>Statut & Sécurité du Compte</span>
                                </h3>
                                <p className="text-sm font-medium opacity-90">
                                    Compte actif • Synchronisation temps réel avec la base centralisée CallNet.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-4 py-1.5 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md border border-white/20">
                                    {currentUser?.role}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: ADMIN DANGER ZONE - PURGE DATA */}
                    {currentUser?.role === Role.Admin && (
                        <div className="bg-rose-500/5 dark:bg-rose-950/20 border-2 border-rose-500/30 rounded-3xl p-6 sm:p-8 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight">
                                            Zone d'Administration Avancée // Purge de la Base de Données
                                        </h3>
                                        <p className="text-xs text-text-secondary font-medium">
                                            Actions irréversibles de nettoyage et réinitialisation des données sur Cloud SQL et le serveur central.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {dangerFeedback && (
                                <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold animate-in fade-in ${
                                    dangerFeedback.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                                }`}>
                                    {dangerFeedback.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                                    <span>{dangerFeedback.message}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Bouton 1: Supprimer toutes les commandes */}
                                <div className="p-5 bg-base-100 rounded-2xl border border-rose-500/20 flex flex-col justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm uppercase tracking-wide">
                                            <PackageX className="w-4 h-4" />
                                            <span>Supprimer Toutes les Commandes</span>
                                        </div>
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Vide l'intégralité de la table des commandes sur Cloud SQL PostgreSQL et la mémoire serveur. Les comptes utilisateurs et boutiques restent intacts.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmOrdersModal(true)}
                                        disabled={isDeletingOrders}
                                        className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Supprimer Toutes les Commandes</span>
                                    </button>
                                </div>

                                {/* Bouton 2: Supprimer tous les utilisateurs */}
                                <div className="p-5 bg-base-100 rounded-2xl border border-rose-500/20 flex flex-col justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm uppercase tracking-wide">
                                            <Users className="w-4 h-4" />
                                            <span>Supprimer Tous les Utilisateurs</span>
                                        </div>
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Supprime tous les comptes agents, superviseurs et boutiques de la base de données. Votre compte administrateur est automatiquement conservé.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmUsersModal(true)}
                                        disabled={isDeletingUsers}
                                        className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20 disabled:opacity-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Supprimer Tous les Utilisateurs</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Confirmation - Supprimer toutes les commandes */}
            {showConfirmOrdersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-base-100 border-2 border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-text-primary uppercase tracking-tight">
                                    Confirmation Obligatoire
                                </h4>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                    Suppression totale des commandes
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-text-secondary leading-relaxed bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                            Êtes-vous absolument sûr de vouloir <strong>supprimer définitivement toutes les commandes</strong> de la base de données ? Cette action est irréversible.
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmOrdersModal(false)}
                                disabled={isDeletingOrders}
                                className="px-5 py-2.5 rounded-xl border border-base-300 font-bold text-xs text-text-primary hover:bg-base-200 transition-all cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAllOrders}
                                disabled={isDeletingOrders}
                                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-50"
                            >
                                {isDeletingOrders ? (
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

            {/* Modal Confirmation - Supprimer tous les utilisateurs */}
            {showConfirmUsersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-base-100 border-2 border-rose-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-text-primary uppercase tracking-tight">
                                    Confirmation Obligatoire
                                </h4>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                    Suppression de tous les utilisateurs
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-text-secondary leading-relaxed bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                            Êtes-vous absolument sûr de vouloir <strong>supprimer tous les utilisateurs</strong> (agents, superviseurs, boutiques) ? Votre compte administrateur actuel restera actif et sécurisé.
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmUsersModal(false)}
                                disabled={isDeletingUsers}
                                className="px-5 py-2.5 rounded-xl border border-base-300 font-bold text-xs text-text-primary hover:bg-base-200 transition-all cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAllUsers}
                                disabled={isDeletingUsers}
                                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-50"
                            >
                                {isDeletingUsers ? (
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

export default Settings;
