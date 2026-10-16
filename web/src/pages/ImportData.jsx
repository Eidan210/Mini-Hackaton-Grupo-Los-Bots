import { useMemo, useState } from 'react';
import { CheckCheck, Eye, FileText, FileUp, RotateCcw, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { PageHeader, Select, Textarea } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { Badge } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDateTime } from '../util.js';
import CatalogRemove from '../features/CatalogRemove.jsx';

/* ───────── Formato esperado (lo que valida el importador del servidor) ───────── */

const FORMATS = {
  spaces: {
    title: 'Espacios',
    columns: [
      ['codigo', 'Obligatoria y única. Ej.: A-101'],
      ['nombre', 'Obligatoria'],
      ['tipo', 'aula, cubiculo, laboratorio o auditorio'],
      ['capacidad', 'Número entero mayor a 0'],
      ['ubicacion', 'Opcional'],
      ['estado', 'Opcional: disponible, mantenimiento o bloqueado'],
    ],
    csv: 'codigo,nombre,tipo,capacidad,ubicacion,estado\nA-301,Aula A-301,aula,30,Torre A · Piso 3,disponible',
  },
  equipment: {
    title: 'Equipos',
    columns: [
      ['codigo', 'Obligatoria y única. Ej.: LP-050'],
      ['nombre', 'Obligatoria'],
      ['categoria', 'portatil, proyector, tablet, audio, red u otro'],
      ['ubicacion', 'Opcional'],
      ['estado', 'Opcional: disponible, en_revision o danado'],
    ],
    csv: 'codigo,nombre,categoria,ubicacion,estado\nLP-050,Portátil Lenovo ThinkPad,portatil,Biblioteca,disponible',
  },
};

function FormatGuide() {
  return (
    <Card title="Formato esperado" className="h-fit">
      <p className="mb-4 text-sm text-mute">
        La primera fila es el encabezado. Puede ir en español o inglés y separarse con coma o punto y coma.
        En JSON, envía un arreglo de objetos con las mismas claves.
      </p>
      <div className="space-y-5">
        {Object.entries(FORMATS).map(([key, f]) => (
          <section key={key} aria-labelledby={`fmt-${key}`}>
            <h3 id={`fmt-${key}`} className="mb-2 text-sm font-semibold">{f.title}</h3>
            <dl className="divide-y divide-line rounded-lg border border-line bg-panel text-sm">
              {f.columns.map(([col, desc]) => (
                <div key={col} className="grid grid-cols-[7rem_1fr] gap-2 px-3 py-1.5">
                  <dt className="font-mono text-xs text-accent-soft">{col}</dt>
                  <dd className="text-xs text-mute">{desc}</dd>
                </div>
              ))}
            </dl>
            <p className="mb-1 mt-3 text-xs font-medium text-mute">Ejemplo CSV</p>
            <pre className="overflow-x-auto rounded-lg border border-line bg-panel p-3 font-mono text-xs leading-relaxed">{f.csv}</pre>
          </section>
        ))}
      </div>
    </Card>
  );
}

/* ───────── Ayuda para corregir un rechazo ───────── */

const FIXES = [
  [/c[oó]digo vac[ií]o/i, 'Completa la columna "codigo" con un identificador único (por ejemplo A-101 o LP-050).'],
  [/nombre vac[ií]o/i, 'Escribe el nombre del espacio o del equipo en la columna "nombre".'],
  [/tipo .*no es v[aá]lido/i, 'Usa un tipo válido: aula, cubiculo, laboratorio o auditorio.'],
  [/capacidad/i, 'La capacidad debe ser un número entero mayor a 0 (por ejemplo 30), sin texto ni decimales.'],
  [/categor[ií]a .*no es v[aá]lida?/i, 'Usa una categoría válida: portatil, proyector, tablet, audio, red u otro.'],
  [/prestado/i, 'No importes equipos como "prestado": déjalos como "disponible" y registra el préstamo desde la sección Equipos.'],
  [/estado .*no es v[aá]lido/i, 'Usa un estado válido: disponible, mantenimiento o bloqueado (espacios); disponible, en_revision o danado (equipos).'],
  [/duplicad/i, 'Cada código debe aparecer una sola vez por archivo: elimina la fila repetida o cambia su código.'],
  [/no se pudo leer|formato inv[aá]lido/i, 'Revisa que el contenido sea un CSV con encabezado (o un JSON válido) y que el formato elegido coincida con el archivo.'],
];

