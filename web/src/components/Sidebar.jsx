import { NavLink } from 'react-router-dom';
import {
  AlertTriangle, Building2, ChevronsLeft, ChevronsRight, Database, LayoutDashboard, Laptop, ScrollText, Users,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';

// `perm`: permiso necesario para ver la entrada (sin `perm` = visible para todos)
const GROUPS = [
  [{ to: '/', label: 'Panel', icon: LayoutDashboard, end: true }],
  [{ to: '/espacios', label: 'Espacios', icon: Building2 }, { to: '/equipos', label: 'Equipos', icon: Laptop }],
  [{ to: '/incidencias', label: 'Incidencias', icon: AlertTriangle }],
  [
    { to: '/datos', label: 'Datos importados', icon: Database, perm: 'ver_datos_importados' },
    { to: '/reglas', label: 'Reglas activas', icon: ScrollText, perm: 'ver_reglas' },
    { to: '/usuarios', label: 'Usuarios', icon: Users, perm: 'gestionar_usuarios' },
  ],
];

// `collapsed`: modo solo íconos (≈64px). `onToggle`: si se pasa, muestra el botón de plegar.
export default function Sidebar({ onNavigate, collapsed = false, onToggle }) {
  const { can } = useAuth();
  const groups = GROUPS
    .map((g) => g.filter((item) => !item.perm || can(item.perm)))
    .filter((g) => g.length > 0);

  return (
    <nav aria-label="Principal" className="flex h-full flex-col overflow-x-hidden overflow-y-auto p-3">
      {groups.map((g, i) => (
        <ul key={g[0].to} className={`flex flex-col gap-1 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
          {g.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${
                    collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${isActive ? 'bg-accent text-white' : 'text-mute hover:bg-white/10 hover:text-ink active:bg-white/15'}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      ))}
      {onToggle && (
        <div className="mt-auto border-t border-line pt-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-mute transition-colors duration-150 hover:bg-white/10 hover:text-ink active:bg-white/15 ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            }`}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" aria-hidden="true" /> : <ChevronsLeft className="h-5 w-5" aria-hidden="true" />}
            {!collapsed && <span>Contraer menú</span>}
          </button>
        </div>
      )}
    </nav>
  );
}
