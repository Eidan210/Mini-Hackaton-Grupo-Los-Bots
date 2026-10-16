import { Ban, ChevronRight, LockOpen, Plus, Users, Wrench } from 'lucide-react';
import Button from '../components/Button.jsx';
import { StatusChip } from '../components/Badge.jsx';
import SpaceTypeChip from './SpaceTypeChip.jsx';
import { spaceType, withAlpha } from './spaceTypes.js';
import { formatDay } from './format.js';
import { bookingStyle } from './timeline.js';

// Vista agenda para el celular: una tarjeta por espacio con una barra de ocupación del día (07–21)
// que cabe en el ancho de la pantalla y la lista de reservas debajo. Mismos datos que la línea de tiempo.
export default function SpaceAgendaCard({ space, canBlock, canBook, onOpen, onSchedule, onRelease, onBook, releasing }) {
  const type = spaceType(space.type);
  const block = space.block || null;
  const unavailable = space.status !== 'disponible';
  const isBlocked = block?.tipo === 'bloqueo' || space.status === 'bloqueado';
  const NoticeIcon = isBlocked ? Ban : Wrench;
  const bookings = (space.bookings || []).filter((b) => b.status !== 'cancelada');
  const tint = withAlpha(type.color, 0.55);

  return (
    <article className="rounded-xl border border-line border-l-4 bg-card p-3 shadow-[var(--shadow-card)]" style={{ borderLeftColor: type.color }}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{space.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <SpaceTypeChip type={space.type} />
            <span className="flex items-center gap-1 text-xs text-mute"><Users className="h-3 w-3" aria-hidden="true" /> {space.capacity}<span className="sr-only"> personas</span></span>
          </div>
        </div>
        <StatusChip status={space.status} />
      </header>

      {unavailable && (
        <p className={`mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs ${isBlocked ? 'border-bad/50 bg-bad/10' : 'border-warn/50 bg-warn/10'}`}>
          <NoticeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {block?.motivo || (isBlocked ? 'Bloqueado' : 'En mantenimiento')}
            {block?.hasta ? ` · hasta ${formatDay(block.hasta)}` : ''}
            {block?.incident_code ? ` · ${block.incident_code}` : ''}
          </span>
        </p>
      )}

      {/* Barra de ocupación del día */}
      <div className="mt-3" aria-hidden="true">
        <div className={`relative h-3 overflow-hidden rounded-full bg-panel ${unavailable ? 'stripes' : ''}`}>
          {bookings.map((b) => (
            <span key={b.id} className="absolute inset-y-0 rounded-full" style={{ ...bookingStyle(b), backgroundColor: tint }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-mute"><span>07:00</span><span>14:00</span><span>21:00</span></div>
      </div>

      {bookings.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {bookings.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onOpen(b, space)}
                aria-label={`Ver detalle de la reserva ${b.title}, ${b.start_time} a ${b.end_time}`}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5 active:bg-white/10"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-mute">{b.start_time}–{b.end_time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{b.title}</span>
                  <span className="block truncate text-xs text-mute">{b.organizer_name}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-mute" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-mute">{unavailable ? 'No admite reservas este día.' : 'Libre todo el día.'}</p>
      )}

      {(canBook || canBlock) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canBook && !unavailable && (
            <Button size="sm" variant="primary" onClick={() => onBook(space)}><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Reservar aquí</Button>
          )}
          {canBlock && (
            <Button size="sm" onClick={() => onSchedule(space)} aria-label={`Programar mantenimiento o bloqueo de ${space.name}`}>
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" /> Programar
            </Button>
          )}
          {canBlock && block && (
            <Button size="sm" loading={releasing} onClick={() => onRelease(space)} aria-label={`Liberar ${space.name}`}>
              <LockOpen className="h-3.5 w-3.5" aria-hidden="true" /> Liberar
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
