// Test unitaire du moteur audio chiptune (chip.js).
import assert from 'node:assert/strict';
import { noteFreq, chiptuneToSong, createChipAudio, PRESETS, INSTRUMENTS, INSTRUMENT_PRESETS, VALID_EFFECTS, MASTER_GAIN, generateSfxr, mutateSfxr, drumPiece } from '../chip.js';
import { pitchToMidi, midiToPitch, SCALES, CHORDS, isBlackKey } from '../../editors/music/pianoroll.js';
import { encodeWav, audioBufferToDataUrl, audioBufferToWavBlob } from '../wav-encoder.js';
import { parseMidi, midiToSong } from '../midi-parser.js';
import { parseSongText, songToText } from '../../../mcp/lib/song-text.js';
import { SONG_PRESETS, getSongPreset, DRUM_PATTERNS } from '../presets/index.js';

function createMockParam(defaultVal = 0, scheduledValues = []) {
  return {
    value: defaultVal,
    setValueAtTime(v, t) { scheduledValues.push({ type: 'set', v, t }); },
    linearRampToValueAtTime(v, t) { scheduledValues.push({ type: 'linear', v, t }); },
    exponentialRampToValueAtTime(v, t) { scheduledValues.push({ type: 'exp', v, t }); },
    cancelScheduledValues(t) { scheduledValues.push({ type: 'cancel', t }); }
  };
}

function createMockAudioContext() {
  const scheduledValues = [];
  const nodes = [];

  function createParam(defaultVal = 0) {
    return createMockParam(defaultVal, scheduledValues);
  }

  const mockCtx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: { tag: 'destination' },
    createGain() {
      const g = { gain: createParam(1), connect() {}, disconnect() {} };
      nodes.push(g);
      return g;
    },
    createStereoPanner() {
      const p = { pan: createParam(0), connect() {}, disconnect() {} };
      nodes.push(p);
      return p;
    },
    createOscillator() {
      const o = {
        type: 'sine',
        frequency: createParam(440),
        setPeriodicWave() {},
        connect() {},
        start() {},
        stop() {}
      };
      nodes.push(o);
      return o;
    },
    createBufferSource() {
      const s = {
        buffer: null,
        loop: false,
        playbackRate: createParam(1),
        connect() {},
        start() {},
        stop() {}
      };
      nodes.push(s);
      return s;
    },
    createBiquadFilter() {
      const f = {
        type: 'lowpass',
        frequency: createParam(350),
        Q: createParam(1),
        gain: createParam(0),
        connect() {},
        disconnect() {}
      };
      nodes.push(f);
      return f;
    },
    createDelay(max = 1) {
      const d = { delayTime: createParam(0), connect() {}, disconnect() {} };
      nodes.push(d);
      return d;
    },
    createWaveShaper() {
      const ws = { curve: null, oversample: 'none', connect() {}, disconnect() {} };
      nodes.push(ws);
      return ws;
    },
    createDynamicsCompressor() {
      const c = {
        threshold: createParam(-24),
        knee: createParam(30),
        ratio: createParam(12),
        attack: createParam(0.003),
        release: createParam(0.25),
        reduction: 0,
        connect() {},
        disconnect() {}
      };
      nodes.push(c);
      return c;
    },
    createConvolver() {
      const cv = { buffer: null, normalize: true, connect() {}, disconnect() {} };
      nodes.push(cv);
      return cv;
    },
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate: rate,
        getChannelData: () => data
      };
    },
    createPeriodicWave() {
      return { tag: 'PeriodicWave' };
    },
    decodeAudioData(buffer, success) {
      const b = this.createBuffer(1, 4410, 44100);
      if (success) success(b);
      return Promise.resolve(b);
    }
  };

  return { mockCtx, nodes, scheduledValues };
}

// 1. Constantes de base
assert.equal(MASTER_GAIN, 0.6);
assert.equal(PRESETS.length, 8);
assert.ok(INSTRUMENTS.includes('pulse12'));
assert.ok(INSTRUMENTS.includes('pulse25'));
assert.ok(INSTRUMENTS.includes('pulse50'));

// 2. Calculs de frequence (noteFreq)
assert.equal(Math.round(noteFreq('A4')), 440);
assert.equal(Math.round(noteFreq('A3')), 220);
assert.equal(Math.round(noteFreq('C4')), 262);
assert.equal(Math.round(noteFreq(69)), 440);
assert.equal(noteFreq(440), 440);
assert.equal(noteFreq('-'), 0);
assert.equal(noteFreq(''), 0);
assert.equal(noteFreq(null), 0);

// 3. Conversion chiptune vers song
const legacyTrack = {
  bpm: 150,
  notes: ['C4', 'E4', 'G4', 'C5'],
  durations: [1, 1, 1, 2]
};
const converted = chiptuneToSong(legacyTrack);
assert.equal(converted.bpm, 150);
assert.equal(converted.channels.length, 1);
assert.equal(converted.channels[0].instrument, 'pulse50');
assert.equal(converted.patterns.length, 1);
assert.equal(converted.patterns[0].notes.length, 4);
assert.equal(converted.patterns[0].length, 5); // 1 + 1 + 1 + 2

// 4. Creation du moteur audio chiptune
const { mockCtx } = createMockAudioContext();
const chip = createChipAudio(mockCtx);

assert.ok(typeof chip.playSfx === 'function');
assert.ok(typeof chip.scheduleNote === 'function');
assert.ok(typeof chip.playSong === 'function');
assert.ok(typeof chip.stopSong === 'function');
assert.ok(typeof chip.playChiptuneTrack === 'function');
assert.ok(typeof chip.renderOffline === 'function');

// 5. Presets sonores (durees et declenchements)
assert.equal(chip.playSfx('jump'), 0.2);
assert.equal(chip.playSfx('coin'), 0.35);
assert.equal(chip.playSfx('hit'), 0.25);
assert.equal(chip.playSfx('powerup'), 0.5);
assert.equal(chip.playSfx('explosion'), 0.75);
assert.equal(chip.playSfx('laser'), 0.25);
assert.equal(chip.playSfx('blip'), 0.08);
assert.equal(chip.playSfx('portal'), 0.65);
assert.equal(chip.playSfx('inconnu'), 0);

// Options object
assert.equal(chip.playSfx({ preset: 'jump', volume: 0.5 }), 0.2);

// 6. Planification de notes
const notePulse = chip.scheduleNote({ instrument: 'pulse25', pitch: 'C4', duration: 0.2 });
assert.ok(notePulse);
notePulse.stop();

const noteNoise = chip.scheduleNote({ instrument: 'noise', duration: 0.1 });
assert.ok(noteNoise);
noteNoise.stop();

