import { Sparkles } from 'lucide-react';
import { Badge } from './Badge.jsx';

// Contenedor visual de todo lo que viene de la IA (borde violeta + icono Sparkles)
export default function AiPanel({ title = 'Asistente IA', badge, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-accent bg-card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" /> {title}
        </h2>
        {badge && <Badge tone="ai">{badge}</Badge>}
      </div>
      {children}
    </section>
  );
}
