import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const SIZES = { md: 'max-w-md', lg: 'max-w-2xl' };

// variant "drawer": panel lateral derecho; "center": diálogo centrado (size: "md" | "lg")
export default function Modal({ open, onClose, title, children, variant = 'center', size = 'md' }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (ev) => ev.code === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Foco: entra al diálogo al abrir y vuelve al elemento que lo abrió al cerrar
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const dlg = dialogRef.current;
    if (dlg && !dlg.contains(document.activeElement)) dlg.focus();
    return () => { if (previous instanceof HTMLElement && document.contains(previous)) previous.focus(); };
  }, [open]);

  if (!open) return null;

  const box = variant === 'drawer'
    ? 'slidein ml-auto h-full w-full max-w-md overflow-y-auto border-l'
    : `popin m-auto max-h-full w-full ${SIZES[size] || SIZES.md} overflow-y-auto rounded-xl border`;
  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${box} border-line bg-card p-5 shadow-2xl outline-none`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-mute hover:bg-white/10 hover:text-ink active:bg-white/15">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
