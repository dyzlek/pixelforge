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

console.log('Tous les tests Assistant IA & Game Design sont valides !');
