// Capa de datos: PostgreSQL real (Supabase vía DATABASE_URL) o, si no hay URL,
// PostgreSQL embebido (PGlite) en ./.pgdata. Mismo SQL en ambos casos.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
let driver = null;
export let dbKind = 'pglite';

export async function connect() {
  if (driver) return driver;
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
      max: 5,
    });
    dbKind = 'postgres';
    driver = {
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: (t, p) => client.query(t, p) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR || path.join(here, '..', '.pgdata');
    let pglite;
    try {
      pglite = new PGlite(dir);
      await pglite.waitReady;
    } catch (err) {
      // Un cierre abrupto puede dañar la base local: se abre una nueva con los datos iniciales.
      const fresh = `${dir}-${Date.now()}`;
      console.warn(`[db] La base local ${dir} está dañada (${err.message}). Usando ${fresh}; borra la carpeta dañada cuando puedas.`);
      pglite = new PGlite(fresh);
      await pglite.waitReady;
    }
    // Cierre ordenado para no dañar los archivos de PGlite.
    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.once(sig, () => pglite.close().finally(() => process.exit(0)));
    }
    dbKind = 'pglite';
    driver = {
      query: (text, params) => pglite.query(text, params),
      exec: (sql) => pglite.exec(sql),
      tx: (fn) => pglite.transaction((t) => fn({ query: (q, p) => t.query(q, p) })),
    };
  }
  await driver.exec(await readFile(path.join(here, 'schema.sql'), 'utf8'));
  return driver;
}

export const query = (text, params = []) => driver.query(text, params);
export const tx = (fn) => driver.tx(fn);

export async function logActivity(q, type, message) {
  await q('INSERT INTO activity (type, message) VALUES ($1, $2)', [type, message]);
}
