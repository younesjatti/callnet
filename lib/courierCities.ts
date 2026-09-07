import { CourierCity, CourierProvider } from '../types';
import { OZON_LIVE_CITIES } from './ozonCitiesLive';

export const OZON_EXPRESS_CITIES: CourierCity[] = OZON_LIVE_CITIES;

export const KARGO_EXPRESS_CITIES: CourierCity[] = [
    { id: 101, name: 'Casablanca', code: 'CAS', courier: 'kargo_express', aliases: ['casa', 'dar el beida', 'bouskoura', 'ain sebaa', 'sidi maarouf'] },
    { id: 102, name: 'Rabat', code: 'RAB', courier: 'kargo_express', aliases: ['agdal', 'hay riad', 'rabat centre'] },
    { id: 103, name: 'Marrakech', code: 'RAK', courier: 'kargo_express', aliases: ['marrakesh', 'kech', 'gueliz', 'medina'] },
    { id: 104, name: 'Fes', code: 'FEZ', courier: 'kargo_express', aliases: ['fès', 'fez', 'fes-saiss'] },
    { id: 105, name: 'Kenitra', code: 'KEN', courier: 'kargo_express', aliases: ['kénitra', 'kenitra ville', 'mehdia', 'maamora'] },
    { id: 106, name: 'Tanger', code: 'TNG', courier: 'kargo_express', aliases: ['tangier', 'tanger ville', 'malabata'] },
    { id: 107, name: 'Agadir', code: 'AGA', courier: 'kargo_express', aliases: ['agadir-ida', 'taghazout', 'tikiouine'] },
    { id: 108, name: 'Meknes', code: 'MEK', courier: 'kargo_express', aliases: ['meknès', 'hamria', 'meknes ville'] },
    { id: 109, name: 'Oujda', code: 'OUD', courier: 'kargo_express', aliases: ['oujda-angad', 'oujda ville'] },
    { id: 110, name: 'Tetouan', code: 'TET', courier: 'kargo_express', aliases: ['tétouan', 'martil', 'saniat rmel'] },
    { id: 111, name: 'Safi', code: 'SFI', courier: 'kargo_express', aliases: ['asfi', 'safi ville'] },
    { id: 112, name: 'Mohammedia', code: 'MOH', courier: 'kargo_express', aliases: ['mohammédia', 'fedala'] },
    { id: 113, name: 'El Jadida', code: 'EJD', courier: 'kargo_express', aliases: ['eljadida', 'mazagan', 'sidi bouzid'] },
    { id: 114, name: 'Beni Mellal', code: 'BML', courier: 'kargo_express', aliases: ['béni mellal', 'benimellal'] },
    { id: 115, name: 'Nador', code: 'NDR', courier: 'kargo_express', aliases: ['nador ville', 'beni ansar'] },
    { id: 116, name: 'Taza', code: 'TAZ', courier: 'kargo_express', aliases: ['taza haut', 'taza bas'] },
    { id: 117, name: 'Khemisset', code: 'KHM', courier: 'kargo_express', aliases: ['khémisset', 'zemmour'] },
    { id: 118, name: 'Settat', code: 'SET', courier: 'kargo_express', aliases: ['settat ville', 'chaouia'] },
    { id: 119, name: 'Berrechid', code: 'BRC', courier: 'kargo_express', aliases: ['berchid', 'barchid'] },
    { id: 120, name: 'Larache', code: 'LAR', courier: 'kargo_express', aliases: ['el araich', 'larache ville'] },
    { id: 121, name: 'Ksar El Kebir', code: 'KSK', courier: 'kargo_express', aliases: ['ksar kebir'] },
    { id: 122, name: 'Temara', code: 'TEM', courier: 'kargo_express', aliases: ['témara', 'harhoura'] },
    { id: 123, name: 'Sale', code: 'SLE', courier: 'kargo_express', aliases: ['salé', 'tabriquet', 'sala al jadida'] },
    { id: 124, name: 'Guelmim', code: 'GLM', courier: 'kargo_express', aliases: ['goulimine'] },
    { id: 125, name: 'Laayoune', code: 'EUN', courier: 'kargo_express', aliases: ['laâyoune', 'el aaiun'] },
    { id: 126, name: 'Dakhla', code: 'VIL', courier: 'kargo_express', aliases: ['villa cisneros'] },
    { id: 127, name: 'Ouarzazate', code: 'OZZ', courier: 'kargo_express', aliases: ['warzazat'] },
    { id: 128, name: 'Errachidia', code: 'ERH', courier: 'kargo_express', aliases: ['ksar es souk'] },
    { id: 129, name: 'Taroudant', code: 'TRD', courier: 'kargo_express', aliases: ['taroudannt'] },
    { id: 130, name: 'Berkane', code: 'BRK', courier: 'kargo_express', aliases: ['berkan'] },
    { id: 131, name: 'Al Hoceima', code: 'AHU', courier: 'kargo_express', aliases: ['al hoceïma', 'imzouren'] },
    { id: 132, name: 'Essaouira', code: 'ESU', courier: 'kargo_express', aliases: ['mogador'] },
    { id: 133, name: 'Tiznit', code: 'TZN', courier: 'kargo_express', aliases: ['tiznite'] },
    { id: 134, name: 'Taourirt', code: 'TRT', courier: 'kargo_express', aliases: ['taourirte'] },
    { id: 135, name: 'Sidi Slimane', code: 'SSL', courier: 'kargo_express', aliases: ['sidi slimane gharb'] },
    { id: 136, name: 'Sidi Kacem', code: 'SKC', courier: 'kargo_express', aliases: ['petitjean'] },
    { id: 137, name: 'Khenifra', code: 'KNF', courier: 'kargo_express', aliases: ['khénifra'] },
    { id: 138, name: 'Chefchaouen', code: 'CHF', courier: 'kargo_express', aliases: ['chaouen'] },
    { id: 139, name: 'Martil', code: 'MTL', courier: 'kargo_express', aliases: ['martil plage'] },
    { id: 140, name: 'Fnideq', code: 'FND', courier: 'kargo_express', aliases: ['castillejos'] },
    { id: 141, name: 'Mdiq', code: 'MDQ', courier: 'kargo_express', aliases: ["m'diq", 'rincon'] },
    { id: 142, name: 'Bouznika', code: 'BOU', courier: 'kargo_express', aliases: ['bouznika bay'] },
    { id: 143, name: 'Skhirat', code: 'SKH', courier: 'kargo_express', aliases: ['skhirate'] },
    { id: 144, name: 'Dar Bouazza', code: 'DBZ', courier: 'kargo_express', aliases: ['tamaris'] },
    { id: 145, name: 'Bouskoura', code: 'BSK', courier: 'kargo_express', aliases: ['ville verte'] },
    { id: 146, name: 'Had Soualem', code: 'HSL', courier: 'kargo_express', aliases: ['soualem'] },
    { id: 147, name: 'Sidi Bennour', code: 'SBN', courier: 'kargo_express', aliases: ['sidi bennour'] },
    { id: 148, name: 'Benguerir', code: 'BGR', courier: 'kargo_express', aliases: ['ben guerir'] },
    { id: 149, name: 'El Kelaa des Sraghna', code: 'KLS', courier: 'kargo_express', aliases: ['kelaa des sraghna', 'el kelaa'] },
    { id: 150, name: 'Inezgane', code: 'INZ', courier: 'kargo_express', aliases: ['inezgane agadir', 'ait melloul'] }
];

