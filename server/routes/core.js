// Sesión, usuarios, panel por rol, notificaciones, importación de datos oficiales y reglas.
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, dbKind, logActivity } from '../db.js';
import {
  checkRateLimit, clearFailures, createToken, demoLoginEnabled, hashPassword, publicUser,
  registerFailure, requireAuth, requirePermiso, verifyPassword,
} from '../auth.js';
import { HttpError, notFound } from '../http.js';
import { importRecords } from '../importer.js';
import { CATALOGOS, CONFIG, REGLAS, ROLES, ROL_REGISTRO, tienePermiso } from '../rules.js';
import { reglasActivas } from '../ruleState.js';
import { aiConfig } from '../ai/nemotron.js';
import { localDate } from '../seed.js';

export const publicRouter = Router();
export const router = Router();

const DUMMY_HASH = await hashPassword('usuario-inexistente');
const email = z.string().trim().toLowerCase().email('escribe un correo válido').max(120);

publicRouter.get('/health', (_req, res) => {
  const ai = aiConfig();
  res.json({ ok: true, db: dbKind, ai: { configured: Boolean(ai.apiKey), model: ai.model } });
});

publicRouter.get('/auth/config', (_req, res) => res.json({ demoLogin: demoLoginEnabled() }));

publicRouter.post('/auth/login', async (req, res) => {
  const body = z.object({ email, password: z.string().min(1, 'escribe tu contraseña').max(200) }).parse(req.body);
  const key = `${body.email}|${req.ip}`;
  checkRateLimit(key);
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = $1', [body.email]);
  // Siempre se calcula un hash (aunque el correo no exista) para no revelar qué correos están registrados.
  const passwordOk = await verifyPassword(body.password, rows[0]?.password_hash || DUMMY_HASH);
  const ok = Boolean(rows[0]) && passwordOk;
  if (!ok) {
    registerFailure(key);
    throw new HttpError(401, 'CREDENCIALES', 'Correo o contraseña incorrectos.');
  }
  clearFailures(key);
  res.json({ token: createToken(rows[0].id), user: publicUser(rows[0]) });
});

publicRouter.post('/auth/register', async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(3, 'escribe tu nombre completo').max(80),
    email,
    password: z.string().min(8, 'la contraseña debe tener al menos 8 caracteres').max(200),
  }).parse(req.body);
  checkRateLimit(`registro|${req.ip}`);
  const { rows: existe } = await query('SELECT 1 FROM users WHERE lower(email) = $1', [body.email]);
  if (existe.length) throw new HttpError(409, 'EMAIL_EXISTE', 'Ya existe una cuenta con ese correo.');
  const id = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { rows } = await query(
    'INSERT INTO users (id, name, email, role, password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [id, body.name, body.email, ROL_REGISTRO, await hashPassword(body.password)],
  );
  registerFailure(`registro|${req.ip}`); // limita la creación masiva de cuentas desde una misma IP
  await logActivity(query, 'usuario', `Nuevo usuario registrado: ${body.name} (${ROLES[ROL_REGISTRO]})`, id);
  res.status(201).json({ token: createToken(id), user: publicUser(rows[0]) });
});

// Acceso rápido de demostración: solo existe si DEMO_LOGIN=true.
publicRouter.get('/auth/users', async (_req, res) => {
  if (!demoLoginEnabled()) throw notFound('El acceso de demostración');
  const { rows } = await query(`SELECT id, name, email, role FROM users WHERE id LIKE 'u-%' AND email LIKE '%@campus.demo'
    ORDER BY array_position(ARRAY['admin','coordinador','tecnico','trainer','camper'], role), name`);
  res.json(rows.map((u) => ({ ...u, roleLabel: ROLES[u.role] })));
});

publicRouter.post('/auth/demo', async (req, res) => {
  if (!demoLoginEnabled()) throw notFound('El acceso de demostración');
  const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
  const { rows } = await query(`SELECT * FROM users WHERE id = $1 AND email LIKE '%@campus.demo'`, [userId]);
  if (!rows[0]) throw notFound('Ese perfil');
  res.json({ token: createToken(rows[0].id), user: publicUser(rows[0]) });
});

