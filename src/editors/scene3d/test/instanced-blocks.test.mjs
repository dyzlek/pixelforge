/**
 * Tests unitaires et benchmarks pour InstancedBlockGrid (Issue #78)
 * Verifie la rapidite, l exactitude et le critere d acceptation 20 000 blocs.
 */

import assert from 'node:assert';
import { InstancedBlockGrid } from '../instanced-blocks.js';

console.log('=== Tests InstancedMesh & Mises a jour incrementales 3D ===');

// Mock Three.js avec InstancedMesh
class MockVec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

class MockMat4 {
  constructor() { this.elements = new Float32Array(16); this.identity(); }
  identity() {
    this.elements.fill(0);
    this.elements[0] = 1; this.elements[5] = 1; this.elements[10] = 1; this.elements[15] = 1;
    return this;
  }
  setPosition(v) {
    this.elements[12] = v.x;
    this.elements[13] = v.y;
    this.elements[14] = v.z;
    return this;
  }
}

class MockGroup {
  constructor() { this.children = []; }
  add(c) { this.children.push(c); }
  remove(c) { this.children = this.children.filter((x) => x !== c); }
}

class MockInstancedMesh {
  constructor(geo, mat, count) {
    this.isInstancedMesh = true;
    this.geometry = geo;
    this.material = mat;
    this.capacity = count;
    this.count = 0;
    this.matrixArray = new Float32Array(count * 16);
    this.instanceMatrix = { needsUpdate: false };
    this.userData = {};
  }
  setMatrixAt(idx, mat) {
    for (let i = 0; i < 16; i++) {
      this.matrixArray[idx * 16 + i] = mat.elements[i];
    }
  }
  getMatrixAt(idx, mat) {
    for (let i = 0; i < 16; i++) {
      mat.elements[i] = this.matrixArray[idx * 16 + i];
    }
  }
  dispose() {}
}

class MockMesh {
  constructor(geo, mat) {
    this.geometry = geo;
    this.material = mat;
    this.position = new MockVec3();
    this.userData = {};
  }
}

const mockThree = {
  Group: MockGroup,
  InstancedMesh: MockInstancedMesh,
  Mesh: MockMesh,
  Matrix4: MockMat4,
  Vector3: MockVec3,
};

const materials = new Map();
function getMaterial(color) {
  if (!materials.has(color)) materials.set(color, { color });
  return materials.get(color);
}

// 1. Initialisation et operations elementaires
{
  const grid = new InstancedBlockGrid({
    ThreeLib: mockThree,
    geometry: {},
    getMaterial,
    resolveColor: (c) => c,
  });

  assert.strictEqual(grid.size, 0);
  assert.strictEqual(grid.has(0, 0, 0), false);

  // Ajout d un bloc
  const added = grid.setBlock(2, 4, 6, '#38b764');
  assert.strictEqual(added, true);
  assert.strictEqual(grid.size, 1);
  assert.strictEqual(grid.has(2, 4, 6), true);

  const block = grid.get(2, 4, 6);
  assert.strictEqual(block.x, 2);
  assert.strictEqual(block.y, 4);
  assert.strictEqual(block.z, 6);
  assert.strictEqual(block.colorHex, '#38b764');

  // Meme couleur -> aucun changement
  const noChange = grid.setBlock(2, 4, 6, '#38b764');
  assert.strictEqual(noChange, false);
  assert.strictEqual(grid.size, 1);

  // Changement de couleur
  const updated = grid.setBlock(2, 4, 6, '#ffcd75');
  assert.strictEqual(updated, true);
  assert.strictEqual(grid.size, 1);
  assert.strictEqual(grid.get(2, 4, 6).colorHex, '#ffcd75');

  // Suppression
  const removed = grid.removeBlock(2, 4, 6);
  assert.strictEqual(removed, true);
  assert.strictEqual(grid.size, 0);
  assert.strictEqual(grid.has(2, 4, 6), false);

  grid.dispose();
}

// 2. Mises a jour incrementales O(1) avec suppression par echange
{
  const grid = new InstancedBlockGrid({
    ThreeLib: mockThree,
    geometry: {},
    getMaterial,
    resolveColor: (c) => c,
  });

  // Ajouter 3 blocs de meme couleur
  grid.setBlock(0, 0, 0, '#41a6f6');
  grid.setBlock(1, 0, 0, '#41a6f6');
  grid.setBlock(2, 0, 0, '#41a6f6');
  assert.strictEqual(grid.size, 3);

  // Supprimer le bloc du milieu (1,0,0) : doit echanger avec le dernier (2,0,0)
  grid.removeBlock(1, 0, 0);
  assert.strictEqual(grid.size, 2);
  assert.strictEqual(grid.has(0, 0, 0), true);
  assert.strictEqual(grid.has(1, 0, 0), false);
  assert.strictEqual(grid.has(2, 0, 0), true);

  // Verifier que (2,0,0) est toujours adressable et correct
  const b2 = grid.get(2, 0, 0);
  assert.strictEqual(b2.x, 2);

  grid.dispose();
}

