import { Clock, MessageSquareText, Send, UserRound } from 'lucide-react';
import Button from '../components/Button.jsx';
import { PriorityChip, StatusChip } from '../components/Badge.jsx';
import { formatDateTime } from '../util.js';
import categoryIcon from './categoryIcon.js';
import { EquipmentChips, isUnreviewed } from './EquipmentStatus.jsx';
import { ageHours, ageLabel } from './format.js';

// Un reporte sin revisar con más de 48 h se resalta como atrasado
export const STALE_HOURS = 48;

// Orden: reportes sin revisar primero (el más antiguo arriba), luego el resto de equipos fuera de servicio
export function sortReviewItems(items) {
  const rank = (e) => (isUnreviewed(e) ? 0 : e.report ? 1 : 2);
  const created = (e) => (e.report?.created_at ? new Date(e.report.created_at).getTime() : Number.MAX_SAFE_INTEGER);
  return [...items].sort((a, b) => rank(a) - rank(b) || created(a) - created(b) || a.name.localeCompare(b.name, 'es'));
}

export const needsReview = (e) => e.status === 'en_revision' || e.status === 'danado' || !!e.report;

function Info({ icon: Icon, label, children }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-mute"><Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

export default function EquipmentReviewList({ items, canConsult, consultingId, onConsult }) {
  const unreviewed = items.filter(isUnreviewed);
  const oldestId = unreviewed.length > 1 ? unreviewed[0].id : null; // ya viene ordenado: el más antiguo primero

  return (
    <ul className="space-y-3">
      {items.map((e) => {
        const r = e.report;
        const Icon = categoryIcon(e.category);
        const pending = isUnreviewed(e);
        const stale = pending && ageHours(r.created_at) >= STALE_HOURS;
        const highlight = stale || e.id === oldestId;
        return (
          <li key={e.id} className={`rounded-xl border bg-card p-4 ${highlight ? 'border-bad/60 border-l-4' : 'border-line'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel text-mute"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-medium">{e.name} <span className="font-mono text-xs font-normal text-mute">{e.code}</span></p>
                  <p className="text-xs text-mute">{e.category}{e.location ? ` · ${e.location}` : ''}</p>
                </div>
              </div>
              <EquipmentChips equipment={e} />
            </div>

            {pending && highlight && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#ff8a8d]">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {stale ? `Reporte sin revisar ${ageLabel(r.created_at).replace('hace ', 'desde hace ')}` : 'Es el reporte sin revisar más antiguo'}
                {stale && e.id === oldestId ? ' · el más antiguo' : ''}
              </p>
            )}

            {r ? (
              <dl className="mt-3 grid grid-cols-1 gap-4 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info icon={MessageSquareText} label="Motivo del reporte">
                  <span className="font-medium">{r.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs text-mute">{r.incident_code}</span>
                    <PriorityChip priority={r.priority} />
                    <StatusChip status={r.status} />
                  </span>
                </Info>
                <Info icon={UserRound} label="Reportado por">
                  {r.reported_by_name || '—'}
                  <span className="block text-xs text-mute">{formatDateTime(r.created_at)} · {ageLabel(r.created_at)}</span>
                </Info>
                <Info icon={UserRound} label="Técnico asignado">
                  {r.assigned_name
                    ? <>{r.assigned_name}{r.assigned_email && <span className="block text-xs text-mute">{r.assigned_email}</span>}</>
                    : <span className="text-mute">Sin asignar</span>}
                </Info>
                <Info icon={MessageSquareText} label="Última nota">
                  {r.last_note
                    ? <>{r.last_note}<span className="block text-xs text-mute">{ageLabel(r.last_note_at)} · {formatDateTime(r.last_note_at)}</span></>
                    : <span className="text-mute">Sin notas del técnico todavía</span>}
                </Info>
              </dl>
            ) : (
              <p className="mt-3 border-t border-line pt-3 text-sm text-mute">Este equipo está fuera de servicio, pero no tiene una incidencia asociada.</p>
            )}

            {canConsult && r && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" loading={consultingId === e.id} onClick={() => onConsult(e)} aria-label={`Consultar al técnico por ${e.name} (${r.incident_code})`}>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" /> Consultar al técnico
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
