/**
 * PixelForge Studio — Structure de donnees et utilitaires Terrain 3D (Issue #76)
 * Gere la heightmap d'un paysage sculptable (monter, creuser, lisser, peindre),
 * la generation de blocs solides pour la physique de jeu et le maillage low-poly.
 *
 * Concu sans dependance DOM pour tourner sous Node (tests, CLI, MCP) et dans le navigateur.
 */

export class Terrain3D {
  constructor(initialData = {}) {
    this.enabled = initialData.enabled !== false;
    this.width = typeof initialData.width === 'number' && initialData.width > 0 ? initialData.width : 32;
    this.depth = typeof initialData.depth === 'number' && initialData.depth > 0 ? initialData.depth : 32;
    this.cellSize = typeof initialData.cellSize === 'number' && initialData.cellSize > 0 ? initialData.cellSize : 1;
    this.originX = typeof initialData.originX === 'number' ? initialData.originX : -Math.floor(this.width / 2);
    this.originZ = typeof initialData.originZ === 'number' ? initialData.originZ : -Math.floor(this.depth / 2);
    this.defaultHeight = typeof initialData.defaultHeight === 'number' ? initialData.defaultHeight : 0;
    this.defaultColor = initialData.defaultColor != null ? initialData.defaultColor : 6; // index de palette vert par defaut

    this.heights = new Map();
    this.colors = new Map();

    if (initialData.heights && typeof initialData.heights === 'object') {
      Object.entries(initialData.heights).forEach(([k, v]) => {
        if (Terrain3D.isKey(k) && Number.isFinite(v)) {
          this.heights.set(k, v);
        }
      });
    }

    if (initialData.colors && typeof initialData.colors === 'object') {
      Object.entries(initialData.colors).forEach(([k, v]) => {
        if (Terrain3D.isKey(k) && v != null) {
          this.colors.set(k, v);
        }
      });
    }
  }

  static key(x, z) {
    return `${Math.round(x)},${Math.round(z)}`;
  }

  static isKey(k) {
    const parts = String(k).split(',');
    return parts.length === 2 && parts.every((p) => p.trim() !== '' && Number.isInteger(Number(p)));
  }

  static parseKey(k) {
    const parts = String(k).split(',').map((v) => parseInt(v, 10));
    return { x: parts[0] || 0, z: parts[1] || 0 };
  }

  getHeight(x, z) {
    const k = Terrain3D.key(x, z);
    const v = this.heights.get(k);
    return v !== undefined ? v : this.defaultHeight;
  }

  setHeight(x, z, h) {
    const k = Terrain3D.key(x, z);
    const val = Number.isFinite(h) ? h : this.defaultHeight;
    this.heights.set(k, val);
  }

  getColor(x, z) {
    const k = Terrain3D.key(x, z);
    const c = this.colors.get(k);
    return c !== undefined ? c : this.defaultColor;
  }

  setColor(x, z, c) {
    const k = Terrain3D.key(x, z);
    this.colors.set(k, c);
  }

  /**
   * Monte le terrain dans un rayon donne avec attenuation cosinusoidale douce.
   */
  raise(centerX, centerZ, radius = 2, strength = 1) {
    return this._applyBrush(centerX, centerZ, radius, (currentH, weight) => currentH + strength * weight);
  }

  /**
   * Creuse le terrain dans un rayon donne.
   */
  lower(centerX, centerZ, radius = 2, strength = 1) {
    return this._applyBrush(centerX, centerZ, radius, (currentH, weight) => currentH - strength * weight);
  }

  /**
   * Lisse le terrain dans un rayon donne en interpolant vers la moyenne des voisins.
   */
  smooth(centerX, centerZ, radius = 2, strength = 0.5) {
    const r = Math.max(1, Math.round(radius));
    const cx = Math.round(centerX);
    const cz = Math.round(centerZ);

    // Calcul de la moyenne locale
    let sum = 0;
    let count = 0;
    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= radius) {
          sum += this.getHeight(x, z);
          count++;
        }
      }
    }
    const avg = count > 0 ? sum / count : this.defaultHeight;

    return this._applyBrush(centerX, centerZ, radius, (currentH, weight) => {
      return currentH + (avg - currentH) * Math.min(1, Math.max(0, strength * weight));
    });
  }

  /**
   * Peint la couleur de la surface dans un rayon donne.
   */
  paint(centerX, centerZ, radius = 2, color = 6) {
    const r = Math.max(1, Math.round(radius));
    const cx = Math.round(centerX);
    const cz = Math.round(centerZ);
    let count = 0;

    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= radius) {
          this.setColor(x, z, color);
          count++;
        }
      }
    }
    return count;
  }

  _applyBrush(centerX, centerZ, radius, op) {
    const r = Math.max(1, Math.round(radius));
    const cx = Math.round(centerX);
    const cz = Math.round(centerZ);
    let count = 0;

    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d <= radius) {
          const weight = Math.cos((d / radius) * (Math.PI / 2));
          const currentH = this.getHeight(x, z);
          const newH = op(currentH, weight);
          this.setHeight(x, z, Math.round(newH * 100) / 100);
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Convertit le terrain sculpte en dictionnaire de blocs solides { "x,y,z": color }
   * pour la physique du jeu (AABB et Rapier).
   * Chaque colonne (x, z) de la grille est solide de minY jusqu'a Math.round(height).
   */
  toSolidBlocks(minY = -2) {
    const blocks = {};
    const minX = this.originX;
    const maxX = this.originX + this.width - 1;
    const minZ = this.originZ;
    const maxZ = this.originZ + this.depth - 1;

    // Colonnes definies ou couvertes par les dimensions du terrain
    const cols = new Set();
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        cols.add(Terrain3D.key(x, z));
      }
    }
    for (const k of this.heights.keys()) cols.add(k);
    for (const k of this.colors.keys()) cols.add(k);

    for (const k of cols) {
      const { x, z } = Terrain3D.parseKey(k);
      const topY = Math.round(this.getHeight(x, z));
      const col = this.getColor(x, z);
      const base = Math.min(minY, topY);
      for (let y = base; y <= topY; y++) {
        blocks[`${x},${y},${z}`] = col;
      }
    }

    return blocks;
  }

  toProjectJSON(existing = {}) {
    const base = existing && typeof existing === 'object' ? existing : {};
    return {
      ...base,
      enabled: this.enabled,
      width: this.width,
      depth: this.depth,
      cellSize: this.cellSize,
      originX: this.originX,
      originZ: this.originZ,
      defaultHeight: this.defaultHeight,
      defaultColor: this.defaultColor,
      heights: this.heightsToJSON(),
      colors: this.colorsToJSON(),
    };
  }

  heightsToJSON() {
    const out = {};
    for (const [k, v] of this.heights.entries()) {
      if (v !== this.defaultHeight) out[k] = v;
    }
    return out;
  }

  colorsToJSON() {
    const out = {};
    for (const [k, v] of this.colors.entries()) {
      if (v !== this.defaultColor) out[k] = v;
    }
    return out;
  }
}