const noteDrum = chip.scheduleNote({ instrument: 'noise', drumKit: true, pitch: 'kick', duration: 0.1 });
assert.ok(noteDrum);
noteDrum.stop();

// 7. Lecture de morceau complet
const song = {
  id: 'test_song',
  name: 'Test',
  bpm: 120,
  stepsPerBeat: 4,
  loop: false,
  channels: [
    { id: 'lead', name: 'Lead', instrument: 'pulse50', volume: 0.8 }
  ],
  patterns: [
    {
      id: 'p1',
      name: 'P1',
      length: 16,
      notes: [
        { ch: 'lead', step: 0, pitch: 'C4', len: 2 },
        { ch: 'lead', step: 4, pitch: 'E4', len: 2 }
      ]
    }
  ],
  playlist: [
    { pattern: 'p1', start: 0, track: 0 }
  ]
};

const ctrl = chip.playSong(song, { loop: false });
assert.ok(ctrl);
assert.equal(typeof ctrl.stop, 'function');
assert.equal(typeof ctrl.getCurrentStep, 'function');
assert.equal(typeof ctrl.isPlaying, 'function');
assert.equal(ctrl.isPlaying(), true);
ctrl.stop();
assert.equal(ctrl.isPlaying(), false);

chip.stopSong();

// 8. Test de pattern de batterie chiptune a 180 BPM
const drumSong = {
  id: 'drum_song',
  name: 'Drum Test',
  bpm: 180,
  stepsPerBeat: 4,
  loop: false,
  channels: [
    { id: 'drums', name: 'Batterie', instrument: 'noise', drumKit: true, volume: 0.9 }
  ],
  patterns: [
    {
      id: 'p_drums',
      name: 'Beat 180',
      length: 16,
      notes: [
        { ch: 'drums', step: 0, pitch: 'kick', len: 1 },
        { ch: 'drums', step: 4, pitch: 'snare', len: 1 },
        { ch: 'drums', step: 8, pitch: 'kick', len: 1 },
        { ch: 'drums', step: 12, pitch: 'snare', len: 1 },
        { ch: 'drums', step: 2, pitch: 'hat_closed', len: 1 },
        { ch: 'drums', step: 6, pitch: 'hat_closed', len: 1 },
        { ch: 'drums', step: 10, pitch: 'hat_closed', len: 1 },
        { ch: 'drums', step: 14, pitch: 'hat_open', len: 1 }
      ]
    }
  ],
  playlist: [
    { pattern: 'p_drums', start: 0, track: 0 }
  ]
};

const drumCtrl = chip.playSong(drumSong, { loop: false });
assert.ok(drumCtrl);
assert.equal(drumCtrl.isPlaying(), true);
drumCtrl.stop();
assert.equal(drumCtrl.isPlaying(), false);

// 9. Test des utilitaires Piano Roll (conversions MIDI, gammes et accords)
assert.equal(pitchToMidi('C4'), 60);
assert.equal(pitchToMidi('A4'), 69);
assert.equal(pitchToMidi('C3'), 48);
assert.equal(pitchToMidi('C#4'), 61);
assert.equal(pitchToMidi(60), 60);

assert.equal(midiToPitch(60), 'C4');
assert.equal(midiToPitch(69), 'A4');
assert.equal(midiToPitch(61), 'C#4');

assert.equal(isBlackKey(60), false); // C4 = blanche
assert.equal(isBlackKey(61), true);  // C#4 = noire
assert.equal(isBlackKey(62), false); // D4 = blanche
assert.equal(isBlackKey(63), true);  // D#4 = noire

// Gammes musicales
assert.equal(SCALES.major.intervals.length, 7);
assert.equal(SCALES.minor.intervals.length, 7);
assert.equal(SCALES.pentatonic_major.intervals.length, 5);
assert.equal(SCALES.blues.intervals.length, 6);

// Accords
assert.deepEqual(CHORDS.maj.semitones, [0, 4, 7]);
assert.deepEqual(CHORDS.min.semitones, [0, 3, 7]);
assert.deepEqual(CHORDS.maj7.semitones, [0, 4, 7, 11]);

// 10. Test d'arrangement Playlist et marqueurs de boucle (Intro -> Boucle)
const arrangedSong = {
  id: 'arranged_song',
  name: 'Arrangement Test',
  bpm: 140,
  stepsPerBeat: 4,
  loop: true,
  loopStart: 16, // Boucle a partir du pas 16 (apres l'intro 0..15)
  channels: [
    { id: 'lead', name: 'Lead', instrument: 'pulse50', volume: 0.8 }
  ],
  patterns: [
    { id: 'intro', name: 'Intro', length: 16, notes: [{ ch: 'lead', step: 0, pitch: 'C4', len: 4 }] },
    { id: 'couplet', name: 'Couplet', length: 16, notes: [{ ch: 'lead', step: 0, pitch: 'E4', len: 4 }] }
  ],
  playlist: [
    { pattern: 'intro', start: 0, track: 0 },
    { pattern: 'couplet', start: 16, track: 0 }
  ]
};

const arrangeCtrl = chip.playSong(arrangedSong, { loop: true, startStep: 16 });
assert.ok(arrangeCtrl);
assert.equal(arrangeCtrl.isPlaying(), true);
arrangeCtrl.stop();
assert.equal(arrangeCtrl.isPlaying(), false);

// 11. Test de l'encodeur WAV PCM 16-bit
const mockBuffer = {
  numberOfChannels: 2,
  sampleRate: 44100,
  length: 100,
  getChannelData: () => new Float32Array(100)
};
const wavBytes = encodeWav(mockBuffer);
assert.ok(wavBytes instanceof Uint8Array);
assert.equal(wavBytes.length, 44 + 100 * 2 * 2); // 44 header + 400 data
const headerStr = String.fromCharCode(...wavBytes.slice(0, 4)) + String.fromCharCode(...wavBytes.slice(8, 12));
assert.equal(headerStr, 'RIFFWAVE');

// 12. Test du parseur Standard MIDI et conversion en morceau PixelForge
// Construction d'un fichier SMF minimal valide en memoire : Format 0, 1 piste, 480 ticks/beat
const smfBytes = [
  // MThd
  0x4D, 0x54, 0x68, 0x64, // 'MThd'
  0x00, 0x00, 0x00, 0x06, // length = 6
  0x00, 0x00,             // format 0
  0x00, 0x01,             // 1 track
  0x01, 0xE0,             // division = 480
  // MTrk
  0x4D, 0x54, 0x72, 0x6B, // 'MTrk'
  0x00, 0x00, 0x00, 0x1B, // chunk length = 27 octets
  // Delta 0, Tempo Meta (120 BPM = 500000 us/beat -> 0x07A120)
  0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20,
  // Delta 0, Note On: Ch 0, Note 60 (C4), Vel 100
  0x00, 0x90, 0x3C, 0x64,
  // Delta 480 (1 beat = 4 pas), Note Off: Ch 0, Note 60, Vel 0
  0x83, 0x60, 0x80, 0x3C, 0x00,
  // Delta 0, End of track
  0x00, 0xFF, 0x2F, 0x00
];

