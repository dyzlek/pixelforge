/**
 * PixelForge Studio — Panneau Console & Débogage distant (Godot 4 style)
 * Capture des logs d'exécution et inspection des instances vivantes en jeu.
 */

import './console.css';
import { getIconSvg } from '../icons.js';

function getDebugSnapshot() {
  return typeof globalThis !== 'undefined' && globalThis.__pfDebugSnapshot
    ? globalThis.__pfDebugSnapshot()
    : null;
}

export function createConsolePanel(container, store, workspace) {
  let activeTab = 'logs'; // 'logs' | 'remote'
  let filterText = '';
  let logs = [];
  let pollTimer = null;

  container.innerHTML = `
    <div class="pf-console-panel">
      <div class="pf-con-bar">
        <div class="pf-con-tabs">
          <button class="pf-con-tab-btn active" data-tab="logs">Console & Sortie</button>
          <button class="pf-con-tab-btn" data-tab="remote">Scène en jeu (Distant)</button>
        </div>
        <div class="pf-con-actions">
          <input type="search" class="pf-con-search" placeholder="Filtrer…" spellcheck="false" />
          <button class="pf-dock-btn" data-act="clear" title="Effacer la console">Effacer</button>
        </div>
      </div>
      <div class="pf-con-log-list" id="pf-con-logs"></div>
      <div class="pf-con-remote-view" id="pf-con-remote" style="display:none"></div>
    </div>
  `;

  const logsEl = container.querySelector('#pf-con-logs');
  const remoteEl = container.querySelector('#pf-con-remote');
  const searchInput = container.querySelector('.pf-con-search');

  // Commutateur d'onglets internes
  container.querySelectorAll('.pf-con-tab-btn').forEach((btn) => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      container.querySelectorAll('.pf-con-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      logsEl.style.display = activeTab === 'logs' ? 'flex' : 'none';
      remoteEl.style.display = activeTab === 'remote' ? 'block' : 'none';
      if (activeTab === 'remote') renderRemote();
    };
  });

  searchInput.oninput = () => {
    filterText = searchInput.value.trim().toLowerCase();
    renderLogs();
  };

  container.querySelector('[data-act="clear"]').onclick = () => {
    logs = [];
    renderLogs();
  };

  function addLog(msg, level = 'info') {
    const time = new Date().toLocaleTimeString();
    logs.push({ msg: String(msg), level, time });
    if (logs.length > 500) logs.shift();
    if (activeTab === 'logs') {
      renderLogs();
      logsEl.scrollTop = logsEl.scrollHeight;
    }
  }

  function renderLogs() {
    logsEl.innerHTML = '';
    const filtered = logs.filter((l) => !filterText || l.msg.toLowerCase().includes(filterText));
    if (filtered.length === 0) {
      logsEl.innerHTML = `
        <div style="padding:16px;color:var(--fg-2);font-style:italic;display:flex;align-items:center;gap:8px;">
          ${getIconSvg('info', 14)}
          <span>${filterText ? 'Aucun log ne correspond au filtre.' : 'Aucun message dans la console. Les logs et erreurs s\'afficheront ici lors du test.'}</span>
        </div>
      `;
      return;
    }
    for (const l of filtered) {
      const line = document.createElement('div');
      line.className = `pf-con-line pf-con-${l.level}`;
      line.innerHTML = `<span class="pf-con-time">${l.time}</span><span>${escapeHtml(l.msg)}</span>`;

      // Clic sur une erreur : tentative de redirection vers l'objet ou nœud concerné
      if (l.level === 'error') {
        line.title = 'Cliquez pour ouvrir le script concerné';
        line.onclick = () => {
          // Cherche si un nom d'objet apparaît dans le message
          const p = store.project;
          for (const obj of p.objects || []) {
            if (l.msg.includes(obj.name)) {
              workspace.open({ kind: 'objects', refId: obj.id, title: obj.name });
              return;
            }
          }
          // Repli sur le premier objet
          if (p.objects?.[0]) {
            workspace.open({ kind: 'objects', refId: p.objects[0].id, title: p.objects[0].name });
          }
        };
      }

      logsEl.appendChild(line);
    }
  }

  function renderRemote() {
    const snap = getDebugSnapshot();
    if (!snap || !snap.instances || snap.instances.length === 0) {
      remoteEl.innerHTML = `
        <div style="padding:16px;color:var(--fg-2);font-style:italic;">
          Le jeu n'est pas en cours d'exécution. Lancez le jeu (F5) pour voir les entités et variables vivantes en temps réel.
        </div>
      `;
      return;
    }

    const is3D = snap.instances.some((i) => i.z !== undefined) || snap.blocks !== undefined;

    let rowsHtml = '';
    for (const inst of snap.instances) {
      const varsJson = JSON.stringify(inst.vars || {});
      const posText = is3D ? `${inst.x}, ${inst.y}, ${inst.z ?? 0}` : `${inst.x}, ${inst.y}`;
      const velText = is3D ? `${inst.vx}, ${inst.vy}, ${inst.vz ?? 0}` : `${inst.vx}, ${inst.vy}`;
      rowsHtml += `
        <tr>
          <td>#${inst.id}</td>
          <td style="font-weight:600;color:var(--accent)">${escapeHtml(inst.name)}</td>
          <td>${posText}</td>
          <td>${velText}</td>
          <td>${inst.onGround ? 'Oui' : 'Non'}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg-1);" title="${escapeHtml(varsJson)}">
            ${escapeHtml(varsJson)}
          </td>
        </tr>
      `;
    }

    remoteEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;margin-bottom:4px;border-bottom:1px solid var(--border);color:var(--fg-1)">
        <span>${is3D ? 'Scène active' : 'Carte active'} : <strong>${escapeHtml(snap.mapName || snap.scene || 'Principale')}</strong> (${snap.instances.length} instance(s)${snap.blocks !== undefined ? `, ${snap.blocks} blocs` : ''})</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="pf-dock-btn" data-remote-act="pause" title="Pause / Reprendre">${snap.isPaused ? 'Reprendre' : 'Pause'}</button>
          <button class="pf-dock-btn" data-remote-act="step" title="Avancer d'une image">Image</button>
          <button class="pf-dock-btn ${snap.debugColliders ? 'active' : ''}" data-remote-act="colliders" title="Afficher/masquer colliders">Colliders</button>
          <span style="color:var(--success)">${snap.fps} FPS</span>
        </div>
      </div>
      <table class="pf-remote-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nom</th>
            <th>Position (${is3D ? 'X, Y, Z' : 'X, Y'})</th>
            <th>Vitesse (${is3D ? 'Vx, Vy, Vz' : 'Vx, Vy'})</th>
            <th>Au sol</th>
            <th>Variables (vars)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  remoteEl.onclick = (e) => {
    const btn = e.target.closest('[data-remote-act]');
    if (!btn) return;
    const act = btn.dataset.remoteAct;
    if (act === 'pause') {
      const snap = getDebugSnapshot();
      if (snap?.isPaused) {
        globalThis.__pfPlayResume?.();
      } else {
        globalThis.__pfPlayPause?.();
      }
    } else if (act === 'step') {
      globalThis.__pfPlayStep?.();
    } else if (act === 'colliders') {
      globalThis.__pfPlayToggleColliders?.();
    }
    renderRemote();
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  // Écoute des logs émis par le runtime
  const offLog = store.on('log', (entry) => {
    addLog(entry.msg, entry.level);
  });

  // Polling de l'inspecteur distant à 4 Hz
  pollTimer = setInterval(() => {
    if (activeTab === 'remote') renderRemote();
  }, 250);

  // Message d'accueil
  addLog('PixelForge Studio v3.0 console prête.', 'sys');

  return () => {
    offLog();
    clearInterval(pollTimer);
  };
}
