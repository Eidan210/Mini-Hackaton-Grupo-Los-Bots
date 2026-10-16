import { useId } from 'react';

const base = 'w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-mute/70 focus:border-accent';

export function Field({ label, children, hint }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-mute">{label}</label>
      {children(id, base)}
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export const Input = ({ label, hint, ...p }) => (
  <Field label={label} hint={hint}>{(id, cls) => <input id={id} className={cls} {...p} />}</Field>
);

export const Select = ({ label, hint, children, ...p }) => (
  <Field label={label} hint={hint}>{(id, cls) => <select id={id} className={cls} {...p}>{children}</select>}</Field>
);

export const Textarea = ({ label, hint, ...p }) => (
  <Field label={label} hint={hint}>{(id, cls) => <textarea id={id} className={`${cls} resize-y`} {...p} />}</Field>
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
