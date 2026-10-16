import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, clearSession, getToken, loadUser, saveSession, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const REFRESH_MIN_GAP_MS = 60_000;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(loadUser());

  const logout = useCallback(() => { clearSession(); setToken(null); setUser(null); }, []);

  const startSession = useCallback((data) => {
    saveSession(data.token, data.user);
    setToken(data.token);
    setUser(data.user);
  }, []);

  // Inicio de sesión real: correo + contraseña
  const login = useCallback(
    async (email, password) => startSession(await apiFetch('/auth/login', { method: 'POST', body: { email, password } })),
    [startSession],
  );

  // Registro público: entra directo como Camper
  const register = useCallback(
    async ({ name, email, password }) => startSession(await apiFetch('/auth/register', { method: 'POST', body: { name, email, password } })),
    [startSession],
  );

  // Acceso rápido de demostración (solo si el backend lo habilita)
  const loginDemo = useCallback(
    async (userId) => startSession(await apiFetch('/auth/demo', { method: 'POST', body: { userId } })),
    [startSession],
  );

  // Cualquier 401 de la API cierra la sesión
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  // Sincroniza permisos/rol con el servidor al abrir la app y al volver a la pestaña (máx. 1 vez por minuto)
  useEffect(() => {
    let last = 0;
    let alive = true;
    const refresh = () => {
      if (!getToken() || Date.now() - last < REFRESH_MIN_GAP_MS) return;
      last = Date.now();
      apiFetch('/auth/me')
        .then((res) => {
          if (!alive || !res?.user) return;
          const t = getToken();
          if (t) saveSession(t, res.user);
          setUser((prev) => (JSON.stringify(prev) === JSON.stringify(res.user) ? prev : res.user));
        })
        .catch(() => { /* un 401 ya cierra la sesión; otros errores se ignoran */ });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.removeEventListener('focus', refresh); };
  }, []);

  const can = useCallback((perm) => !!user?.permisos?.includes(perm), [user]);

  const value = useMemo(() => ({
    token, user, login, register, loginDemo, logout, can,
  }), [token, user, login, register, loginDemo, logout, can]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
