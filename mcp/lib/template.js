// Modèle « platformer » : un petit niveau jouable (joueur, pièces, slimes, drapeau), construit avec les mêmes
// opérations que les outils MCP. Sprites en texte, voir sprites.js.
import { upsertSprite, upsertObject, upsertMap, paintMap, placeEntities, setSettings } from './ops.js';

const blank = '.'.repeat(16);
// centre horizontalement et cale en bas dans une frame 16x16
const pad = (rows, w = 16, h = 16) => [
  ...Array(h - rows.length).fill('.'.repeat(w)),
  ...rows.map((r) => { const l = Math.floor((w - r.length) / 2); return '.'.repeat(l) + r + '.'.repeat(w - l - r.length); }),
];
const left = (rows, w = 16, h = 16) => [...Array(h - rows.length).fill('.'.repeat(w)), ...rows.map((r) => r.padEnd(w, '.'))];

function bricks(body, hi, mortar) {
  const M = mortar.repeat(16);
  const A = body.repeat(7) + mortar + body.repeat(7) + mortar;
  const Ah = hi.repeat(7) + mortar + hi.repeat(7) + mortar;
  const B = body.repeat(3) + mortar + body.repeat(7) + mortar + body.repeat(4);
  const Bh = hi.repeat(3) + mortar + hi.repeat(7) + mortar + hi.repeat(4);
  return [M, Ah, A, A, M, Bh, B, B, M, Ah, A, A, M, Bh, B, B];
}
const DIRT = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => ((x * 7 + y * 13) % 11 === 0 ? '1' : '2')).join(''));
const GRASS = ['5555555555555555', '6666666666666666', '6676666766666766', '2262226222262222', ...DIRT.slice(4)];

const HEAD = ['......22222.....', '.....2222222....', '.....1111111....', '.....3333303....', '.....3333333....', '......33333.....'];
const TORSO = ['.....9999999....', '....399999993...', '....33999993....', '.....4444444....'];
const LEGS = {
  idle: ['.....8888888....', '.....888.888....', '.....888.888....', '.....111.111....', '....1111.1111...'],
  runA: ['.....8888888....', '....888..888....', '...888....888...', '..888......888..', '..111......111..'],
  runC: ['.....8888888....', '.....888..888...', '....888....888..', '...888......88..', '...111......11..'],
};
const PLAYER = [
  [blank, ...HEAD, ...TORSO, ...LEGS.idle],
  [blank, blank, ...HEAD, TORSO[0], TORSO[2], TORSO[3], ...LEGS.idle],
  [blank, ...HEAD, ...TORSO, ...LEGS.runA],
  [blank, ...HEAD, ...TORSO, ...LEGS.runC],
];

function coin(rx) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / rx, dy = (y + 0.5 - 8) / 6.5, d = dx * dx + dy * dy;
      row += d > 1 ? '.' : d > 0.5 ? '3' : dx < -0.2 && dy < -0.2 ? 'c' : '4';
    }
    rows.push(row);
  }
  return rows;
}

const SLIME = [
  pad(['6666', '66666666', '556666666666', '66666666666666', '66cc666666cc66', '66c0666666c066', '66666666666666', '6666666666666666', '6666666666666666', '7777777777777777']),
  pad(['66666666', '556666666666', '6666666666666666', '66cc66666666cc66', '66c066666666c066', '6666666666666666', '6666666666666666', '7777777777777777']),
];
const FLAG = left(['..44', '..cd2222222', '..cd22222222', '..cd2222222', '..cd222222', '..cd2222', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '.eeeeee']);

const S_GLOBAL = `// Global script: runs once when each map starts (self is null here).
game.vars.showScore = () => game.setText('score', 'Coins: ' + game.score, 4, 4);
on('create', () => {
  game.vars.showScore();
});
`;

const S_PLAYER = `const SPEED = 90;
const JUMP = 290;

on('create', () => {
  game.camera.follow(self);
});

on('update', (dt) => {
  self.vx = 0;
  if (input.isDown('LEFT') || input.isDown('A') || input.isDown('Q')) { self.vx = -SPEED; self.flipX = true; }
  if (input.isDown('RIGHT') || input.isDown('D')) { self.vx = SPEED; self.flipX = false; }
  if (input.justPressed('SPACE') || input.justPressed('UP') || input.justPressed('W') || input.justPressed('Z')) self.jump(JUMP);
  self.play(self.vx !== 0 ? 'run' : 'idle');
  // fell into a hole: restart the level
  if (self.y > game.mapHeight + 32) { game.score = 0; game.restart(); }
});
`;

const S_COIN = `on('overlap', 'Player', () => {
  self.destroy();
  game.score += 1;
  game.vars.showScore();
});
`;