const midiArrayBuffer = new Uint8Array(smfBytes).buffer;
const parsedMidi = parseMidi(midiArrayBuffer);
assert.equal(parsedMidi.numTracks, 1);
assert.equal(parsedMidi.bpm, 120);

const convertedMidiSong = midiToSong(midiArrayBuffer, 'Test MIDI');
assert.equal(convertedMidiSong.name, 'Test MIDI');
assert.equal(convertedMidiSong.bpm, 120);
assert.equal(convertedMidiSong.channels.length, 1);
assert.equal(convertedMidiSong.patterns[0].notes.length, 1);
assert.equal(convertedMidiSong.patterns[0].notes[0].pitch, 'C4');
assert.equal(convertedMidiSong.patterns[0].notes[0].len, 4);

// 13. Test du generateur procedural sfxr et mutation
const types = ['coin', 'laser', 'explosion', 'powerup', 'hit', 'jump', 'blip', 'random'];
for (const t of types) {
  const p = generateSfxr(t, 42);
  assert.ok(p.waveType);
  assert.ok(p.baseFreq > 0);
  assert.ok(p.attack >= 0);
  assert.ok(p.sustain >= 0);
  assert.ok(p.decay >= 0);
}

const orig = generateSfxr('coin', 123);
const mutated = mutateSfxr(orig, 456);
assert.notDeepEqual(orig, mutated);
assert.ok(mutated.baseFreq > 0);
assert.ok(mutated.decay > 0);

// Test de synthese procedurale playSfx({ params })
const { mockCtx: sfxCtx } = createMockAudioContext();
const chipSfx = createChipAudio(sfxCtx);
const dur = chipSfx.playSfx({ params: orig });
assert.ok(dur > 0);

// 14. Test de la notation tracker ASCII (parseSongText / songToText)
const sampleTrackerText = `
BPM 150
CHANNELS
  Lead: pulse25, vol 0.8
  Bass: triangle, vol 0.9
  Drums: noise, drumKit

PATTERN Melody 16
00 | C4 | C3 | kick
04 | E4 | G3 | snare
08 | G4 | C3 | kick
12 | B4 | G3 | snare

PLAYLIST
  Track0: Melody Melody
`;

const parsedSong = parseSongText(sampleTrackerText, 'TrackerTune');
assert.equal(parsedSong.name, 'TrackerTune');
assert.equal(parsedSong.bpm, 150);
assert.equal(parsedSong.channels.length, 3);
assert.equal(parsedSong.channels[0].name, 'Lead');
assert.equal(parsedSong.channels[0].instrument, 'pulse25');
assert.equal(parsedSong.channels[2].drumKit, true);
assert.equal(parsedSong.patterns.length, 1);
assert.equal(parsedSong.patterns[0].name, 'Melody');
assert.equal(parsedSong.patterns[0].notes.length, 12);
assert.equal(parsedSong.playlist.length, 2);

const generatedText = songToText(parsedSong);
assert.ok(generatedText.includes('BPM 150'));
assert.ok(generatedText.includes('CHANNELS'));
assert.ok(generatedText.includes('PATTERN Melody 16'));
assert.ok(generatedText.includes('PLAYLIST'));

// 15. Test de chip.playSong avec callbacks onBeat et fadeIn/fadeOut
const { mockCtx: songCtx } = createMockAudioContext();
const chipSong = createChipAudio(songCtx);
let beatCount = 0;
const songCtrl = chipSong.playSong(parsedSong, {
  fadeIn: 0.5,
  onBeat: (b) => { beatCount++; }
});
assert.ok(songCtrl);
assert.equal(typeof songCtrl.stop, 'function');
assert.equal(typeof songCtrl.setVolume, 'function');
assert.ok(songCtrl.isPlaying());
songCtrl.setVolume(0.5);
songCtrl.stop({ fadeOut: 0.1 });

// 16. Test des 7 morceaux de demonstration et 4 modeles de batterie
assert.equal(SONG_PRESETS.length, 7);
for (const p of SONG_PRESETS) {
  const song = p.create();
  assert.ok(song.id);
  assert.ok(song.name);
  assert.ok(song.bpm > 60 && song.bpm < 200);
  assert.ok(song.channels.length >= 3);
  assert.ok(song.patterns.length >= 1);
  assert.ok(song.playlist.length >= 1);
  // Verification de lecture sans erreur dans le mock audio
  const ctrl = chipSong.playSong(song);
  assert.ok(ctrl);
  ctrl.stop();
}

const drumIds = ['rock8bit', 'discoRetro', 'march', 'halfTime'];
for (const id of drumIds) {
  const dp = DRUM_PATTERNS[id];
  assert.ok(dp);
  assert.ok(dp.name);
  assert.ok(dp.notes.length >= 4);
}

// Batterie : piece choisie par le nom, sinon par la classe de hauteur (C3 kick, D3 snare, F#3 hat ferme, A#3 hat ouvert)
assert.equal(drumPiece('C3'), 'kick');
assert.equal(drumPiece('D3'), 'snare');
assert.equal(drumPiece('F#3'), 'hat_closed');
assert.equal(drumPiece('A#3'), 'hat_open');
assert.equal(drumPiece('snare'), 'snare');
assert.equal(drumPiece('hat_open'), 'hat_open');
assert.equal(drumPiece(38), 'snare', 'numero MIDI General MIDI 38 = caisse claire');

