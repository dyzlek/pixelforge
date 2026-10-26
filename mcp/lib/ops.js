// Opérations de haut niveau sur un projet (mutent l'objet projet, lèvent une Error avec un message utile).
// Utilisées par le serveur MCP et la CLI.
import { createObject, createMap, createLayer, createModel, createScene3D, uid } from '../../src/core/project.js';
import { textToFrames, framesToText } from './sprites.js';
import { checkSyntax } from './validate.js';
import { buildGraphScript } from './graph.js';
import { parseSongText, songToText } from './song-text.js';

export const SOUND_PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal', 'tetris', 'korobeiniki', 'adventure', 'action'];
const list = (arr) => arr.join(', ') || 'none';

// ---------- recherche par nom (ou id) ----------
function find(arr, ref, kind) {
  const hit = arr.find((x) => x.name === ref || x.id === ref) || arr.find((x) => x.name.toLowerCase() === String(ref).toLowerCase());
  if (!hit) throw new Error(`${kind} "${ref}" not found (${kind}s: ${list(arr.map((x) => x.name))})`);
  return hit;
}
export const findSprite = (p, ref) => find(p.sprites, ref, 'sprite');
export const findObject = (p, ref) => find(p.objects, ref, 'object');
export const findMap = (p, ref) => find(p.maps, ref, 'map');
export const findModel = (p, ref) => find(p.models || [], ref, 'model');
export const findScene3D = (p, ref) => find(p.scenes3d || [], ref, 'scene3d');
const findLayer = (m, ref) => find(m.layers, ref, 'layer');

// ---------- résumé ----------
export function summarize(p) {
  const L = [];
  const s = p.settings;
  L.push(`Game "${p.name}" (id ${p.meta.id})${p.meta.description ? ' - ' + p.meta.description : ''}`);
  const startMap = p.maps?.find((m) => m.id === s.startMapId)?.name || 'none';
  const startScene = p.scenes3d?.find((sc) => sc.id === s.startScene3DId)?.name || 'none';
  L.push(`Settings: dimension ${s.dimension || '2d'}, screen ${s.width}x${s.height}, tileSize ${s.tileSize}, gravity ${s.gravity}, pixelZoom ${s.pixelZoom}, background ${s.background}, touchControls ${s.touchControls}, start map "${startMap}"${s.dimension === '3d' ? `, start 3D scene "${startScene}"` : ''}`);
  L.push(`Palette: ${p.palette.map((c, i) => i.toString(16) + '=' + c).join(' ')}`);
  L.push(`Sprites (${(p.sprites || []).length}):`);
  for (const sp of p.sprites || []) L.push(`  - ${sp.name}: ${sp.width}x${sp.height}, ${sp.frames.length} frame(s), anims: ${(sp.animations || []).map((a) => `${a.name}[${a.frames.join(',')}]@${a.fps}${a.loop ? '' : ' once'}`).join(' ') || 'none'}`);
  L.push(`Models 3D (${(p.models || []).length}):`);
  for (const m of p.models || []) L.push(`  - ${m.name}: ${m.type || 'voxel'}, ${m.width}x${m.height}x${m.depth}, ${m.type === 'voxel' ? Object.keys(m.voxels || {}).length + ' voxels' : 'gltf'}`);
  L.push(`Objects (${p.objects.length}):`);
  for (const o of p.objects) {
    const sp = (p.sprites || []).find((x) => x.id === o.spriteId);
    const mod = (p.models || []).find((x) => x.id === o.modelId);
    const vis = sp ? `sprite ${sp.name}` : mod ? `model ${mod.name}` : 'none';
    const ph = o.physics;
    const flags = ['gravity', 'immovable', 'collideMap', 'collideWorld'].filter((k) => ph[k]).join('+') || 'static';
    L.push(`  - ${o.name}: ${vis}, anim ${o.defaultAnim || '-'}, physics ${ph.enabled ? flags : 'off'}${ph.bounce ? ', bounce ' + ph.bounce : ''}, hitbox ${o.hitbox ? JSON.stringify(o.hitbox) : 'full'}, script ${o.script?.mode || 'code'} ${o.script?.code?.length || 0} chars`);
  }
  L.push(`Global script: ${p.globalScript?.mode || 'code'}, ${p.globalScript?.code?.length || 0} chars`);
  L.push(`Maps (${(p.maps || []).length}):`);
  for (const m of p.maps || []) {
    const ts = (p.sprites || []).find((x) => x.id === m.tilesetSpriteId);
    L.push(`  - ${m.name}: ${m.width}x${m.height} tiles, tileset ${ts ? ts.name : 'none'}, layers: ${m.layers.map((l) => `${l.name}${l.collides ? '(collides)' : ''}${l.oneWay ? '(oneWay)' : ''}${l.depth === 'above' ? '(above)' : ''}${l.scrollFactor !== undefined && l.scrollFactor !== 1 ? `(parallax ${typeof l.scrollFactor === 'object' ? JSON.stringify(l.scrollFactor) : l.scrollFactor})` : ''}`).join(', ')}, ${m.entities.length} entities`);
  }
  L.push(`Scenes 3D (${(p.scenes3d || []).length}):`);
  for (const sc of p.scenes3d || []) {
    const bCount = Object.keys(sc.gridmap?.blocks || {}).length;
    L.push(`  - ${sc.name}: ${bCount} blocks, ${sc.entities.length} entities, sky ${sc.environment?.skyColor || '#1a1c2c'}`);
  }
  L.push(`Sounds (${(p.sounds || []).length}): ${(p.sounds || []).map((x) => `${x.name}${x.kind === 'sfx' ? ':' + x.sfx?.preset : ':file'}`).join(', ') || 'none'}`);
  return L.join('\n');
}

