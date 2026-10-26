import './style.css';
import { createGame } from './engine.js';
import engineSource from './engine.js?raw';
import { buildStandaloneHTML } from './export-template.js';

let ctx = null; // état de l'onglet monté { game, ro, ... }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mount(container, store) {
  const mapOptions = (selected) => store.project.maps
    .map((m) => `<option value="${esc(m.id)}"${m.id === selected ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
  const s = store.project.settings;

  container.innerHTML = `
    <div class="play-root">
      <div class="play-bar">
        <button class="primary" data-act="replay">↻ Rejouer</button>
        <label>Carte <select data-role="run-map">${mapOptions(s.startMapId)}</select></label>
        <button data-act="fullscreen">⛶ Plein écran</button>
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
    let Phaser;
    try {
      Phaser = (await import('phaser')).default;
    } catch (e) {
      addLog('Impossible de charger Phaser : ' + e.message, 'error');
      return;
    }
    if (state.dead || token !== state.token) return;
    try {
      state.game = createGame(structuredClone(store.project), screen, Phaser, { mapId: runMap.value, onLog: addLog });
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
  state.ro = new ResizeObserver(() => { if (state.game) state.game.scale.refresh(); });
  state.ro.observe(screen);

  // Compteur de FPS (discret, dans l'en-tête de la console)
  state.fpsTimer = setInterval(() => {
    const g = state.game;
    fpsEl.textContent = g && g.loop ? '· ' + Math.round(g.loop.actualFps) + ' FPS' : '';
  }, 500);

  addLog('Jeu lancé. Flèches / Q D pour bouger, Espace pour sauter (selon les scripts).', 'sys');
  start();
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

// HTML autonome : voir export-template.js (fonction pure, aussi utilisée par le serveur MCP)
export function exportStandaloneHTML(project) {
  return buildStandaloneHTML(project, engineSource);
}

export function getDebugSnapshot() {
  return ctx?.game?.__debugSnapshot?.() || null;
}