const S_ENEMY = `const SPEED = 30;
let dir = -1;

on('create', () => { self.vx = dir * SPEED; });

on('update', () => {
  if (self.vx === 0) dir = -dir; // blocked by a wall: turn around
  self.vx = dir * SPEED;
  self.flipX = dir > 0;
  if (self.y > game.mapHeight + 16) self.destroy();
});

on('timer', 1400, () => { dir = -dir; });

on('collide', 'Player', (player) => {
  // collide fires after physical separation: use geometry to know if the player landed on top
  const fromAbove = player.y + player.height - self.y < 10;
  if (fromAbove) {
    self.destroy();
    player.vy = -180;
    game.score += 3;
    game.vars.showScore();
  } else {
    game.camera.shake(150, 0.01);
    game.score = 0;
    game.restart();
  }
});
`;

const S_FLAG = `on('overlap', 'Player', () => {
  if (self.vars.won) return;
  self.vars.won = true;
  game.camera.flash(300);
  game.setText('win', 'You win! Score: ' + game.score + '  (ENTER = replay)', 20, 70);
});
on('keydown', 'ENTER', () => {
  if (self.vars.won) { game.score = 0; game.restart(); }
});
`;

export function applyPlatformerTemplate(p) {
  upsertSprite(p, { name: 'Tileset', frames: [GRASS, DIRT, bricks('2', '3', 'd'), bricks('f', 'e', '8')] });
  upsertSprite(p, { name: 'Player', frames: PLAYER, animations: [{ name: 'idle', frames: [0, 1], fps: 3, loop: true }, { name: 'run', frames: [2, 3], fps: 8, loop: true }] });
  upsertSprite(p, { name: 'Coin', frames: [6, 4, 1.4, 4].map(coin), animations: [{ name: 'spin', frames: [0, 1, 2, 3], fps: 8, loop: true }] });
  upsertSprite(p, { name: 'Slime', frames: SLIME, animations: [{ name: 'idle', frames: [0, 1], fps: 3, loop: true }] });
  upsertSprite(p, { name: 'Flag', frames: [FLAG] });
  const still = { gravity: false, immovable: true, collideMap: false, collideWorld: false };
  upsertObject(p, { name: 'Player', sprite: 'Player', defaultAnim: 'idle', hitbox: { x: 4, y: 1, w: 8, h: 15 }, physics: { collideWorld: false }, code: S_PLAYER });
  upsertObject(p, { name: 'Coin', sprite: 'Coin', defaultAnim: 'spin', hitbox: { x: 3, y: 3, w: 10, h: 10 }, physics: still, code: S_COIN });
  upsertObject(p, { name: 'Enemy', sprite: 'Slime', defaultAnim: 'idle', hitbox: { x: 1, y: 6, w: 14, h: 10 }, physics: { immovable: true, collideWorld: false }, code: S_ENEMY });
  upsertObject(p, { name: 'Flag', sprite: 'Flag', hitbox: { x: 2, y: 0, w: 10, h: 16 }, physics: still, code: S_FLAG });
  p.globalScript = { mode: 'code', code: S_GLOBAL };

  setSettings(p, { background: '#41a6f6' });
  upsertMap(p, { name: 'Level 1', width: 40, height: 12, tileset: 'Tileset', background: '#41a6f6', start: true, layers: [{ name: 'Background', collides: false }, { name: 'Ground', collides: true }] });
  const W = 40, H = 12;
  const grid = () => Array.from({ length: H }, () => Array(W).fill('.'));
  const set = (g, x, y, c) => { g[y][x] = c; };
  const ground = grid();
  const holes = new Set([16, 17, 28, 29, 30]);
  for (let x = 0; x < W; x++) if (!holes.has(x)) { set(ground, x, 10, 'G'); set(ground, x, 11, 'D'); }
  for (let y = 0; y < 10; y++) { set(ground, 0, y, 'S'); set(ground, W - 1, y, 'S'); }
  for (const x of [17, 18, 19]) set(ground, x, 6, 'G');
  for (const x of [9, 10, 11, 32, 33, 34]) set(ground, x, 7, 'G');
  set(ground, 34, 8, 'B'); set(ground, 34, 9, 'B');
  paintMap(p, { map: 'Level 1', layer: 'Ground', legend: { G: 0, D: 1, B: 2, S: 3 }, rows: ground.map((r) => r.join('')) });

  const ents = grid();
  set(ents, 2, 9, 'P'); set(ents, 12, 9, 'E'); set(ents, 24, 9, 'E'); set(ents, 37, 9, 'F');
  for (const [x, y] of [[6, 9], [8, 9], [10, 6], [17, 5], [18, 5], [19, 5], [26, 9], [33, 6], [14, 9]]) set(ents, x, y, 'C');
  placeEntities(p, { map: 'Level 1', mode: 'replace', legend: { P: 'Player', C: 'Coin', E: 'Enemy', F: 'Flag' }, rows: ents.map((r) => r.join('')) });
}