export const CATHEDIS_CITIES: CourierCity[] = [
    { id: 'CAS-01', name: 'CASABLANCA', code: 'CAS', courier: 'cathedis', aliases: ['casablanca', 'casa', 'dar bouazza', 'bouskoura'] },
    { id: 'RAB-02', name: 'RABAT', code: 'RAB', courier: 'cathedis', aliases: ['rabat', 'agdal', 'hay riad', 'temara'] },
    { id: 'KEN-03', name: 'KENITRA', code: 'KEN', courier: 'cathedis', aliases: ['kenitra', 'kénitra', 'kenitra ville', 'mehdia'] },
    { id: 'RAK-04', name: 'MARRAKECH', code: 'RAK', courier: 'cathedis', aliases: ['marrakech', 'marrakesh', 'gueliz'] },
    { id: 'TNG-05', name: 'TANGER', code: 'TNG', courier: 'cathedis', aliases: ['tanger', 'tangier', 'malabata'] },
    { id: 'FEZ-06', name: 'FES', code: 'FEZ', courier: 'cathedis', aliases: ['fès', 'fes', 'fez'] },
    { id: 'MEK-07', name: 'MEKNES', code: 'MEK', courier: 'cathedis', aliases: ['meknès', 'meknes', 'hamria'] },
    { id: 'AGA-08', name: 'AGADIR', code: 'AGA', courier: 'cathedis', aliases: ['agadir', 'inezgane', 'ait melloul'] },
    { id: 'OUD-09', name: 'OUJDA', code: 'OUD', courier: 'cathedis', aliases: ['oujda', 'oujda-angad'] },
    { id: 'TET-10', name: 'TETOUAN', code: 'TET', courier: 'cathedis', aliases: ['tétouan', 'tetouan', 'martil'] },
    { id: 'SFI-11', name: 'SAFI', code: 'SFI', courier: 'cathedis', aliases: ['safi', 'asfi'] },
    { id: 'MOH-12', name: 'MOHAMMEDIA', code: 'MOH', courier: 'cathedis', aliases: ['mohammedia', 'mohammédia'] },
    { id: 'EJD-13', name: 'EL JADIDA', code: 'EJD', courier: 'cathedis', aliases: ['el jadida', 'eljadida'] },
    { id: 'BML-14', name: 'BENI MELLAL', code: 'BML', courier: 'cathedis', aliases: ['béni mellal', 'beni mellal'] },
    { id: 'NDR-15', name: 'NADOR', code: 'NDR', courier: 'cathedis', aliases: ['nador', 'beni ansar'] },
    { id: 'TAZ-16', name: 'TAZA', code: 'TAZ', courier: 'cathedis', aliases: ['taza'] },
    { id: 'SET-17', name: 'SETTAT', code: 'SET', courier: 'cathedis', aliases: ['settat'] },
    { id: 'BRC-18', name: 'BERRECHID', code: 'BRC', courier: 'cathedis', aliases: ['berrechid'] },
    { id: 'LAR-19', name: 'LARACHE', code: 'LAR', courier: 'cathedis', aliases: ['larache'] },
    { id: 'EUN-20', name: 'LAAYOUNE', code: 'EUN', courier: 'cathedis', aliases: ['laâyoune', 'laayoune'] }
];

