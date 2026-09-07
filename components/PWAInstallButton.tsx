import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false, className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed standalone PWA, do not show the install button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      try {
        setIsInstalling(true);
        await install();
      } finally {
        setIsInstalling(false);
      }
    } else {
      // Show guided instructions for iOS or other browsers
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        id="pwa-install-button"
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        title="Installer l'application sur votre téléphone ou ordinateur"
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 shadow-sm active:scale-95 ${
          compact
            ? 'px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            : 'px-3.5 py-2 text-xs md:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-blue-500/20 shadow-md'
        } ${className}`}
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">
          {compact ? 'Installer l\'App' : 'Installer l\'application'}
        </span>
        <Download className="w-3.5 h-3.5 shrink-0 opacity-80" />
      </button>

      {/* Guide Modal for iOS Safari / Unsupported Browsers */}
      {showGuideModal && (
        <div 
          id="pwa-install-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowGuideModal(false)}
        >
          <div 
            id="pwa-install-modal-content"
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Installer CallNet sur mobile
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Accédez à la plateforme en plein écran comme une application native
                  </p>
                </div>
              </div>
              <button
                id="pwa-install-modal-close"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5 text-sm">
              {isIOS ? (
                <>
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 space-y-2.5">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                      Pour iPhone & iPad (Safari) :
                    </p>
                    <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">1</span>
                        <span>Appuyez sur le bouton <strong>Partager</strong> <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-600 dark:text-blue-400" /> dans la barre Safari.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">2</span>
                        <span>Faites défiler vers le bas et sélectionnez <strong>Sur l'écran d'accueil</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-blue-600 dark:text-blue-400" />.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">3</span>
                        <span>Appuyez sur <strong>Ajouter</strong> en haut à droite. L'icône apparaîtra sur votre écran d'accueil !</span>
                      </li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                    Pour Android ou Chrome :
                  </p>
                  <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">1</span>
                      <span>Dans le menu de votre navigateur (<strong>⋮</strong> en haut à droite).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">2</span>
                      <span>Appuyez sur <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</span>
                    </li>
                  </ol>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Fonctionne hors ligne, sans téléchargement d'App Store.</span>
              </div>
            </div>

            <button
              id="pwa-install-modal-dismiss"
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
