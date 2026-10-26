// Stockage de la bibliothèque : dossier games/ via l'API du serveur de dev, sinon IndexedDB.
// Interface : listGames, getGame, saveGame, deleteGame, subscribe, backendInfo.

const ID_RE = /^[a-z0-9-]+$/;
export const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

const summary = (p) => ({
  id: p.meta.id,
  name: p.name || p.meta.id,
  description: p.meta.description || '',
  thumbnail: p.meta.thumbnail || null,
  updatedAt: p.meta.updatedAt || null,
});

// --- Backend HTTP (dossier games/) ---
const httpBackend = {
  name: 'disk',
  label: 'Dossier games/',
  async list() {
    const r = await fetch('/api/games', { cache: 'no-store' });
    if (!r.ok) throw new Error('Liste impossible (' + r.status + ')');
    return r.json();
  },
  async get(id) {
    const r = await fetch('/api/games/' + id, { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Lecture impossible (' + r.status + ')');
    return r.json();
  },
  async put(project) {
    const r = await fetch('/api/games/' + project.meta.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!r.ok) throw new Error('Écriture impossible (' + r.status + ')');
  },
  async remove(id) {
    const r = await fetch('/api/games/' + id, { method: 'DELETE' });
    if (!r.ok) throw new Error('Suppression impossible (' + r.status + ')');
  },
  listen(emit) {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => { try { emit(JSON.parse(e.data)); } catch {} };
    return () => es.close();
  },
};

// --- Backend IndexedDB (build statique) ---
let dbPromise = null;
function openDb() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('pixelforge', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('games', { keyPath: 'meta.id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('games', mode);
    const req = fn(t.objectStore('games'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const CHANNEL = 'pixelforge-games';
const idbBackend = {
  name: 'browser',
  label: 'Navigateur',
  channel: typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null,
  async list() {
    const all = await tx('readonly', (s) => s.getAll());
    return all.map(summary).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },
  async get(id) { return (await tx('readonly', (s) => s.get(id))) || null; },
  async put(project) {
    await tx('readwrite', (s) => s.put(project));
    this.channel?.postMessage({ type: 'game-changed', id: project.meta.id, updatedAt: project.meta.updatedAt });
  },
  async remove(id) {
    await tx('readwrite', (s) => s.delete(id));
    this.channel?.postMessage({ type: 'game-deleted', id });
  },
  listen(emit) {
    if (typeof BroadcastChannel === 'undefined') return () => {};
    const ch = new BroadcastChannel(CHANNEL); // un canal ne reçoit pas ses propres messages
    ch.onmessage = (e) => emit(e.data);
    return () => ch.close();
  },
};

let backendPromise = null;
function backend() {
  backendPromise ||= (async () => {
    try {
      const r = await fetch('/api/games', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
        const data = await r.json();
        if (Array.isArray(data)) return httpBackend;
      }
    } catch {}
    return idbBackend;
  })();
  return backendPromise;
}

export async function backendInfo() {
  const b = await backend();
  return { name: b.name, label: b.label };
}

export async function listGames() { return (await backend()).list(); }
export async function getGame(id) {
  if (!isValidId(id)) return null;
  return (await backend()).get(id);
}

// Met à jour meta.updatedAt puis écrit. Retourne le updatedAt écrit.
export async function saveGame(project) {
  if (!isValidId(project?.meta?.id)) throw new Error('Identifiant de jeu invalide');
  project.meta.updatedAt = new Date().toISOString();
  await (await backend()).put(project);
  return project.meta.updatedAt;
}

export async function deleteGame(id) {
  if (!isValidId(id)) return;
  await (await backend()).remove(id);
}

// cb({ type: 'game-changed' | 'game-deleted', id, updatedAt? }) ; retourne la fonction de désabonnement
const subscribers = new Set();
let stopListening = null;
export function subscribe(cb) {
  subscribers.add(cb);
  if (!stopListening) {
    stopListening = () => {};
    backend().then((b) => {
      stopListening = b.listen((ev) => { for (const f of subscribers) { try { f(ev); } catch (e) { console.error(e); } } });
    });
  }
  return () => { subscribers.delete(cb); };
}
