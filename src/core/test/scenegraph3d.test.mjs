/**
 * PixelForge — Tests unitaires du graphe de scene 3D (Issue #70)
 * Verifie la creation, normalisation, hierarchie parentee, detection de cycle,
 * synchronisation nœuds <-> entites et validation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyProject, normalizeProject, createScene3D, createSceneNode } from '../project.js';
import { validateProject } from '../ops/validate.js';
import { placeEntities } from '../ops/ops.js';

test('createSceneNode : initialise les champs par defaut', () => {
  const node = createSceneNode('MonMesh', 'mesh', null);
  assert.ok(node.id.startsWith('node3d_'), 'id doit commencer par node3d_');
  assert.strictEqual(node.name, 'MonMesh');
  assert.strictEqual(node.kind, 'mesh');
  assert.strictEqual(node.parent, null);
  assert.deepStrictEqual(node.position, [0, 0, 0]);
  assert.deepStrictEqual(node.rotation, [0, 0, 0]);
  assert.deepStrictEqual(node.scale, [1, 1, 1]);
  assert.strictEqual(node.visible, true);
  assert.strictEqual(node.locked, false);
});

test('normalizeProject : convertit entities existantes en nodes si nodes est vide', () => {
  const p = createEmptyProject();
  p.settings.dimension = '3d';
  const sc = createScene3D('Scene Test');
  sc.entities = [
    { id: 'ent_1', objectId: 'obj_1', x: 2, y: 3, z: 4, rotationY: 45, visible: true, locked: false, props: { speed: 10 } }
  ];
  delete sc.nodes;
  p.scenes3d = [sc];

  const norm = normalizeProject(p);
  const normSc = norm.scenes3d[0];

  assert.ok(Array.isArray(normSc.nodes), 'nodes doit etre un tableau');
  assert.strictEqual(normSc.nodes.length, 1);
  const n = normSc.nodes[0];
  assert.strictEqual(n.id, 'ent_1');
  assert.strictEqual(n.objectId, 'obj_1');
  assert.deepStrictEqual(n.position, [2, 3, 4]);
  assert.deepStrictEqual(n.rotation, [0, 45, 0]);
  assert.deepStrictEqual(n.props, { speed: 10 });
  assert.strictEqual(normSc.entities.length, 1);
});

test('validateProject : detecte les cycles de parente dans le graphe de scene 3D', () => {
  const p = createEmptyProject();
  p.settings.dimension = '3d';
  p.objects = [{ id: 'player_obj', name: 'Player', spriteId: null, modelId: null }];
  const sc = createScene3D('Main');
  p.settings.startScene3DId = sc.id;

  const n1 = createSceneNode('N1', 'empty', 'node_2');
  n1.id = 'node_1';
  const n2 = createSceneNode('N2', 'empty', 'node_1');
  n2.id = 'node_2';

  const playerNode = createSceneNode('PlayerNode', 'mesh', null);
  playerNode.objectId = 'player_obj';

  sc.nodes = [n1, n2, playerNode];
  p.scenes3d = [sc];

  const issues = validateProject(p);
  const hasCycle = issues.some((e) => e.level === 'error' && e.message.includes('circular parent-child hierarchy detected'));
  assert.ok(hasCycle, 'Doit remonter une erreur de cycle de parente');
});

test('placeEntities : synchronise les collections entities et nodes', () => {
  const p = createEmptyProject();
  p.settings.dimension = '3d';
  p.objects = [{ id: 'cube_obj', name: 'Cube', spriteId: null, modelId: null }];
  const sc = createScene3D('Main');
  p.scenes3d = [sc];

  placeEntities(p, {
    scene: 'Main',
    entities: [{ object: 'Cube', x: 5, y: 1, z: 10 }],
  });

  assert.strictEqual(sc.entities.length, 1);
  assert.strictEqual(sc.nodes.length, 1);
  const n = sc.nodes[0];
  assert.strictEqual(n.objectId, 'cube_obj');
  assert.deepStrictEqual(n.position, [5, 1, 10]);
  assert.strictEqual(n.id, sc.entities[0].id);
});
