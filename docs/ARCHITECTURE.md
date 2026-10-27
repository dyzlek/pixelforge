# PixelForge — architecture

Moteur / éditeur de jeux 2D dans le navigateur, basé sur **Phaser 4**.
Vite + JavaScript (modules ES), pas de framework UI.

```
index.html
src/
  main.js              shell : barre du haut, onglets, menu projet (Nouveau / Ouvrir / Enregistrer / Exporter)
  style.css            thème global (variables CSS)
  core/
    project.js         schéma du projet, createEmptyProject(), uid(), helpers
    store.js           état global + événements + sauvegarde auto (localStorage)
    sample.js          projet d'exemple (sprites dessinés en code, carte, scripts)   [runtime]
  editors/
    pixel/             éditeur de pixel art + animations                           [agent pixel]
    map/               éditeur de cartes (tuiles, calques, collisions, entités)    [agent map]
    objects/           objets du jeu : propriétés, physique, script Blueprint OU code
                       (editor.js : bascule Blueprint / Code ; graph-editor.js : éditeur de graphe de nœuds)
  graph/               noyau des Blueprints, sans DOM ni dépendance (navigateur ET node) :
                       nodes.js (catalogue), compile.js (graphe -> JS), fromBlockly.js (ancien format -> graphe),
                       test/ (node src/graph/test/graph.test.mjs ; legacy-blocks.js = référence Blockly du test seulement)
  runtime/
    engine.js          transforme un projet en jeu Phaser (aucun import !)         [agent runtime]
    play.js            onglet « Jouer » + export HTML autonome                    [agent runtime]
docs/
  ARCHITECTURE.md      ce fichier
  SCRIPT_API.md        API des scripts (partagée entre Blueprint, code et runtime)
  BLUEPRINTS.md        format des graphes de nœuds, catalogue, compilation
  PROJECT_SCHEMA.json  JSON Schema du fichier de jeu
```

## Contrat des modules d'onglet

Chaque onglet est un module qui exporte :

```js
export function mount(container, store) { ... }   // appelé à chaque ouverture de l'onglet
export function unmount() { ... }                 // appelé quand on quitte l'onglet (nettoyer listeners, jeux Phaser…)
```

`container` est un `<div class="tab-view">` vide, pleine taille (flex). Le module construit tout son DOM dedans.
Un module ne touche **jamais** au DOM hors de son container, et n'importe jamais un autre éditeur.
Préfixer les classes CSS par le module (`px-`, `map-`, `obj-`, `play-`) et mettre le CSS dans un fichier
`style.css` du dossier du module, importé par le module (`import './style.css'`).

## Store (src/core/store.js)

```js
store.project                 // l'objet projet courant (voir schéma)
store.update(fn, reason?)     // fn(project) modifie le projet en place ; émet 'change' ; sauvegarde auto
store.on(event, cb) -> off()  // événements : 'change' (reason), 'load' (projet remplacé)
store.emit(event, payload)
store.load(projectJson)       // remplace le projet (émet 'load')
store.toJSON()                // string JSON
store.ui                      // état d'interface partagé, libre : { selectedSpriteId, selectedMapId, selectedObjectId }
```

Ne pas garder de copie du projet : toujours relire `store.project` (il est remplacé au chargement).

## Schéma du projet (voir src/core/project.js pour les valeurs par défaut)

```js
{
  version: 1,
  name: 'Mon jeu',
  settings: { width: 320, height: 180, pixelZoom: 3, tileSize: 16, background: '#1a1c2c',
              startMapId: '<id>', gravity: 800 },
  palette: ['#1a1c2c', ...],           // couleurs (hex) proposées dans l'éditeur pixel

  sprites: [{
    id, name,
    width, height,                     // taille d'une frame en pixels
    frames: ['data:image/png;base64,…'],   // une image PNG par frame (taille width×height)
    animations: [{ name: 'idle', frames: [0, 1], fps: 6, loop: true }]
  }],

  // Un « tileset » est simplement un sprite dont chaque frame est une tuile (taille = tileSize).
  objects: [{
    id, name,                          // name est utilisé par les scripts (game.spawn('Coin'), collide 'Coin')
    spriteId, defaultAnim: 'idle' | null,
    hitbox: null | { x, y, w, h },     // en pixels relatifs à la frame ; null = toute la frame
    physics: { enabled: true, gravity: true, immovable: false, bounce: 0, collideMap: true, collideWorld: true },
    script: { mode: 'graph' | 'code', code: '', graph: {…} }      // graph : voir docs/BLUEPRINTS.md (absent en mode code)
  }],

  maps: [{
    id, name,
    width: 40, height: 12,             // en tuiles
    tileSize: 16,
    tilesetSpriteId: '<sprite id>' | null,
    background: '#1a1c2c',
    layers: [{ id, name, data: [-1, …],  // width*height, -1 = vide, sinon index de frame du tileset
               collides: true, visible: true }],
    entities: [{ id, objectId, x, y }]   // x,y en pixels (coin haut-gauche de la frame)
  }],

  globalScript: { mode: 'graph' | 'code', code: '', graph: {…} }
}
```

