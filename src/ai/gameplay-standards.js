/**
 * PixelForge Studio — Standards de Gameplay et Guide Fondamental
 * Regles de conception et scripts de reference pour eviter les oublis (controles, physique, camera, mort).
 *
 * Ce module est utilise par :
 * - Le prompt systeme de l'Assistant IA (buildAgentSystemPrompt dans src/ai/agent.js)
 * - Le generateur de jeux (src/ai/game-generator.js)
 * - Le playtester headless et d'autocorrection (src/ai/playtester.js)
 *
 * Module pur : zero dependance DOM, zero dependance Node. Zero emoji.
 */

// ============================================================================
// 1. SCRIPTS DE REFERENCE OFFICIELS (2D & 3D)
// ============================================================================

export const STANDARD_PLAYER_2D_SCRIPT = `
// Joueur plateforme 2D standard : controles universels AZERTY / QWERTY,
// camera follow, Coyote Time, Jump Buffering, saut variable et securite du vide.
let coyoteTimer = 0;
let jumpBuffer = 0;
const SPEED = 110;
const JUMP_FORCE = 300;

on('create', () => {
  game.camera.follow(self);
  game.score = game.score || 0;
  game.setText('hud', 'Score : ' + game.score + ' | ' + (game.currentMapName || 'Niveau 1'), 8, 8);
});

on('update', (dt) => {
  // 1. Gestion Coyote Time (grace apres avoir quitte le sol)
  if (self.onGround) {
    coyoteTimer = 100;
  } else {
    coyoteTimer = Math.max(0, coyoteTimer - dt);
  }

  // 2. Gestion Jump Buffering (enregistrement d'un saut anticipe)
  const wantsJump = input.justPressed('SPACE') ||
                    input.justPressed('UP') ||
                    input.justPressed('Z') ||
                    input.justPressed('W');
  if (wantsJump) {
    jumpBuffer = 100;
  } else {
    jumpBuffer = Math.max(0, jumpBuffer - dt);
  }

  // 3. Deplacements horizontaux (Support universel Fleches + ZQSD + WASD)
  self.vx = 0;
  const isMovingLeft = input.isDown('LEFT') || input.isDown('Q') || input.isDown('A');
  const isMovingRight = input.isDown('RIGHT') || input.isDown('D');

  if (isMovingLeft) {
    self.vx = -SPEED;
    self.flipX = true;
  }
  if (isMovingRight) {
    self.vx = SPEED;
    self.flipX = false;
  }

  // 4. Declenchement du saut
  if (jumpBuffer > 0 && coyoteTimer > 0) {
    self.jump(JUMP_FORCE);
    jumpBuffer = 0;
    coyoteTimer = 0;
    game.playSound('jump', 0.8, 1.2);
  }

  // 5. Saut a hauteur variable (relacher attenue la poussee)
  const jumpReleased = input.justReleased('SPACE') ||
                       input.justReleased('UP') ||
                       input.justReleased('Z') ||
                       input.justReleased('W');
  if (jumpReleased && self.vy < -80) {
    self.vy *= 0.5;
  }

  // 6. Animations visuelles
  if (!self.onGround) {
    self.play('jump');
  } else if (self.vx !== 0) {
    self.play('run');
  } else {
    self.play('idle');
  }

  // 7. Securite du vide : chute hors de la carte
  if (self.y > game.mapHeight + 48) {
    game.restart();
  }
});
`.trim();

export const STANDARD_PLAYER_3D_SCRIPT = `
// Joueur plateforme 3D standard : camera 3eme personne, deplacements
// universels AZERTY / QWERTY, saut et securite de chute dans le vide.
on('create', () => {
  game.camera.setMode('third-person');
  game.camera.follow(self, { distance: 6, height: 3 });
  game.score = game.score || 0;
  game.setText('hud', 'Score : ' + game.score, 8, 8);
});

on('update', () => {
  // Mouvements avant / arriere (Z / W / Fleche HAUT pour avancer, S / Fleche BAS pour reculer)
  let speed = 0;
  if (input.isDown('UP') || input.isDown('Z') || input.isDown('W')) speed = 7;
  if (input.isDown('DOWN') || input.isDown('S')) speed = -7;

  // Rotation ou strafe (Q / A / Fleche GAUCHE, D / Fleche DROITE)
  if (input.isDown('LEFT') || input.isDown('Q') || input.isDown('A')) self.rotateY(-3);
  if (input.isDown('RIGHT') || input.isDown('D')) self.rotateY(3);

  self.moveForward(speed);

  // Saut vertical
  const wantsJump = input.justPressed('SPACE') || input.justPressed('UP');
  if (wantsJump && self.onGround) {
    self.jump(12);
    game.playSound('jump', 0.8, 1.2);
  }

  // Securite chute dans le vide
  if (self.y < -12) {
    game.restart();
  }
});
`.trim();

// ============================================================================
// 2. DOCUMENTATION FONDAMENTALE ET SYSTEM PROMPT
// ============================================================================

