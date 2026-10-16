// Sesión de demostración: el usuario elige un perfil ficticio y recibe un token firmado (HMAC).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { query } from './db.js';
import { HttpError } from './http.js';
import { PERMISOS, ROLES, tienePermiso } from './rules.js';

const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const TTL_MS = 12 * 60 * 60 * 1000;

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
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return data.exp > Date.now() ? data.sub : null;
}

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLES[u.role], permisos: PERMISOS[u.role] || [],
});

export async function requireAuth(req, _res, next) {
  const userId = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!userId) throw new HttpError(401, 'SIN_SESION', 'Tu sesión expiró. Vuelve a entrar.');
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(401, 'SIN_SESION', 'El usuario de la sesión ya no existe.');
  req.user = rows[0];
  next();
}

export const requirePermiso = (permiso) => (req, _res, next) => {
  if (!tienePermiso(req.user.role, permiso)) {
    throw new HttpError(403, 'SIN_PERMISO', `Tu rol (${ROLES[req.user.role]}) no puede realizar esta acción.`);
  }
  next();
};
