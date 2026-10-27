// Moteur audio chiptune WebAudio pour PixelForge.
// Zero imports : ce fichier est utilise directement par l'editeur,
// le runtime de test et inline dans l'export autonome HTML.

export const MASTER_GAIN = 0.6;
export const PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'];
export const INSTRUMENTS = [
  'pulse12', 'pulse25', 'pulse50', 'triangle', 'saw', 'noise', 'wave', 'sample',
  'synth_sub', 'synth_fm', 'sampler', 'drum_machine'
];
export const VALID_EFFECTS = ['reverb', 'delay', 'eq3', 'compressor', 'filter', 'distortion', 'chorus', 'bitcrusher'];

export const INSTRUMENT_PRESETS = {
  bass_808: {
    type: 'synth_sub',
    name: 'Basse 808',
    category: 'bass',
    params: {
      osc1: { wave: 'sine', octave: -1, tune: 0, mix: 0.9 },
      osc2: { wave: 'triangle', octave: -1, tune: 0, mix: 0.3 },
      filter: { type: 'lowpass', cutoff: 350, resonance: 1.0, envAmount: 0.4 },
      envAmp: { a: 0.005, d: 0.25, s: 0.4, r: 0.1 },
      envFilter: { a: 0.005, d: 0.1, s: 0.2, r: 0.05 },
    }
  },
  bass_synth: {
    type: 'synth_sub',
    name: 'Basse Synth Punchy',
    category: 'bass',
    params: {
      osc1: { wave: 'saw', octave: -1, tune: 0, mix: 0.8 },
      osc2: { wave: 'pulse50', octave: -1, tune: 7, mix: 0.5 },
      filter: { type: 'lowpass', cutoff: 1200, resonance: 3.0, envAmount: 0.7 },
      envAmp: { a: 0.01, d: 0.15, s: 0.6, r: 0.08 },
      envFilter: { a: 0.005, d: 0.12, s: 0.1, r: 0.05 },
    }
  },
  bass_fm: {
    type: 'synth_fm',
    name: 'Basse FM Solide',
    category: 'bass',
    params: {
      algorithm: 1,
      op1: { ratio: 1.0, level: 1.0, env: { a: 0.005, d: 0.2, s: 0.5, r: 0.08 } },
      op2: { ratio: 2.0, level: 0.7, env: { a: 0.005, d: 0.1, s: 0.2, r: 0.05 } },
      op3: { ratio: 1.0, level: 0.3, env: { a: 0.01, d: 0.15, s: 0.1, r: 0.05 } },
      op4: { ratio: 3.5, level: 0.15, env: { a: 0.005, d: 0.08, s: 0.05, r: 0.05 } },
      feedback: 0.25
    }
  },
  lead_retro: {
    type: 'synth_sub',
    name: 'Lead Retro Chiptune',
    category: 'lead',
    params: {
      osc1: { wave: 'pulse50', octave: 0, tune: 0, mix: 0.7 },
      osc2: { wave: 'saw', octave: 0, tune: 8, mix: 0.6 },
      filter: { type: 'lowpass', cutoff: 3800, resonance: 2.5, envAmount: 0.3 },
      envAmp: { a: 0.005, d: 0.1, s: 0.8, r: 0.12 },
      lfo: { target: 'pitch', rate: 5.5, depth: 0.08 }
    }
  },
  lead_poly: {
    type: 'synth_sub',
    name: 'Lead Polyphonique Cuivre',
    category: 'lead',
    params: {
      osc1: { wave: 'saw', octave: 0, tune: 0, mix: 0.75 },
      osc2: { wave: 'saw', octave: 0, tune: 12, mix: 0.6 },
      filter: { type: 'lowpass', cutoff: 2800, resonance: 2.0, envAmount: 0.5 },
      envAmp: { a: 0.02, d: 0.2, s: 0.7, r: 0.15 },
      envFilter: { a: 0.03, d: 0.3, s: 0.3, r: 0.1 }
    }
  },
  pad_warm: {
    type: 'synth_sub',
    name: 'Nappe Chaude Analogique',
    category: 'pad',
    params: {
      osc1: { wave: 'saw', octave: 0, tune: -6, mix: 0.7 },
      osc2: { wave: 'saw', octave: 0, tune: 6, mix: 0.7 },
      filter: { type: 'lowpass', cutoff: 1400, resonance: 1.5, envAmount: 0.2 },
      envAmp: { a: 0.15, d: 0.4, s: 0.85, r: 0.35 },
      lfo: { target: 'filter', rate: 1.2, depth: 0.15 }
    }
  },
  pad_retro: {
    type: 'synth_sub',
    name: 'Nappe Espace 8-Bit',
    category: 'pad',
    params: {
      osc1: { wave: 'pulse25', octave: 0, tune: 0, mix: 0.6 },
      osc2: { wave: 'triangle', octave: 1, tune: 4, mix: 0.5 },
      filter: { type: 'bandpass', cutoff: 1800, resonance: 2.2, envAmount: 0.1 },
      envAmp: { a: 0.1, d: 0.3, s: 0.8, r: 0.3 },
      lfo: { target: 'pitch', rate: 4.0, depth: 0.05 }
    }
  },
  piano_vintage: {
    type: 'synth_fm',
    name: 'Piano Electrique FM',
    category: 'keys',
    params: {
      algorithm: 5,
      op1: { ratio: 1.0, level: 1.0, env: { a: 0.005, d: 0.5, s: 0.3, r: 0.2 } },
      op2: { ratio: 1.0, level: 0.4, env: { a: 0.005, d: 0.2, s: 0.1, r: 0.1 } },
      op3: { ratio: 1.0, level: 0.9, env: { a: 0.005, d: 0.6, s: 0.3, r: 0.2 } },
      op4: { ratio: 14.0, level: 0.2, env: { a: 0.002, d: 0.08, s: 0.01, r: 0.05 } },
      feedback: 0.1
    }
  },
  strings_ensemble: {
    type: 'synth_sub',
    name: 'Cordes Orchestrales',
    category: 'strings',
    params: {
      osc1: { wave: 'saw', octave: 0, tune: -8, mix: 0.65 },
      osc2: { wave: 'saw', octave: 0, tune: 8, mix: 0.65 },
      filter: { type: 'lowpass', cutoff: 2600, resonance: 1.2, envAmount: 0.15 },
      envAmp: { a: 0.12, d: 0.35, s: 0.9, r: 0.3 },
      lfo: { target: 'pitch', rate: 5.0, depth: 0.03 }
    }
  },
  drums_808: {
    type: 'drum_machine',
    name: 'Batterie Vintage 808',
    category: 'drums',
    params: { kit: '808' }
  },
  drums_acoustic: {
    type: 'drum_machine',
    name: 'Batterie Hybride Retro',
    category: 'drums',
    params: { kit: 'acoustic' }
  }
};

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