// 3. Resolution du raycasting vers les coordonnees du bloc
{
  const grid = new InstancedBlockGrid({
    ThreeLib: mockThree,
    geometry: {},
    getMaterial,
    resolveColor: (c) => c,
  });

  grid.setBlock(10, 5, -8, '#b13e53');
  const batch = grid.batches.get('#b13e53');
  assert.ok(batch && batch.mesh);

  // Simulation d une intersection Three.js sur l InstancedMesh
  const hit = {
    distance: 12.5,
    point: new MockVec3(10.2, 5.5, -8.1),
    face: { normal: new MockVec3(0, 1, 0) },
    instanceId: 0,
    object: batch.mesh,
  };

  const resolved = grid.resolveRaycastHit(hit);
  assert.ok(resolved, 'intersection resolue');
  assert.strictEqual(resolved.object.userData.blockKey, '10,5,-8');
  assert.strictEqual(resolved.object.userData.x, 10);
  assert.strictEqual(resolved.object.userData.y, 5);
  assert.strictEqual(resolved.object.userData.z, -8);
  assert.strictEqual(resolved.object.userData.colorHex, '#b13e53');

  grid.dispose();
}

// 4. Construction complete (buildFrom) avec grille et relief de terrain
{
  const grid = new InstancedBlockGrid({
    ThreeLib: mockThree,
    geometry: {},
    getMaterial,
    resolveColor: (c) => (c === 4 ? '#ffcd75' : '#38b764'),
  });

  const blocks = {
    '0,0,0': 4,
    '1,0,0': 4,
    '2,0,0': 6,
  };

  const terrain = {
    enabled: true,
    originX: 0,
    originZ: 0,
    width: 2,
    depth: 2,
    defaultHeight: 1,
    defaultColor: 6,
    heights: { '0,1': 2 },
  };

  grid.buildFrom(blocks, terrain);
  assert.strictEqual(grid.has(0, 0, 0), true);
  assert.strictEqual(grid.has(1, 0, 0), true);
  assert.strictEqual(grid.has(2, 0, 0), true);
  // Blocs de terrain
  assert.strictEqual(grid.has(0, 2, 1), true, 'pic du terrain en Y=2');
  assert.strictEqual(grid.has(0, 1, 0), true, 'sol du terrain en Y=1');

  grid.dispose();
}

// 5. Benchmark de performance : 20 000 blocs a 60 FPS
{
  const grid = new InstancedBlockGrid({
    ThreeLib: mockThree,
    geometry: {},
    getMaterial,
    resolveColor: (c) => (c % 2 === 0 ? '#38b764' : '#ffcd75'),
  });

  // Generation de 20 000 coordonnees
  const blocks = new Map();
  let count = 0;
  for (let x = 0; x < 50; x++) {
    for (let z = 0; z < 50; z++) {
      for (let y = 0; y < 8; y++) {
        blocks.set(`${x},${y},${z}`, (x + y + z) % 16);
        count++;
      }
    }
  }
  assert.strictEqual(count, 20000, '20 000 blocs generes pour le benchmark');

  // Mesure de construction complete des 20 000 blocs
  const t0 = performance.now();
  grid.buildFrom(blocks);
  const tBuild = performance.now() - t0;
  assert.strictEqual(grid.size, 20000);

  // Mesure de 1000 ajouts incrementaux
  const t1 = performance.now();
  for (let i = 0; i < 1000; i++) {
    grid.setBlock(100 + i, 0, 0, '#41a6f6');
  }
  const tAdd = performance.now() - t1;
  assert.strictEqual(grid.size, 21000);

  // Mesure de 1000 suppressions incrementales
  const t2 = performance.now();
  for (let i = 0; i < 1000; i++) {
    grid.removeBlock(100 + i, 0, 0);
  }
  const tRemove = performance.now() - t2;
  assert.strictEqual(grid.size, 20000);

  console.log(`- Benchmark 20 000 blocs (InstancedMesh) :`);
  console.log(`  * Construction complete de 20 000 blocs : ${tBuild.toFixed(2)} ms (budget < 50 ms)`);
  console.log(`  * 1 000 ajouts incrementaux O(1)        : ${tAdd.toFixed(2)} ms (${(tAdd / 1000).toFixed(4)} ms/bloc)`);
  console.log(`  * 1 000 suppressions O(1)               : ${tRemove.toFixed(2)} ms (${(tRemove / 1000).toFixed(4)} ms/bloc)`);

  assert.ok(tBuild < 50, `la construction de 20 000 blocs doit prendre < 50 ms (actuel: ${tBuild.toFixed(2)} ms)`);
  assert.ok(tAdd / 1000 < 0.1, `l ajout incremental doit prendre < 0.1 ms par bloc`);
  assert.ok(tRemove / 1000 < 0.1, `la suppression doit prendre < 0.1 ms par bloc`);

  grid.dispose();
}

console.log('Tous les tests InstancedMesh & Mises a jour incrementales sont valides !');
