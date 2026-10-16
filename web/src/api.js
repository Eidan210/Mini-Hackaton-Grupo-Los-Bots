// Cliente HTTP mínimo: añade el Bearer, parsea JSON y normaliza errores.
const TOKEN_KEY = 'cc_token';
const USER_KEY = 'cc_user';

export class ApiError extends Error {
  constructor({ status, code, rule, message, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.rule = rule;
    this.details = details;
  }
}

export const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};
export const getToken = () => storage.get(TOKEN_KEY);
export const saveSession = (token, user) => { storage.set(TOKEN_KEY, token); storage.set(USER_KEY, JSON.stringify(user)); };
export const clearSession = () => { storage.del(TOKEN_KEY); storage.del(USER_KEY); };
export const loadUser = () => { try { return JSON.parse(storage.get(USER_KEY)); } catch { return null; } };

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError({ status: 0, code: 'RED', message: 'No se pudo conectar con el servidor' });
  }

  let data = null;
  try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }

  if (!res.ok) {
    const e = data?.error || {};
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError({
      status: res.status,
      code: e.code,
      rule: e.rule,
      message: e.message || (res.status >= 502 && res.status <= 504
        ? 'La API no responde. Revisa que el backend esté corriendo (npm run dev) y vuelve a intentar.'
        : `Error ${res.status} del servidor`),
      details: e.details,
    });
  }
  return data;
}
