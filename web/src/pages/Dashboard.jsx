import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bell, Building2, CalendarCheck, CalendarClock, DoorOpen, FileUp, Laptop, RefreshCw, Repeat,
  ShieldBan, Sparkles, Wrench,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import { Badge, PriorityChip, StatusChip } from '../components/Badge.jsx';
import { formatDate, formatDateTime, spaceTypeLabel, timeAgo } from '../util.js';

const ACTIVITY_ICON = {
  reserva: CalendarCheck, prestamo: Laptop, devolucion: Repeat, incidencia: AlertTriangle, estado: Wrench, importacion: FileUp,
};

const STEPS = [
  { icon: AlertTriangle, text: 'Se reporta' },
  { icon: Sparkles, text: 'IA clasifica', ai: true },
  { icon: RefreshCw, text: 'Se actualiza el recurso' },
  { icon: ShieldBan, text: 'Se bloquean reservas/préstamos' },
  { icon: Bell, text: 'Se notifica al área' },
];

function Kpi({ icon: Icon, tone, value, label, sub, subTone }) {
  return (
    <Card>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${tone}26`, color: tone }}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-mute">{label}</p>
      {sub && <p className="mt-0.5 text-xs font-medium" style={{ color: subTone || tone }}>{sub}</p>}
    </Card>
  );
}

function ActivityList({ items, empty = 'Sin actividad todavía', label = 'Actividad reciente' }) {
  if (!items?.length) return <EmptyState title={empty} />;
  return (
    <ul tabIndex={0} aria-label={label} className="flex max-h-[24rem] flex-col gap-3 overflow-y-auto pr-1">
      {items.map((a) => {
        const Icon = ACTIVITY_ICON[a.type] || Bell;
        return (
          <li key={a.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel text-mute"><Icon className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-sm">{a.message}</p>
              <p className="text-xs text-mute">{timeAgo(a.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────── Vista global ───────── */

// Barras flex con altura proporcional que llenan toda la altura disponible de la tarjeta
function UsageChart({ usage, peakHour }) {
  if (!usage?.length) return <EmptyState title="Sin datos de uso hoy" />;
  const peak = peakHour ? String(peakHour).slice(0, 2) : null;
  return (
    <div className="relative min-h-[220px] flex-1 overflow-x-auto">
      <div
        className="absolute inset-y-0 left-0 flex w-full min-w-[480px] items-stretch gap-2"
        role="img"
        aria-label="Espacios ocupados frente al total por hora"
      >
        {usage.map((u) => {
          const pct = u.total ? Math.round((u.occupied / u.total) * 100) : 0;
          const isPeak = peak !== null && u.hour.slice(0, 2) === peak;
          return (
            <div key={u.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${u.hour}: ${u.occupied} de ${u.total} espacios ocupados`}>
              <span className="text-[10px] text-mute">{u.occupied}/{u.total}</span>
              <div className="flex w-full flex-1 items-end rounded-md bg-panel">
                <div
                  className={`w-full rounded-md ${isPeak ? 'bg-accent-soft' : 'bg-accent'}`}
                  style={{ height: `${pct}%`, minHeight: u.occupied ? 4 : 0 }}
                />
              </div>
              <span className={`text-[10px] ${isPeak ? 'font-bold text-ink' : 'text-mute'}`}>{u.hour.slice(0, 2)}h</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsRow({ stats }) {
  if (!stats) return null;
  const avgRaw = Number(stats.avgOccupancy);
  const avg = Number.isFinite(avgRaw) ? Math.round(avgRaw <= 1 ? avgRaw * 100 : avgRaw) : null;
  const top = (stats.topSpaces || []).slice(0, 3);
  return (
    <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-3">
      <div>
        <dt className="text-xs text-mute">Hora pico</dt>
        <dd className="mt-0.5 text-xl font-bold">{stats.peakHour || '—'}</dd>
      </div>
      <div>
        <dt className="text-xs text-mute">Ocupación promedio del día</dt>
        <dd className="mt-0.5 text-xl font-bold">{avg === null ? '—' : `${avg}%`}</dd>
      </div>
      <div>
        <dt className="text-xs text-mute">Espacios más reservados</dt>
        <dd className="mt-0.5">
          {top.length ? (
            <ol className="space-y-0.5 text-sm">
              {top.map((s, i) => (
                <li key={s.name} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate"><span className="mr-1 text-mute">{i + 1}.</span>{s.name}</span>
                  <span className="shrink-0 text-xs text-mute">{s.count} {s.count === 1 ? 'reserva' : 'reservas'}</span>
                </li>
              ))}
            </ol>
          ) : <span className="text-sm text-mute">Sin reservas hoy</span>}
        </dd>
      </div>
    </dl>
  );
}

function GlobalView({ data, can }) {
  const k = data.kpis;
  return (
    <div className="space-y-6">
      {k.importRejected > 0 && can('ver_datos_importados') && (
        <Alert tone="warning">
          {k.importRejected} {k.importRejected === 1 ? 'registro importado pendiente de revisión' : 'registros importados pendientes de revisión'}.{' '}
          <Link to="/datos" className="font-semibold underline">Revisar datos importados</Link>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi icon={Building2} tone="#23A55A" value={`${k.spacesAvailable}/${k.spacesTotal}`} label="Aulas disponibles" />
        <Kpi icon={Laptop} tone="#3B82F6" value={`${k.equipmentLent}/${k.equipmentTotal}`} label="Equipos prestados" />
        <Kpi icon={AlertTriangle} tone="#F0B232" value={k.incidentsOpen} label="Incidencias abiertas" sub={`${k.incidentsHigh} de alta prioridad`} />
        <Kpi icon={CalendarCheck} tone="#8E81FF" value={k.bookingsToday} label="Reservas hoy" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Uso de espacios por hora" className="flex flex-col lg:col-span-3">
          <UsageChart usage={data.usage} peakHour={data.stats?.peakHour} />
          <StatsRow stats={data.stats} />
        </Card>
        <Card title="Actividad reciente" className="lg:col-span-2">
          <ActivityList items={data.activity} />
        </Card>
      </div>

      <Card title="Cómo funciona">
        <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {STEPS.map((s, i) => (
            <li key={s.text} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.ai ? 'bg-accent text-white' : 'bg-panel text-mute'}`}>
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs text-mute"><span className="mr-1 font-semibold text-ink">{i + 1}.</span>{s.text}</span>
              {i < STEPS.length - 1 && <ArrowRight className="hidden" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ───────── Vista personal (camper) ───────── */

function ListCard({ title, to, linkLabel, children }) {
  return (
    <Card
      title={title}
      action={to && (
        <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-accent-soft hover:underline">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    >
      {children}
    </Card>
  );
}

function PersonalView({ data }) {
  const k = data.kpis || {};
  const overdue = k.myOverdueLoans || 0;
  const bookings = data.bookings || [];
  const loans = data.loans || [];
  const incidents = data.incidents || [];
  const available = data.availableNow || [];

  return (
    <div className="space-y-6">
      {overdue > 0 && (
        <Alert tone="warning" title={overdue === 1 ? 'Tienes 1 préstamo vencido' : `Tienes ${overdue} préstamos vencidos`}>
          Devuelve {overdue === 1 ? 'el equipo' : 'los equipos'} lo antes posible para que otras personas puedan usarlos.{' '}
          <Link to="/equipos" className="font-semibold underline">Ir a Equipos</Link>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Kpi icon={CalendarCheck} tone="#8E81FF" value={k.myBookingsToday ?? 0} label="Mis reservas hoy" />
        <Kpi icon={CalendarClock} tone="#3B82F6" value={k.myUpcomingBookings ?? 0} label="Reservas próximas" />
        <Kpi
          icon={Laptop}
          tone="#3B82F6"
          value={k.myActiveLoans ?? 0}
          label="Mis préstamos activos"
          sub={overdue > 0 ? `${overdue} ${overdue === 1 ? 'vencido' : 'vencidos'}` : null}
          subTone="#F0B232"
        />
        <Kpi icon={AlertTriangle} tone="#F0B232" value={k.myOpenIncidents ?? 0} label="Mis incidencias abiertas" />
        <Kpi icon={DoorOpen} tone="#23A55A" value={k.spacesAvailableNow ?? 0} label="Espacios libres ahora" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard title="Mis próximas reservas" to="/espacios" linkLabel="Reservar un espacio">
          {bookings.length ? (
            <ul className="divide-y divide-line">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.title || b.space_name}</p>
                    <p className="truncate text-xs text-mute">{b.space_name}</p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-mute">
                    <span className="block capitalize text-ink">{formatDate(b.date)}</span>
                    {b.start_time}–{b.end_time}
                  </p>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={CalendarClock} title="No tienes reservas próximas">Reserva un aula o cubículo desde Espacios.</EmptyState>}
        </ListCard>

        <ListCard title="Mis préstamos" to="/equipos" linkLabel="Ver equipos">
          {loans.length ? (
            <ul className="divide-y divide-line">
              {loans.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.equipment_name}</p>
                    <p className="truncate text-xs text-mute">{l.equipment_code}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-mute">
                    {l.overdue ? <Badge tone="warn">Vencido</Badge> : <StatusChip status="activo" />}
                    <p className="mt-1">Vence {formatDateTime(l.due_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Laptop} title="No tienes préstamos activos">Pide un equipo prestado desde Equipos.</EmptyState>}
        </ListCard>

        <ListCard title="Mis incidencias" to="/incidencias" linkLabel="Ver incidencias">
          {incidents.length ? (
            <ul className="divide-y divide-line">
              {incidents.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="truncate text-xs text-mute">{i.code}{i.space_name || i.equipment_name ? ` · ${i.space_name || i.equipment_name}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusChip status={i.status} />
                    {i.priority && <PriorityChip priority={i.priority} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={AlertTriangle} title="No has reportado incidencias">Si algo falla, repórtalo desde Incidencias.</EmptyState>}
        </ListCard>

        <ListCard title="Espacios libres ahora" to="/espacios" linkLabel="Ver espacios">
          {available.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {available.map((s) => (
                <li key={s.id} className="rounded-lg border border-line bg-panel px-3 py-2">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-mute">{spaceTypeLabel(s.type)} · {s.capacity} personas</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Building2} title="No hay espacios libres en este momento" />}
        </ListCard>
      </div>

      <Card title="Mi actividad reciente">
        <ActivityList items={data.activity} label="Mi actividad reciente" />
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const { data, loading, error, reload } = useLoad('/dashboard');
  const personal = data?.scope === 'personal';
  const ready = data && (personal || data.kpis);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Hola, {user?.name?.split(' ')[0]} 👋</h1>
        <Badge tone="ai">{user?.roleLabel}</Badge>
      </div>

      {loading && !data && <Spinner label="Cargando panel…" />}
      {error && (
        <Alert className="mb-4" title="No se pudo cargar el panel">
          {error.message} <Button size="sm" className="ml-2" onClick={reload}>Reintentar</Button>
        </Alert>
      )}

      {ready && (personal ? <PersonalView data={data} /> : <GlobalView data={data} can={can} />)}
    </>
  );
}
