// «Monde 1-1» — un niveau plateforme complet dans l'esprit du premier niveau d'un célèbre jeu NES,
// avec des graphismes et du code 100 % originaux. Ce script GÉNÈRE le jeu games/monde-1-1.pixelforge.json
// avec la bibliothèque mcp/lib (les mêmes opérations que les outils MCP : upsertSprite, upsertObject,
// upsertMap, paintMap, placeEntities, addSound, setScript, validateProject).
//
//   node games-src/monde-1-1.mjs        (relançable : le jeu est recréé à chaque fois)
//
// Organisation du fichier : 1) palette et dessin des sprites  2) scripts des objets (en français)
// 3) plan du niveau  4) assemblage du projet.
import * as pf from '../mcp/lib/index.js';

// =====================================================================================================
// 1. PALETTE ET SPRITES
// =====================================================================================================
// Palette de 16 couleurs : les sprites s'écrivent avec les chiffres hexadécimaux 0-9 a-f.
const PALETTE = [
  '#1a1c2c', // 0 contour sombre
  '#5c94fc', // 1 ciel
  '#b84800', // 2 brique foncée
  '#e87820', // 3 orange
  '#fcc858', // 4 jaune
  '#009c28', // 5 vert
  '#58d858', // 6 vert clair
  '#005810', // 7 vert sombre
  '#ffffff', // 8 blanc
  '#bcd8fc', // 9 bleu nuage
  '#f8b880', // a peau
  '#3050d8', // b bleu salopette
  '#d82800', // c rouge
  '#6c3c10', // d brun
  '#a8a8a8', // e gris
  '#504038', // f gris foncé
];

