import * as Blockly from 'blockly';
import { generateCode, setBlocksContext } from '../src/editors/objects/blocks.js';
import { createEmptyProject, createObject, createMap, uid as genUid } from '../src/core/project.js';
import * as pf from '../mcp/lib/index.js';
import fs from 'node:fs';
import path from 'node:path';

// Palette de couleurs pour Tetris
const PALETTE = [
  '#0d0e17', // 0 fond noir bleuté rétro
  '#1b1f32', // 1 fond panneau / boîte HUD
  '#2f3756', // 2 bordure sombre / ombre biseau
  '#596892', // 3 bordure claire / reflet métal
  '#f4f4f4', // 4 blanc pur (reflet gemme / flash)
  '#00c060', // 5 vert S (émeraude)
  '#68f090', // 6 vert S clair
  '#00d0f0', // 7 cyan I
  '#80f4ff', // 8 cyan I clair
  '#2850e0', // 9 bleu J
  '#7090ff', // a bleu J clair
  '#f08020', // b orange L
  '#ffba50', // c orange L / jaune O clair
  '#ffd000', // d jaune O
  '#e02840', // e rouge Z
  '#b040e0', // f violet T
];

function makeBlock(b, l, d, g) {
  return [
    l + l + l + l + l + l + l + d,
    l + l + l + l + l + l + b + d,
    l + l + g + g + b + b + b + d,
    l + l + g + g + b + b + b + d,
    l + b + b + b + b + b + b + d,
    l + b + b + b + b + b + b + d,
    l + b + b + b + b + b + d + d,
    d + d + d + d + d + d + d + d,
  ];
}

const CELL_EMPTY = [
  '........', '........', '........', '...11...',
  '...11...', '........', '........', '........'
];
const WALL_H = [
  '33333333', '22222222', '21212121', '11111111',
  '11111111', '21212121', '22222222', '00000000'
];
const WALL_V = [
  '32211220', '32111120', '32211220', '32111120',
  '32211220', '32111120', '32211220', '32111120'
];
const CORNER_TL = [
  '33333333', '32222222', '32111111', '3211....',
  '321.....', '321.....', '321.....', '321.....'
];
const CORNER_TR = [
  '33333330', '22222220', '11111120', '....1120',
  '.....120', '.....120', '.....120', '.....120'
];
const CORNER_BL = [
  '321.....', '321.....', '321.....', '3211....',
  '32111111', '32222222', '33333333', '00000000'
];
const CORNER_BR = [
  '.....120', '.....120', '.....120', '....1120',
  '11111120', '22222220', '33333330', '00000000'
];
const PANEL_BG = Array(8).fill('11111111');
const DARK_BG = Array(8).fill('00000000');
const BLOCK_I = makeBlock('7', '8', '2', '4');
const BLOCK_J = makeBlock('9', 'a', '2', '4');
const BLOCK_L = makeBlock('b', 'c', '2', '4');
const BLOCK_O = makeBlock('d', 'c', '2', '4');
const BLOCK_S = makeBlock('5', '6', '2', '4');
const BLOCK_T = makeBlock('f', 'c', '2', '4');
const BLOCK_Z = makeBlock('e', 'c', '2', '4');

const GHOST_BLOCK = [
  '33333333', '3......2', '3......2', '3......2',
  '3......2', '3......2', '3......2', '22222222'
];
const FLASH_BLOCK = Array(8).fill('44444444');

const LETTER_T = ['........', '.777777.', '...77...', '...77...', '...77...', '...77...', '...77...', '........'];
const LETTER_E = ['........', '.ffffff.', '.ff.....', '.ffff...', '.ff.....', '.ff.....', '.ffffff.', '........'];
const LETTER_T2 = ['........', '.dddddd.', '...dd...', '...dd...', '...dd...', '...dd...', '...dd...', '........'];
const LETTER_R = ['........', '.55555..', '.55..55.', '.55555..', '.5555...', '.55..55.', '.55..55.', '........'];
const LETTER_I = ['........', '.777777.', '...77...', '...77...', '...77...', '...77...', '...77...', '........'];
const LETTER_S = ['........', '.ffffff.', '.ff.....', '.ffffff.', '.....ff.', '.....ff.', '.ffffff.', '........'];

const TILESET_FRAMES = [
  CELL_EMPTY, WALL_H, WALL_V, CORNER_TL, CORNER_TR, CORNER_BL, CORNER_BR,
  PANEL_BG, DARK_BG, BLOCK_I, BLOCK_J, BLOCK_L, BLOCK_O, BLOCK_S, BLOCK_T, BLOCK_Z,
  GHOST_BLOCK, FLASH_BLOCK, LETTER_T, LETTER_E, LETTER_T2, LETTER_R, LETTER_I, LETTER_S
];

const SPRITE_VIDE = Array(8).fill('........');

// ============================================================================
// CONSTRUCTEUR DU WORKSPACE BLOCKLY POUR TETRIS
// ============================================================================

let blockIdCounter = 1000;
function uid(prefix = 'b') {
  return `${prefix}_${blockIdCounter++}`;
}

