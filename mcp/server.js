#!/usr/bin/env node
// Serveur MCP (stdio) de PixelForge : permet à une IA de créer / modifier les jeux de games/.
// Les jeux sont des fichiers games/<meta.id>.pixelforge.json ; l'éditeur web les surveille et se recharge.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as pf from './lib/index.js';

const server = new McpServer({ name: 'pixelforge', version: '1.0.0' });

const text = (t) => ({ content: [{ type: 'text', text: t }] });

// Enregistre un outil : le handler renvoie une chaîne ; toute erreur devient un résultat isError lisible.
function tool(name, description, shape, handler) {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => {
    try { return text(await handler(args)); } catch (e) { return { isError: true, content: [{ type: 'text', text: 'Error: ' + (e?.message || e) }] }; }
  });
}

// Édite un jeu, puis ajoute au message les issues de validation qui concernent `scope` (préfixe de `where`)
function write(game, scope, fn) {
  const { msg, extra } = pf.editGame(game, (p) => ({ msg: fn(p), extra: p }));
  const issues = pf.validateProject(extra).filter((i) => scope && i.where.startsWith(scope));
  return msg + (issues.length ? '\nValidation:\n' + pf.formatIssues(issues) : '');
}

const gameArg = z.string().describe('Game id or name');
const physicsShape = z.object({
  enabled: z.boolean().optional(), gravity: z.boolean().optional(), immovable: z.boolean().optional(),
  bounce: z.number().optional(), collideMap: z.boolean().optional(), collideWorld: z.boolean().optional(),
}).describe('Partial physics flags; defaults {enabled:true,gravity:true,immovable:false,bounce:0,collideMap:true,collideWorld:true}');

// Graphe Blueprint : même format que script.graph dans le fichier du jeu (docs/BLUEPRINTS.md)
const graphShape = z.object({
  nodes: z.array(z.object({
    id: z.string(), type: z.string(), x: z.number().optional(), y: z.number().optional(),
    fields: z.record(z.string(), z.any()).optional(), values: z.record(z.string(), z.any()).optional(), extra: z.record(z.string(), z.any()).optional(),
  })),
  links: z.array(z.object({ id: z.string().optional(), from: z.string(), fromPin: z.string(), to: z.string(), toPin: z.string() })).optional(),
  variables: z.array(z.object({ name: z.string(), default: z.any().optional() })).optional(),
  comments: z.array(z.record(z.string(), z.any())).optional(),
}).describe('Blueprint graph: nodes [{id, type, fields, values, extra}] + links [{from, fromPin, to, toPin}] (exec pins: exec / then / true / false / body...; data pins: out -> input name). x,y are optional (auto layout). Node types and pins: list_nodes. Details: pixelforge_guide.');

tool('pixelforge_guide', 'Read this first. Returns the AGENTS.md guide (workflow, formats, golden rules, recipes, Blueprint graphs) and the scripting API (SCRIPT_API.md).', {}, () =>
  pf.readDoc('AGENTS.md') + '\n\n---\n\n' + pf.readDoc('docs', 'SCRIPT_API.md'));

tool('list_games', 'List the games in the library (id, name, last update).', {}, () => {
  const g = pf.listGames();
  return g.length ? g.map((x) => `${x.id} - "${x.name}" (updated ${x.updatedAt})`).join('\n') : 'No games yet. Use create_game.';
});

tool('create_game', 'Create a new game. template "platformer" gives a playable level (player, coins, slimes, flag) to modify; "empty" gives a blank project with one empty map.', {
  name: z.string(), width: z.number().int().optional().describe('screen width in px (default 320)'), height: z.number().int().optional().describe('screen height in px (default 180)'),
  tileSize: z.number().int().optional().describe('tile size in px (default 16)'), gravity: z.number().optional().describe('default 800'),
  template: z.enum(['empty', 'platformer']).optional(),
}, (a) => {
  const p = pf.createGameFile(a.name, (proj) => {
    pf.setSettings(proj, { width: a.width, height: a.height, tileSize: a.tileSize, gravity: a.gravity });
    for (const m of proj.maps) m.tileSize = proj.settings.tileSize;
    if (a.template === 'platformer') pf.applyPlatformerTemplate(proj);
  });
  return `Created game "${p.name}" (id ${p.meta.id}). Next: ${a.template === 'platformer' ? 'get_game / render_map to see it, then modify.' : 'upsert_sprite (tileset + characters), upsert_object, upsert_map, paint_map, place_entities, validate_game.'}`;
});

tool('get_game', 'Compact summary of a game: settings, palette, sprites, objects, maps, sounds.', { game: gameArg }, ({ game }) => pf.summarize(pf.loadGame(game)));

