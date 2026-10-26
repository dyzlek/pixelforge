// Schéma du projet : voir docs/ARCHITECTURE.md
import { compileGraph, blocklyToGraph } from '../graph/index.js';
import { unpackProjectVoxels } from './compression.js';

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

export function createModel(name = 'Modele', width = 8, height = 8, depth = 8) {
  return {
    id: uid('model'),
    name,
    type: 'voxel',
    width,
    height,
    depth,
    voxels: {},
    animations: [],
  };
}

export function createScene3D(name = 'Scene 3D') {
  return {
    id: uid('scene3d'),
    name,
    environment: {
      skyColor: '#1a1c2c',
      fog: { enabled: false, color: '#1a1c2c', density: 0.04 },
      ambientLight: { color: '#ffffff', intensity: 0.6 },
      directionalLight: { color: '#ffeedd', intensity: 1.0, position: [10, 20, 15] },
    },
    gridmap: {
      blockSize: 1,
      blocks: {},
    },
    entities: [],
  };
}

export function createSong(name = 'Musique') {
  const chLead = {
    id: uid('ch'),
    name: 'Lead',
    instrument: 'pulse50',
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    drumKit: false,
    env: { a: 0.005, d: 0.1, s: 0.6, r: 0.08 },
    vibrato: { depth: 0, rate: 6 },
    arp: [],
  };
  const chBass = {
    id: uid('ch'),
    name: 'Basse',
    instrument: 'triangle',
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    drumKit: false,
    env: { a: 0.01, d: 0.15, s: 0.7, r: 0.1 },
    vibrato: { depth: 0, rate: 6 },
    arp: [],
  };
  const chDrums = {
    id: uid('ch'),
    name: 'Batterie',
    instrument: 'noise',
    drumKit: true,
    volume: 0.7,
    pan: 0,
    mute: false,
    solo: false,
    env: { a: 0.001, d: 0.08, s: 0, r: 0.05 },
    vibrato: { depth: 0, rate: 6 },
    arp: [],
  };

  const pattern = {
    id: uid('pat'),
    name: 'Pattern 1',
    length: 16,
    notes: [],
  };

  return {
    id: uid('sng'),
    name,
    folder: '',
    bpm: 130,
    channels: [chLead, chBass, chDrums],
    patterns: [pattern],
    playlist: [{ pattern: pattern.id, track: 0, start: 0 }],
    loop: { enabled: true, start: 0, end: 16 },
  };
}

export function createEmptyProject(name = 'Mon jeu') {
  const map = createMap('Niveau 1');
  return {
    version: PROJECT_VERSION,
    name,
    meta: createMeta(name),
    settings: { width: 320, height: 180, pixelZoom: 3, tileSize: 16, background: '#1a1c2c', startMapId: map.id, gravity: 800, touchControls: true, dimension: '2d' },
    palette: [...DEFAULT_PALETTE],
    sprites: [],
    sounds: [],
    songs: [],
    models: [],
    materials: [],
    scenes3d: [],
    environment: {
      skyColor: '#1a1c2c',
      fog: { enabled: false, color: '#1a1c2c', density: 0.04 },
      ambientLight: { color: '#ffffff', intensity: 0.6 },
      directionalLight: { color: '#ffeedd', intensity: 1.0, position: [10, 20, 15] },
    },
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
  p.songs = (p.songs || []).map((s) => {
    const song = {
      folder: '',
      bpm: 130,
      channels: [],
      patterns: [],
      playlist: [],
      loop: { enabled: true, start: 0, end: 16 },
      ...s,
    };
    song.channels = (song.channels || []).map((ch) => ({
      id: ch.id || uid('ch'),
      name: ch.name || 'Canal',
      instrument: ch.instrument || 'pulse50',
      volume: typeof ch.volume === 'number' ? ch.volume : 0.8,
      pan: typeof ch.pan === 'number' ? ch.pan : 0,
      mute: !!ch.mute,
      solo: !!ch.solo,
      drumKit: !!ch.drumKit,
      env: { a: 0.005, d: 0.1, s: 0.6, r: 0.08, ...(ch.env || {}) },
      vibrato: { depth: 0, rate: 6, ...(ch.vibrato || {}) },
      arp: Array.isArray(ch.arp) ? ch.arp : [],
      waveTable: Array.isArray(ch.waveTable) ? ch.waveTable : null,
      sampleSoundId: ch.sampleSoundId || null,
      ...(ch.defaultPitch ? { defaultPitch: ch.defaultPitch } : {}),
    }));
    song.patterns = (song.patterns || []).map((pat) => ({
      id: pat.id || uid('pat'),
      name: pat.name || 'Pattern',
      length: typeof pat.length === 'number' ? pat.length : 16,
      notes: Array.isArray(pat.notes) ? pat.notes : [],
    }));
    song.playlist = Array.isArray(song.playlist) ? song.playlist : [];
    // Boucle au format { enabled, start, end } ; anciens formats : booleen et loopStart a la racine.
    // La lecture boucle de loop.start a la fin de l'arrangement.
    if (!song.loop || typeof song.loop !== 'object') {
      song.loop = { enabled: song.loop !== false, start: 0, end: 16 };
    }
    if (Number.isInteger(song.loopStart)) {
      song.loop = { ...song.loop, start: song.loopStart };
      delete song.loopStart;
    }
    return song;
  });
  p.models = Array.isArray(p.models) ? p.models.map((m) => ({ folder: '', ...m })) : [];
  p.materials = Array.isArray(p.materials) ? p.materials : [];
  p.scenes3d = Array.isArray(p.scenes3d) ? p.scenes3d.map((s) => ({ folder: '', gridmap: {}, entities: [], ...s })) : [];
  // Gridmap au format unique { blockSize, blocks } (l'ancien editeur ecrivait une map plate "x,y,z" -> couleur)
  for (const sc of p.scenes3d || []) {
    const g = sc.gridmap;
    if (!g || typeof g !== 'object') sc.gridmap = { blockSize: 1, blocks: {} };
    else if (!g.blocks && !g.blocksRLE) {
      const blocks = {};
      for (const [k, v] of Object.entries(g)) if (/^-?\d+,-?\d+,-?\d+$/.test(k)) blocks[k] = v;
      sc.gridmap = { blockSize: typeof g.blockSize === 'number' ? g.blockSize : 1, blocks };
    }
    if (!Array.isArray(sc.entities)) sc.entities = [];
  }
  unpackProjectVoxels(p);
  p.environment = { ...base.environment, ...(p.environment || {}) };
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
    for (const e of m.entities || []) {
      e.props = e.props || {};
      if (e.angle === undefined) e.angle = 0;
      if (e.scale === undefined) e.scale = 1;
      if (e.locked === undefined) e.locked = false;
      if (e.visible === undefined) e.visible = true;
    }
  }
  p.globalScript = normalizeScript(p.globalScript, true);
  if (p.settings.dimension === '3d') {
    if (p.scenes3d?.length && !p.scenes3d.some((s) => s.id === p.settings.startScene3DId)) {
      p.settings.startScene3DId = p.scenes3d[0].id;
    }
  } else {
    if (!p.maps.some((m) => m.id === p.settings.startMapId)) p.settings.startMapId = p.maps[0].id;
  }
  return p;
}

export const findById = (list, id) => list.find((x) => x.id === id) || null;
export const findByName = (list, name) => list.find((x) => x.name === name) || null;
