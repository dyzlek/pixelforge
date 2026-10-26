# Reference de l'API de Script 3D PixelForge

Ce document decrit l'interface de programmation JavaScript exposee aux scripts d'objets dans les projets 3D.
La signature de depart reste identique a la 2D : `(self, game, input, on)`.

---

## 1. L'objet `self` (Instance 3D)

L'objet `self` represente l'entite 3D executee dans la scene courante.

### Coordonnees et Transformations
- `self.x, self.y, self.z` : Coordonnees spatiales de l'objet dans le monde en unites (1 unite = 1 metre).
- `self.vx, self.vy, self.vz` : Velocite actuelle en unites par seconde le long de chaque axe.
- `self.rotationX, self.rotationY, self.rotationZ` : Rotation en degres.
- `self.scaleX, self.scaleY, self.scaleZ` : Facteur d'echelle sur chaque axe (defaut: 1).
- `self.width, self.height, self.depth` : Dimensions de la boite englobante de collision (AABB).

### Etat Physique
- `self.onGround` : Booleen valant `true` si l'entite repose sur un sol solide ou une face superieure de bloc.
- `self.jump(force)` : Applique une impulsion verticale vers le haut (+Y) si `self.onGround` est vrai (force recommandee : 8 a 15).
- `self.setGravity(enabled)` : Active ou desactive la gravite sur cette entite.

### Deplacements et Orientation
- `self.moveForward(speed)` : Deplace l'entite dans la direction de son angle `rotationY` a la vitesse indiquee.
- `self.moveRight(speed)` : Deplace l'entite lateralement (strafe) perpendiculairement a `rotationY`.
- `self.lookAt(targetX, targetY, targetZ)` : Oriente automatiquement l'entite vers un point de l'espace.
- `self.rotateY(degrees)` : Ajoute un angle a l'orientation horizontale.

### Cycle de Vie et Donnees
- `self.destroy()` : Supprime definitivement l'entite de la scene 3D.
- `self.play(animationName)` : Lance une animation par images cles definie sur le modele voxel.
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
- `game.raycast3D(origin, direction, maxDistance, options)` : Lance un rayon 3D et renvoie `{ hit: boolean, point: {x,y,z}, normal: {x,y,z}, instance, block }`.

### Audio et Interface
- `game.playSound(soundName, volume, pitch)` : Joue un effet sonore sfxr.
- `game.playSong(songName, options)` : Joue une musique chiptune multi-canaux.
- `game.stopSong()` : Arrete la musique.
- `game.setText(id, text, x, y)` : Affiche un texte d'interface 2D superpose sur la vue 3D.
- `game.score` : Score global du jeu.
- `game.vars` : Variables partagees globales.
- `game.restart()` : Recharge la scene courante.
- `game.goToScene(sceneName)` : Transitionne vers une autre scene 3D.

---

## 4. Gestionnaires d'Evenements `on`

Tous les gestionnaires s'enregistrent au premier niveau du script :
- `on('create', () => { ... })` : Execution a la creation de l'instance.
- `on('update', (dt) => { ... })` : Boucle a chaque frame avec `dt` en millisecondes.
- `on('collide', 'NomObjet', (other) => { ... })` : Collision solide bloquante.
- `on('overlap', 'NomObjet', (other) => { ... })` : Chevauchement sans repulsion physique.
- `on('overlapStart', 'NomObjet', (other) => { ... })` : Declenchement a l'entree dans le volume de contact.
- `on('overlapEnd', 'NomObjet', (other) => { ... })` : Declenchement a la sortie du volume de contact.
- `on('timer', ms, () => { ... })` : Intervalle repete toutes les N millisecondes.
- `on('keydown', 'KEY', () => { ... })` : Pression sur une touche specifique.
- `on('beat', (beatNumber) => { ... })` : Synchronisation rythmique audio.
