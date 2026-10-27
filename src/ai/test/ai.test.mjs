/**
 * Tests unitaires pour l'Assistant IA, l'extracteur de code et la base de connaissances
 */

import assert from 'node:assert';
import { extractCodeBlocks } from '../client.js';
import { buildSystemPrompt, PIXELFORGE_SCRIPT_API, BLUEPRINT_SCHEMA_GUIDE } from '../knowledge.js';
import { GAMEDESIGN_PRINCIPLES, SCRIPT_TEMPLATES } from '../gamedesign.js';
import {
  AGENT_TOOLS,
  parseJsonPlan,
  executeTool,
  executePlan,
  buildAgentSystemPrompt,
  runAgent,
  generateAsset,
  generateSpriteData,
  generateSongData,
  generateModelData,
  generateSoundData,
  generateFullGame,
  generateGameDesignDocument,
  playtestGame,
  autoFixGame,
  runPlaytestAndFix,
  COPILOT_SUGGESTIONS,
  COPILOT_ALLOWED_TOOLS,
} from '../agent.js';
import { parseSongText } from '../../core/ops/song-text.js';
import { validateProject } from '../../core/ops/validate.js';
import { createEmptyProject, createMap, normalizeProject } from '../../core/project.js';

console.log('=== Tests Assistant IA & Game Design ===');

// 1. Verification de la base de connaissances Game Design
assert.ok(GAMEDESIGN_PRINCIPLES.includes('COYOTE TIME'), 'Game design principles must include Coyote Time');
assert.ok(GAMEDESIGN_PRINCIPLES.includes('JUMP BUFFERING'), 'Game design principles must include Jump Buffering');
assert.ok(GAMEDESIGN_PRINCIPLES.includes('VARIABLE'), 'Game design principles must include Variable jump');
assert.ok(GAMEDESIGN_PRINCIPLES.includes('KISHOTENKETSU'), 'Game design principles must include Kishotenketsu');

// 2. Verification des templates de script
assert.ok(SCRIPT_TEMPLATES.platformerPlayer.includes('coyoteTimer'), 'Platformer template must implement coyoteTimer');
assert.ok(SCRIPT_TEMPLATES.patrolEnemy.includes('on(\'collide\''), 'Patrol enemy must handle collide');
assert.ok(SCRIPT_TEMPLATES.collectibleCoin.includes('Math.sin'), 'Coin template must implement float oscillation');

// 3. Verification du constructeur de System Prompt
const promptFull = buildSystemPrompt({
  includeGameDesign: true,
  includeBlueprints: true,
  activeObject: { name: 'Hero', physics: { gravity: true } },
  activeScript: "on('create', () => game.camera.follow(self));",
});

assert.ok(promptFull.includes('PixelForge Studio'), 'System prompt must identify engine');
assert.ok(promptFull.includes('COYOTE TIME'), 'System prompt must include game design');
assert.ok(promptFull.includes('BLUEPRINT'), 'System prompt must include blueprint guide');
assert.ok(promptFull.includes('Hero'), 'System prompt must include active object context');
assert.ok(promptFull.includes('game.camera.follow'), 'System prompt must include active script');

// Verification stricte de l'absence totale d'emojis dans le prompt et les templates
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
assert.ok(!emojiRegex.test(promptFull), 'System prompt must not contain any emoji');
assert.ok(!emojiRegex.test(GAMEDESIGN_PRINCIPLES), 'Game design doc must not contain any emoji');

// 4. Verification de l'extracteur de code et de JSON
const sampleAssistantText = `
Voici une proposition pour votre joueur avec saut pro :

\`\`\`js
let coyoteTimer = 0;
on('update', () => {
  if (self.onGround) coyoteTimer = 100;
});
\`\`\`

Et voici le graphe Blueprint equivalent :

\`\`\`json
{
  "version": 1,
  "nodes": [
    { "id": "n1", "type": "pf_on_update" }
  ],
  "links": []
}
\`\`\`

Bon developpement !
`;

const extracted = extractCodeBlocks(sampleAssistantText);
assert.strictEqual(extracted.jsBlocks.length, 1, 'Must extract 1 JS block');
assert.ok(extracted.jsBlocks[0].includes('coyoteTimer = 100'), 'Extracted JS matches content');
assert.strictEqual(extracted.jsonBlocks.length, 1, 'Must extract 1 JSON block');
assert.strictEqual(extracted.jsonBlocks[0].version, 1, 'Extracted JSON parses correctly');
assert.strictEqual(extracted.jsonBlocks[0].nodes[0].type, 'pf_on_update', 'Extracted JSON node matches');