// Planification hors-ligne : tout le morceau d'un coup, solo respecte, note invalide ignoree sans bloquer
{
  const { mockCtx, nodes } = createMockAudioContext();
  const chip = createChipAudio(mockCtx, mockCtx.destination);
  const song = {
    bpm: 120, stepsPerBeat: 4, loop: { enabled: false, start: 0 },
    channels: [
      { id: 'a', instrument: 'pulse50', volume: 0.8 },
      { id: 'b', instrument: 'triangle', volume: 0.8, solo: true },
    ],
    patterns: [{ id: 'p', length: 8, notes: [
      { step: 0, ch: 'a', pitch: 'C4' }, { step: 1, ch: 'b', pitch: 'E4' },
      { step: 2, ch: 'b', pitch: Number.NaN }, { step: 3, ch: 'b', pitch: 'G4', env: { a: 'x' } },
      { step: 20, ch: 'b', pitch: 'C5' },
    ] }],
    playlist: [{ pattern: 'p', start: 0, track: 0 }],
  };
  const before = nodes.filter((n) => n.frequency && n.setPeriodicWave).length;
  chip.playSong(song, { loop: false, offline: true });
  const oscs = nodes.filter((n) => n.frequency && n.setPeriodicWave).length - before;
  assert.equal(oscs, 2, 'seules les 2 notes valides du canal solo sont jouees (obtenu ' + oscs + ')');
  assert.throws(() => chip.playSong(song, { loop: true, offline: true }), /hors-ligne/);
}

// Boucle au format du projet : loop.enabled = false arrete le morceau, loop.start est le point de reprise
{
  const { mockCtx } = createMockAudioContext();
  const chip = createChipAudio(mockCtx, mockCtx.destination);
  const ctrl = chip.playSong({ bpm: 120, loop: { enabled: true, start: 4 }, channels: [], patterns: [{ id: 'p', length: 8, notes: [] }], playlist: [{ pattern: 'p', start: 0 }] });
  mockCtx.currentTime = 10; // simule un long temps de lecture puis un tick
  ctrl.stop();
  assert.ok(!ctrl.isPlaying());
}

// 17. Aller-retour texte <-> musique MCP sans perte (Issue #62, point B-8)
{
  function canonicalize(song) {
    const chMap = new Map();
    const patMap = new Map();
    song.channels.forEach((ch, i) => chMap.set(ch.id, 'ch_' + i));
    song.patterns.forEach((pat, i) => patMap.set(pat.id, 'pat_' + i));

    return {
      name: song.name,
      bpm: song.bpm,
      ...(song.swing != null ? { swing: song.swing } : {}),
      loop: song.loop ? { enabled: song.loop.enabled !== false, start: song.loop.start || 0, ...(song.loop.end != null ? { end: song.loop.end } : {}) } : undefined,
      channels: song.channels.map((ch, i) => {
        const copy = {
          ...ch,
          id: 'ch_' + i,
          mute: !!ch.mute,
          solo: !!ch.solo,
          drumKit: !!ch.drumKit,
        };
        for (const k of Object.keys(copy)) {
          if (copy[k] === undefined) delete copy[k];
        }
        return copy;
      }),
      patterns: song.patterns.map((pat, i) => ({
        name: pat.name,
        length: pat.length,
        notes: (pat.notes || [])
          .map((n) => {
            const copy = { ...n, ch: chMap.get(n.ch) || n.ch, len: n.len != null ? n.len : 1 };
            if (n.vel != null && n.vel !== 1) copy.vel = n.vel;
            else delete copy.vel;
            for (const k of Object.keys(copy)) {
              if (copy[k] === undefined) delete copy[k];
            }
            return copy;
          })
          .sort((a, b) => a.step - b.step || a.ch.localeCompare(b.ch) || a.pitch.localeCompare(b.pitch))
      })),
      playlist: (song.playlist || []).map((it) => ({
        pattern: patMap.get(it.pattern) || it.pattern,
        track: it.track || 0,
        start: it.start || 0
      })).sort((a, b) => (a.track || 0) - (b.track || 0) || a.start - b.start)
    };
  }

  // (a) Test sur les 6 morceaux de demonstration chiptune tracker
  for (const preset of SONG_PRESETS.filter((p) => p.id !== 'epic_2min')) {
    const original = preset.create();
    const text = songToText(original);
    const parsed = parseSongText(text, original.name);
    assert.deepStrictEqual(canonicalize(parsed), canonicalize(original), 'Aller-retour sans perte sur preset ' + preset.name);
  }

  // (b) Test sur un morceau complet personnalise
  const customSong = {
    name: 'Theme Mystique & Épique',
    bpm: 145,
    swing: 0.25,
    loop: { enabled: true, start: 8, end: 48 },
    channels: [
      {
        id: 'c1',
        name: 'Synthé Éthéré',
        instrument: 'pulse25',
        volume: 0.75,
        pan: -0.4,
        env: { a: 0.02, d: 0.2, s: 0.5, r: 0.3 },
        vibrato: { depth: 0.3, rate: 5 },
        arp: [0, 4, 7, 12]
      },
      {
        id: 'c2',
        name: 'Basse Custom Wave',
        instrument: 'wave',
        volume: 0.9,
        pan: 0,
        mute: true,
        solo: false,
        waveTable: [0, 0.5, 1, 0.5, 0, -0.5, -1, -0.5]
      },
      {
        id: 'c3',
        name: 'Batterie Solo',
        instrument: 'noise',
        volume: 0.85,
        pan: 0.1,
        drumKit: true,
        solo: true
      }
    ],
    patterns: [
      {
        id: 'pt1',
        name: 'Pattern Intro 1',
        length: 16,
        notes: [
          { ch: 'c1', step: 0, pitch: 'C4', len: 4, vel: 0.8 },
          { ch: 'c1', step: 0, pitch: 'G4', len: 4, vel: 0.7 },
          { ch: 'c2', step: 0, pitch: 'C2', len: 8 },
          { ch: 'c3', step: 0, pitch: 'kick', len: 1 },
          { ch: 'c3', step: 0, pitch: 'hat_closed', len: 1, vel: 0.5 },
          { ch: 'c3', step: 4, pitch: 'snare', len: 1 }
        ]
      }
    ],
    playlist: [
      { pattern: 'pt1', track: 0, start: 0 },
      { pattern: 'pt1', track: 0, start: 24 },
      { pattern: 'pt1', track: 1, start: 8 }
    ]
  };

  const customText = songToText(customSong);
  const parsedCustom = parseSongText(customText);
  assert.deepStrictEqual(canonicalize(parsedCustom), canonicalize(customSong), 'Aller-retour sans perte sur morceau personnalise');

  // (c) Retrocompatibilite : textes anciens sans guillemets, sans @, sans loop
  const legacyText = 'BPM 120\nCHANNELS\n  Lead: pulse50\n  Bass: triangle\nPATTERN Main 16\n00 | C4 | C3\n04 | E4 | G3\nPLAYLIST\n  Track0: Main Main';
  const parsedLegacy = parseSongText(legacyText, 'Legacy');
  assert.equal(parsedLegacy.name, 'Legacy');
  assert.equal(parsedLegacy.bpm, 120);
  assert.equal(parsedLegacy.channels.length, 2);
  assert.equal(parsedLegacy.channels[0].name, 'Lead');
  assert.equal(parsedLegacy.patterns.length, 1);
  assert.equal(parsedLegacy.patterns[0].notes.length, 4);
  assert.equal(parsedLegacy.playlist.length, 2);
  assert.equal(parsedLegacy.playlist[0].start, 0);
  assert.equal(parsedLegacy.playlist[1].start, 16);
}

