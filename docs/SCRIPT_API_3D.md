# Reference de l'API de Script 3D PixelForge

Ce document decrit l'interface de programmation JavaScript exposee aux scripts d'objets dans les projets 3D.
La signature de depart reste identique a la 2D : `(self, game, input, on)`.

---

## 1. L'objet `self` (Instance 3D)

L'objet `self` represente l'entite 3D executee dans la scene courante.

### Coordonnees et Transformations
- `self.x, self.y, self.z` : Coordonnees du **centre** de l'objet en unites (1 unite = 1 bloc). Un bloc de la grille de cle "x,y,z" est un cube centre sur (x, y, z) : un objet de 0,9 de haut pose sur le bloc Y=0 a `y = 0.95`.
- `self.vx, self.vy, self.vz` : Velocite actuelle en unites par seconde le long de chaque axe.
- `self.rotationX, self.rotationY, self.rotationZ` : Rotation en degres.
- `self.width, self.height, self.depth` : Boite de collision (AABB), 0,9 par defaut. Le modele voxel est mis a l'echelle pour tenir dans cette boite.
- `self.visible` : afficher / cacher le modele.
- `self.setPosition(x, y, z)`, `self.setVelocity(vx, vy, vz)`, `self.distanceTo(autre)` (distance 3D).

### Etat Physique
- `self.onGround` : Booleen valant `true` si l'entite repose sur une face superieure de bloc.
- Les objets avec `physics.collideMap` sont bloques par les blocs sur les 3 axes (murs, sols, plafonds).
- Gravite : `settings.gravity3d` en blocs/s², sinon deduite de `settings.gravity` (800 donne 30).
- `self.jump(force)` : Impulsion verticale (+Y) si `self.onGround` est vrai. Avec la gravite par defaut, `jump(8)` monte d'environ 1 bloc, `jump(12)` d'environ 2,4 blocs.
- `self.setGravity(enabled)` : Active ou desactive la gravite sur cette entite.

### Deplacements et Orientation
- `self.moveForward(speed)` : Deplace l'entite dans la direction de son angle `rotationY` a la vitesse indiquee.
- `self.moveRight(speed)` : Deplace l'entite lateralement (strafe) perpendiculairement a `rotationY`.
- `self.lookAt(targetX, targetY, targetZ)` : Oriente automatiquement l'entite vers un point de l'espace.
- `self.rotateY(degrees)` : Ajoute un angle a l'orientation horizontale (positif = vers la droite, vu de dessus ; 0 = regarde vers -Z).

### Animations et Modeles glTF
- `self.play(animName)` : Declenche une animation du modele glTF avec fondu enchaine (150 ms) via l'AnimationMixer Three.js. Accepte les noms de clips exacts ainsi que les synonymes francais et anglais (`self.play('marche')` ou `self.play('walk')`, `self.play('attente')` ou `self.play('idle')`, `self.play('course')` ou `self.play('run')`).

### Cycle de Vie et Donnees
- `self.destroy()` : Supprime definitivement l'entite de la scene 3D.
- `self.vars` : Dictionnaire d'etat propre a l'instance (ex: `self.vars.hp = 3`).
- `self.props` : Proprietes configurees dans l'inspecteur lors du placement de l'entite dans la scene.

---

## 2. L'objet `input` (Entrees et Souris 3D)

En 3D, l'objet `input` s'enrichit de la capture de la souris en vue subjective (`pointer lock`).

### Clavier
- `input.isDown('W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SPACE' | 'SHIFT')` : Vrai tant que la touche est maintenue.
- `input.justPressed('KEY')` : Vrai sur l'unique frame de pression.
- `input.justReleased('KEY')` : Vrai sur l'unique frame de relachement.

### Souris et Vue Subjective
- `input.mouseDeltaX` : Deplacement horizontal de la souris depuis la derniere frame (en pixels).
- `input.mouseDeltaY` : Deplacement vertical de la souris depuis la derniere frame (en pixels).
- `input.isPointerLocked` : Booleen indiquant si le curseur de la souris est verrouille dans la fenetre.
- `input.requestPointerLock()` : Demande au navigateur de capturer le pointeur (indispensable pour les FPS).
- `input.exitPointerLock()` : Libere la souris.

---

## 3. L'objet `game` (Monde et Moteur 3D)

