// PixelForge — Jeu de démonstration 3D : Cube Runner
// Plateforme 3D retro en voxels, 3 niveaux, 100 % Blueprints et musique chiptune.
// Usage: node games-src/cube-runner.mjs
import * as pf from '../mcp/lib/index.js';

function makeGraph(nodes, links) {
  return {
    version: 1,
    nodes: nodes.map((n, i) => ({
      id: n.id || `n${i + 1}`,
      type: n.type,
      fields: n.fields || {},
      values: n.values || {},
      extra: n.extra || {},
    })),
    links: links.map((l, i) => ({
      id: l.id || `l${i + 1}`,
      from: l.from,
      fromPin: l.fromPin || 'then',
      to: l.to,
      toPin: l.toPin || 'exec',
    })),
    variables: [],
    comments: [],
  };
}

// ---------------------------------------------------------------- Graphes Blueprints

const graphPlayer = makeGraph(
  [
    // Creation
    { id: 'c1', type: 'pf_on_create' },
    { id: 'c2', type: 'pf_camera_mode_3d', fields: { MODE: 'third-person' } },
    { id: 'c3', type: 'pf_camera_follow_3d', values: { DIST: 6, HEIGHT: 3 } },
    { id: 'c4', type: 'pf_play_song', fields: { SONG: 'RunnerTheme' } },
    { id: 'c5', type: 'pf_set_text', fields: { ID: 'hud' }, values: { TEXT: 'Score: 0', X: 10, Y: 10 } },

    // Update
    { id: 'u1', type: 'pf_on_update' },

    // Touche AVANCER (UP)
    { id: 'b_up', type: 'flow_branch' },
    { id: 'k_up', type: 'pf_key_down', fields: { KEY: 'UP' } },
    { id: 'act_up', type: 'pf_move_forward_3d', values: { SPEED: 7 } },

    // Touche RECULER (DOWN)
    { id: 'b_down', type: 'flow_branch' },
    { id: 'k_down', type: 'pf_key_down', fields: { KEY: 'DOWN' } },
    { id: 'act_down', type: 'pf_move_forward_3d', values: { SPEED: -7 } },

    // Touche TOURNER GAUCHE (LEFT)
    { id: 'b_left', type: 'flow_branch' },
    { id: 'k_left', type: 'pf_key_down', fields: { KEY: 'LEFT' } },
    { id: 'act_left', type: 'pf_rotate_y_3d', values: { ANGLE: -3.5 } },

    // Touche TOURNER DROITE (RIGHT)
    { id: 'b_right', type: 'flow_branch' },
    { id: 'k_right', type: 'pf_key_down', fields: { KEY: 'RIGHT' } },
    { id: 'act_right', type: 'pf_rotate_y_3d', values: { ANGLE: 3.5 } },

    // Touche SAUTER (SPACE)
    { id: 'b_jump', type: 'flow_branch' },
    { id: 'k_jump', type: 'pf_key_just', fields: { KEY: 'SPACE' } },
    { id: 'act_jump', type: 'pf_jump_3d', values: { FORCE: 12 } },

    // Chute hors du niveau (Y < -10)
    { id: 'b_fall', type: 'flow_branch' },
    { id: 'y_val', type: 'pf_self_get_3d', fields: { PROP: 'y' } },
    { id: 'cmp_fall', type: 'logic_compare', fields: { OP: 'LT' }, values: { B: -10 } },
    { id: 'act_restart', type: 'pf_restart' },
  ],
  [
    // Init chain
    { from: 'c1', fromPin: 'then', to: 'c2', toPin: 'exec' },
    { from: 'c2', fromPin: 'then', to: 'c3', toPin: 'exec' },
    { from: 'c3', fromPin: 'then', to: 'c4', toPin: 'exec' },
    { from: 'c4', fromPin: 'then', to: 'c5', toPin: 'exec' },

    // Update chain
    { from: 'u1', fromPin: 'then', to: 'b_up', toPin: 'exec' },
    { from: 'k_up', fromPin: 'out', to: 'b_up', toPin: 'COND' },
    { from: 'b_up', fromPin: 'true', to: 'act_up', toPin: 'exec' },

    { from: 'b_up', fromPin: 'false', to: 'b_down', toPin: 'exec' },
    { from: 'act_up', fromPin: 'then', to: 'b_down', toPin: 'exec' },
    { from: 'k_down', fromPin: 'out', to: 'b_down', toPin: 'COND' },
    { from: 'b_down', fromPin: 'true', to: 'act_down', toPin: 'exec' },

    { from: 'b_down', fromPin: 'false', to: 'b_left', toPin: 'exec' },
    { from: 'act_down', fromPin: 'then', to: 'b_left', toPin: 'exec' },
    { from: 'k_left', fromPin: 'out', to: 'b_left', toPin: 'COND' },
    { from: 'b_left', fromPin: 'true', to: 'act_left', toPin: 'exec' },

    { from: 'b_left', fromPin: 'false', to: 'b_right', toPin: 'exec' },
    { from: 'act_left', fromPin: 'then', to: 'b_right', toPin: 'exec' },
    { from: 'k_right', fromPin: 'out', to: 'b_right', toPin: 'COND' },
    { from: 'b_right', fromPin: 'true', to: 'act_right', toPin: 'exec' },

    { from: 'b_right', fromPin: 'false', to: 'b_jump', toPin: 'exec' },
    { from: 'act_right', fromPin: 'then', to: 'b_jump', toPin: 'exec' },
    { from: 'k_jump', fromPin: 'out', to: 'b_jump', toPin: 'COND' },
    { from: 'b_jump', fromPin: 'true', to: 'act_jump', toPin: 'exec' },

    { from: 'b_jump', fromPin: 'false', to: 'b_fall', toPin: 'exec' },
    { from: 'act_jump', fromPin: 'then', to: 'b_fall', toPin: 'exec' },
    { from: 'y_val', fromPin: 'out', to: 'cmp_fall', toPin: 'A' },
    { from: 'cmp_fall', fromPin: 'out', to: 'b_fall', toPin: 'COND' },
    { from: 'b_fall', fromPin: 'true', to: 'act_restart', toPin: 'exec' },
  ]
);

