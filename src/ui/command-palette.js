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
        category: 'Scène',
        label: m.name,
        action: () => this.workspace.open({ kind: 'map', refId: m.id, title: m.name }),
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