// 18. Moteur audio v2 : pistes, bus et planificateur DAW (Issue #81, G1)
{
  const { mockCtx } = createMockAudioContext();
  const audio = createChipAudio(mockCtx);

  // (a) Test de mesure de performance et latence sur 16 pistes
  const perf = audio.measureSchedulingPerformance(16, 64);
  assert.equal(perf.trackCount, 16, 'Doit tester 16 pistes');
  assert.equal(perf.stepCount, 64, 'Doit tester 64 pas');
  assert.ok(perf.ok, `Performance de planification 16 pistes acceptable (${perf.elapsedMs}ms)`);

  // (b) Test de routage de bus de pistes avec controle dynamique du volume/pan/mute
  const multiTrackSong = {
    bpm: 120,
    tracks: [
      { id: 't1', name: 'Lead', volume: 0.8, pan: -0.5, instrument: 'pulse50' },
      { id: 't2', name: 'Bass', volume: 0.7, pan: 0.5, instrument: 'triangle' },
    ],
    clips: [
      {
        trackId: 't1',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [
          { step: 0, pitch: 'C4', length: 4, velocity: 0.9 },
          { step: 4, pitch: 'E4', length: 4, velocity: 0.9 }
        ]
      },
      {
        trackId: 't2',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [
          { step: 0, pitch: 'C2', length: 8, velocity: 0.8 }
        ]
      }
    ]
  };

  const ctrl = audio.playSong(multiTrackSong, { loop: false, volume: 1 });
  assert.ok(ctrl, 'playSong doit renvoyer un controleur actif');
  assert.equal(ctrl.tracks.length, 2, 'Doit instancier 2 bus de pistes');

  const t1 = ctrl.getTrack('t1');
  assert.ok(t1, 'Piste t1 accessible par id');
  assert.equal(t1.volume, 0.8);

  ctrl.setTrackVolume('t1', 0.5);
  assert.equal(t1.volume, 0.5);

  ctrl.setTrackMute('t1', true);
  assert.equal(t1.mute, true);

  ctrl.setTrackMute('t1', false);
  assert.equal(t1.mute, false);

  ctrl.setTrackPan('t1', 0.2);
  ctrl.stop(0);

  // (c) Test de normalisation bidirectionnelle dans normalizeProject
  const { normalizeProject } = await import('../../core/project.js');
  const projLegacy = {
    name: 'Legacy Project',
    songs: [{
      id: 's1',
      name: 'Song 1',
      channels: [{ id: 'ch1', name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 }],
      patterns: [{ id: 'p1', name: 'P1', length: 16, notes: [] }]
    }]
  };
  normalizeProject(projLegacy);
  assert.ok(Array.isArray(projLegacy.songs[0].tracks), 'tracks[] doit etre cree a partir de channels[]');
  assert.equal(projLegacy.songs[0].tracks.length, 1);
  assert.equal(projLegacy.songs[0].tracks[0].id, 'ch1');
  assert.equal(projLegacy.songs[0].tracks[0].name, 'Lead');
}

// 19. Instruments DAW v2 et banque de prereglages (Issue #82, G2)
{
  const { mockCtx, nodes } = createMockAudioContext();
  const audio = createChipAudio(mockCtx);

  // (a) Presence des instruments et des prereglages
  const dawInstruments = ['synth_sub', 'synth_fm', 'drum_machine', 'sampler'];
  for (const inst of dawInstruments) {
    assert.ok(INSTRUMENTS.includes(inst), `INSTRUMENTS doit inclure ${inst}`);
  }

  const expectedCategories = ['bass', 'lead', 'pad', 'keys', 'strings', 'drums'];
  const presentCategories = new Set(Object.values(INSTRUMENT_PRESETS).map((p) => p.category));
  for (const cat of expectedCategories) {
    assert.ok(presentCategories.has(cat), `La banque de prereglages doit contenir la categorie ${cat}`);
  }

  // (b) Synthe soustractif (synth_sub) avec 2 oscillateurs, filtre resonant et LFO
  const subHandle = audio.scheduleNote({
    instrument: 'synth_sub',
    pitch: 'A2',
    duration: 0.4,
    volume: 0.8,
    preset: 'bass_808'
  });
  assert.ok(subHandle && typeof subHandle.stop === 'function', 'synth_sub doit renvoyer un handle avec stop()');
  subHandle.stop();

  // (c) Synthe FM 4 operateurs (synth_fm) avec algorithmes 1 et 5
  const fmHandle1 = audio.scheduleNote({
    instrument: 'synth_fm',
    pitch: 'C4',
    duration: 0.5,
    volume: 0.85,
    preset: 'bass_fm'
  });
  assert.ok(fmHandle1 && typeof fmHandle1.stop === 'function', 'synth_fm algo 1 doit fonctionner');
  fmHandle1.stop();

  const fmHandle5 = audio.scheduleNote({
    instrument: 'synth_fm',
    pitch: 'E4',
    duration: 0.5,
    volume: 0.85,
    preset: 'piano_vintage'
  });
  assert.ok(fmHandle5 && typeof fmHandle5.stop === 'function', 'synth_fm algo 5 (piano) doit fonctionner');
  fmHandle5.stop();

  // (d) Boite a rythmes (drum_machine) pour toutes les pieces
  const drumPieces = ['kick', 'snare', 'hat_closed', 'hat_open', 'tom', 'clap', 'cymbal'];
  for (const piece of drumPieces) {
    const handle = audio.scheduleNote({
      instrument: 'drum_machine',
      pitch: piece,
      duration: 0.2,
      volume: 0.9,
      kit: '808'
    });
    assert.ok(handle && typeof handle.stop === 'function', `drum_machine doit synthetiser ${piece}`);
    handle.stop();
  }

  // (e) Sampler polyphonique avec suivi de hauteur et cache
  const sampleBuf = mockCtx.createBuffer(1, 4410, 44100);
  await audio.loadAudioSample('snare_sample', sampleBuf);
  assert.equal(audio.getAudioSample('snare_sample'), sampleBuf, 'loadAudioSample doit mettre en cache le buffer');

  const samplerHandle = audio.scheduleNote({
    instrument: 'sampler',
    sampleId: 'snare_sample',
    pitch: 'G4',
    duration: 0.3,
    rootPitch: 'C4'
  });
  assert.ok(samplerHandle && typeof samplerHandle.stop === 'function', 'sampler doit jouer un echantillon');
  samplerHandle.stop();

  // Repli gracieux pour un echantillon absent
  const fallbackHandle = audio.scheduleNote({
    instrument: 'sampler',
    sampleId: 'missing_sample',
    pitch: 'A4',
    duration: 0.2
  });
  assert.ok(fallbackHandle && typeof fallbackHandle.stop === 'function', 'sampler repli sine');
  fallbackHandle.stop();

  // (f) Audition en 1-clic via previewPreset
  for (const presetKey of Object.keys(INSTRUMENT_PRESETS)) {
    const handle = audio.previewPreset(presetKey);
    assert.ok(handle && typeof handle.stop === 'function', `previewPreset(${presetKey}) doit fonctionner`);
    handle.stop();
  }

  // (g) Lecture d'un morceau complet integrant les 4 nouveaux instruments DAW v2
  const dawSong = {
    bpm: 125,
    tracks: [
      { id: 'sub', name: 'Basse Sub', instrument: 'synth_sub', preset: 'bass_synth', volume: 0.8 },
      { id: 'fm', name: 'Keys FM', instrument: 'synth_fm', preset: 'piano_vintage', volume: 0.75 },
      { id: 'drums', name: 'Rythmes 808', instrument: 'drum_machine', kit: '808', volume: 0.9 },
      { id: 'smp', name: 'Sampleur', instrument: 'sampler', sampleId: 'snare_sample', volume: 0.7 }
    ],
    clips: [
      {
        trackId: 'sub',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [{ step: 0, pitch: 'A2', length: 4 }, { step: 4, pitch: 'C3', length: 4 }]
      },
      {
        trackId: 'fm',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [{ step: 0, pitch: 'A4', length: 8 }, { step: 8, pitch: 'E4', length: 8 }]
      },
      {
        trackId: 'drums',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [
          { step: 0, pitch: 'kick', length: 1 },
          { step: 4, pitch: 'snare', length: 1 },
          { step: 8, pitch: 'clap', length: 1 }
        ]
      },
      {
        trackId: 'smp',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [{ step: 2, pitch: 'C4', length: 2 }]
      }
    ]
  };

  const ctrl = audio.playSong(dawSong, { loop: false, volume: 1 });
  assert.ok(ctrl, 'playSong doit jouer le morceau DAW v2 sans erreur');
  assert.equal(ctrl.tracks.length, 4, 'Doit instancier les 4 pistes');
  ctrl.stop(0);
}

