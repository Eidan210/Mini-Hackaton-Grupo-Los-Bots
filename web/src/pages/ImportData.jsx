import { useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { PageHeader, Select, Textarea } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';

function RejectedTable({ rows, cols }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs text-mute">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

export default function ImportData() {
  const { can } = useAuth();
  const toast = useToast();
  const errors = useLoad('/import/errors');
  const [entity, setEntity] = useState('spaces');
  const [format, setFormat] = useState('csv');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setContent(await f.text());
    if (f.name.endsWith('.json')) setFormat('json');
    if (f.name.endsWith('.csv')) setFormat('csv');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch('/import', { method: 'POST', body: { entity, format, content } });
      setResult(res);
      toast(`Importación completada: ${res.inserted} nuevos, ${res.updated} actualizados`);
      errors.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Datos importados" subtitle="Carga masiva de espacios y equipos; los registros inválidos se rechazan con su motivo." />
      <div className="space-y-6">
        {can('importar_datos') && (
          <Card title="Importar datos">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select label="Entidad" value={entity} onChange={(e) => setEntity(e.target.value)}>
                  <option value="spaces">Espacios</option>
                  <option value="equipment">Equipos</option>
                </Select>
                <Select label="Formato" value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </Select>
              </div>
              <Textarea label="Contenido" rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono" placeholder="Pega aquí el contenido o carga un archivo" />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-btn px-4 py-2 text-sm font-medium hover:bg-[#5a5c65] focus-within:outline focus-within:outline-2 focus-within:outline-[#9a8fff]">
                  <FileUp className="h-4 w-4" aria-hidden="true" /> Cargar archivo
                  <input type="file" accept=".csv,.json,text/csv,application/json,text/plain" onChange={onFile} className="sr-only" />
                </label>
                <Button type="submit" variant="primary" loading={busy} disabled={!content.trim()}>
                  <Upload className="h-4 w-4" aria-hidden="true" /> Importar
                </Button>
              </div>
            </form>
            <div className="mt-4 space-y-3">
              <ApiAlert error={error} />
              {result && (
                <Alert tone="success" title="Importación completada">
                  Insertados: {result.inserted} · Actualizados: {result.updated} · Rechazados: {result.rejected?.length ?? 0}
                </Alert>
              )}
              {result?.rejected?.length > 0 && (
                <RejectedTable
                  cols={['Fila', 'Registro', 'Motivo']}
                  rows={result.rejected.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2 font-mono text-xs">{typeof r.raw === 'string' ? r.raw : JSON.stringify(r.raw)}</td>
                      <td className="px-3 py-2 text-[#ff8a8d]">{r.reason}</td>
                    </tr>
                  ))}
                />
              )}
            </div>
          </Card>
        )}

        <Card title="Registros rechazados">
          {errors.loading && !errors.data && <Spinner label="Cargando rechazos…" />}
          {errors.error && <Alert>{errors.error.message}</Alert>}
          {errors.data && !errors.data.length && <EmptyState title="Sin registros rechazados">Todo lo importado hasta ahora fue válido.</EmptyState>}
          {errors.data?.length > 0 && (
            <RejectedTable
              cols={['Origen', 'Fila', 'Registro', 'Motivo']}
              rows={errors.data.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-2">{r.source}</td>
                  <td className="px-3 py-2">{r.row_number}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{typeof r.raw === 'string' ? r.raw : JSON.stringify(r.raw)}</td>
                  <td className="px-3 py-2 text-[#ff8a8d]">{r.reason}</td>
                </tr>
              ))}
            />
          )}
        </Card>
      </div>
    </>
  );
}