// --- petits outils de dessin : une grille de caractères, remplie par une fonction (x, y) -> caractère ---
const mk = (w, h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const pad16 = (r) => { if (r.length > 16) throw new Error('rangée de sprite trop longue : ' + r); return r.padEnd(16, '.'); };
const rows16 = (list) => list.map(pad16);
const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

// --- Tuiles (16x16) ---
const sol = mk(16, 16, (x, y) => {
  if (y === 15 || x === 15) return 'd';           // ombre bas / droite
  if (y === 0 || x === 0) return '3';             // lumière haut / gauche
  return ((x * 7 + y * 5) % 13 === 0 || (x * 3 + y * 11) % 17 === 0) ? 'd' : '2';
});
const briques = (corps, clair, joint) => mk(16, 16, (x, y) => {
  if (y % 4 === 3) return joint;                  // joint horizontal
  const decal = (y >> 2) % 2 ? 4 : 0;
  if ((x + decal) % 8 === 7) return joint;        // joint vertical décalé une rangée sur deux
  return y % 4 === 0 ? clair : corps;
});
const brique = briques('2', '3', 'f');
const GLYPHE = ['..1111..', '.11..11.', '.11..11.', '....11..', '...11...', '...11...', '........', '...11...'];
const question = (fond, ombre) => mk(16, 16, (x, y) => {
  if (x === 0 || y === 0 || x === 15 || y === 15) return '0';
  if ((x === 2 || x === 13) && (y === 2 || y === 13)) return 'd';   // rivets
  const gx = x - 4, gy = y - 4;
  if (gx >= 0 && gx < 8 && gy >= 0 && gy < 8 && GLYPHE[gy][gx] === '1') return ombre;
  if (x === 1 || y === 1) return '8';                                // reflet
  return fond;
});
const videBloc = mk(16, 16, (x, y) => {
  if (x === 0 || y === 0 || x === 15 || y === 15) return '0';
  if ((x === 2 || x === 13) && (y === 2 || y === 13)) return '0';
  if (x === 1 || y === 1) return '3';
  return '2';
});
const pierre = mk(16, 16, (x, y) => {
  if (x === 15 || y === 15) return 'f';
  if (x === 0 || y === 0) return '8';
  return (x + y) % 11 === 0 ? 'f' : 'e';
});
// Tuyau : deux tuiles de large ; la collerette (haut) déborde du corps
const tuyau = (cote, haut) => mk(16, 16, (x, y) => {
  const collerette = haut && y < 8;
  const e0 = collerette ? 0 : 2, e1 = collerette ? 31 : 29;
  const gx = cote === 'G' ? x : 16 + x;
  if (gx < e0 || gx > e1) return '.';
  if (gx === e0 || gx === e1 || (collerette && (y === 0 || y === 7))) return '0';
  const u = gx - e0;
  if (u >= 2 && u <= 4) return '6';
  if (e1 - gx >= 2 && e1 - gx <= 5) return '7';
  return '5';
});
const invisible = mk(16, 16, () => '.');

// Colline : pente gauche / droite, sommet, remplissage (avec ou sans « yeux »)
const colG = mk(16, 16, (x, y) => (x === 15 - y ? '7' : x > 15 - y ? '6' : '.'));
const colD = mk(16, 16, (x, y) => (x === y ? '7' : x < y ? '6' : '.'));
const colHaut = mk(16, 16, (x, y) => (y === 0 ? '7' : '6'));
const colPlein = mk(16, 16, (x, y) => (x % 8 === 3 && y % 6 === 2 ? '5' : '6'));
const colYeux = mk(16, 16, (x, y) => ([4, 5, 10, 11].includes(x) && y >= 3 && y <= 6 ? '7' : '6'));

// Buisson : bosses rondes posées en bas de la tuile (le milieu se répète)
function buisson(cx, r, gauche, droite) {
  const dedans = (x, y) => {
    if (y >= 13) return !(gauche && x < 2) && !(droite && x > 13);
    return dist(x, y, cx, 13) <= r && !(gauche && x < 1) && !(droite && x > 14);
  };
  return mk(16, 16, (x, y) => {
    if (!dedans(x, y)) return '.';
    const bord = !dedans(x - 1, y) && x > 0 || !dedans(x + 1, y) && x < 15 || !dedans(x, y - 1) || (x === 0 && gauche) || (x === 15 && droite);
    if (bord && y < 15) return '7';
    if (y === 15) return '7';
    return (x + y) % 5 === 0 ? '6' : '5';
  });
}
const busG = buisson(9, 7.5, true, false), busM = buisson(7.5, 8, false, false), busD = buisson(6, 7.5, false, true);

// Nuage : 2 tuiles de haut (haut + bas), rond en haut, plat en bas
const nuageHaut = (cote) => mk(16, 16, (x, y) => {
  const cx = cote === 'M' ? 7.5 : cote === 'G' ? 9 : 6;
  const plat = cote === 'G' ? (x >= 8 && y >= 5) : cote === 'D' ? (x < 8 && y >= 5) : y >= 9;
  return dist(x, y, cx, 13) <= 8 || plat ? '8' : '.';
});
const nuageBas = (cote) => mk(16, 16, (x, y) => {
  if (y > 12) return '.';
  if (cote === 'G' && (x < 2 || (x < 4 && (y < 2 || y > 10)))) return '.';
  if (cote === 'D' && (x > 13 || (x > 11 && (y < 2 || y > 10)))) return '.';
  return y >= 11 ? '9' : '8';
});

// Château : murs de pierre, créneaux, fenêtre, porte voûtée
const mur = briques('e', '8', 'f');
const creneau = mk(16, 16, (x, y) => {
  if (y < 6) return (x < 4 || (x >= 8 && x < 12)) ? (y === 0 || x === 0 || x === 8 ? '8' : 'e') : '.';
  return mur[y][x];
});
const fenetre = mk(16, 16, (x, y) => ((x >= 5 && x <= 10 && y >= 4 && y <= 13) && !(y === 4 && (x === 5 || x === 10)) ? '0' : mur[y][x]));
const arche = mk(16, 16, (x, y) => {
  const dedans = (x >= 2 && x <= 13 && y >= 7) || dist(x, y, 7.5, 8) <= 5.8;
  return dedans ? '0' : mur[y][x];
});
const porte = mk(16, 16, (x, y) => (x >= 2 && x <= 13 ? '0' : mur[y][x]));

// Indices des tuiles dans le tileset (= numéro de frame) : le plan du niveau et les scripts s'y réfèrent
const TL = {
  SOL: 0, BRIQUE: 1, Q0: 2, Q1: 3, Q2: 4, VIDE: 5, PIERRE: 6, TUY_HG: 7, TUY_HD: 8, TUY_BG: 9, TUY_BD: 10, INVISIBLE: 11,
  COL_G: 12, COL_D: 13, COL_HAUT: 14, COL_PLEIN: 15, COL_YEUX: 16, BUS_G: 17, BUS_M: 18, BUS_D: 19,
  NUA_HG: 20, NUA_HM: 21, NUA_HD: 22, NUA_BG: 23, NUA_BM: 24, NUA_BD: 25,
  CH_CRENEAU: 26, CH_MUR: 27, CH_FENETRE: 28, CH_ARCHE: 29, CH_PORTE: 30,
};
const TILESET = [
  sol, brique, question('4', 'd'), question('3', '2'), question('d', '4'), videBloc, pierre,
  tuyau('G', true), tuyau('D', true), tuyau('G', false), tuyau('D', false), invisible,
  colG, colD, colHaut, colPlein, colYeux, busG, busM, busD,
  nuageHaut('G'), nuageHaut('M'), nuageHaut('D'), nuageBas('G'), nuageBas('M'), nuageBas('D'),
  creneau, mur, fenetre, arche, porte,
];

// --- Le Plombier : on écrit le petit (16x16) ; le grand (16x32) en est un étirement vertical ---
const TETE = ['....33333333', '...4444444444444', '...dddaaaa0aa', '..dadaaaaaaaaa', '..ddaaaa0000aa', '....aaaaaaaa'];
const TORSE = ['...88bbbbbbbb88', '..aa8b4bb4b8aa', '....bbbbbbbb', '....bbbbbbbb', '....bbbbbbbb'];
const JAMBES = {
  repos: ['....bbbb.bbbb', '....bbbb.bbbb', '....bbbb.bbbb', '...dddd...dddd', '..ddddd...ddddd'],
  pasA: ['....bbbbbbbb', '...bbbb..bbbb', '..bbbb....bbb', '..dddd.....dd', '.ddddd.....ddd'],
  pasB: ['....bbbbbbb', '....bbbbbb', '....bbbbb', '....ddddd', '...dddddd'],
  pasC: ['....bbbbbbbb', '.....bbb.bbbb', '....bbb...bbb', '...dddd....ddd', '...dddd....dddd'],
  saut: ['....bbbbbbbb', '...bbbb..bbbb', '..bbbb....bbbb', '..dddd.....ddd', '.ddddd.....dddd'],
  mort: ['....bbbbbbbb', '...bbbb..bbbb', '..bbbb....bbbb', '..dddd....dddd', '.ddddd....ddddd'],
};
const decale = (r) => r.slice(1);                 // décale une rangée d'un pixel vers la gauche (dérapage : buste penché)
const petit = (tete, torse, jambes) => rows16([...tete, ...torse, ...jambes]);
const PETIT = [
  petit(TETE, TORSE, JAMBES.repos),                                                                  // 0 repos
  petit(TETE, TORSE, JAMBES.pasA),                                                                   // 1 course 1
  petit(TETE, ['...88bbbbbbbb8a', '...a8b4bb4b8a', ...TORSE.slice(2)], JAMBES.pasB),                  // 2 course 2
  petit(TETE, TORSE, JAMBES.pasC),                                                                   // 3 course 3
  petit(TETE, ['...88bbbbbbbb88a', '..aa8b4bb4b8a', ...TORSE.slice(2)], JAMBES.saut),                 // 4 saut
  petit(TETE.map(decale), TORSE.map(decale), ['...bbbbbbbb', '...bbbbbbbb', '...bbbbbbbb', '...ddddddd', '..dddddddd']), // 5 dérapage
  petit(['....33333333', '...444444444444', '...dd0aaaa0add', '..dadaaaaaaaad', '....aa0000aa', '....aaaaaaaa'],
    ['..a88bbbbbb88a', '..a8bb4bb4bb8a', '....bbbbbbbb', '....bbbbbbbb', '....bbbbbbbb'], JAMBES.mort),    // 6 mort / glisse sur le mât
];
const PLAN_GRAND = [1, 1, 2, 2, 1, 1, 2, 3, 3, 2, 2, 3, 3, 2, 2, 2];    // 16 rangées -> 32 : 8 de tête, 12 de buste, 12 de jambes
const GRAND = PETIT.map((f) => f.flatMap((r, i) => Array(PLAN_GRAND[i]).fill(r)));

// --- Goomba (16x16) : champignon marron en colère ---
const G1 = rows16([
  '', '.....dddddd', '....dddddddd', '...dddddddddd', '..ddd00dd00ddd', '..dd88dddd88dd', '..dd80dddd08dd', '..dddddddddddd',
  '..ddddd00ddddd', '...dddddddddd', '....aaaaaaaa', '....aaaaaaaa', '....aaaaaaaa', '...aaaaaaaaaa', '..0000....0000', '.000000..000000',
]);
const G2 = [...G1.slice(0, 14), ...rows16(['....00000000', '...0000000000'])];
const GAPLAT = rows16([
  '', '', '', '', '', '', '', '', '', '', '....dddddddd', '..dddddddddddd', '.ddd8ddddd8dddd', '.dddddddddddddd', '..aaaaaaaaaaaa', '..000000000000',
]);

// --- Koopa (16x24) : tortue qui marche, regarde à gauche ---
const KOOPA_CORPS = [
  '', '....4444', '...444444', '...408444', '...44444444', '..0044444444', '....444444', '....44444.66', '....4444.666666', '...44444.656566',
  '...44444.665666', '...44444.656566', '...44444.665666', '....4444.666666', '....4444.666666', '....44444.7777', '....4444444444', '....4444444444',
];
const KOOPA = [
  rows16([...KOOPA_CORPS, '....444444444', '....444..4444', '...444...4444', '...444....444', '..0000....0000', '..00000...00000']),
  rows16([...KOOPA_CORPS, '....444444444', '....4444.444', '....4444.4444', '....444..444', '...0000..0000', '...00000.00000']),
];
// --- Carapace (16x16) : dôme vert + dessous jaune ---
const CARAPACE = mk(16, 16, (x, y) => {
  const dx = (x - 7.5) / 7.6, dy = (y - 9.5) / 7.2, d = dx * dx + dy * dy;
  if (y >= 13 && y <= 14 && x >= 2 && x <= 13) return y === 14 ? '4' : '3';
  if (y > 12 || d > 1) return '.';
  if (d > 0.72) return '7';
  return (y === 6 || x === 5 || x === 10) ? '5' : '6';
});
// --- Objets ramassables (frames : 0 champignon, 1-4 étoile, 5 champignon vert) ---
const champignon = (chapeau) => mk(16, 16, (x, y) => {
  const dx = (x - 7.5) / 7.5, dy = (y - 8.5) / 8, d = dx * dx + dy * dy;
  if (y <= 9 && d <= 1) {
    if (y === 9 || d > 0.8) return '0';
    if (dist(x, y, 4, 5) <= 2 || dist(x, y, 11, 5) <= 2 || dist(x, y, 7.5, 2.5) <= 1.5) return '8';
    return chapeau;
  }
  if (y >= 10 && x >= 3 && x <= 12) {
    if (x === 3 || x === 12 || y === 15) return '0';
    if ((y === 11 || y === 12) && (x === 6 || x === 9)) return '0';
    return 'a';
  }
  return '.';
});
function etoile(fond) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.8 : 8;
    pts.push([7.5 + r * Math.cos(a), 8.5 + r * Math.sin(a)]);
  }
  const dedans = (px, py) => {
    let in_ = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) in_ = !in_;
    }
    return in_;
  };
  return mk(16, 16, (x, y) => {
    if (!dedans(x + 0.5, y + 0.5)) return '.';
    if (!dedans(x - 0.5, y + 0.5) || !dedans(x + 1.5, y + 0.5) || !dedans(x + 0.5, y - 0.5) || !dedans(x + 0.5, y + 1.5)) return '0';
    if ((x === 6 || x === 9) && (y === 8 || y === 9)) return '0';
    return fond;
  });
}
const OBJETS = [champignon('3'), etoile('4'), etoile('3'), etoile('8'), etoile('4'), champignon('6')];
// --- Pièce qui tourne (4 phases) ---
const piece = (rx) => mk(16, 16, (x, y) => {
  const dx = (x + 0.5 - 8) / rx, dy = (y + 0.5 - 8) / 6.5, d = dx * dx + dy * dy;
  return d > 1 ? '.' : d > 0.5 ? '3' : dx < -0.2 && dy < -0.2 ? '8' : '4';
});
// --- Morceaux de brique (8x8), blocs « qui sautent » (brique / ? / vide), cadavres, mât, drapeau, rideau noir ---
const DEBRIS = [mk(8, 8, (x, y) => (x === 7 || y === 7 ? 'f' : y < 3 ? '3' : '2')), mk(8, 8, (x, y) => (x === 0 || y === 0 ? 'f' : y > 4 ? '3' : '2'))];
const BLOCS_BUMP = [brique, question('4', 'd'), videBloc];
const hautGauche = (frame, h = 24) => [...Array(h - frame.length).fill('.'.repeat(16)), ...frame];
const CADAVRES = [hautGauche(G1), hautGauche(KOOPA[0]), hautGauche(CARAPACE)];
const MAT = mk(16, 160, (x, y) => {
  if (dist(x, y, 8, 4) <= 4) return dist(x, y, 7, 3) <= 1.5 ? '8' : '4';
  if (y < 8) return '.';
  return x === 7 ? '8' : x === 8 ? 'e' : '.';
});
const DRAPEAU = mk(16, 16, (x, y) => {
  const demi = (7 * (x + 1)) / 16;
  if (Math.abs(y - 7.5) > demi + 0.5) return '.';
  if (dist(x, y, 10, 7.5) <= 2.6) return '5';
  return Math.abs(y - 7.5) > demi - 1 ? '9' : '8';
});
const RIDEAU = mk(256, 240, () => 'K');   // noir pur (lettre K déclarée dans la légende du sprite)
const VIDE16 = mk(16, 16, () => '.');

