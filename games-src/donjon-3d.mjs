// PixelForge — Jeu de démonstration 3D : Donjon 3D
// Labyrinthe en vue à la première personne (FPS), pointer lock, clés, portes verrouillées et musique mystérieuse.
// 100 % Blueprints.
// Usage: node games-src/donjon-3d.mjs
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

const graphPlayerFPS = makeGraph(
  [
    // Creation
    { id: 'c1', type: 'pf_on_create' },
    { id: 'c2', type: 'pf_pointer_lock' },
    { id: 'c3', type: 'pf_camera_mode_3d', fields: { MODE: 'first-person' } },
    { id: 'c4', type: 'pf_camera_follow_3d', values: { DIST: 0, HEIGHT: 0.8 } },
    { id: 'c5', type: 'pf_play_song', fields: { SONG: 'DungeonTheme' } },
    { id: 'c6', type: 'pf_set_text', fields: { ID: 'hud' }, values: { TEXT: 'Cles: 0  |  Explorez le donjon (Z,Q,S,D + Souris)', X: 10, Y: 10 } },

    // Update
    { id: 'u1', type: 'pf_on_update' },

    // Rotation souris
    { id: 'm_dx', type: 'pf_mouse_delta', fields: { AXIS: 'x' } },
    { id: 'm_mul', type: 'math_arithmetic', fields: { OP: 'MULTIPLY' }, values: { B: 0.15 } },
    { id: 'act_rot', type: 'pf_rotate_y_3d' },

    // Avancer (Z ou W ou UP)
    { id: 'b_fwd', type: 'flow_branch' },
    { id: 'k_w', type: 'pf_key_down', fields: { KEY: 'W' } },
    { id: 'act_fwd', type: 'pf_move_forward_3d', values: { SPEED: 6 } },

    // Reculer (S ou DOWN)
    { id: 'b_back', type: 'flow_branch' },
    { id: 'k_s', type: 'pf_key_down', fields: { KEY: 'S' } },
    { id: 'act_back', type: 'pf_move_forward_3d', values: { SPEED: -6 } },

    // Strafe gauche (A ou LEFT)
    { id: 'b_left', type: 'flow_branch' },
    { id: 'k_a', type: 'pf_key_down', fields: { KEY: 'A' } },
    { id: 'act_left', type: 'pf_move_right_3d', values: { SPEED: -5 } },

    // Strafe droite (D ou RIGHT)
    { id: 'b_right', type: 'flow_branch' },
    { id: 'k_d', type: 'pf_key_down', fields: { KEY: 'D' } },
    { id: 'act_right', type: 'pf_move_right_3d', values: { SPEED: 5 } },

    // Sauter (SPACE)
    { id: 'b_jump', type: 'flow_branch' },
    { id: 'k_space', type: 'pf_key_just', fields: { KEY: 'SPACE' } },
    { id: 'act_jump', type: 'pf_jump_3d', values: { FORCE: 10 } },
  ],
  [
    // Init chain
    { from: 'c1', fromPin: 'then', to: 'c2', toPin: 'exec' },
    { from: 'c2', fromPin: 'then', to: 'c3', toPin: 'exec' },
    { from: 'c3', fromPin: 'then', to: 'c4', toPin: 'exec' },
    { from: 'c4', fromPin: 'then', to: 'c5', toPin: 'exec' },
    { from: 'c5', fromPin: 'then', to: 'c6', toPin: 'exec' },

    // Update chain
    { from: 'u1', fromPin: 'then', to: 'act_rot', toPin: 'exec' },
    { from: 'm_dx', fromPin: 'out', to: 'm_mul', toPin: 'A' },
    { from: 'm_mul', fromPin: 'out', to: 'act_rot', toPin: 'ANGLE' },

    { from: 'act_rot', fromPin: 'then', to: 'b_fwd', toPin: 'exec' },
    { from: 'k_w', fromPin: 'out', to: 'b_fwd', toPin: 'COND' },
    { from: 'b_fwd', fromPin: 'true', to: 'act_fwd', toPin: 'exec' },

    { from: 'b_fwd', fromPin: 'false', to: 'b_back', toPin: 'exec' },
    { from: 'act_fwd', fromPin: 'then', to: 'b_back', toPin: 'exec' },
    { from: 'k_s', fromPin: 'out', to: 'b_back', toPin: 'COND' },
    { from: 'b_back', fromPin: 'true', to: 'act_back', toPin: 'exec' },

    { from: 'b_back', fromPin: 'false', to: 'b_left', toPin: 'exec' },
    { from: 'act_back', fromPin: 'then', to: 'b_left', toPin: 'exec' },
    { from: 'k_a', fromPin: 'out', to: 'b_left', toPin: 'COND' },
    { from: 'b_left', fromPin: 'true', to: 'act_left', toPin: 'exec' },

    { from: 'b_left', fromPin: 'false', to: 'b_right', toPin: 'exec' },
    { from: 'act_left', fromPin: 'then', to: 'b_right', toPin: 'exec' },
    { from: 'k_d', fromPin: 'out', to: 'b_right', toPin: 'COND' },
    { from: 'b_right', fromPin: 'true', to: 'act_right', toPin: 'exec' },

    { from: 'b_right', fromPin: 'false', to: 'b_jump', toPin: 'exec' },
    { from: 'act_right', fromPin: 'then', to: 'b_jump', toPin: 'exec' },
    { from: 'k_space', fromPin: 'out', to: 'b_jump', toPin: 'COND' },
    { from: 'b_jump', fromPin: 'true', to: 'act_jump', toPin: 'exec' },
  ]
);

