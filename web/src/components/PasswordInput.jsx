import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field } from './Field.jsx';

// Campo de contraseña con botón para mostrar/ocultar
export default function PasswordInput({ label, hint, error, className = '', ...p }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, cls, aria) => (
        <div className="relative">
          <input id={id} className={`${cls} pr-11 ${className}`} type={show ? 'text' : 'password'} {...aria} {...p} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label="Mostrar contraseña"
            aria-pressed={show}
            title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-mute hover:text-ink"
          >
            {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
}
