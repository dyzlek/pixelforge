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

export function createSceneNode(name = 'Node3D', kind = 'mesh', parent = null) {
  const isLight = kind === 'light';
  return {
    id: uid('node3d'),
    name,
    kind,
    parent,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    locked: false,
    objectId: null,
    materialId: null,
    props: isLight ? {
      lightType: 'point',
      color: '#ffcd75',
      intensity: 1.5,
      distance: 12,
      decay: 2,
      angle: 45,
      penumbra: 0.2,
      castShadow: false
    } : {},
  };
}

export function createMaterial(name = 'Materiau', type = 'standard') {
  return {
    id: uid('mat'),
    name,
    type,
    color: '#ffffff',
    roughness: 0.8,
    metalness: 0.1,
    textureSpriteId: null,
    emissive: '#000000',
    transparent: false,
    opacity: 1.0,
    doubleSided: false,
  };
}

export function createScene3D(name = 'Scene 3D') {
  return {
    id: uid('scene3d'),
    name,
    environment: {
      skyColor: '#1a1c2c',
      horizonColor: '#29366f',
      skyGradient: { enabled: false, topColor: '#0d0f18', bottomColor: '#29366f' },
      fog: { enabled: false, type: 'exp2', color: '#1a1c2c', density: 0.04, near: 10, far: 50 },
      ambientLight: { color: '#ffffff', intensity: 0.6 },
      directionalLight: { color: '#ffeedd', intensity: 1.0, position: [10, 20, 15], castShadow: false },
      shadows: { enabled: false }
    },
    gridmap: {
      blockSize: 1,
      blocks: {},
    },
    nodes: [],
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
    song.tracks = Array.isArray(song.tracks) ? song.tracks : [];
    song.clips = (song.clips || []).map((c) => ({
      id: c.id || uid('clp'),
      name: c.name || 'Clip',
      trackId: c.trackId || (song.tracks[0]?.id || song.channels[0]?.id || 'ch0'),
      type: c.type || 'notes',
      start: typeof c.start === 'number' ? c.start : 0,
      length: typeof c.length === 'number' ? c.length : 16,
      offset: typeof c.offset === 'number' ? c.offset : 0,
      loop: !!c.loop,
      notes: Array.isArray(c.notes) ? c.notes : []
    }));
    song.markers = (song.markers || []).map((m) => ({
      step: typeof m.step === 'number' ? Math.max(0, m.step) : 0,
      name: m.name || 'Marqueur'
    }));
    song.timeSignature = Array.isArray(song.timeSignature) && song.timeSignature.length === 2
      ? [Math.max(1, song.timeSignature[0] || 4), Math.max(1, song.timeSignature[1] || 4)]
      : [4, 4];
    if (song.channels.length > 0 && song.tracks.length === 0) {
      song.tracks = song.channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        color: '#41a6f6',
        volume: ch.volume,
        pan: ch.pan,
        mute: ch.mute,
        solo: ch.solo,
        instrument: ch.instrument,
        preset: ch.preset,
        params: ch.params,
        drumKit: ch.drumKit,
        env: ch.env,
        vibrato: ch.vibrato,
        arp: ch.arp,
        waveTable: ch.waveTable,
        sampleSoundId: ch.sampleSoundId,
        effects: Array.isArray(ch.effects) ? ch.effects : [],
        sends: Array.isArray(ch.sends) ? ch.sends : []
      }));
    } else if (song.tracks.length > 0 && song.channels.length === 0) {
      song.channels = song.tracks.map((tr) => ({
        id: tr.id,
        name: tr.name,
        instrument: typeof tr.instrument === 'string' ? tr.instrument : (tr.instrument?.type || 'pulse50'),
        preset: tr.preset || tr.instrument?.preset,
        params: tr.params || tr.instrument?.params,
        volume: tr.volume,
        pan: tr.pan,
        mute: tr.mute,
        solo: tr.solo,
        drumKit: tr.drumKit,
        env: tr.env,
        vibrato: tr.vibrato,
        arp: tr.arp,
        waveTable: tr.waveTable,
        sampleSoundId: tr.sampleSoundId,
        effects: Array.isArray(tr.effects) ? tr.effects : [],
        sends: Array.isArray(tr.sends) ? tr.sends : []
      }));
    }
    return song;
  });
  p.models = Array.isArray(p.models) ? p.models.map((m) => ({ folder: '', ...m })) : [];
  p.materials = Array.isArray(p.materials) ? p.materials : [];
  p.scenes3d = Array.isArray(p.scenes3d) ? p.scenes3d.map((s) => ({ folder: '', gridmap: {}, entities: [], nodes: [], ...s })) : [];
  // Gridmap au format unique { blockSize, blocks } et migration hierarchique entities[] -> nodes[]
  for (const sc of p.scenes3d || []) {
    const g = sc.gridmap;
    if (!g || typeof g !== 'object') sc.gridmap = { blockSize: 1, blocks: {} };
    else if (!g.blocks && !g.blocksRLE) {
      const blocks = {};
      for (const [k, v] of Object.entries(g)) if (/^-?\d+,-?\d+,-?\d+$/.test(k)) blocks[k] = v;
      sc.gridmap = { blockSize: typeof g.blockSize === 'number' ? g.blockSize : 1, blocks };
    }
    if (!Array.isArray(sc.entities)) sc.entities = [];
    if (!Array.isArray(sc.nodes)) sc.nodes = [];

    // Conversion entities[] -> nodes[] si nodes[] est vide
    if (sc.entities.length > 0 && sc.nodes.length === 0) {
      for (const e of sc.entities) {
        const obj = (p.objects || []).find((o) => o.id === e.objectId);
        sc.nodes.push({
          id: e.id,
          name: obj?.name || `Entity_${e.id.slice(-4)}`,
          kind: 'mesh',
          parent: null,
          position: [e.x || 0, e.y || 0, e.z || 0],
          rotation: [e.rotationX || 0, e.rotationY || 0, e.rotationZ || 0],
          scale: [e.scaleX || 1, e.scaleY || 1, e.scaleZ || 1],
          visible: e.visible !== false,
          locked: !!e.locked,
          objectId: e.objectId || null,
          materialId: e.materialId || null,
          props: e.props || {},
        });
      }
    } else if (sc.nodes.length > 0 && sc.entities.length === 0) {
      // Synchronisation inverse pour compatibilite avec les runtimes qui lisent entities[]
      for (const n of sc.nodes) {
        if (n.kind === 'mesh' && n.objectId) {
          sc.entities.push({
            id: n.id,
            objectId: n.objectId,
            x: Array.isArray(n.position) ? n.position[0] : 0,
            y: Array.isArray(n.position) ? n.position[1] : 0,
            z: Array.isArray(n.position) ? n.position[2] : 0,
            rotationY: Array.isArray(n.rotation) ? n.rotation[1] : 0,
            props: n.props || {},
          });
        }
      }
    }

    // Normalisation de l'environnement de la scene (ciel, brouillard, lumieres, ombres)
    const env = sc.environment || {};
    sc.environment = {
      skyColor: env.skyColor || '#1a1c2c',
      horizonColor: env.horizonColor || '#29366f',
      skyGradient: {
        enabled: !!env.skyGradient?.enabled,
        topColor: env.skyGradient?.topColor || '#0d0f18',
        bottomColor: env.skyGradient?.bottomColor || env.horizonColor || '#29366f'
      },
      fog: {
        enabled: !!env.fog?.enabled,
        type: env.fog?.type || 'exp2',
        color: env.fog?.color || env.skyColor || '#1a1c2c',
        density: typeof env.fog?.density === 'number' ? env.fog.density : 0.04,
        near: typeof env.fog?.near === 'number' ? env.fog.near : 10,
        far: typeof env.fog?.far === 'number' ? env.fog.far : 50
      },
      ambientLight: {
        color: env.ambientLight?.color || '#ffffff',
        intensity: typeof env.ambientLight?.intensity === 'number' ? env.ambientLight.intensity : 0.6
      },
      directionalLight: {
        color: env.directionalLight?.color || '#ffeedd',
        intensity: typeof env.directionalLight?.intensity === 'number' ? env.directionalLight.intensity : 1.0,
        position: Array.isArray(env.directionalLight?.position) ? env.directionalLight.position : [10, 20, 15],
        castShadow: !!env.directionalLight?.castShadow
      },
      shadows: {
        enabled: !!(env.shadows?.enabled || env.directionalLight?.castShadow)
      }
    };

    for (const n of sc.nodes) {
      if (n.kind === 'light') {
        n.props = {
          lightType: 'point',
          color: '#ffcd75',
          intensity: 1.5,
          distance: 12,
          decay: 2,
          angle: 45,
          penumbra: 0.2,
          castShadow: false,
          ...(n.props || {})
        };
      }
    }
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
