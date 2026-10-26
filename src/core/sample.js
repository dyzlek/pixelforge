// Projet d'exemple : un petit jeu de plateforme jouable dès le premier lancement.
// Les sprites sont dessinés ici en code : chaque caractère d'une ligne = un index de la palette
// (0-9 puis a-f, voir DEFAULT_PALETTE), '.' = transparent.

import { createEmptyProject, createSprite, createObject, createMap, DEFAULT_PALETTE, uid } from './project.js';

const HEX = '0123456789abcdef';

// Convertit des lignes de caractères en image PNG (dataURL). align : 'left' ou 'center' (horizontal),
// toujours calé en bas pour que les personnages « posent le pied » sur le sol.
function frame(rows, align = 'left', w = 16, h = 16) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const top = h - rows.length;
  rows.forEach((row, j) => {
    const left = align === 'center' ? Math.floor((w - row.length) / 2) : 0;
    for (let i = 0; i < row.length; i++) {
      const idx = HEX.indexOf(row[i]);
      if (idx < 0) continue;
      ctx.fillStyle = DEFAULT_PALETTE[idx];
      ctx.fillRect(left + i, top + j, 1, 1);
    }
  });
  return c.toDataURL('image/png');
}

const blank = '.'.repeat(16);
const setPx = (rows, x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); return rows; };

// ---------- Tuiles ----------
function bricks(body, hi, mortar) {
  const M = mortar.repeat(16);
  const A = body.repeat(7) + mortar + body.repeat(7) + mortar;
  const Ah = hi.repeat(7) + mortar + hi.repeat(7) + mortar;
  const B = body.repeat(3) + mortar + body.repeat(7) + mortar + body.repeat(4);
  const Bh = hi.repeat(3) + mortar + hi.repeat(7) + mortar + hi.repeat(4);
  return [M, Ah, A, A, M, Bh, B, B, M, Ah, A, A, M, Bh, B, B];
}

const DIRT = [
  '2222222222222222', '2212222222222122', '2222222322222222', '2222222222221222',
  '2221222222222222', '2222222232222222', '2222122222222212', '2222222222222222',
  '2322222222122222', '2222222222222222', '2222221222222322', '1222222222222222',
  '2222222232222212', '2222122222222222', '2222222222322222', '2222222222222222',
];

const GRASS = [
  '5555555555555555', '5565555565555655', '6666566666656666', '6676666766666766',
  '2262226222262222', ...DIRT.slice(5),
];

const STONE = (() => {
  const rows = ['c'.repeat(15) + 'd'];
  for (let y = 1; y < 15; y++) rows.push('c' + 'd'.repeat(14) + 'e');
  rows.push('d' + 'e'.repeat(15));
  setPx(rows, 4, 4, 'e'); setPx(rows, 5, 4, 'e'); setPx(rows, 10, 9, 'c'); setPx(rows, 9, 10, 'e'); setPx(rows, 3, 11, 'c');
  return rows;
})();

const WOOD = [
  '4444444444444444', '3333333333333333', '3333323333333333', '3333333333233333',
  '3333333333333333', '3323333333333323', '3333333333333333', '2222222222222222',
  '4444444444444444', '3333333333333333', '3333333323333333', '3233333333333333',
  '3333333333333323', '3333323333333333', '3333333333333333', '2222222222222222',
];

const TILES = [GRASS, DIRT, bricks('2', '3', 'd'), STONE, WOOD, bricks('f', 'e', '8')];
const T = { GRASS: 0, DIRT: 1, BRICK: 2, STONE: 3, WOOD: 4, WALL: 5 };

// ---------- Joueur (16×16, regarde à droite) ----------
const HEAD = [
  '......22222.....', '.....2222222....', '.....1111111....',
  '.....3333303....', '.....3333333....', '......33333.....',
];
const TORSO = ['.....9999999....', '....399999993...', '....33999993....', '.....4444444....'];
const LEGS = {
  idle: ['.....8888888....', '.....888.888....', '.....888.888....', '.....111.111....', '....1111.1111...'],
  runA: ['.....8888888....', '....888..888....', '...888....888...', '..888......888..', '..111......111..'],
  runB: ['.....8888888....', '.....888.888....', '......88.88.....', '......88.88.....', '......11.111....'],
  runC: ['.....8888888....', '.....888..888...', '....888....888..', '...888......88..', '...111......11..'],
  runD: ['.....8888888....', '.....88.8888....', '.....88.888.....', '.....88.888.....', '.....11.1111....'],
};
const PLAYER_FRAMES = [
  [blank, ...HEAD, ...TORSO, ...LEGS.idle], // idle 1
  [blank, blank, ...HEAD, TORSO[0], TORSO[2], TORSO[3], ...LEGS.idle], // idle 2 : le corps s'écrase un peu
  [blank, ...HEAD, ...TORSO, ...LEGS.runA], // course 1..4
  [blank, ...HEAD, ...TORSO, ...LEGS.runB],
  [blank, ...HEAD, ...TORSO, ...LEGS.runC],
  [blank, ...HEAD, ...TORSO, ...LEGS.runD],
];