router.use(requireAuth);

router.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- usuarios ----------
router.get('/users', async (req, res) => {
  const role = z.enum(Object.keys(ROLES)).optional().catch(undefined).parse(req.query.role);
  const puede = tienePermiso(req.user.role, 'gestionar_usuarios')
    || (role === 'tecnico' && tienePermiso(req.user.role, 'gestionar_incidencias'));
  if (!puede) throw new HttpError(403, 'SIN_PERMISO', 'Tu rol no puede ver la lista de usuarios.');
  const { rows } = role
    ? await query('SELECT id, name, email, role, created_at FROM users WHERE role = $1 ORDER BY name', [role])
    : await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC, name');
  res.json(rows.map((u) => ({ ...u, roleLabel: ROLES[u.role] })));
});

router.patch('/users/:id', requirePermiso('gestionar_usuarios'), async (req, res) => {
  const { role } = z.object({ role: z.enum(Object.keys(ROLES)) }).parse(req.body);
  if (req.params.id === req.user.id) throw new HttpError(409, 'PROPIO_ROL', 'No puedes cambiar tu propio rol.');
  const { rows } = await query('UPDATE users SET role = $2 WHERE id = $1 RETURNING *', [req.params.id, role]);
  if (!rows[0]) throw notFound('El usuario');
  await logActivity(query, 'usuario', `${rows[0].name} ahora es ${ROLES[role]} (${req.user.name})`, req.user.id, rows[0].id);
  res.json({ user: publicUser(rows[0]) });
});

// ---------- panel ----------
const BLOQUEO_HOY = `EXISTS (SELECT 1 FROM space_blocks b WHERE b.space_id = s.id AND b.activo AND b.desde <= $1 AND $1 <= b.hasta)`;

router.get('/dashboard', async (req, res) => {
  const hoy = localDate();
  if (!tienePermiso(req.user.role, 'ver_panel_global')) return res.json(await personalDashboard(req.user, hoy));

  const [k, usage, activity, top] = await Promise.all([
    query(`SELECT
      (SELECT count(*)::int FROM spaces s WHERE NOT ${BLOQUEO_HOY}) AS "spacesAvailable",
      (SELECT count(*)::int FROM spaces) AS "spacesTotal",
      (SELECT count(*)::int FROM equipment WHERE status = 'prestado') AS "equipmentLent",
      (SELECT count(*)::int FROM equipment) AS "equipmentTotal",
      (SELECT count(*)::int FROM incidents WHERE status <> 'resuelta') AS "incidentsOpen",
      (SELECT count(*)::int FROM incidents WHERE status <> 'resuelta' AND priority = ANY($2)) AS "incidentsHigh",
      (SELECT count(*)::int FROM bookings WHERE date = $1 AND status = 'confirmada') AS "bookingsToday",
      (SELECT count(*)::int FROM import_errors WHERE deleted_at IS NULL AND status = 'pendiente') AS "importRejected"`,
    [hoy, CONFIG.incidencias.prioridadesQueBloquean]),
    query(`SELECT start_time, end_time FROM bookings WHERE date = $1 AND status = 'confirmada'`, [hoy]),
    query('SELECT * FROM activity ORDER BY created_at DESC, id DESC LIMIT 10'),
    query(`SELECT s.name, count(*)::int AS count FROM bookings b JOIN spaces s ON s.id = b.space_id
           WHERE b.date = $1 AND b.status = 'confirmada' GROUP BY s.name ORDER BY count DESC, s.name LIMIT 3`, [hoy]),
  ]);
  const total = k.rows[0].spacesTotal;
  const horas = [];
  for (let h = 7; h < 21; h++) {
    const hh = `${String(h).padStart(2, '0')}:00`;
    const fin = `${String(h + 1).padStart(2, '0')}:00`;
    horas.push({ hour: hh, occupied: usage.rows.filter((b) => b.start_time < fin && b.end_time > hh).length, total });
  }
  const pico = horas.reduce((a, b) => (b.occupied > (a?.occupied ?? 0) ? b : a), null);
  const avg = total ? horas.reduce((s, h) => s + h.occupied, 0) / (horas.length * total) : 0;
  res.json({
    scope: 'global',
    kpis: k.rows[0],
    usage: horas,
    stats: { peakHour: pico?.occupied ? pico.hour : null, avgOccupancy: Math.round(avg * 100) / 100, topSpaces: top.rows },
    activity: activity.rows,
  });
});