// Helpers pour blocs Blockly
const n = (num) => ({ block: { type: 'math_number', id: uid('num'), fields: { NUM: num } } });
const str = (text) => ({ block: { type: 'text', id: uid('txt'), fields: { TEXT: text } } });
const bool = (v) => ({ block: { type: 'logic_boolean', id: uid('bool'), fields: { BOOL: v ? 'TRUE' : 'FALSE' } } });
const col = (hex) => ({ block: { type: 'pf_colour', id: uid('col'), fields: { COL: hex } } });
const vGet = (name) => ({ block: { type: 'variables_get', id: uid('vget'), fields: { VAR: name } } });
const vSet = (name, valBlock, next = null) => ({
  type: 'variables_set',
  id: uid('vset'),
  fields: { VAR: name },
  inputs: { VALUE: valBlock },
  ...(next ? { next: { block: next } } : {})
});
const jsStmt = (code, next = null) => ({
  type: 'pf_js',
  id: uid('js'),
  fields: { CODE: code },
  ...(next ? { next: { block: next } } : {})
});
const jsVal = (expr) => ({
  block: {
    type: 'pf_js_val',
    id: uid('jsval'),
    fields: { EXPR: expr }
  }
});
const callProc = (name, next = null) => ({
  type: 'procedures_callnoreturn',
  id: uid('call'),
  extraState: { name },
  fields: { NAME: name },
  ...(next ? { next: { block: next } } : {})
});
const defProc = (name, stackBlock, x, y) => ({
  type: 'procedures_defnoreturn',
  id: uid('def'),
  x,
  y,
  extraState: {
    params: []
  },
  fields: { NAME: name },
  inputs: stackBlock ? { STACK: { block: stackBlock } } : {}
});

const chain = (...blocks) => {
  const filtered = blocks.filter(Boolean);
  for (let i = 0; i < filtered.length - 1; i++) {
    filtered[i].next = { block: filtered[i + 1] };
  }
  return filtered[0];
};

