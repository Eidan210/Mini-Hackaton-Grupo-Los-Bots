import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import DynamicBackground from '../components/DynamicBackground.jsx';
import { Input } from '../components/Field.jsx';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const MIN_PASSWORD = 8;

// Validación solo como ayuda: el servidor es quien decide
function validate({ name, email, password, confirm }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Escribe tu nombre.';
  if (!email.trim()) errors.email = 'Escribe tu correo electrónico.';
  if (password.length < MIN_PASSWORD) errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (confirm !== password) errors.confirm = 'Las contraseñas no coinciden.';
  return errors;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const errors = submitted ? validate(form) : {};

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setError(null);
    if (Object.keys(validate(form)).length > 0) return;
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
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
            <h1 className="mt-5 text-2xl font-bold">Crear cuenta</h1>
            <p className="mt-1 text-sm text-mute">Te registras como Camper en CampusControl.</p>
          </div>

          <form onSubmit={submit} noValidate className="space-y-4">
            <Input
              label="Nombre completo"
              name="name"
              autoComplete="name"
              required
              autoFocus
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />
            <Input
              label="Correo electrónico"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              placeholder="tucorreo@ejemplo.com"
            />
            <PasswordInput
              label="Contraseña"
              name="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
            />
            <PasswordInput
              label="Confirmar contraseña"
              name="confirm"
              autoComplete="new-password"
              required
              value={form.confirm}
              onChange={set('confirm')}
              error={errors.confirm}
            />
            {error && <Alert title="No se pudo crear la cuenta">{error.message}</Alert>}
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              {!busy && <UserPlus className="h-4 w-4" aria-hidden="true" />} {busy ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-mute">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-accent-soft underline-offset-2 hover:underline">Inicia sesión</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
