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

console.log('Tous les tests de compression RLE voxel sont valides !');