async function personalDashboard(user, hoy) {
  const ahora = new Date().toTimeString().slice(0, 5);
  const [bookings, loans, incidents, libres, activity] = await Promise.all([
    query(`SELECT b.*, s.name AS space_name FROM bookings b JOIN spaces s ON s.id = b.space_id
           WHERE b.organizer_id = $1 AND b.status = 'confirmada' AND b.date >= $2 ORDER BY b.date, b.start_time LIMIT 10`, [user.id, hoy]),
    query(`SELECT l.*, e.name AS equipment_name, e.code AS equipment_code, (l.due_at < now()) AS overdue
           FROM loans l JOIN equipment e ON e.id = l.equipment_id WHERE l.user_id = $1 AND l.status = 'activo' ORDER BY l.due_at`, [user.id]),
    query(`SELECT i.id, i.code, i.title, i.priority, i.status, i.created_at, s.name AS space_name, e.name AS equipment_name
           FROM incidents i LEFT JOIN spaces s ON s.id = i.space_id LEFT JOIN equipment e ON e.id = i.equipment_id
           WHERE i.reported_by = $1 ORDER BY (i.status = 'resuelta'), i.created_at DESC LIMIT 10`, [user.id]),
    query(`SELECT s.id, s.name, s.type, s.capacity FROM spaces s
           WHERE NOT ${BLOQUEO_HOY}
             AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.space_id = s.id AND b.date = $1 AND b.status = 'confirmada'
                             AND b.start_time <= $2 AND b.end_time > $2)
           ORDER BY s.type, s.name`, [hoy, ahora]),
    query('SELECT * FROM activity WHERE user_id = $1 OR target_user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 8', [user.id]),
  ]);
  return {
    scope: 'personal',
    kpis: {
      myBookingsToday: bookings.rows.filter((b) => b.date === hoy).length,
      myUpcomingBookings: bookings.rows.filter((b) => b.date > hoy).length,
      myActiveLoans: loans.rows.length,
      myOverdueLoans: loans.rows.filter((l) => l.overdue).length,
      myOpenIncidents: incidents.rows.filter((i) => i.status !== 'resuelta').length,
      spacesAvailableNow: libres.rows.length,
    },
    bookings: bookings.rows,
    loans: loans.rows,
    incidents: incidents.rows,
    availableNow: libres.rows,
    activity: activity.rows,
  };
}

// ---------- notificaciones ----------
const LINKS = { reserva: '/espacios', prestamo: '/equipos', devolucion: '/equipos', incidencia: '/incidencias', estado: '/espacios', importacion: '/datos', usuario: '/usuarios', regla: '/reglas', consulta: '/incidencias' };

function notificationFilter(user) {
  if (tienePermiso(user.role, 'ver_panel_global') && ['admin', 'coordinador'].includes(user.role)) return { where: 'TRUE', params: [] };
  if (user.role === 'tecnico') {
    return { where: `(type IN ('incidencia','estado','consulta') OR user_id = $1 OR target_user_id = $1)`, params: [user.id] };
  }
  return { where: '(user_id = $1 OR target_user_id = $1)', params: [user.id] };
}

