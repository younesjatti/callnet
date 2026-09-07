import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Headphones, 
  Zap, 
  Layers, 
  X,
  Sparkles,
  PhoneCall,
  Truck
} from 'lucide-react';

interface HomeProps {
  onLogin: () => void;
}

export const Home: React.FC<HomeProps> = ({ onLogin }) => {
  const { t, language } = useLanguage();
  const [showServicesModal, setShowServicesModal] = useState(false);

  const services = [
    {
      icon: PhoneCall,
      title: language === 'fr' ? 'Confirmation de Commandes' : language === 'ar' ? 'تأكيد الطلبيات' : 'Order Confirmation',
      desc: language === 'fr' ? 'Traitement ultra-rapide des prospects avec un taux de confirmation moyen supérieur à 85%.' : language === 'ar' ? 'معالجة فورية للطلبات بنسبة تأكيد تفوق 85%.' : 'Ultra-fast lead processing with confirmation rates over 85%.',
      stat: '+85%',
      label: language === 'fr' ? 'Taux moyen' : 'Average rate'
    },
    {
      icon: TrendingUp,
      title: language === 'fr' ? 'Upsell & Panier Moyen' : language === 'ar' ? 'البيع الإضافي' : 'Upsell & Cross-sell',
      desc: language === 'fr' ? 'Augmentation stratégique de la valeur moyenne de chaque commande lors de l’appel de confirmation.' : language === 'ar' ? 'زيادة قيمة سلة المشتريات أثناء مكالمة التأكيد.' : 'Strategic increase in average basket value during confirmation calls.',
      stat: '+28%',
      label: language === 'fr' ? 'Panier moyen' : 'Average basket'
    },
    {
      icon: Headphones,
      title: language === 'fr' ? 'Support Client & Suivi' : language === 'ar' ? 'خدمة العملاء' : 'Customer Support & Tracking',
      desc: language === 'fr' ? 'Gestion proactive des réclamations et suivi personnalisé pour réduire le taux de retour.' : language === 'ar' ? 'متابعة دقيقة واستباقية لتقليل نسبة المرتجعات.' : 'Proactive inquiry handling and personal tracking to minimize returns.',
      stat: '24/7',
      label: language === 'fr' ? 'Disponibilité' : 'Availability'
    },
    {
      icon: Truck,
      title: language === 'fr' ? 'Expédition Multi-Transporteurs' : language === 'ar' ? 'ربط شركات الشحن' : 'Carrier Integration',
      desc: language === 'fr' ? 'Génération automatique de bordereaux et synchronisation directe avec vos feuilles Google Sheets.' : language === 'ar' ? 'توليد بوليصات الشحن ومزامنة مباشرة مع غوغل شيت.' : 'Automated waybill generation and direct real-time Google Sheets sync.',
      stat: '100%',
      label: language === 'fr' ? 'Automatisé' : 'Automated'
    }
  ];

  return (
    <div className="min-h-full w-full bg-base-100 text-text-primary font-montserrat flex flex-col justify-between selection:bg-accent selection:text-white transition-colors pb-12">
      {/* Top Minimalist Header */}
      <header className="sticky top-0 z-40 w-full bg-base-200/80 backdrop-blur-md border-b border-base-300 px-6 py-4 lg:px-12 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-base-100 border border-base-300 p-1.5 flex items-center justify-center shadow-sm group-hover:border-accent/40 transition-colors">
              <LogoIcon className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center tracking-tight">
              <span className="font-extrabold text-lg text-text-primary">CALLNET</span>
              <span className="font-extrabold text-lg text-accent">.MA</span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wide uppercase text-text-secondary">
            <button 
              onClick={() => setShowServicesModal(true)}
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              {language === 'fr' ? 'Services' : language === 'ar' ? 'الخدمات' : 'Services'}
            </button>
            <button 
              onClick={() => setShowServicesModal(true)}
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              {language === 'fr' ? 'Solutions COD' : language === 'ar' ? 'حلول الدفع' : 'COD Solutions'}
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {language === 'fr' ? 'Réseau opérationnel' : language === 'ar' ? 'الشبكة نشطة' : 'Network Active'}
            </span>
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            <PWAInstallButton compact />
            <ThemeToggle />
            <div className="scale-95 hidden xs:block">
              <LanguageSelector />
            </div>
            <button 
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-accent text-white hover:bg-accent/90 text-xs sm:text-sm font-semibold tracking-wide shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>{t('loginButton') || (language === 'fr' ? 'Connexion' : language === 'ar' ? 'دخول' : 'Sign in')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero & Value Proposition */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 sm:py-20 lg:py-24 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Minimalist Content */}
          <div className="lg:col-span-7 flex flex-col items-start space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'fr' ? 'Plateforme de Confirmation & Logistique COD' : language === 'ar' ? 'منصة تأكيد الطلبيات والشحن' : 'E-Commerce COD & Call Center Platform'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.15]">
              {language === 'fr' ? (
                <>
                  La confirmation e-commerce, <br className="hidden sm:inline" />
                  <span className="text-accent">élégante et sans friction.</span>
                </>
              ) : language === 'ar' ? (
                <>
                  تأكيد طلبيات التجارة الإلكترونية، <br className="hidden sm:inline" />
                  <span className="text-accent">بسرعة واحترافية فائقة.</span>
                </>
              ) : (
                <>
                  E-commerce confirmation, <br className="hidden sm:inline" />
                  <span className="text-accent">seamless &amp; precise.</span>
                </>
              )}
            </h1>

            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl font-normal">
              {language === 'fr'
                ? "Gérez vos commandes, synchronisez instantanément vos Google Sheets et expédiez avec vos transporteurs favoris depuis une interface minimaliste pensée pour la performance."
                : language === 'ar'
                ? "إدارة متكاملة لطلبيات متجرك، مزامنة فورية مع ملفات غوغل شيت، وإرسال مباشر لشركات التوصيل عبر واجهة مستخدم سريعة وعصرية."
                : "Manage orders, synchronize live Google Sheets, and dispatch to top carriers within a streamlined, performance-driven interface."
              }
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto pt-2">
              <button 
                onClick={onLogin}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-accent text-white font-semibold text-sm shadow-sm hover:bg-accent/90 hover:shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span>{language === 'fr' ? 'Accéder à la plateforme' : language === 'ar' ? 'الدخول إلى المنصة' : 'Enter Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setShowServicesModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-base-200 border border-base-300 text-text-primary hover:bg-base-300/60 font-semibold text-sm transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-text-secondary" />
                <span>{language === 'fr' ? 'Découvrir nos solutions' : language === 'ar' ? 'حلولنا وخدماتنا' : 'View Solutions'}</span>
              </button>
            </div>

            {/* Micro Trust Indicators */}
            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-text-secondary font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{language === 'fr' ? 'Sync Google Sheets bidirectionnelle' : 'Two-way Google Sheets Sync'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{language === 'fr' ? 'Téléopérateurs experts en dialecte' : 'Expert native agents'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Minimalist Live Dashboard Preview */}
          <div className="lg:col-span-5 w-full">
            <div className="relative rounded-2xl bg-base-200 border border-base-300 p-6 sm:p-8 shadow-xl overflow-hidden transition-all hover:shadow-2xl">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-6 border-b border-base-300">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    {language === 'fr' ? 'Activité en temps réel' : 'Real-time Feed'}
                  </span>
                </div>
                <span className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                  Callnet Engine 2.0
                </span>
              </div>

              {/* Central Key Numbers */}
              <div className="py-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-base-100 border border-base-300/80">
                  <span className="text-xs text-text-secondary font-medium block mb-1">
                    {language === 'fr' ? 'Confirmation' : 'Confirmed'}
                  </span>
                  <div className="text-3xl font-extrabold text-text-primary tracking-tight">
                    87.4%
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 inline-block">
                    +4.2% vs moyenne
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-base-100 border border-base-300/80">
                  <span className="text-xs text-text-secondary font-medium block mb-1">
                    {language === 'fr' ? 'Livraison Finale' : 'Delivered'}
                  </span>
                  <div className="text-3xl font-extrabold text-text-primary tracking-tight">
                    82.1%
                  </div>
                  <span className="text-[11px] font-semibold text-accent mt-1 inline-block">
                    Ozon • Kargo • Cathedis
                  </span>
                </div>
              </div>

              {/* Minimal Sparkline representation */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-text-secondary font-medium">
                  <span>{language === 'fr' ? 'Flux de confirmation quotidien' : 'Daily Volume'}</span>
                  <span className="font-semibold text-text-primary">1 420 commandes/j</span>
                </div>
                <div className="h-2 w-full bg-base-300 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full w-[85%] transition-all duration-1000"></div>
                </div>
              </div>

              {/* Active operators pill strip */}
              <div className="mt-6 pt-4 border-t border-base-300 flex items-center justify-between text-xs text-text-secondary">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-base-200 bg-accent/20 text-accent font-bold text-[10px] flex items-center justify-center">C</span>
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-base-200 bg-emerald-500/20 text-emerald-600 font-bold text-[10px] flex items-center justify-center">O</span>
                    <span className="inline-block h-6 w-6 rounded-full ring-2 ring-base-200 bg-amber-500/20 text-amber-600 font-bold text-[10px] flex items-center justify-center">D</span>
                  </div>
                  <span className="font-medium">{language === 'fr' ? '18 téléopérateurs actifs' : '18 active agents'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{language === 'fr' ? 'En ligne' : 'Connected'}</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Minimalist Stats Strip */}
        <div className="mt-16 sm:mt-24 pt-12 border-t border-base-300 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {services.map((srv, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
                {srv.stat}
              </div>
              <div className="text-xs font-semibold text-accent uppercase tracking-wider">
                {srv.title}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed hidden sm:block pt-1">
                {srv.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Services Minimalist Modal */}
      {showServicesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-base-200 border border-base-300 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative text-text-primary">
            
            <div className="flex items-center justify-between pb-4 border-b border-base-300">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">Solutions &amp; Écosystème</span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-text-primary">Services Callnet</h3>
              </div>
              <button 
                onClick={() => setShowServicesModal(false)}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-base-300 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((srv, idx) => {
                const IconComponent = srv.icon;
                return (
                  <div key={idx} className="p-5 rounded-xl bg-base-100 border border-base-300 hover:border-accent/40 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-extrabold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                        {srv.stat}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-text-primary pt-1">{srv.title}</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{srv.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-base-300 flex items-center justify-end gap-3">
              <button 
                onClick={() => { setShowServicesModal(false); onLogin(); }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-accent text-white font-semibold text-xs uppercase tracking-wider hover:bg-accent/90 transition-all cursor-pointer shadow-sm"
              >
                {language === 'fr' ? 'Accéder à mon compte' : 'Open Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimalist Footer */}
      <footer className="w-full border-t border-base-300 py-6 px-6 lg:px-12 bg-base-200/50 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">CALLNET.MA</span>
            <span>— Plateforme de confirmation COD</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Sécurité SSL &amp; Données chiffrées</span>
            <span>© {new Date().getFullYear()} Tous droits réservés</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
