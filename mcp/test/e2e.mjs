// Test de bout en bout : lance le serveur MCP (stdio) dans un dossier de jeux temporaire et déroule un scénario complet.
//   node mcp/test/e2e.mjs [--keep]      (--keep : garde le dossier temporaire et affiche son chemin)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverJs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-e2e-'));
const gamesDir = path.join(tmp, 'games');

const client = new Client({ name: 'e2e', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverJs], env: { ...process.env, PIXELFORGE_GAMES: gamesDir } }));

let failed = false;
async function call(name, args = {}, { expectError = false } = {}) {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.map((c) => c.text).join('\n');
  if (!!r.isError !== expectError) { failed = true; console.error(`FAIL ${name}: ${t}`); throw new Error(name + ' ' + (expectError ? 'should have failed' : 'failed')); }
  console.log(`- ${name}: ${t.split('\n')[0]}`);
  return t;
}

try {
  const tools = (await client.listTools()).tools.map((t) => t.name);
  console.log('tools:', tools.join(', '));
  for (const n of ['pixelforge_guide', 'list_games', 'create_game', 'get_game', 'delete_game', 'duplicate_game', 'set_settings', 'upsert_sprite', 'get_sprite', 'upsert_object', 'set_script', 'get_script', 'list_nodes', 'upsert_map', 'paint_map', 'set_layer', 'place_entities', 'render_map', 'add_sound', 'upsert_song', 'get_song', 'validate_game', 'export_html']) assert.ok(tools.includes(n), 'missing tool ' + n);

  assert.match(await call('pixelforge_guide'), /PixelForge/);
  await call('create_game', { name: 'test-mcp' });

  await call('upsert_sprite', { game: 'test-mcp', name: 'Tiles', frames: [
    ['2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222', '2222222222222222'],
    [...Array(16)].map((_, y) => (y === 0 ? '6'.repeat(16) : '3'.repeat(16))),
  ] });
  await call('upsert_sprite', { game: 'test-mcp', name: 'Hero', legend: { R: '#ff0044' }, frames: [
    ['...RRRR.', '..RRRRRR', '..R9R9RR', '..RRRRRR', '...RRRR.', '..99999.', '.9999999', '.9.999.9', '...9.9..', '..88.88.', '..88.88.', '.888.888'],
    ['...RRRR.', '..RRRRRR', '..R9R9RR', '..RRRRRR', '...RRRR.', '..99999.', '.9999999', '.9.999.9', '...9.9..', '...8.88.', '..88.88.', '.888.888'],
  ], animations: [{ name: 'idle', frames: [0, 1], fps: 4, loop: true }] });
  const back = await call('get_sprite', { game: 'test-mcp', name: 'Hero' });
  assert.match(back, /...GGGG./);
  assert.match(back, /"G":"#ff0044"/); // couleurs hors palette : lettres auto
  await call('upsert_sprite', { game: 'test-mcp', name: 'Bad', frames: [['..?..']] }, { expectError: true });

  await call('upsert_object', { game: 'test-mcp', name: 'Player', sprite: 'Hero', physics: { collideWorld: false }, hitbox: { x: 1, y: 0, w: 6, h: 12 }, code: `
on('create', () => game.camera.follow(self));
on('update', () => {
  self.vx = 0;
  if (input.isDown('LEFT')) self.vx = -80;
  if (input.isDown('RIGHT')) self.vx = 80;
  if (input.justPressed('SPACE')) self.jump(280);
  self.play('idle');
});` });
  await call('set_script', { game: 'test-mcp', object: 'Player', code: 'on(' }, { expectError: true });
  const bad = await call('set_script', { game: 'test-mcp', object: 'global', code: "on('create', () => game.setText('t', 'test-mcp', 4, 4)); on('bogus', () => {});" });
  assert.match(bad, /unknown event "bogus"/, 'unknown event should be reported');
  await call('set_script', { game: 'test-mcp', object: 'global', code: "on('create', () => game.setText('t', 'test-mcp', 4, 4));" });

  // --- Blueprint : événement update -> si la touche ESPACE vient d'être pressée -> Sauter
  const nodes = await call('list_nodes', { search: 'sauter' });
  assert.match(nodes, /pf_jump/);
  const jumpGraph = {
    nodes: [
      { id: 'n1', type: 'pf_on_update' },
      { id: 'n2', type: 'flow_branch' },
      { id: 'n3', type: 'pf_key_just', fields: { KEY: 'SPACE' } },
      { id: 'n4', type: 'pf_jump', values: { SPEED: 300 } },
    ],
    links: [
      { from: 'n1', fromPin: 'then', to: 'n2', toPin: 'exec' },
      { from: 'n3', fromPin: 'out', to: 'n2', toPin: 'COND' },
      { from: 'n2', fromPin: 'true', to: 'n4', toPin: 'exec' },
    ],
  };
  await call('upsert_object', { game: 'test-mcp', name: 'Jumper', sprite: 'Hero', graph: jumpGraph });
  const jumper = await call('get_script', { game: 'test-mcp', object: 'Jumper' });
  assert.match(jumper, /^mode: graph/, 'get_script returns the mode and the graph');
  assert.match(jumper, /"type":"pf_jump"/, 'get_script returns the graph');
  assert.match(jumper, /on\('update', \(dt\) => \{\n {2}if \(input\.justPressed\('SPACE'\)\) \{\n {4}self\.jump\(300\);/, 'compiled code:\n' + jumper);
  // erreurs de graphe renvoyées comme erreurs d'outil (rien n'est enregistré)
  const badType = await call('set_script', { game: 'test-mcp', object: 'Jumper', graph: { nodes: [{ id: 'a', type: 'pf_nope' }] } }, { expectError: true });
  assert.match(badType, /unknown type "pf_nope"/);
  const badPin = await call('set_script', { game: 'test-mcp', object: 'Jumper', graph: { nodes: [{ id: 'a', type: 'pf_on_update' }, { id: 'b', type: 'pf_jump' }], links: [{ from: 'a', fromPin: 'then', to: 'b', toPin: 'nope' }] } }, { expectError: true });
  assert.match(badPin, /no input pin "nope"/);
  const selfOnly = await call('set_script', { game: 'test-mcp', object: 'global', graph: { nodes: [{ id: 'a', type: 'pf_on_create' }, { id: 'b', type: 'pf_jump' }], links: [{ from: 'a', fromPin: 'then', to: 'b', toPin: 'exec' }] } }, { expectError: true });
  assert.match(selfOnly, /node b \(pf_jump\)/, 'compile errors name the node id and type');
  await call('set_script', { game: 'test-mcp', object: 'Jumper', code: 'x', graph: jumpGraph }, { expectError: true });
  assert.match(await call('get_script', { game: 'test-mcp', object: 'Jumper' }), /self\.jump\(300\)/, 'a refused call leaves the script untouched');
  // un graphe sans x/y est mis en page automatiquement
  const laid = JSON.parse(fs.readFileSync(path.join(gamesDir, 'test-mcp.pixelforge.json'), 'utf8')).objects.find((o) => o.name === 'Jumper').script;
  assert.equal(laid.mode, 'graph');
  assert.ok(laid.graph.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), 'auto layout');
  assert.ok(!('blocks' in laid), 'no blocks field');

  await call('upsert_map', { game: 'test-mcp', name: 'Main', width: 20, height: 10, tileset: 'Tiles', background: '#29366f', start: true, layers: [{ name: 'Ground', collides: true }] });
  await call('paint_map', { game: 'test-mcp', map: 'Main', layer: 'Ground', legend: { '#': 1, d: 0 }, rows: [
    '#..................#', '#..................#', '#..................#', '#..................#', '#..................#',
    '#..................#', '#.....###..........#', '#..................#', '####################', 'dddddddddddddddddddd'], y: 0 });
  await call('place_entities', { game: 'test-mcp', map: 'Main', mode: 'replace', legend: { P: 'Player' }, rows: [
    '....................', '....................', '....................', '....................', '....................',
    '....................', '....................', '..P.................', '....................', '....................'] });
  await call('add_sound', { game: 'test-mcp', name: 'ding', preset: 'coin', volume: 0.6 });
  const songAscii = 'BPM 140\nCHANNELS\n  Lead: pulse50\n  Bass: triangle\nPATTERN Main 16\n00 | C4 | C3\n04 | E4 | G3\nPLAYLIST\n  Track0: Main Main';
  await call('upsert_song', { game: 'test-mcp', name: 'Theme', text: songAscii });
  const fetchedSong = await call('get_song', { game: 'test-mcp', song: 'Theme' });
  assert.match(fetchedSong, /Theme/);
  const summary = await call('get_game', { game: 'test-mcp' });
  assert.match(summary, /Player/);
  const v = await call('validate_game', { game: 'test-mcp' });
  assert.match(v, /^OK|0 error/, 'validate_game must report no error:\n' + v);
  // code recompilé != script.code -> avertissement ; ancien script Blockly -> converti au chargement
  const gf = path.join(gamesDir, 'test-mcp.pixelforge.json');
  const edited = JSON.parse(fs.readFileSync(gf, 'utf8'));
  edited.objects.find((o) => o.name === 'Jumper').script.code += '// edited by hand\n';
  const legacy = { mode: 'blocks', code: 'stale', blocks: { blocks: { languageVersion: 0, blocks: [{ type: 'pf_on_overlap', id: 'b1', fields: { OBJ: 'Player' }, inputs: { DO: { block: { type: 'pf_destroy_self', id: 'b2' } } } }] } } };
  edited.objects.push({ ...edited.objects.find((o) => o.name === 'Player'), id: 'obj_legacy', name: 'Legacy', script: legacy });
  fs.writeFileSync(gf, JSON.stringify(edited, null, 2));
  const warned = await call('validate_game', { game: 'test-mcp' });
  assert.match(warned, /script\.code differs from the code recompiled/, 'stale compiled code is reported:\n' + warned);
  const converted = await call('get_script', { game: 'test-mcp', object: 'Legacy' });
  assert.match(converted, /^mode: graph/);
  assert.match(converted, /on\('overlap', 'Player', \(other\) => \{\n {2}self\.destroy\(\);/, 'legacy blocks converted and recompiled:\n' + converted);
  await call('set_script', { game: 'test-mcp', object: 'Jumper', graph: jumpGraph }); // regénère le code
  const map = await call('render_map', { game: 'test-mcp', map: 'Main' });
  console.log(map);
  assert.match(map, /P/);

  // fichier produit : id, indentation 2 espaces, normalisation stable
  const file = path.join(gamesDir, 'test-mcp.pixelforge.json');
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(raw.startsWith('{\n  "version"'), 'JSON indented with 2 spaces');
  const proj = JSON.parse(raw);
  assert.equal(proj.meta.id, 'test-mcp');
  const { normalizeProject } = await import('../../src/core/project.js');
  const copy = normalizeProject(JSON.parse(raw));
  assert.equal(JSON.stringify(copy), JSON.stringify(proj), 'normalizeProject must not change the file');

  const exp = await call('export_html', { game: 'test-mcp' });
  const out = /Exported (.+?\.html)/.exec(exp)[1];
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.includes('createGame') && html.includes('"test-mcp"'), 'export contains engine and project');
  console.log('export:', out);

  await call('duplicate_game', { game: 'test-mcp', newName: 'test-mcp copy' });
  await call('delete_game', { game: 'test-mcp copy', confirm: true });
  await call('delete_game', { game: 'test-mcp', confirm: true });
  assert.match(await call('list_games'), /No games/);
  console.log(failed ? 'FAILED' : 'ALL OK');
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await client.close();
  if (process.argv.includes('--keep')) console.log('kept:', tmp); else fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
