/**
 * PixelForge Studio — Gestionnaire de Projets (Project Manager façon Godot 4)
 * Accueil, gestion, création via modèles, import/export et bascule de projets.
 */

import './project-manager.css';
import { listGames, getGame, saveGame, deleteGame, backendInfo, isValidId } from '../library/storage.js';
import { createEmptyProject, createMeta, normalizeProject } from '../core/project.js';
import { createSampleProject } from '../core/sample.js';
import { getIconSvg } from './icons.js';

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function relativeDate(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const s = Math.round((t - Date.now()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return "à l'instant";
}

function download(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createProjectManager(container, store, onOpenProject = () => {}) {
  let filterText = '';
  let sortBy = 'date'; // 'date' | 'name'
  let games = [];

  container.innerHTML = `
    <div class="pf-pm-root">
      <header class="pf-pm-header">
        <div class="pf-pm-brand">
          <span class="pf-pm-title">PixelForge Studio</span>
          <span class="pf-pm-version">v3.0</span>
        </div>
        <div class="pf-pm-toolbar">
          <input type="search" class="pf-pm-search" placeholder="Rechercher un projet…" spellcheck="false" />
          <select id="pf-pm-sort" class="pf-res-search" style="height:28px;">
            <option value="date">Plus récents d'abord</option>
            <option value="name">Par nom (A-Z)</option>
          </select>
          <button class="primary" data-act="new-project" style="height:28px;padding:0 12px;font-weight:600;">+ Nouveau projet</button>
          <button data-act="import-project" style="height:28px;padding:0 10px;">${getIconSvg('import', 12)} <span>Importer</span></button>
          <button data-act="sample-games" style="height:28px;padding:0 10px;">${getIconSvg('sparkles', 12)} <span>Jeux d'exemple</span></button>
          <input type="file" id="pf-pm-file-input" accept=".json,application/json" hidden multiple />
        </div>
      </header>

      <div class="pf-pm-grid" id="pf-pm-grid"></div>
    </div>
  `;

  const gridEl = container.querySelector('#pf-pm-grid');
  const searchInput = container.querySelector('.pf-pm-search');
  const sortSelect = container.querySelector('#pf-pm-sort');
  const fileInput = container.querySelector('#pf-pm-file-input');

  searchInput.oninput = () => {
    filterText = searchInput.value.trim().toLowerCase();
    renderGrid();
  };

  sortSelect.onchange = () => {
    sortBy = sortSelect.value;
    renderGrid();
  };

  fileInput.onchange = async () => {
    for (const file of fileInput.files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (!json.meta?.id) {
          json.meta = createMeta(json.name || file.name.replace(/\.json$/i, ''));
        }
        await saveGame(json);
      } catch (err) {
        alert(`Erreur lors de l'import de ${file.name}: ${err.message}`);
      }
    }
    await refreshGames();
  };

  async function refreshGames() {
    try {
      games = await listGames();
    } catch {
      games = [];
    }
    renderGrid();
  }

  function renderGrid() {
    gridEl.innerHTML = '';

    let list = games.filter((g) => {
      if (!filterText) return true;
      return (g.name || '').toLowerCase().includes(filterText) ||
             (g.description || '').toLowerCase().includes(filterText);
    });

    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      list.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
    }

    if (list.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--fg-2);">
          <div style="margin-bottom: 8px; color: var(--fg-2);">${getIconSvg('folder', 32)}</div>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--fg-1);">Aucun projet trouvé</div>
          <p style="margin: 0; font-size: 12px;">Créez un nouveau projet ou chargez les exemples pour démarrer.</p>
        </div>
      `;
      return;
    }

    for (const g of list) {
      const card = document.createElement('div');
      const isCurrent = store.currentId === g.id;
      card.className = `pf-pm-card${isCurrent ? ' active' : ''}`;

      let thumbHtml = `<div class="pf-pm-thumb-placeholder">${getIconSvg('project', 24)}</div>`;
      if (g.thumbnail) {
        thumbHtml = `<img src="${g.thumbnail}" class="pf-pm-thumb" alt="${g.name}" />`;
      }

      card.innerHTML = `
        <div class="pf-pm-thumb-box" data-open="${g.id}">
          ${thumbHtml}
        </div>
        <div class="pf-pm-body">
          <div class="pf-pm-name">
            <span>${escapeHtml(g.name || 'Sans titre')}</span>
            ${isCurrent ? '<span class="pf-pm-badge">Ouvert</span>' : ''}
          </div>
          <div class="pf-pm-desc">${escapeHtml(g.description || 'Projet PixelForge 2D')}</div>
          <div class="pf-pm-date">Modifié ${relativeDate(g.updatedAt)}</div>
        </div>
        <div class="pf-pm-actions">
          <button class="primary" data-open="${g.id}">Ouvrir</button>
          <button data-clone="${g.id}" title="Dupliquer le projet">Dupliquer</button>
          <button data-export="${g.id}" title="Télécharger le fichier JSON">Export</button>
          <button data-del="${g.id}" style="color:var(--danger);margin-left:auto;" title="Supprimer le projet" aria-label="Supprimer le projet">${getIconSvg('trash', 12)}</button>
        </div>
      `;

      gridEl.appendChild(card);
    }
  }

  function showNewProjectModal() {
    const modalBack = document.createElement('div');
    modalBack.className = 'pf-pm-modal-back';

    modalBack.innerHTML = `
      <div class="pf-pm-modal">
        <h3 style="margin:0;font-size:16px;">Nouveau projet PixelForge</h3>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:12px;color:var(--fg-1);">Nom du jeu :</label>
          <input type="text" id="pf-modal-name" class="pf-res-search" style="width:100%;height:30px;font-size:13px;" value="Mon super jeu" />
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;color:var(--fg-1);">Modèle de départ :</label>
          <div class="pf-pm-template-list">
            <div class="pf-pm-template-card selected" data-template="platformer">
              <span style="display:flex;align-items:center;justify-content:center;color:var(--accent);">${getIconSvg('play', 22)}</span>
              <strong>Jeu de Plateforme</strong>
              <small style="color:var(--fg-2);">Héros avec course et saut, pièce ramassable et drapeau avec Blueprints.</small>
            </div>
            <div class="pf-pm-template-card" data-template="empty">
              <span style="display:flex;align-items:center;justify-content:center;color:var(--accent);">${getIconSvg('file', 22)}</span>
              <strong>Projet Vide</strong>
              <small style="color:var(--fg-2);">Une carte de départ vierge prête à accueillir vos créations.</small>
            </div>
            <div class="pf-pm-template-card" data-template="topdown">
              <span style="display:flex;align-items:center;justify-content:center;color:var(--accent);">${getIconSvg('compass', 22)}</span>
              <strong>Vue de Dessus (Top-down)</strong>
              <small style="color:var(--fg-2);">Sans gravité, déplacement 4/8 directions au clavier.</small>
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button id="pf-modal-cancel">Annuler</button>
          <button id="pf-modal-confirm" class="primary">Créer le projet</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBack);

    let selectedTemplate = 'platformer';
    const nameInput = modalBack.querySelector('#pf-modal-name');
    nameInput.focus();
    nameInput.select();

    modalBack.querySelectorAll('.pf-pm-template-card').forEach((card) => {
      card.onclick = () => {
        modalBack.querySelectorAll('.pf-pm-template-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedTemplate = card.dataset.template;
      };
    });

    modalBack.querySelector('#pf-modal-cancel').onclick = () => modalBack.remove();

    modalBack.querySelector('#pf-modal-confirm').onclick = async () => {
      const name = nameInput.value.trim() || 'Mon jeu';
      let proj;
      if (selectedTemplate === 'platformer') {
        proj = createSampleProject(name);
      } else if (selectedTemplate === 'topdown') {
        proj = createEmptyProject(name);
        proj.settings.gravity = 0;
      } else {
        proj = createEmptyProject(name);
      }
      modalBack.remove();
      await saveGame(proj);
      await store.load(proj.meta.id);
      onOpenProject(proj.meta.id);
    };
  }

  // Écouteurs de clics sur les actions de la page
  container.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const openId = e.target.closest('[data-open]')?.dataset.open;
    const cloneId = e.target.closest('[data-clone]')?.dataset.clone;
    const exportId = e.target.closest('[data-export]')?.dataset.export;
    const delId = e.target.closest('[data-del]')?.dataset.del;

    if (act === 'new-project') {
      showNewProjectModal();
    } else if (act === 'import-project') {
      fileInput.click();
    } else if (act === 'sample-games') {
      try {
        const sample = createSampleProject('Exemple Plateforme');
        await saveGame(sample);
        await refreshGames();
      } catch (err) {
        alert(err.message);
      }
    } else if (openId) {
      await store.load(openId);
      onOpenProject(openId);
    } else if (cloneId) {
      const orig = await getGame(cloneId);
      if (orig) {
        const copy = structuredClone(orig);
        copy.meta = createMeta((orig.name || 'Jeu') + ' (copie)');
        copy.name = copy.meta.name = (orig.name || 'Jeu') + ' (copie)';
        await saveGame(copy);
        await refreshGames();
      }
    } else if (exportId) {
      const game = await getGame(exportId);
      if (game) {
        download(`${game.meta?.id || 'jeu'}.pixelforge.json`, JSON.stringify(game, null, 2));
      }
    } else if (delId) {
      const g = games.find((x) => x.id === delId);
      if (confirm(`Voulez-vous vraiment supprimer le projet "${g?.name || delId}" ? Cette action est irréversible.`)) {
        await deleteGame(delId);
        if (store.currentId === delId) store.currentId = null;
        await refreshGames();
      }
    }
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  refreshGames();

  return () => {};
}
