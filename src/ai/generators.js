/**
 * PixelForge — Generateurs de ressources IA (sprites, musiques, modeles 3D et sons)
 * Conforme a la Decision V5 et a la Phase H (H4 - Issue #92).
 * Fonctions pures, zero dependance DOM ni Node.
 */

import { SOUND_PRESETS } from '../core/ops/ops.js';
import { CC0_PRESETS } from '../core/cc0-models.js';

/**
 * Palette standard Sweetie 16 (indices hex 0 a f) :
 * 0: #1a1c2c, 1: #5d275d, 2: #b13e53, 3: #ef7d57,
 * 4: #ffcd75, 5: #a7f070, 6: #38b764, 7: #257179,
 * 8: #29366f, 9: #3b5dc9, a: #41a6f6, b: #73eff7,
 * c: #f4f4f4, d: #94b0c2, e: #566c86, f: #333c57.
 */

// ============================================================================
// 1. GENERATEUR DE SPRITES PIXEL ART TEXTUELS (16x16 MULTI-FRAMES & ANIME)
// ============================================================================

/**
 * Modeles de sprites predefinis 16x16 de haute qualite avec animations completes
 */
const SPRITE_TEMPLATES = {
  // --- Personnage Chevalier / Aventurier / Guerrier ---
  knight: {
    category: 'character',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Idle stance A
      [
        '................',
        '.....fffff......',
        '....feddddf.....',
        '....fddccdf.....',
        '....feddddf.....',
        '.....f333f......',
        '....fedddedf....',
        '...feddddddef...',
        '...fdd4444ddf...',
        '...fddf44fddf...',
        '....feddddef....',
        '....f333333f....',
        '....fedffdef....',
        '....fedffdef....',
        '....f00ff00f....',
        '....f00ff00f....',
      ],
      // Frame 1 : Idle stance B (respiration)
      [
        '................',
        '................',
        '.....fffff......',
        '....feddddf.....',
        '....fddccdf.....',
        '....feddddf.....',
        '.....f333f......',
        '....fedddedf....',
        '...feddddddef...',
        '...fdd4444ddf...',
        '...fddf44fddf...',
        '....feddddef....',
        '....f333333f....',
        '....fedffdef....',
        '....f00ff00f....',
        '....f00ff00f....',
      ],
      // Frame 2 : Marche pied droit avance
      [
        '................',
        '.....fffff......',
        '....feddddf.....',
        '....fddccdf.....',
        '....feddddf.....',
        '.....f333f......',
        '...fedddddedf...',
        '..fdeddddddedf..',
        '..fdde4444eddf..',
        '...fedf44fedf...',
        '....feddddef....',
        '....f333333f....',
        '.....fdd..fef...',
        '.....fed...f0f..',
        '.....f00f...ff..',
        '......ff........',
      ],
      // Frame 3 : Marche pied gauche avance
      [
        '................',
        '.....fffff......',
        '....feddddf.....',
        '....fddccdf.....',
        '....feddddf.....',
        '.....f333f......',
        '...fedddddedf...',
        '..fdeddddddedf..',
        '..fdde4444eddf..',
        '...fedf44fedf...',
        '....feddddef....',
        '....f333333f....',
        '....fef..fdd....',
        '...f0f...fdef...',
        '...ff...f00f....',
        '........ff......',
      ],
      // Frame 4 : Saut en extension
      [
        '.....fffff......',
        '....feddddf.....',
        '....fddccdf.....',
        '....feddddf.....',
        '.....f333f......',
        '..ffedddddedff..',
        '.fdeddddddddedf.',
        '.fd..f4444f..ddf',
        '..f..f4444f..f..',
        '.....fddddf.....',
        '....feddddef....',
        '....f333333f....',
        '....ffddddff....',
        '...f00ffff00f...',
        '...fff....fff...',
        '................',
      ],
      // Frame 5 : Saut retoubee / reception
      [
        '................',
        '................',
        '.....fffff......',
        '....feddddf.....',
        '....fddccdf.....',
        '....feddddf.....',
        '.....f333f......',
        '...fedddddedf...',
        '..feddddddddef..',
        '..fedd4444ddef..',
        '...fddffffddf...',
        '....ff3333ff....',
        '....feddddef....',
        '....f00ff00f....',
        '...f000ff000f...',
        '...ffffffffff...',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 4, loop: true },
      { name: 'run', frames: [0, 2, 0, 3], fps: 8, loop: true },
      { name: 'walk', frames: [0, 2, 0, 3], fps: 6, loop: true },
      { name: 'jump', frames: [4, 5], fps: 4, loop: false },
    ],
  },

  // --- Monstre Slime Vert ---
  slime: {
    category: 'monster',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Repos normal
      [
        '................',
        '................',
        '................',
        '................',
        '......6666......',
        '....66555566....',
        '...6555555556...',
        '..655cc55cc556..',
        '..6550c550c556..',
        '.6555cc55cc5556.',
        '.65555555555556.',
        '.65555555555556.',
        '.66555555555566.',
        '..666555555666..',
        '...6666666666...',
        '................',
      ],
      // Frame 1 : Respiration legere
      [
        '................',
        '................',
        '................',
        '......6666......',
        '....66555566....',
        '...6555555556...',
        '..655cc55cc556..',
        '..6550c550c556..',
        '.6555cc55cc5556.',
        '.65555555555556.',
        '.65555555555556.',
        '.65555555555556.',
        '..665555555566..',
        '...6665555666...',
        '....66666666....',
        '................',
      ],
      // Frame 2 : Ecrasement (squash avant saut ou atterrissage)
      [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '....66666666....',
        '..665555555566..',
        '.6555cc55cc5556.',
        '.65550c550c5556.',
        '.6555cc55cc5556.',
        '6555555555555556',
        '6555555555555556',
        '6665555555555666',
        '.66666666666666.',
        '................',
      ],
      // Frame 3 : Etirement (stretch en plein bond)
      [
        '................',
        '.......66.......',
        '.....665566.....',
        '....65555556....',
        '...655cc55cc6...',
        '...6550c550c6...',
        '...655cc55cc6...',
        '....65555556....',
        '....65555556....',
        '....65555556....',
        '....65555556....',
        '....66555566....',
        '.....665566.....',
        '......6666......',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 3, loop: true },
      { name: 'walk', frames: [0, 2, 3, 0], fps: 6, loop: true },
      { name: 'run', frames: [0, 2, 3, 0], fps: 8, loop: true },
      { name: 'jump', frames: [2, 3], fps: 4, loop: false },
    ],
  },

  // --- Monstre Chauve-souris Volante ---
  bat: {
    category: 'monster',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Ailes hautes
      [
        '1..............1',
        '11............11',
        '1f1..........1f1',
        '.1f1...ff...1f1.',
        '..1f1.f44f.1f1..',
        '...1f1f00f1f1...',
        '....1ffffff1....',
        '.....fccccf.....',
        '.....ffffff.....',
        '......ffff......',
        '.......ff.......',
        '................',
        '................',
        '................',
        '................',
        '................',
      ],
      // Frame 1 : Ailes horizontales
      [
        '................',
        '................',
        '................',
        '111..........111',
        '.1ff1..ff..1ff1.',
        '..1fff4444fff1..',
        '...1fff00fff1...',
        '....1ffffff1....',
        '.....fccccf.....',
        '.....ffffff.....',
        '......ffff......',
        '.......ff.......',
        '................',
        '................',
        '................',
        '................',
      ],
      // Frame 2 : Ailes basses
      [
        '................',
        '................',
        '................',
        '.......ff.......',
        '......f44f......',
        '.....ff00ff.....',
        '....1ffffff1....',
        '...1f1cccc1f1...',
        '..1f1.ffff.1f1..',
        '.1f1..ffff..1f1.',
        '1f1....ff....1f1',
        '11............11',
        '................',
        '................',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1, 2, 1], fps: 6, loop: true },
      { name: 'fly', frames: [0, 1, 2, 1], fps: 8, loop: true },
      { name: 'run', frames: [0, 1, 2, 1], fps: 8, loop: true },
    ],
  },

  // --- Monstre Squelette ---
  skeleton: {
    category: 'monster',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Stance neutre
      [
        '................',
        '.....cccccc.....',
        '....cddddddc....',
        '....cd0dd0dc....',
        '....cddddddc....',
        '.....c0c0cc.....',
        '......cddc......',
        '....ccddddcc....',
        '...cd.cddc.dc...',
        '...cd.cddc.dc...',
        '......cddc......',
        '.....cd..dc.....',
        '.....cd..dc.....',
        '.....cd..dc.....',
        '....ccd..dcc....',
        '....ccd..dcc....',
      ],
      // Frame 1 : Respiration
      [
        '................',
        '................',
        '.....cccccc.....',
        '....cddddddc....',
        '....cd0dd0dc....',
        '....cddddddc....',
        '.....c0c0cc.....',
        '......cddc......',
        '....ccddddcc....',
        '...cd.cddc.dc...',
        '...cd.cddc.dc...',
        '......cddc......',
        '.....cd..dc.....',
        '.....cd..dc.....',
        '....ccd..dcc....',
        '....ccd..dcc....',
      ],
      // Frame 2 : Marche pas A
      [
        '................',
        '.....cccccc.....',
        '....cddddddc....',
        '....cd0dd0dc....',
        '....cddddddc....',
        '.....c0c0cc.....',
        '......cddc......',
        '....ccddddcc....',
        '...cd..cddc.dc..',
        '..cd...cddc..dc.',
        '.......cddc.....',
        '......cdd.dc....',
        '.....cd....dc...',
        '....ccd.....dc..',
        '...ccd......dcc.',
        '................',
      ],
      // Frame 3 : Marche pas B
      [
        '................',
        '.....cccccc.....',
        '....cddddddc....',
        '....cd0dd0dc....',
        '....cddddddc....',
        '.....c0c0cc.....',
        '......cddc......',
        '....ccddddcc....',
        '..cd.cddc..dc...',
        '.dc..cddc...cd..',
        '.....cddc.......',
        '....cd.ddc......',
        '...dc....dc.....',
        '..dc.....dcc....',
        '.dcc......ccd...',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 3, loop: true },
      { name: 'walk', frames: [0, 2, 0, 3], fps: 6, loop: true },
      { name: 'run', frames: [0, 2, 0, 3], fps: 8, loop: true },
    ],
  },

  // --- Objet Collectible Pièce d'or tournoyante ---
  coin: {
    category: 'collectible',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Face ronde complete
      [
        '................',
        '................',
        '......4444......',
        '....44cccc44....',
        '...4cc4444cc4...',
        '..4c44ffff44c4..',
        '..4c4ffffff4c4..',
        '..4c4ffffff4c4..',
        '..4c4ffffff4c4..',
        '..4c44ffff44c4..',
        '...4cc4444cc4...',
        '....44cccc44....',
        '......4444......',
        '................',
        '................',
        '................',
      ],
      // Frame 1 : Angle 3/4
      [
        '................',
        '................',
        '.......44.......',
        '.....44cc44.....',
        '....4cc44cc4....',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '....4cc44cc4....',
        '.....44cc44.....',
        '.......44.......',
        '................',
        '................',
        '................',
      ],
      // Frame 2 : Tranche fine
      [
        '................',
        '................',
        '.......44.......',
        '......4cc4......',
        '......4cc4......',
        '......4ff4......',
        '......4ff4......',
        '......4ff4......',
        '......4ff4......',
        '......4ff4......',
        '......4cc4......',
        '......4cc4......',
        '.......44.......',
        '................',
        '................',
        '................',
      ],
      // Frame 3 : Angle inverse
      [
        '................',
        '................',
        '.......44.......',
        '.....44cc44.....',
        '....4cc44cc4....',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '...4c4ffff4c4...',
        '....4cc44cc4....',
        '.....44cc44.....',
        '.......44.......',
        '................',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1, 2, 3], fps: 8, loop: true },
    ],
  },

  // --- Objet Collectible Gemme / Rubis / Émeraude étincelante ---
  gem: {
    category: 'collectible',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Eclat standard
      [
        '................',
        '................',
        '.....bbbbbb.....',
        '....baaaaabb....',
        '...bacccccabb...',
        '..baacccccaab9..',
        '..baaaaaaaaaa9..',
        '..9baaaaaaaab9..',
        '...9baaaaaab9...',
        '....9baaaab9....',
        '.....9baab9.....',
        '......9bb9......',
        '.......99.......',
        '................',
        '................',
        '................',
      ],
      // Frame 1 : Eclat scintillant
      [
        '.......cc.......',
        '......cccc......',
        '.....bbccbb.....',
        '....baaaaabb....',
        '...bacccccabb...',
        '..baacccccaab9..',
        '..baaaaaaaaaa9..',
        '..9baaaaaaaab9..',
        '...9baaaaaab9...',
        '....9baaaab9....',
        '.....9baab9.....',
        '......9bb9......',
        '.......99.......',
        '................',
        '................',
        '................',
      ],
      // Frame 2 : Lueur tamisee
      [
        '................',
        '................',
        '.....bbbbbb.....',
        '....baaaaabb....',
        '...baaaaaaabb...',
        '..baaaaaaaaaab9.',
        '..baaaaaaaaaab9.',
        '..9baaaaaaaab9..',
        '...9baaaaaab9...',
        '....9baaaab9....',
        '.....9baab9.....',
        '......9bb9......',
        '.......99.......',
        '................',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1, 0, 2], fps: 6, loop: true },
    ],
  },

  // --- Objet Collectible Clé dorée ---
  key: {
    category: 'collectible',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Flottement haut
      [
        '................',
        '......4444......',
        '.....4cccc4.....',
        '....4c4444c4....',
        '....4c4..4c4....',
        '....4c4444c4....',
        '.....4cccc4.....',
        '......4444......',
        '.......44.......',
        '.......4444.....',
        '.......44.......',
        '.......4444.....',
        '.......44.......',
        '.......44.......',
        '................',
        '................',
      ],
      // Frame 1 : Flottement bas avec brillance
      [
        '................',
        '................',
        '......4444......',
        '.....4cccc4.....',
        '....4cccccc4....',
        '....4c4..4c4....',
        '....4c4444c4....',
        '.....4cccc4.....',
        '......4444......',
        '.......44.......',
        '.......4444.....',
        '.......44.......',
        '.......4444.....',
        '.......44.......',
        '.......44.......',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 3, loop: true },
    ],
  },

  // --- Objet Collectible Coeur / Vie ---
  heart: {
    category: 'collectible',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Battement normal
      [
        '................',
        '................',
        '..2222....2222..',
        '.233332..233332.',
        '.23cc332233cc32.',
        '233cccc33cccc332',
        '2333333333333332',
        '2333333333333332',
        '.23333333333332.',
        '..233333333332..',
        '...2333333332...',
        '....23333332....',
        '.....233332.....',
        '......2332......',
        '.......22.......',
        '................',
      ],
      // Frame 1 : Battement grossi
      [
        '................',
        '.22222....22222.',
        '2333332..2333332',
        '23cccc3223cccc32',
        '2333333333333332',
        '2333333333333332',
        '2333333333333332',
        '.23333333333332.',
        '..233333333332..',
        '...2333333332...',
        '....23333332....',
        '.....233332.....',
        '......2332......',
        '.......22.......',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 3, loop: true },
    ],
  },

  // --- Objet Coffre au trésor ---
  chest: {
    category: 'prop',
    width: 16,
    height: 16,
    frames: [
      // Frame 0 : Coffre ferme
      [
        '................',
        '................',
        '................',
        '.....eeeeee.....',
        '....effffffe....',
        '...ef333333fe...',
        '..effffffffff4..',
        '..e3333443333e..',
        '..effff44ffffe..',
        '..e3333443333e..',
        '..e3333333333e..',
        '..e3333333333e..',
        '..effffffffff4..',
        '..e0000000000e..',
        '................',
        '................',
      ],
      // Frame 1 : Coffre avec brillance de serrure
      [
        '................',
        '................',
        '................',
        '.....eeeeee.....',
        '....effffffe....',
        '...ef333333fe...',
        '..effffffffff4..',
        '..e3333cc3333e..',
        '..effffccffffe..',
        '..e3333443333e..',
        '..e3333333333e..',
        '..e3333333333e..',
        '..effffffffff4..',
        '..e0000000000e..',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 2, loop: true },
    ],
  },

  // --- Projectile Boule de feu / Laser ---
  fireball: {
    category: 'projectile',
    width: 16,
    height: 16,
    frames: [
      // Frame 0
      [
        '................',
        '................',
        '........222.....',
        '......223332....',
        '....223444332...',
        '...23344cc4322..',
        '..2344ccccc4332.',
        '.2344ccffcc4332.',
        '..2344ccccc4332.',
        '...23344cc4322..',
        '....223444332...',
        '......223332....',
        '........222.....',
        '................',
        '................',
        '................',
      ],
      // Frame 1
      [
        '................',
        '................',
        '.......222......',
        '.....2233322....',
        '...2234444332...',
        '..2334ccccc432..',
        '.2344ccffcc4432.',
        '.2344ccffcc4432.',
        '..2334ccccc432..',
        '...2234444332...',
        '.....2233322....',
        '.......222......',
        '................',
        '................',
        '................',
        '................',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 8, loop: true },
    ],
  },

  // --- Tuile Plateforme Herbe ---
  platform_grass: {
    category: 'tile',
    width: 16,
    height: 16,
    frames: [
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
    ],
    animations: [
      { name: 'idle', frames: [0], fps: 1, loop: false },
    ],
  },

  // --- Danger Piques / Spikes ---
  spikes: {
    category: 'tile',
    width: 16,
    height: 16,
    frames: [
      [
        '................',
        '....d......d....',
        '...dcd....dcd...',
        '...dcd....dcd...',
        '..dcdd...dcdd...',
        '..dcdd...dcdd...',
        '.dccdd..dccdd...',
        '.dccdd..dccdd...',
        'dccddd.dccddd...',
        'dccdddfdccdddf..',
        'ffffffeffffffeff',
        'ffffffffffffffff',
        'eeeeeeeeeeeeeeee',
        'eeeeeeeeeeeeeeee',
        '0000000000000000',
        '0000000000000000',
      ],
    ],
    animations: [
      { name: 'idle', frames: [0], fps: 1, loop: false },
    ],
  },
};

