// Éditeur de graphe de nœuds façon Blueprint (Unreal Engine) : nœuds en DOM, fils en SVG, vue transformée (translate + scale).
// Contrat du format et du catalogue : docs/BLUEPRINTS.md. Le graphe est un objet JSON simple, modifié sur place ;
// chaque modification appelle onChange(graph) (l'appelant regroupe et sauvegarde).
import './graph.css';
import {
  getSpec, listSpecs, resolvePins, isCompatible, fieldOptions, createNode, CATEGORIES, PIN_COLORS, estimateNodeSize,
} from '../../graph/index.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const SNAP = 16;
const MIN_K = 0.25;
const MAX_K = 2;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const COMMENT_COLORS = ['#3b5dc9', '#38b764', '#b13e53', '#ef7d57', '#ffcd75', '#5d275d', '#94b0c2'];
const EVENT_COLOR = '#b13e53';
const PURE_COLOR = '#2f7a52';
const FALLBACK_COLOR = '#566c86';
const TYPE_NAMES = { exec: 'Exécution', number: 'Nombre', boolean: 'Booléen', string: 'Texte', object: 'Objet', color: 'Couleur', list: 'Liste', any: 'Tout type' };

let clipboard = null; // { nodes, links, comments } (JSON) : partagé entre les éditeurs (copier d'un objet vers un autre)
const viewMemory = new Map(); // dernière vue par script (objet / global)

// ---------------------------------------------------------------- utilitaires

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const snap = (v) => Math.round(v / SNAP) * SNAP;
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const clone = (o) => JSON.parse(JSON.stringify(o));

function hexRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  const n = m ? parseInt(m[1], 16) : 0x566c86;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// k < 0 assombrit, k > 0 éclaircit
function shade(hex, k) {
  const c = hexRgb(hex).map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function btn(label, title, fn, cls) {
  const b = el('button', cls || 'bp-btn', label);
  if (title) b.title = title;
  b.onclick = fn;
  return b;
}

function execShape() {
  const s = svgEl('svg', { viewBox: '0 0 14 14', width: 14, height: 14 });
  s.appendChild(svgEl('path', { d: 'M3 2.5 H7.5 L12 7 L7.5 11.5 H3 Z', class: 'bp-exec-shape' }));
  return s;
}

// valeur saisie → nombre / booléen / texte (valeur par défaut d'une variable)
function parseLiteral(s) {
  const t = String(s).trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && Number.isFinite(Number(t))) return Number(t);
  return String(s);
}

// ---------------------------------------------------------------- composant

/**
 * Monte l'éditeur de graphe dans `host`.
 * opts : { getGraph(), onChange(graph), ctx: { getProject, objectId, isGlobal } }
 * Retourne { setGraph(graph), getGraph(), focusNode(id), setDiagnostics({errors, warnings}), dispose() }.
 */
