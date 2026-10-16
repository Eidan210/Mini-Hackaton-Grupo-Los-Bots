// `interactive` añade una leve elevación al pasar el mouse (útil para tarjetas de listado)
export default function Card({ title, action, children, className = '', accent = false, interactive = false, as: Tag = 'section' }) {
  const lift = interactive ? 'transition duration-150 hover:-translate-y-0.5 hover:shadow-card-hover' : '';
  return (
    <Tag className={`rounded-xl border bg-card p-5 shadow-card ${accent ? 'border-accent' : 'border-line'} ${lift} ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}