// ---------- paramètres ----------
export function setSettings(p, a) {
  const s = p.settings, changed = [];
  for (const k of ['width', 'height', 'pixelZoom', 'tileSize', 'gravity', 'dimension']) if (a[k] !== undefined) { s[k] = a[k]; changed.push(`${k}=${a[k]}`); }
  if (a.background !== undefined) { s.background = a.background; changed.push('background'); }
  if (a.touchControls !== undefined) { s.touchControls = a.touchControls; changed.push('touchControls'); }
  if (a.startMap) { s.startMapId = findMap(p, a.startMap).id; changed.push('startMap'); }
  if (a.startScene3D) { s.startScene3DId = findScene3D(p, a.startScene3D).id; changed.push('startScene3D'); }
  if (a.name) { p.name = a.name; changed.push('name'); }
  if (a.description !== undefined) { p.meta.description = a.description; changed.push('description'); }
  if (a.author !== undefined) { p.meta.author = a.author; changed.push('author'); }
  if (a.palette) {
    if (a.palette.length !== 16) throw new Error('palette must contain exactly 16 colours');
    p.palette = a.palette; changed.push('palette (existing sprite pixels are NOT recoloured)');
  }
  if (!changed.length) return 'Nothing to change.';
  return 'Updated: ' + changed.join(', ') + (a.tileSize !== undefined ? '. Note: existing maps/tilesets keep their own tileSize.' : '');
}

// ---------- sprites ----------
export function upsertSprite(p, a) {
  const { width, height, frames } = textToFrames(a.frames, p.palette, a.legend, { width: a.width, height: a.height });
  let sp = p.sprites.find((s) => s.name === a.name);
  const isNew = !sp;
  if (!sp) { sp = { id: uid('spr'), name: a.name }; p.sprites.push(sp); }
  Object.assign(sp, { width, height, frames });
  if (a.animations) {
    sp.animations = a.animations.map((an) => ({ name: an.name, frames: an.frames, fps: an.fps ?? 6, loop: an.loop ?? true }));
  } else if (isNew || !sp.animations?.length) {
    sp.animations = [{ name: 'idle', frames: frames.map((_, i) => i), fps: 6, loop: true }];
  } else {
    sp.animations = sp.animations.map((an) => ({ ...an, frames: an.frames.filter((i) => i < frames.length) })).filter((an) => an.frames.length);
    if (!sp.animations.length) sp.animations = [{ name: 'idle', frames: frames.map((_, i) => i), fps: 6, loop: true }];
  }
  return `${isNew ? 'Created' : 'Updated'} sprite "${a.name}" ${width}x${height}, ${frames.length} frame(s), animations: ${sp.animations.map((x) => x.name).join(', ')}.` +
    (sp.animations.length === 1 && !a.animations ? ' (default animation "idle" plays all frames; pass animations to split them.)' : '');
}

