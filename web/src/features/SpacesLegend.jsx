import { useId } from 'react';
import SpaceTypeChip from './SpaceTypeChip.jsx';
import { SPACE_TYPE_KEYS } from './spaceTypes.js';

// Leyenda de la línea de tiempo: tipos de espacio (color + ícono) y, por separado, los estados.
export default function SpacesLegend() {
  const typesId = useId();
  const statesId = useId();
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-panel px-4 py-3 text-xs lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8">
      <div role="group" aria-labelledby={typesId} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id={typesId} className="font-medium text-mute">Tipo de espacio</span>
        {SPACE_TYPE_KEYS.map((k) => <SpaceTypeChip key={k} type={k} />)}
      </div>
      <div className="hidden h-6 w-px bg-line lg:block" aria-hidden="true" />
      <div role="group" aria-labelledby={statesId} className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span id={statesId} className="font-medium text-mute">Estado en la línea de tiempo</span>
        <span className="flex items-center gap-1.5 text-ink">
          <span className="h-4 w-8 rounded border border-ink/50 bg-ink/15" aria-hidden="true" /> Reserva <span className="text-mute">(color según el tipo)</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink">
          <span className="stripes h-4 w-8 rounded border border-line" aria-hidden="true" /> No disponible <span className="text-mute">(mantenimiento o bloqueo)</span>
        </span>
      </div>
    </div>
  );
}