// =====================================================================================================
// 2. SCRIPTS (mode 'code', commentés en français)
// =====================================================================================================
const T_JS = 'const T = ' + JSON.stringify({ SOL: TL.SOL, BRIQUE: TL.BRIQUE, Q0: TL.Q0, VIDE: TL.VIDE, PIERRE: TL.PIERRE, INVISIBLE: TL.INVISIBLE }) + ';';

// ----- Plan des blocs : [x, y, type ('?' bloc point d'interrogation, 'b' brique), contenu] -----
// contenus : piece, champi (champignon : fait grandir), etoile (invincibilité), multi (brique à 10 pièces)
const BLOCS = [
  [16, 9, '?', 'piece'],
  [20, 9, 'b'], [21, 9, '?', 'champi'], [22, 9, 'b'], [23, 9, '?', 'piece'], [24, 9, 'b'], [22, 5, '?', 'piece'],
  [77, 9, 'b'], [78, 9, '?', 'champi'], [79, 9, 'b'],
  ...[80, 81, 82, 83, 84, 85, 86, 87].map((x) => [x, 5, 'b']),
  [91, 5, 'b'], [92, 5, 'b'], [93, 5, 'b'], [94, 5, '?', 'piece'], [94, 9, 'b', 'multi'],
  [100, 9, 'b'], [101, 9, 'b', 'etoile'],
  [106, 9, '?', 'piece'], [109, 9, '?', 'champi'], [112, 9, '?', 'piece'], [109, 5, '?', 'piece'],
  [118, 9, 'b'], [121, 5, 'b'], [122, 5, 'b'], [123, 5, 'b'],
  [128, 5, 'b'], [129, 5, '?', 'piece'], [130, 5, '?', 'piece'], [131, 5, 'b'], [129, 9, 'b'], [130, 9, 'b'],
  [168, 9, 'b'], [169, 9, '?', 'piece'], [170, 9, 'b'],
];
const CACHES = [[64, 9, 'vie'], [125, 9, 'piece']];   // blocs invisibles (n'apparaissent que frappés par en dessous)
const CONTENUS = {};
for (const [x, y, , c] of BLOCS) if (c) CONTENUS[x + ',' + y] = c;
const CASES_Q = BLOCS.filter((b) => b[2] === '?').map((b) => [b[0], b[1]]);

