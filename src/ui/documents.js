/**
 * PixelForge Studio — Multi-document Workspace (Godot 4 / IDE style)
 * Permet d'ouvrir plusieurs ressources simultanément dans des onglets centraux sans écraser l'état.
 *
 * Contrat des modules d'éditeur (un onglet = une instance, tout l'état est local à l'instance) :
 *
 *   export function mount(container, store, { refId }) -> handle
 *   handle = {
 *     dispose(),   // obligatoire : retire DOM, écouteurs (window/document/store) et timers de CETTE instance
 *     onShow?(),   // l'onglet devient actif et visible : l'instance active ses raccourcis clavier
 *     onHide?(),   // l'onglet est masqué : l'instance ignore le clavier
 *   }
 *
 * Un handle peut aussi être une simple fonction (équivalent à { dispose }). Les conteneurs de tous les
 * documents restent montés ; seul `display` bascule. L'instance édite `refId` (pas store.ui.selectedXxxId) ;
 * onShow() republie sa sélection dans store.ui pour l'inspecteur / l'arbre de scène.
 */

import './documents.css';
import { getIconSvg } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON_NAMES = {
  library: 'project',
  map: 'map',
  scene: 'map',
  pixel: 'palette',
  sprite: 'sprite',
  objects: 'object',
  script: 'code',
  sound: 'sound',
  song: 'music',
  model3d: 'object',
  play: 'play',
};

export class DocumentWorkspace {
  constructor({ tabbar, view, store }) {
    this.tabbar = tabbar;
    this.view = view;
    this.store = store;
    this.docs = []; // { id, kind, refId, title, icon, dirty, container, module, handle, shown }
    this.activeId = null;

    this.setupShortcuts();
    this.setupStoreSync();
  }

  getStorageKey() {
    return `pixelforge.openDocs.${this.store.currentId || 'default'}`;
  }

  saveOpenDocs() {
    if (!this.store.currentId) return;
    try {
      const serialized = this.docs
        .filter((d) => d.kind !== 'library' && d.kind !== 'play')
        .map((d) => ({
          kind: d.kind,
          refId: d.refId,
          title: d.title,
          icon: d.icon,
        }));
      localStorage.setItem(this.getStorageKey(), JSON.stringify(serialized));
      localStorage.setItem(`pixelforge.activeDoc.${this.store.currentId}`, this.activeId || '');
    } catch {}
  }

