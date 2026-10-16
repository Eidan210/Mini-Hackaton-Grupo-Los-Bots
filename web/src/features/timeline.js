import { hhmmToMin } from '../util.js';

// Eje horizontal de la línea de tiempo de espacios: 07:00 a 21:00
export const START = 7 * 60;
export const END = 21 * 60;
export const HOURS = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START / 60 + i);
export const SLOTS = HOURS.length - 1;

export const pct = (min) => `${Math.min(100, Math.max(0, ((min - START) / (END - START)) * 100))}%`;
export const bookingStyle = (b) => ({
  left: pct(hhmmToMin(b.start_time)),
  width: `calc(${pct(hhmmToMin(b.end_time))} - ${pct(hhmmToMin(b.start_time))})`,
});
