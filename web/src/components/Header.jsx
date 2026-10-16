import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { initials } from '../util.js';
import Logo from './Logo.jsx';
import NotificationsBell from './NotificationsBell.jsx';

export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Clic fuera y Escape cierran el menú de usuario
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (ev) => ref.current && !ref.current.contains(ev.target) && setOpen(false);
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-panel px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenu} aria-label="Abrir menú" className="rounded-lg p-2 text-mute hover:bg-white/10 hover:text-ink active:bg-white/15 md:hidden">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link to="/" aria-label="CampusControl: ir al panel" className="flex min-w-0 items-center gap-3 rounded-lg">
          <Logo className="h-5 sm:h-6" />
          <span aria-hidden="true" className="hidden h-7 w-px bg-line sm:block" />
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block text-sm font-bold">Campus<span className="text-accent-soft">Control</span></span>
            <span className="hidden truncate text-[11px] text-mute lg:block">Sistema Central de Gestión Operativa</span>
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationsBell />
        <div ref={ref} className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Menú de usuario"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white hover:bg-[#5b4ae8] active:bg-[#4f3fd6]"
          >
            {initials(user?.name)}
          </button>
          {open && (
            <div role="menu" className="popin absolute right-0 mt-2 w-64 rounded-xl border border-line bg-card p-3 shadow-2xl">
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-mute">{user?.email}</p>
              <p className="text-xs text-mute">{user?.roleLabel}</p>
              <button type="button" role="menuitem" onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-lg bg-btn px-3 py-2 text-sm hover:bg-[#5d5f69] active:bg-[#686a75]">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
