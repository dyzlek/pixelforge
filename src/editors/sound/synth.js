// Synthèse WebAudio des presets sfx.
// ATTENTION : ce code doit rester IDENTIQUE à la synthèse de src/runtime/engine.js (section « Son »,
// fonctions rng / tone / noise / synth) pour que le son de l'éditeur soit celui du jeu.
// Seule différence : le contexte audio et le gain maître (0.6 dans engine.js) sont passés en paramètres,
// ce qui permet aussi le rendu hors-ligne (OfflineAudioContext) pour la forme d'onde.

export const PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'];
export const MASTER_GAIN = 0.6;

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

const rng = (seed) => { // mulberry32
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Une note : oscillateur avec glissando f0 -> f1 et enveloppe décroissante
const tone = (ctx, type, f0, f1, t, dur, vol, dest) => {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f0), t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
};
const noise = (ctx, t, dur, vol, c0, c1, dest) => {
  if (!ctx._pfNoiseBuf) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx._pfNoiseBuf = buf;
  }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = ctx._pfNoiseBuf;
  s.loop = true;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(c0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, c1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest);
  s.start(t);
  s.stop(t + dur + 0.03);
};

// Joue un preset vers `master` ; renvoie sa durée en secondes (0 si preset inconnu)
export function synth(ctx, master, preset, seed, volume, pitch) {
  const r = rng(seed || 0);
  const vary = seed ? 1 + (r() - 0.5) * 0.2 : 1;
  const k = (num(pitch) && pitch > 0 ? pitch : 1) * vary;
  const v = Math.max(0, Math.min(1, volume));
  const t = ctx.currentTime + 0.005;
  const T = (type, f0, f1, at, dur, vol) => tone(ctx, type, f0 * k, f1 * k, t + at, dur, vol * v, master);
  const N = (at, dur, vol, c0, c1) => noise(ctx, t + at, dur, vol, c0, c1, master);
  switch (preset) {
    case 'jump': T('square', 220, 560, 0, 0.18, 0.3); return 0.2;
    case 'coin': T('square', 988, 988, 0, 0.07, 0.25); T('square', 1319, 1319, 0.07, 0.25, 0.25); return 0.35;
    case 'hit': T('sawtooth', 220, 50, 0, 0.2, 0.35); N(0, 0.12, 0.3 * v, 3000, 300); return 0.25;
    case 'powerup': [392, 523, 659, 784, 1047].forEach((f, i) => T('square', f, f, i * 0.07, 0.09, 0.22)); return 0.5;
    case 'explosion': N(0, 0.7, 0.8 * v, 2400, 80); T('sawtooth', 90, 30, 0, 0.5, 0.3); return 0.75;
    case 'laser': T('sawtooth', 1400, 180, 0, 0.22, 0.25); return 0.25;
    case 'blip': T('square', 660, 660, 0, 0.06, 0.25); return 0.08;
    case 'portal':
      T('sine', 180, 900, 0, 0.45, 0.35); T('triangle', 185, 930, 0, 0.45, 0.2); T('sine', 900, 400, 0.4, 0.2, 0.2);
      return 0.65;
    default: return 0;
  }
}
