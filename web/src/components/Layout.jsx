import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Brain } from 'lucide-react';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

export default function Layout() {
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setDrawer(false); }, [pathname]);

  return (
    <div className="min-h-full">
      <Header onMenu={() => setDrawer(true)} />
      <aside className="fixed bottom-0 left-0 top-16 z-20 hidden w-64 border-r border-line bg-panel md:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" onMouseDown={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute bottom-0 left-0 top-0 w-64 border-r border-line bg-panel pt-16" onMouseDown={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <main className="min-h-screen overflow-x-hidden px-4 pb-24 pt-24 md:pl-72 md:pr-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
      <Link
        to="/incidencias"
        aria-label="Reportar con IA"
        title="Reportar con IA"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/40 hover:bg-[#7b6dff]"
      >
        <Brain className="h-6 w-6" />
      </Link>
    </div>
  );
}
