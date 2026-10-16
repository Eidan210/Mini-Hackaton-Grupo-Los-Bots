import { useCallback, useState } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { PageHeader } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Badge } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Rules() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad('/rules');
  const canManage = can('gestionar_reglas');
  const [confirm, setConfirm] = useState(null); // regla que se quiere desactivar
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const setActive = useCallback(async (regla, activa) => {
    setBusyId(regla.id);
    setActionError(null);
    try {
      await apiFetch(`/rules/${encodeURIComponent(regla.id)}`, { method: 'PATCH', body: { activa } });
      toast(activa ? `Regla ${regla.id} activada` : `Regla ${regla.id} desactivada`);
      setConfirm(null);
      await reload();
    } catch (err) {
      setActionError(err);
      if (!confirm) toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }, [confirm, reload, toast]);

  const reglas = data?.reglas ?? [];
  const activeCount = reglas.filter((r) => r.activa).length;

  return (
    <>
      <PageHeader title="Reglas activas" subtitle="Normas que el sistema valida antes de aceptar una reserva, un préstamo o una incidencia." />
      {loading && !data && <Spinner label="Cargando reglas…" />}
      {error && <Alert title="No se pudieron cargar las reglas">{error.message}</Alert>}
      {data && !reglas.length && <EmptyState title="No hay reglas definidas" />}

      {reglas.length > 0 && (
        <>
          <p className="mb-4 text-sm text-mute" aria-live="polite">
            {activeCount} {activeCount === 1 ? 'regla activa' : 'reglas activas'} de {reglas.length}.
          </p>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {reglas.map((r) => (
              <li key={r.id} className="flex">
                <Card interactive className={`flex w-full flex-col ${r.activa ? '' : 'border-dashed'}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="ai">{r.id}</Badge>
                    {r.activa ? <Badge tone="ok">Activa</Badge> : <Badge tone="neutral">Desactivada</Badge>}
                  </div>
                  <h2 className="text-sm font-medium text-mute">{r.nombre}</h2>
                  <p className="mt-1 text-lg font-semibold leading-snug">{r.resumen || r.nombre}</p>
                  {r.descripcion && <p className="mt-2 text-sm text-mute">{r.descripcion}</p>}
                  {canManage && (
                    <div className="mt-auto flex justify-end pt-4">
                      {r.activa ? (
                        <Button size="sm" variant="secondary" disabled={busyId !== null} onClick={() => { setActionError(null); setConfirm(r); }}>
                          <PowerOff className="h-4 w-4" aria-hidden="true" /> Desactivar
                        </Button>
                      ) : (
                        <Button size="sm" variant="primary" loading={busyId === r.id} disabled={busyId !== null} onClick={() => setActive(r, true)}>
                          {busyId !== r.id && <Power className="h-4 w-4" aria-hidden="true" />} Activar
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {canManage && (
            <p className="mt-4 text-xs text-mute">
              Una regla desactivada deja de validarse. Desde esta pantalla no se crean reglas con lógica nueva:
              {' '}&ldquo;agregar&rdquo; una regla equivale a reactivar una que esté desactivada.
            </p>
          )}
        </>
      )}

      <Modal open={!!confirm} onClose={() => busyId === null && setConfirm(null)} title={confirm ? `Desactivar la regla ${confirm.id}` : ''}>
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{confirm.resumen || confirm.nombre}</span>
            </p>
            <Alert tone="warning">
              Mientras esté desactivada, el sistema dejará de aplicar esta regla y podrá aceptar operaciones que antes rechazaba.
              Puedes volver a activarla cuando quieras.
            </Alert>
            <ApiAlert error={actionError} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busyId !== null}>Cancelar</Button>
              <Button variant="danger" loading={busyId === confirm.id} onClick={() => setActive(confirm, false)}>Desactivar regla</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
