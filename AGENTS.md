# PixelForge - guide for AI agents

PixelForge is a 2D game editor + engine that runs in the browser (Vite, vanilla JS, Phaser 3, Blockly). A game is **one JSON file**:
`games/<meta.id>.pixelforge.json` (indented 2 spaces). The web editor watches `games/` and reloads when a file changes, so you can
build a game from the terminal and see it live. You can create a complete game without opening the editor.

```
npm install
npm run dev        # editor at http://localhost:5173 (or the port Vite prints); games/ is served live
npm run mcp        # MCP server (stdio), declared in .mcp.json for Claude Code
npm run pf -- list | show <game> | validate <game> | render <game> [map] | export <game>
npm run build      # must keep passing
```

Games and names: every tool/CLI argument `game` accepts the game id or its name. Override the folder with env `PIXELFORGE_GAMES`.

## Two ways to build a game

**A. MCP tools** (preferred; they validate for you). Call `pixelforge_guide` first (returns this file + the scripting API), then:
`create_game {template:'platformer'|'empty'}` -> `upsert_sprite` (tileset + characters, as text) -> `upsert_object` (sprite, physics, `code`)
-> `upsert_map` -> `paint_map` -> `place_entities` -> `render_map` (look at your level!) -> `validate_game` -> `export_html`.
Other tools: `list_games get_game duplicate_game delete_game set_settings get_sprite set_script get_script set_layer add_sound`.

**B. Edit the JSON directly**, then run `npm run pf -- validate <game>`. Schema: `docs/PROJECT_SCHEMA.json`; architecture: `docs/ARCHITECTURE.md`.
Sprite frames in the file are PNG data URLs, so for sprites prefer the MCP tool (or `mcp/lib/sprites.js`: `textToFrames`) instead of hand-writing PNG.

Workflow that works well: start from `template: 'platformer'` and modify it, or build in this order: settings -> sprites -> objects (+scripts) -> map -> entities.
Always finish with `validate_game` (0 errors) and `render_map`. Fix every error; read warnings.

## Project model (short)

`settings` (screen `width x height` px, `tileSize`, `gravity`, `startMapId`) - `palette` (16 hex colours) - `sprites[]` (PNG frames + named `animations`)
- `objects[]` (templates: `spriteId`, `physics`, `hitbox`, `script`) - `maps[]` (`layers[]` of tile indexes, `entities[]` = placed object instances)
- `sounds[]` (synthesized presets: jump coin hit powerup explosion laser blip portal) - `globalScript`.
A tileset is a sprite whose every frame is one tile; a map points to it with `tilesetSpriteId`. Tile value in `layer.data` = frame index, `-1` = empty,
`data.length` must equal `width*height`. Entities: `{id, objectId, x, y, props}` with x,y in **pixels** (top-left of the sprite frame).
Scripts only run from `script.code` (always write `mode: 'code'`). Scripts and tools refer to things **by name**; the JSON links them **by id**.

## Text sprites

`frames` = array of frames, each frame = array of strings (rows), one character per pixel:
`.` transparent - `0-9a-f` index in the project palette - any other char via `legend: {"R": "#ff0000"}`. Frame size = longest row x row count.
Default palette (Sweetie 16): 0 #1a1c2c, 1 #5d275d, 2 #b13e53, 3 #ef7d57, 4 #ffcd75, 5 #a7f070, 6 #38b764, 7 #257179, 8 #29366f, 9 #3b5dc9, a #41a6f6, b #73eff7, c #f4f4f4, d #94b0c2, e #566c86, f #333c57.

```json
{"name":"Gem","frames":[["..33..","..33..",".3443.","344443",".3443.","..33.."]],"animations":[{"name":"idle","frames":[0],"fps":6,"loop":true}]}
```
Keep tiles exactly `tileSize` x `tileSize` (16x16 default); characters 16x16 too (draw feet on the last row so they stand on the ground).
Use `get_sprite` to read a sprite back as text. Tileset frames are numbered from 0 in the order you give them; map tile `n` = frame `n`.

## Maps

`paint_map {rows, legend:{char: tileIndex}}`: `.` = empty, space = leave unchanged, without legend `0-9a-z` = tile 0-35 (same as `render_map`).
Put solid things on a layer with `collides: true` (objects with `collideMap` are blocked by it). Decoration goes on a non-colliding layer; `depth:'above'` draws in front of entities.
`place_entities {rows, legend:{char: ObjectName}}` places on the tile grid (sprite bottom-left aligned in the cell) or `entities:[{object,x,y,props}]` in pixels.
The start map (`settings.startMapId`) must contain the player object and the level must be completable. Camera: call `game.camera.follow(self)` in the player's `create`.

## Scripts

