// Logotipo de Campuslands.
// /campuslands-logo.svg (web/public) es un logotipo tipográfico PROVISIONAL: se reemplaza por el
// archivo oficial de Campuslands conservando el mismo nombre; este componente no necesita cambios.
export default function Logo({ className = 'h-6' }) {
  return <img src="/campuslands-logo.svg" alt="Campuslands" className={`block w-auto select-none ${className}`} draggable="false" />;
}