// 5. Verification du parseur de plan JSON (repli petits modeles)
const planSample1 = `
Voici le plan pour ajouter votre gemme :
\`\`\`json
{
  "plan": [
    { "tool": "upsert_sprite", "args": { "name": "Gem", "frames": [["..33..", "..33.."]] } },
    { "tool": "upsert_object", "args": { "name": "Gem", "sprite": "Gem" } }
  ]
}
\`\`\`
`;
const plan1 = parseJsonPlan(planSample1);
assert.ok(Array.isArray(plan1), 'parseJsonPlan doit renvoyer un tableau');
assert.strictEqual(plan1.length, 2, 'parseJsonPlan doit extraire 2 actions');
assert.strictEqual(plan1[0].tool, 'upsert_sprite');
assert.strictEqual(plan1[0].args.name, 'Gem');
assert.strictEqual(plan1[1].tool, 'upsert_object');

// Test plan avec tableau direct sans wrapper
const planSample2 = `
\`\`\`json
[
  { "name": "add_sound", "parameters": { "name": "ping", "preset": "coin" } }
]
\`\`\`
`;
const plan2 = parseJsonPlan(planSample2);
assert.ok(Array.isArray(plan2), 'parseJsonPlan direct array doit renvoyer un tableau');
assert.strictEqual(plan2.length, 1);
assert.strictEqual(plan2[0].tool, 'add_sound');
assert.strictEqual(plan2[0].args.name, 'ping');

// Test texte sans plan -> renvoie null
assert.strictEqual(parseJsonPlan('Voici une reponse purement textuelle.'), null);

// 6. Verification de executeTool et executePlan sur un projet
const testProject = createEmptyProject();
const spriteResult = await executeTool(testProject, 'upsert_sprite', {
  name: 'CoinSprite',
  frames: [
    ['.44.', '4444', '4444', '.44.']
  ],
});
assert.ok(spriteResult.includes('Created sprite "CoinSprite"'), 'upsert_sprite doit creer le sprite');
assert.strictEqual(testProject.sprites.length, 1);
assert.strictEqual(testProject.sprites[0].name, 'CoinSprite');

const objResult = await executeTool(testProject, 'upsert_object', {
  name: 'Coin',
  sprite: 'CoinSprite',
  physics: { enabled: true, gravity: false, immovable: true, collideMap: false },
  code: "on('overlap', 'Player', () => { game.score += 10; self.destroy(); });",
});
assert.ok(objResult.includes('Created object "Coin"'), 'upsert_object doit creer l\'objet');
assert.strictEqual(testProject.objects.length, 1);
assert.strictEqual(testProject.objects[0].name, 'Coin');

// 7. Verification du hook de confirmation lors d'un ecrasement (Decision V6)
let confirmCalled = false;
try {
  await executeTool(testProject, 'upsert_sprite', {
    name: 'CoinSprite',
    frames: [['44', '44']],
  }, {
    confirm: async ({ type, name, action }) => {
      confirmCalled = true;
      assert.strictEqual(type, 'sprite');
      assert.strictEqual(name, 'CoinSprite');
      assert.strictEqual(action, 'overwrite');
      return false; // L'utilisateur refuse l'ecrasement
    },
  });
  assert.fail('L\'ecrasement refuse aurait du lever une erreur');
} catch (err) {
  assert.ok(err.message.includes('Action annulee par l\'utilisateur'), 'Erreur attendue sur refus');
}
assert.strictEqual(confirmCalled, true, 'Le hook confirm doit etre appele sur ressource existante');

// 8. Critere d'acceptation H2 :
// "Ajoute une piece qui rapporte 10 points et place-en 5 sur la carte"
// -> cree le sprite, l'objet, son script et les 5 instances ; Ctrl+Z annule tout.

// Creation d'un store minimal avec pile undo/redo identique a src/core/store.js
function createMockStore(initProject) {
  const undoStack = [];
  let currentProject = normalizeProject(JSON.parse(JSON.stringify(initProject)));

  return {
    get project() { return currentProject; },
    get undoStack() { return undoStack; },
    update(fn) {
      undoStack.push(JSON.stringify(currentProject));
      fn(currentProject);
    },
    undo() {
      if (!undoStack.length) return false;
      currentProject = normalizeProject(JSON.parse(undoStack.pop()));
      return true;
    },
  };
}

// Creation d'un projet avec une seule carte "Main"
const baseProj = createEmptyProject();
baseProj.maps = [createMap('Main', 20, 10, 16)];
baseProj.settings.startMapId = baseProj.maps[0].id;

const store = createMockStore(baseProj);
assert.strictEqual(store.project.sprites.length, 0);
assert.strictEqual(store.project.objects.length, 0);
assert.strictEqual(store.project.maps[0].entities.length, 0);

