import { CalendarDays, Clock, MapPin, Trash2, User, Users } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import { StatusChip } from '../components/Badge.jsx';
import SpaceTypeChip from './SpaceTypeChip.jsx';
import { spaceType } from './spaceTypes.js';
import { hhmmToMin, formatDateTime } from '../util.js';
import { parseDay } from './format.js';

const duration = (b) => {
  const min = hhmmToMin(b.end_time) - hhmmToMin(b.start_time);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
};

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-mute" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

// Detalle de una reserva al tocarla en el calendario (línea de tiempo o vista agenda).
export default function BookingDetailModal({ detail, canCancel, onCancel, onClose }) {
  const b = detail?.booking;
  const space = detail?.space;
  const type = spaceType(space?.type);
  const day = parseDay(b?.date);
  const occupancy = space?.capacity ? Math.round((b.attendees / space.capacity) * 100) : null;

  return (
    <Modal open={!!b} onClose={onClose} title="Detalle de la reserva">
      {b && (
        <>
          <div className="rounded-lg border-l-4 bg-panel p-3" style={{ borderLeftColor: type.color }}>
            <p className="text-base font-semibold">{b.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SpaceTypeChip type={space?.type} />
              <StatusChip status={b.status} />
            </div>
          </div>
          <dl className="mt-2 divide-y divide-line">
            <Row icon={MapPin} label="Espacio">
              {b.space_name || space?.name}
              {space?.location ? <span className="block text-xs text-mute">{space.location}</span> : null}
            </Row>
            <Row icon={CalendarDays} label="Fecha">
              {day ? day.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : b.date}
            </Row>
            <Row icon={Clock} label="Horario">
              {b.start_time} – {b.end_time} <span className="text-mute">· {duration(b)}</span>
            </Row>
            <Row icon={Users} label="Asistentes">
              {b.attendees} personas
              {occupancy !== null && <span className="text-mute"> · {occupancy}% de la capacidad ({space.capacity})</span>}
            </Row>
            <Row icon={User} label="Organizador">
              {b.organizer_name}
              {b.created_at && <span className="block text-xs text-mute">Reservado el {formatDateTime(b.created_at)}</span>}
            </Row>
          </dl>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {canCancel(b) && b.status !== 'cancelada' && (
              <Button variant="danger" onClick={() => onCancel(b)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Cancelar reserva
              </Button>
            )}
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
