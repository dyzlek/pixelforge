# Blueprints — scripts en graphe de nœuds (remplace Blockly)

Les scripts visuels de PixelForge sont des **graphes de nœuds façon Blueprint d'Unreal Engine** :
des nœuds reliés par des fils d'**exécution** (blancs, ordre des actions) et des fils de **données** (colorés selon le type).
Le runtime n'exécute toujours que `script.code` : le graphe est **compilé en JavaScript** (même API, docs/SCRIPT_API.md).

## Stockage

```js
script = {
  mode: 'graph' | 'code',          // 'blocks' (ancien format Blockly) : converti au chargement par normalizeProject, champ blocks supprimé
  code: '...',                     // JS compilé depuis le graphe (mode graph) ou écrit à la main (mode code)
  graph: {
    version: 1,
    nodes: [{ id: 'n1', type: 'pf_on_update', x: 120, y: 80, fields: {}, values: {}, extra: {} }],
    links: [{ id: 'l1', from: 'n1', fromPin: 'then', to: 'n2', toPin: 'exec' }],
    variables: [{ name: 'compteur', default: 0 }],   // variables du script (var en tête du code)
    comments: [{ id: 'c1', x: 0, y: 0, w: 400, h: 200, text: 'Mouvement', color: '#3b5dc9' }],
  },
}
```

