// Estado de activación de las reglas (el administrador puede desactivar/reactivar R1–R7).
// La lógica de cada regla sigue en rules.js; aquí solo se guarda si está activa.
import { REGLAS } from './rules.js';

export async function reglasActivas(q) {
  const { rows } = await q('SELECT id, activa FROM rule_state');
  const off = new Set(rows.filter((r) => !r.activa).map((r) => r.id));
  return new Set(REGLAS.map((r) => r.id).filter((id) => !off.has(id)));
}