// Plan simule emis par l'IA autonome pour la requete
const aiPlan = [
  {
    tool: 'upsert_sprite',
    args: {
      name: 'Piece',
      frames: [
        ['.44.', '4444', '4444', '.44.'],
      ],
    },
  },
  {
    tool: 'upsert_object',
    args: {
      name: 'Piece',
      sprite: 'Piece',
      physics: { enabled: true, gravity: false, immovable: true, collideMap: false },
      code: "on('overlap', 'Player', () => { game.score += 10; game.playSound('coin'); self.destroy(); });",
    },
  },
  {
    tool: 'place_entities',
    args: {
      map: 'Main',
      entities: [
        { object: 'Piece', x: 32, y: 64 },
        { object: 'Piece', x: 64, y: 64 },
        { object: 'Piece', x: 96, y: 64 },
        { object: 'Piece', x: 128, y: 64 },
        { object: 'Piece', x: 160, y: 64 },
      ],
    },
  },
];

// Execution atomique telle qu'effectuee par runAgent
const workingCopy = JSON.parse(JSON.stringify(store.project));
await executePlan(workingCopy, aiPlan);

// Application en une seule operation store.update
store.update((p) => {
  for (const k of Object.keys(p)) {
    if (!(k in workingCopy)) delete p[k];
  }
  Object.assign(p, JSON.parse(JSON.stringify(workingCopy)));
});

// Verifications post-execution
assert.strictEqual(store.project.sprites.length, 1, 'Sprite Piece doit etre cree');
assert.strictEqual(store.project.sprites[0].name, 'Piece');
assert.strictEqual(store.project.objects.length, 1, 'Objet Piece doit etre cree');
assert.strictEqual(store.project.objects[0].name, 'Piece');
assert.ok(store.project.objects[0].script.code.includes('game.score += 10'), 'Script doit incrementer le score de 10');
assert.strictEqual(store.project.maps[0].entities.length, 5, 'Exactement 5 entites doivent etre placees');
assert.strictEqual(store.undoStack.length, 1, 'L\'action complete doit produire EXACTEMENT une seule entree dans l\'historique d\'annulation');

// Annulation par Ctrl+Z (store.undo())
const undid = store.undo();
assert.strictEqual(undid, true, 'store.undo() doit reussir');
assert.strictEqual(store.project.sprites.length, 0, 'Le sprite cree doit etre completement annule');
assert.strictEqual(store.project.objects.length, 0, 'L\'objet cree doit etre completement annule');
assert.strictEqual(store.project.maps[0].entities.length, 0, 'Les 5 instances doivent etre completement annulees');

// Verification system prompt de l'agent
const agentPrompt = buildAgentSystemPrompt(store.project);
assert.ok(agentPrompt.includes('PixelForge Studio'), 'System prompt agent doit mentionner PixelForge');
assert.ok(agentPrompt.includes('upsert_sprite'), 'System prompt agent doit mentionner les outils');
const emojiAgentRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
assert.ok(!emojiAgentRegex.test(agentPrompt), 'System prompt agent ne doit contenir aucun emoji');

// 9. Verification de l'interruption (signal d'arret) sans laisser le projet a moitie modifie
const abortProj = createEmptyProject();
abortProj.maps = [createMap('Main', 20, 10, 16)];
const storeAbort = createMockStore(abortProj);

const ac = new AbortController();
ac.abort(); // Interrompu des le demarrage

try {
  await runAgent({
    project: storeAbort.project,
    prompt: 'Cree une piece et place-en 5 sur la carte',
    store: storeAbort,
    signal: ac.signal,
  });
  assert.fail('Une interruption aurait du arreter l\'execution');
} catch (err) {
  assert.ok(err.message.includes('annulee'), 'L\'erreur doit mentionner l\'annulation');
}

// Verification que le store n'a JAMAIS ete modifie (zero entree d'annulation, zero ressource parasite)
assert.strictEqual(storeAbort.undoStack.length, 0, 'Aucune modification ne doit etre validee en cas d\'arret');
assert.strictEqual(storeAbort.project.sprites.length, 0, 'Aucun sprite ne doit persister en cas d\'arret');
assert.strictEqual(storeAbort.project.objects.length, 0, 'Aucun objet ne doit persister en cas d\'arret');
assert.strictEqual(storeAbort.project.maps[0].entities.length, 0, 'Aucune entite ne doit persister en cas d\'arret');

// 10. Tests Phase H (H4 - Issue #92) : Generation de ressources par l'IA (sprites, musiques, modeles 3D, sons)