export function getSprite(p, name) {
  const sp = findSprite(p, name);
  const { frames, legend } = framesToText(sp.frames, p.palette);
  return { sprite: sp, text: `Sprite "${sp.name}" ${sp.width}x${sp.height}\nanimations: ${JSON.stringify(sp.animations)}\nlegend: ${JSON.stringify(legend)}\n` +
    frames.map((f, i) => `frame ${i}:\n${f.join('\n')}`).join('\n') };
}

// ---------- scripts : code JavaScript ou graphe Blueprint ----------
// a = { code } ou { graph } (exactement un des deux). Lève une Error si le script est invalide.
function makeScript(a, isGlobal, notSaved, dimension = '2d') {
  if (a.code !== undefined && a.graph !== undefined) throw new Error('give either "code" or "graph", not both');
  if (a.graph !== undefined) {
    let r;
    try { r = buildGraphScript(a.graph, isGlobal, dimension); } catch (e) { throw new Error(`${e.message}\n${notSaved}`); }
    const err = checkSyntax(r.code);
    if (err) throw new Error(`compiled graph has a syntax error: ${err}. ${notSaved}`);
    const note = r.warnings.length ? `\nGraph warnings:\n- ${r.warnings.join('\n- ')}` : '';
    return { script: { mode: 'graph', code: r.code, graph: r.graph }, note };
  }
  const code = a.code ?? '';
  const err = checkSyntax(code);
  if (err) throw new Error(`script syntax error: ${err}. ${notSaved}`);
  return { script: { mode: 'code', code }, note: '' };
}

// ---------- objets ----------
export function upsertObject(p, a) {
  let o = p.objects.find((x) => x.name === a.name);
  const isNew = !o;
  if (!o) { o = createObject(a.name, null); p.objects.push(o); }
  if (a.sprite !== undefined) {
    if (a.sprite === null || a.sprite === '') o.spriteId = null;
    else {
      const sp = findSprite(p, a.sprite);
      o.spriteId = sp.id;
      if (a.defaultAnim === undefined && !(sp.animations || []).some((x) => x.name === o.defaultAnim)) o.defaultAnim = sp.animations?.[0]?.name ?? null;
    }
  }
  if (a.model !== undefined) {
    if (a.model === null || a.model === '') o.modelId = null;
    else {
      const mod = findModel(p, a.model);
      o.modelId = mod.id;
    }
  }
  if (a.defaultAnim !== undefined) o.defaultAnim = a.defaultAnim;
  if (a.physics) o.physics = { ...o.physics, ...a.physics };
  if (a.hitbox !== undefined) o.hitbox = a.hitbox;
  let scriptNote = '';
  if (a.code !== undefined || a.graph !== undefined) {
    const r = makeScript(a, false, 'Object not saved.', p.settings?.dimension || '2d');
    o.script = r.script;
    scriptNote = r.note;
  }
  const sp = (p.sprites || []).find((s) => s.id === o.spriteId);
  const mod = (p.models || []).find((m) => m.id === o.modelId);
  const vis = sp ? `sprite ${sp.name}` : mod ? `model ${mod.name}` : 'none';
  return `${isNew ? 'Created' : 'Updated'} object "${o.name}" (${vis}, anim ${o.defaultAnim || '-'}, physics ${JSON.stringify(o.physics)}, script ${o.script.mode} ${o.script.code.length} chars).${scriptNote}`;
}

