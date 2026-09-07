import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient } from '../lib/apiClient';
import { db } from '../lib/db';
import { Order, User, Role, ORDER_FIELDS, GoogleSheetIntegration, EcommercePlatformConfig } from '../types';
import { extractCleanSpreadsheetId, buildSpreadsheetUrl } from '../lib/spreadsheetUtils';
import { suggestColumnMapping } from '../lib/gemini';
import {
  GoogleSheetsIcon,
  ShopifyIcon,
  YouCanIcon,
  StoreepIcon,
  WoocommerceIcon,
  LightfunnelsIcon,
  StoreinoIcon,
  EasyOrdersIcon,
  ApiIcon,
  MagentoIcon
} from './icons/PlatformIcons';
import {
  Trash2,
  RefreshCw,
  Plus,
  Copy,
  Check,
  ExternalLink,
  SlidersHorizontal,
  X,
  Sparkles,
  Layers,
  ChevronRight,
  Store as StoreIcon,
  HelpCircle,
  Zap,
  Clock,
  Radio,
  CheckCircle2,
  Webhook,
  Activity
} from 'lucide-react';

interface StoreProps {
  onSync: () => Promise<void>;
  selectedClientId?: string;
  onBack?: () => void;
}

type PlatformTab =
  | 'google_sheets'
  | 'shopify'
  | 'youcan'
  | 'storeep'
  | 'woocommerce'
  | 'lightfunnels'
  | 'storeino'
  | 'easyorders'
  | 'api'
  | 'magento';

const PLATFORM_TABS: Array<{ id: PlatformTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'google_sheets', label: 'Google Sheets', icon: GoogleSheetsIcon },
  { id: 'shopify', label: 'Shopify', icon: ShopifyIcon },
  { id: 'youcan', label: 'YouCan', icon: YouCanIcon },
  { id: 'storeep', label: 'Storeep', icon: StoreepIcon },
  { id: 'woocommerce', label: 'Woocommerce', icon: WoocommerceIcon },
  { id: 'lightfunnels', label: 'lightfunnels', icon: LightfunnelsIcon },
  { id: 'storeino', label: 'Storeino', icon: StoreinoIcon },
  { id: 'easyorders', label: 'EasyOrders', icon: EasyOrdersIcon },
  { id: 'api', label: 'API', icon: ApiIcon },
  { id: 'magento', label: 'Magento', icon: MagentoIcon },
];

