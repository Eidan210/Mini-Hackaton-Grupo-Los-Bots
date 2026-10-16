import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useLoad } from '../hooks.js';
import { Select } from '../components/Field.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { ApiAlert } from '../components/Alert.jsx';
import { useToast } from '../components/Toast.jsx';

// Retirar espacios o equipos del catálogo (la capacidad instalada se añade con la importación de arriba).
export default function CatalogRemove() {
  const toast = useToast();
  const [entity, setEntity] = useState('spaces');
  const [id, setId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { data, reload } = useLoad(entity === 'spaces' ? '/spaces' : '/equipment');
  const items = data || [];
  const selected = items.find((x) => x.id === id);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/${entity}/${id}`, { method: 'DELETE' });
      toast(`${selected?.name} se retiró del catálogo`);
      setId('');
      reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <Card title="Retirar del catálogo" className="mt-6">
      <p className="mb-4 text-sm text-mute">Para añadir espacios o equipos usa la importación de arriba (CSV o JSON). Aquí puedes retirar uno que ya no exista.</p>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
        <Select label="Tipo" value={entity} onChange={(e) => { setEntity(e.target.value); setId(''); setError(null); }}>
          <option value="spaces">Espacio</option>
          <option value="equipment">Equipo</option>
        </Select>
        <Select label="Elemento" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Elige uno…</option>
          {items.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}{x.capacity ? ` (${x.capacity})` : ''}</option>)}
        </Select>
        <Button variant="danger" disabled={!id} onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Retirar</Button>
      </div>
      <ApiAlert error={error} className="mt-3" />
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Retirar del catálogo">
        <p className="text-sm text-mute">¿Retirar "{selected?.name}" ({selected?.code})? Su historial de reservas o préstamos también se elimina.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Volver</Button>
          <Button variant="danger" loading={busy} onClick={remove}>Retirar</Button>
        </div>
      </Modal>
    </Card>
  );
}
