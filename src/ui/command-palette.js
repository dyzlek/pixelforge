/**
 * PixelForge Studio — Palette de Commandes (Ctrl+Maj+P) et Ouverture Rapide (Ctrl+P)
 */

import './command-palette.css';
import { shortcuts } from './shortcuts.js';
import { getIconSvg } from './icons.js';

export class CommandPalette {
  constructor({ store, workspace, dock, onOpenPrefs = () => {} }) {
    this.store = store;
    this.workspace = workspace;
    this.dock = dock;
    this.onOpenPrefs = onOpenPrefs;
    this.shortcuts = shortcuts;
    this.activeModal = null;

    this.registerGlobalCommands();
  }

  registerGlobalCommands() {
    // Raccourcis d'ouverture de la palette
    shortcuts.register({
      id: 'palette',
      label: 'Afficher toutes les commandes',
      category: 'Vue',
      key: 'p',
      ctrl: true,
      shift: true,
      shortcutText: 'Ctrl+Maj+P',
      action: () => this.openCommands(),
    });

    shortcuts.register({
      id: 'quick-open',
      label: 'Accéder rapidement au fichier / ressource',
      category: 'Fichier',
      key: 'p',
      ctrl: true,
      shift: false,
      shortcutText: 'Ctrl+P',
      action: () => this.openQuickOpen(),
    });

    shortcuts.register({
      id: 'save',
      label: 'Enregistrer le projet',
      category: 'Fichier',
      key: 's',
      ctrl: true,
      shortcutText: 'Ctrl+S',
      action: () => this.store.saveNow(),
    });

    shortcuts.register({
      id: 'play-main',
      label: 'Lancer le jeu principal',
      category: 'Jeu',
      key: 'F5',
      shortcutText: 'F5',
      action: () => this.dock.triggerPlay(),
    });

    shortcuts.register({
      id: 'play-current',
      label: 'Lancer la scène courante',
      category: 'Jeu',
      key: 'F6',
      shortcutText: 'F6',
      action: () => this.dock.triggerPlayCurrent(),
    });

    shortcuts.register({
      id: 'stop',
      label: 'Arrêter le jeu',
      category: 'Jeu',
      key: 'F8',
      shortcutText: 'F8',
      action: () => this.dock.triggerStop(),
    });

    shortcuts.register({
      id: 'preferences',
      label: 'Ouvrir les préférences Studio',
      category: 'Édition',
      key: ',',
      ctrl: true,
      shortcutText: 'Ctrl+,',
      action: () => this.onOpenPrefs(),
    });

    shortcuts.register({
      id: 'ai-assistant',
      label: "Ouvrir l'assistant IA local (LM Studio)",
      category: 'Outils',
      key: 'i',
      ctrl: true,
      shift: true,
      shortcutText: 'Ctrl+Maj+I',
      action: () => {
        this.dock.activatePanel('ai-assistant');
      },
    });

    shortcuts.register({
      id: 'view-3d-focus',
      label: 'Vue 3D : Centrer sur la sélection (Focus)',
      category: 'Vue 3D',
      key: 'f',
      shortcutText: 'F',
      action: () => window.dispatchEvent(new CustomEvent('pixelforge:view3d:focus')),
    });

    shortcuts.register({
      id: 'view-3d-front',
      label: 'Vue 3D : Vue de Face',
      category: 'Vue 3D',
      key: '1',
      shortcutText: '1 / Pavé 1',
      action: () => window.dispatchEvent(new CustomEvent('pixelforge:view3d:view', { detail: 'front' })),
    });

    shortcuts.register({
      id: 'view-3d-side',
      label: 'Vue 3D : Vue de Côté (Profil)',
      category: 'Vue 3D',
      key: '3',
      shortcutText: '3 / Pavé 3',
      action: () => window.dispatchEvent(new CustomEvent('pixelforge:view3d:view', { detail: 'side' })),
    });

    shortcuts.register({
      id: 'view-3d-top',
      label: 'Vue 3D : Vue de Dessus',
      category: 'Vue 3D',
      key: '7',
      shortcutText: '7 / Pavé 7',
      action: () => window.dispatchEvent(new CustomEvent('pixelforge:view3d:view', { detail: 'top' })),
    });

    shortcuts.register({
      id: 'view-3d-persp-ortho',
      label: 'Vue 3D : Basculer Perspective / Orthographique',
      category: 'Vue 3D',
      key: '5',
      shortcutText: '5 / Pavé 5',
      action: () => window.dispatchEvent(new CustomEvent('pixelforge:view3d:view', { detail: 'toggle-ortho' })),
    });
  }

