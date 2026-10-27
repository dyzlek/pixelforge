/**
 * PixelForge Studio — Gestionnaire de blocs 3D optimisé avec InstancedMesh
 * Permet d'afficher et manipuler plus de 20 000 blocs à 60 FPS avec mises à jour
 * incrémentales O(1) et un nombre minimal de draw calls (groupés par couleur).
 *
 * Fonctionne sans dépendance DOM (testable sous Node et dans le navigateur).
 */

export class InstancedBlockGrid {
  /**
   * @param {object} options
   * @param {object} options.ThreeLib - Bibliothèque Three.js (Mesh, InstancedMesh, Matrix4, Vector3...)
   * @param {object} options.geometry - Géométrie partagée pour un bloc (ex. BoxGeometry(1, 1, 1))
   * @param {Function} options.getMaterial - Fonction (colorHex) -> Material Three.js partagé
   * @param {Function} [options.resolveColor] - Fonction (colorVal) -> '#rrggbb'
   */
  constructor({ ThreeLib, geometry, getMaterial, resolveColor }) {
    this.ThreeLib = ThreeLib;
    this.geometry = geometry;
    this.getMaterial = getMaterial;
    this.resolveColor = resolveColor || ((c) => (typeof c === 'string' && c.startsWith('#') ? c : '#38b764'));

    this.group = new (ThreeLib.Group || class {
      constructor() { this.children = []; }
      add(c) { this.children.push(c); }
      remove(c) { this.children = this.children.filter((x) => x !== c); }
    })();

    // colorHex -> Batch { colorHex, mesh, capacity, count, instances: [{ key, x, y, z, isTerrain }] }
    this.batches = new Map();

    // blockKey ("x,y,z") -> { colorHex, index, isTerrain }
    this.keyMap = new Map();

    this.useInstancing = typeof ThreeLib.InstancedMesh === 'function';
    this.dummyMatrix = ThreeLib.Matrix4 ? new ThreeLib.Matrix4() : null;
    this.dummyPosition = ThreeLib.Vector3 ? new ThreeLib.Vector3() : null;

    // Mode repli (Mesh par bloc) si InstancedMesh n'est pas disponible
    this.fallbackMeshes = new Map();
  }

  /**
   * Retourne le nombre total de blocs actifs.
   */
  get size() {
    return this.keyMap.size;
  }

  /**
   * Verifie si un bloc existe a ces coordonnees.
   */
  has(x, y, z) {
    return this.keyMap.has(`${x},${y},${z}`);
  }

  /**
   * Obtient les informations d'un bloc par coordonnees.
   */
  get(x, y, z) {
    const key = `${x},${y},${z}`;
    const entry = this.keyMap.get(key);
    if (!entry) return null;
    const batch = this.batches.get(entry.colorHex);
    return batch ? batch.instances[entry.index] : null;
  }

  /**
   * Assure la capacite d'un batch InstancedMesh.
   * @private
   */
  _ensureCapacity(batch, needed) {
    if (!this.useInstancing) return;
    if (needed <= batch.capacity) return;

    const newCap = Math.max(64, Math.max(needed, batch.capacity * 2));
    const mat = this.getMaterial(batch.colorHex);
    const newMesh = new this.ThreeLib.InstancedMesh(this.geometry, mat, newCap);
    newMesh.castShadow = true;
    newMesh.receiveShadow = true;
    newMesh.userData = { batch };

    if (batch.mesh) {
      // Recopie des matrices existantes
      const m = this.dummyMatrix;
      for (let i = 0; i < batch.count; i++) {
        batch.mesh.getMatrixAt(i, m);
        newMesh.setMatrixAt(i, m);
      }
      this.group.remove(batch.mesh);
      if (typeof batch.mesh.dispose === 'function') batch.mesh.dispose();
    }

    newMesh.count = batch.count;
    if (newMesh.instanceMatrix) newMesh.instanceMatrix.needsUpdate = true;
    batch.mesh = newMesh;
    batch.capacity = newCap;
    this.group.add(newMesh);
  }

  /**
   * Obtient ou cree un batch pour une couleur donnee.
   * @private
   */
  _getOrCreateBatch(colorHex, initialCapacity = 64) {
    let batch = this.batches.get(colorHex);
    if (!batch) {
      batch = {
        colorHex,
        mesh: null,
        capacity: 0,
        count: 0,
        instances: [],
      };
      if (this.useInstancing) {
        this._ensureCapacity(batch, initialCapacity);
      }
      this.batches.set(colorHex, batch);
    }
    return batch;
  }

