// Onglet « Cartes » : éditeur de tuiles, calques et entités (rendu Canvas 2D)
import './style.css';
import { createMap, createLayer, uid, findById } from '../../core/project.js';

const MAX_UNDO = 50;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;
const MAX_MAP = 512;
const ERASER = { w: 1, h: 1, tiles: [-1] };
const TOOLS = [
  { id: 'brush', label: 'Pinceau', key: 'B' },
  { id: 'eraser', label: 'Gomme', key: 'E' },
  { id: 'fill', label: 'Remplir', key: 'G' },
  { id: 'rect', label: 'Rectangle', key: 'R' },
  { id: 'pick', label: 'Pipette', key: 'I' },
  { id: 'select', label: 'Sélection', key: 'S' },
  { id: 'entities', label: 'Entités', key: 'O' },
];
const CHUNK = 32;        // taille (en tuiles) des morceaux du cache de rendu
const MAX_CHUNKS = 160;  // nombre maximal de morceaux gardés en mémoire (LRU)
const MINI_H = 64;

// ---------------------------------------------------------------- état du module
let store = null;
let S = null;            // état d'interface local (réinitialisé à chaque mount)
let els = null;          // références DOM
let cleanups = [];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// ---------------------------------------------------------------- accès au projet
function curMap() {
  const p = store.project;
  let m = findById(p.maps, store.ui.selectedMapId);
  if (!m) {
    m = findById(p.maps, p.settings.startMapId) || p.maps[0];
    store.ui.selectedMapId = m.id;
  }
  return m;
}

const tilesetOf = (map) => findById(store.project.sprites, map.tilesetSpriteId);

function activeLayer(map) {
  let l = findById(map.layers, S.layerId);
  if (!l) {
    l = map.layers[0] || null;
    S.layerId = l ? l.id : null;
  }
  return l;
}

// ---------------------------------------------------------------- cache d'images
function getImg(src) {
  let e = S.imgs.get(src);
  if (!e) {
    const img = new Image();
    e = { img, ok: false };
    img.onload = () => { if (!S) return; e.ok = true; S.imgGen++; requestDraw(); drawPalette(); };
    img.src = src;
    S.imgs.set(src, e);
  }
  return e.ok ? e.img : null;
}

// Supprime du cache les images qui ne sont plus des frames du projet
function pruneImgs() {
  const live = new Set();
  for (const s of store.project.sprites) for (const f of s.frames) live.add(f);
  for (const k of [...S.imgs.keys()]) if (!live.has(k)) S.imgs.delete(k);
  S.imgGen++;
}

// Frame d'aperçu d'un objet : 1re frame de son defaultAnim, sinon frame 0
function objectFrame(obj) {
  const spr = obj && findById(store.project.sprites, obj.spriteId);
  if (!spr || !spr.frames.length) return null;
  const anim = obj.defaultAnim ? spr.animations?.find((a) => a.name === obj.defaultAnim) : null;
  const fi = anim?.frames?.length ? anim.frames[0] : 0;
  return { spr, src: spr.frames[fi] ?? spr.frames[0] };
}

function entityInfo(ent, ts) {
  const of = objectFrame(findById(store.project.objects, ent.objectId));
  if (!of) return { w: ts, h: ts, img: null, missing: true };
  return { w: of.spr.width, h: of.spr.height, img: getImg(of.src), missing: false };
}

// ---------------------------------------------------------------- undo / redo (carte courante)
// Les tableaux `data` ne sont jamais modifiés sur place : un snapshot peut donc les partager.
function snap(map) {
  return {
    name: map.name, width: map.width, height: map.height,
    tilesetSpriteId: map.tilesetSpriteId, background: map.background,
    layers: map.layers.map((l) => ({ ...l })),
    entities: map.entities.map((e) => ({ ...e })),
  };
}

function restore(map, s) {
  map.name = s.name; map.width = s.width; map.height = s.height;
  map.tilesetSpriteId = s.tilesetSpriteId; map.background = s.background;
  map.layers = s.layers.map((l) => ({ ...l }));
  map.entities = s.entities.map((e) => ({ ...e }));
}

const stackOf = (m, id) => { if (!m.has(id)) m.set(id, []); return m.get(id); };

// Applique une modification de la carte courante (annulable) et écrit dans le projet
function commit(fn) {
  const map = curMap();
  const before = snap(map);
  store.update(() => fn(map), 'map');
  const u = stackOf(S.undo, map.id);
  u.push(before);
  if (u.length > MAX_UNDO) u.shift();
  S.redo.set(map.id, []);
  refresh();
}

function undo() {
  const map = curMap();
  const u = stackOf(S.undo, map.id);
  if (!u.length) return;
  S.gesture = null;
  const s = u.pop();
  stackOf(S.redo, map.id).push(snap(map));
  store.update(() => restore(map, s), 'map');
  refresh();
}

function redo() {
  const map = curMap();
  const r = stackOf(S.redo, map.id);
  if (!r.length) return;
  S.gesture = null;
  const s = r.pop();
  stackOf(S.undo, map.id).push(snap(map));
  store.update(() => restore(map, s), 'map');
  refresh();
}

// ---------------------------------------------------------------- vue (zoom / déplacement)
function fitView() {
  const { w, h: hh } = S.size;
  if (!w || !hh) { S.needFit = true; return; }
  const map = curMap();
  const mw = map.width * map.tileSize, mh = map.height * map.tileSize;
  let z = Math.min((w - 48) / mw, (hh - 48) / mh);
  z = clamp(z >= 1 ? Math.floor(z) : z, MIN_ZOOM, MAX_ZOOM);
  S.view = { zoom: z, ox: (w - mw * z) / 2, oy: (hh - mh * z) / 2 };
  S.needFit = false;
  updateStatus();
  requestDraw();
}

function requestDraw() {
  if (!S || S.raf) return;
  S.raf = requestAnimationFrame(() => { if (!S) return; S.raf = 0; draw(); });
}

function canvasPos(e) {
  const r = els.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

const toWorld = (p) => ({ x: (p.x - S.view.ox) / S.view.zoom, y: (p.y - S.view.oy) / S.view.zoom });

function setMsg(text) {
  S.msg = text;
  clearTimeout(S.msgTimer);
  S.msgTimer = setTimeout(() => { if (S) { S.msg = ''; updateStatus(); } }, 3000);
  updateStatus();
}

// ---------------------------------------------------------------- rendu du canevas
function drawTile(ctx, tileset, idx, x, y, w, hh) {
  const src = tileset && idx >= 0 ? tileset.frames[idx] : null;
  if (src) {
    const img = getImg(src);
    if (img) ctx.drawImage(img, x, y, w, hh);
    return;
  }
  // tuile inconnue (pas de tileset ou index hors limites)
  ctx.fillStyle = 'rgba(214, 70, 200, .55)';
  ctx.fillRect(x, y, w, hh);
  if (w >= 12) {
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(w * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + hh / 2);
  }
}

function layerData(layer) {
  const g = S.gesture;
  return g && g.work && g.layerId === layer.id ? g.work : layer.data;
}

function entPos(e) {
  const g = S.gesture;
  return g && g.type === 'ent' && g.id === e.id ? { x: g.x, y: g.y } : e;
}

// Cache de rendu : un canvas hors écran par morceau de CHUNK×CHUNK tuiles et par tableau `data`
// (les tableaux ne sont jamais modifiés sur place → un nouveau tableau = cache neuf automatiquement).
function dataId(data) {
  let id = S.dataIds.get(data);
  if (!id) { id = S.nextDataId++; S.dataIds.set(data, id); }
  return id;
}

function getChunk(data, map, tileset, cx, cy) {
  const key = `${S.imgGen}|${tileset ? tileset.id + ':' + tileset.frames.length : ''}|${map.width}|${map.tileSize}`;
  if (S.chunkKey !== key) { S.chunks.clear(); S.chunkKey = key; }
  const ck = `${dataId(data)}:${cx}:${cy}`;
  let cv = S.chunks.get(ck);
  if (cv) { S.chunks.delete(ck); S.chunks.set(ck, cv); return cv; }
  const ts = map.tileSize;
  const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
  const tw = Math.min(CHUNK, map.width - tx0), th = Math.min(CHUNK, map.height - ty0);
  cv = document.createElement('canvas');
  cv.width = tw * ts; cv.height = th * ts;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const idx = data[(ty0 + j) * map.width + tx0 + i];
      if (idx >= 0) drawTile(c, tileset, idx, i * ts, j * ts, ts, ts);
    }
  }
  S.chunks.set(ck, cv);
  if (S.chunks.size > MAX_CHUNKS) S.chunks.delete(S.chunks.keys().next().value);
  return cv;
}