const graphKey = makeGraph(
  [
    { id: 'u1', type: 'pf_on_update' },
    { id: 'rot', type: 'pf_rotate_y_3d', values: { ANGLE: 3 } },

    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'dest', type: 'pf_destroy_self' },
    { id: 'sc_add', type: 'pf_score_add', values: { VALUE: 1 } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'blip' } },
    { id: 'txt', type: 'pf_set_text', fields: { ID: 'hud' }, values: { TEXT: 'Cle trouvee ! Vous pouvez ouvrir la grande porte !', X: 10, Y: 10 } },
  ],
  [
    { from: 'u1', fromPin: 'then', to: 'rot', toPin: 'exec' },

    { from: 'ov', fromPin: 'then', to: 'dest', toPin: 'exec' },
    { from: 'dest', fromPin: 'then', to: 'sc_add', toPin: 'exec' },
    { from: 'sc_add', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'txt', toPin: 'exec' },
  ]
);

const graphDoor = makeGraph(
  [
    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'b_has_key', type: 'flow_branch' },
    { id: 'sc_get', type: 'pf_score_get' },
    { id: 'cmp_key', type: 'logic_compare', fields: { OP: 'GTE' }, values: { B: 1 } },

    // Porte ouverte
    { id: 'snd_open', type: 'pf_play_sound', fields: { SOUND: 'portal' } },
    { id: 'dest_door', type: 'pf_destroy_self' },
    { id: 'txt_open', type: 'pf_set_text', fields: { ID: 'hud' }, values: { TEXT: 'La porte de pierre s ouvre dans un grondement !', X: 10, Y: 10 } },

    // Porte fermée
    { id: 'txt_closed', type: 'pf_set_text', fields: { ID: 'hud' }, values: { TEXT: 'Porte verrouillee... Trouvez la cle d or dans les alcoves !', X: 10, Y: 10 } },
  ],
  [
    { from: 'ov', fromPin: 'then', to: 'b_has_key', toPin: 'exec' },
    { from: 'sc_get', fromPin: 'out', to: 'cmp_key', toPin: 'A' },
    { from: 'cmp_key', fromPin: 'out', to: 'b_has_key', toPin: 'COND' },

    // Si cle possedee
    { from: 'b_has_key', fromPin: 'true', to: 'snd_open', toPin: 'exec' },
    { from: 'snd_open', fromPin: 'then', to: 'dest_door', toPin: 'exec' },
    { from: 'dest_door', fromPin: 'then', to: 'txt_open', toPin: 'exec' },

    // Si pas de cle
    { from: 'b_has_key', fromPin: 'false', to: 'txt_closed', toPin: 'exec' },
  ]
);

const graphStairs = makeGraph(
  [
    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'portal' } },
    { id: 'goto', type: 'pf_goto_map', fields: { MAP: 'Salle du Tresor' } },
  ],
  [
    { from: 'ov', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'goto', toPin: 'exec' },
  ]
);

