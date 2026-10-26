# API des scripts

Le `code` d'un objet est le **corps d'une fonction** appelée une fois par instance, à sa création :

```js
new Function('self', 'game', 'input', 'on', code)(self, game, input, on)
```

Le script global (`project.globalScript`) est appelé une fois au démarrage de chaque carte, avec `self = null`.
Une erreur dans un script est attrapée et affichée dans la console du jeu (overlay), sans planter le jeu.

## Événements — `on(...)`

| Appel | Quand |
|---|---|
| `on('create', () => {})` | juste après l'apparition de l'instance |
| `on('update', (dt) => {})` | à chaque image ; `dt` en secondes |
| `on('collide', 'NomObjet', (other) => {})` | contact avec une instance de cet objet (au début du contact, une fois) |
| `on('overlap', 'NomObjet', (other) => {})` | chevauchement (sans blocage physique) — chaque image tant qu'il dure |
| `on('keydown', 'SPACE', () => {})` | touche pressée (une fois) |
| `on('timer', 1000, () => {})` | toutes les N millisecondes |
| `on('beat', (beat) => {})` | à chaque temps musical (battement) de la musique chiptune en cours |
| `on('destroy', () => {})` | juste avant la destruction |

Règle physique : deux objets dont l'un a un handler `collide` l'un vers l'autre se bloquent (collider) ;
`overlap` ne bloque pas.

## `self` (instance)

