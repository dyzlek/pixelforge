# PixelForge - guide for AI agents

PixelForge is a 2D game editor + engine that runs in the browser (Vite, vanilla JS, Phaser 3, Blueprint node graphs). A game is **one JSON file**:
`games/<meta.id>.pixelforge.json` (indented 2 spaces). The web editor watches `games/` and reloads when a file changes, so you can
build a game from the terminal and see it live. You can create a complete game without opening the editor.

```
npm install
npm run dev        # editor at http://localhost:5173 (or the port Vite prints); games/ is served live
npm run mcp        # MCP server (stdio), declared in .mcp.json for Claude Code
npm run pf -- list | show <game> | validate <game> | compile <game> | render <game> [map] | export <game> | nodes [word]
npm run build      # must keep passing
```

Games and names: every tool/CLI argument `game` accepts the game id or its name. Override the folder with env `PIXELFORGE_GAMES`.

## Two ways to build a game

**A. MCP tools** (preferred; they validate for you). Call `pixelforge_guide` first (returns this file + the scripting API), then:
`create_game {template:'platformer'|'empty'}` -> `upsert_sprite` (tileset + characters, as text) -> `upsert_object` (sprite, physics, `code` or Blueprint `graph`)
-> `upsert_map` -> `paint_map` -> `place_entities` -> `render_map` (look at your level!) -> `validate_game` -> `export_html`.
Other tools: `list_games get_game duplicate_game delete_game set_settings get_sprite set_script get_script list_nodes set_layer add_sound`.

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
Scripts only run from `script.code`: write it as JavaScript (`mode: 'code'`) or as a Blueprint node graph that compiles to it (`mode: 'graph'`, see **Blueprints**). Scripts and tools refer to things **by name**; the JSON links them **by id**.

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

## Blueprints (script as a node graph)

The editor's visual scripts are **Blueprint graphs** (nodes + wires, like Unreal): `script = { mode: 'graph', code, graph }`. The game still runs only
`script.code`; the graph is **compiled to JavaScript** (same API as above, `docs/SCRIPT_API.md`). Full contract: `docs/BLUEPRINTS.md`.
You can write scripts as plain JavaScript (`mode: 'code'`, recipes above) **or** as a graph. Graph = best when the user wants to read/edit the logic visually.

**With the MCP**: `upsert_object {name, graph}` or `set_script {object, graph}` (object name or `"global"`). `x`/`y` are optional (auto layout), each link `id` is
optional, `fields` / `values` / `extra` default to `{}`. The graph is checked and compiled; errors come back as tool errors (`node n3 (pf_jump): ...`) and nothing
is saved. `get_script` returns the graph (JSON) and the compiled code. `list_nodes {category?, search?}` (CLI: `npm run pf -- nodes [word]`) lists every node
type with its pins and fields: **look nodes up there, do not guess names**. `validate_game` recompiles graphs (errors, warnings, and a warning if `script.code` no longer
matches the graph). **By hand in the JSON**: write `mode: 'graph'`, the `graph` and `code: ""`, then run `npm run pf -- compile <game>`: it compiles every graph script of the
game, writes `script.code` and prints the compile errors (the game runs `script.code`, so an empty or stale `code` means a dead script).

```
graph = { version: 1,
  nodes: [{ id, type, x, y, fields: {}, values: {}, extra: {} }],
  links: [{ id, from: <node id>, fromPin, to: <node id>, toPin }],
  variables: [{ name, default? }],            // script variables (var at the top of the code)
  comments: [] }
```

- **Two kinds of wires.** *Execution* wires (white) set the order of actions: from an output `then` (or `true` / `false` of `flow_branch`, `body` of loops, `done` of
  `pf_wait`, `then0..N` of `flow_sequence`) to the input pin `exec` of the next node. *Data* wires carry a value from an output pin (`out` for pure nodes, `other` /
  `dt` / `tile` / `data` for event nodes) to a data input pin (`VALUE`, `COND`, `X`, `TARGET`...). A node with `kind: 'event'` (`pf_on_update`, `pf_on_overlap`...) starts a
  handler and has no `exec` input; a `pure` node (`pf_key_down`, `math_arithmetic`, `pf_score_get`...) has no exec pins: it is re-evaluated every time it is read.
- **Pin names** = those of `list_nodes` (exact, case-sensitive). One execution output -> at most one wire; an execution input accepts several; a data input accepts one wire,
  a data output many. Types: exec, number, boolean, string, object, color, list, any (a number/boolean/color can feed a string; `any` fits everything).
