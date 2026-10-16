import { useEffect } from 'react';
import { X } from 'lucide-react';

// variant "drawer": panel lateral derecho; "center": diálogo centrado
export default function Modal({ open, onClose, title, children, variant = 'center' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (ev) => ev.code === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
  if (!open) return null;

  const box = variant === 'drawer'
    ? 'slidein ml-auto h-full w-full max-w-md overflow-y-auto border-l'
    : 'm-auto w-full max-w-md rounded-xl border';
  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`${box} border-line bg-panel p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-mute hover:bg-white/10 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
