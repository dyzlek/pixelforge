/**
 * PixelForge Studio — Panneau Assistant IA Local (LM Studio / Ollama / OpenAI-compatible / Claude)
 * Permet d'echanger avec un LLM, d'executer des actions directes sur le projet avec apercu,
 * d'annuler/refaire les modifications et d'ouvrir les ressources creees d'un clic.
 */

import { testConnection, fetchModels, DEFAULT_AI_CONFIG } from '../../ai/client.js';
import { runAgent } from '../../ai/agent.js';
import { compileGraph } from '../../graph/compile.js';
import { getIconSvg } from '../icons.js';
import './ai-assistant.css';

const STORAGE_KEY = 'pixelforge.ai.config';

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

/**
 * Ouvre la ressource cible dans l'editeur correspondant
 */
export function openResource(store, workspace, toolName, args = {}) {
  if (!workspace || typeof workspace.open !== 'function') return;
  const p = store?.project;
  if (!p) return;

  switch (toolName) {
    case 'generate_asset': {
      const type = String(args.type || '').toLowerCase();
      if (type === 'sprite') {
        const sp = (p.sprites || []).find((s) => s.name === args.name || s.id === args.name);
        if (sp) {
          workspace.open({ kind: 'pixel', refId: sp.id, title: sp.name });
          store.setSelection?.({ type: 'sprite', id: sp.id });
        }
      } else if (type === 'song' || type === 'music') {
        const sng = (p.songs || []).find((s) => s.name === args.name || s.id === args.name);
        if (sng) {
          workspace.open({ kind: 'song', refId: sng.id, title: sng.name });
          store.setSelection?.({ type: 'song', id: sng.id });
        }
      } else if (type === 'model' || type === 'model3d' || type === 'voxel') {
        const mod = (p.models || []).find((m) => m.name === args.name || m.id === args.name);
        if (mod) {
          workspace.open({ kind: 'voxel', refId: mod.id, title: mod.name });
          store.setSelection?.({ type: 'voxel', id: mod.id });
        }
      } else if (type === 'sound' || type === 'sfx') {
        const snd = (p.sounds || []).find((s) => s.name === args.name || s.id === args.name);
        if (snd) {
          workspace.open({ kind: 'sound', refId: snd.id, title: snd.name });
          store.setSelection?.({ type: 'sound', id: snd.id });
        }
      }
      break;
    }
    case 'upsert_sprite':
    case 'get_sprite': {
      const sp = (p.sprites || []).find((s) => s.name === args.name || s.id === args.name);
      if (sp) {
        workspace.open({ kind: 'pixel', refId: sp.id, title: sp.name });
        store.setSelection?.({ type: 'sprite', id: sp.id });
      }
      break;
    }
    case 'upsert_object':
    case 'set_script':
    case 'get_script': {
      const targetName = args.name || args.object;
      const obj = (p.objects || []).find((o) => o.name === targetName || o.id === targetName);
      if (obj) {
        workspace.open({ kind: 'objects', refId: obj.id, title: obj.name });
        store.setSelection?.({ type: 'object', id: obj.id });
      }
      break;
    }
    case 'upsert_map':
    case 'paint_map':
    case 'set_layer': {
      const mapName = args.name || args.map;
      const m = (p.maps || []).find((x) => x.name === mapName || x.id === mapName);
      if (m) {
        workspace.open({ kind: 'map', refId: m.id, title: m.name });
        store.setSelection?.({ type: 'map', id: m.id });
      }
      break;
    }
    case 'place_entities': {
      if (args.scene) {
        const sc = (p.scenes3d || []).find((s) => s.name === args.scene || s.id === args.scene);
        if (sc) {
          workspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
          store.setSelection?.({ type: 'scene3d', id: sc.id });
        }
      } else {
        const mapName = args.map || p.maps?.[0]?.name;
        const m = (p.maps || []).find((x) => x.name === mapName || x.id === mapName);
        if (m) {
          workspace.open({ kind: 'map', refId: m.id, title: m.name });
          store.setSelection?.({ type: 'map', id: m.id });
        }
      }
      break;
    }
    case 'add_sound': {
      const snd = (p.sounds || []).find((s) => s.name === args.name || s.id === args.name);
      if (snd) {
        workspace.open({ kind: 'sound', refId: snd.id, title: snd.name });
        store.setSelection?.({ type: 'sound', id: snd.id });
      }
      break;
    }
    case 'upsert_song':
    case 'get_song': {
      const sng = (p.songs || []).find((s) => s.name === args.name || s.id === args.name);
      if (sng) {
        workspace.open({ kind: 'song', refId: sng.id, title: sng.name });
        store.setSelection?.({ type: 'song', id: sng.id });
      }
      break;
    }
    case 'upsert_model':
    case 'get_model': {
      const mod = (p.models || []).find((m) => m.name === args.name || m.id === args.name);
      if (mod) {
        workspace.open({ kind: 'voxel', refId: mod.id, title: mod.name });
        store.setSelection?.({ type: 'voxel', id: mod.id });
      }
      break;
    }
    case 'upsert_scene3d':
    case 'paint_gridmap':
    case 'render_scene3d': {
      const sceneName = args.name || args.scene;
      const sc = (p.scenes3d || []).find((s) => s.name === sceneName || s.id === sceneName);
      if (sc) {
        workspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
        store.setSelection?.({ type: 'scene3d', id: sc.id });
      }
      break;
    }
    case 'render_map': {
      const m = (p.maps || []).find((x) => x.name === args.map || x.id === args.map);
      if (m) {
        workspace.open({ kind: 'map', refId: m.id, title: m.name });
        store.setSelection?.({ type: 'map', id: m.id });
      }
      break;
    }
  }
}

