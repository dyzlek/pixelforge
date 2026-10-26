/**
 * PixelForge Studio — Base de connaissances Game Design & Game Feel
 * Fournit les principes et recettes a injecter dans le contexte des modeles IA
 * pour produire du code et des Blueprints de qualite superieure.
 */

export const GAMEDESIGN_PRINCIPLES = `
# PRINCIPES ESSENTIELS DE GAME DESIGN & GAME FEEL (PIXELFORGE)

1. COYOTE TIME :
   Accorder toujours 80 a 120 ms de tolerance apres avoir quitte une plateforme pour permettre au joueur de sauter.
   Pattern : stocker un timer coyoteTimer decremente dans update, reinitialise a COYOTE_DURATION quand self.onGround.

2. JUMP BUFFERING :
   Memoriser un appui sur la touche saut pendant 80 a 120 ms avant d'atterrir et declencher le saut des l'impact au sol.
   Pattern : stocker un timer jumpBufferTimer arme sur input.justPressed, decremente dans update.

3. HAUTEUR DE SAUT VARIABLE :
   Quand la touche saut est relachee (input.justReleased), reduire la vitesse verticale (self.vy *= 0.5) pour un saut court et reactif.

4. ACCELERATION ET FRICTION :
   Eviter le mouvement instantane brutal. Utiliser une interpolation (lerp) pour atteindre la vitesse cible et de la friction a l'arret.

5. SECOUSSE D'ECRAN (SCREEN SHAKE) :
   Lors des impacts, appliquer un deplacement aleatoire a la camera avec amortissement exponentiel.

6. FEEDBACK VISUEL ET SONORE :
   - Telegraphier les attaques ennemies (anticiper avant de frapper).
   - Utiliser des particules ou un clignotement lors des degats.
   - Accompagner chaque action gratifiante d'un son chiptune adapte (jump, coin, hit, explosion, laser).

7. CONCEPTION DE NIVEAUX (KISHOTENKETSU) :
   Introduction -> Developpement -> Rebondissement / Twist -> Conclusion / Maitrise.
   Placer les objets de collection en cloche pour dessiner la trajectoire ideale des sauts.
`;

export const SCRIPT_TEMPLATES = {
  platformerPlayer: `
// Joueur plateforme perfectionne avec Coyote Time et Jump Buffering
let coyoteTimer = 0;
let jumpBuffer = 0;
const SPEED = 110;
const JUMP_FORCE = 300;

on('create', () => {
  game.camera.follow(self);
});

on('update', (dt) => {
  // Gestion Coyote Time
  if (self.onGround) {
    coyoteTimer = 100;
  } else {
    coyoteTimer = Math.max(0, coyoteTimer - dt);
  }

  // Gestion Jump Buffer
  if (input.justPressed('SPACE') || input.justPressed('UP')) {
    jumpBuffer = 100;
  } else {
    jumpBuffer = Math.max(0, jumpBuffer - dt);
  }

  // Mouvement horizontal
  self.vx = 0;
  if (input.isDown('LEFT')) {
    self.vx = -SPEED;
    self.flipX = true;
  }
  if (input.isDown('RIGHT')) {
    self.vx = SPEED;
    self.flipX = false;
  }

  // Declenchement du saut
  if (jumpBuffer > 0 && coyoteTimer > 0) {
    self.jump(JUMP_FORCE);
    jumpBuffer = 0;
    coyoteTimer = 0;
    game.playSound('jump', 0.8, 1);
  }

  // Saut variable a la relache
  if (input.justReleased('SPACE') && self.vy < -80) {
    self.vy *= 0.5;
  }

  // Animations
  if (!self.onGround) {
    self.play('jump');
  } else if (self.vx !== 0) {
    self.play('run');
  } else {
    self.play('idle');
  }

  // Chute hors niveau
  if (self.y > game.mapHeight + 48) {
    game.restart();
  }
});
`,

  patrolEnemy: `
// Ennemi patrouilleur avec inversion aux obstacles et elimination par le dessus
let dir = 1;
const SPEED = 40;

on('create', () => {
  self.vx = dir * SPEED;
});

on('update', () => {
  if (self.vx === 0) {
    dir = -dir;
  }
  self.vx = dir * SPEED;
  self.flipX = dir < 0;
});

on('timer', 1600, () => {
  dir = -dir;
});

on('collide', 'Player', (p) => {
  // Verification si le joueur atterrit au-dessus de la tete
  if (p.y + p.height - self.y < 12 && p.vy > 0) {
    self.destroy();
    p.vy = -200;
    game.score += 100;
    game.playSound('hit', 0.8, 1.2);
  } else {
    game.restart();
  }
});
`,

  collectibleCoin: `
// Collectible avec animation de flottement et son gratifiant
let startY = 0;
let time = 0;

on('create', () => {
  startY = self.y;
});

on('update', (dt) => {
  time += dt * 0.005;
  self.y = startY + Math.sin(time) * 3;
});

on('overlap', 'Player', () => {
  self.destroy();
  game.score += 10;
  game.setText('score', 'Score : ' + game.score, 6, 6);
  game.playSound('coin', 0.8, 1);
});
`,
};