// ----- Script global : les règles du jeu (états, HUD, blocs, mort, fin de niveau) -----
const GLOBAL = `// ===== Script global : règles du jeu «Monde 1-1» =====
// Il tourne une fois au démarrage de la carte (self vaut null). Les fonctions partagées par plusieurs
// objets sont rangées dans game.vars (V) : les objets les appellent par exemple V.points(...).
// État du jeu : V.etat = 'jeu' | 'drapeau' | 'chateau' | 'bonus' | 'fin' | 'mort' | 'perdu'.
const V = game.vars;
${T_JS}
const CONTENUS = ${JSON.stringify(CONTENUS)};    // contenu des blocs, clé «x,y» en tuiles
const CASES_Q = ${JSON.stringify(CASES_Q)};      // positions des blocs « ? » (pour les faire clignoter)
const MAT_X = 198 * 16 + 8;                       // x du centre du mât, en pixels
const SOL_MAT = 12 * 16;                          // y du haut du bloc de base du mât

// ---------- Initialisation (la partie complète garde score / pièces / vies entre les vies) ----------
if (V.vies === undefined) { V.vies = 3; V.pieces = 0; game.score = 0; }
V.temps = 400;        // compte à rebours (1 unité = 0,4 s)
V.etat = 'jeu';
V.grand = false;      // le héros est-il grand ?
V.inv = 0;            // invincibilité après un coup (ms)
V.etoile = 0;         // invincibilité de l'étoile (ms)
V.chaine = 0;         // enchaînement d'écrasements sans toucher le sol
V.multi = {};         // coups restants des briques à pièces
V.intro = true;       // écran d'introduction du niveau

const zero = (n, l) => { let s = String(Math.max(0, Math.floor(n))); while (s.length < l) s = '0' + s; return s; };
V.joueur = () => game.find('PlombierGrand') || game.find('Plombier');

// ---------- Affichage tête haute (style NES) ----------
const TXT = { size: 0.62, color: '#ffffff' };
V.hud = () => {
  game.setText('h1', 'PLOMBIER', 16, 6, TXT);   game.setText('h2', zero(game.score, 6), 16, 17, TXT);
  game.setText('h3', 'PIECES', 82, 6, TXT);     game.setText('h4', 'x' + zero(V.pieces, 2), 82, 17, TXT);
  game.setText('h5', 'VIES', 132, 6, TXT);      game.setText('h6', 'x' + V.vies, 132, 17, TXT);
  game.setText('h7', 'MONDE', 170, 6, TXT);     game.setText('h8', '1-1', 174, 17, TXT);
  game.setText('h9', 'TEMPS', 214, 6, TXT);     game.setText('h10', zero(V.temps, 3), 218, 17, TXT);
};
on('update', () => V.hud());

// ---------- Points, pièces, vies ----------
V.popup = (texte, x, y) => game.spawn('Points', x, y, { texte: texte });
V.points = (n, x, y) => { game.score += n; V.popup(String(n), x, y); };
const CHAINE = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
V.pointsChaine = (x, y) => {                     // 1er ennemi écrasé 100, puis 200, 400... puis une vie
  const i = V.chaine++;
  if (i >= CHAINE.length) { V.gagnerVie(); V.popup('1UP', x, y); } else V.points(CHAINE[i], x, y);
};
V.gagnerVie = () => { V.vies += 1; game.playSound('vie'); };
V.piece = () => {
  V.pieces += 1;
  game.score += 200;
  if (V.pieces >= 100) { V.pieces -= 100; V.gagnerVie(); }
};
V.rebond = (p) => {                               // rebond du héros sur un ennemi écrasé (plus haut si on garde le saut appuyé)
  const tenu = input.isDown('SPACE') || input.isDown('Z') || input.isDown('UP') || input.isDown('W');
  p.vy = tenu ? -320 : -210;
};

// ---------- Ennemis tués : ils basculent et tombent hors de l'écran ----------
V.cadavre = (e, quoi, dir) => {
  e.vars.mort = true;
  game.spawn('Cadavre', e.x, e.y + e.height - 24, { quoi: quoi, dir: dir });
  e.destroy();
};

// ---------- Blocs : coup de tête sous une tuile ----------
V.frapper = (t, grand) => {
  const contenu = CONTENUS[t.tx + ',' + t.ty];
  if (t.index === T.BRIQUE) {
    if (contenu === 'multi') {                    // brique à pièces : une pièce par coup
      const reste = (V.multi[t.tx + ',' + t.ty] === undefined ? 10 : V.multi[t.tx + ',' + t.ty]) - 1;
      V.multi[t.tx + ',' + t.ty] = reste;
      V.donner(t, 'piece');
      V.secouer(t, 'brique', reste > 0 ? 'brique' : 'vide');
    } else if (contenu) {                         // brique avec surprise : se vide comme un bloc « ? »
      V.donner(t, contenu);
      V.secouer(t, 'brique', 'vide');
    } else if (grand) {                           // grand : la brique éclate
      V.casser(t);
    } else {                                      // petit : la brique bouge seulement
      game.playSound('bump');
      V.secouer(t, 'brique', 'brique');
    }
  } else if (t.index >= T.Q0 && t.index <= T.Q0 + 2) {
    V.donner(t, contenu || 'piece');
    V.secouer(t, 'question', 'vide');
  }
};
// Sort le contenu d'un bloc
V.donner = (t, contenu) => {
  if (contenu === 'piece') {
    V.piece();
    game.playSound('piece');
    game.spawn('PieceBloc', t.x, t.y - 16);
  } else {
    game.playSound('apparition');
    game.spawn('Emergence', t.x, t.y, { quoi: contenu });
  }
};
// Animation du bloc frappé. Pendant ce temps la tuile est remplacée par une tuile invisible mais SOLIDE ;
// le BlocBump rend ensuite la brique, ou affiche le bloc vide sur le calque «Devant» (la solidité reste dans «Sol»).
V.secouer = (t, cadre, final) => {
  game.setTile(t.tx, t.ty, T.INVISIBLE, 'Sol');
  game.spawn('BlocBump', t.x, t.y, { tx: t.tx, ty: t.ty, cadre: cadre, final: final });
  V.retourner(t);
};
// Les ennemis posés sur le bloc frappé sont renversés
V.retourner = (t) => {
  for (const nom of ['Goomba', 'Koopa']) {
    for (const e of game.findAll(nom)) {
      if (e.vars.mort) continue;
      if (Math.abs(e.centerX - (t.x + 8)) < 14 && Math.abs((e.y + e.height) - t.y) < 6) {
        V.points(100, e.x, e.y - 8);
        V.cadavre(e, nom === 'Goomba' ? 'goomba' : 'koopa', e.centerX < t.x + 8 ? -1 : 1);
      }
    }
  }
};
V.casser = (t) => {                               // brique cassée : 4 morceaux + 50 points
  game.setTile(t.tx, t.ty, -1, 'Sol');
  game.playSound('brique');
  game.score += 50;
  for (const [dx, dy, vx, vy] of [[0, 0, -70, -280], [8, 0, 70, -280], [0, 8, -45, -190], [8, 8, 45, -190]]) {
    game.spawn('Debris', t.x + dx, t.y + dy, { vx: vx, vy: vy });
  }
  V.retourner(t);
};
// Bloc invisible révélé par le héros
V.revele = (tx, ty, contenu) => {
  const t = { tx: tx, ty: ty, x: tx * 16, y: ty * 16 };
  V.donner(t, contenu);
  V.secouer(t, 'vide', 'vide');
};
// Les blocs « ? » clignotent (cycle de 3 tuiles)
const CYCLE = [0, 0, 0, 1, 2, 1];
let phase = 0;
on('timer', 130, () => {
  phase = (phase + 1) % CYCLE.length;
  for (const [x, y] of CASES_Q) {
    const i = game.getTile(x, y, 'Sol');
    if (i >= T.Q0 && i <= T.Q0 + 2) game.setTile(x, y, T.Q0 + CYCLE[phase], 'Sol');
  }
});

// ---------- Le héros change de taille : on remplace l'objet par l'autre version ----------
V.echanger = (p, nom, dy) => {
  const n = game.spawn(nom, p.x, p.y + dy);
  n.vx = p.vx; n.vy = p.vy; n.flipX = p.flipX;
  p.destroy();
  return n;
};
V.devenirGrand = (p) => {
  if (V.grand) { V.points(1000, p.x, p.y - 8); return; }
  V.grand = true;
  game.playSound('champignon');
  const g = V.echanger(p, 'PlombierGrand', -16);
  V.inv = 800;                                    // clignote un instant
  V.points(1000, g.x, g.y - 8);
};
V.rapetisser = (p) => {
  V.grand = false;
  game.playSound('tuyau');
  V.echanger(p, 'Plombier', 16);
  V.inv = 2000;                                   // invincible 2 s en clignotant
};
// Un ennemi touche le héros (sans qu'il l'écrase)
V.toucher = (p) => {
  if (V.etat !== 'jeu' || V.intro || V.inv > 0) return;
  if (V.grand) V.rapetisser(p); else V.mourir(p);
};

// ---------- Mort, vies, fin de partie ----------
V.mourir = (p) => {
  if (V.etat !== 'jeu' || !p) return;
  V.etat = 'mort';
  game.playSound('mort');
  if (p.y < game.mapHeight) game.spawn('MortPlombier', p.x, p.y);   // petit saut de la mort (pas si on est tombé dans un trou)
  p.destroy();
  game.wait(2800, () => V.finDeVie());
};
V.finDeVie = () => {
  V.vies -= 1;
  if (V.vies > 0) { game.restart(); return; }       // il reste des vies : on recommence le niveau
  V.etat = 'perdu';                                 // plus de vies : écran de fin puis nouvelle partie
  game.spawn('Rideau', game.camera.x, 0);
  game.setText('fin1', 'FIN DE PARTIE', 128, 100, { align: 'center', size: 1, color: '#ffffff' });
  game.setText('fin2', 'SCORE ' + zero(game.score, 6), 128, 126, { align: 'center', size: 0.7, color: '#fcc858' });
  game.wait(3500, () => { V.nouvellePartie(); game.restart(); });
};
V.nouvellePartie = () => { V.vies = 3; V.pieces = 0; game.score = 0; };

// Compte à rebours : si le temps tombe à 0, le héros meurt
on('timer', 400, () => {
  if (V.etat !== 'jeu' || V.intro) return;
  V.temps -= 1;
  if (V.temps <= 0) { V.temps = 0; V.mourir(V.joueur()); }
});

// ---------- Écran d'introduction ----------
const rideau = game.spawn('Rideau', 0, 0);
game.setText('i1', 'MONDE 1-1', 128, 84, { align: 'center', size: 1, color: '#ffffff' });
game.setText('i2', 'PLOMBIER   x  ' + V.vies, 128, 118, { align: 'center', size: 0.8, color: '#ffffff' });
game.wait(2200, () => { V.intro = false; rideau.destroy(); game.removeText('i1'); game.removeText('i2'); });

// ---------- La caméra suit un « fantôme » qui n'avance jamais en arrière (comme sur NES) ----------
game.camera.follow(game.spawn('Camera', 0, 112));

// ---------- Fin du niveau : mât, glissade, château, bonus de temps ----------
V.drapeau = (p) => {
  if (V.etat !== 'jeu') return;
  V.etat = 'drapeau';
  const haut = SOL_MAT - (p.y + p.height);        // hauteur de la prise au-dessus du pied du mât
  const pts = haut >= 128 ? 5000 : haut >= 96 ? 2000 : haut >= 64 ? 800 : haut >= 32 ? 400 : 100;
  game.playSound('drapeau');
  V.points(pts, MAT_X + 8, p.y - 8);
  p.setGravity(false); p.vx = 0; p.vy = 0;
  p.x = MAT_X - 14; p.flipX = false; p.play('glisse');
  const duree = Math.max(400, (SOL_MAT - (p.y + p.height)) * 10);   // 100 px/s
  p.tweenTo({ y: SOL_MAT - p.height }, duree);
  const drap = game.find('Drapeau');
  if (drap) drap.tweenTo({ y: SOL_MAT - 20 }, duree);
  game.wait(duree + 450, () => {                  // le héros passe de l'autre côté du mât puis marche vers le château
    p.x = MAT_X - 2; p.flipX = true;
    p.setGravity(true);
    game.wait(350, () => { V.etat = 'chateau'; });
  });
};
V.entrerChateau = () => {                          // le temps restant est converti en points (50 par unité)
  const tick = () => {
    if (V.temps > 0) {
      const n = Math.min(V.temps, 5);
      V.temps -= n; game.score += 50 * n;
      game.playSound('blip', 0.3, 1.5);
      game.wait(40, tick);
    } else V.feux();
  };
  game.wait(500, tick);
};
V.feux = () => {                                   // petit feu d'artifice au-dessus du château
  [[3240, 90], [3300, 70], [3268, 50]].forEach(([x, y], i) => {
    game.wait(i * 450, () => {
      game.particles(x, y, '#fcc858', 30, 120, 700);
      game.particles(x, y, '#ffffff', 16, 80, 600);
      game.playSound('explosion', 0.5, 1.6);
      game.score += 500;
    });
  });
  game.wait(1900, () => V.victoire());
};
V.victoire = () => {
  V.etat = 'fin';
  game.playSound('victoire');
  game.setText('v1', 'BRAVO !', 128, 34, { align: 'center', size: 1.5, color: '#fcc858' });
  game.setText('v2', 'MONDE 1-1 TERMINÉ', 128, 68, { align: 'center', size: 0.9, color: '#ffffff' });
  game.setText('v3', 'SCORE ' + zero(game.score, 6), 128, 92, { align: 'center', size: 0.8, color: '#ffffff' });
  game.setText('v4', 'ENTRÉE : REJOUER', 128, 110, { align: 'center', size: 0.7, color: '#ffffff' });
};
on('keydown', 'ENTER', () => {
  if (V.etat === 'fin') { V.nouvellePartie(); game.restart(); }
});
`;

