# Inventaire et Guide de Migration : Phaser 3 vers Phaser 4.2.1

Ce document recense l'inventaire complet des interfaces et composants Phaser utilises dans PixelForge, evalue leur compatibilite avec Phaser 4.2.1 et formalise la feuille de route pour la migration (Phase E).

---

## 1. Contexte et Objectifs

Phaser 4 apporte des ameliorations majeures par rapport a la branche Phaser 3 :
- Moteur de rendu WebGL et WebGL2 modernise et optimise, ideal pour le pixel art et les performances sur mobile et bureau.
- Abandon du rendu Canvas historique au profit d'un pipeline WebGL natif haute vitesse.
- Remplacement du systeme complexe de pipelines personnalises par des **Render Nodes** et une API unifiee de **Filtres / Post-FX** (`addFilter`, `clearFilters`).
- Suppression d'anciennes API obsoletes (`setTintFill`, `Geom.Point`, objets 2D `Mesh` et `Plane`).

PixelForge a ete concu avec une encapsulation stricte dans `src/runtime/engine.js` (Phaser n'y est jamais importe directement mais injecte au constructeur). Cette conception rend la migration rapide et maitrisee.

---

## 2. Inventaire Exhaustif des API Phaser dans PixelForge

### 2.1 Configuration et cycle de vie (`src/runtime/engine.js`)

| API / Symbole | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `new Phaser.Game(config)` | Instanciation du jeu 2D | Inchange | Conserver |
| `type: Phaser.AUTO` | Selection du renderer | Canvas deprecie | Remplacer par `Phaser.WEBGL` avec message clair |
| `parent`, `width`, `height` | Dimensions du canvas | Inchange | Conserver |
| `backgroundColor` | Couleur de fond globale | Inchange | Conserver |
| `pixelArt: true` | Desactivation du lissage | Inchange | Conserver |
| `roundPixels: true` | Arrondi des coordonnees de rendu | Inchange | Conserver |
| `antialias: false` | Pas d'antialiasing (pixel art) | Inchange | Conserver |
| `disableContextMenu: true` | Empeche le clic droit contextuel | Inchange | Conserver |
| `audio: { noAudio: true }` | Audio gere par chip.js | Inchange | Conserver |
| `scale: { mode, autoCenter }` | `FIT` et `CENTER_BOTH` | Inchange | Conserver |
| `physics: { default: 'arcade' }` | Moteur physique Arcade 2D | Inchange | Conserver |
| `scene: [BootScene, MapScene]` | Liste des classes de scene | Inchange | Conserver |
| `game.destroy(true)` | Nettoyage complet lors de l'arret | Inchange | Conserver |
| `game.loop.actualFps` | Metrique pour la console et le snapshot | Inchange | Conserver |
| `game.loop.frame` | Compteur d'images pour le cache de contact | Inchange | Conserver |

### 2.2 Gestion des Scenes (`src/runtime/engine.js`)

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `class BootScene extends Phaser.Scene` | Scene de preparation textures/anims | Inchange | Conserver |
| `class MapScene extends Phaser.Scene` | Scene active d'un niveau de carte | Inchange | Conserver |
| `this.scene.start('Map', data)` | Transition vers la carte | Inchange | Conserver |
| `init(data)` / `create()` / `update(time, delta)` | Methodes de cycle de vie de scene | Inchange | Conserver |

### 2.3 Textures et Animations (`BootScene` & `MapScene`)

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `this.textures.addCanvas(id, canvas)` | Enregistrement dynamique des spritesheet | Inchange | Conserver |
| `tex.add(frame, 0, x, y, w, h)` | Decoupage des frames dans la texture | Inchange | Conserver |
| `this.textures.remove(key)` | Purge des textures de texte HUD | Inchange | Conserver |
| `this.anims.create(config)` | Creation d'animations sprites | Inchange | Conserver |
| `sprite.anims.play(key, true)` | Lecture d'une animation nommee | Inchange | Conserver |

### 2.4 Cartes en tuiles (`MapScene`)

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `this.make.tilemap({ data, tileWidth, tileHeight })` | Generation de la tilemap matricielle | Inchange | Conserver |
| `tm.addTilesetImage('tiles', spriteId, w, h, 0, 0)` | Liaison du tileset | Inchange | Conserver |
| `tm.createLayer(0, tileset, 0, 0)` | Instanciation du calque graphique | Inchange | Conserver |
| `tl.setCollisionByExclusion([-1])` | Activation des collisions de tuiles | Inchange | Conserver |
| `tl.forEachTile(callback)` | Configuration one-way (plateformes) | Inchange | Conserver |
| `tl.setScrollFactor(x, y)` | Parallaxe par calque | Inchange | Conserver |
| `tl.setDepth(depth)` | Ordre d'affichage sous/sur entites | Inchange | Conserver |

### 2.5 Physique Arcade et Entites (`MapScene`)

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `this.physics.world.setBounds(x, y, w, h)` | Bords physiques du monde | Inchange | Conserver |
| `this.physics.world.on('worldstep', fn)` | Detection d'avancement de pas physique | Inchange | Conserver |
| `this.physics.world.resume()` / `pause()` | Controle pause / reprise | Inchange | Conserver |
| `this.physics.add.group()` | Groupes par type d'objet | Inchange | Conserver |
| `this.physics.add.sprite(x, y, key, frame)` | Creation d'entite physique | Inchange | Conserver |
| `this.physics.add.collider(...)` | Collision physique blocante | Inchange | Conserver |
| `this.physics.add.overlap(...)` | Detection de chevauchement / trigger | Inchange | Conserver |
| `body.setSize(w, h, false)` | Hitbox personnalisee | Inchange | Conserver |
| `body.setOffset(x, y)` | Decalage de hitbox | Inchange | Conserver |
| `body.setAllowGravity(bool)` | Gravite par entite | Inchange | Conserver |
| `body.setBounce(factor)` | Rebond | Inchange | Conserver |
| `body.setImmovable(bool)` | Entite fixe (plateforme / obstacle) | Inchange | Conserver |
| `body.setCollideWorldBounds(bool)` | Blocage contre les bords du monde | Inchange | Conserver |
| `body.setVelocityX(vx)` / `setVelocityY(vy)` | Vitesses physiques | Inchange | Conserver |
| `body.blocked` / `body.touching` | Verification du sol (`onGround`) | Inchange | Conserver |

### 2.6 Camera 2D (`MapScene`)

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `this.cameras.main.setBounds(x, y, w, h)` | Bords de deplacement camera | Inchange | Conserver |
| `cam.setBackgroundColor(color)` | Couleur de fond du viewport | Inchange | Conserver |
| `cam.centerOn(x, y)` | Recentrage immediat | Inchange | Conserver |
| `cam.startFollow(target, round, lx, ly)` | Suivi fluide de l'entite | Inchange | Conserver |
| `cam.stopFollow()` | Arret du suivi | Inchange | Conserver |
| `cam.pan(x, y, duration, ease)` | Travelling vers un point | Inchange | Conserver |
| `cam.setDeadzone(w, h)` | Zone morte de suivi | Inchange | Conserver |
| `cam.setFollowOffset(x, y)` | Decalage du suivi | Inchange | Conserver |
| `cam.setLerp(x, y)` | Facteur d'amortissement | Inchange | Conserver |
| `cam.shake(duration, intensity)` | Tremblement d'ecran | Inchange | Conserver |
| `cam.flash(duration)` | Flash lumineux | Inchange | Conserver |
| `cam.setZoom(factor)` | Niveau de zoom | Inchange | Conserver |
| `cam.getWorldPoint(screenX, screenY, out)` | Conversion coordonnees ecran vers monde | Inchange | Conserver |

### 2.7 Entrees utilisateur (`MapScene`)

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `Phaser.Input.Keyboard.KeyCodes` | Enum des touches clavier | Inchange | Conserver |
| `this.input.keyboard.addKey(code)` | Surveillance de touches individuelles | Inchange | Conserver |
| `key.on('down', fn)` | Evenement de frappe immediate | Inchange | Conserver |
| `this.input.on('pointerdown', fn)` | Clic souris et toucher tactile | Inchange | Conserver |
| `this.input.activePointer` | Pointeur actif (position et boutons) | Inchange | Conserver |
| `Phaser.Math.Vector2` | Vecteur temporaire pour conversion | Inchange | Conserver |

### 2.8 Rendu d'objets simples, Particules et HUD

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `this.add.rectangle(x, y, w, h, col)` | Particules de pixel art | Inchange | Conserver |
| `this.add.image(x, y, key)` | Affichage de texte HUD rendu sur canvas | Inchange | Conserver |
| `img.setOrigin(0, 0)` | Alignement en haut a gauche | Inchange | Conserver |
| `img.setScrollFactor(0)` | Fixation ecran pour HUD | Inchange | Conserver |
| `img.setDepth(depth)` | Plan d'affichage au-dessus de la scene | Inchange | Conserver |

### 2.9 Horloge et Tweens

| API / Methode | Usage dans PixelForge | Statut Phaser 4.2.1 | Action requise |
|---|---|---|---|
| `this.time.addEvent(config)` | Minuteurs de scripts | Inchange | Conserver |
| `this.time.paused` | Pause globale du temps | Inchange | Conserver |
| `this.time.now` | Horodatage courant | Inchange | Conserver |
| `this.tweens.resumeAll()` | Reprise des transitions | Inchange | Conserver |

---

## 3. Analyse des Ruptures et Incompatibilites Potentielles

1. **Suppression de `setTintFill`** :
   - PixelForge utilise uniquement `sprite.setTint(...)` et `sprite.clearTint()`.
   - Aucun usage de `setTintFill`. Risque nul.

2. **Suppression de `Geom.Point`** :
   - PixelForge utilise `Phaser.Math.Vector2` pour la conversion camera.
   - Aucun usage de `Geom.Point`. Risque nul.

3. **Suppression de `Mesh` et `Plane`** :
   - Aucun usage dans le moteur 2D PixelForge (le voxel 3D passe par Three.js dans `engine3d.js`).
   - Risque nul.

4. **Depreciation du renderer Canvas (`Phaser.CANVAS`)** :
   - Dans `engine.js`, `type: Phaser.AUTO` doit etre migre vers `type: Phaser.WEBGL`.
   - Ajouter une detection propre de la disponibilite de WebGL avec message d'erreur explicite si l'environnement ne le supporte pas.

5. **Gestionnaire de Post-FX / Filtres** :
   - Phaser 4 fournit une API native simplifiee pour les filtres (`addFilter`, `clearFilters`).
   - Cette opportunite sera exploitee directement dans l'etape E2 (#67) pour offrir les filtres CRT, lueur, flou et pixellisation dans l'API de script et les Blueprints.

---

## 4. Feuille de Route de Migration (Phases E1 a E3)

- **E1 (Issue #66)** :
  - Mise a jour de `package.json` : `"phaser": "4.2.1"`.
  - Mise a jour de `src/runtime/export-template.js` pour pointer vers le CDN `phaser@4.2.1`.
  - Modification de `type: Phaser.AUTO` vers `type: Phaser.WEBGL` dans `src/runtime/engine.js`.
  - Verification complete de tous les jeux de demonstration 2D (Monde 1-1, Tetris, Plateforme).
- **E2 (Issue #67)** :
  - Implementation de `self.addFilter`, `self.clearFilters`, `game.camera.addFilter`, `self.setTintMode` dans `src/runtime/engine.js`.
  - Ajout des noeuds Blueprint correspondants dans `src/graph/nodes.js` et `src/graph/compile.js`.
  - Regeneration de la documentation des noeuds (`npm run doc:nodes`).
- **E3 (Issue #68)** :
  - Nettoyage des references a Phaser 3 dans la documentation (`README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`).
  - Validation globale de la suite de tests et de l'export standalone.
