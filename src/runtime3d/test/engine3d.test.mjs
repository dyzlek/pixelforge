/**
 * Tests unitaires pour le Runtime 3D et le gabarit d'export HTML 3D
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStandaloneHTML3D } from '../export-template-3d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engine3dPath = path.join(__dirname, '..', 'engine3d.js');
const engine3dSource = fs.readFileSync(engine3dPath, 'utf8');

console.log('=== Tests Runtime 3D Retro ===');

// 1. Verification de la contrainte ZERO IMPORT dans engine3d.js
const lines = engine3dSource.split('\n');
const importLines = lines.filter((line) => line.trim().startsWith('import ') && !line.includes('docs/'));
assert.strictEqual(
  importLines.length,
  0,
  `engine3d.js ne doit avoir AUCUN import (trouve : ${importLines.join(', ')})`
);

// 2. Verification de l'absence totale d'emojis dans engine3d.js
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
assert.ok(!emojiRegex.test(engine3dSource), 'engine3d.js ne doit contenir aucun emoji');

// 3. Test de generation d'un export HTML 3D autonome
const dummyProject = {
  version: 1,
  name: 'Test 3D Retro',
  meta: { id: 'test-3d' },
  settings: { width: 320, height: 180, dimension: '3d' },
  palette: ['#1a1c2c', '#ffffff'],
  objects: [
    {
      id: 'obj_cube',
      name: 'PlayerCube',
      physics: { gravity: true },
      script: { mode: 'code', code: "on('update', () => { self.vx = 1; });" },
    },
  ],
  scenes3d: [
    {
      id: 'scene_main',
      name: 'Niveau 1',
      gridmap: { '0,0,0': '#ffffff' },
      entities: [{ id: 'ent_1', objectId: 'obj_cube', x: 0, y: 1, z: 0 }],
    },
  ],
};

const chipSource = 'export function createChipAudio() { return {}; }';
const html = buildStandaloneHTML3D(dummyProject, engine3dSource, chipSource);

assert.ok(html.includes('<!doctype html>'), 'HTML export must include doctype');
assert.ok(html.includes('three.min.js'), 'HTML export must load Three.js');
assert.ok(html.includes('createGame3D(PROJECT'), 'HTML export must launch createGame3D');
assert.ok(html.includes('image-rendering: pixelated'), 'HTML export must enforce pixelated rendering');
assert.ok(!emojiRegex.test(html), 'HTML export must not contain any emoji');

console.log('Tous les tests Runtime 3D Retro sont valides !');
