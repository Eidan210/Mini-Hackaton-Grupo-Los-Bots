# Contrato de la API (backend Express)

Base: `/api`. Todas las respuestas son JSON. Las rutas (salvo `/health`, `/auth/users` y `/auth/login`) exigen
`Authorization: Bearer <token>`.

**Formato de error (siempre igual):**

```json
{ "error": { "code": "REGLA_SOLAPAMIENTO", "rule": "R1", "message": "Texto claro para el usuario", "details": {} } }
```

- `400` validación de campos (Zod) · `401` sin sesión · `403` el rol no tiene permiso · `404` no existe
- `409` se violó una regla de negocio (`error.rule` = `R1`..`R7`) · `502` la IA falló o devolvió algo inválido

Fechas `YYYY-MM-DD`, horas `HH:mm`, timestamps ISO.

## Roles (ficticios)

`admin` (Administrador), `coordinador` (Coordinador académico), `tecnico` (Técnico de soporte), `trainer`, `camper`.
Permisos en `server/rules.js > PERMISOS`; el frontend recibe `user.permisos` (array de strings) para ocultar botones:
`reservar`, `prestar`, `reportar_incidencia`, `gestionar_incidencias`, `cambiar_estado_recurso`, `importar_datos`.

## Salud y sesión

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/health` | | `{ ok, db: "postgres"\|"pglite", ai: { configured: bool, model } }` |
| GET | `/auth/users` | | `[{ id, name, email, role, roleLabel }]` (usuarios demo para el login) |
| POST | `/auth/login` | `{ userId }` | `{ token, user: { id, name, email, role, roleLabel, permisos: [] } }` |
| GET | `/auth/me` | | `{ user }` |

## Panel

`GET /dashboard` →
```json
{
  "kpis": { "spacesAvailable": 7, "spacesTotal": 10, "equipmentLent": 3, "equipmentTotal": 12,
            "incidentsOpen": 4, "incidentsHigh": 2, "bookingsToday": 5, "importRejected": 3 },
  "usage": [{ "hour": "08:00", "occupied": 3, "total": 10 }],
  "activity": [{ "id": 1, "type": "reserva|prestamo|devolucion|incidencia|estado|importacion", "message": "…", "created_at": "ISO" }]
}
```

## Espacios y reservas

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/spaces?date=YYYY-MM-DD` | | `[{ id, code, name, type: "aula"\|"cubiculo"\|"laboratorio"\|"auditorio", capacity, location, status: "disponible"\|"mantenimiento"\|"bloqueado", bookings: [booking] }]` |
| PATCH | `/spaces/:id/status` | `{ status }` | `{ space }` |
| GET | `/bookings?date=` | | `[booking]` |
| POST | `/bookings` | `{ spaceId, title, date, startTime, endTime, attendees }` | `201 { booking }` o `409` con regla |
| DELETE | `/bookings/:id` | | `{ booking }` (status `cancelada`) |

`booking = { id, space_id, space_name, title, organizer_name, date, start_time, end_time, attendees, status }`

## Equipos y préstamos

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/equipment` | | `[{ id, code, name, category, location, status: "disponible"\|"prestado"\|"en_revision"\|"danado", borrower_name, due_at }]` |
| PATCH | `/equipment/:id/status` | `{ status }` | `{ equipment }` |
| GET | `/loans?status=activo` | | `[{ id, equipment_id, equipment_name, equipment_code, user_name, start_at, due_at, returned_at, status, overdue: bool }]` |
| POST | `/loans` | `{ equipmentId, hours }` | `201 { loan }` o `409` con regla |
| POST | `/loans/:id/return` | | `{ loan }` |

## Incidencias + IA

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/incidents` | | `[incident]` |
| POST | `/incidents/analyze` | `{ description, spaceId?, equipmentId? }` | `{ analysis, consequence, model, latencyMs }` o `502` |
| POST | `/incidents` | `{ description, spaceId?, equipmentId?, category, priority, area, justification, aiModel? }` | `201 { incident, effects: ["Aula A-102 quedó bloqueada", …] }` |
| PATCH | `/incidents/:id` | `{ status: "en_progreso"\|"resuelta" }` | `{ incident, effects: [] }` |

`analysis = { title, category, priority: "Baja"\|"Media"\|"Alta"\|"Crítica", area, spaceId, equipmentId, justification, recommendations: [string] }`

`incident = { id, code, title, description, category, priority, area, justification, space_id, space_name, equipment_id, equipment_name, status: "abierta"\|"en_progreso"\|"resuelta", ai_model (null si fue manual), reported_by_name, created_at, resolved_at }`

Categorías, prioridades y áreas válidas: `GET /rules` → `catalogos`.

## IA: recomendación de espacio

`POST /ai/recommend-space` `{ spaceId, date, startTime, endTime, attendees }` →
`{ suggestion: { spaceId, name, reason } | null, candidates: n, model }`. Solo propone espacios que ya pasan las reglas.

## Datos oficiales

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/import` | `{ entity: "spaces"\|"equipment", format: "csv"\|"json", content: string }` | `{ inserted, updated, rejected: [{ row, raw, reason }] }` |
| GET | `/import/errors` | | `[{ id, source, row_number, raw, reason, created_at }]` |

## Reglas activas

`GET /rules` → `{ reglas: [{ id: "R1", nombre, descripcion, valor }], config: {...}, catalogos: { categorias, prioridades, areas } }`