export function buildTetrisBlockWorkspace() {
  const allBlocks = [];

  // ========================================================================
  // 1. PROCÉDURES (colonne droite, x = 460)
  // ========================================================================

  // Procédure : initialiserConstantes
  allBlocks.push(defProc('initialiserConstantes', chain(
    jsStmt(`
      BOARD_X = 11;
      BOARD_Y = 4;
      PREVIEW_X = 25;
      PREVIEW_Y = 4;
      HOLD_X = 3;
      HOLD_Y = 4;
      TILE_GHOST = 16;
      TILE_FLASH = 17;
      PIECE_TILES = [9, 10, 11, 12, 13, 14, 15];
      SHAPES = [
        [[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
        [[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
        [[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
        [[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]]],
        [[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
        [[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[2,1],[1,2]],[[1,0],[0,1],[1,1],[1,2]]],
        [[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]]
      ];
      PIECE_DIMS = [{w:4,h:4},{w:3,h:3},{w:3,h:3},{w:2,h:2},{w:3,h:3},{w:3,h:3},{w:3,h:3}];
      DAS = 0.16;
      ARR = 0.05;
      SOFT_DROP_RATE = 0.04;
      drawnActive = [];
      drawnGhost = [];
      getFromBag = function() {
        if (!bag || bag.length === 0) {
          bag = [0, 1, 2, 3, 4, 5, 6];
          for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
          }
        }
        return bag.pop();
      };
      canFit = function(p, rot, px, py) {
        const bl = SHAPES[p][rot];
        for (let i = 0; i < 4; i++) {
          const c = px + bl[i][0];
          const r = py + bl[i][1];
          if (c < 0 || c >= 10 || r >= 20) return false;
          if (r >= 0 && board[r][c] >= 0) return false;
        }
        return true;
      };
    `)
  ), 460, 20));

  // Procédure : initialiserPartie
  allBlocks.push(defProc('initialiserPartie', chain(
    callProc('initialiserConstantes'),
    vSet('gameOver', bool(false)),
    vSet('enPause', bool(false)),
    vSet('clearing', bool(false)),
    vSet('score', n(0)),
    vSet('lignes', n(0)),
    vSet('niveau', n(1)),
    vSet('heldPiece', n(-1)),
    vSet('canHold', bool(true)),
    vSet('moveDir', n(0)),
    vSet('dasTimer', n(0)),
    vSet('arrTimer', n(0)),
    vSet('softDropTimer', n(0)),
    vSet('dropTimer', n(0)),
    { type: 'pf_remove_text', id: uid('rm'), fields: { ID: 'gov1' } },
    { type: 'pf_remove_text', id: uid('rm'), fields: { ID: 'gov2' } },
    { type: 'pf_remove_text', id: uid('rm'), fields: { ID: 'gov3' } },
    { type: 'pf_remove_text', id: uid('rm'), fields: { ID: 'pause' } },
    jsStmt(`
      bag = [];
      board = Array.from({ length: 20 }, () => Array(10).fill(-1));
      curPiece = getFromBag();
      nextPiece = getFromBag();
      curRot = 0;
      curX = curPiece === 0 ? 3 : curPiece === 3 ? 4 : 3;
      curY = 0;
    `),
    callProc('effacerGrille'),
    callProc('mettreAJourApercus'),
    callProc('mettreAJourHUD'),
    callProc('mettreAJourAffichage'),
    { type: 'pf_play_music', id: uid('pm'), fields: { SOUND: 'tetris' } }
  ), 460, 360));

  // Procédure : effacerAffichageActif
  allBlocks.push(defProc('effacerAffichageActif', chain(
    jsStmt(`
      for (let i = 0; i < drawnGhost.length; i++) {
        const tx = drawnGhost[i][0], ty = drawnGhost[i][1];
        const br = ty - BOARD_Y, bc = tx - BOARD_X;
        const under = (br >= 0 && br < 20 && bc >= 0 && bc < 10) ? board[br][bc] : -1;
        game.setTile(tx, ty, under, 'Grille');
      }
      drawnGhost = [];
      for (let i = 0; i < drawnActive.length; i++) {
        const tx = drawnActive[i][0], ty = drawnActive[i][1];
        const br = ty - BOARD_Y, bc = tx - BOARD_X;
        const under = (br >= 0 && br < 20 && bc >= 0 && bc < 10) ? board[br][bc] : -1;
        game.setTile(tx, ty, under, 'Grille');
      }
      drawnActive = [];
    `)
  ), 460, 940));

  // Procédure : mettreAJourAffichage
  allBlocks.push(defProc('mettreAJourAffichage', chain(
    callProc('effacerAffichageActif'),
    {
      type: 'controls_if',
      id: uid('cif'),
      inputs: {
        IF0: jsVal('!gameOver && !clearing'),
        DO0: {
          block: chain(
            jsStmt(`
              // Dessin du fantôme
              let gy = curY;
              while (canFit(curPiece, curRot, curX, gy + 1)) gy++;
              if (gy !== curY) {
                const bl = SHAPES[curPiece][curRot];
                for (let i = 0; i < 4; i++) {
                  const c = curX + bl[i][0], r = gy + bl[i][1];
                  if (r >= 0 && r < 20 && c >= 0 && c < 10) {
                    const tx = BOARD_X + c, ty = BOARD_Y + r;
                    game.setTile(tx, ty, TILE_GHOST, 'Grille');
                    drawnGhost.push([tx, ty]);
                  }
                }
              }
              // Dessin de la pièce active
              const bl = SHAPES[curPiece][curRot];
              const tileId = PIECE_TILES[curPiece];
              for (let i = 0; i < 4; i++) {
                const c = curX + bl[i][0], r = curY + bl[i][1];
                if (r >= 0 && r < 20 && c >= 0 && c < 10) {
                  const tx = BOARD_X + c, ty = BOARD_Y + r;
                  game.setTile(tx, ty, tileId, 'Grille');
                  drawnActive.push([tx, ty]);
                }
              }
            `)
          )
        }
      }
    }
  ), 460, 1150));

  // Procédure : effacerGrille
  allBlocks.push(defProc('effacerGrille', chain(
    jsStmt(`
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          game.setTile(BOARD_X + c, BOARD_Y + r, board[r][c], 'Grille');
        }
      }
    `)
  ), 460, 1420));

  // Procédure : mettreAJourApercus
  allBlocks.push(defProc('mettreAJourApercus', chain(
    jsStmt(`
      // Aperçu SUIVANT
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          game.setTile(PREVIEW_X + dx, PREVIEW_Y + dy, -1, 'Grille');
        }
      }
      const dimsN = PIECE_DIMS[nextPiece];
      const oxN = Math.floor((4 - dimsN.w) / 2);
      const oyN = Math.floor((4 - dimsN.h) / 2);
      const blN = SHAPES[nextPiece][0];
      const tidN = PIECE_TILES[nextPiece];
      for (let i = 0; i < 4; i++) {
        game.setTile(PREVIEW_X + oxN + blN[i][0], PREVIEW_Y + oyN + blN[i][1], tidN, 'Grille');
      }

      // Aperçu RÉSERVE (HOLD)
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          game.setTile(HOLD_X + dx, HOLD_Y + dy, -1, 'Grille');
        }
      }
      if (heldPiece >= 0) {
        const dimsH = PIECE_DIMS[heldPiece];
        const oxH = Math.floor((4 - dimsH.w) / 2);
        const oyH = Math.floor((4 - dimsH.h) / 2);
        const blH = SHAPES[heldPiece][0];
        const tidH = PIECE_TILES[heldPiece];
        for (let i = 0; i < 4; i++) {
          game.setTile(HOLD_X + oxH + blH[i][0], HOLD_Y + oyH + blH[i][1], tidH, 'Grille');
        }
      }
    `)
  ), 460, 1600));

  // Procédure : mettreAJourHUD
  allBlocks.push(defProc('mettreAJourHUD', chain(
    jsStmt(`
      const best = game.load('tetris_best', 0);
      if (score > best) game.save('tetris_best', score);
      const record = Math.max(score, best);

      game.setText('t_hold', 'RÉSERVE', 38, 25, { align: 'center', size: 0.65, color: '#fcc858' });
      game.setText('t_score_lbl', 'SCORE', 40, 72, { align: 'center', size: 0.65, color: '#fcc858' });
      game.setText('t_score_val', '' + score, 40, 84, { align: 'center', size: 0.75, color: '#ffffff' });

      game.setText('t_lines_lbl', 'LIGNES', 40, 102, { align: 'center', size: 0.65, color: '#fcc858' });
      game.setText('t_lines_val', '' + lignes, 40, 114, { align: 'center', size: 0.75, color: '#ffffff' });

      game.setText('t_level_lbl', 'NIVEAU', 40, 132, { align: 'center', size: 0.65, color: '#fcc858' });
      game.setText('t_level_val', '' + niveau, 40, 144, { align: 'center', size: 0.75, color: '#ffffff' });

      game.setText('t_best_lbl', 'RECORD', 40, 164, { align: 'center', size: 0.65, color: '#a7f070' });
      game.setText('t_best_val', '' + record, 40, 176, { align: 'center', size: 0.75, color: '#ffffff' });

      game.setText('t_next', 'SUIVANT', 214, 25, { align: 'center', size: 0.65, color: '#fcc858' });
      game.setText('t_ctrl_title', 'AIDE', 214, 72, { align: 'center', size: 0.65, color: '#fcc858' });
      game.setText('t_ctrl1', '← → Bouger', 214, 86, { align: 'center', size: 0.58, color: '#bcd8fc' });
      game.setText('t_ctrl2', '↑ / X Tourner', 214, 98, { align: 'center', size: 0.58, color: '#bcd8fc' });
      game.setText('t_ctrl3', '↓ Descente', 214, 110, { align: 'center', size: 0.58, color: '#bcd8fc' });
      game.setText('t_ctrl4', 'ESPACE Drop', 214, 122, { align: 'center', size: 0.58, color: '#bcd8fc' });
      game.setText('t_ctrl5', 'C Réserve', 214, 134, { align: 'center', size: 0.58, color: '#bcd8fc' });
      game.setText('t_ctrl6', 'ENTRÉE Pause', 214, 146, { align: 'center', size: 0.58, color: '#bcd8fc' });
    `)
  ), 460, 2040));

  // Procédure : spawnNextPiece
  allBlocks.push(defProc('spawnNextPiece', chain(
    jsStmt(`
      curPiece = nextPiece;
      nextPiece = getFromBag();
      curRot = 0;
      curX = curPiece === 0 ? 3 : curPiece === 3 ? 4 : 3;
      curY = 0;
      canHold = true;
    `),
    callProc('mettreAJourApercus'),
    {
      type: 'controls_if',
      id: uid('cif'),
      inputs: {
        IF0: jsVal('!canFit(curPiece, curRot, curX, curY)'),
        DO0: { block: callProc('partiePerdue') }
      },
      next: {
        block: {
          type: 'controls_if',
          id: uid('cif'),
          inputs: {
            IF0: jsVal('!gameOver'),
            DO0: { block: callProc('mettreAJourAffichage') }
          }
        }
      }
    }
  ), 460, 2350));

  // Procédure : verrouillerPiece
  allBlocks.push(defProc('verrouillerPiece', chain(
    {
      type: 'controls_if',
      id: uid('cif'),
      inputs: {
        IF0: jsVal('!gameOver && !clearing'),
        DO0: {
          block: chain(
            jsStmt(`
              const bl = SHAPES[curPiece][curRot];
              const tid = PIECE_TILES[curPiece];
              for (let i = 0; i < 4; i++) {
                const c = curX + bl[i][0], r = curY + bl[i][1];
                if (r >= 0 && r < 20 && c >= 0 && c < 10) board[r][c] = tid;
              }
              drawnActive = [];
              drawnGhost = [];
              const fullRows = [];
              for (let r = 0; r < 20; r++) {
                let full = true;
                for (let c = 0; c < 10; c++) if (board[r][c] < 0) { full = false; break; }
                if (full) fullRows.push(r);
              }
            `),
            {
              type: 'controls_if',
              id: uid('cif'),
              extraState: { hasElse: true },
              inputs: {
                IF0: jsVal('fullRows.length > 0'),
                DO0: {
                  block: chain(
                    vSet('clearing', bool(true)),
                    jsStmt(`
                      for (let i = 0; i < fullRows.length; i++) {
                        const r = fullRows[i];
                        for (let c = 0; c < 10; c++) game.setTile(BOARD_X + c, BOARD_Y + r, TILE_FLASH, 'Grille');
                        game.particles((BOARD_X + 5) * 8, (BOARD_Y + r) * 8 + 4, '#ffcd75', 14, 60, 300);
                      }
                      const count = fullRows.length;
                      const pts = [0, 100, 300, 500, 800][count] * niveau;
                      score += pts;
                      lignes += count;
                      if (count === 4) {
                        game.camera.shake(160, 0.012);
                        game.playSound('tetris');
                        game.setText('streak', 'TETRIS !', 128, 28, { align: 'center', size: 1.1, color: '#ffd000' });
                        game.wait(900, () => game.removeText('streak'));
                      } else {
                        game.playSound('ligne');
                      }
                      const newLvl = Math.floor(lignes / 10) + 1;
                      if (newLvl > niveau) {
                        niveau = newLvl;
                        game.playSound('niveau');
                        game.setText('levelup', 'NIVEAU ' + niveau + ' !', 128, 28, { align: 'center', size: 1.0, color: '#00d0f0' });
                        game.wait(1000, () => game.removeText('levelup'));
                      }
                    `),
                    callProc('mettreAJourHUD'),
                    {
                      type: 'pf_wait',
                      id: uid('wait'),
                      inputs: {
                        MS: n(130),
                        DO: {
                          block: chain(
                            vSet('clearing', bool(false)),
                            jsStmt(`
                              for (let i = 0; i < fullRows.length; i++) {
                                const r = fullRows[i];
                                board.splice(r, 1);
                                board.unshift(Array(10).fill(-1));
                              }
                            `),
                            callProc('effacerGrille'),
                            callProc('spawnNextPiece')
                          )
                        }
                      }
                    }
                  )
                },
                ELSE: {
                  block: chain(
                    { type: 'pf_play_sound', id: uid('ps'), fields: { SOUND: 'deplacement' } },
                    callProc('spawnNextPiece')
                  )
                }
              }
            }
          )
        }
      }
    }
  ), 460, 2650));

  // Procédure : descendre
  allBlocks.push(defProc('descendre', chain(
    {
      type: 'controls_if',
      id: uid('cif'),
      extraState: { hasElse: true },
      inputs: {
        IF0: jsVal('canFit(curPiece, curRot, curX, curY + 1)'),
        DO0: {
          block: chain(
            jsStmt('curY++'),
            callProc('mettreAJourAffichage')
          )
        },
        ELSE: {
          block: callProc('verrouillerPiece')
        }
      }
    }
  ), 460, 3150));

  // Procédure : deplacer
  allBlocks.push(defProc('deplacer', chain(
    {
      type: 'controls_if',
      id: uid('cif'),
      inputs: {
        IF0: jsVal('!gameOver && !enPause && !clearing'),
        DO0: {
          block: chain(
            {
              type: 'controls_if',
              id: uid('cif'),
              inputs: {
                IF0: jsVal('canFit(curPiece, curRot, curX + moveDx, curY)'),
                DO0: {
                  block: chain(
                    jsStmt('curX += moveDx'),
                    { type: 'pf_play_sound', id: uid('ps'), fields: { SOUND: 'deplacement' } },
                    callProc('mettreAJourAffichage')
                  )
                }
              }
            }
          )
        }
      }
    }
  ), 460, 3350));

  // Procédure : tourner
  allBlocks.push(defProc('tourner', chain(
    {
      type: 'controls_if',
      id: uid('cif'),
      inputs: {
        IF0: jsVal('!gameOver && !enPause && !clearing'),
        DO0: {
          block: chain(
            jsStmt(`
              const nextRot = (curRot + rotDir + 4) % 4;
              const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
              let turned = false;
              for (let i = 0; i < kicks.length; i++) {
                const kx = kicks[i][0], ky = kicks[i][1];
                if (canFit(curPiece, nextRot, curX + kx, curY + ky)) {
                  curRot = nextRot;
                  curX += kx;
                  curY += ky;
                  turned = true;
                  break;
                }
              }
            `),
            {
              type: 'controls_if',
              id: uid('cif'),
              inputs: {
                IF0: jsVal('turned'),
                DO0: {
                  block: chain(
                    { type: 'pf_play_sound', id: uid('ps'), fields: { SOUND: 'rotation' } },
                    callProc('mettreAJourAffichage')
                  )
                }
              }
            }
          )
        }
      }
    }
  ), 460, 3600));

  // Procédure : reserver (Hold)
  allBlocks.push(defProc('reserver', chain(
    {
      type: 'controls_if',
      id: uid('cif'),
      inputs: {
        IF0: jsVal('canHold && !gameOver && !enPause && !clearing'),
        DO0: {
          block: chain(
            vSet('canHold', bool(false)),
            { type: 'pf_play_sound', id: uid('ps'), fields: { SOUND: 'hold' } },
            callProc('effacerAffichageActif'),
            jsStmt(`
              if (heldPiece === -1) {
                heldPiece = curPiece;
                spawnNextPiece();
              } else {
                const tmp = heldPiece;
                heldPiece = curPiece;
                curPiece = tmp;
                curRot = 0;
                curX = curPiece === 0 ? 3 : curPiece === 3 ? 4 : 3;
                curY = 0;
                if (!canFit(curPiece, curRot, curX, curY)) {
                  partiePerdue();
                } else {
                  updateDisplay();
                }
              }
            `),
            callProc('mettreAJourApercus')
          )
        }
      }
    }
  ), 460, 3950));

  // Procédure : partiePerdue
  allBlocks.push(defProc('partiePerdue', chain(
    vSet('gameOver', bool(true)),
    callProc('effacerAffichageActif'),
    { type: 'pf_stop_music', id: uid('sm') },
    { type: 'pf_play_sound', id: uid('ps'), fields: { SOUND: 'perdu' } },
    {
      type: 'pf_cam_shake',
      id: uid('shake'),
      inputs: {
        MS: n(300),
        POWER: n(0.02)
      }
    },
    {
      type: 'pf_set_text_opts',
      id: uid('txt'),
      fields: { ID: 'gov1', ALIGN: 'center' },
      inputs: {
        TEXT: str('FIN DE PARTIE'),
        X: n(128),
        Y: n(92),
        COLOR: col('#ef7d57'),
        SIZE: n(1.15)
      }
    },
    jsStmt(`
      game.setText('gov2', 'SCORE : ' + score, 128, 114, { align: 'center', size: 0.85, color: '#ffffff' });
      game.setText('gov3', 'ENTRÉE POUR REJOUER', 128, 134, { align: 'center', size: 0.72, color: '#fcc858' });
    `)
  ), 460, 4300));

  // ========================================================================
  // 2. ÉVÉNEMENTS (colonne gauche, x = 20)
  // ========================================================================

  // Quand créé
  allBlocks.push({
    type: 'pf_on_create',
    id: uid('on_create'),
    x: 20,
    y: 20,
    inputs: {
      DO: { block: callProc('initialiserPartie') }
    }
  });

  // À chaque image (avec dt)
  allBlocks.push({
    type: 'pf_on_update',
    id: uid('on_update'),
    x: 20,
    y: 140,
    inputs: {
      DO: {
        block: {
          type: 'controls_if',
          id: uid('cif'),
          inputs: {
            IF0: jsVal('!gameOver && !enPause && !clearing'),
            DO0: {
              block: chain(
                jsStmt(`
                  const leftDown = input.isDown('LEFT') || input.isDown('A') || input.isDown('Q');
                  const rightDown = input.isDown('RIGHT') || input.isDown('D');
                  const downDown = input.isDown('DOWN') || input.isDown('S');

                  // Déplacement horizontal répétitif (DAS/ARR)
                  if (leftDown && !rightDown) {
                    if (moveDir !== -1) {
                      moveDir = -1; dasTimer = 0; arrTimer = 0;
                      moveDx = -1; deplacer();
                    } else {
                      dasTimer += dt;
                      if (dasTimer >= DAS) {
                        arrTimer += dt;
                        if (arrTimer >= ARR) { arrTimer = 0; moveDx = -1; deplacer(); }
                      }
                    }
                  } else if (rightDown && !leftDown) {
                    if (moveDir !== 1) {
                      moveDir = 1; dasTimer = 0; arrTimer = 0;
                      moveDx = 1; deplacer();
                    } else {
                      dasTimer += dt;
                      if (dasTimer >= DAS) {
                        arrTimer += dt;
                        if (arrTimer >= ARR) { arrTimer = 0; moveDx = 1; deplacer(); }
                      }
                    }
                  } else {
                    moveDir = 0; dasTimer = 0; arrTimer = 0;
                  }

                  // Descente rapide (soft drop)
                  if (downDown) {
                    softDropTimer += dt;
                    if (softDropTimer >= SOFT_DROP_RATE) {
                      softDropTimer = 0;
                      if (canFit(curPiece, curRot, curX, curY + 1)) {
                        curY++;
                        score += 1;
                        updateDisplay();
                        updateHud();
                      } else {
                        verrouillerPiece();
                      }
                    }
                  } else {
                    softDropTimer = 0;
                  }

                  // Gravité normale
                  const dropInterval = Math.max(0.08, 0.85 - (niveau - 1) * 0.075);
                  dropTimer += dt;
                  if (dropTimer >= dropInterval) {
                    dropTimer = 0;
                    descendre();
                  }
                `)
              )
            }
          }
        }
      }
    }
  });

  // Touche GAUCHE
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_left'),
    x: 20,
    y: 450,
    fields: { KEY: 'LEFT' },
    inputs: {
      DO: {
        block: chain(
          vSet('moveDx', n(-1)),
          callProc('deplacer')
        )
      }
    }
  });

  // Touche DROITE
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_right'),
    x: 20,
    y: 590,
    fields: { KEY: 'RIGHT' },
    inputs: {
      DO: {
        block: chain(
          vSet('moveDx', n(1)),
          callProc('deplacer')
        )
      }
    }
  });

  // Touche HAUT
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_up'),
    x: 20,
    y: 730,
    fields: { KEY: 'UP' },
    inputs: {
      DO: {
        block: chain(
          vSet('rotDir', n(1)),
          callProc('tourner')
        )
      }
    }
  });

  // Touche W
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_w'),
    x: 20,
    y: 870,
    fields: { KEY: 'W' },
    inputs: {
      DO: {
        block: chain(
          vSet('rotDir', n(1)),
          callProc('tourner')
        )
      }
    }
  });

  // Touche X
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_x'),
    x: 20,
    y: 1010,
    fields: { KEY: 'X' },
    inputs: {
      DO: {
        block: chain(
          vSet('rotDir', n(1)),
          callProc('tourner')
        )
      }
    }
  });

  // Touche Z
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_z'),
    x: 20,
    y: 1150,
    fields: { KEY: 'Z' },
    inputs: {
      DO: {
        block: chain(
          vSet('rotDir', n(-1)),
          callProc('tourner')
        )
      }
    }
  });

  // Touche BAS
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_down'),
    x: 20,
    y: 1290,
    fields: { KEY: 'DOWN' },
    inputs: {
      DO: { block: callProc('descendre') }
    }
  });

  // Touche ESPACE (Hard drop / Rejouer)
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_space'),
    x: 20,
    y: 1430,
    fields: { KEY: 'SPACE' },
    inputs: {
      DO: {
        block: {
          type: 'controls_if',
          id: uid('cif'),
          extraState: { hasElse: true },
          inputs: {
            IF0: vGet('gameOver'),
            DO0: { block: callProc('initialiserPartie') },
            ELSE: {
              block: {
                type: 'controls_if',
                id: uid('cif'),
                inputs: {
                  IF0: jsVal('!enPause && !clearing'),
                  DO0: {
                    block: chain(
                      jsStmt(`
                        let dist = 0;
                        while (canFit(curPiece, curRot, curX, curY + 1)) {
                          curY++;
                          dist++;
                        }
                        score += dist * 2;
                      `),
                      {
                        type: 'pf_cam_shake',
                        id: uid('shake'),
                        inputs: {
                          MS: n(80),
                          POWER: n(0.005)
                        }
                      },
                      { type: 'pf_play_sound', id: uid('ps'), fields: { SOUND: 'chute' } },
                      callProc('mettreAJourHUD'),
                      callProc('verrouillerPiece')
                    )
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  // Touche C (Réserve / Hold)
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_c'),
    x: 20,
    y: 1720,
    fields: { KEY: 'C' },
    inputs: {
      DO: { block: callProc('reserver') }
    }
  });

  // Touche SHIFT (Réserve / Hold)
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_shift'),
    x: 20,
    y: 1860,
    fields: { KEY: 'SHIFT' },
    inputs: {
      DO: { block: callProc('reserver') }
    }
  });

  // Touche ENTRÉE (Pause / Rejouer)
  allBlocks.push({
    type: 'pf_on_key',
    id: uid('k_enter'),
    x: 20,
    y: 2000,
    fields: { KEY: 'ENTER' },
    inputs: {
      DO: {
        block: {
          type: 'controls_if',
          id: uid('cif'),
          extraState: { hasElse: true },
          inputs: {
            IF0: vGet('gameOver'),
            DO0: { block: callProc('initialiserPartie') },
            ELSE: {
              block: chain(
                jsStmt('enPause = !enPause'),
                {
                  type: 'controls_if',
                  id: uid('cif'),
                  extraState: { hasElse: true },
                  inputs: {
                    IF0: vGet('enPause'),
                    DO0: {
                      block: chain(
                        { type: 'pf_stop_music', id: uid('sm') },
                        {
                          type: 'pf_set_text_opts',
                          id: uid('txt'),
                          fields: { ID: 'pause', ALIGN: 'center' },
                          inputs: {
                            TEXT: str('PAUSE'),
                            X: n(128),
                            Y: n(108),
                            COLOR: col('#00d0f0'),
                            SIZE: n(1.4)
                          }
                        }
                      )
                    },
                    ELSE: {
                      block: chain(
                        { type: 'pf_remove_text', id: uid('rm'), fields: { ID: 'pause' } },
                        { type: 'pf_play_music', id: uid('pm'), fields: { SOUND: 'tetris' } }
                      )
                    }
                  }
                }
              )
            }
          }
        }
      }
    }
  });

  return {
    blocks: {
      languageVersion: 0,
      blocks: allBlocks
    }
  };
}

// ============================================================================
// CRÉATION DE LA CARTE ET DU PROJET
// ============================================================================

const W = 32;
const H = 30;

function planFond() {
  const g = Array.from({ length: H }, () => Array(W).fill(8));
  g[1][13] = 18; g[1][14] = 19; g[1][15] = 20; g[1][16] = 21; g[1][17] = 22; g[1][18] = 23;
  for (let x = 1; x < 31; x++) g[2][x] = 1;

  // Boîte HOLD
  g[3][2] = 3; g[3][7] = 4;
  for (let x = 3; x <= 6; x++) g[3][x] = 1;
  for (let y = 4; y <= 7; y++) {
    g[y][2] = 2;
    for (let x = 3; x <= 6; x++) g[y][x] = 7;
    g[y][7] = 2;
  }
  g[8][2] = 5; g[8][7] = 6;
  for (let x = 3; x <= 6; x++) g[8][x] = 1;

  // Panneau stats gauche
  for (let y = 9; y <= 23; y++) {
    for (let x = 2; x <= 8; x++) g[y][x] = 7;
  }
  for (let y = 9; y <= 23; y++) { g[y][1] = 2; g[y][9] = 2; }
  for (let x = 1; x <= 9; x++) { g[24][x] = 1; }
  g[24][1] = 5; g[24][9] = 6;

  // Grille principale
  for (let y = 4; y <= 23; y++) {
    for (let x = 11; x <= 20; x++) g[y][x] = 0;
  }
  g[3][10] = 3; g[3][21] = 4;
  for (let x = 11; x <= 20; x++) g[3][x] = 1;
  for (let y = 4; y <= 23; y++) { g[y][10] = 2; g[y][21] = 2; }
  g[24][10] = 5; g[24][21] = 6;
  for (let x = 11; x <= 20; x++) g[24][x] = 1;

  // Boîte NEXT
  g[3][24] = 3; g[3][29] = 4;
  for (let x = 25; x <= 28; x++) g[3][x] = 1;
  for (let y = 4; y <= 7; y++) {
    g[y][24] = 2;
    for (let x = 25; x <= 28; x++) g[y][x] = 7;
    g[y][29] = 2;
  }
  g[8][24] = 5; g[8][29] = 6;
  for (let x = 25; x <= 28; x++) g[8][x] = 1;

  // Panneau aide droite
  for (let y = 9; y <= 23; y++) {
    for (let x = 23; x <= 29; x++) g[y][x] = 7;
  }
  for (let y = 9; y <= 23; y++) { g[y][22] = 2; g[y][30] = 2; }
  for (let x = 22; x <= 30; x++) { g[24][x] = 1; }
  g[24][22] = 5; g[24][30] = 6;

  for (let x = 1; x < 31; x++) g[28][x] = 1;

  return g.flat();
}

export function buildTetrisProject() {
  const project = createEmptyProject('Tetris');
  project.meta.id = 'tetris';
  project.meta.description = 'Tetris rétro complet codé à 100% en Blocs (Blockly) avec rotation SRS, 7-bag, ghost piece, hold et musique chiptune';
  project.palette = PALETTE;
  project.settings.width = 256;
  project.settings.height = 240;
  project.settings.tileSize = 8;
  project.settings.gravity = 0;
  project.settings.background = '#0d0e17';

  // Sprites
  pf.upsertSprite(project, {
    name: 'TilesetTetris',
    width: 8,
    height: 8,
    frames: TILESET_FRAMES,
    animations: [{ name: 'idle', frames: [0], fps: 1, loop: true }]
  });

  pf.upsertSprite(project, {
    name: 'Vide',
    width: 8,
    height: 8,
    frames: [SPRITE_VIDE],
    animations: [{ name: 'idle', frames: [0], fps: 1, loop: true }]
  });

  // Sons
  const sons = [
    { name: 'deplacement', preset: 'blip', volume: 0.2, pitch: 0.9 },
    { name: 'rotation', preset: 'blip', volume: 0.4, pitch: 1.6 },
    { name: 'chute', preset: 'hit', volume: 0.4, pitch: 1.2 },
    { name: 'ligne', preset: 'coin', volume: 0.6, pitch: 1.0 },
    { name: 'tetris', preset: 'powerup', volume: 0.75, pitch: 1.3 },
    { name: 'hold', preset: 'powerup', volume: 0.4, pitch: 1.6 },
    { name: 'perdu', preset: 'explosion', volume: 0.6, pitch: 0.6 },
    { name: 'niveau', preset: 'portal', volume: 0.65, pitch: 1.2 },
  ];
  for (const s of sons) {
    pf.addSound(project, s);
  }

  // Définir le contexte Blockly avec le projet (pour que les dropdowns trouvent les sons)
  setBlocksContext({ getProject: () => project });

  // Construction du workspace Blockly
  const blocksWorkspaceState = buildTetrisBlockWorkspace();

  // Création d'un workspace Blockly temporaire en mémoire pour générer le code
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(blocksWorkspaceState, ws);
  const generatedCode = generateCode(ws);

  // Objet TetrisGame en MODE BLOCS
  const tetrisObj = createObject('TetrisGame', pf.findSprite(project, 'Vide').id);
  tetrisObj.physics.gravity = false;
  tetrisObj.physics.collideWorld = false;
  tetrisObj.physics.collideMap = false;
  tetrisObj.physics.immovable = true;
  tetrisObj.script = {
    mode: 'blocks',
    code: generatedCode,
    blocks: blocksWorkspaceState
  };
  project.objects.push(tetrisObj);

  // Carte
  const map = createMap('Tetris', W, H, 8);
  map.tilesetSpriteId = pf.findSprite(project, 'TilesetTetris').id;
  map.background = '#0d0e17';
  map.layers = [
    {
      id: genUid('lay'),
      name: 'Fond',
      visible: true,
      solid: false,
      data: planFond()
    },
    {
      id: genUid('lay'),
      name: 'Grille',
      visible: true,
      solid: false,
      data: Array(W * H).fill(-1)
    }
  ];
  map.entities = [
    {
      id: genUid('ent'),
      objectId: tetrisObj.id,
      x: 0,
      y: 0
    }
  ];
  project.maps = [map];
  project.settings.startMapId = map.id;

  return project;
}

// Exécution si appelé directement
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('Construction du projet Tetris en mode Blocs...');
  const project = buildTetrisProject();
  pf.saveGame(project);
  console.log('Jeu sauvegardé dans games/tetris.pixelforge.json');

  const issues = pf.validateProject(project);
  console.log(pf.formatIssues(issues));

  const { file, bytes } = await pf.exportGameHTML(project);
  console.log(`Exporté avec succès : ${file} (${Math.round(bytes / 1024)} Ko)`);
}
