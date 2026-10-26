// Algorithmes de rastérisation purs (aucun accès au DOM) pour l'éditeur pixel art.

export function hexToRgba(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function rgbaToHex(d) {
  return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Ligne de Bresenham : appelle plot(x, y) pour chaque pixel
export function line(x0, y0, x1, y1, plot) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function rect(x0, y0, x1, y1, filled, plot) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  if (filled) {
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) plot(x, y);
    return;
  }
  line(ax, ay, bx, ay, plot);
  line(ax, by, bx, by, plot);
  line(ax, ay, ax, by, plot);
  line(bx, ay, bx, by, plot);
}

// Ellipse inscrite dans la boîte (x0,y0)-(x1,y1) ; le contour = pixels dont un voisin est hors de l'ellipse
export function ellipse(x0, y0, x1, y1, filled, plot) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const rx = (bx - ax) / 2 + 0.5, ry = (by - ay) / 2 + 0.5;
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      if (!inside(x, y)) continue;
      if (filled || !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1))) plot(x, y);
    }
  }
}

// Remplissage par contiguïté (4 voisins) sur une ImageData. Renvoie true si quelque chose a changé.
export function floodFill(img, sx, sy, rgba) {
  const { width: w, height: h } = img;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;
  const px = new Uint32Array(img.data.buffer);
  const fill = ((rgba[3] << 24) | (rgba[2] << 16) | (rgba[1] << 8) | rgba[0]) >>> 0;
  const same = (a, b) => a === b || ((a >>> 24) === 0 && (b >>> 24) === 0);
  const target = px[sy * w + sx];
  if (same(target, fill)) return false;
  const stack = [sy * w + sx];
  while (stack.length) {
    const i = stack.pop();
    if (!same(px[i], target)) continue;
    px[i] = fill;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  return true;
}
