/**
 * PixelForge Studio — Arbre de scene (Scene Tree façon Godot 4)
 * Liste hierarchique des calques/entites (2D) ou des nœuds de scene (3D).
 * Supporte la selection, duplication, suppression, renommage et regroupement par glisser-deposer.
 */

import './scene-tree.css';
import { createSceneNode, uid } from '../../core/project.js';
import { getIconSvg } from '../icons.js';

export function createSceneTree(container, store) {
  let selectedEntityId = null;
  let selectedNodeId = null;
  let editingNodeId = null;
  let draggedNodeId = null;
  let showAddMenu = false;

  container.innerHTML = `
    <div class="pf-scene-tree">
      <div class="pf-st-toolbar" style="position:relative;">
        <span style="font-weight:600;font-size:12px;color:var(--fg-0);flex:1;" id="pf-st-map-name">Scene</span>
        <button class="pf-dock-btn" data-act="add" id="pf-st-add-btn" title="Ajouter un nœud 3D" aria-label="Ajouter un nœud">${getIconSvg('plus', 12)}</button>
        <button class="pf-dock-btn" data-act="dup" title="Dupliquer la selection (Ctrl+D)" aria-label="Dupliquer la selection">${getIconSvg('copy', 12)}</button>
        <button class="pf-dock-btn" data-act="del" title="Supprimer la selection" aria-label="Supprimer la selection" style="color:var(--danger)">${getIconSvg('trash', 12)}</button>
        <div class="pf-st-menu" id="pf-st-add-menu" style="display:none;">
          <button class="pf-st-menu-item" data-add-kind="mesh">${getIconSvg('cube', 12)} <span>Mesh / Objet</span></button>
          <button class="pf-st-menu-item" data-add-kind="light">${getIconSvg('sun', 12)} <span>Lumiere</span></button>
          <button class="pf-st-menu-item" data-add-kind="camera">${getIconSvg('camera', 12)} <span>Camera</span></button>
          <button class="pf-st-menu-item" data-add-kind="collision">${getIconSvg('shield', 12)} <span>Collision / Zone</span></button>
          <button class="pf-st-menu-item" data-add-kind="audio">${getIconSvg('sound', 12)} <span>Audio 3D</span></button>
          <button class="pf-st-menu-item" data-add-kind="empty">${getIconSvg('folder', 12)} <span>Nœud vide / Dossier</span></button>
        </div>
      </div>
      <div class="pf-st-body"></div>
    </div>
  `;

  const bodyEl = container.querySelector('.pf-st-body');
  const titleEl = container.querySelector('#pf-st-map-name');
  const addBtn = container.querySelector('#pf-st-add-btn');
  const addMenu = container.querySelector('#pf-st-add-menu');

  function getTarget() {
    const p = store.project;
    if (!p) return null;
    const is3D = p.settings?.dimension === '3d';

    if (store.ui.selectedScene3DId) {
      const sc = p.scenes3d?.find((s) => s.id === store.ui.selectedScene3DId);
      if (sc) return { is3D: true, scene: sc };
    }
    if (store.ui.selection?.type === 'node3d' || store.ui.selection?.type === 'scene3d') {
      const sid = store.ui.selection.sceneId || store.ui.selection.id;
      const sc = p.scenes3d?.find((s) => s.id === sid);
      if (sc) return { is3D: true, scene: sc };
    }
    if (is3D && p.scenes3d?.length) {
      const startId = p.settings?.startScene3DId;
      const sc = p.scenes3d.find((s) => s.id === startId) || p.scenes3d[0];
      return { is3D: true, scene: sc };
    }
    const map = p.maps?.find((m) => m.id === store.ui.selectedMapId) || p.maps?.[0] || null;
    if (map) return { is3D: false, map };
    if (p.scenes3d?.length) return { is3D: true, scene: p.scenes3d[0] };
    return null;
  }

  function isDescendant(nodes, potentialAncestorId, targetId) {
    let curr = nodes.find((n) => n.id === targetId);
    while (curr && curr.parent) {
      if (curr.parent === potentialAncestorId) return true;
      curr = nodes.find((n) => n.id === curr.parent);
    }
    return false;
  }

  function renderTree() {
    const target = getTarget();
    if (!target) {
      titleEl.textContent = 'Aucune scene';
      addBtn.style.display = 'none';
      bodyEl.innerHTML = '<div class="pf-st-empty">Aucune scene active.<br><span style="font-size:11px;color:var(--fg-2);">Ouvrez une carte ou scene 3D pour afficher son arborescence.</span></div>';
      return;
    }

    if (target.is3D) {
      render3DTree(target.scene);
    } else {
      render2DTree(target.map);
    }
  }

  // --- Rendu 2D (Cartes de tuiles et entites) ---
  function render2DTree(map) {
    addBtn.style.display = 'none';
    titleEl.textContent = map.name;
    bodyEl.innerHTML = '';

    const p = store.project;

    // Groupe Calques
    const layerGroup = document.createElement('div');
    layerGroup.className = 'pf-st-group';
    layerGroup.innerHTML = `
      <div class="pf-st-group-head">
        <span>${getIconSvg('layers', 13)}</span>
        <span>Calques (${map.layers?.length || 0})</span>
      </div>
    `;
    const layerList = document.createElement('div');
    layerList.style.display = 'flex';
    layerList.style.flexDirection = 'column';
    layerList.style.gap = '1px';

    for (const l of map.layers || []) {
      const item = document.createElement('div');
      item.className = 'pf-st-item';
      const isVisible = l.visible !== false;
      item.innerHTML = `
        <span style="display:inline-flex;align-items:center;color:${l.collides ? 'var(--accent)' : 'var(--fg-2)'};">${getIconSvg(l.collides ? 'lock' : 'layers', 12)}</span>
        <span class="pf-st-name">${l.name}</span>
        <div class="pf-st-actions">
          <button class="pf-st-action-btn${isVisible ? '' : ' off'}" data-vis-layer="${l.id}" title="${isVisible ? 'Masquer le calque' : 'Afficher le calque'}" aria-label="Afficher ou masquer le calque">${getIconSvg(isVisible ? 'eye' : 'eyeOff', 12)}</button>
        </div>
      `;

      item.onclick = (e) => {
        if (!e.target.closest('[data-vis-layer]')) {
          store.ui.selectedLayerId = l.id;
        }
      };

      const visBtn = item.querySelector('[data-vis-layer]');
      visBtn.onclick = (e) => {
        e.stopPropagation();
        store.update(() => {
          l.visible = l.visible === false ? true : false;
        }, 'map');
      };

      layerList.appendChild(item);
    }
    layerGroup.appendChild(layerList);
    bodyEl.appendChild(layerGroup);

    // Groupe Entites
    const entGroup = document.createElement('div');
    entGroup.className = 'pf-st-group';
    entGroup.innerHTML = `
      <div class="pf-st-group-head">
        <span>${getIconSvg('object', 13)}</span>
        <span>Entites (${map.entities?.length || 0})</span>
      </div>
    `;

    const entList = document.createElement('div');
    entList.style.display = 'flex';
    entList.style.flexDirection = 'column';
    entList.style.gap = '1px';

    if (!map.entities?.length) {
      entList.innerHTML = '<div class="pf-st-empty">Cette scene ne contient aucune entite.<br><span style="font-size:10px;color:var(--fg-2);">Glissez un objet depuis le panneau Ressources pour l\'ajouter.</span></div>';
    } else {
      for (const ent of map.entities) {
        const obj = p.objects?.find((o) => o.id === ent.objectId);
        const spr = p.sprites?.find((s) => s.id === obj?.spriteId);
        const isSelected = selectedEntityId === ent.id;

        const item = document.createElement('div');
        item.className = `pf-st-item${isSelected ? ' selected' : ''}${ent.locked ? ' locked' : ''}`;

        let iconHtml = getIconSvg('object', 13);
        if (spr?.frames?.[0]) {
          iconHtml = `<img src="${spr.frames[0]}" style="width:14px;height:14px;object-fit:contain;image-rendering:pixelated;" alt="${obj?.name || ''}" />`;
        }

        const isVisible = ent.visible !== false;
        const isLocked = !!ent.locked;

        item.innerHTML = `
          <span>${iconHtml}</span>
          <span class="pf-st-name">${obj?.name || 'Entite'} <small style="color:var(--fg-2)">(${Math.round(ent.x)}, ${Math.round(ent.y)})</small></span>
          <div class="pf-st-actions">
            <button class="pf-st-action-btn${isVisible ? '' : ' off'}" data-vis-ent="${ent.id}" title="${isVisible ? 'Masquer' : 'Afficher'}" aria-label="Afficher ou masquer l'entite">${getIconSvg(isVisible ? 'eye' : 'eyeOff', 12)}</button>
            <button class="pf-st-action-btn${isLocked ? '' : ' off'}" data-lock-ent="${ent.id}" title="${isLocked ? 'Deverrouiller' : 'Verrouiller'}" aria-label="Verrouiller ou deverrouiller l'entite">${getIconSvg(isLocked ? 'lock' : 'unlock', 12)}</button>
          </div>
        `;

        item.onclick = (e) => {
          if (!e.target.closest('button')) {
            selectedEntityId = ent.id;
            selectedNodeId = null;
            store.setSelection({ type: 'entity', id: ent.id, mapId: map.id });
            renderTree();
          }
        };

        const visBtn = item.querySelector('[data-vis-ent]');
        visBtn.onclick = (e) => {
          e.stopPropagation();
          store.update(() => {
            ent.visible = ent.visible === false ? true : false;
          }, 'map');
        };

        const lockBtn = item.querySelector('[data-lock-ent]');
        lockBtn.onclick = (e) => {
          e.stopPropagation();
          store.update(() => {
            ent.locked = !ent.locked;
          }, 'map');
        };

        entList.appendChild(item);
      }
    }

    entGroup.appendChild(entList);
    bodyEl.appendChild(entGroup);
  }

  // --- Rendu 3D (Hierarchie de nœuds de scene) ---
  function render3DTree(scene) {
    addBtn.style.display = 'inline-flex';
    titleEl.textContent = scene.name;
    bodyEl.innerHTML = '';

    const p = store.project;
    const blockCount = Object.keys(scene.gridmap?.blocks || {}).length;

    // Groupe 1 : Environnement & Grille
    const envGroup = document.createElement('div');
    envGroup.className = 'pf-st-group';
    const isSceneSelected = store.ui.selection?.type === 'scene3d' && store.ui.selection?.id === scene.id;
    envGroup.innerHTML = `
      <div class="pf-st-group-head${isSceneSelected ? ' selected' : ''}" id="pf-st-env-head">
        <span style="display:inline-flex;align-items:center;gap:4px;">${getIconSvg('sun', 13)} <span>Environnement & Grille</span></span>
        <span class="pf-st-badge">${blockCount} blocs</span>
      </div>
    `;
    envGroup.querySelector('#pf-st-env-head').onclick = () => {
      selectedNodeId = null;
      selectedEntityId = null;
      store.setSelection({ type: 'scene3d', id: scene.id });
      renderTree();
    };
    bodyEl.appendChild(envGroup);

    // Groupe 2 : Nœuds de scene
    const nodes = scene.nodes || [];
    const nodeGroup = document.createElement('div');
    nodeGroup.className = 'pf-st-group';
    nodeGroup.innerHTML = `
      <div class="pf-st-group-head" id="pf-st-nodes-head">
        <span style="display:inline-flex;align-items:center;gap:4px;">${getIconSvg('sceneTree', 13)} <span>Nœuds (${nodes.length})</span></span>
        <span style="font-size:10px;color:var(--fg-2);">Glisser pour parenter</span>
      </div>
    `;

    // Drop sur le header du groupe de nœuds pour reparenter a la racine
    const nodesHead = nodeGroup.querySelector('#pf-st-nodes-head');
    nodesHead.ondragover = (e) => {
      e.preventDefault();
      nodesHead.classList.add('pf-st-drag-over');
    };
    nodesHead.ondragleave = () => {
      nodesHead.classList.remove('pf-st-drag-over');
    };
    nodesHead.ondrop = (e) => {
      e.preventDefault();
      nodesHead.classList.remove('pf-st-drag-over');
      if (draggedNodeId) {
        store.update((proj) => {
          const sc = proj.scenes3d?.find((s) => s.id === scene.id);
          const n = sc?.nodes?.find((x) => x.id === draggedNodeId);
          if (n) n.parent = null;
        }, 'scene3d');
        draggedNodeId = null;
      }
    };

    const nodeList = document.createElement('div');
    nodeList.style.display = 'flex';
    nodeList.style.flexDirection = 'column';
    nodeList.style.gap = '1px';

    if (!nodes.length) {
      nodeList.innerHTML = '<div class="pf-st-empty">Aucun nœud 3D.<br><span style="font-size:10px;color:var(--fg-2);">Cliquez sur [+] pour ajouter un Mesh, Lumiere ou Camera.</span></div>';
    } else {
      // Construction de la hierarchie
      const childrenMap = new Map();
      const nodeMap = new Map();
      for (const n of nodes) {
        nodeMap.set(n.id, n);
      }
      for (const n of nodes) {
        const pid = n.parent && nodeMap.has(n.parent) ? n.parent : null;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid).push(n);
      }

      function renderNode(node, depth = 0) {
        const isSelected = selectedNodeId === node.id;
        const isEditing = editingNodeId === node.id;
        const isVisible = node.visible !== false;
        const isLocked = !!node.locked;

        let iconName = 'cube';
        if (node.kind === 'light') iconName = 'sun';
        else if (node.kind === 'camera') iconName = 'camera';
        else if (node.kind === 'collision') iconName = 'shield';
        else if (node.kind === 'audio') iconName = 'sound';
        else if (node.kind === 'empty') iconName = 'folder';

        let thumbHtml = getIconSvg(iconName, 12);
        if (node.kind === 'mesh' && node.objectId) {
          const obj = p.objects?.find((o) => o.id === node.objectId);
          const spr = p.sprites?.find((s) => s.id === obj?.spriteId);
          if (spr?.frames?.[0]) {
            thumbHtml = `<img src="${spr.frames[0]}" style="width:14px;height:14px;object-fit:contain;image-rendering:pixelated;" alt="${node.name}" />`;
          }
        }

        const item = document.createElement('div');
        item.className = `pf-st-item${isSelected ? ' selected' : ''}${isLocked ? ' locked' : ''}`;
        item.style.paddingLeft = `${depth * 14 + 6}px`;
        item.draggable = !isEditing && !isLocked;

        let nameHtml = '';
        if (isEditing) {
          nameHtml = `<input type="text" class="pf-st-rename-input" value="${node.name}" />`;
        } else {
          nameHtml = `<span class="pf-st-name">${node.name}</span><span class="pf-st-badge">${node.kind || 'mesh'}</span>`;
        }

        item.innerHTML = `
          <span>${thumbHtml}</span>
          ${nameHtml}
          <div class="pf-st-actions">
            <button class="pf-st-action-btn${isVisible ? '' : ' off'}" data-vis-node="${node.id}" title="${isVisible ? 'Masquer' : 'Afficher'}" aria-label="Afficher ou masquer le nœud">${getIconSvg(isVisible ? 'eye' : 'eyeOff', 12)}</button>
            <button class="pf-st-action-btn${isLocked ? '' : ' off'}" data-lock-node="${node.id}" title="${isLocked ? 'Deverrouiller' : 'Verrouiller'}" aria-label="Verrouiller ou deverrouiller le nœud">${getIconSvg(isLocked ? 'lock' : 'unlock', 12)}</button>
          </div>
        `;

        // Gestion de l'edition inline
        if (isEditing) {
          const input = item.querySelector('.pf-st-rename-input');
          setTimeout(() => {
            input?.focus();
            input?.select();
          }, 10);

          const commitRename = () => {
            const val = input.value.trim();
            if (val && val !== node.name) {
              store.update((proj) => {
                const sc = proj.scenes3d?.find((s) => s.id === scene.id);
                const n = sc?.nodes?.find((x) => x.id === node.id);
                if (n) n.name = val;
              }, 'scene3d');
            }
            editingNodeId = null;
            renderTree();
          };

          input.onblur = commitRename;
          input.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              editingNodeId = null;
              renderTree();
            }
          };
        } else {
          item.ondblclick = (e) => {
            if (e.target.closest('button')) return;
            editingNodeId = node.id;
            renderTree();
          };
        }

        // Selection
        item.onclick = (e) => {
          if (e.target.closest('button') || e.target.closest('input')) return;
          selectedNodeId = node.id;
          selectedEntityId = null;
          store.setSelection({ type: 'node3d', sceneId: scene.id, id: node.id });
          renderTree();
        };

        // Visibilite
        const visBtn = item.querySelector('[data-vis-node]');
        visBtn.onclick = (e) => {
          e.stopPropagation();
          store.update((proj) => {
            const sc = proj.scenes3d?.find((s) => s.id === scene.id);
            const n = sc?.nodes?.find((x) => x.id === node.id);
            if (n) {
              n.visible = n.visible === false ? true : false;
              const ent = sc.entities?.find((x) => x.id === node.id);
              if (ent) ent.visible = n.visible;
            }
          }, 'scene3d');
        };

        // Verrouillage
        const lockBtn = item.querySelector('[data-lock-node]');
        lockBtn.onclick = (e) => {
          e.stopPropagation();
          store.update((proj) => {
            const sc = proj.scenes3d?.find((s) => s.id === scene.id);
            const n = sc?.nodes?.find((x) => x.id === node.id);
            if (n) {
              n.locked = !n.locked;
              const ent = sc.entities?.find((x) => x.id === node.id);
              if (ent) ent.locked = n.locked;
            }
          }, 'scene3d');
        };

        // Glisser-deposer pour parenter
        item.ondragstart = (e) => {
          draggedNodeId = node.id;
          e.dataTransfer.setData('text/plain', node.id);
          e.dataTransfer.effectAllowed = 'move';
        };

        item.ondragover = (e) => {
          if (!draggedNodeId || draggedNodeId === node.id) return;
          if (isDescendant(nodes, draggedNodeId, node.id)) return;
          e.preventDefault();
          item.classList.add('pf-st-drag-over');
        };

        item.ondragleave = () => {
          item.classList.remove('pf-st-drag-over');
        };

        item.ondrop = (e) => {
          e.preventDefault();
          item.classList.remove('pf-st-drag-over');
          if (!draggedNodeId || draggedNodeId === node.id) return;
          if (isDescendant(nodes, draggedNodeId, node.id)) return;

          store.update((proj) => {
            const sc = proj.scenes3d?.find((s) => s.id === scene.id);
            const n = sc?.nodes?.find((x) => x.id === draggedNodeId);
            if (n) n.parent = node.id;
          }, 'scene3d');
          draggedNodeId = null;
        };

        nodeList.appendChild(item);

        // Rendu recursif des enfants
        const children = childrenMap.get(node.id) || [];
        for (const child of children) {
          renderNode(child, depth + 1);
        }
      }

      // Racine (parent === null)
      const rootNodes = childrenMap.get(null) || [];
      for (const root of rootNodes) {
        renderNode(root, 0);
      }
    }

    nodeGroup.appendChild(nodeList);
    bodyEl.appendChild(nodeGroup);
  }

  // Ajout de nœud (menu deroulant)
  addBtn.onclick = (e) => {
    e.stopPropagation();
    showAddMenu = !showAddMenu;
    addMenu.style.display = showAddMenu ? 'flex' : 'none';
  };

  window.addEventListener('click', (e) => {
    if (!e.target.closest('#pf-st-add-menu') && !e.target.closest('#pf-st-add-btn')) {
      showAddMenu = false;
      addMenu.style.display = 'none';
    }
  });

  addMenu.onclick = (e) => {
    const item = e.target.closest('[data-add-kind]');
    if (!item) return;
    const kind = item.dataset.addKind;
    showAddMenu = false;
    addMenu.style.display = 'none';

    const target = getTarget();
    if (!target?.is3D) return;
    const scene = target.scene;

    const parentId = selectedNodeId || null;
    const baseNames = {
      mesh: 'Mesh',
      light: 'Light',
      camera: 'Camera',
      collision: 'Collider',
      audio: 'AudioSource',
      empty: 'Node',
    };
    const name = `${baseNames[kind] || 'Node'}_${(scene.nodes?.length || 0) + 1}`;

    store.update((proj) => {
      const sc = proj.scenes3d?.find((s) => s.id === scene.id);
      if (!sc) return;
      sc.nodes = sc.nodes || [];
      const node = createSceneNode(name, kind, parentId);
      if (kind === 'mesh') {
        node.objectId = proj.objects?.[0]?.id || null;
        sc.entities = sc.entities || [];
        sc.entities.push({
          id: node.id,
          objectId: node.objectId,
          x: node.position[0],
          y: node.position[1],
          z: node.position[2],
          rotationY: node.rotation[1],
          props: {},
        });
      } else if (kind === 'light') {
        node.position = [0, 3, 0];
      }
      sc.nodes.push(node);
      selectedNodeId = node.id;
      store.setSelection({ type: 'node3d', sceneId: sc.id, id: node.id });
    }, 'scene3d');
  };

  // Duplication et suppression
  function duplicateSelected() {
    const target = getTarget();
    if (!target) return;

    if (target.is3D) {
      if (!selectedNodeId) return;
      const scene = target.scene;
      const node = scene.nodes?.find((n) => n.id === selectedNodeId);
      if (!node) return;

      store.update((proj) => {
        const sc = proj.scenes3d?.find((s) => s.id === scene.id);
        if (!sc) return;
        const copy = structuredClone(node);
        copy.id = uid('node3d');
        copy.name = `${node.name}_copie`;
        if (Array.isArray(copy.position)) {
          copy.position[0] = (copy.position[0] || 0) + 1;
        }
        sc.nodes = sc.nodes || [];
        sc.nodes.push(copy);

        if (copy.kind === 'mesh' && copy.objectId) {
          sc.entities = sc.entities || [];
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

        selectedNodeId = copy.id;
        store.setSelection({ type: 'node3d', sceneId: sc.id, id: copy.id });
      }, 'scene3d');
    } else {
      const map = target.map;
      if (!selectedEntityId) return;
      const ent = map.entities?.find((x) => x.id === selectedEntityId);
      if (!ent) return;

      store.update((proj) => {
        const m = proj.maps?.find((x) => x.id === map.id);
        if (!m) return;
        const copy = structuredClone(ent);
        copy.id = uid('ent');
        copy.x += 16;
        copy.y += 16;
        m.entities = m.entities || [];
        m.entities.push(copy);
        selectedEntityId = copy.id;
        store.setSelection({ type: 'entity', id: copy.id, mapId: m.id });
      }, 'map');
    }
  }

  function deleteSelected() {
    const target = getTarget();
    if (!target) return;

    if (target.is3D) {
      if (!selectedNodeId) return;
      const scene = target.scene;
      store.update((proj) => {
        const sc = proj.scenes3d?.find((s) => s.id === scene.id);
        if (!sc) return;
        const node = sc.nodes?.find((n) => n.id === selectedNodeId);
        if (!node) return;
        // Reparenter les enfants au parent du nœud supprime
        for (const child of sc.nodes || []) {
          if (child.parent === node.id) {
            child.parent = node.parent || null;
          }
        }
        sc.nodes = sc.nodes.filter((n) => n.id !== selectedNodeId);
        sc.entities = (sc.entities || []).filter((e) => e.id !== selectedNodeId);
        selectedNodeId = null;
        store.setSelection(null);
      }, 'scene3d');
    } else {
      const map = target.map;
      if (!selectedEntityId) return;
      store.update((proj) => {
        const m = proj.maps?.find((x) => x.id === map.id);
        if (!m) return;
        m.entities = (m.entities || []).filter((x) => x.id !== selectedEntityId);
        selectedEntityId = null;
        store.setSelection(null);
      }, 'map');
    }
  }

  // Barre d'outils
  container.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'dup') duplicateSelected();
    else if (act === 'del') deleteSelected();
  });

  // Raccourcis clavier (Ctrl+D)
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      const target = getTarget();
      if ((target?.is3D && selectedNodeId) || (!target?.is3D && selectedEntityId)) {
        e.preventDefault();
        duplicateSelected();
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const offSel = store.on('selection', (sel) => {
    if (sel?.type === 'node3d') {
      selectedNodeId = sel.id;
      selectedEntityId = null;
      renderTree();
    } else if (sel?.type === 'entity') {
      selectedEntityId = sel.id;
      selectedNodeId = null;
      renderTree();
    } else if (sel?.type === 'scene3d') {
      selectedNodeId = null;
      selectedEntityId = null;
      renderTree();
    } else if (!sel && (selectedNodeId || selectedEntityId)) {
      selectedNodeId = null;
      selectedEntityId = null;
      renderTree();
    }
  });

  const offChange = store.on('change', () => renderTree());
  const offLoad = store.on('load', () => {
    selectedNodeId = null;
    selectedEntityId = null;
    editingNodeId = null;
    renderTree();
  });

  renderTree();

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    offSel();
    offChange();
    offLoad();
  };
}
