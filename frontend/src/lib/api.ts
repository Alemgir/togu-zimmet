import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'zimmet_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: { message?: string } }>) => {
    const isLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLogin) onUnauthorized?.();
    return Promise.reject(err);
  },
);

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export function errorMessage(e: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(e)) {
    if (!e.response) return 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin';
    return e.response.data?.error?.message ?? 'Beklenmeyen bir hata oluştu';
  }
  return e instanceof Error ? e.message : 'Beklenmeyen bir hata oluştu';
}

export function errorDetails<T = unknown>(e: unknown): T | undefined {
  return axios.isAxiosError<ApiErrorBody>(e) ? (e.response?.data?.error?.details as T | undefined) : undefined;
}
