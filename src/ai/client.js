/**
 * PixelForge Studio — Client API pour IA Locale et Cloud
 * Supporte le protocole standard OpenAI (LM Studio, Ollama, vLLM, etc.)
 * avec tool calling / streaming, ainsi que l'API Claude (Anthropic).
 */

export const DEFAULT_AI_CONFIG = {
  endpoint: 'http://localhost:1234/v1',
  model: 'local-model',
  temperature: 0.7,
  maxTokens: 2048,
  stream: true,
  provider: 'openai', // 'openai' ou 'claude'
  apiKey: '',
};

/**
 * Teste la joignabilite de l'endpoint IA
 */
export async function testConnection(endpoint = DEFAULT_AI_CONFIG.endpoint, apiKey = '') {
  const url = endpoint.replace(/\/+$/, '');
  const headers = {};
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // Cas Claude API direct
  if (url.includes('api.anthropic.com')) {
    try {
      const res = await fetch(`${url}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (!res.ok) return { ok: false, error: `Erreur Claude API HTTP ${res.status}` };
      const data = await res.json();
      const models = Array.isArray(data?.data) ? data.data.map((m) => m.id) : ['claude-3-5-sonnet-20241022'];
      return { ok: true, models };
    } catch (err) {
      return { ok: false, error: err.message || 'Impossible de joindre Claude API' };
    }
  }

  // Protocole OpenAI standard
  try {
    const res = await fetch(`${url}/models`, { method: 'GET', headers });
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
export async function fetchModels(endpoint = DEFAULT_AI_CONFIG.endpoint, apiKey = '') {
  const res = await testConnection(endpoint, apiKey);
  return res.ok ? res.models : [];
}

/**
 * Envoie une requete a Claude (Anthropic Messages API)
 */
async function sendClaudeRequest({
  endpoint,
  model,
  messages,
  tools = null,
  temperature = 0.7,
  maxTokens = 2048,
  apiKey = '',
  signal = null,
  onChunk = () => {},
}) {
  const url = endpoint.includes('api.anthropic.com')
    ? `${endpoint.replace(/\/+$/, '')}/messages`
    : `${endpoint.replace(/\/+$/, '')}/v1/messages`;

  // Extraction du system prompt et conversion des messages pour Claude
  let systemPrompt = '';
  const filteredMessages = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemPrompt += (systemPrompt ? '\n\n' : '') + m.content;
    } else if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length) {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls) {
        let input = {};
        try {
          input = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function?.arguments || {});
        } catch {}
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function?.name,
          input,
        });
      }
      filteredMessages.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool') {
      const toolBlock = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      };
      const last = filteredMessages[filteredMessages.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        last.content.push(toolBlock);
      } else {
        filteredMessages.push({
          role: 'user',
          content: [toolBlock],
        });
      }
    } else {
      filteredMessages.push(m);
    }
  }

  // Formatage des outils Claude
  const claudeTools = tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const payload = {
    model: model || 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    temperature,
    messages: filteredMessages,
  };
  if (systemPrompt) payload.system = systemPrompt;
  if (claudeTools?.length) payload.tools = claudeTools;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erreur API Claude (${res.status}) : ${errText || res.statusText}`);
  }

  const data = await res.json();
  let content = '';
  const toolCalls = [];

  for (const block of data.content || []) {
    if (block.type === 'text') {
      content += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        },
      });
    }
  }

  if (content) onChunk(content, content);

  return {
    content,
    tool_calls: toolCalls.length ? toolCalls : null,
  };
}

/**
 * Requete de chat structuree avec support de function calling / tools
 * Renvoie { content: string, tool_calls: Array | null }
 */
export async function sendAgentChatRequest({
  endpoint = DEFAULT_AI_CONFIG.endpoint,
  model = DEFAULT_AI_CONFIG.model,
  messages = [],
  tools = null,
  toolChoice = 'auto',
  temperature = 0.7,
  maxTokens = 2048,
  stream = true,
  provider = 'openai',
  apiKey = '',
  onChunk = () => {},
  signal = null,
} = {}) {
  // Aiguillage Claude
  if (provider === 'claude' || endpoint.includes('api.anthropic.com')) {
    return sendClaudeRequest({
      endpoint,
      model,
      messages,
      tools,
      temperature,
      maxTokens,
      apiKey,
      signal,
      onChunk,
    });
  }

  // Format standard OpenAI
  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`;

  const payload = {
    model: model || 'local-model',
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: Boolean(stream),
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = toolChoice;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Erreur API (${response.status}) : ${errText || response.statusText}`);
  }

  // Lecture streaming SSE
  if (stream && response.body && response.body.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';
    const accToolCalls = [];

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
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullText += delta.content;
            onChunk(delta.content, fullText);
          }

          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!accToolCalls[idx]) {
                accToolCalls[idx] = {
                  id: tc.id || `call_${idx}`,
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }
              if (tc.id) accToolCalls[idx].id = tc.id;
              if (tc.function?.name) accToolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) accToolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // Ligne partielle
        }
      }
    }

    const toolCalls = accToolCalls.filter((tc) => tc && tc.function?.name);
    return {
      content: fullText,
      tool_calls: toolCalls.length ? toolCalls : null,
    };
  }

  // Reponse complete standard sans streaming
  const data = await response.json();
  const choice = data.choices?.[0]?.message;
  const content = choice?.content || '';
  const toolCalls = choice?.tool_calls || (choice?.function_call ? [{
    id: 'call_0',
    type: 'function',
    function: choice.function_call,
  }] : null);

  if (content) onChunk(content, content);

  return {
    content,
    tool_calls: toolCalls && toolCalls.length ? toolCalls : null,
  };
}

/**
 * Requete de chat simple renvoyant le texte brut (compatibilite)
 */
export async function sendChatRequest(options = {}) {
  const res = await sendAgentChatRequest(options);
  return res.content;
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
