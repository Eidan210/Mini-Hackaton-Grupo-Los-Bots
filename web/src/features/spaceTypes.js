import { Building2, DoorClosed, FlaskConical, GraduationCap, Presentation } from 'lucide-react';
import { label as humanize } from '../util.js';

// Color + ícono + etiqueta por tipo de espacio. El color nunca va solo: siempre se acompaña de ícono y texto.
// Paleta pensada para fondo oscuro y distinta de los colores de estado (verde / rojo / naranja).
export const SPACE_TYPES = {
  aula: { label: 'Aula', plural: 'Aulas', color: '#5B8DEF', Icon: GraduationCap },
  cubiculo: { label: 'Cubículo', plural: 'Cubículos', color: '#2BB3A3', Icon: DoorClosed },
  laboratorio: { label: 'Laboratorio', plural: 'Laboratorios', color: '#D9A441', Icon: FlaskConical },
  auditorio: { label: 'Auditorio', plural: 'Auditorios', color: '#D46BA3', Icon: Presentation },
};

export const SPACE_TYPE_KEYS = Object.keys(SPACE_TYPES);

const FALLBACK = { color: '#a1a7b0', Icon: Building2 };

export function spaceType(type) {
  return SPACE_TYPES[type] || { ...FALLBACK, label: humanize(type) || 'Otro', plural: humanize(type) || 'Otros' };
}

// '#RRGGBB' + opacidad 0..1 -> '#RRGGBBAA'
export function withAlpha(hex, alpha) {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}
