import { useState } from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useLoad } from '../hooks.js';
import { Select } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AiPanel from '../components/AiPanel.jsx';
import { PriorityChip } from '../components/Badge.jsx';
import { useToast } from '../components/Toast.jsx';
import FixedTextarea from './FixedTextarea.jsx';
import IncidentEffects from './IncidentEffects.jsx';

const MAX = 500;

// Formulario "Nueva incidencia" + panel "Asistente IA" de clasificación (solo roles con `reportar_incidencia`)
export default function IncidentReportForm({ onCreated }) {
  const toast = useToast();
  const rules = useLoad('/rules');
  const spaces = useLoad('/spaces');
  const equipment = useLoad('/equipment');

  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  // ai: idle | loading | error | result
  const [ai, setAi] = useState({ state: 'idle' });
  const [draft, setDraft] = useState(null); // clasificación editable
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [effects, setEffects] = useState(null);

  const cat = rules.data?.catalogos || {};

  async function analyze() {
    setAi({ state: 'loading' });
    setDraft(null);
    setEffects(null);
    setSaveError(null);
    const body = { description };
    if (spaceId) body.spaceId = spaceId;
    if (equipmentId) body.equipmentId = equipmentId;
    try {
      const res = await apiFetch('/incidents/analyze', { method: 'POST', body });
      setAi({ state: 'result', res });
      setDraft({ ...res.analysis, spaceId: res.analysis.spaceId ?? body.spaceId ?? null, equipmentId: res.analysis.equipmentId ?? body.equipmentId ?? null });
    } catch (e) {
      setAi({ state: 'error', error: e });
    }
  }

  // Clasificación manual: sin modelo, campos vacíos que el usuario completa
  function manual() {
    setAi({ state: 'result', res: null });
    setDraft({
      title: '', category: cat.categorias?.[0] ?? '', priority: cat.prioridades?.[0] ?? '', area: cat.areas?.[0] ?? '',
      justification: '', recommendations: [], spaceId: spaceId || null, equipmentId: equipmentId || null,
    });
  }

  async function confirm() {
    setSaveBusy(true);
    setSaveError(null);
    const body = {
      description, category: draft.category, priority: draft.priority, area: draft.area,
      justification: draft.justification || (ai.res ? '' : 'Clasificación manual'),
      aiModel: ai.res ? ai.res.model : null,
    };
    if (draft.title) body.title = draft.title;
    if (draft.spaceId) body.spaceId = draft.spaceId;
    if (draft.equipmentId) body.equipmentId = draft.equipmentId;
    try {
      const res = await apiFetch('/incidents', { method: 'POST', body });
      toast('Incidencia registrada');
      setEffects(res.effects);
      setDescription('');
      setSpaceId('');
      setEquipmentId('');
      setAi({ state: 'idle' });
      setDraft(null);
      onCreated?.();
      spaces.reload();
      equipment.reload();
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaveBusy(false);
    }
  }

  const upd = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Izquierda: formulario */}
      <Card title="Nueva incidencia">
        <div className="space-y-4">
          <FixedTextarea
            label="Descripción del problema"
            rows={5}
            maxLength={MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. El proyector del aula A-102 no enciende y huele a quemado"
            hint={`${description.length}/${MAX} · mínimo 10 caracteres`}
          />
          <Select label="Ubicación (opcional)" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">Sin ubicación</option>
            {spaces.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select label="Equipo (opcional)" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="">Sin equipo</option>
            {equipment.data?.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
          </Select>
          <Button variant="primary" className="w-full" loading={ai.state === 'loading'} disabled={description.trim().length < 10} onClick={analyze}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Analizar con IA
          </Button>
          {effects && <IncidentEffects effects={effects} />}
        </div>
      </Card>

      {/* Derecha: asistente IA */}
      <AiPanel badge={ai.state === 'result' && ai.res ? 'Propuesta IA' : undefined}>
        {ai.state === 'idle' && (
          <EmptyState icon={Brain} title="Esperando una incidencia">Describe el problema y pulsa "Analizar con IA" para recibir una propuesta de clasificación.</EmptyState>
        )}
        {ai.state === 'loading' && (
          <div role="status" aria-live="polite" className="space-y-3">
            <p className="text-sm text-mute">La IA está analizando la incidencia…</p>
            <div className="skeleton h-5 w-3/4" /><div className="skeleton h-4 w-1/2" /><div className="skeleton h-16 w-full" /><div className="skeleton h-4 w-2/3" />
          </div>
        )}
        {ai.state === 'error' && (
          <div className="space-y-3">
            <Alert title="La IA no pudo analizar la incidencia">{ai.error.message}</Alert>
            <Button onClick={manual} disabled={!rules.data}>Clasificar manualmente</Button>
            {rules.error && <p className="text-xs text-mute">No se pudieron cargar las categorías para la clasificación manual: {rules.error.message}</p>}
          </div>
        )}
        {ai.state === 'result' && draft && (
          <div className="space-y-4">
            {ai.res ? <h3 className="text-lg font-semibold">{draft.title}</h3> : <Alert tone="info">Clasificación manual: sin intervención de la IA.</Alert>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Categoría" value={draft.category} onChange={upd('category')}>
                {(cat.categorias || []).map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Select label="Prioridad" value={draft.priority} onChange={upd('priority')}>
                {(cat.prioridades || []).map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Select label="Área responsable" value={draft.area} onChange={upd('area')}>
                {(cat.areas || []).map((c) => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm"><span className="text-mute">Prioridad:</span> <PriorityChip priority={draft.priority} /></div>
            {draft.justification && <p className="text-sm"><span className="font-medium">Justificación: </span><span className="text-mute">{draft.justification}</span></p>}
            {draft.recommendations?.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">Recomendaciones</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-mute">{draft.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
            {ai.res?.consequence && (
              <div className="rounded-lg border border-accent bg-accent/15 p-3 text-sm font-medium">Al confirmar: {ai.res.consequence}</div>
            )}
            <ApiAlert error={saveError} />
            <Button variant="primary" className="w-full" loading={saveBusy} onClick={confirm} disabled={!draft.category || !draft.priority || !draft.area}>
              Confirmar y registrar
            </Button>
            {ai.res && <p className="text-xs text-mute">Modelo: {ai.res.model} · {ai.res.latencyMs} ms</p>}
          </div>
        )}
      </AiPanel>
    </div>
  );
}
