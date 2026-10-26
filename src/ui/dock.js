/**
 * PixelForge Studio — Gestionnaire de Dock & Coque d'interface (Godot 4 style)
 * Aucun import de bibliothèque externe, DOM pur.
 */

import './dock.css';

const STORAGE_KEY = 'pixelforge.layout';

const DEFAULT_LAYOUT = {
  leftWidth: 250,
  rightWidth: 280,
  bottomHeight: 170,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
  activePanels: {
    left: null,
    right: null,
    bottom: null,
  },
};

export class DockManager {
  constructor(options = {}) {
    this.options = options;
    this.layout = this.loadLayout();
    this.panels = new Map(); // id -> { id, title, icon, area, mount, unmount, el, mounted }
    this.areas = {
      left: { el: null, body: null, tabsEl: null, panels: [] },
      right: { el: null, body: null, tabsEl: null, panels: [] },
      bottom: { el: null, body: null, tabsEl: null, panels: [] },
      center: { el: null, body: null, tabsEl: null, panels: [] },
    };
    this.onPlay = options.onPlay || (() => {});
    this.onPlayCurrent = options.onPlayCurrent || (() => {});
    this.onStop = options.onStop || (() => {});
    this.isPlaying = false;
  }

  loadLayout() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_LAYOUT };
  }

  saveLayout() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layout));
    } catch {}
  }

  resetLayout() {
    this.layout = { ...DEFAULT_LAYOUT, activePanels: { ...this.layout.activePanels } };
    this.saveLayout();
    this.applyDimensions();
  }

  applyDimensions() {
    const root = this.rootEl;
    if (!root) return;

    root.style.setProperty('--dock-left-w', `${this.layout.leftWidth}px`);
    root.style.setProperty('--dock-right-w', `${this.layout.rightWidth}px`);
    root.style.setProperty('--dock-bottom-h', `${this.layout.bottomHeight}px`);

    this.areas.left.el?.classList.toggle('collapsed', !!this.layout.leftCollapsed);
    this.areas.right.el?.classList.toggle('collapsed', !!this.layout.rightCollapsed);
    this.areas.bottom.el?.classList.toggle('collapsed', !!this.layout.bottomCollapsed);
  }

  toggleCollapse(area) {
    if (area === 'left') this.layout.leftCollapsed = !this.layout.leftCollapsed;
    else if (area === 'right') this.layout.rightCollapsed = !this.layout.rightCollapsed;
    else if (area === 'bottom') this.layout.bottomCollapsed = !this.layout.bottomCollapsed;
    this.saveLayout();
    this.applyDimensions();
  }

  mount(container) {
    this.container = container;
    container.innerHTML = `
      <div class="pf-studio-shell">
        <header class="pf-top-bar">
          <div class="pf-top-left">
            <span class="pf-brand-badge">PixelForge</span>
            <div class="pf-menu-bar" id="pf-menubar"></div>
          </div>
          <div class="pf-top-center" id="pf-playbar">
            <button class="pf-playbar-btn play" data-action="play-main" title="Lancer le jeu principal (F5)">▶ Jouer (F5)</button>
            <button class="pf-playbar-btn" data-action="play-current" title="Lancer la scène courante (F6)">▶ Scène (F6)</button>
            <button class="pf-playbar-btn stop" data-action="stop" title="Arrêter le jeu (F8)">■ Arrêter (F8)</button>
          </div>
          <div class="pf-top-right" id="pf-topright"></div>
        </header>

        <div class="pf-dock-root" id="pf-dock-root">
          <!-- Dock Gauche -->
          <aside class="pf-dock-area pf-dock-left" data-area="left">
            <div class="pf-dock-header">
              <div class="pf-dock-tabs" data-tabs="left"></div>
              <div class="pf-dock-controls">
                <button class="pf-dock-btn" data-toggle="left" title="Replier / Déplier le panneau">◀</button>
              </div>
            </div>
            <div class="pf-dock-body" data-body="left"></div>
          </aside>

          <!-- Séparateur gauche -->
          <div class="pf-dock-splitter pf-dock-splitter-h" data-splitter="left"></div>

          <!-- Colonne centrale -->
          <div class="pf-dock-center-col">
            <main class="pf-dock-area pf-dock-center" data-area="center">
              <div class="pf-dock-body" data-body="center"></div>
            </main>

            <!-- Séparateur bas -->
            <div class="pf-dock-splitter pf-dock-splitter-v" data-splitter="bottom"></div>

            <!-- Dock Bas -->
            <section class="pf-dock-area pf-dock-bottom" data-area="bottom">
              <div class="pf-dock-header">
                <div class="pf-dock-tabs" data-tabs="bottom"></div>
                <div class="pf-dock-controls">
                  <button class="pf-dock-btn" data-toggle="bottom" title="Replier / Déplier la console">▼</button>
                </div>
              </div>
              <div class="pf-dock-body" data-body="bottom"></div>
            </section>
          </div>

          <!-- Séparateur droit -->
          <div class="pf-dock-splitter pf-dock-splitter-h" data-splitter="right"></div>

          <!-- Dock Droit -->
          <aside class="pf-dock-area pf-dock-right" data-area="right">
            <div class="pf-dock-header">
              <div class="pf-dock-tabs" data-tabs="right"></div>
              <div class="pf-dock-controls">
                <button class="pf-dock-btn" data-toggle="right" title="Replier / Déplier l'inspecteur">▶</button>
              </div>
            </div>
            <div class="pf-dock-body" data-body="right"></div>
          </aside>
        </div>
      </div>
    `;

    this.rootEl = container.querySelector('#pf-dock-root');
    for (const a of ['left', 'right', 'bottom', 'center']) {
      this.areas[a].el = container.querySelector(`[data-area="${a}"]`);
      this.areas[a].body = container.querySelector(`[data-body="${a}"]`);
      this.areas[a].tabsEl = container.querySelector(`[data-tabs="${a}"]`);
    }

    this.setupSplitters();
    this.setupMenus();
    this.setupPlaybar();
    this.setupShortcuts();
    this.applyDimensions();

    // Montage des panneaux déjà enregistrés
    for (const [id, p] of this.panels.entries()) {
      this.initPanelInArea(p);
    }
  }

  setupSplitters() {
    let activeSplitter = null;
    let startX = 0;
    let startY = 0;
    let startDim = 0;

    const onPointerDown = (e) => {
      const splitter = e.target.closest('[data-splitter]');
      if (!splitter) return;
      activeSplitter = splitter.dataset.splitter;
      splitter.classList.add('active');
      startX = e.clientX;
      startY = e.clientY;
      if (activeSplitter === 'left') startDim = this.layout.leftWidth;
      else if (activeSplitter === 'right') startDim = this.layout.rightWidth;
      else if (activeSplitter === 'bottom') startDim = this.layout.bottomHeight;
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!activeSplitter) return;
      if (activeSplitter === 'left') {
        const dx = e.clientX - startX;
        this.layout.leftWidth = Math.max(150, Math.min(600, startDim + dx));
        this.layout.leftCollapsed = false;
      } else if (activeSplitter === 'right') {
        const dx = startX - e.clientX;
        this.layout.rightWidth = Math.max(160, Math.min(600, startDim + dx));
        this.layout.rightCollapsed = false;
      } else if (activeSplitter === 'bottom') {
        const dy = startY - e.clientY;
        this.layout.bottomHeight = Math.max(80, Math.min(500, startDim + dy));
        this.layout.bottomCollapsed = false;
      }
      this.applyDimensions();
    };

    const onPointerUp = () => {
      if (!activeSplitter) return;
      const s = this.container.querySelector(`[data-splitter="${activeSplitter}"]`);
      s?.classList.remove('active');
      activeSplitter = null;
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      this.saveLayout();
    };

    this.container.addEventListener('pointerdown', onPointerDown);

    // Boutons de repli
    this.container.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) this.toggleCollapse(toggle.dataset.toggle);
    });
  }

  setupPlaybar() {
    const playbar = this.container.querySelector('#pf-playbar');
    if (!playbar) return;

    playbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const act = btn.dataset.action;
      if (act === 'play-main') this.triggerPlay();
      else if (act === 'play-current') this.triggerPlayCurrent();
      else if (act === 'stop') this.triggerStop();
    });
  }

  setPlayingState(playing) {
    this.isPlaying = playing;
    const playBtn = this.container?.querySelector('[data-action="play-main"]');
    if (playBtn) {
      playBtn.classList.toggle('playing', playing);
      playBtn.textContent = playing ? '↻ Relancer (F5)' : '▶ Jouer (F5)';
    }
  }

  triggerPlay() {
    this.setPlayingState(true);
    this.onPlay();
  }

  triggerPlayCurrent() {
    this.setPlayingState(true);
    this.onPlayCurrent();
  }

  triggerStop() {
    this.setPlayingState(false);
    this.onStop();
  }

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Éviter si l'utilisateur est dans un input ou éditeur de texte
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'F5') {
        e.preventDefault();
        this.triggerPlay();
      } else if (e.key === 'F6') {
        e.preventDefault();
        this.triggerPlayCurrent();
      } else if (e.key === 'F8') {
        e.preventDefault();
        this.triggerStop();
      }
    });
  }

  setupMenus() {
    const menuEl = this.container.querySelector('#pf-menubar');
    if (!menuEl) return;

    const menus = [
      {
        id: 'game',
        label: 'Jeu',
        items: [
          { label: '▶ Lancer le jeu', shortcut: 'F5', action: () => this.triggerPlay() },
          { label: '▶ Lancer la scène', shortcut: 'F6', action: () => this.triggerPlayCurrent() },
          { label: '■ Arrêter', shortcut: 'F8', action: () => this.triggerStop() },
          { sep: true },
          { label: 'Exporter HTML autonome…', shortcut: '', action: () => this.options.onExport?.() },
        ],
      },
      {
        id: 'view',
        label: 'Affichage',
        items: [
          { label: 'Basculer panneau gauche', action: () => this.toggleCollapse('left') },
          { label: 'Basculer panneau droit', action: () => this.toggleCollapse('right') },
          { label: 'Basculer console', action: () => this.toggleCollapse('bottom') },
          { sep: true },
          { label: 'Réinitialiser la disposition', action: () => this.resetLayout() },
        ],
      },
      {
        id: 'help',
        label: 'Aide',
        items: [
          { label: 'Guide PixelForge…', action: () => window.open('https://github.com/dyzlek/pixelforge#readme', '_blank') },
          { label: 'Raccourcis clavier (F5, F6, F8, Ctrl+S)', action: () => alert('Raccourcis Studio :\n• F5 : Lancer le jeu\n• F6 : Lancer la scène courante\n• F8 : Arrêter le jeu\n• Ctrl+S : Sauvegarder\n• Ctrl+Z / Ctrl+Y : Annuler / Rétablir') },
          { sep: true },
          { label: 'À propos de PixelForge Studio', action: () => alert('PixelForge Studio v3.0\nMoteur et studio de création de jeux 2D / 3D rétro.') },
        ],
      },
    ];

    let openMenuId = null;

    const closeAll = () => {
      openMenuId = null;
      menuEl.querySelectorAll('.pf-menu-dropdown').forEach((d) => d.classList.remove('show'));
      menuEl.querySelectorAll('.pf-menu-btn').forEach((b) => b.classList.remove('open'));
    };

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#pf-menubar')) closeAll();
    });

    for (const m of menus) {
      const itemEl = document.createElement('div');
      itemEl.className = 'pf-menu-item';

      const btn = document.createElement('button');
      btn.className = 'pf-menu-btn';
      btn.textContent = m.label;
      itemEl.appendChild(btn);

      const drop = document.createElement('div');
      drop.className = 'pf-menu-dropdown';

      for (const it of m.items) {
        if (it.sep) {
          const sep = document.createElement('div');
          sep.className = 'pf-menu-sep';
          drop.appendChild(sep);
        } else {
          const actionBtn = document.createElement('button');
          actionBtn.className = 'pf-menu-action';
          actionBtn.innerHTML = `<span>${it.label}</span>${it.shortcut ? `<span class="pf-menu-shortcut">${it.shortcut}</span>` : ''}`;
          actionBtn.onclick = () => {
            closeAll();
            it.action();
          };
          drop.appendChild(actionBtn);
        }
      }

      itemEl.appendChild(drop);

      btn.onclick = (e) => {
        e.stopPropagation();
        if (openMenuId === m.id) {
          closeAll();
        } else {
          closeAll();
          openMenuId = m.id;
          drop.classList.add('show');
          btn.classList.add('open');
        }
      };

      btn.onmouseenter = () => {
        if (openMenuId && openMenuId !== m.id) {
          closeAll();
          openMenuId = m.id;
          drop.classList.add('show');
          btn.classList.add('open');
        }
      };

      menuEl.appendChild(itemEl);
    }
  }

  registerPanel(panel) {
    // { id, title, icon, area, mount, unmount }
    this.panels.set(panel.id, panel);
    const area = this.areas[panel.area || 'left'];
    if (area) {
      area.panels.push(panel);
      if (this.rootEl) this.initPanelInArea(panel);
    }
  }

  initPanelInArea(panel) {
    const area = this.areas[panel.area];
    if (!area || !area.tabsEl) return;

    // Ajout de l'onglet si non présent
    if (!area.tabsEl.querySelector(`[data-tab-id="${panel.id}"]`)) {
      const tab = document.createElement('button');
      tab.className = 'pf-dock-tab';
      tab.dataset.tabId = panel.id;
      tab.innerHTML = `${panel.icon ? `<span>${panel.icon}</span>` : ''}<span>${panel.title}</span>`;
      tab.onclick = () => this.activatePanel(panel.id);
      area.tabsEl.appendChild(tab);
    }

    // Activer si aucun panneau actif dans cette zone ou si mémorisé
    const savedActive = this.layout.activePanels[panel.area];
    if (savedActive === panel.id || (!savedActive && area.panels[0]?.id === panel.id)) {
      this.activatePanel(panel.id);
    }
  }

  activatePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    const area = this.areas[panel.area];
    if (!area) return;

    this.layout.activePanels[panel.area] = panelId;
    this.saveLayout();

    // Mise à jour de l'onglet actif
    if (area.tabsEl) {
      for (const btn of area.tabsEl.querySelectorAll('.pf-dock-tab')) {
        btn.classList.toggle('active', btn.dataset.tabId === panelId);
      }
    }

    // Montage dans le corps de l'area
    if (area.body) {
      // Démonter les autres panneaux de la zone
      for (const other of area.panels) {
        if (other.id !== panelId && other.mounted) {
          try { other.unmount?.(); } catch (e) { console.error(e); }
          other.mounted = false;
        }
      }
      area.body.replaceChildren();
      const container = document.createElement('div');
      container.className = 'pf-dock-panel-container';
      container.style.width = '100%';
      container.style.height = '100%';
      area.body.appendChild(container);
      try {
        panel.mount(container);
        panel.mounted = true;
      } catch (e) {
        console.error(`Erreur au montage du panneau ${panelId}:`, e);
      }
    }
  }

  getAreaBody(areaName) {
    return this.areas[areaName]?.body || null;
  }
}
