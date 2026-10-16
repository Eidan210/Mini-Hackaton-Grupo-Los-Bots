import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogIn, Sparkles } from 'lucide-react';
import { apiFetch } from '../api.js';
import { useAuth } from '../auth.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import DynamicBackground from '../components/DynamicBackground.jsx';
import { Input } from '../components/Field.jsx';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Spinner from '../components/Spinner.jsx';
import { Badge } from '../components/Badge.jsx';
import { initials } from '../util.js';

// Acceso rápido de demostración: solo existe si GET /auth/config devuelve demoLogin: true
function DemoAccess() {
  const { loginDemo } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function onToggle(e) {
    if (e.currentTarget.open && !users && !loadError) {
      apiFetch('/auth/users').then(setUsers).catch(setLoadError);
    }
  }

  async function pick(id) {
    setBusyId(id);
    setError(null);
    try {
      await loginDemo(id);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      setBusyId(null);
    }
  }

  return (
    <details onToggle={onToggle} className="group mt-6 rounded-xl border border-line bg-panel/70">
      <summary className="flex list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm text-mute hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" aria-hidden="true" /> Acceso rápido de demostración</span>
        <ChevronDown className="h-4 w-4 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-line px-3 pb-3 pt-3">
        <p className="mb-2 px-1 text-xs text-mute">Perfiles de prueba para recorrer la aplicación sin contraseña.</p>
        {error && <Alert className="mb-2">{error.message}</Alert>}
        {loadError && <Alert className="mb-2">{loadError.message}</Alert>}
        {!users && !loadError && <Spinner label="Cargando perfiles…" className="py-4" />}
        <ul className="flex flex-col gap-2">
          {users?.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => pick(u.id)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-lg border border-line bg-card p-2.5 text-left hover:border-accent hover:bg-card-2 disabled:opacity-60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">{initials(u.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-mute">{u.email}</span>
                </span>
                <Badge tone="ai">{busyId === u.id ? 'Entrando…' : u.roleLabel}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch('/auth/config')
      .then((c) => alive && setDemo(c?.demoLogin === true))
      .catch(() => alive && setDemo(false));
    return () => { alive = false; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="login-bg relative isolate min-h-screen">
      <DynamicBackground variant="login" />
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-card/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo className="h-8" />
            <h1 className="mt-5 text-2xl font-bold">Campus<span className="text-accent-soft">Control</span></h1>
            <p className="mt-1 text-sm text-mute">Sistema Central de Gestión Operativa</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              name="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
            <PasswordInput
              label="Contraseña"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Alert title="No se pudo iniciar sesión">{error.message}</Alert>}
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              {!busy && <LogIn className="h-4 w-4" aria-hidden="true" />} {busy ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-mute">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-accent-soft underline-offset-2 hover:underline">Regístrate</Link>
          </p>

          {demo && <DemoAccess />}
        </div>
      </main>
    </div>
  );
}
