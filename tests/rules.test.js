import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  seCruzan,
  validarReserva,
  validarPrestamo,
  prioridadBloquea,
  consecuenciaIncidencia,
} from '../server/rules.js';

const FECHA_FUTURA = '2099-01-15';
const NOW_FIJO = new Date('2026-01-01T00:00:00');

describe('Reglas de Negocio - rules.js', () => {
  const espacioBase = {
    id: 'espacio-1',
    name: 'Sala de Innovación',
    type: 'aula',
    capacity: 20,
    status: 'disponible',
  };

  const usuarioTrainer = { id: 'u-1', name: 'Trainer Juan', role: 'trainer' };
  const usuarioCamper = { id: 'u-2', name: 'Camper Maria', role: 'camper' };

  describe('R1: Detección de solapamientos (seCruzan y validarReserva)', () => {
    it('seCruzan detecta solapamiento cuando los rangos se cruzan', () => {
      const a = { start_time: '10:00', end_time: '12:00' };
      const b = { start_time: '11:00', end_time: '13:00' };
      assert.equal(seCruzan(a, b), true);
      assert.equal(seCruzan(b, a), true);
    });

    it('seCruzan permite intervalos cuyos bordes se tocan (10:00-12:00 y 12:00-13:00)', () => {
      const a = { start_time: '10:00', end_time: '12:00' };
      const b = { start_time: '12:00', end_time: '13:00' };
      assert.equal(seCruzan(a, b), false);
      assert.equal(seCruzan(b, a), false);
    });

    it('validarReserva rechaza si hay solapamiento con una reserva confirmada', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 10,
      };
      const bookings = [
        {
          id: 'b-1',
          title: 'Clase Node',
          start_time: '11:00',
          end_time: '13:00',
          status: 'confirmada',
        },
      ];
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings,
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R1');
      assert.equal(resultado.code, 'REGLA_SOLAPAMIENTO');
      assert.equal(resultado.details?.conflictoId, 'b-1');
    });

    it('validarReserva es válida si los bordes horarios se tocan con una reserva confirmada', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '12:00',
        endTime: '14:00',
        attendees: 10,
      };
      const bookings = [
        {
          id: 'b-1',
          title: 'Reserva previa',
          start_time: '10:00',
          end_time: '12:00',
          status: 'confirmada',
        },
        {
          id: 'b-2',
          title: 'Reserva posterior',
          start_time: '14:00',
          end_time: '16:00',
          status: 'confirmada',
        },
      ];
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings,
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });

    it('validarReserva ignora reservas canceladas en el mismo horario', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 10,
      };
      const bookings = [
        {
          id: 'b-cancelada',
          title: 'Clase cancelada',
          start_time: '10:00',
          end_time: '12:00',
          status: 'cancelada',
        },
      ];
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings,
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });
  });

  describe('R2: Aforo máximo', () => {
    it('rechaza si los asistentes superan la capacidad del espacio', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 21,
      };
      const resultado = validarReserva({
        space: espacioBase, // capacity: 20
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R2');
      assert.equal(resultado.code, 'REGLA_AFORO');
    });

    it('acepta si los asistentes son exactamente iguales a la capacidad', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 20,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });

    it('acepta si los asistentes son menores a la capacidad', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });
  });

  describe('R3: Recursos inhabilitados', () => {
    it('rechaza reserva de espacio bloqueado', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 5,
      };
      const espacioBloqueado = { ...espacioBase, status: 'bloqueado' };
      const resultado = validarReserva({
        space: espacioBloqueado,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R3');
      assert.equal(resultado.code, 'REGLA_RECURSO_INHABILITADO');
    });

    it('rechaza reserva de espacio en mantenimiento', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 5,
      };
      const espacioMantenimiento = { ...espacioBase, status: 'mantenimiento' };
      const resultado = validarReserva({
        space: espacioMantenimiento,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R3');
      assert.equal(resultado.code, 'REGLA_RECURSO_INHABILITADO');
    });

    it('rechaza préstamo de equipo prestado', () => {
      const equipo = { id: 'eq-1', name: 'Laptop Dell', code: 'LAP-001', status: 'prestado' };
      const resultado = validarPrestamo({
        equipment: equipo,
        hours: 4,
        prestamosActivos: [],
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R3');
      assert.equal(resultado.code, 'REGLA_RECURSO_INHABILITADO');
    });

    it('rechaza préstamo de equipo en revisión', () => {
      const equipo = { id: 'eq-2', name: 'Proyector Epson', code: 'PRJ-001', status: 'en_revision' };
      const resultado = validarPrestamo({
        equipment: equipo,
        hours: 4,
        prestamosActivos: [],
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R3');
      assert.equal(resultado.code, 'REGLA_RECURSO_INHABILITADO');
    });

    it('rechaza préstamo de equipo dañado', () => {
      const equipo = { id: 'eq-3', name: 'Monitor LG', code: 'MON-001', status: 'danado' };
      const resultado = validarPrestamo({
        equipment: equipo,
        hours: 4,
        prestamosActivos: [],
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R3');
      assert.equal(resultado.code, 'REGLA_RECURSO_INHABILITADO');
    });
  });

  describe('R4: Límite de préstamos y préstamos vencidos', () => {
    const equipoDisponible = { id: 'eq-1', name: 'Laptop Dell', code: 'LAP-001', status: 'disponible' };

    it('rechaza préstamo si el usuario tiene un préstamo vencido', () => {
      const prestamosActivos = [
        {
          id: 'p-vencido',
          equipment_id: 'eq-antiguo',
          due_at: '2025-12-31T23:59:59', // anterior a NOW_FIJO
        },
      ];
      const resultado = validarPrestamo({
        equipment: equipoDisponible,
        hours: 2,
        prestamosActivos,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R4');
      assert.equal(resultado.code, 'REGLA_PRESTAMO_VENCIDO');
      assert.equal(resultado.details?.prestamoId, 'p-vencido');
    });

    it('rechaza préstamo si el usuario alcanzó el límite de préstamos activos (2)', () => {
      const prestamosActivos = [
        { id: 'p-1', equipment_id: 'eq-10', due_at: '2026-01-02T12:00:00' },
        { id: 'p-2', equipment_id: 'eq-11', due_at: '2026-01-02T12:00:00' },
      ];
      const resultado = validarPrestamo({
        equipment: equipoDisponible,
        hours: 2,
        prestamosActivos,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R4');
      assert.equal(resultado.code, 'REGLA_LIMITE_PRESTAMOS');
    });

    it('permite préstamo si el usuario tiene menos del límite y ninguno vencido', () => {
      const prestamosActivos = [
        { id: 'p-1', equipment_id: 'eq-10', due_at: '2026-01-02T12:00:00' },
      ];
      const resultado = validarPrestamo({
        equipment: equipoDisponible,
        hours: 4,
        prestamosActivos,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });
  });

  describe('R5: Horario, duración, fin <= inicio y fecha pasada', () => {
    it('rechaza si la hora de fin es igual a la hora de inicio', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '10:00',
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_HORARIO');
      assert.match(resultado.message, /posterior/i);
    });

    it('rechaza si la hora de fin es menor a la de inicio', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '11:00',
        endTime: '10:00',
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_HORARIO');
    });

    it('rechaza si la reserva empieza antes de la apertura del campus (07:00)', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '06:30',
        endTime: '08:00',
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_HORARIO');
    });

    it('rechaza si la reserva termina después del cierre del campus (21:00)', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '20:00',
        endTime: '21:30',
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_HORARIO');
    });

    it('rechaza si la duración de la reserva supera las 4 horas', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '15:00', // 5 horas
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_DURACION');
    });

    it('permite una reserva de exactamente 4 horas', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '14:00', // 4 horas
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });

    it('rechaza si la fecha y hora de la reserva ya pasó', () => {
      const request = {
        date: '2025-12-31',
        startTime: '10:00',
        endTime: '12:00',
        attendees: 5,
      };
      const resultado = validarReserva({
        space: espacioBase,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO, // 2026-01-01
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_PASADO');
    });

    it('rechaza préstamo si las horas son menores o iguales a cero', () => {
      const equipo = { id: 'eq-1', name: 'Laptop Dell', code: 'LAP-001', status: 'disponible' };
      const resultado = validarPrestamo({
        equipment: equipo,
        hours: 0,
        prestamosActivos: [],
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_DURACION');
    });

    it('rechaza préstamo si las horas superan el máximo permitido (24 horas)', () => {
      const equipo = { id: 'eq-1', name: 'Laptop Dell', code: 'LAP-001', status: 'disponible' };
      const resultado = validarPrestamo({
        equipment: equipo,
        hours: 25,
        prestamosActivos: [],
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R5');
      assert.equal(resultado.code, 'REGLA_DURACION');
    });

    it('acepta préstamo con horas válidas', () => {
      const equipo = { id: 'eq-1', name: 'Laptop Dell', code: 'LAP-001', status: 'disponible' };
      const resultado = validarPrestamo({
        equipment: equipo,
        hours: 24,
        prestamosActivos: [],
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });
  });

  describe('R7: Camper vs Cubículo', () => {
    it('rechaza si un camper intenta reservar un aula', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 2,
      };
      const aula = { ...espacioBase, type: 'aula' };
      const resultado = validarReserva({
        space: aula,
        request,
        bookings: [],
        user: usuarioCamper,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R7');
      assert.equal(resultado.code, 'REGLA_ROL_CAMPER');
    });

    it('rechaza si un camper intenta reservar un laboratorio', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 2,
      };
      const lab = { ...espacioBase, type: 'laboratorio' };
      const resultado = validarReserva({
        space: lab,
        request,
        bookings: [],
        user: usuarioCamper,
        now: NOW_FIJO,
      });

      assert.ok(resultado);
      assert.equal(resultado.rule, 'R7');
      assert.equal(resultado.code, 'REGLA_ROL_CAMPER');
    });

    it('permite si un camper reserva un cubículo', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 2,
      };
      const cubiculo = { ...espacioBase, type: 'cubiculo', capacity: 4 };
      const resultado = validarReserva({
        space: cubiculo,
        request,
        bookings: [],
        user: usuarioCamper,
        now: NOW_FIJO,
      });

      assert.equal(resultado, null);
    });

    it('permite a un trainer o admin reservar un aula', () => {
      const request = {
        date: FECHA_FUTURA,
        startTime: '10:00',
        endTime: '12:00',
        attendees: 15,
      };
      const aula = { ...espacioBase, type: 'aula' };
      const resultadoTrainer = validarReserva({
        space: aula,
        request,
        bookings: [],
        user: usuarioTrainer,
        now: NOW_FIJO,
      });
      assert.equal(resultadoTrainer, null);

      const resultadoAdmin = validarReserva({
        space: aula,
        request,
        bookings: [],
        user: { id: 'u-admin', role: 'admin' },
        now: NOW_FIJO,
      });
      assert.equal(resultadoAdmin, null);
    });
  });

  describe('R6: prioridadBloquea y consecuenciaIncidencia', () => {
    it('prioridadBloquea retorna true únicamente para prioridades Alta y Crítica', () => {
      assert.equal(prioridadBloquea('Alta'), true);
      assert.equal(prioridadBloquea('Crítica'), true);
      assert.equal(prioridadBloquea('Media'), false);
      assert.equal(prioridadBloquea('Baja'), false);
      assert.equal(prioridadBloquea('Informativa'), false);
    });

    it('consecuenciaIncidencia informa registro sin bloqueo cuando la prioridad no bloquea', () => {
      const mensaje = consecuenciaIncidencia({
        priority: 'Media',
        space: { name: 'Laboratorio 1' },
      });
      assert.equal(
        mensaje,
        'Se registrará la incidencia y se notificará al área responsable, sin bloquear recursos.'
      );
    });

    it('consecuenciaIncidencia incluye bloqueo de espacio en prioridad alta', () => {
      const mensaje = consecuenciaIncidencia({
        priority: 'Alta',
        space: { name: 'Laboratorio 1' },
      });
      assert.match(mensaje, /Laboratorio 1/);
      assert.match(mensaje, /quedará bloqueado y se rechazarán nuevas reservas/);
    });

    it('consecuenciaIncidencia incluye envío a revisión técnica del equipo', () => {
      const mensaje = consecuenciaIncidencia({
        priority: 'Crítica',
        equipment: { name: 'Proyector 4K', code: 'PRJ-4K-01' },
      });
      assert.match(mensaje, /Proyector 4K/);
      assert.match(mensaje, /PRJ-4K-01/);
      assert.match(mensaje, /pasará a revisión y no se podrá prestar/);
    });

    it('consecuenciaIncidencia concatena ambos recursos si se especifican espacio y equipo', () => {
      const mensaje = consecuenciaIncidencia({
        priority: 'Alta',
        space: { name: 'Aula 101' },
        equipment: { name: 'Pantalla Táctil', code: 'SCR-001' },
      });
      assert.match(mensaje, /Aula 101/);
      assert.match(mensaje, /Pantalla Táctil/);
      assert.match(mensaje, /quedará bloqueado/);
      assert.match(mensaje, /pasará a revisión/);
    });
  });
});