- `fields` : valeurs des widgets du nœud (listes déroulantes, texte…), par nom de champ (`OBJ`, `PROP`, `KEY`, `NAME`…).
- `values` : valeurs littérales des **broches de données d'entrée non reliées**, par nom de broche (`{ X: 0, TEXT: 'Score: ' }`).
- `extra` : état des nœuds à broches dynamiques (`{ items: 3 }` pour text_join / lists_create_with / pf_dict ;
  `{ params: ['a','b'] }` pour fn_def ; `{ name: 'f', params: ['a','b'] }` pour fn_call ; `{ outs: 3 }` pour flow_sequence ;
  `{ elseIf: 1, else: true }` n'existe pas : un `if / sinon si` Blockly devient une chaîne de nœuds Branch).
- Coordonnées `x, y` en unités du graphe (coin haut-gauche du nœud), zoom 1 = 1 px.

## Broches

| type      | couleur  | usage |
|-----------|----------|-------|
| `exec`    | #ffffff  | ordre d'exécution (triangle) |
| `number`  | #9cf06a  | nombre |
| `boolean` | #e04848  | vrai / faux |
| `string`  | #f05ad0  | texte |
| `object`  | #41a6f6  | instance (self, autre, trouvé…) |
| `color`   | #ffcd75  | couleur `#rrggbb` (chaîne) |
| `list`    | #73eff7  | liste |
| `any`     | #94b0c2  | n'importe quoi (données de message, variables…) |

Noms de broches :
- entrée d'exécution : `exec` ; sorties d'exécution : `then` (suite), plus celles du nœud (`true`/`false` pour Branch,
  `body` pour les boucles, `done` pour Delay, `then0..thenN` pour Sequence). Un nœud événement n'a pas d'`exec` en entrée.
- données : mêmes noms que les entrées des anciens blocs (`VALUE`, `X`, `Y`, `TARGET`, `MS`…). Sortie d'un nœud pur : `out`.
  Les événements exposent leurs paramètres en sorties : `dt` (update), `other` (collide/overlap*), `tile` (hitTile), `data` (message).

Règles de liaison (comme Unreal) :
- une sortie `exec` → **au plus un** fil ; une entrée `exec` peut en recevoir plusieurs ;
- une entrée de données → **au plus un** fil ; une sortie de données → plusieurs ;
- types compatibles : identiques, ou l'un des deux est `any`, ou `number`/`boolean`/`color` -> `string`, `color` <-> `string`.

## Catalogue des nœuds — `src/graph/nodes.js` (sans DOM, sans dépendance : utilisable sous node)

```js
export const PIN_COLORS = { exec: '#ffffff', number: '#9cf06a', ... };
export const CATEGORIES = [{ id: 'event', label: 'Événements', color: '#b13e53' }, ...]; // ordre d'affichage de la palette
export function getSpec(type)          // → spec | null
export function listSpecs()            // → toutes les specs (palette)
export function resolvePins(node, graph) // → { inputs: Pin[], outputs: Pin[] }  (spec + broches dynamiques)
export function isCompatible(fromType, toType) // → bool
export function fieldOptions(field, ctx)  // ctx = { project, objectId } → [[label, value], ...] pour les listes dynamiques
export function createNode(type, x, y, graph) // → nœud neuf avec id unique, fields/values par défaut

spec = {
  type: 'pf_jump', title: 'Sauter', category: 'move', tooltip: '...',
  kind: 'event' | 'exec' | 'pure',     // event : en-tête rouge, pas d'exec en entrée ; pure : pas d'exec du tout
  inputs:  [{ name: 'exec', type: 'exec' }, { name: 'SPEED', label: 'vitesse', type: 'number', default: 260 }],
  outputs: [{ name: 'then', type: 'exec' }],
  fields:  [{ name: 'PROP', label: 'propriété', kind: 'dropdown', options: [['vx','vx'], ...], default: 'vx' }],
           // kind : dropdown | text | number | checkbox | color | object | map | anim | sound | layer | variable | key
           //   object/map/anim/sound/layer/variable = listes dynamiques (fieldOptions)
  selfOnly: true,                       // interdit dans le script global (self = null)
  keywords: 'saut jump',                // recherche dans la palette
  dynamic: 'items' | 'params' | 'call' | 'outs',  // broches dynamiques gérées par resolvePins et extra
}
Pin = { name, label, type, default? }
```

Types de nœuds : les nœuds PixelForge gardent les noms des anciens blocs (`pf_on_update`, `pf_jump`, `pf_find`…).
Nœuds généraux : `flow_branch`, `flow_sequence`, `flow_while`, `flow_repeat`, `flow_for`, `flow_for_each`, `flow_break`,
`flow_continue`, `var_get`, `var_set`, `var_change`, `fn_def`, `fn_call`, `fn_call_value`, `fn_return`, opérateurs
(`math_*`, `logic_*`, `text_*`, `lists_*` aux noms Blockly), `pf_wait` = **Delay** (sorties `then` tout de suite, `done` après le délai).

## Compilation — `src/graph/compile.js`

```js
export function compileGraph(graph, { isGlobal = false } = {}) // → { code, errors: [{ nodeId, message }], warnings: [...] }
```
- un handler `on(...)` par nœud événement, triés par (y, x) ; le corps suit les fils `exec` ;
- `fn_def` → `function nom(params) { ... }` en tête ; `graph.variables` → `var nom = défaut;` en tête ;
- un nœud pur est **réévalué à chaque lecture** (expression inlinée), comme un nœud pur d'Unreal ;
- broche de données non reliée → `values[nom]`, sinon `default` de la spec ;
- une sortie d'événement (`other`, `dt`…) lue hors de son événement → erreur ; nœud `selfOnly` dans le script global → erreur ;
- les nœuds non reliés à un événement / une fonction sont ignorés (pas d'erreur).

## Conversion Blockly → graphe — `src/graph/fromBlockly.js`

```js
export function blocklyToGraph(blocklyJson) // → graph (mise en page automatique, lisible : exécution de gauche à droite)
```
Les blocs `math_number`, `text`, `logic_boolean`, `pf_colour` branchés sur une entrée deviennent des valeurs littérales (`values`).

## Point d'entrée — `src/graph/index.js` réexporte tout ce qui précède.

## Précisions d'implémentation (noyau `src/graph/`, testé par `node src/graph/test/graph.test.mjs`)

### Catalogue
- `resolvePins(node, graph)` renvoie aussi **`fields`** (champs de la spec + champs dynamiques : `K0..Kn` de `pf_dict`).
- Propriétés de broche en plus : `optional: true` (entrée de données **omise** du code si ni fil ni valeur : `pf_tween_to` X/Y/…,
  `pf_broadcast` DATA, `pf_spawn_props` PROPS, `fn_return` VALUE) ; `implicit: 'tile' | 'other'` (entrée non reliée = valeur du
  contexte d'événement : `pf_tile_info.TILE`, `pf_destroy_other.OTHER` ; hors du bon événement → erreur). Propriété de champ :
  `multiline: true` (`pf_js`, `pf_js_val`).
- Broches dynamiques : `fn_def` → sorties `ARG0..ARGn` (étiquette = nom du paramètre, lues dans le corps de la fonction) ;
  `fn_call` / `fn_call_value` → entrées `ARG0..ARGn` ; `text_join` / `lists_create_with` → `ADD0..` ; `pf_dict` → `V0..` + champs `K0..` ;
  `flow_sequence` → sorties `then0..` (pas de `then`) ; `dynamic: 'at'` (listes : `AT` seulement si WHERE = FROM_START / FROM_END) ;
  `dynamic: 'divisor'` (`math_number_property` : `DIVISOR` seulement si PROPERTY = DIVISIBLE_BY).
- `fn_def` est de `kind: 'event'` (pas d'exec en entrée) mais de catégorie `func`. `flow_for` a un champ `VAR` (variable de boucle, déclarée
  automatiquement) et une sortie `index` ; `flow_for_each` : champ `VAR`, sortie `item`. Les boucles ont une sortie d'exécution `body`.
- Pas de nœuds `pf_dt` / `pf_other` / `pf_msg_data` : ce sont les sorties `dt` / `other` / `data` des événements. `pf_tile_info` (pure) lit `tile`.
- Nœuds ajoutés : `lists_removeIndex` (instruction ; le bloc Blockly `lists_getIndex` en mode REMOVE), nœuds littéraux autonomes
  `math_number`, `text`, `logic_boolean`, `logic_null`, `pf_colour`. Valeurs de `logic_boolean.BOOL` : `'TRUE'` / `'FALSE'`.
- `fieldOptions(field, ctx)` : `ctx = { project, objectId, graph?, value? }` (`graph` pour les variables, `value` = valeur actuelle conservée
  dans la liste si absente du projet). `createNode` remplit `values` avec les défauts des broches de données.

### Compilation
- Gestionnaires triés par (y, x) ; les `fn_def` d'abord. Le texte produit suit celui de Blockly (mêmes gardes `{ const _t = …; if (_t) … }`,
  `_pfRay`, fonctions utilitaires `mathRandomInt` / `mathIsPrime` / `listsGetRandomItem`, noms de boucle `count`, `count2`, `repeat_end`,
  `i_end`/`i_inc`/`i_list`/`i_index`, `tmpList`/`tmpX`, parenthèses selon `Order` de Blockly ; `Order` et `quote` sont exportés).
- `graph.variables` : `{ name, default? }` ; sans `default` → `var a, b;` (une ligne, comme Blockly) ; avec → `var a = 0;`. Une variable utilisée
  mais non déclarée est déclarée automatiquement (avertissement ; silencieux pour les variables de boucle). Les noms sont rendus sûrs
  (`encodeURI` + `_`, préfixe `my_` devant un chiffre, suffixe numérique si collision avec `self game input on dt other tile data _pfRay`,
  mots réservés JS ou noms déjà pris).
- Une branche « Faux » réduite à un seul `flow_branch` sans `then` est écrite `else if` ; chaque nœud exec atteint par plusieurs chemins est
  généré à chaque fois ; un cycle d'exécution, un cycle de données, un type inconnu, ou plus de 20000 instructions générées → erreur.
- Tout nœud `selfOnly` présent dans le graphe d'un script global est une **erreur**, qu'il soit relié ou non.
- Avertissements : lien vers un nœud inexistant, entrée reliée deux fois, champ objet / carte vide, fonction appelée introuvable, variable non déclarée.

### Conversion Blockly
- Blocs désactivés ignorés (ils ne produisaient pas de code) ; blocs isolés conservés (non reliés à un événement) ; bloc inconnu : valeur → `logic_null`,
  instruction → ignorée. `controls_if` → chaîne de `flow_branch` (`false` → branche suivante) ; `UNTIL` → `flow_while` + `logic_negate` ;
  `procedures_ifreturn` → `flow_branch` + `fn_return` ; `procedures_defreturn` → `fn_def` + `fn_return` en fin de corps ; les paramètres lus dans
  le corps deviennent des fils depuis `fn_def.ARGi` (ils ne sont plus déclarés dans `graph.variables`).
- `graph.variables` suit l'ordre de l'en-tête `var` de Blockly (parcours en largeur de tous les blocs). Entrée laissée vide dans Blockly : la valeur
  qu'utilisait le générateur est écrite dans `values` quand elle diffère du défaut du nœud.
- `estimateNodeSize(node, graph)` → `{ w, h }` (exporté par `fromBlockly.js` et `index.js`). Mise en page : chaîne d'exécution de gauche à droite, corps
  (`true` / `false` / `body` / `done`) empilés à droite du nœud, nœuds de données à gauche et sous la rangée des broches d'exécution, groupes placés à
  `40 + 1.5 × position Blockly` puis poussés vers le bas pour ne rien chevaucher.

## Intégration (projet, MCP, CLI)

- `normalizeProject` (`src/core/project.js`, utilisé par l'éditeur, le serveur MCP et la CLI) migre les scripts `mode: 'blocks'` : `blocklyToGraph` →
  `compileGraph` (le code est recompilé), `mode: 'graph'`, champ `blocks` supprimé. Sans blocs mais avec du code → `mode: 'code'` ; vide → graphe vide.
  `emptyScript()` donne `{ mode: 'graph', code: '', graph: <graphe vide> }`. Blockly n'est plus une dépendance de l'application
  (devDependency, uniquement pour comparer le compilateur à l'ancien générateur dans `src/graph/test/`).
- Renommer un objet dans l'éditeur réécrit les champs de nœuds de type `object` (`OBJ`…), les littéraux de broches égaux à l'ancien nom et les chaînes `'Nom'` du code.
- MCP : `upsert_object` / `set_script` acceptent `graph` (ce format ; `x` / `y` / `id` de fil / `fields` / `values` / `extra` facultatifs) : contrôle de structure
  (types, ids, broches des fils), mise en page automatique, compilation ; toute erreur est renvoyée comme erreur d'outil (`node n3 (pf_jump) : …`) et rien n'est enregistré.
  `get_script` renvoie le graphe et le code ; `list_nodes {category?, search?}` (CLI : `npm run pf -- nodes [mot]`) liste les types, broches et champs.
  `validate_game` / `npm run pf -- validate` : erreurs de compilation, avertissements du compilateur, avertissement si `script.code` ≠ code recompilé.
  `npm run pf -- compile <jeu>` recompile tous les graphes d'un jeu édité à la main. Code : `mcp/lib/graph.js`.
