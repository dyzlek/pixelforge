/**
 * PixelForge Studio — Panneau « Ressources » (FileSystem façon Godot 4)
 * Arborescence du projet, dossiers virtuels, recherche temps réel et glisser-déposer.
 */

import './resources.css';
import { createMap, createSprite, createObject, createSong, uid } from '../../core/project.js';
import { getIconSvg } from '../icons.js';
import { showNewSongDialog } from '../dialogs/new-song.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createResourcesPanel(container, store, workspace) {
  let filterText = '';
  let selectedItem = null; // { kind, id, name }
  let collapsedGroups = new Set();

  container.innerHTML = `
    <div class="pf-res-panel">
      <div class="pf-res-toolbar">
        <input type="search" class="pf-res-search" placeholder="Filtrer les ressources…" spellcheck="false" aria-label="Recherche de ressources" />
        <button class="pf-dock-btn" data-act="add" title="Ajouter une ressource" aria-label="Ajouter une ressource">${getIconSvg('plus', 12)}</button>
        <button class="pf-dock-btn" data-act="dup" title="Dupliquer la sélection" aria-label="Dupliquer la ressource sélectionnée">${getIconSvg('copy', 12)}</button>
        <button class="pf-dock-btn" data-act="del" title="Supprimer la sélection" aria-label="Supprimer la ressource sélectionnée" style="color:var(--danger)">${getIconSvg('trash', 12)}</button>
      </div>
      <div class="pf-res-tree"></div>
    </div>
  `;

  const treeEl = container.querySelector('.pf-res-tree');
  const searchInput = container.querySelector('.pf-res-search');

  searchInput.addEventListener('input', () => {
    filterText = searchInput.value.trim().toLowerCase();
    renderTree();
  });

  function renderTree() {
    const p = store.project;
    if (!p) {
      treeEl.innerHTML = '<div class="pf-res-empty">Aucun projet ouvert.<br><span style="font-size:11px;color:var(--fg-2);">Ouvrez ou créez un projet depuis la bibliothèque.</span></div>';
      return;
    }

    treeEl.innerHTML = '';

    const is3D = p.settings?.dimension === '3d';

    const groups = [
      ...(is3D || p.scenes3d?.length ? [{
        id: 'scenes3d',
        label: 'Scènes 3D',
        iconName: 'map',
        kind: 'scene3d',
        items: p.scenes3d || [],
      }] : [{
        id: 'maps',
        label: 'Scènes & Cartes',
        iconName: 'map',
        kind: 'map',
        items: p.maps || [],
      }]),
      {
        id: 'objects',
        label: 'Objets',
        iconName: 'object',
        kind: 'objects',
        items: p.objects || [],
      },
      ...(is3D || p.models?.length ? [{
        id: 'models',
        label: 'Modèles 3D',
        iconName: 'cube',
        kind: 'model3d',
        items: p.models || [],
      }] : []),
      {
        id: 'sprites',
        label: 'Sprites & Tuiles',
        iconName: 'sprite',
        kind: 'pixel',
        items: p.sprites || [],
      },
      {
        id: 'sounds',
        label: 'Sons & Audio',
        iconName: 'sound',
        kind: 'sound',
        items: p.sounds || [],
      },
      {
        id: 'songs',
        label: 'Musiques',
        iconName: 'music',
        kind: 'song',
        items: p.songs || [],
      },
    ];

    for (const g of groups) {
      const filtered = g.items.filter((item) => !filterText || item.name.toLowerCase().includes(filterText));
      if (filterText && filtered.length === 0) continue;

      const groupEl = document.createElement('div');
      groupEl.className = `pf-res-group${collapsedGroups.has(g.id) ? ' collapsed' : ''}`;

      const head = document.createElement('div');
      head.className = 'pf-res-group-head';
      head.innerHTML = `
        <span class="pf-res-group-chev">${getIconSvg('chevronDown', 10)}</span>
        <span>${getIconSvg(g.iconName, 13)}</span>
        <span>${g.label} (${g.items.length})</span>
      `;
      head.onclick = () => {
        if (collapsedGroups.has(g.id)) collapsedGroups.delete(g.id);
        else collapsedGroups.add(g.id);
        groupEl.classList.toggle('collapsed', collapsedGroups.has(g.id));
      };
      groupEl.appendChild(head);

      const itemsEl = document.createElement('div');
      itemsEl.className = 'pf-res-items';

      if (filtered.length === 0) {
        itemsEl.innerHTML = '<div class="pf-res-empty">Aucun élément dans cette catégorie.<br><span style="font-size:10px;color:var(--fg-2);">Utilisez le bouton [+] pour en créer un.</span></div>';
      } else {
        for (const item of filtered) {
          const itemEl = document.createElement('div');
          const isSelected = selectedItem?.id === item.id;
          itemEl.className = `pf-res-item${isSelected ? ' selected' : ''}`;
          itemEl.draggable = true;

          // Miniature ou icône
          let thumbHtml = `<span>${getIconSvg(g.iconName, 13)}</span>`;
          if (g.kind === 'pixel' && item.frames?.[0]) {
            thumbHtml = `<img src="${item.frames[0]}" class="pf-res-thumb" alt="${item.name}" />`;
          } else if (g.kind === 'objects') {
            const spr = p.sprites?.find((s) => s.id === item.spriteId);
            if (spr?.frames?.[0]) {
              thumbHtml = `<img src="${spr.frames[0]}" class="pf-res-thumb" alt="${item.name}" />`;
            }
          }

          let badgeHtml = '';
          if (g.kind === 'map' && item.id === p.settings?.startMapId) {
            badgeHtml = '<span class="pf-res-badge">Start</span>';
          }

          itemEl.innerHTML = `
            <div class="pf-res-thumb">${thumbHtml}</div>
            <span class="pf-res-name">${esc(item.name)}</span>
            ${badgeHtml}
          `;

          // Clic : sélection
          itemEl.onclick = () => {
            selectedItem = { kind: g.kind, id: item.id, name: item.name };
            treeEl.querySelectorAll('.pf-res-item').forEach((el) => el.classList.remove('selected'));
            itemEl.classList.add('selected');
          };

          // Double clic : ouvrir dans le workspace
          itemEl.ondblclick = () => {
            workspace.open({ kind: g.kind, refId: item.id, title: item.name });
          };

          // Drag & Drop
          itemEl.ondragstart = (e) => {
            const payload = JSON.stringify({
              type: 'pixelforge-resource',
              kind: g.kind,
              id: item.id,
              name: item.name,
              spriteId: item.spriteId || null,
            });
            e.dataTransfer.setData('application/pixelforge-resource', payload);
            e.dataTransfer.setData('text/plain', item.name);
            e.dataTransfer.effectAllowed = 'copyMove';
          };

          itemsEl.appendChild(itemEl);
        }
      }

      groupEl.appendChild(itemsEl);
      treeEl.appendChild(groupEl);
    }
  }

  // Barre d'actions (Ajouter, Dupliquer, Supprimer)
  container.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;

    if (act === 'add') {
      const type = prompt('Type de ressource à créer :\n1 = Scène / Carte\n2 = Sprite\n3 = Objet\n4 = Son\n5 = Musique', '1');
      if (type === '1') {
        const name = prompt('Nom de la carte :', 'Nouvelle carte');
        if (name) {
          store.update((p) => {
            const m = createMap(name);
            p.maps.push(m);
            workspace.open({ kind: 'map', refId: m.id, title: m.name });
          }, 'map');
        }
      } else if (type === '2') {
        const name = prompt('Nom du sprite :', 'Nouveau sprite');
        if (name) {
          store.update((p) => {
            const s = createSprite(name);
            p.sprites.push(s);
            workspace.open({ kind: 'pixel', refId: s.id, title: s.name });
          }, 'sprite');
        }
      } else if (type === '3') {
        const name = prompt("Nom de l'objet :", 'NouvelObjet');
        if (name) {
          store.update((p) => {
            const o = createObject(name);
            p.objects.push(o);
            workspace.open({ kind: 'objects', refId: o.id, title: o.name });
          }, 'object');
        }
      } else if (type === '4') {
        const name = prompt('Nom du son :', 'bip');
        if (name) {
          store.update((p) => {
            p.sounds = p.sounds || [];
            p.sounds.push({ id: uid('snd'), name, kind: 'sfx', sfx: { preset: 'blip', seed: 0, volume: 0.5, pitch: 1 } });
            workspace.open({ kind: 'sound', refId: p.sounds[p.sounds.length - 1].id, title: name });
          }, 'sound');
        }
      } else if (type === '5') {
        showNewSongDialog(store, workspace);
      }
    } else if (act === 'dup' && selectedItem) {
      store.update((p) => {
        if (selectedItem.kind === 'map') {
          const src = p.maps.find((m) => m.id === selectedItem.id);
          if (src) {
            const copy = structuredClone(src);
            copy.id = uid('map');
            copy.name = src.name + ' (copie)';
            p.maps.push(copy);
            workspace.open({ kind: 'map', refId: copy.id, title: copy.name });
          }
        } else if (selectedItem.kind === 'pixel') {
          const src = p.sprites.find((s) => s.id === selectedItem.id);
          if (src) {
            const copy = structuredClone(src);
            copy.id = uid('spr');
            copy.name = src.name + ' (copie)';
            p.sprites.push(copy);
            workspace.open({ kind: 'pixel', refId: copy.id, title: copy.name });
          }
        } else if (selectedItem.kind === 'objects') {
          const src = p.objects.find((o) => o.id === selectedItem.id);
          if (src) {
            const copy = structuredClone(src);
            copy.id = uid('obj');
            copy.name = src.name + 'Copy';
            p.objects.push(copy);
            workspace.open({ kind: 'objects', refId: copy.id, title: copy.name });
          }
        } else if (selectedItem.kind === 'song') {
          const src = (p.songs || []).find((s) => s.id === selectedItem.id);
          if (src) {
            const copy = structuredClone(src);
            copy.id = uid('sng');
            copy.name = src.name + ' (copie)';
            p.songs = p.songs || [];
            p.songs.push(copy);
            workspace.open({ kind: 'song', refId: copy.id, title: copy.name });
          }
        } else if (selectedItem.kind === 'scene3d') {
          const src = (p.scenes3d || []).find((s) => s.id === selectedItem.id);
          if (src) {
            const copy = structuredClone(src);
            copy.id = uid('scene3d');
            copy.name = src.name + ' (copie)';
            p.scenes3d = p.scenes3d || [];
            p.scenes3d.push(copy);
            workspace.open({ kind: 'scene3d', refId: copy.id, title: copy.name });
          }
        } else if (selectedItem.kind === 'model3d') {
          const src = (p.models || []).find((m) => m.id === selectedItem.id);
          if (src) {
            const copy = structuredClone(src);
            copy.id = uid('mod');
            copy.name = src.name + ' (copie)';
            p.models = p.models || [];
            p.models.push(copy);
            workspace.open({ kind: 'model3d', refId: copy.id, title: copy.name });
          }
        }
      });
    } else if (act === 'del' && selectedItem) {
      const p = store.project;
      // Vérification des dépendances
      if (selectedItem.kind === 'objects') {
        const usedMaps = (p.maps || []).filter((m) => m.entities?.some((ent) => ent.objectId === selectedItem.id));
        if (usedMaps.length > 0) {
          const proceed = confirm(`Attention : l'objet "${selectedItem.name}" est utilisé dans ${usedMaps.length} scène(s) :\n` +
            usedMaps.map((m) => `• ${m.name}`).join('\n') + '\n\nVoulez-vous quand même le supprimer ?');
          if (!proceed) return;
        }
      } else if (selectedItem.kind === 'pixel') {
        const usedObjects = (p.objects || []).filter((o) => o.spriteId === selectedItem.id);
        const usedTilesets = (p.maps || []).filter((m) => m.tilesetSpriteId === selectedItem.id);
        if (usedObjects.length > 0 || usedTilesets.length > 0) {
          const proceed = confirm(`Attention : le sprite "${selectedItem.name}" est utilisé par ${usedObjects.length} objet(s) et ${usedTilesets.length} carte(s).\nVoulez-vous quand même le supprimer ?`);
          if (!proceed) return;
        }
      }

      store.update((proj) => {
        if (selectedItem.kind === 'map') proj.maps = proj.maps.filter((m) => m.id !== selectedItem.id);
        else if (selectedItem.kind === 'scene3d') proj.scenes3d = (proj.scenes3d || []).filter((s) => s.id !== selectedItem.id);
        else if (selectedItem.kind === 'model3d') proj.models = (proj.models || []).filter((m) => m.id !== selectedItem.id);
        else if (selectedItem.kind === 'pixel') proj.sprites = proj.sprites.filter((s) => s.id !== selectedItem.id);
        else if (selectedItem.kind === 'objects') proj.objects = proj.objects.filter((o) => o.id !== selectedItem.id);
        else if (selectedItem.kind === 'sound') proj.sounds = proj.sounds.filter((s) => s.id !== selectedItem.id);
        else if (selectedItem.kind === 'song') proj.songs = (proj.songs || []).filter((s) => s.id !== selectedItem.id);
        selectedItem = null;
      });
    }
  });

  const offChange = store.on('change', () => renderTree());
  const offLoad = store.on('load', () => {
    selectedItem = null;
    renderTree();
  });

  renderTree();

  return () => {
    offChange();
    offLoad();
  };
}
