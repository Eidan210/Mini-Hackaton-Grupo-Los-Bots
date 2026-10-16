import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, clearSession, getToken, loadUser, saveSession, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(loadUser());

  const logout = useCallback(() => { clearSession(); setToken(null); setUser(null); }, []);

  const login = useCallback(async (userId) => {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { userId } });
    saveSession(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
  }, []);

  // Cualquier 401 de la API cierra la sesión
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const value = useMemo(() => ({
    token, user, login, logout,
    can: (perm) => !!user?.permisos?.includes(perm),
  }), [token, user, login, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