tool('delete_game', 'Permanently delete a game. Requires confirm: true.', { game: gameArg, confirm: z.literal(true) }, ({ game }) => `Deleted game ${pf.deleteGameFile(game)}.`);

tool('duplicate_game', 'Copy a game under a new name.', { game: gameArg, newName: z.string().optional() }, ({ game, newName }) => {
  const c = pf.duplicateGameFile(game, newName);
  return `Duplicated as "${c.name}" (id ${c.meta.id}).`;
});

tool('set_settings', 'Change game settings (screen size, tile size, gravity, background, start map, name/description, 16-colour palette).', {
  game: gameArg, name: z.string().optional(), description: z.string().optional(), author: z.string().optional(),
  width: z.number().int().optional(), height: z.number().int().optional(), pixelZoom: z.number().optional(), tileSize: z.number().int().optional(),
  gravity: z.number().optional(), background: z.string().optional().describe('#rrggbb'), touchControls: z.boolean().optional(),
  startMap: z.string().optional().describe('map name'), palette: z.array(z.string()).length(16).optional().describe('16 hex colours'),
}, ({ game, ...a }) => write(game, 'settings', (p) => pf.setSettings(p, a)));

tool('upsert_sprite', 'Create or replace a sprite (or tileset: a sprite whose frames are tiles) from text. frames = array of frames, each frame = array of strings, one char per pixel: "." transparent, 0-9a-f = project palette index, other chars via legend {"R":"#ff0000"}. Size = longest row x row count (or width/height). animations: [{name, frames:[indexes], fps, loop}]; default is one "idle" animation over all frames.', {
  game: gameArg, name: z.string(), frames: z.array(z.array(z.string())), legend: z.record(z.string(), z.string()).optional(),
  animations: z.array(z.object({ name: z.string(), frames: z.array(z.number().int()), fps: z.number().optional(), loop: z.boolean().optional() })).optional(),
  width: z.number().int().optional(), height: z.number().int().optional(),
}, ({ game, ...a }) => write(game, `sprite "${a.name}"`, (p) => pf.upsertSprite(p, a)));

tool('get_sprite', 'Show a sprite as text (frames, legend, animations) in the same format as upsert_sprite.', { game: gameArg, name: z.string() }, ({ game, name }) => pf.getSprite(pf.loadGame(game), name).text);

tool('upsert_object', 'Create or update a game object (a template for entities: sprite, physics, hitbox, script). Object names are case-sensitive and used by scripts. code = script body (see pixelforge_guide) OR graph = Blueprint node graph (see list_nodes); both are checked and the call is refused if invalid.', {
  game: gameArg, name: z.string(), sprite: z.string().nullable().optional().describe('sprite name'), defaultAnim: z.string().nullable().optional(),
  physics: physicsShape.optional(), hitbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable().optional().describe('pixels relative to the frame; null = whole frame'),
  code: z.string().optional().describe('script as JavaScript (mode code)'),
  graph: graphShape.optional().describe('script as a Blueprint graph (mode graph): compiled to JavaScript; refused with the compile errors if invalid. Give code OR graph, not both.'),
}, ({ game, ...a }) => write(game, `object "${a.name}"`, (p) => pf.upsertObject(p, a)));

tool('set_script', 'Set the script of an object (or "global" for the global script), either as JavaScript `code` or as a Blueprint `graph` (compiled to JavaScript, mode graph). Syntax / compile errors refuse the call with the error.', {
  game: gameArg, object: z.string().describe('object name or "global"'),
  code: z.string().optional(), graph: graphShape.optional().describe('Blueprint graph (give code OR graph)'),
}, ({ game, object, code, graph }) => write(game, object === 'global' ? 'global script' : `object "${object}"`, (p) => pf.setScript(p, object, { code, graph })));

tool('get_script', 'Read the script of an object (or "global"): the code, plus the Blueprint graph (JSON) when it has one.', { game: gameArg, object: z.string() }, ({ game, object }) => pf.getScript(pf.loadGame(game), object) || '(empty script)');

tool('list_nodes', 'Catalogue of Blueprint node types for the "graph" argument of upsert_object / set_script: type, title, kind (event / exec / pure), input and output pins (name:type), fields. Filter with category (e.g. event, move, flow, math) or a search word.', {
  category: z.string().optional(), search: z.string().optional(),
}, (a) => pf.listNodes(a));

