export default function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {Icon && <Icon className="h-8 w-8 text-mute" aria-hidden="true" />}
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-mute">{children}</p>}
    </div>
  );
}
