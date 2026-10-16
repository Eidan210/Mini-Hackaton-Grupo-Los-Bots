import { AirVent, Camera, Laptop, Mic, Monitor, Package, Projector, Refrigerator, Router, Tablet, Tv } from 'lucide-react';

// Icono según la categoría del equipo (búsqueda por palabra clave)
export default function categoryIcon(cat = '') {
  const c = cat.toLowerCase();
  if (/port|lap/.test(c)) return Laptop;
  if (/comput|pc/.test(c)) return Monitor;
  if (/aire/.test(c)) return AirVent;
  if (/^tv|telev/.test(c)) return Tv;
  if (/electro|nevera|micro/.test(c)) return Refrigerator;
  if (/proy|video/.test(c)) return Projector;
  if (/c[aá]m|foto/.test(c)) return Camera;
  if (/tab/.test(c)) return Tablet;
  if (/mic|audio|son/.test(c)) return Mic;
  if (/red|rout|switch/.test(c)) return Router;
  return Package;
}
