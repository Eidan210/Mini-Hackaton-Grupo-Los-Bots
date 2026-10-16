// Módulo 3: incidencias con triaje por IA (Nemotron), bitácora de técnicos, consulta a la IA
// y efectos automáticos sobre los recursos (R6, con bloqueos de espacio por fechas).
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, logActivity } from '../db.js';
import { requirePermiso } from '../auth.js';
import { HttpError, notFound } from '../http.js';
import { CATALOGOS, CONFIG, consecuenciaIncidencia, fechaLiberacion, prioridadBloquea, tienePermiso } from '../rules.js';
import { reglasActivas } from '../ruleState.js';
import { analizarIncidencia, responderSobreIncidencias } from '../ai/triage.js';
import { localDate } from '../seed.js';

const router = Router();

const INCIDENT_SELECT = `SELECT i.*, s.name AS space_name, e.name AS equipment_name, e.code AS equipment_code,
    u.name AS reported_by_name, t.name AS assigned_name,
    n.text AS last_note, n.created_at AS last_note_at, COALESCE(nc.n, 0) AS notes_count, sb.hasta AS block_hasta
  FROM incidents i
  LEFT JOIN spaces s ON s.id = i.space_id
  LEFT JOIN equipment e ON e.id = i.equipment_id
  JOIN users u ON u.id = i.reported_by
  LEFT JOIN users t ON t.id = i.assigned_to
  LEFT JOIN LATERAL (SELECT text, created_at FROM incident_notes WHERE incident_id = i.id ORDER BY created_at DESC LIMIT 1) n ON TRUE
  LEFT JOIN LATERAL (SELECT count(*)::int AS n FROM incident_notes WHERE incident_id = i.id) nc ON TRUE
  LEFT JOIN LATERAL (SELECT hasta FROM space_blocks WHERE incident_id = i.id AND activo ORDER BY id DESC LIMIT 1) sb ON TRUE`;

const optionalId = z.string().trim().min(1).nullish().transform((v) => v || null);

async function loadTargets(spaceId, equipmentId) {
  const space = spaceId ? (await query('SELECT * FROM spaces WHERE id = $1', [spaceId])).rows[0] : null;
  const equipment = equipmentId ? (await query('SELECT * FROM equipment WHERE id = $1', [equipmentId])).rows[0] : null;
  if (spaceId && !space) throw notFound('El espacio');
  if (equipmentId && !equipment) throw notFound('El equipo');
  return { space, equipment };
}