// ----- Héros : le même script pour la version petite et la version grande -----
const heroScript = (grand) => `// ===== Plombier (${grand ? 'grand, 16x32' : 'petit, 16x16'}) =====
// Les deux versions du héros partagent ce script : seule la constante GRAND change. Quand il grandit ou
// rétrécit, on remplace l'objet par l'autre version (game.vars.devenirGrand / rapetisser, script global).
// Commandes : GAUCHE/DROITE (ou Q/D), SAUT = ESPACE / Z / HAUT, COURSE = SHIFT / X.
const GRAND = ${grand};
const V = game.vars;

// --- Réglages de mouvement (px/s et px/s²) ---
const MARCHE = 94;        // vitesse max en marchant
const COURSE = 158;       // vitesse max en courant
const ACCEL = 270;        // accélération au sol
const ACCEL_AIR = 230;    // accélération en l'air
const FREIN = 270;        // ralentissement quand on lâche la direction
const DERAPE = 620;       // freinage quand on inverse la direction (dérapage)
const SAUT = 362;         // vitesse de départ du saut
const COUPE_SAUT = 1000;  // gravité ajoutée si on lâche le bouton en montant : saut plus court
const GRAV_CHUTE = 450;   // gravité ajoutée pendant la chute : retombée plus ferme
const VMAX_CHUTE = 420;   // vitesse de chute maximale
const PORTE_X = 3262;     // x à partir duquel le héros « entre » dans le château
const TEINTES = ['#ffff80', '#80ff80', '#ff8080', '#80c0ff'];

let tamponSaut = 0;       // mémorise un appui sur saut juste avant l'atterrissage

on('create', () => { self.depth = 100; });

// Frapper un bloc avec la tête : tout est géré par game.vars.frapper (script global)
on('hitTile', (t) => {
  if (t.side === 'up' && V.etat === 'jeu') V.frapper(t, GRAND);
});

on('update', (dt) => {
  // --- Séquences spéciales ---
  if (V.etat === 'drapeau') return;                 // glissade sur le mât : pilotée par game.vars.drapeau
  if (V.etat === 'chateau') {                       // marche toute seule jusqu'à la porte du château
    self.vx = 66; self.flipX = false; self.play('marche');
    if (self.x > PORTE_X) { self.visible = false; self.vx = 0; self.setGravity(false); self.vy = 0; V.etat = 'bonus'; V.entrerChateau(); }
    return;
  }
  if (V.etat !== 'jeu' || V.intro) { self.vx = 0; self.play('repos'); return; }

  // --- Commandes ---
  const gauche = input.isDown('LEFT') || input.isDown('Q') || input.isDown('A');
  const droite = input.isDown('RIGHT') || input.isDown('D');
  const dir = (droite ? 1 : 0) - (gauche ? 1 : 0);
  const court = input.isDown('SHIFT') || input.isDown('X');
  const saut = input.isDown('SPACE') || input.isDown('Z') || input.isDown('UP') || input.isDown('W');
  const sautPresse = input.justPressed('SPACE') || input.justPressed('Z') || input.justPressed('UP') || input.justPressed('W');
  const auSol = self.onGround;

  // --- Horizontal : accélération progressive, inertie, dérapage ---
  const vmax = court ? COURSE : MARCHE;
  let derape = false;
  if (dir !== 0) {
    if (self.vx * dir < -12 && auSol) {             // on veut repartir dans l'autre sens : on dérape
      self.vx += dir * DERAPE * dt;
      derape = true;
    } else if (self.vx * dir < vmax) {              // on accélère jusqu'à la vitesse voulue
      self.vx += dir * (auSol ? ACCEL : ACCEL_AIR) * dt;
      if (self.vx * dir > vmax) self.vx = dir * vmax;
    } else if (auSol) {                             // plus vite que permis (course relâchée) : on ralentit
      self.vx -= dir * FREIN * dt;
      if (self.vx * dir < vmax) self.vx = dir * vmax;
    }
  } else if (auSol) {                               // aucune direction : on glisse jusqu'à l'arrêt
    const f = FREIN * dt;
    self.vx = Math.abs(self.vx) <= f ? 0 : self.vx - Math.sign(self.vx) * f;
  }

  // --- Saut (avec un petit tampon) ; il est plus haut quand on court ---
  tamponSaut = sautPresse ? 0.1 : tamponSaut - dt;
  if (tamponSaut > 0 && auSol) {
    self.jump(SAUT + Math.abs(self.vx) * 0.14);
    tamponSaut = 0;
    game.playSound('saut');
  }
  if (self.vy < 0 && !saut) self.vy += COUPE_SAUT * dt;   // bouton relâché en montant : saut plus court
  if (self.vy > 0) {                                      // retombée plus ferme qu'à la montée
    self.vy += GRAV_CHUTE * dt;
    if (self.vy > VMAX_CHUTE) self.vy = VMAX_CHUTE;
  }
  if (auSol) V.chaine = 0;                                // le compteur d'écrasements repart à zéro au sol

  // --- La caméra ne revient pas en arrière : on ne peut pas quitter l'écran par la gauche ---
  if (self.x < game.camera.x - 3) { self.x = game.camera.x - 3; if (self.vx < 0) self.vx = 0; }

  // --- Animation ---
  if (dir !== 0 && !derape) self.flipX = dir < 0;
  if (!auSol) self.play('saut');
  else if (derape) self.play('derapage');
  else if (Math.abs(self.vx) > 6) self.play(Math.abs(self.vx) > MARCHE + 10 ? 'course' : 'marche');
  else self.play('repos');

  // --- Invincibilité (après un coup) et étoile ---
  if (V.inv > 0) {
    V.inv -= dt * 1000;
    self.visible = V.inv <= 0 || Math.floor(V.inv / 70) % 2 === 0;
  }
  if (V.etoile > 0) {
    V.etoile -= dt * 1000;
    self.tint = V.etoile > 0 ? TEINTES[Math.floor(V.etoile / 55) % 4] : null;
  }

  // --- Tombé dans un trou ---
  if (self.y > game.mapHeight + 8) V.mourir(self);
});
`;

const mortScript = `// Animation de mort : le héros reste figé, saute, puis tombe hors de l'écran.
on('create', () => {
  self.depth = 800;
  game.wait(450, () => {
    self.tweenTo({ y: self.y - 56 }, 320);
    game.wait(330, () => self.tweenTo({ y: game.mapHeight + 40 }, 750));
  });
});
`;

const goombaScript = `// ===== Goomba : marche, change de sens contre un mur ou un autre ennemi, s'écrase quand on lui saute dessus =====
const V = game.vars;
const VITESSE = 32;
let dir = -1;
let actif = false;       // il ne bouge qu'une fois arrivé près de l'écran

on('update', () => {
  if (self.vars.mort) return;
  if (!actif) {
    if (self.x < game.camera.x + game.width + 16) actif = true; else return;
  }
  if (self.blocked.left) dir = 1; else if (self.blocked.right) dir = -1;
  self.vx = dir * VITESSE;
  if (self.y > game.mapHeight + 16 || self.x < game.camera.x - 90) self.destroy();
});
on('collide', 'Goomba', () => { dir = -dir; });
on('collide', 'Koopa', () => { dir = -dir; });

const rencontre = (p) => {
  if (self.vars.mort) return;
  if (V.etoile > 0) {                                // héros invincible : l'ennemi est balayé
    V.points(100, self.x, self.y - 8);
    game.playSound('coup');
    V.cadavre(self, 'goomba', p.vx >= 0 ? 1 : -1);
    return;
  }
  // « écrasé » = le héros tombe et ses pieds sont au niveau du haut du Goomba (le haut de son corps est à y + 3)
  const dessus = p.vy > 0 && (p.y + p.height) - (self.y + 3) < 10;
  if (dessus) {
    self.vars.mort = true;
    self.vx = 0;
    self.play('ecrase');
    V.rebond(p);
    V.pointsChaine(self.x, self.y - 8);
    game.playSound('ecrase');
    game.wait(400, () => self.destroy());
  } else {
    V.toucher(p);
  }
};
on('overlap', 'Plombier', rencontre);
on('overlap', 'PlombierGrand', rencontre);
`;

