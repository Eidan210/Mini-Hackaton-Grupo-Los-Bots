// Importador de los datos oficiales (CSV o JSON). Valida fila por fila: lo válido se guarda,
// lo inconsistente se rechaza con su motivo en import_errors (nunca tumba el servidor).
import { z } from 'zod';
import { logActivity } from './db.js';

/** Parser CSV mínimo con soporte de comillas dobles. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => norm(h));
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const norm = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

const ALIAS = {
  type: { aula: 'aula', salon: 'aula', cubiculo: 'cubiculo', laboratorio: 'laboratorio', lab: 'laboratorio', auditorio: 'auditorio' },
  spaceStatus: { disponible: 'disponible', '': 'disponible', mantenimiento: 'mantenimiento', bloqueado: 'bloqueado', inhabilitado: 'bloqueado' },
  category: { portatil: 'portatil', laptop: 'portatil', computador_portatil: 'portatil', proyector: 'proyector', tablet: 'tablet', audio: 'audio', red: 'red', otro: 'otro' },
  equipmentStatus: { disponible: 'disponible', '': 'disponible', en_revision: 'en_revision', revision: 'en_revision', mantenimiento: 'en_revision', danado: 'danado', inhabilitado: 'danado' },
};

const enumFrom = (map, label) => z.string().transform((v, ctx) => {
  const val = map[norm(v)];
  if (!val) ctx.addIssue({ code: 'custom', message: `${label} "${v}" no es válido` });
  return val;
});

const spaceRow = z.object({
  code: z.string().min(1, 'código vacío'),
  name: z.string().min(1, 'nombre vacío'),
  type: enumFrom(ALIAS.type, 'tipo'),
  capacity: z.coerce.number({ message: 'capacidad no numérica' }).int('capacidad no entera').positive('capacidad debe ser mayor a 0'),
  location: z.string().default(''),
  status: enumFrom(ALIAS.spaceStatus, 'estado').default('disponible'),
});

const equipmentRow = z.object({
  code: z.string().min(1, 'código vacío'),
  name: z.string().min(1, 'nombre vacío'),
  category: enumFrom(ALIAS.category, 'categoría'),
  location: z.string().default(''),
  status: z.string().default('disponible').transform((v, ctx) => {
    if (norm(v) === 'prestado') {
      ctx.addIssue({ code: 'custom', message: 'estado "prestado" sin un préstamo registrado que lo respalde' });
      return undefined;
    }
    const val = ALIAS.equipmentStatus[norm(v)];
    if (!val) ctx.addIssue({ code: 'custom', message: `estado "${v}" no es válido` });
    return val;
  }),
});

// Admite encabezados en español o inglés.
const HEADER_MAP = { codigo: 'code', nombre: 'name', tipo: 'type', capacidad: 'capacity', aforo: 'capacity', ubicacion: 'location', estado: 'status', categoria: 'category' };
const mapHeaders = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [HEADER_MAP[norm(k)] || norm(k), typeof v === 'string' ? v.trim() : v]));

/**
 * Importa filas de espacios o equipos dentro de una transacción.
 * @returns {{inserted:number, updated:number, rejected:{row:number, raw:string, reason:string}[]}}
 */
export async function importRecords(q, { entity, format, content, source }) {
  let records;
  try {
    records = format === 'json' ? JSON.parse(content) : parseCsv(content);
  } catch {
    return { inserted: 0, updated: 0, rejected: [{ row: 0, raw: String(content).slice(0, 120), reason: 'El archivo no se pudo leer (formato inválido).' }] };
  }
  if (!Array.isArray(records)) records = records?.[entity] || [];

  const schema = entity === 'spaces' ? spaceRow : equipmentRow;
  const seen = new Set();
  const result = { inserted: 0, updated: 0, rejected: [] };

  for (const [i, original] of records.entries()) {
    const rowNumber = i + 2; // +1 por el encabezado, +1 porque las filas empiezan en 1
    const raw = format === 'json' ? JSON.stringify(original) : Object.values(original).join(',');
    const reject = async (reason) => {
      result.rejected.push({ row: rowNumber, raw, reason });
      await q('INSERT INTO import_errors (source, row_number, raw, reason) VALUES ($1, $2, $3, $4)', [source, rowNumber, raw, reason]);
    };

    const parsed = schema.safeParse(mapHeaders(original || {}));
    if (!parsed.success) {
      await reject(parsed.error.issues.map((x) => x.message).join('; '));
      continue;
    }
    const r = parsed.data;
    const code = r.code.toUpperCase();
    if (seen.has(code)) {
      await reject(`código ${code} duplicado dentro del mismo archivo`);
      continue;
    }
    seen.add(code);
    const id = code.toLowerCase();

    if (entity === 'spaces') {
      const { rows } = await q(
        `INSERT INTO spaces (id, code, name, type, capacity, location, status) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, capacity = EXCLUDED.capacity,
           location = EXCLUDED.location,
           status = CASE WHEN spaces.status = 'bloqueado' THEN spaces.status ELSE EXCLUDED.status END
         RETURNING (xmax = 0) AS inserted`,
        [id, code, r.name, r.type, r.capacity, r.location, r.status],
      );
      rows[0].inserted ? result.inserted++ : result.updated++;
    } else {
      const { rows } = await q(
        `INSERT INTO equipment (id, code, name, category, location, status) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, location = EXCLUDED.location,
           status = CASE WHEN equipment.status IN ('prestado','en_revision') THEN equipment.status ELSE EXCLUDED.status END
         RETURNING (xmax = 0) AS inserted`,
        [id, code, r.name, r.category, r.location, r.status],
      );
      rows[0].inserted ? result.inserted++ : result.updated++;
    }
  }

  await logActivity(q, 'importacion', `Importación de ${entity === 'spaces' ? 'espacios' : 'equipos'} (${source}): ${result.inserted} nuevos, ${result.updated} actualizados, ${result.rejected.length} rechazados`);
  return result;
}
