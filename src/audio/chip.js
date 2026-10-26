// Moteur audio chiptune WebAudio pour PixelForge.
// Zero imports : ce fichier est utilise directement par l'editeur,
// le runtime de test et inline dans l'export autonome HTML.

export const MASTER_GAIN = 0.6;
export const PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'];
export const INSTRUMENTS = ['pulse12', 'pulse25', 'pulse50', 'triangle', 'saw', 'noise', 'wave', 'sample'];

const NOTE_SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function noteFreq(val) {
  if (typeof val === 'number') {
    if (val <= 0) return 0;
    if (Number.isInteger(val) && val >= 1 && val <= 127) {
      return 440 * Math.pow(2, (val - 69) / 12);
    }
    return val;
  }
  const str = String(val || '').trim();
  if (!str || str === '-' || str === '...' || str === '---') return 0;
  const m = /^([A-Ga-g])([#b]?)(-?[0-9])$/.exec(str);
  if (!m) return 0;
  const base = NOTE_SEMITONES[m[1].toLowerCase()];
  if (base === undefined) return 0;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const oct = parseInt(m[3], 10);
  const midi = (oct + 1) * 12 + base + acc;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Generateur pseudo-aleatoire mulberry32 pour les variations de sons
const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Formes d'ondes NES via PeriodicWave (rapports cycliques 12.5%, 25%, 50%)
function getPulseWave(ctx, duty) {
  const key = '_pfPulse_' + Math.round(duty * 1000);
  if (ctx[key]) return ctx[key];
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    real[i] = (2 / (i * Math.PI)) * Math.sin(2 * Math.PI * i * duty);
    imag[i] = (2 / (i * Math.PI)) * (1 - Math.cos(2 * Math.PI * i * duty));
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  ctx[key] = wave;
  return wave;
}

// Bruit blanc aleatoire standard (utilise par les effets hit, explosion pour parfaite compatibilite)
function getWhiteNoiseBuffer(ctx) {
  if (ctx._pfNoiseBuf) return ctx._pfNoiseBuf;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  ctx._pfNoiseBuf = buf;
  return buf;
}

// Bruit metallique LFSR (Linear Feedback Shift Register) authentique NES 15-bit
function getLfsrBuffer(ctx, shortMode = false) {
  const key = shortMode ? '_pfLfsrShort' : '_pfLfsrLong';
  if (ctx[key]) return ctx[key];
  const length = shortMode ? 93 * 16 : 32767;
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let reg = 1;
  const tap = shortMode ? 6 : 1;
  for (let i = 0; i < length; i++) {
    const b0 = reg & 1;
    const bOther = (reg >> tap) & 1;
    const feedback = b0 ^ bOther;
    reg = (reg >> 1) | (feedback << 14);
    d[i] = b0 ? 1 : -1;
  }
  ctx[key] = buf;
  return buf;
}

// Table d'onde 32 echantillons (Game Boy / SCC)
function getWaveTableBuffer(ctx, table) {
  const buf = ctx.createBuffer(1, 32, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (Array.isArray(table) && table.length >= 32) {
    for (let i = 0; i < 32; i++) {
      const v = typeof table[i] === 'number' ? table[i] : 8;
      d[i] = (v / 7.5) - 1;
    }
  } else {
    for (let i = 0; i < 32; i++) {
      d[i] = Math.sin((i / 32) * Math.PI * 2);
    }
  }
  return buf;
}

export function chiptuneToSong(track) {
  const bpm = track.bpm || 140;
  const notes = track.notes || [];
  const durs = track.durations || [];
  const patternNotes = [];
  let step = 0;
  for (let i = 0; i < notes.length; i++) {
    const dur = durs[i] || 1;
    const n = notes[i];
    if (n && n !== '-' && n !== '...') {
      patternNotes.push({ ch: 'lead', step, len: dur, pitch: n, vel: 0.8 });
    }
    step += dur;
  }
  return {
    id: 'track_' + (track.name || 'chiptune'),
    name: track.name || 'Chiptune',
    bpm,
    stepsPerBeat: 2,
    loop: true,
    channels: [
      {
        id: 'lead',
        name: 'Lead',
        instrument: track.type === 'triangle' ? 'triangle' : 'pulse50',
        volume: 0.8,
        pan: 0,
        env: { a: 0.005, d: 0.05, s: 0.8, r: 0.02 }
      }
    ],
    patterns: [
      { id: 'p0', name: 'Main', length: Math.max(1, step), notes: patternNotes }
    ],
    playlist: [
      { pattern: 'p0', start: 0, track: 0 }
    ]
  };
}

export function createChipAudio(ctx, destination) {
  const dest = destination || ctx.destination;
  let activeSong = null;

  // Joue une note avec glissando f0 -> f1 et enveloppe exponentielle (utilise pour les presets sfx)
  function playTone(type, f0, f1, t, dur, vol, targetDest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(targetDest || dest);
    o.start(t);
    o.stop(t + dur + 0.03);
    return { osc: o, gain: g };
  }

  // Joue un bruit filtre (utilise pour les presets sfx hit, explosion)
  function playNoise(t, dur, vol, c0, c1, targetDest) {
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = getWhiteNoiseBuffer(ctx);
    s.loop = true;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(c0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, c1), t + dur);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(targetDest || dest);
    s.start(t);
    s.stop(t + dur + 0.03);
    return { source: s, filter: f, gain: g };
  }

  // Joue un preset sonore (jump, coin, hit...). Compatible avec l'ancienne signature synth(preset, seed, volume, pitch).
  function playSfx(preset, seed = 0, volume = 1, pitch = 1, atTime = null) {
    if (typeof preset === 'object' && preset !== null) {
      const opts = preset;
      preset = opts.preset;
      seed = opts.seed || 0;
      volume = opts.volume != null ? opts.volume : 1;
      pitch = opts.pitch || 1;
      atTime = opts.atTime != null ? opts.atTime : null;
    }
    const r = rng(seed || 0);
    const vary = seed ? 1 + (r() - 0.5) * 0.2 : 1;
    const k = (typeof pitch === 'number' && pitch > 0 ? pitch : 1) * vary;
    const v = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1));
    const t = (atTime != null ? atTime : ctx.currentTime) + 0.005;

    const T = (type, f0, f1, at, dur, vol) => playTone(type, f0 * k, f1 * k, t + at, dur, vol * v, dest);
    const N = (at, dur, vol, c0, c1) => playNoise(t + at, dur, vol * v, c0, c1, dest);

    switch (preset) {
      case 'jump':
        T('square', 220, 560, 0, 0.18, 0.3);
        return 0.2;
      case 'coin':
        T('square', 988, 988, 0, 0.07, 0.25);
        T('square', 1319, 1319, 0.07, 0.25, 0.25);
        return 0.35;
      case 'hit':
        T('sawtooth', 220, 50, 0, 0.2, 0.35);
        N(0, 0.12, 0.3, 3000, 300);
        return 0.25;
      case 'powerup':
        [392, 523, 659, 784, 1047].forEach((f, i) => T('square', f, f, i * 0.07, 0.09, 0.22));
        return 0.5;
      case 'explosion':
        N(0, 0.7, 0.8, 2400, 80);
        T('sawtooth', 90, 30, 0, 0.5, 0.3);
        return 0.75;
      case 'laser':
        T('sawtooth', 1400, 180, 0, 0.22, 0.25);
        return 0.25;
      case 'blip':
        T('square', 660, 660, 0, 0.06, 0.25);
        return 0.08;
      case 'portal':
        T('sine', 180, 900, 0, 0.45, 0.35);
        T('triangle', 185, 930, 0, 0.45, 0.2);
        T('sine', 900, 400, 0.4, 0.2, 0.2);
        return 0.65;
      default:
        return 0;
    }
  }

  // Joue une note instrumentale complete avec ADSR, vibrato LFO et arpege 60 Hz
  function scheduleNote(opts) {
    const time = Math.max(ctx.currentTime, opts.time || ctx.currentTime);
    const duration = Math.max(0.01, opts.duration || 0.1);
    const inst = opts.instrument || 'pulse50';
    const rawPitch = opts.pitch != null ? opts.pitch : 'A4';
    const baseFreq = noteFreq(rawPitch);
    const vel = opts.vel != null ? opts.vel : 1;
    const vol = Math.max(0, Math.min(1, (opts.volume != null ? opts.volume : 0.8) * vel));
    const pan = Math.max(-1, Math.min(1, opts.pan != null ? opts.pan : 0));
    const env = Object.assign({ a: 0.005, d: 0.08, s: 0.6, r: 0.05 }, opts.env || {});
    const vibrato = opts.vibrato || null;
    const arp = Array.isArray(opts.arp) && opts.arp.length > 0 ? opts.arp : null;

    if (inst !== 'noise' && baseFreq <= 0) return null;

    // Chaine de gain et panoramique
    const noteGain = ctx.createGain();
    let panNode = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panNode = ctx.createStereoPanner();
      panNode.pan.setValueAtTime(pan, time);
      noteGain.connect(panNode);
      panNode.connect(dest);
    } else {
      noteGain.connect(dest);
    }

    // Automatisation ADSR
    const a = Math.max(0.001, env.a);
    const d = Math.max(0.001, env.d);
    const s = Math.max(0.0001, Math.min(1, env.s));
    const r = Math.max(0.001, env.r);

    noteGain.gain.setValueAtTime(0.0001, time);
    noteGain.gain.linearRampToValueAtTime(vol * 0.5, time + a);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.5 * s), time + a + d);
    const releaseStart = time + duration;
    noteGain.gain.setValueAtTime(Math.max(0.0001, vol * 0.5 * s), releaseStart);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + r);

    const stopTime = releaseStart + r + 0.02;

    // Batterie NES speciale
    if (inst === 'noise' && opts.drumKit) {
      const isKick = baseFreq < 150 || rawPitch === 'C3' || rawPitch === 'kick';
      const isSnare = (baseFreq >= 150 && baseFreq < 300) || rawPitch === 'D3' || rawPitch === 'snare';
      const isHatOpen = baseFreq > 600 || rawPitch === 'A#3' || rawPitch === 'hat_open';

      if (isKick) {
        // Kick : onde triangulaire descendante
        const kickOsc = ctx.createOscillator();
        kickOsc.type = 'triangle';
        kickOsc.frequency.setValueAtTime(130, time);
        kickOsc.frequency.exponentialRampToValueAtTime(35, time + Math.min(0.12, duration));
        kickOsc.connect(noteGain);
        kickOsc.start(time);
        kickOsc.stop(stopTime);
        return { stop: () => { try { kickOsc.stop(); } catch (e) {} } };
      }

      // Snare / Charleston
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = getLfsrBuffer(ctx, isSnare);
      noiseSource.loop = true;
      const filter = ctx.createBiquadFilter();
      if (isSnare) {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, time);
        filter.Q.setValueAtTime(1.5, time);
      } else {
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(isHatOpen ? 6000 : 8000, time);
      }
      noiseSource.connect(filter);
      filter.connect(noteGain);
      noiseSource.start(time);
      noiseSource.stop(stopTime);
      return { stop: () => { try { noiseSource.stop(); } catch (e) {} } };
    }

    if (inst === 'noise') {
      const noiseSource = ctx.createBufferSource();
      const isShort = opts.shortNoise || baseFreq > 500;
      noiseSource.buffer = getLfsrBuffer(ctx, isShort);
      noiseSource.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.max(100, Math.min(18000, baseFreq * 8)), time);
      noiseSource.connect(filter);
      filter.connect(noteGain);
      noiseSource.start(time);
      noiseSource.stop(stopTime);
      return { stop: () => { try { noiseSource.stop(); } catch (e) {} } };
    }

    if (inst === 'wave') {
      const src = ctx.createBufferSource();
      src.buffer = getWaveTableBuffer(ctx, opts.waveTable);
      src.loop = true;
      src.playbackRate.setValueAtTime((baseFreq * 32) / ctx.sampleRate, time);
      src.connect(noteGain);
      src.start(time);
      src.stop(stopTime);
      return { stop: () => { try { src.stop(); } catch (e) {} } };
    }

    // Oscillateur pour pulse12, pulse25, pulse50, triangle, saw
    const osc = ctx.createOscillator();
    if (inst === 'pulse12') {
      osc.setPeriodicWave(getPulseWave(ctx, 0.125));
    } else if (inst === 'pulse25') {
      osc.setPeriodicWave(getPulseWave(ctx, 0.25));
    } else if (inst === 'pulse50') {
      osc.setPeriodicWave(getPulseWave(ctx, 0.5));
    } else if (inst === 'triangle') {
      osc.type = 'triangle';
    } else if (inst === 'saw') {
      osc.type = 'sawtooth';
    } else {
      osc.type = 'square';
    }

    osc.frequency.setValueAtTime(baseFreq, time);

    // Arpege rapide a 60 Hz
    if (arp && arp.length > 1) {
      const stepDuration = 1 / 60;
      const totalSteps = Math.ceil(duration / stepDuration);
      for (let sIdx = 0; sIdx < totalSteps; sIdx++) {
        const semiOffset = arp[sIdx % arp.length];
        const stepPitch = baseFreq * Math.pow(2, semiOffset / 12);
        osc.frequency.setValueAtTime(stepPitch, time + sIdx * stepDuration);
      }
    }

    // Vibrato LFO
    let vibOsc = null;
    if (vibrato && vibrato.depth > 0) {
      vibOsc = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vibOsc.type = 'sine';
      vibOsc.frequency.setValueAtTime(vibrato.rate || 6, time);
      const depthHz = baseFreq * (Math.pow(2, (vibrato.depth || 0.5) / 12) - 1);
      vibGain.gain.setValueAtTime(depthHz, time);
      vibOsc.connect(vibGain);
      vibGain.connect(osc.frequency);
      vibOsc.start(time);
      vibOsc.stop(stopTime);
    }

    osc.connect(noteGain);
    osc.start(time);
    osc.stop(stopTime);

    return {
      stop() {
        try { osc.stop(); } catch (e) {}
        if (vibOsc) { try { vibOsc.stop(); } catch (e) {} }
      }
    };
  }

  // Joue une piste chiptune simple (retrocompatibilite tetris, adventure, action)
  function playChiptuneTrack(track, volume = 0.5, onDone = null) {
    const song = chiptuneToSong(track);
    return playSong(song, { loop: false, volume, onEnd: onDone });
  }

  // Joue un morceau complet (objet song) avec planificateur d'anticipation (Two Clocks pattern)
  function playSong(song, options = {}) {
    stopSong();

    if (!song) return null;
    const bpm = Math.max(20, Math.min(300, song.bpm || 140));
    const stepsPerBeat = Math.max(1, song.stepsPerBeat || 4);
    const loop = options.loop != null ? !!options.loop : (song.loop !== false);
    const masterVol = options.volume != null ? options.volume : 1;
    const swing = Math.max(0, Math.min(0.5, song.swing || 0));
    const secondsPerBeat = 60 / bpm;
    const baseStepSec = secondsPerBeat / stepsPerBeat;

    const channelsById = {};
    (song.channels || []).forEach((c) => { channelsById[c.id] = c; });

    const patternsById = {};
    (song.patterns || []).forEach((p) => { patternsById[p.id] = p; });

    // Construction de la grille d'evenements
    // Si playlist est vide mais qu'un pattern existe, on joue le premier pattern
    let playlist = song.playlist || [];
    if (playlist.length === 0 && (song.patterns || []).length > 0) {
      playlist = [{ pattern: song.patterns[0].id, start: 0, track: 0 }];
    }

    let maxStep = 0;
    const eventsByStep = {};

    playlist.forEach((item) => {
      const pat = patternsById[item.pattern];
      if (!pat) return;
      const startStep = item.start || 0;
      const pLen = pat.length || 16;
      if (startStep + pLen > maxStep) maxStep = startStep + pLen;

      (pat.notes || []).forEach((note) => {
        const step = startStep + (note.step || 0);
        if (!eventsByStep[step]) eventsByStep[step] = [];
        eventsByStep[step].push({
          ch: note.ch,
          pitch: note.pitch,
          len: note.len || 1,
          vel: note.vel != null ? note.vel : 1
        });
      });
    });

    if (maxStep <= 0) maxStep = 16;

    let currentStep = 0;
    let nextStepTime = ctx.currentTime + 0.05;
    let timerId = null;
    let stopped = false;
    const activeNotes = [];

    const SCHEDULE_INTERVAL_MS = 25;
    const LOOKAHEAD_SEC = 0.1;

    function stepDuration(s) {
      if (swing <= 0) return baseStepSec;
      return (s % 2 === 0) ? baseStepSec * (1 + swing) : baseStepSec * (1 - swing);
    }

    function scheduleAhead() {
      if (stopped) return;
      while (nextStepTime < ctx.currentTime + LOOKAHEAD_SEC) {
        const notesAtStep = eventsByStep[currentStep];
        if (notesAtStep && notesAtStep.length > 0) {
          notesAtStep.forEach((n) => {
            const ch = channelsById[n.ch] || { instrument: 'pulse50', volume: 0.8 };
            if (ch.mute) return;
            const dur = (n.len || 1) * baseStepSec;
            const handle = scheduleNote({
              time: nextStepTime,
              duration: dur,
              instrument: ch.instrument,
              pitch: n.pitch,
              vel: n.vel,
              volume: (ch.volume != null ? ch.volume : 0.8) * masterVol,
              pan: ch.pan || 0,
              env: ch.env,
              vibrato: ch.vibrato,
              arp: ch.arp,
              drumKit: ch.drumKit,
              waveTable: ch.waveTable
            });
            if (handle) activeNotes.push(handle);
          });
        }

        if (options.onBeat && currentStep % stepsPerBeat === 0) {
          options.onBeat(Math.floor(currentStep / stepsPerBeat));
        }

        const durThisStep = stepDuration(currentStep);
        nextStepTime += durThisStep;
        currentStep++;

        if (currentStep >= maxStep) {
          if (loop) {
            currentStep = 0;
          } else {
            stopped = true;
            clearInterval(timerId);
            timerId = null;
            if (options.onEnd) {
              const delayToEnd = Math.max(0, (nextStepTime - ctx.currentTime) * 1000);
              setTimeout(() => { if (!activeSong || activeSong.controller !== controller) return; options.onEnd(); }, delayToEnd);
            }
            break;
          }
        }
      }
    }

    timerId = setInterval(scheduleAhead, SCHEDULE_INTERVAL_MS);
    scheduleAhead();

    const controller = {
      stop() {
        if (stopped) return;
        stopped = true;
        if (timerId) { clearInterval(timerId); timerId = null; }
        for (const n of activeNotes) n.stop();
        activeNotes.length = 0;
        if (activeSong && activeSong.controller === controller) activeSong = null;
      },
      getCurrentStep() {
        return currentStep;
      },
      isPlaying() {
        return !stopped;
      }
    };

    activeSong = { song, controller };
    return controller;
  }

  function stopSong() {
    if (activeSong) {
      activeSong.controller.stop();
      activeSong = null;
    }
  }

  // Rendu hors-ligne vers un AudioBuffer (utilise pour export WAV et formes d'ondes)
  async function renderOffline(song, durationSeconds = null) {
    const OfflineCtx = (typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext)) || null;
    if (!OfflineCtx) throw new Error('OfflineAudioContext non supporte dans cet environnement');

    const bpm = Math.max(20, Math.min(300, (song && song.bpm) || 140));
    const stepsPerBeat = Math.max(1, (song && song.stepsPerBeat) || 4);
    const baseStepSec = (60 / bpm) / stepsPerBeat;

    let totalSteps = 16;
    if (song && song.playlist && song.playlist.length > 0) {
      const pats = {};
      (song.patterns || []).forEach((p) => { pats[p.id] = p; });
      song.playlist.forEach((item) => {
        const p = pats[item.pattern];
        const pLen = (p && p.length) || 16;
        if ((item.start || 0) + pLen > totalSteps) totalSteps = (item.start || 0) + pLen;
      });
    }

    const calcDur = durationSeconds || (totalSteps * baseStepSec + 1.0);
    const sampleRate = 44100;
    const offCtx = new OfflineCtx(2, Math.ceil(sampleRate * calcDur), sampleRate);
    const offChip = createChipAudio(offCtx, offCtx.destination);
    offChip.playSong(song, { loop: false, volume: 1 });
    return offCtx.startRendering();
  }

  return {
    playSfx,
    scheduleNote,
    playSong,
    stopSong,
    playChiptuneTrack,
    renderOffline
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createChipAudio = createChipAudio;
  globalThis.chiptuneToSong = chiptuneToSong;
  globalThis.noteFreq = noteFreq;
}
