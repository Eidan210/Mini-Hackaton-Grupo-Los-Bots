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
  incidencias: {
    prioridadesQueBloquean: ['Alta', 'Crítica'],       // R6
    diasBloqueo: { Alta: 1, 'Crítica': 3 },              // R6: días estimados hasta liberar el espacio
  },
  camper: { tiposPermitidos: ['cubiculo'] },      // R7: qué espacios puede reservar un camper
};

export const PERMISOS = {
  admin: ['reservar', 'prestar', 'gestionar_incidencias', 'registrar_avance', 'ver_tablero_incidencias', 'consultar_ia_incidencias',
    'cambiar_estado_recurso', 'importar_datos', 'ver_datos_importados', 'gestionar_reglas', 'gestionar_usuarios', 'ver_reglas', 'ver_panel_global'],
  coordinador: ['reservar', 'prestar', 'gestionar_incidencias', 'ver_tablero_incidencias', 'consultar_ia_incidencias',
    'cambiar_estado_recurso', 'importar_datos', 'ver_datos_importados', 'ver_reglas', 'ver_panel_global'],
  tecnico: ['reportar_incidencia', 'gestionar_incidencias', 'registrar_avance', 'ver_tablero_incidencias', 'cambiar_estado_recurso', 'ver_reglas', 'ver_panel_global'],
  trainer: ['reservar', 'prestar', 'reportar_incidencia', 'ver_reglas', 'ver_panel_global'],
  camper: ['reservar', 'prestar', 'reportar_incidencia'],
};

/** Rol que recibe quien se registra por su cuenta. Los demás roles los asigna el administrador. */
export const ROL_REGISTRO = 'camper';

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
  { id: 'R1', nombre: 'Sin cruces de horario', resumen: 'Un espacio no se puede reservar dos veces a la misma hora.', descripcion: 'Si ya hay una reserva confirmada que se cruza con el horario pedido, la nueva se rechaza y la IA sugiere otro espacio libre.' },
  { id: 'R2', nombre: 'Aforo máximo', resumen: 'No caben más personas que la capacidad del espacio.', descripcion: 'El número de asistentes de una reserva no puede superar la capacidad registrada del aula, cubículo, laboratorio o auditorio.' },
  { id: 'R3', nombre: 'Recursos fuera de servicio', resumen: 'No se reserva ni se presta lo que está bloqueado, en mantenimiento, en revisión o dañado.', descripcion: 'Los bloqueos de espacios tienen fechas: fuera de ese rango el espacio vuelve a estar disponible.' },
  { id: 'R4', nombre: 'Límite de préstamos', resumen: `Máximo ${CONFIG.prestamos.maxActivosPorUsuario} préstamos activos por persona y ninguno nuevo si hay uno vencido.`, descripcion: 'Quien tenga un equipo sin devolver después de la fecha acordada debe devolverlo antes de pedir otro.' },
  { id: 'R5', nombre: 'Horario y duración', resumen: `Reservas entre ${CONFIG.horario.apertura} y ${CONFIG.horario.cierre}, de máximo ${CONFIG.reservas.maxHoras} horas y nunca en el pasado; préstamos de hasta ${CONFIG.prestamos.maxHoras} horas.`, descripcion: 'La hora de fin debe ser posterior a la de inicio y la reserva debe quedar dentro del horario del campus.' },
  { id: 'R6', nombre: 'Bloqueo por incidencia', resumen: `Una incidencia ${CONFIG.incidencias.prioridadesQueBloquean.join(' o ')} bloquea el espacio unos días y manda el equipo a revisión.`, descripcion: 'El bloqueo dura hasta la fecha estimada de liberación o hasta que un técnico resuelve la incidencia, lo que pase primero.' },
  { id: 'R7', nombre: 'Reservas de campers', resumen: `Los campers solo pueden reservar ${CONFIG.camper.tiposPermitidos.map((t) => (t === 'cubiculo' ? 'cubículos' : t)).join(', ')}.`, descripcion: 'Las aulas, laboratorios y el auditorio los reservan trainers y coordinadores.' },
];

// ---------------------------------------------------------------------------

