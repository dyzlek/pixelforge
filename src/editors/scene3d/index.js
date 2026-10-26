/**
 * PixelForge Studio — Editeur de Scene 3D (GridMap, Entites et Test F6)
 * Permet de construire des niveaux 3D a la souris, de peindre la GridMap par etage
 * et de positionner des entites d'objets.
 */

import { GridMap3D } from './gridmap.js';
import { getIconSvg } from '../../ui/icons.js';
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

  let grid = new GridMap3D(sceneData.gridmap);

  let activeTool = 'block'; // 'block' | 'erase' | 'entity' | 'select'
  let activeLevel = 0; // Etage Y
  let activeColor = 9; // index de palette (meme format que paint_gridmap)
  let isActive = true;
  let selectedObjectId = store.project?.objects?.[0]?.id || null;
  let selectedEntityId = null;
  let isDisposed = false;
  let animId = null;

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
        <button class="pf-scene3d-btn" data-tool="select" title="Selectionner / deplacer une entite">Selectionner</button>
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
        <div class="pf-scene3d-overlay-hint">Clic gauche : Editer | Clic droit / Molette : Orbite et Zoom | PageUp/Down : Changer d'etage</div>
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
          <div class="pf-scene3d-card-title">Entite selectionnee</div>
          <div id="pf-s3d-sel-details" style="color:var(--fg-2);">Aucune entite selectionnee</div>
          <button class="pf-scene3d-btn danger" id="pf-s3d-delete-ent" style="display:none;margin-top:4px;">Supprimer l'entite</button>
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
    };
  });

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

  // Lance le jeu sur cette scene (sans changer la scene de depart du projet)
  const playBtn = container.querySelector('#pf-s3d-play-btn');
  playBtn.onclick = () => {
    store.ui.playScene3DId = sceneData.id;
    window.dispatchEvent(new CustomEvent('pixelforge:play'));
  };

  // Toute modification passe par store.update : une entree d'annulation, prise AVANT le changement.
  // La grille locale est recopiee dans le projet ; mutate(scene) modifie les entites.
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

  // Annuler / retablir / rechargement : le projet est remplace, on relit la scene
  const offLoad = store.on('load', () => {
    const sc = findScene();
    if (!sc) return;
    sceneData = sc;
    grid = new GridMap3D(sc.gridmap);
    if (selectedEntityId && !(sc.entities || []).some((e) => e.id === selectedEntityId)) selectedEntityId = null;
    if (blockGroup) {
      rebuildBlocks();
      rebuildEntities();
    }
    updateSelectionUI();
  });

  // --- Initialisation Three.js Viewport ---
  const viewportContainer = container.querySelector('#pf-s3d-viewport');
  let scene, camera, renderer, ThreeLib;
  let gridHelper;
  let blockGroup, entityGroup;
  let ro = null;
  let renderLoop = null;
  const cubeGeo = { geo: null };
  const materialCache = new Map(); // couleur -> materiau (blocs et entites), libere au dispose
  const disposables = []; // geometries / materiaux crees une fois

  function getMaterial(color) {
    if (!materialCache.has(color)) {
      materialCache.set(color, new ThreeLib.MeshLambertMaterial({ color, flatShading: true }));
    }
    return materialCache.get(color);
  }

  // Couleur d'un bloc : index de palette ou '#rrggbb'
  function blockColor(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return palette[((v % palette.length) + palette.length) % palette.length];
    if (typeof v === 'string' && v.charAt(0) === '#') return v;
    if (typeof v === 'string' && /^[0-9a-f]$/i.test(v)) return palette[parseInt(v, 16) % palette.length];
    return palette[6];
  }

  // Raccourcis clavier de l'onglet (actifs seulement quand il est visible ; F6 est gere par le dock)
  function onKeyDown(e) {
    if (isDisposed || !isActive) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'PageUp') {
      e.preventDefault();
      setLevel(activeLevel + 1);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setLevel(activeLevel - 1);
    } else if (e.key === 'Delete' && selectedEntityId) {
      deleteSelectedEntity();
    }
  }
  window.addEventListener('keydown', onKeyDown);

  async function initThree() {
    ThreeLib = await import('three');
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

    // Rendu des blocs et des entites
    rebuildBlocks();
    rebuildEntities();

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

    canvas.onpointerdown = (e) => {
      if (e.button === 2 || e.button === 1 || e.shiftKey) {
        isOrbiting = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 0) {
        handlePointerClick(e);
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
      } else {
        handlePointerHover(e, cursorBox);
      }
    };

    canvas.onpointerup = (e) => {
      if (isOrbiting) {
        isOrbiting = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
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

    // Rendu seulement quand l'onglet est visible
    renderLoop = function loop() {
      animId = null;
      if (isDisposed || !isActive) return;
      animId = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    renderLoop();
  }

  let selWireMat = null;

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

    (sceneData.entities || []).forEach((ent) => {
      const objDef = (store.project?.objects || []).find((o) => o.id === ent.objectId);
      const color = objDef?.color || '#ffcd75';
      const mesh = new ThreeLib.Mesh(cubeGeo.geo, getMaterial(color));
      mesh.position.set(ent.x, ent.y, ent.z);
      mesh.scale.set(0.9, 0.9, 0.9);
      mesh.userData = { entityId: ent.id, ent };

      // Marqueur de sélection
      if (ent.id === selectedEntityId) {
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

    // Test entites
    const entHits = raycaster.intersectObjects(entityGroup.children, true);
    let hitEntity = null;
    if (entHits.length > 0) {
      let topObj = entHits[0].object;
      while (topObj.parent && topObj.parent !== entityGroup) topObj = topObj.parent;
      hitEntity = topObj.userData?.ent || null;
    }

    // Test blocs
    const blockHits = raycaster.intersectObjects(blockGroup.children, false);
    const hitBlock = blockHits.length > 0 ? blockHits[0] : null;

    // Test plan de l'etage Y actif
    const plane = new ThreeLib.Plane(new ThreeLib.Vector3(0, 1, 0), -activeLevel);
    const planePoint = new ThreeLib.Vector3();
    const hitPlane = raycaster.ray.intersectPlane(plane, planePoint);

    return { hitBlock, hitGrid: hitPlane ? planePoint : null, hitEntity };
  }

  function handlePointerHover(e, cursorBox) {
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

    if (activeTool === 'select' && hitEntity) {
      selectedEntityId = hitEntity.id;
      updateSelectionUI();
      rebuildEntities();
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
      // Entites centrees dans la case (meme convention que les blocs et le runtime)
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

      const newEnt = {
        id: `ent3d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        objectId: selectedObjectId,
        x: ex,
        y: ey,
        z: ez,
        rotationY: 0,
        props: {},
      };
      commit((sc) => {
        if (!Array.isArray(sc.entities)) sc.entities = [];
        sc.entities.push(newEnt);
      });
      selectedEntityId = newEnt.id;
      updateSelectionUI();
      rebuildEntities();
    }
  }

  function updateSelectionUI() {
    const card = container.querySelector('#pf-s3d-selected-card');
    const details = container.querySelector('#pf-s3d-sel-details');
    const delBtn = container.querySelector('#pf-s3d-delete-ent');

    const ent = (sceneData.entities || []).find((i) => i.id === selectedEntityId);
    if (!ent) {
      details.textContent = 'Aucune entité sélectionnée';
      delBtn.style.display = 'none';
      return;
    }

    const obj = (store.project?.objects || []).find((o) => o.id === ent.objectId);
    const num = (v) => (Number.isFinite(v) ? v.toFixed(1) : '?');
    details.innerHTML = `
      <div><strong>${esc(obj?.name || 'Entité')}</strong></div>
      <div>Position : (${num(ent.x)}, ${num(ent.y)}, ${num(ent.z)})</div>
    `;
    delBtn.style.display = 'block';
  }
  container.querySelector('#pf-s3d-delete-ent').onclick = () => deleteSelectedEntity();

  function deleteSelectedEntity() {
    if (!selectedEntityId) return;
    const id = selectedEntityId;
    if (!(sceneData.entities || []).some((i) => i.id === id)) return;
    commit((sc) => {
      sc.entities = (sc.entities || []).filter((i) => i.id !== id);
    });
    selectedEntityId = null;
    updateSelectionUI();
    rebuildEntities();
  }

  initThree();

  return {
    dispose() {
      isDisposed = true;
      isActive = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      window.removeEventListener('keydown', onKeyDown);
      offLoad();
      ro?.disconnect();
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
      if (renderLoop && !animId) renderLoop();
    },
    onHide() {
      isActive = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    },
  };
}
