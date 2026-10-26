# Blueprints — scripts en graphe de nœuds (remplace Blockly)

Les scripts visuels de PixelForge sont des **graphes de nœuds façon Blueprint d'Unreal Engine** :
des nœuds reliés par des fils d'**exécution** (blancs, ordre des actions) et des fils de **données** (colorés selon le type).
Le runtime n'exécute toujours que `script.code` : le graphe est **compilé en JavaScript** (même API, docs/SCRIPT_API.md).

## Stockage

```js
script = {
  mode: 'graph' | 'code',          // 'blocks' = ancien format Blockly, converti au chargement (normalizeProject)
  code: '...',                     // JS compilé depuis le graphe (mode graph) ou écrit à la main (mode code)
  graph: {
    version: 1,
    nodes: [{ id: 'n1', type: 'pf_on_update', x: 120, y: 80, fields: {}, values: {}, extra: {} }],
    links: [{ id: 'l1', from: 'n1', fromPin: 'then', to: 'n2', toPin: 'exec' }],
    variables: [{ name: 'compteur', default: 0 }],   // variables du script (var en tête du code)
    comments: [{ id: 'c1', x: 0, y: 0, w: 400, h: 200, text: 'Mouvement', color: '#3b5dc9' }],
  },
  blocks: null,                    // ancien Blockly : conservé seulement le temps de la conversion
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
- types compatibles : identiques, ou l'un des deux est `any`, ou `number`/`boolean`/`color` → `string`, `color` ↔ `string`.

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
