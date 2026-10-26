/**
 * Tests unitaires pour l'Assistant IA, l'extracteur de code et la base de connaissances
 */

import assert from 'node:assert';
import { extractCodeBlocks } from '../client.js';
import { buildSystemPrompt, PIXELFORGE_SCRIPT_API, BLUEPRINT_SCHEMA_GUIDE } from '../knowledge.js';
import { GAMEDESIGN_PRINCIPLES, SCRIPT_TEMPLATES } from '../gamedesign.js';

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

console.log('Tous les tests Assistant IA & Game Design sont valides !');
