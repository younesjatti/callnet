import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Order, User, Product, PlatformMessage } from '../types';

export interface SupabaseConfig {
    url: string;
    anonKey: string;
    serviceKey?: string;
    connected?: boolean;
}

const STORAGE_KEY = 'callnet_supabase_config_v1';

export const DEFAULT_SUPABASE_URL = 'https://ywycwjkkjmlxrwohkgas.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_VPBJecU1GFkNX8WU5c188w__oTAWPhw';

// Default Supabase config (checks localStorage first, then environment variables, then Supabase project default)
export const getSupabaseConfig = (): SupabaseConfig => {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.url && parsed.anonKey) {
                    return parsed;
                }
            }
        } catch (_) {}
    }

    const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
    const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

    return {
        url: envUrl,
        anonKey: envKey,
        connected: Boolean(envUrl && envKey)
    };
};

export const saveSupabaseConfig = (config: SupabaseConfig) => {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (_) {}
    }
    // Reinitialize client
    initSupabaseClient(config.url, config.anonKey);
};

let currentClient: SupabaseClient | null = null;

export const initSupabaseClient = (url?: string, anonKey?: string): SupabaseClient | null => {
    const targetUrl = url || getSupabaseConfig().url;
    const targetKey = anonKey || getSupabaseConfig().anonKey;

    if (!targetUrl || !targetKey) {
        currentClient = null;
        return null;
    }

    try {
        currentClient = createClient(targetUrl.trim(), targetKey.trim(), {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        return currentClient;
    } catch (e) {
        console.warn("Erreur d'initialisation du client Supabase:", e);
        currentClient = null;
        return null;
    }
};

// Initialize immediately if credentials exist
const initialConfig = getSupabaseConfig();
if (initialConfig.url && initialConfig.anonKey) {
    initSupabaseClient(initialConfig.url, initialConfig.anonKey);
}

export const getSupabaseClient = (): SupabaseClient | null => {
    if (!currentClient) {
        const config = getSupabaseConfig();
        if (config.url && config.anonKey) {
            return initSupabaseClient(config.url, config.anonKey);
        }
    }
    return currentClient;
};

export const isSupabaseReady = (): boolean => {
    return Boolean(getSupabaseClient());
};

// Test connection to Supabase
export const testSupabaseConnection = async (testUrl?: string, testKey?: string): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    tablesFound?: string[];
}> => {
    const start = Date.now();
    const client = (testUrl && testKey)
        ? createClient(testUrl.trim(), testKey.trim())
        : getSupabaseClient();

    if (!client) {
        return {
            success: false,
            message: "Configuration Supabase manquante (URL du projet et clé anon/service requises)."
        };
    }

    try {
        // Query users table as probe
        const { data, error } = await client
            .from('users')
            .select('id, name, email')
            .limit(1);

        const latencyMs = Date.now() - start;

        if (error) {
            // Table might not exist yet or permission error
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                return {
                    success: true,
                    latencyMs,
                    message: "Connecté à Supabase avec succès ! Les tables CallNet doivent être initialisées avec le script SQL fourni."
                };
            }
            return {
                success: false,
                latencyMs,
                message: `Erreur Supabase (${error.code || 'API'}): ${error.message}`
            };
        }

        return {
            success: true,
            latencyMs,
            message: `Connexion établie avec succès avec Supabase (${latencyMs}ms). Tables opérationnelles.`
        };
    } catch (err: any) {
        return {
            success: false,
            latencyMs: Date.now() - start,
            message: `Impossible de contacter Supabase: ${err.message || 'Erreur réseau'}`
        };
    }
};

// Complete SQL Schema Migration Script to copy-paste into Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- CALLNET PLATFORM - INITIALISATION DU SCHÉMA COMPLET SUPABASE
-- Collez et exécutez ce script dans l'Éditeur SQL de votre projet Supabase (SQL Editor)
-- =========================================================================

