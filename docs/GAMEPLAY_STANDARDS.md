# Standards Fondamentaux de Gameplay PixelForge

Ce document decrit les standards de conception de gameplay pour les jeux 2D et 3D de PixelForge.
Ces regles servent de reference a la fois pour les developpeurs humains et pour les assistants d'intelligence artificielle afin de garantir que chaque jeu produit possede des controles complets, une physique agreable (game feel), une camera adaptee et des conditions de mort/reapparition sans defaut.

---

## 1. Controles Universels du Joueur (Clavier AZERTY & QWERTY)

Un jeu de plateforme ou d'action ne doit jamais imposer une seule disposition de clavier. Le script du joueur doit systematiquement verifier simultanement les fleches de direction et les touches de deplacement AZERTY et QWERTY.

### Plateforme 2D
- **Aller a gauche** : Fleche GAUCHE ou touche Q (AZERTY) ou touche A (QWERTY)
  ```js
  const isMovingLeft = input.isDown('LEFT') || input.isDown('Q') || input.isDown('A');
  if (isMovingLeft) {
    self.vx = -SPEED;
    self.flipX = true;
  }
  ```
- **Aller a droite** : Fleche DROITE ou touche D
  ```js
  const isMovingRight = input.isDown('RIGHT') || input.isDown('D');
  if (isMovingRight) {
    self.vx = SPEED;
    self.flipX = false;
  }
  ```
- **Sauter** : Barre ESPACE ou Fleche HAUT ou touche Z (AZERTY) ou touche W (QWERTY)
  ```js
  const wantsJump = input.justPressed('SPACE') || input.justPressed('UP') || input.justPressed('Z') || input.justPressed('W');
  if (wantsJump && self.onGround) {
    self.jump(300);
    game.playSound('jump');
  }
  ```

### Plateforme 3D
- **Avancer** : Fleche HAUT ou touche Z (AZERTY) ou touche W (QWERTY)
  ```js
  let speed = 0;
  if (input.isDown('UP') || input.isDown('Z') || input.isDown('W')) speed = 7;
  ```
- **Reculer** : Fleche BAS ou touche S
  ```js
  if (input.isDown('DOWN') || input.isDown('S')) speed = -7;
  ```
- **Pivoter ou esquiver** : Fleches GAUCHE/DROITE ou Q/A et D
  ```js
  if (input.isDown('LEFT') || input.isDown('Q') || input.isDown('A')) self.rotateY(-3);
  if (input.isDown('RIGHT') || input.isDown('D')) self.rotateY(3);
  self.moveForward(speed);
  ```

---

## 2. Suivi de Camera

Le joueur ne doit jamais sortir du champ de vision :
- **En 2D** : Dans le hook `create`, enregistrer le suivi camera direct :
  ```js
  on('create', () => {
    game.camera.follow(self);
  });
  ```
- **En 3D** : Configurer le mode 3eme personne avec distance et hauteur :
  ```js
  on('create', () => {
    game.camera.setMode('third-person');
    game.camera.follow(self, { distance: 6, height: 3 });
  });
  ```

---

## 3. Securite du Vide et Chute Hors Carte

Tout niveau comportant des fosses ou des ravins doit capturer la sortie de zone du joueur pour declencher une reinitialisation ou une perte de vie :
- **En 2D** :
  ```js
  if (self.y > game.mapHeight + 48) {
    game.restart();
  }
  ```
- **En 3D** :
  ```js
  if (self.y < -12) {
    game.restart();
  }
  ```

---

## 4. Game Feel & Physique du Saut (Plateforme 2D)

Pour un ressenti fluide digne des classiques d'arcade :
1. **Velocite** : Toujours affecter `self.vx` (en px/s, ex: 110 a 130 px/s). Ne jamais deplacer un objet en modifiant `self.x` directement lorsque la physique est activee.
2. **Coyote Time** : Accorder une fenetre de tolerance d'environ 100 ms apres que le joueur a quitte le bord d'une plateforme pour lui permettre de sauter tout de meme.
3. **Jump Buffering** : Memoriser l'appui sur le saut pendant environ 100 ms si le joueur presse la touche quelques fractions de seconde avant de toucher le sol.
4. **Saut a hauteur variable** : Si le joueur relache la touche de saut alors qu'il est en phase ascendante, reduire sa vitesse verticale (`self.vy *= 0.5`) pour permettre des petits sauts precis.
5. **Mecanique Stomp sur les monstres** :
  ```js
  on('collide', 'Player', (p) => {
    if (p.y + p.height - self.y < 14 && p.vy > 0) {
      self.destroy();
      p.vy = -220; // Rebond satisfaisant
      game.score = (game.score || 0) + 100;
      game.playSound('hit');
    } else {
      game.restart();
    }
  });
  ```

---

## 5. Interactions et Triggers

- **Objets a collecter (pieces, gemmes, bonus)** :
  Toujours configurer l'objet avec :
  `physics: { enabled: true, gravity: false, immovable: true, collideMap: false }`
  et gerer la collision avec `on('overlap', 'Player', ...)`.
- **Portails et sorties** :
  Utiliser egalement `on('overlap', 'Player', ...)` pour changer de carte avec `game.goToMap('Niveau Suivant')`.

---

## 6. Audit Automatique dans le Moteur de Playtest

Le module `src/ai/playtester.js` execute une verification statique et dynamique de chaque objet identifie comme Joueur (`Player`, `Hero`, `Joueur`) :
1. Verification de la presence de touches horizontales (`LEFT`, `RIGHT`, `Q`, `A`, `D`).
2. Verification de la presence de la touche de saut (`SPACE`, `UP`, `Z`, `W`).
3. Verification du suivi camera (`game.camera.follow`).
4. Verification de la gestion de chute hors carte (`mapHeight` ou `y >`).

Si une anomalie est detectee, le moteur d'autocorrection (`autoFixGame`) injecte automatiquement le script standard de reference eprouve pour retablir instantanement la jouabilite.
