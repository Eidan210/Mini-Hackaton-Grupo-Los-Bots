import { useState } from 'react';
import { NotebookPen, Sparkles } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useLoad } from '../hooks.js';
import { formatDateTime } from '../util.js';
import { Select } from '../components/Field.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import { Badge, PriorityChip, StatusChip } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';
import FixedTextarea from './FixedTextarea.jsx';
import IncidentEffects from './IncidentEffects.jsx';
import { ageLabel, formatDay, roleLabel } from './format.js';

const FLOW = ['abierta', 'en_progreso', 'resuelta'];
const STATUS_LABEL = { abierta: 'Abierta', en_progreso: 'En progreso', resuelta: 'Resuelta' };
const MAX_NOTE = 500;

// Solo se permiten transiciones hacia adelante: abierta -> en progreso -> resuelta
const statusOptions = (current) => {
  const i = FLOW.indexOf(current);
  return i < 0 ? FLOW : FLOW.slice(i);
};

// Cambiar estado y asignar técnico (permiso `gestionar_incidencias`)
function ManagePanel({ incident, onChanged }) {
  const toast = useToast();
  const techs = useLoad('/users?role=tecnico');
  const [draft, setDraft] = useState({}); // solo lo que el usuario tocó
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [effects, setEffects] = useState(null);

  const currentAssigned = incident.assigned_to == null ? '' : String(incident.assigned_to);
  const status = draft.status ?? incident.status;
  const assigned = draft.assigned ?? currentAssigned;
  const dirty = status !== incident.status || assigned !== currentAssigned;
  const technicians = techs.data || [];
  const assigneeKnown = !currentAssigned || technicians.some((t) => String(t.id) === currentAssigned);

  async function save(e) {
    e.preventDefault();
    const body = {};
    if (status !== incident.status) body.status = status;
    if (assigned !== currentAssigned && assigned !== '') body.assignedTo = technicians.find((t) => String(t.id) === assigned)?.id ?? assigned;
    if (!Object.keys(body).length) return;
    setBusy(true);
    setError(null);
    setEffects(null);
    try {
      const res = await apiFetch(`/incidents/${incident.id}`, { method: 'PATCH', body });
      toast(`${incident.code} actualizada`);
      setEffects(res?.effects);
      setDraft({});
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border border-line bg-panel p-3">
      <h3 className="text-sm font-semibold">Gestionar incidencia</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Estado" value={status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} disabled={incident.status === 'resuelta'}>
          {statusOptions(incident.status).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
        <Select
          label="Técnico asignado"
          value={assigned}
          onChange={(e) => setDraft((d) => ({ ...d, assigned: e.target.value }))}
          hint={techs.loading && !techs.data ? 'Cargando técnicos…' : undefined}
        >
          {!currentAssigned && <option value="">Sin asignar</option>}
          {!assigneeKnown && <option value={currentAssigned}>{incident.assigned_name || 'Técnico actual'}</option>}
          {technicians.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </Select>
      </div>
      {techs.error && <Alert tone="warning">No se pudo cargar la lista de técnicos: {techs.error.message}</Alert>}
      <ApiAlert error={error} />
      <IncidentEffects effects={effects} className="" />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>Guardar cambios</Button>
      </div>
    </form>
  );
}

// Bitácora de avances + formulario para añadir una nota
function Journal({ incident, canNote, onChanged }) {
  const toast = useToast();
  const notes = useLoad(`/incidents/${incident.id}/notes`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = [...(notes.data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/incidents/${incident.id}/notes`, { method: 'POST', body: { text: value } });
      toast('Avance registrado en la bitácora');
      setText('');
      notes.reload();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`bitacora-${incident.id}`}>
      <h3 id={`bitacora-${incident.id}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <NotebookPen className="h-4 w-4 text-mute" aria-hidden="true" /> Bitácora de avances
        {notes.data && <Badge>{notes.data.length}</Badge>}
      </h3>

      {canNote && (
        <form onSubmit={submit} className="mb-4 space-y-2">
          <FixedTextarea
            label="Nuevo avance"
            rows={3}
            maxLength={MAX_NOTE}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej. Se reemplazó la lámpara del proyector; pendiente probar."
            hint={`${text.length}/${MAX_NOTE}`}
          />
          <ApiAlert error={error} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!text.trim()}>Añadir a la bitácora</Button>
          </div>
        </form>
      )}

      {notes.error && <Alert title="No se pudo cargar la bitácora">{notes.error.message}</Alert>}
      {notes.loading && !notes.data && <Spinner label="Cargando bitácora…" className="py-4" />}
      {notes.data && !list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-mute">Todavía no hay avances registrados.</p>}
      {list.length > 0 && (
        <ol className="space-y-3">
          {list.map((n) => (
            <li key={n.id} className="rounded-lg border border-line bg-panel p-3">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-mute">
                <span className="font-medium text-ink">{n.author_name}</span>
                {n.author_role && <span>{roleLabel(n.author_role)}</span>}
                <span aria-hidden="true">·</span>
                <time dateTime={n.created_at} title={formatDateTime(n.created_at)}>{ageLabel(n.created_at)} ({formatDateTime(n.created_at)})</time>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{n.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Meta({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-mute">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

// Contenido del panel lateral de una incidencia: detalle, gestión y bitácora
export default function IncidentDetail({ incident, canManage, canNote, onChanged }) {
  const i = incident;
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-mute">{i.code}</span>
          <StatusChip status={i.status} />
          <PriorityChip priority={i.priority} />
          {i.ai_model && <span className="inline-flex items-center gap-1 text-xs text-[#b4abff]"><Sparkles className="h-3 w-3" aria-hidden="true" /> Clasificada con IA</span>}
        </div>
        <h3 className="text-base font-semibold">{i.title}</h3>
        {i.description && <p className="whitespace-pre-wrap break-words text-sm text-ink/90">{i.description}</p>}
        {i.justification && <p className="text-sm text-mute"><span className="font-medium text-ink">Justificación: </span>{i.justification}</p>}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Meta label="Categoría">{i.category}</Meta>
          <Meta label="Área responsable">{i.area}</Meta>
          <Meta label="Espacio">{i.space_name}</Meta>
          <Meta label="Equipo">{i.equipment_name}</Meta>
          <Meta label="Reportada por">{i.reported_by_name}</Meta>
          <Meta label="Creada">{formatDateTime(i.created_at)}</Meta>
          <Meta label="Última actualización">{i.updated_at ? `${ageLabel(i.updated_at)} (${formatDateTime(i.updated_at)})` : null}</Meta>
          <Meta label="Técnico asignado">{i.assigned_name || 'Sin asignar'}</Meta>
          <Meta label="Espacio bloqueado hasta">{i.block_hasta ? formatDay(i.block_hasta) : null}</Meta>
          <Meta label="Resuelta">{i.resolved_at ? formatDateTime(i.resolved_at) : null}</Meta>
        </dl>
      </div>

      {canManage && <ManagePanel incident={i} onChanged={onChanged} />}
      <Journal incident={i} canNote={canNote} onChanged={onChanged} />
    </div>
  );
}
