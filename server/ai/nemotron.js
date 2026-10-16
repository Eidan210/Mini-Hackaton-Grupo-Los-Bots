// Cliente de Nemotron Ultra (API de NVIDIA, compatible con OpenAI).
// La clave vive solo en el entorno (NEMOTRON_API_KEY). Si la IA falla, se lanza AiError:
// nunca se devuelve una respuesta inventada.

export class AiError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

export const aiConfig = () => ({
  apiKey: process.env.NEMOTRON_API_KEY || '',
  baseUrl: (process.env.NEMOTRON_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, ''),
  model: process.env.NEMOTRON_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
});

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

/**
 * Pide a Nemotron una respuesta JSON y la valida con un esquema Zod.
 * Reintenta una vez si el JSON no cumple el esquema.
 */
export async function askJson({ system, user, schema, temperature = 0.2, timeoutMs = 60000 }) {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) throw new AiError('La IA no está configurada: falta NEMOTRON_API_KEY en el .env del servidor.');

  const messages = [];
  // Llama-Nemotron controla el razonamiento con el system prompt; Nemotron 3 con chat_template_kwargs.
  if (model.includes('llama')) messages.push({ role: 'system', content: 'detailed thinking off' });
  messages.push({ role: 'user', content: `${system}\n\n${user}` });

  let lastError;
  for (let intento = 1; intento <= 2; intento++) {
    const started = Date.now();
    let res;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 900,
          ...(model.includes('nemotron-3') ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new AiError(err.name === 'TimeoutError' ? 'La IA tardó demasiado en responder.' : 'No se pudo conectar con la IA.', { cause: err.message });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const msg = res.status === 401 || res.status === 403 ? 'La clave de la IA no es válida.'
        : res.status === 429 ? 'La IA está saturada (límite de peticiones). Intenta en unos segundos.'
        : `La IA respondió con error ${res.status}.`;
      throw new AiError(msg, { status: res.status, body: body.slice(0, 300) });
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    try {
      const parsed = schema.safeParse(extractJson(content));
      if (parsed.success) return { data: parsed.data, model, latencyMs: Date.now() - started };
      lastError = new AiError('La respuesta de la IA no cumple el formato esperado.', { issues: parsed.error.issues.slice(0, 5) });
    } catch (err) {
      lastError = err;
    }
    messages.push({ role: 'assistant', content: String(content || '') });
    messages.push({ role: 'user', content: 'Tu respuesta no cumplió el formato. Responde SOLO con el objeto JSON válido pedido, sin texto adicional.' });
  }
  throw lastError;
}