-- 1. TABLE UTILISATEURS (Comptes Admins, Équipes et Boutiques Clients)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Client',
    assigned_client_ids TEXT[] DEFAULT '{}',
    google_sheet_url TEXT,
    selected_sheet TEXT,
    auto_sync BOOLEAN DEFAULT FALSE,
    column_mapping JSONB DEFAULT '{}'::jsonb,
    logo_data TEXT,
    logo_scale NUMERIC(4, 2) DEFAULT 1.0,
    avatar_url TEXT,
    phone TEXT,
    primary_courier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLE COMMANDES (Orders & Suivi logistique)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    product TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    variant TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'En attente',
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    city_id TEXT,
    district TEXT,
    note TEXT,
    client_id TEXT,
    archived BOOLEAN DEFAULT FALSE,
    tracking_number TEXT,
    courier_status TEXT,
    courier_name TEXT,
    row_index TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLE PRODUITS (Catalogue & Upsells)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    regular_price NUMERIC(10, 2),
    product_url TEXT,
    image_url TEXT,
    description TEXT,
    confirmation_pitch TEXT,
    upsell_offer TEXT,
    stock INTEGER DEFAULT 0,
    category TEXT,
    client_id TEXT NOT NULL,
    client_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE MODÈLES D'EXPÉDITION (Templates Excel & Bordereaux)
CREATE TABLE IF NOT EXISTS public.shipping_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT,
    description TEXT,
    mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    column_order TEXT[] DEFAULT '{}',
    enabled_keys TEXT[] DEFAULT '{}',
    static_columns JSONB DEFAULT '{}'::jsonb,
    filename_prefix TEXT,
    sheet_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLE MESSAGES & CHAT INTERNE
CREATE TABLE IF NOT EXISTS public.platform_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    sender_avatar TEXT,
    recipient_id TEXT,
    recipient_name TEXT,
    store_id TEXT NOT NULL,
    store_name TEXT,
    content TEXT NOT NULL,
    order_ref_id TEXT,
    order_customer_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_by TEXT[] DEFAULT '{}'
);

-- 6. TABLE CONFIGURATIONS TRANSPORTEURS
CREATE TABLE IF NOT EXISTS public.courier_configs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    api_key TEXT,
    client_id TEXT,
    api_secret TEXT,
    api_base_url TEXT,
    is_stock BOOLEAN DEFAULT FALSE,
    allow_open_parcel BOOLEAN DEFAULT TRUE,
    default_nature TEXT,
    store_owner_id TEXT,
    webhook_secret TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABLE JOURNAL D'AUDIT
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    category TEXT,
    details TEXT,
    status TEXT DEFAULT 'success'
);

-- Index pour accélérer les requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_products_client_id ON public.products(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_store_id ON public.platform_messages(store_id);

-- Compte Administrateur Initial
INSERT INTO public.users (id, name, email, password, role, avatar_url, phone)
VALUES (
    'admin-younes',
    'Younes Jatti (Administrateur)',
    'younes.jatti.91@gmail.com',
    'admin123',
    'Admin',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    '+212 6 00 00 00 00'
)
ON CONFLICT (email) DO NOTHING;

-- Activation des politiques de sécurité (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politiques d'accès complètes pour le client de l'application
DO $$
BEGIN
    DROP POLICY IF EXISTS "Callnet users full access" ON public.users;
    CREATE POLICY "Callnet users full access" ON public.users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Callnet orders full access" ON public.orders;
    CREATE POLICY "Callnet orders full access" ON public.orders FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Callnet products full access" ON public.products;
    CREATE POLICY "Callnet products full access" ON public.products FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Callnet templates full access" ON public.shipping_templates;
    CREATE POLICY "Callnet templates full access" ON public.shipping_templates FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Callnet messages full access" ON public.platform_messages;
    CREATE POLICY "Callnet messages full access" ON public.platform_messages FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Callnet couriers full access" ON public.courier_configs;
    CREATE POLICY "Callnet couriers full access" ON public.courier_configs FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Callnet logs full access" ON public.audit_logs;
    CREATE POLICY "Callnet logs full access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
END $$;
`;