function suggestFixes(reason = '') {
  const found = FIXES.filter(([re]) => re.test(reason)).map(([, text]) => text);
  return found.length ? found : ['Corrige el registro según el motivo indicado y vuelve a importarlo. Si ya lo resolviste, márcalo como revisado.'];
}

const rawText = (raw) => {
  if (raw === null || raw === undefined) return '';
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
};

const FILTERS = [
  ['pendiente', 'Pendientes'],
  ['revisado', 'Revisados'],
  ['todos', 'Todos'],
];

function StatusBadge({ status }) {
  return status === 'revisado' ? <Badge tone="ok">Revisado</Badge> : <Badge tone="warn">Pendiente</Badge>;
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

  const [filter, setFilter] = useState('pendiente');
  const [rowBusy, setRowBusy] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const all = errors.data;
  const counts = useMemo(() => ({
    pendiente: (all || []).filter((r) => r.status !== 'revisado').length,
    revisado: (all || []).filter((r) => r.status === 'revisado').length,
    todos: (all || []).length,
  }), [all]);
  const visible = useMemo(() => (all || []).filter((r) => {
    if (filter === 'todos') return true;
    return filter === 'revisado' ? r.status === 'revisado' : r.status !== 'revisado';
  }), [all, filter]);
  const detail = all?.find((r) => r.id === detailId) || null;

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setContent(await f.text());
    if (f.name.endsWith('.json')) setFormat('json');
    if (f.name.endsWith('.csv')) setFormat('csv');
    e.target.value = ''; // permite volver a elegir el mismo archivo
  }

  function fillExample() {
    setFormat('csv');
    setContent(FORMATS[entity].csv);
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
      if (res.rejected?.length) setFilter('pendiente');
      errors.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleReview(r) {
    const next = r.status === 'revisado' ? 'pendiente' : 'revisado';
    setRowBusy(r.id);
    try {
      await apiFetch(`/import/errors/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { status: next } });
      toast(next === 'revisado' ? 'Registro marcado como revisado' : 'Registro marcado como pendiente');
      await errors.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRowBusy(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setRowBusy(toDelete.id);
    setDeleteError(null);
    try {
      await apiFetch(`/import/errors/${encodeURIComponent(toDelete.id)}`, { method: 'DELETE' });
      toast('Registro eliminado');
      if (detailId === toDelete.id) setDetailId(null);
      setToDelete(null);
      await errors.reload();
    } catch (err) {
      setDeleteError(err);
    } finally {
      setRowBusy(null);
    }
  }

  const canImport = can('importar_datos');

  return (
    <>
      <PageHeader title="Datos importados" subtitle="Carga masiva de espacios y equipos; los registros inválidos se rechazan con su motivo para que puedas corregirlos." />
      <div className={`grid grid-cols-1 gap-6 ${canImport ? 'lg:grid-cols-2' : ''}`}>
        {canImport && (
          <>
            <Card title="Importar datos" className="h-fit">
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
                <Textarea
                  label="Contenido"
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[200px] w-full font-mono"
                  spellCheck={false}
                  placeholder="Pega aquí el contenido o carga un archivo"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-btn px-4 py-2 text-sm font-medium hover:bg-[#5d5f69] active:bg-[#686a75] focus-within:outline focus-within:outline-2 focus-within:outline-[#9a8fff]">
                    <FileUp className="h-4 w-4" aria-hidden="true" /> Cargar archivo
                    <input type="file" accept=".csv,.json,text/csv,application/json,text/plain" onChange={onFile} className="sr-only" />
                  </label>
                  <Button variant="ghost" onClick={fillExample}>
                    <FileText className="h-4 w-4" aria-hidden="true" /> Usar ejemplo
                  </Button>
                  <Button type="submit" variant="primary" loading={busy} disabled={!content.trim()} className="ml-auto">
                    <Upload className="h-4 w-4" aria-hidden="true" /> Importar
                  </Button>
                </div>
              </form>
              <div className="mt-4 space-y-3">
                <ApiAlert error={error} />
                {result && (
                  <Alert
                    tone={result.rejected?.length ? 'warning' : 'success'}
                    title="Importación completada"
                  >
                    Insertados: {result.inserted} · Actualizados: {result.updated} · Rechazados: {result.rejected?.length ?? 0}
                    {result.rejected?.length > 0 && ' — los rechazados aparecen abajo para revisarlos.'}
                  </Alert>
                )}
              </div>
            </Card>
            <FormatGuide />
          </>
        )}

        <Card
          title="Registros rechazados"
          className={canImport ? 'lg:col-span-2' : ''}
          action={all && (
            <div role="group" aria-label="Filtrar por estado" className="inline-flex rounded-lg border border-line bg-panel p-0.5">
              {FILTERS.map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${filter === value ? 'bg-accent text-white' : 'text-mute hover:bg-white/10 hover:text-ink'}`}
                >
                  {text} ({counts[value]})
                </button>
              ))}
            </div>
          )}
        >
          {errors.loading && !all && <Spinner label="Cargando rechazos…" />}
          {errors.error && <Alert>{errors.error.message}</Alert>}
          {all && !all.length && <EmptyState title="Sin registros rechazados">Todo lo importado hasta ahora fue válido.</EmptyState>}
          {all?.length > 0 && !visible.length && (
            <EmptyState title={filter === 'revisado' ? 'No hay registros revisados' : 'No hay registros pendientes'}>
              {filter === 'pendiente' ? 'Ya revisaste todos los rechazos. Usa el filtro para ver el historial.' : 'Cambia el filtro para ver otros registros.'}
            </EmptyState>
          )}
          {visible.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <caption className="sr-only">Registros rechazados en las importaciones</caption>
                <thead className="text-xs text-mute">
                  <tr>
                    {['Origen', 'Fila', 'Registro', 'Motivo', 'Estado', 'Acciones'].map((c) => (
                      <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const reviewed = r.status === 'revisado';
                    const working = rowBusy === r.id;
                    return (
                      <tr key={r.id} className="border-t border-line align-top">
                        <td className="px-3 py-2">{r.source}</td>
                        <td className="px-3 py-2">{r.row_number}</td>
                        <td className="max-w-[260px] break-all px-3 py-2 font-mono text-xs">{rawText(r.raw)}</td>
                        <td className="px-3 py-2 text-[#ff8a8d]">{r.reason}</td>
                        <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => setDetailId(r.id)}>
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Ver detalle
                            </Button>
                            <Button size="sm" variant="secondary" loading={working} disabled={rowBusy !== null} onClick={() => toggleReview(r)}>
                              {!working && (reviewed ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />)}
                              {reviewed ? 'Marcar pendiente' : 'Marcar como revisado'}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={rowBusy !== null} onClick={() => { setDeleteError(null); setToDelete(r); }} aria-label={`Eliminar el registro de la fila ${r.row_number}`}>
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={!!detail} onClose={() => setDetailId(null)} title="Detalle del registro rechazado" size="lg">
        {detail && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-mute">Origen</dt><dd className="break-words">{detail.source}</dd></div>
              <div><dt className="text-xs text-mute">Fila</dt><dd>{detail.row_number}</dd></div>
              <div><dt className="text-xs text-mute">Estado</dt><dd className="mt-0.5"><StatusBadge status={detail.status} /></dd></div>
              <div><dt className="text-xs text-mute">Recibido</dt><dd>{formatDateTime(detail.created_at)}</dd></div>
            </dl>
            {detail.status === 'revisado' && (
              <p className="text-xs text-mute">
                Revisado{detail.reviewed_by_name ? ` por ${detail.reviewed_by_name}` : ''}{detail.reviewed_at ? ` · ${formatDateTime(detail.reviewed_at)}` : ''}
              </p>
            )}
            <div>
              <p className="mb-1 text-xs font-medium text-mute">Registro completo</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-panel p-3 font-mono text-xs">{rawText(detail.raw) || '(vacío)'}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-mute">Motivo del rechazo</p>
              <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-[#ff8a8d]">{detail.reason}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-mute">Cómo corregirlo</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {suggestFixes(detail.reason).map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setDetailId(null)}>Cerrar</Button>
              <Button variant="secondary" loading={rowBusy === detail.id} disabled={rowBusy !== null} onClick={() => toggleReview(detail)}>
                {detail.status === 'revisado' ? 'Marcar pendiente' : 'Marcar como revisado'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!toDelete} onClose={() => rowBusy === null && setToDelete(null)} title="Eliminar registro rechazado">
        {toDelete && (
          <div className="space-y-4">
            <p className="text-sm">
              Vas a eliminar el registro de la fila <span className="font-semibold">{toDelete.row_number}</span> de <span className="font-semibold">{toDelete.source}</span>.
              Esta acción no se puede deshacer.
            </p>
            <ApiAlert error={deleteError} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={rowBusy !== null}>Cancelar</Button>
              <Button variant="danger" loading={rowBusy === toDelete.id} onClick={confirmDelete}>Eliminar</Button>
            </div>
          </div>
        )}
      </Modal>
      {canImport && <CatalogRemove />}
    </>
  );
}