export function setScript(p, objectRef, a) {
  if (a.code === undefined && a.graph === undefined) throw new Error('give "code" (JavaScript) or "graph" (Blueprint)');
  const isGlobal = objectRef === 'global';
  const o = isGlobal ? null : findObject(p, objectRef);
  const r = makeScript(a, isGlobal, 'Script not saved.', p.settings?.dimension || '2d');
  if (isGlobal) p.globalScript = r.script; else o.script = r.script;
  return `${isGlobal ? 'Global script' : `Script of "${o.name}"`} set (${r.script.code.length} chars, mode ${r.script.mode}).${r.note}`;
}

export function getScript(p, objectRef) {
  const s = objectRef === 'global' ? p.globalScript : findObject(p, objectRef).script;
  if (!s?.graph?.nodes?.length) return s?.code || '';
  const what = s.mode === 'graph' ? 'compiled from the graph' : 'hand-written code; the graph is ignored while mode is code';
  return [`mode: ${s.mode}`, '--- graph (JSON, same format as set_script "graph") ---', JSON.stringify(s.graph), `--- script.code (${what}) ---`, s.code].join('\n');
}

// ---------- cartes ----------
const isPristine = (m) => !m.entities.length && !m.tilesetSpriteId && m.layers.every((l) => l.data.every((t) => t === -1));

function resizeLayer(l, ow, oh, w, h) {
  const data = new Array(w * h).fill(-1);
  for (let y = 0; y < Math.min(oh, h); y++) for (let x = 0; x < Math.min(ow, w); x++) data[y * w + x] = l.data[y * ow + x];
  l.data = data;
}

export function upsertMap(p, a) {
  let m = p.maps.find((x) => x.name === a.name);
  let note = '';
  if (!m) {
    m = createMap(a.name, a.width || 40, a.height || 12, p.settings.tileSize);
    if (p.maps.length === 1 && isPristine(p.maps[0])) { // remplace la carte vide par défaut
      note = ` (replaced the empty default map "${p.maps[0].name}" and made it the start map)`;
      p.maps = [m];
      p.settings.startMapId = m.id;
    } else p.maps.push(m);
    m.background = p.settings.background;
  } else if ((a.width && a.width !== m.width) || (a.height && a.height !== m.height)) {
    const w = a.width || m.width, h = a.height || m.height;
    for (const l of m.layers) resizeLayer(l, m.width, m.height, w, h);
    m.width = w; m.height = h;
  }
  if (a.tileset !== undefined) m.tilesetSpriteId = a.tileset ? findSprite(p, a.tileset).id : null;
  if (a.background) m.background = a.background;
  if (a.layers) {
    const next = [];
    for (const spec of a.layers) {
      let l = m.layers.find((x) => x.name === spec.name);
      if (!l) l = createLayer(spec.name, m.width, m.height, false);
      if (spec.collides !== undefined) l.collides = spec.collides;
      if (spec.oneWay !== undefined) l.oneWay = !!spec.oneWay;
      if (spec.scrollFactor !== undefined) l.scrollFactor = spec.scrollFactor;
      if (spec.parallax !== undefined) l.scrollFactor = spec.parallax;
      if (spec.depth) l.depth = spec.depth;
      if (spec.visible !== undefined) l.visible = spec.visible;
      next.push(l);
    }
    m.layers = next; // l'ordre donné = ordre de dessin (le dernier est dessiné au-dessus)
  }
  if (a.start) { p.settings.startMapId = m.id; note += ' Start map.'; }
  return `Map "${m.name}" ${m.width}x${m.height} tiles, layers: ${m.layers.map((l) => l.name + (l.collides ? '(collides)' : '')).join(', ')}, tileset ${p.sprites.find((s) => s.id === m.tilesetSpriteId)?.name || 'none'}.${note}`;
}

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

