/**
 * PixelForge Studio — Editeur de modeles Voxel 3D et import glTF (Inspire de MagicaVoxel)
 * Gere la modelisation 3D, l'optimisation par Greedy Meshing, la palette et l'import glTF.
 */

import { greedyMeshVoxels } from './mesher.js';
import { getIconSvg } from '../../ui/icons.js';
import './voxel.css';

export function mount(container, store, { refId } = {}) {
  let model = (store.project?.models || []).find((m) => m.id === refId);
  if (!model) {
    model = {
      id: refId || 'model_new',
      name: 'Nouveau Modele 3D',
      type: 'voxel',
      dimX: 16,
      dimY: 16,
      dimZ: 16,
      voxels: {}, // "x,y,z" => paletteColorIndex (0-15)
      frames: [],
    };
    if (!store.project.models) store.project.models = [];
    store.project.models.push(model);
  }

  // Initialisation des voxels si modele vide : creer un petit socle ou personnage
  if (!model.voxels || Object.keys(model.voxels).length === 0) {
    model.voxels = {};
    for (let x = 6; x <= 9; x++) {
      for (let z = 6; z <= 9; z++) {
        model.voxels[`${x},0,${z}`] = 6; // base verte
        model.voxels[`${x},1,${z}`] = 9; // corps bleu
        model.voxels[`${x},2,${z}`] = 9;
      }
    }
    model.voxels['7,3,7'] = 4; // tete jaune
    model.voxels['8,3,7'] = 4;
    model.voxels['7,3,8'] = 4;
    model.voxels['8,3,8'] = 4;
  }

  const dimX = model.dimX || 16;
  const dimY = model.dimY || 16;
  const dimZ = model.dimZ || 16;

  let activeTool = 'brush'; // 'brush' | 'erase' | 'paint' | 'picker'
  let activeColorIndex = 4; // Sweetie-16 index
  let mirrorX = false;
  let isDisposed = false;
  let animId = null;

  const palette = store.project?.palette || [
    '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
    '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
  ];

  container.className = 'pf-voxel-editor';
  container.innerHTML = `
    <div class="pf-voxel-toolbar">
      <div class="pf-voxel-tools">
        <button class="pf-voxel-tool-btn active" data-tool="brush" title="Pinceau (Ajouter un voxel sur la face cliquee)">Pinceau</button>
        <button class="pf-voxel-tool-btn" data-tool="erase" title="Gomme (Supprimer le voxel clique)">Gomme</button>
        <button class="pf-voxel-tool-btn" data-tool="paint" title="Peindre (Changer la couleur du voxel clique)">Peindre</button>
        <button class="pf-voxel-tool-btn" data-tool="picker" title="Pipette (Prelever la couleur)">Pipette</button>
        <span style="width:1px;height:18px;background:var(--border);margin:0 4px;"></span>
        <button class="pf-voxel-tool-btn" id="pf-voxel-mirror-x" title="Activer la symetrie d'axe X">Miroir X : Non</button>
        <button class="pf-voxel-tool-btn" id="pf-voxel-clear-btn" title="Effacer tous les voxels">Tout effacer</button>
      </div>

      <div style="display:flex;align-items:center;gap:6px;">
        <label class="pf-voxel-tool-btn" style="cursor:pointer;" title="Importer un fichier glTF ou GLB">
          Importer glTF/GLB
          <input type="file" id="pf-gltf-file-input" accept=".gltf,.glb" style="display:none;" />
        </label>
        <span id="pf-voxel-poly-stats" style="font-size:11px;color:var(--fg-2);">0 polygones</span>
      </div>
    </div>

    <div class="pf-voxel-workspace">
      <div class="pf-voxel-viewport-container" id="pf-voxel-viewport">
        <div class="pf-voxel-hint-overlay">Clic gauche : Editer | Clic droit / molette : Orbite et Zoom</div>
      </div>

      <div class="pf-voxel-sidebar">
        <div style="font-weight:600;font-size:11px;color:var(--fg-1);text-transform:uppercase;">Palette de couleurs</div>
        <div class="pf-voxel-palette-grid" id="pf-voxel-palette-grid"></div>

        <div class="pf-voxel-info-card">
          <div style="font-weight:600;color:var(--fg-0);">${model.name}</div>
          <div>Dimensions : ${dimX} × ${dimY} × ${dimZ} voxels</div>
          <div id="pf-voxel-count-label">Voxels : ${Object.keys(model.voxels).length}</div>
          <div id="pf-voxel-gltf-info" style="display:${model.type === 'gltf' ? 'block' : 'none'};color:var(--accent);">Modèle glTF embarque</div>
        </div>
      </div>
    </div>
  `;

  // Construction de la grille de palette
  const paletteGrid = container.querySelector('#pf-voxel-palette-grid');
  palette.forEach((hex, idx) => {
    const swatch = document.createElement('div');
    swatch.className = `pf-voxel-color-swatch${idx === activeColorIndex ? ' active' : ''}`;
    swatch.style.backgroundColor = hex;
    swatch.title = `Couleur ${idx} (${hex})`;
    swatch.onclick = () => {
      activeColorIndex = idx;
      paletteGrid.querySelectorAll('.pf-voxel-color-swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
    };
    paletteGrid.appendChild(swatch);
  });

  // Outils
  const toolBtns = container.querySelectorAll('.pf-voxel-tool-btn[data-tool]');
  toolBtns.forEach((btn) => {
    btn.onclick = () => {
      activeTool = btn.dataset.tool;
      toolBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  const mirrorBtn = container.querySelector('#pf-voxel-mirror-x');
  mirrorBtn.onclick = () => {
    mirrorX = !mirrorX;
    mirrorBtn.textContent = `Miroir X : ${mirrorX ? 'Oui' : 'Non'}`;
    mirrorBtn.classList.toggle('active', mirrorX);
  };

  const clearBtn = container.querySelector('#pf-voxel-clear-btn');
  clearBtn.onclick = () => {
    if (confirm('Voulez-vous vraiment effacer tous les voxels de ce modele ?')) {
      model.voxels = {};
      rebuildMesh();
      notifyChange();
    }
  };

  // Import glTF
  const gltfInput = container.querySelector('#pf-gltf-file-input');
  gltfInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Attention : Ce fichier dépasse 2 Mo. Il peut ralentir le chargement.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      model.type = 'gltf';
      model.dataUrl = reader.result;
      container.querySelector('#pf-voxel-gltf-info').style.display = 'block';
      notifyChange();
      alert(`Modèle glTF "${file.name}" importé avec succès.`);
    };
    reader.readAsDataURL(file);
  };

  function notifyChange() {
    container.querySelector('#pf-voxel-count-label').textContent = `Voxels : ${Object.keys(model.voxels).length}`;
    store.emit('change', 'model');
  }

  // --- Initialisation Three.js Viewport ---
  const viewportContainer = container.querySelector('#pf-voxel-viewport');
  let currentMesh = null;
  let scene, camera, renderer, ThreeLib;

  async function initThree() {
    ThreeLib = await import('three');
    if (isDisposed) return;

    scene = new ThreeLib.Scene();
    scene.background = new ThreeLib.Color('#1e2330');

    const width = viewportContainer.clientWidth || 400;
    const height = viewportContainer.clientHeight || 300;

    camera = new ThreeLib.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(12, 12, 16);
    camera.lookAt(0, 4, 0);

    renderer = new ThreeLib.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewportContainer.appendChild(renderer.domElement);

    // Lumieres
    const amb = new ThreeLib.AmbientLight(0xffffff, 0.7);
    scene.add(amb);
    const dir = new ThreeLib.DirectionalLight(0xffeedd, 0.9);
    dir.position.set(10, 20, 15);
    scene.add(dir);

    // Grille de repere au sol
    const gridHelper = new ThreeLib.GridHelper(dimX, dimX, 0x566c86, 0x333c57);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Curseur de survol (wireframe cube)
    const hoverGeo = new ThreeLib.BoxGeometry(1.02, 1.02, 1.02);
    const hoverMat = new ThreeLib.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 });
    const hoverBox = new ThreeLib.Mesh(hoverGeo, hoverMat);
    hoverBox.visible = false;
    scene.add(hoverBox);

    // Construction du maillage initial
    rebuildMesh();

    // Controles d'orbite a la souris
    let isOrbiting = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let camRadius = 20;
    let camTheta = Math.PI / 4;
    let camPhi = Math.PI / 6;
    const camTarget = new ThreeLib.Vector3(0, dimY / 4, 0);

    function updateCamera() {
      camRadius = Math.max(5, Math.min(60, camRadius));
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
        // Clic droit / Shift : Orbite
        isOrbiting = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      } else if (e.button === 0) {
        // Clic gauche : Edition
        handleVoxelClick(e);
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
        // Raycast de survol
        handleVoxelHover(e, hoverBox);
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
      camRadius += e.deltaY * 0.02;
      updateCamera();
    };

    // Redimensionnement automatique
    const resizeObserver = new ResizeObserver(() => {
      if (isDisposed) return;
      const w = viewportContainer.clientWidth || 400;
      const h = viewportContainer.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(viewportContainer);

    function loop() {
      if (isDisposed) return;
      animId = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    }
    loop();
  }

  function getVoxelAt(x, y, z) {
    if (x < 0 || x >= dimX || y < 0 || y >= dimY || z < 0 || z >= dimZ) return 0;
    const val = model.voxels[`${x},${y},${z}`];
    return val !== undefined ? val : 0;
  }

  function setVoxelAt(x, y, z, val) {
    if (x < 0 || x >= dimX || y < 0 || y >= dimY || z < 0 || z >= dimZ) return;
    if (val === null || val === undefined) {
      delete model.voxels[`${x},${y},${z}`];
    } else {
      model.voxels[`${x},${y},${z}`] = val;
    }
  }

  function rebuildMesh() {
    if (!scene || !ThreeLib) return;

    if (currentMesh) {
      scene.remove(currentMesh);
      currentMesh.geometry?.dispose();
      currentMesh = null;
    }

    // Execution de l'algorithme de Greedy Meshing
    const meshData = greedyMeshVoxels({
      dimX,
      dimY,
      dimZ,
      getVoxel: getVoxelAt,
      palette,
      scale: 1,
    });

    const polyCount = meshData.count / 3;
    container.querySelector('#pf-voxel-poly-stats').textContent = `${polyCount} polygones (Greedy)`;

    if (meshData.count === 0) return;

    const geo = new ThreeLib.BufferGeometry();
    geo.setAttribute('position', new ThreeLib.BufferAttribute(meshData.positions, 3));
    geo.setAttribute('normal', new ThreeLib.BufferAttribute(meshData.normals, 3));
    geo.setAttribute('color', new ThreeLib.BufferAttribute(meshData.colors, 3));

    const mat = new ThreeLib.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    });

    currentMesh = new ThreeLib.Mesh(geo, mat);
    scene.add(currentMesh);
  }

  function getRaycastIntersects(e) {
    if (!currentMesh || !camera || !ThreeLib) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new ThreeLib.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new ThreeLib.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(currentMesh);
    return hits.length > 0 ? hits[0] : null;
  }

  function handleVoxelHover(e, hoverBox) {
    const hit = getRaycastIntersects(e);
    if (!hit) {
      hoverBox.visible = false;
      return;
    }

    const norm = hit.face.normal;
    const hitPoint = hit.point.clone().sub(norm.clone().multiplyScalar(0.1));
    const vx = Math.floor(hitPoint.x + dimX / 2);
    const vy = Math.floor(hitPoint.y);
    const vz = Math.floor(hitPoint.z + dimZ / 2);

    hoverBox.position.set(vx - dimX / 2 + 0.5, vy + 0.5, vz - dimZ / 2 + 0.5);
    hoverBox.visible = true;
  }

  function handleVoxelClick(e) {
    const hit = getRaycastIntersects(e);
    if (!hit) return;

    const norm = hit.face.normal;
    const hitInside = hit.point.clone().sub(norm.clone().multiplyScalar(0.1));
    const hitOutside = hit.point.clone().add(norm.clone().multiplyScalar(0.1));

    const inX = Math.floor(hitInside.x + dimX / 2);
    const inY = Math.floor(hitInside.y);
    const inZ = Math.floor(hitInside.z + dimZ / 2);

    const outX = Math.floor(hitOutside.x + dimX / 2);
    const outY = Math.floor(hitOutside.y);
    const outZ = Math.floor(hitOutside.z + dimZ / 2);

    if (activeTool === 'brush') {
      setVoxelAt(outX, outY, outZ, activeColorIndex);
      if (mirrorX) {
        const mx = dimX - 1 - outX;
        setVoxelAt(mx, outY, outZ, activeColorIndex);
      }
    } else if (activeTool === 'erase') {
      setVoxelAt(inX, inY, inZ, null);
      if (mirrorX) {
        const mx = dimX - 1 - inX;
        setVoxelAt(mx, inY, inZ, null);
      }
    } else if (activeTool === 'paint') {
      setVoxelAt(inX, inY, inZ, activeColorIndex);
      if (mirrorX) {
        const mx = dimX - 1 - inX;
        setVoxelAt(mx, inY, inZ, activeColorIndex);
      }
    } else if (activeTool === 'picker') {
      const col = getVoxelAt(inX, inY, inZ);
      if (col !== 0) {
        activeColorIndex = col;
        paletteGrid.querySelectorAll('.pf-voxel-color-swatch').forEach((s, idx) => {
          s.classList.toggle('active', idx === col);
        });
      }
      return;
    }

    rebuildMesh();
    notifyChange();
  }

  initThree();

  return {
    dispose() {
      isDisposed = true;
      if (animId) cancelAnimationFrame(animId);
      if (currentMesh) {
        scene?.remove(currentMesh);
        currentMesh.geometry?.dispose();
      }
      renderer?.dispose();
    },
    onShow() {
      // Reprise
    },
    onHide() {
      // Pause
    },
  };
}
