/**
 * PixelForge Studio — Arbre de scène (Scene Tree façon Godot 4)
 * Liste hiérarchique des calques et des entités de la scène courante, visibilité et verrouillage.
 */

import './scene-tree.css';
import { uid } from '../../core/project.js';

export function createSceneTree(container, store) {
  let selectedEntityId = null;

  container.innerHTML = `
    <div class="pf-scene-tree">
      <div class="pf-st-toolbar">
        <span style="font-weight:600;font-size:12px;color:var(--fg-0);flex:1;" id="pf-st-map-name">Scène</span>
        <button class="pf-dock-btn" data-act="dup" title="Dupliquer l'entité sélectionnée (Ctrl+D)">⧉</button>
        <button class="pf-dock-btn" data-act="del" title="Supprimer l'entité" style="color:var(--danger)">🗑</button>
      </div>
      <div class="pf-st-body"></div>
    </div>
  `;

  const bodyEl = container.querySelector('.pf-st-body');
  const titleEl = container.querySelector('#pf-st-map-name');

  function getCurrentMap() {
    const p = store.project;
    if (!p) return null;
    return p.maps?.find((m) => m.id === store.ui.selectedMapId) || p.maps?.[0] || null;
  }

  function renderTree() {
    const map = getCurrentMap();
    if (!map) {
      titleEl.textContent = 'Aucune scène';
      bodyEl.innerHTML = '<div class="pf-st-empty">Aucune scène active.</div>';
      return;
    }

    titleEl.textContent = map.name;
    bodyEl.innerHTML = '';

    const p = store.project;

    // --- Groupe Calques de tuiles ---
    const layerGroup = document.createElement('div');
    layerGroup.className = 'pf-st-group';
    layerGroup.innerHTML = `
      <div class="pf-st-group-head">
        <span>🧱 Calques (${map.layers?.length || 0})</span>
      </div>
    `;
    const layerList = document.createElement('div');
    layerList.style.display = 'flex';
    layerList.style.flexDirection = 'column';
    layerList.style.gap = '1px';

    for (const l of map.layers || []) {
      const item = document.createElement('div');
      item.className = 'pf-st-item';
      item.innerHTML = `
        <span style="font-size:11px;">${l.collides ? '🛡️' : '░'}</span>
        <span class="pf-st-name">${l.name}</span>
        <div class="pf-st-actions">
          <button class="pf-st-action-btn${l.visible !== false ? '' : ' off'}" data-vis-layer="${l.id}" title="Afficher/Masquer le calque">👁</button>
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

    // --- Groupe Entités / Instances ---
    const entGroup = document.createElement('div');
    entGroup.className = 'pf-st-group';
    entGroup.innerHTML = `
      <div class="pf-st-group-head">
        <span>👾 Entités (${map.entities?.length || 0})</span>
      </div>
    `;

    const entList = document.createElement('div');
    entList.style.display = 'flex';
    entList.style.flexDirection = 'column';
    entList.style.gap = '1px';

    if (!map.entities?.length) {
      entList.innerHTML = '<div class="pf-st-empty">Aucune entité placée. Glissez un objet ici !</div>';
    } else {
      for (const ent of map.entities) {
        const obj = p.objects?.find((o) => o.id === ent.objectId);
        const spr = p.sprites?.find((s) => s.id === obj?.spriteId);
        const isSelected = selectedEntityId === ent.id;

        const item = document.createElement('div');
        item.className = `pf-st-item${isSelected ? ' selected' : ''}${ent.locked ? ' locked' : ''}`;

        let iconHtml = '👾';
        if (spr?.frames?.[0]) {
          iconHtml = `<img src="${spr.frames[0]}" style="width:14px;height:14px;object-fit:contain;image-rendering:pixelated;" />`;
        }

        item.innerHTML = `
          <span>${iconHtml}</span>
          <span class="pf-st-name">${obj?.name || 'Entité'} <small style="color:var(--fg-2)">(${Math.round(ent.x)}, ${Math.round(ent.y)})</small></span>
          <div class="pf-st-actions">
            <button class="pf-st-action-btn${ent.visible !== false ? '' : ' off'}" data-vis-ent="${ent.id}" title="Afficher/Masquer">👁</button>
            <button class="pf-st-action-btn${ent.locked ? '' : ' off'}" data-lock-ent="${ent.id}" title="Verrouiller">🔒</button>
          </div>
        `;

        item.onclick = (e) => {
          if (!e.target.closest('button')) {
            selectedEntityId = ent.id;
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

  // Actions de barre d'outils
  container.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;

    const map = getCurrentMap();
    if (!map || !selectedEntityId) return;

    if (act === 'dup') {
      const ent = map.entities.find((x) => x.id === selectedEntityId);
      if (ent) {
        store.update(() => {
          const copy = structuredClone(ent);
          copy.id = uid('ent');
          copy.x += 16;
          copy.y += 16;
          map.entities.push(copy);
          selectedEntityId = copy.id;
          store.setSelection({ type: 'entity', id: copy.id, mapId: map.id });
        }, 'map');
      }
    } else if (act === 'del') {
      store.update(() => {
        map.entities = map.entities.filter((x) => x.id !== selectedEntityId);
        selectedEntityId = null;
        store.setSelection(null);
      }, 'map');
    }
  });

  // Raccourci Ctrl+D
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      const map = getCurrentMap();
      if (map && selectedEntityId) {
        e.preventDefault();
        const ent = map.entities.find((x) => x.id === selectedEntityId);
        if (ent) {
          store.update(() => {
            const copy = structuredClone(ent);
            copy.id = uid('ent');
            copy.x += 16;
            copy.y += 16;
            map.entities.push(copy);
            selectedEntityId = copy.id;
            store.setSelection({ type: 'entity', id: copy.id, mapId: map.id });
          }, 'map');
        }
      }
    }
  });

  const offSel = store.on('selection', (sel) => {
    if (sel?.type === 'entity') {
      selectedEntityId = sel.id;
      renderTree();
    } else if (selectedEntityId && (!sel || sel.type !== 'entity')) {
      selectedEntityId = null;
      renderTree();
    }
  });

  const offChange = store.on('change', () => renderTree());
  const offLoad = store.on('load', () => {
    selectedEntityId = null;
    renderTree();
  });

  renderTree();

  return () => {
    offSel();
    offChange();
    offLoad();
  };
}