// Copie la partie visible d'un morceau sur le canevas
function blit(ctx, cv, dx, dy, dw, dh) {
  const { w, h: hh } = S.size;
  const a0 = Math.max(dx, 0), b0 = Math.max(dy, 0), a1 = Math.min(dx + dw, w), b1 = Math.min(dy + dh, hh);
  if (a1 <= a0 || b1 <= b0 || dw <= 0 || dh <= 0) return;
  const kx = cv.width / dw, ky = cv.height / dh;
  ctx.drawImage(cv, (a0 - dx) * kx, (b0 - dy) * ky, (a1 - a0) * kx, (b1 - b0) * ky, a0, b0, a1 - a0, b1 - b0);
}

function drawLayer(ctx, layer, map, tileset, X, Y, x0, x1, y0, y1) {
  const g = S.gesture;
  if (g && g.work && g.layerId === layer.id) {
    // calque en cours d'édition : tableau modifié sur place → dessin direct
    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const idx = g.work[ty * map.width + tx];
        if (!(idx >= 0)) continue;
        drawTile(ctx, tileset, idx, X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
      }
    }
    return;
  }
  for (let cy = Math.floor(y0 / CHUNK); cy * CHUNK < y1; cy++) {
    for (let cx = Math.floor(x0 / CHUNK); cx * CHUNK < x1; cx++) {
      const cv = getChunk(layer.data, map, tileset, cx, cy);
      const tx1 = Math.min((cx + 1) * CHUNK, map.width), ty1 = Math.min((cy + 1) * CHUNK, map.height);
      const dx = X(cx * CHUNK), dy = Y(cy * CHUNK);
      blit(ctx, cv, dx, dy, X(tx1) - dx, Y(ty1) - dy);
    }
  }
}

function hasProps(e) {
  return !!e.props && typeof e.props === 'object' && Object.keys(e.props).length > 0;
}

