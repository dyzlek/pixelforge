import './style.css';
import { store } from './core/store.js';
import { exportStandaloneHTML } from './runtime/play.js';

const TABS = [
  { id: 'library', label: 'Bibliothèque', load: () => import('./library/index.js') },
  { id: 'pixel', label: 'Pixel art', load: () => import('./editors/pixel/index.js') },
  { id: 'map', label: 'Cartes', load: () => import('./editors/map/index.js') },
  { id: 'objects', label: 'Objets & code', load: () => import('./editors/objects/index.js') },
  { id: 'sound', label: 'Sons', load: () => import('./editors/sound/index.js') },
  { id: 'play', label: '▶ Jouer', load: () => import('./runtime/play.js') },
];

const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const nameInput = document.getElementById('project-name');
const statusEl = document.getElementById('save-status');

let current = null; // { id, module, container }
let switching = Promise.resolve();

function readHash() {
  const id = location.hash.slice(1);
  if (!TABS.some((t) => t.id === id)) return store.currentId ? 'pixel' : 'library';
  // Sans jeu ouvert, les onglets d'édition renvoient vers la bibliothèque
  return id !== 'library' && !store.currentId ? 'library' : id;
}

async function showTab(id, force = false) {
  if (id !== 'library' && !store.currentId) id = 'library';
  if (current?.id === id && !force) return;
  if (current) {
    try { current.module.unmount?.(); } catch (e) { console.error(e); }
    current.container.remove();
    current = null;
  }
  const tab = TABS.find((t) => t.id === id);
  for (const b of tabsEl.children) b.classList.toggle('active', b.dataset.tab === id);
  const container = document.createElement('div');
  container.className = 'tab-view';
  view.appendChild(container);
  const module = await tab.load();
  current = { id, module, container };
  module.mount(container, store);
}

function openTab(id) {
  switching = switching.then(() => showTab(id)).catch((e) => console.error(e));
  return switching;
}

// Recharge l'onglet courant (après chargement d'un autre projet)
function remountCurrent() {
  switching = switching.then(() => (current ? showTab(current.id, true) : null)).catch((e) => console.error(e));
}

for (const t of TABS) {
  const b = document.createElement('button');
  b.textContent = t.label;
  b.dataset.tab = t.id;
  b.onclick = () => { location.hash = t.id; };
  tabsEl.appendChild(b);
}
window.addEventListener('hashchange', () => openTab(readHash()));

// Nom du projet et état de sauvegarde
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
  if (!store.currentId && current?.id !== 'library') location.hash = 'library';
  remountCurrent();
});
store.on('change', (reason) => {
  if (reason === 'rename' && document.activeElement !== nameInput) syncName();
  if (store.currentId) setStatus('…');
});
store.on('saving', () => setStatus('Sauvegarde…'));
store.on('saved', () => setStatus('Sauvegardé'));
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

const slug = () => (store.project.name || 'jeu').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jeu';

for (const b of document.querySelectorAll('.menu [data-action]')) {
  b.onclick = () => {
    if (b.dataset.action !== 'export') return;
    if (!store.currentId) { toast('Ouvrez un jeu depuis la bibliothèque pour l\'exporter'); return; }
    download(slug() + '.html', exportStandaloneHTML(store.project), 'text/html');
  };
}

// Ctrl+S = sauvegarde immédiate
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); store.saveNow(); }
});

(async () => {
  try {
    await store.init();
  } catch (e) {
    console.error('Initialisation de la bibliothèque impossible', e);
    toast('Bibliothèque indisponible : ' + (e.message || e));
  }
  syncName();
  if (!location.hash || !TABS.some((t) => t.id === location.hash.slice(1))) location.hash = store.currentId ? 'pixel' : 'library';
  openTab(readHash());
})();
