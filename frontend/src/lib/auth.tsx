import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { User } from './types';

interface Ctx {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  /** Yönetici veya birim sorumlusu */
  isManager: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setSession: (token: string) => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const clear = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!tokenStore.get()) return;
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* oturum zaten kapanmış olabilir */
    }
    clear();
  }, [clear]);

  const setSession = useCallback(async (token: string) => {
    tokenStore.set(token);
    const { data } = await api.get<{ user: User }>('/auth/me');
    setUser(data.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAdmin: user?.role === 'ADMIN', isManager: user?.role === 'ADMIN' || user?.role === 'UNIT_MANAGER', login, logout, setSession }),
    [user, loading, login, logout, setSession],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthProvider eksik');
  return c;
};
