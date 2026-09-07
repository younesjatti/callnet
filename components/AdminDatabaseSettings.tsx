import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AuditLog } from '../types';
import { apiClient } from '../lib/apiClient';
import { db } from '../lib/db';
import { 
    Trash2, 
    AlertTriangle, 
    Check, 
    PackageX, 
    Users, 
    Database, 
    RefreshCw, 
    Copy, 
    ExternalLink, 
    Key, 
    CheckCircle2, 
    XCircle, 
    ShieldCheck, 
    Zap,
    BookOpen,
    Layers
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA, getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../lib/supabase';

type TabType = 'overview' | 'config' | 'setup_sql' | 'maintenance';

const AdminDatabaseSettings: React.FC = () => {
    const { currentUser, deleteAllUsers, refreshUsers } = useAuth();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState<TabType>('overview');

    // Supabase Status
    const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'testing' | 'disconnected' | 'error'>('disconnected');
    const [supabaseData, setSupabaseData] = useState<any>(null);
    const [latency, setLatency] = useState<number | null>(null);

    // Form inputs for Supabase
    const initialConfig = getSupabaseConfig();
    const [supabaseUrl, setSupabaseUrl] = useState(initialConfig.url || '');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialConfig.anonKey || '');
    const [supabaseServiceKey, setSupabaseServiceKey] = useState(initialConfig.serviceKey || '');
    const [supabaseDbUrl, setSupabaseDbUrl] = useState('');
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isTestingConfig, setIsTestingConfig] = useState(false);

    // Syncing state
    const [isSyncingData, setIsSyncingData] = useState(false);
    const [isAutoCreatingTables, setIsAutoCreatingTables] = useState(false);

    // SQL copy feedback
    const [hasCopiedSql, setHasCopiedSql] = useState(false);

    // Logs & Diagnostics
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [logFilterCategory, setLogFilterCategory] = useState<string>('all');
    const [logSearchQuery, setLogSearchQuery] = useState<string>('');
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

    // Deletion modals & loading states
    const [isDeletingOrders, setIsDeletingOrders] = useState(false);
    const [isDeletingUsers, setIsDeletingUsers] = useState(false);
    const [showConfirmOrdersModal, setShowConfirmOrdersModal] = useState(false);
    const [showConfirmUsersModal, setShowConfirmUsersModal] = useState(false);

    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
        setActionMessage({ type, text });
        setTimeout(() => setActionMessage(null), 6000);
    };

    // Refresh Supabase status from backend
    const refreshStatus = useCallback(async () => {
        try {
            const data = await apiClient.apiFetch<any>('/supabase/status');
            if (data) {
                setSupabaseData(data);
                setSupabaseStatus(data.connected ? 'connected' : (data.configured ? 'disconnected' : 'disconnected'));
                if (data.latencyMs) setLatency(data.latencyMs);
                if (data.url && !supabaseUrl) setSupabaseUrl(data.url);
            }
        } catch (_) {
            // Fallback: test client-side connection
            const clientTest = await testSupabaseConnection();
            if (clientTest.success) {
                setSupabaseStatus('connected');
                setLatency(clientTest.latencyMs || 45);
            } else {
                setSupabaseStatus('disconnected');
            }
        }
    }, [supabaseUrl]);

    // Load backend config
    const loadServerConfig = useCallback(async () => {
        try {
            const data = await apiClient.apiFetch<any>('/supabase/config');
            if (data) {
                if (data.url) setSupabaseUrl(data.url);
                if (data.anonKey) setSupabaseAnonKey(data.anonKey);
                if (data.serviceKey) setSupabaseServiceKey(data.serviceKey);
                if (data.dbUrl) setSupabaseDbUrl(data.dbUrl);
            }
        } catch (_) {}
    }, []);

    // Load Audit Logs
    const loadLogs = useCallback(async (isSilent = false) => {
        if (!isSilent) setIsRefreshingLogs(true);
        try {
            const data = await apiClient.apiFetch<{ logs: AuditLog[] }>('/database/logs');
            if (data && Array.isArray(data.logs)) {
                setLogs(data.logs);
            }
        } catch (_) {
        } finally {
            if (!isSilent) setIsRefreshingLogs(false);
        }
    }, []);

    useEffect(() => {
        refreshStatus();
        loadServerConfig();
        loadLogs(true);

        const interval = setInterval(() => {
            refreshStatus();
        }, 15000);
        return () => clearInterval(interval);
    }, [refreshStatus, loadServerConfig, loadLogs]);

    // Test connection action
    const handleTestConnection = async () => {
        setIsTestingConfig(true);
        try {
            const res = await apiClient.apiPost<any>('/supabase/test', {
                url: supabaseUrl,
                anonKey: supabaseAnonKey,
                serviceKey: supabaseServiceKey
            });

            if (res && res.success) {
                setSupabaseStatus('connected');
                setLatency(res.latencyMs || 35);
                showMessage('success', res.message || 'Connexion Supabase établie avec succès !');
                refreshStatus();
            } else {
                showMessage('error', res?.message || 'Échec du test de connexion Supabase.');
            }
        } catch (err: any) {
            // Also try client-side probe
            const clientTest = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
            if (clientTest.success) {
                setSupabaseStatus('connected');
                showMessage('success', clientTest.message);
            } else {
                showMessage('error', clientTest.message || err.message || 'Impossible de joindre le projet Supabase.');
            }
        } finally {
            setIsTestingConfig(false);
        }
    };

    // Save Supabase Configuration
    const handleSaveConfig = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSavingConfig(true);
        try {
            // Save locally
            saveSupabaseConfig({
                url: supabaseUrl.trim(),
                anonKey: supabaseAnonKey.trim(),
                serviceKey: supabaseServiceKey.trim(),
                connected: true
            });

            // Save on server
            const res = await apiClient.apiPost<any>('/supabase/config', {
                url: supabaseUrl.trim(),
                anonKey: supabaseAnonKey.trim(),
                serviceKey: supabaseServiceKey.trim(),
                dbUrl: supabaseDbUrl.trim(),
                autoSyncToSupabase: true
            });

            if (res && res.success) {
                showMessage('success', 'Configuration Supabase enregistrée ! Test de la connexion en cours...');
                await handleTestConnection();
            } else {
                showMessage('info', 'Configuration enregistrée dans le navigateur.');
            }
        } catch (err: any) {
            showMessage('error', err.message || 'Erreur lors de la sauvegarde.');
        } finally {
            setIsSavingConfig(false);
        }
    };

    // Synchronize All Data to Supabase
    const handleSyncToSupabase = async () => {
        setIsSyncingData(true);
        try {
            const res = await apiClient.apiPost<any>('/supabase/sync', {});

            if (res && res.success) {
                showMessage('success', res.message || 'Toutes les données ont été synchronisées vers Supabase !');
                refreshStatus();
                loadLogs(true);
            } else {
                showMessage('error', res?.message || 'Erreur lors de la synchronisation.');
            }
        } catch (err: any) {
            showMessage('error', err.message || 'Erreur lors de la synchronisation vers Supabase.');
        } finally {
            setIsSyncingData(false);
        }
    };

    // Auto-create Tables directly on Supabase via PostgreSQL connection
    const handleAutoCreateTables = async () => {
        if (!supabaseDbUrl && !supabaseUrl) {
            showMessage('error', 'Veuillez renseigner la chaîne de connexion PostgreSQL (URI) de votre projet Supabase ci-dessous.');
            return;
        }
        setIsAutoCreatingTables(true);
        try {
            const res = await apiClient.apiPost<any>('/supabase/auto-init-tables', {
                dbUrl: supabaseDbUrl.trim(),
                url: supabaseUrl.trim(),
                anonKey: supabaseAnonKey.trim(),
                serviceKey: supabaseServiceKey.trim()
            });

            if (res && res.success) {
                showMessage('success', res.message || 'Toutes les tables ont été créées avec succès sur Supabase !');
                setSupabaseStatus('connected');
                await refreshStatus();
                await loadLogs(true);
            } else {
                showMessage('error', res?.message || 'Erreur lors de la création automatique des tables.');
            }
        } catch (err: any) {
            showMessage('error', err.message || 'Impossible de créer les tables automatiquement. Vérifiez le mot de passe dans l’URL.');
        } finally {
            setIsAutoCreatingTables(false);
        }
    };

    // Copy SQL Script to Clipboard
    const handleCopySql = () => {
        navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
        setHasCopiedSql(true);
        showMessage('success', 'Script SQL Supabase copié dans le presse-papier !');
        setTimeout(() => setHasCopiedSql(false), 4000);
    };

    // Delete Orders
    const handleDeleteAllOrders = async () => {
        setIsDeletingOrders(true);
        try {
            await db.orders.deleteAll();
            showMessage('success', 'Toutes les commandes ont été supprimées avec succès.');
            setShowConfirmOrdersModal(false);
            refreshStatus();
            loadLogs(true);
        } catch (e: any) {
            showMessage('error', e.message || 'Erreur lors de la suppression des commandes.');
        } finally {
            setIsDeletingOrders(false);
        }
    };

    // Delete Users
    const handleDeleteAllUsers = async () => {
        setIsDeletingUsers(true);
        try {
            const res = await deleteAllUsers();
            if (res.success) {
                showMessage('success', 'Tous les utilisateurs ont été supprimés avec succès (votre profil administrateur a été conservé).');
                setShowConfirmUsersModal(false);
                await refreshUsers();
                refreshStatus();
                loadLogs(true);
            } else {
                showMessage('error', res.message || 'Erreur lors de la suppression des utilisateurs.');
            }
        } catch (e: any) {
            showMessage('error', e.message || 'Erreur lors de la suppression des utilisateurs.');
        } finally {
            setIsDeletingUsers(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesCategory = logFilterCategory === 'all' || log.category === logFilterCategory;
        const matchesSearch = !logSearchQuery || 
            (log.action && log.action.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
            (log.userEmail && log.userEmail.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
            (log.details && log.details.toLowerCase().includes(logSearchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 shadow-sm">
                        <Database className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-3xl font-black text-text-primary uppercase tracking-tighter">
                                Supabase & Base de Données
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                POSTGRESQL CLOUD
                            </span>
                        </div>
                        <p className="text-text-secondary text-sm font-medium mt-0.5">
                            Gestion centralisée du stockage persistant Supabase, réplication temps réel et synchronisation des données CallNet.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={refreshStatus}
                        className="px-4 py-2.5 bg-base-200 hover:bg-base-300 text-text-primary text-xs font-black uppercase rounded-2xl transition-all shadow-sm border border-base-300 flex items-center gap-2 cursor-pointer"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Actualiser</span>
                    </button>
                    <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                        <ExternalLink className="w-4 h-4" />
                        <span>Dashboard Supabase</span>
                    </a>
                </div>
            </div>

            {/* Notification Banner */}
            {actionMessage && (
                <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-lg animate-in fade-in duration-300 ${
                    actionMessage.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800' :
                    actionMessage.type === 'error' ? 'bg-red-950/40 text-red-400 border-red-800' :
                    'bg-blue-950/40 text-blue-400 border-blue-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : actionMessage.type === 'error' ? <XCircle className="w-5 h-5 shrink-0" /> : <Zap className="w-5 h-5 shrink-0" />}
                        <span>{actionMessage.text}</span>
                    </div>
                    <button onClick={() => setActionMessage(null)} className="opacity-60 hover:opacity-100 text-xs uppercase font-black cursor-pointer">Fermer</button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 p-1.5 bg-base-200 rounded-2xl border border-base-300 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'overview'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>Vue d'ensemble & État</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'config'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <Key className="w-4 h-4" />
                    <span>Configuration & Clés API</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('setup_sql')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'setup_sql'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>Guide & Script SQL (1-Clic)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('maintenance')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === 'maintenance'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'text-text-secondary hover:text-text-primary hover:bg-base-300'
                    }`}
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Maintenance & Purge</span>
                </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Metric KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-base-200 p-5 rounded-3xl border border-base-300 shadow-sm">
                            <div className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">Moteur Central</div>
                            <div className="text-xl font-black text-text-primary flex items-center gap-2">
                                <span className="text-emerald-500">Supabase</span>
                            </div>
                            <div className="mt-2 text-xs font-semibold text-emerald-500 flex items-center gap-1">
                                <span>●</span> PostgreSQL 15+ & Realtime
                            </div>
                        </div>

                        <div className="bg-base-200 p-5 rounded-3xl border border-base-300 shadow-sm">
                            <div className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">Utilisateurs & Boutiques</div>
                            <div className="text-2xl font-black text-text-primary">{supabaseData?.counts?.users ?? '—'}</div>
                            <div className="mt-2 text-xs font-semibold text-blue-500 flex items-center gap-1">
                                <span>●</span> Table `users`
                            </div>
                        </div>

                        <div className="bg-base-200 p-5 rounded-3xl border border-base-300 shadow-sm">
                            <div className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">Commandes Enregistrées</div>
                            <div className="text-2xl font-black text-text-primary">{supabaseData?.counts?.orders ?? '—'}</div>
                            <div className="mt-2 text-xs font-semibold text-purple-500 flex items-center gap-1">
                                <span>●</span> Table `orders`
                            </div>
                        </div>

                        <div className="bg-base-200 p-5 rounded-3xl border border-base-300 shadow-sm">
                            <div className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">État Connexion</div>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`w-3 h-3 rounded-full ${
                                    supabaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 
                                    supabaseStatus === 'testing' ? 'bg-amber-500 animate-spin' : 
                                    'bg-amber-500'
                                }`} />
                                <span className="text-base font-black text-text-primary">
                                    {supabaseStatus === 'connected' ? 'Connecté à Supabase' : 'Prêt / Standby'}
                                </span>
                            </div>
                            <div className="mt-2 text-xs font-semibold text-text-secondary">
                                Latence : {latency ? `${latency}ms` : '—'}
                            </div>
                        </div>
                    </div>

                    {/* Quick Sync & Diagnostic Card */}
                    <div className="bg-base-200 p-6 md:p-8 rounded-3xl shadow-lg border border-base-300 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-300 pb-5">
                            <div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                    <span>Synchronisation Directe avec Supabase</span>
                                </h3>
                                <p className="text-xs text-text-secondary font-medium mt-0.5">
                                    Poussez instantanément l'intégralité des utilisateurs, commandes, modèles de livraison et produits existants dans vos tables Supabase.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleSyncToSupabase}
                                disabled={isSyncingData}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                            >
                                {isSyncingData ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Synchronisation en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4" />
                                        <span>Synchroniser vers Supabase</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Schema Status Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="p-4 bg-base-100 rounded-2xl border border-base-300 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black text-text-primary">Table `users`</div>
                                    <div className="text-[11px] text-text-secondary">Comptes, boutiques, rôles</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    {supabaseData?.counts?.users ?? 0} lignes
                                </span>
                            </div>

                            <div className="p-4 bg-base-100 rounded-2xl border border-base-300 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black text-text-primary">Table `orders`</div>
                                    <div className="text-[11px] text-text-secondary">Commandes & suivis</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                    {supabaseData?.counts?.orders ?? 0} lignes
                                </span>
                            </div>

                            <div className="p-4 bg-base-100 rounded-2xl border border-base-300 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black text-text-primary">Table `products`</div>
                                    <div className="text-[11px] text-text-secondary">Catalogue et stocks</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                    {supabaseData?.counts?.products ?? 0} lignes
                                </span>
                            </div>

                            <div className="p-4 bg-base-100 rounded-2xl border border-base-300 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black text-text-primary">Table `shipping_templates`</div>
                                    <div className="text-[11px] text-text-secondary">Modèles d'export bordereaux</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    {supabaseData?.counts?.templates ?? 0} modèles
                                </span>
                            </div>

                            <div className="p-4 bg-base-100 rounded-2xl border border-base-300 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black text-text-primary">Table `platform_messages`</div>
                                    <div className="text-[11px] text-text-secondary">Messagerie interne</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    {supabaseData?.counts?.messages ?? 0} messages
                                </span>
                            </div>

                            <div className="p-4 bg-base-100 rounded-2xl border border-base-300 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black text-text-primary">Table `audit_logs`</div>
                                    <div className="text-[11px] text-text-secondary">Journal d'audit & sécurité</div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-text-secondary/10 text-text-secondary border border-text-secondary/20">
                                    {logs.length} entrées
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: CONFIGURATION */}
            {activeTab === 'config' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* AUTO SETUP 1-CLICK CARD */}
                    <div className="p-6 md:p-8 bg-gradient-to-br from-emerald-950/40 via-base-200 to-base-200 rounded-3xl border-2 border-emerald-500/30 shadow-xl space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-emerald-400 uppercase tracking-tight flex items-center gap-2">
                                        <span>Création Automatique des Tables (1-Clic)</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                                            RECOMMANDÉ
                                        </span>
                                    </h3>
                                    <p className="text-xs text-text-secondary font-medium mt-0.5">
                                        Pas besoin de copier du code SQL ! Renseignez votre chaîne de connexion PostgreSQL Supabase et l'application crée automatiquement toutes les tables pour vous.
                                    </p>
                                </div>
                            </div>

                            <a
                                href="https://supabase.com/dashboard/project/_/settings/database"
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-base-100 hover:bg-base-300 text-text-primary text-xs font-black uppercase rounded-xl transition-all border border-base-300 flex items-center gap-2 self-start md:self-auto cursor-pointer"
                            >
                                <ExternalLink className="w-4 h-4 text-emerald-500" />
                                <span>Où trouver la chaîne URI ?</span>
                            </a>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-black text-text-primary uppercase tracking-wider">
                                Chaîne de connexion PostgreSQL de votre Supabase (URI) *
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={supabaseDbUrl}
                                    onChange={(e) => setSupabaseDbUrl(e.target.value)}
                                    placeholder="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
                                    className="flex-1 px-4 py-3 bg-base-100 rounded-xl border border-base-300 text-text-primary font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner"
                                />
                                <button
                                    type="button"
                                    onClick={handleAutoCreateTables}
                                    disabled={isAutoCreatingTables || !supabaseDbUrl}
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isAutoCreatingTables ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Création en cours...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-4 h-4" />
                                            <span>⚡ Créer les tables sur Supabase</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="p-3 bg-base-100/60 rounded-xl border border-base-300 text-[11px] text-text-secondary leading-relaxed flex items-start gap-2">
                                <span className="font-bold text-emerald-500 shrink-0">Astuce :</span>
                                <span>
                                    Dans votre tableau de bord Supabase, allez dans <strong>Project Settings ➔ Database ➔ Connection string</strong>, choisissez <strong>URI</strong>, copiez la ligne et remplacez <code>[YOUR-PASSWORD]</code> par votre mot de passe Supabase.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Standard API Keys Config */}
                    <div className="bg-base-200 p-6 md:p-8 rounded-3xl shadow-lg border border-base-300 space-y-6">
                        <div className="border-b border-base-300 pb-4">
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                <Key className="w-5 h-5 text-emerald-500" />
                                <span>Paramètres de Connexion & Clés API Supabase</span>
                            </h3>
                            <p className="text-xs text-text-secondary font-medium mt-0.5">
                                Ces clés permettent au tableau de bord et à l'application de communiquer en temps réel avec Supabase.
                            </p>
                        </div>

                        <form onSubmit={handleSaveConfig} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-text-secondary uppercase tracking-wider mb-1.5">
                                    Supabase Project URL *
                                </label>
                                <input
                                    type="url"
                                    required
                                    value={supabaseUrl}
                                    onChange={(e) => setSupabaseUrl(e.target.value)}
                                    placeholder="https://votre-projet.supabase.co"
                                    className="w-full px-4 py-3 bg-base-100 rounded-xl border border-base-300 text-text-primary font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <p className="text-[11px] text-text-secondary mt-1">Exemple : https://pxkvqtcykkggpgudnohh.supabase.co</p>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-text-secondary uppercase tracking-wider mb-1.5">
                                    Supabase Anon Public Key (API Key) *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={supabaseAnonKey}
                                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    className="w-full px-4 py-2.5 bg-base-100 rounded-xl border border-base-300 text-text-primary font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <p className="text-[11px] text-text-secondary mt-1">Trouvable sous <strong>Project Settings ➔ API ➔ Project API Keys (anon public)</strong>.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-text-secondary uppercase tracking-wider mb-1.5">
                                    Supabase Service Role Key (Optionnel / Serveur)
                                </label>
                                <textarea
                                    rows={2}
                                    value={supabaseServiceKey}
                                    onChange={(e) => setSupabaseServiceKey(e.target.value)}
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Clé secrète de service)"
                                    className="w-full px-4 py-2.5 bg-base-100 rounded-xl border border-base-300 text-text-primary font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <p className="text-[11px] text-text-secondary mt-1">Optionnelle : Permet au serveur backend de contourner les politiques RLS pour les tâches d'administration.</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-base-300">
                                <button
                                    type="button"
                                    onClick={handleTestConnection}
                                    disabled={isTestingConfig || !supabaseUrl || !supabaseAnonKey}
                                    className="px-5 py-3 rounded-xl border border-base-300 font-black text-xs uppercase tracking-wider text-text-primary hover:bg-base-300 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isTestingConfig ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Zap className="w-4 h-4 text-amber-500" />
                                    )}
                                    <span>Tester la connexion</span>
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSavingConfig}
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                                >
                                    {isSavingConfig ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    <span>Enregistrer & Connecter</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 3: STEP-BY-STEP SETUP & SQL SCRIPT */}
            {activeTab === 'setup_sql' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* AUTO BANNER */}
                    <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm font-black text-text-primary">Vous préférez que l'application crée les tables automatiquement ?</div>
                                <div className="text-xs text-text-secondary">Pas besoin de copier-coller de SQL ! Passez en mode automatique 1-clic avec votre URI de connexion.</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('config')}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                            <Zap className="w-4 h-4" />
                            <span>Passer au mode 1-Clic Automatique</span>
                        </button>
                    </div>

                    {/* Setup Guide Cards */}
                    <div className="bg-base-200 p-6 md:p-8 rounded-3xl shadow-lg border border-base-300 space-y-6">
                        <div className="border-b border-base-300 pb-4">
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-emerald-500" />
                                <span>Guide d'Installation Supabase (3 Étapes Faciles)</span>
                            </h3>
                            <p className="text-xs text-text-secondary font-medium mt-0.5">
                                Suivez ces étapes simples pour configurer votre base de données Supabase gratuite en moins de 2 minutes.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-5 bg-base-100 rounded-2xl border border-base-300 space-y-2">
                                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm">1</div>
                                <div className="text-sm font-black text-text-primary">Créer le projet Supabase</div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Allez sur <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-500 underline font-bold">supabase.com</a>, connectez-vous et cliquez sur <strong>New Project</strong>. Donnez-lui un nom (ex: <code>callnet-prod</code>).
                                </p>
                            </div>

                            <div className="p-5 bg-base-100 rounded-2xl border border-base-300 space-y-2">
                                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm">2</div>
                                <div className="text-sm font-black text-text-primary">Exécuter le Script SQL</div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Dans votre menu Supabase, cliquez sur <strong>SQL Editor</strong> ➔ Cliquez sur <strong>New Query</strong> ➔ Collez le script ci-dessous ➔ Cliquez sur <strong>RUN</strong>.
                                </p>
                            </div>

                            <div className="p-5 bg-base-100 rounded-2xl border border-base-300 space-y-2">
                                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-sm">3</div>
                                <div className="text-sm font-black text-text-primary">Copier l'URL & la Clé API</div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Allez dans <strong>Project Settings &gt; API</strong>, copiez l'URL et la clé <code>anon public</code>, puis collez-les dans l'onglet <strong>Configuration</strong>.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SQL Script Box */}
                    <div className="bg-base-200 p-6 md:p-8 rounded-3xl shadow-lg border border-base-300 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-300 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                    <span>Script SQL Complet CallNet (Tables, Index & Politiques RLS)</span>
                                </h3>
                                <p className="text-xs text-text-secondary font-medium">
                                    Ce script crée toutes les tables nécessaires (`users`, `orders`, `products`, `shipping_templates`, `platform_messages`, `audit_logs`).
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopySql}
                                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                                        hasCopiedSql ? 'bg-emerald-600 text-white' : 'bg-base-100 hover:bg-base-300 text-text-primary border border-base-300'
                                    }`}
                                >
                                    {hasCopiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    <span>{hasCopiedSql ? 'Copié !' : 'Copier le script SQL'}</span>
                                </button>
                                <a
                                    href="https://supabase.com/dashboard/project/_/sql/new"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Ouvrir SQL Editor</span>
                                </a>
                            </div>
                        </div>

                        <div className="relative">
                            <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-slate-800">
                                <code>{SUPABASE_SQL_SCHEMA}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: MAINTENANCE & LOGS */}
            {activeTab === 'maintenance' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Maintenance Section */}
                    <div className="bg-rose-500/5 dark:bg-rose-950/20 border-2 border-rose-500/30 rounded-3xl p-6 md:p-8 space-y-6">
                        <div className="border-b border-rose-500/20 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight">
                                        Maintenance Critique // Nettoyage des Tables
                                    </h3>
                                    <p className="text-xs text-text-secondary font-medium">
                                        Opérations de purge globale pour réinitialiser les données sur Supabase et le serveur central.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Purge Commandes */}
                            <div className="p-5 bg-base-100 rounded-2xl border border-rose-500/20 flex flex-col justify-between gap-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm uppercase tracking-wide">
                                        <PackageX className="w-4 h-4" />
                                        <span>Supprimer Toutes les Commandes</span>
                                    </div>
                                    <p className="text-xs text-text-secondary leading-relaxed">
                                        Purge l'intégralité des commandes de la table <code className="font-mono text-purple-500">orders</code>. Les utilisateurs et produits ne sont pas affectés.
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

                            {/* Purge Utilisateurs */}
                            <div className="p-5 bg-base-100 rounded-2xl border border-rose-500/20 flex flex-col justify-between gap-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm uppercase tracking-wide">
                                        <Users className="w-4 h-4" />
                                        <span>Supprimer Tous les Utilisateurs</span>
                                    </div>
                                    <p className="text-xs text-text-secondary leading-relaxed">
                                        Supprime toutes les boutiques, superviseurs et agents de la table <code className="font-mono text-blue-500">users</code>. Votre compte administrateur est automatiquement conservé.
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

                    {/* Audit Logs Table */}
                    <div className="bg-base-200 p-6 md:p-8 rounded-3xl shadow-lg border border-base-300 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-300 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">
                                    Journal d'Audit des Opérations
                                </h3>
                                <p className="text-xs text-text-secondary font-medium">
                                    Historique des modifications et des synchronisations de la base de données.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Rechercher dans les logs..."
                                    value={logSearchQuery}
                                    onChange={(e) => setLogSearchQuery(e.target.value)}
                                    className="px-3 py-1.5 bg-base-100 rounded-xl border border-base-300 text-xs text-text-primary"
                                />
                                <button
                                    type="button"
                                    onClick={() => loadLogs(false)}
                                    disabled={isRefreshingLogs}
                                    className="p-2 bg-base-100 hover:bg-base-300 text-text-primary rounded-xl border border-base-300 cursor-pointer"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshingLogs ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-80">
                            {filteredLogs.length === 0 ? (
                                <div className="text-center py-8 text-xs text-text-secondary">
                                    Aucun événement d'audit enregistré pour le moment.
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-base-300 text-text-secondary font-black uppercase text-[10px]">
                                            <th className="py-2 px-3">Date</th>
                                            <th className="py-2 px-3">Utilisateur</th>
                                            <th className="py-2 px-3">Action</th>
                                            <th className="py-2 px-3">Détails</th>
                                            <th className="py-2 px-3">Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base-300">
                                        {filteredLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-base-100/50">
                                                <td className="py-2 px-3 whitespace-nowrap text-text-secondary font-mono text-[11px]">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-text-primary">{log.userEmail}</td>
                                                <td className="py-2 px-3">
                                                    <span className="font-mono text-[11px] px-2 py-0.5 bg-base-300 rounded-md font-bold">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 text-text-secondary max-w-xs truncate">{log.details}</td>
                                                <td className="py-2 px-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                        log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                        {log.status === 'success' ? 'SUCCÈS' : 'ÉCHEC'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
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
                                    Confirmation Requise
                                </h4>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                    Purge de toutes les commandes
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-text-secondary leading-relaxed bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                            Êtes-vous absolument sûr de vouloir <strong>supprimer toutes les commandes</strong> de la base de données ? Toutes les données de commandes seront effacées définitivement de Supabase et de la mémoire serveur.
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
                                    Confirmation Requise
                                </h4>
                                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                                    Purge de tous les utilisateurs
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-text-secondary leading-relaxed bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                            Êtes-vous absolument sûr de vouloir <strong>supprimer tous les utilisateurs</strong> (agents, superviseurs, boutiques) ? Votre compte administrateur restera automatiquement conservé.
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

export default AdminDatabaseSettings;