- **`fields`** = the node's widgets by name (`OBJ`, `PROP`, `KEY`, `NAME`, `SOUND`, `MAP`, `ANIM`, `MS`...). Object / map / sound / animation names are the same case-sensitive names as in scripts.
- **`values`** = literal for each *unconnected* data input, by pin name (`{ "VALUE": 1 }`, `{ "X": 4, "Y": 4, "TEXT": "Score: " }`); otherwise the pin's default (shown by `list_nodes`).
  A wire on the pin takes precedence.
- **`extra`** = dynamic pins: `{ items: 3 }` (`text_join`, `lists_create_with`, `pf_dict`: pins `ADD0..` / `V0..`), `{ params: ['a','b'] }` (`fn_def`; its outputs `ARG0..` carry
  the parameters), `{ name: 'f', params: ['a','b'] }` (`fn_call` / `fn_call_value`, inputs `ARG0..`), `{ outs: 3 }` (`flow_sequence`).
- Nodes marked `[self only]` (anything acting on `self`) are forbidden in the global script (compile error). Nodes not wired to an event or function are ignored.
- Same golden rules as JavaScript (top-left coordinates, overlap vs collide, names...). Use a `flow_branch` for `if`, `flow_while` / `flow_for` / `flow_for_each` for loops,
  `pf_wait` (Delay) for timers, `var_get` / `var_set` for script variables (declare them in `graph.variables`), `pf_selfvar_*` for per-instance variables.

Minimal valid graph, a pickup (Coin object): when the Player overlaps -> destroy self -> score +1 -> play a sound.

```json
{ "mode": "graph", "code": "", "graph": { "version": 1,
  "nodes": [
    { "id": "n1", "type": "pf_on_overlap", "fields": { "OBJ": "Player" } },
    { "id": "n2", "type": "pf_destroy_self" },
    { "id": "n3", "type": "pf_score_add", "values": { "VALUE": 1 } },
    { "id": "n4", "type": "pf_play_sound", "fields": { "SOUND": "coin" } }
  ],
  "links": [
    { "from": "n1", "fromPin": "then", "to": "n2", "toPin": "exec" },
    { "from": "n2", "fromPin": "then", "to": "n3", "toPin": "exec" },
    { "from": "n3", "fromPin": "then", "to": "n4", "toPin": "exec" }
  ] } }
```
compiles to `on('overlap', 'Player', (other) => { self.destroy(); game.score += 1; game.playSound('coin', 1, 1); });`. Same thing through MCP:
`upsert_object {game, name: 'Coin', sprite: 'Coin', physics: {...}, graph: {nodes: [...], links: [...]}}` (no `mode` / `code` needed).

With a condition (data wire into `flow_branch.COND`, branch `true`): moving right while RIGHT is held.

```json
{ "nodes": [
    { "id": "n1", "type": "pf_on_update" },
    { "id": "n2", "type": "pf_self_set", "fields": { "PROP": "vx" }, "values": { "VALUE": 0 } },
    { "id": "n3", "type": "flow_branch" },
    { "id": "n4", "type": "pf_key_down", "fields": { "KEY": "RIGHT" } },
    { "id": "n5", "type": "pf_self_set", "fields": { "PROP": "vx" }, "values": { "VALUE": 90 } } ],
  "links": [
    { "from": "n1", "fromPin": "then", "to": "n2", "toPin": "exec" },
    { "from": "n2", "fromPin": "then", "to": "n3", "toPin": "exec" },
    { "from": "n4", "fromPin": "out", "to": "n3", "toPin": "COND" },
    { "from": "n3", "fromPin": "true", "to": "n5", "toPin": "exec" } ] }
```
-> `on('update', (dt) => { self.vx = 0; if (input.isDown('RIGHT')) { self.vx = 90; } });`

In the editor the user can switch a script between Blueprint and Code (the text keeps the compiled code; going back to the graph regenerates it). Old games saved with Blockly blocks
(`mode: 'blocks'`) are converted automatically on load (`normalizeProject`): never write `mode: 'blocks'` yourself.

## 3D Games (Retro Voxel / Three.js)

PixelForge also supports 3D retro voxel games (`dimension: '3d'`). The game runs with Three.js (custom retro low-res pixelation, PS1 jitter, AABB physics).
To create a 3D game: `create_game { name: 'my-3d-game', dimension: '3d', template: 'platformer3d' }`.