  /**
   * Ajoute ou met a jour un bloc de maniere purement incrementale (O(1)).
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string|number} colorVal
   * @param {boolean} [isTerrain=false]
   * @returns {boolean} true si le bloc a ete ajoute ou modifie
   */
  setBlock(x, y, z, colorVal, isTerrain = false) {
    const key = `${x},${y},${z}`;
    const colorHex = this.resolveColor(colorVal);

    if (this.keyMap.has(key)) {
      const current = this.keyMap.get(key);
      if (current.colorHex === colorHex && current.isTerrain === isTerrain) {
        return false; // aucun changement
      }
      this.removeBlock(x, y, z);
    }

    if (!this.useInstancing) {
      // Repli Mesh unitaire
      const mat = this.getMaterial(colorHex);
      const mesh = new this.ThreeLib.Mesh(this.geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, y, z);
      mesh.userData = { blockKey: key, x, y, z, isTerrain, colorHex };
      this.group.add(mesh);
      this.fallbackMeshes.set(key, mesh);
      this.keyMap.set(key, { colorHex, index: -1, isTerrain });
      return true;
    }

    const batch = this._getOrCreateBatch(colorHex, 64);
    this._ensureCapacity(batch, batch.count + 1);

    const idx = batch.count;
    if (this.dummyMatrix && this.dummyPosition) {
      this.dummyPosition.set(x, y, z);
      this.dummyMatrix.identity();
      this.dummyMatrix.setPosition(this.dummyPosition);
      batch.mesh.setMatrixAt(idx, this.dummyMatrix);
    }

    const instData = { key, x, y, z, isTerrain, colorHex };
    batch.instances[idx] = instData;
    batch.count++;
    batch.mesh.count = batch.count;
    if (batch.mesh.instanceMatrix) batch.mesh.instanceMatrix.needsUpdate = true;

    this.keyMap.set(key, { colorHex, index: idx, isTerrain });
    return true;
  }

  /**
   * Supprime un bloc de maniere purement incrementale (O(1)).
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean} true si un bloc a ete retire
   */
  removeBlock(x, y, z) {
    const key = `${x},${y},${z}`;
    const entry = this.keyMap.get(key);
    if (!entry) return false;

    if (!this.useInstancing) {
      const mesh = this.fallbackMeshes.get(key);
      if (mesh) {
        this.group.remove(mesh);
        this.fallbackMeshes.delete(key);
      }
      this.keyMap.delete(key);
      return true;
    }

    const batch = this.batches.get(entry.colorHex);
    if (!batch) {
      this.keyMap.delete(key);
      return true;
    }

    const idx = entry.index;
    const lastIdx = batch.count - 1;

    if (idx < lastIdx) {
      // Echange avec le dernier element pour suppression O(1)
      if (this.dummyMatrix) {
        batch.mesh.getMatrixAt(lastIdx, this.dummyMatrix);
        batch.mesh.setMatrixAt(idx, this.dummyMatrix);
      }
      const moved = batch.instances[lastIdx];
      batch.instances[idx] = moved;
      this.keyMap.set(moved.key, { colorHex: entry.colorHex, index: idx, isTerrain: moved.isTerrain });
    }

    batch.instances.pop();
    batch.count--;
    batch.mesh.count = batch.count;
    if (batch.mesh.instanceMatrix) batch.mesh.instanceMatrix.needsUpdate = true;

    this.keyMap.delete(key);
    return true;
  }

  /**
   * Reconstruit l'ensemble des blocs a partir d'une map de grille et du terrain.
   * Optimise en un seul passage pour charger instantanement plus de 20 000 blocs.
   *
   * @param {Map|object} gridBlocks - Map ou Record "x,y,z" => couleur
   * @param {object} [terrain] - Donnees de terrain sculptable
   */
  buildFrom(gridBlocks, terrain = null) {
    this.clear();

    // 1. Rassemblement et dedoublonnage des blocs
    // colorHex -> array de { key, x, y, z, isTerrain }
    const grouped = new Map();

    const addCoord = (x, y, z, val, isTerrain = false) => {
      const key = `${x},${y},${z}`;
      if (this.keyMap.has(key)) return;
      const colorHex = this.resolveColor(val);
      let list = grouped.get(colorHex);
      if (!list) {
        list = [];
        grouped.set(colorHex, list);
      }
      list.push({ key, x, y, z, isTerrain, colorHex });
      this.keyMap.set(key, { colorHex, index: list.length - 1, isTerrain });
    };

    // Blocs de grille
    if (gridBlocks instanceof Map) {
      for (const [key, val] of gridBlocks.entries()) {
        const parts = key.split(',').map(Number);
        if (parts.length === 3 && parts.every(Number.isInteger)) {
          addCoord(parts[0], parts[1], parts[2], val, false);
        }
      }
    } else if (gridBlocks && typeof gridBlocks === 'object') {
      for (const [key, val] of Object.entries(gridBlocks)) {
        const parts = key.split(',').map(Number);
        if (parts.length === 3 && parts.every(Number.isInteger)) {
          addCoord(parts[0], parts[1], parts[2], val, false);
        }
      }
    }

    // Surface superieure du terrain sculpte
    if (terrain && terrain.enabled !== false) {
      const minX = typeof terrain.originX === 'number' ? terrain.originX : -16;
      const maxX = minX + (terrain.width || 32) - 1;
      const minZ = typeof terrain.originZ === 'number' ? terrain.originZ : -16;
      const maxZ = minZ + (terrain.depth || 32) - 1;
      const defaultH = typeof terrain.defaultHeight === 'number' ? terrain.defaultHeight : 0;
      const defaultCol = terrain.defaultColor != null ? terrain.defaultColor : 6;
      const heights = terrain.heights || {};
      const colors = terrain.colors || {};

      const cols = new Set();
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          cols.add(`${x},${z}`);
        }
      }
      for (const k of Object.keys(heights)) cols.add(k);
      for (const k of Object.keys(colors)) cols.add(k);

