// Utilidades HTTP compartidas: errores con formato único y manejador central.
import { ZodError } from 'zod';
import { AiError } from './ai/nemotron.js';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** Error 409 a partir de una violación de regla devuelta por rules.js */
export const ruleError = (v) => new HttpError(409, v.code, v.message, { rule: v.rule, details: v.details });

export const notFound = (what) => new HttpError(404, 'NO_ENCONTRADO', `${what} no existe.`);

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: { code: 'VALIDACION', message: `${first.path.join('.') || 'dato'}: ${first.message}`, details: err.issues },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err instanceof AiError) {
    return res.status(502).json({ error: { code: 'IA_NO_DISPONIBLE', message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'El cuerpo de la petición no es JSON válido.' } });
  }
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado en el servidor.' } });
}