router.get('/notifications', async (req, res) => {
  const f = notificationFilter(req.user);
  const { rows } = await query(`SELECT * FROM activity WHERE ${f.where} ORDER BY created_at DESC, id DESC LIMIT 15`, f.params);
  const seen = new Date(req.user.notif_seen_at);
  const items = rows.map((a) => ({
    id: a.id, type: a.type, message: a.message, created_at: a.created_at,
    read: new Date(a.created_at) <= seen || a.user_id === req.user.id,
    link: LINKS[a.type] || '/',
  }));
  res.json({ unread: items.filter((i) => !i.read).length, items });
});

router.post('/notifications/read-all', async (req, res) => {
  await query('UPDATE users SET notif_seen_at = now() WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
});

// ---------- datos importados ----------
router.post('/import', requirePermiso('importar_datos'), async (req, res) => {
  const body = z.object({
    entity: z.enum(['spaces', 'equipment']),
    format: z.enum(['csv', 'json']),
    content: z.string().min(1, 'el archivo está vacío').max(2_000_000),
    filename: z.string().max(120).optional(),
  }).parse(req.body);
  const result = await tx(({ query: q }) =>
    importRecords(q, { ...body, source: body.filename || `carga manual (${req.user.name})` }));
  res.json(result);
});

const IMPORT_SELECT = `SELECT ie.*, u.name AS reviewed_by_name FROM import_errors ie LEFT JOIN users u ON u.id = ie.reviewed_by`;

router.get('/import/errors', requirePermiso('ver_datos_importados'), async (_req, res) => {
  // Limpieza automática: los revisados hace más de 7 días dejan de mostrarse.
  await query(`UPDATE import_errors SET deleted_at = now()
               WHERE deleted_at IS NULL AND status = 'revisado' AND reviewed_at < now() - interval '7 days'`);
  const { rows } = await query(`${IMPORT_SELECT} WHERE ie.deleted_at IS NULL ORDER BY (ie.status = 'revisado'), ie.created_at DESC, ie.id DESC LIMIT 200`);
  res.json(rows);
});

router.patch('/import/errors/:id', requirePermiso('ver_datos_importados'), async (req, res) => {
  const { status } = z.object({ status: z.enum(['pendiente', 'revisado']) }).parse(req.body);
  const { rows } = await query(
    `UPDATE import_errors SET status = $2,
       reviewed_by = CASE WHEN $2 = 'revisado' THEN $3 ELSE NULL END,
       reviewed_at = CASE WHEN $2 = 'revisado' THEN now() ELSE NULL END
     WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [Number(req.params.id) || 0, status, req.user.id],
  );
  if (!rows[0]) throw notFound('El registro rechazado');
  res.json({ error: (await query(`${IMPORT_SELECT} WHERE ie.id = $1`, [rows[0].id])).rows[0] });
});

router.delete('/import/errors/:id', requirePermiso('ver_datos_importados'), async (req, res) => {
  const { rows } = await query('UPDATE import_errors SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
    [Number(req.params.id) || 0]);
  if (!rows[0]) throw notFound('El registro rechazado');
  res.json({ ok: true });
});

// ---------- reglas ----------
// Quien no tiene "ver_reglas" (camper) solo recibe los catálogos que necesita para reportar incidencias.
router.get('/rules', async (req, res) => {
  if (!tienePermiso(req.user.role, 'ver_reglas')) return res.json({ reglas: [], config: null, catalogos: CATALOGOS });
  const activas = await reglasActivas(query);
  res.json({ reglas: REGLAS.map((r) => ({ ...r, activa: activas.has(r.id) })), config: CONFIG, catalogos: CATALOGOS });
});

router.patch('/rules/:id', requirePermiso('gestionar_reglas'), async (req, res) => {
  const { activa } = z.object({ activa: z.boolean() }).parse(req.body);
  const regla = REGLAS.find((r) => r.id === req.params.id);
  if (!regla) throw notFound('La regla');
  await query(`INSERT INTO rule_state (id, activa) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET activa = EXCLUDED.activa`, [regla.id, activa]);
  await logActivity(query, 'regla', `${regla.id} · ${regla.nombre} fue ${activa ? 'activada' : 'desactivada'} por ${req.user.name}`, req.user.id);
  res.json({ regla: { ...regla, activa } });
});
