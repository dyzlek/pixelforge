// Miniature d'un jeu : carte de départ (tuiles des calques visibles + entités) en PNG 240×135.

const THUMB_W = 240;
const THUMB_H = 135;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderThumbnail(project) {
  const s = project.settings;
  const map = project.maps.find((m) => m.id === s.startMapId) || project.maps[0];
  if (!map) return null;
  const ts = map.tileSize || s.tileSize || 16;
  const mapW = map.width * ts;
  const mapH = map.height * ts;
  // Zone visible au départ : la taille de la vue de jeu, depuis le coin haut-gauche
  const regionW = Math.max(1, Math.min(mapW, s.width || 320));
  const regionH = Math.max(1, Math.min(mapH, s.height || 180));

  const cache = new Map();
  const frame = async (sprite, index) => {
    const src = sprite?.frames?.[index];
    if (!src) return null;
    if (!cache.has(src)) cache.set(src, loadImage(src));
    return cache.get(src);
  };

  const off = document.createElement('canvas');
  off.width = regionW;
  off.height = regionH;
  const ctx = off.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = map.background || s.background || '#000';
  ctx.fillRect(0, 0, regionW, regionH);

  const tileset = project.sprites.find((sp) => sp.id === map.tilesetSpriteId);
  const drawLayers = async (depth) => {
    for (const layer of map.layers) {
      if (layer.visible === false || (layer.depth || 'below') !== depth || !tileset) continue;
      const x1 = Math.min(map.width, Math.ceil(regionW / ts));
      const y1 = Math.min(map.height, Math.ceil(regionH / ts));
      for (let ty = 0; ty < y1; ty++) {
        for (let tx = 0; tx < x1; tx++) {
          const idx = layer.data[ty * map.width + tx];
          if (idx < 0 || idx == null) continue;
          const img = await frame(tileset, idx);
          if (img) ctx.drawImage(img, tx * ts, ty * ts);
        }
      }
    }
  };

  await drawLayers('below');
  for (const e of map.entities || []) {
    const obj = project.objects.find((o) => o.id === e.objectId);
    const sprite = project.sprites.find((sp) => sp.id === obj?.spriteId);
    if (!sprite) continue;
    const anim = sprite.animations?.find((a) => a.name === obj.defaultAnim);
    const img = await frame(sprite, anim?.frames?.[0] ?? 0);
    if (img) ctx.drawImage(img, Math.round(e.x), Math.round(e.y));
  }
  await drawLayers('above');

  const out = document.createElement('canvas');
  out.width = THUMB_W;
  out.height = THUMB_H;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.fillStyle = s.background || '#000';
  octx.fillRect(0, 0, THUMB_W, THUMB_H);
  const scale = Math.min(THUMB_W / regionW, THUMB_H / regionH);
  const w = Math.round(regionW * scale);
  const h = Math.round(regionH * scale);
  octx.drawImage(off, Math.round((THUMB_W - w) / 2), Math.round((THUMB_H - h) / 2), w, h);
  return out.toDataURL('image/png');
}