const graphCoin = makeGraph(
  [
    { id: 'u1', type: 'pf_on_update' },
    { id: 'rot', type: 'pf_rotate_y_3d', values: { ANGLE: 4 } },

    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'dest', type: 'pf_destroy_self' },
    { id: 'score', type: 'pf_score_add', values: { VALUE: 1 } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'coin' } },
    { id: 'txt', type: 'pf_set_text', fields: { ID: 'hud' } },
    { id: 'join', type: 'text_join', extra: { items: 2 }, values: { ADD0: 'Score: ' } },
    { id: 'get_sc', type: 'pf_score_get' },
  ],
  [
    { from: 'u1', fromPin: 'then', to: 'rot', toPin: 'exec' },

    { from: 'ov', fromPin: 'then', to: 'dest', toPin: 'exec' },
    { from: 'dest', fromPin: 'then', to: 'score', toPin: 'exec' },
    { from: 'score', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'txt', toPin: 'exec' },
    { from: 'get_sc', fromPin: 'out', to: 'join', toPin: 'ADD1' },
    { from: 'join', fromPin: 'out', to: 'txt', toPin: 'TEXT' },
  ]
);

const graphSpike = makeGraph(
  [
    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'hit' } },
    { id: 'res', type: 'pf_restart' },
  ],
  [
    { from: 'ov', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'res', toPin: 'exec' },
  ]
);

const graphPortal1 = makeGraph(
  [
    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'portal' } },
    { id: 'goto', type: 'pf_goto_map', fields: { MAP: 'Niveau 2' } },
  ],
  [
    { from: 'ov', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'goto', toPin: 'exec' },
  ]
);

const graphPortal2 = makeGraph(
  [
    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'portal' } },
    { id: 'goto', type: 'pf_goto_map', fields: { MAP: 'Niveau 3' } },
  ],
  [
    { from: 'ov', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'goto', toPin: 'exec' },
  ]
);

const graphGoal = makeGraph(
  [
    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'powerup' } },
    { id: 'txt', type: 'pf_set_text', fields: { ID: 'win' }, values: { TEXT: 'Victoire ! Vous avez termine Cube Runner !', X: 50, Y: 80 } },
  ],
  [
    { from: 'ov', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'txt', toPin: 'exec' },
  ]
);

// ---------------------------------------------------------------- Construction du jeu

