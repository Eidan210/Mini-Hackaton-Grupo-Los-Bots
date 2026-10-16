// Autenticación: correo + contraseña (hash scrypt) y token firmado (HMAC). El rol sale siempre del servidor.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';
import { HttpError } from './http.js';
import { PERMISOS, ROLES, tienePermiso } from './rules.js';

const scryptAsync = promisify(scrypt);
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const TTL_MS = 12 * 60 * 60 * 1000;

// ---------- contraseñas ----------
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(String(password), salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, salt, hex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const key = await scryptAsync(String(password), salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}

// ---------- límite de intentos de login ----------
const MAX_INTENTOS = 5;
const VENTANA_MS = 10 * 60 * 1000;
const intentos = new Map();

export function checkRateLimit(key) {
  const now = Date.now();
  const entry = intentos.get(key);
  if (entry && now - entry.first < VENTANA_MS && entry.count >= MAX_INTENTOS) {
    const min = Math.ceil((VENTANA_MS - (now - entry.first)) / 60000);
    throw new HttpError(429, 'DEMASIADOS_INTENTOS', `Demasiados intentos fallidos. Espera ${min} min e inténtalo de nuevo.`);
  }
}
export function registerFailure(key) {
  const now = Date.now();
  const entry = intentos.get(key);
  if (!entry || now - entry.first >= VENTANA_MS) intentos.set(key, { first: now, count: 1 });
  else entry.count++;
}
export const clearFailures = (key) => intentos.delete(key);

// ---------- tokens ----------
const sign = (data) => createHmac('sha256', SECRET).update(data).digest('base64url');

export function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data.sub : null;
  } catch {
    return null;
  }
}

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLES[u.role], permisos: PERMISOS[u.role] || [],
});

/** El acceso rápido de demostración solo existe si DEMO_LOGIN=true. */
export const demoLoginEnabled = () => process.env.DEMO_LOGIN === 'true';

export async function requireAuth(req, _res, next) {
  const userId = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!userId) throw new HttpError(401, 'SIN_SESION', 'Tu sesión expiró. Vuelve a entrar.');
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(401, 'SIN_SESION', 'El usuario de la sesión ya no existe.');
  req.user = rows[0];
  next();
}

export const requirePermiso = (...permisos) => (req, _res, next) => {
  if (!permisos.some((p) => tienePermiso(req.user.role, p))) {
    throw new HttpError(403, 'SIN_PERMISO', `Tu rol (${ROLES[req.user.role]}) no puede realizar esta acción.`);
  }
  next();
};
