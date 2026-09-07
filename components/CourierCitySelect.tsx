import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CourierCity, CourierProvider } from '../types';
import { 
    getCourierCities, 
    findMatchingCourierCity, 
    checkCityCoverage, 
    COURIER_LABELS,
    OZON_EXPRESS_LOGO 
} from '../lib/courierCities';
import { 
    AlertTriangle, 
    CheckCircle2, 
    ChevronDown, 
    Globe, 
    MapPin, 
    Search, 
    Sparkles, 
    Truck, 
    X 
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface CourierCitySelectProps {
    value: string;
    cityId?: string | number;
    onChange: (city: string, cityId: string | number) => void;
    courierProvider?: CourierProvider;
    placeholder?: string;
    className?: string;
    required?: boolean;
    showBadge?: boolean;
    disabled?: boolean;
    allowProviderSwitch?: boolean;
}

export const CourierCitySelect: React.FC<CourierCitySelectProps> = ({
    value,
    cityId,
    onChange,
    courierProvider = 'ozon_express',
    placeholder = 'Sélectionner ou chercher une ville officielle...',
    className = '',
    required = false,
    showBadge = true,
    disabled = false,
    allowProviderSwitch = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeProvider, setActiveProvider] = useState<CourierProvider>(courierProvider);
    const [cities, setCities] = useState<CourierCity[]>(() => getCourierCities(courierProvider));
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync activeProvider with prop when it changes
    useEffect(() => {
        if (courierProvider) {
            setActiveProvider(courierProvider);
        }
    }, [courierProvider]);

    // Fetch official cities for active courier provider from backend
    useEffect(() => {
        let isMounted = true;
        const fetchCities = async () => {
            setIsLoading(true);
            try {
                const endpoint = `/couriers/${activeProvider}/cities`;
                const data = await apiClient.apiFetch<CourierCity[]>(endpoint);
                if (isMounted && Array.isArray(data) && data.length > 0) {
                    setCities(data);
                } else if (isMounted) {
                    setCities(getCourierCities(activeProvider));
                }
            } catch (err) {
                if (isMounted) setCities(getCourierCities(activeProvider));
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchCities();
        return () => { isMounted = false; };
    }, [activeProvider]);

    // Close dropdown when clicked outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Coverage evaluation
    const coverage = useMemo(() => {
        return checkCityCoverage(value, activeProvider, cities);
    }, [value, activeProvider, cities]);

    const filteredCities = useMemo(() => {
        if (!searchTerm.trim()) return cities;
        const query = searchTerm.toLowerCase().trim();
        return cities.filter(c => 
            c.name.toLowerCase().includes(query) || 
            (c.code && c.code.toLowerCase().includes(query)) ||
            (c.aliases && c.aliases.some(a => a.toLowerCase().includes(query))) ||
            String(c.id).includes(query)
        );
    }, [cities, searchTerm]);

    const handleSelectCity = (city: CourierCity) => {
        onChange(city.name, city.id);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setSearchTerm(text);
        
        // Match against active courier's official list
        const autoMatch = findMatchingCourierCity(text, cities);
        if (autoMatch) {
            onChange(autoMatch.name, autoMatch.id);
        } else {
            onChange(text, '');
        }
    };

    const providerLabel = COURIER_LABELS[activeProvider] || 'Transporteur';

    return (
        <div className={`relative space-y-1.5 ${className}`} ref={containerRef}>
            {/* Optional provider switch tab */}
            {allowProviderSwitch && (
                <div className="flex items-center justify-between text-[11px] pb-1 font-mono">
                    <span className="text-text-secondary flex items-center gap-1">
                        <Truck className="w-3 h-3 text-accent" />
                        Grille tarifaire & villes :
                    </span>
                    <select
                        value={activeProvider}
                        onChange={(e) => setActiveProvider(e.target.value as CourierProvider)}
                        className="bg-base-300 text-text-primary px-2 py-0.5 rounded text-[10px] font-bold border border-base-300 focus:outline-none"
                    >
                        <option value="ozon_express">Ozon Express ({getCourierCities('ozon_express').length} villes)</option>
                        <option value="kargo_express">Kargo Express ({getCourierCities('kargo_express').length} villes)</option>
                        <option value="digylog">DIGYLOG ({getCourierCities('digylog').length} villes)</option>
                        <option value="cathedis">Cathedis ({getCourierCities('cathedis').length} hubs)</option>
                        <option value="ameex">Ameex ({getCourierCities('ameex').length} zones)</option>
                    </select>
                </div>
            )}

            {/* Input field */}
            <div className="relative flex items-center">
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? searchTerm : (value || '')}
                    onChange={handleManualInputChange}
                    onFocus={() => {
                        setSearchTerm(value || '');
                        setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className={`w-full p-2.5 pl-8 pr-16 text-xs border rounded-xl bg-base-100 text-text-primary focus:outline-none transition-all ${
                        coverage.isCovered
                            ? 'border-emerald-500/60 dark:border-emerald-500/70 focus:border-emerald-500'
                            : value && value.trim()
                            ? 'border-amber-500/60 focus:border-amber-500'
                            : 'border-base-300 focus:border-accent'
                    }`}
                />

                <MapPin className={`w-3.5 h-3.5 absolute left-2.5 transition-colors ${
                    coverage.isCovered ? 'text-emerald-500' : value ? 'text-amber-500' : 'text-text-secondary'
                }`} />

                <div className="absolute right-2 flex items-center gap-1">
                    {value && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('', '');
                                setSearchTerm('');
                            }}
                            className="p-1 text-text-secondary hover:text-text-primary rounded cursor-pointer"
                            title="Effacer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 text-text-secondary hover:text-text-primary rounded cursor-pointer"
                        tabIndex={-1}
                    >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-accent' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Match / Coverage Status Badge */}
            {showBadge && value && value.trim() && (
                <div className="text-[11px] animate-in fade-in duration-150">
                    {coverage.isCovered ? (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Ville DESSERVIE par {providerLabel} ({coverage.officialName})
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-500/20 rounded-md font-mono font-bold text-[10px] shrink-0">
                                ID API: #{coverage.officialId}
                            </span>
                        </div>
                    ) : (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 space-y-1.5">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>⚠️ Ville NON DESSERVIE par {providerLabel}</span>
                            </div>
                            <p className="text-[11px] text-text-secondary leading-tight">
                                « {value} » ne figure pas dans le répertoire officiel de {providerLabel}. L'envoi direct via API risque d'être rejeté.
                            </p>
                            {coverage.suggestions.length > 0 && (
                                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] text-text-secondary font-semibold">Villes proches :</span>
                                    {coverage.suggestions.map((sug) => (
                                        <button
                                            key={sug.id}
                                            type="button"
                                            onClick={() => handleSelectCity(sug)}
                                            className="px-2 py-0.5 rounded-md bg-base-100 hover:bg-accent/20 hover:text-accent border border-base-300 text-[10px] font-semibold transition-all cursor-pointer"
                                        >
                                            {sug.name} (#{sug.id})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Dropdown list */}
            {isOpen && (
                <div className="absolute z-[80] top-full left-0 right-0 mt-1.5 bg-base-200 border border-base-300 rounded-xl shadow-2xl max-h-64 overflow-y-auto text-xs animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="p-2.5 border-b border-base-300 bg-base-300/40 flex justify-between items-center text-[11px] text-text-secondary sticky top-0 backdrop-blur-md z-10">
                        <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Search className="w-3 h-3 text-accent" />
                            Villes officielles ({filteredCities.length} hubs)
                        </span>
                        <span className="bg-accent/10 border border-accent/30 text-accent px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
                            {activeProvider === 'ozon_express' && (
                                <img src={OZON_EXPRESS_LOGO} alt="" className="w-3 h-3 rounded object-contain bg-white p-0.2 shrink-0" referrerPolicy="no-referrer" />
                            )}
                            Nomenclature {providerLabel}
                        </span>
                    </div>

                    {filteredCities.length === 0 ? (
                        <div className="p-4 text-center text-text-secondary text-xs space-y-2">
                            <p>Aucune ville trouvée pour « {searchTerm} » chez {providerLabel}.</p>
                            <p className="text-[10px] text-amber-500 font-bold">Cette destination n'est pas desservie par ce transporteur.</p>
                        </div>
                    ) : (
                        <div className="py-1 divide-y divide-base-300/40">
                            {filteredCities.slice(0, 80).map((city) => {
                                const isSelected = (value && value.toLowerCase() === city.name.toLowerCase()) || 
                                                   (cityId && String(cityId) === String(city.id));
                                return (
                                    <button
                                        key={`${city.courier || 'city'}-${city.id}-${city.name}`}
                                        type="button"
                                        onClick={() => handleSelectCity(city)}
                                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-accent/10 hover:text-accent transition-colors cursor-pointer ${
                                            isSelected ? 'bg-accent/15 text-accent font-bold' : 'text-text-primary'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-accent' : 'text-text-secondary'}`} />
                                            <div>
                                                <div className="font-semibold">{city.name}</div>
                                                {city.aliases && city.aliases.length > 0 && (
                                                    <div className="text-[9px] text-text-secondary font-normal truncate max-w-[200px]">
                                                        {city.aliases.slice(0, 3).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {city.deliveredPrice !== undefined && city.deliveredPrice > 0 && (
                                                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded font-mono font-bold">
                                                    {city.deliveredPrice} DH
                                                </span>
                                            )}
                                            {city.code && (
                                                <span className="text-[9px] bg-base-300 px-1 py-0.2 rounded text-text-secondary font-mono">
                                                    {city.code}
                                                </span>
                                            )}
                                            <span className="text-[10px] bg-accent/10 text-accent font-mono font-bold px-1.5 py-0.5 rounded">
                                                ID #{city.id}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                            {filteredCities.length > 80 && (
                                <div className="p-2 text-center text-[10px] text-text-secondary bg-base-300/30">
                                    Affichage des 80 premiers résultats sur {filteredCities.length}. Tapez pour affiner.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CourierCitySelect;
