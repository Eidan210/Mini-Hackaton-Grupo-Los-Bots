// Cliente de Nemotron (API compatible con OpenAI: OpenRouter por defecto, o la API directa de NVIDIA).
// La clave vive solo en el entorno (NEMOTRON_API_KEY). Si la IA falla, se lanza AiError:
// nunca se devuelve una respuesta inventada.

export class AiError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

// Por defecto: Nemotron 3 Ultra gratis vía OpenRouter. Si el modelo principal falla o está saturado,
// se prueba el siguiente de NEMOTRON_FALLBACK_MODELS (también Nemotron, también IA real).
// Para usar la API directa de NVIDIA basta cambiar NEMOTRON_BASE_URL y NEMOTRON_MODEL.
export const aiConfig = () => {
  const model = process.env.NEMOTRON_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
  const fallbacks = (process.env.NEMOTRON_FALLBACK_MODELS ?? 'nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3.5-super-vl:free')
    .split(',').map((m) => m.trim()).filter((m) => m && m !== model);
  return {
    apiKey: process.env.NEMOTRON_API_KEY || process.env.OPENROUTER_API_KEY || '',
    baseUrl: (process.env.NEMOTRON_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model,
    models: [model, ...fallbacks],
  };
};

/** Extrae el primer objeto JSON de la respuesta (ignora bloques <think> y ```json). */
export function extractJson(text) {
  const clean = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiError('La IA no devolvió un JSON.', { raw: clean.slice(0, 300) });
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    throw new AiError('La IA devolvió un JSON mal formado.', { raw: clean.slice(start, start + 300) });
  }
}

// Circuito simple: un modelo que acaba de fallar se salta durante unos minutos para no hacer esperar al usuario.
const SKIP_MS = 5 * 60 * 1000;
const skipUntil = new Map();

/** Una llamada a /chat/completions. Devuelve el texto o lanza AiError. */
async function callModel({ baseUrl, apiKey, model, messages, temperature, timeoutMs }) {
  const body = { model, messages, temperature, max_tokens: 900 };
  if (baseUrl.includes('openrouter')) body.reasoning = { enabled: false };
  else if (model.includes('nemotron-3')) body.chat_template_kwargs = { enable_thinking: false };

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'CampusControl' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new AiError(err.name === 'TimeoutError' ? 'La IA tardó demasiado en responder.' : 'No se pudo conectar con la IA.', { model, cause: err.message });
  }
  const data = await res.json().catch(() => null);
  // OpenRouter puede responder 200 con un objeto "error" cuando el proveedor falla.
  const status = data?.error?.code || res.status;
  if (!res.ok || data?.error) {
    const msg = status === 401 || status === 403 ? 'La clave de la IA no es válida.'
      : status === 429 ? 'La IA está saturada (límite de peticiones). Intenta en unos segundos.'
      : `La IA respondió con error ${status}.`;
    throw new AiError(msg, { model, status, body: JSON.stringify(data?.error || data).slice(0, 300) });
  }
  return data?.choices?.[0]?.message?.content;
}

/**
 * Pide a Nemotron una respuesta JSON y la valida con un esquema Zod.
 * Si el JSON no cumple, reintenta una vez con el mismo modelo; si el modelo falla, pasa al siguiente.
 */
export async function askJson({ system, user, schema, temperature = 0.2, timeoutMs = 20000 }) {
  const { apiKey, baseUrl, models: all } = aiConfig();
  const available = all.filter((m) => !(skipUntil.get(m) > Date.now()));
  const models = available.length ? available : all;
  if (!apiKey) throw new AiError('La IA no está configurada: falta NEMOTRON_API_KEY en las variables de entorno del servidor.');

  let lastError;
  for (const model of models) {
    const messages = [];
    // Llama-Nemotron controla el razonamiento con el system prompt.
    if (model.includes('llama')) messages.push({ role: 'system', content: 'detailed thinking off' });
    messages.push({ role: 'user', content: `${system}\n\n${user}` });

    for (let intento = 1; intento <= 2; intento++) {
      const started = Date.now();
      let content;
      try {
        content = await callModel({ baseUrl, apiKey, model, messages, temperature, timeoutMs });
      } catch (err) {
        lastError = err;
        if (err.details?.status === 401 || err.details?.status === 403) throw err; // clave inválida: no sirve probar otro
        skipUntil.set(model, Date.now() + SKIP_MS);
        console.warn(`[ia] ${model} falló (${err.message}); se omite 5 min y se prueba el siguiente modelo.`);
        break;
      }
      try {
        const parsed = schema.safeParse(extractJson(content));
        if (parsed.success) return { data: parsed.data, model, latencyMs: Date.now() - started };
        lastError = new AiError('La respuesta de la IA no cumple el formato esperado.', { model, issues: parsed.error.issues.slice(0, 5) });
      } catch (err) {
        lastError = err;
      }
      messages.push({ role: 'assistant', content: String(content || '') });
      messages.push({ role: 'user', content: 'Tu respuesta no cumplió el formato. Responde SOLO con el objeto JSON válido pedido, sin texto adicional.' });
    }
  }
  throw lastError;
}