      for (const k of cols) {
        const parts = k.split(',').map((v) => parseInt(v, 10));
        if (parts.length !== 2) continue;
        const [tx, tz] = parts;
        const h = heights[k] !== undefined ? heights[k] : defaultH;
        const topY = Math.round(h);
        const colVal = colors[k] !== undefined ? colors[k] : defaultCol;
        addCoord(tx, topY, tz, colVal, true);
      }
    }

    // 2. Construction rapide des InstancedMesh (ou repli Mesh)
    if (!this.useInstancing) {
      for (const list of grouped.values()) {
        for (const item of list) {
          const mat = this.getMaterial(item.colorHex);
          const mesh = new this.ThreeLib.Mesh(this.geometry, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(item.x, item.y, item.z);
          mesh.userData = { blockKey: item.key, x: item.x, y: item.y, z: item.z, isTerrain: item.isTerrain, colorHex: item.colorHex };
          this.group.add(mesh);
          this.fallbackMeshes.set(item.key, mesh);
        }
      }
      return;
    }

    for (const [colorHex, list] of grouped.entries()) {
      const cap = Math.max(64, list.length);
      const batch = this._getOrCreateBatch(colorHex, cap);
      batch.count = list.length;
      batch.instances = list;

      const m = this.dummyMatrix;
      const p = this.dummyPosition;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (m && p) {
          p.set(item.x, item.y, item.z);
          m.identity();
          m.setPosition(p);
          batch.mesh.setMatrixAt(i, m);
        }
      }
      batch.mesh.count = batch.count;
      if (batch.mesh.instanceMatrix) batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Resout un coup de raycast Three.js vers les coordonnees du bloc.
   *
   * @param {object} hit - Intersection retournee par Three.js Raycaster
   * @returns {{ distance: number, point: object, face: object, object: { position: object, userData: object } } | null}
   */
  resolveRaycastHit(hit) {
    if (!hit) return null;

    // Si c'est un Mesh unitaire de repli
    if (hit.object?.userData?.blockKey) {
      return hit;
    }

    // Si c'est un InstancedMesh
    const batch = hit.object?.userData?.batch;
    if (batch && hit.instanceId !== undefined && hit.instanceId >= 0) {
      const data = batch.instances[hit.instanceId];
      if (!data) return null;

      const pos = this.ThreeLib.Vector3
        ? new this.ThreeLib.Vector3(data.x, data.y, data.z)
        : { x: data.x, y: data.y, z: data.z };

      return {
        distance: hit.distance,
        point: hit.point,
        face: hit.face,
        instanceId: hit.instanceId,
        object: {
          position: pos,
          userData: {
            blockKey: data.key,
            x: data.x,
            y: data.y,
            z: data.z,
            isTerrain: data.isTerrain,
            colorHex: data.colorHex,
          },
        },
      };
    }

    return null;
  }

  /**
   * Nettoie tous les maillages et instances.
   */
  clear() {
    for (const batch of this.batches.values()) {
      if (batch.mesh) {
        this.group.remove(batch.mesh);
        if (typeof batch.mesh.dispose === 'function') batch.mesh.dispose();
      }
    }
    this.batches.clear();

    for (const mesh of this.fallbackMeshes.values()) {
      this.group.remove(mesh);
    }
    this.fallbackMeshes.clear();
    this.keyMap.clear();
  }

  /**
   * Detruit la grille et libere les ressources.
   */
  dispose() {
    this.clear();
  }
}
