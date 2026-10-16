import { Camera, Laptop, Mic, Package, Projector, Router, Tablet } from 'lucide-react';

// Icono según la categoría del equipo (búsqueda por palabra clave)
export default function categoryIcon(cat = '') {
  const c = cat.toLowerCase();
  if (/port|lap|comput|pc/.test(c)) return Laptop;
  if (/proy|video/.test(c)) return Projector;
  if (/c[aá]m|foto/.test(c)) return Camera;
  if (/tab/.test(c)) return Tablet;
  if (/mic|audio|son/.test(c)) return Mic;
  if (/red|rout|switch/.test(c)) return Router;
  return Package;
}