// 10.1 Sprites en notation textuelle avec palette Sweetie 16 et animations
const heroSprite = generateSpriteData('chevalier en armure avec epee', { name: 'Knight' });
assert.strictEqual(heroSprite.name, 'Knight');
assert.strictEqual(heroSprite.width, 16);
assert.strictEqual(heroSprite.height, 16);
assert.ok(Array.isArray(heroSprite.frames) && heroSprite.frames.length >= 4, 'Le sprite chevalier doit comporter au moins 4 frames');
for (const frame of heroSprite.frames) {
  assert.strictEqual(frame.length, 16, 'Chaque frame doit comporter exactement 16 lignes');
  for (const row of frame) {
    assert.strictEqual(row.length, 16, 'Chaque ligne doit comporter exactement 16 caracteres');
    assert.ok(/^[0-9a-f.]+$/.test(row), 'Chaque caractere doit appartenir a la palette Sweetie 16 ou etre transparent (.)');
  }
}
const idleAnim = heroSprite.animations.find((a) => a.name === 'idle');
assert.ok(idleAnim, 'Le sprite chevalier doit posseder une animation idle');
const walkAnim = heroSprite.animations.find((a) => a.name === 'walk' || a.name === 'run');
assert.ok(walkAnim, 'Le sprite chevalier doit posseder une animation walk/run');
const jumpAnim = heroSprite.animations.find((a) => a.name === 'jump');
assert.ok(jumpAnim, 'Le sprite chevalier doit posseder une animation jump');

// Autres archetypes de sprites
const slimeSprite = generateSpriteData('slime vert rebondissant');
assert.ok(slimeSprite.frames.length >= 4);
const coinSprite = generateSpriteData('piece d or tournoyante');
assert.ok(coinSprite.animations.some((a) => a.name === 'idle'));
const batSprite = generateSpriteData('chauve-souris volante');
assert.ok(batSprite.animations.some((a) => a.name === 'fly' || a.name === 'idle'));
const chestSprite = generateSpriteData('coffre aux tresors');
assert.ok(chestSprite.frames.length >= 2);

// 10.2 Musiques au format tracker ASCII avec styles et BPM deduits
const dungeonSong = generateSongData('theme de donjon inquietant, 90 BPM', { name: 'Dungeon' });
assert.strictEqual(dungeonSong.name, 'Dungeon');
assert.strictEqual(dungeonSong.bpm, 90);
assert.strictEqual(dungeonSong.style, 'dungeon');
assert.ok(dungeonSong.text.includes('BPM 90'));
assert.ok(dungeonSong.text.includes('CHANNELS'));
assert.ok(dungeonSong.text.includes('PATTERN'));
assert.ok(dungeonSong.text.includes('PLAYLIST'));
const parsedDungeon = parseSongText(dungeonSong.text, 'Dungeon');
assert.strictEqual(parsedDungeon.bpm, 90);
assert.ok(parsedDungeon.channels.length >= 3, 'Le theme de donjon doit comporter au moins 3 canaux');
assert.ok(parsedDungeon.patterns.length >= 1, 'Le theme de donjon doit comporter des patterns');

const battleSong = generateSongData('combat epique 145 BPM', { name: 'BossBattle' });
assert.strictEqual(battleSong.bpm, 145);
assert.strictEqual(battleSong.style, 'battle');
const parsedBattle = parseSongText(battleSong.text, 'BossBattle');
assert.strictEqual(parsedBattle.bpm, 145);

const villageSong = generateSongData('ambiance de village calme et paisible', { name: 'Village' });
assert.strictEqual(villageSong.bpm, 100);
assert.strictEqual(villageSong.style, 'calm');

const victorySong = generateSongData('fanfare de victoire', { name: 'Win' });
assert.strictEqual(victorySong.style, 'victory');

// 10.3 Modeles 3D : tranches voxels et selection de modeles CC0
const adventurerModel = generateModelData('aventurier');
assert.strictEqual(adventurerModel.preset, 'cc0_adventurer', 'Le modele aventurier doit utiliser le preset CC0 correspondant');

const knightModel = generateModelData('chevalier');
assert.strictEqual(knightModel.preset, 'cc0_knight', 'Le modele chevalier doit utiliser le preset CC0 correspondant');

const chestModel = generateModelData('coffre en bois avec ferrures dorees', { name: 'Chest' });
assert.strictEqual(chestModel.name, 'Chest');
assert.strictEqual(chestModel.width, 6);
assert.strictEqual(chestModel.height, 5);
assert.strictEqual(chestModel.depth, 5);
assert.ok(Array.isArray(chestModel.slices) && chestModel.slices.length === 5, 'Le coffre doit comporter 5 tranches Y');

const treeModel = generateModelData('arbre de foret', { name: 'Tree' });
assert.strictEqual(treeModel.height, 8);
assert.strictEqual(treeModel.slices.length, 8);

// 10.4 Sons sfxr a partir d'une description naturelle
const lightJumpSound = generateSoundData('un saut leger', { name: 'JumpLight' });
assert.strictEqual(lightJumpSound.name, 'JumpLight');
assert.strictEqual(lightJumpSound.preset, 'jump');
assert.ok(lightJumpSound.pitch > 1.0, 'Un saut leger doit avoir un pitch aigu (> 1.0)');

