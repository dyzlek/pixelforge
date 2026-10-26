// Validation d'un projet : références, tailles, syntaxe des scripts, noms d'événements / d'objets / de touches.
// Renvoie une liste d'issues { level: 'error' | 'warning', where, message }.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './store.js';
import { dataURLToBuffer, pngSize } from './png.js';
import { compileGraph } from '../../src/graph/index.js';
import { checkGraph, describeIssue } from './graph.js';

const BASE_EVENTS = ['create', 'update', 'collide', 'overlap', 'overlapStart', 'overlapEnd', 'keydown', 'timer', 'destroy', 'hitTile', 'click', 'mousedown', 'message', 'beat'];
const BASE_KEYS = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE', 'ENTER', 'SHIFT', 'Z', 'X', 'C', 'A', 'W', 'S', 'D', 'Q', 'E'];

const read = (...p) => { try { return fs.readFileSync(path.join(ROOT, ...p), 'utf8'); } catch { return ''; } };

// Événements : liste de base + tout ce que docs/SCRIPT_API.md cite sous la forme on('xxx'
export function knownEvents() {
  const set = new Set(BASE_EVENTS);
  for (const m of read('docs', 'SCRIPT_API.md').matchAll(/\bon\(\s*'([A-Za-z]+)'/g)) set.add(m[1]);
  return set;
}

// Touches : liste de base + const KEYS = [...] du moteur
export function knownKeys() {
  const set = new Set(BASE_KEYS);
  const m = /const KEYS\s*=\s*\[([^\]]*)\]/.exec(read('src', 'runtime', 'engine.js'));
  if (m) for (const k of m[1].matchAll(/['"]([A-Za-z0-9_]+)['"]/g)) set.add(k[1]);
  return set;
}

const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

export function checkSyntax(code) {
  try { new Function('self', 'game', 'input', 'on', code); return null; } catch (e) { return e.message; }
}

function nameHint(name, list) {
  const alt = list.find((n) => n.toLowerCase() === String(name).toLowerCase());
  return alt ? ` (names are case-sensitive: did you mean "${alt}"?)` : ` (existing: ${list.join(', ') || 'none'})`;
}

export function validateProject(p) {
  const issues = [];
  const add = (level, where, message) => issues.push({ level, where, message });
  const events = knownEvents(), keys = knownKeys();

  const spriteById = new Map((p.sprites || []).map((s) => [s.id, s]));
  const modelById = new Map((p.models || []).map((m) => [m.id, m]));
  const objectNames = p.objects.map((o) => o.name);
  const mapNames = p.maps.map((m) => m.name);

  const dup = (list, kind) => {
    const seen = new Set();
    for (const x of list) { if (seen.has(x.name)) add('error', `${kind} "${x.name}"`, `duplicate ${kind} name (scripts and tools look things up by name)`); seen.add(x.name); }
  };
  dup(p.sprites || [], 'sprite'); dup(p.objects, 'object'); dup(p.maps || [], 'map');
  dup(p.sounds || [], 'sound'); dup(p.songs || [], 'song');
  dup(p.models || [], 'model'); dup(p.scenes3d || [], 'scene3d');

  if (p.settings.dimension === '3d') {
    const startSceneId = p.settings.startScene3DId || p.settings.startMapId;
    if (!p.scenes3d?.length) {
      add('error', 'settings', 'dimension is "3d" but project has no 3D scenes in scenes3d');
    } else if (!p.scenes3d.some((s) => s.id === startSceneId)) {
      add('error', 'settings', `startScene3DId "${startSceneId}" matches no 3D scene`);
    }
  } else {
    if (!p.maps.some((m) => m.id === p.settings.startMapId)) add('error', 'settings', `startMapId "${p.settings.startMapId}" matches no map`);
  }

  // ----- sprites -----
  for (const s of p.sprites) {
    const w = `sprite "${s.name}"`;
    if (!s.frames?.length) { add('error', w, 'no frames'); continue; }
    s.frames.forEach((f, i) => {
      try {
        const sz = pngSize(dataURLToBuffer(f));
        if (sz.width !== s.width || sz.height !== s.height) add('error', w, `frame ${i} is ${sz.width}x${sz.height} but sprite is ${s.width}x${s.height}`);
      } catch (e) { add('error', w, `frame ${i} is not a valid PNG data URL (${e.message})`); }
    });
    const names = new Set();
    for (const a of s.animations || []) {
      if (names.has(a.name)) add('warning', w, `duplicate animation "${a.name}"`);
      names.add(a.name);
      for (const fi of a.frames || []) if (!Number.isInteger(fi) || fi < 0 || fi >= s.frames.length) add('error', w, `animation "${a.name}" uses frame ${fi} but the sprite has ${s.frames.length} frame(s)`);
      if (!(a.fps > 0)) add('warning', w, `animation "${a.name}" has fps ${a.fps}`);
    }
  }

  // ----- objets -----
  for (const o of p.objects) {
    const w = `object "${o.name}"`;
    const spr = o.spriteId ? spriteById.get(o.spriteId) : null;
    const mod = o.modelId ? modelById.get(o.modelId) : null;
    if (o.spriteId && !spr) add('error', w, `spriteId "${o.spriteId}" matches no sprite`);
    if (o.modelId && !mod) add('error', w, `modelId "${o.modelId}" matches no 3D model`);
    else if (!o.spriteId && !o.modelId) add('warning', w, 'no sprite or 3D model (invisible object)');
    if (spr && o.defaultAnim && !(spr.animations || []).some((a) => a.name === o.defaultAnim)) add('warning', w, `defaultAnim "${o.defaultAnim}" is not an animation of sprite "${spr.name}"`);
    if (o.hitbox) {
      const h = o.hitbox;
      if (![h.x, h.y, h.w, h.h].every(Number.isFinite) || h.w <= 0 || h.h <= 0) add('error', w, 'hitbox must be {x, y, w, h} with w,h > 0');
      else if (spr && (h.x < 0 || h.y < 0 || h.x + h.w > spr.width || h.y + h.h > spr.height)) add('warning', w, `hitbox exceeds the ${spr.width}x${spr.height} frame`);
    }
    checkScriptObject(o.script, `${w} script`, spr, false);
  }
  checkScriptObject(p.globalScript, 'global script', null, true);

  // Script d'un objet : mode graph = compilation du graphe + cohérence avec script.code ; puis contrôle du code exécuté (script.code)
  function checkScriptObject(script, where, spr, isGlobal) {
    if (script?.mode === 'graph' && script.graph) {
      const g = script.graph;
      for (const m of checkGraph(g)) add('error', where, 'graph: ' + m);
      let r = null;
      try { r = compileGraph(g, { isGlobal }); } catch (e) { add('error', where, 'graph compilation failed: ' + e.message); }
      if (r) {
        for (const e of r.errors) add('error', where, 'graph: ' + describeIssue(g, e));
        for (const w2 of r.warnings) add('warning', where, 'graph: ' + describeIssue(g, w2));
        if (!r.errors.length && r.code !== (script.code || '')) add('warning', where, 'script.code differs from the code recompiled from the graph (the game runs script.code; it is regenerated when the graph is saved in the editor)');
      }
    } else if (script?.mode === 'graph') add('error', where, 'mode is "graph" but the script has no graph');
    else if (script?.mode === 'blocks') add('warning', where, 'legacy Blockly script (mode "blocks"): it will be converted to a Blueprint graph when the game is opened in the editor');
    checkScript(script?.code, where, spr);
  }

  function checkScript(code, where, spr) {
    if (!code || !code.trim()) return;
    const err = checkSyntax(code);
    if (err) { add('error', where, 'syntax error: ' + err); return; }
    const src = stripComments(code);
    for (const m of src.matchAll(/\bon\(\s*(['"`])([A-Za-z_]+)\1/g)) {
      if (!events.has(m[2])) add('error', where, `unknown event "${m[2]}" (known: ${[...events].join(', ')})`);
    }
    for (const m of src.matchAll(/\bon\(\s*['"`](?:collide|overlap|overlapStart|overlapEnd)['"`]\s*,\s*(['"`])([^'"`]*)\1/g)) {
      if (!objectNames.includes(m[2])) add('error', where, `collide/overlap target object "${m[2]}" does not exist` + nameHint(m[2], objectNames));
    }
    for (const m of src.matchAll(/\bgame\.(spawn|findAll|find)\(\s*(['"`])([^'"`]*)\2/g)) {
      if (!objectNames.includes(m[3])) add('error', where, `game.${m[1]}("${m[3]}"): object does not exist` + nameHint(m[3], objectNames));
    }
    const destNames = p.settings.dimension === '3d'
      ? [...mapNames, ...(p.scenes3d || []).map((s) => s.name)]
      : mapNames;
    for (const m of src.matchAll(/\bgame\.(?:goToMap|goToScene)\(\s*(['"`])([^'"`]*)\1/g)) {
      if (!destNames.includes(m[2])) add('error', where, `target "${m[2]}" does not exist` + nameHint(m[2], destNames));
    }
    const sounds = [...(p.sounds || []).map((x) => x.name), 'jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal', 'tetris', 'korobeiniki', 'adventure', 'action'];
    for (const m of src.matchAll(/\bgame\.play(?:Sound|Music)\(\s*(['"`])([^'"`]*)\1/g)) {
      if (!sounds.includes(m[2])) add('warning', where, `game.play...("${m[2]}"): no such sound or preset` + nameHint(m[2], sounds));
    }
    const songs = (p.songs || []).map((x) => x.name);
    for (const m of src.matchAll(/\bgame\.playSong\(\s*(['"`])([^'"`]*)\1/g)) {
      if (!songs.includes(m[2])) add('warning', where, `game.playSong("${m[2]}"): no such song` + nameHint(m[2], songs));
    }
    const keyRe = [/\bon\(\s*['"`]keydown['"`]\s*,\s*(['"`])([^'"`]*)\1/g, /\binput\.(?:isDown|justPressed)\(\s*(['"`])([^'"`]*)\1/g];
    for (const re of keyRe) for (const m of src.matchAll(re)) if (!keys.has(m[2])) add('error', where, `unknown key "${m[2]}" (keys: ${[...keys].join(' ')})`);
    if (spr) {
      for (const m of src.matchAll(/\bself\.play\(\s*(['"`])([^'"`]*)\1/g)) {
        if (!(spr.animations || []).some((a) => a.name === m[2])) add('warning', where, `self.play("${m[2]}"): sprite "${spr.name}" has no such animation (has: ${(spr.animations || []).map((a) => a.name).join(', ') || 'none'})`);
      }
    }
  }

  // ----- cartes -----
  for (const m of p.maps) {
    const w = `map "${m.name}"`;
    const ts = m.tilesetSpriteId ? spriteById.get(m.tilesetSpriteId) : null;
    if (m.tilesetSpriteId && !ts) add('error', w, `tilesetSpriteId "${m.tilesetSpriteId}" matches no sprite`);
    if (ts && (ts.width !== m.tileSize || ts.height !== m.tileSize)) add('warning', w, `tileset sprite "${ts.name}" frames are ${ts.width}x${ts.height} but map tileSize is ${m.tileSize}`);
    if (m.tileSize !== p.settings.tileSize) add('warning', w, `map tileSize ${m.tileSize} differs from settings.tileSize ${p.settings.tileSize}`);
    if (!m.layers?.length) add('warning', w, 'no layers');
    for (const l of m.layers || []) {
      const lw = `${w} layer "${l.name}"`;
      if (!Array.isArray(l.data) || l.data.length !== m.width * m.height) { add('error', lw, `data has ${l.data?.length} cells, expected ${m.width}*${m.height}=${m.width * m.height}`); continue; }
      const used = l.data.filter((t) => t >= 0);
      if (used.length && !ts) add('error', lw, 'has tiles but the map has no tileset (set tileset on the map)');
      if (ts) {
        const bad = used.filter((t) => !Number.isInteger(t) || t >= ts.frames.length);
        if (bad.length) add('error', lw, `${bad.length} tile(s) use an index >= ${ts.frames.length} (tileset "${ts.name}" has ${ts.frames.length} tiles), e.g. ${bad[0]}`);
      }
    }
    (m.entities || []).forEach((e, i) => {
      const obj = p.objects.find((o) => o.id === e.objectId);
      const ew = `${w} entity #${i}${obj ? ` (${obj.name})` : ''}`;
      if (!obj) { add('error', ew, `objectId "${e.objectId}" matches no object`); return; }
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) add('error', ew, 'x/y must be numbers');
      else if (e.x < 0 || e.y < 0 || e.x >= m.width * m.tileSize || e.y >= m.height * m.tileSize) add('warning', ew, `at (${e.x},${e.y}) is outside the ${m.width * m.tileSize}x${m.height * m.tileSize}px map`);
    });
  }

  // ----- chansons -----
  const VALID_INSTRUMENTS = new Set(['pulse12', 'pulse25', 'pulse50', 'triangle', 'saw', 'noise', 'wave', 'sample']);
  for (const song of p.songs || []) {
    const sw = `song "${song.name}"`;
    if (!song.channels?.length) add('warning', sw, 'no channels');
    const chIds = new Set();
    for (const ch of song.channels || []) {
      chIds.add(ch.id);
      if (!VALID_INSTRUMENTS.has(ch.instrument)) add('error', `${sw} channel "${ch.name}"`, `unknown instrument "${ch.instrument}"`);
      if (ch.instrument === 'sample' && ch.sampleSoundId && !(p.sounds || []).some((s) => s.id === ch.sampleSoundId)) {
        add('error', `${sw} channel "${ch.name}"`, `sampleSoundId "${ch.sampleSoundId}" matches no sound`);
      }
    }
    const patIds = new Set();
    for (const pat of song.patterns || []) {
      patIds.add(pat.id);
      for (const n of pat.notes || []) {
        if (!chIds.has(n.ch)) add('error', `${sw} pattern "${pat.name}"`, `note references unknown channel id "${n.ch}"`);
      }
    }
    for (const pl of song.playlist || []) {
      if (!patIds.has(pl.pattern)) add('error', sw, `playlist references unknown pattern id "${pl.pattern}"`);
    }
  }

  // ----- modèles 3D -----
  for (const m of p.models || []) {
    const w = `model "${m.name}"`;
    if (m.type === 'voxel') {
      if (!(m.width > 0) || !(m.height > 0) || !(m.depth > 0)) add('error', w, `dimensions must be > 0 (got ${m.width}x${m.height}x${m.depth})`);
    } else if (m.type === 'gltf') {
      if (!m.gltfData) add('error', w, 'type is "gltf" but gltfData is missing');
    }
  }

  // ----- scènes 3D -----
  for (const sc of p.scenes3d || []) {
    const w = `scene3d "${sc.name}"`;
    (sc.entities || []).forEach((e, i) => {
      const obj = p.objects.find((o) => o.id === e.objectId);
      const ew = `${w} entity #${i}${obj ? ` (${obj.name})` : ''}`;
      if (!obj) { add('error', ew, `objectId "${e.objectId}" matches no object`); return; }
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.z)) add('error', ew, 'x, y, z must be valid numbers');
    });
  }

  if (p.settings.dimension === '3d') {
    const startSc = (p.scenes3d || []).find((s) => s.id === (p.settings.startScene3DId || p.settings.startMapId));
    if (startSc && !startSc.entities?.length) add('warning', `scene3d "${startSc.name}"`, 'the start 3D scene has no entities: nothing will happen when playing');
  } else {
    const start = p.maps.find((m) => m.id === p.settings.startMapId);
    if (start && !start.entities?.length) add('warning', `map "${start.name}"`, 'the start map has no entities: nothing will happen when playing');
  }
  return issues;
}

export function formatIssues(issues) {
  if (!issues.length) return 'OK: no issues.';
  const errs = issues.filter((i) => i.level === 'error').length;
  return `${errs} error(s), ${issues.length - errs} warning(s):\n` + issues.map((i) => `- ${i.level.toUpperCase()} [${i.where}] ${i.message}`).join('\n');
}
