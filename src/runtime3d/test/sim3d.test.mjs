/**
 * Simulation du runtime 3D sous Node avec un faux Three.js et un faux DOM :
 * charge les vrais jeux de demo et verifie la gridmap, les modeles voxel, la physique et les touches.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame3D } from '../engine3d.js';
import { normalizeProject } from '../../core/project.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..', '..');

// ---------- Faux DOM ----------
function fakeEventTarget() {
  const listeners = {};
  return {
    listeners,
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    dispatch(t, ev) { (listeners[t] || []).slice().forEach((fn) => fn(ev)); },
  };
}
function fakeElement(tag) {
  return {
    ...fakeEventTarget(),
    tagName: String(tag).toUpperCase(),
    style: {},
    children: [],
    textContent: '',
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    focus() {},
  };
}
const win = fakeEventTarget();
win.performance = globalThis.performance;
globalThis.window = win;
globalThis.document = { ...fakeEventTarget(), createElement: fakeElement, pointerLockElement: null, querySelector: () => null };
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => { rafCb = null; };

// ---------- Faux Three.js ----------
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  normalize() { return this; }
}
class Color {
  constructor(v) { this.r = 0; this.g = 0; this.b = 0; if (v !== undefined) this.set(v); }
  set(v) {
    if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error('couleur invalide : ' + v);
    const n = parseInt(v.slice(1), 16);
    this.r = ((n >> 16) & 255) / 255; this.g = ((n >> 8) & 255) / 255; this.b = (n & 255) / 255;
    return this;
  }
}
class Obj3D {
  constructor() { this.position = new Vec3(); this.rotation = new Vec3(); this.scale = new Vec3(1, 1, 1); this.children = []; }
  add(c) { this.children.push(c); }
  remove(c) { this.children = this.children.filter((x) => x !== c); }
  lookAt() {}
}
const THREE = {
  Scene: Obj3D,
  Group: Obj3D,
  Color,
  FogExp2: class { constructor(c, d) { this.color = c; this.density = d; } },
  Fog: class { constructor(c, n, f) { this.color = c; this.near = n; this.far = f; } },
  PointLight: class extends Obj3D { constructor(c, i, d) { super(); this.color = new Color(c); this.intensity = i; this.distance = d; } },
  SpotLight: class extends Obj3D { constructor(c, i, d) { super(); this.color = new Color(c); this.intensity = i; this.distance = d; this.target = new Obj3D(); } },
  PerspectiveCamera: class extends Obj3D { updateProjectionMatrix() {} },
  WebGLRenderer: class { constructor() { this.shadowMap = {}; } setSize() {} setPixelRatio() {} render() {} dispose() {} forceContextLoss() {} },
  AmbientLight: class extends Obj3D { constructor() { super(); this.color = new Color('#ffffff'); this.intensity = 1; } },
  DirectionalLight: class extends Obj3D { constructor() { super(); this.color = new Color('#ffffff'); this.intensity = 1; this.shadow = { mapSize: {}, camera: {} }; } },
  BoxGeometry: class { dispose() {} },
  MeshLambertMaterial: class { constructor(o) { this.opts = o; } dispose() {} },
  MeshBasicMaterial: class { constructor(o) { this.opts = o; } dispose() {} },
  Mesh: class extends Obj3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
  BufferGeometry: class { constructor() { this.attributes = {}; } setAttribute(n, a) { this.attributes[n] = a; } dispose() {} },
  Float32BufferAttribute: class { constructor(arr, size) { this.array = arr; this.itemSize = size; this.count = arr.length / size; } },
  Raycaster: class { intersectObjects() { return []; } },
  Vector3: Vec3,
};

const logs = [];
function startGame(project, extraOpts = {}) {
  const parent = fakeElement('div');
  const game = createGame3D(project, parent, THREE, { onLog: (m, l) => logs.push(`[${l}] ${m}`), ...extraOpts });
  let t = 0;
  const step = (frames = 1, dt = 16) => {
    for (let i = 0; i < frames; i++) { t += dt; rafCb(t); }
  };
  step(1, 0);
  return { game, step };
}
const key = (type, k) => win.dispatch(type, { key: k, target: null, preventDefault() {} });

console.log('=== Simulation Runtime 3D ===');

// 1. Jeux de demo : la gridmap {blockSize, blocks} est lue et le joueur tient sur le sol
for (const file of ['cube-runner', 'donjon-3d']) {
  const project = normalizeProject(JSON.parse(fs.readFileSync(path.join(ROOT, 'games', file + '.pixelforge.json'), 'utf8')));
  const { game, step } = startGame(project);
  let snap = game.debugSnapshot();
  assert.ok(snap.blocks > 50, `la gridmap doit etre construite (blocs : ${snap.blocks})`);
  assert.strictEqual(snap.scene, project.scenes3d.find((s) => s.id === project.settings.startScene3DId).name, 'scene de depart = startScene3DId');
  step(120);
  snap = game.debugSnapshot();
  const player = snap.instances.find((i) => /^Player/.test(i.name));
  assert.ok(player, 'le joueur existe');
  assert.ok(player.onGround, `le joueur doit etre au sol (y = ${player.y})`);
  assert.ok(Math.abs(player.y - 0.95 - Math.round(player.y - 0.95)) < 0.01, `${file} : pieds poses sur le haut d'un bloc (y = ${player.y})`);
  game.destroy();
}

// 2. Murs : une instance poussee contre un mur s'arrete, et ne traverse pas le sol en chute rapide
{
  const project = normalizeProject({
    name: 'Sim', settings: { dimension: '3d', gravity: 800 },
    objects: [{ id: 'o1', name: 'Box', physics: { gravity: true, collideMap: true }, script: { mode: 'code', code: "on('update', () => { self.vx = 8; });" } }],
    scenes3d: [{ id: 's1', name: 'S', gridmap: { blockSize: 1, blocks: { '0,0,0': 6, '1,0,0': 6, '2,0,0': 6, '3,0,0': 6, '3,1,0': 0, '3,2,0': 0 } },
      entities: [{ id: 'e1', objectId: 'o1', x: 0, y: 1, z: 0 }] }],
  });
  const { game, step } = startGame(project);
  step(120);
  const box = game.debugSnapshot().instances[0];
  // Le bloc X=3 occupe [2.5, 3.5] ; la boite (demi-largeur 0.45) s'arrete a 2.05
  assert.ok(Math.abs(box.x - 2.05) < 0.01, `le mur en X=3 arrete la boite (x = ${box.x})`);
  assert.ok(box.onGround, 'toujours au sol contre le mur');
  game.destroy();

  const fall = normalizeProject({
    name: 'Chute', settings: { dimension: '3d', gravity: 800 },
    objects: [{ id: 'o1', name: 'Box', physics: { gravity: true, collideMap: true } }],
    scenes3d: [{ id: 's1', name: 'S', gridmap: { blockSize: 1, blocks: { '0,0,0': 6 } }, entities: [{ id: 'e1', objectId: 'o1', x: 0, y: 40, z: 0 }] }],
  });
  const g2 = startGame(fall);
  g2.step(200, 100); // grand dt : vitesse de chute elevee
  const b2 = g2.game.debugSnapshot().instances[0];
  assert.ok(b2 && Math.abs(b2.y - 0.95) < 0.01, `pas de traversee du sol (y = ${b2 && b2.y})`);
  g2.game.destroy();
}

// 3. on('keydown', 'SPACE') et la couleur de palette 0 sur un modele voxel
{
  const project = normalizeProject({
    name: 'Keys', settings: { dimension: '3d' },
    models: [{ id: 'm1', name: 'Noir', type: 'voxel', width: 1, height: 1, depth: 1, voxels: { '0,0,0': 0 } }],
    objects: [{ id: 'o1', name: 'P', modelId: 'm1', physics: { gravity: false },
      script: { mode: 'code', code: "on('keydown', 'SPACE', () => { game.score += 1; }); on('keydown', 'LEFT', () => { game.score += 10; });" } }],
    scenes3d: [{ id: 's1', name: 'S', gridmap: { blockSize: 1, blocks: {} }, entities: [{ id: 'e1', objectId: 'o1', x: 0, y: 0, z: 0 }] }],
  });
  const { game, step } = startGame(project);
  key('keydown', ' '); step(); key('keyup', ' ');
  key('keydown', 'ArrowLeft'); step(); key('keyup', 'ArrowLeft');
  assert.strictEqual(game.debugSnapshot().score, 11, 'keydown SPACE et LEFT declenches');
  game.destroy();
}

// 4. Restart pendant l'update : applique en fin d'image, sans casser la boucle
{
  const project = normalizeProject({
    name: 'Restart', settings: { dimension: '3d' },
    objects: [{ id: 'o1', name: 'A', physics: { gravity: false }, script: { mode: 'code', code: "on('timer', 100, () => game.restart());" } },
      { id: 'o2', name: 'B', physics: { gravity: false }, script: { mode: 'code', code: "on('update', () => { self.x += 0.01; });" } }],
    scenes3d: [{ id: 's1', name: 'S', gridmap: { blockSize: 1, blocks: {} }, entities: [
      { id: 'e1', objectId: 'o1', x: 0, y: 0, z: 0 }, { id: 'e2', objectId: 'o2', x: 5, y: 0, z: 0 }] }],
  });
  const { game, step } = startGame(project);
  step(20);
  const snap = game.debugSnapshot();
  assert.strictEqual(snap.instances.length, 2, `toujours 2 instances apres restart (${snap.instances.length})`);
  game.destroy();
}

// 5. Orientation : rotateY positif tourne a droite ; wait, broadcast et pause
{
  const project = normalizeProject({
    name: 'Api', settings: { dimension: '3d' },
    objects: [{ id: 'o1', name: 'P', physics: { gravity: false, collideMap: false }, script: { mode: 'code', code: [
      "on('create', () => { self.rotateY(90); self.moveForward(5); game.wait(50, () => { game.vars.waited = true; }); });",
      "on('message', 'ping', (d) => { game.vars.msg = d; });",
    ].join('\n') } }],
    scenes3d: [{ id: 's1', name: 'S', gridmap: { blockSize: 1, blocks: {} }, entities: [{ id: 'e1', objectId: 'o1', x: 0, y: 0, z: 0 }] }],
  });
  const { game, step } = startGame(project);
  const p0 = game.debugSnapshot().instances[0];
  assert.ok(p0.vx > 4.9 && Math.abs(p0.vz) < 1e-9, 'rotateY(90) puis moveForward : vers +X (droite)');
  step(5);
  assert.strictEqual(game.game.vars.waited, true, 'game.wait execute');
  game.game.broadcast('ping', 42);
  assert.strictEqual(game.game.vars.msg, 42, 'on(message) recoit broadcast');
  game.game.pause();
  const x1 = game.debugSnapshot().instances[0].x;
  step(10);
  assert.strictEqual(game.debugSnapshot().instances[0].x, x1, 'pause : plus de mouvement');
  game.game.resume();
  step(2);
  assert.ok(game.debugSnapshot().instances[0].x > x1, 'resume : le mouvement reprend');
  game.destroy();
}

// 6. Physique 3D Rapier : corps rigides, empilement et poussee de caisses, et jeux de demo en mode rapier
{
  // 6.1 Jeux de demo en mode Rapier
  for (const file of ['cube-runner', 'donjon-3d']) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', file + '.pixelforge.json'), 'utf8'));
    raw.settings = { ...raw.settings, physics3d: 'rapier' };
    const project = normalizeProject(raw);
    const { game, step } = startGame(project, { rapier: RAPIER });
    step(60);
    const snap = game.debugSnapshot();
    const player = snap.instances.find((i) => /^Player/.test(i.name));
    assert.ok(player, `${file} (rapier) : le joueur existe`);
    assert.ok(player.onGround, `${file} (rapier) : le joueur doit etre au sol (y = ${player.y})`);
    game.destroy();
  }

  // 6.2 Des caisses tombent, s'empilent et se poussent
  {
    const project = normalizeProject({
      name: 'CaissesRapier',
      settings: { dimension: '3d', physics3d: 'rapier', gravity: 800 },
      objects: [
        {
          id: 'o_crate',
          name: 'Caisse',
          physics: {
            enabled: true,
            gravity: true,
            bodyType: 'dynamic',
            colliderShape: 'box',
            mass: 1,
            friction: 0.5,
            restitution: 0,
          },
        },
        {
          id: 'o_pusher',
          name: 'Pousseur',
          physics: {
            enabled: true,
            gravity: true,
            bodyType: 'dynamic',
            colliderShape: 'box',
            mass: 10,
            friction: 0.2,
          },
          script: {
            mode: 'code',
            code: "on('update', () => { self.vx = 4; });",
          },
        },
      ],
      scenes3d: [
        {
          id: 's1',
          name: 'SceneCaisses',
          gridmap: {
            blockSize: 1,
            blocks: {
              '-2,0,0': 6, '-1,0,0': 6, '0,0,0': 6, '1,0,0': 6, '2,0,0': 6, '3,0,0': 6,
            },
          },
          entities: [
            // Caisse 1 posee au sol en X=0
            { id: 'c1', objectId: 'o_crate', x: 0, y: 0.95, z: 0 },
            // Caisse 2 en l'air au-dessus de la caisse 1
            { id: 'c2', objectId: 'o_crate', x: 0, y: 2.5, z: 0 },
            // Pousseur qui va arriver par la gauche
            { id: 'p1', objectId: 'o_pusher', x: -1.5, y: 0.95, z: 0 },
          ],
        },
      ],
    });

    const { game, step } = startGame(project, { rapier: RAPIER });

    // La caisse 2 tombe et s'empile sur la caisse 1
    step(30);
    const snap1 = game.debugSnapshot();
    const crates1 = snap1.instances.filter((i) => i.name === 'Caisse').sort((a, b) => a.y - b.y);
    assert.strictEqual(crates1.length, 2, 'les deux caisses existent');
    const [crate1, crate2] = crates1;
    assert.ok(Math.abs(crate1.y - 0.95) < 0.1, `caisse 1 au sol (y = ${crate1.y})`);
    assert.ok(crate2.y > crate1.y + 0.7, `caisse 2 empilee sur caisse 1 (y = ${crate2.y})`);

    // Le pousseur avance et pousse les caisses
    step(40);
    const snap2 = game.debugSnapshot();
    const crates2 = snap2.instances.filter((i) => i.name === 'Caisse');
    assert.strictEqual(crates2.length, 2, 'les deux caisses sont toujours actives');
    assert.ok(crates2.some((c) => c.x > 0.3), `au moins une caisse a ete poussee vers la droite`);
    game.destroy();
  }

  // 6.3 Formes de colliders (sphere, capsule, trimesh)
  {
    const project = normalizeProject({
      name: 'ShapesRapier',
      settings: { dimension: '3d', physics3d: 'rapier' },
      objects: [
        { id: 'o_sph', name: 'Balle', physics: { colliderShape: 'sphere' } },
        { id: 'o_cap', name: 'Gellule', physics: { colliderShape: 'capsule' } },
        { id: 'o_tri', name: 'Maillage', physics: { colliderShape: 'trimesh' } },
      ],
      scenes3d: [
        {
          id: 's1',
          name: 'SceneShapes',
          gridmap: { blockSize: 1, blocks: { '0,0,0': 1, '1,0,0': 1, '2,0,0': 1 } },
          entities: [
            { id: 'e1', objectId: 'o_sph', x: 0, y: 1, z: 0 },
            { id: 'e2', objectId: 'o_cap', x: 1, y: 1, z: 0 },
            { id: 'e3', objectId: 'o_tri', x: 2, y: 1, z: 0 },
          ],
        },
      ],
    });
    const { game, step } = startGame(project, { rapier: RAPIER });
    step(10);
    const snap = game.debugSnapshot();
    assert.strictEqual(snap.instances.length, 3, 'les 3 formes de colliders sont instanciees');
    game.destroy();
  }
}

// =========================================================================
// 7. Prefabs et Terrain sculpte en jeu (Issue #76)
// =========================================================================

// 7.1 Expansion et instanciation de prefabs dans le runtime 3D
{
  const project = normalizeProject({
    name: 'PrefabRuntime',
    settings: { dimension: '3d' },
    objects: [
      { id: 'o_tree_trunk', name: 'Trunk', physics: { gravity: false } },
      { id: 'o_tree_top', name: 'TreeTop', physics: { gravity: false } },
    ],
    prefabs3d: [
      {
        id: 'pfb_pine',
        name: 'PineTree',
        nodes: [
          { id: 'n_trunk', name: 'Tronc', kind: 'mesh', objectId: 'o_tree_trunk', position: [0, 0, 0] },
          { id: 'n_top', name: 'Feuillage', kind: 'mesh', objectId: 'o_tree_top', position: [0, 2, 0] },
        ],
      },
    ],
    scenes3d: [
      {
        id: 's_prefabs',
        name: 'Foret',
        gridmap: { blockSize: 1, blocks: { '0,0,0': 1, '5,0,5': 1 } },
        nodes: [
          { id: 'p_inst_1', name: 'Sapin1', kind: 'prefab', prefabId: 'pfb_pine', position: [5, 0, 5] },
        ],
      },
    ],
  });

  const { game, step } = startGame(project);
  step(5);
  const snap = game.debugSnapshot();
  const trunk = snap.instances.find((i) => i.name === 'Trunk');
  const top = snap.instances.find((i) => i.name === 'TreeTop');
  assert.ok(trunk, 'le tronc du prefab doit etre instancie');
  assert.ok(top, 'le feuillage du prefab doit etre instancie');
  assert.strictEqual(trunk.x, 5);
  assert.strictEqual(trunk.z, 5);
  assert.strictEqual(top.y, 2);
  game.destroy();
}

// 7.2 Terrain sculpte solide en mode Simple (AABB)
{
  const project = normalizeProject({
    name: 'TerrainAABB',
    settings: { dimension: '3d', physics3d: 'simple' },
    objects: [
      {
        id: 'o_hero',
        name: 'Player',
        physics: { enabled: true, gravity: true, collideMap: true },
        script: {
          mode: 'code',
          code: "on('update', () => { self.vx = 2; });",
        },
      },
    ],
    scenes3d: [
      {
        id: 's_terrain_aabb',
        name: 'Colline',
        terrain: {
          enabled: true,
          width: 10,
          depth: 10,
          originX: -5,
          originZ: -5,
          defaultHeight: 0,
          defaultColor: 6,
          heights: {
            '0,0': 1,
            '1,0': 1,
            '2,0': 1,
            '3,0': 1,
          },
        },
        nodes: [
          { id: 'n_player', name: 'Hero', kind: 'mesh', objectId: 'o_hero', position: [0, 2, 0] },
        ],
      },
    ],
  });

  const { game, step } = startGame(project);
  step(5);
  const snap1 = game.debugSnapshot();
  const player1 = snap1.instances.find((i) => i.name === 'Player');
  assert.ok(player1, 'le joueur existe');
  assert.strictEqual(player1.onGround, true, 'le joueur commence au sol sur le terrain');

  // Le joueur avance sur le plateau sculpte
  step(35);
  const snap2 = game.debugSnapshot();
  const player2 = snap2.instances.find((i) => i.name === 'Player');
  assert.ok(player2.x > 1.0, `le joueur a avance sur le terrain (x = ${player2.x})`);
  assert.ok(Math.abs(player2.y - 1.95) < 0.1, `le joueur repose a la hauteur sculptee (y = ${player2.y})`);
  assert.strictEqual(player2.onGround, true, 'le joueur reste solidement pose sur le terrain sculpte');
  game.destroy();
}

// 7.3 Terrain sculpte solide en mode Rapier 3D
if (RAPIER) {
  const project = normalizeProject({
    name: 'TerrainRapier',
    settings: { dimension: '3d', physics3d: 'rapier' },
    objects: [
      {
        id: 'o_box',
        name: 'Player',
        physics: { enabled: true, gravity: true, bodyType: 'dynamic', colliderShape: 'box' },
      },
    ],
    scenes3d: [
      {
        id: 's_terrain_rapier',
        name: 'Montagne',
        terrain: {
          enabled: true,
          width: 8,
          depth: 8,
          originX: -4,
          originZ: -4,
          defaultHeight: 0,
          heights: {
            '0,0': 3,
          },
        },
        nodes: [
          { id: 'n_p', name: 'Hero', kind: 'mesh', objectId: 'o_box', position: [0, 5, 0] },
        ],
      },
    ],
  });

  const { game, step } = startGame(project, { rapier: RAPIER });
  step(25);
  const snap = game.debugSnapshot();
  const player = snap.instances.find((i) => i.name === 'Player');
  assert.ok(player, 'le joueur existe');
  assert.ok(Math.abs(player.y - 3.95) < 0.2, `le joueur est atterri et repose sur le pic a Y=3 (y = ${player.y})`);
  assert.strictEqual(player.onGround, true, 'le joueur est detecte au sol sur le pic sculpte par Rapier');
  game.destroy();
}

// 8. Jouer depuis la camera de l editeur et debogage 3D (Issue #77)
{
  const project = normalizeProject({
    name: 'DebugCamera3D',
    settings: { dimension: '3d' },
    objects: [
      {
        id: 'o_hero',
        name: 'Player',
        physics: { enabled: true, gravity: false },
        script: {
          code: `
            on('update', () => {
              if (game.vars.moving) {
                self.x += 1;
              }
            });
          `,
        },
      },
      {
        id: 'o_box',
        name: 'Crate',
        physics: { enabled: false },
      },
    ],
    scenes3d: [
      {
        id: 's_debug',
        name: 'DebugLevel',
        gridmap: {
          '0': { '0,0': 4, '1,0': 4 },
        },
        nodes: [
          { id: 'n_hero', name: 'Player', kind: 'mesh', objectId: 'o_hero', position: [0, 0, 0] },
          { id: 'n_box', name: 'Crate', kind: 'mesh', objectId: 'o_box', position: [5, 1, 5] },
        ],
      },
    ],
  });

  // 8.1 Jouer depuis la camera (playFromCamera)
  {
    const { game, step } = startGame(project, {
      playFromCamera: {
        position: [12, 8, 12],
        target: [10, 2, 10],
      },
    });
    const snap = game.debugSnapshot();
    const hero = snap.instances.find((i) => i.name === 'Player');
    assert.ok(hero, 'Hero present');
    assert.strictEqual(hero.x, 10, 'hero repositionne au target de la camera');
    assert.strictEqual(hero.y, 3, 'hero positionne au dessus du target');
    assert.strictEqual(hero.z, 10, 'hero coordonnee Z ajustee');
    game.destroy();
  }

  // 8.2 Placement direct (spawnPlayerPosition)
  {
    const { game } = startGame(project, {
      spawnPlayerPosition: [4, 7, -2],
    });
    const snap = game.debugSnapshot();
    const hero = snap.instances.find((i) => i.name === 'Player');
    assert.strictEqual(hero.x, 4);
    assert.strictEqual(hero.y, 7);
    assert.strictEqual(hero.z, -2);
    game.destroy();
  }

  // 8.3 Pause, Pas-a-pas et Colliders debogage
  {
    const { game, step } = startGame(project);
    game.game.vars.moving = true;
    assert.strictEqual(game.isPaused(), false, 'le jeu demarre en execution');
    assert.strictEqual(game.hasDebugColliders(), false, 'colliders desactives par defaut');

    // Activation des colliders
    const toggled = game.setDebugColliders(true);
    assert.strictEqual(toggled, true);
    assert.strictEqual(game.hasDebugColliders(), true);

    const snapColl = game.debugSnapshot();
    assert.strictEqual(snapColl.debugColliders, true, 'snapshot reflete debugColliders');

    // Pause du jeu
    game.pause();
    assert.strictEqual(game.isPaused(), true, 'le jeu est mis en pause');
    const snapPaused = game.debugSnapshot();
    assert.strictEqual(snapPaused.isPaused, true, 'snapshot reflete isPaused');

    const heroBefore = snapPaused.instances.find((i) => i.name === 'Player');
    const xBefore = heroBefore.x;

    // Pendant la pause, step() ne doit pas avancer la simulation automatique
    step(5);
    const snapDuringPause = game.debugSnapshot();
    const heroDuring = snapDuringPause.instances.find((i) => i.name === 'Player');
    assert.strictEqual(heroDuring.x, xBefore, 'la physique est figee en pause');

    // stepFrame avance manuellement d une image
    game.stepFrame();
    const snapAfterStep = game.debugSnapshot();
    const heroAfterStep = snapAfterStep.instances.find((i) => i.name === 'Player');
    assert.strictEqual(heroAfterStep.x, xBefore + 1, 'stepFrame a avance d une image');
    assert.strictEqual(game.isPaused(), true, 'le jeu reste en pause apres stepFrame');

    // Reprise
    game.resume();
    assert.strictEqual(game.isPaused(), false, 'le jeu a repris');
    step(2);
    const snapResumed = game.debugSnapshot();
    const heroResumed = snapResumed.instances.find((i) => i.name === 'Player');
    assert.ok(heroResumed.x > heroAfterStep.x, 'le jeu continue de s executer normalement');

    game.destroy();
  }
}

assert.deepStrictEqual(logs.filter((l) => l.startsWith('[error]')), [], 'aucune erreur de script');
console.log('Simulation Runtime 3D : OK');