console.log('Construction de Cube Runner...');
const p = pf.createGameFile('Cube Runner', (proj) => {
  pf.setSettings(proj, {
    dimension: '3d',
    width: 320,
    height: 180,
    gravity: 800,
    name: 'Cube Runner',
    description: 'Jeu de plateforme 3D retro voxel sur 3 niveaux avec camera 3e personne et musique chiptune.',
    author: 'PixelForge Team',
  });

  // 1. Modèles voxel
  // Hero (4x6x4)
  const heroSlices = [
    ['.88.', '.88.', '.88.', '.88.'],
    ['.88.', '.88.', '.88.', '.88.'],
    ['.22.', '.22.', '.22.', '.22.'],
    ['.22.', '.22.', '.22.', '.22.'],
    ['.33.', '.30.', '.33.', '.00.'],
    ['.00.', '.00.', '.00.', '.00.'],
  ];
  pf.upsertModel(proj, { name: 'Hero', width: 4, height: 6, depth: 4, slices: heroSlices });

  // Piece d'or (2x2x2)
  const coinSlices = [
    ['44', '44'],
    ['44', '44'],
  ];
  pf.upsertModel(proj, { name: 'Coin', width: 2, height: 2, depth: 2, slices: coinSlices });

  // Piege a piques (2x2x2)
  const spikeSlices = [
    ['22', '22'],
    ['cc', 'cc'],
  ];
  pf.upsertModel(proj, { name: 'Spike', width: 2, height: 2, depth: 2, slices: spikeSlices });

  // Portail (2x4x2)
  const portalSlices = [
    ['11', '11'],
    ['bb', 'bb'],
    ['bb', 'bb'],
    ['11', '11'],
  ];
  pf.upsertModel(proj, { name: 'Portal', width: 2, height: 4, depth: 2, slices: portalSlices });

  // Trophee final (2x4x2)
  const trophySlices = [
    ['44', '44'],
    ['.4..', '.4..'],
    ['44', '44'],
    ['44', '44'],
  ];
  pf.upsertModel(proj, { name: 'Trophy', width: 2, height: 4, depth: 2, slices: trophySlices });

  // 2. Objets (100 % Blueprints)
  pf.upsertObject(proj, {
    name: 'Player',
    model: 'Hero',
    physics: { enabled: true, gravity: true, collideMap: true },
    graph: graphPlayer,
  });

  pf.upsertObject(proj, {
    name: 'Coin',
    model: 'Coin',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphCoin,
  });

  pf.upsertObject(proj, {
    name: 'Spike',
    model: 'Spike',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphSpike,
  });

  pf.upsertObject(proj, {
    name: 'Portal1',
    model: 'Portal',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphPortal1,
  });

  pf.upsertObject(proj, {
    name: 'Portal2',
    model: 'Portal',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphPortal2,
  });

  pf.upsertObject(proj, {
    name: 'Goal',
    model: 'Trophy',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphGoal,
  });

  // 3. Sons
  pf.addSound(proj, { name: 'coin', preset: 'coin' });
  pf.addSound(proj, { name: 'hit', preset: 'hit' });
  pf.addSound(proj, { name: 'portal', preset: 'portal' });
  pf.addSound(proj, { name: 'powerup', preset: 'powerup' });

  // 4. Musique chiptune entraînante
  const songNotation = `
BPM 145
CHANNELS
Lead pulse50 vol 0.8 pan 0
Bass triangle vol 0.9 pan 0
Drums noise vol 0.7 pan 0

PATTERN PatA
Lead: C4 . D4 . E4 . G4 . E4 . D4 . C4 . E4 .
Bass: C2 . . . G2 . . . C2 . . . G2 . . .
Drums: C3 . C3 . C3 . C3 . C3 . C3 . C3 . C3 .

PATTERN PatB
Lead: A4 . G4 . E4 . D4 . C4 . D4 . E4 . G4 .
Bass: A2 . . . E2 . . . F2 . . . G2 . . .
Drums: C3 . C3 . C3 . C3 . C3 . C3 . C3 . C3 .

PLAYLIST
PatA
PatB
PatA
PatB
`.trim();

  pf.upsertSong(proj, { name: 'RunnerTheme', text: songNotation, bpm: 145 });

  // 5. NIVEAU 1 : Les Plaines de Voxels
  pf.upsertScene3D(proj, {
    name: 'Niveau 1',
    start: true,
    environment: {
      skyColor: '#41a6f6',
      fog: { enabled: true, color: '#41a6f6', density: 0.02 },
      ambientLight: { color: '#ffffff', intensity: 0.7 },
      directionalLight: { color: '#ffeedd', intensity: 1.0, position: [10, 20, 15] },
    },
  });

  // Sol d'herbe 16x16
  const floor1 = Array.from({ length: 16 }, () => '6'.repeat(16));
  pf.paintGridMap(proj, { scene: 'Niveau 1', level: 0, rows: floor1 });

  // Marches et plateforme surélevée
  pf.paintGridMap(proj, { scene: 'Niveau 1', level: 1, rows: ['666', '666', '666'], x: 6, z: 6 });
  pf.paintGridMap(proj, { scene: 'Niveau 1', level: 2, rows: ['66', '66'], x: 9, z: 9 });
  pf.paintGridMap(proj, { scene: 'Niveau 1', level: 3, rows: ['6666', '6666', '6666', '6666'], x: 11, z: 11 });

  // Entités Niveau 1
  pf.placeEntities(proj, {
    scene: 'Niveau 1',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 2, y: 1, z: 2 },
      { object: 'Coin', x: 4, y: 1, z: 4 },
      { object: 'Coin', x: 7, y: 2, z: 7 },
      { object: 'Coin', x: 10, y: 3, z: 10 },
      { object: 'Coin', x: 12, y: 4, z: 12 },
      { object: 'Portal1', x: 13, y: 4, z: 13 },
    ],
  });

  // 6. NIVEAU 2 : Le Canyon Obscur
  pf.upsertScene3D(proj, {
    name: 'Niveau 2',
    environment: {
      skyColor: '#1a1c2c',
      fog: { enabled: true, color: '#1a1c2c', density: 0.035 },
      ambientLight: { color: '#8899aa', intensity: 0.5 },
      directionalLight: { color: '#ff8844', intensity: 0.8, position: [5, 15, 10] },
    },
  });

  // Chemins étroits et îles de saut
  pf.paintGridMap(proj, { scene: 'Niveau 2', level: 0, rows: ['eeee', 'eeee', 'eeee'], x: 0, z: 0 });
  pf.paintGridMap(proj, { scene: 'Niveau 2', level: 0, rows: ['ee', 'ee'], x: 6, z: 2 });
  pf.paintGridMap(proj, { scene: 'Niveau 2', level: 1, rows: ['eeee', 'eeee'], x: 10, z: 4 });
  pf.paintGridMap(proj, { scene: 'Niveau 2', level: 2, rows: ['ee', 'ee'], x: 16, z: 6 });
  pf.paintGridMap(proj, { scene: 'Niveau 2', level: 3, rows: ['eeee', 'eeee', 'eeee'], x: 20, z: 8 });

  pf.placeEntities(proj, {
    scene: 'Niveau 2',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 1, y: 1, z: 1 },
      { object: 'Coin', x: 6, y: 1, z: 2 },
      { object: 'Spike', x: 11, y: 2, z: 4 },
      { object: 'Coin', x: 16, y: 3, z: 6 },
      { object: 'Portal2', x: 21, y: 4, z: 9 },
    ],
  });

  // 7. NIVEAU 3 : Le Temple dans les Nuages
  pf.upsertScene3D(proj, {
    name: 'Niveau 3',
    environment: {
      skyColor: '#73eff7',
      fog: { enabled: true, color: '#f4f4f4', density: 0.02 },
      ambientLight: { color: '#ffffff', intensity: 0.8 },
      directionalLight: { color: '#fff0d0', intensity: 1.2, position: [12, 25, 10] },
    },
  });

  // Plateformes en damier d'or et marbre blanc
  pf.paintGridMap(proj, { scene: 'Niveau 3', level: 0, rows: ['4c4c', 'c4c4', '4c4c', 'c4c4'], x: 0, z: 0 });
  pf.paintGridMap(proj, { scene: 'Niveau 3', level: 1, rows: ['4c', 'c4'], x: 6, z: 2 });
  pf.paintGridMap(proj, { scene: 'Niveau 3', level: 2, rows: ['c4', '4c'], x: 10, z: 6 });
  pf.paintGridMap(proj, { scene: 'Niveau 3', level: 3, rows: ['4c', 'c4'], x: 14, z: 10 });
  pf.paintGridMap(proj, { scene: 'Niveau 3', level: 4, rows: ['4c4c4c', 'c4c4c4', '4c4c4c', 'c4c4c4'], x: 18, z: 12 });

  pf.placeEntities(proj, {
    scene: 'Niveau 3',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 1, y: 1, z: 1 },
      { object: 'Coin', x: 6, y: 2, z: 2 },
      { object: 'Spike', x: 10, y: 3, z: 6 },
      { object: 'Coin', x: 14, y: 4, z: 10 },
      { object: 'Coin', x: 19, y: 5, z: 13 },
      { object: 'Goal', x: 20, y: 5, z: 14 },
    ],
  });
});

console.log(`Jeu créé avec succès : ${p.name} (id ${p.meta.id})`);
const issues = pf.validateProject(p);
console.log(pf.formatIssues(issues));
if (issues.some((i) => i.level === 'error')) {
  process.exit(1);
}