const TODAS = new Set(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);

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
export function validarReserva({ space, request, bookings, user, now = new Date(), activas = TODAS }) {
  const { date, startTime, endTime, attendees } = request;
  const on = (id) => activas.has(id);
  const ini = toMin(startTime);
  const fin = toMin(endTime);

  if (on('R7') && user.role === 'camper' && !CONFIG.camper.tiposPermitidos.includes(space.type)) {
    return violation('R7', 'REGLA_ROL_CAMPER', `Los campers solo pueden reservar: ${CONFIG.camper.tiposPermitidos.join(', ')}. "${space.name}" es de tipo ${space.type}.`);
  }
  if (on('R3') && space.status !== 'disponible') {
    const hasta = space.block?.hasta ? ` hasta el ${space.block.hasta}` : '';
    const motivo = space.block?.motivo ? ` (${space.block.motivo})` : '';
    return violation('R3', 'REGLA_RECURSO_INHABILITADO', `"${space.name}" está ${ESTADOS_ESPACIO[space.status] || space.status}${hasta}${motivo} y no admite reservas en esa fecha.`);
  }
  if (fin <= ini) {
    return violation('R5', 'REGLA_HORARIO', 'La hora de fin debe ser posterior a la de inicio.');
  }
  if (on('R5') && (ini < toMin(CONFIG.horario.apertura) || fin > toMin(CONFIG.horario.cierre))) {
    return violation('R5', 'REGLA_HORARIO', `El campus solo admite reservas entre ${CONFIG.horario.apertura} y ${CONFIG.horario.cierre}.`);
  }
  if (on('R5') && fin - ini > CONFIG.reservas.maxHoras * 60) {
    return violation('R5', 'REGLA_DURACION', `Una reserva no puede durar más de ${CONFIG.reservas.maxHoras} horas.`);
  }
  const inicioReserva = new Date(`${date}T${startTime}:00`);
  if (on('R5') && inicioReserva < now) {
    return violation('R5', 'REGLA_PASADO', 'No se puede reservar en una fecha u hora que ya pasó.');
  }
  if (on('R2') && attendees > space.capacity) {
    return violation('R2', 'REGLA_AFORO', `El aforo solicitado (${attendees}) supera la capacidad de "${space.name}" (${space.capacity} personas).`);
  }
  const choque = on('R1') && bookings.find(
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
export function validarPrestamo({ equipment, hours, prestamosActivos, now = new Date(), activas = TODAS }) {
  const on = (id) => activas.has(id);
  // Un equipo prestado nunca se puede volver a prestar (integridad), aunque R3 esté desactivada.
  if (equipment.status === 'prestado' || (on('R3') && equipment.status !== 'disponible')) {
    return violation('R3', 'REGLA_RECURSO_INHABILITADO', `"${equipment.name}" (${equipment.code}) está ${ESTADOS_EQUIPO[equipment.status] || equipment.status} y no se puede prestar.`);
  }
  if (!(hours > 0) || (on('R5') && hours > CONFIG.prestamos.maxHoras)) {
    return violation('R5', 'REGLA_DURACION', `La duración del préstamo debe estar entre 1 y ${CONFIG.prestamos.maxHoras} horas.`);
  }
  const vencido = on('R4') && prestamosActivos.find((l) => new Date(l.due_at) < now);
  if (vencido) {
    return violation('R4', 'REGLA_PRESTAMO_VENCIDO', 'Tienes un préstamo vencido. Devuélvelo antes de pedir otro equipo.', { prestamoId: vencido.id });
  }
  if (on('R4') && prestamosActivos.length >= CONFIG.prestamos.maxActivosPorUsuario) {
    return violation('R4', 'REGLA_LIMITE_PRESTAMOS', `Ya tienes ${prestamosActivos.length} préstamos activos; el máximo es ${CONFIG.prestamos.maxActivosPorUsuario}.`);
  }
  return null;
}

/** R6: ¿esta prioridad bloquea el recurso afectado? */
export const prioridadBloquea = (priority, activas = TODAS) =>
  activas.has('R6') && CONFIG.incidencias.prioridadesQueBloquean.includes(priority);

/** R6: fecha estimada de liberación (YYYY-MM-DD) de un espacio bloqueado por una incidencia. */
export function fechaLiberacion(priority, desde) {
  const dias = CONFIG.incidencias.diasBloqueo[priority] ?? 1;
  const d = new Date(`${desde}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('en-CA');
}

/** R3 con fechas: devuelve el bloqueo activo que cubre esa fecha, o null. */
export const bloqueoEnFecha = (blocks, date) =>
  blocks.find((b) => b.activo !== false && b.desde <= date && date <= b.hasta) || null;

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
