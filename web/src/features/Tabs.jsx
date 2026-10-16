import { useRef } from 'react';

// Pestañas accesibles (patrón WAI-ARIA: flechas, Inicio y Fin cambian de pestaña).
// tabs: [{ id, label, count?, countLabel?, countTone? }]; el contenido de cada panel lo pinta el padre con panelProps().
export default function Tabs({ tabs, value, onChange, idBase, ariaLabel }) {
  const refs = useRef({});

  function onKeyDown(e) {
    const i = tabs.findIndex((t) => t.id === value);
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={active}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium ${active ? 'border-accent text-ink' : 'border-transparent text-mute hover:text-ink'}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`min-w-[1.5rem] rounded-full px-2 py-0.5 text-center text-xs font-semibold ${t.count > 0 && t.countTone === 'warn' ? 'bg-warn/20 text-warn' : 'bg-btn text-ink'}`}>
                {t.count}
                <span className="sr-only"> {t.countLabel || 'elementos'}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const panelProps = (idBase, id) => ({
  role: 'tabpanel',
  id: `${idBase}-panel-${id}`,
  'aria-labelledby': `${idBase}-tab-${id}`,
  tabIndex: 0,
});