tool('upsert_map', 'Create or update a map. New map: width/height in tiles (default 40x12), tileset = sprite name, layers = [{name, collides, depth:"below"|"above", visible}] in drawing order (default: Décor, Sol[collides]). Resizing keeps existing tiles. start:true makes it the start map. A pristine default map is replaced by the first map you create.', {
  game: gameArg, name: z.string(), width: z.number().int().optional(), height: z.number().int().optional(), tileset: z.string().nullable().optional(),
  background: z.string().optional(), start: z.boolean().optional(),
  layers: z.array(z.object({ name: z.string(), collides: z.boolean().optional(), depth: z.enum(['below', 'above']).optional(), visible: z.boolean().optional() })).optional(),
}, ({ game, ...a }) => write(game, `map "${a.name}"`, (p) => pf.upsertMap(p, a)));

tool('paint_map', 'Paint tiles on a layer from text rows. legend maps a char to a tile index (frame of the tileset), "." = -1 (empty, erases), " " = leave unchanged. Without a legend entry, 0-9a-z mean tile 0-35 (same as render_map). x,y = top-left tile where the rows start (default 0,0).', {
  game: gameArg, map: z.string(), layer: z.string(), rows: z.array(z.string()), legend: z.record(z.string(), z.number().int()).optional(),
  x: z.number().int().optional(), y: z.number().int().optional(),
}, ({ game, ...a }) => write(game, `map "${a.map}"`, (p) => pf.paintMap(p, a)));

tool('set_layer', 'Change (or create) a layer: collides (solid for physics), depth "below"/"above" entities, visible.', {
  game: gameArg, map: z.string(), layer: z.string(), collides: z.boolean().optional(), depth: z.enum(['below', 'above']).optional(), visible: z.boolean().optional(),
}, ({ game, ...a }) => write(game, `map "${a.map}"`, (p) => pf.setLayer(p, a)));

tool('place_entities', 'Place object instances on a map. entities = [{object, x, y (pixels, top-left), props}] and/or rows+legend ({char: objectName}) on the tile grid (a sprite is bottom-left aligned in its cell). mode "append" (default) or "replace" (clears existing entities first).', {
  game: gameArg, map: z.string(), mode: z.enum(['append', 'replace']).optional(),
  entities: z.array(z.object({ object: z.string(), x: z.number(), y: z.number(), props: z.record(z.string(), z.any()).optional() })).optional(),
  rows: z.array(z.string()).optional(), legend: z.record(z.string(), z.string()).optional(),
}, ({ game, ...a }) => write(game, `map "${a.map}"`, (p) => pf.placeEntities(p, a)));

tool('render_map', 'ASCII view of a map: combined tiles (base-36 index) + entities (capital letters), per-layer grids and entity coordinates. Use it to check your level.', { game: gameArg, map: z.string() }, ({ game, map }) => pf.renderMap(pf.loadGame(game), map));

tool('add_sound', `Add or update a synthesized sound effect. Presets: ${pf.SOUND_PRESETS.join(', ')}. See SCRIPT_API for how scripts play sounds.`, {
  game: gameArg, name: z.string(), preset: z.enum(pf.SOUND_PRESETS), pitch: z.number().optional(), volume: z.number().optional(),
}, ({ game, ...a }) => write(game, null, (p) => pf.addSound(p, a)));

tool('upsert_song', 'Add or update a chiptune song using compact tracker ASCII notation or direct JSON object. Perfect for composing game music.', {
  game: gameArg,
  name: z.string().describe('Unique name of the song'),
  text: z.string().optional().describe('Tracker ASCII notation (BPM, CHANNELS, PATTERN, PLAYLIST)'),
  song: z.any().optional().describe('Direct song JSON object'),
  bpm: z.number().optional().describe('Song tempo in BPM')
}, ({ game, ...a }) => write(game, null, (p) => pf.upsertSong(p, a)));

tool('get_song', 'Get a song by name or id as tracker ASCII text notation.', {
  game: gameArg,
  song: z.string().describe('Name or id of the song')
}, ({ game, song }) => pf.getSongText(pf.loadGame(game), song));

tool('validate_game', 'Check a game: references, layer sizes, script syntax, unknown events/keys/object names. Returns the list of issues.', { game: gameArg }, ({ game }) => pf.formatIssues(pf.validateProject(pf.loadGame(game))));

tool('export_html', 'Export the game as a standalone HTML file in exports/<id>.html (Phaser loaded from a CDN). Returns the path.', { game: gameArg }, async ({ game }) => {
  const p = pf.loadGame(game);
  const errors = pf.validateProject(p).filter((i) => i.level === 'error');
  const { file, bytes } = await pf.exportGameHTML(p);
  return `Exported ${file} (${Math.round(bytes / 1024)} KB).` + (errors.length ? `\nWarning: the game has ${errors.length} validation error(s); run validate_game.` : '');
});

await server.connect(new StdioServerTransport());
