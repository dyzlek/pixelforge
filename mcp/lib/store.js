// Lecture / écriture des jeux de games/ (même format que l'éditeur : JSON indenté 2 espaces).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeProject, createEmptyProject, slugify } from '../../src/core/project.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXT = '.pixelforge.json';

export const gamesDir = () => path.resolve(process.env.PIXELFORGE_GAMES || path.join(ROOT, 'games'));
export const exportsDir = () => path.join(path.dirname(gamesDir()), 'exports');
const fileOf = (id) => path.join(gamesDir(), id + EXT);

export function listGames() {
  const dir = gamesDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(EXT)) continue;
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      out.push({ id: p.meta?.id || f.slice(0, -EXT.length), name: p.name, description: p.meta?.description || '', updatedAt: p.meta?.updatedAt || '', file: f });
    } catch (e) {
      out.push({ id: f.slice(0, -EXT.length), name: '(unreadable)', description: String(e.message), updatedAt: '', file: f });
    }
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

// `ref` = id (nom de fichier sans extension) ou nom du jeu (insensible à la casse)
export function resolveGameId(ref) {
  if (!ref) throw new Error('missing "game" (id or name)');
  const games = listGames();
  const q = String(ref).toLowerCase();
  const hit = games.find((g) => g.id === ref) || games.find((g) => g.id.toLowerCase() === q)
    || games.find((g) => String(g.name).toLowerCase() === q) || games.find((g) => slugify(g.name) === slugify(ref));
  if (!hit) throw new Error(`game "${ref}" not found. Existing games: ${games.map((g) => `${g.id} ("${g.name}")`).join(', ') || '(none)'}`);
  return hit.id;
}

export function loadGame(ref) {
  const id = resolveGameId(ref);
  const project = normalizeProject(JSON.parse(fs.readFileSync(fileOf(id), 'utf8')));
  project.meta.id = id;
  return project;
}

function renameRetry(from, to) {
  for (let i = 0; ; i++) {
    try { return fs.renameSync(from, to); } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (i + 1)); // l'éditeur ou l'antivirus lit peut-être le fichier
    }
  }
}

// Écriture atomique (fichier temporaire + renommage) ; met à jour meta.updatedAt.
export function saveGame(project) {
  const id = project.meta.id;
  fs.mkdirSync(gamesDir(), { recursive: true });
  project.meta.updatedAt = new Date().toISOString();
  const tmp = fileOf(id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(project, null, 2));
  renameRetry(tmp, fileOf(id));
  return fileOf(id);
}

// Crée un nouveau jeu vide (id unique) et l'écrit sur disque.
export function createGameFile(name, mutate) {
  const project = createEmptyProject(name);
  const base = slugify(name);
  let id = base;
  while (fs.existsSync(fileOf(id))) id = base + '-' + Math.random().toString(36).slice(2, 6);
  project.meta.id = id;
  if (mutate) mutate(project);
  saveGame(project);
  return project;
}

export function deleteGameFile(ref) {
  const id = resolveGameId(ref);
  fs.unlinkSync(fileOf(id));
  return id;
}

export function duplicateGameFile(ref, newName) {
  const src = loadGame(ref);
  const copy = JSON.parse(JSON.stringify(src));
  copy.name = newName || src.name + ' (copy)';
  const base = slugify(copy.name);
  let id = base;
  while (fs.existsSync(fileOf(id))) id = base + '-' + Math.random().toString(36).slice(2, 6);
  copy.meta.id = id;
  copy.meta.createdAt = new Date().toISOString();
  saveGame(copy);
  return copy;
}

// Charge, applique `fn(project)`, sauvegarde. Renvoie ce que fn renvoie.
export function editGame(ref, fn) {
  const project = loadGame(ref);
  const result = fn(project);
  saveGame(project);
  return result;
}
