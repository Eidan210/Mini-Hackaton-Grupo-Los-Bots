// Punto de entrada del backend: API REST + frontend compilado (dist/) en un solo servicio.
import './env.js';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connect, dbKind } from './db.js';
import { seedIfEmpty } from './seed.js';
import { errorHandler } from './http.js';
import { publicRouter, router as coreRouter } from './routes/core.js';
import spacesRouter from './routes/spaces.js';
import equipmentRouter from './routes/equipment.js';
import incidentsRouter from './routes/incidents.js';
import { aiConfig } from './ai/nemotron.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '3mb' }));

app.use('/api', publicRouter);
app.use('/api', coreRouter); // a partir de aquí todo exige sesión
app.use('/api', spacesRouter, equipmentRouter, incidentsRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NO_ENCONTRADO', message: 'Ruta de API inexistente.' } }));

const dist = path.join(here, '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use(errorHandler);

try {
  await connect();
} catch (err) {
  console.error(`\n[db] No se pudo conectar a la base de datos: ${err.message}`);
  console.error('[db] Revisa DATABASE_URL: usuario postgres.<id-del-proyecto>, contraseña sin corchetes y método "Session pooler".\n');
  process.exit(1);
}
const seeded = await seedIfEmpty();
// En desarrollo la API va fija en 3001 (Vite usa 5173 y le hace proxy); en producción usa PORT.
const port = process.argv.includes('--dev') ? 3001 : Number(process.env.PORT) || 3001;
app.listen(port, () => {
  const ai = aiConfig();
  console.log(`CampusControl API en http://localhost:${port} · BD: ${dbKind}${seeded ? ' (datos iniciales cargados)' : ''} · IA: ${ai.apiKey ? ai.model : 'SIN CLAVE (NEMOTRON_API_KEY)'}`);
});
