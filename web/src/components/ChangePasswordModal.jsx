import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { apiFetch } from '../api.js';
import Modal from './Modal.jsx';
import PasswordInput from './PasswordInput.jsx';
import Button from './Button.jsx';
import { ApiAlert } from './Alert.jsx';
import { useToast } from './Toast.jsx';

// Cada usuario cambia su propia contraseña; el backend valida la actual.
export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));
  const mismatch = form.confirm && form.next !== form.confirm;

  function close() {
    setForm({ current: '', next: '', confirm: '' });
    setError(null);
    onClose();
  }

  async function submit(ev) {
    ev.preventDefault();
    if (form.next !== form.confirm) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/password', { method: 'PATCH', body: { currentPassword: form.current, newPassword: form.next } });
      toast('Contraseña actualizada');
      close();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Cambiar contraseña">
      <form onSubmit={submit} className="space-y-4">
        <PasswordInput label="Contraseña actual" autoComplete="current-password" required value={form.current} onChange={set('current')} />
        <PasswordInput label="Nueva contraseña" hint="Mínimo 8 caracteres" autoComplete="new-password" required minLength={8} value={form.next} onChange={set('next')} />
        <PasswordInput label="Confirmar nueva contraseña" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')}
          error={mismatch ? 'Las contraseñas no coinciden' : undefined} />
        <ApiAlert error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={close}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={mismatch || form.next.length < 8}>
            <KeyRound className="h-4 w-4" aria-hidden="true" /> Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
