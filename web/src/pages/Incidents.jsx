import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { PageHeader } from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import IncidentReportForm from '../features/IncidentReportForm.jsx';
import IncidentHistory from '../features/IncidentHistory.jsx';
import IncidentBoard from '../features/IncidentBoard.jsx';
import IncidentDetail from '../features/IncidentDetail.jsx';
import AskIncidentsAi from '../features/AskIncidentsAi.jsx';

// Cada rol ve lo que le corresponde:
//  - reportar_incidencia ............ formulario "Nueva incidencia" + asistente IA de clasificación
//  - ver_tablero_incidencias ........ tablero con detalle y bitácora de avances
//  - consultar_ia_incidencias ....... panel "Pregúntale a la IA"
//  - sin tablero (camper, trainer) .. historial propio de solo lectura
export default function Incidents() {
  const { can } = useAuth();
  const incidents = useLoad('/incidents');
  const [selectedId, setSelectedId] = useState(null);

  const canReport = can('reportar_incidencia');
  const canBoard = can('ver_tablero_incidencias');
  const canAsk = can('consultar_ia_incidencias');
  const canManage = can('gestionar_incidencias');
  const canNote = can('registrar_avance') || canManage;

  const selected = incidents.data?.find((i) => i.id === selectedId) ?? null;
  const open = (inc) => setSelectedId(inc.id);

  return (
    <>
      <PageHeader
        title="Incidencias"
        subtitle={canReport
          ? 'Reporta un problema y deja que la IA lo clasifique; tú confirmas.'
          : 'Seguimiento de incidencias: estado, técnico asignado y bitácora de avances.'}
      />

      <div className="space-y-6">
        {canAsk && <AskIncidentsAi incidents={incidents.data} onOpenIncident={canBoard ? open : undefined} />}

        {canReport && <IncidentReportForm onCreated={incidents.reload} />}

        {canBoard
          ? <IncidentBoard incidents={incidents} onOpen={open} />
          : <IncidentHistory incidents={incidents} />}
      </div>

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `${selected.code} · ${selected.title}` : 'Incidencia'} variant="drawer">
        {selected && (
          <IncidentDetail
            key={selected.id}
            incident={selected}
            canManage={canManage}
            canNote={canNote}
            onChanged={incidents.reload}
          />
        )}
      </Modal>
    </>
  );
}
