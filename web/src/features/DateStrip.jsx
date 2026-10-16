import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayStr } from '../util.js';
import { parseDay } from './format.js';

const p2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const addDays = (value, n) => {
  const d = parseDay(value) || new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

// Semana (lunes a domingo) que contiene la fecha dada
function weekOf(value) {
  const d = parseDay(value) || new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

// Selector de fecha tipo calendario: semana navegable + "Hoy" + selector nativo para saltar a cualquier fecha
export default function DateStrip({ value, onChange }) {
  const today = todayStr();
  const days = weekOf(value);
  const monthRaw = (parseDay(value) || new Date()).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);

  return (
    <section aria-label="Calendario" className="mb-4 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{month}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange(today)} disabled={value === today}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent-soft hover:bg-white/10 disabled:opacity-40">
            Hoy
          </button>
          <label className="relative flex cursor-pointer items-center rounded-lg p-1.5 text-mute hover:bg-white/10 hover:text-ink" title="Elegir otra fecha">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Elegir otra fecha</span>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value || today)}
              className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(addDays(value, -7))} aria-label="Semana anterior"
          className="shrink-0 rounded-lg p-1.5 text-mute hover:bg-white/10 hover:text-ink">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <ol className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {days.map((d) => {
            const key = ymd(d);
            const selected = key === value;
            const isToday = key === today;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onChange(key)}
                  aria-pressed={selected}
                  aria-label={d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                  className={`flex w-full flex-col items-center rounded-lg py-1.5 transition-colors ${
                    selected ? 'bg-accent text-white' : 'text-ink hover:bg-white/10'}`}
                >
                  <span className={`text-[10px] uppercase ${selected ? 'text-white/80' : 'text-mute'}`}>
                    {d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-sm font-semibold">{d.getDate()}</span>
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${isToday ? (selected ? 'bg-white' : 'bg-accent-soft') : 'bg-transparent'}`} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={() => onChange(addDays(value, 7))} aria-label="Semana siguiente"
          className="shrink-0 rounded-lg p-1.5 text-mute hover:bg-white/10 hover:text-ink">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