export function paintMap(p, a) {
  const m = findMap(p, a.map);
  const l = findLayer(m, a.layer);
  const legend = a.legend || {};
  const x0 = a.x || 0, y0 = a.y || 0;
  let painted = 0;
  const ts = p.sprites.find((s) => s.id === m.tilesetSpriteId);
  const writes = [];
  a.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      let t;
      if (ch in legend) t = legend[ch];
      else if (ch === ' ') continue; // espace = ne pas toucher
      else if (ch === '.') t = -1;
      else if (B36.includes(ch)) t = B36.indexOf(ch); // sans légende : index en base 36 (comme render_map)
      else throw new Error(`row ${j}, col ${i}: character "${ch}" is not in legend (legend: {"${ch}": tileIndex}; "." = empty, " " = leave unchanged)`);
      if (!Number.isInteger(t) || t < -1) throw new Error(`legend value for "${ch}" must be a tile index >= 0 or -1`);
      const x = x0 + i, y = y0 + j;
      if (x < 0 || y < 0 || x >= m.width || y >= m.height) throw new Error(`row ${j}, col ${i} lands at (${x},${y}), outside the ${m.width}x${m.height} map (resize with upsert_map first)`);
      writes.push([y * m.width + x, t]);
    }
  });
  for (const [idx, t] of writes) { l.data[idx] = t; painted++; }
  let msg = `Painted ${painted} cell(s) on layer "${l.name}" of "${m.name}".`;
  if (!ts) msg += ' Warning: the map has no tileset yet (upsert_map with tileset).';
  else {
    const over = writes.filter(([, t]) => t >= ts.frames.length).length;
    if (over) msg += ` Warning: ${over} tile(s) use an index >= ${ts.frames.length} (tileset has ${ts.frames.length} tiles).`;
  }
  return msg;
}

export function setLayer(p, a) {
  const m = findMap(p, a.map);
  let l = m.layers.find((x) => x.name === a.layer);
  const created = !l;
  if (!l) { l = createLayer(a.layer, m.width, m.height, false); m.layers.push(l); }
  if (a.collides !== undefined) l.collides = a.collides;
  if (a.oneWay !== undefined) l.oneWay = !!a.oneWay;
  if (a.scrollFactor !== undefined) l.scrollFactor = a.scrollFactor;
  if (a.parallax !== undefined) l.scrollFactor = a.parallax;
  if (a.depth) l.depth = a.depth;
  if (a.visible !== undefined) l.visible = a.visible;
  return `${created ? 'Created' : 'Updated'} layer "${l.name}" of "${m.name}": collides=${l.collides}${l.oneWay ? '(oneWay)' : ''}, depth=${l.depth}, visible=${l.visible}.`;
}

// ---------- modèles 3D ----------
export function upsertModel(p, a) {
  p.models ||= [];
  let m = p.models.find((x) => x.name === a.name);
  const isNew = !m;
  if (!m) {
    m = createModel(a.name, a.width || 8, a.height || 8, a.depth || 8);
    p.models.push(m);
  }
  if (a.width) m.width = a.width;
  if (a.height) m.height = a.height;
  if (a.depth) m.depth = a.depth;

  if (a.gltf) {
    m.type = 'gltf';
    m.gltfData = a.gltf;
  } else if (a.slices) {
    m.type = 'voxel';
    m.voxels = {};
    const legend = a.legend || {};
    for (let y = 0; y < a.slices.length; y++) {
      const slice = a.slices[y];
      for (let z = 0; z < slice.length; z++) {
        const row = slice[z];
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ') continue;
          let val = legend[ch];
          if (val === undefined) {
            const idx = parseInt(ch, 16);
            val = !Number.isNaN(idx) && idx >= 0 && idx < 16 ? idx : ch;
          }
          m.voxels[`${x},${y},${z}`] = val;
        }
      }
    }
  } else if (a.voxels) {
    m.type = 'voxel';
    m.voxels = { ...a.voxels };
  }

  const voxelCount = m.type === 'voxel' ? Object.keys(m.voxels || {}).length : 'gltf';
  return `${isNew ? 'Created' : 'Updated'} model "${m.name}" (${m.type}, ${m.width}x${m.height}x${m.depth}, ${voxelCount} voxels).`;
}