// ---------- Pièce : ellipse dessinée par calcul, de plus en plus fine (elle tourne) ----------
function coinFrame(rx) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / rx;
      const dy = (y + 0.5 - 8) / 6.5;
      const d = dx * dx + dy * dy;
      row += d > 1 ? '.' : d > 0.5 ? '3' : (dx < -0.2 && dy < -0.2 ? 'c' : '4');
    }
    rows.push(row);
  }
  return rows;
}
const COIN_FRAMES = [6, 4, 1.4, 4].map(coinFrame);

// ---------- Slime (2 frames, symétrique donc centré) ----------
const SLIME_FRAMES = [
  ['6666', '66666666', '556666666666', '66666666666666', '66cc666666cc66', '66c0666666c066', '66666666666666', '6666666666666666', '6666666666666666', '7777777777777777'],
  ['66666666', '556666666666', '6666666666666666', '66cc66666666cc66', '66c066666666c066', '6666666666666666', '6666666666666666', '7777777777777777'],
];

// ---------- Drapeau d'arrivée ----------
const FLAG_FRAME = [
  '..44', '..cd2222222', '..cd22222222', '..cd2222222', '..cd222222', '..cd2222',
  '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '..cd', '.eeeeee',
];

// ---------- Scripts (API : docs/SCRIPT_API.md) ----------
const SCRIPT_GLOBAL = `// Script global : lancé une fois au début de chaque niveau (self vaut null ici).
let elapsed = 0;

on('create', () => {
  // game.vars est partagé par tous les scripts : on y range une fonction pratique pour afficher le score.
  game.vars.showScore = () => game.setText('score', 'Pièces : ' + game.score, 4, 4);
  game.vars.showScore();
  game.setText('help', 'Flèches ou Q/D : bouger   Espace : sauter', 4, game.height - 16);
});

// L'aide disparaît au bout de 6 secondes
on('update', (dt) => {
  elapsed += dt;
  if (elapsed > 6) game.removeText('help');
});
`;

const SCRIPT_PLAYER = `// Le joueur : il se déplace, saute, change d'animation, et la caméra le suit.
const SPEED = 90;   // vitesse de marche (pixels par seconde)
const JUMP = 290;   // force du saut

on('create', () => {
  game.camera.follow(self);
});

on('update', (dt) => {
  // 1. Aller à gauche / à droite (flèches, ou Q / D, ou A)
  self.vx = 0;
  if (input.isDown('LEFT') || input.isDown('Q') || input.isDown('A')) {
    self.vx = -SPEED;
    self.flipX = true;      // le sprite regarde vers la gauche
  }
  if (input.isDown('RIGHT') || input.isDown('D')) {
    self.vx = SPEED;
    self.flipX = false;
  }

  // 2. Sauter : self.jump() ne fait rien si on n'est pas posé sur le sol
  if (input.justPressed('SPACE') || input.justPressed('UP') || input.justPressed('Z') || input.justPressed('W')) {
    self.jump(JUMP);
  }

  // 3. Animation : course si on bouge, repos sinon
  self.play(self.vx !== 0 ? 'run' : 'idle');

  // 4. Tombé dans un trou ? On recommence le niveau.
  if (self.y > game.mapHeight + 32) {
    game.score = 0;
    game.restart();
  }
});
`;

