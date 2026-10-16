import { Ban, LockOpen, Trash2, Users, Wrench } from 'lucide-react';
import Button from '../components/Button.jsx';
import { StatusChip } from '../components/Badge.jsx';
import SpaceTypeChip from './SpaceTypeChip.jsx';
import { spaceType, withAlpha } from './spaceTypes.js';
import { formatDay } from './format.js';
import { HOURS, SLOTS, bookingStyle } from './timeline.js';

const NOTICE_TONE = {
  warn: { box: 'border-warn/50 bg-warn/10', title: 'text-warn' },
  bad: { box: 'border-bad/50 bg-bad/10', title: 'text-[#ff8a8d]' },
};

// Fila de la línea de tiempo: columna fija con datos del espacio + eje horario con las reservas
export default function SpaceRow({ space, canCancel, canBlock, onCancel, onSchedule, onRelease, releasing }) {
  const type = spaceType(space.type);
  const TypeIcon = type.Icon;
  const unavailable = space.status !== 'disponible';
  const block = space.block || null;
  const isBlocked = block?.tipo === 'bloqueo' || space.status === 'bloqueado';
  const tone = NOTICE_TONE[isBlocked ? 'bad' : 'warn'];
  const kindLabel = isBlocked ? 'Bloqueado' : 'En mantenimiento';
  const NoticeIcon = isBlocked ? Ban : Wrench;
  const tint = withAlpha(type.color, 0.3); // la reserva es opaca: tinte del tipo sobre el fondo de la tarjeta
  const bookings = (space.bookings || []).filter((b) => b.status !== 'cancelada');
  const until = block?.hasta ? ` hasta ${formatDay(block.hasta)}` : '';
  const summary = block ? `${kindLabel}${until}${block.motivo ? ` · ${block.motivo}` : ''}` : 'No disponible para reservas';

  return (
    <div className="flex border-t border-line">
      <div className="sticky left-0 z-20 w-64 shrink-0 border-l-4 bg-card p-3" style={{ borderLeftColor: type.color }}>
        <p className="truncate text-sm font-semibold" title={space.name}>{space.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SpaceTypeChip type={space.type} />
          <span className="flex items-center gap-1 text-xs text-mute"><Users className="h-3 w-3" aria-hidden="true" /> {space.capacity}<span className="sr-only"> personas de capacidad</span></span>
        </div>
        <div className="mt-1.5">
          <StatusChip status={space.status} />
        </div>

        {unavailable && (
          <div className={`mt-2 rounded-md border px-2 py-1.5 text-xs ${tone.box}`}>
            {block ? (
              <>
                <p className="flex items-start gap-1.5 text-ink">
                  <NoticeIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.title}`} aria-hidden="true" />
                  <span className="break-words font-medium"><span className="sr-only">{kindLabel}: </span>{block.motivo || kindLabel}</span>
                </p>
                <p className="mt-0.5 pl-5 text-ink/80">
                  {block.hasta ? `Hasta ${formatDay(block.hasta)}` : 'Sin fecha de fin'}
                  {block.incident_code ? ` · Incidencia ${block.incident_code}` : ''}
                </p>
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-ink"><NoticeIcon className={`h-3.5 w-3.5 shrink-0 ${tone.title}`} aria-hidden="true" /> No disponible para reservas.</p>
            )}
          </div>
        )}

        {canBlock && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onSchedule(space)} aria-label={`Programar mantenimiento o bloqueo de ${space.name}`} title="Programar mantenimiento o bloqueo">
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" /> Programar
            </Button>
            {block && (
              <Button size="sm" loading={releasing} onClick={() => onRelease(space)} aria-label={`Liberar ${space.name}`}>
                <LockOpen className="h-3.5 w-3.5" aria-hidden="true" /> Liberar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="relative min-w-[700px] flex-1">
        {HOURS.map((h, i) => <div key={h} className="absolute inset-y-0 border-l border-line/60" style={{ left: `${(i / SLOTS) * 100}%` }} />)}
        {unavailable && (
          <div aria-hidden="true" title={summary}>
            <div className="stripes absolute inset-1 rounded-md" />
            <div className={`pointer-events-none absolute left-3 top-1/2 flex max-w-[calc(100%-1.5rem)] -translate-y-1/2 items-center gap-1.5 rounded-md border bg-panel px-2 py-1 text-xs text-ink ${tone.box}`}>
              <NoticeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{summary}</span>
            </div>
          </div>
        )}
        {bookings.map((b) => (
          <div
            key={b.id}
            className="absolute inset-y-2 z-10 flex items-center justify-between gap-1 overflow-hidden rounded-md border px-2 text-xs text-ink"
            style={{ ...bookingStyle(b), borderColor: type.color, backgroundColor: 'var(--color-card)', backgroundImage: `linear-gradient(${tint}, ${tint})` }}
            title={`${b.title} · ${b.start_time}–${b.end_time} · ${b.organizer_name} · ${type.label}`}
          >
            <span className="flex min-w-0 items-center gap-1">
              <TypeIcon className="h-3 w-3 shrink-0" style={{ color: type.color }} aria-hidden="true" />
              <span className="truncate">{b.title}</span>
            </span>
            {canCancel(b) && (
              <button type="button" onClick={() => onCancel(b)} aria-label={`Cancelar reserva ${b.title}`} className="shrink-0 rounded p-0.5 text-mute hover:bg-white/10 hover:text-bad">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
