import './style.css';
import { createSprite, uid, findById } from '../../core/project.js';
import { line, rect, ellipse, floodFill, hexToRgba, rgbaToHex } from './tools.js';

const TOOLS = [
  { id: 'pencil', key: 'b', icon: '/', label: 'Crayon' },
  { id: 'eraser', key: 'e', icon: '⌫', label: 'Gomme' },
  { id: 'fill', key: 'g', icon: '▨', label: 'Pot de peinture' },
  { id: 'picker', key: 'i', icon: '⌖', label: 'Pipette (ou Alt+clic)' },
  { id: 'line', key: 'l', icon: '╱', label: 'Ligne (Maj = angles de 45°)' },
  { id: 'rect', key: 'r', icon: '▭', label: 'Rectangle (Maj = carré)' },
  { id: 'ellipse', key: 'o', icon: '◯', label: 'Ellipse (Maj = cercle)' },
  { id: 'select', key: 'm', icon: '⬚', label: 'Sélection / déplacer' },
];
const SIZE_PRESETS = [8, 16, 24, 32, 64];
const MAX_SIZE = 256;
const HIST_MAX = 100;
const MAX_ZOOM = 64;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = (o) => JSON.parse(JSON.stringify(o));

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

function makeCanvas(w, h2) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h2;
  c.getContext('2d', { willReadFrequently: true }).imageSmoothingEnabled = false;
  return c;
}

function copyCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function uniqueName(base, names) {
  if (!names.includes(base)) return base;
  let n = 2;
  while (names.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

const isBlank = (c) => !c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v);

// Chaque appel crée une instance indépendante (un onglet = une instance) et renvoie son handle { dispose, onShow, onHide }.
export function mount(container, store, opts = {}) {
  return build(container, store, opts);
}

function build(root, store, opts = {}) {
  let active = false;         // onglet visible : seul cas où l'instance écoute le clavier
  const disposers = [];
  const listen = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    disposers.push(() => target.removeEventListener(ev, fn, opts));
  };

  // ---------- état ----------
  let spriteId = opts.refId ?? store.ui.selectedSpriteId;
  const sprite = () => findById(store.project.sprites, spriteId);
  let frames = [];            // canvas de travail, un par frame du sprite courant (source de vérité pendant l'édition)
  let fi = 0;                 // frame courante
  let ready = false;
  let loadToken = 0;
  let viewKey = '';           // identifie sprite+taille pour savoir quand recadrer la vue
  let tool = 'pencil';
  let brush = 1;
  let mirror = false;
  let filled = false;
  let showGrid = true;
  let onion = false;
  const pal0 = store.project.palette;
  let primary = pal0[3] || pal0[0] || '#ffffff';
  let secondary = null;       // null = transparent
  let lastSolid = primary || '#ffffff';
  let palIndex = -1;
  let zoom = 8, panX = 0, panY = 0;
  let sel = null;             // { x, y, w, h }
  let clip = null;            // canvas du presse-papiers interne
  let stroke = null;          // geste en cours
  let spaceDown = false;
  let hover = null;
  let animSel = 0;
  let animT0 = performance.now();
  let raf = 0;
  let modal = null;
  let modalPrimary = null;
  const hist = new Map();     // spriteId -> { undo: [], redo: [] }

  const W = () => frames[0]?.width || 0;
  const H = () => frames[0]?.height || 0;

  // ---------- historique ----------
  const snap = (s) => ({ width: s.width, height: s.height, frames: [...s.frames], animations: clone(s.animations || []) });
  const histOf = (id) => {
    if (!hist.has(id)) hist.set(id, { undo: [], redo: [] });
    return hist.get(id);
  };
  function pushUndo(before) {
    const s = sprite();
    if (!s) return;
    const hs = histOf(s.id);
    hs.undo.push(before);
    if (hs.undo.length > HIST_MAX) hs.undo.shift();
    hs.redo.length = 0;
    updateHistButtons();
  }
  async function applySnapshot(snapshot) {
    const s = sprite();
    store.update((p) => {
      const sp = findById(p.sprites, s.id);
      sp.width = snapshot.width;
      sp.height = snapshot.height;
      sp.frames = [...snapshot.frames];
      sp.animations = clone(snapshot.animations);
    }, 'sprite');
    sel = null;
    await loadSprite();
  }
  async function undo() {
    const s = sprite();
    if (!s || !ready || stroke) return;
    const hs = histOf(s.id);
    const prev = hs.undo.pop();
    if (!prev) return;
    hs.redo.push(snap(s));
    await applySnapshot(prev);
  }
  async function redo() {
    const s = sprite();
    if (!s || !ready || stroke) return;
    const hs = histOf(s.id);
    const next = hs.redo.pop();
    if (!next) return;
    hs.undo.push(snap(s));
    await applySnapshot(next);
  }

  // ---------- chargement du sprite ----------
  async function loadSprite() {
    const token = ++loadToken;
    ready = false;
    const s = sprite();
    if (!s) {
      frames = [];
      ready = true;
      refreshAll();
      return;
    }
    const imgs = await Promise.all((s.frames || []).map(loadImage));
    if (token !== loadToken) return;
    frames = imgs.map((img) => {
      const c = makeCanvas(s.width, s.height);
      if (img) c.getContext('2d').drawImage(img, 0, 0);
      return c;
    });
    if (!Array.isArray(s.animations) || !frames.length) {
      if (!frames.length) frames = [makeCanvas(s.width, s.height)];
      store.update((p) => {
        const sp = findById(p.sprites, s.id);
        if (!Array.isArray(sp.animations)) sp.animations = [];
        sp.frames = frames.map((c) => c.toDataURL());
      }, 'sprite');
    }
    fi = clamp(fi, 0, frames.length - 1);
    ready = true;
    setupCanvases();
    const key = `${s.id}:${s.width}x${s.height}`;
    if (key !== viewKey) { viewKey = key; fitView(); }
    refreshAll();
  }

  function selectSprite(id) {
    spriteId = id;
    store.ui.selectedSpriteId = id;
    fi = 0;
    sel = null;
    animSel = 0;
    viewKey = '';
    loadSprite();
  }

  // ---------- squelette DOM ----------
  const spriteListEl = h('div', { class: 'px-sprite-list' });
  const spriteBtns = {};
  const mkBtn = (label, fn, cls = 'px-panel-btn') => h('button', { class: cls, onclick: fn }, label);
  const leftPanel = h('div', { class: 'panel px-left' },
    h('div', { class: 'px-section' },
      h('h3', {}, 'Sprites'),
      spriteListEl,
      h('div', { class: 'px-row' },
        mkBtn('Nouveau', () => newSpriteDialog()),
        (spriteBtns.dup = mkBtn('Dupliquer', duplicateSprite)),
        (spriteBtns.ren = mkBtn('Renommer', renameSprite)),
        (spriteBtns.del = mkBtn('Supprimer', deleteSprite)),
      ),
    ),
    h('div', { class: 'px-section' },
      h('h3', {}, 'Tileset'),
      h('p', { class: 'px-hint', style: 'margin:0 0 6px' },
        `Un sprite peut servir de tileset : chaque frame = une tuile (taille de tuile du projet : ${store.project.settings.tileSize} px).`),
      mkBtn('Nouveau tileset', newTileset),
    ),
  );

  // barre d'outils
  const toolBtns = {};
  const toolbar = h('div', { class: 'px-toolbar' });
  for (const t of TOOLS) {
    toolBtns[t.id] = h('button', { class: 'px-tool', title: `${t.label} [${t.key.toUpperCase()}]`, onclick: () => setTool(t.id) }, t.icon);
    toolbar.append(toolBtns[t.id]);
  }
  const brushBtns = [1, 2, 3, 4].map((n) => h('button', { title: `Pinceau ${n}px [${n}]`, onclick: () => setBrush(n) }, String(n)));
  const mirrorBtn = h('button', { title: 'Symétrie horizontale pendant le dessin [X = échanger les couleurs]', onclick: () => { mirror = !mirror; syncToolbar(); drawOverlay(); } }, '⇋ Miroir');
  const fillBtn = h('button', { title: 'Rectangle / ellipse pleins', onclick: () => { filled = !filled; syncToolbar(); } }, 'Plein');
  const undoBtn = h('button', { title: 'Annuler [Ctrl+Z]', onclick: undo }, '↶');
  const redoBtn = h('button', { title: 'Rétablir [Ctrl+Y]', onclick: redo }, '↷');
  const zoomLabel = h('span', { class: 'px-label', style: 'min-width:34px;text-align:center' }, '');
  const gridBtn = h('button', { title: 'Grille de pixels', onclick: () => { showGrid = !showGrid; syncToolbar(); drawOverlay(); } }, '▦ Grille');
  const coordsEl = h('span', { class: 'px-coords' }, '');
  toolbar.append(
    h('span', { class: 'px-sep' }), h('span', { class: 'px-label' }, 'Pinceau'), ...brushBtns,
    h('span', { class: 'px-sep' }), mirrorBtn, fillBtn,
    h('span', { class: 'px-sep' }), undoBtn, redoBtn,
    h('span', { class: 'px-sep' }),
    h('button', { title: 'Dézoomer [-]', onclick: () => zoomBy(-1) }, '−'), zoomLabel,
    h('button', { title: 'Zoomer [+]', onclick: () => zoomBy(1) }, '+'),
    h('button', { title: 'Ajuster à la fenêtre', onclick: () => { fitView(); layout(); } }, 'Ajuster'),
    gridBtn, coordsEl,
  );

  // zone de dessin
  const onionC = h('canvas', { class: 'px-onion' });
  const mainC = h('canvas');
  const prevC = h('canvas', { class: 'px-preview' });
  const stage = h('div', { class: 'px-stage checker' }, onionC, mainC, prevC);
  const overlay = h('canvas', { class: 'px-overlay' });
  const emptyMsg = h('div', { class: 'px-empty' }, 'Aucun sprite. Créez-en un avec « Nouveau » dans la colonne de gauche.');
  const vp = h('div', { class: 'px-viewport' }, stage, overlay, emptyMsg);
  const mainCtx = mainC.getContext('2d');
  const onionCtx = onionC.getContext('2d');
  const prevCtx = prevC.getContext('2d');
  const ovCtx = overlay.getContext('2d');

  // bandeau de frames
  const framesEl = h('div', { class: 'px-frames' });
  const onionChk = h('input', { type: 'checkbox', onchange: () => { onion = onionChk.checked; renderMain(); } });
  const frameBtns = {
    add: h('button', { title: 'Ajouter une frame vide', onclick: addFrame }, '＋ Frame'),
    dup: h('button', { title: 'Dupliquer la frame', onclick: dupFrame }, 'Dupliquer'),
    del: h('button', { title: 'Supprimer la frame', onclick: delFrame }, 'Supprimer'),
    left: h('button', { title: 'Déplacer vers la gauche', onclick: () => moveFrame(fi, fi - 1) }, '<'),
    right: h('button', { title: 'Déplacer vers la droite', onclick: () => moveFrame(fi, fi + 1) }, '>'),
  };
  const frameBar = h('div', { class: 'px-framebar' },
    h('div', { class: 'px-frame-actions' },
      frameBtns.add, frameBtns.dup, frameBtns.del, frameBtns.left, frameBtns.right,
      h('label', { title: 'Affiche la frame précédente en transparence' }, onionChk, 'Pelure d\'oignon')),
    framesEl);
  const center = h('div', { class: 'px-center' }, toolbar, vp, frameBar);

  // colonne droite
  const colorBox = h('div', { class: 'px-cbox' });
  const priBox = h('i', { class: 'pri', title: 'Couleur primaire (clic gauche)' });
  const secBox = h('i', { class: 'sec', title: 'Couleur secondaire (clic droit)' });
  colorBox.append(secBox, priBox);
  const picker = h('input', { type: 'color', class: 'px-picker', title: 'Choisir une couleur', value: '#ffffff', oninput: () => setColor('primary', picker.value, true) });
  const swapBtn = h('button', { class: 'px-panel-btn', title: 'Échanger primaire / secondaire [X]', onclick: swapColors }, '⇄');
  const paletteEl = h('div', { class: 'px-palette' });
  const paletteSection = h('div', { class: 'px-section' },
    h('h3', {}, 'Palette'),
    h('div', { class: 'px-colors', style: 'margin-bottom:8px' }, colorBox, picker, swapBtn),
    paletteEl,
    h('div', { class: 'px-row' },
      h('button', { class: 'px-panel-btn', title: 'Ajouter la couleur du sélecteur à la palette', onclick: addPaletteColor }, '＋ Ajouter'),
      h('button', { class: 'px-panel-btn', title: 'Remplacer la couleur de palette sélectionnée par celle du sélecteur', onclick: replacePaletteColor }, 'Remplacer'),
      h('button', { class: 'px-panel-btn', title: 'Retirer la couleur de palette sélectionnée', onclick: removePaletteColor }, 'Retirer'),
    ),
    h('p', { class: 'px-hint', style: 'margin:6px 0 0' }, 'Clic droit sur une couleur = secondaire. La première case est la transparence.'),
  );

  const transformSection = h('div', { class: 'px-section' },
    h('h3', {}, 'Transformations'),
    h('div', { class: 'px-row' },
      mkBtn('Miroir H', () => transformFrame((ctx) => { ctx.translate(W(), 0); ctx.scale(-1, 1); })),
      mkBtn('Miroir V', () => transformFrame((ctx) => { ctx.translate(0, H()); ctx.scale(1, -1); })),
      mkBtn('Effacer', clearFrame),
    ),
    h('div', { class: 'px-row' },
      h('span', { class: 'px-label' }, 'Décaler'),
      mkBtn('←', () => shiftFrame(-1, 0)), mkBtn('→', () => shiftFrame(1, 0)),
      mkBtn('↑', () => shiftFrame(0, -1)), mkBtn('↓', () => shiftFrame(0, 1)),
    ),
    h('div', { class: 'px-row' }, mkBtn('Redimensionner le sprite…', resizeDialog)),
  );

  const colsIn = h('input', { type: 'number', class: 'px-num', min: 1, value: 0, title: '0 = toutes les frames sur une ligne' });
  const fileIn = h('input', { type: 'file', accept: 'image/png,image/*', style: 'display:none', onchange: () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (f) importFile(f);
  } });
  const ioSection = h('div', { class: 'px-section' },
    h('h3', {}, 'Import / export PNG'),
    h('div', { class: 'px-row' }, mkBtn('Importer…', () => fileIn.click()), fileIn),
    h('div', { class: 'px-row' }, mkBtn('Exporter la frame', exportFrame), mkBtn('Spritesheet', exportSheet),
      h('span', { class: 'px-label' }, 'col.'), colsIn),
  );

  const animsEl = h('div', { class: 'px-section' });
  const animPrev = h('canvas', { class: 'px-anim-prev checker', title: 'Cliquer pour relancer' });
  animPrev.addEventListener('click', () => { animT0 = performance.now(); });
  const animPrevCtx = animPrev.getContext('2d');

  const rightPanel = h('div', { class: 'panel px-right' }, paletteSection, transformSection, animsEl, ioSection);
  root.replaceChildren(leftPanel, center, rightPanel);
  disposers.push(() => root.replaceChildren());

  // ---------- rendu ----------
  function setupCanvases() {
    const w = W(), hh = H();
    for (const c of [onionC, mainC, prevC]) { c.width = w; c.height = hh; }
  }

  function refreshAll() {
    renderSprites();
    renderFrames();
    renderMain();
    renderAnims();
    syncToolbar();
    updateHistButtons();
  }

  function renderMain() {
    const has = ready && frames.length > 0;
    stage.style.display = has ? '' : 'none';
    emptyMsg.style.display = sprite() ? 'none' : '';
    if (has) {
      mainCtx.clearRect(0, 0, W(), H());
      mainCtx.drawImage(frames[fi], 0, 0);
      onionCtx.clearRect(0, 0, W(), H());
      if (onion && fi > 0) onionCtx.drawImage(frames[fi - 1], 0, 0);
    }
    layout();
  }

  function layout() {
    zoomLabel.textContent = `${zoom * 100}%`;
    if (ready && frames.length) {
      const w = W() * zoom, hh = H() * zoom, s = Math.max(8, zoom);
      stage.style.cssText = `left:${panX}px;top:${panY}px;width:${w}px;height:${hh}px;` +
        `background-size:${2 * s}px ${2 * s}px;background-position:0 0,0 ${s}px,${s}px -${s}px,-${s}px 0`;
      for (const c of [onionC, mainC, prevC]) { c.style.width = `${w}px`; c.style.height = `${hh}px`; }
    }
    drawOverlay();
  }

  function drawOverlay() {
    const vw = vp.clientWidth, vh = vp.clientHeight;
    if (overlay.width !== vw || overlay.height !== vh) { overlay.width = vw; overlay.height = vh; }
    const g = ovCtx;
    g.clearRect(0, 0, vw, vh);
    if (!ready || !frames.length) return;
    const w = W(), hh = H();
    const x0 = panX, y0 = panY, x1 = panX + w * zoom, y1 = panY + hh * zoom;
    if (showGrid && zoom >= 4) {
      g.beginPath();
      for (let i = 1; i < w; i++) {
        const x = Math.round(x0 + i * zoom) + 0.5;
        if (x >= 0 && x <= vw) { g.moveTo(x, Math.max(0, y0)); g.lineTo(x, Math.min(vh, y1)); }
      }
      for (let i = 1; i < hh; i++) {
        const y = Math.round(y0 + i * zoom) + 0.5;
        if (y >= 0 && y <= vh) { g.moveTo(Math.max(0, x0), y); g.lineTo(Math.min(vw, x1), y); }
      }
      g.strokeStyle = 'rgba(255,255,255,.14)';
      g.lineWidth = 1;
      g.stroke();
    }
    if (mirror) {
      const x = Math.round((x0 + x1) / 2) + 0.5;
      g.beginPath();
      g.setLineDash([4, 4]);
      g.moveTo(x, y0); g.lineTo(x, y1);
      g.strokeStyle = '#41a6f6';
      g.stroke();
      g.setLineDash([]);
    }
    if (hover && !stroke && tool !== 'select' && tool !== 'picker' && tool !== 'fill') {
      const o = Math.floor((brush - 1) / 2);
      g.strokeStyle = 'rgba(255,255,255,.8)';
      g.strokeRect(x0 + (hover.x - o) * zoom + 0.5, y0 + (hover.y - o) * zoom + 0.5, brush * zoom - 1, brush * zoom - 1);
    }
    if (sel) {
      const rx = x0 + sel.x * zoom + 0.5, ry = y0 + sel.y * zoom + 0.5, rw = sel.w * zoom - 1, rh = sel.h * zoom - 1;
      g.setLineDash([5, 5]);
      g.strokeStyle = '#000';
      g.strokeRect(rx, ry, rw, rh);
      g.lineDashOffset = 5;
      g.strokeStyle = '#fff';
      g.strokeRect(rx, ry, rw, rh);
      g.lineDashOffset = 0;
      g.setLineDash([]);
    }
  }

  function syncToolbar() {
    const has = !!sprite() && ready;
    for (const t of TOOLS) { toolBtns[t.id].classList.toggle('active', tool === t.id); toolBtns[t.id].disabled = !has; }
    brushBtns.forEach((b, i) => b.classList.toggle('active', brush === i + 1));
    mirrorBtn.classList.toggle('active', mirror);
    fillBtn.classList.toggle('active', filled);
    fillBtn.disabled = !(tool === 'rect' || tool === 'ellipse');
    gridBtn.classList.toggle('active', showGrid);
    for (const b of Object.values(frameBtns)) b.disabled = !has;
    if (has) {
      frameBtns.del.disabled = false;
      frameBtns.left.disabled = fi === 0;
      frameBtns.right.disabled = fi >= frames.length - 1;
    }
    onionChk.disabled = !has;
    renderColors();
  }

  function updateHistButtons() {
    const s = sprite();
    const hs = s ? histOf(s.id) : { undo: [], redo: [] };
    undoBtn.disabled = !hs.undo.length;
    redoBtn.disabled = !hs.redo.length;
  }

  function renderSprites() {
    const list = store.project.sprites;
    const cur = sprite();
    spriteListEl.replaceChildren(...(list.length ? list.map((sp) => h('div', {
      class: 'list-item' + (cur && sp.id === cur.id ? ' selected' : ''),
      onclick: () => { if (!cur || sp.id !== cur.id) selectSprite(sp.id); },
    },
    h('img', { class: 'pixelated px-thumb', src: sp.frames?.[0], alt: '' }),
    h('div', { class: 'px-sprite-name' }, h('div', {}, sp.name), h('small', {}, `${sp.width}×${sp.height} · ${sp.frames?.length || 0} fr.`)),
    )) : [h('div', { class: 'px-hint' }, 'Aucun sprite')]));
    for (const b of Object.values(spriteBtns)) b.disabled = !cur;
  }

  function renderFrames() {
    framesEl.replaceChildren();
    if (!ready) return;
    const w = W(), hh = H();
    const scale = 48 / Math.max(w, hh, 1);
    frames.forEach((fc, i) => {
      const t = copyCanvas(fc);
      t.className = 'checker';
      t.style.width = `${w * scale}px`;
      t.style.height = `${hh * scale}px`;
      const item = h('div', { class: 'px-frame' + (i === fi ? ' active' : ''), draggable: 'true', title: 'Glisser pour réordonner' }, t, h('span', {}, String(i)));
      item.addEventListener('click', () => { if (i !== fi && !stroke) { fi = i; refreshAll(); } });
      item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; });
      item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('over'); });
      item.addEventListener('dragleave', () => item.classList.remove('over'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (Number.isInteger(from)) moveFrame(from, i);
      });
      framesEl.append(item);
    });
  }

  // ---------- palette / couleurs ----------
  function renderColors() {
    const paint = (el, c) => {
      el.style.background = c || '';
      el.classList.toggle('none', !c);
    };
    paint(priBox, primary);
    paint(secBox, secondary);
    picker.value = primary || secondary || lastSolid;
    paletteEl.replaceChildren();
    const mk = (color, idx) => {
      const sw = h('button', {
        class: 'px-swatch' + (color == null ? ' none' : '') + (color === primary ? ' pri' : '') + (color === secondary ? ' sec' : '') + (idx === palIndex ? ' edit' : ''),
        title: color || 'Transparent',
        style: color ? `background:${color}` : '',
      });
      sw.addEventListener('click', () => { palIndex = idx; setColor('primary', color); });
      sw.addEventListener('contextmenu', (e) => { e.preventDefault(); palIndex = idx; setColor('secondary', color); });
      return sw;
    };
    paletteEl.append(mk(null, -1));
    store.project.palette.forEach((c, i) => paletteEl.append(mk(c, i)));
  }

  function setColor(which, color, fromPicker = false) {
    if (which === 'primary') primary = color; else secondary = color;
    if (color) lastSolid = color;
    if (fromPicker) {
      palIndex = store.project.palette.indexOf(color);
      // met à jour l'affichage sans reconstruire le sélecteur de couleur en cours de manipulation
      priBox.style.background = color;
      priBox.classList.remove('none');
      paletteEl.querySelectorAll('.px-swatch').forEach((el) => el.classList.remove('pri'));
      return;
    }
    renderColors();
  }

  function swapColors() {
    [primary, secondary] = [secondary, primary];
    renderColors();
  }

  function addPaletteColor() {
    const c = picker.value.toLowerCase();
    let idx = store.project.palette.indexOf(c);
    if (idx < 0) {
      store.update((p) => { p.palette.push(c); }, 'palette');
      idx = store.project.palette.length - 1;
    }
    palIndex = idx;
    primary = c;
    renderColors();
  }

  function replacePaletteColor() {
    const pal = store.project.palette;
    if (palIndex < 0 || palIndex >= pal.length) { alert('Sélectionnez d\'abord une couleur de la palette (clic sur une case).'); return; }
    const old = pal[palIndex], c = picker.value.toLowerCase();
    store.update((p) => { p.palette[palIndex] = c; }, 'palette');
    if (primary === old) primary = c;
    if (secondary === old) secondary = c;
    renderColors();
  }

  function removePaletteColor() {
    const pal = store.project.palette;
    if (palIndex < 0 || palIndex >= pal.length) return;
    if (pal.length <= 1) { alert('La palette doit garder au moins une couleur.'); return; }
    store.update((p) => { p.palette.splice(palIndex, 1); }, 'palette');
    palIndex = -1;
    renderColors();
  }

  // ---------- vue : zoom, déplacement ----------
  function fitView() {
    if (!frames.length) return;
    const vw = vp.clientWidth || 600, vh = vp.clientHeight || 400;
    zoom = clamp(Math.floor(Math.min((vw - 40) / W(), (vh - 40) / H())), 1, MAX_ZOOM);
    panX = Math.round((vw - W() * zoom) / 2);
    panY = Math.round((vh - H() * zoom) / 2);
  }

  const stepZoom = (z, dir) => (dir > 0 ? (z < 8 ? z + 1 : z < 16 ? z + 2 : z + 4) : (z <= 8 ? z - 1 : z <= 16 ? z - 2 : z - 4));

  function zoomBy(dir, cx = vp.clientWidth / 2, cy = vp.clientHeight / 2) {
    if (!ready || !frames.length) return;
    const nz = clamp(stepZoom(zoom, dir), 1, MAX_ZOOM);
    if (nz === zoom) return;
    const wx = (cx - panX) / zoom, wy = (cy - panY) / zoom;
    zoom = nz;
    panX = Math.round(cx - wx * zoom);
    panY = Math.round(cy - wy * zoom);
    layout();
  }

  listen(vp, 'wheel', (e) => {
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const ro = new ResizeObserver(() => drawOverlay());
  ro.observe(vp);
  disposers.push(() => ro.disconnect());

  // ---------- dessin ----------
  const toPix = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) };
  };
  const inBounds = (p) => p.x >= 0 && p.y >= 0 && p.x < W() && p.y < H();

  // pose un carré de brush×brush (et son symétrique si miroir)
  function stamp(ctx, x, y, erase, size = brush) {
    const o = Math.floor((size - 1) / 2), x0 = x - o, y0 = y - o;
    const put = (rx) => (erase ? ctx.clearRect(rx, y0, size, size) : ctx.fillRect(rx, y0, size, size));
    put(x0);
    if (mirror) put(W() - x0 - size);
  }

  function drawShape(ctx, kind, a, b, shift, color) {
    let { x: x0, y: y0 } = a, { x: x1, y: y1 } = b;
    if (shift) {
      const dx = x1 - x0, dy = y1 - y0;
      if (kind === 'line') {
        if (Math.abs(dx) > 2 * Math.abs(dy)) y1 = y0;
        else if (Math.abs(dy) > 2 * Math.abs(dx)) x1 = x0;
        else { const d = Math.max(Math.abs(dx), Math.abs(dy)); x1 = x0 + (dx < 0 ? -d : d); y1 = y0 + (dy < 0 ? -d : d); }
      } else {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        x1 = x0 + (dx < 0 ? -d : d);
        y1 = y0 + (dy < 0 ? -d : d);
      }
    }
    ctx.fillStyle = color;
    const full = filled && kind !== 'line';
    const plot = (x, y) => stamp(ctx, x, y, false, full ? 1 : brush);
    if (kind === 'line') line(x0, y0, x1, y1, plot);
    else if (kind === 'rect') rect(x0, y0, x1, y1, full, plot);
    else ellipse(x0, y0, x1, y1, full, plot);
  }

  function commit(before) {
    const s = sprite();
    if (!s || !ready) return;
    const url = frames[fi].toDataURL('image/png');
    if (url === before.frames[fi]) { renderMain(); return; }
    store.update((p) => {
      const sp = findById(p.sprites, s.id);
      sp.frames[fi] = url;
    }, 'sprite');
    pushUndo(before);
    renderMain();
    renderFrames();
    renderSprites();
  }

  function pickAt(p, secondaryBtn) {
    if (!inBounds(p)) return;
    const d = frames[fi].getContext('2d').getImageData(p.x, p.y, 1, 1).data;
    const color = d[3] === 0 ? null : rgbaToHex(d);
    palIndex = color ? store.project.palette.indexOf(color) : -1;
    setColor(secondaryBtn ? 'secondary' : 'primary', color);
  }

  function liftSelection() {
    const f = makeCanvas(sel.w, sel.h);
    f.getContext('2d').drawImage(frames[fi], sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    frames[fi].getContext('2d').clearRect(sel.x, sel.y, sel.w, sel.h);
    return f;
  }

  function clearPreview() { prevCtx.clearRect(0, 0, W(), H()); }

  vp.addEventListener('contextmenu', (e) => e.preventDefault());

  vp.addEventListener('pointerdown', (e) => {
    if (!ready || !sprite() || !frames.length || modal || stroke) return;
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      stroke = { type: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY };
      vp.classList.add('panning');
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    vp.setPointerCapture(e.pointerId);
    const p = toPix(e);
    const right = e.button === 2;
    const t = e.altKey ? 'picker' : tool;
    const color = right ? secondary : primary;
    const erase = t === 'eraser' || color == null;
    const s = sprite();
    const before = snap(s);
    const ctx = frames[fi].getContext('2d');

    if (t === 'picker') {
      stroke = { type: 'pick', right };
      pickAt(p, right);
    } else if (t === 'fill') {
      if (inBounds(p)) {
        const rgba = erase ? [0, 0, 0, 0] : hexToRgba(color);
        const img = ctx.getImageData(0, 0, W(), H());
        let changed = floodFill(img, p.x, p.y, rgba);
        if (mirror) changed = floodFill(img, W() - 1 - p.x, p.y, rgba) || changed;
        if (changed) { ctx.putImageData(img, 0, 0); commit(before); }
      }
    } else if (t === 'pencil' || t === 'eraser') {
      ctx.fillStyle = color || '#000';
      stamp(ctx, p.x, p.y, erase);
      stroke = { type: 'draw', before, erase, last: p };
      renderMain();
    } else if (t === 'line' || t === 'rect' || t === 'ellipse') {
      stroke = { type: 'shape', kind: t, before, erase, color: erase ? '#ffffff' : color, start: p, end: p };
      prevC.classList.toggle('erasing', erase);
      clearPreview();
      drawShape(prevCtx, t, p, p, false, stroke.color);
    } else if (t === 'select') {
      if (sel && p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h) {
        stroke = { type: 'move', before, start: p, orig: { ...sel }, float: liftSelection(), moved: false };
        prevC.classList.remove('erasing');
        clearPreview();
        prevCtx.drawImage(stroke.float, sel.x, sel.y);
        renderMain();
      } else {
        const c = { x: clamp(p.x, 0, W() - 1), y: clamp(p.y, 0, H() - 1) };
        stroke = { type: 'select', start: c, dragged: false };
        sel = null;
        drawOverlay();
      }
    }
  });

  vp.addEventListener('pointermove', (e) => {
    if (!ready || !frames.length) return;
    if (stroke?.type === 'pan') {
      panX = stroke.px + e.clientX - stroke.sx;
      panY = stroke.py + e.clientY - stroke.sy;
      layout();
      return;
    }
    const p = toPix(e);
    hover = p;
    coordsEl.textContent = inBounds(p) ? `${p.x}, ${p.y}  ·  ${W()}×${H()}` : `${W()}×${H()}`;
    if (!stroke) { drawOverlay(); return; }
    switch (stroke.type) {
      case 'pick': pickAt(p, stroke.right); break;
      case 'draw': {
        const ctx = frames[fi].getContext('2d');
        line(stroke.last.x, stroke.last.y, p.x, p.y, (x, y) => stamp(ctx, x, y, stroke.erase));
        stroke.last = p;
        mainCtx.clearRect(0, 0, W(), H());
        mainCtx.drawImage(frames[fi], 0, 0);
        break;
      }
      case 'shape':
        stroke.end = p;
        stroke.shift = e.shiftKey;
        clearPreview();
        drawShape(prevCtx, stroke.kind, stroke.start, p, e.shiftKey, stroke.color);
        break;
      case 'select': {
        const c = { x: clamp(p.x, 0, W() - 1), y: clamp(p.y, 0, H() - 1) };
        stroke.dragged = stroke.dragged || c.x !== stroke.start.x || c.y !== stroke.start.y;
        sel = {
          x: Math.min(c.x, stroke.start.x), y: Math.min(c.y, stroke.start.y),
          w: Math.abs(c.x - stroke.start.x) + 1, h: Math.abs(c.y - stroke.start.y) + 1,
        };
        break;
      }
      case 'move': {
        const dx = p.x - stroke.start.x, dy = p.y - stroke.start.y;
        stroke.moved = stroke.moved || dx !== 0 || dy !== 0;
        sel = { ...stroke.orig, x: stroke.orig.x + dx, y: stroke.orig.y + dy };
        clearPreview();
        prevCtx.drawImage(stroke.float, sel.x, sel.y);
        break;
      }
    }
    drawOverlay();
  });

  function endStroke(e) {
    const st = stroke;
    if (!st) return;
    stroke = null;
    vp.classList.remove('panning');
    try { vp.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    if (!ready || !frames.length) return;
    const ctx = frames[fi].getContext('2d');
    if (st.type === 'draw') {
      commit(st.before);
    } else if (st.type === 'shape') {
      ctx.save();
      if (st.erase) ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(prevC, 0, 0);
      ctx.restore();
      clearPreview();
      commit(st.before);
    } else if (st.type === 'move') {
      ctx.drawImage(st.float, sel.x, sel.y);
      clearPreview();
      commit(st.before);
    } else if (st.type === 'select') {
      if (!st.dragged) sel = null;
    }
    drawOverlay();
  }
  vp.addEventListener('pointerup', endStroke);
  vp.addEventListener('pointercancel', endStroke);
  vp.addEventListener('pointerleave', () => { if (!stroke) { hover = null; coordsEl.textContent = ''; drawOverlay(); } });

  // ---------- opérations sur la frame courante ----------
  function transformFrame(fn) {
    const s = sprite();
    if (!s || !ready) return;
    const before = snap(s);
    const c = frames[fi], tmp = copyCanvas(c), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    fn(ctx);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    commit(before);
  }

  function shiftFrame(dx, dy) {
    const s = sprite();
    if (!s || !ready) return;
    const before = snap(s);
    const c = frames[fi], tmp = copyCanvas(c), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    for (const ox of [-c.width, 0, c.width]) for (const oy of [-c.height, 0, c.height]) ctx.drawImage(tmp, dx + ox, dy + oy);
    commit(before);
  }

  function clearFrame() {
    const s = sprite();
    if (!s || !ready) return;
    const before = snap(s);
    frames[fi].getContext('2d').clearRect(0, 0, W(), H());
    commit(before);
  }

  function clearSelection() {
    if (!sel || !ready) return;
    const before = snap(sprite());
    frames[fi].getContext('2d').clearRect(sel.x, sel.y, sel.w, sel.h);
    commit(before);
  }

  function copySelection(cut) {
    if (!sel || !ready) return;
    clip = makeCanvas(sel.w, sel.h);
    clip.getContext('2d').drawImage(frames[fi], sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    if (cut) clearSelection();
  }

  function pasteClip() {
    if (!clip || !ready || !sprite()) return;
    const before = snap(sprite());
    const x = sel ? sel.x : 0, y = sel ? sel.y : 0;
    frames[fi].getContext('2d').drawImage(clip, x, y);
    sel = { x, y, w: clip.width, h: clip.height };
    commit(before);
    setTool('select');
  }

  // ---------- opérations structurelles (frames, taille) ----------
  // fn modifie `frames` / `fi` ; animFix(sprite) ajuste les animations ; tout est écrit dans le projet + historique
  function structural(fn, animFix) {
    const s = sprite();
    if (!s || !ready || stroke) return;
    const before = snap(s);
    fn();
    sel = null;
    store.update((p) => {
      const sp = findById(p.sprites, s.id);
      sp.width = W();
      sp.height = H();
      sp.frames = frames.map((c) => c.toDataURL('image/png'));
      if (!Array.isArray(sp.animations)) sp.animations = [];
      animFix?.(sp);
    }, 'sprite');
    pushUndo(before);
    setupCanvases();
    refreshAll();
  }

  const remapAnims = (sp, fn) => {
    for (const a of sp.animations) a.frames = a.frames.map(fn).filter((i) => i >= 0);
  };

  function addFrame() {
    const at = fi;
    structural(() => { frames.splice(at + 1, 0, makeCanvas(W(), H())); fi = at + 1; },
      (sp) => remapAnims(sp, (i) => (i > at ? i + 1 : i)));
  }

  function dupFrame() {
    const at = fi;
    structural(() => { frames.splice(at + 1, 0, copyCanvas(frames[at])); fi = at + 1; },
      (sp) => remapAnims(sp, (i) => (i > at ? i + 1 : i)));
  }

  function delFrame() {
    if (!ready || !frames.length) return;
    if (frames.length <= 1) { clearFrame(); return; }
    const at = fi;
    structural(() => { frames.splice(at, 1); fi = Math.min(at, frames.length - 1); },
      (sp) => remapAnims(sp, (i) => (i === at ? -1 : i > at ? i - 1 : i)));
  }

  function moveFrame(from, to) {
    if (!ready || from === to || from < 0 || to < 0 || from >= frames.length || to >= frames.length) return;
    structural(() => { const [c] = frames.splice(from, 1); frames.splice(to, 0, c); fi = to; },
      (sp) => remapAnims(sp, (i) => {
        if (i === from) return to;
        if (from < to && i > from && i <= to) return i - 1;
        if (from > to && i >= to && i < from) return i + 1;
        return i;
      }));
  }

  function resizeSprite(nw, nh) {
    structural(() => {
      frames = frames.map((c) => {
        const n = makeCanvas(nw, nh);
        n.getContext('2d').drawImage(c, 0, 0);
        return n;
      });
    });
    viewKey = '';
    fitView();
    layout();
  }

  // ---------- dialogues ----------
  function closeDialog() {
    modal?.remove();
    modal = null;
    modalPrimary = null;
  }

  function openDialog(title, body, buttons) {
    closeDialog();
    const btnEls = buttons.map((b) => {
      const el = h('button', { class: b.primary ? 'primary' : '' }, b.label);
      el.addEventListener('click', () => { if (b.run?.() !== false) closeDialog(); });
      if (b.primary) modalPrimary = el;
      return el;
    });
    const box = h('div', { class: 'px-modal' }, h('h4', {}, title), body, h('div', { class: 'px-modal-actions' }, btnEls));
    modal = h('div', { class: 'px-modal-back' }, box);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeDialog(); });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDialog();
      else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') { e.preventDefault(); modalPrimary?.click(); }
    });
    root.append(modal);
    const first = box.querySelector('input[type=text], input[type=number]');
    first?.focus();
    first?.select?.();
  }

  function sizeFields(w0, h0) {
    const wIn = h('input', { type: 'number', min: 1, max: MAX_SIZE, value: w0, class: 'px-num' });
    const hIn = h('input', { type: 'number', min: 1, max: MAX_SIZE, value: h0, class: 'px-num' });
    const presets = SIZE_PRESETS.map((n) => h('button', { type: 'button', class: 'px-panel-btn', onclick: () => { wIn.value = n; hIn.value = n; } }, String(n)));
    const read = () => [clamp(parseInt(wIn.value, 10) || w0, 1, MAX_SIZE), clamp(parseInt(hIn.value, 10) || h0, 1, MAX_SIZE)];
    const el = h('div', {},
      h('div', { class: 'px-row' }, h('span', { class: 'px-label' }, 'Taille'), ...presets),
      h('div', { class: 'px-row' }, h('span', { class: 'px-label' }, 'Libre'), wIn, '×', hIn, h('span', { class: 'px-label' }, `px (max ${MAX_SIZE})`)));
    return { el, read };
  }

  function addSprite(sp) {
    store.update((p) => {
      const i = p.sprites.findIndex((x) => x.id === spriteId);
      p.sprites.splice(i < 0 ? p.sprites.length : i + 1, 0, sp);
    }, 'sprite');
    selectSprite(sp.id);
  }

  function newSpriteDialog() {
    const names = store.project.sprites.map((s) => s.name);
    const nameIn = h('input', { type: 'text', class: 'px-grow', value: uniqueName('Sprite', names) });
    const size = sizeFields(16, 16);
    openDialog('Nouveau sprite', h('div', {}, h('div', { class: 'px-row' }, h('span', { class: 'px-label' }, 'Nom'), nameIn), size.el), [
      { label: 'Annuler' },
      { label: 'Créer', primary: true, run: () => {
        const [w, hh] = size.read();
        addSprite(createSprite(nameIn.value.trim() || 'Sprite', w, hh));
      } },
    ]);
  }

  function newTileset() {
    const ts = clamp(parseInt(store.project.settings.tileSize, 10) || 16, 1, MAX_SIZE);
    const sp = createSprite(uniqueName('Tileset', store.project.sprites.map((s) => s.name)), ts, ts);
    sp.frames = Array.from({ length: 8 }, () => sp.frames[0]);
    sp.animations = [];
    addSprite(sp);
  }

  function duplicateSprite() {
    const s = sprite();
    if (!s) return;
    const copy = clone(s);
    copy.id = uid('spr');
    copy.name = uniqueName(`${s.name} copie`, store.project.sprites.map((x) => x.name));
    addSprite(copy);
  }

  function renameSprite() {
    const s = sprite();
    if (!s) return;
    const nameIn = h('input', { type: 'text', class: 'px-grow', value: s.name });
    openDialog('Renommer le sprite', h('div', { class: 'px-row' }, nameIn), [
      { label: 'Annuler' },
      { label: 'Renommer', primary: true, run: () => {
        const name = nameIn.value.trim();
        if (!name) return false;
        store.update((p) => { findById(p.sprites, s.id).name = name; }, 'sprite');
        renderSprites();
      } },
    ]);
  }

  function deleteSprite() {
    const s = sprite();
    if (!s) return;
    const p = store.project;
    const used = p.objects.filter((o) => o.spriteId === s.id).length + p.maps.filter((m) => m.tilesetSpriteId === s.id).length;
    const warn = used ? `\n\nAttention : ${used} objet(s)/carte(s) utilisent ce sprite.` : '';
    if (!confirm(`Supprimer le sprite « ${s.name} » ?${warn}`)) return;
    const i = p.sprites.indexOf(s);
    store.update((pr) => { pr.sprites = pr.sprites.filter((x) => x.id !== s.id); }, 'sprite');
    hist.delete(s.id);
    const next = store.project.sprites[Math.min(i, store.project.sprites.length - 1)];
    selectSprite(next ? next.id : null);
  }

  function resizeDialog() {
    const s = sprite();
    if (!s || !ready) return;
    const size = sizeFields(W(), H());
    openDialog('Redimensionner le sprite', h('div', {}, size.el,
      h('p', { class: 'px-hint' }, 'S\'applique à toutes les frames, ancrage en haut à gauche : l\'excédent est rogné.')), [
      { label: 'Annuler' },
      { label: 'Appliquer', primary: true, run: () => {
        const [nw, nh] = size.read();
        if (nw !== W() || nh !== H()) resizeSprite(nw, nh);
      } },
    ]);
  }

  // ---------- import / export ----------
  function exportFrame() {
    const s = sprite();
    if (!s || !ready) return;
    frames[fi].toBlob((b) => b && download(b, `${s.name}-${fi}.png`), 'image/png');
  }

  function exportSheet() {
    const s = sprite();
    if (!s || !ready) return;
    const n = frames.length;
    const cols = clamp(parseInt(colsIn.value, 10) || n, 1, n);
    const rows = Math.ceil(n / cols);
    const sheet = makeCanvas(cols * W(), rows * H());
    const ctx = sheet.getContext('2d');
    frames.forEach((c, i) => ctx.drawImage(c, (i % cols) * W(), Math.floor(i / cols) * H()));
    sheet.toBlob((b) => b && download(b, `${s.name}-sheet.png`), 'image/png');
  }

  async function importFile(file) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    if (!img) { alert('Image illisible.'); return; }
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'Image';
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = sprite();
    const has = !!s && ready;
    const bigger = has && (iw > W() || ih > H());
    const modes = [];
    if (has) {
      modes.push(['slice', `Découper en frames de ${W()}×${H()} (spritesheet : ${Math.ceil(iw / W())}×${Math.ceil(ih / H())} cases)`, bigger]);
      modes.push(['frame', 'Placer dans la frame courante (en haut à gauche, rogné)', !bigger]);
    }
    modes.push(['sprite', `Créer un nouveau sprite de ${iw}×${ih}`, !has]);
    const radios = modes.map(([val, text, checked]) => h('label', { class: 'px-radio' }, h('input', { type: 'radio', name: 'px-imp', value: val, checked }), text));
    const replaceChk = h('input', { type: 'checkbox' });
    const skipChk = h('input', { type: 'checkbox', checked: true });
    const body = h('div', {}, h('p', { class: 'px-hint', style: 'margin:0 0 8px' }, `${file.name} — ${iw}×${ih}`), radios,
      has && h('div', { class: 'px-hint' },
        h('label', { class: 'px-radio' }, replaceChk, 'Découpage : remplacer les frames existantes'),
        h('label', { class: 'px-radio' }, skipChk, 'Découpage : ignorer les cases vides')));
    openDialog('Importer une image', body, [
      { label: 'Annuler' },
      { label: 'Importer', primary: true, run: () => {
        const mode = body.querySelector('input[name=px-imp]:checked')?.value;
        if (mode === 'sprite') {
          if (iw > 512 || ih > 512) { alert('Image trop grande (512×512 maximum).'); return false; }
          const sp = createSprite(uniqueName(baseName, store.project.sprites.map((x) => x.name)), iw, ih);
          const c = makeCanvas(iw, ih);
          c.getContext('2d').drawImage(img, 0, 0);
          sp.frames = [c.toDataURL('image/png')];
          addSprite(sp);
        } else if (mode === 'frame') {
          const before = snap(s);
          const ctx = frames[fi].getContext('2d');
          ctx.clearRect(0, 0, W(), H());
          ctx.drawImage(img, 0, 0);
          commit(before);
        } else if (mode === 'slice') {
          const cols = Math.ceil(iw / W()), rows = Math.ceil(ih / H());
          const cells = [];
          for (let r = 0; r < rows; r++) {
            for (let cc = 0; cc < cols; cc++) {
              const c = makeCanvas(W(), H());
              c.getContext('2d').drawImage(img, cc * W(), r * H(), W(), H(), 0, 0, W(), H());
              if (!skipChk.checked || !isBlank(c)) cells.push(c);
            }
          }
          if (!cells.length) { alert('Aucune case non vide à importer.'); return false; }
          const replace = replaceChk.checked;
          const oldLen = frames.length;
          structural(() => {
            if (replace) { frames = cells; fi = 0; } else { frames.push(...cells); fi = oldLen; }
          }, replace ? (sp) => remapAnims(sp, (i) => (i < cells.length ? i : -1)) : null);
        }
      } },
    ]);
  }

  // ---------- animations ----------
  const curAnim = () => sprite()?.animations?.[animSel] || null;

  function editAnims(fn) {
    const s = sprite();
    if (!s) return;
    const before = snap(s);
    store.update((p) => {
      const sp = findById(p.sprites, s.id);
      if (!Array.isArray(sp.animations)) sp.animations = [];
      fn(sp.animations);
    }, 'sprite');
    pushUndo(before);
    renderAnims();
  }

  const parseFrames = (txt) => {
    const out = [];
    for (const tok of txt.split(/[\s,;]+/).filter(Boolean)) {
      const m = /^(\d+)-(\d+)$/.exec(tok);
      const [a, b] = m ? [+m[1], +m[2]] : [+tok, +tok];
      if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) if (i >= 0 && i < frames.length && out.length < 999) out.push(i);
    }
    return out;
  };

  function renderAnims() {
    const s = sprite();
    animsEl.replaceChildren(h('h3', {}, 'Animations'));
    if (!s || !ready) { animsEl.append(h('div', { class: 'px-hint' }, 'Sélectionnez un sprite.')); return; }
    const anims = s.animations || [];
    animSel = clamp(animSel, 0, Math.max(0, anims.length - 1));
    animsEl.append(h('div', { class: 'px-anim-list' }, anims.map((a, i) => h('div', {
      class: 'list-item' + (i === animSel ? ' selected' : ''),
      onclick: () => { animSel = i; animT0 = performance.now(); renderAnims(); },
    }, h('span', {}, a.name), h('small', { class: 'px-hint' }, `${a.frames.length} fr. · ${a.fps} fps`)))));
    animsEl.append(h('div', { class: 'px-row' },
      mkBtn('＋ Nouvelle', () => {
        editAnims((list) => {
          list.push({ name: uniqueName('anim', list.map((a) => a.name)), frames: frames.map((_, i) => i), fps: 6, loop: true });
          animSel = list.length - 1;
        });
        animT0 = performance.now();
      }),
      mkBtn('Supprimer', () => { if (curAnim()) editAnims((list) => { list.splice(animSel, 1); }); }),
    ));
    const a = curAnim();
    if (a) {
      const nameIn = h('input', { type: 'text', value: a.name, onchange: () => {
        const v = nameIn.value.trim();
        editAnims((list) => { list[animSel].name = v ? uniqueName(v, list.filter((_, i) => i !== animSel).map((x) => x.name)) : a.name; });
      } });
      const fpsIn = h('input', { type: 'number', min: 1, max: 60, value: a.fps, class: 'px-num', onchange: () => {
        editAnims((list) => { list[animSel].fps = clamp(parseInt(fpsIn.value, 10) || a.fps, 1, 60); });
      } });
      const loopChk = h('input', { type: 'checkbox', checked: a.loop !== false, onchange: () => {
        editAnims((list) => { list[animSel].loop = loopChk.checked; });
      } });
      const framesIn = h('input', { type: 'text', value: a.frames.join(','), title: 'Index de frames séparés par des virgules ; « 0-3 » = plage', onchange: () => {
        editAnims((list) => { list[animSel].frames = parseFrames(framesIn.value); });
        animT0 = performance.now();
      } });
      animsEl.append(
        h('div', { class: 'px-anim-form' },
          h('label', {}, 'Nom'), nameIn,
          h('label', {}, 'FPS'), fpsIn,
          h('label', {}, 'Boucle'), loopChk,
          h('label', {}, 'Frames'), framesIn),
        h('div', { class: 'px-row', style: 'margin-top:6px' },
          mkBtn('＋ Frame courante', () => editAnims((list) => { list[animSel].frames.push(fi); })),
          mkBtn('Toutes', () => editAnims((list) => { list[animSel].frames = frames.map((_, i) => i); })),
          mkBtn('Vider', () => editAnims((list) => { list[animSel].frames = []; })),
        ),
        h('p', { class: 'px-hint', style: 'margin:4px 0 0' }, `Frames valides : 0 à ${frames.length - 1}.`),
        animPrev,
      );
    }
  }

  function tickPreview(now) {
    raf = requestAnimationFrame(tickPreview);
    const a = curAnim();
    if (!a || !animPrev.isConnected || !ready || !frames.length) return;
    const w = W(), hh = H();
    if (animPrev.width !== w || animPrev.height !== hh) {
      animPrev.width = w;
      animPrev.height = hh;
      const k = Math.max(1, Math.floor(96 / Math.max(w, hh)));
      animPrev.style.width = `${w * k}px`;
      animPrev.style.height = `${hh * k}px`;
    }
    animPrevCtx.clearRect(0, 0, w, hh);
    if (!a.frames.length) return;
    const step = Math.floor(((now - animT0) / 1000) * (a.fps || 1));
    let idx;
    if (a.loop !== false) idx = step % a.frames.length;
    else if (step > a.frames.length + (a.fps || 1)) { animT0 = now; idx = 0; }
    else idx = Math.min(step, a.frames.length - 1);
    const f = frames[a.frames[idx]];
    if (f) animPrevCtx.drawImage(f, 0, 0);
  }
  raf = requestAnimationFrame(tickPreview);

  // ---------- outils / clavier ----------
  function setTool(id) {
    if (tool !== id && id !== 'select') sel = null;
    tool = id;
    syncToolbar();
    drawOverlay();
  }

  function setBrush(n) { brush = n; syncToolbar(); drawOverlay(); }

  listen(window, 'keydown', (e) => {
    if (!active || modal) return;
    const t = e.target;
    const typing = t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
      (t.tagName === 'INPUT' && !['checkbox', 'color', 'range', 'radio', 'button'].includes(t.type));
    if (typing) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (k === 'y') { e.preventDefault(); redo(); }
      else if (k === 'c' && sel) { e.preventDefault(); copySelection(false); }
      else if (k === 'x' && sel) { e.preventDefault(); copySelection(true); }
      else if (k === 'v' && clip) { e.preventDefault(); pasteClip(); }
      return;
    }
    if (e.altKey) return;
    if (k === ' ') { e.preventDefault(); spaceDown = true; vp.classList.add('panning'); return; }
    const tl = TOOLS.find((x) => x.key === k);
    if (tl) { if (sprite()) setTool(tl.id); return; }
    if (k.length === 1 && k >= '1' && k <= '4') setBrush(+k);
    else if (k === 'x') swapColors();
    else if (k === '+' || k === '=') zoomBy(1);
    else if (k === '-') zoomBy(-1);
    else if (k === 'delete' || k === 'backspace') { if (sel) { e.preventDefault(); clearSelection(); } }
    else if (k === 'escape') { sel = null; drawOverlay(); }
  });
  listen(window, 'keyup', (e) => {
    if (e.key === ' ') {
      spaceDown = false;
      if (!stroke) vp.classList.remove('panning');
      if (e.target.tagName === 'BUTTON') e.preventDefault();
    }
  });
  listen(window, 'blur', () => { spaceDown = false; if (!stroke) vp.classList.remove('panning'); });

  // ---------- démarrage ----------
  disposers.push(() => { cancelAnimationFrame(raf); loadToken++; ready = false; modal = null; });
  if (!sprite()) spriteId = store.project.sprites[0]?.id ?? null;
  renderSprites();
  renderColors();
  syncToolbar();
  loadSprite();

  return {
    dispose() { active = false; for (const d of disposers.reverse()) d(); },
    onShow() { active = true; store.ui.selectedSpriteId = spriteId; },
    onHide() { active = false; spaceDown = false; },
  };
}