Le runtime n'exécute **que** `script.code`. En mode `graph`, l'éditeur Blueprint recompile le graphe en JavaScript
(`compileGraph`, `src/graph/compile.js`) et réécrit `code` à chaque modification ; en mode `code`, le texte est libre.

**Migration** : `normalizeProject` (src/core/project.js) convertit les anciens scripts `mode: 'blocks'` (Blockly) : blocs -> graphe
(`blocklyToGraph`), recompilation du code, `mode = 'graph'`, champ `blocks` supprimé ; sans blocs mais avec du code -> `mode: 'code'` ;
vide -> graphe vide. Un script `graph` sans `graph` reçoit un graphe vide. L'éditeur, le serveur MCP et la CLI passent tous par
`normalizeProject` : un jeu ancien s'ouvre donc sans manipulation (le fichier n'est réécrit qu'à la prochaine modification).

### Champs ajoutés en v1.1 (remplis par normalizeProject si absents)

```js
meta: { id, description, author, thumbnail: dataURL|null, createdAt, updatedAt },  // id = identifiant de la bibliothèque
settings.touchControls: true,          // croix + boutons A/B tactiles sur mobile
sounds: [{ id, name,
           kind: 'sfx' | 'file',
           sfx: { preset: 'jump'|'coin'|'hit'|'powerup'|'explosion'|'laser'|'blip'|'portal',
                  seed: 0, volume: 0.5, pitch: 1 },   // son synthétisé (WebAudio), si kind = 'sfx'
           dataUrl: 'data:audio/…' }],                 // fichier importé, si kind = 'file'
songs: [{ id, name, bpm: 130,                          // musiques chiptune multi-voix (FL Studio / tracker)
          channels: [{ id, name, instrument: 'pulse50', volume: 0.8, pan: 0, mute: false, solo: false, env: { a, d, s, r } }],
          patterns: [{ id, name, length: 16, notes: [{ ch, step, len, pitch, vel }] }],
          playlist: [{ pattern: '<id>', track: 0, start: 0 }],
          loop: { enabled: true, start: 0, end: 16 } }],
maps[].layers[].depth: 'below' | 'above',             // 'above' = dessiné devant les entités
maps[].entities[].props: { clé: valeur }              // propriétés propres à l'instance → self.props
```

## Bibliothèque de jeux et stockage

Un projet = un jeu. La bibliothèque contient plusieurs jeux, identifiés par `project.meta.id`.

- **Sur disque (source de vérité quand le serveur de dev tourne)** : `games/<meta.id>.pixelforge.json`
  (JSON du projet, indenté 2 espaces). Le serveur Vite expose une API REST (plugin dans vite.config.js) :
  - `GET /api/games` → `[{ id, name, description, thumbnail, updatedAt }]`
  - `GET /api/games/:id` → projet ; `PUT /api/games/:id` (corps = projet) ; `DELETE /api/games/:id`
  - `GET /api/events` → Server-Sent Events : `{ type: 'game-changed' | 'game-deleted', id }` quand un fichier
    de `games/` change sur disque (par ex. modifié par une IA via le serveur MCP) → l'éditeur recharge le jeu ouvert.
- **Sans serveur (build statique)** : IndexedDB du navigateur, même interface.
- Le serveur MCP (`mcp/`) et la CLI lisent / écrivent directement les fichiers de `games/`.

## IA et Operations Partagees

- `src/core/ops/` : operations pures de manipulation de projet (`upsertSprite`, `upsertObject`, `setScript`, `upsertMap`, `paintMap`, `placeEntities`, `validateProject`, etc.) partagees a 100% entre le navigateur et Node.js sans dependance DOM.
- `src/ai/` : client d'IA local et distant (`client.js` : streaming SSE, OpenAI tool calling, Claude API), agent autonome avec catalogue d'outils et repli plan JSON (`agent.js`), generateurs proceduraux de ressources (`generators.js` : sprites animes en Sweetie 16, musiques tracker/DAW selon style et tempo, modeles 3D voxels et presets CC0, effets sonores sfxr avec pitch/volume adaptes), generateur de jeu complet (`game-generator.js` : GDD structure, progression 3 niveaux Kishotenketsu, boss, Game Feel 2D et 3D), playtester headless et moteur d'autocorrection (`playtester.js` : recherche de chemin BFS platformer, securite de spawn, bac a sable d'execution et reparations automatiques), bases de connaissances de script, de Blueprints et de Game Design (`knowledge.js`, `gamedesign.js`). Toute modification de projet est atomique via `store.update` (un seul Ctrl+Z annule tout).
- `AGENTS.md` (racine) : guide pour toute IA qui veut creer un jeu. `llms.txt` : index court.
- `mcp/` : serveur MCP (stdio) + bibliotheque Node pour manipuler les jeux de `games/`. Declare dans `.mcp.json`.
