/**
 * PixelForge — Tests unitaires des Prefabs 3D (Issue #76)
 * Verifie la creation, normalisation, expansion hierarchique et le critere :
 * "Modifier un prefabrique utilise dans 2 scenes met a jour les 2".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyProject,
  normalizeProject,
  createScene3D,
  createSceneNode,
  createPrefab3D,
  expandSceneNodes,
} from '../project.js';
import { validateProject } from '../ops/validate.js';

test('createPrefab3D : initialise les proprietes par defaut', () => {
  const pfb = createPrefab3D('Arbre');
  assert.ok(pfb.id.startsWith('pfb_'), 'L id doit commencer par pfb_');
  assert.strictEqual(pfb.name, 'Arbre');
  assert.deepStrictEqual(pfb.nodes, []);
});

test('normalizeProject : preserve et normalise prefabs3d et prefabId', () => {
  const p = createEmptyProject();
  p.settings.dimension = '3d';
  p.prefabs3d = [
    {
      id: 'pfb_test',
      name: 'Lampadaire',
      nodes: [
        { id: 'n_pole', name: 'Poteau', kind: 'mesh', position: [0, 0, 0] },
      ],
    },
  ];

  const sc = createScene3D('Scene A');
  sc.nodes = [
    { id: 'inst_1', name: 'Lamp_1', kind: 'prefab', prefabId: 'pfb_test', position: [5, 0, 5] },
  ];
  p.scenes3d = [sc];

  const norm = normalizeProject(p);
  assert.ok(Array.isArray(norm.prefabs3d), 'prefabs3d doit etre un tableau');
  assert.strictEqual(norm.prefabs3d.length, 1);
  assert.strictEqual(norm.prefabs3d[0].nodes[0].position[1], 0);
  assert.strictEqual(norm.scenes3d[0].nodes[0].prefabId, 'pfb_test');
});

test('expandSceneNodes : developpe les sous-noeuds relatifs a la position du prefab', () => {
  const pfb = createPrefab3D('Maison', [
    createSceneNode('Murs', 'mesh', null),
    createSceneNode('Toit', 'mesh', null),
  ]);
  pfb.nodes[0].position = [0, 0, 0];
  pfb.nodes[1].position = [0, 3, 0]; // Toit 3 unites plus haut

  const sceneNode = createSceneNode('Maison_Instance', 'prefab', null);
  sceneNode.prefabId = pfb.id;
  sceneNode.position = [10, 0, 20]; // Posee a X=10, Z=20

  const expanded = expandSceneNodes([sceneNode], [pfb]);
  assert.strictEqual(expanded.length, 2, 'Doit contenir les 2 sous-noeuds');

  const murs = expanded.find((n) => n.name.includes('Murs'));
  const toit = expanded.find((n) => n.name.includes('Toit'));

  assert.ok(murs && toit, 'Doit contenir Murs et Toit');
  assert.deepStrictEqual(murs.position, [10, 0, 20]);
  assert.deepStrictEqual(toit.position, [10, 3, 20]);
});

test('Critere d acceptation : modifier un prefabrique utilise dans 2 scenes met a jour les 2', () => {
  const p = createEmptyProject();
  p.settings.dimension = '3d';

  // 1. Creation du prefabrique initial avec 1 seul noeud (Tronc)
  const treePfb = createPrefab3D('ArbreStylise', [
    {
      id: 'node_tronc',
      name: 'Tronc',
      kind: 'mesh',
      parent: null,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ]);
  p.prefabs3d = [treePfb];

  // 2. Creation de Scene 1 et Scene 2 qui instancient toutes les deux le prefabrique
  const sc1 = createScene3D('Foret');
  const instSc1 = createSceneNode('Arbre_Sc1', 'prefab', null);
  instSc1.prefabId = treePfb.id;
  instSc1.position = [2, 0, 4];
  sc1.nodes = [instSc1];

  const sc2 = createScene3D('Village');
  const instSc2 = createSceneNode('Arbre_Sc2', 'prefab', null);
  instSc2.prefabId = treePfb.id;
  instSc2.position = [12, 0, 18];
  sc2.nodes = [instSc2];

  p.scenes3d = [sc1, sc2];

  // Verification initiale : chaque scene a 1 noeud developpe
  const expSc1Initial = expandSceneNodes(sc1.nodes, p.prefabs3d);
  const expSc2Initial = expandSceneNodes(sc2.nodes, p.prefabs3d);
  assert.strictEqual(expSc1Initial.length, 1);
  assert.strictEqual(expSc2Initial.length, 1);

  // 3. Modification du prefabrique : ajout du Feuillage et ajustement
  treePfb.nodes.push({
    id: 'node_feuillage',
    name: 'Feuillage',
    kind: 'mesh',
    parent: 'node_tronc',
    position: [0, 2.5, 0],
    rotation: [0, 45, 0],
    scale: [1.5, 1.5, 1.5],
  });

  // 4. Verification dans les deux scenes : les deux scenes sont immediatement a jour
  const expSc1Updated = expandSceneNodes(sc1.nodes, p.prefabs3d);
  const expSc2Updated = expandSceneNodes(sc2.nodes, p.prefabs3d);

  assert.strictEqual(expSc1Updated.length, 2, 'Scene 1 doit maintenant avoir 2 noeuds');
  assert.strictEqual(expSc2Updated.length, 2, 'Scene 2 doit maintenant avoir 2 noeuds');

  const feuillageSc1 = expSc1Updated.find((n) => n.name.includes('Feuillage'));
  const feuillageSc2 = expSc2Updated.find((n) => n.name.includes('Feuillage'));

  assert.ok(feuillageSc1, 'Feuillage doit apparaitre dans Scene 1');
  assert.ok(feuillageSc2, 'Feuillage doit apparaitre dans Scene 2');

  // Coordonnees absolues exactes dans Scene 1 et Scene 2
  assert.deepStrictEqual(feuillageSc1.position, [2, 2.5, 4]);
  assert.deepStrictEqual(feuillageSc2.position, [12, 2.5, 18]);
});

test('validateProject : signale les erreurs de reference et les cycles dans les prefabs', () => {
  const p = createEmptyProject();
  p.settings.dimension = '3d';
  p.objects = [{ id: 'cube_obj', name: 'Cube', spriteId: null, modelId: null }];

  const pfbCycle = createPrefab3D('Cyclique', [
    { id: 'p_1', name: 'P1', kind: 'empty', parent: 'p_2' },
    { id: 'p_2', name: 'P2', kind: 'empty', parent: 'p_1' },
  ]);
  p.prefabs3d = [pfbCycle];

  const sc = createScene3D('Test');
  p.settings.startScene3DId = sc.id;
  const badNode = createSceneNode('BadPrefabInst', 'prefab', null);
  badNode.prefabId = 'pfb_introuvable';
  sc.nodes = [badNode];
  p.scenes3d = [sc];

  const issues = validateProject(p);

  const hasCycleError = issues.some((i) => i.level === 'error' && i.message.includes('circular parent-child hierarchy detected in prefab'));
  const hasMissingPrefab = issues.some((i) => i.level === 'error' && i.message.includes('matches no prefab in prefabs3d'));

  assert.ok(hasCycleError, 'Doit remonter l erreur de cycle interne dans le prefab');
  assert.ok(hasMissingPrefab, 'Doit remonter l erreur de prefab introuvable');
});