  openCommands() {
    const list = shortcuts.getCommands().map((c) => ({
      icon: getIconSvg('settings', 13),
      category: c.category,
      label: c.label,
      shortcut: c.shortcutText,
      action: c.action,
    }));
    this.showModal({
      placeholder: '> Tapez une commande…',
      items: list,
    });
  }

  openQuickOpen() {
    const p = this.store.project;
    if (!p) return;

    const items = [];

    for (const m of p.maps || []) {
      items.push({
        icon: getIconSvg('map', 13),
        category: 'Scène 2D',
        label: m.name,
        action: () => this.workspace.open({ kind: 'map', refId: m.id, title: m.name }),
      });
    }
    for (const sc of p.scenes3d || []) {
      items.push({
        icon: getIconSvg('map', 13),
        category: 'Scène 3D',
        label: sc.name,
        action: () => this.workspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name }),
      });
    }
    for (const mod of p.models || []) {
      items.push({
        icon: getIconSvg('cube', 13),
        category: 'Modèle 3D',
        label: mod.name,
        action: () => this.workspace.open({ kind: 'model3d', refId: mod.id, title: mod.name }),
      });
    }
    for (const s of p.sprites || []) {
      items.push({
        icon: getIconSvg('palette', 13),
        category: 'Sprite',
        label: s.name,
        action: () => this.workspace.open({ kind: 'pixel', refId: s.id, title: s.name }),
      });
    }
    for (const o of p.objects || []) {
      items.push({
        icon: getIconSvg('object', 13),
        category: 'Objet',
        label: o.name,
        action: () => this.workspace.open({ kind: 'objects', refId: o.id, title: o.name }),
      });
    }
    for (const snd of p.sounds || []) {
      items.push({
        icon: getIconSvg('sound', 13),
        category: 'Son',
        label: snd.name,
        action: () => this.workspace.open({ kind: 'sound', refId: snd.id, title: snd.name }),
      });
    }
    for (const sng of p.songs || []) {
      items.push({
        icon: getIconSvg('music', 13),
        category: 'Musique',
        label: sng.name,
        action: () => this.workspace.open({ kind: 'song', refId: sng.id, title: sng.name }),
      });
    }

    this.showModal({
      placeholder: 'Ouvrir une ressource…',
      items,
    });
  }

  showModal({ placeholder, items }) {
    if (this.activeModal) this.activeModal.remove();

    const back = document.createElement('div');
    back.className = 'pf-palette-back';

    back.innerHTML = `
      <div class="pf-palette-modal">
        <div class="pf-palette-input-wrap">
          <input type="text" class="pf-palette-input" placeholder="${placeholder}" spellcheck="false" />
        </div>
        <div class="pf-palette-list"></div>
      </div>
    `;

    document.body.appendChild(back);
    this.activeModal = back;

    const input = back.querySelector('.pf-palette-input');
    const listEl = back.querySelector('.pf-palette-list');
    let selectedIdx = 0;
    let filtered = [...items];

    const render = () => {
      listEl.innerHTML = '';
      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="pf-palette-empty">Aucun résultat correspondant</div>';
        return;
      }

      filtered.forEach((it, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = `pf-palette-item${idx === selectedIdx ? ' active' : ''}`;
        itemEl.innerHTML = `
          <div class="pf-palette-item-left">
            <span>${it.icon || '•'}</span>
            ${it.category ? `<span class="pf-palette-cat">${it.category}</span>` : ''}
            <span class="pf-palette-label">${it.label}</span>
          </div>
          ${it.shortcut ? `<span class="pf-palette-shortcut">${it.shortcut}</span>` : ''}
        `;

        itemEl.onclick = () => {
          back.remove();
          this.activeModal = null;
          it.action();
        };

        listEl.appendChild(itemEl);
      });

      // Scroll vers l'élément sélectionné
      const activeEl = listEl.children[selectedIdx];
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    };

    input.focus();

    input.oninput = () => {
      const q = input.value.trim().toLowerCase();
      filtered = items.filter((it) => it.label.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q)));
      selectedIdx = 0;
      render();
    };

    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length) selectedIdx = (selectedIdx + 1) % filtered.length;
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filtered.length) selectedIdx = (selectedIdx - 1 + filtered.length) % filtered.length;
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = filtered[selectedIdx];
        if (sel) {
          back.remove();
          this.activeModal = null;
          sel.action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        back.remove();
        this.activeModal = null;
      }
    };

    back.onclick = (e) => {
      if (e.target === back) {
        back.remove();
        this.activeModal = null;
      }
    };

    render();
  }
}