const heavyExplosionSound = generateSoundData('une explosion lourde et assourdissante', { name: 'Boom' });
assert.strictEqual(heavyExplosionSound.preset, 'explosion');
assert.ok(heavyExplosionSound.pitch < 1.0, 'Une explosion lourde doit avoir un pitch grave (< 1.0)');
assert.ok(heavyExplosionSound.volume >= 0.8, 'Une explosion assourdissante doit avoir un volume eleve (>= 0.8)');

const softCoinSound = generateSoundData('un tintement de piece doux et discret', { name: 'CoinSoft' });
assert.strictEqual(softCoinSound.preset, 'coin');
assert.ok(softCoinSound.volume <= 0.5, 'Un son doux et discret doit avoir un volume modere (<= 0.5)');

const fastLaserSound = generateSoundData('un tir laser rapide', { name: 'LaserFast' });
assert.strictEqual(fastLaserSound.preset, 'laser');
assert.ok(fastLaserSound.pitch > 1.0);

// 10.5 Outil generate_asset execute directement sur un projet
const genProject = createEmptyProject();
genProject.maps = [createMap('Main', 20, 10, 16)];
genProject.settings.startMapId = genProject.maps[0].id;

// Creation d'un sprite en une seule demande
const sprRes = await executeTool(genProject, 'generate_asset', {
  type: 'sprite',
  name: 'Slime',
  description: 'slime vert rebondissant',
});
assert.ok(sprRes.includes('Slime'), 'L\'outil doit confirmer la creation du sprite');
assert.strictEqual(genProject.sprites.length, 1);
assert.strictEqual(genProject.sprites[0].name, 'Slime');

// Creation d'une musique en une seule demande
const sngRes = await executeTool(genProject, 'generate_asset', {
  type: 'song',
  name: 'DonjonTheme',
  description: 'theme de donjon inquietant, 90 BPM',
});
assert.ok(sngRes.includes('DonjonTheme'), 'L\'outil doit confirmer la creation de la musique');
assert.strictEqual(genProject.songs.length, 1);
assert.strictEqual(genProject.songs[0].name, 'DonjonTheme');
assert.strictEqual(genProject.songs[0].bpm, 90);

// Creation d'un modele 3D en une seule demande
const modRes = await executeTool(genProject, 'generate_asset', {
  type: 'model',
  name: 'Coffre3D',
  description: 'coffre en bois avec serrure',
});
assert.ok(modRes.includes('Coffre3D'), 'L\'outil doit confirmer la creation du modele 3D');
assert.strictEqual(genProject.models.length, 1);
assert.strictEqual(genProject.models[0].name, 'Coffre3D');

// Creation d'un son en une seule demande
const sndRes = await executeTool(genProject, 'generate_asset', {
  type: 'sound',
  name: 'SautLeger',
  description: 'un saut leger',
});
assert.ok(sndRes.includes('SautLeger'), 'L\'outil doit confirmer la creation de l\'effet sonore');
assert.strictEqual(genProject.sounds.length, 1);
assert.strictEqual(genProject.sounds[0].name, 'SautLeger');
assert.strictEqual(genProject.sounds[0].sfx.preset, 'jump');
assert.ok(genProject.sounds[0].sfx.pitch > 1.0);

// 10.6 Repli transparent : creation d'une ressource via upsert_* avec simple description
await executeTool(genProject, 'upsert_sprite', {
  name: 'HeroAuto',
  description: 'chevalier avec animations de marche et saut',
});
assert.strictEqual(genProject.sprites.length, 2);
assert.strictEqual(genProject.sprites[1].name, 'HeroAuto');

await executeTool(genProject, 'upsert_song', {
  name: 'CombatAuto',
  description: 'combat epique 145 BPM',
});
assert.strictEqual(genProject.songs.length, 2);
assert.strictEqual(genProject.songs[1].name, 'CombatAuto');
assert.strictEqual(genProject.songs[1].bpm, 145);

await executeTool(genProject, 'add_sound', {
  name: 'BoumAuto',
  description: 'une explosion lourde et assourdissante',
});
assert.strictEqual(genProject.sounds.length, 2);
assert.strictEqual(genProject.sounds[1].name, 'BoumAuto');
assert.strictEqual(genProject.sounds[1].sfx.preset, 'explosion');

// 10.7 Validation complete du projet genere (0 erreur)
const issues = validateProject(genProject);
const errors = issues.filter((i) => i.level === 'error');
assert.strictEqual(errors.length, 0, 'Le projet comportant les ressources generees ne doit avoir aucune erreur de validation');

// 10.8 Verification de l'absence totale d'emojis dans generators.js et le system prompt
import { readFileSync } from 'node:fs';
const genSource = readFileSync(new URL('../generators.js', import.meta.url), 'utf-8');
const emojiGenRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
assert.ok(!emojiGenRegex.test(genSource), 'generators.js ne doit contenir aucun emoji');

