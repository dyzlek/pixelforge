import './style.css';
import { store } from './core/store.js';
import { exportStandaloneHTML } from './runtime/play.js';
import { DockManager } from './ui/dock.js';
import { DocumentWorkspace } from './ui/documents.js';

// --- Gestion des thèmes (Design Tokens A0) ---
const THEME_KEY = 'pixelforge-theme';
function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre';
    btn.setAttribute('aria-label', btn.title);
  }
}

function initTheme() {
  const current = getTheme();
  applyTheme(current);
}

const appEl = document.getElementById('app') || document.body;

// Initialisation du Dock Manager (A1)
export const dock = new DockManager({
  onPlay: () => {
    workspace.open({ kind: 'play', title: '▶ Jouer' });
  },
  onPlayCurrent: () => {
    workspace.open({ kind: 'play', title: '▶ Jouer' });
  },
  onStop: () => {
    dock.setPlayingState(false);
    const playDoc = workspace.docs.find((d) => d.kind === 'play');
    if (playDoc) {
      workspace.close(playDoc.id);
    }
  },
  onExport: () => triggerExport(),
});

dock.mount(appEl);

// Structure de la zone centrale
const centerBody = dock.getAreaBody('center');
centerBody.innerHTML = `
  <div style="display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;">
    <div id="pf-center-tabbar" style="display:flex;align-items:center;background:var(--bg-1);border-bottom:1px solid var(--border);flex-shrink:0;padding:2px 6px 0;">
      <nav id="tabs" style="display:flex;align-items:center;flex:1;overflow-x:auto;"></nav>
      <div id="pf-quick-tabs" style="display:flex;align-items:center;gap:4px;margin-left:8px;padding-bottom:2px;">
        <button class="pf-dock-btn" data-open-kind="map" title="Ouvrir l'éditeur de cartes">🗺️ Carte</button>
        <button class="pf-dock-btn" data-open-kind="pixel" title="Ouvrir le pixel art">🎨 Sprite</button>
        <button class="pf-dock-btn" data-open-kind="objects" title="Ouvrir objets & scripts">📜 Objet</button>
        <button class="pf-dock-btn" data-open-kind="sound" title="Ouvrir les sons">🔊 Son</button>
        <button class="pf-dock-btn" data-open-kind="library" title="Ouvrir la bibliothèque">📚 Projets</button>
      </div>
    </div>
    <main id="view" style="flex:1;min-height:0;position:relative;overflow:hidden;"></main>
  </div>
`;

const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');

// Initialisation du Document Workspace (A2)
export const workspace = new DocumentWorkspace({
  tabbar: tabsEl,
  view,
  store,
});

// Écoute des boutons d'ouverture rapide
document.getElementById('pf-quick-tabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open-kind]');
  if (btn) {
    workspace.open({ kind: btn.dataset.openKind });
  }
});

// Éléments de la barre supérieure droite (Godot style)
const topRightEl = document.getElementById('pf-topright');
topRightEl.innerHTML = `
  <input id="project-name" class="project-name" spellcheck="false" placeholder="Aucun jeu ouvert" />
  <button id="theme-toggle" class="theme-btn" title="Changer de thème" aria-label="Changer de thème">☀️</button>
  <button data-action="export" class="primary" style="padding:3px 8px;font-size:12px;">Exporter HTML</button>
  <span id="save-status" style="color:var(--fg-2);min-width:70px;font-size:12px;"></span>
`;

const nameInput = document.getElementById('project-name');
const statusEl = document.getElementById('save-status');

// Bouton de thème
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
  themeBtn.onclick = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
  };
}

// Panneaux par défaut pour les docks latéraux
dock.registerPanel({
  id: 'resources',
  title: 'Ressources',
  icon: '📁',
  area: 'left',
  mount: (container) => {
    container.innerHTML = `
      <div style="padding:10px;font-size:12px;color:var(--fg-1);">
        <div style="font-weight:600;margin-bottom:6px;color:var(--fg-0);">Explorateur de projet</div>
        <p style="margin:0;font-size:11px;color:var(--fg-2);">Double-cliquez sur une ressource pour l'ouvrir dans un onglet.</p>
      </div>
    `;
  },
  unmount: () => {},
});

dock.registerPanel({
  id: 'inspector',
  title: 'Inspecteur',
  icon: '🔍',
  area: 'right',
  mount: (container) => {
    container.innerHTML = `
      <div style="padding:10px;font-size:12px;color:var(--fg-1);">
        <div style="font-weight:600;margin-bottom:6px;color:var(--fg-0);">Propriétés</div>
        <p style="margin:0;font-size:11px;color:var(--fg-2);">Sélectionnez un élément pour afficher ses options.</p>
      </div>
    `;
  },
  unmount: () => {},
});

dock.registerPanel({
  id: 'console',
  title: 'Console',
  icon: '💬',
  area: 'bottom',
  mount: (container) => {
    container.innerHTML = `
      <div style="padding:8px 12px;font-family:var(--font-mono);font-size:11px;color:var(--fg-1);height:100%;overflow:auto;">
        <span style="color:var(--accent);">PixelForge Studio v3.0 initialisé.</span>
      </div>
    `;
  },
  unmount: () => {},
});

const syncName = () => {
  nameInput.value = store.currentId ? store.project.name : '';
  nameInput.disabled = !store.currentId;
  nameInput.placeholder = store.currentId ? '' : 'Aucun jeu ouvert';
};
const setStatus = (text, title = '') => { statusEl.textContent = text; statusEl.title = title; };

nameInput.addEventListener('input', () => store.update((p) => { p.name = nameInput.value || 'Mon jeu'; }, 'rename'));
store.on('load', () => {
  syncName();
  setStatus('');
});
store.on('change', (reason) => {
  if (reason === 'rename' && document.activeElement !== nameInput) syncName();
  if (store.currentId) {
    setStatus('…');
    if (workspace.activeId) workspace.markDirty(workspace.activeId, true);
  }
});
store.on('saving', () => setStatus('Sauvegarde…'));
store.on('saved', () => {
  setStatus('Sauvegardé');
  for (const doc of workspace.docs) workspace.markDirty(doc.id, false);
});
store.on('save-error', (e) => setStatus('Erreur de sauvegarde', String(e?.message || e)));

// Toast discret
let toastTimer = null;
function toast(text) {
  let t = document.getElementById('toast');
  if (!t) {
    t = Object.assign(document.createElement('div'), { id: 'toast' });
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
store.on('external-load', () => toast('Jeu mis à jour depuis le disque (IA / MCP)'));

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = () => (store.project?.name || 'jeu').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jeu';

function triggerExport() {
  if (!store.currentId) { toast('Ouvrez un jeu depuis la bibliothèque pour l\'exporter'); return; }
  download(slug() + '.html', exportStandaloneHTML(store.project), 'text/html');
}

const exportBtn = document.querySelector('[data-action="export"]');
if (exportBtn) exportBtn.onclick = triggerExport;

// Ctrl+S = sauvegarde immédiate
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); store.saveNow(); }
});

(async () => {
  initTheme();
  try {
    await store.init();
  } catch (e) {
    console.error('Initialisation de la bibliothèque impossible', e);
    toast('Bibliothèque indisponible : ' + (e.message || e));
  }
  syncName();

  if (store.currentId) {
    workspace.loadSavedDocs();
  } else {
    workspace.open({ kind: 'library', title: 'Bibliothèque' });
  }
})();
