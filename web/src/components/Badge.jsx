const TONES = {
  ok: 'bg-ok/15 text-ok border-ok/30',
  info: 'bg-info/15 text-info border-info/30',
  bad: 'bg-bad/15 text-bad border-bad/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  ai: 'bg-accent/20 text-[#b4abff] border-accent/40',
  neutral: 'bg-btn/60 text-ink border-line',
};

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const STATUS = {
  disponible: ['ok', 'Disponible'],
  mantenimiento: ['warn', 'Mantenimiento'],
  bloqueado: ['bad', 'Bloqueado'],
  prestado: ['info', 'En uso'],
  en_revision: ['warn', 'En revisión'],
  danado: ['bad', 'Dañado'],
  abierta: ['bad', 'Abierta'],
  en_progreso: ['warn', 'En progreso'],
  resuelta: ['ok', 'Resuelta'],
  activo: ['info', 'Activo'],
  devuelto: ['ok', 'Devuelto'],
};

export function StatusChip({ status }) {
  const [tone, text] = STATUS[status] || ['neutral', status];
  return <Badge tone={tone}>{text}</Badge>;
}

const PRIORITY = { 'Baja': 'ok', 'Media': 'info', 'Alta': 'warn', 'Crítica': 'bad' };
export const PriorityChip = ({ priority }) => <Badge tone={PRIORITY[priority] || 'neutral'}>{priority}</Badge>;
