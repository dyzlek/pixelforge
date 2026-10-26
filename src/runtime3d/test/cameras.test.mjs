/**
 * Tests unitaires pour les contrôleurs de caméras 3D et l'anti-occlusion
 */

import assert from 'node:assert';
import { createCameraController, CAMERA_MODES } from '../cameras.js';

console.log('=== Tests Caméras 3D & Anti-Occlusion ===');

// Mock simple de la caméra Three.js
function createMockCamera() {
  return {
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; },
    },
    lookAtTarget: null,
    lookAt(x, y, z) {
      this.lookAtTarget = { x, y, z };
    },
  };
}

// 1. Modes de caméra
assert.strictEqual(CAMERA_MODES.THIRD_PERSON, 'third-person');
assert.strictEqual(CAMERA_MODES.FIRST_PERSON, 'first-person');
assert.strictEqual(CAMERA_MODES.TOP_DOWN, 'top-down');
assert.strictEqual(CAMERA_MODES.ISOMETRIC, 'isometric');
assert.strictEqual(CAMERA_MODES.SIDE_SCROLL, 'side-scroll');

// 2. Suivi standard 3e personne dans le vide (sans mur)
const mockCam1 = createMockCamera();
const target1 = { x: 0, y: 0, z: 0, rotationY: 0 };
const ctrl1 = createCameraController(mockCam1, {
  mode: CAMERA_MODES.THIRD_PERSON,
  target: target1,
  distance: 6,
  height: 3,
  lerp: 1.0, // lerp instantane pour les tests
});

ctrl1.update(16, null);
// Avec rotationY = 0, la camera doit etre derriere a z = +6, y autour de 3.8
assert.strictEqual(Math.round(mockCam1.position.z), 6);
assert.ok(mockCam1.position.y >= 3 && mockCam1.position.y <= 4);

// 3. Anti-occlusion murale : un mur est place a z = 3 (entre cible en z=0 et camera en z=6)
const solidBlocks = new Map();
solidBlocks.set('0,2,3', '#ffffff'); // mur bloque la ligne de vue

const mockCam2 = createMockCamera();
const target2 = { x: 0, y: 0, z: 0, rotationY: 0 };
const ctrl2 = createCameraController(mockCam2, {
  mode: CAMERA_MODES.THIRD_PERSON,
  target: target2,
  distance: 6,
  height: 3,
  lerp: 1.0,
  solidBlocks,
});

ctrl2.update(16, null);
// La camera NE DOIT PAS etre en z=6 derriere le mur, mais avancee avant le mur (z < 3) !
assert.ok(mockCam2.position.z < 3, `La camera doit eviter le mur (position z=${mockCam2.position.z})`);
assert.ok(mockCam2.position.z > 0.5, 'La camera ne doit pas etre collee a la cible');

// 4. Mode 1re personne (FPS) avec delta souris
const mockCam3 = createMockCamera();
const target3 = { x: 5, y: 2, z: 5, rotationY: 0 };
const ctrl3 = createCameraController(mockCam3, {
  mode: CAMERA_MODES.FIRST_PERSON,
  target: target3,
});

const inputMock = { mouseDeltaX: 10, mouseDeltaY: 5 };
ctrl3.update(16, inputMock);
// Position de la camera au niveau des yeux du joueur
assert.strictEqual(mockCam3.position.x, 5);
assert.ok(mockCam3.position.y > 2);
assert.strictEqual(mockCam3.position.z, 5);

console.log('Tous les tests Caméras 3D sont valides !');
