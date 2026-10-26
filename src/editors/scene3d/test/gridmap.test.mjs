/**
 * Tests unitaires pour la collection GridMap 3D
 */

import assert from 'node:assert';
import { GridMap3D } from '../gridmap.js';

console.log('=== Tests GridMap 3D ===');

// 1. Initialisation et operations de base
const grid = new GridMap3D();
assert.strictEqual(grid.blocks.size, 0);

grid.setBlock(2, 5, -3, '#ffffff');
assert.strictEqual(grid.getBlock(2, 5, -3), '#ffffff');
assert.strictEqual(grid.hasBlock(2, 5, -3), true);
assert.strictEqual(grid.hasBlock(0, 0, 0), false);

grid.removeBlock(2, 5, -3);
assert.strictEqual(grid.hasBlock(2, 5, -3), false);

// 2. Remplissage d'un volume de blocs (fillBox)
const count = grid.fillBox(0, 0, 0, 3, 2, 1, '#ff0000');
// 4 en X (0,1,2,3) × 3 en Y (0,1,2) × 2 en Z (0,1) = 24 blocs
assert.strictEqual(count, 24, `fillBox doit generer 24 blocs (obtenu: ${count})`);
assert.strictEqual(grid.blocks.size, 24);

// 3. Calcul des limites spatiales (getBounds)
const bounds = grid.getBounds();
assert.strictEqual(bounds.minX, 0);
assert.strictEqual(bounds.maxX, 3);
assert.strictEqual(bounds.minY, 0);
assert.strictEqual(bounds.maxY, 2);
assert.strictEqual(bounds.minZ, 0);
assert.strictEqual(bounds.maxZ, 1);
assert.strictEqual(bounds.count, 24);

// 4. Suppression par etage Y (clearLevel)
const cleared = grid.clearLevel(1);
// etage y=1 a 4 × 2 = 8 blocs
assert.strictEqual(cleared, 8);
assert.strictEqual(grid.blocks.size, 16);

// 5. Serialisation JSON
const json = grid.toJSON();
assert.strictEqual(json['0,0,0'], '#ff0000');
assert.strictEqual(json['0,1,0'], undefined);

console.log('Tous les tests GridMap 3D sont valides !');
