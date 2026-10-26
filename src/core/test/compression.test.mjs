// Tests de compression RLE voxel
import assert from 'node:assert/strict';
import { encodeRLEVoxels, decodeRLEVoxels, packProjectVoxels, unpackProjectVoxels } from '../compression.js';

console.log('=== Tests Compression RLE Voxel ===');

// 1. Test compression / decompression
const original = {
  '0,0,0': '#38b764',
  '1,0,0': '#38b764',
  '2,0,0': '#38b764',
  '3,0,0': '#38b764',
  '4,0,0': '#ef7d57',
  '0,1,0': '#38b764',
};

const encoded = encodeRLEVoxels(original);
assert.equal(encoded.length, 3, 'Devrait regrouper les 4 premiers en 1 run, puis 1, puis 1');
assert.deepEqual(encoded[0], [0, 0, 0, 4, '#38b764']);
assert.deepEqual(encoded[1], [4, 0, 0, 1, '#ef7d57']);
assert.deepEqual(encoded[2], [0, 1, 0, 1, '#38b764']);

const decoded = decodeRLEVoxels(encoded);
assert.deepEqual(decoded, original, 'La decompression doit restaurer exactement les voxels d origine');

// 2. Test pack / unpack sur un projet
const project = {
  models: [
    { type: 'voxel', voxels: { ...original } },
  ],
  scenes3d: [
    { gridmap: { blocks: { ...original } } },
  ],
};

packProjectVoxels(project);
assert.ok(Array.isArray(project.models[0].voxelsRLE), 'Doit avoir voxelsRLE');
assert.ok(Array.isArray(project.scenes3d[0].gridmap.blocksRLE), 'Doit avoir blocksRLE');

const packedCopy = {
  models: [
    { type: 'voxel', voxelsRLE: project.models[0].voxelsRLE },
  ],
  scenes3d: [
    { gridmap: { blocksRLE: project.scenes3d[0].gridmap.blocksRLE } },
  ],
};

unpackProjectVoxels(packedCopy);
assert.deepEqual(packedCopy.models[0].voxels, original, 'Unpack doit restaurer les voxels du modele');
assert.deepEqual(packedCopy.scenes3d[0].gridmap.blocks, original, 'Unpack doit restaurer les blocs de la scene');

assert.strictEqual(packedCopy.models[0].voxelsRLE, undefined, 'la forme RLE est retiree apres decodage');
assert.strictEqual(project.models[0].voxels, undefined, 'pack remplace voxels par voxelsRLE');

// 3. Les voxels developpes font foi : un RLE perime ne ressuscite pas un ancien contenu
const stale = { models: [{ type: 'voxel', voxels: { '9,9,9': 1 }, voxelsRLE: [[0, 0, 0, 4, 2]] }] };
unpackProjectVoxels(stale);
assert.deepEqual(stale.models[0].voxels, { '9,9,9': 1 });

// 4. RLE corrompu : runs invalides ou geants ignores, couleur 0 conservee
assert.deepEqual(decodeRLEVoxels([[0, 0, 0, 1e9, 1], ['a', 0, 0, 2, 1], [0, 0, 0, 2, 0]]), { '0,0,0': 0, '1,0,0': 0 });

console.log('Tous les tests de compression RLE voxel sont valides !');
