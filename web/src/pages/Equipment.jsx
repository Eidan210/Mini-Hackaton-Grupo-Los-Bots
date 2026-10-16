import { useId, useMemo, useState } from 'react';
import { Info, Package, RotateCcw, Search } from 'lucide-react';
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
import { Badge } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';
import Tabs, { panelProps } from '../features/Tabs.jsx';
import categoryIcon from '../features/categoryIcon.js';
import { EQUIPMENT_STATES, EquipmentChips, isUnreviewed } from '../features/EquipmentStatus.jsx';
import EquipmentReviewList, { needsReview, sortReviewItems } from '../features/EquipmentReviewList.jsx';

export default function Equipment() {
  const { can, user } = useAuth();
  const toast = useToast();
  const tabsId = useId();
  const equipment = useLoad('/equipment');
  const loans = useLoad('/loans?status=activo');
  const [tab, setTab] = useState('inventario');
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [lending, setLending] = useState(null);
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [returning, setReturning] = useState(null);
  const [returnError, setReturnError] = useState(null);
  const [consultingId, setConsultingId] = useState(null);
  const [consultError, setConsultError] = useState(null);

  const canConsult = can('ver_tablero_incidencias') && ['admin', 'coordinador'].includes(user?.role);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (equipment.data || []).filter((e) => {
      const okState = !state || (state === 'reportado' ? isUnreviewed(e) : e.status === state);
      return okState && (!t || `${e.name} ${e.code} ${e.location}`.toLowerCase().includes(t));
    });
  }, [equipment.data, q, state]);

  const reviewItems = useMemo(() => sortReviewItems((equipment.data || []).filter(needsReview)), [equipment.data]);
  const unreviewedCount = reviewItems.filter(isUnreviewed).length;

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

  // Pide al técnico una actualización: el backend deja una nota en la incidencia y lo notifica
  async function consult(e) {
    setConsultingId(e.id);
    setConsultError(null);
    try {
      const res = await apiFetch(`/equipment/${e.id}/consult`, { method: 'POST' });
      toast(res?.notified
        ? `Se notificó a ${res.notified}`
        : `No hay técnico asignado: la solicitud quedó en la bitácora de ${e.report?.incident_code ?? 'la incidencia'}`);
      equipment.reload();
    } catch (err) {
      setConsultError(err);
    } finally {
      setConsultingId(null);
    }
  }

  const tabs = [
    { id: 'inventario', label: 'Inventario' },
    {
      id: 'revision',
      label: 'En revisión y reportados',
      count: equipment.data ? reviewItems.length : undefined,
      countLabel: 'equipos',
      countTone: 'warn',
    },
  ];

  return (
    <>
      <PageHeader title="Equipos" subtitle="Inventario y préstamos de equipos del campus" />

      {equipment.error && <Alert className="mb-4" title="No se pudieron cargar los equipos">{equipment.error.message}</Alert>}

      <Tabs tabs={tabs} value={tab} onChange={setTab} idBase={tabsId} ariaLabel="Vistas de equipos" />

      {tab === 'inventario' && (
        <div {...panelProps(tabsId, 'inventario')}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-mute" aria-hidden="true" />
              <Input label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código o ubicación" style={{ paddingLeft: 36 }} />
            </div>
            <div className="w-56">
              <Select label="Estado" value={state} onChange={(e) => setState(e.target.value)}>
                {EQUIPMENT_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          </div>

          <Card className="p-0">
            {equipment.loading && !equipment.data ? <Spinner label="Cargando equipos…" /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <caption className="sr-only">Inventario de equipos</caption>
                  <thead className="text-xs text-mute">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Equipo</th><th scope="col" className="px-4 py-3 font-medium">Código</th>
                      <th scope="col" className="px-4 py-3 font-medium">Estado</th><th scope="col" className="px-4 py-3 font-medium">Ubicación</th>
                      <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Acción</span></th>
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
                            <EquipmentChips equipment={e} />
                            {e.status === 'prestado' && e.borrower_name && <span className="mt-1 block text-xs text-mute">{e.borrower_name}</span>}
                          </td>
                          <td className="px-4 py-3 text-mute">{e.location}</td>
                          <td className="px-4 py-3 text-right">
                            {e.status === 'disponible' && can('prestar') && (
                              <Button size="sm" variant="primary" onClick={() => openLend(e)} aria-label={`Prestar ${e.name}`}>Prestar</Button>
                            )}
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
                  <caption className="sr-only">Préstamos activos</caption>
                  <thead className="text-xs text-mute">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Equipo</th><th scope="col" className="px-3 py-2 font-medium">Prestado a</th>
                      <th scope="col" className="px-3 py-2 font-medium">Vence</th><th scope="col" className="px-3 py-2"><span className="sr-only">Acción</span></th>
                    </tr>
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
                            <Button size="sm" loading={returning === l.id} onClick={() => giveBack(l)} aria-label={`Registrar devolución de ${l.equipment_name}`}>
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Registrar devolución
                            </Button>
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
        </div>
      )}

      {tab === 'revision' && (
        <div {...panelProps(tabsId, 'revision')}>
          {consultError && <ApiAlert error={consultError} className="mb-4" />}
          {equipment.loading && !equipment.data && <Spinner label="Cargando equipos…" />}
          {equipment.data && (
            <>
              <p className="mb-4 text-sm text-mute" role="status">
                {reviewItems.length === 0
                  ? 'No hay equipos en revisión ni reportados.'
                  : `${reviewItems.length} ${reviewItems.length === 1 ? 'equipo' : 'equipos'} en revisión, dañados o reportados · ${unreviewedCount} ${unreviewedCount === 1 ? 'reporte sin revisar' : 'reportes sin revisar'}.`}
              </p>
              {reviewItems.length === 0
                ? <Card><EmptyState icon={Package} title="Todo en orden">Ningún equipo está en revisión, dañado o con un reporte abierto.</EmptyState></Card>
                : <EquipmentReviewList items={reviewItems} canConsult={canConsult} consultingId={consultingId} onConsult={consult} />}
            </>
          )}
        </div>
      )}

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