export function getModel(p, ref) {
  const m = findModel(p, ref);
  if (m.type !== 'voxel') return JSON.stringify(m, null, 2);
  const voxels = m.voxels || {};
  const slices = [];
  for (let y = 0; y < m.height; y++) {
    const slice = [];
    for (let z = 0; z < m.depth; z++) {
      let row = '';
      for (let x = 0; x < m.width; x++) {
        const v = voxels[`${x},${y},${z}`];
        if (v === undefined) row += '.';
        else if (typeof v === 'number' && v >= 0 && v < 16) row += v.toString(16);
        else row += '#';
      }
      slice.push(row);
    }
    slices.push(slice);
  }
  return `Model "${m.name}" (${m.width}x${m.height}x${m.depth})\n` + slices.map((s, y) => `--- Y = ${y} ---\n${s.join('\n')}`).join('\n\n');
}

// ---------- scènes 3D ----------
export function upsertScene3D(p, a) {
  p.scenes3d ||= [];
  let sc = p.scenes3d.find((x) => x.name === a.name);
  const isNew = !sc;
  if (!sc) {
    sc = createScene3D(a.name);
    p.scenes3d.push(sc);
    if (a.start || p.scenes3d.length === 1) {
      p.settings.startScene3DId = sc.id;
    }
  }
  if (a.environment) {
    sc.environment = { ...sc.environment, ...a.environment };
  }
  if (a.start) {
    p.settings.startScene3DId = sc.id;
  }
  return `${isNew ? 'Created' : 'Updated'} 3D scene "${sc.name}".`;
}

export function paintGridMap(p, a) {
  const sc = findScene3D(p, a.scene);
  sc.gridmap ||= { blockSize: 1, blocks: {} };
  sc.gridmap.blocks ||= {};
  const y = a.level ?? 0;
  const x0 = a.x ?? 0;
  const z0 = a.z ?? 0;
  const legend = a.legend || {};
  let count = 0;

  for (let z = 0; z < a.rows.length; z++) {
    const row = a.rows[z];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ' ') continue;
      const wx = x0 + x;
      const wz = z0 + z;
      const key = `${wx},${y},${wz}`;
      if (ch === '.') {
        delete sc.gridmap.blocks[key];
      } else {
        let val = legend[ch];
        if (val === undefined) {
          if (/^[0-9a-fA-F]$/.test(ch)) {
            val = parseInt(ch, 16);
          } else {
            throw new Error(`row ${z}, col ${x}: unknown character "${ch}" (must be 0-9a-f for palette index, "." to erase, " " to leave unchanged, or define in legend: {"${ch}": 0-15})`);
          }
        } else {
          if (typeof val === 'string' && /^[0-9a-fA-F]$/.test(val)) val = parseInt(val, 16);
          const isValidInt = Number.isInteger(val) && val >= 0 && val < 16;
          const isValidHex = typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val);
          if (!isValidInt && !isValidHex) {
            throw new Error(`legend value for "${ch}" must be a palette index 0-15 or "#rrggbb" hex (got ${JSON.stringify(val)})`);
          }
        }
        sc.gridmap.blocks[key] = val;
        count++;
      }
    }
  }
  return `Painted ${count} block(s) on level Y=${y} of 3D scene "${sc.name}".`;
}