const koopaScript = `// ===== Koopa : tortue qui marche ; écrasée, elle devient une carapace =====
const V = game.vars;
const VITESSE = 32;
let dir = -1;
let actif = false;

on('update', () => {
  if (self.vars.mort) return;
  if (!actif) {
    if (self.x < game.camera.x + game.width + 16) actif = true; else return;
  }
  if (self.blocked.left) dir = 1; else if (self.blocked.right) dir = -1;
  self.vx = dir * VITESSE;
  self.flipX = dir > 0;                               // le sprite regarde à gauche par défaut
  if (self.y > game.mapHeight + 16 || self.x < game.camera.x - 90) self.destroy();
});
on('collide', 'Goomba', () => { dir = -dir; });
on('collide', 'Koopa', () => { dir = -dir; });

const rencontre = (p) => {
  if (self.vars.mort) return;
  if (V.etoile > 0) {
    V.points(200, self.x, self.y - 8);
    game.playSound('coup');
    V.cadavre(self, 'koopa', p.vx >= 0 ? 1 : -1);
    return;
  }
  const dessus = p.vy > 0 && (p.y + p.height) - (self.y + 8) < 10;   // le haut du corps est à y + 8
  if (dessus) {
    self.vars.mort = true;
    V.rebond(p);
    V.pointsChaine(self.x, self.y);
    game.playSound('ecrase');
    game.spawn('Carapace', self.x, self.y + 8);       // la carapace prend sa place
    self.destroy();
  } else {
    V.toucher(p);
  }
};
on('overlap', 'Plombier', rencontre);
on('overlap', 'PlombierGrand', rencontre);
`;

const carapaceScript = `// ===== Carapace : immobile jusqu'au premier coup ; glisse ensuite, rebondit sur les murs et tue les ennemis =====
const V = game.vars;
const VITESSE = 210;
let dir = 0;               // 0 = immobile, sinon -1 / +1
let delai = 0.35;          // petite immunité après sa création ou un coup de pied (s)

on('update', (dt) => {
  if (delai > 0) delai -= dt;
  if (dir < 0 && self.blocked.left) dir = 1; else if (dir > 0 && self.blocked.right) dir = -1;
  self.vx = dir * VITESSE;
  if (self.y > game.mapHeight + 16 || self.x < game.camera.x - 200) self.destroy();
});

const rencontre = (p) => {
  if (delai > 0) return;
  const dessus = p.vy > 0 && (p.y + p.height) - (self.y + 3) < 10;
  if (dir === 0) {                                    // immobile : un coup la lance, dans le sens opposé au héros
    dir = (p.x + p.width / 2) < (self.x + 8) ? 1 : -1;
    delai = 0.25;
    game.playSound('coup');
    V.points(400, self.x, self.y - 8);
    if (dessus) V.rebond(p);
  } else if (dessus) {                                // glisse : on l'arrête en sautant dessus
    dir = 0;
    delai = 0.25;
    V.rebond(p);
    game.playSound('ecrase');
    V.points(400, self.x, self.y - 8);
  } else {
    V.toucher(p);
  }
};
on('overlap', 'Plombier', rencontre);
on('overlap', 'PlombierGrand', rencontre);

// Quand elle glisse, elle emporte les ennemis
const emporte = (e) => {
  if (dir === 0 || e.vars.mort) return;
  game.playSound('coup');
  V.points(500, e.x, e.y - 8);
  V.cadavre(e, e.name === 'Koopa' ? 'koopa' : 'goomba', dir);
};
on('overlap', 'Goomba', emporte);
on('overlap', 'Koopa', emporte);
`;

const champignonScript = `// ===== Champignon : marche, tombe, fait grandir (la version verte donne une vie) =====
const V = game.vars;
const VITESSE = 62;
let dir = 1;

on('create', () => { if (self.props.vie) self.play('vie'); });
on('update', () => {
  if (self.blocked.right) dir = -1; else if (self.blocked.left) dir = 1;
  self.vx = dir * VITESSE;
  if (self.y > game.mapHeight + 16 || self.x < game.camera.x - 100) self.destroy();
});
const pris = (p) => {
  self.destroy();
  if (self.props.vie) { V.gagnerVie(); V.popup('1UP', self.x, self.y - 8); }
  else V.devenirGrand(p);
};
on('overlap', 'Plombier', pris);
on('overlap', 'PlombierGrand', pris);
`;

const etoileScript = `// ===== Étoile : rebondit en avançant ; 10 secondes d'invincibilité =====
const V = game.vars;
let dir = 1;

on('update', () => {
  if (self.blocked.right) dir = -1; else if (self.blocked.left) dir = 1;
  self.vx = dir * 70;
  if (self.onGround) self.vy = -230;                  // rebond permanent
  if (self.y > game.mapHeight + 16 || self.x < game.camera.x - 100) self.destroy();
});
const prise = (p) => {
  self.destroy();
  V.etoile = 10000;
  game.playSound('champignon');
  V.points(1000, self.x, self.y - 8);
};
on('overlap', 'Plombier', prise);
on('overlap', 'PlombierGrand', prise);
`;

const emergenceScript = `// ===== Émergence : l'objet sort lentement du bloc (sans collision), puis laisse la place à l'objet réel =====
// props.quoi : 'champi' | 'vie' (champignon vert) | 'etoile'
const quoi = self.props.quoi;
on('create', () => {
  self.play(quoi === 'vie' ? 'vie' : quoi === 'etoile' ? 'etoile' : 'champi');
  self.tweenTo({ y: self.y - 16 }, 450);
  game.wait(470, () => {
    if (quoi === 'etoile') game.spawn('Etoile', self.x, self.y);
    else game.spawn('Champignon', self.x, self.y, { vie: quoi === 'vie' });
    self.destroy();
  });
});
`;

const pieceBlocScript = `// ===== Pièce sortie d'un bloc : saute en tournant puis disparaît en affichant 200 =====
const V = game.vars;
const y0 = self.y;
on('create', () => { self.play('tourne'); self.vy = -340; });
on('update', () => {
  if (self.vy > 0 && self.y >= y0 - 4) { V.popup('200', self.x, self.y); self.destroy(); }
});
`;

const debrisScript = `// ===== Morceau de brique : projeté vers le haut, tourne en tombant =====
on('create', () => { self.vx = self.props.vx; self.vy = self.props.vy; });
on('update', (dt) => {
  self.angle += 540 * dt;
  if (self.y > game.mapHeight + 20) self.destroy();
});
`;

const blocBumpScript = `// ===== Bloc frappé : monte puis redescend (80 ms chacun), puis prend son état final =====
// props : tx, ty (tuile), cadre ('brique' | 'question' | 'vide'), final ('brique' = on remet la brique, 'vide' = bloc vide)
${T_JS}
const p = self.props;
on('create', () => {
  self.play(p.cadre);
  self.depth = 120;
  self.tweenTo({ y: self.y - 7 }, 80);
  game.wait(80, () => self.tweenTo({ y: self.y + 7 }, 80));
  game.wait(170, () => {
    if (p.final === 'vide') game.setTile(p.tx, p.ty, T.VIDE, 'Devant');   // affiché devant ; la tuile solide invisible reste dans «Sol»
    else game.setTile(p.tx, p.ty, T.BRIQUE, 'Sol');
    self.destroy();
  });
});
`;

const blocCacheScript = `// ===== Bloc caché : invisible, n'apparaît que si le héros le frappe par en dessous =====
// props.contenu : 'vie' (champignon vert), 'piece', ...
const V = game.vars;
const TX = game.toTile(self.x + 1);
const TY = game.toTile(self.y + 1);
let fait = false;
const frappe = (p) => {
  if (fait || V.etat !== 'jeu') return;
  if (p.vy < 0 && p.y > self.y + 6) {              // la tête entre par le bas
    fait = true;
    p.vy = 40;                                     // le héros rebondit contre le bloc
    V.revele(TX, TY, self.props.contenu);
    self.destroy();
  }
};
on('overlap', 'Plombier', frappe);
on('overlap', 'PlombierGrand', frappe);
`;

const matScript = `// ===== Mât du drapeau : détecte le héros ; toute la séquence est dans game.vars.drapeau =====
on('overlap', 'Plombier', (p) => game.vars.drapeau(p));
on('overlap', 'PlombierGrand', (p) => game.vars.drapeau(p));
`;

const pointsScript = `// ===== Points : petit texte flottant qui suit le monde (le HUD est en coordonnées écran) =====
const id = 'pts' + self.id;
const texte = self.props.texte || '';
const x0 = self.x, y0 = self.y;
let t = 0;
on('update', (dt) => {
  t += dt;
  game.setText(id, texte, Math.round(x0 - game.camera.x), Math.round(y0 - t * 38 - game.camera.y), { size: 0.55, color: '#ffffff' });
  if (t > 0.8) { game.removeText(id); self.destroy(); }
});
on('destroy', () => game.removeText(id));
`;

