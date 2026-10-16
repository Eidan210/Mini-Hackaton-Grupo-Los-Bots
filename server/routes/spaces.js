// Módulo 1: espacios y reservas (+ recomendación de alternativa con IA).
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, logActivity } from '../db.js';
import { requirePermiso } from '../auth.js';
import { HttpError, notFound, ruleError } from '../http.js';
import { CONFIG, validarReserva } from '../rules.js';
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

router.get('/spaces', async (req, res) => {
  const date = fecha.catch(localDate()).parse(req.query.date);
  const [{ rows: spaces }, { rows: bookings }] = await Promise.all([
    query('SELECT * FROM spaces ORDER BY type, code'),
    query(`${BOOKING_SELECT} WHERE b.date = $1 AND b.status = 'confirmada' ORDER BY b.start_time`, [date]),
  ]);
  res.json(spaces.map((s) => ({ ...s, bookings: bookings.filter((b) => b.space_id === s.id) })));
});

router.patch('/spaces/:id/status', requirePermiso('cambiar_estado_recurso'), async (req, res) => {
  const { status } = z.object({ status: z.enum(['disponible', 'mantenimiento', 'bloqueado']) }).parse(req.body);
  const space = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM spaces WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('El espacio');
    if (status === 'disponible') {
      const open = await q(`SELECT code FROM incidents WHERE space_id = $1 AND status <> 'resuelta' AND priority = ANY($2)`,
        [req.params.id, CONFIG.incidencias.prioridadesQueBloquean]);
      if (open.rows.length) {
        throw new HttpError(409, 'REGLA_INCIDENCIA_ABIERTA', `No se puede habilitar: la incidencia ${open.rows[0].code} sigue abierta. Resuélvela primero.`, { rule: 'R6' });
      }
    }
    const { rows: upd } = await q('UPDATE spaces SET status = $2 WHERE id = $1 RETURNING *', [req.params.id, status]);
    await logActivity(q, 'estado', `${upd[0].name} cambió a "${status}" (${req.user.name})`);
    return upd[0];
  });
  res.json({ space });
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
    const v = validarReserva({ space: rows[0], request: body, bookings: existing, user: req.user });
    if (v) throw ruleError(v);
    const { rows: ins } = await q(
      `INSERT INTO bookings (space_id, title, organizer_id, date, start_time, end_time, attendees)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [body.spaceId, body.title, req.user.id, body.date, body.startTime, body.endTime, body.attendees],
    );
    await logActivity(q, 'reserva', `Reserva de ${rows[0].name} el ${body.date} de ${body.startTime} a ${body.endTime}: "${body.title}"`);
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
  await logActivity(query, 'reserva', `Se canceló la reserva de ${b.space_name} (${b.start_time}-${b.end_time})`);
  res.json({ booking: { ...b, status: 'cancelada' } });
});

router.post('/ai/recommend-space', async (req, res) => {
  const body = bookingBody.omit({ title: true }).parse(req.body);
  const [{ rows: spaces }, { rows: bookings }] = await Promise.all([
    query('SELECT * FROM spaces ORDER BY code'),
    query(`SELECT * FROM bookings WHERE date = $1 AND status = 'confirmada'`, [body.date]),
  ]);
  const original = spaces.find((s) => s.id === body.spaceId);
  // Solo se le pasan a la IA los espacios que YA cumplen todas las reglas.
  const candidates = spaces.filter((s) => s.id !== body.spaceId && !validarReserva({
    space: s, request: body, bookings: bookings.filter((b) => b.space_id === s.id), user: req.user,
  }));
  if (!candidates.length) return res.json({ suggestion: null, candidates: 0, model: null });
  const result = await recomendarEspacio({ original, request: body, candidates });
  res.json({ ...result, candidates: candidates.length });
});

export default router;