export const AMEEX_CITIES: CourierCity[] = [
    { id: 201, name: 'Casablanca (Centre + Périphérie)', code: 'CAS', courier: 'ameex', aliases: ['casablanca', 'casa', 'dar bouazza', 'bouskoura', 'mohammedia'] },
    { id: 202, name: 'Rabat - Salé - Témara', code: 'RAB', courier: 'ameex', aliases: ['rabat', 'sale', 'temara', 'salé', 'témara', 'agdal'] },
    { id: 203, name: 'Kénitra & Région', code: 'KEN', courier: 'ameex', aliases: ['kenitra', 'kénitra', 'kenitra ville', 'mehdia', 'sidi taibi'] },
    { id: 204, name: 'Marrakech Ville & Palmeraie', code: 'RAK', courier: 'ameex', aliases: ['marrakech', 'marrakesh', 'gueliz', 'tamansourt'] },
    { id: 205, name: 'Tanger Centre & Zones', code: 'TNG', courier: 'ameex', aliases: ['tanger', 'tangier', 'tanger med', 'gzennaya'] },
    { id: 206, name: 'Fès Ville Nouvelle & Médina', code: 'FEZ', courier: 'ameex', aliases: ['fes', 'fès', 'fez', 'zouagha'] },
    { id: 207, name: 'Meknès & Hamria', code: 'MEK', courier: 'ameex', aliases: ['meknes', 'meknès', 'toulal'] },
    { id: 208, name: 'Grand Agadir & Inezgane', code: 'AGA', courier: 'ameex', aliases: ['agadir', 'inezgane', 'ait melloul', 'dcheira', 'taghazout'] },
    { id: 209, name: 'Oujda & Berkane', code: 'OUD', courier: 'ameex', aliases: ['oujda', 'berkane', 'ahfir'] },
    { id: 210, name: 'Tétouan - Mdiq - Martil', code: 'TET', courier: 'ameex', aliases: ['tetouan', 'tétouan', 'martil', 'mdiq', 'fnideq'] },
    { id: 211, name: 'El Jadida & Sidi Bouzid', code: 'EJD', courier: 'ameex', aliases: ['el jadida', 'eljadida', 'azemmour'] },
    { id: 212, name: 'Safi & Région', code: 'SFI', courier: 'ameex', aliases: ['safi', 'asfi'] },
    { id: 213, name: 'Béni Mellal & Fquih Ben Salah', code: 'BML', courier: 'ameex', aliases: ['beni mellal', 'béni mellal', 'fquih ben salah'] },
    { id: 214, name: 'Nador & Selouane', code: 'NDR', courier: 'ameex', aliases: ['nador', 'selouane', 'al aaroui'] }
];

