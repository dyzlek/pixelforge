/**
 * PixelForge Studio — Structure de donnees et utilitaires GridMap 3D
 * Gere la collection de blocs d'une scene 3D (placement, suppression, remplissage, limites).
 *
 * Concu sans dependance DOM pour tourner sous Node (tests, CLI, MCP) et dans le navigateur.
 */

// Format stocke dans le projet (scene.gridmap) : { blockSize, blocks: { "x,y,z": couleur } },
// couleur = index de palette (nombre) ou '#rrggbb'. L'ancien format plat { "x,y,z": couleur } est accepte en lecture.
export class GridMap3D {
  constructor(initialData = {}) {
    this.blocks = new Map();
    this.blockSize = 1;
    if (initialData && typeof initialData === 'object') {
      const isWrapped = initialData.blocks && typeof initialData.blocks === 'object';
      if (isWrapped && typeof initialData.blockSize === 'number') this.blockSize = initialData.blockSize;
      const src = isWrapped ? initialData.blocks : initialData;
      Object.entries(src).forEach(([k, v]) => {
        if (GridMap3D.isKey(k) && v != null) this.blocks.set(k, v);
      });
    }
  }

  static key(x, y, z) {
    return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
  }

  static isKey(k) {
    const parts = String(k).split(',');
    return parts.length === 3 && parts.every((p) => p.trim() !== '' && Number.isInteger(Number(p)));
  }

  static parseKey(k) {
    const parts = k.split(',').map((v) => parseInt(v, 10));
    return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
  }

  // Ecrit la grille au format du projet, en conservant les autres champs de l'objet existant
  toProjectJSON(existing = {}) {
    const base = existing && typeof existing === 'object' && existing.blocks ? existing : {};
    return { ...base, blockSize: this.blockSize, blocks: this.toJSON() };
  }

  setBlock(x, y, z, blockInfo) {
    const k = GridMap3D.key(x, y, z);
    if (blockInfo === null || blockInfo === undefined) {
      this.blocks.delete(k);
    } else {
      this.blocks.set(k, blockInfo);
    }
  }

  getBlock(x, y, z) {
    const v = this.blocks.get(GridMap3D.key(x, y, z));
    return v === undefined ? null : v;
  }

  hasBlock(x, y, z) {
    return this.blocks.has(GridMap3D.key(x, y, z));
  }

  removeBlock(x, y, z) {
    return this.blocks.delete(GridMap3D.key(x, y, z));
  }

  /**
   * Remplit un volume rectangulaire de blocs
   */
  fillBox(minX, minY, minZ, maxX, maxY, maxZ, blockInfo) {
    const x0 = Math.min(minX, maxX);
    const x1 = Math.max(minX, maxX);
    const y0 = Math.min(minY, maxY);
    const y1 = Math.max(minY, maxY);
    const z0 = Math.min(minZ, maxZ);
    const z1 = Math.max(minZ, maxZ);

    let count = 0;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          this.setBlock(x, y, z, blockInfo);
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Efface tous les blocs situes a un etage Y donne
   */
  clearLevel(y) {
    const targetY = Math.round(y);
    let count = 0;
    for (const [k] of this.blocks.entries()) {
      const parsed = GridMap3D.parseKey(k);
      if (parsed.y === targetY) {
        this.blocks.delete(k);
        count++;
      }
    }
    return count;
  }

  getBounds() {
    if (this.blocks.size === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, count: 0 };
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const [k] of this.blocks.entries()) {
      const { x, y, z } = GridMap3D.parseKey(k);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    return { minX, maxX, minY, maxY, minZ, maxZ, count: this.blocks.size };
  }

  toJSON() {
    const out = {};
    for (const [k, v] of this.blocks.entries()) {
      out[k] = v;
    }
    return out;
  }
}
