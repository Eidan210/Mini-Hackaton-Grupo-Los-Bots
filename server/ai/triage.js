// Triaje de incidencias y recomendación de espacios con Nemotron.
// La IA propone; el backend valida contra el catálogo y las reglas, y el usuario confirma.
import { z } from 'zod';
import { askJson } from './nemotron.js';
import { CATALOGOS } from '../rules.js';

const triageSchema = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(CATALOGOS.categorias),
  priority: z.enum(CATALOGOS.prioridades),
  area: z.enum(CATALOGOS.areas),
  spaceId: z.string().nullable().optional(),
  equipmentId: z.string().nullable().optional(),
  justification: z.string().min(5).max(600),
  recommendations: z.array(z.string().max(200)).max(4).default([]),
});

export async function analizarIncidencia({ description, space, equipment, spaces, equipmentList }) {
  const system = `Eres el motor de triaje operativo del Campus Campuslands (Bucaramanga).
Clasificas reportes de incidencias de aulas, cubículos, laboratorios y equipos tecnológicos.
Criterios de prioridad:
- "Crítica": riesgo para la seguridad de personas (eléctrico, incendio, agua sobre equipos) o un espacio inutilizable con clase en curso.
- "Alta": falla que impide trabajar a un grupo completo (sin proyector, sin red en un aula, equipo inservible).
- "Media": afectación parcial con alternativa disponible.
- "Baja": detalle menor, estético o solicitud sin urgencia.
Responde ÚNICAMENTE con un objeto JSON con esta forma exacta:
{"title": string corto, "category": uno de ${JSON.stringify(CATALOGOS.categorias)}, "priority": uno de ${JSON.stringify(CATALOGOS.prioridades)}, "area": uno de ${JSON.stringify(CATALOGOS.areas)}, "spaceId": id del espacio afectado o null, "equipmentId": id del equipo afectado o null, "justification": por qué esa categoría y prioridad (1-2 frases), "recommendations": [hasta 3 acciones concretas]}`;

  const user = `Reporte del usuario: """${description}"""
Espacio seleccionado por el usuario: ${space ? `${space.id} (${space.name})` : 'ninguno'}
Equipo seleccionado por el usuario: ${equipment ? `${equipment.id} (${equipment.name}, ${equipment.code})` : 'ninguno'}
Catálogo de espacios: ${spaces.map((s) => `${s.id}=${s.name} [${s.code}]`).join('; ')}
Catálogo de equipos: ${equipmentList.map((e) => `${e.id}=${e.name} [${e.code}]`).join('; ')}
Si el usuario seleccionó un espacio o equipo, úsalo. Si el texto menciona uno del catálogo (por nombre o código entre corchetes),
devuelve su id, que es el texto ANTES del signo "=" (por ejemplo "a-102" o "pr-103"). Si no menciona ninguno, null.`;

  const result = await askJson({ system, user, schema: triageSchema });
  // Control de respuesta: ids que no existen en el catálogo se descartan.
  const a = result.data;
  a.spaceId = space?.id || matchCatalog(spaces, a.spaceId) || mentionedCode(spaces, description);
  a.equipmentId = equipment?.id || matchCatalog(equipmentList, a.equipmentId) || mentionedCode(equipmentList, description);
  return result;
}

/** Acepta el id o el código que haya devuelto la IA, si existe en el catálogo. */
function matchCatalog(list, value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return list.find((x) => x.id?.toLowerCase() === v || x.code?.toLowerCase() === v)?.id || null;
}

/** Si el texto cita exactamente un código del catálogo (p. ej. "PR-103"), lo enlaza. */
function mentionedCode(list, text) {
  const found = list.filter((x) => x.code && new RegExp(`(^|[^\\w-])${x.code}($|[^\\w-])`, 'i').test(text || ''));
  return found.length === 1 ? found[0].id : null;
}

const recommendSchema = z.object({
  spaceId: z.string(),
  reason: z.string().min(5).max(400),
});

/** Elige, entre candidatos que YA cumplen las reglas, el mejor reemplazo y explica por qué. */
export async function recomendarEspacio({ original, request, candidates }) {
  const system = `Eres el asistente de reservas del Campus Campuslands. Una reserva fue rechazada por las reglas del campus.
Elige el mejor espacio alternativo de la lista de candidatos (todos están libres y cumplen las reglas).
Prefiere: capacidad cercana a los asistentes (sin desperdiciar un auditorio), mismo tipo de espacio y misma ubicación o torre.
Responde ÚNICAMENTE con JSON: {"spaceId": id elegido de la lista, "reason": explicación breve en español para el usuario}`;
  const user = `Solicitud: ${request.attendees} asistentes, ${request.date} de ${request.startTime} a ${request.endTime}.
Espacio pedido originalmente: ${original ? `${original.name} (${original.type}, capacidad ${original.capacity}, ${original.location})` : 'desconocido'}.
Candidatos: ${candidates.map((c) => `${c.id}=${c.name} (${c.type}, capacidad ${c.capacity}, ${c.location})`).join('; ')}`;

  const result = await askJson({ system, user, schema: recommendSchema });
  const chosen = candidates.find((c) => c.id === result.data.spaceId);
  if (!chosen) return { suggestion: null, model: result.model, latencyMs: result.latencyMs };
  return {
    suggestion: { spaceId: chosen.id, name: chosen.name, reason: result.data.reason },
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
