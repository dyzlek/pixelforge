/**
 * PixelForge Studio — Multi-document Workspace (Godot 4 / IDE style)
 * Permet d'ouvrir plusieurs ressources simultanément dans des onglets centraux sans écraser l'état.
 */

import './documents.css';

const ICONS = {
  library: '📚',
  map: '🗺️',
  scene: '🗺️',
  pixel: '🎨',
  sprite: '🎨',
  objects: '📜',
  script: '📜',
  sound: '🔊',
  song: '🎵',
  model3d: '🧊',
  play: '▶',
};

export class DocumentWorkspace {
  constructor({ tabbar, view, store }) {
    this.tabbar = tabbar;
    this.view = view;
    this.store = store;
    this.docs = []; // { id, kind, refId, title, icon, dirty, container, module, unmountFn }
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
            this.open(item, false);
          }
          const savedActive = localStorage.getItem(`pixelforge.activeDoc.${this.store.currentId}`);
          if (savedActive && this.docs.some((d) => d.id === savedActive)) {
            this.activate(savedActive);
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
      this.open({ kind: 'map', refId: p.settings?.startMapId || p.maps[0].id, title: p.maps[0].name });
    }
    if (p.sprites?.length) {
      this.open({ kind: 'pixel', refId: p.sprites[0].id, title: p.sprites[0].name });
    }
    if (p.objects?.length) {
      this.open({ kind: 'objects', refId: p.objects[0].id, title: p.objects[0].name });
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
      if (activateNow) this.activate(id);
      return existing;
    }

    const docIcon = icon || ICONS[kind] || '📄';
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
      unmountFn: null,
    };

    this.docs.push(doc);
    this.renderTabs();

    // Montage asynchrone du module de l'éditeur
    try {
      let mod = null;
      if (kind === 'library') mod = await import('../library/index.js');
      else if (kind === 'pixel' || kind === 'sprite') mod = await import('../editors/pixel/index.js');
      else if (kind === 'map' || kind === 'scene') mod = await import('../editors/map/index.js');
      else if (kind === 'objects' || kind === 'script') mod = await import('../editors/objects/index.js');
      else if (kind === 'sound') mod = await import('../editors/sound/index.js');
      else if (kind === 'play') mod = await import('../runtime/play.js');

      if (mod) {
        doc.module = mod;
        if (refId) {
          if (kind === 'pixel' || kind === 'sprite') this.store.ui.selectedSpriteId = refId;
          else if (kind === 'map' || kind === 'scene') this.store.ui.selectedMapId = refId;
          else if (kind === 'objects' || kind === 'script') this.store.ui.selectedObjectId = refId;
        }
        const unmount = mod.mount(container, this.store, { refId });
        doc.unmountFn = typeof unmount === 'function' ? unmount : mod.unmount;
      }
    } catch (err) {
      console.error(`Erreur au chargement de l'éditeur pour ${id}:`, err);
      container.innerHTML = `<div style="padding:20px;color:var(--danger)">Erreur de chargement: ${err.message}</div>`;
    }

    if (activateNow) {
      this.activate(id);
    }

    this.saveOpenDocs();
    return doc;
  }

  resolveTitle(kind, refId) {
    const p = this.store.project;
    if (!p) return kind;
    if (kind === 'library') return 'Bibliothèque';
    if (kind === 'play') return '▶ Jouer';
    if (refId) {
      if (kind === 'map' || kind === 'scene') return p.maps?.find((m) => m.id === refId)?.name || 'Carte';
      if (kind === 'pixel' || kind === 'sprite') return p.sprites?.find((s) => s.id === refId)?.name || 'Sprite';
      if (kind === 'objects' || kind === 'script') return p.objects?.find((o) => o.id === refId)?.name || 'Objet';
      if (kind === 'sound') return p.sounds?.find((s) => s.id === refId)?.name || 'Son';
    }
    const defaults = { map: 'Cartes', pixel: 'Pixel art', objects: 'Objets & code', sound: 'Sons' };
    return defaults[kind] || kind;
  }

  activate(id) {
    const doc = this.docs.find((d) => d.id === id);
    if (!doc) return;

    this.activeId = id;

    // Affiche le conteneur du document actif, masque tous les autres
    for (const d of this.docs) {
      if (d.container) {
        d.container.style.display = d.id === id ? 'flex' : 'none';
      }
    }

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

    // Nettoyage de l'instance
    try {
      if (typeof doc.unmountFn === 'function') doc.unmountFn();
      else if (doc.module?.unmount) doc.module.unmount();
    } catch (e) {
      console.error(e);
    }

    // Retrait du DOM
    doc.container?.remove();
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
    for (const doc of this.docs) {
      try {
        if (typeof doc.unmountFn === 'function') doc.unmountFn();
        else if (doc.module?.unmount) doc.module.unmount();
      } catch (e) {
        console.error(e);
      }
      doc.container?.remove();
    }
    this.docs = [];
    this.activeId = null;
    this.renderTabs();
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
    this.tabbar.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'pf-doc-tabs';

    for (const doc of this.docs) {
      const tab = document.createElement('div');
      tab.className = `pf-doc-tab${doc.id === this.activeId ? ' active' : ''}`;
      tab.dataset.docId = doc.id;
      tab.title = `${doc.title} (${doc.kind})`;

      tab.innerHTML = `
        <span class="pf-doc-tab-icon">${doc.icon}</span>
        <span class="pf-doc-tab-title">${doc.title}</span>
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
  }
}
