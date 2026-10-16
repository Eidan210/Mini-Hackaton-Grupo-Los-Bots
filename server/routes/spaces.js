// Módulo 1: espacios, bloqueos con fecha y reservas (+ recomendación de alternativa con IA).
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, logActivity } from '../db.js';
import { requirePermiso } from '../auth.js';
import { HttpError, notFound, ruleError } from '../http.js';
import { bloqueoEnFecha, validarReserva } from '../rules.js';
import { reglasActivas } from '../ruleState.js';
import { recomendarEspacio } from '../ai/triage.js';
import { localDate } from '../seed.js';

const router = Router();

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'usa el formato AAAA-MM-DD');
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'usa el formato HH:mm');
const bookingBody = z.object({
  spaceId: z.string().min(1, 'elige un espacio'),
  title: z.string().trim().min(3, 'escribe un motivo de al menos 3 letras').max(120),
  date: fecha,
  startTime: hora,
  endTime: hora,
  attendees: z.coerce.number().int('debe ser un número entero').positive('debe ser al menos 1'),
});

const BOOKING_SELECT = `SELECT b.*, s.name AS space_name, u.name AS organizer_name
  FROM bookings b JOIN spaces s ON s.id = b.space_id JOIN users u ON u.id = b.organizer_id`;
const BLOCK_SELECT = `SELECT sb.*, i.code AS incident_code FROM space_blocks sb LEFT JOIN incidents i ON i.id = sb.incident_id`;

/** Estado de un espacio en una fecha concreta, según sus bloqueos (R3 con fechas). */
function conEstado(space, blocks, date) {
  const b = bloqueoEnFecha(blocks.filter((x) => x.space_id === space.id), date);
  return {
    ...space,
    status: b ? (b.tipo === 'mantenimiento' ? 'mantenimiento' : 'bloqueado') : 'disponible',
    block: b ? { id: b.id, tipo: b.tipo, desde: b.desde, hasta: b.hasta, motivo: b.motivo, incident_code: b.incident_code } : null,
  };
}

router.get('/spaces', async (req, res) => {
  const date = fecha.catch(localDate()).parse(req.query.date);
  const [{ rows: spaces }, { rows: bookings }, { rows: blocks }] = await Promise.all([
    query('SELECT * FROM spaces ORDER BY type, code'),
    query(`${BOOKING_SELECT} WHERE b.date = $1 AND b.status = 'confirmada' ORDER BY b.start_time`, [date]),
    query(`${BLOCK_SELECT} WHERE sb.activo AND sb.desde <= $1 AND $1 <= sb.hasta`, [date]),
  ]);
  res.json(spaces.map((s) => ({ ...conEstado(s, blocks, date), bookings: bookings.filter((b) => b.space_id === s.id) })));
});

router.post('/spaces/:id/blocks', requirePermiso('cambiar_estado_recurso'), async (req, res) => {
  const body = z.object({
    tipo: z.enum(['mantenimiento', 'bloqueo']),
    desde: fecha,
    hasta: fecha,
    motivo: z.string().trim().min(3, 'escribe el motivo').max(160),
  }).refine((b) => b.desde <= b.hasta, { message: 'la fecha "hasta" debe ser igual o posterior a "desde"', path: ['hasta'] })
    .parse(req.body);
  const block = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM spaces WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw notFound('El espacio');
    const { rows: ins } = await q(
      `INSERT INTO space_blocks (space_id, tipo, desde, hasta, motivo, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, body.tipo, body.desde, body.hasta, body.motivo, req.user.id],
    );
    await logActivity(q, 'estado', `${rows[0].name}: ${body.tipo} del ${body.desde} al ${body.hasta} (${body.motivo})`, req.user.id);
    return ins[0];
  });
  res.status(201).json({ block });
});

router.delete('/spaces/:id/blocks/:blockId', requirePermiso('cambiar_estado_recurso'), async (req, res) => {
  await tx(async ({ query: q }) => {
    const { rows } = await q(
      `${BLOCK_SELECT} WHERE sb.id = $1 AND sb.space_id = $2 AND sb.activo`, [Number(req.params.blockId) || 0, req.params.id]);
    const b = rows[0];
    if (!b) throw notFound('El bloqueo');
    if (b.incident_id) {
      const { rows: inc } = await q(`SELECT code FROM incidents WHERE id = $1 AND status <> 'resuelta'`, [b.incident_id]);
      if (inc[0]) {
        throw new HttpError(409, 'REGLA_INCIDENCIA_ABIERTA', `No se puede liberar: la incidencia ${inc[0].code} sigue abierta. Resuélvela primero.`, { rule: 'R6' });
      }
    }
    await q('UPDATE space_blocks SET activo = false WHERE id = $1', [b.id]);
    const { rows: s } = await q('SELECT name FROM spaces WHERE id = $1', [req.params.id]);
    await logActivity(q, 'estado', `${s[0].name} quedó disponible (se liberó: ${b.motivo})`, req.user.id);
  });
  res.json({ ok: true });
});

router.get('/bookings', async (req, res) => {
  const date = fecha.catch(localDate()).parse(req.query.date);
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.date = $1 ORDER BY b.start_time`, [date]);
  res.json(rows);
});

