import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import { Badge } from '../components/Badge.jsx';
import { initials } from '../util.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    apiFetch('/auth/users').then(setUsers).catch(setError);
  }, []);

  async function pick(id) {
    setBusyId(id);
    setError(null);
    try {
      await login(id);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e);
      setBusyId(null);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <Building2 className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold">Campus<span className="text-accent">Control</span></h1>
          <p className="mt-1 text-sm text-mute">Sistema Central de Gestión Operativa</p>
        </div>
        <h2 className="mb-3 text-sm font-semibold text-mute">Elige un perfil de demostración</h2>
        {error && <Alert className="mb-3">{error.message}</Alert>}
        {!users && !error && <Spinner label="Cargando perfiles…" />}
        <ul className="flex flex-col gap-2">
          {users?.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => pick(u.id)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left transition-colors hover:border-accent disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/80 text-sm font-bold text-white">{initials(u.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-mute">{u.email}</span>
                </span>
                <Badge tone="ai">{busyId === u.id ? 'Entrando…' : u.roleLabel}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
