// Carga inicial: usuarios ficticios + datos oficiales (CSV en server/data) + movimientos de ejemplo.
// Solo se ejecuta si la base está vacía. Los CSV incluyen filas inconsistentes a propósito
// para demostrar que el importador las rechaza sin romper nada.
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { query, tx, logActivity } from './db.js';
import { importRecords } from './importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const localDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD en la zona horaria del servidor
};

const USERS = [
  ['u-admin', 'Valentina Ríos', 'valentina.rios@campus.demo', 'admin'],
  ['u-coord', 'Andrés Pineda', 'andres.pineda@campus.demo', 'coordinador'],
  ['u-tecnico', 'Camila Duarte', 'camila.duarte@campus.demo', 'tecnico'],
  ['u-trainer', 'Miguel Ángel Torres', 'miguel.torres@campus.demo', 'trainer'],
  ['u-camper', 'Sofía Herrera', 'sofia.herrera@campus.demo', 'camper'],
  ['u-camper2', 'Daniel Rojas', 'daniel.rojas@campus.demo', 'camper'],
];

export async function seedIfEmpty() {
  const { rows } = await query('SELECT count(*)::int AS n FROM users');
  if (rows[0].n > 0) return false;

  await tx(async ({ query: q }) => {
    for (const u of USERS) await q('INSERT INTO users (id, name, email, role) VALUES ($1,$2,$3,$4)', u);

    for (const [entity, file] of [['spaces', 'espacios.csv'], ['equipment', 'equipos.csv']]) {
      const content = await readFile(path.join(here, 'data', file), 'utf8');
      await importRecords(q, { entity, format: 'csv', content, source: file });
    }

    const hoy = localDate(0);
    const manana = localDate(1);
    const bookings = [
      ['cosmos', 'Clase de Diseño UX', 'u-trainer', hoy, '08:00', '10:00', 22],
      ['apolo', 'Matemáticas discretas', 'u-coord', hoy, '09:00', '11:00', 30],
      ['apolo', 'Proyecto final · Cohorte 5', 'u-trainer', hoy, '14:00', '16:00', 30],
      ['skilab', 'Laboratorio de bases de datos', 'u-trainer', hoy, '10:00', '12:00', 18],
      ['amarilla', 'Reunión de equipo', 'u-camper', hoy, '10:00', '11:00', 4],
      ['spooki', 'Bootcamp Java Backend', 'u-trainer', hoy, '13:00', '17:00', 36],
      ['aud-1', 'Demo Day Hackatón', 'u-coord', hoy, '18:00', '20:00', 90],
      ['cosmos', 'Tutoría de algoritmos', 'u-trainer', manana, '08:00', '10:00', 18],
      ['spooki', 'Taller de Git', 'u-trainer', manana, '14:00', '16:00', 30],
    ];
    for (const b of bookings) {
      await q('INSERT INTO bookings (space_id, title, organizer_id, date, start_time, end_time, attendees) VALUES ($1,$2,$3,$4,$5,$6,$7)', b);
    }

    // Préstamos: uno vigente y uno vencido (demuestra la regla R4).
    await q(`INSERT INTO loans (equipment_id, user_id, start_at, due_at) VALUES ('pc-001', 'u-trainer', now() - interval '2 hours', now() + interval '6 hours')`);
    await q(`INSERT INTO loans (equipment_id, user_id, start_at, due_at) VALUES ('pc-002', 'u-camper2', now() - interval '30 hours', now() - interval '6 hours')`);
    await q(`UPDATE equipment SET status = 'prestado' WHERE id IN ('pc-001', 'pc-002')`);

    // Incidencias históricas (registradas manualmente, sin IA: ai_model = NULL).
    await q(`INSERT INTO incidents (code, title, description, category, priority, area, justification, space_id, status, reported_by, created_at)
             VALUES ('INC-0001', 'Chispa en tomacorriente', 'Salió una chispa del tomacorriente de la fila 3 de Artemis y se fue la luz en esa fila.',
                     'Eléctrica', 'Crítica', 'Mantenimiento', 'Riesgo eléctrico para las personas del salón.', 'artemis', 'abierta', 'u-tecnico', now() - interval '3 hours')`);
    await q(`UPDATE spaces SET status = 'bloqueado' WHERE id = 'artemis'`);
    await q(`INSERT INTO incidents (code, title, description, category, priority, area, justification, equipment_id, status, reported_by, created_at)
             VALUES ('INC-0002', 'Televisor no enciende', 'El televisor TV-03 de Cosmos no enciende y huele a quemado.', 'Hardware', 'Alta', 'Soporte TI',
                     'Equipo inservible con posible daño en la fuente.', 'tv-03', 'en_progreso', 'u-trainer', now() - interval '1 day')`);

    await q(`UPDATE equipment SET status = 'danado' WHERE id = 'tv-03'`);
    await logActivity(q, 'incidencia', 'INC-0001 · Artemis bloqueado por riesgo eléctrico');
    await logActivity(q, 'prestamo', 'Miguel Ángel Torres recibió Computador de escritorio Spooki (PC-001)');
    await logActivity(q, 'reserva', 'Reserva de Apolo para "Proyecto final · Cohorte 5"');
    await q(`INSERT INTO app_meta (key, value) VALUES ('capacidad_instalada_v1', now()::text) ON CONFLICT (key) DO NOTHING`);
  });
  return true;
}

/**
 * Migración v2 (idempotente): contraseñas para los usuarios de prueba, estados globales de espacio
 * convertidos en bloqueos con fecha y técnico asignado en las incidencias en curso.
 */
