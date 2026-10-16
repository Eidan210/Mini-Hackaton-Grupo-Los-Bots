# CampusControl · Sistema Central de Gestión Operativa

Hackatón Campuslands **"El campus bajo presión"** · Grupo **Los Bots**

Un solo sistema para **reservar espacios**, **prestar equipos** y **reportar incidencias**, donde una IA
(**Nemotron 3 Ultra** de NVIDIA, vía OpenRouter) clasifica y prioriza cada incidencia y propone alternativas cuando una reserva
se rechaza. Las reglas de negocio viven en un único archivo (`server/rules.js`) para poder cambiarlas en vivo.

## Problema

Campuslands crece rápido y la disponibilidad de aulas, el préstamo de equipos y la atención de incidencias
dependen de registros dispersos y revisiones manuales. Resultado: aulas reservadas dos veces, equipos dañados
que se siguen prestando e incidencias que nadie prioriza.

## Integrantes y roles

| Integrante | Rol en el equipo | Rama |
|---|---|---|
| Eidan | Líder técnico · backend, base de datos y reglas de negocio | `eidan` |
| Brayan | IA (Nemotron) e incidencias | `brayan` |
| Luis | Frontend y experiencia de usuario | `luis` |
| Juan | QA, pruebas, documentación e idea de automatización con n8n | `juan` |

`main` contiene la integración de las cuatro ramas.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 (tema oscuro estilo Portal Campers)
- **Backend:** Node.js + Express 5, validación con Zod
- **Base de datos:** PostgreSQL en **Supabase** (`DATABASE_URL`). Sin URL, usa PostgreSQL embebido (PGlite) para desarrollo.
- **IA:** Nemotron 3 Ultra vía OpenRouter (API compatible con OpenAI), con respaldo automático a Nemotron 3 Super si Ultra no responde

```
web/ (React)  ──/api──▶  server/index.js (Express)
                           ├── rules.js        ← reglas de negocio (R1–R7), puras y testeadas
                           ├── routes/         ← espacios, equipos, incidencias, datos
                           ├── ai/             ← cliente Nemotron + triaje + recomendación
                           ├── importer.js     ← carga y validación de los datos oficiales
                           └── db.js           ← PostgreSQL (Supabase) / PGlite
```

## Uso de la IA

1. **Triaje de incidencias** (`POST /api/incidents/analyze`): el usuario describe el problema en lenguaje
   natural y Nemotron propone **título, categoría, prioridad, área responsable y el espacio o equipo afectado**,
   con justificación y recomendaciones.
2. **Recomendación de espacio** (`POST /api/ai/recommend-space`): cuando una reserva se rechaza, el backend
   filtra los espacios que **sí cumplen todas las reglas** y Nemotron elige el más adecuado explicando por qué.

**Control de las respuestas:** la IA debe responder JSON, que se valida con Zod contra los catálogos
(categorías, prioridades y áreas válidas). Los ids que no existen se descartan, se reintenta una vez si el
formato no cumple, si el modelo principal no responde se pasa a otro modelo Nemotron (la pantalla muestra
cuál respondió) y, si todos fallan, el sistema lo dice y permite **clasificar manualmente**: nunca se
inventa una respuesta. La IA **propone** y la persona **confirma**: las consecuencias (bloquear un aula,
mandar un equipo a revisión) las aplica el backend según las reglas, no la IA.

## Reglas de negocio (`server/rules.js`)

| Id | Regla | Valor por defecto |
|---|---|---|
| R1 | Un espacio no puede tener reservas que se crucen | — |
| R2 | Los asistentes no pueden superar el aforo | — |
| R3 | No se reservan espacios bloqueados/en mantenimiento ni se prestan equipos prestados, en revisión o dañados | — |
| R4 | Máximo de préstamos activos por usuario y ninguno si tiene uno vencido | 2 |
| R5 | Reservas dentro del horario, no en el pasado y con duración máxima; préstamos con horas máximas | 07:00–21:00, 4 h, 24 h |
| R6 | Una incidencia Alta/Crítica bloquea el espacio y manda el equipo a revisión; al resolverse se liberan | Alta, Crítica |
| R7 | Los campers solo reservan cubículos | cubiculo |

**Cambio en vivo:** se edita `CONFIG` en `server/rules.js` (por ejemplo `reservas.maxHoras: 2`), se guarda y
el servidor se reinicia solo con `npm run dev`. La pantalla **Reglas activas** muestra los valores vigentes.

## Datos oficiales

Los datos de espacios y equipos se cargan desde `server/data/*.csv` al iniciar con la base vacía, y también
desde la pantalla **Datos importados** (CSV o JSON). Cada fila se valida: lo válido se guarda y lo
inconsistente (capacidad negativa, código duplicado, tipo desconocido, equipo "prestado" sin préstamo…) se
rechaza con su motivo y queda visible en la app. Para usar los datos del día, se reemplazan esos CSV o se
importan desde la pantalla.

## Usuarios de demostración (ficticios)

El login es por perfil, sin contraseñas: Valentina Ríos (Administrador), Andrés Pineda (Coordinador académico),
Camila Duarte (Técnico de soporte), Miguel Ángel Torres (Trainer), Sofía Herrera y Daniel Rojas (Campers;
Daniel tiene un préstamo vencido para demostrar la regla R4).

## Instalación y ejecución

Requisitos: Node.js 20.12 o superior.

```bash
npm install
cp env.example .env   # y rellenar las variables de abajo
npm run dev        # API en :3001 y web en http://localhost:5173
npm test           # pruebas de las reglas y del importador
```

Variables de entorno (archivo `.env`, que **no** se sube a Git):

| Variable | Para qué |
|---|---|
| `NEMOTRON_API_KEY` | Clave gratuita de OpenRouter (openrouter.ai/keys) |
| `NEMOTRON_MODEL` | Opcional. Por defecto `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `NEMOTRON_FALLBACK_MODELS` | Opcional. Modelos de respaldo separados por coma (por defecto Nemotron 3 Super y 3.5 Super VL) |
| `NEMOTRON_BASE_URL` | Opcional. Por defecto `https://openrouter.ai/api/v1` (sirve también la API de NVIDIA) |
| `DATABASE_URL` | Cadena de conexión de Supabase. Vacía = PostgreSQL embebido local |
| `SESSION_SECRET` | Texto aleatorio para firmar las sesiones |

**Producción** (un solo servicio): `npm install && npm run build` y luego `npm start`. Express sirve la API y
el frontend compilado.

## Idea de automatización

Ver [docs/idea-n8n.md](docs/idea-n8n.md) (rama `juan`). Contrato de la API en [docs/API.md](docs/API.md).
