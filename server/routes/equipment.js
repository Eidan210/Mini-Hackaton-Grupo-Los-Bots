// Módulo 2: equipos y préstamos con trazabilidad de estado.
import { Router } from 'express';
import { z } from 'zod';
import { query, tx, logActivity } from '../db.js';
import { requirePermiso } from '../auth.js';
import { HttpError, notFound, ruleError } from '../http.js';
import { CONFIG, validarPrestamo } from '../rules.js';

const router = Router();

router.get('/equipment', async (_req, res) => {
  const { rows } = await query(`
    SELECT e.*, u.name AS borrower_name, l.due_at
    FROM equipment e
    LEFT JOIN loans l ON l.equipment_id = e.id AND l.status = 'activo'
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY e.category, e.code`);
  res.json(rows);
});

router.patch('/equipment/:id/status', requirePermiso('cambiar_estado_recurso'), async (req, res) => {
  const { status } = z.object({ status: z.enum(['disponible', 'en_revision', 'danado']) }).parse(req.body);
  const equipment = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM equipment WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('El equipo');
    if (rows[0].status === 'prestado') {
      throw new HttpError(409, 'EQUIPO_PRESTADO', 'El equipo está prestado: registra primero la devolución.', { rule: 'R3' });
    }
    if (status === 'disponible') {
      const open = await q(`SELECT code FROM incidents WHERE equipment_id = $1 AND status <> 'resuelta' AND priority = ANY($2)`,
        [req.params.id, CONFIG.incidencias.prioridadesQueBloquean]);
      if (open.rows.length) {
        throw new HttpError(409, 'REGLA_INCIDENCIA_ABIERTA', `No se puede habilitar: la incidencia ${open.rows[0].code} sigue abierta. Resuélvela primero.`, { rule: 'R6' });
      }
    }
    const { rows: upd } = await q('UPDATE equipment SET status = $2 WHERE id = $1 RETURNING *', [req.params.id, status]);
    await logActivity(q, 'estado', `${upd[0].name} (${upd[0].code}) cambió a "${status}" (${req.user.name})`);
    return upd[0];
  });
  res.json({ equipment });
});

const LOAN_SELECT = `SELECT l.*, e.name AS equipment_name, e.code AS equipment_code, u.name AS user_name,
  (l.status = 'activo' AND l.due_at < now()) AS overdue
  FROM loans l JOIN equipment e ON e.id = l.equipment_id JOIN users u ON u.id = l.user_id`;

router.get('/loans', async (req, res) => {
  const status = z.enum(['activo', 'devuelto']).optional().catch(undefined).parse(req.query.status);
  const { rows } = status
    ? await query(`${LOAN_SELECT} WHERE l.status = $1 ORDER BY l.due_at`, [status])
    : await query(`${LOAN_SELECT} ORDER BY l.start_at DESC LIMIT 100`);
  res.json(rows);
});

router.post('/loans', requirePermiso('prestar'), async (req, res) => {
  const body = z.object({
    equipmentId: z.string().min(1, 'elige un equipo'),
    hours: z.coerce.number().positive('debe ser mayor a 0'),
  }).parse(req.body);

  const loan = await tx(async ({ query: q }) => {
    const { rows } = await q('SELECT * FROM equipment WHERE id = $1 FOR UPDATE', [body.equipmentId]);
    if (!rows[0]) throw notFound('El equipo');
    const { rows: activos } = await q(`SELECT * FROM loans WHERE user_id = $1 AND status = 'activo'`, [req.user.id]);
    const v = validarPrestamo({ equipment: rows[0], hours: body.hours, prestamosActivos: activos });
    if (v) throw ruleError(v);
    const { rows: ins } = await q(
      `INSERT INTO loans (equipment_id, user_id, due_at) VALUES ($1, $2, now() + make_interval(mins => $3)) RETURNING id`,
      [body.equipmentId, req.user.id, Math.round(body.hours * 60)],
    );
    await q(`UPDATE equipment SET status = 'prestado' WHERE id = $1`, [body.equipmentId]);
    await logActivity(q, 'prestamo', `${req.user.name} recibió ${rows[0].name} (${rows[0].code}) por ${body.hours} h`);
    return (await q(`${LOAN_SELECT} WHERE l.id = $1`, [ins[0].id])).rows[0];
  });
  res.status(201).json({ loan });
});

router.post('/loans/:id/return', async (req, res) => {
  const loan = await tx(async ({ query: q }) => {
    const { rows } = await q(`${LOAN_SELECT} WHERE l.id = $1`, [Number(req.params.id) || 0]);
    const l = rows[0];
    if (!l) throw notFound('El préstamo');
    if (l.status !== 'activo') throw new HttpError(409, 'YA_DEVUELTO', 'Este préstamo ya fue devuelto.');
    const puede = l.user_id === req.user.id || ['admin', 'coordinador', 'tecnico'].includes(req.user.role);
    if (!puede) throw new HttpError(403, 'SIN_PERMISO', 'Solo quien tiene el equipo o el personal del campus puede registrar la devolución.');
    await q(`UPDATE loans SET status = 'devuelto', returned_at = now() WHERE id = $1`, [l.id]);
    // Si mientras estaba prestado se reportó una incidencia sobre el equipo, vuelve a revisión, no a disponible.
    const { rows: inc } = await q(
      `SELECT 1 FROM incidents WHERE equipment_id = $1 AND status <> 'resuelta' AND priority = ANY($2)`,
      [l.equipment_id, CONFIG.incidencias.prioridadesQueBloquean],
    );
    await q('UPDATE equipment SET status = $2 WHERE id = $1', [l.equipment_id, inc.length ? 'en_revision' : 'disponible']);
    await logActivity(q, 'devolucion', `Devolución de ${l.equipment_name} (${l.equipment_code})${l.overdue ? ' con retraso' : ''}`);
    return (await q(`${LOAN_SELECT} WHERE l.id = $1`, [l.id])).rows[0];
  });
  res.json({ loan });
});

export default router;
