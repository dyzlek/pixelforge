/**
 * PixelForge Studio — Panneau Assistant IA Local (LM Studio / Ollama / OpenAI-compatible)
 * Permet d'echanger avec un LLM local, de generer du code, des graphes Blueprints
 * et de recevoir des conseils de Game Design adaptes au moteur.
 */

import { testConnection, fetchModels, sendChatRequest, extractCodeBlocks, DEFAULT_AI_CONFIG } from '../../ai/client.js';
import { buildSystemPrompt } from '../../ai/knowledge.js';
import { compileGraph } from '../../graph/compile.js';
import { getIconSvg } from '../icons.js';
import './ai-assistant.css';

const STORAGE_KEY = 'pixelforge.ai.config';
const CHAT_STORAGE_KEY = 'pixelforge.ai.history';

function loadAiConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_AI_CONFIG };
}

function saveAiConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export function createAiAssistantPanel(container, store, workspace) {
  let config = loadAiConfig();
  let models = [];
  let isOnline = false;
  let isStreaming = false;
  let abortController = null;
  let history = [];

  // Options de contexte
  let includeActiveObject = true;
  let includeGameDesign = true;
  let includeBlueprints = true;

  container.className = 'pf-ai-panel';
  container.innerHTML = `
    <div class="pf-ai-header">
      <div class="pf-ai-status">
        <span class="pf-ai-status-dot offline" id="ai-status-dot"></span>
        <span id="ai-status-label" style="color:var(--fg-2);">Deconnecte</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <select id="ai-model-select" class="pf-insp-input" style="width:130px;font-size:11px;padding:2px 4px;height:24px;">
          <option value="${config.model}">${config.model}</option>
        </select>
        <button id="ai-refresh-models" class="pf-dock-btn" title="Rafraichir les modeles" aria-label="Rafraichir les modeles" style="padding:3px 6px;">
          ${getIconSvg('refresh', 11)}
        </button>
        <button id="ai-toggle-settings" class="pf-dock-btn" title="Reglages serveur" aria-label="Reglages serveur" style="padding:3px 6px;">
          ${getIconSvg('settings', 11)}
        </button>
      </div>
    </div>

    <div class="pf-ai-settings-drawer" id="ai-settings-drawer" style="display:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <label style="color:var(--fg-1);">Endpoint URL :</label>
        <input type="text" id="ai-endpoint-input" class="pf-insp-input" value="${config.endpoint}" style="flex:1;" />
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <label style="color:var(--fg-1);">Temperature :</label>
        <input type="number" id="ai-temp-input" class="pf-insp-input" value="${config.temperature}" min="0" max="2" step="0.1" style="width:70px;" />
        <button id="ai-test-btn" class="pf-dock-btn" style="padding:3px 8px;">Tester la connexion</button>
      </div>
    </div>

    <div class="pf-ai-chips-bar">
      <button class="pf-ai-chip" data-prompt="Cree un script de plateforme complet pour le joueur avec Coyote Time, Jump Buffering et saut variable a la relache.">Saut plateforme pro</button>
      <button class="pf-ai-chip" data-prompt="Cree un ennemi patrouilleur qui fait demi-tour aux murs et qui est elimine quand le joueur saute sur sa tete.">Ennemi patrouilleur</button>
      <button class="pf-ai-chip" data-prompt="Cree un script pour un objet piece collectible qui flotte legerement, incremente le score et joue le son coin.">Piece collectible</button>
      <button class="pf-ai-chip" data-prompt="Genere un graphe Blueprint complet en JSON pour un objet Coin qui est detruit au contact du Player et donne 1 point.">Blueprint Collectible</button>
      <button class="pf-ai-chip" data-prompt="Comment mettre en place une secousse d'ecran (screen shake) fluide lors d'un impact critique ?">Secousse d'ecran</button>
      <button class="pf-ai-chip" data-prompt="Analyse le script actif et propose des ameliorations de Game Feel et de reactivite.">Audit Game Feel</button>
    </div>

    <div class="pf-ai-chat-body" id="ai-chat-body"></div>

    <div class="pf-ai-input-area">
      <div class="pf-ai-context-toggles">
        <label title="Transmettre le code de l'objet selectionne a l'IA">
          <input type="checkbox" id="ai-ctx-obj" ${includeActiveObject ? 'checked' : ''} /> Objet actif
        </label>
        <label title="Injecter les regles de Game Feel">
          <input type="checkbox" id="ai-ctx-gd" ${includeGameDesign ? 'checked' : ''} /> Game Design
        </label>
        <label title="Injecter le schema Blueprint">
          <input type="checkbox" id="ai-ctx-bp" ${includeBlueprints ? 'checked' : ''} /> Blueprints
        </label>
      </div>

      <div class="pf-ai-input-row">
        <textarea id="ai-prompt-input" class="pf-ai-textarea" placeholder="Posez une question, demandez du code ou un graphe Blueprint... (Ctrl+Entree pour envoyer)"></textarea>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button id="ai-send-btn" class="primary" style="padding:6px 12px;font-weight:600;height:32px;">Envoyer</button>
          <button id="ai-clear-btn" class="pf-dock-btn" title="Effacer l'historique" aria-label="Effacer historique" style="padding:4px 8px;">Effacer</button>
        </div>
      </div>
    </div>
  `;

  const dotEl = container.querySelector('#ai-status-dot');
  const labelEl = container.querySelector('#ai-status-label');
  const modelSelect = container.querySelector('#ai-model-select');
  const refreshBtn = container.querySelector('#ai-refresh-models');
  const toggleSettingsBtn = container.querySelector('#ai-toggle-settings');
  const settingsDrawer = container.querySelector('#ai-settings-drawer');
  const endpointInput = container.querySelector('#ai-endpoint-input');
  const tempInput = container.querySelector('#ai-temp-input');
  const testBtn = container.querySelector('#ai-test-btn');
  const chatBody = container.querySelector('#ai-chat-body');
  const promptInput = container.querySelector('#ai-prompt-input');
  const sendBtn = container.querySelector('#ai-send-btn');
  const clearBtn = container.querySelector('#ai-clear-btn');

  const ctxObj = container.querySelector('#ai-ctx-obj');
  const ctxGd = container.querySelector('#ai-ctx-gd');
  const ctxBp = container.querySelector('#ai-ctx-bp');

  ctxObj.onchange = () => { includeActiveObject = ctxObj.checked; };
  ctxGd.onchange = () => { includeGameDesign = ctxGd.checked; };
  ctxBp.onchange = () => { includeBlueprints = ctxBp.checked; };

  toggleSettingsBtn.onclick = () => {
    const isHidden = settingsDrawer.style.display === 'none';
    settingsDrawer.style.display = isHidden ? 'flex' : 'none';
  };

  async function checkServer() {
    dotEl.className = 'pf-ai-status-dot';
    labelEl.textContent = 'Connexion...';
    const res = await testConnection(config.endpoint);
    if (res.ok) {
      isOnline = true;
      dotEl.className = 'pf-ai-status-dot online';
      labelEl.textContent = 'Pret (Local)';
      models = res.models;
      updateModelOptions();
    } else {
      isOnline = false;
      dotEl.className = 'pf-ai-status-dot offline';
      labelEl.textContent = 'Non connecte';
    }
  }

  function updateModelOptions() {
    modelSelect.innerHTML = '';
    if (!models.length) {
      const opt = document.createElement('option');
      opt.value = config.model;
      opt.textContent = config.model;
      modelSelect.appendChild(opt);
      return;
    }
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === config.model) opt.selected = true;
      modelSelect.appendChild(opt);
    });
  }

  modelSelect.onchange = () => {
    config.model = modelSelect.value;
    saveAiConfig(config);
  };

  refreshBtn.onclick = () => checkServer();
  testBtn.onclick = () => {
    config.endpoint = endpointInput.value.trim();
    config.temperature = parseFloat(tempInput.value) || 0.7;
    saveAiConfig(config);
    checkServer();
  };

  function getActiveObject() {
    const selId = store.ui.selectedObjectId;
    if (!selId || !store.project?.objects) return null;
    return store.project.objects.find((o) => o.id === selId) || null;
  }

  function renderMessage(role, text) {
    const msgEl = document.createElement('div');
    msgEl.className = `pf-ai-msg ${role}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'pf-ai-msg-header';
    headerEl.textContent = role === 'user' ? 'Vous' : 'Assistant PixelForge';
    msgEl.appendChild(headerEl);

    if (role === 'user') {
      const p = document.createElement('div');
      p.textContent = text;
      msgEl.appendChild(p);
    } else {
      // Format assistant message with code blocks
      const contentEl = document.createElement('div');
      formatAssistantContent(contentEl, text);
      msgEl.appendChild(contentEl);
    }

    chatBody.appendChild(msgEl);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msgEl;
  }

  function formatAssistantContent(containerEl, text) {
    containerEl.innerHTML = '';
    const parts = text.split(/(```[\s\S]*?```)/g);

    parts.forEach((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstLineEnd = part.indexOf('\n');
        const lang = part.slice(3, firstLineEnd).trim().toLowerCase();
        const code = part.slice(firstLineEnd + 1, -3).trim();

        const blockEl = document.createElement('div');
        blockEl.className = 'pf-ai-code-block';

        const headerEl = document.createElement('div');
        headerEl.className = 'pf-ai-code-header';
        headerEl.innerHTML = `<span>${lang.toUpperCase() || 'CODE'}</span>`;

        const actionsEl = document.createElement('div');
        actionsEl.className = 'pf-ai-code-actions';

        // Action Copier
        const copyBtn = document.createElement('button');
        copyBtn.className = 'pf-dock-btn';
        copyBtn.style.padding = '2px 6px';
        copyBtn.textContent = 'Copier';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(code);
          copyBtn.textContent = 'Copie !';
          setTimeout(() => { copyBtn.textContent = 'Copier'; }, 1500);
        };
        actionsEl.appendChild(copyBtn);

        // Action Remplacer le script JS
        if (lang === 'js' || lang === 'javascript') {
          const applyBtn = document.createElement('button');
          applyBtn.className = 'pf-dock-btn';
          applyBtn.style.padding = '2px 6px';
          applyBtn.textContent = 'Remplacer script actif';
          applyBtn.onclick = () => {
            const activeObj = getActiveObject();
            if (!activeObj) {
              alert("Veuillez d'abord selectionner un objet dans l'arbre de ressources.");
              return;
            }
            activeObj.script = { mode: 'code', code, graph: null };
            store.emit('change', 'script');
            applyBtn.textContent = 'Script applique !';
            setTimeout(() => { applyBtn.textContent = 'Remplacer script actif'; }, 1800);
          };
          actionsEl.appendChild(applyBtn);
        }

        // Action Appliquer le Blueprint JSON
        if (lang === 'json') {
          try {
            const parsed = JSON.parse(code);
            if (Array.isArray(parsed.nodes) && Array.isArray(parsed.links)) {
              const bpBtn = document.createElement('button');
              bpBtn.className = 'pf-dock-btn';
              bpBtn.style.padding = '2px 6px';
              bpBtn.textContent = 'Appliquer graphe Blueprint';
              bpBtn.onclick = () => {
                const activeObj = getActiveObject();
                if (!activeObj) {
                  alert("Veuillez d'abord selectionner un objet dans l'arbre de ressources.");
                  return;
                }
                const compiled = compileGraph(parsed, store.project, activeObj.name);
                activeObj.script = { mode: 'graph', graph: parsed, code: compiled.code };
                store.emit('change', 'script');
                bpBtn.textContent = 'Graphe applique !';
                setTimeout(() => { bpBtn.textContent = 'Appliquer graphe Blueprint'; }, 1800);
              };
              actionsEl.appendChild(bpBtn);
            }
          } catch {}
        }

        headerEl.appendChild(actionsEl);
        blockEl.appendChild(headerEl);

        const pre = document.createElement('pre');
        pre.className = 'pf-ai-code-pre';
        pre.textContent = code;
        blockEl.appendChild(pre);

        containerEl.appendChild(blockEl);
      } else {
        const textLines = part.trim();
        if (textLines) {
          const p = document.createElement('p');
          p.style.margin = '4px 0';
          p.style.whiteSpace = 'pre-wrap';
          p.textContent = textLines;
          containerEl.appendChild(p);
        }
      }
    });
  }

  async function handleSend() {
    const text = promptInput.value.trim();
    if (!text || isStreaming) return;

    promptInput.value = '';
    renderMessage('user', text);
    history.push({ role: 'user', content: text });

    const activeObj = includeActiveObject ? getActiveObject() : null;
    const activeScript = activeObj?.script?.code || '';

    const systemPrompt = buildSystemPrompt({
      includeGameDesign,
      includeBlueprints,
      activeObject: activeObj,
      activeScript,
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    isStreaming = true;
    sendBtn.textContent = 'Arreter';
    sendBtn.className = 'danger';
    abortController = new AbortController();

    const assistantMsgEl = document.createElement('div');
    assistantMsgEl.className = 'pf-ai-msg assistant';
    assistantMsgEl.innerHTML = `
      <div class="pf-ai-msg-header">Assistant PixelForge</div>
      <div class="pf-ai-msg-content" style="color:var(--fg-2);">Generation en cours...</div>
    `;
    chatBody.appendChild(assistantMsgEl);
    chatBody.scrollTop = chatBody.scrollHeight;
    const contentEl = assistantMsgEl.querySelector('.pf-ai-msg-content');

    let currentResponse = '';

    try {
      await sendChatRequest({
        endpoint: config.endpoint,
        model: config.model,
        messages,
        temperature: config.temperature,
        stream: true,
        signal: abortController.signal,
        onChunk: (chunk, fullText) => {
          currentResponse = fullText;
          formatAssistantContent(contentEl, fullText);
          chatBody.scrollTop = chatBody.scrollHeight;
        },
      });

      history.push({ role: 'assistant', content: currentResponse });
    } catch (err) {
      if (err.name === 'AbortError') {
        contentEl.innerHTML += '<p style="color:var(--fg-2);font-style:italic;">(Reponse interrompue)</p>';
      } else {
        contentEl.innerHTML = `<p style="color:var(--danger);font-weight:600;">Erreur : ${err.message}</p>
        <p style="font-size:11px;color:var(--fg-2);">Assurez-vous que LM Studio ou Ollama est demarre avec le serveur local active sur ${config.endpoint}.</p>`;
      }
    } finally {
      isStreaming = false;
      sendBtn.textContent = 'Envoyer';
      sendBtn.className = 'primary';
      abortController = null;
    }
  }

  sendBtn.onclick = () => {
    if (isStreaming) {
      abortController?.abort();
    } else {
      handleSend();
    }
  };

  promptInput.onkeydown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  clearBtn.onclick = () => {
    history = [];
    chatBody.innerHTML = '';
  };

  // Clic sur les suggestions
  container.querySelectorAll('.pf-ai-chip').forEach((btn) => {
    btn.onclick = () => {
      promptInput.value = btn.dataset.prompt;
      promptInput.focus();
    };
  });

  // Message d'accueil
  renderMessage(
    'assistant',
    `Bienvenue dans l'Assistant IA de PixelForge Studio !
Je suis connecte a votre serveur IA local (compatible LM Studio et Ollama sur ${config.endpoint}).
Vous pouvez me demander d'ecrire un script de mouvement, de concevoir un patron de jeu avec Coyote Time ou d'assembler un graphe Blueprint complet.`
  );

  // Verification initiale
  checkServer();

  return {
    dispose: () => {
      abortController?.abort();
    },
  };
}
