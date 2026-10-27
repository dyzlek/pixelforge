/**
 * PixelForge — Tests unitaires de la structure et sculpture Terrain 3D (Issue #76)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Terrain3D } from '../terrain.js';

test('Terrain3D : initialise les dimensions et hauteurs par defaut', () => {
  const t = new Terrain3D({ width: 20, depth: 20 });
  assert.strictEqual(t.width, 20);
  assert.strictEqual(t.depth, 20);
  assert.strictEqual(t.getHeight(0, 0), 0);
  assert.strictEqual(t.getColor(0, 0), 6);
});

test('Terrain3D : monter le terrain (raise) augmente la hauteur avec attenuation', () => {
  const t = new Terrain3D({ width: 10, depth: 10 });
  t.raise(0, 0, 2, 4);

  const centerH = t.getHeight(0, 0);
  const sideH = t.getHeight(1, 0);
  const farH = t.getHeight(3, 0);

  assert.ok(centerH > 3.9, `Hauteur au centre (${centerH}) doit etre proche de 4`);
  assert.ok(sideH > 0 && sideH < centerH, `Hauteur a cote (${sideH}) doit etre inferieure au centre`);
  assert.strictEqual(farH, 0, 'Au-dela du rayon, la hauteur doit rester a 0');
});

test('Terrain3D : creuser le terrain (lower) reduit la hauteur sous le niveau zero', () => {
  const t = new Terrain3D({ width: 10, depth: 10 });
  t.lower(0, 0, 2, 3);

  const centerH = t.getHeight(0, 0);
  assert.ok(centerH < -2.9, `Hauteur au centre (${centerH}) doit etre inferieure a -2.9`);
});

test('Terrain3D : lisser le terrain (smooth) reduit les ecarts de relief', () => {
  const t = new Terrain3D({ width: 10, depth: 10 });
  t.setHeight(0, 0, 10); // pic isole a 10
  const beforeH = t.getHeight(0, 0);
  assert.strictEqual(beforeH, 10);

  t.smooth(0, 0, 2, 0.8);
  const afterH = t.getHeight(0, 0);
  assert.ok(afterH < beforeH, `Hauteur apres lissage (${afterH}) doit avoir diminue`);
  assert.ok(afterH > 0, 'Hauteur apres lissage doit rester positive');
});

test('Terrain3D : peindre le terrain (paint) modifie la couleur de surface', () => {
  const t = new Terrain3D({ width: 10, depth: 10 });
  t.paint(0, 0, 1, 4); // couleur or #ffcd75

  assert.strictEqual(t.getColor(0, 0), 4);
  assert.strictEqual(t.getColor(1, 0), 4);
  assert.strictEqual(t.getColor(4, 4), 6); // reste a la couleur par defaut
});

test('Terrain3D : toSolidBlocks genere des colonnes de blocs solides pour la physique', () => {
  const t = new Terrain3D({ width: 4, depth: 4, originX: 0, originZ: 0 });
  t.setHeight(1, 1, 3); // sommet a Y = 3

  const blocks = t.toSolidBlocks(-1);
  assert.ok(blocks['1,-1,1'] != null, 'Le fond Y=-1 doit exister');
  assert.ok(blocks['1,0,1'] != null, 'L etage Y=0 doit exister');
  assert.ok(blocks['1,1,1'] != null, 'L etage Y=1 doit exister');
  assert.ok(blocks['1,2,1'] != null, 'L etage Y=2 doit exister');
  assert.ok(blocks['1,3,1'] != null, 'Le sommet Y=3 doit exister');
  assert.strictEqual(blocks['1,4,1'], undefined, 'Au-dessus du sommet, aucun bloc');
});

test('Terrain3D : toProjectJSON et restauration conservent fidelement les donnees', () => {
  const t1 = new Terrain3D({ width: 16, depth: 16 });
  t1.raise(2, 3, 2, 5);
  t1.paint(2, 3, 1, 9);

  const json = t1.toProjectJSON();
  const t2 = new Terrain3D(json);

  assert.strictEqual(t2.width, 16);
  assert.strictEqual(t2.depth, 16);
  assert.strictEqual(t2.getHeight(2, 3), t1.getHeight(2, 3));
  assert.strictEqual(t2.getColor(2, 3), 9);
});