// 11. Tests Phase H (H5 - Issue #93) : Generation d'un jeu complet (2D et 3D) a partir d'une description

// 11.1 Document de Conception (GDD)
const sampleGDD = generateGameDesignDocument('fais-moi un jeu de plateforme avec 3 niveaux et un boss');
assert.ok(sampleGDD.title, 'Le GDD doit comporter un titre');
assert.strictEqual(sampleGDD.dimension, '2d');
assert.strictEqual(sampleGDD.levels.length, 3, 'Le GDD doit comporter 3 niveaux');
assert.strictEqual(sampleGDD.levels[0].name, 'Niveau 1');
assert.strictEqual(sampleGDD.levels[1].name, 'Niveau 2');
assert.strictEqual(sampleGDD.levels[2].name, 'Niveau 3 - Boss');
assert.ok(sampleGDD.markdown.includes('Kishotenketsu'), 'Le GDD doit mentionner la structure Kishotenketsu');
assert.ok(sampleGDD.markdown.includes('Coyote Time'), 'Le GDD doit mentionner le Coyote Time');
assert.ok(!emojiGenRegex.test(sampleGDD.markdown), 'Le GDD markdown ne doit contenir aucun emoji');

// 11.2 Generation d'un jeu 2D complet (3 niveaux + Boss)
const full2D = generateFullGame('fais-moi un jeu de plateforme avec 3 niveaux et un boss');
assert.strictEqual(full2D.gdd.dimension, '2d');
assert.strictEqual(full2D.project.settings.dimension, '2d');
assert.strictEqual(full2D.project.maps.length, 3, 'Le projet 2D doit comporter exactement 3 cartes');
assert.strictEqual(full2D.project.maps[0].name, 'Niveau 1');
assert.strictEqual(full2D.project.maps[1].name, 'Niveau 2');
assert.strictEqual(full2D.project.maps[2].name, 'Niveau 3 - Boss');
assert.strictEqual(full2D.project.settings.startMapId, full2D.project.maps[0].id, 'Le niveau de depart doit etre Niveau 1');

// Verification des objets
const objNames2D = full2D.project.objects.map((o) => o.name);
assert.ok(objNames2D.includes('Player'), 'Le jeu doit contenir l\'objet Player');
assert.ok(objNames2D.includes('Coin'), 'Le jeu doit contenir l\'objet Coin');
assert.ok(objNames2D.includes('Enemy'), 'Le jeu doit contenir l\'objet Enemy');
assert.ok(objNames2D.includes('Boss'), 'Le jeu doit contenir l\'objet Boss');
assert.ok(objNames2D.includes('Portal'), 'Le jeu doit contenir l\'objet Portal');

// Verification du script Player
const playerObj2D = full2D.project.objects.find((o) => o.name === 'Player');
assert.ok(playerObj2D.script.code.includes('coyoteTimer'), 'Le script Player doit contenir le Coyote Time');
assert.ok(playerObj2D.script.code.includes('jumpBuffer'), 'Le script Player doit contenir le Jump Buffering');
assert.ok(playerObj2D.script.code.includes('game.camera.follow'), 'La camera doit suivre le joueur');

// Verification du Boss dans le niveau 3
const map3Entities = full2D.project.maps[2].entities;
const bossObjRef = full2D.project.objects.find((o) => o.name === 'Boss');
assert.ok(map3Entities.some((e) => e.objectId === bossObjRef.id), 'Le niveau 3 doit contenir l\'entite Boss');

// Verification de la validite globale du jeu 2D (0 erreur)
const issues2D = validateProject(full2D.project);
const errors2D = issues2D.filter((i) => i.level === 'error');
assert.strictEqual(errors2D.length, 0, 'Le jeu 2D genere ne doit comporter aucune erreur de validation');

// 11.3 Generation d'un jeu 3D complet (3 scenes + Boss)
const full3D = generateFullGame('cree un jeu 3D de plateforme avec 3 niveaux et un boss', { dimension: '3d' });
assert.strictEqual(full3D.gdd.dimension, '3d');
assert.strictEqual(full3D.project.settings.dimension, '3d');
assert.strictEqual(full3D.project.scenes3d.length, 3, 'Le projet 3D doit comporter exactement 3 scenes');
assert.strictEqual(full3D.project.scenes3d[0].name, 'Scene 1');
assert.strictEqual(full3D.project.scenes3d[1].name, 'Scene 2');
assert.strictEqual(full3D.project.scenes3d[2].name, 'Scene 3 - Boss');
assert.strictEqual(full3D.project.settings.startScene3DId, full3D.project.scenes3d[0].id, 'Scene 1 doit etre la scene de depart');