export async function migrateV2() {
  const { hashPassword, verifyPassword } = await import('./auth.js');
  const { fechaLiberacion } = await import('./rules.js');

  // Cuentas de prueba (@campus.demo): no tienen contraseña conocida; se usan con el acceso rápido (DEMO_LOGIN=true).
  // Opcional: SEED_PASSWORD les pone una contraseña para entrar con correo (útil en desarrollo).
  const seedPassword = process.env.SEED_PASSWORD;
  const { rows: demo } = await query(`SELECT id, password_hash FROM users WHERE email LIKE '%@campus.demo'`);
  for (const u of demo) {
    if (seedPassword) {
      if (!(await verifyPassword(seedPassword, u.password_hash))) {
        await query('UPDATE users SET password_hash = $2 WHERE id = $1', [u.id, await hashPassword(seedPassword)]);
      }
    } else if (!u.password_hash) {
      await query('UPDATE users SET password_hash = $2 WHERE id = $1', [u.id, await hashPassword(randomBytes(24).toString('hex'))]);
    }
  }

  await tx(async ({ query: q }) => {
    // Evita que dos instancias del servidor migren a la vez (pasó al arrancar dos procesos juntos).
    await q('SELECT pg_advisory_xact_lock(7300)');
    // Limpieza: bloqueos duplicados idénticos que dejó esa carrera.
    await q(`UPDATE space_blocks b SET activo = false
             WHERE b.activo AND EXISTS (SELECT 1 FROM space_blocks o WHERE o.activo AND o.id < b.id AND o.space_id = b.space_id
               AND o.tipo = b.tipo AND o.desde = b.desde AND o.hasta = b.hasta AND o.motivo = b.motivo
               AND o.incident_id IS NOT DISTINCT FROM b.incident_id)`);
    const hoy = localDate(0);
    const { rows: spaces } = await q(`SELECT * FROM spaces WHERE status <> 'disponible'`);
    for (const s of spaces) {
      const { rows: inc } = await q(
        `SELECT id, code, title, priority, created_at FROM incidents
         WHERE space_id = $1 AND status <> 'resuelta' ORDER BY created_at DESC LIMIT 1`, [s.id]);
      const tipo = s.status === 'mantenimiento' ? 'mantenimiento' : 'bloqueo';
      const desde = inc[0] ? new Date(inc[0].created_at).toLocaleDateString('en-CA') : hoy;
      const hasta = tipo === 'mantenimiento' ? localDate(7) : fechaLiberacion(inc[0]?.priority || 'Alta', desde);
      const motivo = inc[0] ? `${inc[0].code} · ${inc[0].title}` : 'Mantenimiento programado';
      await q('INSERT INTO space_blocks (space_id, tipo, desde, hasta, motivo, incident_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [s.id, tipo, desde, hasta, motivo, inc[0]?.id || null]);
      await q(`UPDATE spaces SET status = 'disponible' WHERE id = $1`, [s.id]);
    }
    await q(`UPDATE incidents SET assigned_to = 'u-tecnico'
             WHERE assigned_to IS NULL AND status = 'en_progreso' AND EXISTS (SELECT 1 FROM users WHERE id = 'u-tecnico')`);
  });
}

// Catálogo ficticio de la primera versión, reemplazado por la capacidad instalada real del campus.
const OLD_SPACES = ['a-101', 'a-102', 'b-201', 'b-202', 'lab-1', 'lab-2', 'c-01', 'c-02', 'c-03', 'c-09'];
const OLD_EQUIPMENT = ['lp-001', 'lp-002', 'lp-003', 'lp-004', 'pr-101', 'pr-102', 'pr-103', 'tb-015', 'tb-016', 'au-001', 'rt-001'];

/** Migración v3 (una sola vez por base): carga la capacidad instalada real desde server/data. */
export async function migrateV3() {
  await tx(async ({ query: q }) => {
    await q('SELECT pg_advisory_xact_lock(7303)');
    const { rows } = await q(`SELECT 1 FROM app_meta WHERE key = 'capacidad_instalada_v1'`);
    if (rows.length) return;
    for (const [entity, file] of [['spaces', 'espacios.csv'], ['equipment', 'equipos.csv']]) {
      const content = await readFile(path.join(here, 'data', file), 'utf8');
      await importRecords(q, { entity, format: 'csv', content, source: file });
    }
    // Se retiran los espacios y equipos ficticios con sus movimientos de prueba.
    await q('DELETE FROM bookings WHERE space_id = ANY($1)', [OLD_SPACES]);
    await q('DELETE FROM space_blocks WHERE space_id = ANY($1)', [OLD_SPACES]);
    await q('DELETE FROM loans WHERE equipment_id = ANY($1)', [OLD_EQUIPMENT]);
    await q('UPDATE incidents SET space_id = NULL WHERE space_id = ANY($1)', [OLD_SPACES]);
    await q('UPDATE incidents SET equipment_id = NULL WHERE equipment_id = ANY($1)', [OLD_EQUIPMENT]);
    await q('DELETE FROM spaces WHERE id = ANY($1)', [OLD_SPACES]);
    await q('DELETE FROM equipment WHERE id = ANY($1)', [OLD_EQUIPMENT]);
    await q(`INSERT INTO app_meta (key, value) VALUES ('capacidad_instalada_v1', now()::text)`);
    await logActivity(q, 'importacion', 'Se cargó la capacidad instalada real del campus (10 espacios y 188 recursos)');
  });
}