Full API: `docs/SCRIPT_API.md`. A script is the body of `new Function('self','game','input','on', code)`, run once per instance; all behaviour goes in handlers:
`on('create'|'update'|'destroy', fn)`, `on('collide'|'overlap', 'ObjectName', fn(other))`, `on('keydown','SPACE', fn)`, `on('timer', ms, fn)`, plus `hitTile`, `click`, `mousedown`, `message` (see the API file).
`self` (x, y, vx, vy, flipX, play(), destroy(), jump(), onGround, width, height, vars, props), `input.isDown/justPressed('LEFT')`, `game.spawn/find/findAll/goToMap/restart/setText/camera/score/vars/random/playSound`.
v1.2 (see the API file): `on('overlapStart'|'overlapEnd', 'Name', fn(other))`, `other.setPosition/setVelocity/…` act on any instance, `self.setCollideMap/setCollideObjects/setHitbox/flipY`, `game.raycast(x,y,angle,dist,{objects:true,ignore:self})` -> `{instance, objectName, layer}`.

### Golden rules
1. `x`/`y` are the **top-left** corner of the sprite frame, in pixels - not the centre. Tile (col,row) = pixel (col*tileSize, row*tileSize).
2. `collide` fires **after** the physical separation, so positions are already pushed apart. To know "landed on top of" use geometry: `other.y + other.height - self.y < 10`, or check `other.vy`.
3. Object names are **case-sensitive** and must exist: `on('collide','Coin')`, `game.spawn('Bullet')`, `game.goToMap('Level 2')` fail silently/with an error otherwise. `validate_game` checks them.
4. `collide` = blocks physically (both sides); `overlap` = no blocking, fires every frame while touching. Use **overlap for pickups/triggers/damage zones**, collide for solid things you stomp or bounce on.
5. Pickups/triggers: `physics {gravity:false, immovable:true, collideMap:false, collideWorld:false}`. Top-down games: set `gravity:false` on every object (global gravity is a setting, per-object switch is `physics.gravity`).
6. Handlers must be registered at the top level of the script (not inside other handlers every frame). Put per-instance state in `let` variables at the top or in `self.vars`; shared state in `game.vars`.
7. `game.vars` and the score survive `game.restart()` and `goToMap`: reset them yourself (`game.score = 0`) when restarting a run.
8. `self.jump(v)` only works when `self.onGround`; set `self.vx` every frame for movement (it is a velocity in px/s, not an offset). Never move by writing `x` unless physics is off.
9. Hitbox is relative to the sprite frame; make it a little smaller than the visible sprite for friendly collisions. Tileset frames must equal `tileSize`.
10. Always `validate_game` and `render_map`, and keep text readable: HUD with `game.setText(id, text, x, y)` (screen coordinates, updating the same id replaces it).

## Recipes (script bodies)

Platformer player
```js
on('create', () => game.camera.follow(self));
on('update', () => {
  self.vx = 0;
  if (input.isDown('LEFT')) { self.vx = -90; self.flipX = true; }
  if (input.isDown('RIGHT')) { self.vx = 90; self.flipX = false; }
  if (input.justPressed('SPACE') || input.justPressed('UP')) self.jump(290);
  self.play(self.vx !== 0 ? 'run' : 'idle');
  if (self.y > game.mapHeight + 32) game.restart();
});
```
Top-down player (object physics: gravity false)
```js
on('update', () => {
  const s = 80;
  self.vx = (input.isDown('RIGHT') ? s : 0) - (input.isDown('LEFT') ? s : 0);
  self.vy = (input.isDown('DOWN') ? s : 0) - (input.isDown('UP') ? s : 0);
});
```
Projectile (Bullet object: gravity false, collideMap false). Shooter script, then bullet script:
```js
on('keydown', 'X', () => { const b = game.spawn('Bullet', self.x + 8, self.y + 6); b.vx = self.flipX ? -200 : 200; });
// Bullet:
on('timer', 1500, () => self.destroy());
on('overlap', 'Enemy', (e) => { e.destroy(); self.destroy(); game.score += 1; });
```
Pickup (Coin: immovable, no gravity, collideMap false)
```js
on('overlap', 'Player', () => { self.destroy(); game.score += 1; game.setText('score', 'Score: ' + game.score, 4, 4); game.playSound('coin'); });
```
Patrolling enemy (turns at walls and every 1.4 s)
```js
let dir = -1;
on('create', () => { self.vx = dir * 30; });
on('update', () => { if (self.vx === 0) dir = -dir; self.vx = dir * 30; self.flipX = dir > 0; });
on('timer', 1400, () => { dir = -dir; });
on('collide', 'Player', (p) => {
  if (p.y + p.height - self.y < 10) { self.destroy(); p.vy = -180; } else { game.score = 0; game.restart(); }
});
```
Level exit: `on('overlap','Player', () => game.goToMap('Level 2'));` (map must exist).

## Files

`mcp/server.js` MCP server - `mcp/cli.js` CLI - `mcp/lib/` Node library (PNG codec, text sprites, validation, ASCII map render, export) -
`mcp/test/e2e.mjs` end-to-end test (`node mcp/test/e2e.mjs`) - `src/runtime/engine.js` the engine (no imports) - `src/core/project.js` schema defaults.
Exports go to `exports/<id>.html` (standalone, Phaser from a CDN).
