// ============================================================================
//  REGLAS DE NEGOCIO CENTRALIZADAS — CampusControl
//  Todo lo que el jurado puede pedir cambiar en vivo está en este archivo:
//  1) cambia un valor en CONFIG o PERMISOS, 2) guarda, 3) el servidor se recarga.
//  Las funciones son puras (sin base de datos) para poder probarlas con node --test.
// ============================================================================

export const CONFIG = {
  horario: { apertura: '07:00', cierre: '21:00' }, // R5: franja en la que se puede reservar
  reservas: { maxHoras: 4 },                      // R5: duración máxima de una reserva
  prestamos: { maxActivosPorUsuario: 2, maxHoras: 24 }, // R4 y R5
  incidencias: { prioridadesQueBloquean: ['Alta', 'Crítica'] }, // R6
  camper: { tiposPermitidos: ['cubiculo'] },      // R7: qué espacios puede reservar un camper
};

export const PERMISOS = {
  admin: ['reservar', 'prestar', 'reportar_incidencia', 'gestionar_incidencias', 'cambiar_estado_recurso', 'importar_datos'],
  coordinador: ['reservar', 'prestar', 'reportar_incidencia', 'gestionar_incidencias', 'cambiar_estado_recurso', 'importar_datos'],
  tecnico: ['reportar_incidencia', 'gestionar_incidencias', 'cambiar_estado_recurso'],
  trainer: ['reservar', 'prestar', 'reportar_incidencia'],
  camper: ['reservar', 'prestar', 'reportar_incidencia'],
};

export const ROLES = {
  admin: 'Administrador',
  coordinador: 'Coordinador académico',
  tecnico: 'Técnico de soporte',
  trainer: 'Trainer',
  camper: 'Camper',
};

export const CATALOGOS = {
  categorias: ['Hardware', 'Redes / Conectividad', 'Eléctrica', 'Climatización', 'Infraestructura / Mobiliario', 'Audiovisual', 'Software', 'Seguridad', 'Otro'],
  prioridades: ['Baja', 'Media', 'Alta', 'Crítica'],
  areas: ['Soporte TI', 'Mantenimiento', 'Servicios Generales', 'Coordinación Académica', 'Seguridad'],
};

export const REGLAS = [
  { id: 'R1', nombre: 'Sin solapamientos', descripcion: 'Un espacio no puede tener dos reservas confirmadas que se crucen en la misma fecha.', valor: 'inicio < finExistente && fin > inicioExistente' },
  { id: 'R2', nombre: 'Aforo máximo', descripcion: 'Los asistentes de una reserva no pueden superar la capacidad del espacio.', valor: 'asistentes <= capacidad' },
  { id: 'R3', nombre: 'Recursos inhabilitados', descripcion: 'No se reservan espacios bloqueados o en mantenimiento ni se prestan equipos prestados, en revisión o dañados.', valor: 'espacio = disponible · equipo = disponible' },
  { id: 'R4', nombre: 'Límite de préstamos', descripcion: 'Un usuario no puede superar el máximo de préstamos activos ni pedir otro si tiene uno vencido.', valor: `máx ${CONFIG.prestamos.maxActivosPorUsuario} activos, 0 vencidos` },
  { id: 'R5', nombre: 'Horario y duración', descripcion: 'Las reservas van dentro del horario del campus, no en el pasado y con duración máxima; los préstamos tienen horas máximas.', valor: `${CONFIG.horario.apertura}–${CONFIG.horario.cierre}, reserva ≤ ${CONFIG.reservas.maxHoras} h, préstamo ≤ ${CONFIG.prestamos.maxHoras} h` },
  { id: 'R6', nombre: 'Bloqueo por incidencia', descripcion: 'Una incidencia de prioridad alta bloquea el espacio y manda el equipo a revisión; al resolverse se liberan.', valor: CONFIG.incidencias.prioridadesQueBloquean.join(', ') },
  { id: 'R7', nombre: 'Reservas de campers', descripcion: 'Los campers solo pueden reservar los tipos de espacio permitidos.', valor: CONFIG.camper.tiposPermitidos.join(', ') },
];

// ---------------------------------------------------------------------------

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
const violation = (rule, code, message, details) => ({ rule, code, message, details });
const ESTADOS_ESPACIO = { mantenimiento: 'en mantenimiento', bloqueado: 'bloqueado por una incidencia' };
const ESTADOS_EQUIPO = { prestado: 'prestado a otra persona', en_revision: 'en revisión técnica', danado: 'dañado' };

export const tienePermiso = (role, permiso) => (PERMISOS[role] || []).includes(permiso);

export const seCruzan = (a, b) =>
  toMin(a.start_time) < toMin(b.end_time) && toMin(a.end_time) > toMin(b.start_time);