### 3D Project Model & Tools
- `upsert_model { game, name, width, height, depth, slices, legend }`: defines a voxel model by slices along the Y axis. `slices` is an array of Y levels (from Y=0 to Y=height-1), each an array of strings (rows along Z, chars along X). Characters: `.` = empty, `0-9a-f` = sweetie 16 palette color index. Or provide `gltf` base64 data URL.
- `get_model { game, name }`: returns the model as ASCII slices.
- `upsert_scene3d { game, name, environment, start }`: creates or updates a 3D scene (with skyColor, fog, ambient/directional lights).
- `paint_gridmap { game, scene, level, rows, legend, x, z }`: paints solid voxel blocks on Y level `level` of the GridMap. Characters: `.` erases, ` ` leaves unchanged, `0-9a-f` = palette color block.
- `place_entities { game, scene, entities: [{object, x, y, z}] }`: places 3D entity instances in the 3D scene.
- `render_scene3d { game, scene }`: ASCII layer-by-layer render of a 3D scene (X/Z grid per Y level with block colors and entity letters).
- `validate_game`: validates 3D models, scene gridmaps, entity coordinates, and start scene.

### 3D Scripting & Golden Rules
Full 3D scripting API: `docs/SCRIPT_API_3D.md`.
1. **Coordinates**: Three.js Y-up system. X = right, Y = up, Z = forward/backward. Units are world blocks (1 block = 1x1x1 unit).
2. **Movement**: Use `self.moveForward(speed)` and `self.moveRight(speed)` to move relative to current horizontal rotation `self.rotationY`. Or set `self.vx`, `self.vy`, `self.vz` directly.
3. **Rotation**: Rotate with `self.rotateY(angle)` or orient with `self.lookAt(targetX, targetY, targetZ)`.
4. **Jumping**: `self.jump(force)` adds positive vertical impulse to `self.vy` if `self.onGround` is true.
5. **Cameras**: Set camera mode with `game.camera.setMode('third-person'|'first-person'|'top-down'|'isometric'|'side-scroll')`. Follow player with `game.camera.follow(self, { distance: 6, height: 3 })`.

### 3D Recipes

3D Third-person Platformer Player:
```js
on('create', () => {
  game.camera.setMode('third-person');
  game.camera.follow(self, { distance: 6, height: 3 });
  game.setText('hud', 'Score: ' + game.score, 8, 8);
});
on('update', () => {
  let speed = 0;
  if (input.isDown('UP') || input.isDown('W')) speed = 6;
  if (input.isDown('DOWN') || input.isDown('S')) speed = -6;
  if (input.isDown('LEFT') || input.isDown('A')) self.rotateY(-3);
  if (input.isDown('RIGHT') || input.isDown('D')) self.rotateY(3);
  self.moveForward(speed);
  if ((input.justPressed('SPACE') || input.justPressed('UP')) && self.onGround) self.jump(12);
  if (self.y < -10) game.restart();
});
```

3D First-person (FPS) Player:
```js
on('create', () => {
  input.requestPointerLock();
  game.camera.setMode('first-person');
  game.camera.follow(self);
});
on('update', () => {
  const lookSpeed = 0.15;
  self.rotateY((input.mouseDeltaX || 0) * lookSpeed);
  let forward = 0, strafe = 0;
  if (input.isDown('W')) forward = 7;
  if (input.isDown('S')) forward = -7;
  if (input.isDown('A')) strafe = -7;
  if (input.isDown('D')) strafe = 7;
  self.moveForward(forward);
  self.moveRight(strafe);
  if (input.justPressed('SPACE') && self.onGround) self.jump(11);
});
```

3D Rotating Pickup Coin:
```js
on('update', () => { self.rotateY(4); });
on('overlap', 'Player', () => {
  game.score += 1;
  game.setText('hud', 'Score: ' + game.score, 8, 8);
  game.playSound('coin');
  self.destroy();
});
```

## Files

`src/graph/` Blueprint core (node catalogue, compiler, Blockly converter; no DOM) - `src/editors/objects/graph-editor.js` visual editor - `mcp/server.js` MCP server - `mcp/cli.js` CLI - `mcp/lib/` Node library (PNG codec, text sprites, validation, ASCII map render, export, graph checks) -
`mcp/test/e2e.mjs` end-to-end test (`node mcp/test/e2e.mjs`) - `src/runtime/engine.js` the engine (no imports) - `src/core/project.js` schema defaults and script migration - `node src/graph/test/graph.test.mjs` Blueprint compiler test.
Exports go to `exports/<id>.html` (standalone, Phaser from a CDN).