function drawEntities(ctx, map) {
  const { zoom: z, ox, oy } = S.view;
  const ts = map.tileSize;
  const { w, h: hh } = S.size;
  for (const e of map.entities) {
    const p = entPos(e);
    const info = entityInfo(e, ts);
    const sx = Math.round(ox + p.x * z), sy = Math.round(oy + p.y * z);
    const sw = Math.max(1, Math.round(info.w * z)), sh = Math.max(1, Math.round(info.h * z));
    if (sx > w || sy > hh || sx + sw < 0 || sy + sh < 0) continue;
    if (info.img) ctx.drawImage(info.img, sx, sy, sw, sh);
    else if (info.missing) {
      ctx.fillStyle = '#e02f3f';
      ctx.fillRect(sx, sy, sw, sh);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.3)';
      ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    }
    if (hasProps(e)) {
      // badge « propriétés d'instance »
      const bw = 13, bx = Math.max(sx, sx + sw - bw), by = sy;
      ctx.fillStyle = '#4fa3ff';
      ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = '#04121f';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', bx + bw / 2, by + 6.5);
    }
    if (e.id === S.entityId) {
      ctx.save();
      ctx.strokeStyle = '#ffcd75';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- mini-carte
let _px = null;
function pxCtx() {
  if (!_px) { _px = document.createElement('canvas'); _px.width = _px.height = 1; }
  return _px.getContext('2d', { willReadFrequently: true });
}

function cssRGB(str) {
  const c = pxCtx();
  c.clearRect(0, 0, 1, 1);
  c.fillStyle = '#000';
  c.fillStyle = str || '#000';
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

// Couleur moyenne d'une tuile (pour la mini-carte)
function tileColor(tileset, idx) {
  const src = tileset ? tileset.frames[idx] : null;
  if (!src) return [214, 70, 200, 200];
  const img = getImg(src);
  if (!img) return null;
  let col = S.avg.get(src);
  if (!col) {
    const c = pxCtx();
    c.clearRect(0, 0, 1, 1);
    c.imageSmoothingEnabled = true;
    c.drawImage(img, 0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data;
    col = [d[0], d[1], d[2], d[3] > 0 ? Math.max(d[3], 170) : 0];
    S.avg.set(src, col);
  }
  return col;
}

function rebuildMini(map, tileset) {
  const W = map.width, H = map.height;
  const m = S.mini;
  if (!m.canvas) m.canvas = document.createElement('canvas');
  m.canvas.width = W; m.canvas.height = H;
  const bg = cssRGB(map.background);
  const img = new ImageData(W, H);
  const px = img.data;
  for (let k = 0; k < W * H; k++) { px[k * 4] = bg[0]; px[k * 4 + 1] = bg[1]; px[k * 4 + 2] = bg[2]; px[k * 4 + 3] = 255; }
  const order = [...map.layers.filter((l) => l.depth !== 'above'), ...map.layers.filter((l) => l.depth === 'above')];
  for (const l of order) {
    if (!l.visible) continue;
    for (let k = 0; k < W * H; k++) {
      const idx = l.data[k];
      if (!(idx >= 0)) continue;
      const c = tileColor(tileset, idx);
      if (!c || !c[3]) continue;
      const a = c[3] / 255, o = k * 4;
      px[o] = c[0] * a + px[o] * (1 - a);
      px[o + 1] = c[1] * a + px[o + 1] * (1 - a);
      px[o + 2] = c[2] * a + px[o + 2] * (1 - a);
    }
  }
  m.canvas.getContext('2d').putImageData(img, 0, 0);
}

function drawMini(map) {
  const cv = els?.miniCanvas;
  if (!cv || !cv.width) return;
  const tileset = tilesetOf(map);
  const sig = [S.imgGen, tileset?.id, tileset?.frames.length, map.width, map.height, map.background,
    ...map.layers.flatMap((l) => [l.data, l.visible, l.depth])];
  const m = S.mini;
  if (!m.sig || m.sig.length !== sig.length || sig.some((v, i) => v !== m.sig[i])) {
    rebuildMini(map, tileset);
    m.sig = sig;
  }
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0f1017';
  ctx.fillRect(0, 0, W, H);
  const sc = Math.min(W / map.width, H / map.height);
  const mw = map.width * sc, mh = map.height * sc;
  const ox = (W - mw) / 2, oy = (H - mh) / 2;
  m.geom = { sc, ox, oy };
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(m.canvas, ox, oy, mw, mh);
  const ts = map.tileSize;
  ctx.fillStyle = '#ffcd75';
  const d = Math.max(2, sc * 0.6);
  for (const e of map.entities) ctx.fillRect(ox + (e.x / ts) * sc - d / 2 + sc / 2, oy + (e.y / ts) * sc - d / 2 + sc / 2, d, d);
  // zone visible
  const { zoom: z, ox: vx, oy: vy } = S.view;
  const vw = S.size.w / (ts * z), vh = S.size.h / (ts * z);
  const rx = ox + (-vx / (ts * z)) * sc, ry = oy + (-vy / (ts * z)) * sc;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(rx) + 0.5, Math.round(ry) + 0.5, Math.max(2, Math.round(vw * sc)), Math.max(2, Math.round(vh * sc)));
}

function miniGo(e) {
  const g = S.mini.geom;
  if (!g) return;
  const map = curMap();
  const r = els.miniCanvas.getBoundingClientRect();
  const tx = (e.clientX - r.left - g.ox) / g.sc, ty = (e.clientY - r.top - g.oy) / g.sc;
  const ts = map.tileSize, z = S.view.zoom;
  S.view.ox = S.size.w / 2 - tx * ts * z;
  S.view.oy = S.size.h / 2 - ty * ts * z;
  updateStatus();
  requestDraw();
}

function draw() {
  const ctx = els.ctx;
  const { w, h: hh } = S.size;
  if (!w || !hh) return;
  const map = curMap();
  const tileset = tilesetOf(map);
  const { zoom: z, ox, oy } = S.view;
  const ts = map.tileSize;
  const X = (tx) => Math.round(ox + tx * ts * z);
  const Y = (ty) => Math.round(oy + ty * ts * z);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0f1017';
  ctx.fillRect(0, 0, w, hh);
  ctx.fillStyle = map.background || '#000';
  ctx.fillRect(X(0), Y(0), X(map.width) - X(0), Y(map.height) - Y(0));

  const x0 = clamp(Math.floor(-ox / (ts * z)), 0, map.width);
  const x1 = clamp(Math.ceil((w - ox) / (ts * z)), 0, map.width);
  const y0 = clamp(Math.floor(-oy / (ts * z)), 0, map.height);
  const y1 = clamp(Math.ceil((hh - oy) / (ts * z)), 0, map.height);

  // calques « derrière » → entités → calques « devant » (layer.depth === 'above')
  const active = activeLayer(map);
  const drawLayers = (list) => {
    for (const layer of list) {
      if (!layer.visible) continue;
      ctx.globalAlpha = S.dim && layer !== active ? 0.4 : 1;
      drawLayer(ctx, layer, map, tileset, X, Y, x0, x1, y0, y1);
    }
    ctx.globalAlpha = 1;
  };
  drawLayers(map.layers.filter((l) => l.depth !== 'above'));
  drawEntities(ctx, map);
  drawLayers(map.layers.filter((l) => l.depth === 'above'));

  // grille
  if (S.grid && ts * z >= 6) {
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let tx = x0; tx <= x1; tx++) { const sx = X(tx) + 0.5; ctx.moveTo(sx, Y(y0)); ctx.lineTo(sx, Y(y1)); }
    for (let ty = y0; ty <= y1; ty++) { const sy = Y(ty) + 0.5; ctx.moveTo(X(x0), sy); ctx.lineTo(X(x1), sy); }
    ctx.stroke();
  }

  // contour de la carte
  ctx.strokeStyle = 'rgba(255, 205, 117, .75)';
  ctx.lineWidth = 1;
  ctx.strokeRect(X(0) - 0.5, Y(0) - 0.5, X(map.width) - X(0) + 1, Y(map.height) - Y(0) + 1);

  drawOverlay(ctx, map, tileset, X, Y);
  drawMini(map);
}

function outlineCells(ctx, X, Y, cx, cy, cw, ch, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(X(cx) + 1, Y(cy) + 1, X(cx + cw) - X(cx) - 2, Y(cy + ch) - Y(cy) - 2);
}

function drawSelBox(ctx, X, Y, r) {
  ctx.save();
  ctx.strokeStyle = '#7fd1ff';
  ctx.fillStyle = 'rgba(127, 209, 255, .15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  const x = X(r.x0), y = Y(r.y0), w = X(r.x1 + 1) - x, hh = Y(r.y1 + 1) - y;
  ctx.fillRect(x, y, w, hh);
  ctx.strokeRect(x + 1, y + 1, w - 2, hh - 2);
  ctx.restore();
}

// Prévisualisation : curseur, rectangle en cours, fantôme d'entité
function drawOverlay(ctx, map, tileset, X, Y) {
  const g = S.gesture;
  const hv = S.hover;
  if (g?.type === 'select') {
    drawSelBox(ctx, X, Y, rectOf(g.start, g.end));
  } else if (S.sel && S.tool === 'select') drawSelBox(ctx, X, Y, S.sel);
  if (g && (g.type === 'pan' || g.type === 'ent' || g.type === 'select')) return;

  if (g && g.type === 'rect') {
    const r = rectOf(g.start, g.end);
    ctx.globalAlpha = 0.6;
    for (let ty = r.y0; ty <= r.y1; ty++) {
      for (let tx = r.x0; tx <= r.x1; tx++) {
        if (g.erase) { ctx.fillStyle = '#e02f3f'; ctx.fillRect(X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty)); continue; }
        const t = patternTile(S.brush, tx - r.x0, ty - r.y0);
        if (t !== -2) drawTile(ctx, tileset, t, X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
      }
    }
    ctx.globalAlpha = 1;
    outlineCells(ctx, X, Y, r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1, '#ffcd75');
    return;
  }
  if (!hv || S.space || g) return;

  const { cx, cy } = hv;
  if (S.paste && S.clip) {
    const b = S.clip;
    ctx.globalAlpha = 0.65;
    for (let j = 0; j < b.h; j++) {
      for (let i = 0; i < b.w; i++) {
        const t = b.tiles[j * b.w + i];
        const tx = cx + i, ty = cy + j;
        if (t < 0 || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        drawTile(ctx, tileset, t, X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
      }
    }
    ctx.globalAlpha = 1;
    outlineCells(ctx, X, Y, cx, cy, b.w, b.h, '#7fd1ff');
    return;
  }
  if (S.tool === 'entities') {
    const obj = findById(store.project.objects, store.ui.selectedObjectId);
    const of = objectFrame(obj);
    if (!obj || !of) return;
    const p = entityPlacement(hv, of.spr.width, of.spr.height, hv.shift, map);
    const img = getImg(of.src);
    const sx = Math.round(S.view.ox + p.x * S.view.zoom), sy = Math.round(S.view.oy + p.y * S.view.zoom);
    const sw = Math.round(of.spr.width * S.view.zoom), sh = Math.round(of.spr.height * S.view.zoom);
    ctx.globalAlpha = 0.6;
    if (img) ctx.drawImage(img, sx, sy, sw, sh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,205,117,.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    return;
  }
  if (S.tool === 'brush') {
    const b = S.brush;
    ctx.globalAlpha = 0.6;
    for (let j = 0; j < b.h; j++) {
      for (let i = 0; i < b.w; i++) {
        const t = b.tiles[j * b.w + i];
        const tx = cx + i, ty = cy + j;
        if (t === -2 || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        drawTile(ctx, tileset, t, X(tx), Y(ty), X(tx + 1) - X(tx), Y(ty + 1) - Y(ty));
      }
    }
    ctx.globalAlpha = 1;
    outlineCells(ctx, X, Y, cx, cy, b.w, b.h, 'rgba(255,255,255,.85)');
  } else {
    outlineCells(ctx, X, Y, cx, cy, 1, 1, S.tool === 'eraser' ? '#ef5d6d' : 'rgba(255,255,255,.85)');
  }
}

// ---------------------------------------------------------------- outils : peinture
const rectOf = (a, b) => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) });

// tuile du tampon répété sur une zone (dx, dy relatifs à l'origine de la zone)
function patternTile(brush, dx, dy) {
  const i = ((dx % brush.w) + brush.w) % brush.w;
  const j = ((dy % brush.h) + brush.h) % brush.h;
  return brush.tiles[j * brush.w + i];
}

function stampAt(g, map, cx, cy, brush) {
  for (let j = 0; j < brush.h; j++) {
    for (let i = 0; i < brush.w; i++) {
      const t = brush.tiles[j * brush.w + i];
      const x = cx + i, y = cy + j;
      if (t === -2 || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const k = y * map.width + x;
      if (g.work[k] !== t) { g.work[k] = t; g.changed = true; }
    }
  }
}

function lineCells(a, b, fn) {
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    fn(x, y);
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function floodFill(g, map, cx, cy, brush, erase) {
  const W = map.width, H = map.height;
  const target = g.work[cy * W + cx];
  const seen = new Uint8Array(W * H);
  const stack = [cx, cy];
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const k = y * W + x;
    if (x < 0 || y < 0 || x >= W || y >= H || seen[k] || g.work[k] !== target) continue;
    seen[k] = 1;
    const t = erase ? -1 : patternTile(brush, x - cx, y - cy);
    if (t !== -2 && g.work[k] !== t) { g.work[k] = t; g.changed = true; }
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
}

function applyRect(g, map, brush, erase) {
  const r = rectOf(g.start, g.end);
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      const t = erase ? -1 : patternTile(brush, x - r.x0, y - r.y0);
      const k = y * map.width + x;
      if (t !== -2 && g.work[k] !== t) { g.work[k] = t; g.changed = true; }
    }
  }
}

function copyData(layer, map) {
  const work = new Array(map.width * map.height).fill(-1);
  for (let k = 0; k < work.length; k++) work[k] = layer.data[k] ?? -1;
  return work;
}

function setBrushSingle(idx) {
  const cols = S.pal?.cols || 1;
  S.brush = { w: 1, h: 1, tiles: [idx] };
  S.palSel = { c0: idx % cols, r0: Math.floor(idx / cols), c1: idx % cols, r1: Math.floor(idx / cols) };
  updatePalInfo();
  drawPalette();
}

// ---------------------------------------------------------------- outils : entités
function entityPlacement(hv, w, hh, free, map) {
  if (free) return { x: Math.round(hv.wx), y: Math.round(hv.wy) };
  return { x: hv.cx * map.tileSize, y: hv.cy * map.tileSize };
}

function hitEntity(map, wx, wy) {
  for (let i = map.entities.length - 1; i >= 0; i--) {
    const e = map.entities[i];
    const info = entityInfo(e, map.tileSize);
    if (wx >= e.x && wy >= e.y && wx < e.x + info.w && wy < e.y + info.h) return e;
  }
  return null;
}

// ---------------------------------------------------------------- événements canevas
function hoverFrom(e, p) {
  const w = toWorld(p);
  const map = curMap();
  S.hover = {
    wx: w.x, wy: w.y, shift: e.shiftKey,
    cx: Math.floor(w.x / map.tileSize), cy: Math.floor(w.y / map.tileSize),
  };
}

function updateCursor() {
  if (!els) return;
  els.canvas.style.cursor = S.gesture?.type === 'pan' ? 'grabbing' : S.space ? 'grab' : S.tool === 'entities' ? 'default' : 'crosshair';
}

function onPointerDown(e) {
  if (e.button === 1 || (e.button === 0 && S.space)) {
    e.preventDefault();
    els.canvas.setPointerCapture(e.pointerId);
    S.gesture = { type: 'pan', lastX: e.clientX, lastY: e.clientY };
    updateCursor();
    return;
  }
  if (e.button !== 0 && e.button !== 2) return;
  const map = curMap();
  const p = canvasPos(e);
  hoverFrom(e, p);
  const hv = S.hover;
  const erase = e.button === 2;
  const inMap = hv.cx >= 0 && hv.cy >= 0 && hv.cx < map.width && hv.cy < map.height;
  els.canvas.focus({ preventScroll: true });

  if (S.paste && S.clip) {
    if (erase) { S.paste = false; requestDraw(); return; }
    pasteAt(map, hv.cx, hv.cy);
    return;
  }
  if (S.tool === 'select') {
    if (erase) { S.sel = null; requestDraw(); return; }
    if (!inMap) return;
    els.canvas.setPointerCapture(e.pointerId);
    S.gesture = { type: 'select', start: { x: hv.cx, y: hv.cy }, end: { x: hv.cx, y: hv.cy } };
    requestDraw();
    return;
  }

  if (S.tool === 'entities') {
    const hit = hitEntity(map, hv.wx, hv.wy);
    if (erase) {
      if (hit) deleteEntity(hit.id);
      return;
    }
    els.canvas.setPointerCapture(e.pointerId);
    if (hit) {
      S.entityId = hit.id;
      store.setSelection({ type: 'entity', id: hit.id, mapId: map.id });
      renderInstance();
      S.gesture = { type: 'ent', id: hit.id, offX: hv.wx - hit.x, offY: hv.wy - hit.y, x: hit.x, y: hit.y, ox: hit.x, oy: hit.y };
    } else {
      const obj = findById(store.project.objects, store.ui.selectedObjectId);
      S.entityId = null;
      store.setSelection({ type: 'map', id: map.id });
      renderInstance();
      if (!obj) { setMsg('Choisissez d\'abord un objet dans la liste « Objets ».'); }
      else {
        const of = objectFrame(obj);
        const pos = entityPlacement(hv, of?.spr.width || map.tileSize, of?.spr.height || map.tileSize, e.shiftKey, map);
        S.gesture = { type: 'place', objectId: obj.id, x: pos.x, y: pos.y };
      }
    }
    requestDraw();
    return;
  }

  if (!inMap && S.tool !== 'pick') return;
  const layer = activeLayer(map);
  if (!layer) return;
  if (S.tool === 'pick') {
    if (!inMap) return;
    const v = layer.data[hv.cy * map.width + hv.cx];
    if (v >= 0) { setBrushSingle(v); setTool('brush'); }
    else setMsg('Case vide sur le calque actif.');
    return;
  }
  if (!layer.visible) { setMsg('Le calque actif est masqué.'); return; }

  els.canvas.setPointerCapture(e.pointerId);
  const cell = { x: hv.cx, y: hv.cy };
  const g = { type: 'paint', layerId: layer.id, work: copyData(layer, map), changed: false, last: cell, erase };
  S.gesture = g;
  if (S.tool === 'brush' || S.tool === 'eraser') {
    stampAt(g, map, cell.x, cell.y, erase || S.tool === 'eraser' ? ERASER : S.brush);
  } else if (S.tool === 'fill') {
    floodFill(g, map, cell.x, cell.y, S.brush, erase);
  } else if (S.tool === 'rect') {
    g.type = 'rect'; g.start = cell; g.end = cell;
  }
  requestDraw();
}

function onPointerMove(e) {
  const g = S.gesture;
  if (g?.type === 'pan') {
    S.view.ox += e.clientX - g.lastX;
    S.view.oy += e.clientY - g.lastY;
    g.lastX = e.clientX; g.lastY = e.clientY;
    requestDraw();
    return;
  }
  const map = curMap();
  hoverFrom(e, canvasPos(e));
  const hv = S.hover;
  if (g?.type === 'paint' && (S.tool === 'brush' || S.tool === 'eraser')) {
    const cell = { x: hv.cx, y: hv.cy };
    if (cell.x !== g.last.x || cell.y !== g.last.y) {
      const brush = g.erase || S.tool === 'eraser' ? ERASER : S.brush;
      lineCells(g.last, cell, (x, y) => stampAt(g, map, x, y, brush));
      g.last = cell;
    }
  } else if (g?.type === 'rect' || g?.type === 'select') {
    g.end = { x: clamp(hv.cx, 0, map.width - 1), y: clamp(hv.cy, 0, map.height - 1) };
  } else if (g?.type === 'ent') {
    let x = hv.wx - g.offX, y = hv.wy - g.offY;
    if (e.shiftKey) { x = Math.round(x); y = Math.round(y); }
    else { x = Math.round(x / map.tileSize) * map.tileSize; y = Math.round(y / map.tileSize) * map.tileSize; }
    g.x = x; g.y = y;
  }
  updateStatus();
  requestDraw();
}

function onPointerUp(e) {
  const g = S.gesture;
  if (!g) return;
  S.gesture = null;
  try { els.canvas.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
  updateCursor();
  const map = curMap();
  if (g.type === 'select') { S.sel = rectOf(g.start, g.end); requestDraw(); return; }
  if (g.type === 'rect') applyRect(g, map, g.erase ? ERASER : S.brush, g.erase);
  if ((g.type === 'paint' || g.type === 'rect') && g.changed) {
    commit((m) => { const l = findById(m.layers, g.layerId); if (l) l.data = g.work; });
  } else if (g.type === 'ent' && (g.x !== g.ox || g.y !== g.oy)) {
    commit((m) => { const en = findById(m.entities, g.id); if (en) { en.x = g.x; en.y = g.y; } });
  } else if (g.type === 'place') {
    const id = uid('ent');
    commit((m) => { m.entities.push({ id, objectId: g.objectId, x: g.x, y: g.y }); });
    S.entityId = id;
    renderInstance();
  }
  requestDraw();
}

function onWheel(e) {
  e.preventDefault();
  const p = canvasPos(e);
  const v = S.view;
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    // défilement horizontal (Maj + molette, ou geste horizontal du pavé tactile)
    v.ox -= e.deltaX || e.deltaY;
    updateStatus();
    requestDraw();
    return;
  }
  const nz = clamp(v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_ZOOM, MAX_ZOOM);
  v.ox = p.x - (p.x - v.ox) * (nz / v.zoom);
  v.oy = p.y - (p.y - v.oy) * (nz / v.zoom);
  v.zoom = nz;
  updateStatus();
  requestDraw();
}

function copySelection() {
  const map = curMap();
  const layer = activeLayer(map);
  if (!S.sel || !layer) { setMsg('Rien à copier : sélectionnez des tuiles (outil Sélection, S).'); return; }
  const r = S.sel;
  const w = r.x1 - r.x0 + 1, hh = r.y1 - r.y0 + 1;
  const tiles = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) tiles.push(layer.data[y * map.width + x] ?? -1);
  S.clip = { w, h: hh, tiles };
  setMsg(`Copié : ${w}×${hh} tuiles`);
}

function startPaste() {
  if (!S.clip) { setMsg('Presse-papiers vide : copiez d\'abord une sélection (Ctrl+C).'); return; }
  setTool('select');
  S.paste = true;
  setMsg('Coller : clic = poser · Échap / clic droit = terminer');
  requestDraw();
}

function pasteAt(map, cx, cy) {
  const layer = activeLayer(map);
  if (!layer) return;
  if (!layer.visible) { setMsg('Le calque actif est masqué.'); return; }
  const b = S.clip;
  const work = copyData(layer, map);
  let changed = false;
  for (let j = 0; j < b.h; j++) {
    for (let i = 0; i < b.w; i++) {
      const t = b.tiles[j * b.w + i], x = cx + i, y = cy + j;
      if (t < 0 || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (work[y * map.width + x] !== t) { work[y * map.width + x] = t; changed = true; }
    }
  }
  if (changed) commit((m) => { const l = findById(m.layers, layer.id); if (l) l.data = work; });
}

function clearSelection() {
  const map = curMap();
  const layer = activeLayer(map);
  if (!S.sel || !layer || !layer.visible) return;
  const work = copyData(layer, map);
  let changed = false;
  for (let y = S.sel.y0; y <= S.sel.y1; y++) {
    for (let x = S.sel.x0; x <= S.sel.x1; x++) {
      if (work[y * map.width + x] !== -1) { work[y * map.width + x] = -1; changed = true; }
    }
  }
  if (changed) commit((m) => { const l = findById(m.layers, layer.id); if (l) l.data = work; });
}

function deleteEntity(id) {
  if (S.entityId === id) S.entityId = null;
  commit((m) => { m.entities = m.entities.filter((en) => en.id !== id); });
}

// ---------------------------------------------------------------- clavier
function onKeyDown(e) {
  if (!S) return;
  const t = e.target;
  if (t instanceof HTMLElement && t.matches('input:not([type=color]):not([type=checkbox]), textarea, select')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!S.space) { S.space = true; updateCursor(); }
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod) {
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    else if (k === 'c') { e.preventDefault(); copySelection(); }
    else if (k === 'v') { e.preventDefault(); startPaste(); }
    return;
  }
  if (e.altKey) return;
  const tool = TOOLS.find((x) => x.key.toLowerCase() === k);
  if (tool) { setTool(tool.id); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.entityId) {
    e.preventDefault();
    deleteEntity(S.entityId);
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.tool === 'select' && S.sel) {
    e.preventDefault();
    clearSelection();
  } else if (e.key === 'Escape') {
    S.entityId = null;
    S.paste = false;
    S.sel = null;
    renderInstance();
    requestDraw();
  }
}

function onKeyUp(e) {
  if (S && e.code === 'Space') { S.space = false; updateCursor(); }
}

// ---------------------------------------------------------------- UI : barre d'outils et statut
function setTool(id) {
  S.tool = id;
  if (id !== 'select') S.paste = false;
  renderInstance();
  renderToolbar();
  updateCursor();
  requestDraw();
}

function renderToolbar() {
  for (const t of TOOLS) els.toolBtns[t.id].classList.toggle('active', S.tool === t.id);
  const map = curMap();
  els.undoBtn.disabled = !stackOf(S.undo, map.id).length;
  els.redoBtn.disabled = !stackOf(S.redo, map.id).length;
  els.gridBtn.classList.toggle('active', S.grid);
}

function updateStatus() {
  if (!S || !els) return;
  const map = curMap();
  const hv = S.hover;
  let left = '';
  if (hv) {
    left = `x ${hv.cx}, y ${hv.cy}`;
    if (hv.cx >= 0 && hv.cy >= 0 && hv.cx < map.width && hv.cy < map.height) {
      const l = activeLayer(map);
      const v = l ? l.data[hv.cy * map.width + hv.cx] : -1;
      left += ` · tuile ${v >= 0 ? v : 'vide'}`;
    }
  }
  els.statusLeft.textContent = left;
  els.statusMsg.textContent = S.msg;
  els.statusRight.textContent = `${map.width}×${map.height} tuiles · zoom ${Math.round(S.view.zoom * 100)} %`;
}

// ---------------------------------------------------------------- UI : colonne gauche
function newMapForm() {
  const name = h('input', { type: 'text', value: 'Nouvelle carte' });
  const w = h('input', { type: 'number', min: 1, max: MAX_MAP, value: 40 });
  const hh = h('input', { type: 'number', min: 1, max: MAX_MAP, value: 12 });
  const create = () => {
    const nw = clamp(parseInt(w.value, 10) || 40, 1, MAX_MAP);
    const nh = clamp(parseInt(hh.value, 10) || 12, 1, MAX_MAP);
    const cur = curMap();
    const m = createMap(name.value.trim() || 'Carte', nw, nh, store.project.settings.tileSize || cur.tileSize);
    m.tilesetSpriteId = cur.tilesetSpriteId;
    store.update((p) => { p.maps.push(m); }, 'map');
    S.newForm = false;
    selectMap(m.id);
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
  return h('div', { class: 'map-newform' },
    name,
    h('div', { class: 'map-row' }, h('label', {}, 'Largeur'), w, h('label', {}, 'Hauteur'), hh),
    h('div', { class: 'map-row' },
      h('button', { class: 'primary', onclick: create }, 'Créer'),
      h('button', { onclick: () => { S.newForm = false; renderLeft(); } }, 'Annuler')));
}

function selectMap(id) {
  store.ui.selectedMapId = id;
  S.gesture = null;
  refresh();
}

function mapActions(map) {
  const maps = store.project.maps;
  return h('div', { class: 'map-row' },
    h('button', { onclick: () => { S.newForm = true; renderLeft(); } }, 'Nouvelle'),
    h('button', {
      onclick: () => {
        const copy = structuredClone(map);
        copy.id = uid('map');
        copy.name = map.name + ' (copie)';
        for (const l of copy.layers) l.id = uid('lay');
        for (const en of copy.entities) en.id = uid('ent');
        store.update((p) => { p.maps.splice(p.maps.findIndex((m) => m.id === map.id) + 1, 0, copy); }, 'map');
        selectMap(copy.id);
      },
    }, 'Dupliquer'),
    h('button', {
      onclick: () => {
        const n = prompt('Nom de la carte :', map.name);
        if (n && n.trim()) commit((m) => { m.name = n.trim(); });
      },
    }, 'Renommer'),
    h('button', {
      disabled: maps.length <= 1,
      title: maps.length <= 1 ? 'Impossible : il faut au moins une carte' : '',
      onclick: () => {
        if (!confirm(`Supprimer la carte « ${map.name} » ? Cette action est définitive.`)) return;
        store.update((p) => {
          p.maps = p.maps.filter((m) => m.id !== map.id);
          if (p.settings.startMapId === map.id) p.settings.startMapId = p.maps[0].id;
        }, 'map');
        store.ui.selectedMapId = store.project.maps[0].id;
        S.undo.delete(map.id); S.redo.delete(map.id);
        refresh();
      },
    }, 'Supprimer'));
}

function mapProps(map) {
  const sprites = store.project.sprites;
  const ts = tilesetOf(map);
  const wIn = h('input', { type: 'number', min: 1, max: MAX_MAP, value: map.width });
  const hIn = h('input', { type: 'number', min: 1, max: MAX_MAP, value: map.height });
  const apply = () => {
    const nw = clamp(parseInt(wIn.value, 10) || map.width, 1, MAX_MAP);
    const nh = clamp(parseInt(hIn.value, 10) || map.height, 1, MAX_MAP);
    if (nw === map.width && nh === map.height) return;
    commit((m) => resizeMap(m, nw, nh));
  };
  const sel = h('select', {
    onchange: () => commit((m) => { m.tilesetSpriteId = sel.value || null; }),
  }, h('option', { value: '' }, '(aucun)'),
  ...sprites.map((s) => h('option', { value: s.id }, `${s.name} (${s.width}×${s.height}, ${s.frames.length})`)));
  sel.value = ts ? ts.id : '';
  const color = h('input', {
    type: 'color', value: /^#[0-9a-f]{6}$/i.test(map.background) ? map.background : '#000000',
    onchange: () => commit((m) => { m.background = color.value; }),
  });
  const warn = [];
  if (map.tilesetSpriteId && !ts) warn.push(h('div', { class: 'map-warn' }, 'Le tileset de cette carte n\'existe plus.'));
  if (ts && (ts.width !== map.tileSize || ts.height !== map.tileSize)) {
    warn.push(h('div', { class: 'map-warn' }, `Tuiles du sprite : ${ts.width}×${ts.height} px, carte : ${map.tileSize} px (mises à l'échelle).`));
  }
  return h('div', { class: 'map-section' },
    h('div', { class: 'map-field' }, h('span', {}, 'Taille'), wIn, '×', hIn, h('button', { onclick: apply, title: 'Redimensionner (ancrage haut-gauche)' }, 'OK')),
    h('div', { class: 'map-field' }, h('span', {}, 'Fond'), color),
    h('div', { class: 'map-field' }, h('span', {}, 'Tileset'), sel),
    ...warn);
}

function resizeMap(map, nw, nh) {
  const ow = map.width, oh = map.height;
  for (const l of map.layers) {
    const d = new Array(nw * nh).fill(-1);
    for (let y = 0; y < Math.min(oh, nh); y++) {
      for (let x = 0; x < Math.min(ow, nw); x++) d[y * nw + x] = l.data[y * ow + x] ?? -1;
    }
    l.data = d;
  }
  map.width = nw; map.height = nh;
  map.entities = map.entities.filter((e) => e.x < nw * map.tileSize && e.y < nh * map.tileSize);
}

function layersSection(map) {
  const active = activeLayer(map);
  const n = map.layers.length;
  const move = (layer, dir) => commit((m) => {
    const i = m.layers.findIndex((l) => l.id === layer.id);
    const j = i + dir;
    if (j < 0 || j >= m.layers.length) return;
    [m.layers[i], m.layers[j]] = [m.layers[j], m.layers[i]];
  });
  const rows = [...map.layers].reverse().map((l) => {
    const i = map.layers.indexOf(l);
    return h('div', {
      class: 'list-item map-layer' + (l === active ? ' selected' : '') + (l.visible ? '' : ' hidden'),
      onclick: () => { S.layerId = l.id; renderLeft(); requestDraw(); updateStatus(); },
      ondblclick: () => {
        const nm = prompt('Nom du calque :', l.name);
        if (nm && nm.trim()) commit((m) => { findById(m.layers, l.id).name = nm.trim(); });
      },
    },
    h('button', {
      class: 'map-mini' + (l.visible ? ' on' : ''), title: l.visible ? 'Masquer' : 'Afficher',
      onclick: (e) => { e.stopPropagation(); commit((m) => { const x = findById(m.layers, l.id); x.visible = !x.visible; }); },
    }, l.visible ? '◉' : '○'),
    h('span', { class: 'map-name', title: 'Double-clic pour renommer' }, l.name),
    h('button', {
      class: 'map-mini' + (l.collides ? ' on' : ''), title: l.collides ? 'Solide (collisions actives)' : 'Non solide',
      onclick: (e) => { e.stopPropagation(); commit((m) => { const x = findById(m.layers, l.id); x.collides = !x.collides; }); },
    }, l.collides ? '▣' : '▢'),
    h('button', {
      class: 'map-mini' + (l.depth === 'above' ? ' on' : ''),
      title: l.depth === 'above' ? 'Devant les entités (clic : derrière)' : 'Derrière les entités (clic : devant)',
      onclick: (e) => { e.stopPropagation(); commit((m) => { const x = findById(m.layers, l.id); x.depth = x.depth === 'above' ? 'below' : 'above'; }); },
    }, l.depth === 'above' ? '▲' : '▽'),
    h('button', { class: 'map-mini', title: 'Monter', disabled: i === n - 1, onclick: (e) => { e.stopPropagation(); move(l, 1); } }, '↑'),
    h('button', { class: 'map-mini', title: 'Descendre', disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(l, -1); } }, '↓'));
  });
  const dim = h('input', { type: 'checkbox', checked: S.dim, onchange: () => { S.dim = dim.checked; requestDraw(); } });
  return h('div', { class: 'map-section' },
    h('h3', {}, 'Calques'),
    h('div', { class: 'map-list' }, rows),
    h('div', { class: 'map-row' },
      h('button', {
        onclick: () => {
          const l = createLayer('Calque ' + (map.layers.length + 1), map.width, map.height, false);
          S.layerId = l.id;
          commit((m) => { m.layers.push(l); });
        },
      }, 'Ajouter'),
      h('button', {
        disabled: n <= 1, title: n <= 1 ? 'Il faut au moins un calque' : '',
        onclick: () => {
          if (!active || !confirm(`Supprimer le calque « ${active.name} » ?`)) return;
          const id = active.id;
          S.layerId = null;
          commit((m) => { m.layers = m.layers.filter((l) => l.id !== id); });
        },
      }, 'Supprimer')),
    h('label', { class: 'map-check' }, dim, 'Atténuer les autres calques'),
    h('div', { class: 'map-hint' }, '◉ visible · ▣ solide (collisions) · ▲ devant les entités (▽ derrière) · double-clic : renommer'));
}

function renderLeft() {
  const map = curMap();
  const start = store.project.settings.startMapId;
  const items = store.project.maps.map((m) => h('div', {
    class: 'list-item map-item' + (m.id === map.id ? ' selected' : ''),
    onclick: () => { if (m.id !== map.id) selectMap(m.id); },
  },
  h('button', {
    class: 'map-star' + (m.id === start ? ' on' : ''),
    title: m.id === start ? 'Carte de départ' : 'Définir comme carte de départ',
    onclick: (e) => {
      e.stopPropagation();
      store.update((p) => { p.settings.startMapId = m.id; }, 'map');
      renderLeft();
    },
  }, m.id === start ? '★' : '☆'),
  h('span', { class: 'map-name' }, m.name),
  h('span', { class: 'map-dim' }, `${m.width}×${m.height}`)));
  els.left.replaceChildren(
    h('div', { class: 'map-section' },
      h('h3', {}, 'Cartes'),
      h('div', { class: 'map-list' }, items),
      S.newForm ? newMapForm() : mapActions(map),
      h('div', { class: 'map-hint' }, '★ = carte de départ du jeu')),
    h('div', { class: 'map-section' }, h('h3', {}, 'Propriétés'), mapProps(map)),
    layersSection(map));
}

// ---------------------------------------------------------------- UI : colonne droite (palette, objets)
function sanitizeBrush(tileset) {
  const n = tileset ? tileset.frames.length : 0;
  if (!n || S.brush.tiles.some((t) => t >= n)) {
    S.brush = { w: 1, h: 1, tiles: [0] };
    S.palSel = { c0: 0, r0: 0, c1: 0, r1: 0 };
  }
}

function renderRight() {
  const map = curMap();
  const tileset = tilesetOf(map);
  sanitizeBrush(tileset);
  const tilesBox = h('div', { class: 'map-section' }, h('h3', {}, 'Tuiles'));
  S.pal = null;
  els.palCanvas = null;

  if (!tileset) {
    tilesBox.append(h('div', { class: 'map-empty' },
      map.tilesetSpriteId
        ? 'Le tileset de cette carte a été supprimé. Choisissez-en un autre dans les propriétés de la carte.'
        : 'Aucun tileset. Dessinez des tuiles dans l\'onglet « Pixel art » (chaque frame d\'un sprite = une tuile), puis choisissez ce sprite dans les propriétés de la carte.'));
  } else if (!tileset.frames.length) {
    tilesBox.append(h('div', { class: 'map-empty' }, 'Ce sprite n\'a aucune frame.'));
  } else {
    const n = tileset.frames.length;
    const cols = clamp(S.palCols || Math.min(n, 8), 1, n);
    const colsIn = h('input', {
      type: 'number', min: 1, max: n, value: cols,
      onchange: () => { S.palCols = clamp(parseInt(colsIn.value, 10) || 1, 1, n); S.palSel = { c0: 0, r0: 0, c1: 0, r1: 0 }; S.brush = { w: 1, h: 1, tiles: [0] }; renderRight(); },
    });
    const rows = Math.ceil(n / cols);
    const scale = clamp(Math.floor(220 / (cols * tileset.width)), 1, 4);
    const cw = tileset.width * scale, ch = tileset.height * scale;
    const canvas = h('canvas', { class: 'checker pixelated', width: cols * cw, height: rows * ch });
    S.pal = { cols, rows, cw, ch, n, tileset };
    els.palCanvas = canvas;
    wirePalette(canvas);
    S.palInfo = h('div', { class: 'map-hint' });
    tilesBox.append(
      h('div', { class: 'map-field' }, h('span', {}, 'Colonnes'), colsIn, h('span', { style: 'width:auto' }, `${n} tuiles`)),
      h('div', { class: 'map-pal-wrap' }, canvas),
      S.palInfo,
      h('div', { class: 'map-hint' }, 'Clic : choisir · glisser : tampon de plusieurs tuiles'));
    updatePalInfo();
    drawPalette();
  }

  const objs = store.project.objects;
  const selObj = store.ui.selectedObjectId;
  const objBox = h('div', { class: 'map-section' }, h('h3', {}, 'Objets'));
  if (!objs.length) {
    objBox.append(h('div', { class: 'map-empty' }, 'Aucun objet. Créez-en dans l\'onglet « Objets & code » pour les placer sur la carte.'));
  } else {
    objBox.append(h('div', { class: 'map-list', style: 'max-height:none' }, objs.map((o) => {
      const of = objectFrame(o);
      return h('div', {
        class: 'list-item map-obj' + (o.id === selObj ? ' selected' : ''),
        onclick: () => { store.ui.selectedObjectId = o.id; setTool('entities'); renderRight(); },
      },
      of ? h('img', { class: 'pixelated checker', src: of.src }) : h('span', { class: 'map-missing', title: 'Pas de sprite' }),
      h('span', { class: 'map-name' }, o.name));
    })),
    h('div', { class: 'map-hint' }, 'Outil Entités (O) : clic = placer · glisser = déplacer · Suppr / clic droit = supprimer · Maj = placement libre'));
  }
  els.right.replaceChildren(els.inst, tilesBox, objBox);
  renderInstance();
}

// ---------------------------------------------------------------- UI : panneau « Instance »
// Valeur saisie → valeur typée : nombre, booléen, JSON ([…] / {…}) ou texte
function parseVal(str) {
  const t = str.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^[[{]/.test(t)) { try { return JSON.parse(t); } catch { /* texte */ } }
  return str;
}
const fmtVal = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v));

function renderInstance() {
  if (!els || !els.inst) return;
  const map = curMap();
  const ent = S.entityId ? findById(map.entities, S.entityId) : null;
  if (!ent || S.tool !== 'entities') { els.inst.replaceChildren(); return; }
  const id = ent.id;
  const edit = (fn) => commit((m) => { const en = findById(m.entities, id); if (en) fn(en); });
  const setProps = (build) => edit((en) => {
    const np = build({ ...(en.props || {}) });
    if (Object.keys(np).length) en.props = np; else delete en.props;
  });

  const objSel = h('select', { onchange: () => edit((en) => { en.objectId = objSel.value; }) },
    ...store.project.objects.map((o) => h('option', { value: o.id }, o.name)));
  if (!findById(store.project.objects, ent.objectId)) objSel.prepend(h('option', { value: ent.objectId }, '(objet supprimé)'));
  objSel.value = ent.objectId;

  const num = (key) => {
    const inp = h('input', { type: 'number', step: 1, value: ent[key] });
    inp.addEventListener('change', () => {
      const v = Math.round(parseFloat(inp.value));
      if (Number.isNaN(v)) { inp.value = ent[key]; return; }
      if (v !== ent[key]) edit((en) => { en[key] = v; });
    });
    return inp;
  };

  const rows = Object.entries(ent.props || {}).map(([k, v]) => {
    const kIn = h('input', { type: 'text', class: 'map-pk', value: k, title: 'Clé' });
    const vIn = h('input', { type: 'text', class: 'map-pv', value: fmtVal(v), title: 'Valeur (nombre, true/false ou texte)' });
    kIn.addEventListener('change', () => {
      const nk = kIn.value.trim();
      if (nk === k) return;
      if (!nk || nk in (ent.props || {})) { setMsg(nk ? 'Cette clé existe déjà.' : 'Clé vide.'); kIn.value = k; return; }
      setProps((p) => Object.fromEntries(Object.entries(p).map(([a, b]) => [a === k ? nk : a, b])));
    });
    vIn.addEventListener('change', () => setProps((p) => { p[k] = parseVal(vIn.value); return p; }));
    return h('div', { class: 'map-prop' }, kIn, vIn,
      h('button', { class: 'map-mini', title: 'Supprimer la propriété', onclick: () => setProps((p) => { delete p[k]; return p; }) }, '✕'));
  });

  const nkIn = h('input', { type: 'text', class: 'map-pk', placeholder: 'clé' });
  const nvIn = h('input', { type: 'text', class: 'map-pv', placeholder: 'valeur' });
  const add = () => {
    const k = nkIn.value.trim();
    if (!k) { nkIn.focus(); return; }
    if (k in (ent.props || {})) { setMsg('Cette clé existe déjà.'); return; }
    setProps((p) => { p[k] = parseVal(nvIn.value); return p; });
  };
  nvIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  nkIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') nvIn.focus(); });

  els.inst.replaceChildren(h('div', { class: 'map-section map-inst' },
    h('h3', {}, 'Instance'),
    h('div', { class: 'map-field' }, h('span', {}, 'Objet'), objSel),
    h('div', { class: 'map-field' }, h('span', {}, 'x'), num('x'), h('span', { style: 'width:auto' }, 'y'), num('y')),
    h('div', { class: 'map-hint' }, 'Propriétés (→ self.props)'),
    ...rows,
    h('div', { class: 'map-prop' }, nkIn, nvIn, h('button', { class: 'map-mini', title: 'Ajouter la propriété', onclick: add }, '＋')),
    h('div', { class: 'map-hint' }, 'Nombre, true / false, ou texte.')));
}

function updatePalInfo() {
  if (!S.palInfo || !S.pal) return;
  const b = S.brush;
  S.palInfo.textContent = b.w === 1 && b.h === 1 ? `Tuile ${b.tiles[0]}` : `Tampon ${b.w}×${b.h}`;
}

function drawPalette() {
  const cv = els?.palCanvas;
  if (!cv || !S.pal) return;
  const { cols, cw, ch, n, tileset } = S.pal;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < n; i++) {
    const img = getImg(tileset.frames[i]);
    if (img) ctx.drawImage(img, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
  }
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) { ctx.moveTo(c * cw + 0.5, 0); ctx.lineTo(c * cw + 0.5, cv.height); }
  for (let r = 0; r <= S.pal.rows; r++) { ctx.moveTo(0, r * ch + 0.5); ctx.lineTo(cv.width, r * ch + 0.5); }
  ctx.stroke();
  const s = S.palSel;
  const c0 = Math.min(s.c0, s.c1), c1 = Math.max(s.c0, s.c1), r0 = Math.min(s.r0, s.r1), r1 = Math.max(s.r0, s.r1);
  ctx.strokeStyle = '#ffcd75';
  ctx.lineWidth = 2;
  ctx.strokeRect(c0 * cw + 1, r0 * ch + 1, (c1 - c0 + 1) * cw - 2, (r1 - r0 + 1) * ch - 2);
}

