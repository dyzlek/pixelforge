/**
 * PixelForge Studio — Editeur de Scene 3D (GridMap, Entites, Gizmos et Test F6)
 * Permet de construire des niveaux 3D a la souris, de peindre la GridMap par etage,
 * de positionner des entites d'objets, de selectionner (simple / multiple / rectangle),
 * et de manipuler les objets via gizmos TransformControls (deplacer W, tourner E, echelle R, aimantation).
 */

import { GridMap3D } from './gridmap.js';
import { getIconSvg } from '../../ui/icons.js';
import { uid } from '../../core/project.js';
import './scene3d.css';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mount(container, store, { refId } = {}) {
  const findScene = () => (store.project?.scenes3d || []).find((s) => s.id === refId) || null;
  let sceneData = findScene();
  if (!sceneData) {
    container.className = 'pf-scene3d-editor';
    container.textContent = 'Scene 3D introuvable (supprimee ?).';
    return { dispose() {}, onShow() {}, onHide() {} };
  }

  if (store.ui) store.ui.selectedScene3DId = refId;

  let grid = new GridMap3D(sceneData.gridmap);

  let activeTool = 'block'; // 'block' | 'erase' | 'entity' | 'select'
  let activeLevel = 0; // Etage Y
  let activeColor = 9; // index de palette (meme format que paint_gridmap)
  let isActive = true;
  let selectedObjectId = store.project?.objects?.[0]?.id || null;
  let selectedEntityId = null;
  let selectedNodeIds = new Set();
  let isDisposed = false;
  let animId = null;

  // Gizmo & Aimantation
  let gizmoMode = 'translate'; // 'translate' | 'rotate' | 'scale'
  let gizmoSpace = 'world'; // 'world' | 'local'
  let snapEnabled = true;
  let snapStep = 1.0;
  let isTransformDragging = false;
  let dragInitialTransforms = new Map();
  let nodeClipboard = [];

  const palette = store.project?.palette || [
    '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
    '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
  ];

  container.className = 'pf-scene3d-editor';
  container.innerHTML = `
    <div class="pf-scene3d-toolbar">
      <div class="pf-scene3d-tools">
        <button class="pf-scene3d-btn active" data-tool="block" title="Placer un bloc (Clic sur la grille ou une face)">Placer bloc</button>
        <button class="pf-scene3d-btn" data-tool="erase" title="Gomme (Supprimer le bloc clique)">Gomme bloc</button>
        <button class="pf-scene3d-btn" data-tool="entity" title="Poser une instance d'objet 3D">Poser entite</button>
        <button class="pf-scene3d-btn" data-tool="select" title="Selectionner / manipuler les objets (W/E/R)">Selectionner</button>
        <span style="width:1px;height:18px;background:var(--border);margin:0 4px;"></span>
        <div class="pf-s3d-gizmo-tools" id="pf-s3d-gizmo-bar">
          <button class="pf-s3d-gizmo-btn active" data-gizmo="translate" title="Deplacer (W)">W</button>
          <button class="pf-s3d-gizmo-btn" data-gizmo="rotate" title="Tourner (E)">E</button>
          <button class="pf-s3d-gizmo-btn" data-gizmo="scale" title="Echelle (R)">R</button>
          <button class="pf-s3d-gizmo-btn" id="pf-s3d-space-btn" title="Basculer Espace Monde / Local (Q)">Monde</button>
        </div>
        <div class="pf-s3d-snap-box" title="Aimantation a la grille (Maintenir Ctrl pour couper)">
          <input type="checkbox" id="pf-s3d-snap-chk" checked />
          <label for="pf-s3d-snap-chk" style="font-size:11px;cursor:pointer;">Aimant</label>
          <select id="pf-s3d-snap-val" class="pf-insp-input" style="padding:1px 4px;font-size:10px;height:20px;">
            <option value="1.0" selected>1.0</option>
            <option value="0.5">0.5</option>
            <option value="0.25">0.25</option>
          </select>
        </div>
        <span style="width:1px;height:18px;background:var(--border);margin:0 4px;"></span>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--fg-1);">
          <span>Etage Y :</span>
          <button class="pf-scene3d-btn" id="pf-s3d-lvl-down" style="padding:2px 6px;">-</button>
          <span id="pf-s3d-lvl-label" style="font-weight:700;min-width:20px;text-align:center;">${activeLevel}</span>
          <button class="pf-scene3d-btn" id="pf-s3d-lvl-up" style="padding:2px 6px;">+</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;">
        <button class="pf-scene3d-btn primary" id="pf-s3d-play-btn" title="Tester cette scene (F6)">${getIconSvg('playScene', 12)} Tester la scene (F6)</button>
        <span id="pf-s3d-stats" style="font-size:11px;color:var(--fg-2);">0 blocs</span>
      </div>
    </div>

    <div class="pf-scene3d-workspace">
      <div class="pf-scene3d-viewport" id="pf-s3d-viewport">
        <div class="pf-scene3d-overlay-hint">Clic : Selectionner / Placer | Maj+Clic / Rectangle : Multi-selection | W/E/R : Gizmos | Q : Monde/Local | Ctrl : Sans aimant | Ctrl+C/V/D : Copier / Coller / Dupliquer</div>
        <div class="pf-s3d-marquee" id="pf-s3d-marquee" style="display:none;"></div>
      </div>

      <div class="pf-scene3d-sidebar">
        <div class="pf-scene3d-card">
          <div class="pf-scene3d-card-title">Objet a poser</div>
          <select id="pf-s3d-obj-select" class="pf-insp-input" style="width:100%;font-size:11px;">
            ${(store.project?.objects || []).map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}
          </select>
        </div>

        <div class="pf-scene3d-card">
          <div class="pf-scene3d-card-title">Couleur du bloc</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">
            ${palette.map((hex, i) => `<button type="button" class="pf-s3d-color-swatch" data-index="${i}" title="Couleur ${i} (${esc(hex)})" aria-label="Couleur ${i}" aria-pressed="${i === activeColor}" style="background:${esc(hex)};aspect-ratio:1;border-radius:3px;cursor:pointer;border:1px solid rgba(0,0,0,0.4);padding:0;${i === activeColor ? 'outline:2px solid #ffffff;' : ''}"></button>`).join('')}
          </div>
        </div>

        <div class="pf-scene3d-card" id="pf-s3d-selected-card">
          <div class="pf-scene3d-card-title">Selection</div>
          <div id="pf-s3d-sel-details" style="color:var(--fg-2);">Aucun objet selectionne</div>
          <button class="pf-scene3d-btn danger" id="pf-s3d-delete-ent" style="display:none;margin-top:4px;">Supprimer la selection</button>
        </div>
      </div>
    </div>
  `;

  // Gestion des outils
  const toolBtns = container.querySelectorAll('.pf-scene3d-btn[data-tool]');
  toolBtns.forEach((btn) => {
    btn.onclick = () => {
      activeTool = btn.dataset.tool;
      toolBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateGizmoAttachment();
    };
  });

  // Gestion des boutons de gizmo
  const gizmoBtns = container.querySelectorAll('.pf-s3d-gizmo-btn[data-gizmo]');
  gizmoBtns.forEach((btn) => {
    btn.onclick = () => {
      setGizmoMode(btn.dataset.gizmo);
    };
  });

  function setGizmoMode(mode) {
    gizmoMode = mode;
    gizmoBtns.forEach((b) => b.classList.toggle('active', b.dataset.gizmo === mode));
    if (transformControls) {
      transformControls.setMode(mode);
    }
  }

  const spaceBtn = container.querySelector('#pf-s3d-space-btn');
  function toggleGizmoSpace() {
    gizmoSpace = gizmoSpace === 'world' ? 'local' : 'world';
    spaceBtn.textContent = gizmoSpace === 'world' ? 'Monde' : 'Local';
    if (transformControls) {
      transformControls.setSpace(gizmoSpace);
    }
  }
  spaceBtn.onclick = toggleGizmoSpace;

  // Aimantation
  const snapChk = container.querySelector('#pf-s3d-snap-chk');
  const snapVal = container.querySelector('#pf-s3d-snap-val');

  snapChk.onchange = () => {
    snapEnabled = snapChk.checked;
    applySnapping();
  };
  snapVal.onchange = () => {
    snapStep = parseFloat(snapVal.value) || 1.0;
    applySnapping();
  };

  function applySnapping(forceOff = false) {
    if (!transformControls || !ThreeLib) return;
    if (!snapEnabled || forceOff) {
      transformControls.setTranslationSnap(null);
      transformControls.setRotationSnap(null);
      transformControls.setScaleSnap(null);
    } else {
      transformControls.setTranslationSnap(snapStep);
      transformControls.setRotationSnap(ThreeLib.MathUtils.degToRad(15));
      transformControls.setScaleSnap(0.25);
    }
  }

  // Changement d'etage Y
  const lvlLabel = container.querySelector('#pf-s3d-lvl-label');
  const lvlUp = container.querySelector('#pf-s3d-lvl-up');
  const lvlDown = container.querySelector('#pf-s3d-lvl-down');

  function setLevel(lvl) {
    activeLevel = Math.max(-10, Math.min(30, lvl));
    lvlLabel.textContent = activeLevel;
    if (gridHelper) gridHelper.position.y = activeLevel;
  }
  lvlUp.onclick = () => setLevel(activeLevel + 1);
  lvlDown.onclick = () => setLevel(activeLevel - 1);

  // Palette de couleur de bloc
  container.querySelectorAll('.pf-s3d-color-swatch').forEach((swatch) => {
    swatch.onclick = () => {
      activeColor = Number(swatch.dataset.index);
      container.querySelectorAll('.pf-s3d-color-swatch').forEach((s) => {
        s.style.outline = 'none';
        s.setAttribute('aria-pressed', 'false');
      });
      swatch.style.outline = '2px solid #ffffff';
      swatch.setAttribute('aria-pressed', 'true');
    };
  });

  const objSelect = container.querySelector('#pf-s3d-obj-select');
  objSelect.onchange = () => {
    selectedObjectId = objSelect.value;
  };

  // Lance le jeu sur cette scene
  const playBtn = container.querySelector('#pf-s3d-play-btn');
  playBtn.onclick = () => {
    store.ui.playScene3DId = sceneData.id;
    window.dispatchEvent(new CustomEvent('pixelforge:play'));
  };

  // Toute modification passe par store.update (Ctrl+Z)
  function commit(mutate) {
    store.update((p) => {
      const sc = (p.scenes3d || []).find((s) => s.id === refId);
      if (!sc) return;
      if (mutate) mutate(sc);
      sc.gridmap = grid.toProjectJSON(sc.gridmap);
      sceneData = sc;
    }, 'scene3d');
    container.querySelector('#pf-s3d-stats').textContent = `${grid.blocks.size} blocs`;
  }

  // Annuler / retablir / rechargement
  const offLoad = store.on('load', () => {
    const sc = findScene();
    if (!sc) return;
    sceneData = sc;
    grid = new GridMap3D(sc.gridmap);
    if (selectedEntityId && !(sc.entities || []).some((e) => e.id === selectedEntityId) && !(sc.nodes || []).some((n) => n.id === selectedEntityId)) {
      selectedEntityId = null;
      selectedNodeIds.clear();
    }
    if (blockGroup) {
      rebuildBlocks();
      rebuildEntities();
      updateGizmoAttachment();
    }
    updateSelectionUI();
  });

  const offChange = store.on('change', () => {
    const sc = findScene();
    if (!sc) return;
    sceneData = sc;
    grid = new GridMap3D(sc.gridmap);
    if (blockGroup) {
      rebuildBlocks();
      rebuildEntities();
      updateGizmoAttachment();
    }
    updateSelectionUI();
  });

  const offSel = store.on('selection', (sel) => {
    if (sel?.type === 'node3d' && (sel.sceneId === refId || !sel.sceneId)) {
      if (selectedEntityId !== sel.id) {
        selectedEntityId = sel.id;
        selectedNodeIds = new Set([sel.id]);
        updateSelectionUI();
        rebuildEntities();
        updateGizmoAttachment();
      }
    } else if (sel?.type === 'entity') {
      if (selectedEntityId !== sel.id) {
        selectedEntityId = sel.id;
        selectedNodeIds = new Set([sel.id]);
        updateSelectionUI();
        rebuildEntities();
        updateGizmoAttachment();
      }
    } else if (selectedEntityId && (!sel || (sel.type !== 'node3d' && sel.type !== 'entity'))) {
      selectedEntityId = null;
      selectedNodeIds.clear();
      updateSelectionUI();
      rebuildEntities();
      updateGizmoAttachment();
    }
  });

  // Copier / Coller / Dupliquer
  function copySelectedNodes() {
    const ids = Array.from(selectedNodeIds);
    if (!ids.length && selectedEntityId) ids.push(selectedEntityId);
    if (!ids.length) return;
    const nodes = (sceneData.nodes || []).filter((n) => ids.includes(n.id));
    if (nodes.length) {
      nodeClipboard = structuredClone(nodes);
    }
  }

  function pasteNodes() {
    if (!nodeClipboard.length) return;
    commit((sc) => {
      sc.nodes = sc.nodes || [];
      sc.entities = sc.entities || [];
      const newSelectedIds = new Set();

      for (const node of nodeClipboard) {
        const copy = structuredClone(node);
        copy.id = uid('node3d');
        copy.name = `${copy.name}_copie`;
        if (Array.isArray(copy.position)) {
          copy.position[0] = (copy.position[0] || 0) + 1;
          copy.position[2] = (copy.position[2] || 0) + 1;
        }
        sc.nodes.push(copy);
        if (copy.kind === 'mesh' && copy.objectId) {
          sc.entities.push({
            id: copy.id,
            objectId: copy.objectId,
            x: copy.position[0],
            y: copy.position[1],
            z: copy.position[2],
            rotationY: copy.rotation?.[1] || 0,
            props: structuredClone(copy.props || {}),
          });
        }
        newSelectedIds.add(copy.id);
      }

      selectedNodeIds = newSelectedIds;
      selectedEntityId = Array.from(newSelectedIds)[0] || null;
      if (selectedEntityId) {
        store.setSelection({ type: 'node3d', sceneId: sceneData.id, id: selectedEntityId });
      }
    });
    updateSelectionUI();
    rebuildEntities();
    updateGizmoAttachment();
  }

  function duplicateSelectedNodes() {
    copySelectedNodes();
    pasteNodes();
  }

  // Raccourcis clavier
  function onKeyDown(e) {
    if (isDisposed || !isActive) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

    if (e.key === 'Control') {
      applySnapping(true);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setLevel(activeLevel + 1);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setLevel(activeLevel - 1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelectedNodes();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteNodes();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelectedNodes();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedEntityId || selectedNodeIds.size > 0) {
        e.preventDefault();
        deleteSelectedEntity();
      }
    } else if (e.key.toLowerCase() === 'w') {
      setGizmoMode('translate');
    } else if (e.key.toLowerCase() === 'e') {
      setGizmoMode('rotate');
    } else if (e.key.toLowerCase() === 'r') {
      setGizmoMode('scale');
    } else if (e.key.toLowerCase() === 'q') {
      toggleGizmoSpace();
    }
  }

  function onKeyUp(e) {
    if (e.key === 'Control') {
      applySnapping(false);
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // --- Initialisation Three.js Viewport ---
  const viewportContainer = container.querySelector('#pf-s3d-viewport');
  const marqueeEl = container.querySelector('#pf-s3d-marquee');
  let scene, camera, renderer, ThreeLib;
  let gridHelper;
  let blockGroup, entityGroup;
  let transformControls = null;
  let transformHelper = null;
  let ro = null;
  let renderLoop = null;
  const cubeGeo = { geo: null };
  const materialCache = new Map();
  const disposables = [];

  function getMaterial(color) {
    if (!materialCache.has(color)) {
      materialCache.set(color, new ThreeLib.MeshLambertMaterial({ color, flatShading: true }));
    }
    return materialCache.get(color);
  }

  function blockColor(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return palette[((v % palette.length) + palette.length) % palette.length];
    if (typeof v === 'string' && v.charAt(0) === '#') return v;
    if (typeof v === 'string' && /^[0-9a-f]$/i.test(v)) return palette[parseInt(v, 16) % palette.length];
    return palette[6];
  }

  async function initThree() {
    ThreeLib = await import('three');
    const { TransformControls } = await import('three/addons/controls/TransformControls.js');
    if (isDisposed) return;

    scene = new ThreeLib.Scene();
    scene.background = new ThreeLib.Color('#191c28');

    const width = viewportContainer.clientWidth || 400;
    const height = viewportContainer.clientHeight || 300;

    camera = new ThreeLib.PerspectiveCamera(55, width / height, 0.1, 500);
    camera.position.set(16, 16, 20);
    camera.lookAt(0, 0, 0);

    renderer = new ThreeLib.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewportContainer.appendChild(renderer.domElement);

    // Lumieres
    const amb = new ThreeLib.AmbientLight(0xffffff, 0.75);
    scene.add(amb);
    const dir = new ThreeLib.DirectionalLight(0xffeedd, 0.95);
    dir.position.set(15, 25, 20);
    scene.add(dir);

    // Grille de travail a l'etage Y actif
    gridHelper = new ThreeLib.GridHelper(32, 32, 0x41a6f6, 0x333c57);
    gridHelper.position.y = activeLevel;
    scene.add(gridHelper);

    // Groupes pour les blocs et les entites
    blockGroup = new ThreeLib.Group();
    scene.add(blockGroup);
    entityGroup = new ThreeLib.Group();
    scene.add(entityGroup);

    cubeGeo.geo = new ThreeLib.BoxGeometry(1, 1, 1);

    // Curseur de survol
    const cursorGeo = new ThreeLib.BoxGeometry(1.02, 1.02, 1.02);
    const cursorMat = new ThreeLib.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7 });
    selWireMat = new ThreeLib.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    disposables.push(cubeGeo.geo, cursorGeo, cursorMat, selWireMat, gridHelper.geometry, gridHelper.material);
    const cursorBox = new ThreeLib.Mesh(cursorGeo, cursorMat);
    cursorBox.visible = false;
    scene.add(cursorBox);

    // TransformControls (Gizmos de translation, rotation, echelle)
    transformControls = new TransformControls(camera, renderer.domElement);
    transformHelper = transformControls.getHelper ? transformControls.getHelper() : transformControls;
    scene.add(transformHelper);
    transformHelper.visible = false;
    applySnapping();

    transformControls.addEventListener('dragging-changed', (event) => {
      isTransformDragging = event.value;
      if (event.value) {
        // Debut du deplacement
        dragInitialTransforms.clear();
        const ids = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds) : (selectedEntityId ? [selectedEntityId] : []);
        for (const id of ids) {
          const node = (sceneData.nodes || []).find((n) => n.id === id);
          if (node) {
            dragInitialTransforms.set(id, {
              position: [...(node.position || [0, 0, 0])],
              rotation: [...(node.rotation || [0, 0, 0])],
              scale: [...(node.scale || [1, 1, 1])],
            });
          }
        }
      } else {
        // Fin du deplacement : sauvegarde atomique dans store.update
        commitTransformFromGizmo();
      }
    });

    transformControls.addEventListener('change', () => {
      if (!isTransformDragging) return;
      const activeMesh = transformControls.object;
      if (!activeMesh) return;
      const activeId = activeMesh.userData?.entityId;
      const initial = dragInitialTransforms.get(activeId);
      if (!initial) return;

      const dx = activeMesh.position.x - initial.position[0];
      const dy = activeMesh.position.y - initial.position[1];
      const dz = activeMesh.position.z - initial.position[2];

      for (const child of entityGroup.children) {
        const id = child.userData?.entityId;
        if (id && id !== activeId && selectedNodeIds.has(id)) {
          const initOther = dragInitialTransforms.get(id);
          if (initOther && gizmoMode === 'translate') {
            child.position.set(initOther.position[0] + dx, initOther.position[1] + dy, initOther.position[2] + dz);
          }
        }
      }
    });

    // Rendu des blocs et des entites
    rebuildBlocks();
    rebuildEntities();
    updateGizmoAttachment();

    // Controles orbite / deplacement
    let isOrbiting = false;
    let prevMouseX = 0, prevMouseY = 0;
    let camRadius = 28;
    let camTheta = Math.PI / 4;
    let camPhi = Math.PI / 6;
    const camTarget = new ThreeLib.Vector3(0, 0, 0);

    function updateCamera() {
      camRadius = Math.max(6, Math.min(120, camRadius));
      camPhi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, camPhi));

      camera.position.x = camTarget.x + camRadius * Math.sin(camTheta) * Math.cos(camPhi);
      camera.position.y = camTarget.y + camRadius * Math.sin(camPhi);
      camera.position.z = camTarget.z + camRadius * Math.cos(camTheta) * Math.cos(camPhi);
      camera.lookAt(camTarget);
    }
    updateCamera();

    const canvas = renderer.domElement;
    canvas.oncontextmenu = (e) => e.preventDefault();

    let isMarquee = false;
    let marqueeStartX = 0, marqueeStartY = 0;

    canvas.onpointerdown = (e) => {
      if (isTransformDragging) return;
      // Ne pas intercepter si le pointeur est sur le gizmo
      if (transformControls && transformControls.axis !== null) return;

      if (e.button === 2 || e.button === 1 || (e.altKey && e.button === 0)) {
        isOrbiting = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 0) {
        const { hitEntity, hitBlock } = getRaycastHits(e);
        if (activeTool === 'select' && !hitEntity && !hitBlock) {
          // Debut de rectangle de selection sur le fond vide
          isMarquee = true;
          marqueeStartX = e.clientX;
          marqueeStartY = e.clientY;
          marqueeEl.style.left = `${e.clientX}px`;
          marqueeEl.style.top = `${e.clientY}px`;
          marqueeEl.style.width = '0px';
          marqueeEl.style.height = '0px';
          marqueeEl.style.display = 'block';
          canvas.setPointerCapture(e.pointerId);
        } else {
          handlePointerClick(e);
        }
      }
    };

    canvas.onpointermove = (e) => {
      if (isOrbiting) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        camTheta -= dx * 0.01;
        camPhi += dy * 0.01;
        updateCamera();
      } else if (isMarquee) {
        const minX = Math.min(marqueeStartX, e.clientX);
        const minY = Math.min(marqueeStartY, e.clientY);
        const w = Math.abs(e.clientX - marqueeStartX);
        const h = Math.abs(e.clientY - marqueeStartY);
        const rect = viewportContainer.getBoundingClientRect();
        marqueeEl.style.left = `${minX - rect.left}px`;
        marqueeEl.style.top = `${minY - rect.top}px`;
        marqueeEl.style.width = `${w}px`;
        marqueeEl.style.height = `${h}px`;
      } else {
        handlePointerHover(e, cursorBox);
      }
    };

    canvas.onpointerup = (e) => {
      if (isOrbiting) {
        isOrbiting = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
      } else if (isMarquee) {
        isMarquee = false;
        marqueeEl.style.display = 'none';
        try { canvas.releasePointerCapture(e.pointerId); } catch {}

        const minX = Math.min(marqueeStartX, e.clientX);
        const maxX = Math.max(marqueeStartX, e.clientX);
        const minY = Math.min(marqueeStartY, e.clientY);
        const maxY = Math.max(marqueeStartY, e.clientY);

        if (maxX - minX > 6 && maxY - minY > 6) {
          const rect = canvas.getBoundingClientRect();
          const newSel = e.shiftKey ? new Set(selectedNodeIds) : new Set();

          for (const child of entityGroup.children) {
            const id = child.userData?.entityId;
            if (!id) continue;
            const p = child.position.clone();
            p.project(camera);
            const sx = ((p.x + 1) * rect.width) / 2 + rect.left;
            const sy = ((-p.y + 1) * rect.height) / 2 + rect.top;

            if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
              newSel.add(id);
            }
          }

          selectedNodeIds = newSel;
          selectedEntityId = Array.from(newSel)[0] || null;
          if (selectedEntityId) {
            store.setSelection({ type: 'node3d', sceneId: sceneData.id, id: selectedEntityId });
          } else {
            store.setSelection(null);
          }
          updateSelectionUI();
          rebuildEntities();
          updateGizmoAttachment();
        } else if (!e.shiftKey) {
          selectedNodeIds.clear();
          selectedEntityId = null;
          store.setSelection(null);
          updateSelectionUI();
          rebuildEntities();
          updateGizmoAttachment();
        }
      }
    };

    canvas.onwheel = (e) => {
      e.preventDefault();
      camRadius += e.deltaY * 0.03;
      updateCamera();
    };

    ro = new ResizeObserver(() => {
      if (isDisposed) return;
      const w = viewportContainer.clientWidth || 400;
      const h = viewportContainer.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(viewportContainer);

    renderLoop = function loop() {
      animId = null;
      if (isDisposed || !isActive) return;
      animId = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    renderLoop();
  }

  let selWireMat = null;

  function updateGizmoAttachment() {
    if (!transformControls) return;
    if (activeTool !== 'select' || !selectedEntityId) {
      transformControls.detach();
      if (transformHelper) transformHelper.visible = false;
      return;
    }

    const mesh = entityGroup.children.find((m) => m.userData?.entityId === selectedEntityId);
    if (mesh) {
      transformControls.attach(mesh);
      transformControls.setMode(gizmoMode);
      transformControls.setSpace(gizmoSpace);
      applySnapping();
      if (transformHelper) transformHelper.visible = true;
    } else {
      transformControls.detach();
      if (transformHelper) transformHelper.visible = false;
    }
  }

  function commitTransformFromGizmo() {
    const ids = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds) : (selectedEntityId ? [selectedEntityId] : []);
    if (!ids.length) return;

    commit((sc) => {
      sc.nodes = sc.nodes || [];
      sc.entities = sc.entities || [];

      for (const id of ids) {
        const node = sc.nodes.find((n) => n.id === id);
        const mesh = entityGroup.children.find((m) => m.userData?.entityId === id);
        if (!node || !mesh) continue;

        node.position = [
          Math.round(mesh.position.x * 100) / 100,
          Math.round(mesh.position.y * 100) / 100,
          Math.round(mesh.position.z * 100) / 100,
        ];
        node.rotation = [
          Math.round(mesh.rotation.x * (180 / Math.PI) * 10) / 10,
          Math.round(mesh.rotation.y * (180 / Math.PI) * 10) / 10,
          Math.round(mesh.rotation.z * (180 / Math.PI) * 10) / 10,
        ];
        node.scale = [
          Math.round((mesh.scale.x / 0.9) * 100) / 100,
          Math.round((mesh.scale.y / 0.9) * 100) / 100,
          Math.round((mesh.scale.z / 0.9) * 100) / 100,
        ];

        // Synchronisation de l'entite si c'est un mesh
        const ent = sc.entities.find((e) => e.id === id);
        if (ent) {
          ent.x = node.position[0];
          ent.y = node.position[1];
          ent.z = node.position[2];
          ent.rotationY = node.rotation[1];
        }
      }
    });

    updateSelectionUI();
  }

  function rebuildBlocks() {
    while (blockGroup.children.length > 0) {
      blockGroup.remove(blockGroup.children[0]);
    }

    for (const [key, value] of grid.blocks.entries()) {
      const { x, y, z } = GridMap3D.parseKey(key);
      const mesh = new ThreeLib.Mesh(cubeGeo.geo, getMaterial(blockColor(value)));
      mesh.position.set(x, y, z);
      mesh.userData = { blockKey: key, x, y, z };
      blockGroup.add(mesh);
    }

    container.querySelector('#pf-s3d-stats').textContent = `${grid.blocks.size} blocs`;
  }

  function rebuildEntities() {
    while (entityGroup.children.length > 0) {
      entityGroup.remove(entityGroup.children[0]);
    }

    const nodes = (sceneData.nodes && sceneData.nodes.length > 0) ? sceneData.nodes : (sceneData.entities || []).map((ent) => ({
      id: ent.id,
      name: 'Entity',
      kind: 'mesh',
      parent: null,
      position: [ent.x, ent.y, ent.z],
      rotation: [0, ent.rotationY || 0, 0],
      scale: [1, 1, 1],
      visible: ent.visible !== false,
      locked: !!ent.locked,
      objectId: ent.objectId,
      props: ent.props,
    }));

    nodes.forEach((node) => {
      if (node.visible === false) return;
      const objDef = (store.project?.objects || []).find((o) => o.id === node.objectId);
      const color = objDef?.color || '#ffcd75';
      const pos = Array.isArray(node.position) ? node.position : [0, 0, 0];
      const scl = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
      const rot = Array.isArray(node.rotation) ? node.rotation : [0, 0, 0];

      let mat = getMaterial(color);
      if (node.kind === 'light') {
        mat = getMaterial('#ffea75');
      } else if (node.kind === 'camera') {
        mat = getMaterial('#41a6f6');
      } else if (node.kind === 'collision') {
        mat = getMaterial('#ef7d57');
      }

      const mesh = new ThreeLib.Mesh(cubeGeo.geo, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.rotation.set(rot[0] * (Math.PI / 180), rot[1] * (Math.PI / 180), rot[2] * (Math.PI / 180));
      mesh.scale.set(scl[0] * 0.9, scl[1] * 0.9, scl[2] * 0.9);
      mesh.userData = { entityId: node.id, node };

      // Marqueur de selection
      const isSelected = selectedNodeIds.has(node.id) || node.id === selectedEntityId;
      if (isSelected) {
        const selWire = new ThreeLib.Mesh(cubeGeo.geo, selWireMat);
        selWire.scale.set(1.05, 1.05, 1.05);
        mesh.add(selWire);
      }

      entityGroup.add(mesh);
    });
  }

  function getRaycastHits(e) {
    if (!camera || !ThreeLib || !renderer) return { hitBlock: null, hitGrid: null, hitEntity: null };
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new ThreeLib.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new ThreeLib.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Entites
    const entHits = raycaster.intersectObjects(entityGroup.children, true);
    let hitEntity = null;
    if (entHits.length > 0) {
      let cur = entHits[0].object;
      while (cur && cur.parent && cur.parent !== entityGroup) cur = cur.parent;
      if (cur?.userData?.entityId) hitEntity = { id: cur.userData.entityId, mesh: cur };
    }

    // Blocs
    const blockHits = raycaster.intersectObjects(blockGroup.children, false);
    const hitBlock = blockHits.length > 0 ? blockHits[0] : null;

    // Plan horizontal a Y = activeLevel
    const plane = new ThreeLib.Plane(new ThreeLib.Vector3(0, 1, 0), -activeLevel);
    const hitGrid = new ThreeLib.Vector3();
    const hasGridHit = raycaster.ray.intersectPlane(plane, hitGrid);

    return { hitBlock, hitGrid: hasGridHit ? hitGrid : null, hitEntity };
  }

  function handlePointerHover(e, cursorBox) {
    if (!cursorBox || activeTool === 'select') {
      if (cursorBox) cursorBox.visible = false;
      return;
    }
    const { hitBlock, hitGrid } = getRaycastHits(e);
    if (hitBlock) {
      const norm = hitBlock.face?.normal || new ThreeLib.Vector3(0, 1, 0);
      const pos = hitBlock.object.position.clone();
      if (activeTool === 'block') {
        pos.add(norm);
      }
      cursorBox.position.copy(pos);
      cursorBox.visible = true;
    } else if (hitGrid && activeTool === 'block') {
      const gx = Math.round(hitGrid.x);
      const gz = Math.round(hitGrid.z);
      cursorBox.position.set(gx, activeLevel, gz);
      cursorBox.visible = true;
    } else {
      cursorBox.visible = false;
    }
  }

  function handlePointerClick(e) {
    const { hitBlock, hitGrid, hitEntity } = getRaycastHits(e);

    if (activeTool === 'select') {
      if (hitEntity) {
        if (e.shiftKey) {
          if (selectedNodeIds.has(hitEntity.id)) {
            selectedNodeIds.delete(hitEntity.id);
            selectedEntityId = Array.from(selectedNodeIds)[0] || null;
          } else {
            selectedNodeIds.add(hitEntity.id);
            selectedEntityId = hitEntity.id;
          }
        } else {
          selectedNodeIds = new Set([hitEntity.id]);
          selectedEntityId = hitEntity.id;
        }

        if (selectedEntityId) {
          store.setSelection({ type: 'node3d', sceneId: sceneData.id, id: selectedEntityId });
        } else {
          store.setSelection(null);
        }

        updateSelectionUI();
        rebuildEntities();
        updateGizmoAttachment();
        return;
      } else if (!e.shiftKey) {
        selectedNodeIds.clear();
        selectedEntityId = null;
        store.setSelection(null);
        updateSelectionUI();
        rebuildEntities();
        updateGizmoAttachment();
      }
      return;
    }

    if (activeTool === 'block') {
      let bx = 0, by = activeLevel, bz = 0;
      if (hitBlock) {
        const norm = hitBlock.face?.normal || new ThreeLib.Vector3(0, 1, 0);
        bx = hitBlock.object.position.x + norm.x;
        by = hitBlock.object.position.y + norm.y;
        bz = hitBlock.object.position.z + norm.z;
      } else if (hitGrid) {
        bx = Math.round(hitGrid.x);
        by = activeLevel;
        bz = Math.round(hitGrid.z);
      }
      grid.setBlock(bx, by, bz, activeColor);
      rebuildBlocks();
      commit();
    } else if (activeTool === 'erase') {
      if (hitBlock) {
        const key = hitBlock.object.userData?.blockKey;
        if (key) {
          grid.blocks.delete(key);
          rebuildBlocks();
          commit();
        }
      }
    } else if (activeTool === 'entity') {
      if (!selectedObjectId) return;
      let ex = 0, ey = activeLevel, ez = 0;
      if (hitBlock) {
        const norm = hitBlock.face?.normal || new ThreeLib.Vector3(0, 1, 0);
        ex = hitBlock.object.position.x + norm.x;
        ey = hitBlock.object.position.y + norm.y;
        ez = hitBlock.object.position.z + norm.z;
      } else if (hitGrid) {
        ex = Math.round(hitGrid.x);
        ey = activeLevel;
        ez = Math.round(hitGrid.z);
      }

      const id = `node3d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const objName = (store.project?.objects || []).find((o) => o.id === selectedObjectId)?.name || 'Mesh';
      const newNode = {
        id,
        name: objName,
        kind: 'mesh',
        parent: null,
        position: [ex, ey, ez],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
        locked: false,
        objectId: selectedObjectId,
        materialId: null,
        props: {},
      };
      const newEnt = {
        id,
        objectId: selectedObjectId,
        x: ex,
        y: ey,
        z: ez,
        rotationY: 0,
        props: {},
      };
      commit((sc) => {
        if (!Array.isArray(sc.nodes)) sc.nodes = [];
        sc.nodes.push(newNode);
        if (!Array.isArray(sc.entities)) sc.entities = [];
        sc.entities.push(newEnt);
      });
      selectedEntityId = id;
      selectedNodeIds = new Set([id]);
      store.setSelection({ type: 'node3d', sceneId: sceneData.id, id });
      updateSelectionUI();
      rebuildEntities();
      updateGizmoAttachment();
    }
  }

  function updateSelectionUI() {
    const details = container.querySelector('#pf-s3d-sel-details');
    const delBtn = container.querySelector('#pf-s3d-delete-ent');

    if (selectedNodeIds.size > 1) {
      details.innerHTML = `<div><strong>${selectedNodeIds.size} objets selectionnes</strong></div>`;
      delBtn.style.display = 'block';
      return;
    }

    const node = (sceneData.nodes || []).find((i) => i.id === selectedEntityId) ||
                 (sceneData.entities || []).find((i) => i.id === selectedEntityId);
    if (!node) {
      details.textContent = 'Aucun objet selectionne';
      delBtn.style.display = 'none';
      return;
    }

    const obj = (store.project?.objects || []).find((o) => o.id === node.objectId);
    const num = (v) => (Number.isFinite(v) ? v.toFixed(1) : '?');
    const pos = Array.isArray(node.position) ? node.position : [node.x ?? 0, node.y ?? 0, node.z ?? 0];
    details.innerHTML = `
      <div><strong>${esc(node.name || obj?.name || 'Objet 3D')}</strong> <small style="color:var(--fg-2);">(${esc(node.kind || 'mesh')})</small></div>
      <div>Position : (${num(pos[0])}, ${num(pos[1])}, ${num(pos[2])})</div>
    `;
    delBtn.style.display = 'block';
  }
  container.querySelector('#pf-s3d-delete-ent').onclick = () => deleteSelectedEntity();

  function deleteSelectedEntity() {
    const ids = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds) : (selectedEntityId ? [selectedEntityId] : []);
    if (!ids.length) return;

    commit((sc) => {
      sc.nodes = (sc.nodes || []).filter((i) => !ids.includes(i.id));
      sc.entities = (sc.entities || []).filter((i) => !ids.includes(i.id));
    });

    selectedNodeIds.clear();
    selectedEntityId = null;
    store.setSelection(null);
    updateSelectionUI();
    rebuildEntities();
    updateGizmoAttachment();
  }

  initThree();

  return {
    dispose() {
      isDisposed = true;
      isActive = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      offLoad();
      offChange();
      offSel();
      ro?.disconnect();
      if (transformControls) {
        transformControls.dispose();
      }
      materialCache.forEach((m) => m.dispose());
      materialCache.clear();
      disposables.forEach((d) => d?.dispose?.());
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss?.();
        renderer.domElement.remove();
      }
    },
    onShow() {
      isActive = true;
      if (store.ui) store.ui.selectedScene3DId = refId;
      if (renderLoop && !animId) renderLoop();
    },
    onHide() {
      isActive = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    },
  };
}
