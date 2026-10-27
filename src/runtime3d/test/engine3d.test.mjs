/**
 * Tests unitaires pour le Runtime 3D et le gabarit d'export HTML 3D
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStandaloneHTML3D } from '../export-template-3d.js';
import { validateProject } from '../../../mcp/lib/validate.js';
import { paintGridMap } from '../../../mcp/lib/ops.js';

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
assert.ok(html.includes('three.module.min.js') && html.includes('three@0.186.1'), 'HTML export must load Three.js 0.186.1 via importmap');
assert.ok(html.includes('createGame3D(PROJECT'), 'HTML export must launch createGame3D');
assert.ok(html.includes('image-rendering: pixelated'), 'HTML export must enforce pixelated rendering');
assert.ok(!emojiRegex.test(html), 'HTML export must not contain any emoji');

// 4. Validation 3D durcie (Issue #63, C-20)
{
  // (a) Joueur absent de la scene de depart -> erreur
  const noPlayerProj = {
    settings: { dimension: '3d', startScene3DId: 'sc1' },
    objects: [{ id: 'o1', name: 'Coin', physics: { enabled: true } }],
    scenes3d: [{ id: 'sc1', name: 'Main', entities: [{ objectId: 'o1', x: 0, y: 1, z: 0 }] }],
    maps: [], sprites: [], sounds: [], songs: []
  };
  const issuesNoPlayer = validateProject(noPlayerProj);
  assert.ok(
    issuesNoPlayer.some((i) => i.level === 'error' && i.message.includes('must contain a player entity')),
    'Un jeu 3D sans joueur dans la scene de depart doit declencher une erreur'
  );

  // (b) Blocs de gridmap mal formes -> erreur
  const badBlocksProj = {
    settings: { dimension: '3d', startScene3DId: 'sc1' },
    objects: [{ id: 'p', name: 'Player', physics: { enabled: true } }],
    scenes3d: [{
      id: 'sc1',
      name: 'Main',
      gridmap: { blocks: { 'invalid_key': 5, '0,0,0': 'invalid_color' } },
      entities: [{ objectId: 'p', x: 0, y: 1, z: 0 }]
    }],
    maps: [], sprites: [], sounds: [], songs: []
  };
  const issuesBadBlocks = validateProject(badBlocksProj);
  assert.ok(
    issuesBadBlocks.some((i) => i.level === 'error' && i.message.includes('invalid block position key')),
    'Cle de coordonnee de bloc invalide doit declencher une erreur'
  );
  assert.ok(
    issuesBadBlocks.some((i) => i.level === 'error' && i.message.includes('invalid color')),
    'Couleur de bloc invalide doit declencher une erreur'
  );

  // (c) goToMap ciblant une carte 2D depuis un jeu 3D -> erreur
  const crossDimProj = {
    settings: { dimension: '3d', startScene3DId: 'sc1' },
    objects: [{
      id: 'p',
      name: 'Player',
      physics: { enabled: true },
      script: { mode: 'code', code: "on('create', () => { game.goToMap('Map2D'); });" }
    }],
    scenes3d: [{ id: 'sc1', name: 'Main', gridmap: { blocks: { '0,0,0': 1 } }, entities: [{ objectId: 'p', x: 0, y: 1, z: 0 }] }],
    maps: [{ id: 'm1', name: 'Map2D', width: 10, height: 10, tileSize: 16, layers: [{ data: [] }], entities: [] }],
    sprites: [], sounds: [], songs: []
  };
  const issuesCrossDim = validateProject(crossDimProj);
  assert.ok(
    issuesCrossDim.some((i) => i.level === 'error' && i.message.includes('is a 2D map, but game dimension is 3D')),
    'goToMap vers une carte 2D depuis un jeu 3D doit declencher une erreur'
  );

  // (d) Entite avec gravite sans sol sous ses pieds -> avertissement
  const voidProj = {
    settings: { dimension: '3d', startScene3DId: 'sc1' },
    objects: [{ id: 'p', name: 'Player', physics: { enabled: true, gravity: true } }],
    scenes3d: [{ id: 'sc1', name: 'Main', gridmap: { blocks: {} }, entities: [{ objectId: 'p', x: 0, y: 1, z: 0 }] }],
    maps: [], sprites: [], sounds: [], songs: []
  };
  const issuesVoid = validateProject(voidProj);
  assert.ok(
    issuesVoid.some((i) => i.level === 'warning' && i.message.includes('fall into the void')),
    'Entite avec gravite sans sol doit declencher un avertissement de chute dans le vide'
  );
}

// 5. paintGridMap validation des caracteres inconnus (Issue #63, point 2)
{
  const proj = {
    settings: { dimension: '3d' },
    scenes3d: [{ id: 'sc1', name: 'Main', gridmap: { blockSize: 1, blocks: {} } }],
    objects: [], maps: [], sprites: []
  };
  assert.throws(
    () => paintGridMap(proj, { scene: 'Main', level: 0, rows: ['??'] }),
    /unknown character "\?"/,
    'paintGridMap doit lever une erreur sur un caractere inconnu hors palette et hors legende'
  );
  // Avec legende valide -> succes
  paintGridMap(proj, { scene: 'Main', level: 0, rows: ['??'], legend: { '?': 4 } });
  assert.strictEqual(proj.scenes3d[0].gridmap.blocks['0,0,0'], 4);
}

// 6. Modeles glTF, materiaux et presets CC0 (Issue #73, F4)
{
  // (a) Verification de l'import de GLTFLoader dans l'export autonome HTML 3D
  assert.ok(html.includes('import { GLTFLoader } from'), 'HTML export must import GLTFLoader');
  assert.ok(html.includes('GLTFLoader,'), 'HTML export must pass GLTFLoader in opts');

  // (b) Verification des presets CC0
  const { CC0_PRESETS } = await import('../../core/cc0-models.js');
  assert.strictEqual(CC0_PRESETS.length, 4, 'Doit contenir 4 presets CC0');
  const adv = CC0_PRESETS.find((p) => p.id === 'cc0_adventurer');
  assert.ok(adv, 'Preset aventurier Quaternius present');
  const advDataUrl = adv.generate();
  assert.ok(advDataUrl.startsWith('data:model/gltf+json;base64,'), 'Format dataUrl valide');

  // (c) Validation des materiaux dans validateProject
  const matProj = {
    settings: { dimension: '3d', startScene3DId: 'sc1' },
    sprites: [{ id: 'spr1', name: 'Texture', width: 16, height: 16, frames: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='], animations: [] }],
    materials: [
      { id: 'mat1', name: 'Bois', type: 'standard', color: '#ff0000', textureSpriteId: 'spr1' },
      { id: 'mat_orphan', name: 'Pierre', type: 'unlit', textureSpriteId: 'spr_inexistant' }
    ],
    objects: [{ id: 'p', name: 'Player', materialId: 'mat1', physics: { enabled: true } }],
    scenes3d: [{ id: 'sc1', name: 'Main', gridmap: { blocks: { '0,0,0': 1 } }, entities: [{ objectId: 'p', x: 0, y: 1, z: 0 }] }],
    maps: [], sounds: [], songs: []
  };
  const matIssues = validateProject(matProj);
  assert.ok(
    matIssues.some((i) => i.level === 'error' && i.message.includes('spr_inexistant')),
    'textureSpriteId invalide doit declencher une erreur'
  );
}

console.log('Tous les tests Runtime 3D Retro sont valides !');
