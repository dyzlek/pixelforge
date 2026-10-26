/**
 * PixelForge Studio — Editeur de modeles Voxel 3D et import glTF (Inspire de MagicaVoxel)
 * Gere la modelisation 3D, l'optimisation par Greedy Meshing, la palette et l'import glTF.
 */

import { greedyMeshVoxels } from './mesher.js';
import { getIconSvg } from '../../ui/icons.js';
import './voxel.css';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GLTF_MAX_BYTES = 5 * 1024 * 1024;

export function mount(container, store, { refId } = {}) {
  const findModel = () => (store.project?.models || []).find((m) => m.id === refId) || null;
  let model = findModel();
  if (!model) {
    container.className = 'pf-voxel-editor';
    container.textContent = 'Modele 3D introuvable (supprime ?).';
    return { dispose() {}, onShow() {}, onHide() {} };
  }

  // Copie de travail des voxels ("x,y,z" -> index de palette, 0 compris) ; ecrite dans le projet par commit()
  let voxels = { ...(model.voxels || {}) };

  // Dimensions du projet (width/height/depth, comme le MCP) ; dimX.. pour les anciens fichiers
  const dimX = model.width || model.dimX || 16;
  const dimY = model.height || model.dimY || 16;
  const dimZ = model.depth || model.dimZ || 16;

  let activeTool = 'brush'; // 'brush' | 'erase' | 'paint' | 'picker'
  let activeColorIndex = 4; // Sweetie-16 index
  let mirrorX = false;
  let isDisposed = false;
  let isActive = true;
  let animId = null;
  let renderLoop = null;
  let resizeObserver = null;
  const disposables = [];

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
          <div style="font-weight:600;color:var(--fg-0);">${esc(model.name)}</div>
          <div>Dimensions : ${dimX} × ${dimY} × ${dimZ} voxels</div>
          <div id="pf-voxel-count-label">Voxels : ${Object.keys(voxels).length}</div>
          <div id="pf-voxel-gltf-info" style="display:${model.type === 'gltf' ? 'block' : 'none'};color:var(--accent);">Modèle glTF embarqué (non affiché en jeu pour l'instant : cube par défaut)</div>
        </div>
      </div>
    </div>
  `;

  // Construction de la grille de palette
  const paletteGrid = container.querySelector('#pf-voxel-palette-grid');
  function selectColor(idx) {
    activeColorIndex = idx;
    paletteGrid.querySelectorAll('.pf-voxel-color-swatch').forEach((s, i) => {
      s.classList.toggle('active', i === idx);
      s.setAttribute('aria-pressed', String(i === idx));
    });
  }
  palette.forEach((hex, idx) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = `pf-voxel-color-swatch${idx === activeColorIndex ? ' active' : ''}`;
    swatch.style.backgroundColor = hex;
    swatch.title = `Couleur ${idx} (${hex})`;
    swatch.setAttribute('aria-label', `Couleur ${idx}`);
    swatch.setAttribute('aria-pressed', String(idx === activeColorIndex));
    swatch.onclick = () => selectColor(idx);
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
    if (confirm('Voulez-vous vraiment effacer tous les voxels de ce modele ? (Ctrl+Z pour annuler)')) {
      voxels = {};
      rebuildMesh();
      commit();
    }
  };

  // Import glTF : en-tete verifie (GLB binaire « glTF » ou JSON avec « asset »), taille limitee
  const gltfInput = container.querySelector('#pf-gltf-file-input');
  const gltfInfo = container.querySelector('#pf-voxel-gltf-info');
  gltfInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    gltfInput.value = '';
    if (!file) return;
    if (file.size > GLTF_MAX_BYTES) {
      alert(`Fichier trop gros (${(file.size / 1048576).toFixed(1)} Mo) : la limite est de 5 Mo, car il est stocké dans le fichier du jeu.`);
      return;
    }
    let valid = false;
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (String.fromCharCode(...head) === 'glTF') valid = true;
      else if (/\.gltf$/i.test(file.name)) valid = !!JSON.parse(await file.text()).asset;
    } catch (err) {
      valid = false;
    }
    if (!valid) {
      alert(`« ${file.name} » n'est pas un fichier glTF / GLB valide.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert(`Lecture impossible de « ${file.name} ».`);
    reader.onload = () => {
      if (isDisposed) return;
      commit((m) => {
        m.type = 'gltf';
        m.gltfData = reader.result;
        delete m.dataUrl;
      });
      gltfInfo.style.display = 'block';
    };
    reader.readAsDataURL(file);
  };

  // Toute modification passe par store.update (une entree d'annulation prise AVANT le changement)
  function commit(mutate) {
    store.update((p) => {
      const m = (p.models || []).find((x) => x.id === refId);
      if (!m) return;
      m.voxels = { ...voxels };
      if (mutate) mutate(m);
      model = m;
    }, 'model');
    container.querySelector('#pf-voxel-count-label').textContent = `Voxels : ${Object.keys(voxels).length}`;
  }

  // Annuler / retablir / rechargement : le projet est remplace, on relit le modele
  const offLoad = store.on('load', () => {
    const m = findModel();
    if (!m) return;
    model = m;
    voxels = { ...(m.voxels || {}) };
    gltfInfo.style.display = m.type === 'gltf' ? 'block' : 'none';
    container.querySelector('#pf-voxel-count-label').textContent = `Voxels : ${Object.keys(voxels).length}`;
    rebuildMesh();
  });

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
    voxelMat = new ThreeLib.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    disposables.push(hoverGeo, hoverMat, voxelMat, gridHelper.geometry, gridHelper.material);
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
    resizeObserver = new ResizeObserver(() => {
      if (isDisposed) return;
      const w = viewportContainer.clientWidth || 400;
      const h = viewportContainer.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(viewportContainer);

    // Rendu seulement quand l'onglet est visible
    renderLoop = function loop() {
      animId = null;
      if (isDisposed || !isActive) return;
      animId = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    renderLoop();
  }

  let voxelMat = null;

  // null = vide (la couleur 0 de la palette est un vrai voxel)
  function getVoxelAt(x, y, z) {
    if (x < 0 || x >= dimX || y < 0 || y >= dimY || z < 0 || z >= dimZ) return null;
    const val = voxels[`${x},${y},${z}`];
    return val === undefined ? null : val;
  }

  function setVoxelAt(x, y, z, val) {
    if (x < 0 || x >= dimX || y < 0 || y >= dimY || z < 0 || z >= dimZ) return;
    if (val === null || val === undefined) {
      delete voxels[`${x},${y},${z}`];
    } else {
      voxels[`${x},${y},${z}`] = val;
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

    currentMesh = new ThreeLib.Mesh(geo, voxelMat);
    scene.add(currentMesh);
  }

  // Rayon souris -> voxel touche ; a defaut, le plan du sol (Y = 0) pour poser un premier voxel
  function getRaycastIntersects(e) {
    if (!camera || !ThreeLib) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new ThreeLib.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new ThreeLib.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = currentMesh ? raycaster.intersectObject(currentMesh) : [];
    if (hits.length > 0) return hits[0];
    const point = new ThreeLib.Vector3();
    if (!raycaster.ray.intersectPlane(new ThreeLib.Plane(new ThreeLib.Vector3(0, 1, 0), 0), point)) return null;
    // Face du dessus d'un sol virtuel : « dedans » est sous le plan, « dehors » au-dessus
    return { point, face: { normal: new ThreeLib.Vector3(0, 1, 0) }, ground: true };
  }

  function handleVoxelHover(e, hoverBox) {
    const hit = getRaycastIntersects(e);
    if (!hit || (hit.ground && activeTool !== 'brush')) {
      hoverBox.visible = false;
      return;
    }
    if (hit.ground) {
      const gx = Math.floor(hit.point.x + dimX / 2);
      const gz = Math.floor(hit.point.z + dimZ / 2);
      hoverBox.visible = gx >= 0 && gx < dimX && gz >= 0 && gz < dimZ;
      hoverBox.position.set(gx - dimX / 2 + 0.5, 0.5, gz - dimZ / 2 + 0.5);
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
    if (hit.ground && activeTool !== 'brush') return;

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
      if (typeof col === 'number') selectColor(col);
      return;
    }

    rebuildMesh();
    commit();
  }

  initThree();

  return {
    dispose() {
      isDisposed = true;
      isActive = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
      offLoad();
      resizeObserver?.disconnect();
      if (currentMesh) {
        scene?.remove(currentMesh);
        currentMesh.geometry?.dispose();
      }
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