/**
 * Normalise un texte pour recherche de mots-cles (minuscules, sans accents)
 */
function normalizeDesc(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Generateur procedural de sprite de repli base sur des parametres d'archetype
 */
function generateProceduralSprite(desc, width = 16, height = 16) {
  const norm = normalizeDesc(desc);
  let mainColor = '4'; // defaut or/jaune
  let secColor = '3';
  let outlineColor = '0';

  if (norm.includes('vert') || norm.includes('green') || norm.includes('foret') || norm.includes('poison')) {
    mainColor = '5'; secColor = '6';
  } else if (norm.includes('rouge') || norm.includes('red') || norm.includes('feu') || norm.includes('sang')) {
    mainColor = '3'; secColor = '2';
  } else if (norm.includes('bleu') || norm.includes('blue') || norm.includes('eau') || norm.includes('glace') || norm.includes('magic')) {
    mainColor = 'a'; secColor = '9';
  } else if (norm.includes('violet') || norm.includes('purple') || norm.includes('sombre')) {
    mainColor = '1'; secColor = '8';
  } else if (norm.includes('blanc') || norm.includes('white') || norm.includes('lumiere')) {
    mainColor = 'c'; secColor = 'd';
  }

  // Construit un sprite spherique/carre stylise centre
  const frame0 = [];
  const frame1 = [];
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const r = Math.min(cx, cy) - 2;

  for (let y = 0; y < height; y++) {
    let row0 = '';
    let row1 = '';
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r - 1) {
        row0 += (x < cx && y < cy) ? 'c' : mainColor;
        row1 += (x === cx || y === cy) ? 'c' : secColor;
      } else if (d <= r) {
        row0 += secColor;
        row1 += mainColor;
      } else if (d <= r + 0.8) {
        row0 += outlineColor;
        row1 += outlineColor;
      } else {
        row0 += '.';
        row1 += '.';
      }
    }
    frame0.push(row0);
    frame1.push(row1);
  }

  return {
    width,
    height,
    frames: [frame0, frame1],
    animations: [
      { name: 'idle', frames: [0, 1], fps: 4, loop: true },
      { name: 'walk', frames: [0, 1], fps: 6, loop: true },
      { name: 'jump', frames: [1], fps: 2, loop: false },
    ],
  };
}