function wirePalette(canvas) {
  const cellAt = (e) => {
    const r = canvas.getBoundingClientRect();
    const { cols, rows, cw, ch } = S.pal;
    return { c: clamp(Math.floor((e.clientX - r.left) / cw), 0, cols - 1), r: clamp(Math.floor((e.clientY - r.top) / ch), 0, rows - 1) };
  };
  const buildBrush = () => {
    const { cols, n } = S.pal;
    const s = S.palSel;
    const c0 = Math.min(s.c0, s.c1), c1 = Math.max(s.c0, s.c1), r0 = Math.min(s.r0, s.r1), r1 = Math.max(s.r0, s.r1);
    const tiles = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const i = r * cols + c; tiles.push(i < n ? i : -2); }
    if (tiles.every((t) => t === -2)) return;
    S.brush = { w: c1 - c0 + 1, h: r1 - r0 + 1, tiles };
  };
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    dragging = true;
    const { c, r } = cellAt(e);
    S.palSel = { c0: c, r0: r, c1: c, r1: r };
    buildBrush(); updatePalInfo(); drawPalette();
    if (!['brush', 'fill', 'rect'].includes(S.tool)) setTool('brush');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const { c, r } = cellAt(e);
    if (c === S.palSel.c1 && r === S.palSel.r1) return;
    S.palSel.c1 = c; S.palSel.r1 = r;
    buildBrush(); updatePalInfo(); drawPalette();
  });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- rafraîchissement global
