import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogoIcon } from './icons/LogoIcon';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert, Check } from 'lucide-react';

interface LoginProps {
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBack }) => {
    const { login } = useAuth();
    const { t, language } = useLanguage();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const passwordInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        const trimmedPass = password.trim();

        if (!trimmedEmail) {
            setErrorMessage(language === 'fr' ? 'Veuillez saisir votre adresse email ou identifiant.' : 'Please enter your email or username.');
            return;
        }

        if (!trimmedPass) {
            setErrorMessage(language === 'fr' ? 'Veuillez saisir votre mot de passe.' : 'Please enter your password.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const res = await login(trimmedEmail, trimmedPass);
            if (!res.success) {
                setErrorMessage(res.message || (language === 'fr' ? 'Email ou mot de passe incorrect.' : 'Incorrect email or password.'));
            }
        } catch (err: any) {
            setErrorMessage(err.message || (language === 'fr' ? 'Une erreur est survenue lors de la connexion.' : 'An error occurred during sign-in.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-base-100 text-text-primary font-montserrat flex flex-col justify-between p-4 sm:p-6 md:p-8 selection:bg-accent selection:text-white transition-colors overflow-x-hidden">
            
            {/* Top Navigation Bar: Minimalist & Clean */}
            <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
                {onBack ? (
                    <button 
                        onClick={onBack}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-base-200 border border-base-300 transition-all cursor-pointer"
                        title={language === 'fr' ? "Retour à l'accueil" : "Back to home"}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{language === 'fr' ? 'Retour' : 'Back'}</span>
                    </button>
                ) : (
                    <div />
                )}

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <div className="scale-95">
                        <LanguageSelector />
                    </div>
                </div>
            </div>

            {/* Central Card Container */}
            <div className="flex-1 flex items-center justify-center py-8">
                <div className="w-full max-w-md bg-base-200 border border-base-300 rounded-2xl shadow-xl p-8 sm:p-10 space-y-8 transition-all">
                    
                    {/* Brand Presentation */}
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-base-100 border border-base-300 p-2.5 flex items-center justify-center shadow-xs">
                            <LogoIcon className="w-full h-full object-contain" />
                        </div>
                        
                        <div className="space-y-1">
                            <div className="flex items-center justify-center tracking-tight">
                                <span className="font-extrabold text-2xl text-text-primary">CALLNET</span>
                                <span className="font-extrabold text-2xl text-accent">.MA</span>
                            </div>
                            <p className="text-xs text-text-secondary font-medium">
                                {language === 'fr' ? 'Espace de travail sécurisé' : 'Secure Workspace Portal'}
                            </p>
                        </div>
                    </div>

                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5 animate-in fade-in duration-150 font-medium">
                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                            <span className="leading-relaxed">{errorMessage}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email or Username */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                {language === 'fr' ? 'Email ou Identifiant' : 'Email or Username'}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errorMessage) setErrorMessage('');
                                    }}
                                    placeholder={language === 'fr' ? 'nom@callnet.ma ou identifiant' : 'user@callnet.ma or username'}
                                    required
                                    autoFocus
                                    autoComplete="username"
                                    className="w-full pl-10 pr-4 py-3 bg-base-100 text-text-primary placeholder:text-text-secondary/50 border border-base-300 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-sm font-medium transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                {language === 'fr' ? 'Mot de passe' : 'Password'}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    ref={passwordInputRef}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errorMessage) setErrorMessage('');
                                    }}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full pl-10 pr-11 py-3 bg-base-100 text-text-primary placeholder:text-text-secondary/50 border border-base-300 rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-sm font-medium transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                    title={showPassword ? 'Masquer' : 'Afficher'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Remember me option */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-base-300 text-accent focus:ring-accent/30 accent-accent cursor-pointer"
                                />
                                <span className="text-xs font-medium text-text-secondary">
                                    {language === 'fr' ? 'Se souvenir de moi' : 'Remember me'}
                                </span>
                            </label>
                        </div>

                        {/* Submit CTA */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3.5 px-4 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-sm shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.99] cursor-pointer"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>{language === 'fr' ? 'Vérification...' : 'Signing in...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{t('loginButton') || (language === 'fr' ? 'Se connecter' : 'Sign in')}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Bottom Minimalist Footer */}
            <div className="text-center py-4 text-xs text-text-secondary">
                <span>© {new Date().getFullYear()} CALLNET.MA • Plateforme COD Sécurisée</span>
            </div>

        </div>
    );
};

export default Login;
