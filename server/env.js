// Se importa antes que todo: carga variables de entorno y fija la zona horaria del campus.
process.env.TZ ||= 'America/Bogota';
try {
  process.loadEnvFile();
} catch {
  // Sin archivo local: se usan las variables del entorno (p. ej. en Render).
}
