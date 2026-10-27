/**
 * PixelForge — Generateur de jeu complet par l'IA (Phase H - H5 - Issue #93)
 * Produit un jeu complet, jouable et terminable de 3 niveaux avec boss, en 2D ou 3D.
 * Conforme aux principes de Game Design (Kishotenketsu, Coyote Time, Jump Buffering).
 * Fonctions pures, zero dependance DOM ni Node.
 */

import {
  setSettings,
  upsertSprite,
  upsertObject,
  upsertMap,
  paintMap,
  placeEntities,
  upsertScene3D,
  paintGridMap,
  upsertModel,
  importModel,
  addSound,
  upsertSong,
  validateProject,
} from '../core/ops/index.js';

import {
  generateSpriteData,
  generateSongData,
  generateModelData,
  generateSoundData,
} from './generators.js';
import { runPlaytestAndFix } from './playtester.js';
import {
  STANDARD_PLAYER_2D_SCRIPT,
  STANDARD_PLAYER_3D_SCRIPT,
} from './gameplay-standards.js';

/**
 * Normalise un texte pour recherche de mots-cles
 */
function norm(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * 1. Generateur de Document de Conception (GDD - Game Design Document)
 * Produit un document concis, structure, presentable a l'utilisateur et modifiable.
 */
export function generateGameDesignDocument(description = '', options = {}) {
  const d = norm(description);
  const is3D = options.dimension === '3d' || d.includes('3d') || d.includes('voxel') || d.includes('three');
  const dimension = is3D ? '3d' : '2d';

  // Determination du theme et du titre
  let title = options.name;
  if (!title) {
    if (d.includes('chevalier') || d.includes('chateau') || d.includes('donjon') || d.includes('medieval')) {
      title = is3D ? 'La Quete du Chevalier 3D' : 'L Epopée du Chevalier';
    } else if (d.includes('slime') || d.includes('foret') || d.includes('prairie')) {
      title = is3D ? 'Slime World 3D' : 'L Aventure du Slime';
    } else if (d.includes('espace') || d.includes('sci-fi') || d.includes('galaxie')) {
      title = is3D ? 'Cosmo Runner 3D' : 'Aventure Cosmique';
    } else {
      title = is3D ? 'Pixel Adventure 3D' : 'Aventure Retro';
    }
  }

  const gdd = {
    title,
    dimension,
    genre: is3D ? 'Plateforme 3D retro voxel' : 'Plateforme 2D pixel art',
    pitch: `Un jeu de plateforme dynamique et complet en 3 niveaux progressifs ou le joueur traverse des epreuves equilibrees avant d affronter un boss redoutable dans son arene.`,
    controls: is3D
      ? { move: 'Z/Q/S/D ou W/A/S/D ou Fleches (deplacement et rotation)', jump: 'ESPACE ou Fleche HAUT', camera: 'Camera troisieme personne avec suivi dynamique' }
      : { move: 'Fleches GAUCHE / DROITE ou Q / D ou A / D', jump: 'ESPACE ou Fleche HAUT ou Z ou W', restart: 'R ou ENTREE' },
    gameFeel: {
      coyoteTime: 100, // ms
      jumpBuffering: 100, // ms
      variableJump: true,
      stompMechanic: true,
    },
    levels: [
      {
        id: 'level1',
        name: is3D ? 'Scene 1' : 'Niveau 1',
        subtitle: 'Introduction (Ki)',
        goal: 'Prise en main des commandes, decouverte du saut, premiers collectibles et un patrouilleur isole.',
        difficulty: 'Facile',
      },
      {
        id: 'level2',
        name: is3D ? 'Scene 2' : 'Niveau 2',
        subtitle: 'Developpement (Sho)',
        goal: 'Plateformes surlevees avec espacement calcule, fosses a enjamber, 2 ennemis patrouilleurs et collectibles en cloche.',
        difficulty: 'Moyen',
      },
      {
        id: 'level3',
        name: is3D ? 'Scene 3 - Boss' : 'Niveau 3 - Boss',
        subtitle: 'Climax & Boss (Ten / Ketsu)',
        goal: 'Arene de combat close avec plateformes d esquive, Boss a 3 points de vie qui saute et charge. Le vaincre declenche la victoire !',
        difficulty: 'Difficile',
      },
    ],
    entities: [
      { name: 'Player', role: 'Hero controle par le joueur avec Game Feel professionnel' },
      { name: 'Coin', role: 'Collectible rapportant 10 points avec animation et tintement' },
      { name: 'Enemy', role: 'Monstre patrouilleur eliminable d un saut sur la tete' },
      { name: 'Boss', role: 'Ennemi majeur a 3 points de vie protegeant la sortie finale' },
      { name: 'Portal', role: 'Portail de teleportation menant au niveau suivant ou a la victoire' },
    ],
    audio: {
      music: 'ThemeAventure (chiptune entrainante multi-canaux)',
      sounds: ['jump (saut vif)', 'coin (tintement gratifiant)', 'hit (impact sourd)', 'powerup (victoire et succes)'],
    },
    hud: {
      score: true,
      levelName: true,
      bossHp: true,
    },
  };

  // Generation de la synthese Markdown lisible par l'utilisateur
  gdd.markdown = `# Document de Conception (GDD) : ${gdd.title}

## 1. Concept et Direction
- **Titre** : ${gdd.title}
- **Dimension** : ${gdd.dimension.toUpperCase()} (${gdd.genre})
- **Pitch** : ${gdd.pitch}

## 2. Controles et Game Feel
- **Deplacements** : ${gdd.controls.move}
- **Saut** : ${gdd.controls.jump}
- **Game Feel** : Coyote Time (${gdd.gameFeel.coyoteTime} ms), Jump Buffering (${gdd.gameFeel.jumpBuffering} ms), saut a hauteur variable.

## 3. Progression des 3 Niveaux (Structure Kishotenketsu)
1. **${gdd.levels[0].name} — ${gdd.levels[0].subtitle}** : ${gdd.levels[0].goal} (${gdd.levels[0].difficulty})
2. **${gdd.levels[1].name} — ${gdd.levels[1].subtitle}** : ${gdd.levels[1].goal} (${gdd.levels[1].difficulty})
3. **${gdd.levels[2].name} — ${gdd.levels[2].subtitle}** : ${gdd.levels[2].goal} (${gdd.levels[2].difficulty})

## 4. Entites et Elements de Jeu
- **Player** : personnage reactif et anime.
- **Coin** : bonus (+10 pts) positionnes sur les trajectoires ideales de saut.
- **Enemy** : patrouilleurs eliminables par le dessus (+100 pts).
- **Boss** : 3 PV, deplacement rapide, saut et telegraphing.
- **Portal** : transition fluide vers le niveau suivant ou la victoire finale.

## 5. Environnement Sonore et Affichage
- **Bande-son** : ${gdd.audio.music}
- **Effets SFXR** : ${gdd.audio.sounds.join(', ')}
- **Interface HUD** : Score en temps reel et indication du niveau courant.
`;

  return gdd;
}

// ============================================================================
// 2. SCRIPTS DES OBJETS DE JEU (2D & 3D)
// ============================================================================

const SCRIPT_PLAYER_2D = STANDARD_PLAYER_2D_SCRIPT;

const SCRIPT_COIN_2D = `
// Collectible avec animation de flottement
let startY = 0;
let time = 0;

on('create', () => {
  startY = self.y;
});

on('update', (dt) => {
  time += dt * 0.005;
  self.y = startY + Math.sin(time) * 3;
});

on('overlap', 'Player', () => {
  self.destroy();
  game.score = (game.score || 0) + 10;
  game.setText('hud', 'Score : ' + game.score + ' | ' + (game.currentMapName || ''), 8, 8);
  game.playSound('coin', 0.8, 1);
});
`.trim();

const SCRIPT_ENEMY_2D = `
// Monstre patrouilleur eliminable par le dessus
let dir = 1;
const SPEED = 45;

on('create', () => {
  self.vx = dir * SPEED;
});

on('update', () => {
  if (self.vx === 0) {
    dir = -dir;
  }
  self.vx = dir * SPEED;
  self.flipX = dir < 0;
});

on('timer', 1500, () => {
  dir = -dir;
});

on('collide', 'Player', (p) => {
  // Si le joueur touche par le dessus avec velocite descendante
  if (p.y + p.height - self.y < 14 && p.vy > 0) {
    self.destroy();
    p.vy = -220;
    game.score = (game.score || 0) + 100;
    game.setText('hud', 'Score : ' + game.score + ' | ' + (game.currentMapName || ''), 8, 8);
    game.playSound('hit', 0.8, 1.3);
  } else {
    game.restart();
  }
});
`.trim();

const SCRIPT_BOSS_2D = `
// Boss de fin de niveau avec 3 points de vie et sauts d attaque
let dir = -1;
let hp = 3;
const SPEED = 65;

on('create', () => {
  self.vars.hp = hp;
  self.vx = dir * SPEED;
});

on('update', () => {
  if (self.vx === 0) {
    dir = -dir;
  }
  self.vx = dir * SPEED;
  self.flipX = dir > 0;
});

on('timer', 1200, () => {
  dir = -dir;
  if (self.onGround && Math.random() > 0.4) {
    self.jump(250);
  }
});

on('collide', 'Player', (p) => {
  if (p.y + p.height - self.y < 16 && p.vy > 0) {
    hp--;
    self.vars.hp = hp;
    p.vy = -260;
    game.playSound('hit', 0.9, 0.8);

    if (hp <= 0) {
      self.destroy();
      game.score = (game.score || 0) + 500;
      game.setText('hud', 'Score : ' + game.score + ' | VICTOIRE !', 8, 8);
      game.setText('win', 'BRAVO ! LE BOSS EST VAINCU !', 50, 70);
      game.playSound('powerup', 1, 1);
    } else {
      game.setText('hud', 'Score : ' + game.score + ' | BOSS HP : ' + hp, 8, 8);
    }
  } else {
    game.restart();
  }
});
`.trim();

const SCRIPT_PORTAL_2D = `
// Portail de transition vers le niveau suivant ou ecran de victoire
on('overlap', 'Player', () => {
  const current = game.currentMapName || '';
  if (current === 'Niveau 1') {
    game.goToMap('Niveau 2');
  } else if (current === 'Niveau 2') {
    game.goToMap('Niveau 3 - Boss');
  } else {
    game.setText('win', 'FELICITATIONS ! JEU TERMINE !', 55, 75);
    game.playSound('powerup', 1, 1);
  }
});
`.trim();

// Scripts 3D
const SCRIPT_PLAYER_3D = STANDARD_PLAYER_3D_SCRIPT;

const SCRIPT_COIN_3D = `
on('update', () => {
  self.rotateY(4);
});

on('overlap', 'Player', () => {
  self.destroy();
  game.score = (game.score || 0) + 10;
  game.setText('hud', 'Score : ' + game.score, 8, 8);
  game.playSound('coin', 0.8, 1);
});
`.trim();

const SCRIPT_ENEMY_3D = `
let dir = 1;
on('update', () => {
  self.moveForward(dir * 3);
});

on('timer', 2000, () => {
  dir = -dir;
  self.rotateY(180);
});

on('collide', 'Player', (p) => {
  if (p.y > self.y + 1.2 && p.vy < 0) {
    self.destroy();
    p.vy = 8;
    game.score = (game.score || 0) + 100;
    game.setText('hud', 'Score : ' + game.score, 8, 8);
    game.playSound('hit', 0.8, 1.3);
  } else {
    game.restart();
  }
});
`.trim();

const SCRIPT_BOSS_3D = `
let dir = 1;
let hp = 3;
on('update', () => {
  self.moveForward(dir * 5);
  self.rotateY(2);
});

on('timer', 1500, () => {
  dir = -dir;
  if (self.onGround) self.jump(8);
});

on('collide', 'Player', (p) => {
  if (p.y > self.y + 1.5 && p.vy < 0) {
    hp--;
    p.vy = 10;
    game.playSound('hit', 0.9, 0.8);
    if (hp <= 0) {
      self.destroy();
      game.score = (game.score || 0) + 500;
      game.setText('hud', 'Score : ' + game.score + ' | VICTOIRE !', 8, 8);
      game.setText('win', 'BRAVO ! BOSS 3D VAINCU !', 60, 70);
      game.playSound('powerup', 1, 1);
    } else {
      game.setText('hud', 'Score : ' + game.score + ' | BOSS HP : ' + hp, 8, 8);
    }
  } else {
    game.restart();
  }
});
`.trim();

const SCRIPT_PORTAL_3D = `
on('update', () => {
  self.rotateY(2);
});

on('overlap', 'Player', () => {
  const current = game.currentSceneName || game.currentMapName || '';
  if (current === 'Scene 1') {
    game.goToScene('Scene 2');
  } else if (current === 'Scene 2') {
    game.goToScene('Scene 3 - Boss');
  } else {
    game.setText('win', 'FELICITATIONS ! JEU 3D TERMINE !', 50, 70);
    game.playSound('powerup', 1, 1);
  }
});
`.trim();

// ============================================================================
// 3. CONSTRUCTION DU JEU 2D (3 NIVEAUX + BOSS)
// ============================================================================

function buildGame2D(project, gdd) {
  // 1. Parametres generaux
  setSettings(project, {
    name: gdd.title,
    dimension: '2d',
    width: 320,
    height: 180,
    tileSize: 16,
    gravity: 800,
    background: '#41a6f6',
  });

  // 2. Sprites necessaires
  // Tileset : herbe (0), terre (1), briques (2), metal sombre (3)
  const tilesetData = {
    name: 'Tileset',
    frames: [
      // 0: Herbe
      [
        '6565565665655656',
        '6656665666566656',
        '7667667676676676',
        '.7..7...7.7..7..',
        '3333333333333333',
        '3e3333e333e3333e',
        'eeeeeeeeeeeeeeee',
        'e0e0ee0eee0ee0e0',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
      ],
      // 1: Terre
      [
        '3333333333333333',
        '3e3333e333e3333e',
        'eeeeeeeeeeeeeeee',
        'e0e0ee0eee0ee0e0',
        '3333333333333333',
        '3e3333e333e3333e',
        'eeeeeeeeeeeeeeee',
        'e0e0ee0eee0ee0e0',
        '3333333333333333',
        '3e3333e333e3333e',
        'eeeeeeeeeeeeeeee',
        'e0e0ee0eee0ee0e0',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
        '0000000000000000',
      ],
      // 2: Briques
      [
        'ffffffffffffffff',
        'feeeeeedfeeeeeed',
        'feeeeeedfeeeeeed',
        'fdddddddfddddddd',
        'ffffffffffffffff',
        'edfeeeeeedfeeeee',
        'edfeeeeeedfeeeee',
        'ddfdddddddfddddd',
        'ffffffffffffffff',
        'feeeeeedfeeeeeed',
        'feeeeeedfeeeeeed',
        'fdddddddfddddddd',
        'ffffffffffffffff',
        'edfeeeeeedfeeeee',
        'edfeeeeeedfeeeee',
        'ddfdddddddfddddd',
      ],
      // 3: Metal sombre
      [
        'ffffffffffffffff',
        'f00000000000000f',
        'f0ffffffffffff0f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f0feeeeeeeeee00f',
        'f00000000000000f',
        'f00000000000000f',
        'ffffffffffffffff',
      ],
    ],
  };
  upsertSprite(project, tilesetData);

  // Sprites du joueur, des pieces, de l'ennemi et du boss
  const playerSpr = generateSpriteData('chevalier en armure', { name: 'Player' });
  upsertSprite(project, playerSpr);

  const coinSpr = generateSpriteData('piece d or tournoyante', { name: 'Coin' });
  upsertSprite(project, coinSpr);

  const enemySpr = generateSpriteData('slime vert rebondissant', { name: 'Enemy' });
  upsertSprite(project, enemySpr);

  // Boss : grand sprite sombre et menacant
  const bossSpr = {
    name: 'Boss',
    width: 16,
    height: 16,
    frames: [
      [
        '................',
        '.....11111......',
        '....1222221.....',
        '...12cc2cc21....',
        '...120020021....',
        '...122222221....',
        '....1222221.....',
        '..11122222111...',
        '.1222111112221..',
        '.1222222222221..',
        '.1212222222121..',
        '..11222222211...',
        '...111111111....',
        '...1001.1001....',
        '...1001.1001....',
        '...1111.1111....',
      ],
      [
        '................',
        '................',
        '.....11111......',
        '....1222221.....',
        '...12cc2cc21....',
        '...120020021....',
        '...122222221....',
        '....1222221.....',
        '..11122222111...',
        '.1222111112221..',
        '.1222222222221..',
        '.1212222222121..',
        '..11222222211...',
        '...111111111....',
        '...1001.1001....',
        '...1111.1111....',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 3, loop: true },
      { name: 'walk', frames: [0, 1], fps: 6, loop: true },
      { name: 'run', frames: [0, 1], fps: 8, loop: true },
      { name: 'jump', frames: [0], fps: 1, loop: false },
    ],
  };
  upsertSprite(project, bossSpr);

  // Portail de sortie
  const portalSpr = {
    name: 'Portal',
    width: 16,
    height: 16,
    frames: [
      [
        '.....bbbbbb.....',
        '...bbaaaaaabb...',
        '..baaaaaaaaaab..',
        '.baaaaccccaaaab.',
        '.baaaccccccaaab.',
        'baaacccccccccaab',
        'baaacccccccccaab',
        'baaacccccccccaab',
        'baaacccccccccaab',
        'baaacccccccccaab',
        'baaacccccccccaab',
        '.baaaccccccaaab.',
        '.baaaaccccaaaab.',
        '..baaaaaaaaaab..',
        '...bbaaaaaabb...',
        '.....bbbbbb.....',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0], fps: 1, loop: false },
    ],
  };
  upsertSprite(project, portalSpr);

  // 3. Objets avec physique et scripts
  const still = { enabled: true, gravity: false, immovable: true, collideMap: false, collideWorld: false };
  upsertObject(project, {
    name: 'Player',
    sprite: 'Player',
    defaultAnim: 'idle',
    hitbox: { x: 3, y: 1, w: 10, h: 15 },
    physics: { enabled: true, gravity: true, immovable: false, bounce: 0, collideMap: true, collideWorld: false },
    code: SCRIPT_PLAYER_2D,
  });

  upsertObject(project, {
    name: 'Coin',
    sprite: 'Coin',
    defaultAnim: 'idle',
    hitbox: { x: 2, y: 2, w: 12, h: 12 },
    physics: still,
    code: SCRIPT_COIN_2D,
  });

  upsertObject(project, {
    name: 'Enemy',
    sprite: 'Enemy',
    defaultAnim: 'idle',
    hitbox: { x: 2, y: 4, w: 12, h: 12 },
    physics: { enabled: true, gravity: true, immovable: true, collideMap: true, collideWorld: false },
    code: SCRIPT_ENEMY_2D,
  });

  upsertObject(project, {
    name: 'Boss',
    sprite: 'Boss',
    defaultAnim: 'idle',
    hitbox: { x: 2, y: 2, w: 12, h: 14 },
    physics: { enabled: true, gravity: true, immovable: true, collideMap: true, collideWorld: false },
    code: SCRIPT_BOSS_2D,
  });

  upsertObject(project, {
    name: 'Portal',
    sprite: 'Portal',
    defaultAnim: 'idle',
    hitbox: { x: 1, y: 1, w: 14, h: 14 },
    physics: still,
    code: SCRIPT_PORTAL_2D,
  });

  // 4. Cartes des 3 niveaux complets
  // Niveau 1 : Introduction (Ki)
  const W1 = 40;
  const H1 = 12;
  upsertMap(project, {
    name: 'Niveau 1',
    width: W1,
    height: H1,
    tileset: 'Tileset',
    background: '#41a6f6',
    start: true,
    layers: [
      { name: 'Ground', collides: true, visible: true },
    ],
  });

  const g1 = Array.from({ length: H1 }, () => Array(W1).fill('.'));
  const hole1 = new Set([18, 19]); // Petit fosse franchissable
  for (let x = 0; x < W1; x++) {
    if (!hole1.has(x)) {
      g1[10][x] = '0'; // Herbe
      g1[11][x] = '1'; // Terre
    }
  }
  // Murs aux extremites
  for (let y = 0; y < 10; y++) {
    g1[y][0] = '2';
    g1[y][W1 - 1] = '2';
  }
  // Petite plateforme d'initiation au saut
  for (const x of [10, 11, 12, 13]) g1[7][x] = '0';

  paintMap(project, {
    map: 'Niveau 1',
    layer: 'Ground',
    rows: g1.map((r) => r.join('')),
  });

  placeEntities(project, {
    map: 'Niveau 1',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 32, y: 144 },
      { object: 'Coin', x: 160, y: 96 },
      { object: 'Coin', x: 176, y: 96 },
      { object: 'Coin', x: 192, y: 96 },
      { object: 'Coin', x: 260, y: 144 },
      { object: 'Coin', x: 290, y: 144 },
      { object: 'Enemy', x: 350, y: 144 },
      { object: 'Portal', x: 576, y: 144 },
    ],
  });

  // Niveau 2 : Developpement (Sho) - Plateformes surlevees et fosses
  const W2 = 45;
  const H2 = 12;
  upsertMap(project, {
    name: 'Niveau 2',
    width: W2,
    height: H2,
    tileset: 'Tileset',
    background: '#3b5dc9',
    start: false,
    layers: [
      { name: 'Ground', collides: true, visible: true },
    ],
  });

  const g2 = Array.from({ length: H2 }, () => Array(W2).fill('.'));
  const hole2 = new Set([12, 13, 22, 23, 24, 34, 35]);
  for (let x = 0; x < W2; x++) {
    if (!hole2.has(x)) {
      g2[10][x] = '0';
      g2[11][x] = '1';
    }
  }
  for (let y = 0; y < 10; y++) {
    g2[y][0] = '2';
    g2[y][W2 - 1] = '2';
  }
  // Plateformes en hauteur accessibles (hauteur d'un saut = 32-48px)
  for (const x of [12, 13, 14]) g2[7][x] = '0';
  for (const x of [22, 23, 24]) g2[6][x] = '0';
  for (const x of [33, 34, 35]) g2[7][x] = '0';

  paintMap(project, {
    map: 'Niveau 2',
    layer: 'Ground',
    rows: g2.map((r) => r.join('')),
  });

  placeEntities(project, {
    map: 'Niveau 2',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 32, y: 144 },
      { object: 'Enemy', x: 110, y: 144 },
      { object: 'Coin', x: 200, y: 80 },
      { object: 'Coin', x: 216, y: 80 },
      { object: 'Coin', x: 360, y: 64 },
      { object: 'Coin', x: 376, y: 64 },
      { object: 'Enemy', x: 450, y: 144 },
      { object: 'Coin', x: 540, y: 80 },
      { object: 'Portal', x: 656, y: 144 },
    ],
  });

  // Niveau 3 : Arene du Boss (Ten / Ketsu)
  const W3 = 30;
  const H3 = 12;
  upsertMap(project, {
    name: 'Niveau 3 - Boss',
    width: W3,
    height: H3,
    tileset: 'Tileset',
    background: '#1a1c2c',
    start: false,
    layers: [
      { name: 'Ground', collides: true, visible: true },
    ],
  });

  const g3 = Array.from({ length: H3 }, () => Array(W3).fill('.'));
  for (let x = 0; x < W3; x++) {
    g3[10][x] = '2'; // Briques solides
    g3[11][x] = '3';
  }
  // Murs de l'arene
  for (let y = 0; y < 10; y++) {
    g3[y][0] = '2';
    g3[y][1] = '3';
    g3[y][W3 - 2] = '3';
    g3[y][W3 - 1] = '2';
  }
  // Deux plateformes d'esquive
  for (const x of [6, 7, 8]) g3[7][x] = '2';
  for (const x of [21, 22, 23]) g3[7][x] = '2';

  paintMap(project, {
    map: 'Niveau 3 - Boss',
    layer: 'Ground',
    rows: g3.map((r) => r.join('')),
  });

  placeEntities(project, {
    map: 'Niveau 3 - Boss',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 48, y: 144 },
      { object: 'Boss', x: 260, y: 144 },
      { object: 'Coin', x: 112, y: 80 },
      { object: 'Coin', x: 352, y: 80 },
      { object: 'Portal', x: 400, y: 144 },
    ],
  });

  // 5. Sons et Musique
  addSound(project, { name: 'jump', preset: 'jump', pitch: 1.2, volume: 0.7 });
  addSound(project, { name: 'coin', preset: 'coin', pitch: 1.0, volume: 0.8 });
  addSound(project, { name: 'hit', preset: 'hit', pitch: 1.1, volume: 0.8 });
  addSound(project, { name: 'powerup', preset: 'powerup', pitch: 1.0, volume: 0.9 });

  const songData = generateSongData('aventure joyeuse 124 BPM', { name: 'ThemeJeu' });
  upsertSong(project, songData);

  // 6. Script global
  project.globalScript = {
    mode: 'code',
    code: `
// Gestionnaire global de partie
on('create', () => {
  game.score = 0;
  game.playSong('ThemeJeu', { loop: true, volume: 0.7 });
});

on('keydown', 'ENTER', () => {
  game.score = 0;
  game.goToMap('Niveau 1');
});
`.trim(),
  };

  return project;
}

