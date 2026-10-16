export const cn = (...c) => c.filter(Boolean).join(' ');

export const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('') || '?';

export function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

export const hhmmToMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };

export const label = (s = '') => String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// 'YYYY-MM-DD' (o ISO) → "lun, 12 oct" sin desfases de zona horaria
export function formatDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? ''));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(ymd);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

const SPACE_TYPES = { aula: 'Aula', cubiculo: 'Cubículo', laboratorio: 'Laboratorio', auditorio: 'Auditorio' };
export const spaceTypeLabel = (t) => SPACE_TYPES[t] || label(t);
