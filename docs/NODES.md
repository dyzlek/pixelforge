# Catalogue des nœuds Blueprint de PixelForge

> Ce document est généré automatiquement par `node scripts/gen-nodes-doc.mjs`.
> Total : **182 nœuds** répartis en **18 catégories**.

## Sommaire des catégories

- [Événements (#event)](#event) (14 nœuds)
- [Flux (#flow)](#flow) (9 nœuds)
- [Fonctions (#func)](#func) (4 nœuds)
- [Variables (#var)](#var) (3 nœuds)
- [Mouvement (#move)](#move) (24 nœuds)
- [Apparence (#look)](#look) (10 nœuds)
- [Objet (#self)](#self) (23 nœuds)
- [Entrée (#input)](#input) (2 nœuds)
- [Souris (#mouse)](#mouse) (5 nœuds)
- [Tuiles & rayons (#tile)](#tile) (12 nœuds)
- [Son (#sound)](#sound) (6 nœuds)
- [Messages (#msg)](#msg) (3 nœuds)
- [Jeu (#game)](#game) (24 nœuds)
- [Caméra & texte (#cam)](#cam) (15 nœuds)
- [Logique (#logic)](#logic) (6 nœuds)
- [Maths (#math)](#math) (11 nœuds)
- [Texte (#text)](#text) (4 nœuds)
- [Listes (#list)](#list) (7 nœuds)

---

## <a id="event"></a>Événements

### `pf_on_create` — Quand créé

**Type de nœud** : Événement  
**Description** : Exécuté une fois, à l'apparition.  
**Mots-clés de recherche** : `create début start`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
});
```

### `pf_on_update` — À chaque image

**Type de nœud** : Événement  
**Description** : Exécuté à chaque image ; dt = secondes écoulées.  
**Mots-clés de recherche** : `update frame tick boucle`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `dt` | `number` | dt |

**Exemple de code JavaScript compilé :**

```javascript
on('update', (dt) => {
});
```

### `pf_on_collide` — Collision avec

**Type de nœud** : Événement  
**Description** : Contact avec un objet (bloquant). « l'autre » = l'objet touché.  
**Mots-clés de recherche** : `collide contact`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `other` | `object` | l'autre |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('collide', '', (other) => {
});
```

### `pf_on_overlap` — Chevauche

**Type de nœud** : Événement  
**Description** : Chevauchement sans blocage, à chaque image. « l'autre » = l'objet touché.  
**Mots-clés de recherche** : `overlap toucher`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `other` | `object` | l'autre |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('overlap', '', (other) => {
});
```

### `pf_on_overlap_start` — Début de chevauchement

**Type de nœud** : Événement  
**Description** : Une seule fois, quand le chevauchement commence. « l'autre » = l'objet touché.  
**Mots-clés de recherche** : `overlapStart entrer`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `other` | `object` | l'autre |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('overlapStart', '', (other) => {
});
```

### `pf_on_overlap_end` — Fin de chevauchement

**Type de nœud** : Événement  
**Description** : Une seule fois, quand le chevauchement se termine. « l'autre » = l'objet quitté.  
**Mots-clés de recherche** : `overlapEnd sortir`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `other` | `object` | l'autre |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('overlapEnd', '', (other) => {
});
```

### `pf_on_key` — Touche pressée

**Type de nœud** : Événement  
**Description** : Touche pressée (une fois).  
**Mots-clés de recherche** : `keydown clavier`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `key` | `"SPACE"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('keydown', 'SPACE', () => {
});
```

### `pf_on_timer` — Minuteur

**Type de nœud** : Événement  
**Description** : Répété toutes les N millisecondes.  
**Mots-clés de recherche** : `timer répéter`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MS` | `number` | `1000` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('timer', 1000, () => {
});
```

### `pf_on_destroy` — Quand détruit

**Type de nœud** : Événement  
**Description** : Juste avant la destruction.  
**Mots-clés de recherche** : `destroy`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Exemple de code JavaScript compilé :**

```javascript
on('destroy', () => {
});
```

### `pf_on_hit_tile` — Tuile solide touchée

**Type de nœud** : Événement  
**Description** : Au début du contact avec une tuile solide (l'objet doit avoir « collision avec la carte »). Lis « tuile touchée » pour les détails.  
**Mots-clés de recherche** : `hitTile mur sol`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `tile` | `any` | tuile |

**Exemple de code JavaScript compilé :**

```javascript
on('hitTile', (tile) => {
});
```

### `pf_on_click` — Clic sur moi

**Type de nœud** : Événement  
**Description** : Clic ou toucher sur cet objet.  
**Mots-clés de recherche** : `click souris`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Exemple de code JavaScript compilé :**

```javascript
on('click', () => {
});
```

### `pf_on_mousedown` — Bouton souris pressé

**Type de nœud** : Événement  
**Description** : Bouton de souris pressé n'importe où.  
**Mots-clés de recherche** : `mousedown clic`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `BTN` | `dropdown` | `"LEFT"` | `LEFT`, `RIGHT` |

**Exemple de code JavaScript compilé :**

```javascript
on('mousedown', 'LEFT', () => {
});
```

### `pf_on_message` — Message reçu

**Type de nœud** : Événement  
**Description** : Un objet a diffusé ce message. « données » donne ce qui a été envoyé.  
**Mots-clés de recherche** : `message broadcast recevoir`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `data` | `any` | données |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"porte"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('message', 'porte', (data) => {
});
```

### `pf_on_beat` — Au battement (rythme)

**Type de nœud** : Événement  
**Description** : Déclenché à chaque battement / temps musical de la musique en cours.  
**Mots-clés de recherche** : `beat rythme bpm pulsation musique`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `beat` | `number` | temps |

**Exemple de code JavaScript compilé :**

```javascript
on('beat', (beat) => {
});
```

---

## <a id="flow"></a>Flux

### `flow_branch` — Branche

**Type de nœud** : Action  
**Description** : Exécute « Vrai » ou « Faux » selon la condition, puis la suite.  
**Mots-clés de recherche** : `if si sinon condition`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `COND` | `boolean` | `false` | condition |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `true` | `exec` | Vrai |
| `false` | `exec` | Faux |

### `flow_sequence` — Séquence

**Type de nœud** : Action  
**Description** : Exécute chaque sortie l'une après l'autre, dans l'ordre.  
**Mots-clés de recherche** : `sequence ordre`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then0` | `exec` | 0 |
| `then1` | `exec` | 1 |

### `flow_while` — Tant que

**Type de nœud** : Action  
**Description** : Répète « Corps » tant que la condition est vraie.  
**Mots-clés de recherche** : `while boucle`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `COND` | `boolean` | `false` | condition |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `body` | `exec` | Corps |

### `flow_repeat` — Répéter

**Type de nœud** : Action  
**Description** : Répète « Corps » un nombre de fois.  
**Mots-clés de recherche** : `repeat boucle`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TIMES` | `number` | `10` | fois |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `body` | `exec` | Corps |

### `flow_for` — Pour

**Type de nœud** : Action  
**Description** : Compte d'une valeur à une autre (la variable de boucle est lisible via « index »).  
**Mots-clés de recherche** : `for boucle compter`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `FROM` | `number` | `1` | de |
| `TO` | `number` | `10` | à |
| `BY` | `number` | `1` | pas |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `body` | `exec` | Corps |
| `index` | `number` | index |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `VAR` | `variable` | `"i"` | — |

### `flow_for_each` — Pour chaque

**Type de nœud** : Action  
**Description** : Parcourt une liste (l'élément courant est lisible via « élément »).  
**Mots-clés de recherche** : `foreach boucle liste`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `LIST` | `list` | — | liste |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `body` | `exec` | Corps |
| `item` | `any` | élément |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `VAR` | `variable` | `"item"` | — |

### `flow_break` — Interrompre

**Type de nœud** : Action  
**Description** : Sort de la boucle.  
**Mots-clés de recherche** : `break`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

### `flow_continue` — Passer au suivant

**Type de nœud** : Action  
**Description** : Passe à l'itération suivante.  
**Mots-clés de recherche** : `continue`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

### `pf_wait` — Délai

**Type de nœud** : Action  
**Description** : Continue tout de suite par « Suite » ; « Terminé » s'exécute une seule fois après ce délai en millisecondes.  
**Mots-clés de recherche** : `wait attendre delay timer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `MS` | `number` | `1000` | ms |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |
| `done` | `exec` | Terminé |

---

## <a id="func"></a>Fonctions

### `fn_def` — Fonction

**Type de nœud** : Événement  
**Description** : Définit une fonction (appelée avec « Appeler »). Les paramètres sont des sorties.  
**Mots-clés de recherche** : `function procédure définir`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"fonction"` | — |

**Exemple de code JavaScript compilé :**

```javascript
function fonction() {
}
```

### `fn_call` — Appeler

**Type de nœud** : Action  
**Description** : Appelle une fonction du script.  
**Mots-clés de recherche** : `function appeler call`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `fn_call_value` — Appeler (valeur)

**Type de nœud** : Pur (expression)  
**Description** : Appelle une fonction du script et renvoie son résultat.  
**Mots-clés de recherche** : `function appeler call retour`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `fn_return` — Retourner

**Type de nœud** : Action  
**Description** : Quitte la fonction (ou le gestionnaire) en renvoyant une valeur facultative.  
**Mots-clés de recherche** : `return retour`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | — | valeur |

---

## <a id="var"></a>Variables

### `var_get` — Lire variable

**Type de nœud** : Pur (expression)  
**Description** : Valeur d'une variable du script.  
**Mots-clés de recherche** : `variable get`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `variable` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `var_set` — Définir variable

**Type de nœud** : Action  
**Description** : Affecte une valeur à une variable du script.  
**Mots-clés de recherche** : `variable set`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `variable` | `""` | — |

### `var_change` — Changer variable de

**Type de nœud** : Action  
**Description** : Ajoute une valeur à une variable du script.  
**Mots-clés de recherche** : `variable incrémenter add`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `DELTA` | `number` | `1` | delta |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `variable` | `""` | — |

---

## <a id="move"></a>Mouvement

### `pf_self_set` — Définir

**Type de nœud** : Action  
**Description** : Fixe une propriété de l'objet.  
**Mots-clés de recherche** : `set fixer vitesse`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"vx"` | `x`, `y`, `vx`, `vy`, `angle`, `alpha`, `flipX`, `visible`, `depth`, `scale`, `flipY`, `collideMap`, `collideObjects` |

### `pf_self_change` — Ajouter à

**Type de nœud** : Action  
**Description** : Ajoute une valeur à une propriété de l'objet.  
**Mots-clés de recherche** : `change incrémenter`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `number` | `1` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"x"` | `x`, `y`, `vx`, `vy`, `angle`, `scale` |

### `pf_jump` — Sauter

**Type de nœud** : Action  
**Description** : Saute (seulement si l'objet touche le sol).  
**Mots-clés de recherche** : `jump saut`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `SPEED` | `number` | `260` | vitesse |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_move_towards` — Se diriger vers

**Type de nœud** : Action  
**Description** : Règle la vitesse vers un autre objet.  
**Mots-clés de recherche** : `suivre poursuivre`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | objet |
| `SPEED` | `number` | `40` | vitesse |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_flip` — Miroir

**Type de nœud** : Action  
**Description** : Retourne l'image horizontalement.  
**Mots-clés de recherche** : `flip`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ON` | `dropdown` | `"true"` | `true`, `false` |

### `pf_gravity` — Gravité

**Type de nœud** : Action  
**Description** : Active ou coupe la gravité de cet objet.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ON` | `dropdown` | `"true"` | `true`, `false` |

### `pf_distance_to` — Distance jusqu'à

**Type de nœud** : Pur (expression)  
**Description** : Distance en pixels jusqu'à un autre objet.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TARGET` | `object` | — | objet |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_set_position` — Placer

**Type de nœud** : Action  
**Description** : Place l'objet (coin haut-gauche, en pixels).  
**Mots-clés de recherche** : `position téléporter`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_set_velocity` — Définir vitesse

**Type de nœud** : Action  
**Description** : Règle la vitesse (pixels par seconde).  
**Mots-clés de recherche** : `velocity`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VX` | `number` | `0` | vx |
| `VY` | `number` | `0` | vy |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_set_vel_angle` — Vitesse par angle

**Type de nœud** : Action  
**Description** : Vitesse dans une direction. Angle en degrés : 0 = droite, 90 = bas, -90 = haut.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `ANGLE` | `number` | `0` | angle |
| `SPEED` | `number` | `100` | vitesse |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_angle_to_obj` — Angle vers objet

**Type de nœud** : Pur (expression)  
**Description** : Angle en degrés (0 = droite, 90 = bas) de cet objet vers un autre objet.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TARGET` | `object` | — | objet |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_angle_to_point` — Angle vers point

**Type de nœud** : Pur (expression)  
**Description** : Angle en degrés (0 = droite, 90 = bas) de cet objet vers un point du monde.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_angle_to_mouse` — Angle vers la souris

**Type de nœud** : Pur (expression)  
**Description** : Angle en degrés (0 = droite, 90 = bas) de cet objet vers la souris.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_speed` — Ma vitesse

**Type de nœud** : Pur (expression)  
**Description** : Norme ou direction (angle en degrés) de la vitesse actuelle.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"speed"` | `speed`, `dir` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_atan2` — Angle du vecteur

**Type de nœud** : Pur (expression)  
**Description** : Angle en degrés (0 = droite, 90 = bas) d'un vecteur (dx, dy). Utile avec la normale d'un rayon.  
**Mots-clés de recherche** : `atan2`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `DX` | `number` | `1` | dx |
| `DY` | `number` | `0` | dy |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_blocked` — Bloqué ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai si l'objet est bloqué de ce côté par un mur, le sol ou une autre instance qui collide.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `SIDE` | `dropdown` | `"down"` | `down`, `up`, `left`, `right` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_self_set_3d` — Définir propriété 3D

**Type de nœud** : Action  
**Description** : Fixe une coordonnée ou vitesse 3D de cet objet.  
**Mots-clés de recherche** : `3d position vitesse coordonnee`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `number` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"vx"` | `x`, `y`, `z`, `vx`, `vy`, `vz`, `rotationY`, `rotationX`, `rotationZ` |

### `pf_self_get_3d` — Lire propriété 3D

**Type de nœud** : Pur (expression)  
**Description** : Lit une coordonnée ou vitesse 3D de cet objet.  
**Mots-clés de recherche** : `3d position vitesse coordonnee`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"x"` | `x`, `y`, `z`, `vx`, `vy`, `vz`, `rotationY`, `rotationX`, `rotationZ` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_jump_3d` — Sauter 3D

**Type de nœud** : Action  
**Description** : Fait sauter l'objet vers le haut (+Y) s'il touche le sol.  
**Mots-clés de recherche** : `3d saut jump impulsion`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `FORCE` | `number` | `10` | force |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_move_forward_3d` — Avancer (direction regardée)

**Type de nœud** : Action  
**Description** : Avance dans la direction horizontale actuellement regardée.  
**Mots-clés de recherche** : `3d avancer forward vitesse`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `SPEED` | `number` | `5` | vitesse |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_move_right_3d` — Déplacement latéral (strafe)

**Type de nœud** : Action  
**Description** : Déplacement latéral perpendiculaire à l'angle de vue.  
**Mots-clés de recherche** : `3d strafe lateral droite gauche`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `SPEED` | `number` | `5` | vitesse |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_look_at_3d` — Regarder vers 3D

**Type de nœud** : Action  
**Description** : Oriente l'objet vers les coordonnées cibles.  
**Mots-clés de recherche** : `3d orientation regarder cibler`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `Z` | `number` | `0` | z |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_rotate_y_3d` — Pivoter horizontalement

**Type de nœud** : Action  
**Description** : Ajoute un angle à l'orientation horizontale de l'objet.  
**Mots-clés de recherche** : `3d tourner pivoter rotation`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `ANGLE` | `number` | `45` | angle (°) |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_distance_3d` — Distance 3D

**Type de nœud** : Pur (expression)  
**Description** : Calcule la distance euclidienne entre deux points dans l'espace 3D.  
**Mots-clés de recherche** : `3d distance euclidienne hypot`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `X1` | `number` | `0` | x1 |
| `Y1` | `number` | `0` | y1 |
| `Z1` | `number` | `0` | z1 |
| `X2` | `number` | `0` | x2 |
| `Y2` | `number` | `0` | y2 |
| `Z2` | `number` | `0` | z2 |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="look"></a>Apparence

### `pf_tween_to` — Animer vers

**Type de nœud** : Action  
**Description** : Anime l'objet vers ces valeurs. Les entrées laissées vides ne changent pas. Pour un objet à gravité, coupe d'abord la gravité.  
**Mots-clés de recherche** : `tween animer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `any` | — | x |
| `Y` | `any` | — | y |
| `ALPHA` | `any` | — | opacité |
| `ANGLE` | `any` | — | angle |
| `SCALE` | `any` | — | échelle |
| `MS` | `any` | `400` | durée (ms) |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_play` — Jouer l'animation

**Type de nœud** : Action  
**Description** : Joue une animation du sprite de l'objet.  
**Mots-clés de recherche** : `animation play`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ANIM` | `anim` | `""` | — |

### `pf_visible` — Afficher / cacher

**Type de nœud** : Action  
**Description** : Affiche ou cache l'objet.  
**Mots-clés de recherche** : `visible`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ON` | `dropdown` | `"true"` | `true`, `false` |

### `pf_alpha` — Opacité

**Type de nœud** : Action  
**Description** : Opacité de l'objet (0 à 1).  
**Mots-clés de recherche** : `alpha`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `number` | `1` | opacité |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_tint_set` — Teinter

**Type de nœud** : Action  
**Description** : Teinte l'objet avec une couleur.  
**Mots-clés de recherche** : `tint couleur`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `COLOR` | `color` | `"#ff8040"` | couleur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_tint_none` — Enlever la teinte

**Type de nœud** : Action  
**Description** : Enlève la teinte.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_filter_add` — Ajouter un filtre

**Type de nœud** : Action  
**Description** : Applique un filtre visuel (lueur, flou, pixellisation, ombre) sur cet objet (Phaser 4).  
**Mots-clés de recherche** : `filtre fx glow lueur flou blur pixelate`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `COLOR` | `color` | `"#ffffff"` | couleur |
| `INTENSITY` | `number` | `2` | intensité |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `FILTER` | `dropdown` | `"glow"` | `glow`, `blur`, `pixelate`, `vignette`, `shadow` |

### `pf_filter_clear` — Enlever les filtres

**Type de nœud** : Action  
**Description** : Enlève tous les filtres visuels appliqués sur cet objet.  
**Mots-clés de recherche** : `filtre clear`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_tint_mode` — Mode de teinte

**Type de nœud** : Action  
**Description** : Définit le mode de fusion de teinte (Phaser 4 : multiply, fill, add, screen, overlay).  
**Mots-clés de recherche** : `tint mode fusion`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `"multiply"` | `multiply`, `fill`, `add`, `screen`, `overlay` |

### `pf_colour` — Couleur

**Type de nœud** : Pur (expression)  
**Description** : Une couleur (clique pour choisir). Texte « #rrggbb ».  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `color` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `COL` | `color` | `"#ff8040"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="self"></a>Objet

### `pf_self_get` — Ma propriété

**Type de nœud** : Pur (expression)  
**Description** : Lit une propriété de l'objet.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"x"` | `x`, `y`, `vx`, `vy`, `angle`, `alpha`, `flipX`, `visible`, `depth`, `scale`, `flipY`, `collideMap`, `collideObjects`, `id`, `onGround`, `width`, `height`, `name`, `centerX`, `centerY` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_self_id` — Mon numéro (id)

**Type de nœud** : Pur (expression)  
**Description** : Numéro unique de cette instance.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_props_get` — Mes propriétés

**Type de nœud** : Pur (expression)  
**Description** : Propriété de l'instance, définie dans la carte ou à la création (« créer … avec propriétés »).  
**Mots-clés de recherche** : `props`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"cle"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_props_set` — Définir mes propriétés

**Type de nœud** : Action  
**Description** : Fixe une propriété de l'instance (self.props).  
**Mots-clés de recherche** : `props`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"cle"` | — |

### `pf_obj_prop` — Propriété d'un objet

**Type de nœud** : Pur (expression)  
**Description** : Propriété (self.props) d'un autre objet.  
**Mots-clés de recherche** : `props`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TARGET` | `object` | — | objet |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"cle"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_selfvar_set` — Définir variable d'objet

**Type de nœud** : Action  
**Description** : Variable propre à cette instance (self.vars).  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"compteur"` | — |

### `pf_selfvar_get` — Variable d'objet

**Type de nœud** : Pur (expression)  
**Description** : Variable propre à cette instance (self.vars).  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"compteur"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_find` — Premier objet

**Type de nœud** : Pur (expression)  
**Description** : Première instance de cet objet (ou rien).  
**Mots-clés de recherche** : `find trouver`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `object` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_find_all` — Tous les objets

**Type de nœud** : Pur (expression)  
**Description** : Liste de toutes les instances de cet objet.  
**Mots-clés de recherche** : `findAll`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `list` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_obj_get` — Propriété d'un objet

**Type de nœud** : Pur (expression)  
**Description** : Lit une propriété d'un autre objet.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TARGET` | `object` | — | objet |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"x"` | `x`, `y`, `vx`, `vy`, `angle`, `alpha`, `flipX`, `visible`, `depth`, `scale`, `flipY`, `collideMap`, `collideObjects`, `id`, `onGround`, `width`, `height`, `name`, `centerX`, `centerY` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_obj_set` — Définir sur un objet

**Type de nœud** : Action  
**Description** : Fixe une propriété d'un autre objet.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | objet |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"x"` | `x`, `y`, `vx`, `vy`, `angle`, `alpha`, `flipX`, `visible`, `depth`, `scale`, `flipY`, `collideMap`, `collideObjects` |

### `pf_destroy_target` — Détruire

**Type de nœud** : Action  
**Description** : Détruit l'objet donné.  
**Mots-clés de recherche** : `destroy supprimer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | objet |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_count_of` — Nombre de

**Type de nœud** : Pur (expression)  
**Description** : Nombre d'instances vivantes de cet objet.  
**Mots-clés de recherche** : `count`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_self_ref` — Moi-même

**Type de nœud** : Pur (expression)  
**Description** : Cet objet lui-même, à brancher sur une entrée « cible ».  
**Mots-clés de recherche** : `self`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `object` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_exists` — Existe ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai si la cible existe (par exemple « premier Portail » ou « instance touchée par le rayon »).  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TARGET` | `object` | — | cible |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_t_set_position` — Placer (cible)

**Type de nœud** : Action  
**Description** : Place la cible (coin haut-gauche, en pixels).  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_t_set_velocity` — Vitesse (cible)

**Type de nœud** : Action  
**Description** : Règle la vitesse de la cible (pixels par seconde).  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |
| `VX` | `number` | `0` | vx |
| `VY` | `number` | `0` | vy |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_t_set_vel_angle` — Vitesse par angle (cible)

**Type de nœud** : Action  
**Description** : Vitesse de la cible dans une direction. Angle en degrés : 0 = droite, 90 = bas, -90 = haut.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |
| `ANGLE` | `number` | `0` | angle |
| `SPEED` | `number` | `100` | vitesse |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_t_orient` — Orienter (cible)

**Type de nœud** : Action  
**Description** : Oriente la cible selon une normale (angle = atan2(ny, nx), en degrés) + un décalage. 0 = le sprite regarde à droite.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |
| `NX` | `number` | `0` | normale nx |
| `NY` | `number` | `-1` | normale ny |
| `OFFSET` | `number` | `0` | décalage ° |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_t_collide_map` — Collision carte (cible)

**Type de nœud** : Action  
**Description** : La cible traverse la carte (collision coupée) ou la heurte à nouveau. Nécessite « collision avec la carte » sur l'objet.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ON` | `dropdown` | `"true"` | `true`, `false` |

### `pf_t_collide_objs` — Collision objets (cible)

**Type de nœud** : Action  
**Description** : La cible ne bloque plus (ou bloque à nouveau) les autres objets en « collision ». Les chevauchements ne changent pas.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ON` | `dropdown` | `"true"` | `true`, `false` |

### `pf_t_hitbox` — Hitbox (cible)

**Type de nœud** : Action  
**Description** : Boîte de collision de la cible, relative à son image (pixels).  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `W` | `number` | `16` | largeur |
| `H` | `number` | `16` | hauteur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_t_prop_set` — Propriété (cible)

**Type de nœud** : Action  
**Description** : Fixe une propriété (self.props) de la cible.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | cible |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"cle"` | — |

---

## <a id="input"></a>Entrée

### `pf_key_down` — Touche maintenue ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai tant que la touche est maintenue.  
**Mots-clés de recherche** : `isDown clavier`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `key` | `"SPACE"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_key_just` — Touche pressée ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai seulement l'image où la touche est pressée.  
**Mots-clés de recherche** : `justPressed clavier`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `key` | `"SPACE"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="mouse"></a>Souris

### `pf_mouse_pos` — Position souris

**Type de nœud** : Pur (expression)  
**Description** : Position de la souris : dans le monde (pixels de la carte) ou dans l'écran du jeu.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"mouseX"` | `mouseX`, `mouseY`, `mouseScreenX`, `mouseScreenY` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_mouse_down` — Bouton souris maintenu ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai tant que le bouton de la souris est maintenu.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `BTN` | `dropdown` | `"LEFT"` | `LEFT`, `RIGHT` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_mouse_just` — Bouton souris pressé ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai seulement l'image où le bouton est pressé.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `BTN` | `dropdown` | `"LEFT"` | `LEFT`, `RIGHT` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_mouse_delta` — Déplacement souris (Delta)

**Type de nœud** : Pur (expression)  
**Description** : Déplacement de la souris depuis la dernière image (utile pour la vue FPS).  
**Mots-clés de recherche** : `souris delta mouse pointer fps`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `AXIS` | `dropdown` | `"x"` | `x`, `y` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_pointer_lock` — Verrouiller le curseur

**Type de nœud** : Action  
**Description** : Verrouille le curseur de la souris pour le contrôle FPS subjectif.  
**Mots-clés de recherche** : `souris pointer lock verrouiller fps`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

---

## <a id="tile"></a>Tuiles & rayons

### `pf_tile_info` — Tuile touchée

**Type de nœud** : Pur (expression)  
**Description** : Information sur la tuile touchée (dans « Tuile solide touchée »). Le côté est celui de l'objet qui touche.  
**Mots-clés de recherche** : `tile`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TILE` | `any` | — | tuile |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"tx"` | `tx`, `ty`, `x`, `y`, `index`, `side`, `layer` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_get_tile` — Numéro de tuile

**Type de nœud** : Pur (expression)  
**Description** : Numéro de la tuile (-1 si vide ou hors carte).  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `TX` | `number` | `0` | colonne |
| `TY` | `number` | `0` | ligne |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `LAYER` | `layer` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_set_tile` — Changer une tuile

**Type de nœud** : Action  
**Description** : Change une tuile (-1 pour la supprimer). Les collisions suivent immédiatement.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TX` | `number` | `0` | colonne |
| `TY` | `number` | `0` | ligne |
| `INDEX` | `number` | `-1` | devient |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `LAYER` | `layer` | `""` | — |

### `pf_is_solid_at` — Solide en (x, y) ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai si le point (en pixels) est dans une tuile solide.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_tile_size` — Taille des tuiles

**Type de nœud** : Pur (expression)  
**Description** : Taille d'une tuile en pixels.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_to_tile` — Pixels → tuile

**Type de nœud** : Pur (expression)  
**Description** : Convertit une position en pixels en coordonnée de tuile.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `PX` | `number` | `0` | pixels |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_raycast` — Rayon (résultat)

**Type de nœud** : Pur (expression)  
**Description** : Lance un rayon contre les tuiles solides (et, au choix, les objets) et renvoie le résultat. Mets-le dans une variable, puis lis-le avec « Champ du rayon ».  
**Mots-clés de recherche** : `raycast`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `ANGLE` | `number` | `0` | angle |
| `DIST` | `number` | `600` | distance max |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `""` | ``, `objs`, `all` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_ray_cast` — Lancer un rayon

**Type de nœud** : Action  
**Description** : Lance un rayon contre les tuiles solides (et, au choix, les objets) et mémorise le résultat, à lire avec « Dernier rayon ».  
**Mots-clés de recherche** : `raycast`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `ANGLE` | `number` | `0` | angle |
| `DIST` | `number` | `600` | distance max |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `""` | ``, `objs`, `all` |

### `pf_ray_cast_mouse` — Rayon vers la souris

**Type de nœud** : Action  
**Description** : Lance un rayon depuis le centre de l'objet vers la souris et mémorise le résultat.  
**Mots-clés de recherche** : `raycast`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `DIST` | `number` | `600` | distance max |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `""` | ``, `objs`, `all` |

### `pf_ray_last` — Dernier rayon

**Type de nœud** : Pur (expression)  
**Description** : Lit le résultat du dernier rayon lancé par « Lancer un rayon ». Sans impact : touché = faux.  
**Mots-clés de recherche** : `raycast`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `FIELD` | `dropdown` | `"hit"` | `hit`, `x`, `y`, `tx`, `ty`, `normalX`, `normalY`, `side`, `distance`, `layer`, `instance`, `objectName` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_ray_get` — Champ du rayon

**Type de nœud** : Pur (expression)  
**Description** : Lit un champ d'un résultat de « Rayon (résultat) » mis dans une variable.  
**Mots-clés de recherche** : `raycast`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `RAY` | `any` | — | rayon |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `FIELD` | `dropdown` | `"hit"` | `hit`, `x`, `y`, `tx`, `ty`, `normalX`, `normalY`, `side`, `distance`, `layer`, `instance`, `objectName` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_side` — Côté

**Type de nœud** : Pur (expression)  
**Description** : Un côté, à comparer avec « côté touché » ou « tuile touchée : côté ».  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `string` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `SIDE` | `dropdown` | `"left"` | `left`, `right`, `up`, `down` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="sound"></a>Son

### `pf_play_sound` — Jouer un son

**Type de nœud** : Action  
**Description** : Joue un son du projet ou un preset (volume 0-1, pitch 1 = normal).  
**Mots-clés de recherche** : `sound audio`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VOL` | `number` | `1` | volume |
| `PITCH` | `number` | `1` | pitch |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `SOUND` | `sound` | `""` | — |

### `pf_play_music` — Jouer la musique

**Type de nœud** : Action  
**Description** : Joue en boucle (relancer la même musique ne fait rien).  
**Mots-clés de recherche** : `music`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `SOUND` | `sound` | `""` | — |

### `pf_stop_music` — Arrêter la musique

**Type de nœud** : Action  
**Description** : Arrête la musique.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_play_song` — Jouer un morceau

**Type de nœud** : Action  
**Description** : Lance la lecture d'un morceau chiptune avec options de volume et fondu.  
**Mots-clés de recherche** : `song music chiptune`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VOL` | `number` | `1` | volume |
| `LOOP` | `boolean` | `true` | boucle |
| `FADE_IN` | `number` | `0` | fondu entrant (s) |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `SONG` | `song` | `""` | — |

### `pf_stop_song` — Arrêter le morceau

**Type de nœud** : Action  
**Description** : Arrête la lecture du morceau actuel avec option de fondu sortant.  
**Mots-clés de recherche** : `stop song music`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `FADE_OUT` | `number` | `0` | fondu sortant (s) |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_set_song_volume` — Volume du morceau

**Type de nœud** : Action  
**Description** : Modifie le volume du morceau en cours de lecture.  
**Mots-clés de recherche** : `volume song music`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VOL` | `number` | `1` | volume |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

---

## <a id="msg"></a>Messages

### `pf_broadcast` — Diffuser un message

**Type de nœud** : Action  
**Description** : Envoie un message à tous les objets qui l'écoutent. Les données sont facultatives.  
**Mots-clés de recherche** : `broadcast envoyer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `DATA` | `any` | — | données |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"porte"` | — |

### `pf_value_field` — Champ d'un ensemble

**Type de nœud** : Pur (expression)  
**Description** : Lit un champ d'un ensemble de propriétés (données de message, résultat…). Vide si absent.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `OBJ` | `any` | — | ensemble |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"cle"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_dict` — Ensemble de propriétés

**Type de nœud** : Pur (expression)  
**Description** : Ensemble de propriétés « clé = valeur ». À brancher sur « Créer … avec propriétés » ou « Diffuser un message ».  
**Mots-clés de recherche** : `dict objet clé valeur`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="game"></a>Jeu

### `pf_score_set` — Fixer le score

**Type de nœud** : Action  
**Description** : Fixe le score.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `number` | `0` | score |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_score_add` — Ajouter au score

**Type de nœud** : Action  
**Description** : Ajoute au score.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `number` | `1` | points |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_score_get` — Score

**Type de nœud** : Pur (expression)  
**Description** : Le score.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_gvar_set` — Définir variable globale

**Type de nœud** : Action  
**Description** : Variable globale partagée entre les objets et les cartes.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"niveau"` | — |

### `pf_gvar_get` — Variable globale

**Type de nœud** : Pur (expression)  
**Description** : Variable globale partagée entre les objets et les cartes.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NAME` | `text` | `"niveau"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_spawn` — Créer

**Type de nœud** : Action  
**Description** : Crée une nouvelle instance.  
**Mots-clés de recherche** : `spawn instancier`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

### `pf_spawn_props` — Créer avec propriétés

**Type de nœud** : Action  
**Description** : Crée une instance avec des propriétés, lisibles dès « Quand créé » via « Mes propriétés ».  
**Mots-clés de recherche** : `spawn instancier`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `PROPS` | `any` | — | propriétés |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

### `pf_spawn_val` — Créer (instance)

**Type de nœud** : Pur (expression)  
**Description** : Crée une instance (avec propriétés facultatives) et renvoie l'instance : mets-la dans une variable.  
**Mots-clés de recherche** : `spawn instancier`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `PROPS` | `any` | — | propriétés |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `object` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OBJ` | `object` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_destroy_self` — Me détruire

**Type de nœud** : Action  
**Description** : Détruit cet objet.  
**Mots-clés de recherche** : `destroy supprimer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_destroy_other` — Détruire l'autre

**Type de nœud** : Action  
**Description** : Détruit l'objet touché (dans « Collision » / « Chevauche »).  
**Mots-clés de recherche** : `destroy supprimer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `OTHER` | `object` | — | l'autre |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_goto_map` — Aller à la carte

**Type de nœud** : Action  
**Description** : Change de carte.  
**Mots-clés de recherche** : `map niveau`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MAP` | `map` | `""` | — |

### `pf_restart` — Recommencer la carte

**Type de nœud** : Action  
**Description** : Recharge la carte courante.  
**Mots-clés de recherche** : `restart rejouer`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_current_map` — Carte courante

**Type de nœud** : Pur (expression)  
**Description** : Nom de la carte courante.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `string` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_pause` — Mettre en pause

**Type de nœud** : Action  
**Description** : Gèle la physique, les « à chaque image », les timers, les attentes et les animations. Les touches, clics et messages restent actifs.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_resume` — Reprendre le jeu

**Type de nœud** : Action  
**Description** : Reprend le jeu après une pause.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_is_paused` — En pause ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai si le jeu est en pause.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_particles` — Particules

**Type de nœud** : Action  
**Description** : Petites particules carrées à une position du monde.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |
| `COLOR` | `color` | `"#ffcd75"` | couleur |
| `COUNT` | `number` | `12` | nombre |
| `SPEED` | `number` | `80` | vitesse |
| `MS` | `number` | `500` | durée (ms) |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_save` — Sauvegarder

**Type de nœud** : Action  
**Description** : Sauvegarde une valeur dans le navigateur (propre à ce jeu).  
**Mots-clés de recherche** : `save stockage`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"record"` | — |

### `pf_load` — Charger

**Type de nœud** : Pur (expression)  
**Description** : Relit une valeur sauvegardée (ou la valeur par défaut).  
**Mots-clés de recherche** : `load stockage`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `DEFAULT` | `any` | `0` | défaut |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `KEY` | `text` | `"record"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_random` — Aléatoire entre

**Type de nœud** : Pur (expression)  
**Description** : Entier aléatoire (bornes incluses).  
**Mots-clés de recherche** : `random hasard`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `MIN` | `number` | `1` | min |
| `MAX` | `number` | `6` | max |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_game_info` — Dimensions

**Type de nœud** : Pur (expression)  
**Description** : Dimensions de l'écran et de la carte.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"width"` | `width`, `height`, `mapWidth`, `mapHeight` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_log` — Écrire dans la console

**Type de nœud** : Action  
**Description** : Affiche dans la console du jeu.  
**Mots-clés de recherche** : `log print debug`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `any` | `"Bonjour"` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_js` — JavaScript

**Type de nœud** : Action  
**Description** : Exécute une instruction JavaScript.  
**Mots-clés de recherche** : `js code script`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `CODE` | `text` | `"/* code */"` | — |

### `pf_js_val` — JavaScript (valeur)

**Type de nœud** : Pur (expression)  
**Description** : Évalue une expression JavaScript.  
**Mots-clés de recherche** : `js code script`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `EXPR` | `text` | `"/* expression */"` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="cam"></a>Caméra & texte

### `pf_set_text` — Afficher le texte

**Type de nœud** : Action  
**Description** : Texte fixe à l'écran (créé ou mis à jour par identifiant).  
**Mots-clés de recherche** : `text hud`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TEXT` | `any` | `"Score: "` | texte |
| `X` | `number` | `4` | x |
| `Y` | `number` | `4` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ID` | `text` | `"score"` | — |

### `pf_set_text_opts` — Afficher le texte (options)

**Type de nœud** : Action  
**Description** : Texte à l'écran avec couleur, taille (1 = normale) et alignement (avec centré / droite, x est le centre / le bord droit).  
**Mots-clés de recherche** : `text hud`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TEXT` | `any` | `"Score: "` | texte |
| `X` | `number` | `4` | x |
| `Y` | `number` | `4` | y |
| `COLOR` | `color` | `"#ffffff"` | couleur |
| `SIZE` | `number` | `1` | taille |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ID` | `text` | `"score"` | — |
| `ALIGN` | `dropdown` | `"left"` | `left`, `center`, `right` |

### `pf_remove_text` — Effacer le texte

**Type de nœud** : Action  
**Description** : Retire un texte affiché.  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `ID` | `text` | `"score"` | — |

### `pf_cam_follow_self` — Caméra : me suivre

**Type de nœud** : Action  
**Description** : La caméra suit cet objet.  
**Mots-clés de recherche** : `camera follow`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_follow` — Caméra : suivre

**Type de nœud** : Action  
**Description** : La caméra suit l'objet donné.  
**Mots-clés de recherche** : `camera follow`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `TARGET` | `object` | — | objet |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_shake` — Caméra : secouer

**Type de nœud** : Action  
**Description** : Secoue la caméra.  
**Mots-clés de recherche** : `camera shake`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `MS` | `number` | `200` | durée (ms) |
| `POWER` | `number` | `0.01` | intensité |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_flash` — Caméra : flash

**Type de nœud** : Action  
**Description** : Flash blanc.  
**Mots-clés de recherche** : `camera flash`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `MS` | `number` | `200` | durée (ms) |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_zoom` — Caméra : zoom

**Type de nœud** : Action  
**Description** : Zoom de la caméra (1 = normal).  
**Mots-clés de recherche** : `camera zoom`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `Z` | `number` | `1` | zoom |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_deadzone` — Caméra : zone morte

**Type de nœud** : Action  
**Description** : Zone morte au centre de l'écran (px) : la caméra ne bouge que si la cible en sort.  
**Mots-clés de recherche** : `camera deadzone`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `W` | `number` | `40` | largeur |
| `H` | `number` | `30` | hauteur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_offset` — Caméra : décalage

**Type de nœud** : Action  
**Description** : Décalage de la caméra par rapport à la cible suivie (px).  
**Mots-clés de recherche** : `camera offset`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `X` | `number` | `0` | x |
| `Y` | `number` | `0` | y |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_filter` — Caméra : filtre

**Type de nœud** : Action  
**Description** : Applique un filtre visuel plein écran sur la caméra (CRT, vignette, flou, pixellisation).  
**Mots-clés de recherche** : `camera filtre crt postfx vignette flou`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `INTENSITY` | `number` | `1.5` | intensité |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `FILTER` | `dropdown` | `"crt"` | `crt`, `vignette`, `blur`, `pixelate` |

### `pf_cam_clear_filters` — Caméra : enlever les filtres

**Type de nœud** : Action  
**Description** : Enlève tous les filtres plein écran de la caméra.  
**Mots-clés de recherche** : `camera clear filtre`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

### `pf_cam_pos` — Position caméra

**Type de nœud** : Pur (expression)  
**Description** : Coin haut-gauche de la vue dans le monde.  
**Mots-clés de recherche** : `camera`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROP` | `dropdown` | `"x"` | `x`, `y` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `pf_camera_mode_3d` — Mode caméra 3D

**Type de nœud** : Action  
**Description** : Définit le type de caméra 3D active (3e personne, 1re personne / FPS, dessus, isométrique, 2.5D).  
**Mots-clés de recherche** : `3d camera mode fps vue`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `"third-person"` | `third-person`, `first-person`, `top-down`, `isometric`, `side-scroll` |

### `pf_camera_follow_3d` — Suivre avec caméra 3D

**Type de nœud** : Action  
**Description** : Fait suivre cet objet par la caméra 3D avec distance et hauteur.  
**Mots-clés de recherche** : `3d camera follow suivre vue`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `DIST` | `number` | `6` | distance |
| `HEIGHT` | `number` | `3` | hauteur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

---

## <a id="logic"></a>Logique

### `logic_compare` — Comparer

**Type de nœud** : Pur (expression)  
**Description** : Compare deux valeurs.  
**Mots-clés de recherche** : `égal compare`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `A` | `any` | `0` | A |
| `B` | `any` | `0` | B |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OP` | `dropdown` | `"EQ"` | `EQ`, `NEQ`, `LT`, `LTE`, `GT`, `GTE` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `logic_operation` — Et / Ou

**Type de nœud** : Pur (expression)  
**Description** : Combine deux conditions.  
**Mots-clés de recherche** : `and or`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `A` | `boolean` | `false` | A |
| `B` | `boolean` | `false` | B |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OP` | `dropdown` | `"AND"` | `AND`, `OR` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `logic_negate` — Non

**Type de nœud** : Pur (expression)  
**Description** : Inverse une condition.  
**Mots-clés de recherche** : `not`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `BOOL` | `boolean` | `true` | BOOL |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `logic_boolean` — Booléen

**Type de nœud** : Pur (expression)  
**Description** : Vrai ou faux.  
**Mots-clés de recherche** : `true false`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `BOOL` | `dropdown` | `"TRUE"` | `TRUE`, `FALSE` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `logic_null` — Rien (null)

**Type de nœud** : Pur (expression)  
**Description** : La valeur vide.  
**Mots-clés de recherche** : `null vide`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `logic_ternary` — Si ? alors : sinon

**Type de nœud** : Pur (expression)  
**Description** : Renvoie « alors » si la condition est vraie, sinon « sinon ».  
**Mots-clés de recherche** : `ternaire if`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `IF` | `boolean` | `false` | si |
| `THEN` | `any` | — | alors |
| `ELSE` | `any` | — | sinon |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="math"></a>Maths

### `math_number` — Nombre

**Type de nœud** : Pur (expression)  
**Description** : Un nombre.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `NUM` | `number` | `0` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_arithmetic` — Opération

**Type de nœud** : Pur (expression)  
**Description** : Addition, soustraction, multiplication, division, puissance.  
**Mots-clés de recherche** : `add plus moins fois diviser`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `A` | `number` | `1` | A |
| `B` | `number` | `1` | B |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OP` | `dropdown` | `"ADD"` | `ADD`, `MINUS`, `MULTIPLY`, `DIVIDE`, `POWER` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_single` — Fonction

**Type de nœud** : Pur (expression)  
**Description** : Racine carrée, valeur absolue, opposé, logarithme, exponentielle.  
**Mots-clés de recherche** : `sqrt abs`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `NUM` | `number` | `9` | NUM |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OP` | `dropdown` | `"ROOT"` | `ROOT`, `ABS`, `NEG`, `LN`, `LOG10`, `EXP`, `POW10` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_trig` — Trigonométrie

**Type de nœud** : Pur (expression)  
**Description** : Sinus, cosinus, tangente (en degrés) et leurs inverses.  
**Mots-clés de recherche** : `sin cos tan`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `NUM` | `number` | `45` | NUM |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OP` | `dropdown` | `"SIN"` | `SIN`, `COS`, `TAN`, `ASIN`, `ACOS`, `ATAN` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_constant` — Constante

**Type de nœud** : Pur (expression)  
**Description** : π, e, nombre d'or, √2, √½, ∞.  
**Mots-clés de recherche** : `pi`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `CONSTANT` | `dropdown` | `"PI"` | `PI`, `E`, `GOLDEN_RATIO`, `SQRT2`, `SQRT1_2`, `INFINITY` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_modulo` — Reste de la division

**Type de nœud** : Pur (expression)  
**Description** : Reste de la division euclidienne.  
**Mots-clés de recherche** : `modulo %`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `DIVIDEND` | `number` | `64` | dividende |
| `DIVISOR` | `number` | `10` | diviseur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_round` — Arrondir

**Type de nœud** : Pur (expression)  
**Description** : Arrondi à l'entier le plus proche, au-dessus ou en dessous.  
**Mots-clés de recherche** : `round floor ceil`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `NUM` | `number` | `3.1` | NUM |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `OP` | `dropdown` | `"ROUND"` | `ROUND`, `ROUNDUP`, `ROUNDDOWN` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_random_int` — Entier aléatoire

**Type de nœud** : Pur (expression)  
**Description** : Entier aléatoire entre deux bornes (incluses).  
**Mots-clés de recherche** : `random hasard`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `FROM` | `number` | `1` | de |
| `TO` | `number` | `100` | à |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_random_float` — Décimal aléatoire

**Type de nœud** : Pur (expression)  
**Description** : Nombre aléatoire entre 0 (inclus) et 1 (exclu).  
**Mots-clés de recherche** : `random hasard`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_constrain` — Limiter

**Type de nœud** : Pur (expression)  
**Description** : Limite une valeur entre un minimum et un maximum.  
**Mots-clés de recherche** : `clamp constrain`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `VALUE` | `number` | `50` | valeur |
| `LOW` | `number` | `1` | min |
| `HIGH` | `number` | `100` | max |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `math_number_property` — Propriété du nombre

**Type de nœud** : Pur (expression)  
**Description** : Teste si un nombre est pair, impair, premier, entier, positif, négatif ou divisible.  
**Mots-clés de recherche** : `pair impair premier`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `NUMBER_TO_CHECK` | `number` | `0` | nombre |
| `DIVISOR` | `number` | `1` | diviseur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `PROPERTY` | `dropdown` | `"EVEN"` | `EVEN`, `ODD`, `PRIME`, `WHOLE`, `POSITIVE`, `NEGATIVE`, `DIVISIBLE_BY` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="text"></a>Texte

### `text` — Texte

**Type de nœud** : Pur (expression)  
**Description** : Un texte.  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `string` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `TEXT` | `text` | `""` | — |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `text_join` — Assembler du texte

**Type de nœud** : Pur (expression)  
**Description** : Colle plusieurs valeurs bout à bout.  
**Mots-clés de recherche** : `join concat`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `string` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `text_length` — Longueur du texte

**Type de nœud** : Pur (expression)  
**Description** : Nombre de caractères.  
**Mots-clés de recherche** : `length`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `VALUE` | `string` | `"abc"` | VALUE |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `text_isEmpty` — Texte vide ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai si le texte est vide.  
**Mots-clés de recherche** : `empty`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `VALUE` | `string` | `""` | VALUE |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

---

## <a id="list"></a>Listes

### `lists_create_empty` — Liste vide

**Type de nœud** : Pur (expression)  
**Description** : Une liste sans élément.  
**Mots-clés de recherche** : `array`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `list` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `lists_create_with` — Créer une liste

**Type de nœud** : Pur (expression)  
**Description** : Liste avec les éléments donnés.  
**Mots-clés de recherche** : `array`  

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `list` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `lists_length` — Longueur de la liste

**Type de nœud** : Pur (expression)  
**Description** : Nombre d'éléments.  
**Mots-clés de recherche** : `length`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `VALUE` | `list` | — | liste |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `number` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `lists_isEmpty` — Liste vide ?

**Type de nœud** : Pur (expression)  
**Description** : Vrai si la liste est vide.  
**Mots-clés de recherche** : `empty`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `VALUE` | `list` | — | liste |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `boolean` | out |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `lists_getIndex` — Élément de la liste

**Type de nœud** : Pur (expression)  
**Description** : Lit un élément (le numéro 1 est le premier), éventuellement en le retirant.  
**Mots-clés de recherche** : `get index`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `VALUE` | `list` | — | liste |
| `AT` | `number` | `1` | n° |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `out` | `any` | out |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `"GET"` | `GET`, `GET_REMOVE` |
| `WHERE` | `dropdown` | `"FROM_START"` | `FROM_START`, `FROM_END`, `FIRST`, `LAST`, `RANDOM` |

**Exemple de code JavaScript compilé :**

```javascript
on('create', () => {
  game.log('Bonjour');
});
```

### `lists_removeIndex` — Retirer de la liste

**Type de nœud** : Action  
**Description** : Retire un élément de la liste (le numéro 1 est le premier).  
**Mots-clés de recherche** : `remove splice`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `VALUE` | `list` | — | liste |
| `AT` | `number` | `1` | n° |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `WHERE` | `dropdown` | `"FROM_START"` | `FROM_START`, `FROM_END`, `FIRST`, `LAST`, `RANDOM` |

### `lists_setIndex` — Modifier la liste

**Type de nœud** : Action  
**Description** : Remplace un élément de la liste ou en insère un (le numéro 1 est le premier).  
**Mots-clés de recherche** : `set insert push`  

**Entrées (broches) :**

| Broche | Type | Valeur par défaut | Description |
|---|---|---|---|
| `exec` | `exec` | — | exec |
| `LIST` | `list` | — | liste |
| `AT` | `number` | `1` | n° |
| `TO` | `any` | `0` | valeur |

**Sorties (broches) :**

| Broche | Type | Description |
|---|---|---|
| `then` | `exec` | then |

**Champs configurables :**

| Champ | Type de widget | Valeur par défaut | Options / Détails |
|---|---|---|---|
| `MODE` | `dropdown` | `"SET"` | `SET`, `INSERT` |
| `WHERE` | `dropdown` | `"FROM_START"` | `FROM_START`, `FROM_END`, `FIRST`, `LAST`, `RANDOM` |