Propriétés (lecture/écriture) : `x`, `y` (px, haut-gauche), `vx`, `vy` (px/s), `flipX`, `visible`, `alpha`, `angle`.
Lecture : `name` (nom de l'objet), `onGround` (bool, touche le sol), `width`, `height`.
`self.vars` : objet libre pour les variables de l'instance.

Méthodes :
- `self.play('anim')` — joue une animation du sprite (ne relance pas si déjà en cours)
- `self.destroy()`
- `self.jump(vitesse)` — `vy = -vitesse` seulement si `onGround`
- `self.moveTowards(other, vitesse)` — règle vx/vy vers `other`
- `self.distanceTo(other)` — distance en px
- `self.setGravity(bool)`

## `input`

- `input.isDown('LEFT')` — touche maintenue
- `input.justPressed('SPACE')` — vraie seulement l'image où la touche est pressée

Touches : `LEFT RIGHT UP DOWN SPACE ENTER SHIFT Z X C A W S D Q E`.

## `game`

- `game.vars` — variables globales (objet), conservées entre les cartes
- `game.score` — raccourci vers `game.vars.score` (initialisé à 0)
- `game.spawn('NomObjet', x, y)` -> instance
- `game.find('NomObjet')` -> première instance ou `null` ; `game.findAll('NomObjet')` -> tableau
- `game.goToMap('NomCarte')`, `game.restart()` (recharge la carte courante)
- `game.setText('id', 'texte', x, y)` — texte HUD fixe à l'écran (créé ou mis à jour par id) ; `game.removeText('id')`
- `game.camera.follow(self)`, `game.camera.shake(ms = 200, intensité = 0.01)`, `game.camera.flash(ms = 200)`
- `game.random(min, max)` — entier inclus
- `game.width`, `game.height` — taille de l'écran ; `game.mapWidth`, `game.mapHeight` en px
- `game.log(...args)` — affiche dans la console du jeu

## Exemple

```js
on('create', () => { game.camera.follow(self); });
on('update', (dt) => {
  self.vx = 0;
  if (input.isDown('LEFT'))  { self.vx = -90; self.flipX = true; }
  if (input.isDown('RIGHT')) { self.vx =  90; self.flipX = false; }
  if (input.justPressed('SPACE')) self.jump(260);
  self.play(self.vx !== 0 ? 'run' : 'idle');
});
on('overlap', 'Coin', (coin) => { coin.destroy(); game.score += 1; game.setText('score', 'Score: ' + game.score, 4, 4); });
```

---

# v1.1 — ajouts (100 % compatibles avec ce qui précède)

Tout ce qui précède reste valable. Les signatures ci-dessous sont volontairement « plates » (arguments simples) :
chacune peut devenir un nœud Blueprint. Les angles sont en **degrés** : 0 = droite, 90 = bas, −90 = haut (sens horaire, comme Phaser).

## Schéma du projet

| Champ | Effet |
|---|---|
| `maps[].layers[].depth` : `'below'` (défaut) ou `'above'` | `'above'` = calque dessiné **devant** les entités (feuillage, premier plan) |
| `maps[].entities[].props` : `{ clé: valeur }` | copié dans `self.props` de l'instance |
| `project.sounds` : `[{ id, name, kind: 'sfx' ou 'file', sfx: { preset, seed, volume, pitch }, dataUrl }]` | sons utilisables par `game.playSound` / `game.playMusic` (voir « Son ») |
| `settings.touchControls` (défaut `true`) | contrôles tactiles à l'écran sur appareil tactile |

Les entités ont une profondeur par défaut stable (50 + ordre de création) : la dernière créée est devant.
Ordre d'affichage : calques `below` < entités < calques `above` < particules < texte HUD.

## `self` — ajouts

| Membre | Description |
|---|---|
| `self.id` | numéro unique de l'instance (lecture) |
| `self.props` | objet : propriétés de l'instance (depuis la carte, ou 4e argument de `game.spawn`) |
| `self.setPosition(x, y)` | place l'instance (haut-gauche, px) |
| `self.setVelocity(vx, vy)` | règle la vitesse (px/s) |
| `self.angleTo(cible)` | angle en degrés vers une instance ou un point `{x, y}` |
| `self.setVelocityAngle(angle, vitesse)` | vitesse `vitesse` dans la direction `angle` (degrés) |
| `self.blocked` | `{ left, right, up, down }` : bloqué par un mur / le sol / une autre instance qui collide (lecture) |
| `self.depth` | ordre d'affichage (nombre, lecture/écriture) |
| `self.tint` | teinte `'#rrggbb'` ; `null` pour l'enlever |
| `self.scale` | échelle (1 = normal) |
| `self.tweenTo({x?, y?, alpha?, angle?, scale?}, ms)` | anime ces valeurs en `ms` millisecondes (x, y = haut-gauche). Pour déplacer un objet à gravité, faire d'abord `self.setGravity(false)` |
| `self.centerX`, `self.centerY` | centre de l'instance (lecture) |

```js
on('create', () => { self.tint = '#ff8080'; self.tweenTo({ y: self.y - 20, alpha: 0 }, 400); });
on('update', () => {
  const cible = game.find('Joueur');
  if (cible) self.setVelocityAngle(self.angleTo(cible), 50);   // poursuite
});
```

## Nouveaux événements

| Appel | Quand |
|---|---|
| `on('hitTile', (tile) => {})` | au **début** du contact avec une tuile solide |
| `on('click', () => {})` | clic / toucher sur cette instance |
| `on('mousedown', 'LEFT' ou 'RIGHT', () => {})` | bouton de souris pressé n'importe où (sans bouton : `LEFT`) |
| `on('message', 'nom', (data) => {})` | un objet a appelé `game.broadcast('nom', data)` |

`tile = { tx, ty, x, y, index, side, layer }` : `tx, ty` = coordonnées en tuiles, `x, y` = pixels du coin haut-gauche de la tuile,
`index` = numéro de la tuile, `layer` = nom du calque, `side` = côté **de l'instance** qui touche :
`'up'` (coup de tête sous un bloc), `'down'` (atterrissage), `'left'`, `'right'`.
Si plusieurs tuiles sont touchées du même côté, seule la plus centrée est rapportée.
`hitTile` et `click` ne sont pas disponibles dans le script global ; `mousedown` et `message` le sont.

```js
// Bloc « ? » à la Mario : le joueur le frappe par en dessous
on('hitTile', (t) => {
  if (t.side === 'up' && t.index === 5) {            // 5 = tuile « bloc ? »
    game.setTile(t.tx, t.ty, 6, t.layer);            // devient un bloc vide
    game.spawn('Coin', t.x, t.y - 16);
    game.playSound('coin');
  }
});

// Communication entre objets (idéal pour les blocs)
// objet Bouton :
on('collide', 'Joueur', () => game.broadcast('porte', { ouverte: true }));
// objet Porte :
on('message', 'porte', (d) => { if (d.ouverte) self.destroy(); });
```

## `input` — souris, manette, tactile

| Membre | Description |
|---|---|
| `input.mouseX`, `input.mouseY` | position de la souris dans le **monde** (px) |
| `input.mouseScreenX`, `input.mouseScreenY` | position dans l'écran du jeu (px) |
| `input.isMouseDown('LEFT' ou 'RIGHT')` | bouton maintenu |
| `input.mouseJustPressed('LEFT' ou 'RIGHT')` | vrai seulement l'image où le bouton est pressé |

Le menu contextuel du navigateur est désactivé sur le jeu (clic droit utilisable).
**Manette** (Gamepad API, automatique) : croix ou stick gauche = `LEFT/RIGHT/UP/DOWN`, bouton A = `SPACE` et `Z`, B = `X`, Start = `ENTER`.
`input.isDown`, `input.justPressed` et `on('keydown', …)` réagissent aussi à la manette et au tactile.
**Tactile** : si `settings.touchControls` et appareil tactile, une croix (gauche) et deux boutons A = `SPACE`, B = `X` (droite) sont affichés, semi-transparents, multi-touch.

## `game` — tuiles

| Appel | Description |
|---|---|
| `game.tileSize` | taille d'une tuile (px) |
| `game.toTile(px)` | pixel -> coordonnée de tuile |
| `game.getTile(tx, ty, calque?)` | index de la tuile, `-1` si vide ou hors carte. Sans nom de calque : premier calque solide |
| `game.setTile(tx, ty, index, calque?)` | change une tuile ; `-1` pour la supprimer (briques cassables). Les collisions suivent immédiatement |
| `game.isSolidAt(x, y)` | vrai si le point (px) est dans une tuile solide |
| `game.raycast(x, y, angle, maxDist = 1000)` | rayon contre les tuiles solides (précis au pixel) |

`raycast` renvoie `{ hit, x, y, tx, ty, normalX, normalY, side, distance }` : `x, y` = point d'impact, `tx, ty` = tuile touchée,
`normalX, normalY` = normale de la face touchée (ex. mur à droite du tireur : `normalX = -1`), `side` = face de la **tuile** touchée
(`'left'`, `'right'`, `'up'`, `'down'`), `distance` en px. Sans impact : `hit: false`, `x, y` = bout du rayon, `side: null`.
Départ dans une tuile solide : `hit: true`, `distance: 0`, `side: null`.

```js
// Pistolet à portails : tir vers la souris
on('update', () => {
  if (input.mouseJustPressed('LEFT')) {
    const a = self.angleTo({ x: input.mouseX, y: input.mouseY });
    const r = game.raycast(self.centerX, self.centerY, a, 600);
    if (r.hit) {
      game.spawn('PortailBleu', r.x - 8 + r.normalX * 8, r.y - 8 + r.normalY * 8, { side: r.side });
      game.playSound('portal');
    }
  }
});
```

## `game` — son

| Appel | Description |
|---|---|
| `game.playSound('nom', volume?, pitch?)` | joue un son du projet. `volume` 0–1 (1 par défaut), `pitch` multiplie la fréquence / vitesse (1 par défaut) |
| `game.playMusic('nom')` | joue en boucle (relancer le même nom ne fait rien) |
| `game.stopMusic()` | arrête la musique |
| `game.playSong('nom', { loop?, volume?, fadeIn? })` | joue un morceau chiptune du projet avec options |
| `game.stopSong({ fadeOut? })` | arrête le morceau chiptune en cours |
| `game.setSongVolume(v)` | règle le volume du morceau en cours (0 à 1) |

Sons `kind: 'sfx'` : synthétisés par WebAudio, sans fichier. Presets : `jump coin hit powerup explosion laser blip portal`
(`sfx.seed` varie légèrement le son, `sfx.pitch` et `sfx.volume` sont les réglages de base). Sons `kind: 'file'` : `dataUrl` audio.
Si le nom n'existe pas dans le projet mais est un nom de preset, le preset est joué (`game.playSound('jump')` marche sans rien déclarer).
Les navigateurs interdisent le son avant un premier geste (clic, touche, toucher) : les sons joués avant sont ignorés, la musique démarre au premier geste.

## `game` — divers

| Appel | Description |
|---|---|
| `game.spawn('Nom', x, y, props?)` | 4e argument : propriétés copiées dans `self.props` (disponibles dès `on('create')`) |
| `game.broadcast('nom', data?)` | envoie un message à tous les `on('message', 'nom', …)` |
| `game.particles(x, y, couleur = '#ffffff', nombre = 12, vitesse = 80, vieMs = 500)` | petites particules carrées, légère gravité |
| `game.wait(ms, fn)` | exécute `fn` une fois après `ms` millisecondes. Renvoie `{ cancel() }` pour annuler le timer |
| `game.clearWait(handle)` | annule un timer créé par `game.wait` |
| `game.pause()`, `game.resume()`, `game.paused` | gèle physique, `update`, timers, `wait` et tweens. `keydown`, `click`, `mousedown`, `message` continuent de fonctionner (pour reprendre la partie) |
| `game.countOf('Nom')` | nombre d'instances vivantes de cet objet |
| `game.currentMap` | nom de la carte courante |
| `game.save('clé', valeur)`, `game.load('clé', défaut)` | sauvegarde locale (localStorage, propre à chaque jeu) ; valeurs JSON |
| `game.camera.follow(self, lerpX = 0.2, lerpY = 0.2)` | suit l'instance avec amorti fluide réglable |
| `game.camera.stopFollow()` | arrête le suivi de la caméra |
| `game.camera.panTo(x, y, ms = 500)` | déplace la caméra vers les coordonnées du monde `(x, y)` |
| `game.camera.setDeadzone(w, h)` | zone morte au centre de l'écran avant que la caméra ne se déplace |
| `game.camera.setBounds(x, y, w, h)` | restreint les déplacements de la caméra à cette boîte |
| `game.camera.setLerp(lx, ly)` | règle la fluidité du suivi caméra |
| `game.camera.setZoom(z)` | zoom de la caméra (1 = normal) |
| `game.camera.x`, `game.camera.y` | coin haut-gauche de la vue dans le monde (lecture) |
| `game.setText(id, texte, x, y, options?)` | `options = { color: '#rrggbb', size: 1, align: 'left', 'center' ou 'right', world: false }` ; avec `world: true`, le texte est ancré dans le monde et défile avec la caméra |
| `game.setWorldText(id, texte, x, y, options?)` | raccourci pour placer un texte dans l'espace du monde (ex. dégâts flottants, dialogues) |
| `game.removeText(id)` | supprime un texte HUD ou World |
| `game.playTune(notes, bpm = 140, loop = true, volume = 0.5)` | joue une mélodie chiptune synthétisée à la volée (ex. `"E5:2 B4:1 C5:1 D5:2"`) |
| `game.stopTune()` | arrête la mélodie chiptune |
| `game.setVolume(0 à 1)`, `game.setMasterVolume(0 à 1)` | volume sonore général |

## Schéma des calques (ajouts v1.2)

- `maps[].layers[].oneWay: true` : transforme le calque en **plateformes semi-solides traversables par le bas** (bloque uniquement par le dessus).
- `maps[].layers[].scrollFactor: 0.3` (ou `{ x: 0.3, y: 1 }`) : effet de **parallaxe** pour défilement différentiel des arrière-plans et premiers plans.
- Raccourcis universels dans l'éditeur PixelForge : **`Ctrl+Z` (Annuler)** et **`Ctrl+Y` / `Ctrl+Shift+Z` (Rétablir)**.

```js
// Écran de démarrage + meilleur score
on('create', () => {
  game.setText('best', 'Record : ' + game.load('best', 0), game.width - 4, 4, { align: 'right', color: '#ffcd75' });
  game.pause();
  game.setText('go', 'APPUIE SUR ENTREE', game.width / 2, game.height / 2, { align: 'center', size: 1.5 });
});
on('keydown', 'ENTER', () => { if (game.paused) { game.resume(); game.removeText('go'); } });
```

# v1.2 — ajouts (actions sur une autre instance, Portal 2D)

Tout est rétrocompatible. Les nœuds Blueprint correspondants sont dans les catégories « Objet », « Événements », « Tuiles & rayons » et « Caméra & texte ».

## Agir sur une autre instance

Les instances reçues par `on('collide'|'overlap'|'overlapStart'|'overlapEnd', …, (other) => …)`, `game.find`, `game.findAll`, `game.spawn`
et `r.instance` (rayon) exposent **exactement la même API que `self`** : `other.setPosition(x, y)`, `other.setVelocity(vx, vy)`,
`other.setVelocityAngle(angle, force)`, `other.angle = …`, `other.props`, `other.destroy()`… Dans un Blueprint : « moi-même (instance) »,
« l'autre », « premier … » ou une variable se branchent sur l'entrée **cible** des nœuds « cible : se placer en x y », « cible : vitesse vx vy »,
« cible : vitesse angle force », « cible : s'orienter selon la normale », « cible : collision avec la carte / les objets », « cible : hitbox », « cible : propriété ».
Sans effet si la cible est vide (`null`).

## Nouveaux événements

| Appel | Quand |
|---|---|
| `on('overlapStart', 'NomObjet', (other) => {})` | **une seule fois**, quand le chevauchement avec cet objet commence |
| `on('overlapEnd', 'NomObjet', (other) => {})` | **une seule fois**, quand il se termine (si l'un des deux a été détruit entre-temps, rien n'est envoyé) |

Ils ne bloquent pas physiquement (comme `overlap`). Pas de nouvel événement dans le script global.

## `self` — ajouts

| Membre | Description |
|---|---|
| `self.flipY` | miroir vertical (lecture/écriture) ; la hitbox n'est pas retournée |
| `self.collideMap`, `self.setCollideMap(bool)` | `false` : l'instance traverse les tuiles solides (et `hitTile` ne se déclenche plus). N'a d'effet que si l'objet a « collision avec la carte » |
| `self.collideObjects`, `self.setCollideObjects(bool)` | `false` : l'instance ne bloque plus les autres instances en `collide` (les `overlap*` ne changent pas) |
| `self.setHitbox(x, y, w, h)` | change la boîte de collision de cette instance (relative à la frame, px) |

## `game.raycast` — objets et calque

`game.raycast(x, y, angle, maxDist = 1000, opts?)` avec `opts = { objects: true | 'Nom' | ['Nom', …], ignore: instance | [instances] }` :
le rayon teste aussi les boîtes de physique des instances (la plus proche gagne, tuile ou instance). Une instance qui contient le point de départ est ignorée ; ajoute `ignore: self` pour ne pas se toucher soi-même.

Le résultat contient en plus : `layer` (nom du calque solide touché — le dernier calque solide ayant une tuile à cet endroit —, `null` sinon), `index` (numéro de la tuile, `-1` sinon),
`instance` (l'instance touchée ou `null`) et `objectName`. Pour une instance : `tx = ty = -1`, `side`/normale = face de la **boîte** touchée.
**Tuiles non portalisables** : mets les murs spéciaux sur un calque solide nommé par ex. « Métal » et teste `r.layer === 'Métal'`.

## `game.camera` — ajouts

`game.camera.setDeadzone(w, h)` (déjà dispo, nœud ajouté) et `game.camera.setOffset(x, y)` : décalage de la caméra par rapport à la cible suivie.

```js
// Portail : tir au clic, refusé sur le calque « Métal », orienté selon la normale
on('mousedown', 'LEFT', () => {
  const r = game.raycast(self.centerX, self.centerY, self.angleTo({ x: input.mouseX, y: input.mouseY }), 600);
  if (!r.hit || r.layer === 'Métal') return;
  const old = game.find('PortailBleu'); if (old) old.destroy();
  const p = game.spawn('PortailBleu', r.x + r.normalX * 8 - 8, r.y + r.normalY * 8 - 8, { nx: r.normalX, ny: r.normalY });
  p.angle = Math.atan2(r.normalY, r.normalX) * 180 / Math.PI;
});
// Entrée dans un portail : on ne traite que le début du contact
on('overlapStart', 'PortailBleu', (p) => {
  const sortie = game.find('PortailOrange');
  if (!sortie) return;
  const v = Math.max(120, Math.hypot(self.vx, self.vy));
  self.setPosition(sortie.centerX - self.width / 2, sortie.centerY - self.height / 2);
  self.setVelocity(sortie.props.nx * v, sortie.props.ny * v);
});
```

## Limites connues

- Les presets sonores sont des approximations « rétro ».
- `hitTile` ne vaut que pour les objets ayant `collideMap` ; un seul `tile` (le plus centré) est rapporté par côté et par contact.
- `raycast` ne voit les instances que avec `opts.objects` (boîte de physique alignée sur les axes) et traite les bords de la carte comme vides.
- `overlapStart` / `overlapEnd` sont calculés une fois par image de physique : un contact plus court qu'un pas de physique peut passer inaperçu.
- Les contrôles tactiles apparaissent si le navigateur annonce un écran tactile (un PC tactile les affichera aussi).
