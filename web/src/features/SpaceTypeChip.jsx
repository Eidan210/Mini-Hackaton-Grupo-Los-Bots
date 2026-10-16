import { spaceType, withAlpha } from './spaceTypes.js';

// Chip de tipo de espacio: color + ícono + texto (el color nunca es la única señal).
export default function SpaceTypeChip({ type, className = '' }) {
  const t = spaceType(type);
  const Icon = t.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium text-ink ${className}`}
      style={{ borderColor: t.color, backgroundColor: withAlpha(t.color, 0.14) }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: t.color }} aria-hidden="true" />
      {t.label}
    </span>
  );
}
