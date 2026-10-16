import Alert from '../components/Alert.jsx';

// Efectos secundarios que devuelve el backend al crear o actualizar una incidencia (p. ej. "Aula A-102 quedó bloqueada")
export default function IncidentEffects({ effects, className = 'mt-3' }) {
  if (!effects?.length) return null;
  return (
    <Alert tone="success" title="Efectos aplicados" className={className}>
      <ul className="list-disc pl-4">{effects.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </Alert>
  );
}