export function placeEntities(p, a) {
  const is3D = a.scene || (p.settings.dimension === '3d' && (p.scenes3d || []).some((s) => s.name === a.map || s.id === a.map));
  if (is3D) {
    const sc = findScene3D(p, a.scene || a.map);
    const mode = a.mode || 'append';
    const added = [];
    const make3D = (obj, x, y, z, props) => {
      const o = findObject(p, obj);
      added.push({ id: uid('ent'), objectId: o.id, x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0, props: props || {} });
    };
    for (const e of a.entities || []) make3D(e.object, e.x, e.y, e.z, e.props);
    if (a.rows) {
      const legend = a.legend || {};
      const y = a.level ?? 0;
      a.rows.forEach((row, z) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ') continue;
          if (!(ch in legend)) throw new Error(`row ${z}, col ${x}: character "${ch}" is not in legend (legend: {"${ch}": "ObjectName"})`);
          make3D(legend[ch], x, y, z, null);
        }
      });
    }
    if (mode === 'replace') sc.entities = added; else sc.entities.push(...added);
    const counts = {};
    for (const e of added) { const n = p.objects.find((o) => o.id === e.objectId).name; counts[n] = (counts[n] || 0) + 1; }
    return `${mode === 'replace' ? 'Replaced entities of' : 'Added to'} 3D scene "${sc.name}": ${Object.entries(counts).map(([n, c]) => `${c}x${n}`).join(', ') || 'nothing'}; scene now has ${sc.entities.length} entities.`;
  }

  const m = findMap(p, a.map);
  const mode = a.mode || 'append';
  const added = [];
  const make = (obj, x, y, props) => {
    const o = findObject(p, obj);
    added.push({ id: uid('ent'), objectId: o.id, x: Math.round(x), y: Math.round(y), props: props || {} });
  };
  for (const e of a.entities || []) make(e.object, e.x, e.y, e.props);
  if (a.rows) {
    const legend = a.legend || {};
    a.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        if (!(ch in legend)) throw new Error(`row ${j}, col ${i}: character "${ch}" is not in legend (legend: {"${ch}": "ObjectName"})`);
        const o = findObject(p, legend[ch]);
        const sp = p.sprites.find((s) => s.id === o.spriteId);
        // posé en bas à gauche de la case : un sprite plus grand que la tuile « se tient » sur la case
        make(o.name, i * m.tileSize, j * m.tileSize + m.tileSize - (sp ? sp.height : m.tileSize), null);
      }
    });
  }
  if (mode === 'replace') m.entities = added; else m.entities.push(...added);
  const counts = {};
  for (const e of added) { const n = p.objects.find((o) => o.id === e.objectId).name; counts[n] = (counts[n] || 0) + 1; }
  return `${mode === 'replace' ? 'Replaced entities of' : 'Added to'} "${m.name}": ${Object.entries(counts).map(([n, c]) => `${c}x${n}`).join(', ') || 'nothing'}; map now has ${m.entities.length} entities.`;
}

// ---------- sons ----------
export function addSound(p, a) {
  if (!SOUND_PRESETS.includes(a.preset)) throw new Error(`unknown preset "${a.preset}" (presets: ${SOUND_PRESETS.join(', ')})`);
  p.sounds ||= [];
  let s = p.sounds.find((x) => x.name === a.name);
  const isNew = !s;
  if (!s) { s = { id: uid('snd'), name: a.name }; p.sounds.push(s); }
  s.kind = 'sfx';
  s.sfx = { preset: a.preset, seed: s.sfx?.seed ?? 0, volume: a.volume ?? 0.5, pitch: a.pitch ?? 1 };
  return `${isNew ? 'Added' : 'Updated'} sound "${a.name}" (${a.preset}, volume ${s.sfx.volume}, pitch ${s.sfx.pitch}).`;
}

// ---------- musiques (songs) ----------
export function upsertSong(p, a) {
  if (!a.name) throw new Error('song name is required');
  p.songs ||= [];
  let songData;
  if (a.text) {
    songData = parseSongText(a.text, a.name);
    if (a.name) songData.name = a.name;
    if (a.bpm) songData.bpm = a.bpm;
  } else if (a.song) {
    songData = Object.assign({}, a.song, { name: a.name });
  } else {
    songData = parseSongText('', a.name);
    if (a.bpm) songData.bpm = a.bpm;
  }

  let existing = p.songs.find((s) => s.name === a.name || (s.id && s.id === a.id));
  const isNew = !existing;
  if (existing) {
    songData.id = existing.id;
    const idx = p.songs.indexOf(existing);
    p.songs[idx] = songData;
  } else {
    if (!songData.id) songData.id = uid('sng');
    p.songs.push(songData);
  }

  const numChannels = (songData.channels || []).length;
  const numPatterns = (songData.patterns || []).length;
  return `${isNew ? 'Created' : 'Updated'} song "${songData.name}" (BPM ${songData.bpm}, ${numChannels} channels, ${numPatterns} patterns).`;
}

export function getSongText(p, nameOrId) {
  p.songs ||= [];
  const s = p.songs.find((x) => x.name === nameOrId || x.id === nameOrId);
  if (!s) throw new Error(`song "${nameOrId}" not found`);
  return songToText(s);
}

