// Schéma du projet : voir docs/ARCHITECTURE.md
import { compileGraph, blocklyToGraph } from '../graph/index.js';

export const PROJECT_VERSION = 1;

// Palette « Sweetie 16 »
export const DEFAULT_PALETTE = [
  '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
  '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
];

export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

export const emptyGraph = () => ({ version: 1, nodes: [], links: [], variables: [], comments: [] });

// Script vide : un Blueprint sans nœud
export function emptyScript() {
  return { mode: 'graph', code: '', graph: emptyGraph() };
}

// Normalise un script chargé (objet ou global). Ancien format Blockly (mode 'blocks') : converti en graphe et recompilé
// (le code enregistré par Blockly peut être faux, la conversion le répare) ; sans blocs mais avec du code → mode 'code' ; vide → graphe vide.
export function normalizeScript(s, isGlobal = false) {
  if (!s || typeof s !== 'object') return emptyScript();
  const blocks = s.blocks;
  delete s.blocks;
  if (typeof s.code !== 'string') s.code = '';
  if (s.mode === 'graph') {
    if (!s.graph || typeof s.graph !== 'object') s.graph = emptyGraph();
  } else if (s.mode !== 'code') {
    const top = blocks?.blocks?.blocks ?? blocks?.blocks;
    const hasBlocks = Array.isArray(top) && top.length > 0;
    if (hasBlocks) {
      let graph;
      try { graph = blocklyToGraph(blocks); } catch (e) { console.error('Conversion des blocs impossible :', e); graph = emptyGraph(); }
      s.graph = graph;
      s.mode = 'graph';
      s.code = compileGraph(graph, { isGlobal }).code;
    } else if (s.code.trim()) {
      s.mode = 'code';
    } else {
      s.mode = 'graph';
      s.graph = emptyGraph();
    }
  }
  return s;
}

export function blankFrame(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c.toDataURL('image/png');
}

export function createSprite(name = 'Sprite', width = 16, height = 16) {
  return {
    id: uid('spr'), name, width, height,
    frames: [blankFrame(width, height)],
    animations: [{ name: 'idle', frames: [0], fps: 6, loop: true }],
  };
}

export function createObject(name = 'Objet', spriteId = null) {
  return {
    id: uid('obj'), name, spriteId, defaultAnim: 'idle', hitbox: null,
    physics: { enabled: true, gravity: true, immovable: false, bounce: 0, collideMap: true, collideWorld: true },
    script: emptyScript(),
    exportedProps: [],
  };
}

export function createLayer(name, width, height, collides = false, oneWay = false, scrollFactor = 1) {
  return { id: uid('lay'), name, data: new Array(width * height).fill(-1), collides, oneWay: !!oneWay, scrollFactor: scrollFactor ?? 1, visible: true, depth: 'below' };
}

export function slugify(text) {
  return (text || 'jeu').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jeu';
}

export function createMeta(name) {
  const now = new Date().toISOString();
  return { id: slugify(name) + '-' + Math.random().toString(36).slice(2, 6), description: '', author: '', thumbnail: null, createdAt: now, updatedAt: now };
}

export function createMap(name = 'Carte', width = 40, height = 12, tileSize = 16) {
  return {
    id: uid('map'), name, width, height, tileSize,
    tilesetSpriteId: null,
    background: '#1a1c2c',
    layers: [createLayer('Décor', width, height, false), createLayer('Sol', width, height, true)],
    entities: [],
  };
}

export function createEmptyProject(name = 'Mon jeu') {
  const map = createMap('Niveau 1');
  return {
    version: PROJECT_VERSION,
    name,
    meta: createMeta(name),
    settings: { width: 320, height: 180, pixelZoom: 3, tileSize: 16, background: '#1a1c2c', startMapId: map.id, gravity: 800, touchControls: true },
    palette: [...DEFAULT_PALETTE],
    sprites: [],
    sounds: [],
    objects: [],
    maps: [map],
    globalScript: emptyScript(),
  };
}

// Complète un projet chargé (anciens fichiers, champs manquants)
export function normalizeProject(p) {
  const base = createEmptyProject(p.name || 'Mon jeu');
  p.version = PROJECT_VERSION;
  p.settings = { ...base.settings, ...(p.settings || {}) };
  p.palette = p.palette?.length ? p.palette : base.palette;
  p.meta = { ...base.meta, ...(p.meta || {}) };
  p.sprites = (p.sprites || []).map((s) => ({ folder: '', ...s }));
  p.sounds = (p.sounds || []).map((s) => ({ folder: '', ...s }));
  p.objects = (p.objects || []).map((o) => {
    const obj = { folder: '', exportedProps: [], ...createObject(o.name), ...o, physics: { ...createObject().physics, ...(o.physics || {}) } };
    obj.script = normalizeScript(o.script, false);
    obj.exportedProps = Array.isArray(o.exportedProps) ? o.exportedProps : [];
    return obj;
  });
  p.maps = p.maps?.length ? p.maps : base.maps;
  for (const m of p.maps) {
    if (m.folder === undefined) m.folder = '';
    for (const l of m.layers || []) {
      l.depth = l.depth || 'below';
      if (l.oneWay === undefined) l.oneWay = false;
      if (l.scrollFactor === undefined) l.scrollFactor = 1;
    }
    for (const e of m.entities || []) e.props = e.props || {};
  }
  p.globalScript = normalizeScript(p.globalScript, true);
  if (!p.maps.some((m) => m.id === p.settings.startMapId)) p.settings.startMapId = p.maps[0].id;
  return p;
}

export const findById = (list, id) => list.find((x) => x.id === id) || null;
export const findByName = (list, name) => list.find((x) => x.name === name) || null;