  loadSavedDocs() {
    if (!this.store.currentId) return;
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          for (const item of list) {
            this.open({ kind: item.kind, refId: item.refId, title: item.title }, false); // l'icône est recalculée (jamais relue du stockage)
          }
          const savedActive = localStorage.getItem(`pixelforge.activeDoc.${this.store.currentId}`);
          if (savedActive && this.docs.some((d) => d.id === savedActive)) {
            this.activate(savedActive);
            return;
          } else if (this.docs.length > 0) {
            this.activate(this.docs[0].id);
            return;
          }
        }
      }
    } catch {}

    // Onglets par défaut si aucun sauvegardé
    this.openDefaultProjectDocs();
  }

  openDefaultProjectDocs() {
    const p = this.store.project;
    if (!p) return;

    if (p.maps?.length) {
      this.open({ kind: 'map', refId: p.settings?.startMapId || p.maps[0].id, title: p.maps[0].name }, true);
    }
    if (p.sprites?.length) {
      this.open({ kind: 'pixel', refId: p.sprites[0].id, title: p.sprites[0].name }, false);
    }
    if (p.objects?.length) {
      this.open({ kind: 'objects', refId: p.objects[0].id, title: p.objects[0].name }, false);
    }
    if (!this.docs.length) {
      this.open({ kind: 'library', title: 'Bibliothèque' });
    }
  }

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) this.cyclePrev();
          else this.cycleNext();
        } else if (e.key.toLowerCase() === 'w') {
          // Fermer le document actif sauf la bibliothèque
          if (this.activeId && this.activeDoc?.kind !== 'library') {
            e.preventDefault();
            this.close(this.activeId);
          }
        }
      }
    });
  }

  setupStoreSync() {
    this.store.on('change', () => {
      this.syncTitles();
    });
    this.store.on('load', () => {
      this.closeAll();
      if (this.store.currentId) {
        this.loadSavedDocs();
      } else {
        this.open({ kind: 'library', title: 'Bibliothèque' });
      }
    });
  }

  syncTitles() {
    const p = this.store.project;
    if (!p) return;

    for (const doc of this.docs) {
      let currentName = null;
      if ((doc.kind === 'map' || doc.kind === 'scene') && doc.refId) {
        currentName = p.maps?.find((m) => m.id === doc.refId)?.name;
      } else if ((doc.kind === 'pixel' || doc.kind === 'sprite') && doc.refId) {
        currentName = p.sprites?.find((s) => s.id === doc.refId)?.name;
      } else if ((doc.kind === 'objects' || doc.kind === 'script') && doc.refId) {
        currentName = p.objects?.find((o) => o.id === doc.refId)?.name;
      } else if (doc.kind === 'sound' && doc.refId) {
        currentName = p.sounds?.find((s) => s.id === doc.refId)?.name;
      } else if ((doc.kind === 'song' || doc.kind === 'music') && doc.refId) {
        currentName = p.songs?.find((s) => s.id === doc.refId)?.name;
      } else if ((doc.kind === 'model3d' || doc.kind === 'voxel') && doc.refId) {
        currentName = p.models?.find((m) => m.id === doc.refId)?.name;
      }
      if (currentName && currentName !== doc.title) {
        doc.title = currentName;
      }
    }
    this.renderTabs();
  }

  get activeDoc() {
    return this.docs.find((d) => d.id === this.activeId) || null;
  }

  async open({ kind, refId = null, title = '', icon = null }, activateNow = true) {
    const id = `${kind}:${refId || 'main'}`;
    const existing = this.docs.find((d) => d.id === id);
    if (existing) {
      if (activateNow || !this.activeId) this.activate(id);
      return existing;
    }

    const docIcon = icon || (ICON_NAMES[kind] ? getIconSvg(ICON_NAMES[kind], 13) : getIconSvg('file', 13));
    const docTitle = title || this.resolveTitle(kind, refId) || kind;

    const container = document.createElement('div');
    container.className = 'tab-view pf-document-view';
    container.dataset.docId = id;
    container.style.display = 'none';
    this.view.appendChild(container);

    const doc = {
      id,
      kind,
      refId,
      title: docTitle,
      icon: docIcon,
      dirty: false,
      container,
      module: null,
      handle: null,
      shown: false,
    };

    this.docs.push(doc);
    this.renderTabs();
    if (activateNow || !this.activeId) {
      this.activate(id);
    }

    // Montage asynchrone du module de l'éditeur
    try {
      let mod = null;
      if (kind === 'library') mod = await import('../library/index.js');
      else if (kind === 'pixel' || kind === 'sprite') mod = await import('../editors/pixel/index.js');
      else if (kind === 'map' || kind === 'scene') mod = await import('../editors/map/index.js');
      else if (kind === 'objects' || kind === 'script') mod = await import('../editors/objects/index.js');
      else if (kind === 'sound') mod = await import('../editors/sound/index.js');
      else if (kind === 'song' || kind === 'music') mod = await import('../editors/music/index.js');
      else if (kind === 'model3d' || kind === 'voxel') mod = await import('../editors/voxel/index.js');
      else if (kind === 'scene3d') mod = await import('../editors/scene3d/index.js');
      else if (kind === 'play') mod = await import('../runtime/play.js');

      if (mod) {
        doc.module = mod;
        const res = mod.mount(container, this.store, { refId });
        if (typeof res === 'function') doc.handle = { dispose: res };
        else if (res && typeof res.dispose === 'function') doc.handle = res;
        else doc.handle = { dispose: () => mod.unmount?.() }; // ancien contrat (module à instance unique)
        if (!this.docs.includes(doc)) this.disposeDoc(doc); // fermé pendant le chargement
        else if (this.activeId === id) this.setShown(doc, true);
      }
    } catch (err) {
      console.error(`Erreur au chargement de l'éditeur pour ${id}:`, err);
      container.innerHTML = `<div style="padding:20px;color:var(--danger)">Erreur de chargement: ${esc(err.message)}</div>`;
    }

    this.saveOpenDocs();
    return doc;
  }

  resolveTitle(kind, refId) {
    const p = this.store.project;
    if (!p) return kind;
    if (kind === 'library') return 'Bibliothèque';
    if (kind === 'play') return 'Jouer';
    if (refId) {
      if (kind === 'map' || kind === 'scene') return p.maps?.find((m) => m.id === refId)?.name || 'Carte';
      if (kind === 'pixel' || kind === 'sprite') return p.sprites?.find((s) => s.id === refId)?.name || 'Sprite';
      if (kind === 'objects' || kind === 'script') return p.objects?.find((o) => o.id === refId)?.name || 'Objet';
      if (kind === 'sound') return p.sounds?.find((s) => s.id === refId)?.name || 'Son';
      if (kind === 'song' || kind === 'music') return p.songs?.find((s) => s.id === refId)?.name || 'Musique';
      if (kind === 'model3d' || kind === 'voxel') return p.models?.find((m) => m.id === refId)?.name || 'Modèle 3D';
    }
    const defaults = { map: 'Cartes', pixel: 'Pixel art', objects: 'Objets & code', sound: 'Sons', song: 'Musiques', music: 'Musiques', model3d: 'Modèles 3D', voxel: 'Modèles 3D' };
    return defaults[kind] || kind;
  }

  activate(id) {
    const doc = this.docs.find((d) => d.id === id);
    if (!doc) return;

    this.activeId = id;

    // Affiche le conteneur du document actif, masque tous les autres (puis notifie les instances)
    for (const d of this.docs) {
      if (d.container) {
        d.container.style.display = d.id === id ? 'flex' : 'none';
      }
    }
    for (const d of this.docs) if (d.id !== id) this.setShown(d, false);
    this.setShown(doc, true);

    // Met à jour l'apparence des onglets
    for (const tabEl of this.tabbar.querySelectorAll('.pf-doc-tab')) {
      tabEl.classList.toggle('active', tabEl.dataset.docId === id);
    }

    this.saveOpenDocs();
  }

  close(id) {
    const idx = this.docs.findIndex((d) => d.id === id);
    if (idx === -1) return;

    const doc = this.docs[idx];

    // Nettoyage de l'instance (uniquement la sienne) puis retrait du DOM
    this.disposeDoc(doc);
    this.docs.splice(idx, 1);

    // Sélection du nouvel onglet actif si l'actuel a été fermé
    if (this.activeId === id) {
      if (this.docs.length > 0) {
        const nextIdx = Math.min(idx, this.docs.length - 1);
        this.activate(this.docs[nextIdx].id);
      } else {
        this.activeId = null;
        this.open({ kind: 'library', title: 'Bibliothèque' });
      }
    }

    this.renderTabs();
    this.saveOpenDocs();
  }

  closeAll() {
    for (const doc of this.docs) this.disposeDoc(doc);
    this.docs = [];
    this.activeId = null;
    this.renderTabs();
  }

  setShown(doc, shown) {
    if (!doc.handle || doc.shown === shown) return;
    doc.shown = shown;
    try {
      if (shown) doc.handle.onShow?.();
      else doc.handle.onHide?.();
    } catch (e) {
      console.error(e);
    }
  }

  disposeDoc(doc) {
    this.setShown(doc, false);
    try {
      doc.handle?.dispose();
    } catch (e) {
      console.error(e);
    }
    doc.handle = null;
    doc.container?.remove();
  }

  cycleNext() {
    if (this.docs.length <= 1) return;
    const curIdx = this.docs.findIndex((d) => d.id === this.activeId);
    const nextIdx = (curIdx + 1) % this.docs.length;
    this.activate(this.docs[nextIdx].id);
  }

  cyclePrev() {
    if (this.docs.length <= 1) return;
    const curIdx = this.docs.findIndex((d) => d.id === this.activeId);
    const prevIdx = (curIdx - 1 + this.docs.length) % this.docs.length;
    this.activate(this.docs[prevIdx].id);
  }

  markDirty(id, dirty = true) {
    const doc = this.docs.find((d) => d.id === id);
    if (doc && doc.dirty !== dirty) {
      doc.dirty = dirty;
      const tabEl = this.tabbar.querySelector(`[data-doc-id="${id}"] .pf-doc-tab-dirty`);
      if (tabEl) tabEl.style.display = dirty ? 'inline' : 'none';
    }
  }

  renderTabs() {
    try {
      this.tabbar.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'pf-doc-tabs';

      for (const doc of this.docs) {
        const tab = document.createElement('div');
        tab.className = `pf-doc-tab${doc.id === this.activeId ? ' active' : ''}`;
        tab.dataset.docId = doc.id;
        tab.title = `${doc.title} (${doc.kind})`;

        tab.innerHTML = `
          <span class="pf-doc-tab-icon">${/^\s*<svg[\s>]/i.test(doc.icon) ? doc.icon : esc(doc.icon)}</span>
          <span class="pf-doc-tab-title">${esc(doc.title)}</span>
          <span class="pf-doc-tab-dirty" style="display:${doc.dirty ? 'inline' : 'none'}">●</span>
          ${doc.kind !== 'library' ? '<button class="pf-doc-tab-close" title="Fermer (Ctrl+W)">×</button>' : ''}
        `;

        // Clic gauche : active
        tab.onclick = (e) => {
          if (!e.target.closest('.pf-doc-tab-close')) {
            this.activate(doc.id);
          }
        };

        // Clic molette : ferme l'onglet
        tab.onauxclick = (e) => {
          if (e.button === 1 && doc.kind !== 'library') {
            e.preventDefault();
            this.close(doc.id);
          }
        };

        // Clic sur la croix de fermeture
        const closeBtn = tab.querySelector('.pf-doc-tab-close');
        if (closeBtn) {
          closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.close(doc.id);
          };
        }

        wrapper.appendChild(tab);
      }

      this.tabbar.appendChild(wrapper);
    } catch (err) {
      console.error('ERROR IN RENDER TABS:', err);
    }
  }
}