export const Store: React.FC<StoreProps> = ({ onSync, selectedClientId }) => {
  const { currentUser, updateUser, users } = useAuth();
  const { t } = useLanguage();

  // Active tab state
  const [activeTab, setActiveTab] = useState<PlatformTab>('google_sheets');

  // Selected seller if Admin/Manager is inspecting a specific client
  const [effectiveClientId, setEffectiveClientId] = useState<string>(() => {
    return selectedClientId || (currentUser?.role === Role.Client ? currentUser.id : '');
  });

  // Effective seller user object
  const targetSeller: User | undefined = useMemo(() => {
    if (!currentUser) return undefined;
    if (currentUser.role === Role.Client) return currentUser;
    if (effectiveClientId) {
      const found = users.find(u => u.id === effectiveClientId);
      if (found) return found;
    }
    // Default to first client or current admin
    const firstClient = users.find(u => u.role === Role.Client);
    return firstClient || currentUser;
  }, [currentUser, effectiveClientId, users]);

  // Google Sheets array
  const googleSheets: GoogleSheetIntegration[] = useMemo(() => {
    if (!targetSeller) return [];
    if (Array.isArray(targetSeller.googleSheets) && targetSeller.googleSheets.length > 0) {
      return targetSeller.googleSheets;
    }
    // Fallback: migrate legacy single-sheet config into the new multiple sheets array
    if (targetSeller.googleSheetUrl && targetSeller.googleSheetUrl.trim() !== '') {
      const cleanId = extractCleanSpreadsheetId(targetSeller.googleSheetUrl);
      return [{
        id: 'sheet-default',
        spreadsheetId: cleanId || '1HN2z0wfBY7vjuh_LJLYFVvDAkX8CN5AozEAoNxqh0wo',
        sheetUrl: targetSeller.googleSheetUrl,
        sheetTitle: targetSeller.name || 'CallNet',
        fileName: targetSeller.selectedSheet || 'Feuille 1',
        status: true,
        columnMapping: targetSeller.columnMapping || {},
        autoSync: targetSeller.autoSync
      }];
    }
    return [];
  }, [targetSeller]);

  // Loading and Sync States
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingSheetId, setSyncingSheetId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State for Adding/Editing Google Sheet
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<GoogleSheetIntegration | null>(null);

  // Modal Form Inputs
  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputFileName, setInputFileName] = useState('Feuille 1');
  const [inputStatus, setInputStatus] = useState(true);
  const [inputMapping, setInputMapping] = useState<Record<string, string>>({});
  const [isDetectingTabs, setIsDetectingTabs] = useState(false);
  const [detectedTabs, setDetectedTabs] = useState<string[]>([]);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [showScriptModal, setShowScriptModal] = useState(false);

  // E-commerce platform state (Shopify, YouCan, etc.)
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [platformStoreName, setPlatformStoreName] = useState('');
  const [platformStoreUrl, setPlatformStoreUrl] = useState('');
  const [platformApiKey, setPlatformApiKey] = useState('');

  // Auto-Sync States
  const [isSavingAutoSync, setIsSavingAutoSync] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Clear toast message after 4 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Helper to copy text to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format relative timestamp
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Jamais';
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 10) return "À l'instant";
      if (diffSec < 60) return `Il y a ${diffSec} sec`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Il y a ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingSheet(null);
    setInputUrl('');
    setInputTitle(targetSeller?.name || 'CallNet');
    setInputFileName('Feuille 1');
    setInputStatus(true);
    setInputMapping({});
    setDetectedTabs([]);
    setDetectedHeaders([]);
    setShowAdvancedMapping(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sheet: GoogleSheetIntegration) => {
    setEditingSheet(sheet);
    setInputUrl(sheet.sheetUrl || sheet.spreadsheetId);
    setInputTitle(sheet.sheetTitle);
    setInputFileName(sheet.fileName);
    setInputStatus(sheet.status);
    setInputMapping(sheet.columnMapping || {});
    setDetectedTabs([]);
    setDetectedHeaders([]);
    setShowAdvancedMapping(Boolean(sheet.columnMapping && Object.keys(sheet.columnMapping).length > 0));
    setIsModalOpen(true);
  };

  // Toggle status directly from table row
  const handleToggleStatus = async (sheetId: string) => {
    if (!targetSeller) return;
    const updated = googleSheets.map(s => {
      if (s.id === sheetId) {
        return { ...s, status: !s.status };
      }
      return s;
    });

    try {
      await updateUser({
        id: targetSeller.id,
        googleSheets: updated
      });
      setStatusMessage({ type: 'success', text: 'Statut de la feuille mis à jour.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur lors de la mise à jour' });
    }
  };

  // Delete Google Sheet integration
  const handleDeleteSheet = async (sheetId: string) => {
    if (!targetSeller) return;
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette intégration Google Sheets ?")) {
      return;
    }

    const updated = googleSheets.filter(s => s.id !== sheetId);
    try {
      await updateUser({
        id: targetSeller.id,
        googleSheets: updated,
        googleSheetUrl: updated.length > 0 ? updated[0].sheetUrl : '',
        selectedSheet: updated.length > 0 ? updated[0].fileName : ''
      });
      setStatusMessage({ type: 'success', text: 'Feuille supprimée avec succès.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur de suppression' });
    }
  };

  // Toggle Global Auto-Sync for this Seller
  const handleToggleAutoSync = async (enabled: boolean) => {
    if (!targetSeller) return;
    setIsSavingAutoSync(true);
    try {
      await updateUser({
        id: targetSeller.id,
        autoSync: enabled,
        autoSyncInterval: targetSeller.autoSyncInterval || 120
      });
      setStatusMessage({
        type: 'success',
        text: enabled
          ? `Synchronisation automatique 100% activée (toutes les ${Math.round((targetSeller.autoSyncInterval || 120) / 60)} min).`
          : 'Synchronisation automatique mise en pause.'
      });
      if (enabled) {
        handleSyncAllActiveSheets();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur lors de la configuration du mode automatique' });
    } finally {
      setIsSavingAutoSync(false);
    }
  };

  // Change Auto-Sync Interval
  const handleChangeAutoSyncInterval = async (intervalSec: number) => {
    if (!targetSeller) return;
    setIsSavingAutoSync(true);
    try {
      await updateUser({
        id: targetSeller.id,
        autoSync: targetSeller.autoSync ?? true,
        autoSyncInterval: intervalSec
      });
      setStatusMessage({
        type: 'success',
        text: `Fréquence mise à jour : synchronisation toutes les ${intervalSec >= 60 ? `${Math.round(intervalSec / 60)} min` : `${intervalSec}s`}.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur de mise à jour' });
    } finally {
      setIsSavingAutoSync(false);
    }
  };

  // Toggle individual sheet Auto-Sync
  const handleToggleSheetAutoSync = async (sheetId: string) => {
    if (!targetSeller) return;
    const updated = googleSheets.map(s => {
      if (s.id === sheetId) {
        return { ...s, autoSync: s.autoSync === false ? true : false };
      }
      return s;
    });
    try {
      await updateUser({
        id: targetSeller.id,
        googleSheets: updated
      });
      setStatusMessage({ type: 'success', text: 'Option auto-sync de la feuille mise à jour.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur de mise à jour' });
    }
  };

  // Detect Available Sheets/Tabs
  const handleDetectTabs = async () => {
    const url = inputUrl.trim();
    if (!url) {
      alert("Veuillez saisir l'URL ou l'ID de votre Google Spreadsheet");
      return;
    }
    setIsDetectingTabs(true);
    try {
      const data = await apiClient.apiPost<any>('/google-sheets/list-sheets', { sheetUrl: url });
      let sheetsList: string[] = [];
      if (Array.isArray(data)) sheetsList = data;
      else if (data && Array.isArray(data.sheets)) sheetsList = data.sheets;
      else if (data && Array.isArray(data.data)) sheetsList = data.data;

      if (sheetsList.length > 0) {
        setDetectedTabs(sheetsList);
        if (!sheetsList.includes(inputFileName)) {
          setInputFileName(sheetsList[0]);
        }
        setStatusMessage({ type: 'success', text: `${sheetsList.length} onglet(s) détecté(s)` });
      } else {
        setDetectedTabs(['Feuille 1', 'Sheet1', 'Commandes', 'Orders']);
      }
    } catch (err: any) {
      setDetectedTabs(['Feuille 1', 'Sheet1', 'Commandes', 'Orders']);
    } finally {
      setIsDetectingTabs(false);
    }
  };

  // Auto-detect & AI Map Columns
  const handleAutoDetectColumns = async () => {
    const url = inputUrl.trim();
    if (!url) {
      alert("Veuillez d'abord saisir l'URL de votre Google Spreadsheet");
      return;
    }
    setIsAutoMapping(true);
    try {
      const cols = await apiClient.apiPost<string[]>('/google-sheets/list-columns', {
        sheetUrl: url,
        sheetName: inputFileName
      });
      if (Array.isArray(cols) && cols.length > 0) {
        setDetectedHeaders(cols);
        // Call Gemini AI or heuristic suggestions
        const suggested = await suggestColumnMapping(
          cols,
          ORDER_FIELDS.map(f => ({ key: f.key, label: f.label }))
        );
        setInputMapping(suggested || {});
        setShowAdvancedMapping(true);
        setStatusMessage({ type: 'success', text: 'Colonnes détectées et associées automatiquement.' });
      } else {
        alert("Impossible de lire les en-têtes. Vérifiez le partage public ou le déploiement Apps Script.");
      }
    } catch (e: any) {
      alert(`Erreur d'analyse des colonnes : ${e?.message || e}`);
    } finally {
      setIsAutoMapping(false);
    }
  };

  // Save Modal (Add or Edit)
  const handleSaveSheetModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSeller) return;
    const cleanUrl = inputUrl.trim();
    if (!cleanUrl) {
      alert("L'URL ou l'ID de la feuille est obligatoire");
      return;
    }

    const cleanSpreadsheetId = extractCleanSpreadsheetId(cleanUrl);
    const fullUrl = buildSpreadsheetUrl(cleanUrl);

    let updatedSheets: GoogleSheetIntegration[];

    if (editingSheet) {
      updatedSheets = googleSheets.map(s => {
        if (s.id === editingSheet.id) {
          return {
            ...s,
            spreadsheetId: cleanSpreadsheetId,
            sheetUrl: fullUrl,
            sheetTitle: inputTitle.trim() || 'Boutique',
            fileName: inputFileName.trim() || 'Feuille 1',
            status: inputStatus,
            columnMapping: inputMapping
          };
        }
        return s;
      });
    } else {
      const newSheet: GoogleSheetIntegration = {
        id: `sheet-${Date.now()}`,
        spreadsheetId: cleanSpreadsheetId,
        sheetUrl: fullUrl,
        sheetTitle: inputTitle.trim() || 'CallNet',
        fileName: inputFileName.trim() || 'Feuille 1',
        status: inputStatus,
        columnMapping: inputMapping,
        createdAt: new Date().toISOString()
      };
      updatedSheets = [...googleSheets, newSheet];
    }

    try {
      await updateUser({
        id: targetSeller.id,
        googleSheets: updatedSheets,
        googleSheetUrl: updatedSheets.length > 0 ? updatedSheets[0].sheetUrl : '',
        selectedSheet: updatedSheets.length > 0 ? updatedSheets[0].fileName : ''
      });

      setIsModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: editingSheet ? 'Intégration mise à jour avec succès.' : 'Nouvelle feuille Google Sheets intégrée !'
      });

      // Synchronize immediately if active
      if (inputStatus) {
        handleSyncSingleSheet(editingSheet ? editingSheet.id : updatedSheets[updatedSheets.length - 1].id, updatedSheets);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || "Erreur lors de l'enregistrement" });
    }
  };

  // Sync a single sheet
  const handleSyncSingleSheet = async (sheetId: string, sheetsOverride?: GoogleSheetIntegration[]) => {
    if (!targetSeller) return;
    const list = sheetsOverride || googleSheets;
    const targetSheet = list.find(s => s.id === sheetId);
    if (!targetSheet) return;

    setSyncingSheetId(sheetId);
    try {
      const res = await apiClient.apiPost<{ message: string; count: number; orders?: Order[] }>(
        '/google-sheets/sync-orders',
        {
          sheetUrl: targetSheet.sheetUrl,
          sheetName: targetSheet.fileName,
          columnMapping: targetSheet.columnMapping,
          storeName: targetSheet.sheetTitle,
          clientId: targetSeller.id,
          sheetId: targetSheet.id
        }
      );

      if (res.orders && targetSeller.id) {
        await db.orders.replaceForClient(targetSeller.id, res.orders);
      }

      await onSync();
      setStatusMessage({
        type: 'success',
        text: `Synchronisation réussie pour ${targetSheet.sheetTitle} : ${res.count || 0} commande(s).`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Échec de synchronisation : ${err?.message || err}` });
    } finally {
      setSyncingSheetId(null);
    }
  };

  // Sync all active sheets for this seller
  const handleSyncAllActiveSheets = async () => {
    if (!targetSeller) return;
    const activeSheets = googleSheets.filter(s => s.status);
    if (activeSheets.length === 0) {
      alert("Aucune feuille active à synchroniser. Activez au moins une feuille dans le tableau.");
      return;
    }

    setIsSyncingAll(true);
    try {
      const res = await apiClient.apiPost<{ message: string; count: number; orders?: Order[] }>(
        '/google-sheets/sync-orders',
        {
          sheets: activeSheets,
          clientId: targetSeller.id,
          storeName: targetSeller.name
        }
      );

      if (res.orders && targetSeller.id) {
        await db.orders.replaceForClient(targetSeller.id, res.orders);
      }

      await onSync();
      setStatusMessage({
        type: 'success',
        text: `Synchronisation miroir réussie ! ${res.count || 0} commande(s) réinjectée(s) depuis ${activeSheets.length} feuille(s).`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Échec de la synchronisation : ${err?.message || err}` });
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Connected e-commerce platforms
  const ecommercePlatforms: EcommercePlatformConfig[] = targetSeller?.ecommercePlatforms || [];

  // Add E-commerce platform
  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSeller) return;
    const newConfig: EcommercePlatformConfig = {
      id: `plat-${Date.now()}`,
      platform: activeTab as any,
      storeName: platformStoreName.trim() || activeTab.toUpperCase(),
      storeUrl: platformStoreUrl.trim(),
      apiKey: platformApiKey.trim(),
      status: true,
      webhookUrl: `${window.location.origin}/api/webhooks/${activeTab}/${targetSeller.id}`,
      createdAt: new Date().toISOString()
    };

    const updated = [...ecommercePlatforms, newConfig];
    try {
      await updateUser({
        id: targetSeller.id,
        ecommercePlatforms: updated
      });
      setIsPlatformModalOpen(false);
      setPlatformStoreName('');
      setPlatformStoreUrl('');
      setPlatformApiKey('');
      setStatusMessage({ type: 'success', text: `Intégration ${activeTab} ajoutée avec succès !` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || "Erreur d'ajout" });
    }
  };

  const handleDeletePlatform = async (id: string) => {
    if (!targetSeller) return;
    if (!window.confirm("Supprimer cette intégration ?")) return;
    const updated = ecommercePlatforms.filter(p => p.id !== id);
    try {
      await updateUser({
        id: targetSeller.id,
        ecommercePlatforms: updated
      });
      setStatusMessage({ type: 'success', text: 'Intégration supprimée.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur' });
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-3 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200'
              : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP BAR: LIST header on left, integration / list breadcrumb on right (Exact format from photo) */}
      <div className="flex flex-col xs:flex-row sm:flex-row items-start xs:items-center justify-between gap-2.5 pt-1 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-white uppercase font-sans">
            LIST
          </h1>

          {/* Admin / Manager Seller Switcher */}
          {(currentUser?.role === Role.Admin || currentUser?.role === Role.Manager) && (
            <div className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-base-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-base-300">
              <StoreIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">Boutique :</span>
              <select
                value={targetSeller?.id || ''}
                onChange={e => setEffectiveClientId(e.target.value)}
                className="bg-transparent font-medium text-slate-800 dark:text-white focus:outline-hidden cursor-pointer max-w-[150px] sm:max-w-none truncate"
              >
                {users
                  .filter(u => u.role === Role.Client)
                  .map(seller => (
                    <option key={seller.id} value={seller.id} className="text-slate-900 dark:text-slate-100">
                      {seller.name} ({seller.email})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Breadcrumbs matching photo: integration / list */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-normal self-end xs:self-center">
          <span>integration</span>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">list</span>
        </div>
      </div>

      {/* HORIZONTAL PLATFORM TABS BAR (Google Sheets, Shopify, YouCan, Storeep, Woocommerce, etc.) */}
      <div className="w-full overflow-x-auto scrollbar-none border-b border-slate-200 dark:border-base-300 -mx-1 px-1">
        <div className="flex items-center gap-1 min-w-max pb-px">
          {PLATFORM_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all rounded-t-lg border-b-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-base-200 font-semibold shadow-xs'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-base-200/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GOOGLE SHEETS TAB CONTENT */}
      {activeTab === 'google_sheets' && (
        <div className="space-y-4">
          {/* AUTO-SYNC COMMAND & STATUS BANNER */}
          <div className="bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                  targetSeller?.autoSync !== false
                    ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-100 text-slate-400 dark:bg-base-300 dark:text-slate-500 border border-slate-200 dark:border-base-300'
                }`}>
                  <Zap className={`w-5 h-5 ${targetSeller?.autoSync !== false ? 'animate-pulse' : ''}`} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                      Synchronisation Automatique en Arrière-Plan
                    </h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      targetSeller?.autoSync !== false
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${targetSeller?.autoSync !== false ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
                      {targetSeller?.autoSync !== false ? '100% Automatique Actif' : 'Mode Manuel'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                    Le serveur scrute automatiquement vos feuilles Google Sheets et importe en direct les nouvelles commandes sans aucune action requise.
                  </p>
                </div>
              </div>

              {/* Master Auto-Sync Switch */}
              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 hidden xs:inline">
                  {targetSeller?.autoSync !== false ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
                </span>
                <button
                  type="button"
                  disabled={isSavingAutoSync}
                  onClick={() => handleToggleAutoSync(targetSeller?.autoSync === false ? true : false)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                    targetSeller?.autoSync !== false ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  role="switch"
                  aria-checked={targetSeller?.autoSync !== false}
                  title="Activer ou désactiver la synchronisation automatique"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      targetSeller?.autoSync !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Controls Bar: Interval options + Last Synced + Instant Trigger buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-base-300 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
              {/* Left: Interval options */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Fréquence :
                </span>
                {[
                  { sec: 60, label: '1 min' },
                  { sec: 120, label: '2 min (Recommandé)' },
                  { sec: 300, label: '5 min' },
                  { sec: 600, label: '10 min' }
                ].map(opt => {
                  const currentSec = targetSeller?.autoSyncInterval || 120;
                  const isSelected = currentSec === opt.sec;
                  return (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => handleChangeAutoSyncInterval(opt.sec)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-base-300 dark:hover:bg-base-100 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Right: Last Sync status + Webhook trigger modal button */}
              <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  Dernier scan : <strong className="text-slate-700 dark:text-slate-200">{formatRelativeTime(targetSeller?.lastAutoSyncedAt)}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setShowWebhookModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                  title="Activer la synchronisation instantanée via Webhook Google Sheets"
                >
                  <Webhook className="w-3.5 h-3.5" />
                  <span>Webhook Instantané (0 délai)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Bar with responsive stacking for phone screens */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {googleSheets.length} feuille{googleSheets.length > 1 ? 's' : ''} intégrée{googleSheets.length > 1 ? 's' : ''} pour ce vendeur
              </span>
              {googleSheets.filter(s => s.status).length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  {googleSheets.filter(s => s.status).length} active(s)
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {googleSheets.length > 0 && (
                <button
                  onClick={handleSyncAllActiveSheets}
                  disabled={isSyncingAll}
                  className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-base-300 dark:hover:bg-base-100 border border-slate-300 dark:border-base-300 rounded-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                  title="Synchroniser toutes les feuilles actives en direct"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncingAll ? 'animate-spin text-blue-600' : ''}`} />
                  <span className="whitespace-nowrap">{isSyncingAll ? 'Synchronisation...' : 'Synchroniser tout'}</span>
                </button>
              )}

              {/* Exact button from photo: 'Intégrer le nouveau Google Sheets' with clean blue outline */}
              <button
                onClick={handleOpenAddModal}
                className="w-full sm:w-auto justify-center border border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium text-sm px-4 py-2.5 sm:py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4 shrink-0 text-blue-500" />
                <span className="whitespace-nowrap">Intégrer le nouveau Google Sheets</span>
              </button>
            </div>
          </div>

          {/* DESKTOP TABLE VIEW (Visible on tablet & desktop >= 640px) */}
          <div className="hidden sm:block bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-lg shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-base-300/60 border-b border-slate-200 dark:border-base-300 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold font-mono">
                    <th scope="col" className="px-5 py-3.5">
                      spreadsheet id
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      sheet title
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      file name
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-center">
                      status
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-center">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-base-300 text-sm">
                  {googleSheets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <div className="max-w-md mx-auto space-y-3">
                          <GoogleSheetsIcon className="w-10 h-10 mx-auto opacity-70" />
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            Aucune feuille Google Sheets intégrée
                          </p>
                          <p className="text-xs text-slate-400">
                            Vous pouvez intégrer plusieurs feuilles Google Sheets pour ce vendeur.
                            Cliquez sur le bouton ci-dessous pour ajouter votre première feuille.
                          </p>
                          <button
                            onClick={handleOpenAddModal}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Intégrer le nouveau Google Sheets</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    googleSheets.map(sheet => {
                      const isSyncing = syncingSheetId === sheet.id;
                      return (
                        <tr
                          key={sheet.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-base-300/30 transition-colors"
                        >
                          {/* SPREADSHEET ID */}
                          <td className="px-5 py-4 font-mono text-xs text-slate-700 dark:text-slate-200 max-w-[240px] truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate select-all" title={sheet.spreadsheetId}>
                                {sheet.spreadsheetId}
                              </span>
                              <button
                                onClick={() => handleCopy(sheet.spreadsheetId, sheet.id)}
                                className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                                title="Copier l'ID"
                              >
                                {copiedId === sheet.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {sheet.sheetUrl && (
                                <a
                                  href={sheet.sheetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                  title="Ouvrir dans Google Sheets"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* SHEET TITLE & AUTO-SYNC METRICS */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{sheet.sheetTitle || 'CallNet'}</span>
                                {sheet.autoSync !== false && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    <Zap className="w-2.5 h-2.5" />
                                    Auto
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                {sheet.orderCount !== undefined && <span>{sheet.orderCount} commande{sheet.orderCount > 1 ? 's' : ''}</span>}
                                {sheet.orderCount !== undefined && sheet.lastSyncedAt && <span>•</span>}
                                {sheet.lastSyncedAt ? (
                                  <span>Dernière synchro : {formatRelativeTime(sheet.lastSyncedAt)}</span>
                                ) : (
                                  <span className="text-slate-400">En attente de scan</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* FILE NAME (Tab Name) */}
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-base-300 rounded-md text-xs font-mono">
                              {sheet.fileName || 'Feuille 1'}
                            </span>
                          </td>

                          {/* STATUS (Green Toggle switch matching photo) */}
                          <td className="px-5 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(sheet.id)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                sheet.status ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                              role="switch"
                              aria-checked={sheet.status}
                              title={sheet.status ? 'Actif - Cliquez pour désactiver' : 'Inactif - Cliquez pour activer'}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  sheet.status ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          {/* ACTION (Red Trash button in square border matching photo, plus sync & config buttons) */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Sync Single Sheet */}
                              <button
                                onClick={() => handleSyncSingleSheet(sheet.id)}
                                disabled={isSyncing}
                                className="border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-600 hover:text-emerald-600 dark:text-slate-300 rounded-md p-1.5 transition-all cursor-pointer"
                                title="Synchroniser cette feuille"
                              >
                                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                              </button>

                              {/* Edit / Column Mapping */}
                              <button
                                onClick={() => handleOpenEditModal(sheet)}
                                className="border border-slate-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-600 hover:text-blue-600 dark:text-slate-300 rounded-md p-1.5 transition-all cursor-pointer"
                                title="Configurer le mappage des colonnes"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>

                              {/* Red Trash Delete Action (Exact design from photo: square button with red border) */}
                              <button
                                onClick={() => handleDeleteSheet(sheet.id)}
                                className="border border-red-400 hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 hover:text-red-700 rounded-md p-1.5 transition-all cursor-pointer"
                                title="Supprimer l'intégration"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS VIEW (Clean, phone-optimized layout - 0% overflow, all controls on screen) */}
          <div className="block sm:hidden space-y-3">
            {googleSheets.length === 0 ? (
              <div className="bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-xl p-6 text-center space-y-3">
                <GoogleSheetsIcon className="w-10 h-10 mx-auto opacity-70" />
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  Aucune feuille Google Sheets intégrée
                </p>
                <p className="text-xs text-slate-400">
                  Ajoutez votre première feuille Google Sheets pour synchroniser les commandes.
                </p>
                <button
                  onClick={handleOpenAddModal}
                  className="w-full justify-center inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Intégrer le nouveau Google Sheets</span>
                </button>
              </div>
            ) : (
              googleSheets.map(sheet => {
                const isSyncing = syncingSheetId === sheet.id;
                return (
                  <div
                    key={sheet.id}
                    className="bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-xl p-4 shadow-xs space-y-3.5"
                  >
                    {/* Card Header: Title + Status Switch */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                        <h3 className="font-bold text-slate-800 dark:text-white text-base truncate">
                          {sheet.sheetTitle || 'CallNet'}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold ${sheet.status ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                          {sheet.status ? 'Actif' : 'Inactif'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sheet.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            sheet.status ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                          role="switch"
                          aria-checked={sheet.status}
                          title={sheet.status ? 'Désactiver' : 'Activer'}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              sheet.status ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Card Details: File Name + Spreadsheet ID */}
                    <div className="bg-slate-50 dark:bg-base-300/60 rounded-lg p-3 space-y-2 border border-slate-100 dark:border-base-300/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Onglet (File name) :</span>
                        <span className="px-2 py-0.5 bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded font-mono font-semibold text-slate-700 dark:text-slate-200">
                          {sheet.fileName || 'Feuille 1'}
                        </span>
                      </div>

                      {(sheet.orderCount !== undefined || sheet.lastSyncedAt) && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-base-300">
                          <span className="text-slate-500 font-medium">Commandes & Synchro :</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {sheet.orderCount !== undefined ? `${sheet.orderCount} cmd` : ''} {sheet.lastSyncedAt ? `(${formatRelativeTime(sheet.lastSyncedAt)})` : '(En attente)'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs gap-2 pt-1 border-t border-slate-200/60 dark:border-base-300">
                        <span className="text-slate-500 font-medium shrink-0">ID :</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-slate-600 dark:text-slate-300 truncate text-[11px]" title={sheet.spreadsheetId}>
                            {sheet.spreadsheetId.slice(0, 14)}...
                          </span>
                          <button
                            onClick={() => handleCopy(sheet.spreadsheetId, sheet.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Copier l'ID"
                          >
                            {copiedId === sheet.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {sheet.sheetUrl && (
                            <a
                              href={sheet.sheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-blue-600"
                              title="Ouvrir dans Google Sheets"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Action Buttons: Full touch width, clean square red trash button */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSyncSingleSheet(sheet.id)}
                        disabled={isSyncing}
                        className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                        <span>{isSyncing ? 'Sync...' : 'Synchroniser'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(sheet)}
                        className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                        <span>Mappage</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSheet(sheet.id)}
                        className="p-2 border border-red-400 hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 hover:text-red-700 rounded-lg transition-all cursor-pointer shrink-0"
                        title="Supprimer la feuille"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Helper Banner with Google Apps Script code */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-50 dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-lg text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start sm:items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Besoin d'une synchronisation bidirectionnelle instantanée ? Déployez notre script Google Apps Script gratuit.
              </span>
            </div>
            <button
              onClick={() => setShowScriptModal(true)}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer shrink-0 whitespace-nowrap self-end sm:self-auto"
            >
              Voir le script →
            </button>
          </div>
        </div>
      )}

      {/* OTHER E-COMMERCE PLATFORMS TABS (Shopify, YouCan, Woocommerce, Lightfunnels, etc.) */}
      {activeTab !== 'google_sheets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Intégration directe pour {activeTab.toUpperCase()}
            </span>

            <button
              onClick={() => setIsPlatformModalOpen(true)}
              className="w-full sm:w-auto justify-center border border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium text-sm px-4 py-2.5 sm:py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-blue-500" />
              <span>Intégrer {activeTab}</span>
            </button>
          </div>

          {/* DESKTOP TABLE VIEW FOR OTHER PLATFORMS */}
          <div className="hidden sm:block bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-lg shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-base-300/60 border-b border-slate-200 dark:border-base-300 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold font-mono">
                    <th className="px-5 py-3.5">store name</th>
                    <th className="px-5 py-3.5">store url / id</th>
                    <th className="px-5 py-3.5">webhook url</th>
                    <th className="px-5 py-3.5 text-center">status</th>
                    <th className="px-5 py-3.5 text-center">action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-base-300 text-sm">
                  {ecommercePlatforms.filter(p => p.platform === activeTab).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <div className="max-w-md mx-auto space-y-3">
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            Aucune boutique {activeTab} connectée
                          </p>
                          <p className="text-xs text-slate-400">
                            Connectez votre boutique pour synchroniser automatiquement les commandes en temps réel.
                          </p>
                          <button
                            onClick={() => setIsPlatformModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Intégrer {activeTab}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ecommercePlatforms
                      .filter(p => p.platform === activeTab)
                      .map(plat => (
                        <tr key={plat.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-100">
                            {plat.storeName}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            {plat.storeUrl || 'N/A'}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            <span className="truncate max-w-[200px] inline-block">{plat.webhookUrl}</span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              Actif
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => handleDeletePlatform(plat.id)}
                              className="border border-red-400 hover:border-red-600 hover:bg-red-50 text-red-500 rounded-md p-1.5 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS VIEW FOR OTHER PLATFORMS */}
          <div className="block sm:hidden space-y-3">
            {ecommercePlatforms.filter(p => p.platform === activeTab).length === 0 ? (
              <div className="bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-xl p-6 text-center space-y-3">
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  Aucune boutique {activeTab} connectée
                </p>
                <p className="text-xs text-slate-400">
                  Connectez votre boutique pour synchroniser automatiquement les commandes en temps réel.
                </p>
                <button
                  onClick={() => setIsPlatformModalOpen(true)}
                  className="w-full justify-center inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-blue-500 text-blue-600 font-medium text-sm hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Intégrer {activeTab}</span>
                </button>
              </div>
            ) : (
              ecommercePlatforms
                .filter(p => p.platform === activeTab)
                .map(plat => (
                  <div
                    key={plat.id}
                    className="bg-white dark:bg-base-200 border border-slate-200 dark:border-base-300 rounded-xl p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-white text-base">
                        {plat.storeName}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Actif
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-base-300/60 rounded-lg p-2.5 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">URL :</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{plat.storeUrl || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Webhook :</span>
                        <span className="font-mono text-[10px] text-slate-500 truncate max-w-[160px]">{plat.webhookUrl}</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleDeletePlatform(plat.id)}
                        className="px-3 py-1.5 border border-red-400 text-red-500 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* FOOTER (Exact copyright text from the photo) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-base-300">
        <div>2026 © callnet.</div>
        <div>Design &amp; Develop by Team CallNet</div>
      </div>

      {/* MODAL: INTÉGRER UN NOUVEAU GOOGLE SHEETS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-base-100 rounded-xl shadow-2xl border border-slate-200 dark:border-base-300 max-w-xl w-full p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-base-300 pb-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <GoogleSheetsIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white truncate">
                  {editingSheet ? 'Modifier la feuille Google Sheets' : 'Intégrer le nouveau Google Sheets'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSheetModal} className="space-y-4">
              {/* Spreadsheet URL or ID */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  URL ou ID du Spreadsheet Google Sheets *
                </label>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  placeholder="ex: 1HN2z0wfBY7vjuh_LJLYFVvDAkX8CN5AozEAoNxqh0wo ou URL complète"
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Vous pouvez coller l'URL complète de votre feuille Google Sheets, son ID, ou l'URL Web App (/exec).
                </p>
              </div>

              {/* Sheet Title and Tab Name (Side by Side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Titre de la feuille (Boutique) *
                  </label>
                  <input
                    type="text"
                    value={inputTitle}
                    onChange={e => setInputTitle(e.target.value)}
                    placeholder="ex: CallNet, TikTok Store, Magasin 2"
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Nom de l'onglet (File name) *
                    </label>
                    <button
                      type="button"
                      onClick={handleDetectTabs}
                      disabled={isDetectingTabs || !inputUrl}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isDetectingTabs ? 'animate-spin' : ''}`} />
                      <span>{isDetectingTabs ? 'Recherche...' : 'Détecter'}</span>
                    </button>
                  </div>
                  {detectedTabs.length > 0 ? (
                    <select
                      value={inputFileName}
                      onChange={e => setInputFileName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      {detectedTabs.map(tab => (
                        <option key={tab} value={tab}>
                          {tab}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={inputFileName}
                      onChange={e => setInputFileName(e.target.value)}
                      placeholder="ex: Feuille 1, Sheet1, Commandes"
                      required
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Status Toggle in Modal */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-base-200 rounded-lg border border-slate-200 dark:border-base-300">
                <div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Activer la synchronisation
                  </span>
                  <p className="text-xs text-slate-500">
                    Les commandes de cette feuille seront synchronisées lors du rafraîchissement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInputStatus(!inputStatus)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    inputStatus ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                  role="switch"
                  aria-checked={inputStatus}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      inputStatus ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Collapsible Column Mapping Section */}
              <div className="border border-slate-200 dark:border-base-300 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Mappage des colonnes (Optionnel)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoDetectColumns}
                    disabled={isAutoMapping || !inputUrl}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-300 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-blue-500 ${isAutoMapping ? 'animate-spin' : ''}`} />
                    <span>{isAutoMapping ? 'Détection IA...' : 'Auto-détecter (IA)'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Notre système reconnaît automatiquement la plupart des colonnes (Nom, Tél, Produit, Prix, Ville).
                  Vous pouvez ajuster les correspondances ci-dessous si nécessaire.
                </p>

                {showAdvancedMapping && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 max-h-48 overflow-y-auto pr-1">
                    {ORDER_FIELDS.slice(0, 8).map(field => (
                      <div key={field.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-medium truncate w-28">
                          {field.label} :
                        </span>
                        {detectedHeaders.length > 0 ? (
                          <select
                            value={inputMapping[field.key] || ''}
                            onChange={e =>
                              setInputMapping(prev => ({
                                ...prev,
                                [field.key]: e.target.value
                              }))
                            }
                            className="flex-1 px-2 py-1 bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded text-xs"
                          >
                            <option value="">(Non assigné)</option>
                            {detectedHeaders.map(h => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={inputMapping[field.key] || ''}
                            onChange={e =>
                              setInputMapping(prev => ({
                                ...prev,
                                [field.key]: e.target.value
                              }))
                            }
                            placeholder="Nom colonne"
                            className="flex-1 px-2 py-1 bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-200 dark:border-base-300">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto text-center px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-base-200 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto justify-center px-5 py-2.5 sm:py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingSheet ? 'Enregistrer les modifications' : 'Intégrer et Synchroniser'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GOOGLE APPS SCRIPT CODE */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-base-100 rounded-xl shadow-2xl border border-slate-200 dark:border-base-300 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-base-300 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <GoogleSheetsIcon className="w-5 h-5" />
                <span>Script Google Apps Script (2-way Live Sync)</span>
              </h3>
              <button onClick={() => setShowScriptModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Dans votre Google Sheet, allez dans <b>Extensions &gt; Apps Script</b>, collez le code suivant, puis cliquez sur <b>Déployer &gt; Nouveau déploiement &gt; Application Web</b> (Accès : Tout le monde).
            </p>

            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto max-h-64 select-all">
{`function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : "Feuille 1";
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = { _rowIndex: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    rows.push(obj);
  }
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}`}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-base-300 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD E-COMMERCE PLATFORM (Shopify, YouCan, etc.) */}
      {isPlatformModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-base-100 rounded-xl shadow-2xl border border-slate-200 dark:border-base-300 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-base-300 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white capitalize">
                Intégrer une boutique {activeTab}
              </h3>
              <button onClick={() => setIsPlatformModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlatform} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Nom de la boutique
                </label>
                <input
                  type="text"
                  value={platformStoreName}
                  onChange={e => setPlatformStoreName(e.target.value)}
                  placeholder={`ex: Ma Boutique ${activeTab}`}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  URL de la boutique (Domaine)
                </label>
                <input
                  type="text"
                  value={platformStoreUrl}
                  onChange={e => setPlatformStoreUrl(e.target.value)}
                  placeholder="ex: https://maboutique.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Clé API / Token d'accès (Optionnel)
                </label>
                <input
                  type="password"
                  value={platformApiKey}
                  onChange={e => setPlatformApiKey(e.target.value)}
                  placeholder="Token ou clé API privée"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg font-mono"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-200 dark:border-base-300">
                <button
                  type="button"
                  onClick={() => setIsPlatformModalOpen(false)}
                  className="w-full sm:w-auto text-center px-4 py-2.5 sm:py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-base-200 rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto justify-center px-4 py-2.5 sm:py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Ajouter l'intégration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSTANT WEBHOOK SYNC (ZERO DELAY) */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-base-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-base-300 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-base-300 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    Webhook Instantané Google Sheets (0 délai)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Importation en temps réel dès qu'une commande est saisie ou modifiée dans Google Sheets
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWebhookModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Unique Webhook URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Votre URL Webhook CallNet dédiée
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' && targetSeller ? `${window.location.origin}/api/webhooks/google-sheets/${targetSeller.id}` : ''}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-base-200 border border-slate-300 dark:border-base-300 rounded-lg text-purple-700 dark:text-purple-300 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && targetSeller) {
                      navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/google-sheets/${targetSeller.id}`);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  {copiedWebhook ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWebhook ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* Quick explanation steps */}
            <div className="bg-slate-50 dark:bg-base-200/60 rounded-xl p-3.5 border border-slate-200 dark:border-base-300 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Comment l'installer en 1 minute dans votre Google Sheet :
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                <li>Ouvrez votre feuille Google Sheets &gt; Menu <b>Extensions</b> &gt; <b>Apps Script</b>.</li>
                <li>Supprimez tout et collez le script ci-dessous, puis cliquez sur <b>Enregistrer</b> (icône disquette).</li>
                <li>Dans le menu gauche d'Apps Script, cliquez sur <b>Déclencheurs</b> (icône réveil) &gt; <b>Ajouter un déclencheur</b> &gt; Sélectionnez la fonction <code>sendCallNetWebhook</code> &gt; Type d'événement : <code>Lors d'une modification</code> (ou <code>Lors de l'envoi du formulaire</code>).</li>
              </ol>
            </div>

            {/* Ready-to-copy code snippet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Script Google Apps Script (Auto-trigger)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const snippet = `function onEdit(e) {\n  sendCallNetWebhook();\n}\n\nfunction onChange(e) {\n  sendCallNetWebhook();\n}\n\nfunction sendCallNetWebhook() {\n  try {\n    var webhookUrl = "${window.location.origin}/api/webhooks/google-sheets/${targetSeller?.id || ''}";\n    var ss = SpreadsheetApp.getActiveSpreadsheet();\n    var payload = {\n      sheetUrl: ss.getUrl(),\n      spreadsheetId: ss.getId(),\n      sheetName: ss.getActiveSheet().getName(),\n      timestamp: new Date().toISOString()\n    };\n    UrlFetchApp.fetch(webhookUrl, {\n      method: "post",\n      contentType: "application/json",\n      payload: JSON.stringify(payload),\n      muteHttpExceptions: true\n    });\n  } catch (err) {\n    Logger.log("Erreur Webhook CallNet: " + err);\n  }\n}`;
                    navigator.clipboard.writeText(snippet);
                    setStatusMessage({ type: 'success', text: 'Script copié dans le presse-papier !' });
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le script complet</span>
                </button>
              </div>

              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-52 select-all leading-relaxed">
{`function onEdit(e) {
  sendCallNetWebhook();
}

function onChange(e) {
  sendCallNetWebhook();
}

function sendCallNetWebhook() {
  try {
    var webhookUrl = "${typeof window !== 'undefined' && targetSeller ? `${window.location.origin}/api/webhooks/google-sheets/${targetSeller.id}` : ''}";
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = {
      sheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      sheetName: ss.getActiveSheet().getName(),
      timestamp: new Date().toISOString()
    };
    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("Erreur Webhook CallNet: " + err);
  }
}`}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-base-300">
              <button
                type="button"
                onClick={() => setShowWebhookModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-base-300 dark:hover:bg-base-200 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;