// ============================================================================
// 4. CONSTRUCTION DU JEU 3D (3 SCENES + BOSS)
// ============================================================================

function buildGame3D(project, gdd) {
  setSettings(project, {
    name: gdd.title,
    dimension: '3d',
    width: 320,
    height: 180,
    gravity: 800,
  });

  // 1. Modeles 3D
  // Hero CC0 Aventurier
  importModel(project, { name: 'Hero', preset: 'cc0_adventurer' });

  // Piece en or
  const coinSlices = [
    ['44', '44'],
    ['44', '44'],
  ];
  upsertModel(project, { name: 'Coin', width: 2, height: 2, depth: 2, slices: coinSlices });

  // Ennemi patrouilleur
  const enemySlices = [
    ['.66.', '6556', '6556', '.66.'],
    ['.66.', '6556', '6556', '.66.'],
    ['.66.', '6cc6', '6cc6', '.66.'],
  ];
  upsertModel(project, { name: 'Enemy', width: 4, height: 3, depth: 4, slices: enemySlices });

  // Boss Voxel
  const bossSlices = [
    ['.2222.', '211112', '211112', '211112', '211112', '.2222.'],
    ['.2222.', '211112', '21cc12', '21cc12', '211112', '.2222.'],
    ['.2222.', '211112', '210012', '210012', '211112', '.2222.'],
    ['..22..', '.2112.', '.2112.', '.2112.', '.2112.', '..22..'],
  ];
  upsertModel(project, { name: 'Boss', width: 6, height: 4, depth: 6, slices: bossSlices });

  // Portail 3D
  const portalSlices = [
    ['bb', 'bb'],
    ['bb', 'bb'],
    ['bb', 'bb'],
    ['bb', 'bb'],
    ['bb', 'bb'],
  ];
  upsertModel(project, { name: 'Portal', width: 2, height: 5, depth: 2, slices: portalSlices });

  // 2. Objets et scripts 3D
  upsertObject(project, {
    name: 'Player',
    model: 'Hero',
    physics: { enabled: true, gravity: true, collideMap: true },
    code: SCRIPT_PLAYER_3D,
  });

  upsertObject(project, {
    name: 'Coin',
    model: 'Coin',
    physics: { enabled: true, gravity: false, collideMap: false },
    code: SCRIPT_COIN_3D,
  });

  upsertObject(project, {
    name: 'Enemy',
    model: 'Enemy',
    physics: { enabled: true, gravity: true, collideMap: true },
    code: SCRIPT_ENEMY_3D,
  });

  upsertObject(project, {
    name: 'Boss',
    model: 'Boss',
    physics: { enabled: true, gravity: true, collideMap: true },
    code: SCRIPT_BOSS_3D,
  });

  upsertObject(project, {
    name: 'Portal',
    model: 'Portal',
    physics: { enabled: true, gravity: false, collideMap: false },
    code: SCRIPT_PORTAL_3D,
  });

  // 3. Scenes 3D
  // Scene 1 : Introduction
  upsertScene3D(project, {
    name: 'Scene 1',
    start: true,
    environment: { skyColor: '#41a6f6', fog: true, fogNear: 15, fogFar: 45 },
  });

  // Sol en blocs herbe '6'
  const floor1 = [
    '6666666666666666',
    '6666666666666666',
    '6666666666666666',
    '6666666666666666',
  ];
  paintGridMap(project, {
    scene: 'Scene 1',
    level: 0,
    rows: floor1,
    x: 0,
    z: 0,
  });

  placeEntities(project, {
    scene: 'Scene 1',
    entities: [
      { object: 'Player', x: 2, y: 1, z: 2 },
      { object: 'Coin', x: 5, y: 1.5, z: 2 },
      { object: 'Coin', x: 8, y: 1.5, z: 2 },
      { object: 'Enemy', x: 10, y: 1, z: 2 },
      { object: 'Portal', x: 14, y: 1, z: 2 },
    ],
  });

  // Scene 2 : Developpement
  upsertScene3D(project, {
    name: 'Scene 2',
    start: false,
    environment: { skyColor: '#3b5dc9', fog: true, fogNear: 15, fogFar: 50 },
  });

  paintGridMap(project, {
    scene: 'Scene 2',
    level: 0,
    rows: [
      '66666666666666666666',
      '66666666666666666666',
      '66666666666666666666',
      '66666666666666666666',
    ],
    x: 0,
    z: 0,
  });

  // Plateformes surelevees Y=2
  paintGridMap(project, {
    scene: 'Scene 2',
    level: 2,
    rows: [
      '....4444........4444',
      '....4444........4444',
    ],
    x: 0,
    z: 1,
  });

  placeEntities(project, {
    scene: 'Scene 2',
    entities: [
      { object: 'Player', x: 1, y: 1, z: 2 },
      { object: 'Enemy', x: 6, y: 1, z: 2 },
      { object: 'Coin', x: 5, y: 3.5, z: 2 },
      { object: 'Coin', x: 17, y: 3.5, z: 2 },
      { object: 'Portal', x: 18, y: 1, z: 2 },
    ],
  });

  // Scene 3 : Boss
  upsertScene3D(project, {
    name: 'Scene 3 - Boss',
    start: false,
    environment: { skyColor: '#1a1c2c', fog: true, fogNear: 12, fogFar: 40 },
  });

  paintGridMap(project, {
    scene: 'Scene 3 - Boss',
    level: 0,
    rows: [
      '2222222222222222',
      '2222222222222222',
      '2222222222222222',
      '2222222222222222',
    ],
    x: 0,
    z: 0,
  });

  placeEntities(project, {
    scene: 'Scene 3 - Boss',
    entities: [
      { object: 'Player', x: 2, y: 1, z: 2 },
      { object: 'Boss', x: 10, y: 1, z: 2 },
      { object: 'Coin', x: 6, y: 1.5, z: 2 },
      { object: 'Portal', x: 14, y: 1, z: 2 },
    ],
  });

  // 4. Sons et Musique
  addSound(project, { name: 'jump', preset: 'jump', pitch: 1.2, volume: 0.7 });
  addSound(project, { name: 'coin', preset: 'coin', pitch: 1.0, volume: 0.8 });
  addSound(project, { name: 'hit', preset: 'hit', pitch: 1.1, volume: 0.8 });
  addSound(project, { name: 'powerup', preset: 'powerup', pitch: 1.0, volume: 0.9 });

  const songData = generateSongData('combat epique 145 BPM', { name: 'ThemeJeu3D' });
  upsertSong(project, songData);

  project.globalScript = {
    mode: 'code',
    code: `
on('create', () => {
  game.score = 0;
  game.playSong('ThemeJeu3D', { loop: true, volume: 0.7 });
});
`.trim(),
  };

  return project;
}

