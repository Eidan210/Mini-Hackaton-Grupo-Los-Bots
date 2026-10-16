import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle, Bell, CalendarCheck, CheckCheck, FileUp, Laptop, MessageSquare, Repeat, ShieldBan, Wrench,
} from 'lucide-react';
import { apiFetch } from '../api.js';
import { timeAgo } from '../util.js';
import Spinner from './Spinner.jsx';

const REFRESH_MS = 60_000;

// El contrato no enumera los tipos de notificación: se reconocen por palabra clave y el resto usa la campana
const TYPE_ICONS = [
  ['incidencia', AlertTriangle], ['reserva', CalendarCheck], ['prestamo', Laptop], ['devolucion', Repeat],
  ['bloqueo', ShieldBan], ['estado', Wrench], ['importacion', FileUp], ['nota', MessageSquare], ['consulta', MessageSquare],
];
const iconFor = (type = '') => {
  const t = String(type).toLowerCase();
  return (TYPE_ICONS.find(([k]) => t.includes(k)) || [null, Bell])[1];
};

// Campana con menú desplegable: no navega; cada "Ver" lleva al enlace solo si la persona lo pulsa
export default function NotificationsBell() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null); // { unread, items }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [marking, setMarking] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const seq = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    const n = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch('/notifications');
      if (n !== seq.current) return;
      setData({ unread: Number(res?.unread) || 0, items: Array.isArray(res?.items) ? res.items : [] });
      setError(null);
    } catch (err) {
      if (n === seq.current) setError(err);
    } finally {
      if (n === seq.current && !silent) setLoading(false);
    }
  }, []);

  // Carga inicial + refresco cada 60 s (silencioso: no parpadea el menú)
  useEffect(() => {
    load({ silent: true });
    const t = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Refresca al abrir (con spinner solo la primera vez)
  useEffect(() => {
    if (open) load({ silent: data !== null });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Se cierra al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // Clic fuera y Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (ev) => wrapRef.current && !wrapRef.current.contains(ev.target) && setOpen(false);
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

  async function markAll() {
    setMarking(true);
    setError(null);
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      setData((d) => d && { unread: 0, items: d.items.map((i) => ({ ...i, read: true })) });
      load({ silent: true });
    } catch (err) {
      setError(err);
    } finally {
      setMarking(false);
    }
  }

  // Flechas arriba/abajo recorren los elementos del menú
  function onMenuKeyDown(ev) {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const items = [...ev.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (!items.length) return;
    ev.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next = ev.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  }

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        className="relative rounded-lg p-2 text-mute hover:bg-white/10 hover:text-ink active:bg-white/15"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d6303a] px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notificaciones"
          onKeyDown={onMenuKeyDown}
          className="popin fixed inset-x-3 top-[4.25rem] z-40 overflow-hidden rounded-xl border border-line bg-card shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notificaciones</p>
            <button
              type="button"
              role="menuitem"
              onClick={markAll}
              disabled={marking || unread === 0}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent-soft hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Marcar todas como leídas
            </button>
          </div>

          <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
            {loading && !data && <Spinner label="Cargando…" className="py-8" />}
            {error && (
              <p role="alert" className="px-4 py-3 text-sm text-[#ff8a8d]">{error.message}</p>
            )}
            {data && !items.length && !error && (
              <p className="px-4 py-8 text-center text-sm text-mute">No tienes notificaciones.</p>
            )}
            {items.length > 0 && (
              <ul role="none" className="divide-y divide-line">
                {items.map((n) => {
                  const Icon = iconFor(n.type);
                  return (
                    <li key={n.id} role="none" className={`flex items-start gap-3 px-4 py-3 ${n.read ? '' : 'bg-accent/10'}`}>
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel text-mute">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent-soft align-middle" aria-hidden="true" />}
                          {!n.read && <span className="sr-only">Sin leer: </span>}
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-xs text-mute">{timeAgo(n.created_at)}</p>
                      </div>
                      {n.link && (
                        <Link
                          to={n.link}
                          role="menuitem"
                          onClick={() => setOpen(false)}
                          aria-label={`Ver: ${n.message}`}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent-soft hover:bg-white/10"
                        >
                          Ver
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
