import { useState } from 'react';
import { apiFetch } from '../api.js';
import { Input, Select } from '../components/Field.jsx';
import Alert, { ApiAlert } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import FixedTextarea from './FixedTextarea.jsx';
import { formatDay } from './format.js';

const MAX_REASON = 200;
const TIPOS = [['mantenimiento', 'Mantenimiento'], ['bloqueo', 'Bloqueo']];

function BlockForm({ space, date, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ tipo: 'mantenimiento', desde: date, hasta: date, motivo: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [localError, setLocalError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setDesde = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, desde: v, hasta: f.hasta && v && f.hasta < v ? v : f.hasta }));
  };

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLocalError('');
    if (!form.desde || !form.hasta) { setLocalError('Indica las fechas de inicio y fin.'); return; }
    if (form.hasta < form.desde) { setLocalError('La fecha "Hasta" no puede ser anterior a "Desde".'); return; }
    setBusy(true);
    try {
      await apiFetch(`/spaces/${space.id}/blocks`, {
        method: 'POST',
        body: { tipo: form.tipo, desde: form.desde, hasta: form.hasta, motivo: form.motivo.trim() },
      });
      toast(`${space.name}: ${form.tipo === 'bloqueo' ? 'bloqueo' : 'mantenimiento'} programado hasta ${formatDay(form.hasta)}`);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-mute">Espacio: <span className="font-medium text-ink">{space.name}</span></p>
      <Select label="Tipo" value={form.tipo} onChange={set('tipo')} required>
        {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Desde" type="date" value={form.desde} onChange={setDesde} required />
        <Input label="Hasta (inclusive)" type="date" value={form.hasta} min={form.desde || undefined} onChange={set('hasta')} required />
      </div>
      <FixedTextarea
        label="Motivo"
        rows={3}
        maxLength={MAX_REASON}
        value={form.motivo}
        onChange={set('motivo')}
        required
        placeholder="Ej. Cambio del cableado de red del aula"
        hint={`${form.motivo.length}/${MAX_REASON}`}
      />
      {localError && <Alert>{localError}</Alert>}
      <ApiAlert error={error} />
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={busy} disabled={!form.motivo.trim()}>Programar</Button>
      </div>
    </form>
  );
}

// Modal para programar un mantenimiento o bloqueo de un espacio. `space` null = cerrado.
export default function SpaceBlockModal({ space, date, onClose, onDone }) {
  return (
    <Modal open={!!space} onClose={onClose} title="Programar mantenimiento o bloqueo">
      {space && <BlockForm key={space.id} space={space} date={date} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}
