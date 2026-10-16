import { Field } from '../components/Field.jsx';

// Textarea de altura fija (sin redimensionar), con la misma apariencia que el resto de campos.
export default function FixedTextarea({ label, hint, className = '', rows = 4, ...rest }) {
  return (
    <Field label={label} hint={hint}>
      {(id, base) => <textarea id={id} rows={rows} className={`${base} resize-none ${className}`} {...rest} />}
    </Field>
  );
}