const objNames3D = full3D.project.objects.map((o) => o.name);
assert.ok(objNames3D.includes('Player'), 'Le jeu 3D doit contenir l\'objet Player');
assert.ok(objNames3D.includes('Boss'), 'Le jeu 3D doit contenir l\'objet Boss');

// Verification de la validite globale du jeu 3D (0 erreur)
const issues3D = validateProject(full3D.project);
const errors3D = issues3D.filter((i) => i.level === 'error');
assert.strictEqual(errors3D.length, 0, 'Le jeu 3D genere ne doit comporter aucune erreur de validation');

// 11.4 Execution de l'outil generate_game via executeTool
const toolProject = createEmptyProject();
const toolResult = await executeTool(toolProject, 'generate_game', {
  description: 'fais-moi un jeu de plateforme avec 3 niveaux et un boss',
  name: 'Super Plateforme',
});
assert.ok(toolResult.includes('Super Plateforme'), 'executeTool doit renvoyer le resume de generation');
assert.ok(toolResult.includes('GDD'), 'executeTool doit renvoyer le Document de Conception');
assert.strictEqual(toolProject.maps.length, 3, 'Le projet modifie par executeTool doit avoir 3 cartes');

// 11.5 Verification de l'absence totale d'emojis dans game-generator.js
const gameGenSource = readFileSync(new URL('../game-generator.js', import.meta.url), 'utf-8');
assert.ok(!emojiGenRegex.test(gameGenSource), 'game-generator.js ne doit contenir aucun emoji');

// ==========================================
// 12. Playtester headless et autocorrection autonome (Phase H - H6 - Issue #94)
// ==========================================

// 12.1 Playtest d'un jeu complet valide
const validGame = generateFullGame('jeu de plateforme simple', { name: 'Jeu Valide' });
const validReport = playtestGame(validGame.project);
assert.strictEqual(validReport.ok, true, 'Un jeu correctement genere doit passer le playtest avec succes');
assert.strictEqual(validReport.issues.length, 0, 'Aucune anomalie ne doit etre signalee sur un jeu valide');
assert.ok(validReport.stats.mapsChecked >= 3, 'Au moins 3 cartes doivent avoir ete controlees');

// 12.2 Detection d'un joueur coince dans un mur
const stuckProject = JSON.parse(JSON.stringify(validGame.project));
const map0 = stuckProject.maps[0];
const layer0 = map0.layers.find((l) => l.collides);
const playerEnt = map0.entities.find((e) => {
  const o = stuckProject.objects.find((obj) => obj.id === e.objectId);
  return o && o.name === 'Player';
});
const pCol = Math.floor(playerEnt.x / 16);
const pRow = Math.floor(playerEnt.y / 16);
layer0.data[pRow * map0.width + pCol] = 1;

const stuckReport = playtestGame(stuckProject);
assert.strictEqual(stuckReport.ok, false, 'Le playtest doit echouer si le joueur est dans un mur');
assert.ok(stuckReport.issues.some((i) => i.type === 'player_in_wall'), 'L anomalie player_in_wall doit etre detectee');

// 12.3 Detection d'un niveau impossible (fosse infranchissable de 15 tuiles sans plateforme)
const impossibleProject = JSON.parse(JSON.stringify(validGame.project));
const impMap = impossibleProject.maps[0];
const impLayer = impMap.layers.find((l) => l.collides);
// Creuser un abime geant de 15 tuiles de large entre la colonne 4 et 19
for (let c = 4; c <= 19; c++) {
  for (let r = 0; r < impMap.height; r++) {
    impLayer.data[r * impMap.width + c] = -1;
  }
}
// Placer la sortie a la colonne 20
const portalEnt = impMap.entities.find((e) => {
  const o = impossibleProject.objects.find((obj) => obj.id === e.objectId);
  return o && o.name === 'Portal';
});
portalEnt.x = 20 * 16;
portalEnt.y = 7 * 16;
// Remettre du sol a la colonne 20 pour que la sortie ait du sol
impLayer.data[8 * impMap.width + 20] = 1;

const impReport = playtestGame(impossibleProject);
assert.strictEqual(impReport.ok, false, 'Le playtest doit echouer si la sortie est inatteignable');
const unreachableIssue = impReport.issues.find((i) => i.type === 'unreachable_exit');
assert.ok(unreachableIssue, 'L anomalie unreachable_exit doit etre detectee');
assert.ok(unreachableIssue.message.includes('inatteignable'), 'Le message doit expliciter l inaccessibilite');

// 12.4 Autocorrection autonome du niveau impossible
const fixResult = autoFixGame(impossibleProject, impReport.issues);
assert.ok(fixResult.repairsApplied.length > 0, 'Des reparations doivent avoir ete appliquees');
assert.ok(fixResult.repairsApplied.some((r) => r.type === 'added_stepping_platform'), 'Des plateformes relais doivent avoir ete ajoutees');