// Piece de batterie d'une note de canal « drumKit » : nom explicite, sinon classe de hauteur
// (convention General MIDI : C = kick, D/D#/E = snare, F#/G# = charleston ferme, A# = ouvert, autres = tom).
export function drumPiece(pitch) {
  const name = String(pitch || '').toLowerCase();
  if (name === 'kick' || name === 'snare' || name === 'hat_closed' || name === 'hat_open' || name === 'tom') return name;
  if (name === 'hat') return 'hat_closed';
  const f = noteFreq(pitch);
  if (!(f > 0)) return 'kick';
  const pc = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
  if (pc === 0 || pc === 11) return 'kick';
  if (pc === 2 || pc === 3 || pc === 4) return 'snare';
  if (pc === 6 || pc === 8) return 'hat_closed';
  if (pc === 10) return 'hat_open';
  return 'tom';
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

export function generateSfxr(type, seed = 0) {
  const r = rng(seed || Math.floor(Math.random() * 100000));
  switch (type) {
    case 'coin':
      return {
        waveType: 'square',
        baseFreq: 800 + r() * 400,
        freqSlide: 0.1 + r() * 0.2,
        attack: 0.005,
        sustain: 0.05 + r() * 0.05,
        decay: 0.15 + r() * 0.15,
        punch: 0.3,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        lpf: 20000,
        hpf: 20
      };
    case 'laser':
      return {
        waveType: r() > 0.5 ? 'sawtooth' : 'pulse25',
        baseFreq: 1200 + r() * 600,
        freqSlide: -0.6 - r() * 0.3,
        attack: 0.001,
        sustain: 0.04 + r() * 0.04,
        decay: 0.1 + r() * 0.15,
        punch: 0.2,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        lpf: 15000,
        hpf: 100
      };
    case 'explosion':
      return {
        waveType: 'noise',
        baseFreq: 100 + r() * 100,
        freqSlide: -0.3 - r() * 0.4,
        attack: 0.005,
        sustain: 0.1 + r() * 0.2,
        decay: 0.4 + r() * 0.3,
        punch: 0.5,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        lpf: 2500 + r() * 2000,
        hpf: 20
      };
    case 'powerup':
      return {
        waveType: 'pulse50',
        baseFreq: 300 + r() * 200,
        freqSlide: 0.5 + r() * 0.4,
        attack: 0.01,
        sustain: 0.1 + r() * 0.1,
        decay: 0.2 + r() * 0.2,
        punch: 0.3,
        vibratoDepth: 0.1,
        vibratoSpeed: 8,
        lpf: 20000,
        hpf: 20
      };
    case 'hit':
      return {
        waveType: r() > 0.5 ? 'sawtooth' : 'noise',
        baseFreq: 200 + r() * 150,
        freqSlide: -0.5 - r() * 0.3,
        attack: 0.001,
        sustain: 0.03 + r() * 0.05,
        decay: 0.1 + r() * 0.15,
        punch: 0.4,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        lpf: 5000,
        hpf: 20
      };
    case 'jump':
      return {
        waveType: 'square',
        baseFreq: 180 + r() * 80,
        freqSlide: 0.4 + r() * 0.3,
        attack: 0.005,
        sustain: 0.05 + r() * 0.05,
        decay: 0.12 + r() * 0.1,
        punch: 0.2,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        lpf: 20000,
        hpf: 20
      };
    case 'blip':
      return {
        waveType: 'square',
        baseFreq: 500 + r() * 300,
        freqSlide: 0,
        attack: 0.002,
        sustain: 0.03 + r() * 0.03,
        decay: 0.05 + r() * 0.05,
        punch: 0.1,
        vibratoDepth: 0,
        vibratoSpeed: 0,
        lpf: 20000,
        hpf: 20
      };
    default:
      const waves = ['square', 'sawtooth', 'triangle', 'noise', 'pulse25'];
      return {
        waveType: waves[Math.floor(r() * waves.length)],
        baseFreq: 100 + r() * 1200,
        freqSlide: (r() - 0.5) * 1.2,
        attack: 0.001 + r() * 0.05,
        sustain: 0.02 + r() * 0.2,
        decay: 0.05 + r() * 0.4,
        punch: r() * 0.5,
        vibratoDepth: r() > 0.7 ? r() * 0.3 : 0,
        vibratoSpeed: 5 + r() * 15,
        lpf: 1000 + r() * 19000,
        hpf: 20 + r() * 500
      };
  }
}

export function mutateSfxr(params, seed = 0) {
  const r = rng(seed || Math.floor(Math.random() * 100000));
  const mutateNum = (val, range, min, max) => {
    const delta = (r() - 0.5) * range;
    return Math.max(min, Math.min(max, val + delta));
  };
  return {
    ...params,
    baseFreq: mutateNum(params.baseFreq || 440, 100, 20, 5000),
    freqSlide: mutateNum(params.freqSlide || 0, 0.2, -1, 1),
    attack: mutateNum(params.attack || 0.01, 0.02, 0.001, 1),
    sustain: mutateNum(params.sustain || 0.1, 0.05, 0.01, 1.5),
    decay: mutateNum(params.decay || 0.2, 0.1, 0.01, 2),
    vibratoDepth: mutateNum(params.vibratoDepth || 0, 0.1, 0, 1)
  };
}

export function createChipAudio(ctx, destination) {
  const dest = destination || ctx.destination;
  let activeSong = null;
  const samplesCache = new Map();

  function loadAudioSample(id, dataOrBuffer) {
    if (!id) return Promise.reject(new Error('id requis'));
    if (dataOrBuffer && typeof dataOrBuffer === 'object' && typeof dataOrBuffer.getChannelData === 'function') {
      samplesCache.set(id, dataOrBuffer);
      return Promise.resolve(dataOrBuffer);
    }
    if (typeof dataOrBuffer === 'string' && dataOrBuffer.startsWith('data:')) {
      try {
        const comma = dataOrBuffer.indexOf(',');
        const base64 = comma >= 0 ? dataOrBuffer.slice(comma + 1) : dataOrBuffer;
        if (typeof atob === 'function') {
          const bin = atob(base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          if (typeof ctx.decodeAudioData === 'function') {
            return new Promise((resolve) => {
              ctx.decodeAudioData(bytes.buffer, (buf) => {
                samplesCache.set(id, buf);
                resolve(buf);
              }, () => {
                const fallbackBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
                samplesCache.set(id, fallbackBuf);
                resolve(fallbackBuf);
              });
            });
          }
        }
      } catch (e) {
        // repli
      }
    } else if (dataOrBuffer instanceof ArrayBuffer && typeof ctx.decodeAudioData === 'function') {
      return new Promise((resolve) => {
        ctx.decodeAudioData(dataOrBuffer, (buf) => {
          samplesCache.set(id, buf);
          resolve(buf);
        }, () => {
          const fallbackBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
          samplesCache.set(id, fallbackBuf);
          resolve(fallbackBuf);
        });
      });
    }
    const fallbackBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    samplesCache.set(id, fallbackBuf);
    return Promise.resolve(fallbackBuf);
  }

  function getAudioSample(id) {
    return samplesCache.get(id) || null;
  }

  function previewPreset(presetId, pitch = 'C4', duration = 0.5) {
    const preset = INSTRUMENT_PRESETS[presetId];
    if (!preset) return null;
    return scheduleNote({
      instrument: preset.type,
      preset: presetId,
      params: preset.params,
      pitch,
      duration,
      volume: 0.85
    });
  }

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

  // Synthese procedurale sfxr parametree (bruitages personnalises)
  function playSfxr(params, volume = 1, pitch = 1, atTime = null) {
    const t = (atTime != null ? atTime : ctx.currentTime) + 0.005;
    const v = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1));
    const k = typeof pitch === 'number' && pitch > 0 ? pitch : 1;

    const waveType = params.waveType || 'square';
    const baseFreq = Math.max(20, Math.min(10000, (params.baseFreq || 440) * k));
    const freqSlide = params.freqSlide || 0;
    const endFreq = Math.max(20, Math.min(12000, baseFreq * Math.pow(2, freqSlide * 3)));

    const a = Math.max(0.001, params.attack || 0.005);
    const s = Math.max(0.005, params.sustain || 0.1);
    const d = Math.max(0.005, params.decay || 0.2);
    const totalDur = a + s + d;

    const gainNode = ctx.createGain();
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(Math.max(100, params.lpf || 20000), t);

    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.setValueAtTime(Math.max(20, params.hpf || 20), t);

    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(v * 0.4 * (1 + (params.punch || 0) * 0.5), t + a);
    gainNode.gain.setValueAtTime(v * 0.4, t + a + s);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + totalDur);

    gainNode.connect(lpf);
    lpf.connect(hpf);
    hpf.connect(dest);

    if (waveType === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = getLfsrBuffer(ctx, params.shortNoise || false);
      src.loop = true;
      src.connect(gainNode);
      src.start(t);
      src.stop(t + totalDur + 0.03);
    } else {
      const osc = ctx.createOscillator();
      if (waveType === 'pulse12') osc.setPeriodicWave(getPulseWave(ctx, 0.125));
      else if (waveType === 'pulse25') osc.setPeriodicWave(getPulseWave(ctx, 0.25));
      else if (waveType === 'pulse50') osc.setPeriodicWave(getPulseWave(ctx, 0.5));
      else if (waveType === 'triangle') osc.type = 'triangle';
      else if (waveType === 'sawtooth') osc.type = 'sawtooth';
      else osc.type = 'square';

      osc.frequency.setValueAtTime(baseFreq, t);
      if (freqSlide !== 0) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + totalDur);
      }

      let vibOsc = null;
      if (params.vibratoDepth > 0) {
        vibOsc = ctx.createOscillator();
        const vibGain = ctx.createGain();
        vibOsc.type = 'sine';
        vibOsc.frequency.setValueAtTime(params.vibratoSpeed || 10, t);
        vibGain.gain.setValueAtTime(baseFreq * params.vibratoDepth * 0.3, t);
        vibOsc.connect(vibGain);
        vibGain.connect(osc.frequency);
        vibOsc.start(t);
        vibOsc.stop(t + totalDur + 0.03);
      }

      osc.connect(gainNode);
      osc.start(t);
      osc.stop(t + totalDur + 0.03);
    }

    return totalDur;
  }

  // Joue un preset sonore (jump, coin, hit...). Compatible avec l'ancienne signature synth(preset, seed, volume, pitch).
  function playSfx(preset, seed = 0, volume = 1, pitch = 1, atTime = null) {
    if (typeof preset === 'object' && preset !== null) {
      const opts = preset;
      if (opts.params) {
        return playSfxr(opts.params, opts.volume, opts.pitch, opts.atTime);
      }
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

    if (!Number.isFinite(vol) || !Number.isFinite(time)) return null;
    const isDrumInst = inst === 'noise' || inst === 'drum_machine' || inst === 'drums';
    if (!isDrumInst && (!Number.isFinite(baseFreq) || baseFreq <= 0)) return null;

    // Chaine de gain et panoramique
    const noteGain = ctx.createGain();
    let panNode = null;
    const noteDest = opts.destination || dest;
    if (typeof ctx.createStereoPanner === 'function') {
      panNode = ctx.createStereoPanner();
      panNode.pan.setValueAtTime(pan, time);
      noteGain.connect(panNode);
      panNode.connect(noteDest);
    } else {
      noteGain.connect(noteDest);
    }

    // Automatisation ADSR (valeurs non numeriques -> valeurs par defaut)
    const envNum = (v, dflt) => (Number.isFinite(v) ? v : dflt);
    const a = Math.max(0.001, envNum(env.a, 0.005));
    const d = Math.max(0.001, envNum(env.d, 0.08));
    const s = Math.max(0.0001, Math.min(1, envNum(env.s, 0.6)));
    const r = Math.max(0.001, envNum(env.r, 0.05));

    noteGain.gain.setValueAtTime(0.0001, time);
    noteGain.gain.linearRampToValueAtTime(vol * 0.5, time + a);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.5 * s), time + a + d);
    const releaseStart = time + duration;
    noteGain.gain.setValueAtTime(Math.max(0.0001, vol * 0.5 * s), releaseStart);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + r);

    const stopTime = releaseStart + r + 0.02;

    // Batterie NES speciale
    if (inst === 'noise' && opts.drumKit) {
      const piece = drumPiece(rawPitch);
      const isSnare = piece === 'snare';
      const isHatOpen = piece === 'hat_open';

      if (piece === 'kick' || piece === 'tom') {
        // Kick / tom : onde triangulaire descendante (le tom part plus haut)
        const kickOsc = ctx.createOscillator();
        kickOsc.type = 'triangle';
        kickOsc.frequency.setValueAtTime(piece === 'tom' ? 220 : 130, time);
        kickOsc.frequency.exponentialRampToValueAtTime(piece === 'tom' ? 80 : 35, time + Math.min(0.12, duration));
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

    // Synthe soustractif (2 oscillateurs, filtre, 2 enveloppes, LFO)
    if (inst === 'synth_sub' || inst === 'subtractive') {
      const presetDef = (opts.preset && INSTRUMENT_PRESETS[opts.preset]) || null;
      const subParams = Object.assign({}, presetDef?.params || {}, opts.params || opts.instParams || {});
      const osc1Cfg = Object.assign({ wave: 'saw', octave: 0, tune: 0, mix: 0.8 }, subParams.osc1 || {});
      const osc2Cfg = Object.assign({ wave: 'pulse50', octave: -1, tune: 7, mix: 0.5 }, subParams.osc2 || {});
      const filtCfg = Object.assign({ type: 'lowpass', cutoff: 2400, resonance: 2.0, envAmount: 0.5 }, subParams.filter || {});
      const envFilt = Object.assign({ a: 0.01, d: 0.2, s: 0.3, r: 0.1 }, subParams.envFilter || {});
      const lfoCfg = subParams.lfo || null;

      function createSubOsc(cfg) {
        const o = ctx.createOscillator();
        const w = cfg.wave || 'saw';
        if (w === 'pulse12') o.setPeriodicWave(getPulseWave(ctx, 0.125));
        else if (w === 'pulse25') o.setPeriodicWave(getPulseWave(ctx, 0.25));
        else if (w === 'pulse50') o.setPeriodicWave(getPulseWave(ctx, 0.5));
        else if (w === 'saw' || w === 'sawtooth') o.type = 'sawtooth';
        else if (w === 'triangle') o.type = 'triangle';
        else if (w === 'sine') o.type = 'sine';
        else o.type = 'square';

        const freq = Math.max(10, Math.min(20000, baseFreq * Math.pow(2, (cfg.octave || 0) + (cfg.tune || 0) / 1200)));
        o.frequency.setValueAtTime(freq, time);

        const og = ctx.createGain();
        og.gain.setValueAtTime(Math.max(0, Math.min(1, cfg.mix != null ? cfg.mix : 0.8)), time);
        o.connect(og);
        return { osc: o, gain: og, freq };
      }

      const o1 = createSubOsc(osc1Cfg);
      const o2 = createSubOsc(osc2Cfg);

      const filter = ctx.createBiquadFilter();
      filter.type = filtCfg.type || 'lowpass';
      const cutoff = Math.max(20, Math.min(20000, filtCfg.cutoff || 2400));
      filter.frequency.setValueAtTime(cutoff, time);
      if (filter.Q) filter.Q.setValueAtTime(Math.max(0.1, Math.min(25, filtCfg.resonance || 2.0)), time);

      if (filtCfg.envAmount && Math.abs(filtCfg.envAmount) > 0.01) {
        const fA = Math.max(0.001, envFilt.a || 0.01);
        const fD = Math.max(0.001, envFilt.d || 0.2);
        const fS = Math.max(0.0001, Math.min(1, envFilt.s != null ? envFilt.s : 0.3));
        const fR = Math.max(0.001, envFilt.r || 0.1);
        const peakCutoff = Math.max(20, Math.min(20000, cutoff * (1 + filtCfg.envAmount * 3)));
        const sustainCutoff = Math.max(20, Math.min(20000, cutoff + (peakCutoff - cutoff) * fS));
        filter.frequency.setValueAtTime(cutoff, time);
        filter.frequency.linearRampToValueAtTime(peakCutoff, time + fA);
        filter.frequency.exponentialRampToValueAtTime(sustainCutoff, time + fA + fD);
        filter.frequency.setValueAtTime(sustainCutoff, releaseStart);
        filter.frequency.exponentialRampToValueAtTime(cutoff, releaseStart + fR);
      }

      o1.gain.connect(filter);
      o2.gain.connect(filter);
      filter.connect(noteGain);

      let lfoOsc = null;
      if (lfoCfg && (lfoCfg.depth || 0) > 0) {
        lfoOsc = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfoOsc.type = 'sine';
        lfoOsc.frequency.setValueAtTime(Math.max(0.1, Math.min(40, lfoCfg.rate || 5)), time);
        if (lfoCfg.target === 'filter') {
          lfoGain.gain.setValueAtTime(cutoff * (lfoCfg.depth || 0.2), time);
          lfoOsc.connect(lfoGain);
          lfoGain.connect(filter.frequency);
        } else if (lfoCfg.target === 'amp') {
          lfoGain.gain.setValueAtTime(vol * 0.4 * (lfoCfg.depth || 0.2), time);
          lfoOsc.connect(lfoGain);
          lfoGain.connect(noteGain.gain);
        } else {
          lfoGain.gain.setValueAtTime(baseFreq * (lfoCfg.depth || 0.05), time);
          lfoOsc.connect(lfoGain);
          lfoGain.connect(o1.osc.frequency);
          lfoGain.connect(o2.osc.frequency);
        }
        lfoOsc.start(time);
        lfoOsc.stop(stopTime);
      }

      o1.osc.start(time);
      o1.osc.stop(stopTime);
      o2.osc.start(time);
      o2.osc.stop(stopTime);

      return {
        stop() {
          try { o1.osc.stop(); } catch (e) {}
          try { o2.osc.stop(); } catch (e) {}
          if (lfoOsc) { try { lfoOsc.stop(); } catch (e) {} }
        }
      };
    }

    // Synthe FM 4 operateurs (DX-style)
    if (inst === 'synth_fm' || inst === 'fm') {
      const presetDef = (opts.preset && INSTRUMENT_PRESETS[opts.preset]) || null;
      const fmParams = Object.assign({}, presetDef?.params || {}, opts.params || opts.instParams || {});
      const algo = Number(fmParams.algorithm) || 1;
      const opDefs = [
        Object.assign({ ratio: 1.0, level: 1.0, env: { a: 0.005, d: 0.3, s: 0.5, r: 0.1 } }, fmParams.op1 || {}),
        Object.assign({ ratio: 2.0, level: 0.7, env: { a: 0.005, d: 0.2, s: 0.2, r: 0.08 } }, fmParams.op2 || {}),
        Object.assign({ ratio: 1.0, level: 0.4, env: { a: 0.01, d: 0.2, s: 0.1, r: 0.05 } }, fmParams.op3 || {}),
        Object.assign({ ratio: 3.5, level: 0.2, env: { a: 0.005, d: 0.1, s: 0.05, r: 0.05 } }, fmParams.op4 || {})
      ];

      const ops = opDefs.map((def) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const opFreq = Math.max(1, baseFreq * (def.ratio || 1));
        o.frequency.setValueAtTime(opFreq, time);

        const g = ctx.createGain();
        const e = Object.assign({ a: 0.005, d: 0.2, s: 0.4, r: 0.1 }, def.env || {});
        const opLvl = Math.max(0.0001, def.level != null ? def.level : 0.5);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(opLvl, time + Math.max(0.001, e.a));
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, opLvl * (e.s != null ? e.s : 0.4)), time + Math.max(0.001, e.a) + Math.max(0.001, e.d));
        g.gain.setValueAtTime(Math.max(0.0001, opLvl * (e.s != null ? e.s : 0.4)), releaseStart);
        g.gain.exponentialRampToValueAtTime(0.0001, releaseStart + Math.max(0.001, e.r));

        o.connect(g);
        return { osc: o, gain: g, def, freq: opFreq };
      });

      function connectModulator(modIdx, carrierIdx) {
        const modGainNode = ctx.createGain();
        const modDepth = ops[carrierIdx].freq * 2.5;
        modGainNode.gain.setValueAtTime(modDepth, time);
        ops[modIdx].gain.connect(modGainNode);
        modGainNode.connect(ops[carrierIdx].osc.frequency);
      }

      if (algo === 5) {
        connectModulator(3, 0);
        connectModulator(3, 1);
        connectModulator(3, 2);
        ops[0].gain.connect(noteGain);
        ops[1].gain.connect(noteGain);
        ops[2].gain.connect(noteGain);
      } else if (algo === 4) {
        connectModulator(3, 2);
        connectModulator(1, 0);
        ops[2].gain.connect(noteGain);
        ops[0].gain.connect(noteGain);
      } else if (algo === 6) {
        ops.forEach((op) => op.gain.connect(noteGain));
      } else {
        connectModulator(3, 2);
        connectModulator(2, 1);
        connectModulator(1, 0);
        ops[0].gain.connect(noteGain);
      }

      ops.forEach((op) => {
        op.osc.start(time);
        op.osc.stop(stopTime);
      });

      return {
        stop() {
          ops.forEach((op) => {
            try { op.osc.stop(); } catch (e) {}
          });
        }
      };
    }

    // Boite a rythmes (pads proceduraux / analogiques)
    if (inst === 'drum_machine' || inst === 'drums') {
      const piece = opts.piece || drumPiece(rawPitch);
      const kit = opts.kit || (opts.params?.kit) || '808';

      if (piece === 'kick') {
        const kickOsc = ctx.createOscillator();
        kickOsc.type = 'sine';
        const startF = kit === '808' ? 160 : 130;
        const endF = kit === '808' ? 42 : 36;
        const sweepDur = Math.min(0.08, duration);
        kickOsc.frequency.setValueAtTime(startF, time);
        kickOsc.frequency.exponentialRampToValueAtTime(endF, time + sweepDur);
        kickOsc.connect(noteGain);
        kickOsc.start(time);
        kickOsc.stop(stopTime);
        return { stop: () => { try { kickOsc.stop(); } catch (e) {} } };
      }

      if (piece === 'snare') {
        const toneOsc = ctx.createOscillator();
        toneOsc.type = 'triangle';
        toneOsc.frequency.setValueAtTime(180, time);
        toneOsc.frequency.exponentialRampToValueAtTime(80, time + 0.05);

        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = getWhiteNoiseBuffer(ctx);
        noiseSrc.loop = true;

        const noiseFilt = ctx.createBiquadFilter();
        noiseFilt.type = 'bandpass';
        noiseFilt.frequency.setValueAtTime(1600, time);
        if (noiseFilt.Q) noiseFilt.Q.setValueAtTime(1.8, time);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(0.18, duration));

        toneOsc.connect(noteGain);
        noiseSrc.connect(noiseFilt);
        noiseFilt.connect(noiseGain);
        noiseGain.connect(noteGain);

        toneOsc.start(time);
        toneOsc.stop(stopTime);
        noiseSrc.start(time);
        noiseSrc.stop(stopTime);
        return {
          stop: () => {
            try { toneOsc.stop(); } catch (e) {}
            try { noiseSrc.stop(); } catch (e) {}
          }
        };
      }

      if (piece === 'hat_closed' || piece === 'hat_open') {
        const isOpen = piece === 'hat_open';
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = getWhiteNoiseBuffer(ctx);
        noiseSrc.loop = true;

        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.setValueAtTime(isOpen ? 7000 : 8500, time);

        const hatGain = ctx.createGain();
        hatGain.gain.setValueAtTime(0.6, time);
        hatGain.gain.exponentialRampToValueAtTime(0.0001, time + (isOpen ? Math.min(0.35, duration) : 0.04));

        noiseSrc.connect(hpf);
        hpf.connect(hatGain);
        hatGain.connect(noteGain);

        noiseSrc.start(time);
        noiseSrc.stop(stopTime);
        return { stop: () => { try { noiseSrc.stop(); } catch (e) {} } };
      }

      if (piece === 'tom') {
        const tomOsc = ctx.createOscillator();
        tomOsc.type = 'sine';
        const tomBase = baseFreq > 0 ? baseFreq : 140;
        tomOsc.frequency.setValueAtTime(tomBase * 1.5, time);
        tomOsc.frequency.exponentialRampToValueAtTime(tomBase * 0.7, time + Math.min(0.15, duration));
        tomOsc.connect(noteGain);
        tomOsc.start(time);
        tomOsc.stop(stopTime);
        return { stop: () => { try { tomOsc.stop(); } catch (e) {} } };
      }

      if (piece === 'clap') {
        const clapGain = ctx.createGain();
        const bpf = ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.setValueAtTime(1200, time);
        if (bpf.Q) bpf.Q.setValueAtTime(1.5, time);

        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = getWhiteNoiseBuffer(ctx);
        noiseSrc.loop = true;

        noiseSrc.connect(bpf);
        bpf.connect(clapGain);
        clapGain.connect(noteGain);

        const cDur = Math.min(0.25, duration);
        clapGain.gain.setValueAtTime(0.6, time);
        clapGain.gain.exponentialRampToValueAtTime(0.01, time + 0.01);
        clapGain.gain.setValueAtTime(0.6, time + 0.012);
        clapGain.gain.exponentialRampToValueAtTime(0.01, time + 0.022);
        clapGain.gain.setValueAtTime(0.7, time + 0.024);
        clapGain.gain.exponentialRampToValueAtTime(0.0001, time + cDur);

        noiseSrc.start(time);
        noiseSrc.stop(stopTime);
        return { stop: () => { try { noiseSrc.stop(); } catch (e) {} } };
      }

      const cymSrc = ctx.createBufferSource();
      cymSrc.buffer = getWhiteNoiseBuffer(ctx);
      cymSrc.loop = true;
      const cymFilt = ctx.createBiquadFilter();
      cymFilt.type = 'highpass';
      cymFilt.frequency.setValueAtTime(6500, time);
      const cymGain = ctx.createGain();
      cymGain.gain.setValueAtTime(0.5, time);
      cymGain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.6, duration));
      cymSrc.connect(cymFilt);
      cymFilt.connect(cymGain);
      cymGain.connect(noteGain);
      cymSrc.start(time);
      cymSrc.stop(stopTime);
      return { stop: () => { try { cymSrc.stop(); } catch (e) {} } };
    }

    // Echantillonneur (Sampler) polyphonique avec suivi de hauteur
    if (inst === 'sampler' || inst === 'sample') {
      let buf = opts.sampleBuffer || null;
      const sampleKey = opts.sampleId || opts.sample || opts.preset;
      if (!buf && sampleKey && samplesCache.has(sampleKey)) {
        buf = samplesCache.get(sampleKey);
      }
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = !!opts.loop;
        if (opts.loopStart != null) src.loopStart = opts.loopStart;
        if (opts.loopEnd != null) src.loopEnd = opts.loopEnd;
        const rootFreq = noteFreq(opts.rootPitch || 'C4') || 261.63;
        const rate = baseFreq > 0 ? (baseFreq / rootFreq) : 1;
        if (src.playbackRate) {
          src.playbackRate.setValueAtTime(Math.max(0.05, Math.min(16, rate)), time);
        }
        src.connect(noteGain);
        src.start(time);
        src.stop(stopTime);
        return { stop: () => { try { src.stop(); } catch (e) {} } };
      } else {
        const fallbackOsc = ctx.createOscillator();
        fallbackOsc.type = 'sine';
        fallbackOsc.frequency.setValueAtTime(baseFreq > 0 ? baseFreq : 440, time);
        fallbackOsc.connect(noteGain);
        fallbackOsc.start(time);
        fallbackOsc.stop(stopTime);
        return { stop: () => { try { fallbackOsc.stop(); } catch (e) {} } };
      }
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

  // Fabrication d'un noeud d'effet WebAudio natif sans dependance
  function createEffectNode(effectDef, bpm = 140) {
    const type = effectDef.type || 'filter';
    const bypass = !!effectDef.bypass;

    const inputNode = ctx.createGain();
    const outputNode = ctx.createGain();

    if (bypass) {
      inputNode.connect(outputNode);
      return {
        type,
        bypass: true,
        inputNode,
        outputNode,
        disconnect() {
          try { inputNode.disconnect(); } catch (e) {}
          try { outputNode.disconnect(); } catch (e) {}
        }
      };
    }

    const cleanups = [];

    switch (type) {
      case 'reverb': {
        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = Math.max(0, Math.min(1, effectDef.mix != null ? effectDef.mix : 0.35));
        dryGain.gain.setValueAtTime(1 - mix, ctx.currentTime);
        wetGain.gain.setValueAtTime(mix, ctx.currentTime);

        const roomSize = Math.max(0.1, Math.min(2.0, effectDef.roomSize != null ? effectDef.roomSize : 0.7));
        const damp = Math.max(0.1, Math.min(5.0, effectDef.damp != null ? effectDef.damp : 1.0));
        const len = Math.max(256, Math.floor(ctx.sampleRate * roomSize * 1.5));
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        const dL = buf.getChannelData(0);
        const dR = buf.getChannelData(1);
        for (let i = 0; i < len; i++) {
          const env = Math.exp((-i / len) * damp * 3);
          dL[i] = (Math.random() * 2 - 1) * env;
          dR[i] = (Math.random() * 2 - 1) * env;
        }

        let conv = null;
        if (typeof ctx.createConvolver === 'function') {
          conv = ctx.createConvolver();
          conv.buffer = buf;
        }

        inputNode.connect(dryGain);
        dryGain.connect(outputNode);

        if (conv) {
          inputNode.connect(conv);
          conv.connect(wetGain);
          wetGain.connect(outputNode);
          cleanups.push(() => { try { conv.disconnect(); } catch (e) {} });
        } else {
          inputNode.connect(wetGain);
          wetGain.connect(outputNode);
        }
        break;
      }

      case 'delay': {
        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = Math.max(0, Math.min(1, effectDef.mix != null ? effectDef.mix : 0.3));
        dryGain.gain.setValueAtTime(1 - mix, ctx.currentTime);
        wetGain.gain.setValueAtTime(mix, ctx.currentTime);

        let delaySec = 0.25;
        if (typeof effectDef.time === 'string' && effectDef.time.includes('/')) {
          const parts = effectDef.time.split('/');
          const num = parseFloat(parts[0]) || 1;
          const den = parseFloat(parts[1]) || 4;
          const secPerBeat = 60 / (bpm || 140);
          delaySec = (num / den) * 4 * secPerBeat;
        } else if (typeof effectDef.time === 'number') {
          delaySec = effectDef.time;
        }
        delaySec = Math.max(0.01, Math.min(3.0, delaySec));

        if (typeof ctx.createDelay === 'function') {
          const delayNode = ctx.createDelay(4.0);
          delayNode.delayTime.setValueAtTime(delaySec, ctx.currentTime);
          const fbGain = ctx.createGain();
          fbGain.gain.setValueAtTime(Math.max(0, Math.min(0.9, effectDef.feedback != null ? effectDef.feedback : 0.35)), ctx.currentTime);
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(Math.max(200, Math.min(18000, effectDef.cutoff || 4000)), ctx.currentTime);

          inputNode.connect(dryGain);
          dryGain.connect(outputNode);

          inputNode.connect(delayNode);
          delayNode.connect(filter);
          filter.connect(fbGain);
          fbGain.connect(delayNode);
          filter.connect(wetGain);
          wetGain.connect(outputNode);

          cleanups.push(() => {
            try { delayNode.disconnect(); } catch (e) {}
            try { fbGain.disconnect(); } catch (e) {}
            try { filter.disconnect(); } catch (e) {}
          });
        } else {
          inputNode.connect(outputNode);
        }
        break;
      }

      case 'eq3': {
        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.setValueAtTime(100, ctx.currentTime);
        if (low.gain) low.gain.setValueAtTime(effectDef.low || 0, ctx.currentTime);

        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.setValueAtTime(effectDef.midFreq || 1000, ctx.currentTime);
        if (mid.Q) mid.Q.setValueAtTime(1.0, ctx.currentTime);
        if (mid.gain) mid.gain.setValueAtTime(effectDef.mid || 0, ctx.currentTime);

        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.setValueAtTime(8000, ctx.currentTime);
        if (high.gain) high.gain.setValueAtTime(effectDef.high || 0, ctx.currentTime);

        inputNode.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(outputNode);

        cleanups.push(() => {
          try { low.disconnect(); } catch (e) {}
          try { mid.disconnect(); } catch (e) {}
          try { high.disconnect(); } catch (e) {}
        });
        break;
      }

      case 'compressor': {
        if (typeof ctx.createDynamicsCompressor === 'function') {
          const comp = ctx.createDynamicsCompressor();
          if (comp.threshold) comp.threshold.setValueAtTime(effectDef.threshold != null ? effectDef.threshold : -24, ctx.currentTime);
          if (comp.knee) comp.knee.setValueAtTime(effectDef.knee != null ? effectDef.knee : 30, ctx.currentTime);
          if (comp.ratio) comp.ratio.setValueAtTime(effectDef.ratio != null ? effectDef.ratio : 12, ctx.currentTime);
          if (comp.attack) comp.attack.setValueAtTime(effectDef.attack != null ? effectDef.attack : 0.003, ctx.currentTime);
          if (comp.release) comp.release.setValueAtTime(effectDef.release != null ? effectDef.release : 0.25, ctx.currentTime);

          const makeup = ctx.createGain();
          const gainVal = Math.pow(10, (effectDef.gain || 0) / 20);
          makeup.gain.setValueAtTime(gainVal, ctx.currentTime);

          inputNode.connect(comp);
          comp.connect(makeup);
          makeup.connect(outputNode);

          cleanups.push(() => {
            try { comp.disconnect(); } catch (e) {}
            try { makeup.disconnect(); } catch (e) {}
          });
        } else {
          inputNode.connect(outputNode);
        }
        break;
      }

      case 'filter': {
        const filt = ctx.createBiquadFilter();
        filt.type = effectDef.filterType || effectDef.type || 'lowpass';
        if (filt.type === 'filter') filt.type = 'lowpass';
        filt.frequency.setValueAtTime(Math.max(20, Math.min(20000, effectDef.cutoff || 2000)), ctx.currentTime);
        if (filt.Q) filt.Q.setValueAtTime(Math.max(0.1, Math.min(25, effectDef.resonance || 1.0)), ctx.currentTime);

        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = Math.max(0, Math.min(1, effectDef.mix != null ? effectDef.mix : 1.0));
        dryGain.gain.setValueAtTime(1 - mix, ctx.currentTime);
        wetGain.gain.setValueAtTime(mix, ctx.currentTime);

        inputNode.connect(dryGain);
        dryGain.connect(outputNode);

        inputNode.connect(filt);
        filt.connect(wetGain);
        wetGain.connect(outputNode);

        cleanups.push(() => {
          try { filt.disconnect(); } catch (e) {}
        });
        break;
      }

      case 'distortion': {
        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = Math.max(0, Math.min(1, effectDef.mix != null ? effectDef.mix : 0.5));
        dryGain.gain.setValueAtTime(1 - mix, ctx.currentTime);
        wetGain.gain.setValueAtTime(mix, ctx.currentTime);

        if (typeof ctx.createWaveShaper === 'function') {
          const shaper = ctx.createWaveShaper();
          const drive = Math.max(0.01, effectDef.drive != null ? effectDef.drive : 0.4);
          const nSamples = 1024;
          const curve = new Float32Array(nSamples);
          for (let i = 0; i < nSamples; i++) {
            const x = (i * 2) / nSamples - 1;
            curve[i] = Math.tanh(x * (1 + drive * 8));
          }
          shaper.curve = curve;

          inputNode.connect(dryGain);
          dryGain.connect(outputNode);

          inputNode.connect(shaper);
          shaper.connect(wetGain);
          wetGain.connect(outputNode);

          cleanups.push(() => {
            try { shaper.disconnect(); } catch (e) {}
          });
        } else {
          inputNode.connect(outputNode);
        }
        break;
      }

      case 'chorus': {
        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = Math.max(0, Math.min(1, effectDef.mix != null ? effectDef.mix : 0.4));
        dryGain.gain.setValueAtTime(1 - mix, ctx.currentTime);
        wetGain.gain.setValueAtTime(mix, ctx.currentTime);

        if (typeof ctx.createDelay === 'function') {
          const delay = ctx.createDelay(0.1);
          delay.delayTime.setValueAtTime(0.02, ctx.currentTime);
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.setValueAtTime(Math.max(0.1, Math.min(20, effectDef.rate || 1.5)), ctx.currentTime);
          lfoGain.gain.setValueAtTime(Math.min(0.008, (effectDef.depth || 0.5) * 0.004), ctx.currentTime);

          lfo.connect(lfoGain);
          lfoGain.connect(delay.delayTime);
          lfo.start(ctx.currentTime);

          inputNode.connect(dryGain);
          dryGain.connect(outputNode);

          inputNode.connect(delay);
          delay.connect(wetGain);
          wetGain.connect(outputNode);

          cleanups.push(() => {
            try { lfo.stop(); } catch (e) {}
            try { lfo.disconnect(); } catch (e) {}
            try { lfoGain.disconnect(); } catch (e) {}
            try { delay.disconnect(); } catch (e) {}
          });
        } else {
          inputNode.connect(outputNode);
        }
        break;
      }

      case 'bitcrusher': {
        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = Math.max(0, Math.min(1, effectDef.mix != null ? effectDef.mix : 0.6));
        dryGain.gain.setValueAtTime(1 - mix, ctx.currentTime);
        wetGain.gain.setValueAtTime(mix, ctx.currentTime);

        if (typeof ctx.createWaveShaper === 'function') {
          const bits = Math.max(2, Math.min(16, effectDef.bits != null ? effectDef.bits : 8));
          const steps = Math.pow(2, bits);
          const nSamples = 1024;
          const curve = new Float32Array(nSamples);
          for (let i = 0; i < nSamples; i++) {
            const x = (i * 2) / nSamples - 1;
            curve[i] = Math.round(x * steps) / steps;
          }
          const shaper = ctx.createWaveShaper();
          shaper.curve = curve;
          const lpf = ctx.createBiquadFilter();
          lpf.type = 'lowpass';
          lpf.frequency.setValueAtTime(Math.max(500, Math.min(18000, effectDef.cutoff || 6000)), ctx.currentTime);

          inputNode.connect(dryGain);
          dryGain.connect(outputNode);

          inputNode.connect(shaper);
          shaper.connect(lpf);
          lpf.connect(wetGain);
          wetGain.connect(outputNode);

          cleanups.push(() => {
            try { shaper.disconnect(); } catch (e) {}
            try { lpf.disconnect(); } catch (e) {}
          });
        } else {
          inputNode.connect(outputNode);
        }
        break;
      }

      default:
        inputNode.connect(outputNode);
    }

    return {
      type,
      inputNode,
      outputNode,
      disconnect() {
        cleanups.forEach((fn) => fn());
        try { inputNode.disconnect(); } catch (e) {}
        try { outputNode.disconnect(); } catch (e) {}
      }
    };
  }

  // Joue un morceau complet (objet song) avec planificateur d'anticipation (Two Clocks pattern)
  function playSong(song, options = {}) {
    stopSong();

    if (!song) return null;
    const bpm = Math.max(20, Math.min(300, Number(song.bpm) || 140));
    const stepsPerBeat = Math.max(1, Math.floor(Number(song.stepsPerBeat) || 4));
    // Boucle : song.loop = { enabled, start } (format du projet) ; anciens formats : booleen et song.loopStart.
    // La boucle repart de loop.start et se termine a la fin de l'arrangement.
    const loopCfg = song.loop && typeof song.loop === 'object' ? song.loop : null;
    const loop = options.loop != null ? !!options.loop : (loopCfg ? loopCfg.enabled !== false : song.loop !== false);
    const loopStartRaw = loopCfg && Number.isInteger(loopCfg.start) ? loopCfg.start : song.loopStart;
    const masterVol = options.volume != null ? options.volume : 1;
    const swing = Math.max(0, Math.min(0.5, Number(song.swing) || 0));
    const secondsPerBeat = 60 / bpm;
    const baseStepSec = secondsPerBeat / stepsPerBeat;

    const rawTracks = (song.tracks && song.tracks.length > 0) ? song.tracks : (song.channels || []);
    const channelsById = {};
    rawTracks.forEach((c) => { channelsById[c.id] = c; });
    // Solo : si au moins un canal est en solo, seuls les canaux en solo jouent
    const anySolo = rawTracks.some((c) => c.solo);

    const patternsById = {};
    (song.patterns || []).forEach((p) => { patternsById[p.id] = p; });

    // Construction de la grille d'evenements
    // Si playlist est vide mais qu'un pattern existe, on joue le premier pattern
    let playlist = song.playlist || [];
    if (playlist.length === 0 && (song.patterns || []).length > 0 && (!song.clips || song.clips.length === 0)) {
      playlist = [{ pattern: song.patterns[0].id, start: 0, track: 0 }];
    }

    const explicitEnd = typeof song.loopEnd === 'number' && song.loopEnd > 0 ? song.loopEnd : (loopCfg && Number.isInteger(loopCfg.end) && loopCfg.end > 0 ? loopCfg.end : 0);
    let maxStep = explicitEnd;
    const eventsByStep = {};

    playlist.forEach((item) => {
      const pat = patternsById[item.pattern];
      if (!pat) return;
      const startStep = item.start || 0;
      const pLen = pat.length || 16;
      if (startStep + pLen > maxStep && explicitEnd <= 0) maxStep = startStep + pLen;

      (pat.notes || []).forEach((note) => {
        const noteStep = Math.round(Number(note.step) || 0);
        if (noteStep < 0 || noteStep >= pLen) return;
        const step = startStep + noteStep;
        if (!eventsByStep[step]) eventsByStep[step] = [];
        eventsByStep[step].push({
          ch: note.ch,
          pitch: note.pitch,
          len: note.len || 1,
          vel: note.vel != null ? note.vel : 1
        });
      });
    });

    // Prise en charge des clips de notes (DAW v2)
    if (Array.isArray(song.clips)) {
      song.clips.forEach((clip) => {
        if (clip.type === 'notes' && Array.isArray(clip.notes)) {
          const startStep = clip.start || 0;
          const cLen = clip.length || 16;
          if (startStep + cLen > maxStep && explicitEnd <= 0) maxStep = startStep + cLen;
          clip.notes.forEach((note) => {
            const noteStep = Math.round(Number(note.step) || 0);
            if (noteStep < 0 || noteStep >= cLen) return;
            const step = startStep + noteStep;
            if (!eventsByStep[step]) eventsByStep[step] = [];
            eventsByStep[step].push({
              ch: clip.trackId,
              pitch: note.pitch,
              len: note.len || note.length || 1,
              vel: note.vel != null ? note.vel : (note.velocity != null ? note.velocity : 1)
            });
          });
        }
      });
    }

    if (maxStep <= 0) maxStep = 16;

    let currentStep = typeof options.startStep === 'number' ? Math.max(0, options.startStep) : 0;
    let nextStepTime = ctx.currentTime + 0.05;
    let timerId = null;
    let stopped = false;
    const activeNotes = [];

    const songGain = ctx.createGain();
    const targetVol = masterVol;
    if (options.fadeIn && options.fadeIn > 0) {
      songGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      songGain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + options.fadeIn);
    } else {
      songGain.gain.setValueAtTime(targetVol, ctx.currentTime);
    }
    songGain.connect(dest);

    // Graphe audio par piste (DAW v2) : input -> fader -> panner -> songGain
    const trackBuses = new Map();
    rawTracks.forEach((t) => {
      const input = ctx.createGain();
      input.gain.setValueAtTime(1, ctx.currentTime);

      const fader = ctx.createGain();
      const trackVol = t.volume != null ? t.volume : 0.8;
      const isMuted = t.mute || (anySolo && !t.solo);
      fader.gain.setValueAtTime(isMuted ? 0 : trackVol, ctx.currentTime);

      let panner = null;
      if (typeof ctx.createStereoPanner === 'function') {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, t.pan || 0)), ctx.currentTime);
      }

      // Construction de la chaine d'effets de la piste (input -> fx1 -> fx2 -> ... -> fader)
      const fxNodes = [];
      const effects = Array.isArray(t.effects) ? t.effects : [];
      let lastNode = input;
      effects.forEach((eff) => {
        const fxNode = createEffectNode(eff, bpm);
        lastNode.connect(fxNode.inputNode);
        lastNode = fxNode.outputNode;
        fxNodes.push(fxNode);
      });
      lastNode.connect(fader);

      if (panner) {
        fader.connect(panner);
        panner.connect(songGain);
      } else {
        fader.connect(songGain);
      }

      trackBuses.set(t.id, {
        id: t.id,
        name: t.name || t.id,
        trackDef: t,
        input,
        fader,
        panner,
        fxNodes,
        fxOutputNode: lastNode,
        volume: trackVol,
        mute: !!t.mute,
        solo: !!t.solo,
        setVolume(v, rampTime = 0) {
          this.volume = Math.max(0, Math.min(1, typeof v === 'number' ? v : 1));
          if (!this.mute && (!anySolo || this.solo)) {
            if (rampTime > 0) {
              fader.gain.cancelScheduledValues(ctx.currentTime);
              fader.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + rampTime);
            } else {
              fader.gain.setValueAtTime(this.volume, ctx.currentTime);
            }
          }
        },
        setPan(p) {
          if (panner) panner.pan.setValueAtTime(Math.max(-1, Math.min(1, typeof p === 'number' ? p : 0)), ctx.currentTime);
        },
        setMute(m) {
          this.mute = !!m;
          const active = !this.mute && (!anySolo || this.solo);
          fader.gain.setValueAtTime(active ? this.volume : 0, ctx.currentTime);
        },
        disconnect() {
          try { input.disconnect(); } catch (e) {}
          fxNodes.forEach((n) => n.disconnect());
          try { fader.disconnect(); } catch (e) {}
          try { if (panner) panner.disconnect(); } catch (e) {}
        }
      });
    });

    // Configuration des departs auxiliaires (sends) vers les autres bus de piste
    const sendNodes = [];
    rawTracks.forEach((t) => {
      const sends = Array.isArray(t.sends) ? t.sends : [];
      const sourceBus = trackBuses.get(t.id);
      if (!sourceBus || sends.length === 0) return;
      sends.forEach((snd) => {
        const destId = snd.busId || snd.targetTrackId;
        const destBus = trackBuses.get(destId);
        if (!destBus || destBus === sourceBus) return;
        const sendGain = ctx.createGain();
        const amt = Math.max(0, Math.min(1, snd.amount != null ? snd.amount : 0));
        sendGain.gain.setValueAtTime(amt, ctx.currentTime);
        sourceBus.fxOutputNode.connect(sendGain);
        sendGain.connect(destBus.input);
        sendNodes.push({
          sendGain,
          disconnect() {
            try { sendGain.disconnect(); } catch (e) {}
          }
        });
      });
    });

    const SCHEDULE_INTERVAL_MS = 25;
    const LOOKAHEAD_SEC = 0.1;

    function stepDuration(s) {
      if (swing <= 0) return baseStepSec;
      return (s % 2 === 0) ? baseStepSec * (1 + swing) : baseStepSec * (1 - swing);
    }

    const loopStartStep = Number.isInteger(loopStartRaw) && loopStartRaw >= 0 && loopStartRaw < maxStep ? loopStartRaw : 0;

    function scheduleAhead() {
      if (stopped) return;
      // Retour d'un onglet en arriere-plan (timers brides) : on reprend maintenant au lieu de rejouer les pas manques d'un coup
      if (!options.offline && nextStepTime < ctx.currentTime - 0.05) nextStepTime = ctx.currentTime + 0.02;
      // Les notes terminees ne sont plus gardees (sinon la liste grandit sans fin en boucle)
      for (let k = activeNotes.length - 1; k >= 0; k--) {
        if (activeNotes[k].end < ctx.currentTime) activeNotes.splice(k, 1);
      }
      // Hors-ligne (export WAV) : tout le morceau est planifie d'un coup, sans minuterie
      const horizon = options.offline ? Infinity : ctx.currentTime + LOOKAHEAD_SEC;
      while (nextStepTime < horizon) {
        const notesAtStep = eventsByStep[currentStep];
        if (notesAtStep && notesAtStep.length > 0) {
          notesAtStep.forEach((n) => {
            const trackBus = trackBuses.get(n.ch);
            const ch = channelsById[n.ch] || (trackBus ? trackBus.trackDef : { instrument: 'pulse50', volume: 0.8 });
            if (trackBus) {
              if (trackBus.mute || (anySolo && !trackBus.solo)) return;
            } else if (ch.mute || (anySolo && !ch.solo)) {
              return;
            }
            const dur = (Number(n.len) || 1) * baseStepSec;
            // Une note invalide ne doit pas bloquer le planificateur : elle est ignoree
            try {
              const instType = typeof ch.instrument === 'string' ? ch.instrument : (ch.instrument?.type || 'pulse50');
              const presetKey = ch.preset || ch.instrument?.preset;
              const instParams = ch.params || ch.instrument?.params || (presetKey ? INSTRUMENT_PRESETS[presetKey]?.params : null);
              const handle = scheduleNote({
                time: nextStepTime,
                duration: dur,
                instrument: instType,
                preset: presetKey,
                params: instParams,
                pitch: n.pitch,
                vel: n.vel,
                volume: trackBus ? 1.0 : (ch.volume != null ? ch.volume : 0.8),
                pan: trackBus ? 0 : (ch.pan || 0),
                env: ch.env,
                vibrato: ch.vibrato,
                arp: ch.arp,
                drumKit: ch.drumKit,
                waveTable: ch.waveTable,
                sampleId: ch.sampleId,
                rootPitch: ch.rootPitch,
                destination: trackBus ? trackBus.input : songGain
              });
              if (handle) activeNotes.push({ stop: handle.stop, end: nextStepTime + dur + 1 });
            } catch (e) { /* note ignoree */ }
          });
        }

        if (options.onBeat && currentStep % stepsPerBeat === 0) {
          try { options.onBeat(Math.floor(currentStep / stepsPerBeat)); } catch (e) { /* erreur du script : la musique continue */ }
        }

        const durThisStep = stepDuration(currentStep);
        nextStepTime += durThisStep;
        currentStep++;

        if (currentStep >= maxStep) {
          if (loop) {
            currentStep = loopStartStep;
          } else {
            stopped = true;
            clearInterval(timerId);
            timerId = null;
            // Fin naturelle : liberer la chaine audio une fois les dernieres notes jouees
            const delayToEnd = Math.max(0, (nextStepTime - ctx.currentTime) * 1000);
            setTimeout(() => {
              const current = activeSong && activeSong.controller === controller;
              setTimeout(() => {
                sendNodes.forEach((s) => s.disconnect());
                trackBuses.forEach((b) => b.disconnect());
                try { songGain.disconnect(); } catch (e) {}
              }, 1500);
              if (current) activeSong = null;
              if (current && options.onEnd) options.onEnd();
            }, delayToEnd);
            break;
          }
        }
      }
    }

    if (options.offline && loop) throw new Error('playSong : le rendu hors-ligne exige loop: false');
    if (!options.offline) timerId = setInterval(scheduleAhead, SCHEDULE_INTERVAL_MS);
    scheduleAhead();

    const controller = {
      setVolume(v, rampTime = 0) {
        const val = Math.max(0, Math.min(1, typeof v === 'number' ? v : 1));
        if (rampTime > 0) {
          songGain.gain.linearRampToValueAtTime(val, ctx.currentTime + rampTime);
        } else {
          songGain.gain.setValueAtTime(val, ctx.currentTime);
        }
      },
      setTrackVolume(trackId, v, rampTime = 0) {
        const bus = trackBuses.get(trackId);
        if (bus) bus.setVolume(v, rampTime);
      },
      setTrackPan(trackId, p) {
        const bus = trackBuses.get(trackId);
        if (bus) bus.setPan(p);
      },
      setTrackMute(trackId, m) {
        const bus = trackBuses.get(trackId);
        if (bus) bus.setMute(m);
      },
      getTrack(trackId) {
        return trackBuses.get(trackId) || null;
      },
      get tracks() {
        return Array.from(trackBuses.values());
      },
      stop(stopOpts = {}) {
        if (stopped) return;
        const fadeOut = stopOpts && stopOpts.fadeOut > 0 ? stopOpts.fadeOut : 0;
        if (fadeOut > 0) {
          songGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeOut);
          setTimeout(() => { controller.stop({ fadeOut: 0 }); }, fadeOut * 1000);
          return;
        }
        stopped = true;
        if (timerId) { clearInterval(timerId); timerId = null; }
        for (const n of activeNotes) n.stop();
        activeNotes.length = 0;
        sendNodes.forEach((s) => s.disconnect());
        trackBuses.forEach((b) => b.disconnect());
        try { songGain.disconnect(); } catch (e) {}
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

  function stopSong(opts) {
    if (activeSong) {
      activeSong.controller.stop(opts);
      if (!opts || !opts.fadeOut) activeSong = null;
    }
  }

  function setSongVolume(v, rampTime = 0) {
    if (activeSong && activeSong.controller) {
      activeSong.controller.setVolume(v, rampTime);
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
    // Meme gain maitre que l'editeur et le jeu : le WAV sonne comme l'apercu
    const offMaster = offCtx.createGain();
    offMaster.gain.value = MASTER_GAIN;
    offMaster.connect(offCtx.destination);
    const offChip = createChipAudio(offCtx, offMaster);
    offChip.playSong(song, { loop: false, volume: 1, offline: true });
    return offCtx.startRendering();
  }

  function measureSchedulingPerformance(trackCount = 16, stepCount = 64) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dummySong = {
      bpm: 140,
      tracks: Array.from({ length: trackCount }, (_, i) => ({
        id: `trk_${i}`,
        name: `Track ${i}`,
        volume: 0.8,
        instrument: 'pulse50'
      })),
      clips: Array.from({ length: trackCount }, (_, i) => ({
        trackId: `trk_${i}`,
        type: 'notes',
        start: 0,
        length: stepCount,
        notes: Array.from({ length: Math.floor(stepCount / 2) }, (__, s) => ({
          step: s * 2,
          pitch: 60 + (i % 12),
          length: 1,
          velocity: 0.8
        }))
      }))
    };
    const ctrl = playSong(dummySong, { loop: false, volume: 0 });
    if (ctrl) ctrl.stop(0);
    const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return {
      trackCount,
      stepCount,
      elapsedMs,
      ok: elapsedMs < 100
    };
  }

  return {
    playSfx,
    scheduleNote,
    playSong,
    stopSong,
    setSongVolume,
    playChiptuneTrack,
    renderOffline,
    generateSfxr,
    mutateSfxr,
    measureSchedulingPerformance,
    loadAudioSample,
    getAudioSample,
    previewPreset,
    presets: INSTRUMENT_PRESETS,
    createEffectNode: (eff, bpm) => createEffectNode(eff, bpm),
    effects: VALID_EFFECTS
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createChipAudio = createChipAudio;
  globalThis.chiptuneToSong = chiptuneToSong;
  globalThis.noteFreq = noteFreq;
}
