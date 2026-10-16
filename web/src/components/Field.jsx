import { useId } from 'react';

const common = 'w-full rounded-lg border bg-panel px-3 py-2 text-sm text-ink placeholder:text-mute/70 transition-colors disabled:cursor-not-allowed';
export const fieldClass = `${common} border-line hover:border-[#6b6e78] focus:border-accent`;
const invalidClass = `${common} border-bad focus:border-bad`;

// `children(id, className, aria)`: los consumidores antiguos usan solo (id, className);
// `aria` añade aria-describedby / aria-invalid cuando hay pista o error.
export function Field({ label, children, hint, error }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const aria = {
    'aria-describedby': [errId, hintId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : undefined,
  };
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-mute">{label}</label>
      {children(id, error ? invalidClass : fieldClass, aria)}
      {error && <p id={errId} className="mt-1 text-xs text-[#ff8a8d]">{error}</p>}
      {hint && <p id={hintId} className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export const Input = ({ label, hint, error, className = '', ...p }) => (
  <Field label={label} hint={hint} error={error}>
    {(id, cls, aria) => <input id={id} className={`${cls} ${className}`} {...aria} {...p} />}
  </Field>
);

export const Select = ({ label, hint, error, children, className = '', ...p }) => (
  <Field label={label} hint={hint} error={error}>
    {(id, cls, aria) => <select id={id} className={`${cls} ${className}`} {...aria} {...p}>{children}</select>}
  </Field>
);

// Altura fija (rows / min-h) y scroll interno; el CSS global ya fija resize: none
export const Textarea = ({ label, hint, error, className = '', ...p }) => (
  <Field label={label} hint={hint} error={error}>
    {(id, cls, aria) => <textarea id={id} className={`${cls} resize-none overflow-y-auto ${className}`} {...aria} {...p} />}
  </Field>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
    </div>
    {children}
  </div>
);
