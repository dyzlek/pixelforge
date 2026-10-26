// Onglet « Bibliothèque » : liste des jeux, ouverture, création, import / export.
import './style.css';
import { listGames, getGame, saveGame, deleteGame, subscribe, backendInfo, isValidId } from './storage.js';
import { createEmptyProject, createMeta, normalizeProject } from '../core/project.js';
import { createSampleProject } from '../core/sample.js';
import { renderThumbnail } from './thumbnail.js';

let off = [];
let alive = false;

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function relativeDate(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const s = Math.round((t - Date.now()) / 1000);
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return 'à l\'instant';
}

function download(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function mount(container, store) {
  alive = true;
  const root = el('div', 'lib-root');
  container.appendChild(root);

  const head = el('div', 'lib-head');
  head.appendChild(el('h2', null, 'Bibliothèque'));
  const backendEl = el('span', 'lib-backend', '…');
  backendEl.title = 'Où sont stockés les jeux';
  const btn = (label, fn, cls) => { const b = el('button', cls, label); b.onclick = fn; return b; };
  const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json', hidden: true, multiple: true });
  const grid = el('div', 'lib-grid');
  const msg = el('div', 'lib-error');

  const fail = (e) => { console.error(e); msg.textContent = 'Erreur : ' + (e.message || e); };
  const run = async (fn) => { try { msg.textContent = ''; await fn(); } catch (e) { fail(e); } };

  head.append(
    btn('+ Nouveau jeu', () => run(createGame), 'primary'),
    btn('Importer', () => fileInput.click()),
    btn('Ajouter l\'exemple', () => run(addSample)),
    btn('Charger les jeux d\'exemple', () => run(loadSampleGames)),
    el('span', 'lib-spacer'),
    backendEl,
    fileInput,
  );
  root.append(head, msg, grid);
  backendInfo().then((b) => { backendEl.textContent = b.label; });

  async function render() {
    let games;
    try { games = await listGames(); } catch (e) { fail(e); return; }
    if (!alive) return;
    grid.replaceChildren();
    if (!games.length) {
      grid.appendChild(el('div', 'lib-empty', 'Aucun jeu. Créez-en un ou importez un fichier .pixelforge.json.'));
      return;
    }
    for (const g of games) grid.appendChild(card(g));
  }

  function card(g) {
    const isCurrent = g.id === store.currentId;
    const c = el('div', 'lib-card' + (isCurrent ? ' current' : ''));
    let thumb;
    if (g.thumbnail) {
      thumb = el('img', 'lib-thumb');
      thumb.src = g.thumbnail;
      thumb.alt = '';
    } else {
      thumb = el('div', 'lib-thumb empty checker', 'Pas de miniature');
    }
    thumb.onclick = () => run(() => openGame(g.id, 'pixel'));
    const body = el('div', 'lib-body');
    const name = el('div', 'lib-name');
    name.appendChild(el('span', null, g.name));
    if (isCurrent) name.appendChild(el('span', 'lib-badge', 'Ouvert'));
    name.title = g.name;
    body.append(name, el('div', 'lib-desc', g.description || ''), el('div', 'lib-date', g.updatedAt ? 'Modifié ' + relativeDate(g.updatedAt) : ''));
    const actions = el('div', 'lib-actions');
    const a = (label, fn, cls) => { const b = el('button', cls, label); b.onclick = () => run(fn); actions.appendChild(b); };
    a('Ouvrir', () => openGame(g.id, 'pixel'), 'primary');
    a('▶ Jouer', () => openGame(g.id, 'play'));
    a('Dupliquer', () => duplicateGame(g));
    a('Renommer', () => renameGame(g));
    a('Exporter', () => exportGame(g));
    a('Supprimer', () => removeGame(g), 'lib-danger');
    c.append(thumb, body, actions);
    return c;
  }

  async function openGame(id, tab) {
    if (id !== store.currentId && !(await store.openGame(id))) throw new Error('Jeu introuvable');
    location.hash = tab;
  }

  async function createGame() {
    const name = prompt('Nom du nouveau jeu :', 'Mon jeu');
    if (!name?.trim()) return;
    const p = createEmptyProject(name.trim());
    p.meta.thumbnail = await renderThumbnail(p).catch(() => null);
    await saveGame(p);
    await openGame(p.meta.id, 'pixel');
  }

  async function addSample() {
    const p = createSampleProject();
    p.meta.thumbnail = await renderThumbnail(p).catch(() => null);
    await saveGame(p);
    await render();
  }

  async function loadSampleGames() {
    const baseUrl = import.meta.env?.BASE_URL || '/';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    // Télécharge d'abord tous les jeux, pour pouvoir demander avant d'écraser
    const projects = [];
    try {
      const res = await fetch(cleanBase + '/games/index.json');
      if (res.ok) {
        for (const item of await res.json()) {
          const gr = await fetch(cleanBase + '/games/' + item.file);
          if (gr.ok) projects.push(normalizeProject(await gr.json()));
        }
      }
    } catch (e) {
      console.warn('Impossible de charger games/index.json', e);
    }
    if (!projects.length) { await addSample(); return; }

    // Jeux déjà présents (même id) : les remplacer seulement si l'utilisateur le confirme
    const existing = new Map((await listGames()).map((g) => [g.id, g.name]));
    const clashes = projects.filter((p) => existing.has(p.meta.id));
    let replace = false;
    if (clashes.length) {
      replace = confirm('Ces jeux existent déjà dans votre bibliothèque :\n\n'
        + clashes.map((p) => '• ' + (existing.get(p.meta.id) || p.name)).join('\n')
        + '\n\nOK : les remplacer par la version d\'origine (vos modifications seront perdues).\n'
        + 'Annuler : les garder et ne charger que les jeux manquants.');
    }
    let reopenId = null;
    for (const p of projects) {
      if (existing.has(p.meta.id) && !replace) continue;
      // Jeu ouvert remplacé : on le ferme d'abord pour que sa sauvegarde automatique ne réécrive pas l'ancienne version
      if (p.meta.id === store.currentId) { store.closeGame(); reopenId = p.meta.id; }
      if (!p.meta.thumbnail) p.meta.thumbnail = await renderThumbnail(p).catch(() => null);
      await saveGame(p);
    }
    if (reopenId) await store.openGame(reopenId);
    await render();
  }

  async function duplicateGame(g) {
    let src;
    if (g.id === store.currentId) { await store.flush(); src = JSON.parse(store.toJSON()); } else src = await getGame(g.id);
    if (!src) throw new Error('Jeu introuvable');
    const name = (src.name || 'Jeu') + ' (copie)';
    src.name = name;
    src.meta = { ...src.meta, ...createMeta(name), description: src.meta?.description || '', author: src.meta?.author || '', thumbnail: src.meta?.thumbnail || null };
    await saveGame(src);
    await render();
  }

  async function renameGame(g) {
    const name = prompt('Nouveau nom :', g.name)?.trim();
    if (!name || name === g.name) return;
    if (g.id === store.currentId) {
      store.update((p) => { p.name = name; }, 'rename');
      await store.saveNow();
    } else {
      const p = await getGame(g.id);
      if (!p) throw new Error('Jeu introuvable');
      p.name = name;
      await saveGame(p);
    }
    await render();
  }

  async function exportGame(g) {
    let p;
    if (g.id === store.currentId) { await store.flush(); p = store.project; } else p = await getGame(g.id);
    if (!p) throw new Error('Jeu introuvable');
    download(g.id + '.pixelforge.json', JSON.stringify(p, null, 2));
  }

  async function removeGame(g) {
    if (!confirm('Supprimer « ' + g.name + ' » ? Cette action est définitive.')) return;
    if (g.id === store.currentId) store.closeGame();
    await deleteGame(g.id);
    await render();
  }

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    for (const file of files) {
      await run(async () => {
        let p;
        try { p = normalizeProject(JSON.parse(await file.text())); } catch { throw new Error(file.name + ' : fichier invalide'); }
        const existing = new Set((await listGames()).map((x) => x.id));
        if (!isValidId(p.meta.id) || existing.has(p.meta.id)) p.meta.id = createMeta(p.name).id;
        if (!p.meta.thumbnail) p.meta.thumbnail = await renderThumbnail(p).catch(() => null);
        await saveGame(p);
      });
    }
    await render();
  });

  off = [
    subscribe(() => render()),
    store.on('saved', () => render()),
    store.on('load', () => render()),
    store.on('change', (reason) => { if (reason === 'rename') render(); }),
  ];
  render();
}

export function unmount() {
  alive = false;
  for (const f of off) f();
  off = [];
}
