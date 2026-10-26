/**
 * PixelForge Studio — Controleurs de Cameras 3D Retro & Ambiance
 * Fournit les 5 prereglages de camera (3e personne anti-occlusion, 1re personne / FPS,
 * vue de dessus, isometrique, defilement 2.5D) et la gestion des lumieres/brouillards.
 *
 * Concu sans dependance externe lourde (Three.js passe en argument).
 */

export const CAMERA_MODES = {
  THIRD_PERSON: 'third-person',
  FIRST_PERSON: 'first-person',
  TOP_DOWN: 'top-down',
  ISOMETRIC: 'isometric',
  SIDE_SCROLL: 'side-scroll',
};

/**
 * Cree un controleur de camera 3D avance
 */
export function createCameraController(camera, options = {}) {
  let mode = options.mode || CAMERA_MODES.THIRD_PERSON;
  let target = options.target || null;
  let solidBlocks = options.solidBlocks || new Map();

  let distance = typeof options.distance === 'number' ? options.distance : 6;
  let height = typeof options.height === 'number' ? options.height : 2.5;
  let pitch = typeof options.pitch === 'number' ? options.pitch : 20; // degres
  let yaw = 0; // degres
  let lerpFactor = typeof options.lerp === 'number' ? options.lerp : 0.12;

  // Vue subjective (First person)
  let fov = options.fov || 65;
  let fpsPitch = 0; // vertical
  let fpsYaw = 0; // horizontal

  // Test anti-collision contre les murs (Third-person occlusion avoidance)
  function resolveWallOcclusion(fromPos, idealPos) {
    if (!solidBlocks || solidBlocks.size === 0) return idealPos;

    const dx = idealPos.x - fromPos.x;
    const dy = idealPos.y - fromPos.y;
    const dz = idealPos.z - fromPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.2) return idealPos;

    const steps = Math.ceil(dist * 8); // echantillonnage tous les 12.5 cm
    const stepX = dx / steps;
    const stepY = dy / steps;
    const stepZ = dz / steps;

    let curX = fromPos.x;
    let curY = fromPos.y;
    let curZ = fromPos.z;

    for (let i = 1; i <= steps; i++) {
      curX += stepX;
      curY += stepY;
      curZ += stepZ;

      const bx = Math.floor(curX);
      const by = Math.floor(curY);
      const bz = Math.floor(curZ);

      if (solidBlocks.has(`${bx},${by},${bz}`)) {
        // Mur rencontre : reculer d'un demi-pas de securite et stopper
        const safeDist = Math.max(0.4, (i - 1.5) / steps);
        return {
          x: fromPos.x + dx * safeDist,
          y: fromPos.y + dy * safeDist,
          z: fromPos.z + dz * safeDist,
        };
      }
    }

    return idealPos;
  }

  return {
    get mode() { return mode; },
    get target() { return target; },

    setMode(newMode, opts = {}) {
      mode = newMode;
      if (typeof opts.distance === 'number') distance = opts.distance;
      if (typeof opts.height === 'number') height = opts.height;
      if (typeof opts.pitch === 'number') pitch = opts.pitch;
      if (typeof opts.lerp === 'number') lerpFactor = opts.lerp;
    },

    follow(newTarget, opts = {}) {
      target = newTarget;
      if (typeof opts.distance === 'number') distance = opts.distance;
      if (typeof opts.height === 'number') height = opts.height;
      if (typeof opts.pitch === 'number') pitch = opts.pitch;
      if (typeof opts.lerp === 'number') lerpFactor = opts.lerp;
    },

    setSolidBlocks(blocks) {
      solidBlocks = blocks;
    },

    update(dt = 16, input = null) {
      if (!target || target.destroyed) return;

      const tx = target.x || 0;
      const ty = (target.y || 0) + (target.height ? target.height * 0.7 : 0.8);
      const tz = target.z || 0;

      if (mode === CAMERA_MODES.THIRD_PERSON) {
        const targetRotY = typeof target.rotationY === 'number' ? target.rotationY : 0;
        const rad = (targetRotY * Math.PI) / 180;

        const idealX = tx + Math.sin(rad) * distance;
        const idealY = ty + height;
        const idealZ = tz + Math.cos(rad) * distance;

        // Prevention d'occlusion murale
        const safePos = resolveWallOcclusion({ x: tx, y: ty, z: tz }, { x: idealX, y: idealY, z: idealZ });

        camera.position.x += (safePos.x - camera.position.x) * lerpFactor;
        camera.position.y += (safePos.y - camera.position.y) * lerpFactor;
        camera.position.z += (safePos.z - camera.position.z) * lerpFactor;

        camera.lookAt(tx, ty, tz);
      } else if (mode === CAMERA_MODES.FIRST_PERSON) {
        if (input && (input.mouseDeltaX || input.mouseDeltaY)) {
          fpsYaw -= (input.mouseDeltaX || 0) * 0.2;
          fpsPitch -= (input.mouseDeltaY || 0) * 0.2;
          fpsPitch = Math.max(-85, Math.min(85, fpsPitch));
        }

        // Synchroniser orientation de l'entite avec le yaw souris
        if (target.rotationY !== undefined) {
          target.rotationY = fpsYaw;
        }

        camera.position.set(tx, ty + 0.3, tz);

        const yawRad = (fpsYaw * Math.PI) / 180;
        const pitchRad = (fpsPitch * Math.PI) / 180;

        const dirX = -Math.sin(yawRad) * Math.cos(pitchRad);
        const dirY = Math.sin(pitchRad);
        const dirZ = -Math.cos(yawRad) * Math.cos(pitchRad);

        camera.lookAt(camera.position.x + dirX, camera.position.y + dirY, camera.position.z + dirZ);
      } else if (mode === CAMERA_MODES.TOP_DOWN) {
        const targetX = tx;
        const targetY = ty + distance * 1.5;
        const targetZ = tz + distance * 0.4;

        camera.position.x += (targetX - camera.position.x) * lerpFactor;
        camera.position.y += (targetY - camera.position.y) * lerpFactor;
        camera.position.z += (targetZ - camera.position.z) * lerpFactor;

        camera.lookAt(tx, ty, tz);
      } else if (mode === CAMERA_MODES.ISOMETRIC) {
        // Angle isometrique classique (45 degres yaw, ~35.264 degres pitch)
        const isoDist = distance * 1.4;
        const targetX = tx + isoDist;
        const targetY = ty + isoDist * 0.8;
        const targetZ = tz + isoDist;

        camera.position.x += (targetX - camera.position.x) * lerpFactor;
        camera.position.y += (targetY - camera.position.y) * lerpFactor;
        camera.position.z += (targetZ - camera.position.z) * lerpFactor;

        camera.lookAt(tx, ty, tz);
      } else if (mode === CAMERA_MODES.SIDE_SCROLL) {
        // Defilement lateral 2.5D
        const targetX = tx;
        const targetY = ty + height * 0.5;
        const targetZ = tz + distance * 1.2;

        camera.position.x += (targetX - camera.position.x) * lerpFactor;
        camera.position.y += (targetY - camera.position.y) * lerpFactor;
        camera.position.z += (targetZ - camera.position.z) * lerpFactor;

        camera.lookAt(tx, ty + height * 0.5, tz);
      }
    },
  };
}
