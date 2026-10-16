import { useLoad } from '../hooks.js';
import { PageHeader } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Badge } from '../components/Badge.jsx';

export default function Rules() {
  const { data, loading, error } = useLoad('/rules');
  return (
    <>
      <PageHeader title="Reglas activas" subtitle="Estas reglas viven en server/rules.js" />
      {loading && <Spinner label="Cargando reglas…" />}
      {error && <Alert title="No se pudieron cargar las reglas">{error.message}</Alert>}
      {data && !data.reglas?.length && <EmptyState title="No hay reglas definidas" />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.reglas?.map((r) => (
          <Card key={r.id}>
            <div className="mb-2 flex items-center gap-3">
              <Badge tone="ai">{r.id}</Badge>
              <h2 className="font-semibold">{r.nombre}</h2>
            </div>
            <p className="text-sm text-mute">{r.descripcion}</p>
            <p className="mt-3 break-words rounded-lg bg-panel px-3 py-2 font-mono text-xs">
              {typeof r.valor === 'object' ? JSON.stringify(r.valor) : String(r.valor)}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
