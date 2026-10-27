/**
 * PixelForge Studio — Editeur de Scene 3D (GridMap, Entites, Gizmos, Navigation Godot 4 et Test F6)
 * Permet de construire des niveaux 3D a la souris, de peindre la GridMap par etage,
 * de positionner des entites d'objets, de selectionner (simple / multiple / rectangle),
 * de manipuler les objets via gizmos TransformControls (W/E/R, aimantation, local/monde),
 * et de naviguer librement facon Godot 4 : orbite, vol libre (clic droit + ZQSD),
 * centrage F, vues de face/dessus/cote (pave num 1/3/7) et bascule perspective/orthographique (pave 5).
 */

import { GridMap3D } from './gridmap.js';
import { Terrain3D } from './terrain.js';
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

  // Navigation Vue 3D & Caméra
  let isOrtho = false;
  let isFlycamActive = false;
  let camYaw = 0;
  let camPitch = 0;
  const keysFlycam = { forward: false, backward: false, left: false, right: false, up: false, down: false, boost: false };

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
        <button class="pf-scene3d-btn" data-tool="spawn-play" title="Cliquer pour placer le joueur n'importe ou et jouer immediatement">Placer &amp; Jouer</button>
        <span style="width:1px;height:18px;background:var(--border);margin:0 4px;"></span>
        <button class="pf-scene3d-btn" data-tool="terrain-raise" title="Monter le terrain (sculpture)">Monter terrain</button>
        <button class="pf-scene3d-btn" data-tool="terrain-lower" title="Creuser le terrain (sculpture)">Creuser terrain</button>
        <button class="pf-scene3d-btn" data-tool="terrain-smooth" title="Lisser le terrain">Lisser terrain</button>
        <button class="pf-scene3d-btn" data-tool="terrain-paint" title="Peindre le terrain">Peindre terrain</button>
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
        <button class="pf-scene3d-btn" id="pf-s3d-focus-btn" title="Centrer la vue sur la selection (F)">${getIconSvg('zoom', 12)} Focus (F)</button>
        <button class="pf-scene3d-btn" id="pf-s3d-proj-btn" title="Basculer Perspective / Orthographique (Pave 5)">Persp</button>
        <span style="width:1px;height:18px;background:var(--border);margin:0 4px;"></span>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--fg-1);">
          <span>Etage Y :</span>
          <button class="pf-scene3d-btn" id="pf-s3d-lvl-down" style="padding:2px 6px;">-</button>
          <span id="pf-s3d-lvl-label" style="font-weight:700;min-width:20px;text-align:center;">${activeLevel}</span>
          <button class="pf-scene3d-btn" id="pf-s3d-lvl-up" style="padding:2px 6px;">+</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;">
        <button class="pf-scene3d-btn" id="pf-s3d-play-cam-btn" title="Jouer depuis la vue de la camera (F6)">Vue (F6)</button>
        <button class="pf-scene3d-btn primary" id="pf-s3d-play-btn" title="Tester cette scene (F6)">${getIconSvg('playScene', 12)} Tester la scene (F6)</button>
        <span id="pf-s3d-stats" style="font-size:11px;color:var(--fg-2);">0 blocs</span>
      </div>
    </div>

    <div class="pf-scene3d-workspace">
      <div class="pf-scene3d-viewport" id="pf-s3d-viewport">
        <div class="pf-scene3d-overlay-hint">Clic Droit : Orbite | Clic Droit + ZQSD : Vol libre | F : Focus | 1/3/7 : Vues | 5 : Persp/Ortho | W/E/R : Gizmos | Maj+Clic : Multi-select</div>
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
    if (axesHelper) axesHelper.position.y = activeLevel + 0.01;
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

  const playCamBtn = container.querySelector('#pf-s3d-play-cam-btn');
  if (playCamBtn) {
    playCamBtn.onclick = () => {
      store.ui.playScene3DId = sceneData.id;
      if (camera) {
        store.ui.editorCamera3D = {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [camTarget.x, camTarget.y, camTarget.z],
          sceneId: sceneData.id,
        };
      }
      window.dispatchEvent(new CustomEvent('pixelforge:play-from-camera'));
    };
  }

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
      rebuildLightsAndEnvironment();
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
      rebuildLightsAndEnvironment();
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

  // --- Initialisation Three.js Viewport ---
  const viewportContainer = container.querySelector('#pf-s3d-viewport');
  const marqueeEl = container.querySelector('#pf-s3d-marquee');
  let scene, camera, cameraPersp, cameraOrtho, renderer, ThreeLib;
  let gridHelper, axesHelper;
  let blockGroup, entityGroup, lightGroup, ambLight, dirLight;
  let transformControls = null;
  let transformHelper = null;
  let ro = null;
  let renderLoop = null;
  const cubeGeo = { geo: null };
  const materialCache = new Map();
  const disposables = [];

  let camRadius = 28;
  let camTheta = Math.PI / 4;
  let camPhi = Math.PI / 6;
  const camTarget = { x: 0, y: 0, z: 0 };

  function updateOrbitCamera() {
    if (!camera || !ThreeLib) return;
    camRadius = Math.max(4, Math.min(150, camRadius));
    camPhi = Math.max(0.02, Math.min(Math.PI / 2 - 0.02, camPhi));

    const cx = camTarget.x + camRadius * Math.sin(camTheta) * Math.cos(camPhi);
    const cy = camTarget.y + camRadius * Math.sin(camPhi);
    const cz = camTarget.z + camRadius * Math.cos(camTheta) * Math.cos(camPhi);

    if (cameraPersp) {
      cameraPersp.position.set(cx, cy, cz);
      cameraPersp.lookAt(camTarget.x, camTarget.y, camTarget.z);
    }
    if (cameraOrtho) {
      cameraOrtho.position.set(cx, cy, cz);
      cameraOrtho.lookAt(camTarget.x, camTarget.y, camTarget.z);
      const w = viewportContainer.clientWidth || 400;
      const h = viewportContainer.clientHeight || 300;
      const aspect = w / h;
      const d = camRadius;
      cameraOrtho.left = (-d * aspect) / 2;
      cameraOrtho.right = (d * aspect) / 2;
      cameraOrtho.top = d / 2;
      cameraOrtho.bottom = -d / 2;
      cameraOrtho.updateProjectionMatrix();
    }
  }

  function focusSelection() {
    const ids = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds) : (selectedEntityId ? [selectedEntityId] : []);
    if (ids.length > 0) {
      let sumX = 0, sumY = 0, sumZ = 0;
      let count = 0;
      for (const id of ids) {
        const node = (sceneData.nodes || []).find((n) => n.id === id);
        if (node && Array.isArray(node.position)) {
          sumX += node.position[0];
          sumY += node.position[1];
          sumZ += node.position[2];
          count++;
        }
      }
      if (count > 0) {
        camTarget.x = sumX / count;
        camTarget.y = sumY / count;
        camTarget.z = sumZ / count;
        camRadius = 12;
        updateOrbitCamera();
        return;
      }
    }
    camTarget.x = 0;
    camTarget.y = activeLevel;
    camTarget.z = 0;
    camRadius = 24;
    updateOrbitCamera();
  }

  function setView(viewName) {
    if (viewName === 'front') {
      camTheta = 0;
      camPhi = 0.05;
      updateOrbitCamera();
    } else if (viewName === 'side') {
      camTheta = Math.PI / 2;
      camPhi = 0.05;
      updateOrbitCamera();
    } else if (viewName === 'top') {
      camTheta = 0;
      camPhi = Math.PI / 2 - 0.02;
      updateOrbitCamera();
    } else if (viewName === 'toggle-ortho') {
      toggleProjection();
    }
  }

  function toggleProjection() {
    isOrtho = !isOrtho;
    if (cameraPersp && cameraOrtho) {
      if (isOrtho) {
        cameraOrtho.position.copy(cameraPersp.position);
        cameraOrtho.rotation.copy(cameraPersp.rotation);
        camera = cameraOrtho;
      } else {
        cameraPersp.position.copy(cameraOrtho.position);
        cameraPersp.rotation.copy(cameraOrtho.rotation);
        camera = cameraPersp;
      }
      if (transformControls) {
        transformControls.camera = camera;
      }
      updateOrbitCamera();
    }
    const projBtn = container.querySelector('#pf-s3d-proj-btn');
    if (projBtn) projBtn.textContent = isOrtho ? 'Ortho' : 'Persp';
  }

  container.querySelector('#pf-s3d-focus-btn').onclick = focusSelection;
  container.querySelector('#pf-s3d-proj-btn').onclick = toggleProjection;

  // Evenements globaux de raccourcis
  const onFocusEvent = () => { if (isActive && !isDisposed) focusSelection(); };
  const onViewEvent = (e) => { if (isActive && !isDisposed) setView(e.detail); };
  window.addEventListener('pixelforge:view3d:focus', onFocusEvent);
  window.addEventListener('pixelforge:view3d:view', onViewEvent);

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
    } else if (isFlycamActive) {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'z') keysFlycam.forward = true;
      else if (k === 's') keysFlycam.backward = true;
      else if (k === 'a' || k === 'q') keysFlycam.left = true;
      else if (k === 'd') keysFlycam.right = true;
      else if (k === 'e' || k === ' ') keysFlycam.up = true;
      else if (k === 'c') keysFlycam.down = true;
      else if (e.shiftKey) keysFlycam.boost = true;
    } else {
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        focusSelection();
      } else if (e.code === 'Numpad1' || k === '1') {
        e.preventDefault();
        setView('front');
      } else if (e.code === 'Numpad3' || k === '3') {
        e.preventDefault();
        setView('side');
      } else if (e.code === 'Numpad7' || k === '7') {
        e.preventDefault();
        setView('top');
      } else if (e.code === 'Numpad5' || k === '5') {
        e.preventDefault();
        toggleProjection();
      } else if (k === 'w') {
        setGizmoMode('translate');
      } else if (k === 'e') {
        setGizmoMode('rotate');
      } else if (k === 'r') {
        setGizmoMode('scale');
      } else if (k === 'q') {
        toggleGizmoSpace();
      }
    }
  }

  function onKeyUp(e) {
    if (e.key === 'Control') {
      applySnapping(false);
    }
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'z') keysFlycam.forward = false;
    else if (k === 's') keysFlycam.backward = false;
    else if (k === 'a' || k === 'q') keysFlycam.left = false;
    else if (k === 'd') keysFlycam.right = false;
    else if (k === 'e' || k === ' ') keysFlycam.up = false;
    else if (k === 'c') keysFlycam.down = false;
    if (!e.shiftKey) keysFlycam.boost = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

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
    const aspect = width / height;

    cameraPersp = new ThreeLib.PerspectiveCamera(55, aspect, 0.1, 500);
    const frustumSize = 24;
    cameraOrtho = new ThreeLib.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      500
    );
    camera = cameraPersp;

    renderer = new ThreeLib.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewportContainer.appendChild(renderer.domElement);

    // Lumieres & Ambiance
    ambLight = new ThreeLib.AmbientLight(0xffffff, 0.75);
    scene.add(ambLight);
    dirLight = new ThreeLib.DirectionalLight(0xffeedd, 0.95);
    dirLight.position.set(15, 25, 20);
    scene.add(dirLight);

    lightGroup = new ThreeLib.Group();
    scene.add(lightGroup);

    // Grille de travail a l'etage Y actif (etendue 64x64)
    gridHelper = new ThreeLib.GridHelper(64, 64, 0x41a6f6, 0x272c3d);
    gridHelper.position.y = activeLevel;
    scene.add(gridHelper);

    // Repere d'axes a l'origine de l'etage (Rouge = X, Vert = Y, Bleu = Z)
    axesHelper = new ThreeLib.AxesHelper(3);
    axesHelper.position.set(0, activeLevel + 0.01, 0);
    scene.add(axesHelper);

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
    disposables.push(cubeGeo.geo, cursorGeo, cursorMat, selWireMat, gridHelper.geometry, gridHelper.material, axesHelper.geometry, axesHelper.material);
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

    // Rendu des blocs, entites, lumieres et ambiance
    rebuildBlocks();
    rebuildEntities();
    rebuildLightsAndEnvironment();
    updateGizmoAttachment();
    updateOrbitCamera();

    // Controles orbite / vol libre
    let isOrbiting = false;
    let prevMouseX = 0, prevMouseY = 0;

    const canvas = renderer.domElement;
    canvas.oncontextmenu = (e) => e.preventDefault();

    let isMarquee = false;
    let marqueeStartX = 0, marqueeStartY = 0;

    canvas.onpointerdown = (e) => {
      if (isTransformDragging) return;
      if (transformControls && transformControls.axis !== null) return;

      if (e.button === 2) {
        // Clic droit : Vol libre (Flycam)
        isFlycamActive = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        const fwd = new ThreeLib.Vector3();
        camera.getWorldDirection(fwd);
        camYaw = Math.atan2(fwd.x, fwd.z);
        camPitch = Math.asin(Math.max(-0.99, Math.min(0.99, fwd.y)));
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 1 || (e.altKey && e.button === 0)) {
        // Clic milieu ou Alt+Clic : Orbite
        isOrbiting = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 0) {
        const { hitEntity, hitBlock } = getRaycastHits(e);
        if (activeTool === 'select' && !hitEntity && !hitBlock) {
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
      if (isFlycamActive) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        camYaw -= dx * 0.003;
        camPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, camPitch - dy * 0.003));

        const fwd = new ThreeLib.Vector3(
          Math.sin(camYaw) * Math.cos(camPitch),
          Math.sin(camPitch),
          Math.cos(camYaw) * Math.cos(camPitch)
        ).normalize();

        camera.lookAt(camera.position.clone().add(fwd));
        camTarget.x = camera.position.x + fwd.x * camRadius;
        camTarget.y = camera.position.y + fwd.y * camRadius;
        camTarget.z = camera.position.z + fwd.z * camRadius;
      } else if (isOrbiting) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        camTheta -= dx * 0.01;
        camPhi += dy * 0.01;
        updateOrbitCamera();
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
      if (isFlycamActive && e.button === 2) {
        isFlycamActive = false;
        keysFlycam.forward = false;
        keysFlycam.backward = false;
        keysFlycam.left = false;
        keysFlycam.right = false;
        keysFlycam.up = false;
        keysFlycam.down = false;
        keysFlycam.boost = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}

        const fwd = new ThreeLib.Vector3();
        camera.getWorldDirection(fwd);
        camTheta = Math.atan2(-fwd.x, -fwd.z);
        camPhi = Math.asin(Math.max(-0.99, Math.min(0.99, -fwd.y)));
      } else if (isOrbiting) {
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
      updateOrbitCamera();
    };

    ro = new ResizeObserver(() => {
      if (isDisposed) return;
      const w = viewportContainer.clientWidth || 400;
      const h = viewportContainer.clientHeight || 300;
      const a = w / h;
      if (cameraPersp) {
        cameraPersp.aspect = a;
        cameraPersp.updateProjectionMatrix();
      }
      if (cameraOrtho) {
        const d = camRadius;
        cameraOrtho.left = (-d * a) / 2;
        cameraOrtho.right = (d * a) / 2;
        cameraOrtho.top = d / 2;
        cameraOrtho.bottom = -d / 2;
        cameraOrtho.updateProjectionMatrix();
      }
      renderer.setSize(w, h);
    });
    ro.observe(viewportContainer);

    renderLoop = function loop() {
      animId = null;
      if (isDisposed || !isActive) return;
      animId = requestAnimationFrame(loop);

      // Mise a jour du deplacement Flycam a chaque trame
      if (isFlycamActive) {
        const speed = keysFlycam.boost ? 35 : 14;
        const fwd = new ThreeLib.Vector3();
        camera.getWorldDirection(fwd);
        const right = new ThreeLib.Vector3();
        right.crossVectors(fwd, camera.up).normalize();

        const move = new ThreeLib.Vector3();
        if (keysFlycam.forward) move.add(fwd);
        if (keysFlycam.backward) move.sub(fwd);
        if (keysFlycam.right) move.add(right);
        if (keysFlycam.left) move.sub(right);
        if (keysFlycam.up) move.y += 1;
        if (keysFlycam.down) move.y -= 1;

        if (move.lengthSq() > 0) {
          move.normalize();
          const dt = 0.016;
          camera.position.addScaledVector(move, speed * dt);
          camTarget.x = camera.position.x + fwd.x * camRadius;
          camTarget.y = camera.position.y + fwd.y * camRadius;
          camTarget.z = camera.position.z + fwd.z * camRadius;
        }
      }

      if (store.ui && camera) {
        store.ui.editorCamera3D = {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [camTarget.x, camTarget.y, camTarget.z],
          sceneId: sceneData?.id || null,
        };
      }

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

  function rebuildLightsAndEnvironment() {
    if (!scene || !ThreeLib) return;
    const env = sceneData?.environment || store.project?.environment || {};
    const bgColor = env.skyColor || '#1a1c2c';

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

    if (ambLight) {
      ambLight.color.set(env.ambientLight?.color || '#ffffff');
      ambLight.intensity = typeof env.ambientLight?.intensity === 'number' ? env.ambientLight.intensity : 0.6;
    }
    if (dirLight) {
      dirLight.color.set(env.directionalLight?.color || '#ffeedd');
      dirLight.intensity = typeof env.directionalLight?.intensity === 'number' ? env.directionalLight.intensity : 1.0;
      const dp = env.directionalLight?.position || [15, 25, 20];
      dirLight.position.set(dp[0], dp[1], dp[2]);

      const shadowsEnabled = !!(env.directionalLight?.castShadow || env.shadows?.enabled);
      if (renderer?.shadowMap) {
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
    }

    if (lightGroup) {
      while (lightGroup.children.length > 0) {
        lightGroup.remove(lightGroup.children[0]);
      }
      const lightNodes = (sceneData?.nodes || []).filter((n) => n.kind === 'light' && n.visible !== false).slice(0, 4);
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
          lightGroup.add(lObj);
          if (lObj.target) lightGroup.add(lObj.target);
        } else if (typeof ThreeLib.PointLight === 'function') {
          lObj = new ThreeLib.PointLight(lColor, lIntensity, lDist, lDecay);
          lObj.position.set(pos[0], pos[1], pos[2]);
          if (lp.castShadow && lObj.shadow) {
            lObj.castShadow = true;
            lObj.shadow.mapSize.width = 512;
            lObj.shadow.mapSize.height = 512;
          }
          lightGroup.add(lObj);
        }
      });
    }
  }

  function rebuildBlocks() {
    while (blockGroup.children.length > 0) {
      blockGroup.remove(blockGroup.children[0]);
    }

    for (const [key, value] of grid.blocks.entries()) {
      const { x, y, z } = GridMap3D.parseKey(key);
      const mesh = new ThreeLib.Mesh(cubeGeo.geo, getMaterial(blockColor(value)));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, y, z);
      mesh.userData = { blockKey: key, x, y, z };
      blockGroup.add(mesh);
    }

    if (sceneData.terrain && sceneData.terrain.enabled !== false) {
      const ter = new Terrain3D(sceneData.terrain);
      const tBlocks = ter.toSolidBlocks(-1);
      for (const [key, value] of Object.entries(tBlocks)) {
        if (grid.blocks.has(key)) continue;
        const { x, y, z } = GridMap3D.parseKey(key);
        if (y === Math.round(ter.getHeight(x, z))) {
          const mesh = new ThreeLib.Mesh(cubeGeo.geo, getMaterial(blockColor(value)));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(x, y, z);
          mesh.userData = { isTerrain: true, x, y, z, blockKey: key };
          blockGroup.add(mesh);
        }
      }
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
      const pos = Array.isArray(node.position) ? node.position : [0, 0, 0];
      const scl = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
      const rot = Array.isArray(node.rotation) ? node.rotation : [0, 0, 0];

      if (node.kind === 'prefab') {
        const pfb = (store.project?.prefabs3d || []).find((p) => p.id === node.prefabId || p.name === node.prefabId);
        const group = new ThreeLib.Group();
        group.position.set(pos[0], pos[1], pos[2]);
        group.rotation.set(rot[0] * (Math.PI / 180), rot[1] * (Math.PI / 180), rot[2] * (Math.PI / 180));
        group.scale.set(scl[0], scl[1], scl[2]);
        group.userData = { entityId: node.id, node, isPrefab: true };

        if (pfb && Array.isArray(pfb.nodes) && pfb.nodes.length > 0) {
          for (const c of pfb.nodes) {
            if (c.visible === false) continue;
            const cObj = (store.project?.objects || []).find((o) => o.id === c.objectId);
            const cMatDef = (store.project?.materials || []).find((m) => m.id === (c.materialId || cObj?.materialId));
            const cCol = cMatDef?.color || cObj?.color || '#a7f070';
            const cPos = Array.isArray(c.position) ? c.position : [0, 0, 0];
            const cRot = Array.isArray(c.rotation) ? c.rotation : [0, 0, 0];
            const cScl = Array.isArray(c.scale) ? c.scale : [1, 1, 1];

            const cMesh = new ThreeLib.Mesh(cubeGeo.geo, getMaterial(cCol));
            cMesh.castShadow = true;
            cMesh.receiveShadow = true;
            cMesh.position.set(cPos[0], cPos[1], cPos[2]);
            cMesh.rotation.set(cRot[0] * (Math.PI / 180), cRot[1] * (Math.PI / 180), cRot[2] * (Math.PI / 180));
            cMesh.scale.set(cScl[0] * 0.9, cScl[1] * 0.9, cScl[2] * 0.9);
            group.add(cMesh);
          }
        } else {
          const dummy = new ThreeLib.Mesh(cubeGeo.geo, getMaterial('#a7f070'));
          dummy.scale.set(0.9, 0.9, 0.9);
          group.add(dummy);
        }

        const isSelected = selectedNodeIds.has(node.id) || node.id === selectedEntityId;
        if (isSelected) {
          const selWire = new ThreeLib.Mesh(cubeGeo.geo, selWireMat);
          selWire.scale.set(1.05, 1.05, 1.05);
          group.add(selWire);
        }

        entityGroup.add(group);
        return;
      }

      const objDef = (store.project?.objects || []).find((o) => o.id === node.objectId);
      const matDef = (store.project?.materials || []).find((m) => m.id === (node.materialId || objDef?.materialId));
      const color = matDef?.color || objDef?.color || '#ffcd75';

      let mat = getMaterial(color);
      if (node.kind === 'light') {
        const lp = node.props || {};
        mat = getMaterial(lp.color || '#ffea75');
      } else if (node.kind === 'camera') {
        mat = getMaterial('#41a6f6');
      } else if (node.kind === 'collision') {
        mat = getMaterial('#ef7d57');
      }

      const mesh = new ThreeLib.Mesh(cubeGeo.geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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
      if (activeTool === 'block' || activeTool === 'spawn-play') {
        pos.add(norm);
      }
      cursorBox.position.copy(pos);
      cursorBox.visible = true;
    } else if (hitGrid && (activeTool === 'block' || activeTool === 'spawn-play')) {
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

    if (activeTool === 'spawn-play') {
      let sx = 0, sy = activeLevel, sz = 0;
      if (hitBlock) {
        const norm = hitBlock.face?.normal || new ThreeLib.Vector3(0, 1, 0);
        sx = hitBlock.object.position.x + norm.x;
        sy = hitBlock.object.position.y + norm.y;
        sz = hitBlock.object.position.z + norm.z;
      } else if (hitGrid) {
        sx = Math.round(hitGrid.x);
        sy = activeLevel;
        sz = Math.round(hitGrid.z);
      } else if (hitEntity) {
        sx = hitEntity.position[0];
        sy = hitEntity.position[1] + 1;
        sz = hitEntity.position[2];
      }
      store.ui.playScene3DId = sceneData.id;
      window.dispatchEvent(new CustomEvent('pixelforge:play-from-camera', {
        detail: { spawnPlayerPosition: [sx, sy, sz] },
      }));
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
    } else if (activeTool.startsWith('terrain-')) {
      let tx = 0, tz = 0;
      if (hitBlock) {
        tx = hitBlock.object.position.x;
        tz = hitBlock.object.position.z;
      } else if (hitGrid) {
        tx = Math.round(hitGrid.x);
        tz = Math.round(hitGrid.z);
      }
      store.update((proj) => {
        const sc = (proj.scenes3d || []).find((s) => s.id === sceneData.id);
        if (!sc) return;
        sc.terrain = sc.terrain || { enabled: true, width: 32, depth: 32, heights: {}, colors: {} };
        const t = new Terrain3D(sc.terrain);
        if (activeTool === 'terrain-raise') t.raise(tx, tz, 2, 1);
        else if (activeTool === 'terrain-lower') t.lower(tx, tz, 2, 1);
        else if (activeTool === 'terrain-smooth') t.smooth(tx, tz, 2, 0.5);
        else if (activeTool === 'terrain-paint') t.paint(tx, tz, 2, activeColor);
        sc.terrain = t.toProjectJSON(sc.terrain);
      }, 'scene3d');
      sceneData = findScene();
      rebuildBlocks();
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
      window.removeEventListener('pixelforge:view3d:focus', onFocusEvent);
      window.removeEventListener('pixelforge:view3d:view', onViewEvent);
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
