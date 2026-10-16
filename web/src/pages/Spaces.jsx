import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { todayStr } from '../util.js';
import { Input, PageHeader, Select } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AiPanel from '../components/AiPanel.jsx';
import { useToast } from '../components/Toast.jsx';
import SpaceRow from '../features/SpaceRow.jsx';
import SpaceBlockModal from '../features/SpaceBlockModal.jsx';
import SpacesLegend from '../features/SpacesLegend.jsx';
import SpaceAgendaCard from '../features/SpaceAgendaCard.jsx';
import DateStrip from '../features/DateStrip.jsx';
import { SPACE_TYPES, SPACE_TYPE_KEYS } from '../features/spaceTypes.js';
import { HOURS, SLOTS, START, END } from '../features/timeline.js';

const TYPES = [['', 'Todos'], ...SPACE_TYPE_KEYS.map((k) => [k, SPACE_TYPES[k].plural])];
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// ---- Formulario de reserva + sugerencia de IA ----
function BookingForm({ spaces, date, initialSpaceId, onDone, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    spaceId: initialSpaceId || spaces[0]?.id || '', title: '', date, startTime: '09:00', endTime: '10:00', attendees: 10,
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
        {spaces.map((s) => <option key={s.id} value={s.id}>{s.name} (cap. {s.capacity}){s.status !== 'disponible' ? ' — no disponible ese día' : ''}</option>)}
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

export default function Spaces() {
  const { can, user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formSpaceId, setFormSpaceId] = useState(null); // espacio preseleccionado al reservar desde una tarjeta
  const [toCancel, setToCancel] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [blockTarget, setBlockTarget] = useState(null); // espacio al que se le programa un bloqueo
  const [releasingId, setReleasingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const { data, loading, error, reload } = useLoad(`/spaces?date=${date}`);

  const spaces = useMemo(() => (data || []).filter((s) => !type || s.type === type), [data, type]);
  const canBlock = can('cambiar_estado_recurso');
  const canCancel = (b) => b.organizer_id === user?.id || ['admin', 'coordinador'].includes(user?.role);
  const openForm = (spaceId = null) => { setFormSpaceId(spaceId); setFormOpen(true); };
  const schedule = (sp) => { setActionError(null); setBlockTarget(sp); };

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

  // Libera un bloqueo/mantenimiento. Si pertenece a una incidencia abierta el backend responde 409 (R6).
  async function release(space) {
    setActionError(null);
    setReleasingId(space.id);
    try {
      await apiFetch(`/spaces/${space.id}/blocks/${space.block.id}`, { method: 'DELETE' });
      toast(`${space.name} quedó liberado`);
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setReleasingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Espacios" subtitle={`Disponibilidad por hora, de ${hhmm(START)} a ${hhmm(END)}`}>
        {can('reservar') && (
          <Button variant="primary" onClick={() => openForm()} disabled={!data?.length}><Plus className="h-4 w-4" aria-hidden="true" /> Nueva reserva</Button>
        )}
      </PageHeader>

      <DateStrip value={date} onChange={setDate} />

      {/* Filtro por tipo: chips en el celular, select en escritorio */}
      <div className="mb-4 -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:hidden" role="group" aria-label="Filtrar por tipo">
        {TYPES.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setType(v)} aria-pressed={type === v}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${type === v ? 'border-accent bg-accent text-white' : 'border-line bg-card text-mute hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="mb-4 hidden items-end gap-3 md:flex">
        <div className="w-48">
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      <div className="hidden md:block"><SpacesLegend /></div>

      {actionError && <ApiAlert error={actionError} className="mb-4" />}
      {error && <Alert className="mb-4" title="No se pudieron cargar los espacios">{error.message}</Alert>}

      {/* Celular: vista agenda (sin desplazamiento horizontal) */}
      <div className="space-y-3 md:hidden" aria-busy={loading}>
        {loading && !data && <Spinner label="Cargando espacios…" />}
        {spaces.map((s) => (
          <SpaceAgendaCard
            key={s.id}
            space={s}
            canCancel={canCancel}
            canBlock={canBlock}
            canBook={can('reservar')}
            onCancel={setToCancel}
            onSchedule={schedule}
            onRelease={release}
            onBook={(sp) => openForm(sp.id)}
            releasing={releasingId === s.id}
          />
        ))}
        {data && !spaces.length && <EmptyState title="No hay espacios para este filtro" />}
      </div>

      {/* Escritorio: línea de tiempo por horas */}
      <Card className="hidden p-0 md:block">
        {loading && !data ? <Spinner label="Cargando espacios…" /> : (
          <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
            <div className="min-w-[956px]">
              <div className="flex">
                <div className="sticky left-0 z-20 w-64 shrink-0 bg-card p-3 text-xs font-medium text-mute">Espacio</div>
                <div className="relative h-9 min-w-[700px] flex-1">
                  {HOURS.slice(0, -1).map((h, i) => (
                    <span key={h} className="absolute top-2 text-[11px] text-mute" style={{ left: `calc(${(i / SLOTS) * 100}% + 4px)` }}>{String(h).padStart(2, '0')}:00</span>
                  ))}
                </div>
              </div>
              {spaces.map((s) => (
                <SpaceRow
                  key={s.id}
                  space={s}
                  canCancel={canCancel}
                  canBlock={canBlock}
                  onCancel={setToCancel}
                  onSchedule={schedule}
                  onRelease={release}
                  releasing={releasingId === s.id}
                />
              ))}
            </div>
            {data && !spaces.length && <EmptyState title="No hay espacios para este filtro" />}
          </div>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva reserva" variant="drawer">
        <BookingForm key={`${formSpaceId}-${date}`} spaces={data || []} date={date} initialSpaceId={formSpaceId} onClose={() => setFormOpen(false)} onDone={() => { setFormOpen(false); reload(); }} />
      </Modal>

      <SpaceBlockModal
        space={blockTarget}
        date={date}
        onClose={() => setBlockTarget(null)}
        onDone={() => { setBlockTarget(null); reload(); }}
      />

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
