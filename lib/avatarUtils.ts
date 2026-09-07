import { Role, User } from '../types';
import { normalizeRole } from '../utils';

export interface AvatarPreset {
    id: string;
    name: string;
    url: string;
    role: Role;
    description: string;
    badge?: string;
}

export const ROLE_AVATAR_PRESETS: AvatarPreset[] = [
    // --- AGENTS DE CONFIRMATION (CALL CENTER AVEC CASQUE) ---
    {
        id: 'agent-headset-1',
        name: 'Agent Téléopératrice (Micro-casque)',
        url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80',
        role: Role.Agent,
        description: 'Agent de confirmation avec micro-casque professionnel',
        badge: '🎧 Casque Pro'
    },
    {
        id: 'agent-headset-2',
        name: 'Agent Téléopérateur (Micro-casque)',
        url: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=200&auto=format&fit=crop&q=80',
        role: Role.Agent,
        description: 'Téléconseiller call center avec casque audio',
        badge: '🎧 Casque Call Center'
    },
    {
        id: 'agent-headset-3',
        name: 'Téléconseillère Support',
        url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&auto=format&fit=crop&q=80',
        role: Role.Agent,
        description: 'Support téléphonique & qualification des commandes',
        badge: '🎧 Téléopérateur'
    },
    {
        id: 'agent-headset-4',
        name: 'Confirmateur Qualifié',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        role: Role.Agent,
        description: 'Agent expérimenté confirmation des commandes',
        badge: '🎧 Opérateur'
    },

    // --- CLIENTS (BOUTIQUES E-COMMERCE) ---
    {
        id: 'client-store-1',
        name: 'Gérant E-commerce',
        url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80',
        role: Role.Client,
        description: 'Propriétaire & Responsable Boutique en ligne',
        badge: '🛍️ Boutique'
    },
    {
        id: 'client-store-2',
        name: 'Responsable Ventes',
        url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        role: Role.Client,
        description: 'Gestionnaire de catalogue & commandes',
        badge: '🛍️ Vendeur'
    },
    {
        id: 'client-store-3',
        name: 'Boutique Mode & Cosmétiques',
        url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
        role: Role.Client,
        description: 'Marque E-commerce produits de beauté & mode',
        badge: '✨ Marque'
    },
    {
        id: 'client-store-4',
        name: 'Directeur Commercial E-commerce',
        url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
        role: Role.Client,
        description: 'Gestionnaire multi-boutiques',
        badge: '💼 E-com Pro'
    },

    // --- MANAGERS & SUPERVISEURS CALL CENTER ---
    {
        id: 'manager-1',
        name: 'Manager Call Center (Superviseuse)',
        url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        role: Role.Manager,
        description: 'Responsable des opérations et supervision des opérateurs',
        badge: '👔 Manager Ops'
    },
    {
        id: 'manager-2',
        name: 'Superviseur Équipe Confirmation',
        url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
        role: Role.Manager,
        description: 'Coach de performance et dispatching des commandes',
        badge: '🎯 Superviseur'
    },
    {
        id: 'manager-3',
        name: 'Responsable Qualité & Ventes',
        url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
        role: Role.Manager,
        description: 'Audit des appels et optimisation du taux de confirmation',
        badge: '📊 Coach Ventes'
    },

    // --- ADMINISTRATEURS ---
    {
        id: 'admin-1',
        name: 'Superviseur Général CallNet',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        role: Role.Admin,
        description: 'Gestion globale de la plateforme & équipe',
        badge: '🛡️ Admin'
    },
    {
        id: 'admin-2',
        name: 'Administrateur Opérations',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        role: Role.Admin,
        description: 'Supervision technique et financière',
        badge: '🛡️ Superviseur'
    }
];

export const getAvatarPresetsForRole = (rawRole: any): AvatarPreset[] => {
    const norm = normalizeRole(rawRole);
    return ROLE_AVATAR_PRESETS.filter(p => normalizeRole(p.role) === norm);
};

/**
 * Retourne l'avatar par défaut correspondant au rôle d'un utilisateur.
 * Spécifiquement : Pour les agents de confirmation, un avatar avec micro-casque.
 */
export const getDefaultAvatarForRole = (rawRole: any): string => {
    const role = normalizeRole(rawRole);
    switch (role) {
        case Role.Agent:
            // Avatar avec micro-casque call center
            return 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80';
        case Role.Manager:
            // Avatar manager superviseur
            return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80';
        case Role.Client:
            // Avatar commerçant / boutique
            return 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80';
        case Role.Admin:
        default:
            // Avatar administrateur
            return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
    }
};

