/**
 * Tests unitaires pour l'Assistant IA, l'extracteur de code et la base de connaissances
 */

import assert from 'node:assert';
import { extractCodeBlocks } from '../client.js';
import { buildSystemPrompt, PIXELFORGE_SCRIPT_API, BLUEPRINT_SCHEMA_GUIDE } from '../knowledge.js';
import { GAMEDESIGN_PRINCIPLES, SCRIPT_TEMPLATES } from '../gamedesign.js';
import { AGENT_TOOLS, parseJsonPlan, executeTool, executePlan, buildAgentSystemPrompt, runAgent } from '../agent.js';
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

console.log('Tous les tests Assistant IA & Game Design sont valides !');