router.post('/bookings', requirePermiso('reservar'), async (req, res) => {
  const body = bookingBody.parse(req.body);
  const booking = await tx(async ({ query: q }) => {
    // FOR UPDATE serializa reservas simultáneas sobre el mismo espacio (evita dobles reservas).
    const { rows } = await q('SELECT * FROM spaces WHERE id = $1 FOR UPDATE', [body.spaceId]);
    if (!rows[0]) throw notFound('El espacio');
    const { rows: existing } = await q(`SELECT * FROM bookings WHERE space_id = $1 AND date = $2 AND status = 'confirmada'`, [body.spaceId, body.date]);
    const { rows: blocks } = await q(`${BLOCK_SELECT} WHERE sb.space_id = $1 AND sb.activo`, [body.spaceId]);
    const activas = await reglasActivas(q);
    const space = conEstado(rows[0], blocks, body.date);
    const v = validarReserva({ space, request: body, bookings: existing, user: req.user, activas });
    if (v) throw ruleError(v);
    const { rows: ins } = await q(
      `INSERT INTO bookings (space_id, title, organizer_id, date, start_time, end_time, attendees)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [body.spaceId, body.title, req.user.id, body.date, body.startTime, body.endTime, body.attendees],
    );
    await logActivity(q, 'reserva', `Reserva de ${rows[0].name} el ${body.date} de ${body.startTime} a ${body.endTime}: "${body.title}"`, req.user.id);
    return (await q(`${BOOKING_SELECT} WHERE b.id = $1`, [ins[0].id])).rows[0];
  });
  res.status(201).json({ booking });
});

router.delete('/bookings/:id', async (req, res) => {
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [Number(req.params.id) || 0]);
  const b = rows[0];
  if (!b) throw notFound('La reserva');
  const puede = b.organizer_id === req.user.id || ['admin', 'coordinador'].includes(req.user.role);
  if (!puede) throw new HttpError(403, 'SIN_PERMISO', 'Solo quien hizo la reserva o un coordinador puede cancelarla.');
  if (b.status === 'cancelada') throw new HttpError(409, 'YA_CANCELADA', 'La reserva ya estaba cancelada.');
  await query(`UPDATE bookings SET status = 'cancelada' WHERE id = $1`, [b.id]);
  await logActivity(query, 'reserva', `Se canceló la reserva de ${b.space_name} (${b.start_time}-${b.end_time})`, req.user.id, b.organizer_id);
  res.json({ booking: { ...b, status: 'cancelada' } });
});

router.post('/ai/recommend-space', async (req, res) => {
  const body = bookingBody.omit({ title: true }).parse(req.body);
  const [{ rows: spaces }, { rows: bookings }, { rows: blocks }, activas] = await Promise.all([
    query('SELECT * FROM spaces ORDER BY code'),
    query(`SELECT * FROM bookings WHERE date = $1 AND status = 'confirmada'`, [body.date]),
    query(`${BLOCK_SELECT} WHERE sb.activo AND sb.desde <= $1 AND $1 <= sb.hasta`, [body.date]),
    reglasActivas(query),
  ]);
  const original = spaces.find((s) => s.id === body.spaceId);
  // Solo se le pasan a la IA los espacios que YA cumplen todas las reglas activas en esa fecha.
  const candidates = spaces.map((s) => conEstado(s, blocks, body.date)).filter((s) => s.id !== body.spaceId && !validarReserva({
    space: s, request: body, bookings: bookings.filter((b) => b.space_id === s.id), user: req.user, activas,
  }));
  if (!candidates.length) return res.json({ suggestion: null, candidates: 0, model: null });
  const result = await recomendarEspacio({ original, request: body, candidates });
  res.json({ ...result, candidates: candidates.length });
});

// Retirar un elemento del catálogo (la capacidad instalada se puede añadir desde "Datos importados" y quitar aquí).
router.delete('/spaces/:id', requirePermiso('importar_datos'), async (req, res) => {
  const result = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM spaces WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('El espacio');
    const { rows: uso } = await q(`SELECT count(*)::int AS n FROM bookings WHERE space_id = $1 AND status = 'confirmada' AND date >= to_char(now(), 'YYYY-MM-DD')`, [req.params.id]);
    if (uso[0].n > 0) {
      throw new HttpError(409, 'EN_USO', `No se puede retirar "${rows[0].name}": tiene reservas próximas; cancélalas primero.`);
    }
    await q('DELETE FROM space_blocks WHERE space_id = $1', [req.params.id]);
    await q('UPDATE incidents SET space_id = NULL WHERE space_id = $1', [req.params.id]);
    await q('DELETE FROM bookings WHERE space_id = $1', [req.params.id]);
    await q('DELETE FROM spaces WHERE id = $1', [req.params.id]);
    await logActivity(q, 'estado', `${req.user.name} retiró ${rows[0].name} (${rows[0].code}) del catálogo`, req.user.id);
    return { ok: true };
  });
  res.json(result);
});

export default router;
