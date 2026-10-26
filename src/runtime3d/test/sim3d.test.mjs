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
  constructor() { this.position = new Vec3(); this.rotation = new Vec3(); this.children = []; }
  add(c) { this.children.push(c); }
  remove(c) { this.children = this.children.filter((x) => x !== c); }
  lookAt() {}
}
const THREE = {
  Scene: Obj3D,
  Group: Obj3D,
  Color,
  FogExp2: class { constructor(c, d) { this.color = c; this.density = d; } },
  PerspectiveCamera: class extends Obj3D { updateProjectionMatrix() {} },
  WebGLRenderer: class { setSize() {} setPixelRatio() {} render() {} dispose() {} forceContextLoss() {} },
  AmbientLight: class extends Obj3D { constructor() { super(); this.color = new Color('#ffffff'); this.intensity = 1; } },
  DirectionalLight: class extends Obj3D { constructor() { super(); this.color = new Color('#ffffff'); this.intensity = 1; } },
  BoxGeometry: class { dispose() {} },
  MeshLambertMaterial: class { constructor(o) { this.opts = o; } dispose() {} },
  Mesh: class extends Obj3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
  BufferGeometry: class { constructor() { this.attributes = {}; } setAttribute(n, a) { this.attributes[n] = a; } dispose() {} },
  Float32BufferAttribute: class { constructor(arr, size) { this.array = arr; this.itemSize = size; this.count = arr.length / size; } },
  Raycaster: class { intersectObjects() { return []; } },
  Vector3: Vec3,
};

const logs = [];
function startGame(project) {
  const parent = fakeElement('div');
  const game = createGame3D(project, parent, THREE, { onLog: (m, l) => logs.push(`[${l}] ${m}`) });
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

assert.deepStrictEqual(logs.filter((l) => l.startsWith('[error]')), [], 'aucune erreur de script');
console.log('Simulation Runtime 3D : OK');