const graphChalice = makeGraph(
  [
    { id: 'u1', type: 'pf_on_update' },
    { id: 'rot', type: 'pf_rotate_y_3d', values: { ANGLE: 3 } },

    { id: 'ov', type: 'pf_on_overlap', fields: { OBJ: 'Player' } },
    { id: 'dest', type: 'pf_destroy_self' },
    { id: 'snd', type: 'pf_play_sound', fields: { SOUND: 'powerup' } },
    { id: 'txt', type: 'pf_set_text', fields: { ID: 'win' }, values: { TEXT: 'Victoire ! Vous avez conquis le Donjon 3D et trouve le Calice !', X: 40, Y: 80 } },
  ],
  [
    { from: 'u1', fromPin: 'then', to: 'rot', toPin: 'exec' },

    { from: 'ov', fromPin: 'then', to: 'dest', toPin: 'exec' },
    { from: 'dest', fromPin: 'then', to: 'snd', toPin: 'exec' },
    { from: 'snd', fromPin: 'then', to: 'txt', toPin: 'exec' },
  ]
);

// ---------------------------------------------------------------- Construction du jeu

console.log('Construction de Donjon 3D...');
const p = pf.createGameFile('Donjon 3D', (proj) => {
  pf.setSettings(proj, {
    dimension: '3d',
    width: 320,
    height: 180,
    gravity: 800,
    name: 'Donjon 3D',
    description: 'Dungeon crawler retro en vue a la premiere personne avec pointer lock, labyrinthe, cle et tresor.',
    author: 'PixelForge Team',
  });

  // 1. Modèles voxel
  // Player FPS (boîte 1x2x1)
  const fpsSlices = [
    ['8'],
    ['8'],
  ];
  pf.upsertModel(proj, { name: 'PlayerFPS', width: 1, height: 2, depth: 1, slices: fpsSlices });

  // Cle d or (1x2x1)
  const keySlices = [
    ['4'],
    ['4'],
  ];
  pf.upsertModel(proj, { name: 'Key', width: 1, height: 2, depth: 1, slices: keySlices });

  // Porte en bois et fer (2x3x1)
  const doorSlices = [
    ['11'],
    ['11'],
    ['11'],
  ];
  pf.upsertModel(proj, { name: 'Door', width: 2, height: 3, depth: 1, slices: doorSlices });

  // Escalier / Portail (2x2x2)
  const stairsSlices = [
    ['ee', 'ee'],
    ['..', 'ee'],
  ];
  pf.upsertModel(proj, { name: 'Stairs', width: 2, height: 2, depth: 2, slices: stairsSlices });

  // Calice sacre (2x3x2)
  const chaliceSlices = [
    ['44', '44'],
    ['.4', '4.'],
    ['24', '42'],
  ];
  pf.upsertModel(proj, { name: 'Chalice', width: 2, height: 3, depth: 2, slices: chaliceSlices });

  // 2. Objets (100 % Blueprints)
  pf.upsertObject(proj, {
    name: 'Player',
    model: 'PlayerFPS',
    physics: { enabled: true, gravity: true, collideMap: true },
    graph: graphPlayerFPS,
  });

  pf.upsertObject(proj, {
    name: 'Key',
    model: 'Key',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphKey,
  });

  pf.upsertObject(proj, {
    name: 'Door',
    model: 'Door',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphDoor,
  });

  pf.upsertObject(proj, {
    name: 'Stairs',
    model: 'Stairs',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphStairs,
  });

  pf.upsertObject(proj, {
    name: 'Chalice',
    model: 'Chalice',
    physics: { enabled: true, gravity: false, collideMap: false },
    graph: graphChalice,
  });

  // 3. Sons
  pf.addSound(proj, { name: 'blip', preset: 'blip' });
  pf.addSound(proj, { name: 'portal', preset: 'portal' });
  pf.addSound(proj, { name: 'powerup', preset: 'powerup' });

  // 4. Musique de donjon sombre et mystérieuse
  const songNotation = `
BPM 105
CHANNELS
Lead pulse25 vol 0.7 pan -0.2
Bass triangle vol 0.9 pan 0.2
Drums noise vol 0.5 pan 0

PATTERN PatA
Lead: D4 . . . F4 . . . E4 . . . D4 . . .
Bass: D2 . A2 . D2 . A2 . D2 . A2 . D2 . A2 .
Drums: C3 . . . C3 . . . C3 . . . C3 . . .

PATTERN PatB
Lead: G4 . . . F4 . . . E4 . . . C4 . . .
Bass: G2 . D2 . G2 . D2 . A2 . E2 . A2 . E2 .
Drums: C3 . . . C3 . . . C3 . . . C3 . . .

PLAYLIST
PatA
PatB
PatA
PatB
`.trim();

  pf.upsertSong(proj, { name: 'DungeonTheme', text: songNotation, bpm: 105 });

  // 5. SCÈNE 1 : Le Labyrinthe des Catacombes
  pf.upsertScene3D(proj, {
    name: 'Les Catacombes',
    start: true,
    environment: {
      skyColor: '#0e0f18',
      fog: { enabled: true, color: '#0e0f18', density: 0.06 },
      ambientLight: { color: '#667788', intensity: 0.35 },
      directionalLight: { color: '#ffaa66', intensity: 0.6, position: [8, 12, 8] },
    },
  });

  // Sol des Catacombes (16x16 blocs de pierre sombre)
  const floor1 = Array.from({ length: 16 }, () => 'f'.repeat(16));
  pf.paintGridMap(proj, { scene: 'Les Catacombes', level: 0, rows: floor1 });

  // Murs du labyrinthe (Niveau Y=1 et Y=2)
  const maze = [
    'ffffffffffffffff',
    'f....f.........f',
    'f.ff.f.fffffff.f',
    'f..f...f.....f.f',
    'ff.fffff.fff.f.f',
    'f........f...f.f',
    'f.ffffffff.f.f.f',
    'f.f......f.f.f.f',
    'f.f.ffff.f.f.f.f',
    'f...f..f...f...f',
    'fffff..fffffffff',
    'f..........f...f',
    'f.ffffffff.f.f.f',
    'f.f......f...f.f',
    'f...ffffffff.f.f',
    'ffffffffffffffff',
  ];
  pf.paintGridMap(proj, { scene: 'Les Catacombes', level: 1, rows: maze });
  pf.paintGridMap(proj, { scene: 'Les Catacombes', level: 2, rows: maze });

  // Entités dans Les Catacombes
  pf.placeEntities(proj, {
    scene: 'Les Catacombes',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 1, y: 1, z: 1 },
      { object: 'Key', x: 14, y: 1, z: 1 },
      { object: 'Door', x: 5, y: 1, z: 10 },
      { object: 'Stairs', x: 6, y: 1, z: 10 },
    ],
  });

  // 6. SCÈNE 2 : La Salle du Trésor
  pf.upsertScene3D(proj, {
    name: 'Salle du Tresor',
    environment: {
      skyColor: '#1a1c2c',
      fog: { enabled: true, color: '#1a1c2c', density: 0.04 },
      ambientLight: { color: '#ffd080', intensity: 0.6 },
      directionalLight: { color: '#ffaa44', intensity: 1.0, position: [7, 15, 7] },
    },
  });

  // Sol d'or et marbre 14x14
  const floor2 = Array.from({ length: 14 }, () => '4'.repeat(14));
  pf.paintGridMap(proj, { scene: 'Salle du Tresor', level: 0, rows: floor2 });

  // Piliers et murs du sanctuaire
  const roomWalls = [
    'ffffffffffffff',
    'f............f',
    'f..e......e..f',
    'f............f',
    'f............f',
    'f............f',
    'f............f',
    'f............f',
    'f............f',
    'f............f',
    'f..e......e..f',
    'f............f',
    'f............f',
    'ffffffffffffff',
  ];
  pf.paintGridMap(proj, { scene: 'Salle du Tresor', level: 1, rows: roomWalls });
  pf.paintGridMap(proj, { scene: 'Salle du Tresor', level: 2, rows: roomWalls });

  // Socle du calice
  pf.paintGridMap(proj, { scene: 'Salle du Tresor', level: 1, rows: ['ee', 'ee'], x: 6, z: 6 });

  pf.placeEntities(proj, {
    scene: 'Salle du Tresor',
    mode: 'replace',
    entities: [
      { object: 'Player', x: 2, y: 1, z: 2 },
      { object: 'Chalice', x: 6, y: 2, z: 6 },
    ],
  });
});

console.log(`Jeu créé avec succès : ${p.name} (id ${p.meta.id})`);
const issues = pf.validateProject(p);
console.log(pf.formatIssues(issues));
if (issues.some((i) => i.level === 'error')) {
  process.exit(1);
}
