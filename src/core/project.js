// Schéma du projet : voir docs/ARCHITECTURE.md

export const PROJECT_VERSION = 1;

// Palette « Sweetie 16 »
export const DEFAULT_PALETTE = [
  '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
  '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
];

export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

export function emptyScript(mode = 'blocks') {
  return { mode, code: '', blocks: null };
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
    script: emptyScript('blocks'),
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
    globalScript: emptyScript('blocks'),
  };
}

// Complète un projet chargé (anciens fichiers, champs manquants)
export function normalizeProject(p) {
  const base = createEmptyProject(p.name || 'Mon jeu');
  p.version = PROJECT_VERSION;
  p.settings = { ...base.settings, ...(p.settings || {}) };
  p.palette = p.palette?.length ? p.palette : base.palette;
  p.meta = { ...base.meta, ...(p.meta || {}) };
  p.sprites = p.sprites || [];
  p.sounds = p.sounds || [];
  p.objects = (p.objects || []).map((o) => ({ ...createObject(o.name), ...o, physics: { ...createObject().physics, ...(o.physics || {}) } }));
  p.maps = p.maps?.length ? p.maps : base.maps;
  for (const m of p.maps) {
    for (const l of m.layers || []) {
      l.depth = l.depth || 'below';
      if (l.oneWay === undefined) l.oneWay = false;
      if (l.scrollFactor === undefined) l.scrollFactor = 1;
    }
    for (const e of m.entities || []) e.props = e.props || {};
  }
  p.globalScript = p.globalScript || emptyScript();
  if (!p.maps.some((m) => m.id === p.settings.startMapId)) p.settings.startMapId = p.maps[0].id;
  return p;
}

export const findById = (list, id) => list.find((x) => x.id === id) || null;
export const findByName = (list, name) => list.find((x) => x.name === name) || null;
