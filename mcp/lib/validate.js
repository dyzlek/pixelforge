// Validation d'un projet : références, tailles, syntaxe des scripts, noms d'événements / d'objets / de touches.
// Renvoie une liste d'issues { level: 'error' | 'warning', where, message }.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './store.js';
import { dataURLToBuffer, pngSize } from './png.js';

const BASE_EVENTS = ['create', 'update', 'collide', 'overlap', 'overlapStart', 'overlapEnd', 'keydown', 'timer', 'destroy', 'hitTile', 'click', 'mousedown', 'message'];
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
  const objectNames = p.objects.map((o) => o.name);
  const mapNames = p.maps.map((m) => m.name);

  const dup = (list, kind) => {
    const seen = new Set();
    for (const x of list) { if (seen.has(x.name)) add('error', `${kind} "${x.name}"`, `duplicate ${kind} name (scripts and tools look things up by name)`); seen.add(x.name); }
  };
  dup(p.sprites, 'sprite'); dup(p.objects, 'object'); dup(p.maps, 'map'); dup(p.sounds || [], 'sound');

  if (!p.maps.some((m) => m.id === p.settings.startMapId)) add('error', 'settings', `startMapId "${p.settings.startMapId}" matches no map`);

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
    if (o.spriteId && !spr) add('error', w, `spriteId "${o.spriteId}" matches no sprite`);
    else if (!o.spriteId) add('warning', w, 'no sprite (invisible object)');
    if (spr && o.defaultAnim && !(spr.animations || []).some((a) => a.name === o.defaultAnim)) add('warning', w, `defaultAnim "${o.defaultAnim}" is not an animation of sprite "${spr.name}"`);
    if (o.hitbox) {
      const h = o.hitbox;
      if (![h.x, h.y, h.w, h.h].every(Number.isFinite) || h.w <= 0 || h.h <= 0) add('error', w, 'hitbox must be {x, y, w, h} with w,h > 0');
      else if (spr && (h.x < 0 || h.y < 0 || h.x + h.w > spr.width || h.y + h.h > spr.height)) add('warning', w, `hitbox exceeds the ${spr.width}x${spr.height} frame`);
    }
    checkScript(o.script?.code, `${w} script`, spr);
  }
  checkScript(p.globalScript?.code, 'global script', null);

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
    for (const m of src.matchAll(/\bgame\.goToMap\(\s*(['"`])([^'"`]*)\1/g)) {
      if (!mapNames.includes(m[2])) add('error', where, `game.goToMap("${m[2]}"): map does not exist` + nameHint(m[2], mapNames));
    }
    const sounds = [...(p.sounds || []).map((x) => x.name), 'jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal', 'tetris', 'korobeiniki', 'adventure', 'action'];
    for (const m of src.matchAll(/\bgame\.play(?:Sound|Music)\(\s*(['"`])([^'"`]*)\1/g)) {
      if (!sounds.includes(m[2])) add('warning', where, `game.play...("${m[2]}"): no such sound or preset` + nameHint(m[2], sounds));
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
  const start = p.maps.find((m) => m.id === p.settings.startMapId);
  if (start && !start.entities?.length) add('warning', `map "${start.name}"`, 'the start map has no entities: nothing will happen when playing');
  return issues;
}

export function formatIssues(issues) {
  if (!issues.length) return 'OK: no issues.';
  const errs = issues.filter((i) => i.level === 'error').length;
  return `${errs} error(s), ${issues.length - errs} warning(s):\n` + issues.map((i) => `- ${i.level.toUpperCase()} [${i.where}] ${i.message}`).join('\n');
}
