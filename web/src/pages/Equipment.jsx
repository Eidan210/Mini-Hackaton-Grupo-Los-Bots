import { useMemo, useState } from 'react';
import { Camera, Info, Laptop, Mic, Package, Projector, RotateCcw, Router, Search, Tablet } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { formatDateTime } from '../util.js';
import { Input, PageHeader, Select } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Badge, StatusChip } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';

// Icono según la categoría (búsqueda por palabra clave)
function categoryIcon(cat = '') {
  const c = cat.toLowerCase();
  if (/port|lap|comput|pc/.test(c)) return Laptop;
  if (/proy|video/.test(c)) return Projector;
  if (/c[aá]m|foto/.test(c)) return Camera;
  if (/tab/.test(c)) return Tablet;
  if (/mic|audio|son/.test(c)) return Mic;
  if (/red|rout|switch/.test(c)) return Router;
  return Package;
}

const STATES = [['', 'Todos'], ['disponible', 'Disponible'], ['prestado', 'En uso'], ['en_revision', 'En revisión'], ['danado', 'Dañado']];

export default function Equipment() {
  const { can, user } = useAuth();
  const toast = useToast();
  const equipment = useLoad('/equipment');
  const loans = useLoad('/loans?status=activo');
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [lending, setLending] = useState(null);
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [returning, setReturning] = useState(null);
  const [returnError, setReturnError] = useState(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (equipment.data || []).filter((e) =>
      (!state || e.status === state) && (!t || `${e.name} ${e.code} ${e.location}`.toLowerCase().includes(t)));
  }, [equipment.data, q, state]);

  const refresh = () => { equipment.reload(); loans.reload(); };

  function openLend(e) { setLending(e); setHours(2); setError(null); }

  async function lend(ev) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/loans', { method: 'POST', body: { equipmentId: lending.id, hours: Number(hours) } });
      toast(`${lending.name} prestado por ${hours} h`);
      setLending(null);
      refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function giveBack(loan) {
    setReturning(loan.id);
    setReturnError(null);
    try {
      await apiFetch(`/loans/${loan.id}/return`, { method: 'POST' });
      toast('Devolución registrada');
      refresh();
    } catch (e) {
      setReturnError(e);
    } finally {
      setReturning(null);
    }
  }

  return (
    <>
      <PageHeader title="Equipos" subtitle="Inventario y préstamos de equipos del campus" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-mute" aria-hidden="true" />
          <Input label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código o ubicación" style={{ paddingLeft: 36 }} />
        </div>
        <div className="w-48">
          <Select label="Estado" value={state} onChange={(e) => setState(e.target.value)}>
            {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>

      {equipment.error && <Alert className="mb-4" title="No se pudieron cargar los equipos">{equipment.error.message}</Alert>}

      <Card className="p-0">
        {equipment.loading && !equipment.data ? <Spinner label="Cargando equipos…" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-mute">
                <tr>
                  <th className="px-4 py-3 font-medium">Equipo</th><th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const Icon = categoryIcon(e.category);
                  return (
                    <tr key={e.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel text-mute"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                          <span><span className="block font-medium">{e.name}</span><span className="block text-xs text-mute">{e.category}</span></span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{e.code}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={e.status} />
                        {e.status === 'prestado' && e.borrower_name && <span className="mt-1 block text-xs text-mute">{e.borrower_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-mute">{e.location}</td>
                      <td className="px-4 py-3 text-right">
                        {e.status === 'disponible' && can('prestar') && <Button size="sm" variant="primary" onClick={() => openLend(e)}>Prestar</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {equipment.data && !rows.length && <EmptyState icon={Package} title="Sin equipos para este filtro" />}
          </div>
        )}
      </Card>

      <Card title="Préstamos activos" className="mt-6">
        {returnError && <ApiAlert error={returnError} className="mb-3" />}
        {loans.error && <Alert>{loans.error.message}</Alert>}
        {loans.loading && !loans.data && <Spinner label="Cargando préstamos…" />}
        {loans.data && !loans.data.length && <EmptyState title="No hay préstamos activos" />}
        {loans.data?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="text-xs text-mute">
                <tr><th className="px-3 py-2 font-medium">Equipo</th><th className="px-3 py-2 font-medium">Prestado a</th><th className="px-3 py-2 font-medium">Vence</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody>
                {loans.data.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-3"><span className="font-medium">{l.equipment_name}</span> <span className="font-mono text-xs text-mute">{l.equipment_code}</span></td>
                    <td className="px-3 py-3">{l.user_name}</td>
                    <td className="px-3 py-3">
                      <span className="mr-2">{formatDateTime(l.due_at)}</span>
                      {l.overdue && <Badge tone="bad">Vencido</Badge>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(l.user_id === user?.id || ['admin', 'coordinador', 'tecnico'].includes(user?.role)) && (
                        <Button size="sm" loading={returning === l.id} onClick={() => giveBack(l)}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Registrar devolución</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-6 flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-mute">
        <Info className="h-4 w-4 shrink-0 text-info" aria-hidden="true" /> Los equipos dañados o en revisión no se pueden prestar.
      </p>

      <Modal open={!!lending} onClose={() => setLending(null)} title={`Prestar ${lending?.name ?? ''}`}>
        <form onSubmit={lend} className="space-y-4">
          <Input label="Horas de préstamo" type="number" min="1" value={hours} onChange={(e) => setHours(e.target.value)} required />
          <ApiAlert error={error} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setLending(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>Confirmar préstamo</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
