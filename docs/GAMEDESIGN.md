# Guide de Game Design et Game Feel pour PixelForge

Ce guide formalise les principes essentiels de Game Design et de « Game Feel » (sensations de jeu) adaptes au moteur PixelForge (2D et 3D retro). Il sert de reference pour les createurs humains et de base de connaissances pour l'assistant IA.

---

## 1. Principes fondamentaux du Game Feel

Le Game Feel regroupe toutes les sensations tactiles et visuelles qui rendent un jeu agreable, reactif et gratifiant a jouer.

### 1.1 Coyote Time (Temps de tolerance de saut)
- **Probleme** : Dans un jeu de plateforme strict, si le joueur saute 1 pixel apres avoir quitte le bord d'une plateforme, son saut n'est pas enregistre, ce qui cree de la frustration et une impression de controls rigides.
- **Solution** : Accorder un delai de grace de 80 a 120 millisecondes apres la perte de contact avec le sol durant lequel le saut reste autorise.
- **Recette PixelForge** :
```js
let coyoteTimer = 0;
const COYOTE_DURATION = 100; // ms

on('update', (dt) => {
  if (self.onGround) {
    coyoteTimer = COYOTE_DURATION;
  } else {
    coyoteTimer = Math.max(0, coyoteTimer - dt);
  }

  if ((input.justPressed('SPACE') || input.justPressed('UP')) && coyoteTimer > 0) {
    self.jump(290);
    coyoteTimer = 0;
  }
});
```

### 1.2 Jump Buffering (Memoire tampon d'entree de saut)
- **Probleme** : Le joueur appuie sur saut quelques millisecondes avant de toucher le sol. Si la touche n'est pas maintenue au moment precis de l'atterrissage, le saut n'a pas lieu.
- **Solution** : Memoriser la pression sur la touche de saut pendant 100 ms et l'executer des que le contact au sol est retabli.
- **Recette PixelForge** :
```js
let jumpBufferTimer = 0;
const JUMP_BUFFER = 100; // ms

on('update', (dt) => {
  if (input.justPressed('SPACE') || input.justPressed('UP')) {
    jumpBufferTimer = JUMP_BUFFER;
  } else {
    jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
  }

  if (jumpBufferTimer > 0 && self.onGround) {
    self.jump(290);
    jumpBufferTimer = 0;
  }
});
```

### 1.3 Hauteur de saut variable (Variable Jump Height)
- **Probleme** : Les sauts a hauteur fixe rendent les phases de plateforme monotones et imprecises.
- **Solution** : Si le joueur relache la touche de saut pendant l'ascension, la vitesse verticale ascendante est immediatement reduite (par exemple coupee de moitie), permettant un saut court.
- **Recette PixelForge** :
```js
on('update', () => {
  if (input.justReleased('SPACE') && self.vy < -80) {
    self.vy *= 0.5;
  }
});
```

### 1.4 Acceleration et Deceleration (Mouvement fluide)
- **Principe** : Au lieu d'assigner brutalement une vitesse fixe (`vx = 100`), utiliser une interpolation fluide ou un facteur d'acceleration et de friction pour un ressenti physique naturel.
- **Recette PixelForge** :
```js
const SPEED = 120;
const ACCEL = 12;
const FRICTION = 0.8;

on('update', () => {
  let targetVx = 0;
  if (input.isDown('LEFT')) { targetVx -= SPEED; self.flipX = true; }
  if (input.isDown('RIGHT')) { targetVx += SPEED; self.flipX = false; }

  if (targetVx !== 0) {
    self.vx += (targetVx - self.vx) * 0.2;
  } else {
    self.vx *= FRICTION;
    if (Math.abs(self.vx) < 5) self.vx = 0;
  }
});
```

### 1.5 Secousse d'ecran (Screen Shake)
- **Principe** : Ajouter un leger deplacement aleatoire de la camera lors des impacts violents, explosions ou atterrissages lourds. La secousse doit decroitre rapidement (decroissance quadratique ou exponentielle) pour eviter la fatigue visuelle.
- **Recette PixelForge** :
```js
let shakeAmount = 0;

function triggerShake(intensity) {
  shakeAmount = Math.max(shakeAmount, intensity);
}

on('update', (dt) => {
  if (shakeAmount > 0) {
    const offsetX = (Math.random() - 0.5) * shakeAmount;
    const offsetY = (Math.random() - 0.5) * shakeAmount;
    game.camera.setOffset(offsetX, offsetY);
    shakeAmount = Math.max(0, shakeAmount - dt * 0.05);
  }
});
```

---

## 2. Conception de Niveaux (Level Design)

### 2.1 La methode Kishotenketsu
Cette structure en 4 etapes permet d'introduire toute nouvelle mecanique de maniere pedagogique et valorisante sans tutoriel textuel envahissant :
1. **Introduction** : La mecanique est presentee dans un environnement securise, sans danger mortel.
2. **Developpement** : La mecanique est appliquee avec une legere contrainte (plateforme mobile, timing simple).
3. **Rebondissement / Twist** : La mecanique est combinee avec un element inattendu ou un ennemi pour creer un defi.
4. **Conclusion / Maitrise** : Le joueur surmonte l'epreuve et valide sa competence par une recompense valorisante.

### 2.2 Pacing et Courbe de difficulte
- **Alternance tension / repos** : Ne jamais enchainer continuellement des phases de haute intensite. Introduire des zones de recuperation ou des secrets a explorer apres chaque passage difficile.
- **Guidage visuel subliminal** :
  - Placer des collectibles (pieces, gemmes) en parabole le long des trajectoires de saut ideales.
  - Utiliser le contraste de la palette pour attirer le regard vers la sortie ou les prises d'escalade.
  - La regle du tiers : placer les elements d'interet aux points d'intersection de la grille visuelle.

---

## 3. Intelligence Artificielle et Comportements Ennemis

### 3.1 Machine a etats finis (FSM)
Une machine a etats garantit des comportements lisibles et deboguables pour les ennemis :
- `IDLE` (Immobile, scrute les alentours)
- `PATROL` (Deplacement entre deux bornes ou le long d'une plateforme)
- `CHASE` (Poursuite du joueur detecte a portee)
- `HURT` (Recul et invulnerabilite temporaire)
- `ATTACK` (Preparation puis declenchement de l'attaque)

### 3.2 Detection des bords et des murs
- Pour eviter qu'un patrouilleur ne tombe dans un fosse, combiner la detection de mur et la presence d'un sol sous ses pieds :
```js
let dir = 1;
const SPEED = 40;

on('update', () => {
  self.vx = dir * SPEED;
  self.flipX = dir < 0;

  // Inversion de direction si bloque par un mur
  if (self.vx === 0 && (self.body?.blocked?.left || self.body?.blocked?.right)) {
    dir = -dir;
  }
});
```

---

## 4. Retours Visuels et Sonores (Feedback Loop)

1. **Telegraphing (Anticipation)** : Tout coup ennemi ou piege doit donner un signal visuel ou sonore quelques dixiemes de seconde avant de porter atteinte au joueur (clignotement, pause, son d'alerte).
2. **Hit Stop (Micro-pause)** : Figer l'action pendant 50 a 80 ms lors d'un impact critique amplifie drastiquement le sentiment de puissance de l'attaque.
3. **Indicateurs sonores clairs** :
   - Saut : son ascendant aigu.
   - Degats recus : son sourd grave et decroissant.
   - Collecte : deux notes rapides harmoniques (ex: C5 -> G5).
   - Echec : descente chromatique.
   - Victoire : fanfare majeure triomphale.