// La pièce (mode blocs) : quand le joueur la touche, elle disparaît et le score augmente.
// Sérialisation Blockly + code généré par src/editors/objects/blocks.js (écrits en dur : pas d'import de Blockly ici).
const BLOCKS_COIN = {"blocks":{"languageVersion":0,"blocks":[{"type":"pf_on_overlap","id":"FVz~!p366IsC^ctua1k.","x":20,"y":20,"fields":{"OBJ":"Player"},"inputs":{"DO":{"block":{"type":"pf_destroy_self","id":"@j[+:r;|mguN=c/%jkGy","next":{"block":{"type":"pf_score_add","id":"uu[laKR}JQ3c4G#znT+5","inputs":{"VALUE":{"block":{"type":"math_number","id":"mMK7acNDrtau-e!A)3[:","fields":{"NUM":1}}}},"next":{"block":{"type":"pf_set_text","id":"$d!D+YZ+#g/v|=n^NhfC","fields":{"ID":"score"},"inputs":{"TEXT":{"block":{"type":"text_join","id":"NFaXfz(Y9XEJ0,8Bmor2","extraState":{"itemCount":2},"inputs":{"ADD0":{"block":{"type":"text","id":"Rm}nr8Cr|RtpkCfnilXJ","fields":{"TEXT":"Pièces : "}}},"ADD1":{"block":{"type":"pf_score_get","id":"{TS+=L6}#ETx!H_ErUQx"}}}}},"X":{"block":{"type":"math_number","id":"KTj%Xfc}~(4H].vF{/#U","fields":{"NUM":4}}},"Y":{"block":{"type":"math_number","id":"DJOKFh${zeOIfD2Uth{}","fields":{"NUM":4}}}}}}}}}}}}]}};
const SCRIPT_COIN = `on('overlap', 'Player', (other) => {
  self.destroy();
  game.score += 1;
  game.setText('score', 'Pièces : ' + String(game.score), 4, 4);
});
`;

const SCRIPT_ENEMY = `// L'ennemi : il fait des allers-retours. Sauter sur sa tête le tue, le toucher de côté fait perdre.
const SPEED = 30;
let dir = -1;           // -1 = vers la gauche, 1 = vers la droite

on('create', () => {
  self.vx = dir * SPEED;
});

on('update', () => {
  // Bloqué par un mur ? Sa vitesse tombe à 0 : on fait demi-tour.
  if (self.vx === 0) dir = -dir;
  self.vx = dir * SPEED;
  self.flipX = dir > 0;

  // Tombé dans un trou : on le supprime
  if (self.y > game.mapHeight + 16) self.destroy();
});

// Demi-tour aussi toutes les 1,4 secondes
on('timer', 1400, () => {
  dir = -dir;
});

on('collide', 'Player', (player) => {
  // Le joueur est « au-dessus » si le bas de son sprite est près du haut du slime
  const fromAbove = player.y + player.height - self.y < 10;
  if (fromAbove) {
    self.destroy();
    player.vy = -180;   // petit rebond
    game.score += 3;
    game.vars.showScore();
  } else {
    game.camera.shake(150, 0.01);
    game.score = 0;
    game.restart();
  }
});
`;