/** Quien solo reporta (camper, trainer) ve sus incidencias; quien tiene tablero ve todas. */
router.get('/incidents', async (req, res) => {
  const { rows } = tienePermiso(req.user.role, 'ver_tablero_incidencias')
    ? await query(`${INCIDENT_SELECT} ORDER BY (i.status = 'resuelta'), i.updated_at DESC`)
    : await query(`${INCIDENT_SELECT} WHERE i.reported_by = $1 ORDER BY (i.status = 'resuelta'), i.created_at DESC`, [req.user.id]);
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
  let consequence = consecuenciaIncidencia({ priority: data.priority, ...targets });
  if (targets.space && prioridadBloquea(data.priority, await reglasActivas(query))) {
    consequence += ` Liberación estimada del espacio: ${fechaLiberacion(data.priority, localDate())} o antes si se resuelve.`;
  }
  res.json({ analysis: data, consequence, model, latencyMs });
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
    // Serializa la creación para que dos reportes simultáneos no generen el mismo código INC-xxxx.
    await q('SELECT pg_advisory_xact_lock(7301)');
    const { rows: n } = await q(`SELECT COALESCE(max(substring(code from 5)::int), 0) AS n FROM incidents WHERE code ~ '^INC-[0-9]+$'`);
    const code = `INC-${String(n[0].n + 1).padStart(4, '0')}`;
    const title = body.title || body.description.slice(0, 60);
    // Un técnico que reporta queda asignado; si no, se asigna al primer técnico disponible.
    const { rows: tec } = await q(`SELECT id FROM users WHERE role = 'tecnico' ORDER BY created_at LIMIT 1`);
    const assigned = req.user.role === 'tecnico' ? req.user.id : tec[0]?.id || null;
    const { rows } = await q(
      `INSERT INTO incidents (code, title, description, category, priority, area, justification, space_id, equipment_id, ai_model, reported_by, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [code, title, body.description, body.category, body.priority, body.area, body.justification,
        body.spaceId, body.equipmentId, body.aiModel || null, req.user.id, assigned],
    );
    const incidentId = rows[0].id;

    const effects = [];
    if (prioridadBloquea(body.priority, await reglasActivas(q))) {
      if (space) {
        const desde = localDate();
        const hasta = fechaLiberacion(body.priority, desde);
        await q(`INSERT INTO space_blocks (space_id, tipo, desde, hasta, motivo, incident_id, created_by) VALUES ($1,'bloqueo',$2,$3,$4,$5,$6)`,
          [space.id, desde, hasta, `${code} · ${title}`, incidentId, req.user.id]);
        const { rows: afectadas } = await q(
          `SELECT count(*)::int AS n FROM bookings WHERE space_id = $1 AND status = 'confirmada' AND date BETWEEN $2 AND $3`, [space.id, desde, hasta]);
        effects.push(`${space.name} quedó bloqueado para nuevas reservas hasta el ${hasta} (o hasta que se resuelva)` +
          (afectadas[0].n ? `; ${afectadas[0].n} reservas en ese rango deben reubicarse` : ''));
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
    await logActivity(q, 'incidencia', `${code} · ${title} (${body.priority}${body.aiModel ? ', clasificada por IA' : ''})`, req.user.id, assigned);
    const incident = (await q(`${INCIDENT_SELECT} WHERE i.id = $1`, [incidentId])).rows[0];
    return { incident, effects };
  });
  res.status(201).json(result);
});

router.patch('/incidents/:id', requirePermiso('gestionar_incidencias'), async (req, res) => {
  const body = z.object({
    status: z.enum(['abierta', 'en_progreso', 'resuelta']).optional(),
    assignedTo: z.string().min(1).nullable().optional(),
  }).refine((b) => b.status !== undefined || b.assignedTo !== undefined, { message: 'indica el estado o el técnico asignado' })
    .parse(req.body);

  const result = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM incidents WHERE id = $1 FOR UPDATE', [Number(req.params.id) || 0]);
    const inc = rows[0];
    if (!inc) throw notFound('La incidencia');
    if (inc.status === 'resuelta') throw new HttpError(409, 'YA_RESUELTA', 'La incidencia ya está resuelta.');
    const effects = [];

    let assigned = inc.assigned_to;
    if (body.assignedTo !== undefined) {
      if (body.assignedTo) {
        const { rows: t } = await q(`SELECT name FROM users WHERE id = $1 AND role = 'tecnico'`, [body.assignedTo]);
        if (!t[0]) throw new HttpError(400, 'VALIDACION', 'Solo se puede asignar a un usuario con rol Técnico.');
        effects.push(`Asignada a ${t[0].name}`);
      }
      assigned = body.assignedTo;
    }
    if (body.status === 'en_progreso' && !assigned && req.user.role === 'tecnico') {
      assigned = req.user.id;
      effects.push(`Asignada a ${req.user.name}`);
    }
    const status = body.status || inc.status;
    await q(`UPDATE incidents SET status = $2, assigned_to = $3, updated_at = now(),
               resolved_at = CASE WHEN $2 = 'resuelta' THEN now() ELSE NULL END WHERE id = $1`, [inc.id, status, assigned]);

    if (status === 'resuelta') {
      // R6 inverso: se libera el bloqueo de esta incidencia y el equipo, si no queda otra incidencia que los bloquee.
      const { rows: lib } = await q(
        `UPDATE space_blocks sb SET activo = false FROM spaces s
         WHERE sb.incident_id = $1 AND sb.activo AND s.id = sb.space_id RETURNING s.name`, [inc.id]);
      if (lib[0]) effects.push(`${lib[0].name} volvió a estar disponible`);
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
    const cambio = body.status ? `pasó a "${status.replace('_', ' ')}"` : 'cambió de técnico asignado';
    await logActivity(q, 'incidencia', `${inc.code} ${cambio} (${req.user.name})`, req.user.id, inc.reported_by);
    const incident = (await q(`${INCIDENT_SELECT} WHERE i.id = $1`, [inc.id])).rows[0];
    return { incident, effects };
  });
  res.json(result);
});

// ---------- bitácora de avances ----------
router.get('/incidents/:id/notes', async (req, res) => {
  const id = Number(req.params.id) || 0;
  const { rows: inc } = await query('SELECT reported_by FROM incidents WHERE id = $1', [id]);
  if (!inc[0]) throw notFound('La incidencia');
  if (!tienePermiso(req.user.role, 'ver_tablero_incidencias') && inc[0].reported_by !== req.user.id) {
    throw new HttpError(403, 'SIN_PERMISO', 'Solo puedes ver el avance de tus propias incidencias.');
  }
  const { rows } = await query(
    `SELECT n.id, n.text, n.created_at, u.name AS author_name, u.role AS author_role
     FROM incident_notes n JOIN users u ON u.id = n.author_id WHERE n.incident_id = $1 ORDER BY n.created_at`, [id]);
  res.json(rows);
});

router.post('/incidents/:id/notes', requirePermiso('registrar_avance', 'gestionar_incidencias'), async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(3, 'escribe el avance').max(800) }).parse(req.body);
  const note = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT id, code, reported_by FROM incidents WHERE id = $1', [Number(req.params.id) || 0]);
    if (!rows[0]) throw notFound('La incidencia');
    const { rows: ins } = await q('INSERT INTO incident_notes (incident_id, author_id, text) VALUES ($1,$2,$3) RETURNING id, text, created_at',
      [rows[0].id, req.user.id, text]);
    await q('UPDATE incidents SET updated_at = now() WHERE id = $1', [rows[0].id]);
    await logActivity(q, 'incidencia', `${rows[0].code}: nuevo avance de ${req.user.name}`, req.user.id, rows[0].reported_by);
    return { ...ins[0], author_name: req.user.name, author_role: req.user.role };
  });
  res.status(201).json({ note });
});

// ---------- consulta a la IA sobre el estado de las incidencias ----------
router.post('/ai/incidents/ask', requirePermiso('consultar_ia_incidencias'), async (req, res) => {
  const body = z.object({
    question: z.string().trim().min(3, 'escribe tu pregunta').max(400),
    incidentId: z.coerce.number().int().positive().optional(),
  }).parse(req.body);
  const filtro = body.incidentId ? 'WHERE i.id = $1' : `WHERE i.status <> 'resuelta' OR i.resolved_at > now() - interval '2 days'`;
  const { rows: incidents } = await query(`${INCIDENT_SELECT} ${filtro} ORDER BY i.updated_at DESC LIMIT 25`, body.incidentId ? [body.incidentId] : []);
  if (body.incidentId && !incidents.length) throw notFound('La incidencia');
  const ids = incidents.map((i) => i.id);
  const { rows: notes } = ids.length
    ? await query(`SELECT n.incident_id, n.text, n.created_at, u.name AS author_name FROM incident_notes n
                   JOIN users u ON u.id = n.author_id WHERE n.incident_id = ANY($1) ORDER BY n.created_at`, [ids])
    : { rows: [] };
  const result = await responderSobreIncidencias({ question: body.question, incidents, notes });
  res.json(result);
});

export default router;
