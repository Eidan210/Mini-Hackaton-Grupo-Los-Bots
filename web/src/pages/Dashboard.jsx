import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bell, Building2, CalendarCheck, FileUp, Laptop, RefreshCw, Repeat, ShieldBan, Sparkles, Wrench,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';
import { Badge } from '../components/Badge.jsx';
import { timeAgo } from '../util.js';

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

function Kpi({ icon: Icon, tone, value, label, sub }) {
  return (
    <Card>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${tone}26`, color: tone }}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-mute">{label}</p>
      {sub && <p className="mt-0.5 text-xs" style={{ color: tone }}>{sub}</p>}
    </Card>
  );
}

function UsageChart({ usage }) {
  if (!usage?.length) return <EmptyState title="Sin datos de uso hoy" />;
  return (
    <div className="overflow-x-auto">
      <div className="flex h-44 min-w-[420px] items-end gap-2" role="img" aria-label="Espacios ocupados frente al total por hora">
        {usage.map((u) => {
          const pct = u.total ? Math.round((u.occupied / u.total) * 100) : 0;
          return (
            <div key={u.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] text-mute">{u.occupied}/{u.total}</span>
              <div className="flex w-full flex-1 items-end rounded-md bg-panel">
                <div className="w-full rounded-md bg-accent" style={{ height: `${pct}%`, minHeight: u.occupied ? 4 : 0 }} />
              </div>
              <span className="text-[10px] text-mute">{u.hour.slice(0, 2)}h</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad('/dashboard');
  const k = data?.kpis;

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

      {k && (
        <div className="space-y-6">
          {k.importRejected > 0 && (
            <Alert tone="warning">
              {k.importRejected} registros importados fueron rechazados. <Link to="/datos" className="font-semibold underline">Revisar datos importados</Link>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Building2} tone="#23A55A" value={`${k.spacesAvailable}/${k.spacesTotal}`} label="Aulas disponibles" />
            <Kpi icon={Laptop} tone="#3B82F6" value={`${k.equipmentLent}/${k.equipmentTotal}`} label="Equipos prestados" />
            <Kpi icon={AlertTriangle} tone="#F0B232" value={k.incidentsOpen} label="Incidencias abiertas" sub={`${k.incidentsHigh} de alta prioridad`} />
            <Kpi icon={CalendarCheck} tone="#6D5DFC" value={k.bookingsToday} label="Reservas hoy" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card title="Uso de espacios por hora" className="lg:col-span-3">
              <UsageChart usage={data.usage} />
            </Card>
            <Card title="Actividad reciente" className="lg:col-span-2">
              {data.activity?.length ? (
                <ul className="flex flex-col gap-3">
                  {data.activity.map((a) => {
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
              ) : <EmptyState title="Sin actividad todavía" />}
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
      )}
    </>
  );
}
