import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

const TONES = {
  error: ['border-bad/50 bg-bad/10 text-[#ff8a8d]', XCircle],
  success: ['border-ok/50 bg-ok/10 text-[#5fd68c]', CheckCircle2],
  warning: ['border-warn/50 bg-warn/10 text-warn', AlertTriangle],
  info: ['border-info/50 bg-info/10 text-[#7fb0ff]', Info],
};

export default function Alert({ tone = 'error', title, children, className = '' }) {
  const [cls, Icon] = TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border p-3 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink/90">{children}</div>}
      </div>
    </div>
  );
}

// Alert de error de API: muestra la regla de negocio (R1..R7) si existe
export function ApiAlert({ error, className }) {
  if (!error) return null;
  return (
    <Alert tone="error" className={className} title={error.rule ? `Regla ${error.rule} incumplida` : 'No se pudo completar la acción'}>
      {error.message}
    </Alert>
  );
}