export const DIGYLOG_LOGO = 'https://ywycwjkkjmlxrwohkgas.supabase.co/storage/v1/object/public/callnet%20assets/digylog.svg';

export const DIGYLOG_CITIES: CourierCity[] = [
    { id: 1, name: 'Casablanca', code: 'CAS', courier: 'digylog', aliases: ['casa', 'dar el beida', 'bouskoura', 'ain sebaa', 'sidi maarouf', 'californie', 'maarif', 'anfa'] },
    { id: 2, name: 'Rabat', code: 'RAB', courier: 'digylog', aliases: ['agdal', 'hay riad', 'rabat centre', 'hassan', 'souissi'] },
    { id: 3, name: 'Marrakech', code: 'RAK', courier: 'digylog', aliases: ['marrakesh', 'kech', 'gueliz', 'medina', 'palmeraie', 'targa'] },
    { id: 4, name: 'Tanger', code: 'TNG', courier: 'digylog', aliases: ['tangier', 'tanger ville', 'malabata', 'boukhalef', 'iberia'] },
    { id: 5, name: 'Fes', code: 'FEZ', courier: 'digylog', aliases: ['fès', 'fez', 'fes-saiss', 'narjiss', 'route ain chkef'] },
    { id: 6, name: 'Agadir', code: 'AGA', courier: 'digylog', aliases: ['agadir-ida', 'taghazout', 'tikiouine', 'dakhla agadir', 'hay mohammadi'] },
    { id: 7, name: 'Kenitra', code: 'KEN', courier: 'digylog', aliases: ['kénitra', 'kenitra ville', 'mehdia', 'maamora', 'mimosa'] },
    { id: 8, name: 'Meknes', code: 'MEK', courier: 'digylog', aliases: ['meknès', 'hamria', 'meknes ville', 'marjane'] },
    { id: 9, name: 'Oujda', code: 'OUD', courier: 'digylog', aliases: ['oujda-angad', 'oujda ville', 'lazaret'] },
    { id: 10, name: 'Tetouan', code: 'TET', courier: 'digylog', aliases: ['tétouan', 'martil', 'saniat rmel', 'wilaya'] },
    { id: 11, name: 'Sale', code: 'SLE', courier: 'digylog', aliases: ['salé', 'tabriquet', 'sala al jadida', 'bettana'] },
    { id: 12, name: 'Temara', code: 'TEM', courier: 'digylog', aliases: ['témara', 'harhoura', 'massira', 'wissal'] },
    { id: 13, name: 'Mohammedia', code: 'MOH', courier: 'digylog', aliases: ['mohammédia', 'fedala', 'monica', 'kasbah'] },
    { id: 14, name: 'El Jadida', code: 'EJD', courier: 'digylog', aliases: ['eljadida', 'mazagan', 'sidi bouzid'] },
    { id: 15, name: 'Safi', code: 'SFI', courier: 'digylog', aliases: ['asfi', 'safi ville', 'biada'] },
    { id: 16, name: 'Beni Mellal', code: 'BML', courier: 'digylog', aliases: ['béni mellal', 'benimellal'] },
    { id: 17, name: 'Nador', code: 'NDR', courier: 'digylog', aliases: ['nador ville', 'beni ansar', 'selouane'] },
    { id: 18, name: 'Taza', code: 'TAZ', courier: 'digylog', aliases: ['taza haut', 'taza bas'] },
    { id: 19, name: 'Settat', code: 'SET', courier: 'digylog', aliases: ['settat ville', 'chaouia'] },
    { id: 20, name: 'Berrechid', code: 'BRC', courier: 'digylog', aliases: ['berchid', 'barchid'] },
    { id: 21, name: 'Khemisset', code: 'KHM', courier: 'digylog', aliases: ['khémisset', 'zemmour'] },
    { id: 22, name: 'Larache', code: 'LAR', courier: 'digylog', aliases: ['el araich', 'larache ville'] },
    { id: 23, name: 'Ksar El Kebir', code: 'KSK', courier: 'digylog', aliases: ['ksar kebir'] },
    { id: 24, name: 'Guelmim', code: 'GLM', courier: 'digylog', aliases: ['goulimine'] },
    { id: 25, name: 'Laayoune', code: 'EUN', courier: 'digylog', aliases: ['laâyoune', 'el aaiun'] },
    { id: 26, name: 'Dakhla', code: 'VIL', courier: 'digylog', aliases: ['villa cisneros'] },
    { id: 27, name: 'Ouarzazate', code: 'OZZ', courier: 'digylog', aliases: ['warzazat', 'skoura'] },
    { id: 28, name: 'Errachidia', code: 'ERH', courier: 'digylog', aliases: ['ksar es souk', 'erfoud'] },
    { id: 29, name: 'Taroudant', code: 'TRD', courier: 'digylog', aliases: ['taroudannt'] },
    { id: 30, name: 'Berkane', code: 'BRK', courier: 'digylog', aliases: ['berkan', 'saidia'] },
    { id: 31, name: 'Al Hoceima', code: 'AHU', courier: 'digylog', aliases: ['al hoceïma', 'imzouren'] },
    { id: 32, name: 'Essaouira', code: 'ESU', courier: 'digylog', aliases: ['mogador'] },
    { id: 33, name: 'Tiznit', code: 'TZN', courier: 'digylog', aliases: ['tiznite'] },
    { id: 34, name: 'Taourirt', code: 'TRT', courier: 'digylog', aliases: ['taourirte'] },
    { id: 35, name: 'Sidi Slimane', code: 'SSL', courier: 'digylog', aliases: ['sidi slimane gharb'] },
    { id: 36, name: 'Sidi Kacem', code: 'SKC', courier: 'digylog', aliases: ['petitjean'] },
    { id: 37, name: 'Khenifra', code: 'KNF', courier: 'digylog', aliases: ['khénifra'] },
    { id: 38, name: 'Chefchaouen', code: 'CHF', courier: 'digylog', aliases: ['chaouen'] },
    { id: 39, name: 'Martil', code: 'MTL', courier: 'digylog', aliases: ['martil plage'] },
    { id: 40, name: 'Fnideq', code: 'FND', courier: 'digylog', aliases: ['castillejos'] },
    { id: 41, name: 'Mdiq', code: 'MDQ', courier: 'digylog', aliases: ["m'diq", 'rincon'] },
    { id: 42, name: 'Bouznika', code: 'BOU', courier: 'digylog', aliases: ['bouznika bay'] },
    { id: 43, name: 'Skhirat', code: 'SKH', courier: 'digylog', aliases: ['skhirate'] },
    { id: 44, name: 'Dar Bouazza', code: 'DBZ', courier: 'digylog', aliases: ['tamaris', 'darbouazza'] },
    { id: 45, name: 'Bouskoura', code: 'BSK', courier: 'digylog', aliases: ['ville verte'] },
    { id: 46, name: 'Had Soualem', code: 'HSL', courier: 'digylog', aliases: ['soualem'] },
    { id: 47, name: 'Sidi Bennour', code: 'SBN', courier: 'digylog', aliases: ['sidi bennour'] },
    { id: 48, name: 'Benguerir', code: 'BGR', courier: 'digylog', aliases: ['ben guerir'] },
    { id: 49, name: 'El Kelaa des Sraghna', code: 'KLS', courier: 'digylog', aliases: ['kelaa des sraghna', 'el kelaa'] },
    { id: 50, name: 'Inezgane', code: 'INZ', courier: 'digylog', aliases: ['inezgane agadir', 'ait melloul', 'dcheira'] }
];

