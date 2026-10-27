/**
 * PixelForge Studio — Copilote IA integre par editeur
 * Phase H - H7 : l'IA copilote dans chaque editeur avec le contexte du document ouvert
 * et outils limites au document.
 */

import './editor-copilot.css';
import { runAgent, COPILOT_SUGGESTIONS, COPILOT_ALLOWED_TOOLS } from '../ai/agent.js';
import { getIconSvg } from './icons.js';

export { COPILOT_SUGGESTIONS, COPILOT_ALLOWED_TOOLS };

/**
 * Cree un bouton standard « Demander a l'IA » a inserer dans la barre d'outils d'un editeur.
 *
 * @param {object} options
 * @param {object} options.store - PixelForge store
 * @param {string} options.docKind - Type de document ('script', 'sprite', 'map', 'song', 'scene3d')
 * @param {Function} options.getContext - Fonction renvoyant le contexte actuel ({ docName, docId, ... })
 * @param {Array<string>} [options.allowedTools] - Outils autorises
 * @param {Array<string>} [options.suggestions] - Suggestions textuelles
 * @param {Function} [options.onApplied] - Callback apres application des modifications
 * @returns {HTMLButtonElement}
 */
export function createEditorCopilotButton(options) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pf-copilot-btn';
  btn.title = 'Demander de l\'aide a l\'IA sur ce document (contexte cible)';
  btn.innerHTML = `${getIconSvg('ai', 11)} Demander a l'IA`;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEditorCopilotModal(options);
  });

  return btn;
}

/**
 * Ouvre la fenetre contextuelle du copilote pour le document actif.
 *
 * @param {object} options
 */
export function openEditorCopilotModal(options) {
  const {
    store,
    docKind,
    getContext = () => ({}),
    allowedTools = COPILOT_ALLOWED_TOOLS[docKind] || [],
    suggestions = COPILOT_SUGGESTIONS[docKind] || [],
    onApplied = () => {},
  } = options;

  const ctx = getContext() || {};
  const docName = ctx.docName || ctx.title || docKind;
  const docId = ctx.docId || ctx.refId || '';

  // Fermer d'eventuels modals precedents
  closeExistingModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'pf-copilot-modal-backdrop';
  backdrop.id = 'pf-copilot-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'pf-copilot-modal';

  modal.innerHTML = `
    <div class="pf-copilot-head">
      <div class="pf-copilot-title-group">
        ${getIconSvg('ai', 14)}
        <strong>Copilote IA</strong>
        <span class="pf-copilot-badge">${docKind}</span>
        <span style="color:var(--fg-1);font-weight:600;">${docName}</span>
      </div>
      <button class="pf-copilot-close" title="Fermer (Echap)">&times;</button>
    </div>

    <div class="pf-copilot-body">
      <div style="font-size:11px;color:var(--fg-2);">
        L'IA dispose des outils specifiques a cet editeur : <em>${allowedTools.join(', ')}</em>.
      </div>

      <div class="pf-copilot-suggestions">
        ${suggestions.map((s) => `<button type="button" class="pf-copilot-chip" data-prompt="${s}">${s}</button>`).join('')}
      </div>

      <textarea class="pf-copilot-textarea" id="pf-copilot-prompt" placeholder="Exprimez votre demande pour ce document (Ctrl+Entree pour envoyer)..."></textarea>

      <div class="pf-copilot-status" id="pf-copilot-status">
        <div id="pf-copilot-status-msg">Traitement en cours...</div>
        <div class="pf-copilot-steps" id="pf-copilot-steps"></div>
      </div>
    </div>

    <div class="pf-copilot-foot">
      <div class="pf-copilot-hint">Ctrl+Z pour annuler l'action</div>
      <div class="pf-copilot-actions">
        <button type="button" class="pf-dock-btn" id="pf-copilot-cancel-btn">Annuler</button>
        <button type="button" class="primary" id="pf-copilot-submit-btn" style="padding:4px 14px;font-weight:600;">Appliquer</button>
      </div>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const promptInput = modal.querySelector('#pf-copilot-prompt');
  const submitBtn = modal.querySelector('#pf-copilot-submit-btn');
  const cancelBtn = modal.querySelector('#pf-copilot-cancel-btn');
  const closeBtn = modal.querySelector('.pf-copilot-close');
  const statusEl = modal.querySelector('#pf-copilot-status');
  const statusMsg = modal.querySelector('#pf-copilot-status-msg');
  const stepsEl = modal.querySelector('#pf-copilot-steps');

  let isProcessing = false;
  let abortCtrl = null;

  function close() {
    if (abortCtrl) abortCtrl.abort();
    backdrop.remove();
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runCopilot();
    }
  }

  document.addEventListener('keydown', onKeyDown);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Clic sur les suggestions
  modal.querySelectorAll('.pf-copilot-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.dataset.prompt;
      promptInput.focus();
    });
  });

  async function runCopilot() {
    const text = promptInput.value.trim();
    if (!text || isProcessing) return;

    isProcessing = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'En cours...';
    statusEl.className = 'pf-copilot-status running';
    statusMsg.textContent = 'Traitement de votre demande par l\'agent IA...';
    stepsEl.innerHTML = '';

    abortCtrl = new AbortController();

    try {
      const fullContext = {
        docKind,
        docName,
        docId,
        allowedTools,
        ...getContext(),
      };

      const result = await runAgent({
        project: store.project,
        prompt: `[Contexte : document "${docName}" (${docKind})]\n${text}`,
        store,
        signal: abortCtrl.signal,
        allowedTools,
        context: fullContext,
        onStep: (step) => {
          const item = document.createElement('div');
          item.className = 'pf-copilot-step-item';
          item.textContent = `Outil "${step.tool}" : execution ${step.status}...`;
          stepsEl.appendChild(item);
        },
      });

      statusEl.className = 'pf-copilot-status success';
      statusMsg.textContent = 'Modifications appliquees avec succes dans le document !';
      submitBtn.textContent = 'Termine';

      onApplied(result);

      setTimeout(() => {
        close();
      }, 1200);
    } catch (err) {
      statusEl.className = 'pf-copilot-status error';
      statusMsg.textContent = 'Erreur : ' + (err.message || String(err));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reessayer';
      isProcessing = false;
    }
  }

  submitBtn.addEventListener('click', runCopilot);
  promptInput.focus();
}

function closeExistingModal() {
  const existing = document.getElementById('pf-copilot-modal-backdrop');
  if (existing) existing.remove();
}
