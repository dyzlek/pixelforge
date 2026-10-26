/**
 * Tests unitaires pour l'algorithme de Greedy Meshing Voxel
 */

import assert from 'node:assert';
import { greedyMeshVoxels } from '../mesher.js';

console.log('=== Tests Greedy Mesher Voxel ===');

const palette = ['#1a1c2c', '#ff0000', '#00ff00', '#0000ff'];

// 1. Voxel unique isolé : doit générer exactement 6 faces (12 triangles = 36 sommets)
const singleMesh = greedyMeshVoxels({
  dimX: 4,
  dimY: 4,
  dimZ: 4,
  getVoxel: (x, y, z) => (x === 1 && y === 1 && z === 1 ? 1 : null),
  palette,
  scale: 1,
});

assert.strictEqual(singleMesh.count, 36, 'Un voxel isolé doit générer 36 sommets (6 faces × 2 triangles × 3 sommets)');
assert.strictEqual(singleMesh.positions.length, 36 * 3);
assert.strictEqual(singleMesh.normals.length, 36 * 3);
assert.strictEqual(singleMesh.colors.length, 36 * 3);

// 2. Bloc 2×2×2 de même couleur : le Greedy Meshing DOIT fusionner chaque face en 1 seul quad
// Sans greedy meshing : 6 faces × 4 voxels = 24 quads = 48 triangles = 144 sommets.
// Avec greedy meshing : 6 faces × 1 quad fusionné = 6 quads = 12 triangles = 36 sommets !
const mergedCubeMesh = greedyMeshVoxels({
  dimX: 4,
  dimY: 4,
  dimZ: 4,
  getVoxel: (x, y, z) => (x >= 1 && x <= 2 && y >= 1 && y <= 2 && z >= 1 && z <= 2 ? 1 : null),
  palette,
  scale: 1,
});

assert.strictEqual(
  mergedCubeMesh.count,
  36,
  `Le Greedy Meshing doit fusionner le bloc 2x2x2 en 36 sommets (obtenu : ${mergedCubeMesh.count})`
);

// 3. Couleurs différentes adjacentes : ne doivent pas être fusionnées
const twoColorMesh = greedyMeshVoxels({
  dimX: 4,
  dimY: 4,
  dimZ: 4,
  getVoxel: (x, y, z) => {
    if (x === 1 && y === 1 && z === 1) return 1; // Rouge
    if (x === 2 && y === 1 && z === 1) return 2; // Vert
    return null;
  },
  palette,
  scale: 1,
});

// 2 voxels cote a cote partagent une face interne masquee.
// Faces externes : 10 faces visibles au total.
// 2 faces X externes, 4 faces Y (2 rouges, 2 vertes non fusionnables), 4 faces Z (2 rouges, 2 vertes non fusionnables) = 10 faces = 60 sommets.
assert.strictEqual(twoColorMesh.count, 60, 'Les faces de couleurs distinctes ne doivent pas fusionner');

// 4. La couleur 0 de la palette est un voxel visible (seul null/undefined est vide)
const colorZeroMesh = greedyMeshVoxels({
  dimX: 2,
  dimY: 2,
  dimZ: 2,
  getVoxel: (x, y, z) => (x === 0 && y === 0 && z === 0 ? 0 : undefined),
  palette,
  scale: 1,
});
assert.strictEqual(colorZeroMesh.count, 36, 'un voxel de couleur 0 doit produire 6 faces');

console.log('Tous les tests Greedy Mesher sont valides !');