/**
 * Formatage d'un intitule lisible pour chaque outil
 */
function formatStepLabel(name, args = {}) {
  switch (name) {
    case 'upsert_sprite':
      return `Creation / mise a jour du sprite "${args.name || ''}"`;
    case 'get_sprite':
      return `Inspection du sprite "${args.name || ''}"`;
    case 'upsert_object':
      return `Creation / configuration de l'objet "${args.name || ''}"`;
    case 'set_script':
      return `Mise a jour du script de "${args.object || ''}"`;
    case 'get_script':
      return `Lecture du script de "${args.object || ''}"`;
    case 'upsert_map':
      return `Creation / dimensionnement de la carte "${args.name || ''}"`;
    case 'paint_map':
      return `Peinture de tuiles sur le calque "${args.layer || ''}" (${args.map || ''})`;
    case 'set_layer':
      return `Configuration du calque "${args.layer || ''}" (${args.map || ''})`;
    case 'place_entities': {
      const count = args.entities?.length || (args.rows ? 'grille' : '1');
      return `Placement de ${count} instance(s) sur "${args.map || args.scene || ''}"`;
    }
    case 'add_sound':
      return `Effet sonore "${args.name || ''}" (${args.preset || ''})`;
    case 'upsert_song':
      return `Musique tracker "${args.name || ''}"`;
    case 'get_song':
      return `Lecture du morceau "${args.name || ''}"`;
    case 'upsert_model':
      return `Modele 3D voxel "${args.name || ''}"`;
    case 'get_model':
      return `Lecture du modele 3D "${args.name || ''}"`;
    case 'upsert_scene3d':
      return `Configuration de la scene 3D "${args.name || ''}"`;
    case 'paint_gridmap':
      return `Peinture de blocs 3D au niveau Y=${args.level ?? 0} (${args.scene || ''})`;
    case 'set_settings':
      return `Mise a jour des parametres du projet`;
    case 'validate_game':
      return `Verification de l'integrite du projet`;
    case 'render_map':
      return `Visualisation de la carte "${args.map || ''}"`;
    case 'render_scene3d':
      return `Visualisation de la scene 3D "${args.scene || ''}"`;
    case 'list_nodes':
      return `Consultation du catalogue de noeuds`;
    case 'generate_asset':
      return `Generation de ${args.type || 'ressource'} "${args.name || ''}" (${args.description || ''})`;
    case 'generate_game':
      return `Generation d un jeu complet 3 niveaux (${args.dimension || '2D'})`;
    default:
      return `${name}`;
  }
}