/**
 * Récupère l'URL d'avatar résolue pour un utilisateur (personnalisée ou par défaut selon son rôle).
 */
export const resolveUserAvatar = (user: Partial<User> | null | undefined): string => {
    if (!user) return getDefaultAvatarForRole(Role.Client);
    if (user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim() !== '') {
        return user.avatarUrl.trim();
    }
    if (user.logoData && typeof user.logoData === 'string' && user.logoData.trim() !== '') {
        return user.logoData.trim();
    }
    return getDefaultAvatarForRole(user.role);
};

/**
 * Vérifie avec une tolérance et une précision maximales si un agent est assigné à une boutique / client donné.
 * Prend en charge les comparaisons par ID, email, nom, Google Sheet URL, et gère les cas sans affectation (accès global par défaut).
 */
export const isAgentAssignedToStore = (
    agent: User | null | undefined, 
    clientOrStoreId: User | string | null | undefined,
    allUsers: User[] = []
): boolean => {
    if (!agent) return false;
    if (normalizeRole(agent.role) !== Role.Agent) return false;

    // Si aucune boutique n'est spécifiée (ex: vue globale pour admin) -> vrai
    if (!clientOrStoreId || clientOrStoreId === 'all') return true;

    const allClients = allUsers.filter(u => normalizeRole(u.role) === Role.Client);

    // Récupération des identifiants valides de la boutique cible dans un ensemble
    const targetSet = new Set<string>();

    if (typeof clientOrStoreId === 'string') {
        const clean = clientOrStoreId.trim().toLowerCase();
        targetSet.add(clean);
        // Chercher l'utilisateur client correspondant dans allUsers pour enrichir tous les identifiants possibles
        const found = allUsers.find(u => 
            String(u.id).trim().toLowerCase() === clean || 
            String(u.email || '').trim().toLowerCase() === clean ||
            String(u.name || '').trim().toLowerCase() === clean ||
            String(u.googleSheetUrl || '').trim().toLowerCase() === clean
        );
        if (found) {
            if (found.id) targetSet.add(String(found.id).trim().toLowerCase());
            if (found.email) targetSet.add(String(found.email).trim().toLowerCase());
            if (found.name) targetSet.add(String(found.name).trim().toLowerCase());
            if (found.googleSheetUrl) targetSet.add(String(found.googleSheetUrl).trim().toLowerCase());
        }
    } else {
        if (clientOrStoreId.id) targetSet.add(String(clientOrStoreId.id).trim().toLowerCase());
        if (clientOrStoreId.email) targetSet.add(String(clientOrStoreId.email).trim().toLowerCase());
        if (clientOrStoreId.name) targetSet.add(String(clientOrStoreId.name).trim().toLowerCase());
        if (clientOrStoreId.googleSheetUrl) targetSet.add(String(clientOrStoreId.googleSheetUrl).trim().toLowerCase());
    }

    // Récupération de la liste des assignations de l'agent
    const rawList = Array.isArray(agent.assignedClientIds) ? agent.assignedClientIds : [];
    const assigned = rawList.map(id => String(id).trim().toLowerCase()).filter(Boolean);

    // 1. Si l'agent a accès à toutes les boutiques explicitement
    if (assigned.includes('all') || assigned.includes('*')) {
        return true;
    }

    // 2. Si aucune assignation n'est définie (liste vide) -> non assigné
    if (assigned.length === 0) {
        return false;
    }

    // 3. Correspondance directe dans le targetSet
    if (assigned.some(id => targetSet.has(id))) {
        return true;
    }

    // 4. Comparaison croisée avec les objets clients réels
    for (const assignId of assigned) {
        const matchedClient = allClients.find(c => 
            String(c.id).trim().toLowerCase() === assignId ||
            String(c.email || '').trim().toLowerCase() === assignId ||
            String(c.name || '').trim().toLowerCase() === assignId
        );
        if (matchedClient) {
            if (targetSet.has(String(matchedClient.id).trim().toLowerCase()) ||
                targetSet.has(String(matchedClient.email || '').trim().toLowerCase()) ||
                targetSet.has(String(matchedClient.name || '').trim().toLowerCase())) {
                return true;
            }
        }
    }

    return false;
};
