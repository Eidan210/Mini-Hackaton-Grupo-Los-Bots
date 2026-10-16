import { NavLink } from 'react-router-dom';
import { AlertTriangle, Database, LayoutDashboard, Laptop, Building2, ScrollText } from 'lucide-react';

const GROUPS = [
  [{ to: '/', label: 'Panel', icon: LayoutDashboard, end: true }],
  [{ to: '/espacios', label: 'Espacios', icon: Building2 }, { to: '/equipos', label: 'Equipos', icon: Laptop }],
  [{ to: '/incidencias', label: 'Incidencias', icon: AlertTriangle }],
  [{ to: '/datos', label: 'Datos importados', icon: Database }, { to: '/reglas', label: 'Reglas activas', icon: ScrollText }],
];

export default function Sidebar({ onNavigate }) {
  return (
    <nav aria-label="Principal" className="flex h-full flex-col overflow-y-auto p-3">
      {GROUPS.map((g, i) => (
        <ul key={i} className={`flex flex-col gap-1 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
          {g.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-accent text-white' : 'text-mute hover:bg-white/5 hover:text-ink'
                  }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" /> {label}
              </NavLink>
            </li>
          ))}
        </ul>
      ))}
    </nav>
  );
}