// Le drapeau d'arrivée (mode blocs) : le toucher termine le niveau, ENTREE rejoue.
const BLOCKS_FLAG = {"blocks":{"languageVersion":0,"blocks":[{"type":"pf_on_overlap","id":"eHAKKWwC+6}I;FQJ)$Y8","x":20,"y":20,"fields":{"OBJ":"Player"},"inputs":{"DO":{"block":{"type":"controls_if","id":"Y{^S?v,f)JNw6-T7%Mu%","inputs":{"IF0":{"block":{"type":"logic_negate","id":"vdKs:L#ow$5ZR(wwpD^X","inputs":{"BOOL":{"block":{"type":"pf_selfvar_get","id":"_TyOPt.mR3OVH!f,ceO@","fields":{"NAME":"won"}}}}}},"DO0":{"block":{"type":"pf_selfvar_set","id":"a}=K$mWO--mgyLoct^RI","fields":{"NAME":"won"},"inputs":{"VALUE":{"block":{"type":"logic_boolean","id":"GFBRYz$:T|6dC[w;(?N!","fields":{"BOOL":"TRUE"}}}},"next":{"block":{"type":"pf_cam_flash","id":"I)crQFP1uaWMS?=!p(m|","inputs":{"MS":{"block":{"type":"math_number","id":"WxsrSp%bZ52E.MM?@`Be","fields":{"NUM":300}}}},"next":{"block":{"type":"pf_set_text","id":"~f/.paH_;?I_NlB!/+m|","fields":{"ID":"win1"},"inputs":{"TEXT":{"block":{"type":"text","id":"%-XLVh$R_,jz,1~s]vU*","fields":{"TEXT":"Bravo !"}}},"X":{"block":{"type":"math_arithmetic","id":"w#3cr!g7wuS1k!=gkf/=","fields":{"OP":"MINUS"},"inputs":{"A":{"block":{"type":"math_arithmetic","id":"$,G,abyTe#er*?$VRaxa","fields":{"OP":"DIVIDE"},"inputs":{"A":{"block":{"type":"pf_game_info","id":"EoW318m*nh}XmTM30Na9","fields":{"PROP":"width"}}},"B":{"block":{"type":"math_number","id":"ik,djkbNXE#yg,L=WbI+","fields":{"NUM":2}}}}}},"B":{"block":{"type":"math_number","id":"=vkpmPeLAf3P)9GBkCl7","fields":{"NUM":48}}}}}},"Y":{"block":{"type":"math_number","id":"=#0r)vY,Sp*j^_l_GnF;","fields":{"NUM":50}}}},"next":{"block":{"type":"pf_set_text","id":"a{@b0r()Upvz1lZx?-U:","fields":{"ID":"win2"},"inputs":{"TEXT":{"block":{"type":"text_join","id":"Q3^Wx:/rts.Lka|BbY):","extraState":{"itemCount":2},"inputs":{"ADD0":{"block":{"type":"text","id":"uqB{@/a@sM4LUc[}{ToP","fields":{"TEXT":"Score : "}}},"ADD1":{"block":{"type":"pf_score_get","id":"oTT/SA5(2*~*GG2x~yjc"}}}}},"X":{"block":{"type":"math_arithmetic","id":"ENg^8Z|[KZTyc5|Ru4B.","fields":{"OP":"MINUS"},"inputs":{"A":{"block":{"type":"math_arithmetic","id":"];xiCq$3zv-L^Qv3Btv.","fields":{"OP":"DIVIDE"},"inputs":{"A":{"block":{"type":"pf_game_info","id":"MmHOHG]Ng7]j5Z,]$Np^","fields":{"PROP":"width"}}},"B":{"block":{"type":"math_number","id":"1zjQwCg+=3nwDPK8;=G}","fields":{"NUM":2}}}}}},"B":{"block":{"type":"math_number","id":"S%W#J57n4rr(Wh*p[sYO","fields":{"NUM":48}}}}}},"Y":{"block":{"type":"math_number","id":"f1)h{Ji+yPI8=z^bwPX*","fields":{"NUM":63}}}},"next":{"block":{"type":"pf_set_text","id":"q-+B.-26H*hpU)tf($_y","fields":{"ID":"win3"},"inputs":{"TEXT":{"block":{"type":"text","id":":|ss#olPWYE*N4[vRVX!","fields":{"TEXT":"ENTREE = rejouer"}}},"X":{"block":{"type":"math_arithmetic","id":"-+s-oC|h_3EjN7%,ocgB","fields":{"OP":"MINUS"},"inputs":{"A":{"block":{"type":"math_arithmetic","id":"n~p38RymLHWnuYm1W1Ko","fields":{"OP":"DIVIDE"},"inputs":{"A":{"block":{"type":"pf_game_info","id":"s6$Eio=+oG9r`4N`P^Ey","fields":{"PROP":"width"}}},"B":{"block":{"type":"math_number","id":"yDU%y5[fF7H}5l;I%DB(","fields":{"NUM":2}}}}}},"B":{"block":{"type":"math_number","id":"BUW`*f|ZKM@p}xDI,yA:","fields":{"NUM":48}}}}}},"Y":{"block":{"type":"math_number","id":"TZN_~O=mdfEea+%+?C_}","fields":{"NUM":76}}}}}}}}}}}}}}}}}}},{"type":"pf_on_key","id":"$y-u-jFLhpcO{5g+~A!6","x":20,"y":300,"fields":{"KEY":"ENTER"},"inputs":{"DO":{"block":{"type":"controls_if","id":"/@/WRJ2|GZZ-xcnd|X-*","inputs":{"IF0":{"block":{"type":"pf_selfvar_get","id":"66$Of_z}fiI[Z.TV73v7","fields":{"NAME":"won"}}},"DO0":{"block":{"type":"pf_score_set","id":"z;oI{:+wDld7wqOiFO|I","inputs":{"VALUE":{"block":{"type":"math_number","id":"B2m1fV]:Rp)Hus)*,#xB","fields":{"NUM":0}}}},"next":{"block":{"type":"pf_restart","id":"%+.v-Zha[w.N,B7qsp[c"}}}}}}}}}]}};
const SCRIPT_FLAG = `on('overlap', 'Player', (other) => {
  if (!self.vars['won']) {
    self.vars['won'] = true;
    game.camera.flash(300);
    game.setText('win1', 'Bravo !', game.width / 2 - 48, 50);
    game.setText('win2', 'Score : ' + String(game.score), game.width / 2 - 48, 63);
    game.setText('win3', 'ENTREE = rejouer', game.width / 2 - 48, 76);
  }
});
on('keydown', 'ENTER', () => {
  if (self.vars['won']) {
    game.score = 0;
    game.restart();
  }
});
`;