export function createGraphEditor(host, { getGraph, onChange, ctx = {} } = {}) {
  let graph = null;
  let disposed = false;
  const view = { x: 80, y: 80, k: 1 };
  const viewKey = ctx.isGlobal ? '__global__' : (ctx.objectId || '?');
  let pendingFrame = false;

  const nodeIndex = new Map(); // id -> node (JSON du graphe)
  const nodeStates = new Map(); // id -> { el, spec, pins, pinMap, pinEls, pinPos, w, h, sig }
  const linkEls = new Map(); // id -> { g, line, hit, color }
  const commentEls = new Map(); // id -> { el, title, ... }
  const linksByNode = new Map(); // id -> Set(link)
  const selection = new Set(); // ids de nœuds et de commentaires
  let selLink = null;
  let diagByNode = new Map();
  let diagGlobal = [];
  let zTop = 10;
  let drag = null;
  let panMoved = false;
  let pal = null; // palette ouverte
  let menu = null; // menu contextuel ouvert
  const mouse = { x: 0, y: 0, inside: false };
  const catColors = {};
  const catLabels = {};
  for (const c of CATEGORIES) { catColors[c.id] = c.color; catLabels[c.id] = c.label; }

  const cx = () => ({ project: ctx.getProject?.() ?? null, objectId: ctx.objectId ?? null, isGlobal: !!ctx.isGlobal, graph });

  // ------------------------------------------------------------ DOM

  const root = el('div', 'bp-root');
  const panel = el('div', 'bp-panel');
  const canvas = el('div', 'bp-canvas');
  canvas.tabIndex = -1;
  const world = el('div', 'bp-world');
  const commentLayer = el('div', 'bp-comments');
  const wireSvg = svgEl('svg', { class: 'bp-wires' });
  const wireLayer = svgEl('g');
  const ghost = svgEl('path', { class: 'bp-ghost' });
  ghost.style.display = 'none';
  wireSvg.append(wireLayer, ghost);
  const nodeLayer = el('div', 'bp-nodes');
  world.append(commentLayer, wireSvg, nodeLayer);
  const marquee = el('div', 'bp-marquee');
  marquee.hidden = true;
  const hint = el('div', 'bp-hint', 'Clic droit ou Espace pour ajouter un nœud');
  const watermark = el('div', 'bp-watermark', 'BLUEPRINT');
  const zoomLbl = el('span', 'bp-zoom', '100 %');
  const status = el('button', 'bp-status');
  status.hidden = true;
  const toolbar = el('div', 'bp-toolbar');
  const mm = el('canvas', 'bp-minimap');
  mm.width = 180;
  mm.height = 120;
  const bMap = btn('Carte', 'Afficher / masquer la mini-carte', () => { mm.hidden = !mm.hidden; bMap.classList.toggle('active', !mm.hidden); drawMinimap(); });
  bMap.classList.add('active');
  toolbar.append(
    btn('+ Nœud', 'Toutes les actions (Espace)', () => openPaletteAtCenter()),
    btn('Cadrer', 'Cadrer tout ou la sélection (F)', () => frame()),
    btn('Recentrer', 'Recentrer la vue (Origine)', () => home()),
    bMap, zoomLbl,
  );
  canvas.append(world, marquee, hint, watermark, status, toolbar, mm);
  root.append(panel, canvas);
  host.appendChild(root);

  // ------------------------------------------------------------ index

  function normalize(g) {
    const out = g && typeof g === 'object' ? g : {};
    if (!out.version) out.version = 1;
    for (const k of ['nodes', 'links', 'variables', 'comments']) if (!Array.isArray(out[k])) out[k] = [];
    return out;
  }

  function reindex() {
    nodeIndex.clear();
    linksByNode.clear();
    for (const n of graph.nodes) {
      if (!n.fields || typeof n.fields !== 'object') n.fields = {};
      if (!n.values || typeof n.values !== 'object') n.values = {};
      if (!n.extra || typeof n.extra !== 'object') n.extra = {};
      nodeIndex.set(n.id, n);
    }
    for (const l of graph.links) indexLink(l);
  }

  function indexLink(l) {
    for (const id of [l.from, l.to]) {
      if (!linksByNode.has(id)) linksByNode.set(id, new Set());
      linksByNode.get(id).add(l);
    }
  }

  function uid(prefix) {
    const used = (id) => nodeIndex.has(id) || graph.links.some((l) => l.id === id) || graph.comments.some((c) => c.id === id);
    let id;
    do id = prefix + Math.random().toString(36).slice(2, 8); while (used(id));
    return id;
  }

  // ------------------------------------------------------------ historique annuler / rétablir (Ctrl+Z / Ctrl+Y)
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 100;
  let isRestoringHistory = false;

  function pushHistory() {
    if (isRestoringHistory || !graph) return;
    const snap = JSON.stringify(graph);
    if (undoStack.length && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length <= 1) return false;
    const current = undoStack.pop();
    redoStack.push(current);
    const prev = undoStack[undoStack.length - 1];
    isRestoringHistory = true;
    try {
      setGraph(JSON.parse(prev));
      onChange?.(graph);
    } finally {
      isRestoringHistory = false;
    }
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    const next = redoStack.pop();
    undoStack.push(next);
    isRestoringHistory = true;
    try {
      setGraph(JSON.parse(next));
      onChange?.(graph);
    } finally {
      isRestoringHistory = false;
    }
    return true;
  }

  const emit = (opts) => {
    if (disposed) return;
    scheduleMinimap();
    updateHint();
    if (!opts?.keepPanel) refreshPanel();
    pushHistory();
    onChange?.(graph);
  };

  // ------------------------------------------------------------ vue

  function applyView() {
    world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    const s = view.k * SNAP;
    const L = s * 8;
    canvas.style.backgroundSize = `${L}px ${L}px, ${L}px ${L}px, ${s}px ${s}px, ${s}px ${s}px`;
    canvas.style.backgroundPosition = `${view.x}px ${view.y}px`;
    canvas.style.setProperty('--bp-fine', String(clamp((s - 4) / 6, 0, 1)));
    zoomLbl.textContent = Math.round(view.k * 100) + ' %';
    viewMemory.set(viewKey, { ...view });
    scheduleMinimap();
  }

  function screenToGraph(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k };
  }

  function zoomAt(clientX, clientY, k) {
    const r = canvas.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    const nk = clamp(k, MIN_K, MAX_K);
    const gx = (px - view.x) / view.k;
    const gy = (py - view.y) / view.k;
    view.k = nk;
    view.x = px - gx * nk;
    view.y = py - gy * nk;
    applyView();
  }

  function sizeOf(node) {
    const ns = nodeStates.get(node.id);
    if (ns?.w) return { w: ns.w, h: ns.h };
    try {
      const s = estimateNodeSize(node, graph);
      if (s) return { w: s.w ?? s.width ?? 180, h: s.h ?? s.height ?? 80 };
    } catch { /* estimation indisponible */ }
    return { w: 180, h: 80 };
  }

  function boundsOf(ids) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    const add = (x, y, w, h) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
    for (const n of graph.nodes) if (!ids || ids.has(n.id)) { const s = sizeOf(n); add(n.x, n.y, s.w, s.h); }
    for (const c of graph.comments) if (!ids || ids.has(c.id)) add(c.x, c.y, c.w, c.h);
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }

  function frame(ids, maxK = 1.25) {
    const sel = ids || (selection.size ? selection : null);
    const b = boundsOf(sel);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!b || !w || !h) return;
    const pad = 60;
    const k = clamp(Math.min((w - pad * 2) / (b.x1 - b.x0), (h - pad * 2) / (b.y1 - b.y0)), MIN_K, maxK);
    view.k = k;
    view.x = (w - (b.x1 - b.x0) * k) / 2 - b.x0 * k;
    view.y = (h - (b.y1 - b.y0) * k) / 2 - b.y0 * k;
    applyView();
  }

  function home() {
    const b = boundsOf(null);
    view.k = 1;
    if (b) {
      view.x = canvas.clientWidth / 2 - ((b.x0 + b.x1) / 2);
      view.y = canvas.clientHeight / 2 - ((b.y0 + b.y1) / 2);
    } else {
      view.x = 80;
      view.y = 80;
    }
    applyView();
  }

  function centerOn(gx, gy) {
    view.x = canvas.clientWidth / 2 - gx * view.k;
    view.y = canvas.clientHeight / 2 - gy * view.k;
    applyView();
  }

  // ------------------------------------------------------------ nœuds : rendu

  function pinSig(pins) {
    return JSON.stringify([pins.inputs.map((p) => p.name + ':' + p.type), pins.outputs.map((p) => p.name + ':' + p.type)]);
  }

  function safePins(node) {
    try {
      const p = resolvePins(node, graph);
      return { inputs: p?.inputs || [], outputs: p?.outputs || [], fields: p?.fields };
    } catch (e) {
      console.error(e);
      return { inputs: [], outputs: [] };
    }
  }

  // Options d'une liste déroulante : [[libellé, valeur], ...] (fieldOptions garde la valeur courante grâce à ctx.value)
  function optionsFor(f, current) {
    let o;
    try { o = typeof f.options === 'function' ? f.options(cx()) : f.options; } catch { o = null; }
    if (!o) { try { o = fieldOptions(f, { ...cx(), value: current }); } catch { o = []; } }
    return (o || []).map((x) => (Array.isArray(x) ? [String(x[0]), x[1] ?? x[0]] : [String(x), x]));
  }

  function fillSelect(sel, f, current) {
    const opts = optionsFor(f, current);
    const key = JSON.stringify(opts) + '|' + current;
    if (sel.__key === key) return;
    sel.__key = key;
    sel.textContent = '';
    let found = false;
    for (const [label, value] of opts) {
      const o = el('option', null, label);
      o.value = value;
      if (String(value) === String(current)) { o.selected = true; found = true; }
      sel.appendChild(o);
    }
    if (!found) {
      const o = el('option', null, current === '' || current == null ? '(aucun)' : String(current));
      o.value = current ?? '';
      o.selected = true;
      sel.insertBefore(o, sel.firstChild);
    }
  }

  function buildField(node, f) {
    const kind = f.kind || 'dropdown';
    const cur = node.fields[f.name] ?? f.default ?? (kind === 'number' ? 0 : kind === 'checkbox' ? false : kind === 'color' ? '#ffffff' : '');
    const row = el('label', 'bp-field');
    let w;
    if (kind === 'checkbox') {
      w = el('input');
      w.type = 'checkbox';
      w.checked = !!cur;
      w.onchange = () => setField(node, f.name, w.checked);
      row.append(w, el('span', 'bp-flabel', f.label || f.name));
      return row;
    }
    row.appendChild(el('span', 'bp-flabel', f.label || f.name));
    if (kind === 'text' || kind === 'number' || kind === 'color') {
      w = el('input', 'bp-in bp-in-' + kind);
      w.type = kind === 'text' ? 'text' : kind;
      if (kind === 'number') w.step = 'any';
      w.value = cur;
      w.oninput = () => {
        if (kind === 'number') { const v = Number(w.value); if (w.value !== '' && Number.isFinite(v)) setField(node, f.name, v); } else setField(node, f.name, w.value);
      };
    } else {
      // dropdown + listes dynamiques (object, map, anim, sound, layer, variable, key)
      if (kind === 'key' && !optionsFor(f, cur).length) {
        w = el('input', 'bp-in bp-in-text');
        w.value = cur;
        w.oninput = () => setField(node, f.name, w.value);
      } else {
        w = el('select', 'bp-sel');
        fillSelect(w, f, cur);
        const refresh = () => fillSelect(w, f, node.fields[f.name] ?? f.default ?? '');
        w.addEventListener('focus', refresh);
        w.addEventListener('mousedown', refresh);
        w.onchange = () => setField(node, f.name, w.value);
      }
    }
    row.appendChild(w);
    return row;
  }

  function buildLiteral(node, pin) {
    const has = node.values[pin.name] !== undefined;
    const cur = has ? node.values[pin.name] : pin.default;
    let kind = pin.type;
    if (kind === 'any') kind = typeof cur === 'number' ? 'number' : typeof cur === 'boolean' ? 'boolean' : typeof cur === 'string' ? 'string' : null;
    if (!['number', 'string', 'boolean', 'color'].includes(kind)) return null;
    const setv = (v) => { node.values[pin.name] = v; emit({ keepPanel: true }); };
    let w;
    if (kind === 'boolean') {
      w = el('input', 'bp-lit bp-lit-bool');
      w.type = 'checkbox';
      w.checked = !!cur;
      w.onchange = () => setv(w.checked);
    } else if (kind === 'color') {
      w = el('input', 'bp-lit bp-lit-color');
      w.type = 'color';
      w.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff';
      w.oninput = () => setv(w.value);
    } else if (kind === 'number') {
      w = el('input', 'bp-lit bp-lit-num');
      w.type = 'number';
      w.step = 'any';
      w.value = cur ?? 0;
      w.oninput = () => { const v = Number(w.value); if (w.value !== '' && Number.isFinite(v)) setv(v); };
    } else {
      w = el('input', 'bp-lit bp-lit-str');
      w.type = 'text';
      w.value = cur ?? '';
      w.oninput = () => setv(w.value);
    }
    return w;
  }

  function buildPin(node, ns, pin, dir) {
    const row = el('div', 'bp-pin ' + dir + (pin.type === 'exec' ? ' exec' : ''));
    row.style.setProperty('--pc', PIN_COLORS[pin.type] || '#94b0c2');
    const dot = el('span', 'bp-dot');
    if (pin.type === 'exec') dot.appendChild(execShape());
    const hideLabel = pin.type === 'exec' && (pin.name === 'exec' || pin.name === 'then') && !pin.label;
    const label = el('span', 'bp-plabel', hideLabel ? '' : (pin.label ?? pin.name));
    row.__pin = { nodeId: node.id, dir, name: pin.name, type: pin.type };
    row.title = TYPE_NAMES[pin.type] || pin.type;
    if (dir === 'in') {
      row.append(dot, label);
      if (pin.type !== 'exec') { const lit = buildLiteral(node, pin); if (lit) row.appendChild(lit); }
    } else {
      row.append(label, dot);
    }
    ns.pinEls.set(dir + ':' + pin.name, { row, dot, pin, dir });
    return row;
  }

  function fillNode(node, ns) {
    const e = ns.el;
    const spec = getSpec(node.type);
    ns.spec = spec;
    ns.pinEls = new Map();
    ns.pinPos = new Map();
    e.textContent = '';
    const kind = spec?.kind || 'exec';
    e.className = 'bp-node bp-' + kind + (spec ? '' : ' bp-unknown');
    e.dataset.id = node.id;
    e.style.transform = `translate(${node.x}px,${node.y}px)`;
    if (selection.has(node.id)) e.classList.add('selected');

    const pins = spec ? safePins(node) : { inputs: [], outputs: [], fields: [] };
    ns.pins = pins;
    ns.sig = pinSig(pins);
    ns.pinMap = new Map();
    for (const p of pins.inputs) ns.pinMap.set('in:' + p.name, p);
    for (const p of pins.outputs) ns.pinMap.set('out:' + p.name, p);

    const head = el('div', 'bp-head');
    const col = kind === 'event' && spec.category === 'event' ? EVENT_COLOR : kind === 'pure' ? PURE_COLOR : (catColors[spec?.category] || FALLBACK_COLOR);
    head.style.background = spec ? `linear-gradient(95deg, ${col} 0%, ${shade(col, -0.45)} 100%)` : '#7a2530';
    let title = spec ? spec.title : 'Nœud inconnu : ' + node.type;
    if ((spec?.dynamic === 'call') && node.extra.name) title += ' ' + node.extra.name;
    head.appendChild(el('span', 'bp-title', title));
    head.title = spec?.tooltip || '';
    if (spec) {
      const helpBtn = el('button', 'bp-help-btn', '?');
      helpBtn.title = 'Aide sur ce nœud : ' + spec.title;
      helpBtn.onclick = (ev) => {
        ev.stopPropagation();
        openNodeDoc(spec, ev.clientX, ev.clientY);
      };
      head.appendChild(helpBtn);
    }
    e.appendChild(head);

    if (spec) {
      const flist = pins.fields || spec.fields || [];
      if (flist.length || spec.dynamic === 'call') {
        const fields = el('div', 'bp-fields');
        for (const f of flist) fields.appendChild(buildField(node, f));
        if (spec.dynamic === 'call' && !flist.length) fields.appendChild(buildCallPicker(node));
        e.appendChild(fields);
      }
      const body = el('div', 'bp-pins');
      const ins = el('div', 'bp-ins');
      const outs = el('div', 'bp-outs');
      for (const p of pins.inputs) ins.appendChild(buildPin(node, ns, p, 'in'));
      for (const p of pins.outputs) outs.appendChild(buildPin(node, ns, p, 'out'));
      body.append(ins, outs);
      e.appendChild(body);
      buildDynamic(node, spec, e);
    }
    applyDiag(node, ns);
  }

  function setField(node, name, value) {
    const old = node.fields[name];
    node.fields[name] = value;
    const ns = nodeStates.get(node.id);
    if (ns && pinSig(safePins(node)) !== ns.sig) refreshNode(node.id, { prune: true }); // les broches dépendent d'un champ
    if (node.type === 'fn_def' && name === 'NAME') syncCalls(old, node);
    emit();
  }

  function buildCallPicker(node) {
    const row = el('label', 'bp-field');
    row.appendChild(el('span', 'bp-flabel', 'fonction'));
    const sel = el('select', 'bp-sel');
    const fill = () => {
      const names = fnDefs().map((d) => d.fields.NAME).filter(Boolean);
      const cur = node.extra.name || '';
      sel.textContent = '';
      if (!names.includes(cur)) sel.appendChild(Object.assign(el('option', null, cur || '(choisir)'), { value: cur }));
      for (const n of names) sel.appendChild(Object.assign(el('option', null, n), { value: n, selected: n === cur }));
      sel.value = cur;
    };
    fill();
    sel.addEventListener('mousedown', fill);
    sel.onchange = () => {
      node.extra.name = sel.value;
      const def = fnDefs().find((d) => d.fields.NAME === sel.value);
      if (def) node.extra.params = [...(def.extra.params || [])];
      refreshNode(node.id, { prune: true });
      emit();
    };
    row.appendChild(sel);
    return row;
  }

  function buildDynamic(node, spec, e) {
    const dyn = spec.dynamic;
    if (dyn === 'items' || dyn === 'outs') {
      const cur = Math.max(1, Number(node.extra[dyn]) || 2);
      const row = el('div', 'bp-dyn');
      const set = (n) => {
        node.extra[dyn] = clamp(n, 1, 24);
        refreshNode(node.id, { prune: true });
        emit();
      };
      row.append(btn('−', 'Retirer une broche', () => set(cur - 1), 'bp-mini'), el('span', 'bp-dyn-n', String(cur)), btn('+', 'Ajouter une broche', () => set(cur + 1), 'bp-mini'));
      e.appendChild(row);
    } else if (dyn === 'params') {
      const row = el('div', 'bp-dyn');
      row.appendChild(btn('Paramètres…', 'Modifier les paramètres de la fonction', () => editParams(node), 'bp-mini wide'));
      e.appendChild(row);
    }
  }

  function createNodeEl(node) {
    const ns = { el: el('div'), spec: null, pins: null, pinMap: null, pinEls: new Map(), pinPos: new Map(), w: 0, h: 0, sig: '' };
    nodeStates.set(node.id, ns);
    fillNode(node, ns);
    nodeLayer.appendChild(ns.el);
    nodeRO.observe(ns.el);
    return ns;
  }

  function refreshNode(id, { prune = false } = {}) {
    const node = nodeIndex.get(id);
    const ns = nodeStates.get(id);
    if (!node || !ns) return;
    fillNode(node, ns);
    if (prune) pruneInvalidLinks(id);
    updateLinked(id);
    measureNode(id);
    redrawLinksOf([id]);
  }

  // Mesure le nœud et la position (dans le nœud) de chacune de ses broches
  function measureNode(id) {
    const ns = nodeStates.get(id);
    if (!ns || !ns.el.isConnected) return false;
    ns.w = ns.el.offsetWidth;
    ns.h = ns.el.offsetHeight;
    ns.pinPos.clear();
    for (const [key, p] of ns.pinEls) {
      let x = ns.el.clientLeft;
      let y = ns.el.clientTop;
      let o = p.dot;
      while (o && o !== ns.el) { x += o.offsetLeft; y += o.offsetTop; o = o.offsetParent; }
      ns.pinPos.set(key, { x: x + p.dot.offsetWidth / 2, y: y + p.dot.offsetHeight / 2 });
    }
    return true;
  }

  // Le contenu d'un nœud peut changer de taille (liste déroulante, champ) : on remesure et on redessine ses fils
  const nodeRO = new ResizeObserver((entries) => {
    if (disposed) return;
    const ids = [];
    for (const en of entries) {
      const id = en.target.dataset.id;
      if (id && measureNode(id)) ids.push(id);
    }
    if (ids.length) { redrawLinksOf(ids); scheduleMinimap(); }
  });

  function updateLinked(id) {
    const ns = nodeStates.get(id);
    if (!ns) return;
    const set = linksByNode.get(id);
    for (const p of ns.pinEls.values()) {
      let linked = false;
      if (set) {
        for (const l of set) {
          if (p.dir === 'in' ? (l.to === id && l.toPin === p.pin.name) : (l.from === id && l.fromPin === p.pin.name)) { linked = true; break; }
        }
      }
      p.row.classList.toggle('linked', linked);
    }
  }

  // ------------------------------------------------------------ diagnostics

  function applyDiag(node, ns) {
    const d = diagByNode.get(node.id);
    const e = ns.el;
    e.classList.toggle('bp-err', !!d?.errors.length);
    e.classList.toggle('bp-warn', !!d && !d.errors.length && !!d.warnings.length);
    e.querySelector('.bp-badge')?.remove();
    const head = e.firstChild;
    if (d && (d.errors.length || d.warnings.length)) {
      const msgs = [...d.errors.map((m) => 'Erreur : ' + m), ...d.warnings.map((m) => 'Avertissement : ' + m)].join('\n');
      const b = el('span', 'bp-badge', d.errors.length ? '!' : '?');
      b.title = msgs;
      head?.appendChild(b);
      e.title = msgs;
    } else {
      e.removeAttribute('title');
    }
  }

  function setDiagnostics({ errors = [], warnings = [] } = {}) {
    const next = new Map();
    diagGlobal = [];
    const put = (list, kind) => {
      for (const d of list) {
        const msg = typeof d === 'string' ? d : d.message;
        const id = typeof d === 'string' ? null : d.nodeId;
        if (!id || !nodeIndex.has(id)) { diagGlobal.push({ kind, msg }); continue; }
        if (!next.has(id)) next.set(id, { errors: [], warnings: [] });
        next.get(id)[kind === 'error' ? 'errors' : 'warnings'].push(msg);
      }
    };
    put(errors, 'error');
    put(warnings, 'warning');
    const touched = new Set([...diagByNode.keys(), ...next.keys()]);
    const prev = diagByNode;
    diagByNode = next;
    for (const id of touched) {
      if (JSON.stringify(prev.get(id)) === JSON.stringify(next.get(id))) continue;
      const ns = nodeStates.get(id);
      const node = nodeIndex.get(id);
      if (ns && node) applyDiag(node, ns);
    }
    const ne = errors.length;
    const nw = warnings.length;
    status.hidden = !ne && !nw;
    status.className = 'bp-status' + (ne ? ' err' : ' warn');
    status.textContent = (ne ? `${ne} erreur${ne > 1 ? 's' : ''}` : '') + (ne && nw ? ' · ' : '') + (nw ? `${nw} avertissement${nw > 1 ? 's' : ''}` : '');
    status.title = [...errors.map((d) => 'Erreur : ' + (d.message ?? d)), ...warnings.map((d) => 'Avertissement : ' + (d.message ?? d))].join('\n');
  }

  status.onclick = () => {
    const first = [...diagByNode.entries()].sort((a, b) => b[1].errors.length - a[1].errors.length)[0];
    if (first) focusNode(first[0]);
  };

  // ------------------------------------------------------------ fils

  const pinTypeOf = (id, dir, name) => nodeStates.get(id)?.pinMap?.get(dir + ':' + name)?.type ?? null;

  function pinPoint(id, dir, name) {
    const node = nodeIndex.get(id);
    const p = nodeStates.get(id)?.pinPos.get(dir + ':' + name);
    return node && p ? { x: node.x + p.x, y: node.y + p.y } : null;
  }

  function linkPath(a, b) {
    const dx = clamp(Math.abs(b.x - a.x) * 0.55, 40, 240);
    return `M${a.x} ${a.y}C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
  }

  function drawLink(l) {
    const a = pinPoint(l.from, 'out', l.fromPin);
    const b = pinPoint(l.to, 'in', l.toPin);
    let rec = linkEls.get(l.id);
    if (!a || !b) { if (rec) rec.g.style.display = 'none'; return; }
    const type = pinTypeOf(l.from, 'out', l.fromPin) || 'any';
    if (!rec) {
      const g = svgEl('g', { class: 'bp-wire' });
      const hit = svgEl('path', { class: 'bp-wire-hit' });
      const line = svgEl('path', { class: 'bp-wire-line' });
      g.append(hit, line);
      g.__link = l;
      wireLayer.appendChild(g);
      rec = { g, line, hit, color: null, exec: null };
      linkEls.set(l.id, rec);
    }
    rec.g.style.display = '';
    const d = linkPath(a, b);
    rec.line.setAttribute('d', d);
    rec.hit.setAttribute('d', d);
    if (rec.exec !== (type === 'exec')) { rec.exec = type === 'exec'; rec.g.classList.toggle('exec', rec.exec); }
    const color = PIN_COLORS[type] || '#94b0c2';
    if (rec.color !== color) { rec.color = color; rec.line.style.stroke = color; }
    rec.g.classList.toggle('selected', selLink === l.id);
  }

  function redrawLinksOf(ids) {
    const done = new Set();
    for (const id of ids) {
      const set = linksByNode.get(id);
      if (!set) continue;
      for (const l of set) if (!done.has(l)) { done.add(l); drawLink(l); }
    }
  }

  function removeLink(l, { quiet = false } = {}) {
    const i = graph.links.indexOf(l);
    if (i >= 0) graph.links.splice(i, 1);
    linksByNode.get(l.from)?.delete(l);
    linksByNode.get(l.to)?.delete(l);
    const rec = linkEls.get(l.id);
    if (rec) { rec.g.remove(); linkEls.delete(l.id); }
    if (selLink === l.id) selLink = null;
    updateLinked(l.from);
    updateLinked(l.to);
    if (!quiet) scheduleMinimap();
  }

  function pruneInvalidLinks(id) {
    const set = linksByNode.get(id);
    if (!set) return false;
    let any = false;
    for (const l of [...set]) {
      const a = pinTypeOf(l.from, 'out', l.fromPin);
      const b = pinTypeOf(l.to, 'in', l.toPin);
      const ok = a && b && ((a === 'exec' && b === 'exec') || (a !== 'exec' && b !== 'exec' && isCompatible(a, b)));
      if (!ok) { removeLink(l); any = true; }
    }
    return any;
  }

  function wouldCycle(outNode, inNode) {
    // ajouter out → in crée une boucle de données si `in` mène déjà à `out` par des fils de données
    const seen = new Set();
    const stack = [inNode];
    while (stack.length) {
      const id = stack.pop();
      if (id === outNode) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const l of linksByNode.get(id) || []) {
        if (l.from === id && pinTypeOf(l.from, 'out', l.fromPin) !== 'exec') stack.push(l.to);
      }
    }
    return false;
  }

  // a, b : { nodeId, dir, name, type }. Retourne { out, inp } si la liaison est permise
  function canConnect(a, b) {
    if (!a || !b || a.dir === b.dir || a.nodeId === b.nodeId) return null;
    const out = a.dir === 'out' ? a : b;
    const inp = a.dir === 'in' ? a : b;
    if ((out.type === 'exec') !== (inp.type === 'exec')) return null;
    if (out.type !== 'exec') {
      if (!isCompatible(out.type, inp.type)) return null;
      if (wouldCycle(out.nodeId, inp.nodeId)) return null;
    }
    return { out, inp };
  }

  function connect(a, b) {
    const c = canConnect(a, b);
    if (!c) return false;
    const { out, inp } = c;
    if (graph.links.some((l) => l.from === out.nodeId && l.fromPin === out.name && l.to === inp.nodeId && l.toPin === inp.name)) return false;
    if (out.type === 'exec') {
      for (const l of graph.links.filter((x) => x.from === out.nodeId && x.fromPin === out.name)) removeLink(l, { quiet: true });
    }
    if (inp.type !== 'exec') {
      for (const l of graph.links.filter((x) => x.to === inp.nodeId && x.toPin === inp.name)) removeLink(l, { quiet: true });
    }
    const link = { id: uid('l'), from: out.nodeId, fromPin: out.name, to: inp.nodeId, toPin: inp.name };
    graph.links.push(link);
    indexLink(link);
    updateLinked(out.nodeId);
    updateLinked(inp.nodeId);
    drawLink(link);
    emit({ keepPanel: true });
    return true;
  }

  function cutPin(p) {
    const list = (linksByNode.get(p.nodeId) ? [...linksByNode.get(p.nodeId)] : [])
      .filter((l) => (p.dir === 'in' ? l.to === p.nodeId && l.toPin === p.name : l.from === p.nodeId && l.fromPin === p.name));
    if (!list.length) return;
    for (const l of list) removeLink(l);
    emit({ keepPanel: true });
  }

  // ------------------------------------------------------------ nœuds : ajout / suppression

  function addNodeData(node) {
    if (!node.fields) node.fields = {};
    if (!node.values) node.values = {};
    if (!node.extra) node.extra = {};
    graph.nodes.push(node);
    nodeIndex.set(node.id, node);
    const ns = createNodeEl(node);
    measureNode(node.id);
    ns.el.style.zIndex = ++zTop;
    return ns;
  }

  function addNodeOfType(type, gx, gy, mutate) {
    let node;
    try { node = createNode(type, gx, gy, graph); } catch (e) { console.error(e); return null; }
    if (!node) return null;
    node.x = snap(gx);
    node.y = snap(gy);
    if (!node.id || nodeIndex.has(node.id)) node.id = uid('n');
    mutate?.(node);
    addNodeData(node);
    return node;
  }

  function removeNodes(ids) {
    const set = new Set(ids);
    for (const id of set) {
      for (const l of [...(linksByNode.get(id) || [])]) removeLink(l, { quiet: true });
      linksByNode.delete(id);
      const ns = nodeStates.get(id);
      if (ns) { nodeRO.unobserve(ns.el); ns.el.remove(); nodeStates.delete(id); }
      nodeIndex.delete(id);
      diagByNode.delete(id);
    }
    graph.nodes = graph.nodes.filter((n) => !set.has(n.id));
  }

  function removeComments(ids) {
    const set = new Set(ids);
    for (const id of set) { commentEls.get(id)?.el.remove(); commentEls.delete(id); }
    graph.comments = graph.comments.filter((c) => !set.has(c.id));
  }

  function deleteSelection() {
    if (selLink) {
      const l = graph.links.find((x) => x.id === selLink);
      if (l) { removeLink(l); emit({ keepPanel: true }); }
      selLink = null;
      return;
    }
    if (!selection.size) return;
    const nodes = [...selection].filter((id) => nodeIndex.has(id));
    const comments = [...selection].filter((id) => commentEls.has(id));
    selection.clear();
    removeNodes(nodes);
    removeComments(comments);
    emit();
  }

  // ------------------------------------------------------------ sélection

  function elOfId(id) { return nodeStates.get(id)?.el || commentEls.get(id)?.el || null; }

  function setSelLink(id) {
    if (selLink === id) return;
    const prev = selLink;
    selLink = id;
    for (const k of [prev, id]) if (k && linkEls.has(k)) linkEls.get(k).g.classList.toggle('selected', k === selLink);
  }

  function applySelection(next) {
    for (const id of [...selection]) if (!next.has(id)) { selection.delete(id); elOfId(id)?.classList.remove('selected'); }
    for (const id of next) if (!selection.has(id)) { selection.add(id); elOfId(id)?.classList.add('selected'); }
    if (selection.size) setSelLink(null);
  }

  const selectOnly = (id) => applySelection(new Set([id]));

  // ------------------------------------------------------------ commentaires

  function commentStyle(c, ce) {
    ce.el.style.transform = `translate(${c.x}px,${c.y}px)`;
    ce.el.style.width = c.w + 'px';
    ce.el.style.height = c.h + 'px';
    ce.el.style.setProperty('--cc', c.color || COMMENT_COLORS[0]);
  }

  function createCommentEl(c) {
    const e = el('div', 'bp-comment');
    e.dataset.id = c.id;
    const head = el('div', 'bp-comment-head');
    const title = el('span', 'bp-comment-title', c.text || '');
    const color = el('input', 'bp-comment-color');
    color.type = 'color';
    color.title = 'Couleur du commentaire';
    color.value = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : COMMENT_COLORS[0];
    color.oninput = () => { c.color = color.value; commentStyle(c, ce); emit({ keepPanel: true }); };
    head.append(title, color);
    const handle = el('div', 'bp-comment-resize');
    e.append(head, handle);
    const ce = { el: e, title, head, handle };
    commentEls.set(c.id, ce);
    commentStyle(c, ce);
    if (selection.has(c.id)) e.classList.add('selected');
    commentLayer.appendChild(e);
    head.ondblclick = (ev) => { if (!ev.target.closest('input')) editCommentTitle(c); };
    return ce;
  }

  function editCommentTitle(c) {
    const ce = commentEls.get(c.id);
    if (!ce) return;
    const input = el('input', 'bp-comment-edit');
    input.value = c.text || '';
    ce.title.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      if (ok) c.text = input.value;
      ce.title.textContent = c.text || '';
      input.replaceWith(ce.title);
      if (ok) emit({ keepPanel: true });
    };
    input.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') finish(false); };
    input.onblur = () => finish(true);
  }

  function addComment(rect) {
    const c = { id: uid('c'), x: snap(rect.x), y: snap(rect.y), w: Math.max(160, snap(rect.w)), h: Math.max(80, snap(rect.h)), text: 'Commentaire', color: COMMENT_COLORS[0] };
    graph.comments.push(c);
    createCommentEl(c);
    selectOnly(c.id);
    emit({ keepPanel: true });
    editCommentTitle(c);
  }

  function commentSelection() {
    const ids = new Set([...selection].filter((id) => nodeIndex.has(id)));
    const b = ids.size ? boundsOf(ids) : null;
    if (b) {
      addComment({ x: b.x0 - 24, y: b.y0 - 48, w: b.x1 - b.x0 + 48, h: b.y1 - b.y0 + 72 });
    } else {
      const g = screenToGraph(mouse.inside ? mouse.x : canvas.getBoundingClientRect().left + 200, mouse.inside ? mouse.y : canvas.getBoundingClientRect().top + 150);
      addComment({ x: g.x, y: g.y, w: 320, h: 200 });
    }
  }

  // nœuds dont le centre est dans le cadre
  function nodesInComment(c) {
    const out = [];
    for (const n of graph.nodes) {
      const s = sizeOf(n);
      const mx = n.x + s.w / 2;
      const my = n.y + s.h / 2;
      if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) out.push(n);
    }
    return out;
  }

  // ------------------------------------------------------------ rendu complet

  function renderAll() {
    nodeRO.disconnect();
    nodeLayer.textContent = '';
    commentLayer.textContent = '';
    wireLayer.textContent = '';
    nodeStates.clear();
    linkEls.clear();
    commentEls.clear();
    reindex();
    for (const n of graph.nodes) createNodeEl(n);
    for (const c of graph.comments) createCommentEl(c);
    for (const n of graph.nodes) measureNode(n.id); // une seule passe de mise en page
    for (const n of graph.nodes) updateLinked(n.id);
    for (const l of graph.links) drawLink(l);
    refreshPanel(true);
    updateHint();
    scheduleMinimap();
  }

  function updateHint() { hint.hidden = !!(graph && (graph.nodes.length || graph.comments.length)); }

  // ------------------------------------------------------------ interactions : pointeur

  function windowMove(e) { if (drag?.move) drag.move(e); }
  function windowUp(e) {
    const d = drag;
    drag = null;
    if (d?.up) d.up(e);
  }

  function pinFromTarget(t) { return t?.closest?.('.bp-pin')?.__pin || null; }

  function onPointerDown(e) {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
    const t = e.target;
    if (t.closest('.bp-toolbar, .bp-minimap, .bp-palette, .bp-menu, .bp-status')) return;
    closeMenu();
    const inField = t.closest('input, select, textarea, button, [contenteditable]');
    if (!inField && document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
    if (e.button === 1) { e.preventDefault(); startPan(e); return; }
    if (e.button === 2) {
      panMoved = false;
      if (!t.closest('.bp-node, .bp-comment-head, .bp-wire')) startPan(e);
      return;
    }
    if (e.button !== 0) return;

    const pinRow = !t.closest('.bp-lit') ? t.closest('.bp-pin') : null;
    const nodeEl = t.closest('.bp-node');
    if (pinRow && (t.closest('.bp-dot') || t.closest('.bp-plabel'))) { startWire(e, pinRow.__pin); return; }
    const handle = t.closest('.bp-comment-resize');
    if (handle) { startCommentResize(e, graph.comments.find((c) => c.id === handle.parentNode.dataset.id)); return; }
    const chead = t.closest('.bp-comment-head');
    if (chead) {
      if (t.closest('input')) return;
      startCommentDrag(e, graph.comments.find((c) => c.id === chead.parentNode.dataset.id));
      return;
    }
    if (nodeEl) {
      const node = nodeIndex.get(nodeEl.dataset.id);
      if (!node) return;
      nodeEl.style.zIndex = ++zTop;
      if (inField) {
        if (!selection.has(node.id)) selectOnly(node.id);
        return;
      }
      startNodeDrag(e, node);
      return;
    }
    const wire = t.closest('.bp-wire');
    if (wire) {
      const l = wire.__link;
      if (e.altKey) { removeLink(l); emit({ keepPanel: true }); return; }
      applySelection(new Set());
      setSelLink(l.id);
      return;
    }
    startMarquee(e);
  }

  function startPan(e) {
    const sx = e.clientX; const sy = e.clientY; const vx = view.x; const vy = view.y;
    canvas.classList.add('panning');
    drag = {
      move(ev) {
        const dx = ev.clientX - sx; const dy = ev.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) panMoved = true;
        view.x = vx + dx; view.y = vy + dy;
        applyView();
      },
      up() { canvas.classList.remove('panning'); },
    };
  }

  function startMarquee(e) {
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = additive ? new Set(selection) : new Set();
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX; const sy = e.clientY;
    let moved = false;
    drag = {
      move(ev) {
        if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
        moved = true;
        const x0 = Math.min(sx, ev.clientX) - r.left; const y0 = Math.min(sy, ev.clientY) - r.top;
        const x1 = Math.max(sx, ev.clientX) - r.left; const y1 = Math.max(sy, ev.clientY) - r.top;
        marquee.hidden = false;
        marquee.style.cssText = `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
        const gx0 = (x0 - view.x) / view.k; const gy0 = (y0 - view.y) / view.k;
        const gx1 = (x1 - view.x) / view.k; const gy1 = (y1 - view.y) / view.k;
        const next = new Set(base);
        for (const n of graph.nodes) {
          const s = sizeOf(n);
          if (n.x < gx1 && n.x + s.w > gx0 && n.y < gy1 && n.y + s.h > gy0) next.add(n.id);
        }
        for (const c of graph.comments) {
          if (c.x < gx1 && c.x + c.w > gx0 && c.y < gy1 && c.y + 28 > gy0) next.add(c.id);
        }
        applySelection(next);
      },
      up() {
        marquee.hidden = true;
        if (!moved && !additive) { applySelection(new Set()); setSelLink(null); }
      },
    };
  }

  // Éléments déplacés avec la sélection (un commentaire emporte les nœuds qu'il contient)
  function collectMovers(primaryId) {
    const nodes = new Map();
    const comments = new Map();
    for (const id of selection) {
      const n = nodeIndex.get(id);
      if (n) { nodes.set(id, { o: n, x0: n.x, y0: n.y }); continue; }
      const c = graph.comments.find((k) => k.id === id);
      if (c) {
        comments.set(id, { o: c, x0: c.x, y0: c.y });
        for (const inner of nodesInComment(c)) if (!nodes.has(inner.id)) nodes.set(inner.id, { o: inner, x0: inner.x, y0: inner.y });
      }
    }
    const primary = nodes.get(primaryId) || comments.get(primaryId);
    return { nodes, comments, primary };
  }

  function dragMovers(e, primaryId, onClickOnly) {
    const { nodes, comments, primary } = collectMovers(primaryId);
    const sx = e.clientX; const sy = e.clientY;
    let moved = false;
    let raf = 0;
    let last = null;
    const apply = () => {
      raf = 0;
      if (!last || !primary) return;
      const dx = (last.clientX - sx) / view.k;
      const dy = (last.clientY - sy) / view.k;
      const free = last.altKey;
      const nx = free ? primary.x0 + dx : snap(primary.x0 + dx);
      const ny = free ? primary.y0 + dy : snap(primary.y0 + dy);
      const ddx = nx - primary.x0; const ddy = ny - primary.y0;
      for (const m of nodes.values()) {
        m.o.x = m.x0 + ddx; m.o.y = m.y0 + ddy;
        const ns = nodeStates.get(m.o.id);
        if (ns) ns.el.style.transform = `translate(${m.o.x}px,${m.o.y}px)`;
      }
      for (const m of comments.values()) {
        m.o.x = m.x0 + ddx; m.o.y = m.y0 + ddy;
        const ce = commentEls.get(m.o.id);
        if (ce) commentStyle(m.o, ce);
      }
      redrawLinksOf(nodes.keys());
      scheduleMinimap();
    };
    drag = {
      move(ev) {
        if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 3) return;
        if (!moved) { moved = true; canvas.classList.add('moving'); }
        last = ev;
        if (!raf) raf = requestAnimationFrame(apply);
      },
      up(ev) {
        if (raf) cancelAnimationFrame(raf);
        canvas.classList.remove('moving');
        if (moved) { last = ev; apply(); emit({ keepPanel: true }); } else onClickOnly?.();
      },
    };
  }

  function startNodeDrag(e, node) {
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const was = selection.has(node.id);
    if (!was) {
      if (additive) applySelection(new Set([...selection, node.id])); else selectOnly(node.id);
    }
    dragMovers(e, node.id, () => {
      if (additive) { if (was) { const n = new Set(selection); n.delete(node.id); applySelection(n); } } else selectOnly(node.id);
    });
  }

  function startCommentDrag(e, c) {
    if (!c) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const was = selection.has(c.id);
    if (!was) {
      if (additive) applySelection(new Set([...selection, c.id])); else selectOnly(c.id);
    }
    dragMovers(e, c.id, () => {
      if (additive) { if (was) { const n = new Set(selection); n.delete(c.id); applySelection(n); } } else selectOnly(c.id);
    });
  }

  function startCommentResize(e, c) {
    if (!c) return;
    const sx = e.clientX; const sy = e.clientY; const w0 = c.w; const h0 = c.h;
    drag = {
      move(ev) {
        c.w = Math.max(120, snap(w0 + (ev.clientX - sx) / view.k));
        c.h = Math.max(64, snap(h0 + (ev.clientY - sy) / view.k));
        const ce = commentEls.get(c.id);
        if (ce) commentStyle(c, ce);
        scheduleMinimap();
      },
      up() { emit({ keepPanel: true }); },
    };
  }

  // ------------------------------------------------------------ fils : glisser depuis une broche

  // première broche compatible d'un nœud pour relier `from`
  function autoPin(nodeId, from) {
    const ns = nodeStates.get(nodeId);
    if (!ns) return null;
    const list = [];
    for (const [key, p] of ns.pinMap) {
      const dir = key.startsWith('in:') ? 'in' : 'out';
      list.push({ nodeId, dir, name: p.name, type: p.type });
    }
    const ok = list.filter((p) => canConnect(from, p));
    ok.sort((a, b) => (a.type === from.type ? 0 : 1) - (b.type === from.type ? 0 : 1));
    return ok[0] || null;
  }

  function startWire(e, pin) {
    if (!pin) return;
    if (e.altKey) { cutPin(pin); return; }
    let from = pin;
    // tirer depuis une entrée de données reliée : on reprend le fil existant
    if (pin.dir === 'in' && pin.type !== 'exec') {
      const l = graph.links.find((x) => x.to === pin.nodeId && x.toPin === pin.name);
      if (l) {
        from = { nodeId: l.from, dir: 'out', name: l.fromPin, type: pinTypeOf(l.from, 'out', l.fromPin) || pin.type };
        removeLink(l);
        emit({ keepPanel: true });
      }
    }
    const color = PIN_COLORS[from.type] || '#94b0c2';
    ghost.style.stroke = color;
    ghost.classList.toggle('exec', from.type === 'exec');
    let hover = null;
    const startPt = () => pinPoint(from.nodeId, from.dir, from.name);
    const clearHover = () => { if (hover) { hover.row?.classList.remove('can', 'nope'); hover = null; } };
    const update = (ev) => {
      const a = startPt();
      if (!a) return;
      const g = screenToGraph(ev.clientX, ev.clientY);
      const d = from.dir === 'out' ? linkPath(a, g) : linkPath(g, a);
      ghost.setAttribute('d', d);
      ghost.style.display = '';
      // cible : une broche, ou un nœud (première broche compatible)
      clearHover();
      const t = document.elementFromPoint(ev.clientX, ev.clientY);
      let target = pinFromTarget(t);
      const nodeEl = t?.closest?.('.bp-node');
      if (!target && nodeEl) target = autoPin(nodeEl.dataset.id, from);
      if (target) {
        const row = nodeStates.get(target.nodeId)?.pinEls.get(target.dir + ':' + target.name)?.row;
        const ok = !!canConnect(from, target);
        row?.classList.add(ok ? 'can' : 'nope');
        hover = { row, target, ok };
      }
    };
    update(e);
    drag = {
      move: update,
      up(ev) {
        ghost.style.display = 'none';
        const h = hover;
        clearHover();
        if (h?.ok) { connect(from, h.target); return; }
        if (h) return; // relâché sur une broche incompatible : rien
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        if (t && canvas.contains(t) && !t.closest('.bp-toolbar, .bp-minimap, .bp-status, .bp-node')) {
          const g = screenToGraph(ev.clientX, ev.clientY);
          openPalette({ clientX: ev.clientX, clientY: ev.clientY, gx: g.x, gy: g.y, filterPin: from });
        }
      },
    };
  }

  // ------------------------------------------------------------ palette « Toutes les actions »

  const pinCache = new Map();
  function pinsOfType(type) {
    if (pinCache.has(type)) return pinCache.get(type);
    let pins;
    try { pins = safePins(createNode(type, 0, 0, graph)); } catch { const s = getSpec(type); pins = { inputs: s?.inputs || [], outputs: s?.outputs || [] }; }
    pinCache.set(type, pins);
    return pins;
  }

  function fits(type, from) {
    const pins = pinsOfType(type);
    if (from.dir === 'out') return pins.inputs.some((p) => (from.type === 'exec' ? p.type === 'exec' : p.type !== 'exec' && isCompatible(from.type, p.type)));
    return pins.outputs.some((p) => (from.type === 'exec' ? p.type === 'exec' : p.type !== 'exec' && isCompatible(p.type, from.type)));
  }

  function paletteEntries() {
    const out = [];
    for (const s of listSpecs()) {
      if (ctx.isGlobal && s.selfOnly) continue;
      if (s.dynamic === 'call') {
        for (const d of fnDefs()) {
          const name = d.fields.NAME;
          if (!name) continue;
          out.push({ spec: s, title: s.title + ' ' + name, preset: { name, params: [...(d.extra.params || [])] } });
        }
        continue;
      }
      out.push({ spec: s, title: s.title });
    }
    return out;
  }

  function openPaletteAtCenter() {
    const r = canvas.getBoundingClientRect();
    const cxp = mouse.inside ? mouse.x : r.left + r.width / 2;
    const cyp = mouse.inside ? mouse.y : r.top + r.height / 2;
    const g = screenToGraph(cxp, cyp);
    openPalette({ clientX: cxp, clientY: cyp, gx: g.x, gy: g.y });
  }

  function closePalette() {
    if (!pal) return;
    document.removeEventListener('pointerdown', pal.outside, true);
    pal.el.remove();
    pal = null;
    canvas.focus({ preventScroll: true });
  }

  function openPalette({ clientX, clientY, gx, gy, filterPin = null }) {
    closePalette();
    closeMenu();
    const entries = paletteEntries().filter((en) => !filterPin || fits(en.spec.type, filterPin));
    const box = el('div', 'bp-palette');
    const head = el('div', 'bp-pal-head');
    head.appendChild(el('strong', null, filterPin ? 'Actions compatibles' : 'Toutes les actions'));
    const input = el('input', 'bp-pal-search');
    input.type = 'search';
    input.placeholder = 'Rechercher un nœud…';
    input.spellcheck = false;
    const list = el('div', 'bp-pal-list');
    const desc = el('div', 'bp-pal-desc');
    box.append(head, input, list, desc);

    // groupes par catégorie, dans l'ordre du contrat
    const groups = new Map();
    const order = CATEGORIES.map((c) => c.id);
    for (const en of entries) if (!order.includes(en.spec.category)) order.push(en.spec.category);
    for (const cid of order) {
      const g = { id: cid, collapsed: false, items: [] };
      g.el = el('div', 'bp-pal-group');
      g.head = el('div', 'bp-pal-ghead');
      g.head.style.setProperty('--gc', catColors[cid] || FALLBACK_COLOR);
      g.head.append(el('span', 'bp-pal-chev', '▾'), el('span', null, catLabels[cid] || cid));
      g.body = el('div', 'bp-pal-items');
      g.el.append(g.head, g.body);
      g.head.onclick = () => { g.collapsed = !g.collapsed; render(); };
      groups.set(cid, g);
    }
    for (const en of entries) {
      const g = groups.get(en.spec.category);
      const it = el('div', 'bp-pal-item');
      it.style.setProperty('--gc', en.spec.kind === 'event' && en.spec.category === 'event' ? EVENT_COLOR : (catColors[en.spec.category] || FALLBACK_COLOR));
      it.append(el('span', 'bp-pal-dot'), el('span', 'bp-pal-name', en.title));
      if (en.spec.kind === 'pure') it.appendChild(el('span', 'bp-pal-tag', 'valeur'));
      en.el = it;
      en.hay = norm(en.title + ' ' + (en.spec.keywords || '') + ' ' + (catLabels[en.spec.category] || '') + ' ' + en.spec.type);
      en.group = g;
      it.onmouseenter = () => setActive(en);
      it.onpointerdown = (ev) => { ev.preventDefault(); pick(en); };
      g.items.push(en);
      g.body.appendChild(it);
    }
    for (const g of groups.values()) if (g.items.length) list.appendChild(g.el);

    let visible = [];
    let active = null;
    const setActive = (en) => {
      active?.el.classList.remove('active');
      active = en;
      if (en) { en.el.classList.add('active'); en.el.scrollIntoView({ block: 'nearest' }); desc.textContent = en.spec.tooltip || ''; } else desc.textContent = '';
    };
    function render() {
      const toks = norm(input.value).split(/\s+/).filter(Boolean);
      const q = norm(input.value).trim();
      visible = [];
      for (const g of groups.values()) {
        let any = false;
        for (const en of g.items) {
          const ok = toks.every((t) => en.hay.includes(t));
          en.match = ok;
          if (ok) any = true;
        }
        const collapsed = g.collapsed && !toks.length;
        g.el.hidden = !any;
        g.el.classList.toggle('collapsed', collapsed);
        g.head.firstChild.textContent = collapsed ? '▸' : '▾';
        // dans un groupe, les titres qui commencent par la recherche passent d'abord
        const ordered = q ? [...g.items].sort((a, b) => (norm(a.title).startsWith(q) ? 0 : 1) - (norm(b.title).startsWith(q) ? 0 : 1)) : g.items;
        for (const en of ordered) {
          g.body.appendChild(en.el);
          en.el.hidden = !en.match || collapsed;
          if (en.match && !collapsed) visible.push(en);
        }
      }
      setActive(visible.includes(active) ? active : visible[0] || null);
    }

    function pick(en) {
      closePalette();
      const node = addNodeOfType(en.spec.type, gx, gy - (filterPin?.dir === 'out' ? 28 : 0), (n) => {
        if (en.preset) { n.extra = { ...n.extra, ...en.preset }; }
      });
      if (!node) return;
      if (filterPin) {
        const ns = nodeStates.get(node.id);
        if (filterPin.dir === 'in') node.x = snap(gx - (ns?.w || 180));
        ns.el.style.transform = `translate(${node.x}px,${node.y}px)`;
        const target = autoPin(node.id, filterPin);
        if (target) connect(filterPin, target);
      }
      selectOnly(node.id);
      emit();
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      const i = visible.indexOf(active);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(visible[Math.min(visible.length - 1, i + 1)] || null); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(visible[Math.max(0, i - 1)] || null); } else if (ev.key === 'Enter') { ev.preventDefault(); if (active) pick(active); } else if (ev.key === 'Escape') { ev.preventDefault(); closePalette(); }
    });

    canvas.appendChild(box);
    const r = canvas.getBoundingClientRect();
    const w = 300;
    const h = Math.min(440, r.height - 16);
    box.style.width = w + 'px';
    box.style.maxHeight = h + 'px';
    box.style.left = clamp(clientX - r.left, 8, Math.max(8, r.width - w - 8)) + 'px';
    box.style.top = clamp(clientY - r.top, 8, Math.max(8, r.height - h - 8)) + 'px';

    pal = {
      el: box,
      outside: (ev) => { if (!box.contains(ev.target)) closePalette(); },
    };
    document.addEventListener('pointerdown', pal.outside, true);
    render();
    input.focus();
  }

  // ------------------------------------------------------------ documentation et aide des nœuds

  let docPopup = null;
  function closeNodeDoc() {
    if (!docPopup) return;
    document.removeEventListener('pointerdown', docPopup.outside, true);
    docPopup.el.remove();
    docPopup = null;
  }

  function openNodeDoc(spec, clientX, clientY) {
    closeNodeDoc();
    closeMenu();
    closePalette();
    const box = el('div', 'bp-doc-popup');
    const head = el('div', 'bp-doc-head');
    head.append(el('strong', null, spec.title), el('span', 'bp-doc-type', spec.type));
    const closeBtn = el('button', 'bp-mini', '×');
    closeBtn.onclick = () => closeNodeDoc();
    head.appendChild(closeBtn);

    const body = el('div', 'bp-doc-body');
    if (spec.tooltip) body.appendChild(el('p', 'bp-doc-desc', spec.tooltip));
    if (spec.inputs?.length) {
      const sec = el('div', 'bp-doc-sec', 'Entrées :');
      for (const p of spec.inputs) {
        sec.appendChild(el('div', 'bp-doc-pin', `${p.name} (${TYPE_NAMES[p.type] || p.type})${p.default !== undefined ? ' = ' + JSON.stringify(p.default) : ''}`));
      }
      body.appendChild(sec);
    }
    if (spec.outputs?.length) {
      const sec = el('div', 'bp-doc-sec', 'Sorties :');
      for (const p of spec.outputs) {
        sec.appendChild(el('div', 'bp-doc-pin', `${p.name} (${TYPE_NAMES[p.type] || p.type})`));
      }
      body.appendChild(sec);
    }
    box.append(head, body);
    canvas.appendChild(box);
    const r = canvas.getBoundingClientRect();
    const x = clientX != null ? clientX - r.left : r.width / 2 - 140;
    const y = clientY != null ? clientY - r.top : r.height / 2 - 100;
    box.style.left = clamp(x, 8, Math.max(8, r.width - 290)) + 'px';
    box.style.top = clamp(y, 8, Math.max(8, r.height - 240)) + 'px';

    docPopup = { el: box, outside: (ev) => { if (!box.contains(ev.target)) closeNodeDoc(); } };
    setTimeout(() => document.addEventListener('pointerdown', docPopup.outside, true), 10);
  }

  // ------------------------------------------------------------ menu contextuel

  function closeMenu() {
    if (!menu) return;
    document.removeEventListener('pointerdown', menu.outside, true);
    menu.el.remove();
    menu = null;
  }

  function openMenu(clientX, clientY, items) {
    closeMenu();
    closePalette();
    closeNodeDoc();
    const box = el('div', 'bp-menu');
    for (const it of items) {
      if (it.sep) { box.appendChild(el('div', 'bp-menu-sep')); continue; }
      const b = el('button', 'bp-menu-item', it.label);
      b.disabled = !!it.disabled;
      b.onclick = () => { closeMenu(); it.fn(); };
      box.appendChild(b);
    }
    canvas.appendChild(box);
    const r = canvas.getBoundingClientRect();
    box.style.left = clamp(clientX - r.left, 4, Math.max(4, r.width - box.offsetWidth - 4)) + 'px';
    box.style.top = clamp(clientY - r.top, 4, Math.max(4, r.height - box.offsetHeight - 4)) + 'px';
    menu = { el: box, outside: (ev) => { if (!box.contains(ev.target)) closeMenu(); } };
    document.addEventListener('pointerdown', menu.outside, true);
  }

  function onContextMenu(e) {
    e.preventDefault();
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
    const t = e.target;
    if (t.closest('.bp-palette, .bp-menu, .bp-toolbar, .bp-minimap, .bp-doc-popup')) return;
    if (panMoved) { panMoved = false; return; }
    const pinRow = !t.closest('.bp-lit') ? t.closest('.bp-pin') : null;
    if (pinRow?.__pin) {
      const p = pinRow.__pin;
      const has = (linksByNode.get(p.nodeId) || new Set()).size > 0
        && [...linksByNode.get(p.nodeId)].some((l) => (p.dir === 'in' ? l.to === p.nodeId && l.toPin === p.name : l.from === p.nodeId && l.fromPin === p.name));
      openMenu(e.clientX, e.clientY, [{ label: 'Couper les liens', disabled: !has, fn: () => cutPin(p) }]);
      return;
    }
    const wire = t.closest('.bp-wire');
    if (wire) {
      openMenu(e.clientX, e.clientY, [{ label: 'Couper le lien', fn: () => { removeLink(wire.__link); emit({ keepPanel: true }); } }]);
      return;
    }
    const nodeEl = t.closest('.bp-node');
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (!selection.has(id)) selectOnly(id);
      const spec = getSpec(nodeIndex.get(id)?.type);
      openMenu(e.clientX, e.clientY, [
        ...(spec ? [{ label: `Fiche d'aide (?)`, fn: () => openNodeDoc(spec, e.clientX, e.clientY) }, { sep: true }] : []),
        { label: 'Dupliquer', fn: () => duplicate() },
        { label: 'Commenter la sélection', fn: () => commentSelection() },
        { label: 'Couper tous les liens', fn: () => cutNodeLinks([...selection].filter((x) => nodeIndex.has(x))) },
        { sep: true },
        { label: 'Supprimer', fn: () => deleteSelection() },
      ]);
      return;
    }
    const chead = t.closest('.bp-comment-head');
    if (chead) {
      const id = chead.parentNode.dataset.id;
      const c = graph.comments.find((k) => k.id === id);
      if (!selection.has(id)) selectOnly(id);
      openMenu(e.clientX, e.clientY, [
        { label: 'Renommer', fn: () => c && editCommentTitle(c) },
        { label: 'Supprimer le commentaire', fn: () => deleteSelection() },
      ]);
      return;
    }
    const g = screenToGraph(e.clientX, e.clientY);
    openPalette({ clientX: e.clientX, clientY: e.clientY, gx: g.x, gy: g.y });
  }

  function cutNodeLinks(ids) {
    let any = false;
    for (const id of ids) for (const l of [...(linksByNode.get(id) || [])]) { removeLink(l, { quiet: true }); any = true; }
    if (any) emit({ keepPanel: true });
  }

  // ------------------------------------------------------------ copier / coller / dupliquer

  function copySelection() {
    const ids = new Set([...selection].filter((id) => nodeIndex.has(id) && nodeIndex.get(id).type !== 'fn_def'));
    const cs = graph.comments.filter((c) => selection.has(c.id));
    if (!ids.size && !cs.length) return false;
    clipboard = {
      nodes: clone(graph.nodes.filter((n) => ids.has(n.id))),
      links: clone(graph.links.filter((l) => ids.has(l.from) && ids.has(l.to))),
      comments: clone(cs),
    };
    return true;
  }

  function paste(at) {
    if (!clipboard) return;
    const data = clone(clipboard);
    let x0 = Infinity; let y0 = Infinity;
    for (const n of data.nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); }
    for (const c of data.comments) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); }
    if (x0 === Infinity) return;
    const ox = at ? snap(at.x) - x0 : 32;
    const oy = at ? snap(at.y) - y0 : 32;
    const map = new Map();
    const added = new Set();
    for (const n of data.nodes) {
      const old = n.id;
      n.id = uid('n');
      map.set(old, n.id);
      n.x += ox; n.y += oy;
      addNodeData(n);
      added.add(n.id);
    }
    for (const l of data.links) {
      if (!map.has(l.from) || !map.has(l.to)) continue;
      const nl = { ...l, id: uid('l'), from: map.get(l.from), to: map.get(l.to) };
      graph.links.push(nl);
      indexLink(nl);
    }
    for (const id of added) updateLinked(id);
    for (const id of added) redrawLinksOf([id]);
    for (const c of data.comments) {
      c.id = uid('c');
      c.x += ox; c.y += oy;
      graph.comments.push(c);
      createCommentEl(c);
      added.add(c.id);
    }
    applySelection(added);
    emit();
  }

  function pasteAtMouse() {
    paste(mouse.inside ? screenToGraph(mouse.x, mouse.y) : null);
  }

  function duplicate() {
    if (copySelection()) paste(null);
  }

  // ------------------------------------------------------------ fonctions et variables du graphe

  function fnDefs() { return graph.nodes.filter((n) => n.type === 'fn_def'); }

  function varFieldOf(spec) {
    return (spec?.fields || []).find((f) => f.kind === 'variable');
  }

  function askIdent(message, initial, taken) {
    let value = initial;
    for (;;) {
      const r = prompt(message, value);
      if (r == null) return null;
      value = r.trim();
      if (!NAME_RE.test(value)) { alert('Le nom doit commencer par une lettre ou « _ » et ne contenir que des lettres, chiffres et « _ ».'); continue; }
      if (taken.includes(value)) { alert('Ce nom existe déjà.'); continue; }
      return value;
    }
  }

  function viewCenter() {
    return screenToGraph(canvas.getBoundingClientRect().left + canvas.clientWidth / 2, canvas.getBoundingClientRect().top + canvas.clientHeight / 2);
  }

  function addFunction() {
    const spec = getSpec('fn_def');
    if (!spec) { alert('Le nœud « fn_def » n’existe pas dans le catalogue.'); return; }
    const names = fnDefs().map((d) => d.fields.NAME);
    let base = 'fonction';
    for (let i = 2; names.includes(base); i++) base = 'fonction' + i;
    const name = askIdent('Nom de la fonction :', base, names);
    if (!name) return;
    const c = viewCenter();
    const node = addNodeOfType('fn_def', c.x - 100, c.y - 60, (n) => {
      n.fields.NAME = name;
      n.extra = { ...n.extra, params: n.extra.params || [] };
    });
    if (!node) return;
    selectOnly(node.id);
    emit();
  }

  function syncCalls(oldName, def) {
    for (const n of graph.nodes) {
      if (getSpec(n.type)?.dynamic !== 'call' || n.extra.name !== oldName) continue;
      n.extra.name = def.fields.NAME;
      n.extra.params = [...(def.extra.params || [])];
      refreshNode(n.id, { prune: true });
    }
  }

  function renameFunction(def) {
    const names = fnDefs().map((d) => d.fields.NAME).filter((n) => n !== def.fields.NAME);
    const name = askIdent('Nouveau nom de la fonction :', def.fields.NAME, names);
    if (!name || name === def.fields.NAME) return;
    const old = def.fields.NAME;
    def.fields.NAME = name;
    refreshNode(def.id);
    syncCalls(old, def);
    emit();
  }

  function editParams(def) {
    const cur = (def.extra.params || []).join(', ');
    const r = prompt('Paramètres de la fonction (séparés par des virgules) :', cur);
    if (r == null) return;
    const list = r.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.some((p, i) => !NAME_RE.test(p) || list.indexOf(p) !== i)) { alert('Paramètres invalides : lettres, chiffres, « _ », sans doublon.'); return; }
    def.extra.params = list;
    refreshNode(def.id, { prune: true });
    syncCalls(def.fields.NAME, def);
    emit();
  }

  function deleteFunction(def) {
    if (!confirm(`Supprimer la fonction « ${def.fields.NAME} » ?`)) return;
    selection.delete(def.id);
    removeNodes([def.id]);
    emit();
  }

  function addVariable() {
    const names = graph.variables.map((v) => v.name);
    let base = 'compteur';
    for (let i = 2; names.includes(base); i++) base = 'compteur' + i;
    const name = askIdent('Nom de la variable :', base, names);
    if (!name) return;
    graph.variables.push({ name, default: 0 });
    emit();
  }

  function renameVariable(v) {
    const name = askIdent('Nouveau nom de la variable :', v.name, graph.variables.map((x) => x.name).filter((n) => n !== v.name));
    if (!name || name === v.name) return;
    const old = v.name;
    v.name = name;
    for (const n of graph.nodes) {
      const f = varFieldOf(getSpec(n.type));
      if (f && n.fields[f.name] === old) { n.fields[f.name] = name; refreshNode(n.id); }
    }
    emit();
  }

  function deleteVariable(v) {
    if (!confirm(`Supprimer la variable « ${v.name} » ? Les nœuds qui l'utilisent resteront dans le graphe.`)) return;
    graph.variables.splice(graph.variables.indexOf(v), 1);
    emit();
  }

  function addVarNode(kind, name, gx, gy) {
    const type = { get: 'var_get', set: 'var_set', change: 'var_change' }[kind];
    const spec = getSpec(type);
    if (!spec) return;
    const f = varFieldOf(spec);
    const node = addNodeOfType(type, gx, gy, (n) => { if (f) n.fields[f.name] = name; });
    if (node) { selectOnly(node.id); emit(); }
  }

  canvas.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('application/x-pf-var')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  });
  canvas.addEventListener('drop', (e) => {
    const name = e.dataTransfer?.getData('application/x-pf-var');
    if (!name) return;
    e.preventDefault();
    const g = screenToGraph(e.clientX, e.clientY);
    if (e.ctrlKey) { addVarNode('get', name, g.x, g.y); return; }
    if (e.altKey) { addVarNode('set', name, g.x, g.y); return; }
    openMenu(e.clientX, e.clientY, [
      { label: `Obtenir « ${name} »`, fn: () => addVarNode('get', name, g.x, g.y) },
      { label: `Définir « ${name} »`, fn: () => addVarNode('set', name, g.x, g.y) },
      { label: `Modifier « ${name} » (+=)`, disabled: !getSpec('var_change'), fn: () => addVarNode('change', name, g.x, g.y) },
    ]);
  });

  // ------------------------------------------------------------ panneau « Mon Blueprint »

  let panelSig = null;
  let panelCollapsed = false;
  const panelHead = el('div', 'bp-panel-head');
  const panelTitle = el('span', 'bp-panel-title', 'Mon Blueprint');
  const panelToggle = btn('«', 'Replier le panneau', () => {
    panelCollapsed = !panelCollapsed;
    panel.classList.toggle('collapsed', panelCollapsed);
    panelToggle.textContent = panelCollapsed ? '»' : '«';
    panelToggle.title = panelCollapsed ? 'Déplier le panneau' : 'Replier le panneau';
  }, 'bp-mini');
  panelHead.append(panelTitle, panelToggle);
  if (host.clientWidth && host.clientWidth < 760) panelToggle.click(); // zone étroite : panneau replié au départ
  const panelBody = el('div', 'bp-panel-body');
  panel.append(panelHead, panelBody);

  function panelSignature() {
    const ev = graph.nodes.filter((n) => isEventNode(n)).map((n) => [n.id, eventLabel(n)]);
    return JSON.stringify([ev, fnDefs().map((d) => [d.id, d.fields.NAME, d.extra.params]), graph.variables]);
  }

  function isEventNode(n) { const s = getSpec(n.type); return s?.kind === 'event' && n.type !== 'fn_def'; }

  function eventLabel(n) {
    const s = getSpec(n.type);
    const vals = (s.fields || []).map((f) => n.fields[f.name]).filter((v) => v != null && v !== '');
    return s.title + (vals.length ? ' · ' + vals.join(' ') : '');
  }

  function section(title, onAdd, addTitle) {
    const sec = el('div', 'bp-sec');
    const h = el('div', 'bp-sec-head');
    h.appendChild(el('span', null, title));
    if (onAdd) h.appendChild(btn('+', addTitle, onAdd, 'bp-mini'));
    sec.appendChild(h);
    panelBody.appendChild(sec);
    return sec;
  }

  function refreshPanel(force) {
    if (!graph) return;
    const sig = panelSignature();
    if (!force && sig === panelSig) return;
    panelSig = sig;
    panelBody.textContent = '';

    const evs = section('Événements');
    const events = graph.nodes.filter((n) => isEventNode(n));
    if (!events.length) evs.appendChild(el('div', 'bp-sec-empty', 'Aucun événement'));
    for (const n of events) {
      const row = el('div', 'bp-row');
      row.appendChild(el('span', 'bp-row-dot ev'));
      row.appendChild(el('span', 'bp-row-name', eventLabel(n)));
      row.onclick = () => focusNode(n.id);
      evs.appendChild(row);
    }

    const fns = section('Fonctions', addFunction, 'Ajouter une fonction');
    const defs = fnDefs();
    if (!defs.length) fns.appendChild(el('div', 'bp-sec-empty', 'Aucune fonction'));
    for (const d of defs) {
      const row = el('div', 'bp-row');
      row.appendChild(el('span', 'bp-row-dot fn'));
      const name = el('span', 'bp-row-name', `${d.fields.NAME || '?'}(${(d.extra.params || []).join(', ')})`);
      row.append(name,
        btn('Editer', 'Renommer', (e) => { e.stopPropagation(); renameFunction(d); }, 'bp-mini'),
        btn('Options', 'Paramètres', (e) => { e.stopPropagation(); editParams(d); }, 'bp-mini'),
        btn('×', 'Supprimer', (e) => { e.stopPropagation(); deleteFunction(d); }, 'bp-mini danger'));
      row.onclick = () => focusNode(d.id);
      fns.appendChild(row);
    }

    const vars = section('Variables', addVariable, 'Ajouter une variable');
    if (!graph.variables.length) vars.appendChild(el('div', 'bp-sec-empty', 'Aucune variable'));
    else vars.appendChild(el('div', 'bp-sec-note', 'Glisser une variable sur le graphe'));
    for (const v of graph.variables) {
      const row = el('div', 'bp-row bp-var');
      row.draggable = true;
      row.ondragstart = (e) => { e.dataTransfer.setData('application/x-pf-var', v.name); e.dataTransfer.setData('text/plain', v.name); e.dataTransfer.effectAllowed = 'copy'; };
      row.appendChild(el('span', 'bp-row-dot var'));
      row.appendChild(el('span', 'bp-row-name', v.name));
      const def = el('input', 'bp-var-default');
      def.value = v.default ?? '';
      def.title = 'Valeur par défaut';
      def.onclick = (e) => e.stopPropagation();
      def.onkeydown = (e) => e.stopPropagation();
      def.oninput = () => { v.default = parseLiteral(def.value); emit({ keepPanel: true }); };
      def.draggable = false;
      row.append(def,
        btn('Editer', 'Renommer', (e) => { e.stopPropagation(); renameVariable(v); }, 'bp-mini'),
        btn('×', 'Supprimer', (e) => { e.stopPropagation(); deleteVariable(v); }, 'bp-mini danger'));
      vars.appendChild(row);
    }
  }

  // ------------------------------------------------------------ mini-carte

  let mmQueued = false;
  let mmMap = null;
  function scheduleMinimap() {
    if (mmQueued || mm.hidden || disposed) return;
    mmQueued = true;
    requestAnimationFrame(drawMinimap);
  }

  function drawMinimap() {
    mmQueued = false;
    if (mm.hidden || disposed || !graph) return;
    const c = mm.getContext('2d');
    const W = mm.width; const H = mm.height;
    c.clearRect(0, 0, W, H);
    const vw = canvas.clientWidth / view.k; const vh = canvas.clientHeight / view.k;
    const vx = -view.x / view.k; const vy = -view.y / view.k;
    const b = boundsOf(null) || { x0: vx, y0: vy, x1: vx + vw, y1: vy + vh };
    const x0 = Math.min(b.x0, vx) - 40; const y0 = Math.min(b.y0, vy) - 40;
    const x1 = Math.max(b.x1, vx + vw) + 40; const y1 = Math.max(b.y1, vy + vh) + 40;
    const s = Math.min(W / (x1 - x0), H / (y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2 - x0 * s;
    const oy = (H - (y1 - y0) * s) / 2 - y0 * s;
    mmMap = { s, ox, oy };
    for (const cm of graph.comments) {
      c.fillStyle = cm.color || COMMENT_COLORS[0];
      c.globalAlpha = 0.25;
      c.fillRect(cm.x * s + ox, cm.y * s + oy, cm.w * s, cm.h * s);
    }
    c.globalAlpha = 1;
    for (const n of graph.nodes) {
      const sp = nodeStates.get(n.id)?.spec;
      const sz = sizeOf(n);
      c.fillStyle = sp?.kind === 'event' && sp.category === 'event' ? EVENT_COLOR : sp?.kind === 'pure' ? PURE_COLOR : (catColors[sp?.category] || FALLBACK_COLOR);
      c.fillRect(n.x * s + ox, n.y * s + oy, Math.max(2, sz.w * s), Math.max(2, sz.h * s));
    }
    c.strokeStyle = '#ffcd75';
    c.lineWidth = 1.5;
    c.strokeRect(vx * s + ox, vy * s + oy, vw * s, vh * s);
  }

  mm.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const go = (ev) => {
      if (!mmMap) return;
      const r = mm.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (mm.width / r.width);
      const py = (ev.clientY - r.top) * (mm.height / r.height);
      centerOn((px - mmMap.ox) / mmMap.s, (py - mmMap.oy) / mmMap.s);
    };
    go(e);
    drag = { move: go };
  });

  // ------------------------------------------------------------ clavier

  function onKeyDown(e) {
    if (disposed || !root.isConnected || root.offsetParent === null) return;
    const ae = document.activeElement;
    const typing = ae && ((ae.tagName === 'INPUT' && !['checkbox', 'color', 'range', 'button'].includes(ae.type)) || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    if (typing) return;
    if (!mouse.inside && !root.contains(ae)) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (key === 'Escape') { closeMenu(); closePalette(); closeNodeDoc(); return; }
    if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (mod && !e.altKey) {
      const k = key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (k === 'c') { if (copySelection()) e.preventDefault(); } else if (k === 'v') { if (clipboard) { e.preventDefault(); pasteAtMouse(); } } else if (k === 'd') { e.preventDefault(); duplicate(); } else if (k === 'a') { e.preventDefault(); applySelection(new Set([...graph.nodes.map((n) => n.id), ...graph.comments.map((c) => c.id)])); }
      return;
    }
    if (e.altKey) return;
    if (key === ' ' || key === 'Tab') { e.preventDefault(); openPaletteAtCenter(); return; }
    const k = key.toLowerCase();
    if (k === 'f') { e.preventDefault(); frame(); } else if (k === 'home') { e.preventDefault(); home(); } else if (k === 'c') { e.preventDefault(); commentSelection(); }
  }

  // ------------------------------------------------------------ branchement des événements

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; });
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; });
  canvas.addEventListener('wheel', (e) => {
    if (e.target.closest('.bp-palette, .bp-menu')) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX, e.clientY, view.k * Math.exp(-dy * 0.0015));
  }, { passive: false });
  window.addEventListener('pointermove', windowMove);
  window.addEventListener('pointerup', windowUp);
  window.addEventListener('pointercancel', windowUp);
  document.addEventListener('keydown', onKeyDown);

  const canvasRO = new ResizeObserver(() => {
    if (disposed) return;
    canvas.classList.toggle('bp-narrow', canvas.clientWidth < 460);
    if (pendingFrame && canvas.clientWidth > 0) { pendingFrame = false; initialView(); }
    scheduleMinimap();
  });
  canvasRO.observe(canvas);

  // ------------------------------------------------------------ API publique

  function initialView() {
    const mem = viewMemory.get(viewKey);
    if (mem) { Object.assign(view, mem); applyView(); return; }
    if (graph.nodes.length || graph.comments.length) {
      // cadre le contenu sans trop dézoomer
      frame(new Set([...graph.nodes.map((n) => n.id), ...graph.comments.map((c) => c.id)]), 1);
    } else {
      view.k = 1; view.x = 80; view.y = 80;
      applyView();
    }
  }

  function setGraph(g) {
    closePalette();
    closeMenu();
    closeNodeDoc();
    graph = normalize(g);
    pinCache.clear();
    selection.clear();
    selLink = null;
    panelSig = null;
    diagByNode = new Map();
    renderAll();
    if (canvas.clientWidth > 0) initialView(); else { pendingFrame = true; applyView(); }
    if (!isRestoringHistory) {
      undoStack.length = 0;
      redoStack.length = 0;
      if (graph) undoStack.push(JSON.stringify(graph));
    }
  }

  function focusNode(id) {
    const n = nodeIndex.get(id);
    if (!n) return;
    selectOnly(id);
    const s = sizeOf(n);
    centerOn(n.x + s.w / 2, n.y + s.h / 2);
    const e = nodeStates.get(id)?.el;
    if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 1200); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    closePalette();
    closeMenu();
    closeNodeDoc();
    window.removeEventListener('pointermove', windowMove);
    window.removeEventListener('pointerup', windowUp);
    window.removeEventListener('pointercancel', windowUp);
    document.removeEventListener('keydown', onKeyDown);
    nodeRO.disconnect();
    canvasRO.disconnect();
    root.remove();
  }

  setGraph(getGraph ? getGraph() : null);

  return { setGraph, getGraph: () => graph, focusNode, setDiagnostics, undo, redo, dispose };
}
