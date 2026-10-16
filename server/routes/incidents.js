// Módulo 3: incidencias con triaje por IA (Nemotron) y efectos automáticos sobre los recursos (R6).
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, logActivity } from '../db.js';
import { requirePermiso } from '../auth.js';
import { HttpError, notFound } from '../http.js';
import { CATALOGOS, CONFIG, consecuenciaIncidencia, prioridadBloquea } from '../rules.js';
import { analizarIncidencia } from '../ai/triage.js';
import { localDate } from '../seed.js';

const router = Router();

const INCIDENT_SELECT = `SELECT i.*, s.name AS space_name, e.name AS equipment_name, e.code AS equipment_code, u.name AS reported_by_name
  FROM incidents i LEFT JOIN spaces s ON s.id = i.space_id LEFT JOIN equipment e ON e.id = i.equipment_id
  JOIN users u ON u.id = i.reported_by`;

const optionalId = z.string().trim().min(1).nullish().transform((v) => v || null);

async function loadTargets(spaceId, equipmentId) {
  const space = spaceId ? (await query('SELECT * FROM spaces WHERE id = $1', [spaceId])).rows[0] : null;
  const equipment = equipmentId ? (await query('SELECT * FROM equipment WHERE id = $1', [equipmentId])).rows[0] : null;
  if (spaceId && !space) throw notFound('El espacio');
  if (equipmentId && !equipment) throw notFound('El equipo');
  return { space, equipment };
}

router.get('/incidents', async (_req, res) => {
  const { rows } = await query(`${INCIDENT_SELECT} ORDER BY (i.status = 'resuelta'), i.created_at DESC`);
  res.json(rows);
});

// Paso 1: la IA propone categoría, prioridad, área y recurso afectado. No se guarda nada todavía.
router.post('/incidents/analyze', requirePermiso('reportar_incidencia'), async (req, res) => {
  const body = z.object({
    description: z.string().trim().min(10, 'describe el problema con al menos 10 caracteres').max(500),
    spaceId: optionalId,
    equipmentId: optionalId,
  }).parse(req.body);
  const { space, equipment } = await loadTargets(body.spaceId, body.equipmentId);
  const [{ rows: spaces }, { rows: equipmentList }] = await Promise.all([
    query('SELECT id, code, name FROM spaces ORDER BY code'),
    query('SELECT id, code, name FROM equipment ORDER BY code'),
  ]);
  const { data, model, latencyMs } = await analizarIncidencia({ description: body.description, space, equipment, spaces, equipmentList });
  const targets = await loadTargets(data.spaceId, data.equipmentId);
  res.json({
    analysis: data,
    consequence: consecuenciaIncidencia({ priority: data.priority, ...targets }),
    model,
    latencyMs,
  });
});

