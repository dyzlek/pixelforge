// Sprites décrits en texte ⇄ images PNG (dataURL).
// Une frame = tableau de lignes ; un caractère par pixel :
//   '.' (ou ' ') = transparent · '0'-'9','a'-'f' = index dans la palette du projet · autre caractère = clé de `legend`.
import { encodePNG, pngToDataURL, dataURLToBuffer, decodePNG } from './png.js';

const HEX = '0123456789abcdef';

export function parseColor(str) {
  const s = String(str).trim().toLowerCase();
  if (s === 'transparent' || s === 'none') return [0, 0, 0, 0];
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (!m) throw new Error(`invalid colour "${str}" (use #rgb, #rrggbb or #rrggbbaa)`);
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
}

export const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// frames : string[][] → { width, height, frames: dataURL[] }
// Les lignes plus courtes que la largeur sont complétées par du transparent (à droite / en bas).
export function textToFrames(frames, palette, legend = {}, size = {}) {
  if (!Array.isArray(frames) || !frames.length) throw new Error('frames must be a non-empty array of frames (each frame = array of strings)');
  for (const f of frames) if (!Array.isArray(f) || !f.length || f.some((r) => typeof r !== 'string')) throw new Error('each frame must be a non-empty array of strings (one string per pixel row)');
  const width = size.width || Math.max(...frames.flat().map((r) => r.length));
  const height = size.height || Math.max(...frames.map((f) => f.length));
  const colors = {};
  for (const [k, v] of Object.entries(legend || {})) {
    if (k.length !== 1) throw new Error(`legend key "${k}" must be a single character`);
    colors[k] = parseColor(v);
  }
  const pal = palette.map(parseColor);
  const urls = frames.map((rows, fi) => {
    const rgba = new Uint8Array(width * height * 4);
    rows.forEach((row, y) => {
      if (y >= height) throw new Error(`frame ${fi}: more than ${height} rows`);
      if (row.length > width) throw new Error(`frame ${fi}, row ${y}: ${row.length} chars, wider than ${width}`);
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        let c;
        if (colors[ch]) c = colors[ch];
        else if (ch === '.' || ch === ' ') continue;
        else if (HEX.includes(ch)) c = pal[HEX.indexOf(ch)];
        else throw new Error(`frame ${fi}, row ${y}, col ${x}: unknown character "${ch}" (add it to legend, e.g. {"${ch}": "#ff0000"})`);
        if (!c) throw new Error(`palette has no colour #${HEX.indexOf(ch)}`);
        rgba.set(c, (y * width + x) * 4);
      }
    });
    return pngToDataURL(encodePNG(width, height, rgba));
  });
  return { width, height, frames: urls };
}

// dataURL[] → { frames: string[][], legend } (couleurs hors palette → lettres majuscules dans la légende)
export function framesToText(dataURLs, palette) {
  const pal = new Map(palette.map((c, i) => [toHex(parseColor(c)), HEX[i]]));
  const legend = {}, letterOf = new Map();
  const spare = [...'GHIJKLMNOPQRSTUVWXYZ'];
  const frames = dataURLs.map((url) => {
    const { width, height, data } = decodePNG(dataURLToBuffer(url));
    const rows = [];
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        if (data[o + 3] < 128) { row += '.'; continue; }
        const hex = toHex([data[o], data[o + 1], data[o + 2]]);
        let ch = pal.get(hex);
        if (!ch) {
          if (!letterOf.has(hex)) {
            const l = spare.shift() || '?';
            letterOf.set(hex, l);
            legend[l] = hex;
          }
          ch = letterOf.get(hex);
        }
        row += ch;
      }
      rows.push(row);
    }
    return rows;
  });
  return { frames, legend };
}
