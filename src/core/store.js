import { createEmptyProject, normalizeProject } from './project.js';
import { createSampleProject } from './sample.js';
import { listGames, getGame, saveGame, deleteGame, subscribe } from '../library/storage.js';
import { renderThumbnail } from '../library/thumbnail.js';

const LAST_ID_KEY = 'pixelforge.lastGameId';
const LEGACY_KEY = 'pixelforge.project';
const LEGACY_DONE_KEY = 'pixelforge.legacyMigrated';
const SAVE_DELAY = 800;
const THUMB_EVERY = 10000;

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

function createStore() {
  const listeners = new Map();
  let saveTimer = null;
  let saving = false;
  let dirty = false;
  let lastThumbAt = 0;
  const written = []; // derniers updatedAt écrits par cet éditeur (pour ignorer nos propres échos SSE)
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 40;

  function pushHistory() {
    if (!store.currentId) return;
    try {
      undoStack.push(JSON.stringify(store.project));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack.length = 0;
      store.emit('history', { canUndo: true, canRedo: false });
    } catch (e) {}
  }

  const store = {
    project: createEmptyProject(), // projet « brouillon » tant qu'aucun jeu n'est ouvert (jamais sauvegardé)
    currentId: null,
    ui: { selectedSpriteId: null, selectedMapId: null, selectedObjectId: null, selection: null },

    setSelection(sel) {
      this.ui.selection = sel;
      this.emit('selection', sel);
    },

    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      return () => listeners.get(event).delete(cb);
    },

    emit(event, payload) {
      for (const cb of listeners.get(event) || []) {
        try { cb(payload); } catch (e) { console.error(e); }
      }
    },

    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },

    undo() {
      if (!undoStack.length) return false;
      const prev = undoStack.pop();
      redoStack.push(JSON.stringify(store.project));
      store.project = normalizeProject(JSON.parse(prev));
      store.emit('change', 'history');
      store.emit('load', store.project);
      store.emit('history', { canUndo: undoStack.length > 0, canRedo: true });
      scheduleSave();
      return true;
    },

    redo() {
      if (!redoStack.length) return false;
      const next = redoStack.pop();
      undoStack.push(JSON.stringify(store.project));
      store.project = normalizeProject(JSON.parse(next));
      store.emit('change', 'history');
      store.emit('load', store.project);
      store.emit('history', { canUndo: true, canRedo: redoStack.length > 0 });
      scheduleSave();
      return true;
    },

    update(fn, reason = 'edit') {
      if (reason !== 'history') pushHistory();
      fn(store.project);
      store.emit('change', reason);
      scheduleSave();
    },

    // Remplace le projet courant (n'écrit rien). opts.keepUi : garder la sélection de l'interface.
    load(json, opts = {}) {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      clearTimeout(saveTimer);
      dirty = false;
      undoStack.length = 0;
      redoStack.length = 0;
      store.project = normalizeProject(data);
      store.currentId = store.project.meta.id;
      lsSet(LAST_ID_KEY, store.currentId);
      if (!opts.keepUi) store.ui = { selectedSpriteId: null, selectedMapId: null, selectedObjectId: null };
      store.emit('load', store.project);
      store.emit('history', { canUndo: false, canRedo: false });
    },

    // Ouvre un jeu de la bibliothèque. Retourne false s'il n'existe pas.
    async openGame(id) {
      await store.flush();
      const p = await getGame(id);
      if (!p) return false;
      if (!p.meta) p.meta = {};
      p.meta.id = id;
      store.load(p);
      return true;
    },

    // Ferme le jeu ouvert (après suppression par ex.)
    closeGame() {
      clearTimeout(saveTimer);
      dirty = false;
      store.currentId = null;
      store.project = createEmptyProject();
      lsSet(LAST_ID_KEY, null);
      store.emit('load', store.project);
    },

    toJSON() {
      return JSON.stringify(store.project);
    },

    // Sauvegarde immédiate du jeu ouvert dans la bibliothèque
    async saveNow() {
      clearTimeout(saveTimer);
      if (!store.currentId) return;
      if (saving) { scheduleSave(); return; }
      saving = true;
      dirty = false;
      store.emit('saving');
      const project = store.project;
      try {
        if (Date.now() - lastThumbAt > THUMB_EVERY || !project.meta.thumbnail) {
          lastThumbAt = Date.now();
          try { project.meta.thumbnail = (await renderThumbnail(project)) || project.meta.thumbnail; } catch (e) { console.warn('Miniature impossible', e); }
        }
        if (project === store.project && store.currentId === project.meta.id) {
          const at = await saveGame(project);
          written.push(at);
          if (written.length > 30) written.shift();
          store.emit('saved', at);
        }
      } catch (e) {
        console.warn('Sauvegarde impossible', e);
        dirty = true;
        store.emit('save-error', e);
      } finally {
        saving = false;
        if (dirty) scheduleSave();
      }
    },

    // Termine la sauvegarde en attente (avant de changer de jeu)
    async flush() {
      while (saving) await new Promise((r) => setTimeout(r, 30));
      if (dirty && store.currentId) await store.saveNow();
    },

    // Crée un jeu à partir d'un projet et l'écrit dans la bibliothèque (sans l'ouvrir)
    async addGame(project) {
      const p = normalizeProject(project);
      await saveGame(p);
      return p;
    },

    // Charge le dernier jeu ouvert ; crée l'exemple si la bibliothèque est vide ; migre l'ancien localStorage.
    async init() {
      await migrateLegacy();
      let games = await listGames();
      if (!games.length) {
        const sample = createSampleProject();
        sample.meta.thumbnail = await renderThumbnail(sample).catch(() => null);
        await saveGame(sample);
        games = await listGames();
        await store.openGame(sample.meta.id);
        return;
      }
      const last = lsGet(LAST_ID_KEY);
      if (last && games.some((g) => g.id === last)) await store.openGame(last);
    },
  };

  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    if (!store.currentId) return;
    saveTimer = setTimeout(store.saveNow, SAVE_DELAY);
  }

  async function migrateLegacy() {
    if (lsGet(LEGACY_DONE_KEY)) return;
    const raw = lsGet(LEGACY_KEY);
    if (!raw) return;
    try {
      const p = normalizeProject(JSON.parse(raw));
      p.meta.thumbnail = await renderThumbnail(p).catch(() => null);
      await saveGame(p);
      if (!lsGet(LAST_ID_KEY)) lsSet(LAST_ID_KEY, p.meta.id);
      lsSet(LEGACY_DONE_KEY, '1'); // l'ancienne clé est conservée comme sauvegarde de secours
    } catch (e) {
      console.warn('Migration de l\'ancien projet impossible', e);
    }
  }

  // Synchro : un autre acteur (IA via MCP, autre onglet) a modifié le jeu ouvert
  subscribe(async (ev) => {
    if (ev.id !== store.currentId) return;
    if (ev.type === 'game-changed') {
      if (written.includes(ev.updatedAt)) return;
      const p = await getGame(ev.id).catch(() => null);
      if (!p || ev.id !== store.currentId) return;
      if (written.includes(p.meta?.updatedAt)) return;
      if (!p.meta) p.meta = {};
      p.meta.id = ev.id;
      store.load(p, { keepUi: true });
      store.emit('external-load');
    }
  });

  window.addEventListener('beforeunload', () => { if (dirty) store.saveNow(); });

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.closest?.('.cm-editor, .bp-canvas, .bp-root')) return;
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) { e.preventDefault(); store.redo(); }
          else { e.preventDefault(); store.undo(); }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          store.redo();
        }
      }
    });
  }

  return store;
}

export const store = createStore();