/**
 * Valida una reserva. Devuelve null si es válida o la primera regla violada.
 * @param {object} p
 * @param {object} p.space       fila de spaces
 * @param {object} p.request     { date, startTime, endTime, attendees }
 * @param {object[]} p.bookings  reservas confirmadas de ese espacio en esa fecha
 * @param {object} p.user        { role }
 * @param {Date}   p.now
 */
export function validarReserva({ space, request, bookings, user, now = new Date() }) {
  const { date, startTime, endTime, attendees } = request;
  const ini = toMin(startTime);
  const fin = toMin(endTime);

  if (user.role === 'camper' && !CONFIG.camper.tiposPermitidos.includes(space.type)) {
    return violation('R7', 'REGLA_ROL_CAMPER', `Los campers solo pueden reservar: ${CONFIG.camper.tiposPermitidos.join(', ')}. "${space.name}" es de tipo ${space.type}.`);
  }
  if (space.status !== 'disponible') {
    return violation('R3', 'REGLA_RECURSO_INHABILITADO', `"${space.name}" está ${ESTADOS_ESPACIO[space.status] || space.status} y no admite reservas.`);
  }
  if (fin <= ini) {
    return violation('R5', 'REGLA_HORARIO', 'La hora de fin debe ser posterior a la de inicio.');
  }
  if (ini < toMin(CONFIG.horario.apertura) || fin > toMin(CONFIG.horario.cierre)) {
    return violation('R5', 'REGLA_HORARIO', `El campus solo admite reservas entre ${CONFIG.horario.apertura} y ${CONFIG.horario.cierre}.`);
  }
  if (fin - ini > CONFIG.reservas.maxHoras * 60) {
    return violation('R5', 'REGLA_DURACION', `Una reserva no puede durar más de ${CONFIG.reservas.maxHoras} horas.`);
  }
  const inicioReserva = new Date(`${date}T${startTime}:00`);
  if (inicioReserva < now) {
    return violation('R5', 'REGLA_PASADO', 'No se puede reservar en una fecha u hora que ya pasó.');
  }
  if (attendees > space.capacity) {
    return violation('R2', 'REGLA_AFORO', `El aforo solicitado (${attendees}) supera la capacidad de "${space.name}" (${space.capacity} personas).`);
  }
  const choque = bookings.find(
    (b) => b.status === 'confirmada' && seCruzan({ start_time: startTime, end_time: endTime }, b),
  );
  if (choque) {
    return violation('R1', 'REGLA_SOLAPAMIENTO', `"${space.name}" ya está reservado de ${choque.start_time} a ${choque.end_time} ("${choque.title}").`, { conflictoId: choque.id });
  }
  return null;
}

/**
 * Valida un préstamo. Devuelve null si es válido o la primera regla violada.
 * @param {object} p.equipment   fila de equipment
 * @param {number} p.hours
 * @param {object[]} p.prestamosActivos préstamos activos del usuario (con due_at)
 */
export function validarPrestamo({ equipment, hours, prestamosActivos, now = new Date() }) {
  if (equipment.status !== 'disponible') {
    return violation('R3', 'REGLA_RECURSO_INHABILITADO', `"${equipment.name}" (${equipment.code}) está ${ESTADOS_EQUIPO[equipment.status] || equipment.status} y no se puede prestar.`);
  }
  if (!(hours > 0) || hours > CONFIG.prestamos.maxHoras) {
    return violation('R5', 'REGLA_DURACION', `La duración del préstamo debe estar entre 1 y ${CONFIG.prestamos.maxHoras} horas.`);
  }
  const vencido = prestamosActivos.find((l) => new Date(l.due_at) < now);
  if (vencido) {
    return violation('R4', 'REGLA_PRESTAMO_VENCIDO', 'Tienes un préstamo vencido. Devuélvelo antes de pedir otro equipo.', { prestamoId: vencido.id });
  }
  if (prestamosActivos.length >= CONFIG.prestamos.maxActivosPorUsuario) {
    return violation('R4', 'REGLA_LIMITE_PRESTAMOS', `Ya tienes ${prestamosActivos.length} préstamos activos; el máximo es ${CONFIG.prestamos.maxActivosPorUsuario}.`);
  }
  return null;
}

/** R6: ¿esta prioridad bloquea el recurso afectado? */
export const prioridadBloquea = (priority) => CONFIG.incidencias.prioridadesQueBloquean.includes(priority);

/** R6: texto de la consecuencia operativa que se le muestra al usuario antes de confirmar. */
export function consecuenciaIncidencia({ priority, space, equipment }) {
  const efectos = [];
  if (prioridadBloquea(priority)) {
    if (space) efectos.push(`"${space.name}" quedará bloqueado y se rechazarán nuevas reservas`);
    if (equipment) efectos.push(`"${equipment.name}" (${equipment.code}) pasará a revisión y no se podrá prestar`);
  }
  if (!efectos.length) return 'Se registrará la incidencia y se notificará al área responsable, sin bloquear recursos.';
  return `Al confirmar: ${efectos.join('; ')}. Se notificará al área responsable.`;
}