// Re-playtest apres correction
const afterFixReport = playtestGame(fixResult.project);
assert.strictEqual(afterFixReport.ok, true, 'Le niveau prealablement impossible doit etre resolu et terminable');

// 12.5 Boucle complete runPlaytestAndFix (Critere d acceptation Issue #94)
// On cree un projet avec un niveau impossible ET un script declenchant une exception
const brokenProject = JSON.parse(JSON.stringify(impossibleProject));
const brokenObj = brokenProject.objects.find((o) => o.name === 'Player');
brokenObj.script.code = 'on("create", () => { throw new Error("Crash de script critique"); });';

const loopResult = runPlaytestAndFix(brokenProject);
assert.strictEqual(loopResult.ok, true, 'runPlaytestAndFix doit reparer et rendre le jeu 100% jouable');
assert.strictEqual(loopResult.fixed, true, 'Le projet doit etre marque comme repare');
assert.ok(loopResult.iterations <= 3, 'La correction doit aboutir en 3 tours maximum');
assert.ok(loopResult.history.length > 0, 'L historique de correction doit etre renseigne');

// 12.6 Execution de l outil playtest_game via executeTool
const toolPlaytestProject = JSON.parse(JSON.stringify(brokenProject));
const toolPlaytestMsg = await executeTool(toolPlaytestProject, 'playtest_game', { autoFix: true });
assert.ok(toolPlaytestMsg.includes('Partie simulee'), 'executeTool doit renvoyer le rapport de simulation');
assert.ok(toolPlaytestMsg.includes('corrigees'), 'executeTool doit indiquer que les anomalies ont ete corrigees');

// 12.7 Verification de l absence totale d emojis dans playtester.js
const playtesterSource = readFileSync(new URL('../playtester.js', import.meta.url), 'utf-8');
assert.ok(!emojiGenRegex.test(playtesterSource), 'playtester.js ne doit contenir aucun emoji');

// ==========================================
// 13. Copilote IA integre par editeur (Phase H - H7 - Issue #95)
// ==========================================

// 13.1 Verification des 5 editeurs supportes (script, sprite, map, song, scene3d)
const requiredEditors = ['script', 'sprite', 'map', 'song', 'scene3d'];
for (const ed of requiredEditors) {
  assert.ok(COPILOT_SUGGESTIONS[ed]?.length >= 3, `L editeur "${ed}" doit avoir au moins 3 suggestions contextuelles`);
  assert.ok(COPILOT_ALLOWED_TOOLS[ed]?.length >= 2, `L editeur "${ed}" doit avoir des outils autorises cibles`);
}

// 13.2 buildAgentSystemPrompt avec contexte document
const dummyProject = createEmptyProject();
const scriptCtxPrompt = buildAgentSystemPrompt(dummyProject, {
  docKind: 'script',
  docName: 'Ennemi',
  docId: 'obj_ennemi',
  allowedTools: COPILOT_ALLOWED_TOOLS.script,
});
assert.ok(scriptCtxPrompt.includes('CONTEXTE DU DOCUMENT ACTIF'), 'Le prompt systeme doit inclure la section contexte');
assert.ok(scriptCtxPrompt.includes('Ennemi'), 'Le prompt systeme doit mentionner le nom de l objet actif');
assert.ok(scriptCtxPrompt.includes('set_script'), 'Le prompt systeme doit mentionner les outils autorises');

// 13.3 executeTool avec resolution automatique du document actif
const ctxProject = createEmptyProject();
ctxProject.objects.push({ id: 'obj_slime', name: 'Slime', script: { mode: 'code', code: '' } });
// set_script sans preciser args.object -> doit deduire context.docName
await executeTool(ctxProject, 'set_script', { code: 'self.vx = 40;' }, {
  context: { docKind: 'script', docName: 'Slime' },
});
const slimeObj = ctxProject.objects.find((o) => o.name === 'Slime');
assert.strictEqual(slimeObj.script.code, 'self.vx = 40;', 'executeTool doit appliquer au document actif sans nom explicite');

// 13.4 Absence totale d emojis dans editor-copilot.js et editor-copilot.css
const copilotJsSource = readFileSync(new URL('../../ui/editor-copilot.js', import.meta.url), 'utf-8');
assert.ok(!emojiGenRegex.test(copilotJsSource), 'editor-copilot.js ne doit contenir aucun emoji');
const copilotCssSource = readFileSync(new URL('../../ui/editor-copilot.css', import.meta.url), 'utf-8');
assert.ok(!emojiGenRegex.test(copilotCssSource), 'editor-copilot.css ne doit contenir aucun emoji');

console.log('Tous les tests Assistant IA & Game Design sont valides !');