export const OFFICIAL_MOROCCAN_COURIER_CITIES: CourierCity[] = OZON_EXPRESS_CITIES;

export const OZON_EXPRESS_LOGO = 'https://ywycwjkkjmlxrwohkgas.supabase.co/storage/v1/object/public/callnet%20assets/1781020774720-ozon.webp';

export const COURIER_LOGOS: Record<CourierProvider, string | null> = {
    ozon_express: OZON_EXPRESS_LOGO,
    kargo_express: null,
    digylog: DIGYLOG_LOGO,
    cathedis: null,
    ameex: null,
    irsaliyat: null,
    onessta: null,
    forcelog: null,
    chrono_diali: null,
    sendit: null,
    ecotrack: null,
    ozone: OZON_EXPRESS_LOGO,
    custom_api: null
};

export const COURIER_LABELS: Record<CourierProvider, string> = {
    ozon_express: 'Ozon Express',
    kargo_express: 'Kargo Express',
    digylog: 'DIGYLOG',
    cathedis: 'Cathedis',
    ameex: 'Ameex',
    irsaliyat: 'Irsaliyat',
    onessta: 'Onessta',
    forcelog: 'Forcelog',
    chrono_diali: 'Chrono Diali',
    sendit: 'Sendit',
    ecotrack: 'EcoTrack / Sendit',
    ozone: 'Ozone',
    custom_api: 'API Personnalisée'
};