function refresh() {
  if (!S) return;
  const map = curMap();
  if (S.mapId !== map.id) {
    S.mapId = map.id;
    S.layerId = null;
    S.entityId = null;
    S.sel = null;
    S.paste = false;
    S.hover = null;
    fitView();
  }
  if (S.entityId && !findById(map.entities, S.entityId)) S.entityId = null;
  activeLayer(map);
  renderLeft();
  renderRight();
  renderToolbar();
  updateStatus();
  requestDraw();
}

// ---------------------------------------------------------------- mount / unmount
export function mount(container, st) {
  unmount();
  store = st;
  S = {
    tool: 'brush', brush: { w: 1, h: 1, tiles: [0] }, palSel: { c0: 0, r0: 0, c1: 0, r1: 0 }, palCols: 0, pal: null, palInfo: null,
    layerId: null, entityId: null, mapId: null, grid: true, dim: true, view: { zoom: 3, ox: 0, oy: 0 },
    hover: null, space: false, gesture: null, msg: '', msgTimer: 0, undo: new Map(), redo: new Map(),
    raf: 0, size: { w: 0, h: 0 }, needFit: true, imgs: new Map(), newForm: false,
    sel: null, clip: null, paste: false, imgGen: 0, chunks: new Map(), chunkKey: '', dataIds: new WeakMap(), nextDataId: 1,
    mini: { canvas: null, sig: null, geom: null }, avg: new Map(),
  };

  const toolBtns = {};
  const bar = h('div', { class: 'map-toolbar' });
  for (const t of TOOLS) {
    toolBtns[t.id] = h('button', { title: `${t.label} (${t.key})`, onclick: () => setTool(t.id) }, t.label, h('kbd', {}, t.key));
    bar.append(toolBtns[t.id]);
  }
  const undoBtn = h('button', { title: 'Annuler (Ctrl+Z)', onclick: undo }, '↶ Annuler');
  const redoBtn = h('button', { title: 'Rétablir (Ctrl+Y)', onclick: redo }, '↷ Rétablir');
  const gridBtn = h('button', { title: 'Afficher / masquer la grille', onclick: () => { S.grid = !S.grid; renderToolbar(); requestDraw(); } }, 'Grille');
  bar.append(h('span', { class: 'map-sep' }), undoBtn, redoBtn, h('span', { class: 'map-sep' }), gridBtn,
    h('button', { title: 'Ajuster la vue à la carte', onclick: fitView }, 'Ajuster'),
    h('button', { title: 'Zoom 100 %', onclick: () => { const { w, h: hh } = S.size; const m = curMap(); S.view = { zoom: 1, ox: (w - m.width * m.tileSize) / 2, oy: (hh - m.height * m.tileSize) / 2 }; updateStatus(); requestDraw(); } }, '1:1'));

  const canvas = h('canvas', { tabindex: 0 });
  const wrap = h('div', { class: 'map-canvas-wrap' }, canvas);
  const statusLeft = h('span'), statusMsg = h('span', { class: 'map-msg' }), statusRight = h('span');
  const status = h('div', { class: 'map-status' }, statusLeft, statusMsg, statusRight);
  const miniCanvas = h('canvas', { title: 'Mini-carte : cliquer ou glisser pour se déplacer' });
  const miniWrap = h('div', { class: 'map-minimap' }, miniCanvas);
  const inst = h('div', { class: 'map-inst-wrap' });
  const left = h('div', { class: 'panel map-left' });
  const right = h('div', { class: 'panel map-right' });
  container.append(h('div', { class: 'map-root' }, left, h('div', { class: 'map-center' }, bar, wrap, miniWrap, status), right));

  els = { canvas, ctx: canvas.getContext('2d'), left, right, toolBtns, undoBtn, redoBtn, gridBtn, statusLeft, statusMsg, statusRight, palCanvas: null, miniCanvas, inst };

  const ro = new ResizeObserver(() => {
    const w = wrap.clientWidth, hh = wrap.clientHeight;
    if (w === S.size.w && hh === S.size.h) return;
    S.size = { w, h: hh };
    canvas.width = w; canvas.height = hh;
    if (S.needFit) fitView();
    requestDraw();
  });
  ro.observe(wrap);
  const roMini = new ResizeObserver(() => {
    const w = miniWrap.clientWidth;
    if (!w || w === miniCanvas.width) return;
    miniCanvas.width = w; miniCanvas.height = MINI_H;
    requestDraw();
  });
  roMini.observe(miniWrap);
  let miniDrag = false;
  miniCanvas.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; miniDrag = true; miniCanvas.setPointerCapture(e.pointerId); miniGo(e); });
  miniCanvas.addEventListener('pointermove', (e) => { if (miniDrag) miniGo(e); });
  miniCanvas.addEventListener('pointerup', () => { miniDrag = false; });
  miniCanvas.addEventListener('pointercancel', () => { miniDrag = false; });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => { if (!S.gesture) { S.hover = null; updateStatus(); requestDraw(); } });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => e.preventDefault());
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const raw = e.dataTransfer?.getData('application/pixelforge-resource');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.kind === 'objects' && data.id) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const [worldX, worldY] = screenToWorld(screenX, screenY);
        const ts = curMap()?.tileSize || 16;
        const tx = e.altKey ? Math.round(worldX) : Math.floor(worldX / ts) * ts;
        const ty = e.altKey ? Math.round(worldY) : Math.floor(worldY / ts) * ts;
        store.update(() => {
          const m = curMap();
          if (m) {
            const newEnt = { id: uid('ent'), objectId: data.id, x: tx, y: ty, angle: 0, scale: 1, locked: false, visible: true, props: {} };
            m.entities = m.entities || [];
            m.entities.push(newEnt);
            store.setSelection({ type: 'entity', id: newEnt.id, mapId: m.id });
          }
        }, 'map');
        refresh();
      }
    } catch (err) {
      console.error('Erreur au drop:', err);
    }
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const onBlur = () => { S.space = false; updateCursor(); };
  window.addEventListener('blur', onBlur);

  const off = store.on('change', (reason) => {
    if (!S || reason === 'map') return;
    if (reason === 'sprite') pruneImgs();
    refresh();
  });
  // Le jeu a été rechargé (disque / IA) : états dépendant de l'ancien projet invalidés
  const offLoad = store.on('load', () => {
    if (!S) return;
    S.gesture = null; S.sel = null; S.paste = false; S.entityId = null;
    S.undo = new Map(); S.redo = new Map(); S.mapId = null; S.layerId = null;
    S.imgs.clear(); S.avg.clear(); S.chunks.clear(); S.mini.sig = null; S.imgGen++;
    refresh();
  });
  cleanups = [
    () => ro.disconnect(),
    () => roMini.disconnect(),
    offLoad,
    () => window.removeEventListener('keydown', onKeyDown),
    () => window.removeEventListener('keyup', onKeyUp),
    () => window.removeEventListener('blur', onBlur),
    off,
    () => { cancelAnimationFrame(S.raf); clearTimeout(S.msgTimer); },
  ];

  updateCursor();
  refresh();
}

export function unmount() {
  for (const fn of cleanups) { try { fn(); } catch (e) { console.error(e); } }
  cleanups = [];
  S = null;
  els = null;
}