const cadavreScript = `// ===== Ennemi renversé : il saute, bascule et tombe hors de l'écran =====
// props : quoi ('goomba' | 'koopa' | 'carapace'), dir (-1 / +1)
const dir = self.props.dir || 1;
on('create', () => {
  self.play(self.props.quoi);
  self.angle = 180;
  self.depth = 110;
  self.tweenTo({ y: self.y - 28, x: self.x + dir * 10 }, 220);
  game.wait(230, () => self.tweenTo({ y: game.mapHeight + 40, x: self.x + dir * 40 }, 900));
  game.wait(1250, () => self.destroy());
});
`;

const cameraScript = `// ===== Caméra : fantôme suivi par la caméra, qui ne recule jamais =====
// Sur NES, l'écran défile quand le héros dépasse le milieu et ne revient jamais en arrière.
on('update', () => {
  const j = game.vars.joueur();
  if (j) self.x = Math.max(self.x, j.x + 8);
});
`;

const rideauScript = `// ===== Rideau noir plein écran (introduction du niveau, fin de partie) =====
on('create', () => { self.depth = 900; });
`;

// =====================================================================================================
// 3. PLAN DU NIVEAU (212 x 15 tuiles)
// =====================================================================================================
const W = 212, H = 15, SOL_Y = 13;                   // le sol occupe les rangées 13 et 14
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const grille = () => Array.from({ length: H }, () => Array(W).fill('.'));
const poser = (g, x, y, t) => { g[y][x] = B36[t]; };

const TROUS = [[69, 70], [86, 88], [153, 154]];       // colonnes sans sol (bornes incluses)
const TUYAUX = [[28, 2], [38, 3], [46, 4], [57, 4], [163, 2], [179, 2]];   // [x gauche, hauteur en tuiles]
const ESCALIERS = [[134, [1, 2, 3, 4]], [140, [4, 3, 2, 1]], [148, [1, 2, 3, 4]], [155, [4, 3, 2, 1]], [181, [1, 2, 3, 4, 5, 6, 7, 8]], [189, [8]]];

function planSol() {
  const g = grille();
  for (let x = 0; x < W; x++) {
    if (TROUS.some(([a, b]) => x >= a && x <= b)) continue;
    poser(g, x, 13, TL.SOL); poser(g, x, 14, TL.SOL);
  }
  for (const [x, h] of TUYAUX) {
    const haut = SOL_Y - h;
    poser(g, x, haut, TL.TUY_HG); poser(g, x + 1, haut, TL.TUY_HD);
    for (let y = haut + 1; y < SOL_Y; y++) { poser(g, x, y, TL.TUY_BG); poser(g, x + 1, y, TL.TUY_BD); }
  }
  for (const [x0, hs] of ESCALIERS) hs.forEach((h, i) => { for (let k = 1; k <= h; k++) poser(g, x0 + i, SOL_Y - k, TL.PIERRE); });
  for (const [x, y, type] of BLOCS) poser(g, x, y, type === '?' ? TL.Q0 : TL.BRIQUE);
  poser(g, 198, 12, TL.PIERRE);                       // base du mât
  return g;
}

function planFond() {
  const g = grille();
  const colline = (x, grande) => {
    if (grande) {
      poser(g, x + 1, 11, TL.COL_G); poser(g, x + 2, 11, TL.COL_HAUT); poser(g, x + 3, 11, TL.COL_D);
      poser(g, x, 12, TL.COL_G); poser(g, x + 1, 12, TL.COL_PLEIN); poser(g, x + 2, 12, TL.COL_YEUX); poser(g, x + 3, 12, TL.COL_PLEIN); poser(g, x + 4, 12, TL.COL_D);
    } else {
      poser(g, x, 12, TL.COL_G); poser(g, x + 1, 12, TL.COL_HAUT); poser(g, x + 2, 12, TL.COL_D);
    }
  };
  for (const x of [0, 48, 96, 144, 192]) colline(x, true);
  for (const x of [16, 64, 112, 160]) colline(x, false);
  const buissonDeco = (x, n) => { poser(g, x, 12, TL.BUS_G); for (let i = 1; i < n - 1; i++) poser(g, x + i, 12, TL.BUS_M); poser(g, x + n - 1, 12, TL.BUS_D); };
  for (const [x, n] of [[11, 3], [23, 5], [41, 3], [59, 3], [71, 5], [89, 3], [107, 3], [119, 5], [165, 3], [172, 5], [192, 3]]) buissonDeco(x, n);
  const nuage = (x, y, n) => {
    poser(g, x, y, TL.NUA_HG); poser(g, x, y + 1, TL.NUA_BG);
    for (let i = 1; i < n - 1; i++) { poser(g, x + i, y, TL.NUA_HM); poser(g, x + i, y + 1, TL.NUA_BM); }
    poser(g, x + n - 1, y, TL.NUA_HD); poser(g, x + n - 1, y + 1, TL.NUA_BD);
  };
  const NUAGES = [[8, 2, 3], [19, 1, 2], [27, 3, 4], [36, 2, 3], [56, 2, 2], [67, 1, 3], [75, 3, 3], [84, 1, 2], [104, 2, 3], [115, 1, 2],
    [123, 3, 4], [132, 2, 3], [152, 2, 2], [163, 1, 3], [171, 3, 3], [180, 1, 2], [200, 2, 3]];
  for (const [x, y, n] of NUAGES) nuage(x, y, n);
  // château (5 x 5)
  const C = TL;
  [[203, 8, C.CH_CRENEAU], [204, 8, C.CH_CRENEAU], [205, 8, C.CH_CRENEAU],
    [203, 9, C.CH_FENETRE], [204, 9, C.CH_MUR], [205, 9, C.CH_FENETRE],
    [202, 10, C.CH_CRENEAU], [203, 10, C.CH_CRENEAU], [204, 10, C.CH_CRENEAU], [205, 10, C.CH_CRENEAU], [206, 10, C.CH_CRENEAU],
    [202, 11, C.CH_MUR], [203, 11, C.CH_MUR], [204, 11, C.CH_ARCHE], [205, 11, C.CH_MUR], [206, 11, C.CH_MUR],
    [202, 12, C.CH_MUR], [203, 12, C.CH_MUR], [204, 12, C.CH_PORTE], [205, 12, C.CH_MUR], [206, 12, C.CH_MUR]].forEach(([x, y, t]) => poser(g, x, y, t));
  return g;
}

// Ennemis (case de l'écran = bas gauche du sprite) : paires de Goombas séparées d'au moins 2 tuiles
const GOOMBAS = [22, 40, 51, 53, 80, 82, 97, 99, 114, 116, 124, 126, 128, 130, 174, 176];
const KOOPAS = [107];

// =====================================================================================================
// 4. ASSEMBLAGE DU PROJET (comme le ferait une IA via les outils MCP)
// =====================================================================================================
// Le jeu est recréé à chaque lancement : on supprime l'ancien fichier (l'id «monde-1-1» vient du nom).
try { pf.deleteGameFile('monde-1-1'); } catch { /* il n'existait pas encore */ }

