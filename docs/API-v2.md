# Cambios de la API (v2) — sugerencias del equipo

Complementa `docs/API.md`. Lo que aquí se describe **reemplaza** a lo anterior cuando choca.
Formato de error igual: `{ error: { code, message, rule?, details? } }`.

## Sesión (sugerencias 1 y 16)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/auth/config` | | `{ demoLogin: bool }` (si es true existe el acceso rápido de demostración) |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` · `401 CREDENCIALES` "Correo o contraseña incorrectos." · `429 DEMASIADOS_INTENTOS` |
| POST | `/auth/register` | `{ name, email, password }` (password ≥ 8) | `201 { token, user }` con rol `camper` (el primer usuario real queda `admin`) · `409 EMAIL_EXISTE` |
| PATCH | `/auth/password` | `{ currentPassword, newPassword }` | `{ ok: true }` · `400 CLAVE_ACTUAL` |
| GET | `/auth/users` | | solo si `demoLogin`: perfiles demo (como antes). Si no, `404`. |
| POST | `/auth/demo` | `{ userId }` | solo si `demoLogin`: `{ token, user }` |
| GET | `/auth/me` | | `{ user }` |
| GET | `/users` | | (permiso `gestionar_usuarios`) `[{ id, name, email, role, roleLabel, created_at }]` |
| PATCH | `/users/:id` | `{ role }` | (permiso `gestionar_usuarios`) `{ user }` · no puede cambiarse su propio rol |

`user = { id, name, email, role, roleLabel, permisos: [] }`. Permisos posibles:
`reservar`, `prestar`, `reportar_incidencia`, `gestionar_incidencias`, `registrar_avance`,
`ver_tablero_incidencias`, `consultar_ia_incidencias`, `cambiar_estado_recurso`, `importar_datos`,
`ver_datos_importados`, `gestionar_reglas`, `gestionar_usuarios`, `ver_reglas`, `ver_panel_global`.

- admin: todos menos `reportar_incidencia`.
- coordinador: `reservar, prestar, gestionar_incidencias, ver_tablero_incidencias, consultar_ia_incidencias, cambiar_estado_recurso, importar_datos, ver_datos_importados, ver_reglas, ver_panel_global`.
- tecnico: `reportar_incidencia, gestionar_incidencias, registrar_avance, ver_tablero_incidencias, cambiar_estado_recurso, ver_reglas, ver_panel_global`.
- trainer: `reservar, prestar, reportar_incidencia, ver_reglas, ver_panel_global`.
- camper: `reservar, prestar, reportar_incidencia` (sin panel global, sin reglas, sin datos importados).

## Panel por rol (sugerencias 3 y 15)

`GET /dashboard`
- Con `ver_panel_global`: `{ scope: "global", kpis: {...como antes, importRejected = solo pendientes}, usage: [...], stats: { peakHour: "10:00"|null, avgOccupancy: 0.32, topSpaces: [{ name, count }] }, activity: [...] }`
- Sin él (camper): `{ scope: "personal", kpis: { myBookingsToday, myUpcomingBookings, myActiveLoans, myOverdueLoans, myOpenIncidents, spacesAvailableNow }, bookings: [booking próximas mías], loans: [loan activos míos], incidents: [incident mías], availableNow: [{ id, name, type, capacity }], activity: [solo mías] }`

## Espacios con bloqueos por fecha (sugerencias 6 y 14)

`GET /spaces?date=` → cada espacio trae `status` **calculado para esa fecha** (`disponible|mantenimiento|bloqueado`) y
`block: null | { id, tipo: "mantenimiento"|"bloqueo", desde, hasta, motivo, incident_code }`.
Fuera del rango `desde..hasta` el espacio sale `disponible`.

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/spaces/:id/blocks` | `{ tipo: "mantenimiento"\|"bloqueo", desde, hasta, motivo }` (permiso `cambiar_estado_recurso`) | `201 { block }` |
| DELETE | `/spaces/:id/blocks/:blockId` | | `{ ok: true }` (libera el espacio). `409 R6` si el bloqueo es de una incidencia abierta. |

`PATCH /spaces/:id/status` desaparece. Las incidencias Alta/Crítica crean un bloqueo desde hoy hasta una
**fecha estimada de liberación** (`CONFIG.incidencias.diasBloqueo`), que se libera al resolverla.
Tipos de espacio para colorear: `aula`, `cubiculo`, `laboratorio`, `auditorio`.

## Equipos fuera de servicio (sugerencia 12)

`GET /equipment` → cada equipo trae además `report: null | { incident_id, incident_code, title, status, priority, reported_by_name, created_at, assigned_name, assigned_email, last_note, last_note_at }`
(la incidencia no resuelta más reciente sobre el equipo). "Reportado sin revisar" = `report.status === "abierta"`.

`POST /equipment/:id/consult` (permiso `ver_tablero_incidencias`, solo admin/coordinador lo usan) → deja una
nota "Solicitud de actualización" en la incidencia y notifica al técnico → `{ ok: true, notified: "Camila Duarte" | null }`.

## Incidencias por rol (sugerencia 9)

- `POST /incidents/analyze` y `POST /incidents` exigen `reportar_incidencia` (admin y coordinador ya no crean).
- `GET /incidents` → cada incidencia trae además `assigned_to, assigned_name, last_note, last_note_at, notes_count, updated_at, block_hasta`.
- `PATCH /incidents/:id` `{ status?, assignedTo? }` (permiso `gestionar_incidencias`). Si un técnico pasa a `en_progreso` sin asignado, se le asigna.
- `GET /incidents/:id/notes` → `[{ id, text, author_name, author_role, created_at }]`
- `POST /incidents/:id/notes` `{ text }` (permiso `registrar_avance` o `gestionar_incidencias`) → `201 { note }`
- `GET /users?role=tecnico` sirve para el selector de asignación (permiso `gestionar_incidencias` también lo permite con `role=tecnico`).
- `POST /ai/incidents/ask` `{ question, incidentId? }` (permiso `consultar_ia_incidencias`) → `{ answer, cited: ["INC-0003"], model, latencyMs }` o `502`.
  La IA responde usando las incidencias abiertas y las notas de avance de los técnicos.

## Reglas (sugerencia 7)

`GET /rules` → `{ reglas: [{ id, nombre, resumen (frase en lenguaje cotidiano), descripcion, activa: bool }], config, catalogos }`
`PATCH /rules/:id` `{ activa: bool }` (permiso `gestionar_reglas`, solo admin) → `{ regla }`. Una regla desactivada deja de validarse.
(No se pueden crear reglas con lógica nueva desde la interfaz; "agregar" = volver a activar una desactivada.)

## Datos importados (sugerencia 4)

`GET /import/errors` (permiso `ver_datos_importados`) → `[{ id, source, row_number, raw, reason, status: "pendiente"|"revisado", reviewed_by_name, reviewed_at, created_at }]`
`PATCH /import/errors/:id` `{ status: "revisado"|"pendiente" }` → `{ error }`
`DELETE /import/errors/:id` → `{ ok: true }` (borrado lógico; los revisados con más de 7 días se limpian solos)

## Notificaciones (sugerencia 11)

`GET /notifications` → `{ unread: n, items: [{ id, type, message, created_at, read: bool, link: "/incidencias"|... }] }` (máx. 15, filtradas por rol: el camper solo ve lo suyo)
`POST /notifications/read-all` → `{ ok: true }`