export function createAiAssistantPanel(container, store, workspace) {
  let config = loadAiConfig();
  let models = [];
  let isOnline = false;
  let isRunning = false;
  let abortController = null;
  let history = [];

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

    <div class="pf-ai-actions-bar">
      <div class="pf-ai-history-btns">
        <button id="ai-undo-btn" class="pf-dock-btn" title="Annuler la derniere action (Ctrl+Z)" disabled style="padding:2px 8px;font-size:11px;">
          Annuler
        </button>
        <button id="ai-redo-btn" class="pf-dock-btn" title="Refaire la derniere action (Ctrl+Y)" disabled style="padding:2px 8px;font-size:11px;">
          Refaire
        </button>
      </div>
      <div style="color:var(--fg-2);font-size:10px;">
        Actions atomiques (Ctrl+Z annule tout)
      </div>
    </div>

    <div class="pf-ai-settings-drawer" id="ai-settings-drawer" style="display:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <label style="color:var(--fg-1);">Endpoint URL :</label>
        <input type="text" id="ai-endpoint-input" class="pf-insp-input" value="${config.endpoint}" style="flex:1;" />
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <label style="color:var(--fg-1);">Cle API (Claude ou Cloud) :</label>
        <input type="password" id="ai-apikey-input" class="pf-insp-input" value="${config.apiKey || ''}" placeholder="Optionnel en local" style="flex:1;" />
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <label style="color:var(--fg-1);">Temperature :</label>
        <input type="number" id="ai-temp-input" class="pf-insp-input" value="${config.temperature}" min="0" max="2" step="0.1" style="width:70px;" />
        <button id="ai-test-btn" class="pf-dock-btn" style="padding:3px 8px;">Tester la connexion</button>
      </div>
    </div>

    <div class="pf-ai-chips-bar">
      <button class="pf-ai-chip" data-prompt="Fais-moi un jeu de plateforme avec 3 niveaux et un boss">Jeu complet 3 niveaux</button>
      <button class="pf-ai-chip" data-prompt="Ajoute une piece qui rapporte 10 points et place-en 5 sur la carte">Piece collectible</button>
      <button class="pf-ai-chip" data-prompt="Cree un script de plateforme complet pour le joueur avec Coyote Time et Jump Buffering">Saut plateforme pro</button>
      <button class="pf-ai-chip" data-prompt="Cree un ennemi patrouilleur qui fait demi-tour aux murs et elimine le joueur s'il est touche de cote">Ennemi patrouilleur</button>
      <button class="pf-ai-chip" data-prompt="Cree un effet sonore laser retro et un son de saut dynamique">Effets sonores</button>
      <button class="pf-ai-chip" data-prompt="Valide le projet entier et affiche le rendu ASCII de la carte">Auditer le niveau</button>
    </div>

    <div class="pf-ai-chat-body" id="ai-chat-body"></div>

    <div class="pf-ai-input-area">
      <div class="pf-ai-input-row">
        <textarea id="ai-prompt-input" class="pf-ai-textarea" placeholder="Demandez a l'IA de creer des objets, coder, placer des entites... (Ctrl+Entree pour envoyer)"></textarea>
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
  const apiKeyInput = container.querySelector('#ai-apikey-input');
  const tempInput = container.querySelector('#ai-temp-input');
  const testBtn = container.querySelector('#ai-test-btn');
  const undoBtn = container.querySelector('#ai-undo-btn');
  const redoBtn = container.querySelector('#ai-redo-btn');
  const chatBody = container.querySelector('#ai-chat-body');
  const promptInput = container.querySelector('#ai-prompt-input');
  const sendBtn = container.querySelector('#ai-send-btn');
  const clearBtn = container.querySelector('#ai-clear-btn');

  // Mise a jour de l'etat des boutons d'annulation
  function syncHistoryBtns() {
    if (!store) return;
    undoBtn.disabled = !store.canUndo;
    redoBtn.disabled = !store.canRedo;
  }
  syncHistoryBtns();
  const unsubs = [];
  if (store?.on) {
    unsubs.push(store.on('history', syncHistoryBtns));
    unsubs.push(store.on('change', syncHistoryBtns));
  }

  undoBtn.onclick = () => {
    store.undo?.();
    syncHistoryBtns();
  };

  redoBtn.onclick = () => {
    store.redo?.();
    syncHistoryBtns();
  };

  toggleSettingsBtn.onclick = () => {
    const isHidden = settingsDrawer.style.display === 'none';
    settingsDrawer.style.display = isHidden ? 'flex' : 'none';
  };

  async function checkServer() {
    dotEl.className = 'pf-ai-status-dot';
    labelEl.textContent = 'Connexion...';
    const res = await testConnection(config.endpoint, config.apiKey);
    if (res.ok) {
      isOnline = true;
      dotEl.className = 'pf-ai-status-dot online';
      labelEl.textContent = 'Pret';
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
    config.apiKey = apiKeyInput.value.trim();
    config.temperature = parseFloat(tempInput.value) || 0.7;
    saveAiConfig(config);
    checkServer();
  };

  function getActiveObject() {
    const selId = store?.ui?.selectedObjectId;
    if (!selId || !store?.project?.objects) return null;
    return store.project.objects.find((o) => o.id === selId) || null;
  }

  function renderMessage(role, text) {
    const msgEl = document.createElement('div');
    msgEl.className = `pf-ai-msg ${role}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'pf-ai-msg-header';
    headerEl.textContent = role === 'user' ? 'Vous' : 'Assistant PixelForge';
    msgEl.appendChild(headerEl);

    const contentEl = document.createElement('div');
    contentEl.className = 'pf-ai-msg-content';
    if (role === 'user') {
      contentEl.textContent = text;
    } else {
      formatAssistantContent(contentEl, text);
    }
    msgEl.appendChild(contentEl);

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
          navigator.clipboard?.writeText(code);
          copyBtn.textContent = 'Copie !';
          setTimeout(() => { copyBtn.textContent = 'Copier'; }, 1500);
        };
        actionsEl.appendChild(copyBtn);

        // Action Remplacer le script JS via store.update
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
            store.update((p) => {
              const o = p.objects.find((x) => x.id === activeObj.id);
              if (o) o.script = { mode: 'code', code, graph: null };
            }, 'script');
            applyBtn.textContent = 'Script applique !';
            setTimeout(() => { applyBtn.textContent = 'Remplacer script actif'; }, 1800);
          };
          actionsEl.appendChild(applyBtn);
        }

        // Action Appliquer le Blueprint JSON via store.update
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
                store.update((p) => {
                  const o = p.objects.find((x) => x.id === activeObj.id);
                  if (!o) return;
                  const compiled = compileGraph(parsed, {
                    isGlobal: false,
                    dimension: p.settings?.dimension || '2d',
                  });
                  o.script = { mode: 'graph', graph: parsed, code: compiled.code };
                }, 'script');
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

  /**
   * Envoi d'une requete a l'agent autonome
   */
  async function handleSend() {
    const text = promptInput.value.trim();
    if (!text || isRunning) return;

    promptInput.value = '';
    renderMessage('user', text);
    history.push({ role: 'user', content: text });

    isRunning = true;
    sendBtn.textContent = 'Arreter';
    sendBtn.className = 'danger';
    abortController = new AbortController();

    const assistantMsgEl = document.createElement('div');
    assistantMsgEl.className = 'pf-ai-msg assistant';
    assistantMsgEl.innerHTML = `
      <div class="pf-ai-msg-header">Assistant PixelForge</div>
      <div class="pf-ai-msg-content" style="color:var(--fg-2);">Traitement en cours...</div>
      <div class="pf-ai-steps-container"></div>
    `;
    chatBody.appendChild(assistantMsgEl);
    chatBody.scrollTop = chatBody.scrollHeight;

    const contentEl = assistantMsgEl.querySelector('.pf-ai-msg-content');
    const stepsContainer = assistantMsgEl.querySelector('.pf-ai-steps-container');
    const stepCardMap = new Map();

    try {
      const result = await runAgent({
        project: store.project,
        prompt: text,
        config,
        store,
        signal: abortController.signal,
        confirm: async ({ type, name, action }) => {
          return window.confirm(`L'assistant IA s'apprete a ecraser ou modifier la ressource existante : ${type} "${name}". Voulez-vous continuer ?`);
        },
        onChunk: (chunk, fullText) => {
          formatAssistantContent(contentEl, fullText);
          chatBody.scrollTop = chatBody.scrollHeight;
        },
        onStep: (step) => {
          const stepKey = step.id || `${step.name}_${step.args?.name || step.args?.object || step.args?.map || ''}`;
          let cardEl = stepCardMap.get(stepKey);

          if (!cardEl) {
            cardEl = document.createElement('div');
            cardEl.className = 'pf-ai-step-card';
            cardEl.innerHTML = `
              <div class="pf-ai-step-header">
                <span class="pf-ai-step-badge running">...</span>
                <span class="pf-ai-step-title"></span>
                <button class="pf-ai-step-open-btn" style="display:none;">Ouvrir</button>
              </div>
            `;
            stepsContainer.appendChild(cardEl);
            stepCardMap.set(stepKey, cardEl);
          }

          const badgeEl = cardEl.querySelector('.pf-ai-step-badge');
          const titleEl = cardEl.querySelector('.pf-ai-step-title');
          const openBtn = cardEl.querySelector('.pf-ai-step-open-btn');

          titleEl.textContent = formatStepLabel(step.name, step.args);

          if (step.status === 'running') {
            badgeEl.className = 'pf-ai-step-badge running';
            badgeEl.textContent = '...';
            openBtn.style.display = 'none';
          } else if (step.status === 'success') {
            badgeEl.className = 'pf-ai-step-badge success';
            badgeEl.textContent = 'OK';

            // Bouton pour ouvrir la ressource creee ou modifiee d'un clic
            const targetName = step.args?.name || step.args?.object || step.args?.map || step.args?.scene;
            if (targetName) {
              openBtn.textContent = `Ouvrir ${targetName}`;
              openBtn.style.display = 'inline-block';
              openBtn.onclick = () => {
                openResource(store, workspace, step.name, step.args);
              };
            }

            // Apercu optionnel si resultat ASCII ou validation
            if (step.result && (step.name === 'render_map' || step.name === 'render_scene3d' || step.name === 'validate_game')) {
              let prevEl = cardEl.querySelector('.pf-ai-step-preview');
              if (!prevEl) {
                prevEl = document.createElement('pre');
                prevEl.className = 'pf-ai-step-preview';
                cardEl.appendChild(prevEl);
              }
              prevEl.textContent = String(step.result);
            }
          } else if (step.status === 'error') {
            badgeEl.className = 'pf-ai-step-badge error';
            badgeEl.textContent = 'ERR';
            let prevEl = cardEl.querySelector('.pf-ai-step-preview');
            if (!prevEl) {
              prevEl = document.createElement('pre');
              prevEl.className = 'pf-ai-step-preview';
              cardEl.appendChild(prevEl);
            }
            prevEl.textContent = String(step.error || 'Erreur');
          }

          chatBody.scrollTop = chatBody.scrollHeight;
        },
      });

      if (result.content) {
        history.push({ role: 'assistant', content: result.content });
      }
      syncHistoryBtns();
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('annulee')) {
        contentEl.innerHTML += '<p style="color:var(--fg-2);font-style:italic;">(Action interrompue par l\'utilisateur — aucun changement applique au projet)</p>';
      } else {
        contentEl.innerHTML = `<p style="color:var(--danger);font-weight:600;">Erreur : ${err.message}</p>
        <p style="font-size:11px;color:var(--fg-2);">Verifiez la connexion a votre serveur IA local sur ${config.endpoint}.</p>`;
      }
    } finally {
      isRunning = false;
      sendBtn.textContent = 'Envoyer';
      sendBtn.className = 'primary';
      abortController = null;
      syncHistoryBtns();
    }
  }

  sendBtn.onclick = () => {
    if (isRunning) {
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
    `Bienvenue dans l'Assistant IA autonome de PixelForge Studio !
Je suis connecte a votre moteur et peux directement creer des sprites, objets, cartes, musiques, placer des entites ou auditer votre jeu.
Toutes les actions sont atomiques et reversibles en un seul clic sur Annuler (Ctrl+Z).`
  );

  // Verification initiale du serveur
  checkServer();

  return {
    dispose: () => {
      abortController?.abort();
      unsubs.forEach((fn) => fn && fn());
    },
  };
}
