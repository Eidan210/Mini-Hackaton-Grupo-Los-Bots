import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { storage } from '../api.js';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import DynamicBackground from './DynamicBackground.jsx';

const COLLAPSE_KEY = 'cc_sidebar_collapsed';

export default function Layout() {
  const { can } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSE_KEY) === '1');
  const { pathname } = useLocation();
  useEffect(() => { setDrawer(false); }, [pathname]);

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
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" onMouseDown={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute bottom-0 left-0 top-0 w-64 border-r border-line bg-panel pt-16" onMouseDown={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <main className={`min-h-screen overflow-x-hidden px-4 pb-24 pt-24 transition-[padding] duration-200 md:pr-8 ${collapsed ? 'md:pl-24' : 'md:pl-72'}`}>
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
      {canAi && (
        <Link
          to="/incidencias"
          aria-label={aiLabel}
          title={aiLabel}
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/40 transition hover:-translate-y-0.5 hover:bg-[#5b4ae8] active:translate-y-0"
        >
          <Brain className="h-6 w-6" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