export const GAMEPLAY_STANDARDS_DOC = `
# STANDARDS FONDAMENTAUX DU GAMEPLAY PIXELFORGE (A RESPECTER STRICTEMENT)

Lors de la generation ou modification de scripts d'objets, applique systematiquement ces regles :

1. CONTROLES UNIVERSELS DU JOUEUR (AZERTY & QWERTY) :
- Le joueur DOIT pouvoir se deplacer avec les Fleches ET les touches clavier standard :
  * Gauche : input.isDown('LEFT') || input.isDown('Q') || input.isDown('A')
  * Droite : input.isDown('RIGHT') || input.isDown('D')
  * Saut : input.justPressed('SPACE') || input.justPressed('UP') || input.justPressed('Z') || input.justPressed('W')
  * Bas / S'accroupir : input.isDown('DOWN') || input.isDown('S')
- En 3D :
  * Avancer : input.isDown('UP') || input.isDown('Z') || input.isDown('W')
  * Reculer : input.isDown('DOWN') || input.isDown('S')
  * Tourner gauche : input.isDown('LEFT') || input.isDown('Q') || input.isDown('A')
  * Tourner droite : input.isDown('RIGHT') || input.isDown('D')

2. SUIVI DE CAMERA OBLIGATOIRE :
- Dans le gestionnaire on('create', ...) du Joueur, configure impérativement la caméra :
  * 2D : game.camera.follow(self);
  * 3D : game.camera.setMode('third-person'); game.camera.follow(self, { distance: 6, height: 3 });

3. SECURITE DU VIDE ET CHUTE :
- Si le joueur tombe dans un ravin ou chute hors du niveau :
  * 2D : if (self.y > game.mapHeight + 48) game.restart();
  * 3D : if (self.y < -12) game.restart();

4. GAME FEEL DU SAUT ET VELOCITE (2D) :
- Ne jamais modifier directement self.x ou self.y avec la physique active : modifier self.vx et self.vy.
- Mettre self.vx = 0 au debut de on('update'), puis self.vx = -SPEED (gauche) ou +SPEED (droite).
- Orientation : self.flipX = true (gauche), false (droite).
- Coyote Time (grace de 100 ms apres avoir quitte une corniche) et Jump Buffering (100 ms avant de toucher le sol).
- Saut a hauteur variable : if (input.justReleased('SPACE') && self.vy < -80) self.vy *= 0.5;

5. INTERACTIONS ENTRE ENTITES :
- Collectibles / Pieces : utiliser on('overlap', 'Player', ...) avec physics: { enabled: true, gravity: false, immovable: true, collideMap: false }.
- Ennemis : utiliser on('collide', 'Player', ...). Pour le stomp par le dessus :
  if (p.y + p.height - self.y < 14 && p.vy > 0) { self.destroy(); p.vy = -220; } else { game.restart(); }
- Portails / Sorties : utiliser on('overlap', 'Player', ...) pour declencher game.goToMap('NomCarte').
`.trim();

// ============================================================================
// 3. FONCTION D'AUDIT DU CODE DU JOUEUR (AUDIT AUTOMATIQUE)
// ============================================================================

/**
 * Analyse le code d'un script joueur pour detecter les oublis fondamentaux.
 *
 * @param {string} code - Script JavaScript du joueur
 * @param {'2d' | '3d'} [dimension='2d'] - Dimension du jeu
 * @returns {{ valid: boolean, missing: Array<string>, details: Array<string> }}
 */
export function auditPlayerScript(code, dimension = '2d') {
  const missing = [];
  const details = [];

  const script = String(code || '').trim();
  if (!script) {
    return {
      valid: false,
      missing: ['empty_script', 'horizontal_movement', 'jump_control', 'camera_follow', 'fall_boundary'],
      details: ['Le script du joueur est completement vide.'],
    };
  }

  // 1. Verification du suivi camera
  const hasCameraFollow = /camera\s*\.\s*follow\s*\(/i.test(script);
  if (!hasCameraFollow) {
    missing.push('camera_follow');
    details.push('Suivi camera manquant (game.camera.follow(self)).');
  }

  // 2. Verification des controles de deplacement
  if (dimension === '3d') {
    const hasMove = /moveForward|moveRight|rotateY|vz|vx/i.test(script);
    const hasInputMove = /isDown\s*\(\s*['"](UP|W|Z|DOWN|S|LEFT|A|Q|RIGHT|D)['"]\s*\)/i.test(script);
    if (!hasMove || !hasInputMove) {
      missing.push('horizontal_movement');
      details.push('Controles de deplacement 3D manquants (touches ZQSD/Fleches et moveForward/rotateY).');
    }

    const hasJump = /jump\s*\(/i.test(script);
    if (!hasJump) {
      missing.push('jump_control');
      details.push('Controle de saut 3D manquant (self.jump).');
    }

    const hasFallCheck = /y\s*<\s*-\s*\d+|restart\s*\(/i.test(script);
    if (!hasFallCheck) {
      missing.push('fall_boundary');
      details.push('Detection de chute dans le vide 3D manquante (self.y < -12).');
    }
  } else {
    // 2D
    const hasHorizontalMove = /(self\s*\.\s*vx|setVelocity|moveRight)/i.test(script);
    const hasLeftKey = /isDown\s*\(\s*['"](LEFT|Q|A)['"]\s*\)|justPressed\s*\(\s*['"](LEFT|Q|A)['"]\s*\)/i.test(script);
    const hasRightKey = /isDown\s*\(\s*['"](RIGHT|D)['"]\s*\)|justPressed\s*\(\s*['"](RIGHT|D)['"]\s*\)/i.test(script);

    if (!hasHorizontalMove || !hasLeftKey || !hasRightKey) {
      missing.push('horizontal_movement');
      details.push('Touches de deplacement horizontal manquantes (LEFT/Q/A ou RIGHT/D avec self.vx).');
    }

    const hasJump = /jump\s*\(/i.test(script);
    const hasJumpKey = /['"](SPACE|UP|Z|W)['"]/i.test(script);
    if (!hasJump || !hasJumpKey) {
      missing.push('jump_control');
      details.push('Touche de saut manquante (SPACE/UP/Z/W avec self.jump).');
    }

    const hasFallCheck = /mapHeight|y\s*>\s*|restart\s*\(/i.test(script);
    if (!hasFallCheck) {
      missing.push('fall_boundary');
      details.push('Detection de chute dans le vide manquante (self.y > game.mapHeight).');
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    details,
  };
}
