import './style.css';
import { createGame } from './engine.js';
import engineSource from './engine.js?raw';
import chipSource from '../audio/chip.js?raw';
import { createChipAudio } from '../audio/chip.js';
import { buildStandaloneHTML } from './export-template.js';
import { createGame3D } from '../runtime3d/engine3d.js';
import engine3dSource from '../runtime3d/engine3d.js?raw';
import { buildStandaloneHTML3D } from '../runtime3d/export-template-3d.js';

let ctx = null; // état de l'onglet monté { game, ro, ... }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mount(container, store) {
  const mapOptions = (selected) => store.project.maps
    .map((m) => `<option value="${esc(m.id)}"${m.id === selected ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
  const s = store.project.settings;

  container.innerHTML = `
    <div class="play-root">
      <div class="play-bar">
        <button class="primary" data-act="replay">Rejouer</button>
        <label>Carte <select data-role="run-map">${mapOptions(s.startMapId)}</select></label>
        <button data-act="fullscreen">Plein écran</button>
        <span class="play-sep"></span>
        <button data-act="toggle-pause" class="pf-dock-btn" title="Pause / Reprendre (P)">Pause</button>
        <button data-act="step-frame" class="pf-dock-btn" title="Image par image (O)">Image</button>
        <button data-act="toggle-colliders" class="pf-dock-btn" title="Boites de collision (F9)">Colliders</button>
        <span class="play-sep"></span>
        <label>Largeur <input type="number" data-set="width" min="64" max="1920" step="16" value="${s.width}"></label>
        <label>Hauteur <input type="number" data-set="height" min="64" max="1080" step="9" value="${s.height}"></label>
        <label>Gravité <input type="number" data-set="gravity" min="0" max="5000" step="50" value="${s.gravity}"></label>
        <label>Carte de départ <select data-set="startMapId">${mapOptions(s.startMapId)}</select></label>
      </div>
      <div class="play-stage"><div class="play-screen"></div></div>
      <div class="play-console">
        <div class="play-console-head"><span>Console <span class="play-fps"></span></span><button data-act="clear">Effacer</button></div>
        <div class="play-log"></div>
      </div>
    </div>`;

  const $ = (sel) => container.querySelector(sel);
  const screen = $('.play-screen');
  const logEl = $('.play-log');
  const runMap = $('[data-role="run-map"]');
  const fpsEl = $('.play-fps');
  const state = { game: null, ro: null, token: 0, offs: [], dead: false };
  ctx = state;

  // Les touches tapées dans la barre ne doivent pas arriver au jeu
  $('.play-bar').addEventListener('keydown', (e) => e.stopPropagation());

  function addLog(msg, level = 'info') {
    const t = new Date().toLocaleTimeString();
    try { store.emit('log', { msg, level, time: t }); } catch {}
    const line = document.createElement('div');
    line.className = 'play-line play-' + level;
    line.innerHTML = `<span class="play-time">${t}</span>${esc(msg)}`;
    logEl.appendChild(line);
    while (logEl.childElementCount > 300) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }

  function stop() {
    state.token++;
    if (state.game) { try { state.game.destroy(true); } catch (e) { console.error(e); } state.game = null; }
    screen.replaceChildren();
  }

  async function start() {
    stop();
    const token = state.token;
    const is3D = store.project?.settings?.dimension === '3d';

    if (is3D) {
      let THREE;
      try {
        THREE = await import('three');
      } catch (e) {
        addLog('Impossible de charger Three.js : ' + e.message, 'error');
        return;
      }
      let GLTFLoader = null;
      try {
        const gltfMod = await import('three/addons/loaders/GLTFLoader.js');
        GLTFLoader = gltfMod.GLTFLoader;
      } catch {}
      let RAPIER = null;
      if (store.project?.settings?.physics3d === 'rapier') {
        try {
          const rapierMod = await import('@dimforge/rapier3d-compat');
          await rapierMod.init();
          RAPIER = rapierMod;
        } catch (e) {
          addLog('Impossible de charger Rapier 3D : ' + e.message, 'warn');
        }
      }
      if (state.dead || token !== state.token) return;
      try {
        // Scene demandee par l'editeur de scene 3D (« Tester la scene »), une seule fois
        const startScene3DId = store.ui.playScene3DId || null;
        store.ui.playScene3DId = null;
        const playFromCamera = store.ui.playFromCamera || null;
        store.ui.playFromCamera = null;
        const spawnPlayerPosition = store.ui.spawnPlayerPosition || null;
        store.ui.spawnPlayerPosition = null;
        state.game = createGame3D(structuredClone(store.project), screen, THREE, {
          onLog: addLog,
          createChipAudio,
          startScene3DId,
          GLTFLoader,
          rapier: RAPIER,
          playFromCamera,
          spawnPlayerPosition,
        });
      } catch (e) {
        addLog('Impossible de lancer le jeu 3D : ' + e.message, 'error');
        console.error(e);
      }
      return;
    }

    let Phaser;
    try {
      Phaser = (await import('phaser')).default;
    } catch (e) {
      addLog('Impossible de charger Phaser : ' + e.message, 'error');
      return;
    }
    if (state.dead || token !== state.token) return;
    try {
      state.game = createGame(structuredClone(store.project), screen, Phaser, {
        mapId: runMap.value,
        onLog: addLog,
        createChipAudio
      });
    } catch (e) {
      addLog('Impossible de lancer le jeu : ' + e.message, 'error');
      console.error(e);
    }
  }

  container.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'replay') { addLog('— Nouvelle partie —', 'sys'); start(); }
    else if (act === 'clear') logEl.replaceChildren();
    else if (act === 'fullscreen') {
      const el = $('.play-stage');
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen?.().catch((err) => addLog('Plein écran impossible : ' + err.message, 'warn'));
    } else if (act === 'toggle-pause') {
      const btn = $('[data-act="toggle-pause"]');
      if (state.game?.isPaused?.()) {
        state.game.resume();
        btn.textContent = 'Pause';
      } else {
        state.game?.pause?.();
        btn.textContent = 'Reprendre';
      }
    } else if (act === 'step-frame') {
      state.game?.stepFrame?.();
      const btn = $('[data-act="toggle-pause"]');
      if (btn) btn.textContent = 'Reprendre';
    } else if (act === 'toggle-colliders') {
      const shown = state.game?.setDebugColliders?.();
      $('[data-act="toggle-colliders"]')?.classList.toggle('active', !!shown);
    }
  });

  // Réglages du jeu : appliqués au projet puis relance
  container.querySelectorAll('[data-set]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.set;
      const value = input.type === 'number' ? Math.max(Number(input.min) || 0, Number(input.value) || 0) : input.value;
      if (input.type === 'number') input.value = value;
      store.update((p) => { p.settings[key] = value; }, 'settings');
      if (key === 'startMapId') runMap.value = value;
      start();
    });
  });
  runMap.addEventListener('change', () => start());

  // Garde le canvas ajusté à la zone quand elle change de taille (console, plein écran…)
  // (le jeu 3D n'a pas de gestionnaire d'echelle Phaser : son canvas suit la zone en CSS)
  state.ro = new ResizeObserver(() => { state.game?.scale?.refresh?.(); });
  state.ro.observe(screen);

  // Compteur de FPS (discret, dans l'en-tête de la console)
  state.fpsTimer = setInterval(() => {
    const g = state.game;
    fpsEl.textContent = g && g.loop ? '· ' + Math.round(g.loop.actualFps) + ' FPS' : '';
  }, 500);

  const onGlobalKey = (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'p' || e.key === 'P') {
      const btn = $('[data-act="toggle-pause"]');
      if (state.game?.isPaused?.()) {
        state.game.resume();
        if (btn) btn.textContent = 'Pause';
      } else {
        state.game?.pause?.();
        if (btn) btn.textContent = 'Reprendre';
      }
    } else if (e.key === 'o' || e.key === 'O') {
      state.game?.stepFrame?.();
      const btn = $('[data-act="toggle-pause"]');
      if (btn) btn.textContent = 'Reprendre';
    } else if (e.key === 'F9') {
      e.preventDefault();
      const shown = state.game?.setDebugColliders?.();
      $('[data-act="toggle-colliders"]')?.classList.toggle('active', !!shown);
    }
  };
  window.addEventListener('keydown', onGlobalKey);
  state.offs.push(() => window.removeEventListener('keydown', onGlobalKey));

  addLog('Jeu lancé. Flèches / Q D pour bouger, Espace pour sauter (selon les scripts).', 'sys');
  start();
  return { dispose: () => { state.offs.forEach((fn) => fn()); unmount(); } }; // onglet unique (play:main) : l'état de module suffit
}

export function unmount() {
  if (!ctx) return;
  ctx.dead = true;
  ctx.token++;
  if (ctx.ro) ctx.ro.disconnect();
  clearInterval(ctx.fpsTimer);
  if (ctx.game) { try { ctx.game.destroy(true); } catch (e) { console.error(e); } }
  ctx = null;
}

// HTML autonome : voir export-template.js (fonction pure, aussi utilisee par le serveur MCP)
export function exportStandaloneHTML(project) {
  if (project?.settings?.dimension === '3d') {
    return buildStandaloneHTML3D(project, engine3dSource, chipSource);
  }
  return buildStandaloneHTML(project, engineSource, chipSource);
}

export function getDebugSnapshot() {
  return ctx?.game?.__debugSnapshot?.() || null;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__pfDebugSnapshot = getDebugSnapshot;
  globalThis.__pfPlayPause = () => ctx?.game?.pause?.();
  globalThis.__pfPlayResume = () => ctx?.game?.resume?.();
  globalThis.__pfPlayStep = () => ctx?.game?.stepFrame?.();
  globalThis.__pfPlayToggleColliders = (val) => ctx?.game?.setDebugColliders?.(val);
  globalThis.__pfGameApi = () => (ctx?.game?.getGameApi ? ctx.game.getGameApi() : ctx?.game) || null;
}
