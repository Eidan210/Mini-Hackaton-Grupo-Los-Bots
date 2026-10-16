import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle, Brain, Building2, LayoutDashboard, Laptop, LogOut, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { storage } from '../api.js';
import { initials } from '../util.js';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import DynamicBackground from './DynamicBackground.jsx';
import Logo from './Logo.jsx';

const COLLAPSE_KEY = 'cc_sidebar_collapsed';

// Barra inferior en el celular: las 4 secciones más usadas + "Más" (abre el cajón con el resto)
const BOTTOM_NAV = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/espacios', label: 'Espacios', icon: Building2 },
  { to: '/equipos', label: 'Equipos', icon: Laptop },
  { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle },
];

function MobileDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // evita que el fondo se desplace con el cajón abierto
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
      <button type="button" aria-label="Cerrar menú" className="drawer-fade absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-line bg-panel shadow-2xl outline-none"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <Logo className="h-5" />
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="rounded-lg p-2 text-mute hover:bg-white/10 hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar onNavigate={onClose} />
        </div>
        <div className="shrink-0 border-t border-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{initials(user?.name)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-mute">{user?.roleLabel}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-btn px-3 py-2.5 text-sm hover:bg-[#5d5f69] active:bg-[#686a75]">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      </aside>
    </div>
  );
}

function BottomNav({ onMore }) {
  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-accent-soft' : 'text-mute hover:text-ink'}`}
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-accent/25' : ''}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMore} className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-mute hover:text-ink">
            <span className="flex h-7 w-12 items-center justify-center rounded-full"><MoreHorizontal className="h-5 w-5" aria-hidden="true" /></span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default function Layout() {
  const { can } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSE_KEY) === '1');
  const { pathname } = useLocation();
  useEffect(() => { setDrawer(false); }, [pathname]);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    storage.set(COLLAPSE_KEY, next ? '1' : '0'); // storage ya envuelve localStorage en try/catch
    setCollapsed(next);
  }, [collapsed]);

  // El botón flotante solo aparece si el rol puede reportar o consultar con IA
  const canAi = can('reportar_incidencia') || can('consultar_ia_incidencias');
  const aiLabel = can('reportar_incidencia') ? 'Reportar con IA' : 'Consultar con IA';

  return (
    <div className="relative isolate min-h-full">
      <DynamicBackground />
      <Header onMenu={() => setDrawer(true)} />
      <aside
        className={`fixed bottom-0 left-0 top-16 z-20 hidden border-r border-line bg-panel transition-[width] duration-200 md:block ${collapsed ? 'w-16' : 'w-64'}`}
      >
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>
      <MobileDrawer open={drawer} onClose={closeDrawer} />
      <main className={`relative min-h-screen overflow-x-hidden px-3 pb-28 pt-20 transition-[padding] duration-200 sm:px-4 md:pb-24 md:pr-8 md:pt-24 ${collapsed ? 'md:pl-24' : 'md:pl-72'}`}>
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
      {canAi && pathname !== '/incidencias' && (
        <Link
          to="/incidencias"
          aria-label={aiLabel}
          title={aiLabel}
          className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/40 transition hover:-translate-y-0.5 hover:bg-[#5b4ae8] active:translate-y-0 md:bottom-5 md:right-5 md:h-14 md:w-14"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Brain className="h-6 w-6" aria-hidden="true" />
        </Link>
      )}
      <BottomNav onMore={() => setDrawer(true)} />
    </div>
  );
}
