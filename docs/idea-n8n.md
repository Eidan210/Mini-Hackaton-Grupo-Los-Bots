# Idea de Juan: automatizaciones con n8n

> Espacio para que Juan desarrolle su idea. Abajo hay una propuesta inicial de cómo encajaría n8n con
> CampusControl; ajústala o reemplázala con tu idea.

## Idea (Juan)

_Escribe aquí la idea en 3–5 líneas: qué problema resuelve, quién lo usa y qué se automatiza._

## Propuesta de integración

CampusControl ya genera eventos claros en el backend (reserva creada, préstamo vencido, incidencia registrada,
incidencia resuelta). n8n puede escucharlos y encargarse de las notificaciones y tareas repetitivas,
sin tocar las reglas de negocio, que siguen en `server/rules.js`.

```
CampusControl (Express) ──POST webhook──▶ n8n ──▶ correo / Telegram / Google Sheets / Slack
```

### Flujos candidatos

| # | Disparador | Qué hace n8n | Valor |
|---|---|---|---|
| 1 | Incidencia **Alta/Crítica** registrada | Avisa al área responsable (correo o Telegram) con el resumen y la justificación de la IA | Respuesta más rápida |
| 2 | Cron cada hora | Consulta `GET /api/loans?status=activo` y recuerda a quien tenga un préstamo vencido | Menos equipos sin devolver |
| 3 | Incidencia resuelta | Avisa a los organizadores de las reservas afectadas que el espacio volvió a estar disponible | Menos fricción |
| 4 | Cada noche | Exporta las incidencias del día a una hoja de cálculo para el reporte de operación | Trazabilidad |

### Cómo se conectaría (mínimo)

1. En n8n crear un flujo con nodo **Webhook** (POST) y copiar su URL.
2. Guardarla en el `.env` del backend como `N8N_WEBHOOK_URL` (nunca en el código).
3. En `server/routes/incidents.js`, después de registrar la incidencia, enviar el evento:
   ```js
   if (process.env.N8N_WEBHOOK_URL) {
     fetch(process.env.N8N_WEBHOOK_URL, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ evento: 'incidencia_creada', incidencia: incident, efectos: effects }),
     }).catch(() => {}); // si n8n no responde, la operación del campus no se detiene
   }
   ```
4. En n8n: nodo **IF** (prioridad Alta/Crítica) → nodo de envío (Gmail, Telegram o Slack).

### Preguntas abiertas

- ¿n8n en la nube (n8n.cloud, prueba gratuita) o local con Docker (`docker run -p 5678:5678 n8nio/n8n`)?
- ¿Qué canal usa el campus para avisar a las áreas: correo, Telegram o WhatsApp?
- ¿Se muestra en la demo o queda como mejora futura en el pitch?
