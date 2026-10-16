// Sesión, panel, importación de datos oficiales y reglas activas.
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, dbKind } from '../db.js';
import { createToken, publicUser, requireAuth, requirePermiso } from '../auth.js';
import { HttpError } from '../http.js';
import { importRecords } from '../importer.js';
import { CATALOGOS, CONFIG, REGLAS, ROLES } from '../rules.js';
import { aiConfig } from '../ai/nemotron.js';
import { localDate } from '../seed.js';

export const publicRouter = Router();
export const router = Router();

publicRouter.get('/health', (_req, res) => {
  const ai = aiConfig();
  res.json({ ok: true, db: dbKind, ai: { configured: Boolean(ai.apiKey), model: ai.model } });
});

publicRouter.get('/auth/users', async (_req, res) => {
  const { rows } = await query(`SELECT id, name, email, role FROM users
    ORDER BY array_position(ARRAY['admin','coordinador','tecnico','trainer','camper'], role), name`);
  res.json(rows.map((u) => ({ ...u, roleLabel: ROLES[u.role] })));
});

publicRouter.post('/auth/login', async (req, res) => {
  const { userId } = z.object({ userId: z.string().min(1, 'elige un perfil') }).parse(req.body);
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(404, 'NO_ENCONTRADO', 'Ese perfil no existe.');
  res.json({ token: createToken(rows[0].id), user: publicUser(rows[0]) });
});

router.use(requireAuth);

router.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

router.get('/dashboard', async (_req, res) => {
  const hoy = localDate();
  const [k, usage, activity] = await Promise.all([
    query(`SELECT
      (SELECT count(*)::int FROM spaces WHERE status = 'disponible') AS "spacesAvailable",
      (SELECT count(*)::int FROM spaces) AS "spacesTotal",
      (SELECT count(*)::int FROM equipment WHERE status = 'prestado') AS "equipmentLent",
      (SELECT count(*)::int FROM equipment) AS "equipmentTotal",
      (SELECT count(*)::int FROM incidents WHERE status <> 'resuelta') AS "incidentsOpen",
      (SELECT count(*)::int FROM incidents WHERE status <> 'resuelta' AND priority IN ('Alta','Crítica')) AS "incidentsHigh",
      (SELECT count(*)::int FROM bookings WHERE date = $1 AND status = 'confirmada') AS "bookingsToday",
      (SELECT count(*)::int FROM import_errors) AS "importRejected"`, [hoy]),
    query(`SELECT start_time, end_time FROM bookings WHERE date = $1 AND status = 'confirmada'`, [hoy]),
    query('SELECT * FROM activity ORDER BY created_at DESC, id DESC LIMIT 8'),
  ]);
  const total = k.rows[0].spacesTotal;
  const horas = [];
  for (let h = 7; h < 21; h++) {
    const hh = `${String(h).padStart(2, '0')}:00`;
    const fin = `${String(h + 1).padStart(2, '0')}:00`;
    horas.push({ hour: hh, occupied: usage.rows.filter((b) => b.start_time < fin && b.end_time > hh).length, total });
  }
  res.json({ kpis: k.rows[0], usage: horas, activity: activity.rows });
});

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

router.get('/import/errors', async (_req, res) => {
  const { rows } = await query('SELECT * FROM import_errors ORDER BY created_at DESC, id DESC LIMIT 200');
  res.json(rows);
});

router.get('/rules', (_req, res) => res.json({ reglas: REGLAS, config: CONFIG, catalogos: CATALOGOS }));