### Gestion de la Camera 3D
- `game.camera.setMode(mode)` : Definit le profil de camera :
  - `'third-person'` : Camera orbitale suivant l'entite avec prevention d'occlusion.
  - `'first-person'` : Camera subjective liee au regard de l'entite cible.
  - `'top-down'` : Vue plongeante aerienne.
  - `'isometric'` : Angle fixe orthographique retro.
  - `'side-scroll'` : Vue laterale 2.5D.
- `game.camera.follow(self, options)` : Lie la camera a l'entite :
  - `options.distance` : Distance derriere l'objet (defaut: 6 unites).
  - `options.height` : Hauteur par rapport a l'objet (defaut: 3 unites).
  - `options.pitch` : Inclinaison vers le bas en degres (defaut: 20).
  - `options.lerp` : Facteur de lissage du suivi (0.01 a 1, defaut: 0.1).
- `game.camera.setFov(fov)` : Angle de champ de vision en degres (defaut: 60).

### Entites et Spawning
- `game.spawn(objectName, x, y, z)` : Instancie un nouvel objet dans la scene 3D aux coordonnees indiquees.
- `game.find(objectName)` : Renvoie la premiere instance de ce nom trouvee dans la scene.
- `game.findAll(objectName)` : Renvoie le tableau de toutes les instances du type indique.
- `game.countOf(objectName)` : nombre d'instances vivantes.
- `game.raycast3D(origin, direction, maxDistance)` : Lance un rayon contre les blocs et renvoie `{ hit, point: {x,y,z}, normal: {x,y,z} }`.

### Audio et Interface
- `game.playSound(soundName, volume, pitch)` : Joue un son du projet ou un preset (jump, coin...).
- `game.playSong(songName, options)` / `game.playMusic(name)` : Joue une musique chiptune du projet.
- `game.stopSong()` / `game.stopMusic()` / `game.setSongVolume(v)`.
- `game.setText(id, text, x, y)` / `game.removeText(id)` : texte d'interface superpose sur la vue 3D.
- `game.random(min, max)`, `game.log(...)`, `game.wait(ms, fn)`, `game.pause()` / `game.resume()` / `game.paused`, `game.save(cle, valeur)` / `game.load(cle, defaut)`, `game.broadcast(nom, donnees)`, `game.currentMap` (nom de la scene).
- `game.score` : Score global du jeu.
- `game.vars` : Variables partagees globales.
- `game.restart()` : Recharge la scene courante (applique en fin d'image).
- `game.goToScene(sceneName)` : Transitionne vers une autre scene 3D (en fin d'image).

Les nœuds Blueprint propres a la 2D (tuiles, souris a l'ecran, angles 2D, tweens, teintes, effets de camera 2D) sont refuses a la compilation dans un jeu 3D.

---

## 4. Gestionnaires d'Evenements `on`

Tous les gestionnaires s'enregistrent au premier niveau du script :
- `on('create', () => { ... })` : Execution a la creation de l'instance.
- `on('update', (dt) => { ... })` : Boucle a chaque frame avec `dt` en millisecondes.
- `on('collide', 'NomObjet', (other) => { ... })` : Contact entre deux objets, a chaque image (les objets ne sont pas separes physiquement entre eux en 3D).
- `on('overlap', 'NomObjet', (other) => { ... })` : Chevauchement sans repulsion physique.
- `on('overlapStart', 'NomObjet', (other) => { ... })` : Declenchement a l'entree dans le volume de contact.
- `on('overlapEnd', 'NomObjet', (other) => { ... })` : Declenchement a la sortie du volume de contact.
- `on('timer', ms, () => { ... })` : Intervalle repete toutes les N millisecondes.
- `on('keydown', 'KEY', () => { ... })` : Pression sur une touche (memes noms que `input` : SPACE, LEFT, UP...).
- `on('message', 'nom', (donnees) => { ... })` : Message diffuse par `game.broadcast`.
- `on('beat', (beatNumber) => { ... })` : Temps fort de la musique jouee par `game.playSong`.

---

## 5. Materiaux et Textures Pixel Art

Les materiaux definis dans `project.materials[]` (`standard`, `unlit`, `toon`) peuvent etre appliques aux nœuds de scene ou directement aux objets.
- `textureSpriteId` : associe un sprite du projet comme texture UV.
- Les textures sont filtrees avec `THREE.NearestFilter` pour garantir un rendu pixel art net sans flou bilineaire.
- Prise en charge de la couleur diffuse, de la rugosite, du metallisme, de l'emissif, de la transparence et du rendu double-face.