// 20. Effets audio par piste et departs auxiliaires (sends) (Issue #83, G3)
{
  const { mockCtx, nodes } = createMockAudioContext();
  const audio = createChipAudio(mockCtx);

  // (a) Verification de la liste des 8 effets valides
  const expectedEffects = ['reverb', 'delay', 'eq3', 'compressor', 'filter', 'distortion', 'chorus', 'bitcrusher'];
  assert.equal(VALID_EFFECTS.length, 8, '8 effets doivent etre definis');
  for (const fxType of expectedEffects) {
    assert.ok(VALID_EFFECTS.includes(fxType), `VALID_EFFECTS doit contenir ${fxType}`);
  }

  // (b) Instanciation unitaire de chacun des 8 effets
  for (const fxType of expectedEffects) {
    const fxNode = audio.createEffectNode({ type: fxType, mix: 0.5 });
    assert.ok(fxNode && fxNode.inputNode && fxNode.outputNode, `L'effet ${fxType} doit posseder inputNode et outputNode`);
    assert.equal(typeof fxNode.disconnect, 'function');
    fxNode.disconnect();
  }

  // Mode Bypass
  const bypassNode = audio.createEffectNode({ type: 'reverb', bypass: true });
  assert.ok(bypassNode.bypass, 'Le mode bypass doit etre pris en compte');
  bypassNode.disconnect();

  // (c) Routage dans playSong avec chaine d'effets et departs auxiliaires (sends)
  const songWithEffectsAndSends = {
    bpm: 130,
    tracks: [
      {
        id: 't_lead',
        name: 'Lead Synth',
        instrument: 'synth_sub',
        volume: 0.8,
        effects: [
          { type: 'distortion', drive: 0.4, mix: 0.3 },
          { type: 'delay', time: '1/8', feedback: 0.4, mix: 0.35 }
        ],
        sends: [
          { busId: 't_aux_reverb', amount: 0.45 }
        ]
      },
      {
        id: 't_aux_reverb',
        name: 'Aux Reverb',
        instrument: 'pulse50',
        volume: 0.7,
        effects: [
          { type: 'reverb', roomSize: 1.2, damp: 0.8, mix: 1.0 }
        ]
      }
    ],
    clips: [
      {
        trackId: 't_lead',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [{ step: 0, pitch: 'C4', length: 4 }]
      }
    ]
  };

  const ctrl = audio.playSong(songWithEffectsAndSends, { loop: false, volume: 1 });
  assert.ok(ctrl, 'playSong doit instancier le morceau avec effets et sends');
  assert.equal(ctrl.tracks.length, 2, 'Doit instancier 2 bus de pistes');

  const leadBus = ctrl.getTrack('t_lead');
  assert.ok(leadBus, 'Bus lead accessible');
  assert.equal(leadBus.fxNodes.length, 2, 'Lead doit posseder 2 noeuds d effets dans sa chaine');

  const auxBus = ctrl.getTrack('t_aux_reverb');
  assert.ok(auxBus, 'Bus aux reverb accessible');
  assert.equal(auxBus.fxNodes.length, 1, 'Aux Reverb doit posseder 1 effet dans sa chaine');

  ctrl.stop(0);
}

