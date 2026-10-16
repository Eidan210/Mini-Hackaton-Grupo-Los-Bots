import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { apiFetch } from '../api.js';
import { initials } from '../util.js';

export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(null);
  const ref = useRef(null);

  // El contador de la campana se refresca en cada navegación
  useEffect(() => {
    let alive = true;
    apiFetch('/dashboard').then((d) => alive && setOpenCount(d.kpis.incidentsOpen)).catch(() => alive && setOpenCount(null));
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-panel px-4">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} aria-label="Abrir menú" className="rounded-lg p-2 text-mute hover:bg-white/10 md:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-base font-bold leading-tight">Campus<span className="text-accent">Control</span></p>
          <p className="hidden text-xs text-mute sm:block">Sistema Central de Gestión Operativa</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/incidencias" aria-label={`Incidencias abiertas: ${openCount ?? 0}`} className="relative rounded-lg p-2 text-mute hover:bg-white/10 hover:text-ink">
          <Bell className="h-5 w-5" />
          {openCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{openCount}</span>
          )}
        </Link>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Menú de usuario"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white"
          >
            {initials(user?.name)}
          </button>
          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-card p-3 shadow-xl">
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs text-mute">{user?.roleLabel}</p>
              <button role="menuitem" onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-lg bg-btn px-3 py-2 text-sm hover:bg-[#5a5c65]">
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