// ---------- Assemblage ----------
export function createSampleProject() {
  const project = createEmptyProject('Exemple : plateforme');

  const mkSprite = (name, frames, animations, align) => {
    const s = createSprite(name, 16, 16);
    s.frames = frames.map((f) => frame(f, align));
    s.animations = animations;
    return s;
  };

  const tileset = mkSprite('Tileset', TILES, [{ name: 'idle', frames: [0], fps: 1, loop: true }]);
  const player = mkSprite('Player', PLAYER_FRAMES, [
    { name: 'idle', frames: [0, 1], fps: 3, loop: true },
    { name: 'run', frames: [2, 3, 4, 5], fps: 10, loop: true },
  ]);
  const coin = mkSprite('Coin', COIN_FRAMES, [{ name: 'spin', frames: [0, 1, 2, 3], fps: 8, loop: true }]);
  const slime = mkSprite('Slime', SLIME_FRAMES, [{ name: 'idle', frames: [0, 1], fps: 3, loop: true }], 'center');
  const flag = mkSprite('Flag', [FLAG_FRAME], [{ name: 'idle', frames: [0], fps: 1, loop: true }]);
  project.sprites = [tileset, player, coin, slime, flag];

  const mkObject = (name, sprite, anim, hitbox, physics, code, blocks = null) => {
    const o = createObject(name, sprite.id);
    o.defaultAnim = anim;
    o.hitbox = hitbox;
    Object.assign(o.physics, physics);
    o.script = blocks ? { mode: 'blocks', code, blocks } : { mode: 'code', code, blocks: null };
    return o;
  };
  const still = { gravity: false, immovable: true, collideMap: false, collideWorld: false };
  const oPlayer = mkObject('Player', player, 'idle', { x: 4, y: 1, w: 8, h: 15 }, { collideWorld: false }, SCRIPT_PLAYER);
  const oCoin = mkObject('Coin', coin, 'spin', { x: 3, y: 3, w: 10, h: 10 }, still, SCRIPT_COIN, BLOCKS_COIN);
  const oEnemy = mkObject('Enemy', slime, 'idle', { x: 1, y: 6, w: 14, h: 10 }, { immovable: true, collideWorld: false }, SCRIPT_ENEMY);
  const oFlag = mkObject('Flag', flag, 'idle', { x: 2, y: 0, w: 10, h: 16 }, still, SCRIPT_FLAG, BLOCKS_FLAG);
  project.objects = [oPlayer, oCoin, oEnemy, oFlag];

  // Niveau 1 : 60×12 tuiles
  const W = 60, H = 12;
  const map = createMap('Niveau 1', W, H, 16);
  map.tilesetSpriteId = tileset.id;
  map.background = '#41a6f6';
  const sol = map.layers[1].data;
  const put = (x, y, t) => { sol[y * W + x] = t; };
  const holes = new Set([18, 19, 32, 33, 34, 47, 48]);
  for (let x = 0; x < W; x++) {
    if (holes.has(x)) continue;
    put(x, 10, T.GRASS);
    put(x, 11, T.DIRT);
  }
  for (let y = 0; y < 10; y++) { put(0, y, T.WALL); put(W - 1, y, T.WALL); }
  for (const [x0, x1, y] of [[11, 13, 8], [22, 24, 8], [26, 28, 6], [38, 40, 8]]) {
    for (let x = x0; x <= x1; x++) put(x, y, T.WOOD);
  }
  put(41, 8, T.BRICK); put(41, 9, T.BRICK);
  put(52, 9, T.STONE); put(53, 9, T.STONE); put(53, 8, T.STONE);

  const entity = (obj, col, row) => ({ id: uid('ent'), objectId: obj.id, x: col * 16, y: row * 16 });
  map.entities = [
    entity(oPlayer, 2, 9),
    ...[[6, 9], [7, 8], [8, 9], [12, 7], [23, 7], [26, 5], [27, 5], [28, 5], [39, 7], [45, 9], [50, 9], [54, 7]].map(([c, r]) => entity(oCoin, c, r)),
    entity(oEnemy, 14, 9), entity(oEnemy, 27, 9), entity(oEnemy, 43, 9),
    entity(oFlag, 56, 9),
  ];

  project.maps = [map];
  project.settings.startMapId = map.id;
  project.settings.background = map.background;
  project.globalScript = { mode: 'code', code: SCRIPT_GLOBAL, blocks: null };
  return project;
}
