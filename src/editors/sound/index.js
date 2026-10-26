// Onglet « Sons » : liste des sons du projet, éditeur d'effets (presets WebAudio) et import de fichiers audio.
import './style.css';
import { uid } from '../../core/project.js';
import { PRESETS, MASTER_GAIN, synth } from './synth.js';

const PRESET_LABELS = {
  jump: 'Saut', coin: 'Pièce', hit: 'Coup', powerup: 'Bonus', explosion: 'Explosion', laser: 'Laser', blip: 'Bip', portal: 'Portail',
};
const MAX_FILE = 1024 * 1024; // au-delà : avertissement (le jeu est un seul fichier JSON / HTML)
const WAVE_RATE = 22050;

let ctx = null;          // AudioContext d'écoute
let master = null;
let fileAudio = null;    // lecture d'un son importé
let cleanups = [];
let waveTimer = null;
let waveToken = 0;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const getCtx = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = MASTER_GAIN; // même gain maître que le moteur
  master.connect(ctx.destination);
  return ctx;
};

function playSfx(sfx) {
  const c = getCtx();
  if (!c) return;
  if (c.state !== 'running') c.resume();
  synth(c, master, sfx.preset, sfx.seed, sfx.volume, sfx.pitch);
}

function playFile(snd) {
  if (fileAudio) { fileAudio.pause(); fileAudio = null; }
  fileAudio = new Audio(snd.dataUrl);
  fileAudio.volume = Math.max(0, Math.min(1, snd.volume != null ? snd.volume : 1));
  fileAudio.play().catch(() => {});
}

function play(snd) {
  if (!snd) return;
  if (snd.kind === 'file') playFile(snd);
  else playSfx(snd.sfx);
}

// ---------- Forme d'onde (rendu hors-ligne, avec les mêmes presets) ----------
function drawWave(canvas, snd) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#0f1017';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#33384f';
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  if (!snd || snd.kind !== 'sfx') return;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return;
  const token = ++waveToken;
  const off = new OAC(1, WAVE_RATE, WAVE_RATE);
  const m = off.createGain();
  m.gain.value = MASTER_GAIN;
  m.connect(off.destination);
  const sfx = snd.sfx;
  const dur = synth(off, m, sfx.preset, sfx.seed, sfx.volume, sfx.pitch);
  off.startRendering().then((buf) => {
    if (token !== waveToken || !canvas.isConnected) return;
    const data = buf.getChannelData(0);
    const n = Math.max(1, Math.min(data.length, Math.ceil((dur + 0.08) * WAVE_RATE)));
    g.fillStyle = '#41a6f6';
    for (let x = 0; x < W; x++) {
      const a = Math.floor((x / W) * n), b = Math.max(a + 1, Math.floor(((x + 1) / W) * n));
      let lo = 0, hi = 0;
      for (let i = a; i < b; i++) { const s = data[i]; if (s < lo) lo = s; if (s > hi) hi = s; }
      const y1 = H / 2 - Math.min(1, hi * 1.6) * (H / 2 - 2), y2 = H / 2 - Math.max(-1, lo * 1.6) * (H / 2 - 2);
      g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
    g.fillStyle = '#8b90a8';
    g.font = '10px monospace';
    g.fillText(Math.round(n / WAVE_RATE * 1000) + ' ms', 4, 11);
  }).catch(() => {});
}

