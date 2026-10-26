// Rendu ASCII d'une carte, pour que l'IA « voie » son niveau.
// Tuiles : index en base 36 (0-9 a-z), '.' = vide. Entités : lettre majuscule (initiale de l'objet).

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const tileChar = (t) => (t < 0 ? '.' : t < 36 ? B36[t] : '*');

function ruler(width, pad) {
  const tens = ' '.repeat(pad) + [...Array(width).keys()].map((x) => (x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ')).join('');
  const ones = ' '.repeat(pad) + [...Array(width).keys()].map((x) => x % 10).join('');
  return width > 10 ? [tens, ones] : [ones];
}

function grid(width, height, cell) {
  const pad = String(height - 1).length + 1;
  const lines = ruler(width, pad);
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) row += cell(x, y);
    lines.push(String(y).padStart(pad - 1) + ' ' + row);
  }
  return lines;
}

// Attribue une lettre unique à chaque objet utilisé
function entityLetters(names) {
  const used = new Set(), map = {};
  for (const n of names) {
    const cands = [...n.toUpperCase().replace(/[^A-Z]/g, ''), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    map[n] = cands.find((c) => !used.has(c)) || '#';
    used.add(map[n]);
  }
  return map;
}

export function renderMap(project, mapRef) {
  const m = project.maps.find((x) => x.name === mapRef || x.id === mapRef)
    || project.maps.find((x) => x.name.toLowerCase() === String(mapRef).toLowerCase());
  if (!m) throw new Error(`map "${mapRef}" not found (maps: ${project.maps.map((x) => x.name).join(', ')})`);
  const ts = m.tilesetSpriteId ? project.sprites.find((s) => s.id === m.tilesetSpriteId) : null;
  const out = [];
  out.push(`Map "${m.name}": ${m.width}x${m.height} tiles of ${m.tileSize}px (${m.width * m.tileSize}x${m.height * m.tileSize}px), tileset: ${ts ? `"${ts.name}" (${ts.frames.length} tiles)` : 'none'}, background ${m.background}`);
  out.push(`Tiles: base-36 index (0-9 a-z), '.' = empty. Columns/rows are tile coordinates; pixel = coordinate * ${m.tileSize}.`);

  const objById = new Map(project.objects.map((o) => [o.id, o]));
  const ents = (m.entities || []).map((e) => ({ e, o: objById.get(e.objectId) })).filter((x) => x.o);
  const letters = entityLetters([...new Set(ents.map((x) => x.o.name))]);

  const cellTile = (x, y) => {
    for (let i = m.layers.length - 1; i >= 0; i--) {
      const l = m.layers[i];
      if (l.visible === false) continue;
      const t = l.data[y * m.width + x];
      if (t >= 0) return tileChar(t);
    }
    return '.';
  };
  const entAt = new Map();
  for (const { e, o } of ents) {
    const spr = project.sprites.find((s) => s.id === o.spriteId);
    // la cellule d'une entité = celle de son centre-bas (là où elle « pose les pieds »)
    const cx = Math.floor((e.x + (spr ? spr.width / 2 : 0)) / m.tileSize);
    const cy = Math.floor((e.y + (spr ? spr.height - 1 : 0)) / m.tileSize);
    entAt.set(cx + ',' + cy, letters[o.name]);
  }

  out.push('', 'Combined view (topmost tile of visible layers; ENTITIES in capitals):');
  out.push(...grid(m.width, m.height, (x, y) => entAt.get(x + ',' + y) || cellTile(x, y)));

  if (m.layers.length > 1) {
    for (const l of m.layers) {
      out.push('', `Layer "${l.name}" (${l.collides ? 'collides' : 'no collision'}, ${l.depth || 'below'}${l.visible === false ? ', hidden' : ''}):`);
      out.push(...grid(m.width, m.height, (x, y) => tileChar(l.data[y * m.width + x])));
    }
  } else if (m.layers.length) {
    const l = m.layers[0];
    out.push('', `Layer "${l.name}": ${l.collides ? 'collides' : 'no collision'}, ${l.depth || 'below'}`);
  }

  out.push('', `Entities (${ents.length}):`);
  const byName = {};
  for (const { e, o } of ents) (byName[o.name] ||= []).push(`(${e.x},${e.y})` + (e.props && Object.keys(e.props).length ? JSON.stringify(e.props) : ''));
  for (const [n, pos] of Object.entries(byName)) out.push(`  ${letters[n]} = ${n} x${pos.length}: ${pos.join(' ')}`);
  return out.join('\n');
}
