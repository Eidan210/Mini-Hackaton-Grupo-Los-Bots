// Utilidades de formato compartidas por las páginas de Espacios, Equipos e Incidencias.

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// 'YYYY-MM-DD' (o ISO) -> Date local, sin desfase por zona horaria
export function parseDay(value) {
  if (!value) return null;
  const m = DAY_RE.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// '2026-10-20' -> '20 oct 2026'
export function formatDay(value) {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

// Antigüedad legible: "hace 5 h", "hace 3 días"
export function ageLabel(iso) {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return '';
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export const ageHours = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, (Date.now() - t) / 3600000);
};

const ROLE_LABELS = {
  admin: 'Administrador',
  coordinador: 'Coordinador académico',
  tecnico: 'Técnico de soporte',
  trainer: 'Trainer',
  camper: 'Camper',
};
export const roleLabel = (role) => ROLE_LABELS[role] || role || '';
