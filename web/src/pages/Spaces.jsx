import { useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { hhmmToMin, todayStr } from '../util.js';
import { Input, PageHeader, Select } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AiPanel from '../components/AiPanel.jsx';
import { Badge, StatusChip } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';

const START = 7 * 60;
const END = 21 * 60;
const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i);
const TYPES = [['', 'Todos'], ['aula', 'Aulas'], ['cubiculo', 'Cubículos'], ['laboratorio', 'Laboratorios'], ['auditorio', 'Auditorio']];
const pct = (min) => `${Math.min(100, Math.max(0, ((min - START) / (END - START)) * 100))}%`;

// ---- Formulario de reserva + sugerencia de IA ----
function BookingForm({ spaces, date, onDone, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    spaceId: spaces[0]?.id ?? '', title: '', date, startTime: '09:00', endTime: '10:00', attendees: 10,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ai, setAi] = useState({ state: 'idle' }); // idle | loading | done | error
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const payload = () => ({ ...form, spaceId: form.spaceId, attendees: Number(form.attendees) });

  async function askAi() {
    setAi({ state: 'loading' });
    const { title, ...rest } = payload(); // eslint-disable-line no-unused-vars
    try {
      const res = await apiFetch('/ai/recommend-space', { method: 'POST', body: rest });
      setAi({ state: 'done', res });
    } catch (e) {
      setAi({ state: 'error', error: e });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setAi({ state: 'idle' });
    try {
      await apiFetch('/bookings', { method: 'POST', body: payload() });
      toast('Reserva creada correctamente');
      onDone();
    } catch (err) {
      setError(err);
      if (err.status === 409) askAi();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Select label="Espacio" value={form.spaceId} onChange={set('spaceId')} required>
        {spaces.map((s) => <option key={s.id} value={s.id}>{s.name} (cap. {s.capacity})</option>)}
      </Select>
      <Input label="Título" value={form.title} onChange={set('title')} required maxLength={120} placeholder="Ej. Clase de React" />
      <Input label="Fecha" type="date" value={form.date} onChange={set('date')} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Hora inicio" type="time" value={form.startTime} onChange={set('startTime')} required />
        <Input label="Hora fin" type="time" value={form.endTime} onChange={set('endTime')} required />
      </div>
      <Input label="Asistentes" type="number" min="1" value={form.attendees} onChange={set('attendees')} required />

      <ApiAlert error={error} />

      {ai.state !== 'idle' && (
        <AiPanel title="Sugerencia de la IA" badge="Propuesta IA">
          {ai.state === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-mute"><span className="skeleton inline-block h-3 w-3 rounded-full" /> La IA está buscando una alternativa…</p>
          )}
          {ai.state === 'error' && <Alert tone="warning">La IA no pudo responder: {ai.error.message}</Alert>}
          {ai.state === 'done' && !ai.res.suggestion && (
            <p className="text-sm text-mute">La IA no encontró un espacio alternativo que cumpla las reglas para ese horario ({ai.res.candidates} candidatos evaluados).</p>
          )}
          {ai.state === 'done' && ai.res.suggestion && (
            <div>
              <p className="font-semibold">{ai.res.suggestion.name}</p>
              <p className="mt-1 text-sm text-mute">{ai.res.suggestion.reason}</p>
              <p className="mt-2 text-xs text-mute">Modelo: {ai.res.model}</p>
              <Button size="sm" variant="primary" className="mt-3" onClick={() => { setForm((f) => ({ ...f, spaceId: ai.res.suggestion.spaceId })); setError(null); setAi({ state: 'idle' }); }}>
                Usar este espacio
              </Button>
            </div>
          )}
        </AiPanel>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={busy}>Reservar</Button>
      </div>
    </form>
  );
}

// ---- Fila de la línea de tiempo ----
function TimelineRow({ space, canCancel, canStatus, onCancel, onStatus }) {
  const blocked = space.status !== 'disponible';
  const bookings = (space.bookings || []).filter((b) => b.status !== 'cancelada');
  return (
    <div className="flex border-t border-line">
      <div className="w-56 shrink-0 p-3">
        <p className="truncate text-sm font-semibold">{space.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-mute"><Users className="h-3 w-3" aria-hidden="true" /> {space.capacity}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusChip status={space.status} />
          {canStatus && (
            <select
              aria-label={`Cambiar estado de ${space.name}`}
              value={space.status}
              onChange={(e) => onStatus(space, e.target.value)}
              className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-xs text-mute"
            >
              <option value="disponible">Disponible</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          )}
        </div>
      </div>
      <div className="relative min-w-[700px] flex-1">
        {HOURS.map((h, i) => <div key={h} className="absolute inset-y-0 border-l border-line/60" style={{ left: `${(i / 14) * 100}%` }} />)}
        {blocked && <div className="stripes absolute inset-1 rounded-md" title="No disponible para reservas" />}
        {bookings.map((b) => (
          <div
            key={b.id}
            className="absolute inset-y-2 flex items-center justify-between gap-1 overflow-hidden rounded-md border border-accent/50 bg-accent/25 px-2 text-xs"
            style={{ left: pct(hhmmToMin(b.start_time)), width: `calc(${pct(hhmmToMin(b.end_time))} - ${pct(hhmmToMin(b.start_time))})` }}
            title={`${b.title} · ${b.start_time}–${b.end_time} · ${b.organizer_name}`}
          >
            <span className="truncate">{b.title}</span>
            {canCancel(b) && (
              <button onClick={() => onCancel(b)} aria-label={`Cancelar reserva ${b.title}`} className="shrink-0 rounded p-0.5 text-mute hover:bg-white/10 hover:text-bad">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Spaces() {
  const { can, user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [toCancel, setToCancel] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const { data, loading, error, reload } = useLoad(`/spaces?date=${date}`);

  const spaces = useMemo(() => (data || []).filter((s) => !type || s.type === type), [data, type]);

  async function confirmCancel() {
    setCancelBusy(true);
    try {
      await apiFetch(`/bookings/${toCancel.id}`, { method: 'DELETE' });
      toast('Reserva cancelada');
      setToCancel(null);
      reload();
    } catch (e) {
      setToCancel(null);
      setActionError(e);
    } finally {
      setCancelBusy(false);
    }
  }

  async function changeStatus(space, status) {
    setActionError(null);
    try {
      await apiFetch(`/spaces/${space.id}/status`, { method: 'PATCH', body: { status } });
      toast(`${space.name} ahora está en estado "${status}"`);
      reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <>
      <PageHeader title="Espacios" subtitle="Disponibilidad por hora, de 07:00 a 21:00">
        {can('reservar') && (
          <Button variant="primary" onClick={() => setFormOpen(true)} disabled={!data?.length}><Plus className="h-4 w-4" aria-hidden="true" /> Nueva reserva</Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44"><Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} /></div>
        <div className="w-48">
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-mute">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-accent/40" /> Reserva</span>
          <span className="flex items-center gap-1"><span className="stripes h-3 w-3 rounded border border-line" /> No disponible</span>
        </div>
      </div>

      {actionError && <ApiAlert error={actionError} className="mb-4" />}
      {error && <Alert className="mb-4" title="No se pudieron cargar los espacios">{error.message}</Alert>}

      <Card className="p-0">
        {loading && !data ? <Spinner label="Cargando espacios…" /> : (
          <div className="overflow-x-auto">
            <div className="min-w-[956px]">
              <div className="flex">
                <div className="w-56 shrink-0 p-3 text-xs font-medium text-mute">Espacio</div>
                <div className="relative h-9 min-w-[700px] flex-1">
                  {HOURS.slice(0, -1).map((h, i) => (
                    <span key={h} className="absolute top-2 text-[11px] text-mute" style={{ left: `calc(${(i / 14) * 100}% + 4px)` }}>{String(h).padStart(2, '0')}:00</span>
                  ))}
                </div>
              </div>
              {spaces.map((s) => (
                <TimelineRow
                  key={s.id}
                  space={s}
                  canCancel={(b) => b.organizer_id === user?.id || ['admin', 'coordinador'].includes(user?.role)}
                  canStatus={can('cambiar_estado_recurso')}
                  onCancel={setToCancel}
                  onStatus={changeStatus}
                />
              ))}
            </div>
            {data && !spaces.length && <EmptyState title="No hay espacios para este filtro" />}
          </div>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva reserva" variant="drawer">
        <BookingForm spaces={data || []} date={date} onClose={() => setFormOpen(false)} onDone={() => { setFormOpen(false); reload(); }} />
      </Modal>

      <Modal open={!!toCancel} onClose={() => setToCancel(null)} title="Cancelar reserva">
        <p className="text-sm text-mute">¿Cancelar la reserva "{toCancel?.title}" ({toCancel?.start_time}–{toCancel?.end_time})?</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setToCancel(null)}>Volver</Button>
          <Button variant="danger" loading={cancelBusy} onClick={confirmCancel}>Cancelar reserva</Button>
        </div>
      </Modal>
    </>
  );
}
