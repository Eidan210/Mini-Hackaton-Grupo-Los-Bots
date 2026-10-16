import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { formatDateTime } from '../util.js';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { PriorityChip, StatusChip } from '../components/Badge.jsx';
import { ageLabel } from './format.js';

const FILTERS = [['', 'Todas'], ['abierta', 'Abiertas'], ['en_progreso', 'En progreso'], ['resuelta', 'Resueltas']];

// Historial de solo lectura para quien reporta pero no gestiona (camper, trainer)
export default function IncidentHistory({ incidents }) {
  const [filter, setFilter] = useState('');
  const list = (incidents.data || []).filter((i) => !filter || i.status === filter);

  return (
    <Card title="Historial de incidencias">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {FILTERS.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === v ? 'bg-accent text-white' : 'bg-btn text-ink hover:bg-[#5a5c65]'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {incidents.error && <Alert title="No se pudieron cargar las incidencias">{incidents.error.message}</Alert>}
      {incidents.loading && !incidents.data && <Spinner label="Cargando incidencias…" />}
      {incidents.data && !list.length && <EmptyState title="Sin incidencias en este filtro" />}
      <ul className="divide-y divide-line">
        {list.map((i) => (
          <li key={i.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-mute">{i.code}</span>
              <span className="font-medium">{i.title}</span>
              <PriorityChip priority={i.priority} />
              <StatusChip status={i.status} />
              {i.ai_model && <span className="inline-flex items-center gap-1 text-xs text-[#b4abff]"><Sparkles className="h-3 w-3" aria-hidden="true" /> IA</span>}
            </div>
            <p className="mt-1 text-xs text-mute">
              {i.category} · {i.area}{i.space_name ? ` · ${i.space_name}` : ''}{i.equipment_name ? ` · ${i.equipment_name}` : ''} · {i.reported_by_name} · {formatDateTime(i.created_at)}
            </p>
            {(i.assigned_name || i.last_note) && (
              <p className="mt-1 text-xs text-mute">
                {i.assigned_name && <>Técnico: <span className="text-ink">{i.assigned_name}</span></>}
                {i.assigned_name && i.last_note && ' · '}
                {i.last_note && <>Última nota ({ageLabel(i.last_note_at)}): <span className="text-ink">{i.last_note}</span></>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