export function mount(container, store) {
  cleanups = [];
  let selectedId = store.ui.selectedSoundId || null;
  const sounds = () => store.project.sounds || (store.project.sounds = []);
  const current = () => sounds().find((s) => s.id === selectedId) || null;
  const on = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); };
  const toast = (text) => {
    let t = document.getElementById('toast');
    if (!t) { t = Object.assign(document.createElement('div'), { id: 'toast' }); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  };

  const root = el('div', 'snd-root');
  const left = el('div', 'panel snd-left');
  const main = el('div', 'snd-main');
  root.append(left, main);
  container.appendChild(root);

  const uniqueName = (base) => {
    const names = new Set(sounds().map((s) => s.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(base + i)) i++;
    return base + i;
  };
  const select = (id) => { selectedId = id; store.ui.selectedSoundId = id; renderList(); renderEditor(); };

  // ---------- Liste ----------
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/wav,audio/mpeg,audio/ogg,audio/*,.wav,.mp3,.ogg';
  fileInput.hidden = true;
  left.appendChild(fileInput);
  const head = el('h3', null, 'Sons du projet');
  const newForm = el('div', 'snd-newform');
  const presetSel = el('select');
  for (const p of PRESETS) presetSel.add(new Option(PRESET_LABELS[p] + ' (' + p + ')', p));
  const newBtn = el('button', 'primary', '+ Nouvel effet');
  const importBtn = el('button', null, 'Importer un fichier audio…');
  newForm.append(presetSel, newBtn, importBtn);
  const list = el('div', 'snd-list');
  left.append(head, newForm, list);

  newBtn.onclick = () => {
    const preset = presetSel.value;
    const snd = { id: uid('snd'), name: uniqueName(preset), kind: 'sfx', sfx: { preset, seed: 0, volume: 0.5, pitch: 1 } };
    store.update((p) => { (p.sounds || (p.sounds = [])).push(snd); }, 'sound');
    select(snd.id);
    play(snd);
  };
  importBtn.onclick = () => fileInput.click();
  on(fileInput, 'change', () => {
    const f = fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (!/^audio\//.test(f.type) && !/\.(wav|mp3|ogg)$/i.test(f.name)) { toast('Format non pris en charge (wav, mp3, ogg)'); return; }
    if (f.size > MAX_FILE && !confirm('Ce fichier fait ' + (f.size / 1048576).toFixed(1) + ' Mo : il alourdit le jeu (sauvegarde, export HTML). Importer quand même ?')) return;
    const fr = new FileReader();
    fr.onload = () => {
      const snd = { id: uid('snd'), name: uniqueName(f.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_') || 'son'), kind: 'file', dataUrl: String(fr.result), volume: 1 };
      store.update((p) => { (p.sounds || (p.sounds = [])).push(snd); }, 'sound');
      select(snd.id);
    };
    fr.onerror = () => toast('Lecture du fichier impossible');
    fr.readAsDataURL(f);
  });

  function renderList() {
    list.textContent = '';
    if (!sounds().length) {
      list.appendChild(el('div', 'snd-empty', 'Aucun son. Créez un effet ou importez un fichier. Les presets (jump, coin…) fonctionnent aussi sans rien déclarer : game.playSound(\'jump\').'));
      return;
    }
    for (const s of sounds()) {
      const it = el('div', 'list-item snd-item' + (s.id === selectedId ? ' selected' : ''));
      it.append(el('span', 'snd-name', s.name), el('span', 'snd-kind', s.kind === 'file' ? 'fichier' : 'sfx · ' + ((s.sfx && s.sfx.preset) || '')));
      const b = el('button', 'snd-mini', 'Play');
      b.title = 'Écouter';
      b.onclick = (e) => { e.stopPropagation(); play(s); };
      it.appendChild(b);
      it.onclick = () => select(s.id);
      list.appendChild(it);
    }
  }

  // ---------- Éditeur ----------
  function renderEditor() {
    main.textContent = '';
    clearTimeout(waveTimer);
    waveToken++;
    const snd = current();
    if (!snd) { main.appendChild(el('div', 'snd-empty snd-big', 'Sélectionnez un son, ou créez-en un.')); return; }
    const upd = (fn) => store.update(() => fn(snd), 'sound');

    const title = el('div', 'snd-row');
    const nameIn = el('input'); nameIn.type = 'text'; nameIn.value = snd.name; nameIn.className = 'snd-name-input';
    const callBox = el('div', 'snd-call');
    const callCode = el('code');
    const renderCall = () => { callCode.textContent = "game.playSound('" + snd.name.replace(/'/g, "\\'") + "')"; };
    nameIn.onchange = () => {
      const v = nameIn.value.trim();
      if (!v || v === snd.name) { nameIn.value = snd.name; return; }
      if (sounds().some((s) => s !== snd && s.name === v)) { toast('Ce nom existe déjà'); nameIn.value = snd.name; return; }
      if (!confirm('Renommer « ' + snd.name + ' » en « ' + v + ' » ? Les scripts qui appellent game.playSound(\'' + snd.name + '\') devront être mis à jour.')) { nameIn.value = snd.name; return; }
      upd(() => { snd.name = v; });
      renderList(); renderCall();
    };
    const dupBtn = el('button', null, 'Dupliquer');
    dupBtn.onclick = () => {
      const copy = JSON.parse(JSON.stringify(snd));
      copy.id = uid('snd'); copy.name = uniqueName(snd.name + '_copie');
      store.update((p) => { p.sounds.push(copy); }, 'sound');
      select(copy.id);
    };
    const delBtn = el('button', null, 'Supprimer');
    delBtn.onclick = () => {
      if (!confirm('Supprimer « ' + snd.name + ' » ? Les scripts qui l\'utilisent ne joueront plus rien.')) return;
      store.update((p) => { p.sounds = p.sounds.filter((s) => s.id !== snd.id); }, 'sound');
      select(null);
    };
    title.append(nameIn, dupBtn, delBtn);
    main.appendChild(title);

    const copyBtn = el('button', 'snd-mini', 'Copier');
    copyBtn.onclick = () => { navigator.clipboard?.writeText(callCode.textContent).then(() => toast('Copié'), () => {}); };
    callBox.append(callCode, copyBtn);
    renderCall();
    main.appendChild(callBox);
    main.appendChild(el('div', 'snd-hint', 'Le nom sert d\'identifiant dans les scripts : le renommer casse les appels existants. Options : game.playSound(\'nom\', volume, pitch).'));

    const field = (label, input) => {
      const f = el('label', 'snd-field');
      f.append(el('span', null, label), input);
      return f;
    };
    const slider = (min, max, step, value, onInput, fmt) => {
      const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = value;
      const out = el('output', 'snd-val', fmt(value));
      i.oninput = () => { out.textContent = fmt(+i.value); onInput(+i.value); };
      const w = el('div', 'snd-slider'); w.append(i, out);
      return w;
    };

    const form = el('div', 'snd-form');
    const wave = el('canvas', 'snd-wave'); wave.width = 560; wave.height = 90;
    const refreshWave = () => { clearTimeout(waveTimer); waveTimer = setTimeout(() => drawWave(wave, snd), 60); };

    const playBtn = el('button', 'primary snd-play', 'Écouter (Espace)');
    playBtn.onclick = () => play(snd);

    if (snd.kind === 'sfx') {
      const sfx = snd.sfx;
      const ps = el('select');
      for (const p of PRESETS) ps.add(new Option(PRESET_LABELS[p] + ' (' + p + ')', p));
      ps.value = sfx.preset;
      ps.onchange = () => { upd(() => { sfx.preset = ps.value; }); renderList(); refreshWave(); play(snd); };
      const seedIn = el('input'); seedIn.type = 'number'; seedIn.step = 1; seedIn.value = sfx.seed || 0;
      seedIn.onchange = () => { upd(() => { sfx.seed = Math.trunc(+seedIn.value) || 0; }); refreshWave(); play(snd); };
      const vary = el('button', null, 'Varier');
      vary.onclick = () => {
        const s = 1 + Math.floor(Math.random() * 99999);
        upd(() => { sfx.seed = s; }); seedIn.value = s; refreshWave(); play(snd);
      };
      const seedW = el('div', 'snd-inline'); seedW.append(seedIn, vary);
      form.append(
        field('Preset', ps),
        field('Seed', seedW),
        field('Pitch', slider(0.25, 3, 0.01, sfx.pitch || 1, (v) => { upd(() => { sfx.pitch = v; }); refreshWave(); }, (v) => '×' + (+v).toFixed(2))),
        field('Volume', slider(0, 1, 0.01, sfx.volume != null ? sfx.volume : 0.5, (v) => { upd(() => { sfx.volume = v; }); refreshWave(); }, (v) => Math.round(v * 100) + ' %')),
      );
      main.append(form, wave, playBtn);

      // Variantes
      const varBox = el('div', 'snd-variants');
      const genBtn = el('button', null, 'Générer 5 variantes');
      const varList = el('div', 'snd-varlist');
      genBtn.onclick = () => {
        varList.textContent = '';
        for (let i = 0; i < 5; i++) {
          const seed = 1 + Math.floor(Math.random() * 99999);
          const row = el('div', 'snd-var');
          row.append(el('span', 'snd-var-seed', 'seed ' + seed));
          const pb = el('button', 'snd-mini', 'Play');
          pb.title = 'Écouter';
          pb.onclick = () => playSfx({ ...sfx, seed });
          const kb = el('button', 'snd-mini', 'Garder');
          kb.onclick = () => { upd(() => { sfx.seed = seed; }); seedIn.value = seed; refreshWave(); play(snd); };
          row.append(pb, kb);
          varList.appendChild(row);
        }
      };
      varBox.append(genBtn, varList);
      main.appendChild(varBox);
      refreshWave();
    } else {
      const au = el('audio'); au.controls = true; au.src = snd.dataUrl; au.className = 'snd-audio';
      const kb = Math.round((snd.dataUrl.length * 3 / 4) / 1024);
      form.append(
        field('Volume', slider(0, 1, 0.01, snd.volume != null ? snd.volume : 1, (v) => { upd(() => { snd.volume = v; }); }, (v) => Math.round(v * 100) + ' %')),
      );
      main.append(el('div', 'snd-hint', 'Fichier importé · ' + kb + ' Ko' + (kb > 1024 ? ' (lourd : préférez un fichier plus court)' : '')), form, au, playBtn);
    }
  }

  // Raccourci Espace = écouter
  on(window, 'keydown', (e) => {
    if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'range'))) return;
    const s = current();
    if (!s) return;
    e.preventDefault();
    play(s);
  });

  if (!current()) selectedId = sounds()[0]?.id || null;
  renderList();
  renderEditor();
}

export function unmount() {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* ignoré */ } }
  cleanups = [];
  clearTimeout(waveTimer);
  waveToken++;
  if (fileAudio) { fileAudio.pause(); fileAudio = null; }
  if (ctx) { try { ctx.close(); } catch (e) { /* ignoré */ } ctx = null; master = null; }
}