// ----------------------------------------------------
// Tests DAW v2 Timeline & Morceau Odyssee 2 min (G4)
// ----------------------------------------------------
{
  const epicPreset = getSongPreset('epic_2min');
  assert.ok(epicPreset, 'Preset epic_2min doit etre accessible');
  assert.equal(epicPreset.bpm, 120, 'BPM doit etre a 120');
  assert.deepEqual(epicPreset.timeSignature, [4, 4], 'Signature doit etre [4, 4]');
  assert.equal(epicPreset.tracks.length, 5, 'Doit comporter 5 pistes');
  assert.equal(epicPreset.clips.length, 5, 'Doit comporter 5 clips DAW v2');
  assert.equal(epicPreset.markers.length, 5, 'Doit comporter 5 marqueurs temporels');

  const markerNames = epicPreset.markers.map((m) => m.name);
  assert.ok(markerNames.includes('Intro'), 'Doit inclure Intro');
  assert.ok(markerNames.includes('Couplet 1'), 'Doit inclure Couplet 1');
  assert.ok(markerNames.includes('Refrain'), 'Doit inclure Refrain');
  assert.ok(markerNames.includes('Pont'), 'Doit inclure Pont');
  assert.ok(markerNames.includes('Fin'), 'Doit inclure Fin');

  // Duree totale 960 pas = 60 mesures = 120 secondes a 120 BPM
  const maxClipStep = Math.max(...epicPreset.clips.map((c) => c.start + c.length));
  assert.equal(maxClipStep, 960, 'Arrangement doit durer exactement 960 pas (120 secondes)');

  const { mockCtx: epicCtx } = createMockAudioContext();
  const audio = createChipAudio(epicCtx);
  const ctrl = audio.playSong(epicPreset, { loop: false, volume: 1 });
  assert.ok(ctrl, 'playSong doit instancier le morceau de 2 minutes');
  assert.equal(ctrl.tracks.length, 5, 'Doit instancier 5 bus de piste');
  ctrl.stop(0);
}

// ----------------------------------------------------
// Tests DAW v2 Automation des Parametres (G6)
// ----------------------------------------------------
{
  const { mockCtx, scheduledValues } = createMockAudioContext();
  const audio = createChipAudio(mockCtx);

  const automatedSong = {
    bpm: 120,
    tracks: [
      {
        id: 'trk_lead',
        name: 'Lead',
        volume: 0.8,
        pan: 0,
        instrument: 'synth_sub',
        effects: [
          {
            id: 'fx_filter',
            type: 'filter',
            filterType: 'lowpass',
            cutoff: 400,
            resonance: 2.0
          }
        ]
      }
    ],
    clips: [
      {
        id: 'clip_lead',
        trackId: 'trk_lead',
        type: 'notes',
        start: 0,
        length: 128,
        notes: [
          { step: 0, pitch: 'C4', len: 4 }
        ]
      }
    ],
    automation: [
      {
        id: 'auto_filter_sweep',
        trackId: 'trk_lead',
        target: 'filter.cutoff',
        points: [
          { step: 0, value: 400 },
          { step: 128, value: 8000 }
        ]
      },
      {
        id: 'auto_vol',
        trackId: 'trk_lead',
        target: 'volume',
        points: [
          { step: 0, value: 0.2 },
          { step: 64, value: 0.9 }
        ]
      }
    ],
    loop: { enabled: false, start: 0, end: 128 }
  };

  const ctrl = audio.playSong(automatedSong, { loop: false, volume: 1 });
  assert.ok(ctrl, 'playSong doit instancier le morceau avec automation');

  // Verification de la resolution des parametres AudioParam
  const cutoffParam = ctrl.resolveAudioParam('trk_lead', 'filter.cutoff');
  assert.ok(cutoffParam, 'Parametre filter.cutoff doit etre resolu');
  const volParam = ctrl.resolveAudioParam('trk_lead', 'volume');
  assert.ok(volParam, 'Parametre volume doit etre resolu');
  const panParam = ctrl.resolveAudioParam('trk_lead', 'pan');
  assert.ok(panParam, 'Parametre pan doit etre resolu');

  // Verification des valeurs planifiees pour le filtre sur 8 mesures (128 pas)
  const filterSets = scheduledValues.filter((s) => s.type === 'set' && s.v === 400);
  assert.ok(filterSets.length > 0, 'La valeur initiale de filtre 400 Hz doit etre planifiee');

  const filterRamps = scheduledValues.filter((s) => s.type === 'linear' && s.v === 8000);
  assert.ok(filterRamps.length > 0, 'La rampe d ouverture de filtre a 8000 Hz sur 8 mesures (128 pas) doit etre planifiee');
  assert.equal(Math.round(filterRamps[0].t * 10) / 10, 16.0, 'Le temps de la rampe 8 mesures a 120 BPM doit valoir 16.0 secondes');

  // Verification de la rampe de volume
  const volRamps = scheduledValues.filter((s) => s.type === 'linear' && s.v === 0.9);
  assert.ok(volRamps.length > 0, 'La rampe de volume doit etre planifiee');

  ctrl.stop(0);

  // Test de rendu hors-ligne (renderOffline) et export WAV
  const origWindow = globalThis.window;
  class MockOfflineAudioContext {
    constructor(channels, length, sampleRate) {
      this.channels = channels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.currentTime = 0;
      this.destination = { tag: 'destination' };
      this.nodes = [];
    }
    createGain() {
      return { gain: createMockParam(1), connect() {}, disconnect() {} };
    }
    createBiquadFilter() {
      return { frequency: createMockParam(350), Q: createMockParam(1), gain: createMockParam(0), connect() {}, disconnect() {} };
    }
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data };
    }
    startRendering() {
      return Promise.resolve(this.createBuffer(this.channels, this.length, this.sampleRate));
    }
  }
  globalThis.window = { OfflineAudioContext: MockOfflineAudioContext };
  try {
    const renderedBuf = await audio.renderOffline(automatedSong);
    assert.ok(renderedBuf, 'renderOffline doit produire un AudioBuffer avec automation');
    const wavBytes = encodeWav(renderedBuf);
    assert.ok(wavBytes instanceof Uint8Array, 'encodeWav doit exporter le WAV avec automation');
  } finally {
    globalThis.window = origWindow;
  }
}

