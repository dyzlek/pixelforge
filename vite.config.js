import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = path.join(ROOT, 'games');
const SUFFIX = '.pixelforge.json';
const ID_RE = /^[a-z0-9-]+$/;
const MAX_BODY = 200 * 1024 * 1024;

const fileOf = (id) => path.join(GAMES_DIR, id + SUFFIX);
const idOfFile = (file) => {
  if (path.dirname(path.resolve(file)) !== GAMES_DIR) return null;
  const base = path.basename(file);
  if (!base.endsWith(SUFFIX)) return null;
  const id = base.slice(0, -SUFFIX.length);
  return ID_RE.test(id) ? id : null;
};

// Lit un jeu ; null si absent ou JSON invalide
async function readGame(id) {
  try {
    return JSON.parse(await fs.promises.readFile(fileOf(id), 'utf8'));
  } catch {
    return null;
  }
}

// Écriture atomique : fichier temporaire (nom qui ne finit pas par .pixelforge.json) puis rename
async function writeGame(id, project) {
  const tmp = fileOf(id) + '.tmp-' + process.pid + '-' + Date.now();
  await fs.promises.writeFile(tmp, JSON.stringify(project, null, 2) + '\n');
  await fs.promises.rename(tmp, fileOf(id));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Corps trop volumineux')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function gamesPlugin() {
  return {
    name: 'pixelforge-games',
    configureServer(server) {
      fs.mkdirSync(GAMES_DIR, { recursive: true });
      server.watcher.add(GAMES_DIR);

      // --- SSE ---
      const clients = new Set();
      const broadcast = (event) => {
        const msg = `data: ${JSON.stringify(event)}\n\n`;
        for (const res of clients) res.write(msg);
      };
      const heartbeat = setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);
      heartbeat.unref();
      server.httpServer?.on('close', () => clearInterval(heartbeat));

      // --- Watcher : un événement par id (regroupe add + change d'une écriture atomique) ---
      const timers = new Map();
      async function notify(id, attempt = 0) {
        let stat = null;
        try { stat = await fs.promises.stat(fileOf(id)); } catch {}
        if (!stat) { broadcast({ type: 'game-deleted', id }); return; }
        const project = await readGame(id);
        if (!project && attempt < 3) { setTimeout(() => notify(id, attempt + 1), 200); return; }
        const updatedAt = project?.meta?.updatedAt || stat.mtime.toISOString();
        broadcast({ type: 'game-changed', id, updatedAt });
      }
      const onFsEvent = (file) => {
        const id = idOfFile(file);
        if (!id) return;
        clearTimeout(timers.get(id));
        timers.set(id, setTimeout(() => { timers.delete(id); notify(id); }, 80));
      };
      server.watcher.on('add', onFsEvent);
      server.watcher.on('change', onFsEvent);
      server.watcher.on('unlink', onFsEvent);

      // --- REST ---
      server.middlewares.use('/api', async (req, res, next) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const parts = url.pathname.split('/').filter(Boolean); // ['games', id] | ['events']

          if (parts[0] === 'events' && parts.length === 1 && req.method === 'GET') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive',
            });
            res.write(': connected\n\n');
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return;
          }

          if (parts[0] !== 'games') return next();

          if (parts.length === 1 && req.method === 'GET') {
            const files = (await fs.promises.readdir(GAMES_DIR)).filter((f) => f.endsWith(SUFFIX));
            const list = [];
            for (const f of files) {
              const id = f.slice(0, -SUFFIX.length);
              if (!ID_RE.test(id)) continue;
              const p = await readGame(id);
              if (!p) continue;
              const stat = await fs.promises.stat(fileOf(id)).catch(() => null);
              list.push({
                id,
                name: p.name || id,
                description: p.meta?.description || '',
                thumbnail: p.meta?.thumbnail || null,
                updatedAt: p.meta?.updatedAt || stat?.mtime.toISOString() || null,
              });
            }
            list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
            return sendJSON(res, 200, list);
          }

          if (parts.length === 2) {
            const id = parts[1];
            if (!ID_RE.test(id)) return sendJSON(res, 400, { error: 'Identifiant invalide' });

            if (req.method === 'GET') {
              const p = await readGame(id);
              return p ? sendJSON(res, 200, p) : sendJSON(res, 404, { error: 'Jeu introuvable' });
            }
            if (req.method === 'PUT') {
              let project;
              try { project = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { error: 'JSON invalide' }); }
              if (!project || typeof project !== 'object' || Array.isArray(project)) return sendJSON(res, 400, { error: 'Projet invalide' });
              project.meta = { ...(project.meta || {}), id };
              await writeGame(id, project);
              return sendJSON(res, 200, { ok: true, id, updatedAt: project.meta.updatedAt || null });
            }
            if (req.method === 'DELETE') {
              try { await fs.promises.unlink(fileOf(id)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
              return sendJSON(res, 200, { ok: true });
            }
          }
          return sendJSON(res, 405, { error: 'Méthode non supportée' });
        } catch (e) {
          console.error('[games]', e);
          sendJSON(res, 500, { error: String(e.message || e) });
        }
      });
    },
  };
}

function copyGamesPlugin() {
  return {
    name: 'copy-games-dist',
    async closeBundle() {
      const outDir = path.join(ROOT, 'dist', 'games');
      await fs.promises.mkdir(outDir, { recursive: true });
      if (!fs.existsSync(GAMES_DIR)) return;
      const files = (await fs.promises.readdir(GAMES_DIR)).filter((f) => f.endsWith(SUFFIX));
      const manifest = [];
      for (const file of files) {
        await fs.promises.copyFile(path.join(GAMES_DIR, file), path.join(outDir, file));
        const id = file.slice(0, -SUFFIX.length);
        manifest.push({ id, file });
      }
      await fs.promises.writeFile(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/pixelforge/' : '/',
  plugins: [gamesPlugin(), copyGamesPlugin()],
});

