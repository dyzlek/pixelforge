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
  for (const n of ['pixelforge_guide', 'list_games', 'create_game', 'get_game', 'delete_game', 'duplicate_game', 'set_settings', 'upsert_sprite', 'get_sprite', 'upsert_object', 'set_script', 'get_script', 'upsert_map', 'paint_map', 'set_layer', 'place_entities', 'render_map', 'add_sound', 'validate_game', 'export_html']) assert.ok(tools.includes(n), 'missing tool ' + n);

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

  await call('upsert_map', { game: 'test-mcp', name: 'Main', width: 20, height: 10, tileset: 'Tiles', background: '#29366f', start: true, layers: [{ name: 'Ground', collides: true }] });
  await call('paint_map', { game: 'test-mcp', map: 'Main', layer: 'Ground', legend: { '#': 1, d: 0 }, rows: [
    '#..................#', '#..................#', '#..................#', '#..................#', '#..................#',
    '#..................#', '#.....###..........#', '#..................#', '####################', 'dddddddddddddddddddd'], y: 0 });
  await call('place_entities', { game: 'test-mcp', map: 'Main', mode: 'replace', legend: { P: 'Player' }, rows: [
    '....................', '....................', '....................', '....................', '....................',
    '....................', '....................', '..P.................', '....................', '....................'] });
  await call('add_sound', { game: 'test-mcp', name: 'ding', preset: 'coin', volume: 0.6 });
  const summary = await call('get_game', { game: 'test-mcp' });
  assert.match(summary, /Player/);
  const v = await call('validate_game', { game: 'test-mcp' });
  assert.match(v, /^OK|0 error/, 'validate_game must report no error:\n' + v);
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