// 24. Mixeur, enregistrement micro, exports stems et import MIDI General MIDI (Issue #87, G7)
{
  const { mockCtx } = createMockAudioContext();
  const audio = createChipAudio(mockCtx);

  // (a) Construction et verification d'un flux MIDI General MIDI synthetique
  // Format 0, 1 piste, 96 ticks par noire
  // Tempo 1 : 120 BPM (500 000 us/noire) a tick 0
  // Tempo 2 : 140 BPM (428 571 us/noire) a tick 96
  // Canal 0 (melodique) : Note 60 (C4)
  // Canal 9 (General MIDI canal 10 = batterie) : Note 36 (kick), 38 (snare), 42 (closed hat), 46 (open hat)
  const trackBytes = [
    // Tick 0 : Set Tempo 120 BPM (0x07A120 = 500000)
    0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20,
    // Tick 0 : NoteOn canal 0, note 60, vel 100
    0x00, 0x90, 0x3C, 0x64,
    // Delta 24 : NoteOff canal 0, note 60
    0x18, 0x80, 0x3C, 0x40,
    // Delta 0 : NoteOn canal 9 (batterie GM), note 36 (kick), vel 110
    0x00, 0x99, 0x24, 0x6E,
    // Delta 24 : NoteOff canal 9, note 36
    0x18, 0x89, 0x24, 0x00,
    // Delta 0 : NoteOn canal 9, note 38 (snare), vel 100
    0x00, 0x99, 0x26, 0x64,
    // Delta 24 : NoteOff canal 9, note 38
    0x18, 0x89, 0x26, 0x00,
    // Delta 24 : NoteOn canal 9, note 42 (hat closed), vel 90
    0x18, 0x99, 0x2A, 0x5A,
    // Delta 0 : Set Tempo 140 BPM (0x068A2B = 428571) a tick 96
    0x00, 0xFF, 0x51, 0x03, 0x06, 0x8A, 0x2B,
    // Delta 24 : NoteOff canal 9, note 42
    0x18, 0x89, 0x2A, 0x00,
    // Delta 0 : NoteOn canal 9, note 46 (hat open), vel 90
    0x00, 0x99, 0x2E, 0x5A,
    // Delta 24 : NoteOff canal 9, note 46
    0x18, 0x89, 0x2E, 0x00,
    // Fin de piste
    0x00, 0xFF, 0x2F, 0x00
  ];

  const headerBytes = [
    // MThd
    0x4D, 0x54, 0x68, 0x64,
    // Longueur en-tete = 6
    0x00, 0x00, 0x00, 0x06,
    // Format 0
    0x00, 0x00,
    // 1 piste
    0x00, 0x01,
    // Division 96 ticks / noire
    0x00, 0x60,
    // MTrk
    0x4D, 0x54, 0x72, 0x6B,
    // Longueur de piste
    (trackBytes.length >> 24) & 0xFF,
    (trackBytes.length >> 16) & 0xFF,
    (trackBytes.length >> 8) & 0xFF,
    trackBytes.length & 0xFF
  ];

  const midiBuf = new Uint8Array([...headerBytes, ...trackBytes]).buffer;

  // Analyse et conversion MIDI
  const parsed = parseMidi(midiBuf);
  assert.equal(parsed.format, 0, 'Format MIDI doit valoir 0');
  assert.equal(parsed.division, 96, 'Division temporelle doit valoir 96');
  assert.ok(parsed.tempoChanges.length >= 2, 'Doit detecter les changements de tempo');
  assert.equal(parsed.tempoChanges[0].bpm, 120, 'Premier tempo doit valoir 120');
  assert.equal(parsed.tempoChanges[1].bpm, 140, 'Deuxieme tempo doit valoir 140');

  const songFromMidi = midiToSong(midiBuf, 'Theme General MIDI');
  assert.equal(songFromMidi.name, 'Theme General MIDI');
  assert.ok(songFromMidi.tempoChanges.length >= 2, 'Song doit enregistrer les changements de tempo');

  // Verification que le canal 9 (Canal 10 en base 1) est mappe a la batterie
  const drumTrack = songFromMidi.tracks.find((t) => t.drumKit === true);
  assert.ok(drumTrack, 'Une piste batterie drumKit doit etre presente');
  assert.equal(drumTrack.instrument, 'drum_machine', 'Instrument de batterie doit etre drum_machine');

  const drumClip = songFromMidi.clips.find((c) => c.trackId === drumTrack.id);
  assert.ok(drumClip, 'Un clip de notes doit exister pour la batterie');
  const drumPitches = drumClip.notes.map((n) => n.pitch);
  assert.ok(drumPitches.includes('kick'), 'Doit mapper note 36 en kick');
  assert.ok(drumPitches.includes('snare'), 'Doit mapper note 38 en snare');
  assert.ok(drumPitches.includes('hat_closed'), 'Doit mapper note 42 en hat_closed');
  assert.ok(drumPitches.includes('hat_open'), 'Doit mapper note 46 en hat_open');

  // (b) Test de routage de sous-bus (outputBusId) et vumetres temps-reel
  const busSong = {
    bpm: 120,
    tracks: [
      { id: 'trk_master_sub', name: 'Drums Bus', volume: 0.9, pan: 0, outputBusId: 'master' },
      { id: 'trk_sub_child', name: 'Snare Track', volume: 0.8, pan: 0.2, outputBusId: 'trk_master_sub' }
    ],
    clips: [
      {
        trackId: 'trk_sub_child',
        type: 'notes',
        start: 0,
        length: 16,
        notes: [{ step: 0, pitch: 'D4', length: 2, velocity: 0.8 }]
      }
    ]
  };

  const ctrlBus = audio.playSong(busSong, { loop: false, volume: 1 });
  assert.ok(ctrlBus, 'Controleur de bus instancie');
  assert.equal(typeof ctrlBus.getTrackLevel, 'function', 'getTrackLevel doit etre expose sur le controleur');
  assert.equal(typeof audio.getTrackLevel, 'function', 'getTrackLevel doit etre expose sur chipAudio');

  // Niveaux initiaux
  const masterLvl = ctrlBus.getTrackLevel('master');
  assert.equal(typeof masterLvl, 'number', 'getTrackLevel master renvoie un nombre');
  const trkLvl = ctrlBus.getTrackLevel('trk_sub_child');
  assert.equal(typeof trkLvl, 'number', 'getTrackLevel piste renvoie un nombre');

  ctrlBus.stop(0);

  // (c) Test de rendu offline des pistes isolees (Stems) et encodage WAV
  const origWindow = globalThis.window;
  class MockOfflineAudioContext {
    constructor(channels, length, sampleRate) {
      this.channels = channels;
      this.length = length;
      this.sampleRate = sampleRate;
      this.currentTime = 0;
      this.destination = { tag: 'destination' };
      this.nodes = [];
    }
    createGain() {
      return { gain: createMockParam(1), connect() {}, disconnect() {} };
    }
    createStereoPanner() {
      return { pan: createMockParam(0), connect() {}, disconnect() {} };
    }
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => data };
    }
    startRendering() {
      return Promise.resolve(this.createBuffer(this.channels, this.length, this.sampleRate));
    }
  }
  globalThis.window = { OfflineAudioContext: MockOfflineAudioContext };
  try {
    const stemBuf = await audio.renderStemOffline(busSong, 'trk_sub_child');
    assert.ok(stemBuf, 'renderStemOffline doit produire un AudioBuffer pour la piste');
    const stemWav = encodeWav(stemBuf);
    assert.ok(stemWav instanceof Uint8Array, 'encodeWav doit exporter le stem WAV');

    const dataUrl = audioBufferToDataUrl(stemBuf);
    assert.ok(dataUrl.startsWith('data:audio/wav;base64,'), 'audioBufferToDataUrl doit produire un data URL WAV base64');
  } finally {
    globalThis.window = origWindow;
  }
}

console.log('Tests chip.js reussis avec succes.');
