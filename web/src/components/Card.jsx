export default function Card({ title, action, children, className = '', accent = false, as: Tag = 'section' }) {
  return (
    <Tag className={`rounded-xl border bg-card p-5 ${accent ? 'border-accent' : 'border-line'} ${className}`}>
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
