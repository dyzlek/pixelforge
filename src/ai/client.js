/**
 * PixelForge Studio — Client API OpenAI-compatible pour IA Locale (LM Studio, Ollama, etc.)
 * Supporte le streaming SSE, l'inspection des modeles et l'extraction automatique de code.
 */

export const DEFAULT_AI_CONFIG = {
  endpoint: 'http://localhost:1234/v1',
  model: 'local-model',
  temperature: 0.7,
  maxTokens: 2048,
  stream: true,
};

/**
 * Teste la joignabilite de l'endpoint IA
 */
export async function testConnection(endpoint = DEFAULT_AI_CONFIG.endpoint) {
  const url = endpoint.replace(/\/+$/, '');
  try {
    const res = await fetch(`${url}/models`, { method: 'GET' });
    if (!res.ok) {
      return { ok: false, error: `Erreur serveur HTTP ${res.status}` };
    }
    const data = await res.json();
    const models = Array.isArray(data?.data) ? data.data.map((m) => m.id) : [];
    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: err.message || 'Impossible de joindre le serveur IA local' };
  }
}

/**
 * Recupere la liste des modeles charges
 */
export async function fetchModels(endpoint = DEFAULT_AI_CONFIG.endpoint) {
  const res = await testConnection(endpoint);
  return res.ok ? res.models : [];
}

/**
 * Envoie une requete de generation de chat au format standard OpenAI
 */
export async function sendChatRequest({
  endpoint = DEFAULT_AI_CONFIG.endpoint,
  model = DEFAULT_AI_CONFIG.model,
  messages = [],
  temperature = 0.7,
  maxTokens = 2048,
  stream = true,
  onChunk = () => {},
  signal = null,
} = {}) {
  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`;

  const payload = {
    model: model || 'local-model',
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: Boolean(stream),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Erreur API (${response.status}) : ${errText || response.statusText}`);
  }

  // Si streaming demande et supporte par le lecteur de flux
  if (stream && response.body && response.body.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const chunk = parsed.choices?.[0]?.delta?.content || '';
          if (chunk) {
            fullText += chunk;
            onChunk(chunk, fullText);
          }
        } catch {
          // Ligne partielle ou non JSON, ignore
        }
      }
    }

    return fullText;
  }

  // Reponse complete standard sans stream
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  onChunk(text, text);
  return text;
}

/**
 * Analyse et extrait les blocs de code markdown (js ou json) d'une reponse
 */
export function extractCodeBlocks(text = '') {
  const jsBlocks = [];
  const jsonBlocks = [];

  const jsRegex = /```(?:javascript|js)\b\s*([\s\S]*?)```/gi;
  let match;
  while ((match = jsRegex.exec(text)) !== null) {
    jsBlocks.push(match[1].trim());
  }

  const jsonRegex = /```json\b\s*([\s\S]*?)```/gi;
  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      jsonBlocks.push(parsed);
    } catch {
      // JSON malforme ignore
    }
  }

  return { jsBlocks, jsonBlocks };
}