/**
 * Retourne le catalogue des villes officielles en fonction de la société de livraison sélectionnée
 */
export function getCourierCities(courier?: CourierProvider | string): CourierCity[] {
    const key = String(courier || '').toLowerCase().trim();
    if (key === 'digylog' || key === 'digi' || key === 'digylog_express') {
        return DIGYLOG_CITIES;
    }
    if (key === 'kargo_express' || key === 'kargo') {
        return KARGO_EXPRESS_CITIES;
    }
    if (key === 'cathedis') {
        return CATHEDIS_CITIES;
    }
    if (key === 'ameex') {
        return AMEEX_CITIES;
    }
    if (key === 'ecotrack' || key === 'sendit') {
        return KARGO_EXPRESS_CITIES;
    }
    // Default to Ozon Express (most exhaustive 110 cities catalog)
    return OZON_EXPRESS_CITIES;
}

/**
 * Nettoie une chaîne de texte de ville (supprime accents, tirets, ponctuation, espaces multiples)
 */
export function cleanCityString(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrait la racine principale d'un nom de ville (supprime 'ville', 'city', 'centre', 'ville de', etc.)
 */
export function cleanCityRoot(str: string): string {
    return cleanCityString(str)
        .replace(/\b(ville de|ville|city|centre|center|region|province|plage|grand|haut|bas)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Recherche et fait correspondre une ville saisie avec la liste officielle de la société de livraison
 */
export function findMatchingCourierCity(
    rawCityName: string, 
    courierOrList?: CourierProvider | CourierCity[]
): CourierCity | null {
    if (!rawCityName || typeof rawCityName !== 'string') return null;
    const cleanInput = cleanCityString(rawCityName);
    if (!cleanInput) return null;
    const cleanRoot = cleanCityRoot(rawCityName);

    let list: CourierCity[] = OZON_EXPRESS_CITIES;
    if (Array.isArray(courierOrList)) {
        list = courierOrList.length > 0 ? courierOrList : OZON_EXPRESS_CITIES;
    } else if (typeof courierOrList === 'string') {
        list = getCourierCities(courierOrList as CourierProvider);
    }

    // 1. Exact match on clean name
    const exactNameMatch = list.find(c => cleanCityString(c.name) === cleanInput);
    if (exactNameMatch) return exactNameMatch;

    // 2. Exact match on Code
    const codeMatch = list.find(c => c.code && cleanCityString(c.code) === cleanInput);
    if (codeMatch) return codeMatch;

    // 3. Match on aliases
    const aliasMatch = list.find(c => 
        c.aliases && c.aliases.some(alias => cleanCityString(alias) === cleanInput)
    );
    if (aliasMatch) return aliasMatch;

    // 4. Root match (e.g., 'kenitra' <=> 'kenitra ville')
    if (cleanRoot) {
        const rootNameMatch = list.find(c => cleanCityRoot(c.name) === cleanRoot);
        if (rootNameMatch) return rootNameMatch;

        const rootAliasMatch = list.find(c => 
            c.aliases && c.aliases.some(alias => cleanCityRoot(alias) === cleanRoot)
        );
        if (rootAliasMatch) return rootAliasMatch;
    }

    // 5. Starts with match or substring match
    const startsMatch = list.find(c => {
        const cleanName = cleanCityString(c.name);
        return cleanInput.startsWith(cleanName) || cleanName.startsWith(cleanInput);
    });
    if (startsMatch) return startsMatch;

    // 6. Contains match in aliases or name
    const partialMatch = list.find(c => {
        const cleanName = cleanCityString(c.name);
        if (cleanInput.includes(cleanName) || cleanName.includes(cleanInput)) return true;
        if (c.aliases) {
            return c.aliases.some(alias => {
                const cleanAlias = cleanCityString(alias);
                return cleanInput.includes(cleanAlias) || cleanAlias.includes(cleanInput);
            });
        }
        return false;
    });
    if (partialMatch) return partialMatch;

    return null;
}

export interface CityCoverageResult {
    isCovered: boolean;
    matchedCity: CourierCity | null;
    officialName: string;
    officialId: string | number;
    providerLabel: string;
    suggestions: CourierCity[];
    isApproximate?: boolean;
}

/**
 * Vérifie avec précision si une ville client est DESSERVIE ou NON DESSERVIE par la société de livraison
 */
export function checkCityCoverage(
    rawCityName: string,
    courier?: CourierProvider | string,
    customList?: CourierCity[]
): CityCoverageResult {
    const providerKey = (courier as CourierProvider) || 'ozon_express';
    const providerLabel = COURIER_LABELS[providerKey] || 'Transporteur';
    const list = customList && customList.length > 0 ? customList : getCourierCities(providerKey);

    if (!rawCityName || !rawCityName.trim()) {
        return {
            isCovered: false,
            matchedCity: null,
            officialName: '',
            officialId: '',
            providerLabel,
            suggestions: list.slice(0, 5)
        };
    }

    const matched = findMatchingCourierCity(rawCityName, list);
    if (matched) {
        return {
            isCovered: true,
            matchedCity: matched,
            officialName: matched.name,
            officialId: matched.id,
            providerLabel,
            suggestions: []
        };
    }

    // Not served - find approximate suggestions (closest hubs)
    const clean = cleanCityString(rawCityName);
    const cleanRootVal = cleanCityRoot(rawCityName);
    const suggestions = list.filter(c => {
        const cClean = cleanCityString(c.name);
        return cClean.startsWith(clean.slice(0, 3)) || (cleanRootVal && cClean.includes(cleanRootVal.slice(0, 3)));
    }).slice(0, 4);

    return {
        isCovered: false,
        matchedCity: null,
        officialName: rawCityName.trim(),
        officialId: '',
        providerLabel,
        suggestions: suggestions.length > 0 ? suggestions : list.slice(0, 4)
    };
}

/**
 * Normalise le nom et l'ID de la ville pour correspondre aux exigences API du transporteur
 */
export function normalizeCityForCourier(
    rawCityName: string, 
    courierOrList?: CourierProvider | CourierCity[]
): { name: string; id: string | number; isExactMatch: boolean; isCovered: boolean } {
    const matched = findMatchingCourierCity(rawCityName, courierOrList);
    if (matched) {
        return {
            name: matched.name,
            id: matched.id,
            isExactMatch: true,
            isCovered: true
        };
    }

    // Default fallback
    const trimmed = String(rawCityName || '').trim();
    return {
        name: trimmed || 'Casablanca',
        id: '1',
        isExactMatch: false,
        isCovered: false
    };
}