const projet = pf.createGameFile('Monde 1-1', (p) => {
  pf.setSettings(p, {
    width: 256, height: 240, tileSize: 16, gravity: 900, pixelZoom: 3, background: '#5c94fc', palette: PALETTE,
    description: 'Un niveau plateforme complet façon NES : 4 tuyaux, trous, blocs « ? », champignon, étoile, Goombas, Koopa, mât et château.',
    author: 'PixelForge',
  });
  p.meta.id = 'monde-1-1';

  // --- Sprites ---
  pf.upsertSprite(p, { name: 'Tuiles', frames: TILESET, width: 16, height: 16 });
  const animHeros = [
    { name: 'repos', frames: [0], fps: 4 }, { name: 'marche', frames: [1, 2, 3], fps: 10 }, { name: 'course', frames: [1, 2, 3], fps: 18 },
    { name: 'saut', frames: [4], fps: 4 }, { name: 'derapage', frames: [5], fps: 4 },
    { name: 'mort', frames: [6], fps: 4 }, { name: 'glisse', frames: [6], fps: 4 },
  ];
  pf.upsertSprite(p, { name: 'Plombier', frames: PETIT, width: 16, height: 16, animations: animHeros });
  pf.upsertSprite(p, { name: 'PlombierGrand', frames: GRAND, width: 16, height: 32, animations: animHeros });
  pf.upsertSprite(p, { name: 'Goomba', frames: [G1, G2, GAPLAT], width: 16, height: 16, animations: [{ name: 'marche', frames: [0, 1], fps: 6 }, { name: 'ecrase', frames: [2], fps: 4 }] });
  pf.upsertSprite(p, { name: 'Koopa', frames: KOOPA, width: 16, height: 24, animations: [{ name: 'marche', frames: [0, 1], fps: 5 }] });
  pf.upsertSprite(p, { name: 'Carapace', frames: [CARAPACE], width: 16, height: 16, animations: [{ name: 'repos', frames: [0], fps: 4 }] });
  pf.upsertSprite(p, {
    name: 'Objets', frames: OBJETS, width: 16, height: 16,
    animations: [{ name: 'champi', frames: [0], fps: 4 }, { name: 'etoile', frames: [1, 2, 3, 4], fps: 10 }, { name: 'vie', frames: [5], fps: 4 }],
  });
  pf.upsertSprite(p, { name: 'PieceBloc', frames: [6, 4, 1.4, 4].map(piece), width: 16, height: 16, animations: [{ name: 'tourne', frames: [0, 1, 2, 3], fps: 16 }] });
  pf.upsertSprite(p, { name: 'Debris', frames: DEBRIS, width: 8, height: 8, animations: [{ name: 'idle', frames: [0, 1], fps: 12 }] });
  pf.upsertSprite(p, {
    name: 'BlocsBump', frames: BLOCS_BUMP, width: 16, height: 16,
    animations: [{ name: 'brique', frames: [0], fps: 4 }, { name: 'question', frames: [1], fps: 4 }, { name: 'vide', frames: [2], fps: 4 }],
  });
  pf.upsertSprite(p, {
    name: 'Cadavres', frames: CADAVRES, width: 16, height: 24,
    animations: [{ name: 'goomba', frames: [0], fps: 4 }, { name: 'koopa', frames: [1], fps: 4 }, { name: 'carapace', frames: [2], fps: 4 }],
  });
  pf.upsertSprite(p, { name: 'Mat', frames: [MAT], width: 16, height: 160 });
  pf.upsertSprite(p, { name: 'Drapeau', frames: [DRAPEAU], width: 16, height: 16 });
  pf.upsertSprite(p, { name: 'Rideau', frames: [RIDEAU], width: 256, height: 240, legend: { K: '#000000' } });
  pf.upsertSprite(p, { name: 'Vide', frames: [VIDE16], width: 16, height: 16 });

  // --- Objets ---
  const fantome = { enabled: false };                                              // pas de physique : décor / animations / fantômes
  const capteur = { gravity: false, immovable: true, collideMap: false, collideWorld: false };
  const chute = { collideWorld: false };                                           // peut tomber dans les trous
  pf.upsertObject(p, { name: 'Plombier', sprite: 'Plombier', defaultAnim: 'repos', hitbox: { x: 3, y: 1, w: 10, h: 15 }, physics: chute, code: heroScript(false) });
  pf.upsertObject(p, { name: 'PlombierGrand', sprite: 'PlombierGrand', defaultAnim: 'repos', hitbox: { x: 3, y: 1, w: 10, h: 31 }, physics: chute, code: heroScript(true) });
  pf.upsertObject(p, { name: 'MortPlombier', sprite: 'Plombier', defaultAnim: 'mort', physics: fantome, code: mortScript });
  pf.upsertObject(p, { name: 'Goomba', sprite: 'Goomba', defaultAnim: 'marche', hitbox: { x: 1, y: 3, w: 14, h: 13 }, physics: chute, code: goombaScript });
  pf.upsertObject(p, { name: 'Koopa', sprite: 'Koopa', defaultAnim: 'marche', hitbox: { x: 2, y: 8, w: 12, h: 16 }, physics: chute, code: koopaScript });
  pf.upsertObject(p, { name: 'Carapace', sprite: 'Carapace', defaultAnim: 'repos', hitbox: { x: 1, y: 3, w: 14, h: 13 }, physics: chute, code: carapaceScript });
  pf.upsertObject(p, { name: 'Champignon', sprite: 'Objets', defaultAnim: 'champi', hitbox: { x: 1, y: 1, w: 14, h: 15 }, physics: chute, code: champignonScript });
  pf.upsertObject(p, { name: 'Etoile', sprite: 'Objets', defaultAnim: 'etoile', hitbox: { x: 2, y: 2, w: 12, h: 13 }, physics: chute, code: etoileScript });
  pf.upsertObject(p, { name: 'Emergence', sprite: 'Objets', defaultAnim: 'champi', physics: fantome, code: emergenceScript });
  pf.upsertObject(p, { name: 'PieceBloc', sprite: 'PieceBloc', defaultAnim: 'tourne', physics: { collideMap: false, collideWorld: false }, code: pieceBlocScript });
  pf.upsertObject(p, { name: 'Debris', sprite: 'Debris', defaultAnim: 'idle', physics: { collideMap: false, collideWorld: false }, code: debrisScript });
  pf.upsertObject(p, { name: 'BlocBump', sprite: 'BlocsBump', defaultAnim: 'brique', physics: fantome, code: blocBumpScript });
  pf.upsertObject(p, { name: 'BlocCache', sprite: 'Vide', defaultAnim: 'idle', hitbox: { x: 1, y: 1, w: 14, h: 14 }, physics: capteur, code: blocCacheScript });
  pf.upsertObject(p, { name: 'Mat', sprite: 'Mat', defaultAnim: 'idle', hitbox: { x: 5, y: 8, w: 6, h: 152 }, physics: capteur, code: matScript });
  pf.upsertObject(p, { name: 'Drapeau', sprite: 'Drapeau', defaultAnim: 'idle', physics: fantome, code: '' });
  pf.upsertObject(p, { name: 'Points', sprite: 'Vide', defaultAnim: 'idle', physics: fantome, code: pointsScript });
  pf.upsertObject(p, { name: 'Cadavre', sprite: 'Cadavres', defaultAnim: 'goomba', physics: fantome, code: cadavreScript });
  pf.upsertObject(p, { name: 'Camera', sprite: 'Vide', defaultAnim: 'idle', physics: fantome, code: cameraScript });
  pf.upsertObject(p, { name: 'Rideau', sprite: 'Rideau', defaultAnim: 'idle', physics: fantome, code: rideauScript });

  // --- Sons (presets synthétisés) ---
  for (const [name, preset, volume, pitch] of [
    ['saut', 'jump', 0.5, 1], ['piece', 'coin', 0.5, 1], ['champignon', 'powerup', 0.5, 1], ['apparition', 'blip', 0.5, 0.7],
    ['bump', 'blip', 0.6, 0.4], ['brique', 'explosion', 0.35, 1.8], ['ecrase', 'hit', 0.4, 1.7], ['coup', 'laser', 0.35, 0.9],
    ['mort', 'hit', 0.6, 0.5], ['tuyau', 'portal', 0.4, 1.4], ['drapeau', 'portal', 0.5, 1.2], ['vie', 'powerup', 0.5, 1.5], ['victoire', 'powerup', 0.6, 1.2],
  ]) pf.addSound(p, { name, preset, volume, pitch });

  // --- Carte, calques et peinture ---
  pf.upsertMap(p, {
    name: 'Monde 1-1', width: W, height: H, tileset: 'Tuiles', background: '#5c94fc', start: true,
    layers: [{ name: 'Fond', collides: false }, { name: 'Sol', collides: true }, { name: 'Devant', collides: false, depth: 'above' }],
  });
  pf.paintMap(p, { map: 'Monde 1-1', layer: 'Fond', rows: planFond().map((r) => r.join('')) });
  pf.paintMap(p, { map: 'Monde 1-1', layer: 'Sol', rows: planSol().map((r) => r.join('')) });

  // --- Entités : mât et drapeau (en pixels), blocs cachés, ennemis (sur la grille), puis le héros ---
  const ent = grille();
  for (const x of GOOMBAS) ent[12][x] = 'g';
  for (const x of KOOPAS) ent[12][x] = 'k';
  pf.placeEntities(p, {
    map: 'Monde 1-1', mode: 'replace',
    entities: [
      { object: 'Mat', x: 198 * 16, y: 2 * 16 },
      { object: 'Drapeau', x: 198 * 16 - 8, y: 3 * 16 },
      ...CACHES.map(([x, y, contenu]) => ({ object: 'BlocCache', x: x * 16, y: y * 16, props: { contenu } })),
    ],
    rows: ent.map((r) => r.join('')), legend: { g: 'Goomba', k: 'Koopa' },
  });
  pf.placeEntities(p, { map: 'Monde 1-1', mode: 'append', entities: [{ object: 'Plombier', x: 3 * 16, y: 12 * 16 }] });

  pf.setScript(p, 'global', GLOBAL);
});

const issues = pf.validateProject(pf.loadGame('monde-1-1'));
console.log('Jeu écrit :', projet.meta.id, '-', pf.formatIssues(issues));
if (issues.some((i) => i.level === 'error')) process.exitCode = 1;
