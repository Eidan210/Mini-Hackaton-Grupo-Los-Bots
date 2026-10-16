import { TriangleAlert } from 'lucide-react';
import { Badge } from '../components/Badge.jsx';

const STATUS = {
  disponible: ['ok', 'Disponible'],
  prestado: ['info', 'Prestado'],
  en_revision: ['warn', 'En revisión'],
  danado: ['bad', 'Dañado'],
};

// "Reportado sin revisar" = la incidencia asociada sigue en estado "abierta"
export const isUnreviewed = (e) => e?.report?.status === 'abierta';

export function EquipmentStatusChip({ status }) {
  const [tone, text] = STATUS[status] || ['neutral', status];
  return <Badge tone={tone}>{text}</Badge>;
}

export function UnreviewedChip() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-bad/40 bg-bad/15 px-2.5 py-0.5 text-xs font-medium text-[#ff8a8d]">
      <TriangleAlert className="h-3 w-3" aria-hidden="true" /> Reportado sin revisar
    </span>
  );
}

// Estado del equipo + aviso de reporte pendiente
export function EquipmentChips({ equipment }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <EquipmentStatusChip status={equipment.status} />
      {isUnreviewed(equipment) && <UnreviewedChip />}
    </span>
  );
}

export const EQUIPMENT_STATES = [
  ['', 'Todos'],
  ['disponible', 'Disponible'],
  ['prestado', 'Prestado'],
  ['en_revision', 'En revisión'],
  ['danado', 'Dañado'],
  ['reportado', 'Reportado sin revisar'],
];