// Paso 2: el usuario confirma (o corrige) la propuesta y se aplican los efectos de la regla R6.
router.post('/incidents', requirePermiso('reportar_incidencia'), async (req, res) => {
  const body = z.object({
    description: z.string().trim().min(10).max(500),
    title: z.string().trim().max(120).optional(),
    spaceId: optionalId,
    equipmentId: optionalId,
    category: z.enum(CATALOGOS.categorias),
    priority: z.enum(CATALOGOS.prioridades),
    area: z.enum(CATALOGOS.areas),
    justification: z.string().trim().max(600).default(''),
    aiModel: z.string().max(120).nullish(),
  }).parse(req.body);
  if (!body.spaceId && !body.equipmentId) {
    throw new HttpError(400, 'VALIDACION', 'Indica el espacio o el equipo afectado para poder enrutar la incidencia.');
  }
  const { space, equipment } = await loadTargets(body.spaceId, body.equipmentId);

  const result = await tx(async ({ query: q }) => {
    const { rows: n } = await q('SELECT count(*)::int AS n FROM incidents');
    const code = `INC-${String(n[0].n + 1).padStart(4, '0')}`;
    const title = body.title || body.description.slice(0, 60);
    const { rows } = await q(
      `INSERT INTO incidents (code, title, description, category, priority, area, justification, space_id, equipment_id, ai_model, reported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [code, title, body.description, body.category, body.priority, body.area, body.justification,
        body.spaceId, body.equipmentId, body.aiModel || null, req.user.id],
    );

    const effects = [];
    if (prioridadBloquea(body.priority)) {
      if (space && space.status !== 'bloqueado') {
        await q(`UPDATE spaces SET status = 'bloqueado' WHERE id = $1`, [space.id]);
        const { rows: afectadas } = await q(
          `SELECT count(*)::int AS n FROM bookings WHERE space_id = $1 AND status = 'confirmada' AND date >= $2`, [space.id, localDate()]);
        effects.push(`${space.name} quedó bloqueado para nuevas reservas` +
          (afectadas[0].n ? ` (${afectadas[0].n} reservas próximas deben reubicarse)` : ''));
      }
      if (equipment) {
        if (equipment.status === 'prestado') {
          effects.push(`${equipment.name} (${equipment.code}) pasará a revisión cuando se devuelva`);
        } else if (equipment.status === 'disponible') {
          await q(`UPDATE equipment SET status = 'en_revision' WHERE id = $1`, [equipment.id]);
          effects.push(`${equipment.name} (${equipment.code}) pasó a revisión y no se puede prestar`);
        }
      }
    }
    effects.push(`Se notificó al área de ${body.area}`);
    await logActivity(q, 'incidencia', `${code} · ${title} (${body.priority}${body.aiModel ? ', clasificada por IA' : ''})`);
    const incident = (await q(`${INCIDENT_SELECT} WHERE i.id = $1`, [rows[0].id])).rows[0];
    return { incident, effects };
  });
  res.status(201).json(result);
});

router.patch('/incidents/:id', requirePermiso('gestionar_incidencias'), async (req, res) => {
  const { status } = z.object({ status: z.enum(['abierta', 'en_progreso', 'resuelta']) }).parse(req.body);
  const result = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM incidents WHERE id = $1 FOR UPDATE', [Number(req.params.id) || 0]);
    const inc = rows[0];
    if (!inc) throw notFound('La incidencia');
    if (inc.status === 'resuelta') throw new HttpError(409, 'YA_RESUELTA', 'La incidencia ya está resuelta.');
    await q(`UPDATE incidents SET status = $2, resolved_at = CASE WHEN $2 = 'resuelta' THEN now() ELSE NULL END WHERE id = $1`, [inc.id, status]);

    const effects = [];
    if (status === 'resuelta') {
      // R6 inverso: se libera el recurso solo si no queda otra incidencia abierta que lo bloquee.
      if (inc.space_id) {
        const { rows: otras } = await q(
          `SELECT 1 FROM incidents WHERE space_id = $1 AND id <> $2 AND status <> 'resuelta' AND priority = ANY($3)`,
          [inc.space_id, inc.id, CONFIG.incidencias.prioridadesQueBloquean]);
        if (!otras.length) {
          const { rows: s } = await q(`UPDATE spaces SET status = 'disponible' WHERE id = $1 AND status = 'bloqueado' RETURNING name`, [inc.space_id]);
          if (s[0]) effects.push(`${s[0].name} volvió a estar disponible`);
        }
      }
      if (inc.equipment_id) {
        const { rows: otras } = await q(
          `SELECT 1 FROM incidents WHERE equipment_id = $1 AND id <> $2 AND status <> 'resuelta' AND priority = ANY($3)`,
          [inc.equipment_id, inc.id, CONFIG.incidencias.prioridadesQueBloquean]);
        if (!otras.length) {
          const { rows: e } = await q(
            `UPDATE equipment SET status = 'disponible' WHERE id = $1 AND status IN ('en_revision','danado') RETURNING name, code`, [inc.equipment_id]);
          if (e[0]) effects.push(`${e[0].name} (${e[0].code}) volvió a estar disponible para préstamo`);
        }
      }
    }
    await logActivity(q, 'incidencia', `${inc.code} pasó a "${status.replace('_', ' ')}" (${req.user.name})`);
    const incident = (await q(`${INCIDENT_SELECT} WHERE i.id = $1`, [inc.id])).rows[0];
    return { incident, effects };
  });
  res.json(result);
});

export default router;