// ============================================================================
// 5. POINT D'ENTREE PRINCIPAL : GENERATION DU JEU COMPLET
// ============================================================================

/**
 * Genere un jeu complet jouable et terminable avec 3 niveaux et un boss
 */
export function generateFullGame(description = '', options = {}) {
  const gdd = generateGameDesignDocument(description, options);
  let targetProject = options.baseProject || {
    version: 1,
    name: gdd.title,
    settings: {},
    palette: [
      '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57',
      '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7',
      '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
    ],
    sprites: [],
    objects: [],
    maps: [],
    scenes3d: [],
    models: [],
    sounds: [],
    songs: [],
    prefabs3d: [],
    materials: [],
    globalScript: { mode: 'code', code: '' },
  };

  if (gdd.dimension === '3d') {
    buildGame3D(targetProject, gdd);
  } else {
    buildGame2D(targetProject, gdd);
  }

  // Validation structurelle complete
  const issues = validateProject(targetProject);
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    throw new Error('Erreur de validation lors de la generation du jeu : ' + errors.map((e) => e.message).join(' ; '));
  }

  // Playtest headless et verification d'accessibilite physique autonome
  const playtestResult = runPlaytestAndFix(targetProject);
  if (playtestResult.project) {
    targetProject = playtestResult.project;
  }

  const levelCount = gdd.dimension === '3d' ? (targetProject.scenes3d || []).length : (targetProject.maps || []).length;
  const summary = `Jeu "${gdd.title}" genere avec succes (${gdd.dimension.toUpperCase()}, ${levelCount} niveaux complets avec arene de Boss).`;

  return {
    gdd,
    project: targetProject,
    summary,
  };
}
