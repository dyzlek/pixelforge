// PixelForge — runtime 3D retro : execute un projet PixelForge en 3D avec Three.js.
// AUCUN IMPORT dans ce fichier (Three.js est passe en parametre ou lu sur globalThis.THREE).
// Ce fichier est inline tel quel dans l'export standalone HTML (export-template-3d.js).
// Reference de l'API : voir docs/SCRIPT_API_3D.md

export function createGame3D(project, parent, THREE, opts = {}) {
  const ThreeLib = THREE || (typeof globalThis !== 'undefined' ? globalThis.THREE : null);
  if (!ThreeLib) {
    throw new Error('Three.js est requis pour executer le runtime 3D PixelForge.');
  }

  const settings = project.settings || {};
  const width = settings.width || 320;
  const height = settings.height || 180;
  const gravityAccel = typeof settings.gravity === 'number' ? settings.gravity / 100 : 9.81;

  // Audio chiptune
  let chipAudio = null;
  try {
    if (opts.chip) {
      chipAudio = opts.chip;
    } else if (typeof globalThis !== 'undefined' && globalThis.createChipAudio) {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioCtx) {
        const actx = new AudioCtx();
        chipAudio = globalThis.createChipAudio(actx, actx.destination);
      }
    }
  } catch (e) {
    console.warn('Audio non initialise en 3D :', e);
  }

  // Conteneur DOM
  const root = typeof parent === 'string' ? document.querySelector(parent) : parent;
  if (!root) throw new Error('Conteneur parent 3D introuvable.');

  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.overflow = 'hidden';
  wrapper.style.background = settings.background || '#1a1c2c';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  root.appendChild(wrapper);

  // Canvas Three.js retro basse resolution
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.objectFit = 'contain';
  canvas.style.display = 'block';
  canvas.tabIndex = 1;
  wrapper.appendChild(canvas);

  // Couche HUD pour game.setText
  const hudContainer = document.createElement('div');
  hudContainer.style.position = 'absolute';
  hudContainer.style.inset = '0';
  hudContainer.style.pointerEvents = 'none';
  hudContainer.style.fontFamily = 'monospace';
  hudContainer.style.fontSize = '12px';
  hudContainer.style.color = '#ffffff';
  hudContainer.style.zIndex = '10';
  wrapper.appendChild(hudContainer);

  const hudTexts = new Map();

  // Three.js Scene, Camera, Renderer
  const scene = new ThreeLib.Scene();
  const env = project.environment || {};
  const bgColor = env.skyColor || settings.background || '#1a1c2c';
  scene.background = new ThreeLib.Color(bgColor);

  if (env.fog?.enabled) {
    scene.fog = new ThreeLib.FogExp2(env.fog.color || bgColor, env.fog.density || 0.04);
  }

  const camera = new ThreeLib.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 5, 10);

  const renderer = new ThreeLib.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  // Lumieres
  const ambientLight = new ThreeLib.AmbientLight(
    env.ambientLight?.color || 0xffffff,
    env.ambientLight?.intensity ?? 0.7
  );
  scene.add(ambientLight);

  const dirLight = new ThreeLib.DirectionalLight(
    env.directionalLight?.color || 0xffeedd,
    env.directionalLight?.intensity ?? 0.9
  );
  const dirPos = env.directionalLight?.position || [10, 20, 15];
  dirLight.position.set(dirPos[0], dirPos[1], dirPos[2]);
  scene.add(dirLight);

  // Donnees du projet
  const objectsByName = {};
  const objectsById = {};
  (project.objects || []).forEach((o) => {
    objectsById[o.id] = o;
    if (!objectsByName[o.name]) objectsByName[o.name] = o;
  });

  const modelsById = {};
  (project.models || []).forEach((m) => {
    modelsById[m.id] = m;
  });

  // Scene 3D active
  let currentScene3D = (project.scenes3d && project.scenes3d[0]) || {
    id: 'default-scene',
    name: 'Scene 1',
    gridmap: {},
    entities: [],
  };

  // Construction de la GridMap (sol et blocs solides)
  const gridGroup = new ThreeLib.Group();
  scene.add(gridGroup);

  const cubeGeo = new ThreeLib.BoxGeometry(1, 1, 1);
  const palette = project.palette || [
    '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
    '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
  ];

  const materialCache = new Map();
  function getMaterial(colorHex) {
    if (!materialCache.has(colorHex)) {
      materialCache.set(
        colorHex,
        new ThreeLib.MeshLambertMaterial({ color: colorHex, flatShading: true })
      );
    }
    return materialCache.get(colorHex);
  }

  // Stockage des blocs solides pour la physique AABB
  const solidBlocks = new Map(); // "x,y,z" => { x, y, z, color }

  function buildGridMap(gridmapData) {
    // Nettoyer l'ancienne grille
    while (gridGroup.children.length > 0) {
      gridGroup.remove(gridGroup.children[0]);
    }
    solidBlocks.clear();

    if (!gridmapData || typeof gridmapData !== 'object') {
      // Si aucune grille specifiee, generer un sol par defaut de 20x20 blocs
      for (let x = -10; x <= 10; x++) {
        for (let z = -10; z <= 10; z++) {
          const colorHex = (Math.abs(x) + Math.abs(z)) % 2 === 0 ? palette[8] : palette[14];
          const mesh = new ThreeLib.Mesh(cubeGeo, getMaterial(colorHex));
          mesh.position.set(x, -0.5, z);
          gridGroup.add(mesh);
          solidBlocks.set(`${x},-1,${z}`, { x, y: -0.5, z });
        }
      }
      return;
    }

    Object.entries(gridmapData).forEach(([coordStr, blockInfo]) => {
      const parts = coordStr.split(',').map((v) => parseInt(v, 10));
      if (parts.length < 3) return;
      const [bx, by, bz] = parts;
      const colorHex = typeof blockInfo === 'string' ? blockInfo : palette[blockInfo?.colorIndex || 6];
      const mesh = new ThreeLib.Mesh(cubeGeo, getMaterial(colorHex));
      mesh.position.set(bx, by, bz);
      gridGroup.add(mesh);
      solidBlocks.set(`${bx},${by},${bz}`, { x: bx, y: by, z: bz });
    });
  }

  buildGridMap(currentScene3D.gridmap);

  // Gestion des Entrees (Input)
  const pressedKeys = new Set();
  const justPressedKeys = new Set();
  const justReleasedKeys = new Set();
  let mouseDeltaX = 0;
  let mouseDeltaY = 0;
  let isPointerLocked = false;

  function onKeyDown(e) {
    const k = e.key.toUpperCase();
    if (!pressedKeys.has(k)) {
      justPressedKeys.add(k);
    }
    pressedKeys.add(k);
    // Gestion fleches & espace
    if (['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key.toUpperCase();
    pressedKeys.delete(k);
    justReleasedKeys.add(k);
  }

  function onMouseMove(e) {
    if (document.pointerLockElement === canvas) {
      mouseDeltaX += e.movementX || 0;
      mouseDeltaY += e.movementY || 0;
    }
  }

  function onPointerLockChange() {
    isPointerLocked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  canvas.addEventListener('click', () => {
    canvas.focus();
  });

  const input = {
    isDown(k) {
      const key = String(k).toUpperCase();
      if (key === 'LEFT') return pressedKeys.has('ARROWLEFT') || pressedKeys.has('A') || pressedKeys.has('Q');
      if (key === 'RIGHT') return pressedKeys.has('ARROWRIGHT') || pressedKeys.has('D');
      if (key === 'UP') return pressedKeys.has('ARROWUP') || pressedKeys.has('W') || pressedKeys.has('Z');
      if (key === 'DOWN') return pressedKeys.has('ARROWDOWN') || pressedKeys.has('S');
      if (key === 'SPACE') return pressedKeys.has(' ');
      return pressedKeys.has(key);
    },
    justPressed(k) {
      const key = String(k).toUpperCase();
      if (key === 'LEFT') return justPressedKeys.has('ARROWLEFT') || justPressedKeys.has('A') || justPressedKeys.has('Q');
      if (key === 'RIGHT') return justPressedKeys.has('ARROWRIGHT') || justPressedKeys.has('D');
      if (key === 'UP') return justPressedKeys.has('ARROWUP') || justPressedKeys.has('W') || justPressedKeys.has('Z');
      if (key === 'DOWN') return justPressedKeys.has('ARROWDOWN') || justPressedKeys.has('S');
      if (key === 'SPACE') return justPressedKeys.has(' ');
      return justPressedKeys.has(key);
    },
    justReleased(k) {
      const key = String(k).toUpperCase();
      if (key === 'LEFT') return justReleasedKeys.has('ARROWLEFT') || justReleasedKeys.has('A') || justReleasedKeys.has('Q');
      if (key === 'RIGHT') return justReleasedKeys.has('ARROWRIGHT') || justReleasedKeys.has('D');
      if (key === 'UP') return justReleasedKeys.has('ARROWUP') || justReleasedKeys.has('W') || justReleasedKeys.has('Z');
      if (key === 'DOWN') return justReleasedKeys.has('ARROWDOWN') || justReleasedKeys.has('S');
      if (key === 'SPACE') return justReleasedKeys.has(' ');
      return justReleasedKeys.has(key);
    },
    get mouseDeltaX() { return mouseDeltaX; },
    get mouseDeltaY() { return mouseDeltaY; },
    get isPointerLocked() { return isPointerLocked; },
    requestPointerLock() {
      canvas.requestPointerLock?.();
    },
    exitPointerLock() {
      document.exitPointerLock?.();
    },
  };

  // Liste globale des instances 3D actives
  const instances = [];
  let nextInstanceId = 1;

  // Gestion de Camera
  let cameraTarget = null;
  let cameraMode = 'third-person';
  let cameraFollowOpts = { distance: 6, height: 3, pitch: 20, lerp: 0.1 };

  const gameCamera = {
    follow(target, opts = {}) {
      cameraTarget = target;
      cameraFollowOpts = { ...cameraFollowOpts, ...opts };
    },
    setMode(mode) {
      cameraMode = mode;
    },
    setFov(fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    },
    setPosition(x, y, z) {
      camera.position.set(x, y, z);
    },
    lookAt(x, y, z) {
      camera.lookAt(x, y, z);
    },
  };

  // Objet Global 'game'
  const game = {
    score: 0,
    vars: {},
    camera: gameCamera,

    spawn(objectName, x = 0, y = 0, z = 0, props = {}) {
      const objDef = objectsByName[objectName];
      if (!objDef) {
        console.warn(`Objet 3D introuvable pour spawn: ${objectName}`);
        return null;
      }
      return createInstance(objDef, x, y, z, props);
    },

    find(objectName) {
      return instances.find((i) => i.objectName === objectName && !i.destroyed) || null;
    },

    findAll(objectName) {
      return instances.filter((i) => i.objectName === objectName && !i.destroyed);
    },

    setText(id, text, x = 10, y = 10) {
      let el = hudTexts.get(id);
      if (!el) {
        el = document.createElement('div');
        el.style.position = 'absolute';
        hudContainer.appendChild(el);
        hudTexts.set(id, el);
      }
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },

    playSound(soundName, volume = 0.8, pitch = 1) {
      if (chipAudio && chipAudio.playSfx) {
        chipAudio.playSfx(soundName, volume, pitch);
      }
    },

    playSong(songName, songOpts = {}) {
      if (chipAudio && chipAudio.playSong) {
        const found = (project.songs || []).find((s) => s.name === songName);
        if (found) {
          chipAudio.playSong(found, songOpts);
        }
      }
    },

    stopSong() {
      if (chipAudio && chipAudio.stopSong) {
        chipAudio.stopSong();
      }
    },

    raycast3D(origin, dir, maxDist = 20) {
      const ray = new ThreeLib.Raycaster(
        new ThreeLib.Vector3(origin.x, origin.y, origin.z),
        new ThreeLib.Vector3(dir.x, dir.y, dir.z).normalize(),
        0,
        maxDist
      );
      const hits = ray.intersectObjects(gridGroup.children, true);
      if (hits.length > 0) {
        const h = hits[0];
        return {
          hit: true,
          point: { x: h.point.x, y: h.point.y, z: h.point.z },
          normal: h.face ? { x: h.face.normal.x, y: h.face.normal.y, z: h.face.normal.z } : { x: 0, y: 1, z: 0 },
        };
      }
      return { hit: false, point: null, normal: null };
    },

    restart() {
      destroyAllInstances();
      buildGridMap(currentScene3D.gridmap);
      spawnSceneEntities();
    },

    goToScene(sceneName) {
      const target = (project.scenes3d || []).find((s) => s.name === sceneName || s.id === sceneName);
      if (target) {
        currentScene3D = target;
        game.restart();
      }
    },
  };

  // Creation d'une instance 3D
  function createInstance(objDef, x, y, z, initialProps = {}) {
    const id = `inst_${nextInstanceId++}`;
    const handlers = {
      create: [],
      update: [],
      destroy: [],
      collide: new Map(),
      overlap: new Map(),
      overlapStart: new Map(),
      overlapEnd: new Map(),
      timer: [],
      keydown: new Map(),
    };

    function on(event, a, b) {
      if (event === 'create') handlers.create.push(a);
      else if (event === 'update') handlers.update.push(a);
      else if (event === 'destroy') handlers.destroy.push(a);
      else if (event === 'collide') {
        const target = a;
        const fn = b;
        if (!handlers.collide.has(target)) handlers.collide.set(target, []);
        handlers.collide.get(target).push(fn);
      } else if (event === 'overlap') {
        const target = a;
        const fn = b;
        if (!handlers.overlap.has(target)) handlers.overlap.set(target, []);
        handlers.overlap.get(target).push(fn);
      } else if (event === 'overlapStart') {
        const target = a;
        const fn = b;
        if (!handlers.overlapStart.has(target)) handlers.overlapStart.set(target, []);
        handlers.overlapStart.get(target).push(fn);
      } else if (event === 'overlapEnd') {
        const target = a;
        const fn = b;
        if (!handlers.overlapEnd.has(target)) handlers.overlapEnd.set(target, []);
        handlers.overlapEnd.get(target).push(fn);
      } else if (event === 'timer') {
        handlers.timer.push({ ms: a, fn: b, elapsed: 0 });
      } else if (event === 'keydown') {
        const key = String(a).toUpperCase();
        if (!handlers.keydown.has(key)) handlers.keydown.set(key, []);
        handlers.keydown.get(key).push(b);
      }
    }

    // Mesh visuel 3D
    let mesh;
    const modelDef = objDef.modelId ? modelsById[objDef.modelId] : null;

    if (modelDef && modelDef.type === 'voxel' && Array.isArray(modelDef.slices)) {
      // Modèle Voxel simple
      mesh = new ThreeLib.Group();
      const voxelSize = 0.125;
      modelDef.slices.forEach((slice, sy) => {
        if (Array.isArray(slice)) {
          slice.forEach((row, sz) => {
            for (let sx = 0; sx < row.length; sx++) {
              const char = row[sx];
              if (char !== '.' && char !== ' ') {
                const colorIdx = parseInt(char, 16) || 0;
                const vMesh = new ThreeLib.Mesh(cubeGeo, getMaterial(palette[colorIdx % palette.length]));
                vMesh.scale.set(voxelSize, voxelSize, voxelSize);
                vMesh.position.set(
                  (sx - row.length / 2) * voxelSize,
                  sy * voxelSize,
                  (sz - slice.length / 2) * voxelSize
                );
                mesh.add(vMesh);
              }
            }
          });
        }
      });
    } else {
      // Cube par défaut avec couleur de l'objet
      const colorHex = objDef.color || palette[nextInstanceId % palette.length];
      mesh = new ThreeLib.Mesh(cubeGeo, getMaterial(colorHex));
    }

    mesh.position.set(x, y, z);
    scene.add(mesh);

    // Proprietes physiques AABB
    const phys = objDef.physics || {};
    const instance = {
      id,
      objectName: objDef.name,
      mesh,
      destroyed: false,
      vars: {},
      props: { ...initialProps },

      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      width: 0.9,
      height: 0.9,
      depth: 0.9,

      gravity: phys.gravity !== false,
      immovable: !!phys.immovable,
      collideMap: phys.collideMap !== false,
      onGround: false,

      overlapping: new Set(),

      jump(force = 10) {
        if (this.onGround) {
          this.vy = force;
          this.onGround = false;
        }
      },

      moveForward(speed) {
        const rad = (this.rotationY * Math.PI) / 180;
        this.vx = -Math.sin(rad) * speed;
        this.vz = -Math.cos(rad) * speed;
      },

      moveRight(speed) {
        const rad = (this.rotationY * Math.PI) / 180;
        this.vx = Math.cos(rad) * speed;
        this.vz = -Math.sin(rad) * speed;
      },

      lookAt(tx, ty, tz) {
        const dx = tx - this.x;
        const dz = tz - this.z;
        this.rotationY = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      },

      rotateY(deg) {
        this.rotationY = (this.rotationY + deg) % 360;
      },

      play(animName) {
        // Animation voxel
      },

      destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        handlers.destroy.forEach((fn) => {
          try { fn(); } catch (e) { console.error(e); }
        });
        scene.remove(mesh);
        mesh.traverse?.((c) => {
          if (c.geometry && c.geometry !== cubeGeo) c.geometry.dispose();
        });
      },
    };

    instances.push(instance);

    // Execution du script utilisateur
    const scriptCode = objDef.script?.code || '';
    if (scriptCode.trim()) {
      try {
        const runScript = new Function('self', 'game', 'input', 'on', scriptCode);
        runScript(instance, game, input, on);
      } catch (err) {
        console.error(`Erreur d'initialisation du script de ${objDef.name} :`, err);
      }
    }

    // Declenchement de on('create')
    handlers.create.forEach((fn) => {
      try { fn(); } catch (e) { console.error(e); }
    });

    instance._handlers = handlers;
    return instance;
  }

  function destroyAllInstances() {
    [...instances].forEach((inst) => inst.destroy());
    instances.length = 0;
  }

  function spawnSceneEntities() {
    (currentScene3D.entities || []).forEach((ent) => {
      const objDef = objectsById[ent.objectId] || objectsByName[ent.objectId];
      if (objDef) {
        const inst = createInstance(objDef, ent.x || 0, ent.y || 0, ent.z || 0, ent.props || {});
        if (typeof ent.rotationY === 'number') inst.rotationY = ent.rotationY;
      }
    });

    // Si aucune entite n'est presente, instancier le premier objet ou un cube joueur
    if (instances.length === 0 && project.objects?.[0]) {
      const p = createInstance(project.objects[0], 0, 2, 0);
      gameCamera.follow(p);
    }
  }

  spawnSceneEntities();

  // Boucle Principale et Moteur Physique 3D
  let lastTime = performance.now();
  let animId = null;
  let isPaused = false;

  function updatePhysics(dt) {
    const dtSec = dt / 1000;

    for (const inst of instances) {
      if (inst.destroyed) continue;

      // Minuteries
      for (const t of inst._handlers.timer) {
        t.elapsed += dt;
        if (t.elapsed >= t.ms) {
          t.elapsed = 0;
          try { t.fn(); } catch (e) { console.error(e); }
        }
      }

      // Evenements keydown
      for (const [key, fns] of inst._handlers.keydown.entries()) {
        if (justPressedKeys.has(key)) {
          fns.forEach((fn) => {
            try { fn(); } catch (e) { console.error(e); }
          });
        }
      }

      // Gravite
      if (inst.gravity && !inst.immovable) {
        inst.vy -= gravityAccel * dtSec * 15;
      }

      // Application des vitesses
      if (!inst.immovable) {
        // Deplacement Y
        inst.y += inst.vy * dtSec;

        // Collision sol & plafond contre la GridMap
        inst.onGround = false;
        if (inst.collideMap) {
          const halfH = inst.height / 2;
          const halfW = inst.width / 2;
          const halfD = inst.depth / 2;

          // Verification du sol sous les pieds
          const checkY = Math.floor(inst.y - halfH);
          const minX = Math.floor(inst.x - halfW);
          const maxX = Math.floor(inst.x + halfW);
          const minZ = Math.floor(inst.z - halfD);
          const maxZ = Math.floor(inst.z + halfD);

          for (let bx = minX; bx <= maxX; bx++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
              if (solidBlocks.has(`${bx},${checkY},${bz}`)) {
                const blockTop = checkY + 0.5 + halfH;
                if (inst.y <= blockTop + 0.2 && inst.vy <= 0) {
                  inst.y = blockTop;
                  inst.vy = 0;
                  inst.onGround = true;
                  break;
                }
              }
            }
            if (inst.onGround) break;
          }
        }

        // Deplacement X et Z
        inst.x += inst.vx * dtSec;
        inst.z += inst.vz * dtSec;

        // Limite de chute
        if (inst.y < -30) {
          game.restart();
          return;
        }
      }

      // Mise a jour du Mesh Three.js
      inst.mesh.position.set(inst.x, inst.y, inst.z);
      inst.mesh.rotation.y = (inst.rotationY * Math.PI) / 180;

      // Appel de on('update')
      for (const fn of inst._handlers.update) {
        try { fn(dt); } catch (e) { console.error(e); }
      }
    }

    // Gestion des collisions et overlaps entre entites (AABB 3D)
    for (let i = 0; i < instances.length; i++) {
      const a = instances[i];
      if (a.destroyed) continue;

      for (let j = i + 1; j < instances.length; j++) {
        const b = instances[j];
        if (b.destroyed) continue;

        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const dz = Math.abs(a.z - b.z);

        const touchX = dx < (a.width + b.width) / 2;
        const touchY = dy < (a.height + b.height) / 2;
        const touchZ = dz < (a.depth + b.depth) / 2;

        if (touchX && touchY && touchZ) {
          // Overlap A -> B
          if (a._handlers.overlap.has(b.objectName)) {
            a._handlers.overlap.get(b.objectName).forEach((fn) => {
              try { fn(b); } catch (e) { console.error(e); }
            });
          }
          // Overlap B -> A
          if (b._handlers.overlap.has(a.objectName)) {
            b._handlers.overlap.get(a.objectName).forEach((fn) => {
              try { fn(a); } catch (e) { console.error(e); }
            });
          }

          // OverlapStart
          if (!a.overlapping.has(b.id)) {
            a.overlapping.add(b.id);
            a._handlers.overlapStart.get(b.objectName)?.forEach((fn) => {
              try { fn(b); } catch (e) { console.error(e); }
            });
          }
          if (!b.overlapping.has(a.id)) {
            b.overlapping.add(a.id);
            b._handlers.overlapStart.get(a.objectName)?.forEach((fn) => {
              try { fn(a); } catch (e) { console.error(e); }
            });
          }

          // Collide physique solide
          if (a._handlers.collide.has(b.objectName) || b._handlers.collide.has(a.objectName)) {
            a._handlers.collide.get(b.objectName)?.forEach((fn) => {
              try { fn(b); } catch (e) { console.error(e); }
            });
            b._handlers.collide.get(a.objectName)?.forEach((fn) => {
              try { fn(a); } catch (e) { console.error(e); }
            });
          }
        } else {
          // Fin de chevauchement (OverlapEnd)
          if (a.overlapping.has(b.id)) {
            a.overlapping.delete(b.id);
            a._handlers.overlapEnd.get(b.objectName)?.forEach((fn) => {
              try { fn(b); } catch (e) { console.error(e); }
            });
          }
          if (b.overlapping.has(a.id)) {
            b.overlapping.delete(a.id);
            b._handlers.overlapEnd.get(a.objectName)?.forEach((fn) => {
              try { fn(a); } catch (e) { console.error(e); }
            });
          }
        }
      }
    }

    // Suivi de la camera
    if (cameraTarget && !cameraTarget.destroyed) {
      if (cameraMode === 'third-person') {
        const dist = cameraFollowOpts.distance || 6;
        const h = cameraFollowOpts.height || 3;
        const rad = (cameraTarget.rotationY * Math.PI) / 180;

        let targetCamX = cameraTarget.x + Math.sin(rad) * dist;
        let targetCamY = cameraTarget.y + h;
        let targetCamZ = cameraTarget.z + Math.cos(rad) * dist;

        // Anti-occlusion murale : tester si un bloc solide est entre la cible et la camera
        const fromX = cameraTarget.x;
        const fromY = cameraTarget.y + 0.8;
        const fromZ = cameraTarget.z;
        const dx = targetCamX - fromX;
        const dy = targetCamY - fromY;
        const dz = targetCamZ - fromZ;
        const totalDist = Math.hypot(dx, dy, dz);
        const steps = Math.ceil(totalDist * 6);
        for (let s = 1; s <= steps; s++) {
          const testX = Math.floor(fromX + (dx * s) / steps);
          const testY = Math.floor(fromY + (dy * s) / steps);
          const testZ = Math.floor(fromZ + (dz * s) / steps);
          if (solidBlocks.has(`${testX},${testY},${testZ}`)) {
            const safeFraction = Math.max(0.3, (s - 1.2) / steps);
            targetCamX = fromX + dx * safeFraction;
            targetCamY = fromY + dy * safeFraction;
            targetCamZ = fromZ + dz * safeFraction;
            break;
          }
        }

        const lerpFactor = cameraFollowOpts.lerp || 0.1;
        camera.position.x += (targetCamX - camera.position.x) * lerpFactor;
        camera.position.y += (targetCamY - camera.position.y) * lerpFactor;
        camera.position.z += (targetCamZ - camera.position.z) * lerpFactor;
        camera.lookAt(cameraTarget.x, cameraTarget.y + 0.8, cameraTarget.z);
      } else if (cameraMode === 'first-person') {
        camera.position.set(cameraTarget.x, cameraTarget.y + 0.7, cameraTarget.z);
        const rad = (cameraTarget.rotationY * Math.PI) / 180;
        camera.lookAt(
          cameraTarget.x - Math.sin(rad) * 10,
          cameraTarget.y + 0.7,
          cameraTarget.z - Math.cos(rad) * 10
        );
      } else if (cameraMode === 'top-down') {
        camera.position.set(cameraTarget.x, cameraTarget.y + 12, cameraTarget.z + 4);
        camera.lookAt(cameraTarget.x, cameraTarget.y, cameraTarget.z);
      } else if (cameraMode === 'isometric') {
        const isoDist = (cameraFollowOpts.distance || 6) * 1.5;
        const targetCamX = cameraTarget.x + isoDist;
        const targetCamY = cameraTarget.y + isoDist * 0.9;
        const targetCamZ = cameraTarget.z + isoDist;
        const lerpFactor = cameraFollowOpts.lerp || 0.1;
        camera.position.x += (targetCamX - camera.position.x) * lerpFactor;
        camera.position.y += (targetCamY - camera.position.y) * lerpFactor;
        camera.position.z += (targetCamZ - camera.position.z) * lerpFactor;
        camera.lookAt(cameraTarget.x, cameraTarget.y + 0.5, cameraTarget.z);
      } else if (cameraMode === 'side-scroll') {
        const dist = cameraFollowOpts.distance || 8;
        const h = cameraFollowOpts.height || 2;
        const targetCamX = cameraTarget.x;
        const targetCamY = cameraTarget.y + h;
        const targetCamZ = cameraTarget.z + dist;
        const lerpFactor = cameraFollowOpts.lerp || 0.1;
        camera.position.x += (targetCamX - camera.position.x) * lerpFactor;
        camera.position.y += (targetCamY - camera.position.y) * lerpFactor;
        camera.position.z += (targetCamZ - camera.position.z) * lerpFactor;
        camera.lookAt(cameraTarget.x, cameraTarget.y + h, cameraTarget.z);
      }
  }

  function loop(now) {
    animId = requestAnimationFrame(loop);
    if (isPaused) return;

    const dt = Math.min(now - lastTime, 100);
    lastTime = now;

    updatePhysics(dt);
    renderer.render(scene, camera);

    // Reinitialisation des flags par frame
    justPressedKeys.clear();
    justReleasedKeys.clear();
    mouseDeltaX = 0;
    mouseDeltaY = 0;
  }

  animId = requestAnimationFrame(loop);

  return {
    destroy() {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      destroyAllInstances();
      renderer.dispose();
      cubeGeo.dispose();
      materialCache.forEach((m) => m.dispose());
      wrapper.remove();
    },

    pause() { isPaused = true; },
    resume() { isPaused = false; lastTime = performance.now(); },
    restart() { game.restart(); },
    game,
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createGame3D = createGame3D;
}
