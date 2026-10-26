// PixelForge — runtime : transforme un projet en jeu Phaser.
// Aucun import dans ce fichier (Phaser est passé en paramètre) et une seule déclaration exportée :
// l'export HTML autonome (export-template.js) inline ce code source tel quel, après avoir retiré le mot-clé d'export.
// API des scripts : voir docs/SCRIPT_API.md

export function createGame(project, parent, Phaser, opts = {}) {
  const settings = project.settings;
  const KEYS = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE', 'ENTER', 'SHIFT', 'Z', 'X', 'C', 'A', 'W', 'S', 'D', 'Q', 'E'];
  const SNAP_PROPS = ['x', 'y', 'vx', 'vy', 'flipX', 'visible', 'alpha', 'angle', 'onGround', 'depth', 'scale', 'centerX', 'centerY', 'flipY', 'collideMap', 'collideObjects'];
  const HUD_FONT = Math.max(8, Math.round(settings.height / 18));
  const DEPTH_ENTITY = 50, DEPTH_ABOVE = 500, DEPTH_PARTICLES = 900, DEPTH_HUD = 1000;

  const spritesById = {};
  for (const s of project.sprites) spritesById[s.id] = s;
  const objectsByName = {};
  const objectsById = {};
  for (const o of project.objects) { objectsById[o.id] = o; if (!objectsByName[o.name]) objectsByName[o.name] = o; }
  const findMap = (ref) => project.maps.find((m) => m.id === ref || m.name === ref) || null;
  const startMap = findMap(opts.mapId) || findMap(settings.startMapId) || project.maps[0] || null;
  const soundList = project.sounds || [];

  const gameVars = { score: 0 }; // game.vars : conservées d'une carte à l'autre
  let destroyed = false;
  let activeScene = null;

  const fmt = (a) => {
    if (typeof a === 'string') return a;
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); }
  };
  const log = (msg, level = 'info') => {
    try {
      if (opts.onLog) opts.onLog(String(msg), level);
      else (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(msg);
    } catch (e) { console.error(e); }
  };
  const warned = {};
  const warnOnce = (msg) => { if (!warned[msg]) { warned[msg] = true; log(msg, 'warn'); } };
  const errMsg = (e) => (e && e.message ? e.message : String(e));

  const boxKey = (obj) => '__box_' + obj.id;

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const parseColor = (c, dflt = 0xffffff) => {
    if (typeof c === 'number' && isFinite(c)) return c;
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(c || '').trim());
    if (!m) return dflt;
    let h = m[1];
    if (h.length === 3) h = h.replace(/./g, (ch) => ch + ch);
    return parseInt(h, 16);
  };
  const cssColor = (c) => '#' + parseColor(c, 0xf4f4f4).toString(16).padStart(6, '0');
  const cloneProps = (p) => {
    try { return p && typeof p === 'object' ? JSON.parse(JSON.stringify(p)) : {}; } catch (e) { return {}; }
  };

  // ---------- Texte HUD pixel-perfect : on dessine le texte puis on supprime l'anti-crénelage ----------
  function pixelText(text, o = {}) {
    const fontPx = Math.max(4, Math.round(HUD_FONT * (num(o.size) && o.size > 0 ? o.size : 1)));
    const align = o.align === 'center' || o.align === 'right' ? o.align : 'left';
    const font = 'bold ' + fontPx + 'px Verdana, "Trebuchet MS", Arial, sans-serif';
    const lines = String(text).split('\n');
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const lh = fontPx + 2;
    const widths = lines.map((l) => measure.measureText(l).width);
    const w = Math.max(1, Math.ceil(Math.max(...widths)) + 4);
    const h = lines.length * lh + 4;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = font;
    ctx.textBaseline = 'top';
    const lx = (i) => Math.round(align === 'center' ? (w - widths[i]) / 2 : align === 'right' ? w - 2 - widths[i] : 2);
    ctx.fillStyle = '#1a1c2c';
    lines.forEach((l, i) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) ctx.fillText(l, lx(i) + dx, 2 + i * lh + dy);
    });
    ctx.fillStyle = cssColor(o.color);
    lines.forEach((l, i) => ctx.fillText(l, lx(i), 2 + i * lh));
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---------- Son : WebAudio, sons synthétisés (presets) ou fichiers ----------
  const audio = (() => {
    const PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'];
    const CHIPTUNE_PRESETS = {
      tetris: {
        bpm: 140,
        notes: ['E5', 'B4', 'C5', 'D5', 'C5', 'B4', 'A4', 'A4', 'C5', 'E5', 'D5', 'C5', 'B4', 'B4', 'C5', 'D5', 'E5', 'C5', 'A4', 'A4', 'D5', 'F5', 'A5', 'G5', 'F5', 'E5', 'C5', 'E5', 'D5', 'C5', 'B4', 'B4', 'C5', 'D5', 'E5', 'C5', 'A4', 'A4'],
        durations: [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 3, 1, 2, 2, 2, 2, 2, 2, 3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 3, 1, 2, 2, 2, 2, 2, 2]
      },
      adventure: {
        bpm: 150,
        notes: ['C4', 'E4', 'G4', 'C5', 'B4', 'G4', 'E4', 'G4', 'A4', 'C5', 'E5', 'D5', 'B4', 'G4', 'D5', 'C5'],
        durations: [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2]
      },
      action: {
        bpm: 160,
        notes: ['A3', 'A3', 'C4', 'A3', 'D4', 'A3', 'E4', 'D4', 'A3', 'A3', 'C4', 'A3', 'G4', 'F4', 'E4', 'D4'],
        durations: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
      }
    };
    CHIPTUNE_PRESETS.korobeiniki = CHIPTUNE_PRESETS.tetris;

    let ctx = null, master = null, chip = null, music = null, pendingMusic = null;
    const buffers = {};
    const chipFactory = opts.createChipAudio || (typeof createChipAudio === 'function' ? createChipAudio : (typeof globalThis !== 'undefined' && globalThis.createChipAudio ? globalThis.createChipAudio : null));

    const getCtx = () => {
      if (ctx) return ctx;
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.6;
        master.connect(ctx.destination);
        if (chipFactory) chip = chipFactory(ctx, master);
      } catch (e) { ctx = null; }
      return ctx;
    };
    const running = () => !!ctx && ctx.state === 'running';

    // Appele au premier geste de l'utilisateur (les navigateurs interdisent le son avant)
    const unlock = () => {
      const c = getCtx();
      if (!c) return;
      if (c.state !== 'running') { try { c.resume(); } catch (e) { /* ignore */ } }
      if (!chip && chipFactory && master) {
        try { chip = chipFactory(c, master); } catch (e) {}
      }
      if (pendingMusic) { const n = pendingMusic; pendingMusic = null; playMusic(n); }
    };

    const findSound = (name) => soundList.find((s) => s.name === name || s.id === name) || null;
    const findSong = (name) => (project.songs || []).find((s) => s.name === name || s.id === name) || null;

    const loadBuffer = (snd) => {
      if (!buffers[snd.id]) {
        buffers[snd.id] = fetch(snd.dataUrl).then((r) => r.arrayBuffer()).then((b) => getCtx().decodeAudioData(b)).catch(() => {
          warnOnce('Son « ' + snd.name + ' » : fichier audio illisible');
          return null;
        });
      }
      return buffers[snd.id];
    };
    const playBuffer = (snd, volume, pitch, loop, onSource) => {
      loadBuffer(snd).then((buf) => {
        if (!buf || destroyed || !ctx) return;
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf;
        src.loop = !!loop;
        src.playbackRate.value = num(pitch) && pitch > 0 ? pitch : 1;
        g.gain.value = Math.max(0, volume);
        src.connect(g);
        g.connect(master);
        src.start();
        if (onSource) onSource(src);
      });
    };

    const resolve = (name) => {
      const sng = findSong(name);
      if (sng) return { song: sng };
      const snd = findSound(name);
      if (snd) return { snd, preset: snd.kind === 'file' ? null : (snd.sfx && snd.sfx.preset) || 'blip' };
      if (CHIPTUNE_PRESETS[name]) return { snd: null, chiptune: CHIPTUNE_PRESETS[name] };
      if (PRESETS.includes(name)) return { snd: null, preset: name };
      return null;
    };

    function playSound(name, volume = 1, pitch = 1) {
      try {
        const r = resolve(String(name));
        if (!r) { warnOnce('game.playSound : son inconnu « ' + name + ' » (presets : ' + PRESETS.join(', ') + ')'); return; }
        const vol = num(volume) !== null ? volume : 1;
        const pit = num(pitch) !== null ? pitch : 1;
        const c = getCtx();
        if (!c) return;
        if (c.state !== 'running') { try { c.resume(); } catch (e) { /* ignore */ } return; }
        if (!chip && chipFactory && master) {
          try { chip = chipFactory(c, master); } catch (e) {}
        }
        if (r.snd && r.snd.kind === 'file') {
          playBuffer(r.snd, vol * (num(r.snd.volume) !== null ? r.snd.volume : 1), pit);
        } else if (chip) {
          if (r.snd) {
            if (r.snd.sfx && r.snd.sfx.params) {
              chip.playSfx({ params: r.snd.sfx.params, volume: (num(r.snd.sfx.volume) !== null ? r.snd.sfx.volume : 0.5) * vol, pitch: (r.snd.sfx.pitch || 1) * pit });
            } else {
              chip.playSfx(r.preset, r.snd.sfx.seed, (num(r.snd.sfx.volume) !== null ? r.snd.sfx.volume : 0.5) * vol, (r.snd.sfx.pitch || 1) * pit);
            }
          } else {
            chip.playSfx(r.preset, 0, 0.5 * vol, pit);
          }
        }
      } catch (e) { log('game.playSound : ' + errMsg(e), 'error'); }
    }

    function stopMusic() {
      pendingMusic = null;
      if (music) { try { music.stop(); } catch (e) { /* ignore */ } music = null; }
    }

    function playMusic(name) {
      try {
        name = String(name);
        if (music && music.name === name) return;
        const r = resolve(name);
        if (!r) { warnOnce('game.playMusic : son inconnu « ' + name + ' »'); return; }
        stopMusic();
        const c = getCtx();
        if (!c || c.state !== 'running') { pendingMusic = name; if (c) { try { c.resume(); } catch (e) { /* ignore */ } } return; }
        if (!chip && chipFactory && master) {
          try { chip = chipFactory(c, master); } catch (e) {}
        }
        const m = { name, src: null, timer: null, activeTrack: null, stopped: false };
        m.stop = () => {
          m.stopped = true;
          if (m.timer) clearInterval(m.timer);
          if (m.activeTrack) { try { m.activeTrack.stop(); } catch (e) {} }
          if (m.src) { try { m.src.stop(); } catch (e) { /* ignore */ } }
        };
        music = m;
        if (r.song && chip) {
          m.activeTrack = chip.playSong(r.song, { loop: true, volume: 0.5 });
        } else if (r.chiptune && chip) {
          const loop = () => {
            if (m.stopped) return;
            m.activeTrack = chip.playChiptuneTrack(r.chiptune, 0.5, () => {
              if (!m.stopped) loop();
            });
          };
          loop();
        } else if (r.snd && r.snd.kind === 'file') {
          playBuffer(r.snd, 0.6 * (num(r.snd.volume) !== null ? r.snd.volume : 1), 1, true, (src) => { if (m.stopped) src.stop(); else m.src = src; });
        } else if (chip) {
          const sx = r.snd ? r.snd.sfx : { seed: 0, volume: 0.5, pitch: 1 };
          const once = () => chip.playSfx(r.preset, sx.seed, (num(sx.volume) !== null ? sx.volume : 0.5) * 0.6, sx.pitch || 1);
          const dur = Math.max(0.2, once() || 0.5);
          m.timer = setInterval(once, dur * 1000);
        }
      } catch (e) { log('game.playMusic : ' + errMsg(e), 'error'); }
    }

    function playSong(songOrName, opts = {}) {
      const song = typeof songOrName === 'string' ? findSong(songOrName) : songOrName;
      if (!song) { warnOnce('game.playSong : morceau inconnu « ' + songOrName + ' »'); return null; }
      stopMusic();
      const c = getCtx();
      if (!c) return null;
      if (c.state !== 'running') { try { c.resume(); } catch (e) {} }
      if (!chip && chipFactory && master) {
        try { chip = chipFactory(c, master); } catch (e) {}
      }
      if (!chip) return null;
      const combinedOpts = Object.assign({}, opts);
      const userBeat = opts.onBeat;
      combinedOpts.onBeat = (b) => {
        if (userBeat) userBeat(b);
        if (activeScene && activeScene.dispatchBeat) activeScene.dispatchBeat(b);
      };
      const ctrl = chip.playSong(song, combinedOpts);
      music = { name: song.name, stop: (stopOpts) => ctrl.stop(stopOpts), ctrl };
      return ctrl;
    }

    function stopSong(opts) {
      if (music && music.stop) {
        music.stop(opts);
        music = null;
      } else {
        stopMusic();
      }
    }

    function setSongVolume(v) {
      if (music && music.ctrl && music.ctrl.setVolume) {
        music.ctrl.setVolume(v);
      }
    }

    function playTune(notesInput, bpm = 140, loop = true, volume = 0.5) {
      stopMusic();
      const c = getCtx();
      if (!c) return;
      if (c.state !== 'running') { try { c.resume(); } catch (e) {} }
      if (!chip && chipFactory && master) {
        try { chip = chipFactory(c, master); } catch (e) {}
      }
      const notes = Array.isArray(notesInput) ? notesInput : String(notesInput).split(/[\s,]+/);
      const parsedNotes = [];
      const parsedDurs = [];
      for (const n of notes) {
        if (!n) continue;
        const parts = n.split(':');
        parsedNotes.push(parts[0]);
        parsedDurs.push(parts[1] ? Number(parts[1]) : 1);
      }
      const track = { bpm: Number(bpm) || 140, notes: parsedNotes, durations: parsedDurs };
      const m = { name: 'custom_tune', activeTrack: null, stopped: false };
      m.stop = () => {
        m.stopped = true;
        if (m.activeTrack) { try { m.activeTrack.stop(); } catch (e) {} }
      };
      music = m;
      if (chip) {
        const startLoop = () => {
          if (m.stopped) return;
          m.activeTrack = chip.playChiptuneTrack(track, volume, () => {
            if (loop && !m.stopped) startLoop();
          });
        };
        startLoop();
      }
    }

    function setMasterVolume(v) {
      const vol = Math.max(0, Math.min(1, num(v) !== null ? v : 1));
      if (master && ctx) master.gain.setValueAtTime(vol * 0.6, ctx.currentTime);
    }

    const dispose = () => {
      stopMusic();
      if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } ctx = null; }
    };
    return { unlock, playSound, playMusic, stopMusic, playSong, stopSong, setSongVolume, playTune, setMasterVolume, dispose };
  })();

  // Débloque l'audio au premier geste
  const gestureEvents = ['pointerdown', 'keydown', 'touchstart'];
  const onGesture = () => audio.unlock();
  if (typeof window !== 'undefined') for (const ev of gestureEvents) window.addEventListener(ev, onGesture, true);

  // ---------- Manette (Gamepad API) : croix / stick -> flèches, A -> SPACE + Z, B -> X, Start -> ENTER ----------
  const pad = {};
  function pollGamepad() {
    for (const k of KEYS) pad[k] = false;
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -0.5 || b(14)) pad.LEFT = true;
      if (ax > 0.5 || b(15)) pad.RIGHT = true;
      if (ay < -0.5 || b(12)) pad.UP = true;
      if (ay > 0.5 || b(13)) pad.DOWN = true;
      if (b(0)) { pad.SPACE = true; pad.Z = true; }
      if (b(1)) pad.X = true;
      if (b(9)) pad.ENTER = true;
    }
  }

  // ---------- Contrôles tactiles : croix à gauche, boutons A (SPACE) et B (X) à droite, multi-touch ----------
  const touchState = {};
  for (const k of KEYS) touchState[k] = false;
  let touchEl = null;
  function setupTouch() {
    if (settings.touchControls === false || typeof document === 'undefined') return;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
    if (!isTouch) return;
    try { if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'; } catch (e) { /* ignoré */ }
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;z-index:5;';
    const base = 'position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;border-radius:50%;'
      + 'background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.35);color:rgba(255,255,255,.75);'
      + 'font:bold 22px sans-serif;display:flex;align-items:center;justify-content:center;';
    const noMenu = (e) => e.preventDefault();
    root.addEventListener('contextmenu', noMenu);

    // Croix directionnelle : une seule zone, la direction suit le doigt (diagonales possibles)
    const dpad = document.createElement('div');
    dpad.style.cssText = base + 'left:14px;bottom:14px;width:min(34vmin,150px);height:min(34vmin,150px);';
    dpad.textContent = '+';
    let dpadId = null;
    const dirs = ['LEFT', 'RIGHT', 'UP', 'DOWN'];
    const setDirs = (e) => {
      const r = dpad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      touchState.LEFT = dx < -0.3;
      touchState.RIGHT = dx > 0.3;
      touchState.UP = dy < -0.3;
      touchState.DOWN = dy > 0.3;
    };
    const clearDirs = () => { dpadId = null; for (const d of dirs) touchState[d] = false; };
    dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); dpadId = e.pointerId; try { dpad.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ } setDirs(e); });
    dpad.addEventListener('pointermove', (e) => { if (e.pointerId === dpadId) setDirs(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) dpad.addEventListener(ev, (e) => { if (e.pointerId === dpadId) clearDirs(); });
    root.appendChild(dpad);

    const button = (label, key, css) => {
      const el = document.createElement('div');
      el.style.cssText = base + css;
      el.textContent = label;
      const ids = new Set();
      const sync = () => { touchState[key] = ids.size > 0; };
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); ids.add(e.pointerId); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignoré */ } sync(); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, (e) => { ids.delete(e.pointerId); sync(); });
      root.appendChild(el);
    };
    button('A', 'SPACE', 'right:14px;bottom:60px;width:min(20vmin,84px);height:min(20vmin,84px);');
    button('B', 'X', 'right:min(24vmin,104px);bottom:14px;width:min(18vmin,76px);height:min(18vmin,76px);');
    parent.appendChild(root);
    touchEl = root;
  }
  setupTouch();

  // ---------- Chargement des images (asynchrone) ----------
  const loadImage = (src) => new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  // Une texture par sprite : frames concaténées horizontalement
  async function buildStrip(sprite) {
    const n = Math.max(1, sprite.frames.length);
    const c = document.createElement('canvas');
    c.width = sprite.width * n;
    c.height = sprite.height;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const imgs = await Promise.all(sprite.frames.map(loadImage));
    imgs.forEach((img, i) => {
      if (img) ctx.drawImage(img, i * sprite.width, 0, sprite.width, sprite.height);
      else log('Sprite « ' + sprite.name + ' » : image illisible (frame ' + i + ')', 'warn');
    });
    return { sprite, canvas: c, count: n };
  }

  // ---------- Scène de démarrage : prépare textures et animations ----------
  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    create() {
      Promise.all(project.sprites.map(buildStrip)).then((strips) => {
        if (destroyed) return;
        for (const { sprite, canvas, count } of strips) {
          const tex = this.textures.addCanvas(sprite.id, canvas);
          for (let i = 0; i < count; i++) tex.add(i, 0, i * sprite.width, 0, sprite.width, sprite.height);
          for (const anim of sprite.animations || []) {
            const frames = (anim.frames || []).filter((f) => f >= 0 && f < count).map((f) => ({ key: sprite.id, frame: f }));
            if (!frames.length) continue;
            this.anims.create({ key: sprite.id + ':' + anim.name, frames, frameRate: anim.fps || 6, repeat: anim.loop === false ? 0 : -1 });
          }
        }
        // Objets sans sprite : carré de couleur 16×16
        const palette = project.palette && project.palette.length ? project.palette : ['#ef7d57'];
        project.objects.forEach((obj, i) => {
          if (obj.spriteId && spritesById[obj.spriteId]) return;
          const c = document.createElement('canvas');
          c.width = c.height = 16;
          const ctx = c.getContext('2d');
          ctx.fillStyle = palette[(i + 2) % palette.length];
          ctx.fillRect(0, 0, 16, 16);
          ctx.strokeStyle = '#1a1c2c';
          ctx.strokeRect(0.5, 0.5, 15, 15);
          const tex = this.textures.addCanvas(boxKey(obj), c);
          tex.add(0, 0, 0, 0, 16, 16);
        });
        if (!startMap) { log('Le projet ne contient aucune carte.', 'error'); return; }
        this.scene.start('Map', { mapId: startMap.id });
      });
    }
  }

  // ---------- Scène de carte ----------
  class MapScene extends Phaser.Scene {
    constructor() { super('Map'); }

    init(data) {
      this.map = findMap(data && data.mapId) || startMap;
      this.leaving = false;
      this.pendingMap = null;
    }

    create() {
      activeScene = this;
      const map = this.map;
      this.insts = [];
      this.nextId = 1;
      this.groups = {};
      this.pairs = {};
      this.pairHandlers = {};
      this.contacts = new Map();
      this.ovNow = new Map(); // chevauchements vus depuis la dernière image (overlapStart / overlapEnd)
      this.ovPrev = new Map();
      this.stepped = false;
      this.physics.world.on('worldstep', () => { this.stepped = true; });
      this.toDestroy = [];
      this.hud = {};
      this.selfMap = new WeakMap();
      this.tileLayers = [];
      this.tileHits = [];
      this.parts = [];
      this.paused = false;
      this.physics.world.resume();
      this.time.paused = false;
      this.tweens.resumeAll();

      const tileSize = map.tileSize || settings.tileSize || 16;
      this.tileSize = tileSize;
      const W = map.width * tileSize;
      const H = map.height * tileSize;
      this.mapPx = { w: W, h: H };
      this.physics.world.setBounds(0, 0, W, H);
      const cam = this.cameras.main;
      cam.setBounds(0, 0, W, H);
      cam.setBackgroundColor(map.background || settings.background || '#000000');

      // Calques de tuiles (depth 'above' : dessinés devant les entités)
      const tsSprite = spritesById[map.tilesetSpriteId];
      if (!tsSprite && map.layers.length) warnOnce('Carte « ' + map.name + ' » : aucun tileset, les calques ne sont pas affichés.');
      if (tsSprite) {
        map.layers.forEach((layer, li) => {
          const data = new Array(map.width * map.height);
          const rows = [];
          for (let y = 0; y < map.height; y++) {
            const row = [];
            for (let x = 0; x < map.width; x++) {
              let v = layer.data[y * map.width + x];
              if (v === undefined || v === null) v = -1;
              row.push(v);
              data[y * map.width + x] = v;
            }
            rows.push(row);
          }
          const tm = this.make.tilemap({ data: rows, tileWidth: tileSize, tileHeight: tileSize });
          const ts = tm.addTilesetImage('tiles', tsSprite.id, tsSprite.width, tsSprite.height, 0, 0);
          const tl = tm.createLayer(0, ts, 0, 0);
          if (!tl) return;
          tl.setDepth(layer.depth === 'above' ? DEPTH_ABOVE + li : li);
          tl.setVisible(layer.visible !== false);

          const sf = layer.scrollFactor !== undefined ? layer.scrollFactor : layer.parallax;
          if (sf !== undefined && sf !== null) {
            const sfx = typeof sf === 'object' ? (sf.x ?? 1) : Number(sf);
            const sfy = typeof sf === 'object' ? (sf.y ?? 1) : Number(sf);
            if (!isNaN(sfx) && !isNaN(sfy)) tl.setScrollFactor(sfx, sfy);
          }

          const collides = !!layer.collides;
          const oneWay = !!layer.oneWay;
          if (collides) {
            tl.setCollisionByExclusion([-1]);
            if (oneWay) {
              tl.forEachTile((t) => {
                if (t.index >= 0) {
                  t.collideUp = true;
                  t.collideDown = false;
                  t.collideLeft = false;
                  t.collideRight = false;
                }
              });
            }
          }
          this.tileLayers.push({ name: layer.name, tl, data, collides, oneWay, count: tsSprite.frames.length });
        });
      }
      this.solids = this.tileLayers.filter((l) => l.collides);

      // Un groupe par nom d'objet (les instances apparues plus tard y entrent aussi)
      for (const obj of project.objects) {
        if (this.groups[obj.name]) continue;
        const g = this.groups[obj.name] = this.add.group();
        const ph = obj.physics || {};
        if (ph.enabled !== false && ph.collideMap !== false) {
          for (const L of this.solids) this.physics.add.collider(g, L.tl, (a, b) => this.onTileContact(L, a, b), (a, b) => this.tileCollides(a, b));
        }
      }

      // Clavier (physique + virtuel : manette et tactile) et souris
      this.keys = {};
      this.tapped = {};
      this.wasDown = {};
      this.justDown = {};
      this.vPrev = {};
      this.keyCbs = {};
      for (const k of KEYS) {
        const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[k]);
        this.keys[k] = key;
        this.tapped[k] = false;
        this.wasDown[k] = false;
        this.justDown[k] = false;
        this.vPrev[k] = false;
        this.keyCbs[k] = [];
        key.on('down', () => this.pressKey(k));
      }
      this.mouseTapped = { LEFT: false, RIGHT: false };
      this.mouseJust = { LEFT: false, RIGHT: false };
      this.input.on('pointerdown', (p) => { this.mouseTapped[p.button === 2 ? 'RIGHT' : 'LEFT'] = true; });

      const keyName = (n) => {
        const k = String(n).toUpperCase();
        if (!this.keys[k]) { warnOnce('Touche inconnue : « ' + n + ' » (touches : ' + KEYS.join(' ') + ')'); return null; }
        return k;
      };
      this.keyName = keyName;
      const mouseBtn = (n) => (String(n || 'LEFT').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT');
      const ptr = () => this.input.activePointer;
      const wp = new Phaser.Math.Vector2();
      this.inputApi = {
        isDown: (n) => { const k = keyName(n); return k ? !!(this.keys[k].isDown || pad[k] || touchState[k]) : false; },
        justPressed: (n) => { const k = keyName(n); return k ? this.justDown[k] : false; },
        isMouseDown: (n) => (mouseBtn(n) === 'RIGHT' ? ptr().rightButtonDown() : ptr().leftButtonDown()),
        mouseJustPressed: (n) => this.mouseJust[mouseBtn(n)],
      };
      Object.defineProperties(this.inputApi, {
        mouseX: { enumerable: true, get: () => Math.round(cam.getWorldPoint(ptr().x, ptr().y, wp).x) },
        mouseY: { enumerable: true, get: () => Math.round(cam.getWorldPoint(ptr().x, ptr().y, wp).y) },
        mouseScreenX: { enumerable: true, get: () => Math.round(ptr().x) },
        mouseScreenY: { enumerable: true, get: () => Math.round(ptr().y) },
      });

      this.gameApi = this.makeGameApi();

      this.events.once('shutdown', () => {
        this.leaving = true;
        for (const id of Object.keys(this.hud)) if (this.hud[id].key) this.textures.remove(this.hud[id].key);
      });

      // Instances d'abord, scripts ensuite (un script peut ainsi retrouver toutes les instances)
      for (const e of map.entities || []) {
        const obj = objectsById[e.objectId];
        if (!obj) { warnOnce('Carte « ' + map.name + ' » : une entité référence un objet supprimé.'); continue; }
        const inst = this.spawnInstance(obj, e.x, e.y, e.props);
        if (inst && inst.self) {
          if (e.angle != null) inst.self.angle = e.angle;
          if (e.scale != null) inst.self.scale = e.scale;
        }
      }
      this.global = this.newHolder('Script global');
      const gs = project.globalScript;
      if (gs && gs.code && gs.code.trim()) this.runScript(this.global, gs.code, null);
      for (const e of this.global.handlers.create.slice()) this.call(this.global, e, 'create');
      for (const inst of this.insts.slice()) this.startScript(inst);
    }

    // Touche pressée (clavier, manette ou tactile) : mémorise l'appui et prévient les on('keydown')
    pressKey(k) {
      this.tapped[k] = true;
      if (this.leaving) return;
      for (const cb of this.keyCbs[k].slice()) cb();
    }

    // ----- Instances -----
    newHandlers() {
      return { create: [], update: [], destroy: [], hitTile: [], message: [], beat: [] };
    }

    dispatchBeat(beatNumber) {
      for (const h of [this.global, ...this.insts]) {
        if (!h || h.dead) continue;
        for (const e of (h.handlers.beat || []).slice()) {
          if (h.dead || this.leaving) break;
          this.call(h, e, 'beat', beatNumber);
        }
      }
    }

    newHolder(name) {
      return {
        id: 0, name, obj: { name }, self: null, dead: false, offs: [], vars: {},
        handlers: this.newHandlers(),
      };
    }

    spawnInstance(obj, x, y, props) {
      const spr = obj.spriteId && spritesById[obj.spriteId];
      const sprite = this.physics.add.sprite(0, 0, spr ? spr.id : boxKey(obj), 0);
      sprite.setPosition(x + sprite.width / 2, y + sprite.height / 2);
      const ph = obj.physics || {};
      const on = ph.enabled !== false;
      const body = sprite.body;
      const hb = obj.hitbox;
      if (hb) { body.setSize(hb.w, hb.h, false); body.setOffset(hb.x, hb.y); }
      body.setAllowGravity(on && ph.gravity !== false);
      body.setBounce(ph.bounce || 0);
      body.setImmovable(!!ph.immovable);
      body.setCollideWorldBounds(on && ph.collideWorld !== false);

      const inst = {
        id: this.nextId++, name: obj.name, obj, sprite, dead: false, offs: [], vars: {}, snap: {}, hb,
        props: cloneProps(props), tint: null, tileSeen: {}, collideMap: true, collideObjects: true,
        handlers: this.newHandlers(),
      };
      sprite.setDepth(DEPTH_ENTITY + inst.id * 0.001); // ordre de la carte, stable
      sprite.pfInst = inst;
      inst.self = this.makeSelf(inst);
      this.selfMap.set(inst.self, inst);
      this.groups[obj.name].add(sprite);
      this.insts.push(inst);
      if (obj.defaultAnim) inst.self.play(obj.defaultAnim);
      return inst;
    }

    makeSelf(inst) {
      const sp = inst.sprite;
      const scene = this;
      const live = () => !inst.dead && !!sp.body; // sp.body disparaît si la carte est rechargée
      const self = { id: inst.id, name: inst.obj.name, vars: inst.vars, props: inst.props };
      const prop = (name, get, set) => Object.defineProperty(self, name, {
        enumerable: true,
        get: () => (live() ? get() : inst.snap[name]),
        set: (v) => { if (live() && set) set(v); },
      });
      prop('x', () => sp.x - sp.width / 2, (v) => { if (num(v) !== null) sp.x = v + sp.width / 2; });
      prop('y', () => sp.y - sp.height / 2, (v) => { if (num(v) !== null) sp.y = v + sp.height / 2; });
      prop('vx', () => sp.body.velocity.x, (v) => { if (num(v) !== null) sp.body.setVelocityX(v); });
      prop('vy', () => sp.body.velocity.y, (v) => { if (num(v) !== null) sp.body.setVelocityY(v); });
      prop('flipX', () => sp.flipX, (v) => {
        sp.flipX = !!v;
        if (inst.hb) sp.body.setOffset(sp.flipX ? sp.width - inst.hb.x - inst.hb.w : inst.hb.x, inst.hb.y);
      });
      prop('flipY', () => sp.flipY, (v) => { sp.flipY = !!v; });
      prop('collideMap', () => inst.collideMap, (v) => { inst.collideMap = !!v; });
      prop('collideObjects', () => inst.collideObjects, (v) => { inst.collideObjects = !!v; });
      prop('visible', () => sp.visible, (v) => { sp.visible = !!v; });
      prop('alpha', () => sp.alpha, (v) => { if (num(v) !== null) sp.alpha = v; });
      prop('angle', () => sp.angle, (v) => { if (num(v) !== null) sp.angle = v; });
      prop('onGround', () => !!(sp.body.blocked.down || sp.body.touching.down));
      prop('depth', () => sp.depth, (v) => { if (num(v) !== null) sp.setDepth(v); });
      prop('scale', () => sp.scaleX, (v) => { if (num(v) !== null) sp.setScale(v); });
      prop('centerX', () => sp.x);
      prop('centerY', () => sp.y);
      Object.defineProperty(self, 'tint', {
        enumerable: true,
        get: () => inst.tint,
        set: (v) => {
          if (!live()) return;
          if (v === null || v === undefined || v === '') { inst.tint = null; sp.clearTint(); return; }
          inst.tint = cssColor(v);
          sp.setTint(parseColor(v));
        },
      });
      Object.defineProperty(self, 'blocked', {
        enumerable: true,
        get: () => {
          if (!live()) return { left: false, right: false, up: false, down: false };
          const b = sp.body;
          return {
            left: !!(b.blocked.left || b.touching.left), right: !!(b.blocked.right || b.touching.right),
            up: !!(b.blocked.up || b.touching.up), down: !!(b.blocked.down || b.touching.down),
          };
        },
      });
      Object.defineProperty(self, 'width', { enumerable: true, get: () => sp.width });
      Object.defineProperty(self, 'height', { enumerable: true, get: () => sp.height });

      const center = (o) => ({ x: o.x + (o.width || 0) / 2, y: o.y + (o.height || 0) / 2 });
      self.play = (name) => {
        if (!live()) return;
        const key = inst.obj.spriteId + ':' + name;
        if (!scene.anims.exists(key)) { warnOnce('[' + inst.name + '] animation inconnue : « ' + name + ' »'); return; }
        const cur = sp.anims.currentAnim;
        if (cur && cur.key === key && sp.anims.isPlaying) return;
        sp.play(key);
      };
      self.destroy = () => scene.kill(inst);
      self.jump = (speed) => { if (live() && self.onGround) self.vy = -speed; };
      self.moveTowards = (other, speed) => {
        if (!live() || !other) return;
        const a = center(self), b = center(other);
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < 1) { self.vx = 0; self.vy = 0; return; }
        self.vx = ((b.x - a.x) / d) * speed;
        self.vy = ((b.y - a.y) / d) * speed;
      };
      self.distanceTo = (other) => {
        if (!other) return Infinity;
        const a = center(self), b = center(other);
        return Math.hypot(b.x - a.x, b.y - a.y);
      };
      self.setGravity = (on) => { if (live()) sp.body.setAllowGravity(!!on); };
      self.setCollideMap = (on) => { self.collideMap = on; };
      self.setCollideObjects = (on) => { self.collideObjects = on; };
      // Hitbox de cette instance (relative à la frame, en px)
      self.setHitbox = (x, y, w, h) => {
        if (!live() || [x, y, w, h].some((v) => num(v) === null) || w <= 0 || h <= 0) return;
        inst.hb = { x, y, w, h };
        sp.body.setSize(w, h, false);
        sp.body.setOffset(sp.flipX ? sp.width - x - w : x, y);
      };
      self.setPosition = (x, y) => { self.x = x; self.y = y; };
      self.setVelocity = (vx, vy) => { self.vx = vx; self.vy = vy; };
      // Angle en degrés vers une instance ou un point {x, y} : 0 = droite, sens horaire (y vers le bas)
      self.angleTo = (target) => {
        if (!target || num(target.x) === null || num(target.y) === null) return 0;
        const a = center(self), b = center(target);
        return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      };
      self.setVelocityAngle = (angleDeg, speed) => {
        if (num(angleDeg) === null || num(speed) === null) return;
        const r = (angleDeg * Math.PI) / 180;
        self.vx = Math.cos(r) * speed;
        self.vy = Math.sin(r) * speed;
      };
      // Anime x, y (haut-gauche), alpha, angle, scale vers les valeurs données en `ms` millisecondes
      self.tweenTo = (to, ms) => {
        if (!live() || !to || typeof to !== 'object') return;
        const cfg = {};
        if (num(to.x) !== null) cfg.x = to.x + sp.width / 2;
        if (num(to.y) !== null) cfg.y = to.y + sp.height / 2;
        if (num(to.alpha) !== null) cfg.alpha = to.alpha;
        if (num(to.angle) !== null) cfg.angle = to.angle;
        if (num(to.scale) !== null) cfg.scale = to.scale;
        const tw = scene.tweens.add({ targets: sp, ...cfg, duration: Math.max(1, num(ms) !== null ? ms : 300) });
        inst.offs.push(() => tw.stop());
      };
      return self;
    }

    kill(inst) {
      if (inst.dead) return;
      if (!this.leaving) for (const e of inst.handlers.destroy.slice()) this.call(inst, e, 'destroy');
      if (inst.snap) for (const k of SNAP_PROPS) inst.snap[k] = inst.self[k];
      inst.dead = true;
      for (const off of inst.offs) { try { off(); } catch (e) { /* déjà nettoyé */ } }
      inst.offs.length = 0;
      const i = this.insts.indexOf(inst);
      if (i >= 0) this.insts.splice(i, 1);
      if (inst.sprite.body) inst.sprite.body.enable = false;
      inst.sprite.setVisible(false);
      this.toDestroy.push(inst.sprite); // destruction réelle en fin d'image (on peut être en pleine étape physique)
    }

    // ----- Scripts -----
    startScript(inst) {
      const code = inst.obj.script && inst.obj.script.code;
      if (code && code.trim()) this.runScript(inst, code, inst.self);
      for (const e of inst.handlers.create.slice()) this.call(inst, e, 'create');
    }

    runScript(inst, code, selfObj) {
      const on = (evt, a, b) => {
        const entry = (fn, label) => ({ fn, off: false, label });
        const needFn = (fn) => {
          if (typeof fn === 'function') return true;
          this.reportError(inst, 'on(\'' + evt + '\')', 'le dernier argument doit être une fonction');
          return false;
        };
        switch (evt) {
          case 'create': case 'update': case 'destroy':
            if (needFn(a)) inst.handlers[evt].push(entry(a));
            break;
          case 'beat':
            if (needFn(a)) inst.handlers.beat.push(entry(a));
            break;
          case 'collide': case 'overlap': case 'overlapStart': case 'overlapEnd':
            if (!selfObj) { warnOnce('Le script global ne peut pas utiliser on(\'' + evt + '\')'); break; }
            if (!needFn(b)) break;
            if (!objectsByName[a]) { warnOnce('[' + inst.name + '] on(\'' + evt + '\') : objet inconnu « ' + a + ' »'); break; }
            this.registerPair(evt, inst, a, entry(b));
            break;
          case 'hitTile':
            if (!selfObj) { warnOnce('Le script global ne peut pas utiliser on(\'hitTile\')'); break; }
            if (needFn(a)) inst.handlers.hitTile.push(entry(a));
            break;
          case 'click': {
            if (!selfObj) { warnOnce('Le script global ne peut pas utiliser on(\'click\')'); break; }
            if (!needFn(a)) break;
            const e = entry(a);
            const sp = inst.sprite;
            if (!sp.input) sp.setInteractive();
            const cb = () => { if (!this.leaving && !inst.dead) this.call(inst, e, 'click'); };
            sp.on('pointerdown', cb);
            inst.offs.push(() => sp.off('pointerdown', cb));
            break;
          }
          case 'mousedown': {
            let btn = a, fn = b;
            if (typeof a === 'function') { fn = a; btn = 'LEFT'; }
            if (!needFn(fn)) break;
            btn = String(btn || 'LEFT').toUpperCase();
            if (btn !== 'LEFT' && btn !== 'RIGHT') { warnOnce('on(\'mousedown\') : bouton inconnu « ' + a + ' » (LEFT ou RIGHT)'); break; }
            const e = entry(fn);
            const code = btn === 'RIGHT' ? 2 : 0;
            const cb = (p) => { if (!this.leaving && !inst.dead && p.button === code) this.call(inst, e, 'mousedown ' + btn); };
            this.input.on('pointerdown', cb);
            inst.offs.push(() => this.input.off('pointerdown', cb));
            break;
          }
          case 'message': {
            if (!needFn(b)) break;
            inst.handlers.message.push({ ...entry(b), name: String(a) });
            break;
          }
          case 'keydown': {
            if (!needFn(b)) break;
            const k = this.keyName(a);
            if (!k) break;
            const e = entry(b);
            const cb = () => { if (!this.leaving && !inst.dead) this.call(inst, e, 'keydown ' + k); };
            this.keyCbs[k].push(cb);
            inst.offs.push(() => { const i = this.keyCbs[k].indexOf(cb); if (i >= 0) this.keyCbs[k].splice(i, 1); });
            break;
          }
          case 'timer': {
            if (!needFn(b)) break;
            const e = entry(b);
            const ev = this.time.addEvent({ delay: Math.max(1, Number(a) || 1), loop: true, callback: () => { if (!this.leaving) this.call(inst, e, 'timer'); } });
            inst.offs.push(() => ev.remove(false));
            break;
          }
          default:
            warnOnce('[' + inst.name + '] événement inconnu : « ' + evt + ' »');
        }
      };
      try {
        const fn = new Function('self', 'game', 'input', 'on', code);
        fn(selfObj, this.gameApi, this.inputApi, on);
      } catch (e) {
        this.reportError(inst, 'script', errMsg(e));
      }
    }

    // Appelle un handler ; une erreur le désactive pour ne pas spammer la console
    call(inst, entry, label, ...args) {
      if (entry.off || this.leaving) return;
      try {
        entry.fn(...args);
      } catch (e) {
        entry.off = true;
        this.reportError(inst, label, errMsg(e) + ' (ce handler est désactivé)');
      }
    }

    reportError(inst, where, msg) {
      log('[' + inst.name + '] erreur dans ' + where + ' : ' + msg, 'error');
    }

    // ----- Collisions / chevauchements -----
    registerPair(kind, inst, otherName, entry) {
      const key = kind + '|' + inst.obj.name + '|' + otherName;
      (this.pairHandlers[key] = this.pairHandlers[key] || []).push({ inst, entry });
      const [n1, n2] = inst.obj.name < otherName ? [inst.obj.name, otherName] : [otherName, inst.obj.name];
      const pkind = kind === 'collide' ? 'collide' : 'overlap'; // overlapStart / overlapEnd s'appuient sur le chevauchement
      const pk = pkind + '|' + n1 + '|' + n2;
      if (this.pairs[pk]) return;
      const cb = (s1, s2) => this.onContact(pkind, s1, s2);
      // Un chevauchement ne doit pas compter comme un blocage : Arcade renseigne body.touching même pour overlap,
      // ce qui fausserait self.onGround / self.blocked. On garde l'état avant et on le restaure dans onContact.
      const keep = (s1, s2) => { s1.pfTouch = { ...s1.body.touching }; s2.pfTouch = { ...s2.body.touching }; return true; };
      const objs = (s1, s2) => !(s1.pfInst && s1.pfInst.collideObjects === false) && !(s2.pfInst && s2.pfInst.collideObjects === false);
      this.pairs[pk] = pkind === 'collide'
        ? this.physics.add.collider(this.groups[n1], this.groups[n2], cb, objs)
        : this.physics.add.overlap(this.groups[n1], this.groups[n2], cb, keep);
    }

    onContact(kind, s1, s2) {
      if (kind === 'overlap') for (const s of [s1, s2]) if (s.pfTouch && s.body) Object.assign(s.body.touching, s.pfTouch);
      if (this.leaving) return;
      const a = s1.pfInst, b = s2.pfInst;
      if (!a || !b || a.dead || b.dead) return;
      if (kind === 'overlap') this.ovNow.set(a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id, [a, b]);
      if (kind === 'collide') { // une seule fois au début du contact
        const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        const frame = this.game.loop.frame;
        const last = this.contacts.get(k);
        this.contacts.set(k, frame);
        if (last !== undefined && frame - last <= 3) return;
      }
      this.fire(kind, a, b);
      this.fire(kind, b, a);
    }

    fire(kind, a, b) {
      const list = this.pairHandlers[kind + '|' + a.obj.name + '|' + b.obj.name];
      if (!list) return;
      for (const h of list.slice()) {
        if (a.dead || b.dead) return;
        if (h.inst === a) this.call(a, h.entry, kind + ' ' + b.obj.name, b.self);
      }
    }

    // Une instance dont setCollideMap(false) a été appelé traverse la carte
    tileCollides(a, b) {
      const sprite = a && a.pfInst ? a : b;
      return !(sprite && sprite.pfInst && sprite.pfInst.collideMap === false);
    }

    // overlapStart / overlapEnd : compare les chevauchements vus depuis la dernière image avec ceux de l'image d'avant
    flushOverlaps() {
      if (!this.stepped) return; // aucun pas de physique depuis la dernière image : rien n'a changé
      this.stepped = false;
      const now = this.ovNow, prev = this.ovPrev;
      this.ovNow = new Map();
      this.ovPrev = now;
      for (const [k, [a, b]] of now) if (!prev.has(k)) { this.fire('overlapStart', a, b); this.fire('overlapStart', b, a); }
      for (const [k, [a, b]] of prev) if (!now.has(k)) { this.fire('overlapEnd', a, b); this.fire('overlapEnd', b, a); }
    }

    // Contact corps / tuile solide : mis en file, traité au début de update() (voir flushTileHits)
    onTileContact(L, a, b) {
      const sprite = a && a.pfInst ? a : b;
      const tile = sprite === a ? b : a;
      const inst = sprite && sprite.pfInst;
      if (!inst || inst.dead || !tile || !inst.handlers.hitTile.length) return;
      const half = this.tileSize / 2;
      const body = sprite.body;
      const nx = (tile.pixelX + half - body.center.x) / (half + body.width / 2);
      const ny = (tile.pixelY + half - body.center.y) / (half + body.height / 2);
      const vertical = Math.abs(ny) >= Math.abs(nx);
      const side = vertical ? (ny > 0 ? 'down' : 'up') : (nx > 0 ? 'right' : 'left');
      this.tileHits.push({
        inst, side, off: Math.abs(vertical ? nx : ny),
        tile: { tx: tile.x, ty: tile.y, x: tile.x * this.tileSize, y: tile.y * this.tileSize, index: tile.index, side, layer: L.name },
      });
    }

    // Une seule tuile par (instance, côté) : la plus centrée ; déclenché seulement au début du contact
    flushTileHits() {
      if (!this.tileHits.length) return;
      const best = new Map();
      for (const h of this.tileHits) {
        const k = h.inst.id + '|' + h.side;
        const cur = best.get(k);
        if (!cur || h.off < cur.off) best.set(k, h);
      }
      this.tileHits.length = 0;
      const now = this.time.now;
      for (const h of best.values()) {
        const inst = h.inst;
        const last = inst.tileSeen[h.side];
        inst.tileSeen[h.side] = now;
        if (last !== undefined && now - last < 120) continue;
        for (const e of inst.handlers.hitTile.slice()) {
          if (inst.dead || this.leaving) break;
          this.call(inst, e, 'hitTile', { ...h.tile });
        }
      }
    }

    // ----- Tuiles -----
    layerRef(name, who) {
      if (name === undefined || name === null || name === '') return this.solids[0] || this.tileLayers[0] || null;
      const L = this.tileLayers.find((l) => l.name === name);
      if (!L) warnOnce(who + ' : calque inconnu « ' + name + ' »');
      return L || null;
    }

    isSolidCell(tx, ty) {
      const map = this.map;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
      const i = ty * map.width + tx;
      for (const L of this.solids) if (L.data[i] >= 0) return true;
      return false;
    }

    setTileIn(L, tx, ty, index) {
      const map = this.map;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
      index = Math.floor(index);
      if (!(index >= 0)) index = -1;
      if (index >= L.count) { warnOnce('game.setTile : la tuile ' + index + ' n\'existe pas dans le tileset'); return; }
      L.data[ty * map.width + tx] = index;
      if (index < 0) {
        L.tl.removeTileAt(tx, ty, false, true);
      } else {
        const t = L.tl.putTileAt(index, tx, ty);
        if (t && L.collides) {
          if (L.oneWay) {
            t.collideUp = true;
            t.collideDown = false;
            t.collideLeft = false;
            t.collideRight = false;
          } else {
            t.setCollision(true, true, true, true, true);
          }
        }
      }
    }

    // Calque solide (le plus haut) qui a une tuile dans cette cellule
    solidLayerAt(tx, ty) {
      const i = ty * this.map.width + tx;
      for (let k = this.solids.length - 1; k >= 0; k--) if (this.solids[k].data[i] >= 0) return this.solids[k];
      return null;
    }

    // Lancer de rayon contre les tuiles solides (DDA) et, avec opts.objects, contre les instances (boîtes de physique).
    // opts : { objects: true | 'Nom' | ['Nom', …], ignore: instance | [instances] }
    raycast(x, y, angleDeg, maxDist, opts) {
      const r = this.raycastTiles(x, y, angleDeg, maxDist);
      r.layer = null; r.index = -1; r.instance = null; r.objectName = null;
      if (r.hit) { const L = this.solidLayerAt(r.tx, r.ty); r.layer = L ? L.name : null; r.index = L ? L.data[r.ty * this.map.width + r.tx] : -1; }
      if (opts && opts.objects) this.raycastObjects(r, x, y, angleDeg, opts);
      return r;
    }

    raycastObjects(r, x, y, angleDeg, opts) {
      const names = opts.objects === true ? null : [].concat(opts.objects).map(String);
      const ignore = [].concat(opts.ignore || []).map((o) => this.selfMap.get(o)).filter(Boolean);
      const rad = ((Number(angleDeg) || 0) * Math.PI) / 180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      x = Number(x) || 0; y = Number(y) || 0;
      let best = null;
      for (const inst of this.insts) {
        if (inst.dead || ignore.includes(inst) || !inst.sprite.body || !inst.sprite.body.enable || (names && !names.includes(inst.name))) continue;
        const b = inst.sprite.body;
        const x0 = b.x, y0 = b.y, x1 = b.x + b.width, y1 = b.y + b.height;
        if (x > x0 && x < x1 && y > y0 && y < y1) continue; // le rayon part de l'intérieur : ignorée
        let tmin = -Infinity, tmax = Infinity, axisX = true, ok = true;
        for (const [o, d, lo, hi, isX] of [[x, dx, x0, x1, true], [y, dy, y0, y1, false]]) {
          if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) ok = false; continue; }
          let t1 = (lo - o) / d, t2 = (hi - o) / d;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
          if (t1 > tmin) { tmin = t1; axisX = isX; }
          if (t2 < tmax) tmax = t2;
        }
        if (!ok || tmin > tmax || tmin < 0 || tmin > r.distance) continue;
        if (!best || tmin < best.t) best = { t: tmin, inst, axisX };
      }
      if (!best) return;
      const { t, inst, axisX } = best;
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
      const nX = axisX ? -stepX : 0, nY = axisX ? 0 : -stepY;
      Object.assign(r, {
        hit: true, x: x + dx * t, y: y + dy * t, tx: -1, ty: -1, normalX: nX, normalY: nY, distance: t,
        side: axisX ? (stepX > 0 ? 'left' : 'right') : (stepY > 0 ? 'up' : 'down'),
        layer: null, index: -1, instance: inst.self, objectName: inst.name,
      });
    }

    // Lancer de rayon (DDA) contre les tuiles solides ; angle en degrés (0 = droite, sens horaire)
    raycastTiles(x, y, angleDeg, maxDist) {
      const ts = this.tileSize;
      const map = this.map;
      const md = num(maxDist) !== null && maxDist > 0 ? maxDist : 1000;
      x = Number(x) || 0;
      y = Number(y) || 0;
      const rad = ((Number(angleDeg) || 0) * Math.PI) / 180;
      let dx = Math.cos(rad), dy = Math.sin(rad);
      if (Math.abs(dx) < 1e-12) dx = 0;
      if (Math.abs(dy) < 1e-12) dy = 0;
      const miss = { hit: false, x: x + dx * md, y: y + dy * md, tx: -1, ty: -1, normalX: 0, normalY: 0, side: null, distance: md };
      let tx = Math.floor(x / ts), ty = Math.floor(y / ts);
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return miss;
      if (this.isSolidCell(tx, ty)) return { hit: true, x, y, tx, ty, normalX: 0, normalY: 0, side: null, distance: 0 };
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
      const tDeltaX = dx === 0 ? Infinity : Math.abs(ts / dx);
      const tDeltaY = dy === 0 ? Infinity : Math.abs(ts / dy);
      let tMaxX = dx === 0 ? Infinity : (dx > 0 ? (tx + 1) * ts - x : x - tx * ts) / Math.abs(dx);
      let tMaxY = dy === 0 ? Infinity : (dy > 0 ? (ty + 1) * ts - y : y - ty * ts) / Math.abs(dy);
      for (;;) {
        let t, axisX;
        if (tMaxX < tMaxY) { t = tMaxX; axisX = true; tx += stepX; tMaxX += tDeltaX; }
        else { t = tMaxY; axisX = false; ty += stepY; tMaxY += tDeltaY; }
        if (t > md || t === Infinity) return miss;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return miss;
        if (this.isSolidCell(tx, ty)) {
          const normalX = axisX ? -stepX : 0, normalY = axisX ? 0 : -stepY;
          const side = axisX ? (stepX > 0 ? 'left' : 'right') : (stepY > 0 ? 'up' : 'down'); // face touchée de la tuile
          return { hit: true, x: x + dx * t, y: y + dy * t, tx, ty, normalX, normalY, side, distance: t };
        }
      }
    }

    // ----- Particules (petits carrés pixel, légère gravité) -----
    addParticles(x, y, color, count, speed, lifeMs) {
      const col = parseColor(color);
      const n = Math.max(0, Math.min(200, Math.floor(num(count) !== null ? count : 12)));
      const sp = num(speed) !== null ? speed : 80;
      const life = Math.max(50, num(lifeMs) !== null ? lifeMs : 500);
      for (let i = 0; i < n && this.parts.length < 800; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = sp * (0.35 + Math.random() * 0.65);
        const r = this.add.rectangle(Number(x) || 0, Number(y) || 0, 2, 2, col).setDepth(DEPTH_PARTICLES);
        this.parts.push({ r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.7 + Math.random() * 0.3), max: life });
      }
    }

    updateParticles(dt, delta) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= delta;
        if (p.life <= 0) { p.r.destroy(); this.parts.splice(i, 1); continue; }
        p.vy += 220 * dt;
        p.r.x += p.vx * dt;
        p.r.y += p.vy * dt;
        p.r.alpha = Math.min(1, (p.life / p.max) * 1.5);
      }
    }

    // ----- API game -----
    makeGameApi() {
      const scene = this;
      const cam = this.cameras.main;
      const instOf = (self) => (self && scene.selfMap.get(self)) || null;
      const saveKey = (k) => 'pixelforge:' + ((project.meta && project.meta.id) || 'game') + ':' + k;
      const api = {
        vars: gameVars,
        width: settings.width,
        height: settings.height,
        mapWidth: this.mapPx.w,
        mapHeight: this.mapPx.h,
        tileSize: this.tileSize,
        currentMap: this.map.name,
        spawn(name, x, y, props) {
          const obj = objectsByName[name];
          if (!obj) { log('game.spawn : objet inconnu « ' + name + ' »', 'error'); return null; }
          const inst = scene.spawnInstance(obj, Number(x) || 0, Number(y) || 0, props);
          scene.startScript(inst);
          return inst.self;
        },
        find(name) {
          const i = scene.insts.find((n) => n.obj.name === name && !n.dead);
          return i ? i.self : null;
        },
        findAll(name) {
          return scene.insts.filter((n) => n.obj.name === name && !n.dead).map((n) => n.self);
        },
        countOf(name) {
          return scene.insts.filter((n) => n.obj.name === name && !n.dead).length;
        },
        goToMap(name) {
          const m = findMap(name);
          if (!m) { log('game.goToMap : carte inconnue « ' + name + ' »', 'error'); return; }
          scene.requestMap(m.id);
        },
        restart() { scene.requestMap(scene.map.id); },
        setText(id, text, x, y, options) { scene.setHud(String(id), text, x, y, options); },
        setWorldText(id, text, x, y, options) { scene.setHud(String(id), text, x, y, { ...(options || {}), world: true }); },
        removeText(id) { scene.removeHud(String(id)); },
        camera: {
          follow(self, lerpX = 0.2, lerpY = 0.2) {
            const i = instOf(self);
            if (!i) { cam.stopFollow(); return; }
            cam.centerOn(i.sprite.x, i.sprite.y);
            const lx = num(lerpX) !== null ? lerpX : 0.2;
            const ly = num(lerpY) !== null ? lerpY : 0.2;
            cam.startFollow(i.sprite, true, lx, ly);
          },
          stopFollow() { cam.stopFollow(); },
          panTo(x, y, ms = 500) { cam.pan(x, y, ms, 'Power2'); },
          setDeadzone(w, h) { cam.setDeadzone(w, h); },
          setOffset(x, y) { cam.setFollowOffset(num(x) !== null ? x : 0, num(y) !== null ? y : 0); },
          setBounds(x, y, w, h) { cam.setBounds(x, y, w, h); },
          setLerp(lx, ly) { cam.setLerp(lx, ly ?? lx); },
          shake(ms = 200, intensity = 0.01) { cam.shake(ms, intensity); },
          flash(ms = 200) { cam.flash(ms); },
          setZoom(z) { if (num(z) !== null && z > 0) cam.setZoom(z); },
        },
        random(min, max) {
          if (max === undefined) { max = min; min = 0; }
          return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        log(...args) { log(args.map(fmt).join(' '), 'info'); },

        // Messages entre objets : diffusés à tous les on('message', nom, fn)
        broadcast(name, data) {
          const n = String(name);
          for (const h of [scene.global, ...scene.insts]) {
            if (!h || h.dead) continue;
            for (const e of h.handlers.message.slice()) {
              if (h.dead || scene.leaving) break;
              if (e.name === n) scene.call(h, e, 'message ' + n, data);
            }
          }
        },

        // Tuiles
        toTile(px) { return Math.floor((Number(px) || 0) / scene.tileSize); },
        getTile(tx, ty, layerName) {
          const L = scene.layerRef(layerName, 'game.getTile');
          const m = scene.map;
          tx = Math.floor(tx); ty = Math.floor(ty);
          if (!L || !(tx >= 0 && ty >= 0 && tx < m.width && ty < m.height)) return -1;
          return L.data[ty * m.width + tx];
        },
        setTile(tx, ty, index, layerName) {
          const L = scene.layerRef(layerName, 'game.setTile');
          if (!L) return;
          if (num(tx) === null || num(ty) === null) return;
          scene.setTileIn(L, Math.floor(tx), Math.floor(ty), index);
        },
        isSolidAt(x, y) {
          const ts = scene.tileSize;
          return scene.isSolidCell(Math.floor((Number(x) || 0) / ts), Math.floor((Number(y) || 0) / ts));
        },
        raycast(x, y, angleDeg, maxDist = 1000, opts) { return scene.raycast(x, y, angleDeg, maxDist, opts); },

        // Son & Musique
        playSound(name, volume, pitch) { audio.playSound(name, volume, pitch); },
        playMusic(name) { audio.playMusic(name); },
        stopMusic() { audio.stopMusic(); },
        playSong(name, opts) { return audio.playSong(name, opts); },
        stopSong(opts) { audio.stopSong(opts); },
        setSongVolume(v) { audio.setSongVolume(v); },
        playTune(notes, bpm, loop, volume) { audio.playTune(notes, bpm, loop, volume); },
        stopTune() { audio.stopMusic(); },
        setVolume(v) { audio.setMasterVolume(v); },
        setMasterVolume(v) { audio.setMasterVolume(v); },

        particles(x, y, color = '#ffffff', count = 12, speed = 80, lifeMs = 500) { scene.addParticles(x, y, color, count, speed, lifeMs); },

        // Temps / pause
        wait(ms, fn) {
          if (typeof fn !== 'function') { log('game.wait : le 2e argument doit être une fonction', 'error'); return null; }
          const timer = scene.time.delayedCall(Math.max(0, Number(ms) || 0), () => {
            if (scene.leaving) return;
            try { fn(); } catch (e) { log('game.wait : ' + errMsg(e), 'error'); }
          });
          return { cancel: () => timer.remove(false), timer };
        },
        clearWait(handle) {
          if (handle && typeof handle.cancel === 'function') handle.cancel();
          else if (handle && typeof handle.remove === 'function') handle.remove(false);
        },
        pause() {
          if (scene.paused) return;
          scene.paused = true;
          scene.physics.world.pause();
          scene.time.paused = true;
          scene.tweens.pauseAll();
        },
        resume() {
          if (!scene.paused) return;
          scene.paused = false;
          scene.physics.world.resume();
          scene.time.paused = false;
          scene.tweens.resumeAll();
        },

        // Sauvegarde locale (localStorage, préfixée par l'id du jeu)
        save(key, value) {
          try { localStorage.setItem(saveKey(key), JSON.stringify(value)); } catch (e) { warnOnce('game.save : stockage indisponible'); }
        },
        load(key, dflt) {
          try {
            const raw = localStorage.getItem(saveKey(key));
            return raw === null ? dflt : JSON.parse(raw);
          } catch (e) { return dflt; }
        },
      };
      Object.defineProperty(api, 'score', { enumerable: true, get: () => gameVars.score, set: (v) => { gameVars.score = v; } });
      Object.defineProperty(api, 'paused', { enumerable: true, get: () => scene.paused });
      Object.defineProperty(api.camera, 'x', { enumerable: true, get: () => Math.round(cam.worldView.x) });
      Object.defineProperty(api.camera, 'y', { enumerable: true, get: () => Math.round(cam.worldView.y) });
      return api;
    }

    requestMap(id) {
      if (this.leaving) return;
      this.leaving = true; // plus aucun handler ne s'exécute d'ici le redémarrage
      this.pendingMap = id;
    }

    setHud(id, text, x, y, o) {
      text = String(text);
      o = o && typeof o === 'object' ? o : {};
      const align = o.align === 'center' || o.align === 'right' ? o.align : 'left';
      const isWorld = !!o.world;
      const sig = text + '\u0001' + cssColor(o.color) + '\u0001' + (num(o.size) || 1) + '\u0001' + align + '\u0001' + isWorld;
      let h = this.hud[id];
      if (!h) h = this.hud[id] = { sig: null, key: null, img: null, n: 0, isWorld };
      if (h.sig !== sig) {
        const key = '__hud_' + id + '_' + (++h.n);
        this.textures.addCanvas(key, pixelText(text, o));
        if (h.img) h.img.setTexture(key);
        else h.img = this.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(isWorld ? 1 : 0).setDepth(isWorld ? (DEPTH_ABOVE + 50) : DEPTH_HUD);
        if (h.key) this.textures.remove(h.key);
        h.key = key;
        h.sig = sig;
      }
      h.img.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0);
      if (typeof x === 'number') h.img.x = Math.round(x);
      if (typeof y === 'number') h.img.y = Math.round(y);
    }

    removeHud(id) {
      const h = this.hud[id];
      if (!h) return;
      if (h.img) h.img.destroy();
      if (h.key) this.textures.remove(h.key);
      delete this.hud[id];
    }

    // ----- Boucle -----
    update(time, delta) {
      if (this.pendingMap) {
        const id = this.pendingMap;
        this.pendingMap = null;
        this.scene.restart({ mapId: id });
        return;
      }
      if (this.leaving) return;
      pollGamepad();
      for (const k of KEYS) {
        const v = !!(pad[k] || touchState[k]); // manette / tactile : appui détecté ici
        if (v && !this.vPrev[k]) this.pressKey(k);
        this.vPrev[k] = v;
        const down = this.keys[k].isDown || v;
        this.justDown[k] = this.tapped[k] || (down && !this.wasDown[k]);
        this.tapped[k] = false;
        this.wasDown[k] = down;
      }
      for (const b of ['LEFT', 'RIGHT']) { this.mouseJust[b] = this.mouseTapped[b]; this.mouseTapped[b] = false; }
      const dt = Math.min(delta / 1000, 0.1);
      this.flushTileHits();
      if (!this.paused) this.flushOverlaps();
      if (!this.paused) {
        for (const inst of [this.global, ...this.insts]) {
          if (inst.dead) continue;
          for (const e of inst.handlers.update.slice()) {
            if (inst.dead || this.leaving) break;
            this.call(inst, e, 'update', dt);
          }
        }
        this.updateParticles(dt, Math.min(delta, 100));
      }
      for (const s of this.toDestroy) s.destroy();
      this.toDestroy.length = 0;
      if (this.contacts.size > 400) {
        const frame = this.game.loop.frame;
        for (const [k, f] of this.contacts) if (frame - f > 10) this.contacts.delete(k);
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: settings.width,
    height: settings.height,
    backgroundColor: (startMap && startMap.background) || settings.background,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: settings.gravity }, debug: false } },
    scene: [BootScene, MapScene],
  });
  game.events.once('destroy', () => {
    destroyed = true;
    if (typeof window !== 'undefined') for (const ev of gestureEvents) window.removeEventListener(ev, onGesture, true);
    if (touchEl && touchEl.parentNode) touchEl.parentNode.removeChild(touchEl);
    audio.dispose();
  });
  game.__debugSnapshot = () => {
    if (!activeScene || !activeScene.insts) return { instances: [], fps: 0, mapName: '' };
    return {
      fps: activeScene.game?.loop ? Math.round(activeScene.game.loop.actualFps) : 60,
      mapName: activeScene.map?.name || '',
      instances: activeScene.insts.filter((i) => !i.dead).map((i) => ({
        id: i.id,
        name: i.name,
        x: Math.round(i.self.x),
        y: Math.round(i.self.y),
        vx: Math.round(i.self.vx || 0),
        vy: Math.round(i.self.vy || 0),
        onGround: !!i.self.onGround,
        vars: { ...i.vars },
      })),
    };
  };
  return game;
}
