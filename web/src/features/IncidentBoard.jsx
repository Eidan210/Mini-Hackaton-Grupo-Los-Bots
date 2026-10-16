import { useMemo, useState } from 'react';
import { FilterX, Sparkles } from 'lucide-react';
import { formatDateTime } from '../util.js';
import { Select } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { PriorityChip, StatusChip } from '../components/Badge.jsx';
import { ageLabel } from './format.js';

const STATES = [['', 'Todos los estados'], ['abierta', 'Abierta'], ['en_progreso', 'En progreso'], ['resuelta', 'Resuelta']];
const updatedAt = (i) => i.updated_at || i.created_at;

// Tablero de seguimiento: código, estado, prioridad, ubicación/equipo, técnico, última actualización y última nota
export default function IncidentBoard({ incidents, onOpen }) {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const all = useMemo(() => incidents.data || [], [incidents.data]);
  // Prioridades presentes en los datos (sin lista fija en el cliente)
  const priorities = useMemo(() => [...new Set(all.map((i) => i.priority).filter(Boolean))], [all]);

  const list = useMemo(() => all
    .filter((i) => (!status || i.status === status) && (!priority || i.priority === priority))
    .sort((a, b) => (a.status === 'resuelta') - (b.status === 'resuelta') || new Date(updatedAt(b)) - new Date(updatedAt(a))),
  [all, status, priority]);

  const filtered = !!(status || priority);

  return (
    <Card title="Tablero de incidencias">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div className="w-52">
          <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Todas las prioridades</option>
            {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        {filtered && (
          <Button variant="ghost" onClick={() => { setStatus(''); setPriority(''); }}><FilterX className="h-4 w-4" aria-hidden="true" /> Quitar filtros</Button>
        )}
        {incidents.data && <p className="ml-auto text-xs text-mute" role="status">Mostrando {list.length} de {all.length}</p>}
      </div>

      {incidents.error && <Alert title="No se pudieron cargar las incidencias">{incidents.error.message}</Alert>}
      {incidents.loading && !incidents.data && <Spinner label="Cargando incidencias…" />}
      {incidents.data && !list.length && <EmptyState title={filtered ? 'Ninguna incidencia coincide con los filtros' : 'Todavía no hay incidencias'} />}

      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <caption className="sr-only">Incidencias con estado, prioridad, técnico asignado y última nota</caption>
            <thead className="text-xs text-mute">
              <tr>
                {['Código', 'Incidencia', 'Estado', 'Prioridad', 'Ubicación / equipo', 'Técnico', 'Actualizada', 'Última nota'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>
                ))}
                <th scope="col" className="px-3 py-2"><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const where = [i.space_name, i.equipment_name].filter(Boolean).join(' · ');
                return (
                  <tr key={i.id} className="border-t border-line align-top">
                    <td className="px-3 py-3 font-mono text-xs">{i.code}</td>
                    <td className="max-w-[16rem] px-3 py-3">
                      <span className="flex items-start gap-1.5 font-medium">
                        {i.title}
                        {i.ai_model && <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b4abff]" aria-label="Clasificada con IA" />}
                      </span>
                      <span className="block text-xs text-mute">{i.category} · {i.area}</span>
                    </td>
                    <td className="px-3 py-3"><StatusChip status={i.status} /></td>
                    <td className="px-3 py-3"><PriorityChip priority={i.priority} /></td>
                    <td className="px-3 py-3 text-mute">{where || '—'}</td>
                    <td className="px-3 py-3">{i.assigned_name || <span className="text-mute">Sin asignar</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span title={formatDateTime(updatedAt(i))}>{ageLabel(updatedAt(i))}</span>
                    </td>
                    <td className="max-w-[18rem] px-3 py-3">
                      {i.last_note ? (
                        <>
                          <span className="line-clamp-2 break-words">{i.last_note}</span>
                          <span className="block text-xs text-mute">{ageLabel(i.last_note_at)}{i.notes_count > 1 ? ` · ${i.notes_count} notas` : ''}</span>
                        </>
                      ) : <span className="text-mute">Sin notas</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" onClick={() => onOpen(i)} aria-label={`Abrir ${i.code}: ${i.title}`}>Abrir</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