/**
 * Genere les donnees completes d'un sprite (frames en texte ASCII et animations)
 */
export function generateSpriteData(description, options = {}) {
  const norm = normalizeDesc(description);
  const name = options.name || (description ? description.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') : 'Sprite');
  const w = options.width || options.tileSize || 16;
  const h = options.height || options.tileSize || 16;

  let template = null;

  if (norm.includes('slime') || norm.includes('bave') || norm.includes('gelatine') || norm.includes('blob')) {
    template = SPRITE_TEMPLATES.slime;
  } else if (norm.includes('chauve') || norm.includes('bat') || norm.includes('volant')) {
    template = SPRITE_TEMPLATES.bat;
  } else if (norm.includes('squelette') || norm.includes('skeleton') || norm.includes('os') || norm.includes('mort-vivant')) {
    template = SPRITE_TEMPLATES.skeleton;
  } else if (norm.includes('piece') || norm.includes('coin') || norm.includes('or') || norm.includes('sous')) {
    template = SPRITE_TEMPLATES.coin;
  } else if (norm.includes('gemme') || norm.includes('gem') || norm.includes('rubis') || norm.includes('diamant') || norm.includes('emeraude') || norm.includes('cristal')) {
    template = SPRITE_TEMPLATES.gem;
  } else if (norm.includes('cle') || norm.includes('key') || norm.includes('serrure')) {
    template = SPRITE_TEMPLATES.key;
  } else if (norm.includes('coeur') || norm.includes('heart') || norm.includes('vie') || norm.includes('soin')) {
    template = SPRITE_TEMPLATES.heart;
  } else if (norm.includes('coffre') || norm.includes('chest') || norm.includes('tresor')) {
    template = SPRITE_TEMPLATES.chest;
  } else if (norm.includes('feu') || norm.includes('fire') || norm.includes('boule de feu') || norm.includes('fireball') || norm.includes('projectile') || norm.includes('laser')) {
    template = SPRITE_TEMPLATES.fireball;
  } else if (norm.includes('herbe') || norm.includes('grass') || norm.includes('plateforme') || norm.includes('sol') || norm.includes('solide')) {
    template = SPRITE_TEMPLATES.platform_grass;
  } else if (norm.includes('pique') || norm.includes('spike') || norm.includes('piege') || norm.includes('danger')) {
    template = SPRITE_TEMPLATES.spikes;
  } else if (
    norm.includes('chevalier') ||
    norm.includes('knight') ||
    norm.includes('joueur') ||
    norm.includes('player') ||
    norm.includes('hero') ||
    norm.includes('heros') ||
    norm.includes('aventurier') ||
    norm.includes('guerrier') ||
    norm.includes('warrior') ||
    norm.includes('gardien')
  ) {
    template = SPRITE_TEMPLATES.knight;
  } else {
    // Repli procedural harmonieux
    template = generateProceduralSprite(description, w, h);
  }

  return {
    name,
    width: template.width,
    height: template.height,
    frames: JSON.parse(JSON.stringify(template.frames)),
    animations: JSON.parse(JSON.stringify(template.animations)),
  };
}

// ============================================================================
// 2. GENERATEUR DE MUSIQUE TRACKER ASCII (STYLES DONJON, COMBAT, AVENTURE...)
// ============================================================================

/**
 * Partitions musicales predefinies et structures stylistiques
 */
const SONG_STYLES = {
  // Thème de Donjon / Souterrain Inquiétant (85-95 BPM, gamme mineure / phrygienne sombre)
  dungeon: {
    defaultBpm: 90,
    text(bpm, name) {
      return `NAME "${name}"
BPM ${bpm}
LOOP on 0

CHANNELS
Lead: pulse50 vol:0.8 pan:-0.15
Bass: triangle vol:0.85 pan:0
Arp: pulse25 vol:0.45 pan:0.25
Drums: noise vol:0.5 pan:0 drumkit

PATTERN "Thème" 16
00 | D-4 | D-2 | D-3 | C-3
01 | ... | ... | F-3 | ...
02 | F-4 | D-2 | A-3 | ...
03 | ... | ... | D-4 | ...
04 | E-4 | D-2 | D-3 | D-3
05 | ... | ... | F-3 | ...
06 | C#4 | D-2 | G-3 | ...
07 | ... | ... | A-3 | ...
08 | D-4 | G-2 | Bb3 | C-3
09 | ... | ... | D-4 | ...
10 | F-4 | G-2 | F-4 | ...
11 | ... | ... | D-4 | ...
12 | A-4 | A-2 | C#4 | D-3
13 | ... | ... | E-4 | ...
14 | G-4 | A-2 | A-3 | ...
15 | ... | ... | C#4 | ...

PATTERN "Variation" 16
00 | F-4 | D-2 | D-3 | C-3
01 | ... | ... | A-3 | ...
02 | G-4 | D-2 | D-4 | ...
03 | ... | ... | F-4 | ...
04 | A-4 | F-2 | F-3 | D-3
05 | ... | ... | A-3 | ...
06 | Bb4 | F-2 | D-4 | ...
07 | ... | ... | F-4 | ...
08 | A-4 | E-2 | E-3 | C-3
09 | ... | ... | G-3 | ...
10 | G-4 | E-2 | Bb3 | ...
11 | ... | ... | E-4 | ...
12 | F-4 | A-2 | C#4 | D-3
13 | E-4 | ... | E-4 | ...
14 | D-4 | A-2 | A-3 | ...
15 | C#4 | ... | C#4 | ...

PLAYLIST
Thème Thème Variation Thème
`;
    },
  },

  // Thème de Combat Épique / Boss (140-160 BPM, rythme effréné et basse continue)
  battle: {
    defaultBpm: 145,
    text(bpm, name) {
      return `NAME "${name}"
BPM ${bpm}
LOOP on 0

CHANNELS
Lead: pulse50 vol:0.85 pan:0
Bass: triangle vol:0.9 pan:0
Pulse: pulse25 vol:0.5 pan:0.2
Drums: noise vol:0.6 pan:0 drumkit

PATTERN "Assaut" 16
00 | E-4 | E-2 | B-3 | C-3
01 | E-4 | E-2 | E-4 | D#3
02 | G-4 | E-2 | B-3 | D#3
03 | A-4 | E-2 | E-4 | D#3
04 | B-4 | E-2 | G-4 | D-3
05 | ... | E-2 | E-4 | D#3
06 | D-5 | E-2 | B-4 | D#3
07 | B-4 | E-2 | E-4 | D#3
08 | A-4 | C-2 | C-4 | C-3
09 | G-4 | C-2 | E-4 | D#3
10 | A-4 | C-2 | G-4 | D#3
11 | ... | C-2 | E-4 | D#3
12 | B-4 | D-2 | D-4 | D-3
13 | A-4 | D-2 | F#4 | D#3
14 | G-4 | D-2 | A-4 | D#3
15 | F#4 | D-2 | D-4 | D#3

PATTERN "Fracas" 16
00 | E-5 | E-2 | E-4 | C-3
01 | ... | E-2 | G-4 | D#3
02 | D-5 | E-2 | B-4 | D#3
03 | B-4 | E-2 | E-4 | D#3
04 | C-5 | C-2 | C-4 | D-3
05 | B-4 | C-2 | E-4 | D#3
06 | A-4 | C-2 | A-4 | D#3
07 | G-4 | C-2 | C-4 | D#3
08 | F#4 | D-2 | D-4 | C-3
09 | G-4 | D-2 | F#4 | D#3
10 | A-4 | D-2 | A-4 | D#3
11 | B-4 | D-2 | D-4 | D#3
12 | G-4 | B-2 | B-3 | D-3
13 | F#4 | B-2 | D#4 | D#3
14 | E-4 | B-2 | F#4 | D#3
15 | D#4 | B-2 | B-3 | D#3

PLAYLIST
Assaut Assaut Fracas Assaut
`;
    },
  },

  // Thème d'Aventure et Plateforme Joyeuse (115-130 BPM, mélodie entraînante et rebondissante)
  adventure: {
    defaultBpm: 124,
    text(bpm, name) {
      return `NAME "${name}"
BPM ${bpm}
LOOP on 0

CHANNELS
Lead: pulse50 vol:0.8 pan:-0.1
Bass: triangle vol:0.85 pan:0
Chords: pulse25 vol:0.45 pan:0.25
Drums: noise vol:0.5 pan:0 drumkit

PATTERN "Plaine" 16
00 | C-4 | C-2 | E-4 | C-3
01 | ... | ... | G-4 | ...
02 | E-4 | G-2 | C-5 | D#3
03 | ... | ... | G-4 | ...
04 | G-4 | C-2 | E-4 | C-3
05 | ... | ... | G-4 | ...
06 | C-5 | G-2 | C-5 | D-3
07 | B-4 | ... | G-4 | ...
08 | A-4 | F-2 | F-4 | C-3
09 | ... | ... | A-4 | ...
10 | F-4 | C-2 | C-5 | D#3
11 | ... | ... | A-4 | ...
12 | G-4 | G-2 | D-4 | D-3
13 | ... | ... | G-4 | ...
14 | F-4 | D-2 | B-4 | D#3
15 | D-4 | ... | G-4 | ...

PATTERN "Colline" 16
00 | E-4 | A-2 | C-4 | C-3
01 | F-4 | ... | E-4 | ...
02 | G-4 | E-2 | A-4 | D#3
03 | ... | ... | E-4 | ...
04 | A-4 | F-2 | F-4 | C-3
05 | B-4 | ... | A-4 | ...
06 | C-5 | C-2 | C-5 | D-3
07 | ... | ... | A-4 | ...
08 | D-5 | G-2 | B-3 | C-3
09 | C-5 | ... | D-4 | ...
10 | B-4 | D-2 | G-4 | D#3
11 | A-4 | ... | D-4 | ...
12 | G-4 | G-2 | B-4 | D-3
13 | ... | ... | G-4 | ...
14 | ... | D-2 | D-5 | D#3
15 | ... | ... | G-4 | ...

PLAYLIST
Plaine Plaine Colline Plaine
`;
    },
  },

  // Thème Calme / Village / Taverne (95-110 BPM, doux et pastoral)
  calm: {
    defaultBpm: 100,
    text(bpm, name) {
      return `NAME "${name}"
BPM ${bpm}
LOOP on 0

CHANNELS
Lead: triangle vol:0.8 pan:0
Chords: pulse25 vol:0.45 pan:-0.2
Harp: pulse12 vol:0.4 pan:0.2
Drums: noise vol:0.3 pan:0 drumkit

PATTERN "Refuge" 16
00 | G-4 | G-3 | B-3 | C-3
01 | ... | B-3 | D-4 | ...
02 | B-4 | D-4 | G-4 | ...
03 | ... | B-3 | D-4 | ...
04 | D-5 | C-4 | E-4 | D-3
05 | ... | E-4 | G-4 | ...
06 | C-5 | G-4 | C-5 | ...
07 | ... | E-4 | G-4 | ...
08 | B-4 | D-4 | F#4 | C-3
09 | A-4 | F#4 | A-4 | ...
10 | G-4 | A-4 | D-5 | ...
11 | ... | F#4 | A-4 | ...
12 | A-4 | G-3 | B-3 | D-3
13 | ... | B-3 | D-4 | ...
14 | G-4 | D-4 | G-4 | ...
15 | ... | B-3 | D-4 | ...

PLAYLIST
Refuge Refuge
`;
    },
  },

  // Fanfare de Victoire
  victory: {
    defaultBpm: 130,
    text(bpm, name) {
      return `NAME "${name}"
BPM ${bpm}
LOOP off 0

CHANNELS
Lead: pulse50 vol:0.85 pan:0
Harmony: pulse25 vol:0.6 pan:0.2
Bass: triangle vol:0.8 pan:0
Drums: noise vol:0.55 pan:0 drumkit

PATTERN "Fanfare" 16
00 | C-4 | E-4 | C-2 | C-3
01 | C-4 | E-4 | C-2 | D#3
02 | C-4 | E-4 | C-2 | D#3
03 | C-4 | E-4 | C-2 | D#3
04 | G-4 | B-4 | G-2 | D-3
05 | ... | ... | ... | ...
06 | G-4 | B-4 | G-2 | C-3
07 | ... | ... | ... | ...
08 | A-4 | C-5 | A-2 | C-3
09 | B-4 | D-5 | B-2 | D#3
10 | C-5:4 | E-5:4 | C-3:4 | D-3
11 | ... | ... | ... | ...
12 | ... | ... | ... | ...
13 | ... | ... | ... | ...
14 | ... | ... | ... | ...
15 | ... | ... | ... | ...

PLAYLIST
Fanfare
`;
    },
  },

  // Game Over / Défaite
  gameover: {
    defaultBpm: 75,
    text(bpm, name) {
      return `NAME "${name}"
BPM ${bpm}
LOOP off 0

CHANNELS
Lead: pulse50 vol:0.8 pan:0
Bass: triangle vol:0.75 pan:0

PATTERN "Defaite" 16
00 | C-4 | C-2
01 | ... | ...
02 | B-3 | B-1
03 | ... | ...
04 | Bb3 | Bb1
05 | ... | ...
06 | A-3 | A-1
07 | ... | ...
08 | Ab3 | Ab1
09 | ... | ...
10 | G-3 | G-1
11 | ... | ...
12 | F-3:4 | F-1:4
13 | ... | ...
14 | ... | ...
15 | ... | ...

PLAYLIST
Defaite
`;
    },
  },
};

/**
 * Genere une partition chiptune complete au format tracker ASCII
 */
export function generateSongData(description, options = {}) {
  const norm = normalizeDesc(description);
  const name = options.name || 'Song';

  // Extraction d'un tempo explicite si indique (ex: "90 BPM", "145 bpm", "tempo 120")
  let bpm = options.bpm;
  if (!bpm) {
    const bpmMatch = norm.match(/\b(\d{2,3})\s*(?:bpm|tempo)\b/) || norm.match(/\b(?:bpm|tempo)\s*[:=]?\s*(\d{2,3})\b/);
    if (bpmMatch) {
      bpm = Number(bpmMatch[1]);
    }
  }

  let styleKey = 'adventure';
  if (norm.includes('donjon') || norm.includes('dungeon') || norm.includes('sombre') || norm.includes('inquietant') || norm.includes('mystere') || norm.includes('grotte') || norm.includes('crypte')) {
    styleKey = 'dungeon';
  } else if (norm.includes('combat') || norm.includes('battle') || norm.includes('boss') || norm.includes('epique') || norm.includes('action') || norm.includes('rapide')) {
    styleKey = 'battle';
  } else if (norm.includes('calme') || norm.includes('village') || norm.includes('paisible') || norm.includes('taverne') || norm.includes('doux') || norm.includes('repos')) {
    styleKey = 'calm';
  } else if (norm.includes('victoire') || norm.includes('victory') || norm.includes('triomphe') || norm.includes('fanfare') || norm.includes('termine') || norm.includes('gagne')) {
    styleKey = 'victory';
  } else if (norm.includes('defaite') || norm.includes('game over') || norm.includes('gameover') || norm.includes('mort') || norm.includes('triste')) {
    styleKey = 'gameover';
  }

  const styleDef = SONG_STYLES[styleKey] || SONG_STYLES.adventure;
  const finalBpm = bpm || styleDef.defaultBpm;
  const text = styleDef.text(finalBpm, name);

  return {
    name,
    bpm: finalBpm,
    style: styleKey,
    text,
  };
}

// ============================================================================
// 3. GENERATEUR DE MODELES 3D VOXEL OU SELECTION CC0 (H4 - CRITERE 3)
// ============================================================================

/**
 * Modeles 3D voxels predefinis (slices le long de l'axe Y)
 */
const VOXEL_TEMPLATES = {
  // Coffre aux trésors en bois avec ferrures dorées (6x5x5 voxels)
  chest: {
    width: 6,
    height: 5,
    depth: 5,
    slices: [
      // Y=0 : Fond solide
      ['eeeeee', 'eeeeee', 'eeeeee', 'eeeeee', 'eeeeee'],
      // Y=1 : Parois et intérieur
      ['e3333e', 'e0000e', 'e0000e', 'e0000e', 'e3333e'],
      // Y=2 : Serrure et côtés
      ['e3443e', 'e0440e', 'e0000e', 'e0000e', 'e3333e'],
      // Y=3 : Couvercle bas
      ['eeeeee', 'e3333e', 'e3333e', 'e3333e', 'eeeeee'],
      // Y=4 : Haut voûté
      ['.eeee.', '.e33e.', '.e33e.', '.e33e.', '.eeee.'],
    ],
  },

  // Arbre voxel stylisé (6x8x6 voxels)
  tree: {
    width: 6,
    height: 8,
    depth: 6,
    slices: [
      // Y=0..2 : Tronc
      ['......', '..ee..', '..ee..', '..ee..', '..ee..', '......'],
      ['......', '..ee..', '..ee..', '..ee..', '..ee..', '......'],
      ['......', '..ee..', '..ee..', '..ee..', '..ee..', '......'],
      // Y=3..6 : Feuillage
      ['.6666.', '665566', '655556', '655556', '665566', '.6666.'],
      ['665566', '655556', '555555', '555555', '655556', '665566'],
      ['665566', '655556', '555555', '555555', '655556', '665566'],
      ['.6666.', '655556', '555555', '555555', '655556', '.6666.'],
      // Y=7 : Cime
      ['......', '.6666.', '.6556.', '.6556.', '.6666.', '......'],
    ],
  },

  // Caisse en bois (4x4x4 voxels)
  crate: {
    width: 4,
    height: 4,
    depth: 4,
    slices: [
      ['eeee', 'e33e', 'e33e', 'eeee'],
      ['e33e', '3443', '3443', 'e33e'],
      ['e33e', '3443', '3443', 'e33e'],
      ['eeee', 'e33e', 'e33e', 'eeee'],
    ],
  },

  // Baril en bois (4x5x4 voxels)
  barrel: {
    width: 4,
    height: 5,
    depth: 4,
    slices: [
      ['.ee.', 'eeee', 'eeee', '.ee.'],
      ['.33.', '3ee3', '3ee3', '.33.'],
      ['.ee.', 'e33e', 'e33e', '.ee.'],
      ['.33.', '3ee3', '3ee3', '.33.'],
      ['.ee.', 'eeee', 'eeee', '.ee.'],
    ],
  },

  // Torche médiévale (2x6x2 voxels)
  torch: {
    width: 2,
    height: 6,
    depth: 2,
    slices: [
      ['ee', 'ee'],
      ['ee', 'ee'],
      ['ee', 'ee'],
      ['ee', 'ee'],
      ['33', '33'],
      ['44', '4c'],
    ],
  },

  // Totem de pierre sculpté (4x8x4 voxels)
  totem: {
    width: 4,
    height: 8,
    depth: 4,
    slices: [
      ['ffff', 'feef', 'feef', 'ffff'],
      ['feef', 'edde', 'edde', 'feef'],
      ['fddf', 'd44d', 'dddd', 'fddf'],
      ['feef', 'edde', 'edde', 'feef'],
      ['ffff', 'feef', 'feef', 'ffff'],
      ['fddf', 'dbbd', 'dddd', 'fddf'],
      ['feef', 'edde', 'edde', 'feef'],
      ['ffff', 'feef', 'feef', 'ffff'],
    ],
  },

  // Pilier de pierre (4x8x4 voxels)
  pillar: {
    width: 4,
    height: 8,
    depth: 4,
    slices: [
      ['ffff', 'ffff', 'ffff', 'ffff'],
      ['.ff.', 'ffff', 'ffff', '.ff.'],
      ['.dd.', 'dddd', 'dddd', '.dd.'],
      ['.dd.', 'dddd', 'dddd', '.dd.'],
      ['.dd.', 'dddd', 'dddd', '.dd.'],
      ['.dd.', 'dddd', 'dddd', '.dd.'],
      ['.ff.', 'ffff', 'ffff', '.ff.'],
      ['ffff', 'ffff', 'ffff', 'ffff'],
    ],
  },
};

/**
 * Genere ou selectionne un modele 3D (preset CC0 ou tranches voxels)
 */
export function generateModelData(description, options = {}) {
  const norm = normalizeDesc(description);
  const name = options.name || 'Model3D';

  // 1. Verification d'une correspondance avec un modele CC0 (Decision F4 / H4)
  if (options.preferCC0 !== false) {
    if (norm.includes('aventurier') || norm.includes('adventurer') || norm.includes('explorateur')) {
      return { name, preset: 'cc0_adventurer' };
    }
    if (norm.includes('chevalier') || norm.includes('knight') || norm.includes('guerrier') || norm.includes('paladin')) {
      return { name, preset: 'cc0_knight' };
    }
    if (options.preferCC0 === true) {
      if (norm.includes('caisse') || norm.includes('crate')) {
        return { name, preset: 'cc0_crate' };
      }
      if (norm.includes('baril') || norm.includes('barrel') || norm.includes('tonneau')) {
        return { name, preset: 'cc0_barrel' };
      }
    }
  }

  // 2. Modeles voxels par tranches Y
  let tpl = VOXEL_TEMPLATES.chest;
  if (norm.includes('arbre') || norm.includes('tree') || norm.includes('vegetation') || norm.includes('foret')) {
    tpl = VOXEL_TEMPLATES.tree;
  } else if (norm.includes('caisse') || norm.includes('crate') || norm.includes('box')) {
    tpl = VOXEL_TEMPLATES.crate;
  } else if (norm.includes('baril') || norm.includes('barrel') || norm.includes('tonneau')) {
    tpl = VOXEL_TEMPLATES.barrel;
  } else if (norm.includes('torche') || norm.includes('torch') || norm.includes('flambeau')) {
    tpl = VOXEL_TEMPLATES.torch;
  } else if (norm.includes('totem') || norm.includes('statue') || norm.includes('monolithe')) {
    tpl = VOXEL_TEMPLATES.totem;
  } else if (norm.includes('pilier') || norm.includes('pillar') || norm.includes('colonne')) {
    tpl = VOXEL_TEMPLATES.pillar;
  }

  return {
    name,
    width: tpl.width,
    height: tpl.height,
    depth: tpl.depth,
    slices: JSON.parse(JSON.stringify(tpl.slices)),
  };
}

// ============================================================================
// 4. GENERATEUR DE SONS SFXR DEPUIS UNE DESCRIPTION (H4 - CRITERE 4)
// ============================================================================

/**
 * Mappe une description en langage naturel vers un preset sfxr avec pitch, volume et seed adaptes
 */
export function generateSoundData(description, options = {}) {
  const norm = normalizeDesc(description);
  const name = options.name || 'Sound';

  let preset = options.preset;
  if (!preset || !SOUND_PRESETS.includes(preset)) {
    if (norm.includes('saut') || norm.includes('jump') || norm.includes('hop') || norm.includes('bondir') || norm.includes('rebond')) {
      preset = 'jump';
    } else if (norm.includes('piece') || norm.includes('coin') || norm.includes('ding') || norm.includes('gemme') || norm.includes('or') || norm.includes('tintement')) {
      preset = 'coin';
    } else if (norm.includes('coup') || norm.includes('hit') || norm.includes('degat') || norm.includes('blessure') || norm.includes('choc') || norm.includes('impact') || norm.includes('touche')) {
      preset = 'hit';
    } else if (norm.includes('explosion') || norm.includes('boum') || norm.includes('boom') || norm.includes('bombe') || norm.includes('fracas') || norm.includes('detruit')) {
      preset = 'explosion';
    } else if (norm.includes('laser') || norm.includes('tir') || norm.includes('shoot') || norm.includes('blaster') || norm.includes('projectile') || norm.includes('rayon')) {
      preset = 'laser';
    } else if (norm.includes('powerup') || norm.includes('bonus') || norm.includes('potion') || norm.includes('amelioration') || norm.includes('magique') || norm.includes('gain') || norm.includes('levelup')) {
      preset = 'powerup';
    } else if (norm.includes('blip') || norm.includes('bip') || norm.includes('bouton') || norm.includes('clic') || norm.includes('menu') || norm.includes('select')) {
      preset = 'blip';
    } else if (norm.includes('portail') || norm.includes('portal') || norm.includes('teleport') || norm.includes('porte') || norm.includes('dimension') || norm.includes('warp')) {
      preset = 'portal';
    } else {
      preset = 'blip';
    }
  }

  // Ajustement de la hauteur (pitch)
  let pitch = options.pitch != null ? options.pitch : 1;
  if (options.pitch == null) {
    if (norm.includes('leger') || norm.includes('aigu') || norm.includes('petit') || norm.includes('rapide') || norm.includes('high') || norm.includes('fin')) {
      pitch = 1.35;
    } else if (norm.includes('lourd') || norm.includes('grave') || norm.includes('profond') || norm.includes('puissant') || norm.includes('gros') || norm.includes('low') || norm.includes('heavy')) {
      pitch = 0.7;
    }
  }

  // Ajustement du volume
  let volume = options.volume != null ? options.volume : 0.65;
  if (options.volume == null) {
    if (norm.includes('doux') || norm.includes('discret') || norm.includes('faible') || norm.includes('soft') || norm.includes('silencieux') || norm.includes('leger')) {
      volume = 0.4;
    } else if (norm.includes('fort') || norm.includes('puissant') || norm.includes('violent') || norm.includes('loud') || norm.includes('assourdissant') || norm.includes('lourd') || norm.includes('enorme')) {
      volume = 0.9;
    }
  }

  // Calcul d'une graine (seed) deterministe basee sur la description
  let seed = 0;
  for (let i = 0; i < norm.length; i++) {
    seed = (seed * 31 + norm.charCodeAt(i)) >>> 0;
  }

  return {
    name,
    preset,
    volume,
    pitch,
    seed,
  };
}

// ============================================================================
// 5. POINT D'ENTREE UNIFIE DE GENERATION DE RESSOURCES
// ============================================================================

/**
 * Genere n'importe quelle ressource PixelForge selon son type et sa description
 */
export function generateAsset(type, description, options = {}) {
  const normType = String(type || '').toLowerCase().trim();
  switch (normType) {
    case 'sprite':
      return { type: 'sprite', data: generateSpriteData(description, options) };
    case 'song':
    case 'music':
      return { type: 'song', data: generateSongData(description, options) };
    case 'model':
    case 'model3d':
    case 'voxel':
      return { type: 'model', data: generateModelData(description, options) };
    case 'sound':
    case 'sfx':
      return { type: 'sound', data: generateSoundData(description, options) };
    default:
      throw new Error(`Type de ressource a generer inconnu : "${type}" (valeurs acceptees: sprite, song, model, sound)`);
  }
}
