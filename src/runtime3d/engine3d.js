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
  // Gravite 3D en blocs/s² : settings.gravity3d, sinon deduite de la gravite 2D (800 -> 30).
  // jump(8) monte d'environ 1 bloc, jump(12) d'environ 2,4 blocs.
  const gravityAccel = typeof settings.gravity3d === 'number' ? settings.gravity3d
    : typeof settings.gravity === 'number' ? (settings.gravity / 800) * 30 : 30;

  const log = (msg, level = 'error') => {
    if (opts.onLog) { try { opts.onLog(msg, level); } catch (e) { /* ignore */ } }
    if (level === 'error') console.error(msg); else console.log(msg);
  };
  const errMsg = (e) => (e && e.message) || String(e);

  const useRapier = settings.physics3d === 'rapier';
  const Rapier = opts.rapier || (typeof globalThis !== 'undefined' ? globalThis.RAPIER : null);
  if (useRapier && !Rapier) {
    log('Physique Rapier 3D demandee mais la bibliotheque Rapier n\'est pas disponible. Repli sur le moteur AABB simple.', 'warn');
  }
  if (typeof window !== 'undefined' && !window.performance && typeof performance !== 'undefined') {
    try { window.performance = performance; } catch (e) { /* ignore */ }
  }

  // Audio chiptune : contexte cree a la demande, debloque au premier geste (regle des navigateurs)
  const chipFactory = opts.createChipAudio
    || (typeof opts.chip === 'function' ? opts.chip : null)
    || (typeof globalThis !== 'undefined' && typeof globalThis.createChipAudio === 'function' ? globalThis.createChipAudio : null);
  let audioCtx = null;
  let chipAudio = opts.chip && typeof opts.chip === 'object' ? opts.chip : null;
  function getChip() {
    if (chipAudio) {
      if (audioCtx && audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) { /* ignore */ } }
      return chipAudio;
    }
    if (!chipFactory) return null;
    const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return null;
    try {
      audioCtx = new AudioCtx();
      const master = audioCtx.createGain();
      master.gain.value = 0.6;
      master.connect(audioCtx.destination);
      chipAudio = chipFactory(audioCtx, master);
      if (audioCtx.state !== 'running') audioCtx.resume();
    } catch (e) {
      log('Audio 3D non initialise : ' + errMsg(e), 'warn');
      chipAudio = null;
    }
    return chipAudio;
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
  const camera = new ThreeLib.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 5, 10);

  const renderer = new ThreeLib.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);

  // Lumieres (couleurs et intensites appliquees par applyEnvironment selon la scene)
  const ambientLight = new ThreeLib.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new ThreeLib.DirectionalLight(0xffeedd, 0.9);
  scene.add(dirLight);

  const dynamicLightGroup = new ThreeLib.Group();
  scene.add(dynamicLightGroup);

  const debugColliderGroup = new ThreeLib.Group();
  debugColliderGroup.visible = false;
  scene.add(debugColliderGroup);

  let showDebugColliders = false;
  const wireframeCubeGeo = typeof ThreeLib.BoxGeometry === 'function' ? new ThreeLib.BoxGeometry(1, 1, 1) : null;
  const blockWireMat = typeof ThreeLib.MeshBasicMaterial === 'function' ? new ThreeLib.MeshBasicMaterial({ color: 0x38b764, wireframe: true }) : null;
  const entityWireMat = typeof ThreeLib.MeshBasicMaterial === 'function' ? new ThreeLib.MeshBasicMaterial({ color: 0xffcd75, wireframe: true }) : null;

  function updateDebugColliders() {
    if (!showDebugColliders || !wireframeCubeGeo) {
      debugColliderGroup.visible = false;
      return;
    }
    debugColliderGroup.visible = true;
    while (debugColliderGroup.children.length > 0) {
      debugColliderGroup.remove(debugColliderGroup.children[0]);
    }

    for (const { x, y, z } of solidBlocks.values()) {
      const m = new ThreeLib.Mesh(wireframeCubeGeo, blockWireMat);
      m.position.set(x, y, z);
      debugColliderGroup.add(m);
    }

    for (const inst of instances) {
      if (inst.destroyed) continue;
      const m = new ThreeLib.Mesh(wireframeCubeGeo, entityWireMat);
      m.position.set(inst.x, inst.y, inst.z);
      if (m.scale?.set) {
        m.scale.set(inst.width || 1, inst.height || 1, inst.depth || 1);
      }
      debugColliderGroup.add(m);
    }
  }

  // Ambiance : celle de la scene 3D, sinon celle du projet (anciens fichiers)
  // Developpement des prefabs (kind === 'prefab') sans import externe
  function expandPrefabNodes(nodes, prefabs3d) {
    const res = [];
    const pfbMap = new Map();
    for (const p of prefabs3d || []) {
      if (p && p.id) pfbMap.set(p.id, p);
      if (p && p.name) pfbMap.set(p.name, p);
    }
    for (const n of nodes || []) {
      if (n.kind === 'prefab') {
        const pfb = pfbMap.get(n.prefabId);
        if (pfb && Array.isArray(pfb.nodes)) {
          const rootPos = Array.isArray(n.position) ? n.position : [0, 0, 0];
          const rootRot = Array.isArray(n.rotation) ? n.rotation : [0, 0, 0];
          const rootScl = Array.isArray(n.scale) ? n.scale : [1, 1, 1];
          for (const c of pfb.nodes) {
            const cp = Array.isArray(c.position) ? c.position : [0, 0, 0];
            const cr = Array.isArray(c.rotation) ? c.rotation : [0, 0, 0];
            const cs = Array.isArray(c.scale) ? c.scale : [1, 1, 1];
            res.push({
              ...c,
              id: `${n.id}_${c.id}`,
              name: `${n.name}/${c.name}`,
              position: [
                rootPos[0] + cp[0] * rootScl[0],
                rootPos[1] + cp[1] * rootScl[1],
                rootPos[2] + cp[2] * rootScl[2],
              ],
              rotation: [rootRot[0] + cr[0], rootRot[1] + cr[1], rootRot[2] + cr[2]],
              scale: [rootScl[0] * cs[0], rootScl[1] * cs[1], rootScl[2] * cs[2]],
              visible: n.visible !== false && c.visible !== false,
            });
          }
          continue;
        }
      }
      res.push(n);
    }
    return res;
  }

  function applyEnvironment(sc) {
    const env = (sc && sc.environment) || project.environment || {};
    const bgColor = env.skyColor || settings.background || '#1a1c2c';

    // Ciel degrade (skyGradient) ou couleur unie
    if (env.skyGradient?.enabled && typeof document !== 'undefined' && typeof ThreeLib.CanvasTexture === 'function') {
      try {
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 2;
        skyCanvas.height = 256;
        const ctx2d = skyCanvas.getContext('2d');
        if (ctx2d) {
          const grad = ctx2d.createLinearGradient(0, 0, 0, 256);
          grad.addColorStop(0, env.skyGradient.topColor || '#0d0f18');
          grad.addColorStop(1, env.skyGradient.bottomColor || env.horizonColor || '#29366f');
          ctx2d.fillStyle = grad;
          ctx2d.fillRect(0, 0, 2, 256);
          const skyTex = new ThreeLib.CanvasTexture(skyCanvas);
          scene.background = skyTex;
        } else {
          scene.background = new ThreeLib.Color(bgColor);
        }
      } catch (e) {
        scene.background = new ThreeLib.Color(bgColor);
      }
    } else {
      scene.background = new ThreeLib.Color(bgColor);
    }

    // Brouillard (lineaire ou exponentiel)
    if (env.fog?.enabled) {
      const fogColor = env.fog.color || bgColor;
      if (env.fog.type === 'linear' && typeof ThreeLib.Fog === 'function') {
        scene.fog = new ThreeLib.Fog(fogColor, env.fog.near || 10, env.fog.far || 50);
      } else if (typeof ThreeLib.FogExp2 === 'function') {
        scene.fog = new ThreeLib.FogExp2(fogColor, env.fog.density || 0.04);
      }
    } else {
      scene.fog = null;
    }

    ambientLight.color.set(env.ambientLight?.color || '#ffffff');
    ambientLight.intensity = env.ambientLight?.intensity ?? 0.7;
    dirLight.color.set(env.directionalLight?.color || '#ffeedd');
    dirLight.intensity = env.directionalLight?.intensity ?? 0.9;
    const dirPos = env.directionalLight?.position || [10, 20, 15];
    dirLight.position.set(dirPos[0], dirPos[1], dirPos[2]);

    // Ombres portees directionnelles
    const shadowsEnabled = !!(env.directionalLight?.castShadow || env.shadows?.enabled);
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = shadowsEnabled;
      if (shadowsEnabled && ThreeLib.PCFSoftShadowMap) {
        renderer.shadowMap.type = ThreeLib.PCFSoftShadowMap;
      }
    }
    if (dirLight.shadow) {
      dirLight.castShadow = shadowsEnabled;
      if (shadowsEnabled) {
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;
        const d = 30;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
      }
    }

    // Lumieres ponctuelles et projecteurs (4 max en mode retro)
    while (dynamicLightGroup.children.length > 0) {
      dynamicLightGroup.remove(dynamicLightGroup.children[0]);
    }

    const allNodes = expandPrefabNodes(sc?.nodes || [], project?.prefabs3d || []);
    const lightNodes = allNodes.filter((n) => n.kind === 'light' && n.visible !== false).slice(0, 4);
    lightNodes.forEach((ln) => {
      const lp = ln.props || {};
      const pos = Array.isArray(ln.position) ? ln.position : [0, 2, 0];
      const lColor = lp.color || '#ffcd75';
      const lIntensity = typeof lp.intensity === 'number' ? lp.intensity : 1.5;
      const lDist = typeof lp.distance === 'number' ? lp.distance : 12;
      const lDecay = typeof lp.decay === 'number' ? lp.decay : 2;

      let lObj = null;
      if (lp.lightType === 'spot' && typeof ThreeLib.SpotLight === 'function') {
        const angleRad = ((lp.angle || 45) * Math.PI) / 180;
        const penumbra = lp.penumbra != null ? lp.penumbra : 0.2;
        lObj = new ThreeLib.SpotLight(lColor, lIntensity, lDist, angleRad, penumbra, lDecay);
        lObj.position.set(pos[0], pos[1], pos[2]);
        if (lp.castShadow && lObj.shadow) {
          lObj.castShadow = true;
          lObj.shadow.mapSize.width = 512;
          lObj.shadow.mapSize.height = 512;
        }
        dynamicLightGroup.add(lObj);
        if (lObj.target) dynamicLightGroup.add(lObj.target);
      } else if (typeof ThreeLib.PointLight === 'function') {
        lObj = new ThreeLib.PointLight(lColor, lIntensity, lDist, lDecay);
        lObj.position.set(pos[0], pos[1], pos[2]);
        if (lp.castShadow && lObj.shadow) {
          lObj.castShadow = true;
          lObj.shadow.mapSize.width = 512;
          lObj.shadow.mapSize.height = 512;
        }
        dynamicLightGroup.add(lObj);
      }
    });
  }

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

  // Scene 3D active : opts.startScene3DId (test d'une scene), sinon settings.startScene3DId, sinon la premiere
  const scenes3d = project.scenes3d || [];
  let currentScene3D = scenes3d.find((s) => s.id === opts.startScene3DId)
    || scenes3d.find((s) => s.id === settings.startScene3DId) || scenes3d[0] || {
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

  const GLTFLoaderClass = opts.GLTFLoader || ThreeLib.GLTFLoader || (typeof globalThis !== 'undefined' ? globalThis.GLTFLoader : null);

  // Cache des textures creees a partir des sprites du projet (filtre nearest pour le pixel art)
  const textureCache = new Map();
  function getSpriteTexture(spriteId) {
    if (!spriteId) return null;
    if (textureCache.has(spriteId)) return textureCache.get(spriteId);
    const spr = (project.sprites || []).find((s) => s.id === spriteId);
    if (!spr || !spr.frames?.[0]) {
      textureCache.set(spriteId, null);
      return null;
    }
    const dataUrl = spr.frames[0];
    let tex = null;
    try {
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.src = dataUrl;
        tex = new ThreeLib.Texture(img);
        img.onload = () => { tex.needsUpdate = true; };
      } else {
        tex = new ThreeLib.Texture();
      }
      tex.magFilter = ThreeLib.NearestFilter;
      tex.minFilter = ThreeLib.NearestFilter;
      if (ThreeLib.SRGBColorSpace) tex.colorSpace = ThreeLib.SRGBColorSpace;
    } catch {
      tex = null;
    }
    textureCache.set(spriteId, tex);
    return tex;
  }

  // Materiaux personnalises (project.materials[])
  const projectMaterialsById = new Map();
  function buildProjectMaterial(matDef) {
    if (!matDef) return null;
    if (projectMaterialsById.has(matDef.id)) return projectMaterialsById.get(matDef.id);

    const tex = matDef.textureSpriteId ? getSpriteTexture(matDef.textureSpriteId) : null;
    const type = matDef.type || 'standard';
    const color = matDef.color || '#ffffff';
    const transparent = !!matDef.transparent || (typeof matDef.opacity === 'number' && matDef.opacity < 1);
    const opacity = typeof matDef.opacity === 'number' ? matDef.opacity : 1.0;
    const side = matDef.doubleSided ? ThreeLib.DoubleSide : ThreeLib.FrontSide;

    let mat;
    if (type === 'unlit') {
      mat = new ThreeLib.MeshBasicMaterial({
        color,
        map: tex,
        transparent,
        opacity,
        side,
      });
    } else if (type === 'toon') {
      mat = new ThreeLib.MeshToonMaterial({
        color,
        map: tex,
        transparent,
        opacity,
        side,
      });
    } else {
      mat = new ThreeLib.MeshStandardMaterial({
        color,
        map: tex,
        roughness: typeof matDef.roughness === 'number' ? matDef.roughness : 0.8,
        metalness: typeof matDef.metalness === 'number' ? matDef.metalness : 0.1,
        emissive: matDef.emissive || '#000000',
        transparent,
        opacity,
        side,
      });
    }

    projectMaterialsById.set(matDef.id, mat);
    return mat;
  }

  (project.materials || []).forEach((m) => {
    buildProjectMaterial(m);
  });

  // Cache et parseur glTF
  const gltfCache = new Map();
  const activeMixers = new Set();

  function parseGltfData(modelDef, onLoaded) {
    if (!modelDef) return;
    const id = modelDef.id;
    if (gltfCache.has(id)) {
      if (onLoaded) onLoaded(gltfCache.get(id));
      return;
    }
    if (!GLTFLoaderClass) {
      log('Chargeur GLTFLoader non disponible.', 'warn');
      return;
    }
    const dataUrl = modelDef.gltfData || modelDef.dataUrl;
    if (!dataUrl) return;

    try {
      const loader = new GLTFLoaderClass();
      const commaIdx = dataUrl.indexOf(',');
      let bufferOrString;
      if (commaIdx !== -1) {
        const header = dataUrl.slice(0, commaIdx);
        const raw = dataUrl.slice(commaIdx + 1);
        if (header.includes(';base64')) {
          if (typeof Buffer !== 'undefined') {
            const b = Buffer.from(raw, 'base64');
            bufferOrString = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
          } else {
            const bin = atob(raw);
            const len = bin.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
            bufferOrString = bytes.buffer;
          }
        } else {
          bufferOrString = decodeURIComponent(raw);
        }
      } else {
        bufferOrString = dataUrl;
      }

      loader.parse(bufferOrString, '', (gltf) => {
        gltfCache.set(id, gltf);
        if (onLoaded) onLoaded(gltf);
      }, (err) => {
        log(`Erreur de chargement du modele glTF « ${modelDef.name} » : ${errMsg(err)}`, 'error');
      });
    } catch (err) {
      log(`Erreur de preparation du modele glTF « ${modelDef.name} » : ${errMsg(err)}`, 'error');
    }
  }

  (project.models || []).forEach((m) => {
    if (m.type === 'gltf') parseGltfData(m);
  });

  // Couleur d'un bloc ou d'un voxel : index de palette (nombre ou chiffre hexa), '#rrggbb' ou {colorIndex}
  function resolveColor(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return palette[((v % palette.length) + palette.length) % palette.length];
    if (typeof v === 'string') {
      if (v.charAt(0) === '#') return v;
      const n = parseInt(v, 16);
      if (Number.isFinite(n)) return palette[n % palette.length];
    }
    if (v && typeof v === 'object' && Number.isFinite(v.colorIndex)) return palette[v.colorIndex % palette.length];
    return palette[6];
  }

  // Blocs de la grille : format { blockSize, blocks: { "x,y,z": couleur } } (ancien format plat accepte)
  function gridBlocks(gridmapData) {
    if (!gridmapData || typeof gridmapData !== 'object') return null;
    if (gridmapData.blocks && typeof gridmapData.blocks === 'object') return gridmapData.blocks;
    return gridmapData;
  }

  // Stockage des blocs solides pour la physique AABB et Rapier.
  // Un bloc de cle "x,y,z" est un cube centre sur (x, y, z) : il occupe [x-0.5, x+0.5] sur chaque axe.
  const solidBlocks = new Map(); // "x,y,z" => { x, y, z }
  const cellOf = (v) => Math.floor(v + 0.5);

  let rapierWorld = null;
  let rapierEventQueue = null;
  let groundBody = null;
  const colliderToInstance = new Map();

  function initPhysicsWorld() {
    if (rapierWorld) {
      try { rapierWorld.free(); } catch (e) { /* ignore */ }
      rapierWorld = null;
    }
    colliderToInstance.clear();

    if (useRapier && Rapier) {
      rapierWorld = new Rapier.World({ x: 0, y: -gravityAccel, z: 0 });
      rapierEventQueue = new Rapier.EventQueue(true);
      groundBody = rapierWorld.createRigidBody(Rapier.RigidBodyDesc.fixed());
      for (const { x, y, z } of solidBlocks.values()) {
        const colDesc = Rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5)
          .setTranslation(x, y, z)
          .setFriction(0.6)
          .setRestitution(0);
        rapierWorld.createCollider(colDesc, groundBody);
      }
    }
  }

  function buildGridMap(gridmapRaw) {
    const gridmapData = gridBlocks(gridmapRaw);
    // Nettoyer l'ancienne grille
    while (gridGroup.children.length > 0) {
      gridGroup.remove(gridGroup.children[0]);
    }
    solidBlocks.clear();

    const renderGroups = new Map();
    function addRenderBlock(x, y, z, colorHex) {
      let list = renderGroups.get(colorHex);
      if (!list) {
        list = [];
        renderGroups.set(colorHex, list);
      }
      list.push({ x, y, z });
    }

    if (!gridmapData && (!currentScene3D.terrain || currentScene3D.terrain.enabled === false)) {
      // Si aucune grille specifiee ni terrain, generer un sol par defaut de 21x21 blocs a Y = -1
      for (let x = -10; x <= 10; x++) {
        for (let z = -10; z <= 10; z++) {
          const colorHex = (Math.abs(x) + Math.abs(z)) % 2 === 0 ? palette[8] : palette[14];
          addRenderBlock(x, -1, z, colorHex);
          solidBlocks.set(`${x},-1,${z}`, { x, y: -1, z });
        }
      }
    } else {
      if (gridmapData) {
        Object.entries(gridmapData).forEach(([coordStr, blockInfo]) => {
          const parts = coordStr.split(',').map((v) => Number(v));
          if (parts.length !== 3 || !parts.every(Number.isInteger)) return;
          if (blockInfo == null || blockInfo === '.') return;
          const [bx, by, bz] = parts;
          const colHex = resolveColor(blockInfo);
          addRenderBlock(bx, by, bz, colHex);
          solidBlocks.set(`${bx},${by},${bz}`, { x: bx, y: by, z: bz });
        });
      }

      // Blocs solides et relief du terrain sculpte
      const ter = currentScene3D.terrain;
      if (ter && ter.enabled !== false) {
        const minX = typeof ter.originX === 'number' ? ter.originX : -16;
        const maxX = minX + (ter.width || 32) - 1;
        const minZ = typeof ter.originZ === 'number' ? ter.originZ : -16;
        const maxZ = minZ + (ter.depth || 32) - 1;
        const defaultH = typeof ter.defaultHeight === 'number' ? ter.defaultHeight : 0;
        const defaultCol = ter.defaultColor != null ? ter.defaultColor : 6;
        const heights = ter.heights || {};
        const colors = ter.colors || {};

        const cols = new Set();
        for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) {
            cols.add(`${x},${z}`);
          }
        }
        for (const k of Object.keys(heights)) cols.add(k);
        for (const k of Object.keys(colors)) cols.add(k);

        for (const k of cols) {
          const parts = k.split(',').map((v) => parseInt(v, 10));
          if (parts.length !== 2) continue;
          const [tx, tz] = parts;
          const h = heights[k] !== undefined ? heights[k] : defaultH;
          const topY = Math.round(h);
          const colVal = colors[k] !== undefined ? colors[k] : defaultCol;
          const colHex = resolveColor(colVal);

          const minY = -2;
          const base = Math.min(minY, topY);
          for (let ty = base; ty <= topY; ty++) {
            const key = `${tx},${ty},${tz}`;
            if (!solidBlocks.has(key)) {
              solidBlocks.set(key, { x: tx, y: ty, z: tz });
              if (ty === topY) {
                addRenderBlock(tx, ty, tz, colHex);
              }
            }
          }
        }
      }
    }

    // Instanciation groupee (InstancedMesh ou repli Mesh)
    if (typeof ThreeLib.InstancedMesh === 'function' && typeof ThreeLib.Matrix4 === 'function') {
      const dummyMat = new ThreeLib.Matrix4();
      const dummyPos = typeof ThreeLib.Vector3 === 'function' ? new ThreeLib.Vector3() : null;
      for (const [colorHex, list] of renderGroups.entries()) {
        const instMesh = new ThreeLib.InstancedMesh(cubeGeo, getMaterial(colorHex), list.length);
        instMesh.castShadow = true;
        instMesh.receiveShadow = true;
        for (let i = 0; i < list.length; i++) {
          if (dummyPos) {
            dummyPos.set(list[i].x, list[i].y, list[i].z);
            dummyMat.identity();
            dummyMat.setPosition(dummyPos);
          }
          instMesh.setMatrixAt(i, dummyMat);
        }
        instMesh.count = list.length;
        if (instMesh.instanceMatrix) instMesh.instanceMatrix.needsUpdate = true;
        gridGroup.add(instMesh);
      }
    } else {
      for (const [colorHex, list] of renderGroups.entries()) {
        const mat = getMaterial(colorHex);
        for (const item of list) {
          const mesh = new ThreeLib.Mesh(cubeGeo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(item.x, item.y, item.z);
          gridGroup.add(mesh);
        }
      }
    }

    initPhysicsWorld();
  }

  applyEnvironment(currentScene3D);

  buildGridMap(currentScene3D.gridmap);

  // Gestion des Entrees (Input)
  const pressedKeys = new Set();
  const justPressedKeys = new Set();
  const justReleasedKeys = new Set();
  let mouseDeltaX = 0;
  let mouseDeltaY = 0;
  let isPointerLocked = false;

  // Les touches sont stockees par e.key en majuscules (' ', 'ARROWLEFT', 'A'...)
  function isTypingTarget(t) {
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  function onKeyDown(e) {
    if (isTypingTarget(e.target)) return;
    const k = e.key.toUpperCase();
    if (!pressedKeys.has(k)) {
      justPressedKeys.add(k);
    }
    pressedKeys.add(k);
    // Gestion fleches & espace
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const k = e.key.toUpperCase();
    pressedKeys.delete(k);
    justReleasedKeys.add(k);
  }

  // Une touche relachee pendant que la fenetre n'a pas le focus ne doit pas rester enfoncee
  function onBlur() {
    pressedKeys.clear();
  }

  // Premier geste : debloque l'audio
  function onGesture() {
    if (audioCtx && audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) { /* ignore */ } }
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
  window.addEventListener('blur', onBlur);
  window.addEventListener('pointerdown', onGesture);
  window.addEventListener('keydown', onGesture);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  function onCanvasClick() {
    canvas.focus();
  }
  canvas.addEventListener('click', onCanvasClick);

  // Noms logiques (LEFT, SPACE...) -> touches reelles ; flèches + ZQSD/WASD
  const KEY_ALIASES = {
    LEFT: ['ARROWLEFT', 'A', 'Q'],
    RIGHT: ['ARROWRIGHT', 'D'],
    UP: ['ARROWUP', 'W', 'Z'],
    DOWN: ['ARROWDOWN', 'S'],
    SPACE: [' '],
    ENTER: ['ENTER'],
    SHIFT: ['SHIFT'],
    ESC: ['ESCAPE'],
  };
  const keyIn = (set, k) => {
    const key = String(k).toUpperCase();
    const keys = KEY_ALIASES[key];
    return keys ? keys.some((x) => set.has(x)) : set.has(key);
  };

  const input = {
    isDown(k) { return keyIn(pressedKeys, k); },
    justPressed(k) { return keyIn(justPressedKeys, k); },
    justReleased(k) { return keyIn(justReleasedKeys, k); },
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
  let pendingScene = null;
  let gamePaused = false;
  let activeSongCtrl = null;
  const waits = [];
  const saveKey = (k) => 'pixelforge:' + ((project.meta && project.meta.id) || 'game') + ':' + k;

  // Temps forts de la musique -> on('beat')
  function dispatchBeat(b) {
    for (const inst of instances.slice()) {
      if (!inst.destroyed) callHandlers(inst, inst._handlers.beat, [b], 'beat');
    }
  }

  function applyPlayFromCamera() {
    let targetPos = null;
    if (Array.isArray(opts.spawnPlayerPosition) && opts.spawnPlayerPosition.length === 3) {
      targetPos = opts.spawnPlayerPosition;
    } else if (opts.playFromCamera) {
      if (Array.isArray(opts.playFromCamera.target)) {
        targetPos = [opts.playFromCamera.target[0], opts.playFromCamera.target[1] + 1, opts.playFromCamera.target[2]];
      } else if (Array.isArray(opts.playFromCamera.position)) {
        targetPos = [opts.playFromCamera.position[0], opts.playFromCamera.position[1], opts.playFromCamera.position[2]];
      }
    }

    if (targetPos) {
      const playerInst = instances.find((i) => /^player\b/i.test(i.objectName) || /player/i.test(i.objectName)) || instances[0];
      if (playerInst) {
        playerInst.setPosition(targetPos[0], targetPos[1], targetPos[2]);
        playerInst.vx = 0;
        playerInst.vy = 0;
        playerInst.vz = 0;
      }
      if (opts.playFromCamera && Array.isArray(opts.playFromCamera.position)) {
        camera.position.set(opts.playFromCamera.position[0], opts.playFromCamera.position[1], opts.playFromCamera.position[2]);
      }
    }
  }

  function loadScene(sc) {
    currentScene3D = sc;
    waits.length = 0;
    destroyAllInstances();
    applyEnvironment(currentScene3D);
    buildGridMap(currentScene3D.gridmap);
    spawnSceneEntities();
    applyPlayFromCamera();
    if (showDebugColliders) updateDebugColliders();
  }

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

    // Meme resolution qu'en 2D : son du projet (sfxr ou preset), sinon nom de preset
    playSound(soundName, volume = 1, pitch = 1) {
      try {
        const chip = getChip();
        if (!chip || !chip.playSfx) return;
        const vol = Number.isFinite(volume) ? volume : 1;
        const pit = Number.isFinite(pitch) && pitch > 0 ? pitch : 1;
        const snd = (project.sounds || []).find((s) => s.name === soundName || s.id === soundName);
        const sfx = snd && snd.sfx;
        if (sfx && sfx.params) {
          chip.playSfx({ params: sfx.params, volume: (Number.isFinite(sfx.volume) ? sfx.volume : 0.5) * vol, pitch: (sfx.pitch || 1) * pit });
        } else if (sfx) {
          chip.playSfx(sfx.preset || 'blip', sfx.seed || 0, (Number.isFinite(sfx.volume) ? sfx.volume : 0.5) * vol, (sfx.pitch || 1) * pit);
        } else {
          chip.playSfx(String(soundName), 0, 0.5 * vol, pit);
        }
      } catch (e) {
        log('game.playSound : ' + errMsg(e));
      }
    },

    playSong(songName, songOpts = {}) {
      const chip = getChip();
      if (!chip || !chip.playSong) return null;
      const found = (project.songs || []).find((s) => s.name === songName || s.id === songName);
      if (!found) {
        log('game.playSong : morceau inconnu « ' + songName + ' »', 'warn');
        return null;
      }
      const userBeat = songOpts && songOpts.onBeat;
      activeSongCtrl = chip.playSong(found, {
        ...(songOpts || {}),
        onBeat: (b) => {
          if (userBeat) { try { userBeat(b); } catch (e) { log('onBeat : ' + errMsg(e)); } }
          dispatchBeat(b);
        },
      });
      return activeSongCtrl;
    },

    stopSong() {
      activeSongCtrl = null;
      if (chipAudio && chipAudio.stopSong) {
        chipAudio.stopSong();
      }
    },

    // Musique : un morceau du projet, sinon le son du meme nom
    playMusic(name) {
      if ((project.songs || []).some((s) => s.name === name || s.id === name)) game.playSong(name, { loop: true });
      else game.playSound(name);
    },
    stopMusic() { game.stopSong(); },
    setSongVolume(v) { if (activeSongCtrl && activeSongCtrl.setVolume) activeSongCtrl.setVolume(v); },

    countOf(objectName) {
      return instances.filter((i) => i.objectName === objectName && !i.destroyed).length;
    },

    removeText(id) {
      const el = hudTexts.get(id);
      if (el) { el.remove(); hudTexts.delete(id); }
    },

    random(min, max) {
      if (max === undefined) { max = min; min = 0; }
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    log(...args) {
      log(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '), 'info');
    },

    // Messages entre objets : diffuses a tous les on('message', nom, fn)
    broadcast(name, data) {
      const n = String(name);
      for (const inst of instances.slice()) {
        if (inst.destroyed) continue;
        for (const h of inst._handlers.message) {
          if (h.name === n) callHandlers(inst, [h.fn], [data], 'message ' + n);
        }
      }
    },

    // Attente (en temps de jeu : suspendue pendant la pause, annulee au changement de scene)
    wait(ms, fn) {
      if (typeof fn !== 'function') { log('game.wait : le 2e argument doit etre une fonction'); return null; }
      const w = { remaining: Math.max(0, Number(ms) || 0), fn, done: false };
      waits.push(w);
      return { cancel() { w.done = true; } };
    },
    clearWait(handle) { if (handle && handle.cancel) handle.cancel(); },

    pause() { gamePaused = true; },
    resume() { gamePaused = false; },
    get paused() { return gamePaused; },
    get currentMap() { return currentScene3D.name; },
    get currentScene() { return currentScene3D.name; },
    get width() { return width; },
    get height() { return height; },

    // Sauvegarde locale (localStorage, prefixee par l'id du jeu)
    save(key, value) {
      try { localStorage.setItem(saveKey(key), JSON.stringify(value)); } catch (e) { log('game.save : stockage indisponible', 'warn'); }
    },
    load(key, dflt) {
      try {
        const raw = localStorage.getItem(saveKey(key));
        return raw === null ? dflt : JSON.parse(raw);
      } catch (e) { return dflt; }
    },

    raycast3D(origin, dir, maxDist = 20, opts = null) {
      const origVec = origin ? new ThreeLib.Vector3(origin.x ?? 0, origin.y ?? 0, origin.z ?? 0) : new ThreeLib.Vector3(0, 0, 0);
      const dirVec = dir ? new ThreeLib.Vector3(dir.x ?? 0, dir.y ?? 0, dir.z ?? -1).normalize() : new ThreeLib.Vector3(0, 0, -1);
      const limit = Number.isFinite(maxDist) ? maxDist : 20;

      const ray = new ThreeLib.Raycaster(origVec, dirVec, 0, limit);

      const mode = opts?.mode || (opts?.objects ? 'all' : 'blocks');
      const testBlocks = mode === 'all' || mode === 'blocks';
      const testObjects = mode === 'all' || mode === 'objects' || !!opts?.objects;

      const ignoreSet = new Set();
      if (opts?.ignore) {
        if (Array.isArray(opts.ignore)) opts.ignore.forEach((x) => ignoreSet.add(x?.id || x));
        else ignoreSet.add(opts.ignore.id || opts.ignore);
      }

      const allHits = [];

      // 1. Raycast contre les blocs solides du GridMap
      if (testBlocks && gridGroup.children.length > 0) {
        const blockHits = ray.intersectObjects(gridGroup.children, true);
        for (const h of blockHits) {
          allHits.push({
            distance: h.distance,
            point: { x: h.point.x, y: h.point.y, z: h.point.z },
            normal: h.face ? { x: h.face.normal.x, y: h.face.normal.y, z: h.face.normal.z } : { x: 0, y: 1, z: 0 },
            instance: null,
            objectName: null,
            type: 'block',
          });
        }
      }

      // 2. Raycast contre les objets
      if (testObjects) {
        const candidateMeshes = [];
        const meshToInst = new Map();
        for (const inst of instances) {
          if (inst.destroyed || ignoreSet.has(inst.id) || ignoreSet.has(inst)) continue;
          if (typeof opts?.objects === 'string' && inst.objectName !== opts.objects) continue;
          if (Array.isArray(opts?.objects) && !opts.objects.includes(inst.objectName)) continue;
          if (inst.mesh) {
            candidateMeshes.push(inst.mesh);
            meshToInst.set(inst.mesh, inst);
          }
        }
        if (candidateMeshes.length > 0) {
          const objHits = ray.intersectObjects(candidateMeshes, true);
          for (const h of objHits) {
            let inst = h.object?.userData?.instance || meshToInst.get(h.object);
            let cur = h.object;
            while (!inst && cur && cur.parent) {
              cur = cur.parent;
              inst = cur.userData?.instance || meshToInst.get(cur);
            }
            if (inst && (ignoreSet.has(inst.id) || ignoreSet.has(inst))) continue;
            allHits.push({
              distance: h.distance,
              point: { x: h.point.x, y: h.point.y, z: h.point.z },
              normal: h.face ? { x: h.face.normal.x, y: h.face.normal.y, z: h.face.normal.z } : { x: 0, y: 1, z: 0 },
              instance: inst || null,
              objectName: inst ? inst.objectName : null,
              type: 'object',
            });
          }
        }
      }

      if (allHits.length > 0) {
        allHits.sort((a, b) => a.distance - b.distance);
        const best = allHits[0];
        return {
          hit: true,
          distance: best.distance,
          point: best.point,
          pointX: best.point.x,
          pointY: best.point.y,
          pointZ: best.point.z,
          normal: best.normal,
          normalX: best.normal.x,
          normalY: best.normal.y,
          normalZ: best.normal.z,
          instance: best.instance,
          objectName: best.objectName,
          type: best.type,
        };
      }

      return {
        hit: false,
        distance: Infinity,
        point: null,
        pointX: 0,
        pointY: 0,
        pointZ: 0,
        normal: null,
        normalX: 0,
        normalY: 1,
        normalZ: 0,
        instance: null,
        objectName: null,
        type: null,
      };
    },

    raycast(origin, dir, maxDist = 20, opts = null) {
      return this.raycast3D(origin, dir, maxDist, opts);
    },

    // Le changement de scene est applique en fin d'image (jamais pendant le parcours des instances)
    restart() {
      pendingScene = currentScene3D;
    },

    goToScene(sceneName) {
      const target = scenes3d.find((s) => s.name === sceneName || s.id === sceneName);
      if (target) {
        pendingScene = target;
      } else {
        log('game.goToScene : scene 3D inconnue « ' + sceneName + ' »');
      }
    },

    goToMap(mapName) {
      game.goToScene(mapName);
    },
  };

  // Modeles voxel : un seul maillage par modele (faces cachees retirees), mis en cache.
  // model.voxels = { "x,y,z": couleur } ; 0 est une couleur valide, seul null/undefined est vide.
  // Le modele est mis a l'echelle pour tenir dans la boite de 0.9 de l'instance, pieds en bas.
  const voxelMaterial = new ThreeLib.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const voxelGeoCache = new Map();
  const INSTANCE_SIZE = 0.9;
  const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  ];

  function getVoxelGeometry(model) {
    if (voxelGeoCache.has(model.id)) return voxelGeoCache.get(model.id);
    const voxels = model.voxels || {};
    const cells = [];
    let maxX = 0, maxY = 0, maxZ = 0;
    for (const [key, val] of Object.entries(voxels)) {
      if (val == null) continue;
      const p = key.split(',').map(Number);
      if (p.length !== 3 || !p.every(Number.isInteger)) continue;
      cells.push([p[0], p[1], p[2], val]);
      maxX = Math.max(maxX, p[0] + 1); maxY = Math.max(maxY, p[1] + 1); maxZ = Math.max(maxZ, p[2] + 1);
    }
    if (!cells.length) { voxelGeoCache.set(model.id, null); return null; }
    const w = Math.max(model.width || model.dimX || 0, maxX);
    const h = Math.max(model.height || model.dimY || 0, maxY);
    const d = Math.max(model.depth || model.dimZ || 0, maxZ);
    const s = INSTANCE_SIZE / Math.max(w, h, d);
    const filled = new Set(cells.map((c) => `${c[0]},${c[1]},${c[2]}`));
    const positions = [];
    const normals = [];
    const colors = [];
    const col = new ThreeLib.Color();
    for (const [x, y, z, val] of cells) {
      col.set(resolveColor(val));
      for (const f of FACES) {
        if (filled.has(`${x + f.n[0]},${y + f.n[1]},${z + f.n[2]}`)) continue;
        const quad = f.c.map(([cx, cy, cz]) => [
          (x + cx - w / 2) * s,
          (y + cy) * s - INSTANCE_SIZE / 2,
          (z + cz - d / 2) * s,
        ]);
        for (const i of [0, 1, 2, 0, 2, 3]) {
          positions.push(quad[i][0], quad[i][1], quad[i][2]);
          normals.push(f.n[0], f.n[1], f.n[2]);
          colors.push(col.r, col.g, col.b);
        }
      }
    }
    const geo = new ThreeLib.BufferGeometry();
    geo.setAttribute('position', new ThreeLib.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new ThreeLib.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new ThreeLib.Float32BufferAttribute(colors, 3));
    voxelGeoCache.set(model.id, geo);
    return geo;
  }

  // Creation d'une instance 3D
  function createInstance(objDef, x, y, z, initialProps = {}, extraOpts = {}) {
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
      message: [],
      beat: [],
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
      } else if (event === 'message') {
        handlers.message.push({ name: String(a), fn: b });
      } else if (event === 'beat') {
        handlers.beat.push(a);
      } else {
        log(`on('${event}') n'existe pas en 3D (objet « ${objDef.name} »).`, 'warn');
      }
    }

    // Mesh visuel 3D
    let mesh;
    let mixer = null;
    const actions = new Map();
    let currentAction = null;

    const modelDef = objDef.modelId ? modelsById[objDef.modelId] : null;
    const customMatId = extraOpts.materialId || objDef.materialId || null;
    const customMat = customMatId ? (projectMaterialsById.get(customMatId) || buildProjectMaterial((project.materials || []).find((m) => m.id === customMatId))) : null;

    const isGltf = modelDef && modelDef.type === 'gltf';
    const voxelGeo = modelDef && (modelDef.type || 'voxel') === 'voxel' ? getVoxelGeometry(modelDef) : null;

    if (isGltf) {
      mesh = new ThreeLib.Group();

      function setupGltfHierarchy(gltf) {
        if (!gltf?.scene) return;
        const cloned = gltf.scene.clone(true);

        if (customMat) {
          cloned.traverse((child) => {
            if (child.isMesh) child.material = customMat;
          });
        }

        const box = new ThreeLib.Box3().setFromObject(cloned);
        const size = new ThreeLib.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scaleFactor = 1.0 / maxDim;
        cloned.scale.setScalar(scaleFactor);

        const scaledBox = new ThreeLib.Box3().setFromObject(cloned);
        const center = new ThreeLib.Vector3();
        scaledBox.getCenter(center);
        cloned.position.x = -center.x;
        cloned.position.z = -center.z;
        cloned.position.y = -scaledBox.min.y;

        cloned.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
          child.userData = child.userData || {};
          child.userData.instance = instance;
        });

        mesh.add(cloned);

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new ThreeLib.AnimationMixer(cloned);
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            actions.set(clip.name, action);
            actions.set(clip.name.toLowerCase(), action);
          });
          activeMixers.add(mixer);

          const defaultAnim = objDef.defaultAnim || extraOpts.anim || 'idle';
          instance.play(defaultAnim);
        }
      }

      if (gltfCache.has(modelDef.id)) {
        setupGltfHierarchy(gltfCache.get(modelDef.id));
      } else {
        parseGltfData(modelDef, (gltf) => {
          setupGltfHierarchy(gltf);
        });
      }
    } else if (voxelGeo) {
      mesh = new ThreeLib.Mesh(voxelGeo, customMat || voxelMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    } else {
      // Cube par defaut avec couleur de l'objet
      const colorHex = objDef.color || palette[nextInstanceId % palette.length];
      mesh = new ThreeLib.Mesh(cubeGeo, customMat || getMaterial(colorHex));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    mesh.position.set(x, y, z);
    scene.add(mesh);

    // Proprietes physiques
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
      _vx: 0,
      _vy: 0,
      _vz: 0,
      get vx() { return this._vx; },
      set vx(v) { this._vx = v; this._velOverridden = true; },
      get vy() { return this._vy; },
      set vy(v) { this._vy = v; },
      get vz() { return this._vz; },
      set vz(v) { this._vz = v; this._velOverridden = true; },
      rotationX: 0,
      rotationY: typeof extraOpts?.rotationY === 'number' ? extraOpts.rotationY : 0,
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

      rigidBody: null,
      collider: null,
      _velOverridden: false,

      overlapping: new Set(),

      jump(force = 10) {
        if (this.onGround) {
          if (this.rigidBody) {
            const lv = this.rigidBody.linvel();
            this.rigidBody.setLinvel({ x: lv.x, y: force, z: lv.z }, true);
          }
          this.vy = force;
          this.onGround = false;
        }
      },

      applyImpulse(ix = 0, iy = 0, iz = 0) {
        if (this.rigidBody) {
          this.rigidBody.applyImpulse({ x: ix, y: iy, z: iz }, true);
        } else {
          this.vx += ix;
          this.vy += iy;
          this.vz += iz;
        }
      },

      moveForward(speed) {
        const rad = (this.rotationY * Math.PI) / 180;
        this.vx = Math.sin(rad) * speed;
        this.vz = -Math.cos(rad) * speed;
        this._velOverridden = true;
      },

      moveRight(speed) {
        const rad = (this.rotationY * Math.PI) / 180;
        this.vx = Math.cos(rad) * speed;
        this.vz = Math.sin(rad) * speed;
        this._velOverridden = true;
      },

      lookAt(tx, ty, tz) {
        const dx = tx - this.x;
        const dz = tz - this.z;
        this.rotationY = (Math.atan2(dx, -dz) * 180) / Math.PI;
        if (this.rigidBody) {
          const rad = (-this.rotationY * Math.PI) / 180;
          const half = rad / 2;
          this.rigidBody.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true);
        }
      },

      rotateY(deg) {
        this.rotationY = (this.rotationY + deg) % 360;
        if (this.rigidBody) {
          const rad = (-this.rotationY * Math.PI) / 180;
          const half = rad / 2;
          this.rigidBody.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true);
        }
      },

      setPosition(px, py, pz) {
        if (Number.isFinite(px)) this.x = px;
        if (Number.isFinite(py)) this.y = py;
        if (Number.isFinite(pz)) this.z = pz;
        if (this.rigidBody) {
          this.rigidBody.setTranslation({ x: this.x, y: this.y, z: this.z }, true);
        }
      },

      setScale(sx = 1, sy = sx, sz = sx) {
        if (Number.isFinite(sx)) this.scaleX = sx;
        if (Number.isFinite(sy)) this.scaleY = sy;
        if (Number.isFinite(sz)) this.scaleZ = sz;
        if (this.mesh?.scale?.set) {
          this.mesh.scale.set(this.scaleX, this.scaleY, this.scaleZ);
        }
      },

      setVelocity(nvx, nvy, nvz) {
        if (Number.isFinite(nvx)) this.vx = nvx;
        if (Number.isFinite(nvy)) this.vy = nvy;
        if (Number.isFinite(nvz)) this.vz = nvz;
        this._velOverridden = true;
        if (this.rigidBody) {
          const lv = this.rigidBody.linvel();
          this.rigidBody.setLinvel({
            x: Number.isFinite(nvx) ? nvx : lv.x,
            y: Number.isFinite(nvy) ? nvy : lv.y,
            z: Number.isFinite(nvz) ? nvz : lv.z,
          }, true);
        }
      },

      setGravity(on) {
        this.gravity = !!on;
        if (this.rigidBody) {
          this.rigidBody.setGravityScale(on ? 1 : 0, true);
        }
      },

      distanceTo(other) {
        if (!other) return Infinity;
        return Math.hypot((other.x || 0) - this.x, (other.y || 0) - this.y, (other.z || 0) - this.z);
      },

      get visible() { return mesh.visible; },
      set visible(v) { mesh.visible = !!v; },

      play(animName) {
        if (!animName) return;
        const name = String(animName).trim();
        const lower = name.toLowerCase();
        let action = actions.get(name) || actions.get(lower);
        if (!action) {
          if (lower === 'marche' || lower === 'marcher') action = actions.get('walk') || actions.get('Walk');
          else if (lower === 'course' || lower === 'courir') action = actions.get('run') || actions.get('Run');
          else if (lower === 'attente' || lower === 'repos') action = actions.get('idle') || actions.get('Idle');
          else if (lower === 'saut' || lower === 'sauter') action = actions.get('jump') || actions.get('Jump');
          else if (lower === 'walk') action = actions.get('marche') || actions.get('Marche');
          else if (lower === 'idle') action = actions.get('attente') || actions.get('repos');
        }
        if (!action) {
          if (!currentAction && actions.size > 0) {
            action = actions.values().next().value;
          }
        }
        if (!action) return;
        if (currentAction === action) return;
        if (currentAction) {
          currentAction.fadeOut(0.15);
        }
        action.reset().fadeIn(0.15).play();
        currentAction = action;
      },

      destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.rigidBody && rapierWorld) {
          if (this.collider) {
            colliderToInstance.delete(this.collider.handle);
          }
          try { rapierWorld.removeRigidBody(this.rigidBody); } catch (e) { /* ignore */ }
          this.rigidBody = null;
          this.collider = null;
        }
        if (mixer) {
          activeMixers.delete(mixer);
          mixer.stopAllAction();
          mixer = null;
        }
        callHandlers(this, handlers.destroy, [], 'destroy');
        // Geometries et materiaux partages (cache) : liberes dans destroy() du jeu
        scene.remove(mesh);
      },
    };

    if (mesh) {
      mesh.userData = mesh.userData || {};
      mesh.userData.instance = instance;
    }

    if (rapierWorld && phys.enabled !== false) {
      const bodyType = phys.bodyType || (phys.immovable ? 'static' : 'dynamic');
      let rbDesc;
      if (bodyType === 'static' || phys.immovable) {
        rbDesc = Rapier.RigidBodyDesc.fixed();
      } else if (bodyType === 'kinematic') {
        rbDesc = Rapier.RigidBodyDesc.kinematicPositionBased();
      } else {
        rbDesc = Rapier.RigidBodyDesc.dynamic();
        if (phys.gravity === false) {
          rbDesc.setGravityScale(0, true);
        }
        if (phys.lockRotations !== false) {
          rbDesc.enabledRotations(false, true, false);
        }
      }
      rbDesc.setTranslation(x, y, z);
      const startRotY = instance.rotationY;
      const rad = (-startRotY * Math.PI) / 180;
      const half = rad / 2;
      rbDesc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
      const rigidBody = rapierWorld.createRigidBody(rbDesc);

      const hw = (instance.width || 0.9) / 2;
      const hh = (instance.height || 0.9) / 2;
      const hd = (instance.depth || 0.9) / 2;
      let colDesc;
      const shape = phys.colliderShape || 'box';
      if (shape === 'sphere') {
        colDesc = Rapier.ColliderDesc.ball(Math.max(hw, hh, hd));
      } else if (shape === 'capsule') {
        const radius = Math.max(hw, hd);
        const halfHeight = Math.max(0.01, hh - radius);
        colDesc = Rapier.ColliderDesc.capsule(halfHeight, radius);
      } else if (shape === 'trimesh' && mesh?.geometry?.attributes?.position && mesh?.geometry?.index) {
        const posAttr = mesh.geometry.attributes.position.array;
        const idxAttr = mesh.geometry.index.array;
        colDesc = Rapier.ColliderDesc.trimesh(new Float32Array(posAttr), new Uint32Array(idxAttr));
      } else {
        colDesc = Rapier.ColliderDesc.cuboid(hw, hh, hd);
      }

      const isSensor = phys.sensor === true || (phys.immovable && !phys.collideMap);
      if (isSensor) {
        colDesc.setSensor(true);
      }
      colDesc.setActiveEvents(Rapier.ActiveEvents.COLLISION_EVENTS);
      colDesc.setFriction(typeof phys.friction === 'number' ? phys.friction : 0.5);
      colDesc.setRestitution(typeof phys.restitution === 'number' ? phys.restitution : (phys.bounce || 0));
      if (typeof phys.mass === 'number' && phys.mass > 0) {
        colDesc.setMass(phys.mass);
      }

      const collider = rapierWorld.createCollider(colDesc, rigidBody);
      colliderToInstance.set(collider.handle, instance);
      instance.rigidBody = rigidBody;
      instance.collider = collider;
    }

    instances.push(instance);

    // Execution du script utilisateur
    const scriptCode = objDef.script?.code || '';
    instance._handlers = handlers;
    if (scriptCode.trim()) {
      try {
        const runScript = new Function('self', 'game', 'input', 'on', scriptCode);
        runScript(instance, game, input, on);
      } catch (err) {
        log(`Script de « ${objDef.name} » : ${errMsg(err)}`);
      }
    }

    // Declenchement de on('create')
    callHandlers(instance, handlers.create, [], 'create');

    return instance;
  }

  // Appel protege des handlers : une erreur de script est remontee a la console de l'editeur
  const reportedErrors = new Set();
  function callHandlers(inst, fns, args, eventName) {
    if (!fns) return;
    for (const fn of fns) {
      try {
        fn(...args);
      } catch (e) {
        const msg = `Script de « ${inst.objectName} » (${eventName}) : ${errMsg(e)}`;
        if (!reportedErrors.has(msg)) {
          reportedErrors.add(msg);
          log(msg);
        }
      }
    }
  }

  function destroyAllInstances() {
    [...instances].forEach((inst) => inst.destroy());
    instances.length = 0;
  }

  function spawnSceneEntities() {
    const rawNodes = Array.isArray(currentScene3D.nodes) && currentScene3D.nodes.length > 0
      ? currentScene3D.nodes
      : null;
    const nodes = rawNodes ? expandPrefabNodes(rawNodes, project.prefabs3d || []) : null;

    if (nodes) {
      nodes.forEach((node) => {
        if (node.visible === false) return;
        if (node.kind === 'mesh' && node.objectId) {
          const objDef = objectsById[node.objectId] || objectsByName[node.objectId];
          if (objDef) {
            const px = Array.isArray(node.position) ? node.position[0] : (node.position?.x || 0);
            const py = Array.isArray(node.position) ? node.position[1] : (node.position?.y || 0);
            const pz = Array.isArray(node.position) ? node.position[2] : (node.position?.z || 0);
            const ry = Array.isArray(node.rotation) ? node.rotation[1] : (node.rotation?.y || 0);
            const inst = createInstance(objDef, px, py, pz, node.props || {}, {
              materialId: node.materialId,
              anim: node.props?.anim,
              rotationY: typeof ry === 'number' ? ry : 0,
            });
            if (typeof ry === 'number') inst.rotationY = ry;
          }
        }
      });
    } else {
      (currentScene3D.entities || []).forEach((ent) => {
        const objDef = objectsById[ent.objectId] || objectsByName[ent.objectId];
        if (objDef) {
          const ry = typeof ent.rotationY === 'number' ? ent.rotationY : 0;
          const inst = createInstance(objDef, ent.x || 0, ent.y || 0, ent.z || 0, ent.props || {}, {
            materialId: ent.materialId,
            anim: ent.props?.anim,
            rotationY: ry,
          });
          if (typeof ent.rotationY === 'number') inst.rotationY = ent.rotationY;
        }
      });
    }

    // Si aucune entite n'est presente, instancier le premier objet ou un cube joueur
    if (instances.length === 0 && project.objects?.[0]) {
      const p = createInstance(project.objects[0], 0, 2, 0);
      gameCamera.follow(p);
    }
  }

  spawnSceneEntities();
  applyPlayFromCamera();
  if (showDebugColliders) updateDebugColliders();

  // Boucle Principale et Moteur Physique 3D
  let lastTime = performance.now();
  let animId = null;
  let isPaused = false;

  // Physique AABB contre la grille : la boite (centre x,y,z ; demi-tailles) touche-t-elle un bloc ?
  const EPS = 1e-4;
  function boxHitsBlocks(x, y, z, hw, hh, hd) {
    const x0 = cellOf(x - hw + EPS), x1 = cellOf(x + hw - EPS);
    const y0 = cellOf(y - hh + EPS), y1 = cellOf(y + hh - EPS);
    const z0 = cellOf(z - hd + EPS), z1 = cellOf(z + hd - EPS);
    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
          if (solidBlocks.has(`${bx},${by},${bz}`)) return true;
        }
      }
    }
    return false;
  }

  // Deplace l'instance sur un axe ; en cas de contact, la colle a la face du bloc et annule la vitesse.
  // Renvoie true si un bloc a arrete le mouvement.
  function moveAxis(inst, axis, delta, hw, hh, hd) {
    if (!delta) return false;
    const pos = { x: inst.x, y: inst.y, z: inst.z };
    pos[axis] += delta;
    if (!boxHitsBlocks(pos.x, pos.y, pos.z, hw, hh, hd)) {
      inst[axis] = pos[axis];
      return false;
    }
    const half = axis === 'x' ? hw : axis === 'y' ? hh : hd;
    // Les sous-pas font moins d'un demi-bloc : le bloc fautif est dans la couche de cellules atteinte
    if (delta > 0) inst[axis] = cellOf(pos[axis] + half - EPS) - 0.5 - half - EPS;
    else inst[axis] = cellOf(pos[axis] - half + EPS) + 0.5 + half + EPS;
    inst['v' + axis] = 0;
    return true;
  }

  function endOverlap(a, b) {
    if (!a.overlapping.has(b.id)) return;
    a.overlapping.delete(b.id);
    if (!a.destroyed) callHandlers(a, a._handlers.overlapEnd.get(b.objectName), [b], 'overlapEnd');
  }

  function updatePhysics(dt) {
    const dtSec = dt / 1000;

    // Evenements keydown (memes noms logiques que input.justPressed : SPACE, LEFT...), meme en pause
    for (const inst of instances.slice()) {
      if (inst.destroyed) continue;
      for (const [key, fns] of inst._handlers.keydown.entries()) {
        if (keyIn(justPressedKeys, key)) callHandlers(inst, fns, [], 'keydown');
      }
    }

    if (!gamePaused) stepWorld(dt, dtSec);
    updateCamera();
  }

  function stepWorldRapier(dt, dtSec) {
    for (const inst of instances.slice()) {
      if (inst.destroyed) continue;

      // Minuteries
      for (const t of inst._handlers.timer) {
        t.elapsed += dt;
        if (t.elapsed >= t.ms) {
          t.elapsed = 0;
          callHandlers(inst, [t.fn], [], 'timer');
        }
      }
      if (inst.destroyed) continue;

      // Synchronisation de la velocite utilisateur vers Rapier
      if (inst.rigidBody && !inst.immovable) {
        if (inst._velOverridden) {
          const curLv = inst.rigidBody.linvel();
          inst.rigidBody.setLinvel({ x: inst.vx, y: curLv.y, z: inst.vz }, true);
          inst._velOverridden = false;
        }
      }
    }

    // Pas de simulation Rapier
    rapierWorld.step(rapierEventQueue);

    // Traitement des collisions Rapier
    rapierEventQueue.drainCollisionEvents((h1, h2, started) => {
      const a = colliderToInstance.get(h1);
      const b = colliderToInstance.get(h2);
      if (!a || !b || a.destroyed || b.destroyed) return;
      if (started) {
        if (!a.overlapping.has(b.id)) {
          a.overlapping.add(b.id);
          callHandlers(a, a._handlers.overlapStart.get(b.objectName), [b], 'overlapStart');
        }
        if (!b.overlapping.has(a.id)) {
          b.overlapping.add(a.id);
          callHandlers(b, b._handlers.overlapStart.get(a.objectName), [a], 'overlapStart');
        }
        callHandlers(a, a._handlers.overlap.get(b.objectName), [b], 'overlap');
        callHandlers(b, b._handlers.overlap.get(a.objectName), [a], 'overlap');
        callHandlers(a, a._handlers.collide.get(b.objectName), [b], 'collide');
        callHandlers(b, b._handlers.collide.get(a.objectName), [a], 'collide');
      } else {
        endOverlap(a, b);
        endOverlap(b, a);
      }
    });

    // Maintien des overlaps actifs
    for (const inst of instances) {
      if (inst.destroyed) continue;
      for (const otherId of inst.overlapping) {
        const other = instances.find((o) => o.id === otherId && !o.destroyed);
        if (other) {
          callHandlers(inst, inst._handlers.overlap.get(other.objectName), [other], 'overlap');
        }
      }
    }

    // Synchronisation de la position et de la vitesse depuis Rapier vers instance et Three.js
    for (const inst of instances.slice()) {
      if (inst.destroyed) continue;

      if (inst.rigidBody) {
        const t = inst.rigidBody.translation();
        const lv = inst.rigidBody.linvel();
        inst.x = t.x;
        inst.y = t.y;
        inst.z = t.z;
        inst._vx = lv.x;
        inst._vy = lv.y;
        inst._vz = lv.z;
        inst._velOverridden = false;

        inst.mesh.position.set(t.x, t.y, t.z);
        const objDef = objectsByName[inst.objectName];
        const phys = objDef?.physics || {};
        if (phys.lockRotations === false) {
          const r = inst.rigidBody.rotation();
          inst.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        } else {
          inst.mesh.rotation.y = (-inst.rotationY * Math.PI) / 180;
        }

        // Detection du sol sous le corps
        const ray = new Rapier.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
        const maxDist = (inst.height / 2) + 0.15;
        const hit = rapierWorld.castRay(ray, maxDist, true, undefined, undefined, inst.collider);
        inst.onGround = hit != null && inst.vy <= 0.5;

        // Limite de chute
        if (inst.y < -30) {
          game.restart();
          continue;
        }
      } else {
        inst.mesh.position.set(inst.x, inst.y, inst.z);
        inst.mesh.rotation.y = (-inst.rotationY * Math.PI) / 180;
      }

      // Appel de on('update')
      callHandlers(inst, inst._handlers.update, [dt], 'update');
    }
  }

  function stepWorldAABB(dt, dtSec) {
    for (const inst of instances.slice()) {
      if (inst.destroyed) continue;

      // Minuteries
      for (const t of inst._handlers.timer) {
        t.elapsed += dt;
        if (t.elapsed >= t.ms) {
          t.elapsed = 0;
          callHandlers(inst, [t.fn], [], 'timer');
        }
      }
      if (inst.destroyed) continue;

      // Gravite
      if (inst.gravity && !inst.immovable) {
        inst.vy -= gravityAccel * dtSec;
      }

      // Application des vitesses, axe par axe, en sous-pas (pas de traversee des blocs)
      if (!inst.immovable) {
        const dx = inst.vx * dtSec;
        const dy = inst.vy * dtSec;
        const dz = inst.vz * dtSec;
        if (inst.collideMap) {
          const hw = inst.width / 2, hh = inst.height / 2, hd = inst.depth / 2;
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
          const wasFalling = dy <= 0;
          inst.onGround = false;
          for (let s = 0; s < steps; s++) {
            moveAxis(inst, 'x', inst.vx ? dx / steps : 0, hw, hh, hd);
            moveAxis(inst, 'z', inst.vz ? dz / steps : 0, hw, hh, hd);
            if (moveAxis(inst, 'y', inst.vy ? dy / steps : 0, hw, hh, hd) && wasFalling) inst.onGround = true;
          }
          // Pose sur un bloc sans vitesse verticale (objet sans gravite) : toujours au sol
          if (!inst.onGround && boxHitsBlocks(inst.x, inst.y - 2 * EPS - 0.01, inst.z, hw, hh, hd) && inst.vy <= 0) {
            inst.onGround = true;
          }
        } else {
          inst.x += dx;
          inst.y += dy;
          inst.z += dz;
          inst.onGround = false;
        }

        // Limite de chute
        if (inst.y < -30) {
          game.restart();
          continue;
        }
      }

      // Mise a jour du Mesh Three.js
      inst.mesh.position.set(inst.x, inst.y, inst.z);
      // rotationY positif = vers la droite vu de dessus (sens horaire) ; Three.js tourne dans l'autre sens
      inst.mesh.rotation.y = (-inst.rotationY * Math.PI) / 180;

      // Appel de on('update')
      callHandlers(inst, inst._handlers.update, [dt], 'update');
    }

    // Gestion des collisions et overlaps entre entites (AABB 3D)
    for (let i = 0; i < instances.length; i++) {
      const a = instances[i];
      if (a.destroyed) continue;

      for (let j = i + 1; j < instances.length; j++) {
        const b = instances[j];
        if (b.destroyed) continue;
        if (a.destroyed) break;

        const touchX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        const touchY = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        const touchZ = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;

        if (touchX && touchY && touchZ) {
          // OverlapStart puis overlap (chaque image tant que les boites se touchent)
          if (!a.overlapping.has(b.id)) {
            a.overlapping.add(b.id);
            callHandlers(a, a._handlers.overlapStart.get(b.objectName), [b], 'overlapStart');
          }
          if (!b.overlapping.has(a.id)) {
            b.overlapping.add(a.id);
            callHandlers(b, b._handlers.overlapStart.get(a.objectName), [a], 'overlapStart');
          }
          callHandlers(a, a._handlers.overlap.get(b.objectName), [b], 'overlap');
          callHandlers(b, b._handlers.overlap.get(a.objectName), [a], 'overlap');
          // collide : evenement de contact (la separation physique entre entites n'est pas geree)
          callHandlers(a, a._handlers.collide.get(b.objectName), [b], 'collide');
          callHandlers(b, b._handlers.collide.get(a.objectName), [a], 'collide');
        } else {
          endOverlap(a, b);
          endOverlap(b, a);
        }
      }
    }
  }

  function stepWorld(dt, dtSec) {
    // Attentes game.wait
    for (let k = 0; k < waits.length; k++) {
      const w = waits[k];
      if (w.done) continue;
      w.remaining -= dt;
      if (w.remaining <= 0) {
        w.done = true;
        try { w.fn(); } catch (e) { log('game.wait : ' + errMsg(e)); }
      }
    }
    for (let k = waits.length - 1; k >= 0; k--) if (waits[k].done) waits.splice(k, 1);

    if (rapierWorld) {
      stepWorldRapier(dt, dtSec);
    } else {
      stepWorldAABB(dt, dtSec);
    }

    // Retire les instances detruites pendant l'image (et termine leurs chevauchements)
    if (instances.some((i) => i.destroyed)) {
      const dead = instances.filter((i) => i.destroyed);
      for (const inst of instances) {
        if (inst.destroyed) continue;
        for (const d of dead) endOverlap(inst, d);
      }
      for (let k = instances.length - 1; k >= 0; k--) {
        if (instances[k].destroyed) instances.splice(k, 1);
      }
    }
  }

  // Suivi de la camera
  function updateCamera() {
    if (cameraTarget && !cameraTarget.destroyed) {
      if (cameraMode === 'third-person') {
        const dist = cameraFollowOpts.distance || 6;
        const h = cameraFollowOpts.height || 3;
        const rad = (cameraTarget.rotationY * Math.PI) / 180;

        let targetCamX = cameraTarget.x - Math.sin(rad) * dist;
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
          const testX = cellOf(fromX + (dx * s) / steps);
          const testY = cellOf(fromY + (dy * s) / steps);
          const testZ = cellOf(fromZ + (dz * s) / steps);
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
          cameraTarget.x + Math.sin(rad) * 10,
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
  }

  function loop(now) {
    animId = requestAnimationFrame(loop);
    if (isPaused) return;

    const dt = Math.max(0, Math.min(now - lastTime, 100));
    lastTime = now;

    updatePhysics(dt);
    if (showDebugColliders) updateDebugColliders();
    if (activeMixers.size > 0) {
      const dtSec = dt / 1000;
      for (const m of activeMixers) {
        m.update(dtSec);
      }
    }
    if (pendingScene) {
      const next = pendingScene;
      pendingScene = null;
      loadScene(next);
    }
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
      animId = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      destroyAllInstances();
      if (rapierWorld) {
        try { rapierWorld.free(); } catch (e) { /* ignore */ }
        rapierWorld = null;
      }
      colliderToInstance.clear();
      for (const m of activeMixers) {
        m.stopAllAction();
      }
      activeMixers.clear();
      projectMaterialsById.forEach((m) => m && m.dispose?.());
      projectMaterialsById.clear();
      textureCache.forEach((t) => t && t.dispose?.());
      textureCache.clear();
      if (chipAudio && chipAudio.stopSong) { try { chipAudio.stopSong(); } catch (e) { /* ignore */ } }
      if (audioCtx) { try { audioCtx.close(); } catch (e) { /* ignore */ } audioCtx = null; }
      cubeGeo.dispose();
      materialCache.forEach((m) => m.dispose());
      voxelGeoCache.forEach((g) => g && g.dispose());
      voxelMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      wrapper.remove();
    },

    pause() { isPaused = true; },
    resume() { isPaused = false; lastTime = performance.now(); },
    isPaused() { return isPaused; },
    stepFrame(dt = 16.6) {
      const wasPaused = isPaused;
      isPaused = false;
      updatePhysics(dt);
      if (showDebugColliders) updateDebugColliders();
      renderer.render(scene, camera);
      isPaused = wasPaused;
    },
    setDebugColliders(enabled) {
      showDebugColliders = enabled !== undefined ? !!enabled : !showDebugColliders;
      updateDebugColliders();
      return showDebugColliders;
    },
    hasDebugColliders() { return showDebugColliders; },
    restart() { loadScene(currentScene3D); },
    // Etat lisible (tests ; panneau Console de l'editeur via __debugSnapshot, meme forme qu'en 2D)
    debugSnapshot,
    __debugSnapshot: debugSnapshot,
    game,
  };

  function debugSnapshot() {
    return {
      fps: 60,
      mapName: currentScene3D.name,
      scene: currentScene3D.name,
      blocks: solidBlocks.size,
      isPaused,
      debugColliders: showDebugColliders,
      instances: instances.filter((i) => !i.destroyed).map((i) => ({
        id: i.id, name: i.objectName, x: i.x, y: i.y, z: i.z, vx: i.vx, vy: i.vy, vz: i.vz, onGround: i.onGround, vars: { ...i.vars },
      })),
      score: game.score,
    };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.createGame3D = createGame3D;
}
