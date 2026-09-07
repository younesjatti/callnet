import { User, Order, Role, OrderStatus } from '../types';
import { normalizeRole, normalizeStatus, forcePrimitiveValue } from '../utils';

const getEnvironment = (): string => {
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const forcedEnv = urlParams.get('env') || urlParams.get('environment');
        if (forcedEnv === 'dev' || forcedEnv === 'development') return 'dev';
        if (forcedEnv === 'prod' || forcedEnv === 'production' || forcedEnv === 'public') return 'prod';

        const host = (window.location.hostname || '').toLowerCase();
        if (host.includes('-dev-') || host.includes('localhost') || host.includes('127.0.0.1')) {
            return 'dev';
        }
    }
    return 'prod';
};

export const currentAppEnvironment = getEnvironment();

const getHeaders = (hasBody: boolean = false): Record<string, string> => {
    const headers: Record<string, string> = {
        'X-App-Environment': getEnvironment(),
    };
    if (hasBody) {
        headers['Content-Type'] = 'application/json';
    }
    const token = (typeof window !== 'undefined') ? (sessionStorage.getItem('authToken') || localStorage.getItem('authToken')) : null;
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const currentUserId = (typeof window !== 'undefined') ? (sessionStorage.getItem('callnet_current_user_id_v2') || localStorage.getItem('callnet_current_user_id_v2')) : null;
    if (currentUserId) {
        headers['X-User-Id'] = currentUserId;
    }
    return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        let errMessage = `Erreur serveur (${response.status})`;
        try {
            const errorData = await response.json();
            errMessage = errorData.message || errorData.error || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    return {} as T;
};

const normalizeEndpoint = (endpoint: string): string => {
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};

export const apiClient = {
    async apiFetch<T>(endpoint: string, retries = 3): Promise<T> {
        const cleanPath = normalizeEndpoint(endpoint);
        try {
            const res = await fetch(`/api${cleanPath}`, {
                method: 'GET',
                headers: getHeaders(false),
            });
            return await handleResponse<T>(res);
        } catch (e: any) {
            if (retries > 0) {
                const backoff = (4 - retries) * 600;
                await new Promise(r => setTimeout(r, backoff));
                return this.apiFetch<T>(endpoint, retries - 1);
            }
            console.warn(`[API Fetch Warning] ${endpoint}:`, e?.message || e);
            throw e;
        }
    },

    async apiPost<T>(endpoint: string, data: any, retries = 2): Promise<T> {
        const cleanPath = normalizeEndpoint(endpoint);
        try {
            const res = await fetch(`/api${cleanPath}`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify(data),
            });
            return await handleResponse<T>(res);
        } catch (e: any) {
            if (retries > 0) {
                const backoff = (3 - retries) * 600;
                await new Promise(r => setTimeout(r, backoff));
                return this.apiPost<T>(endpoint, data, retries - 1);
            }
            console.warn(`[API Post Warning] ${endpoint}:`, e?.message || e);
            throw e;
        }
    },

    async apiPut<T>(endpoint: string, data: any): Promise<T> {
        const cleanPath = normalizeEndpoint(endpoint);
        try {
            const res = await fetch(`/api${cleanPath}`, {
                method: 'PUT',
                headers: getHeaders(true),
                body: JSON.stringify(data),
            });
            return await handleResponse<T>(res);
        } catch (e: any) {
            console.warn(`[API Put Warning] ${endpoint}:`, e?.message || e);
            throw e;
        }
    },

    async apiDelete<T>(endpoint: string): Promise<T> {
        const cleanPath = normalizeEndpoint(endpoint);
        try {
            const res = await fetch(`/api${cleanPath}`, {
                method: 'DELETE',
                headers: getHeaders(false),
            });
            return await handleResponse<T>(res);
        } catch (e: any) {
            console.warn(`[API Delete Warning] ${endpoint}:`, e?.message || e);
            throw e;
        }
    }
};
