import { useMemo, useRef, useState } from 'react';
import { Brain, Send } from 'lucide-react';
import { apiFetch } from '../api.js';
import { Input, Select } from '../components/Field.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AiPanel from '../components/AiPanel.jsx';

const SUMMARY_Q = 'Resumen de incidencias abiertas';
const URGENT_Q = '¿Qué es lo más urgente?';
const MAX_Q = 300;

const chipCls = 'inline-flex items-center rounded-full border border-accent/40 bg-accent/20 px-2.5 py-0.5 font-mono text-xs font-medium text-[#b4abff]';

// Panel "Pregúntale a la IA": consulta sobre incidencias abiertas y bitácoras. La respuesta la genera siempre el backend.
export default function AskIncidentsAi({ incidents, onOpenIncident }) {
  const [scopeId, setScopeId] = useState('');
  const [text, setText] = useState('');
  // ask: idle | loading | error | done
  const [ask, setAsk] = useState({ state: 'idle' });
  const seq = useRef(0);

  const options = useMemo(() => [...(incidents || [])]
    .sort((a, b) => (a.status === 'resuelta') - (b.status === 'resuelta') || new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)),
  [incidents]);
  const scoped = options.find((i) => String(i.id) === scopeId) || null;
  const loading = ask.state === 'loading';

  async function run(question, incidentId) {
    const q = question.trim();
    if (!q) return;
    const n = ++seq.current;
    setAsk({ state: 'loading', question: q, incidentId });
    const body = { question: q };
    if (incidentId !== undefined) body.incidentId = incidentId;
    try {
      const res = await apiFetch('/ai/incidents/ask', { method: 'POST', body });
      if (n === seq.current) setAsk({ state: 'done', question: q, incidentId, res });
    } catch (error) {
      if (n === seq.current) setAsk({ state: 'error', question: q, incidentId, error });
    }
  }

  function submit(e) {
    e.preventDefault();
    run(text, scoped?.id);
  }

  const findByCode = (code) => (incidents || []).find((i) => i.code === code);

  return (
    <AiPanel title="Pregúntale a la IA" badge="Consulta IA">
      <p className="mb-4 text-sm text-mute">Consulta el estado de las incidencias. La IA responde con las incidencias abiertas y las notas de avance de los técnicos.</p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Preguntas rápidas">
        <Button size="sm" disabled={loading} onClick={() => run(SUMMARY_Q)}>{SUMMARY_Q}</Button>
        <Button size="sm" disabled={loading} onClick={() => run(URGENT_Q)}>{URGENT_Q}</Button>
        <Button size="sm" disabled={loading || !scoped} onClick={() => run(`¿Cómo va ${scoped.code}?`, scoped.id)}>
          {scoped ? `¿Cómo va ${scoped.code}?` : '¿Cómo va una incidencia?'}
        </Button>
      </div>

      <form onSubmit={submit} className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end">
        <Select label="Incidencia (opcional)" value={scopeId} onChange={(e) => setScopeId(e.target.value)} hint="Enfoca la pregunta o habilita “¿Cómo va…?”">
          <option value="">Todas las incidencias</option>
          {options.map((i) => <option key={i.id} value={String(i.id)}>{i.code} · {i.title}{i.status === 'resuelta' ? ' (resuelta)' : ''}</option>)}
        </Select>
        <Input label="Pregunta libre" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_Q} placeholder="Ej. ¿Qué incidencias llevan más de dos días sin avance?" />
        <Button type="submit" variant="primary" loading={loading} disabled={!text.trim()} className="md:mb-[1px]">
          <Send className="h-4 w-4" aria-hidden="true" /> Preguntar
        </Button>
      </form>

      <div aria-live="polite" aria-busy={loading}>
        {ask.state === 'idle' && (
          <EmptyState icon={Brain} title="Haz una pregunta">Usa una pregunta rápida o escribe la tuya para consultar el estado de las incidencias.</EmptyState>
        )}
        {ask.state === 'loading' && (
          <div role="status" className="space-y-3">
            <p className="text-sm text-mute">La IA está pensando… <span className="text-ink">“{ask.question}”</span></p>
            <div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" /><div className="skeleton h-4 w-2/3" />
          </div>
        )}
        {ask.state === 'error' && (
          <div className="space-y-3">
            <Alert title="La IA no pudo responder">{ask.error.message}</Alert>
            <Button size="sm" onClick={() => run(ask.question, ask.incidentId)}>Reintentar</Button>
          </div>
        )}
        {ask.state === 'done' && (
          <div className="space-y-3">
            <p className="text-xs text-mute">Pregunta: <span className="text-ink">{ask.question}</span></p>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{ask.res.answer}</p>
            {ask.res.cited?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-mute">Incidencias citadas:</span>
                {ask.res.cited.map((code) => {
                  const inc = findByCode(code);
                  return inc && onOpenIncident
                    ? <button key={code} type="button" className={`${chipCls} hover:bg-accent/30`} onClick={() => onOpenIncident(inc)} aria-label={`Abrir ${code}`}>{code}</button>
                    : <span key={code} className={chipCls}>{code}</span>;
                })}
              </div>
            )}
            <p className="text-xs text-mute">Modelo: {ask.res.model} · {ask.res.latencyMs} ms</p>
          </div>
        )}
      </div>
    </AiPanel>
  );
}
