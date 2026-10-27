// Test unitaire du moteur audio chiptune (chip.js).
import assert from 'node:assert/strict';
import { noteFreq, chiptuneToSong, createChipAudio, PRESETS, INSTRUMENTS, MASTER_GAIN, generateSfxr, mutateSfxr, drumPiece } from '../chip.js';
import { pitchToMidi, midiToPitch, SCALES, CHORDS, isBlackKey } from '../../editors/music/pianoroll.js';
import { encodeWav } from '../wav-encoder.js';
import { parseMidi, midiToSong } from '../midi-parser.js';
import { parseSongText, songToText } from '../../../mcp/lib/song-text.js';
import { SONG_PRESETS, getSongPreset, DRUM_PATTERNS } from '../presets/index.js';

function createMockAudioContext() {
  const scheduledValues = [];
  const nodes = [];

  function createParam(defaultVal = 0) {
    return {
      value: defaultVal,
      setValueAtTime(v, t) { scheduledValues.push({ type: 'set', v, t }); },
      linearRampToValueAtTime(v, t) { scheduledValues.push({ type: 'linear', v, t }); },
      exponentialRampToValueAtTime(v, t) { scheduledValues.push({ type: 'exp', v, t }); }
    };
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
        connect() {}
      };
      nodes.push(f);
      return f;
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

// 16. Test des 6 morceaux de demonstration et 4 modeles de batterie
assert.equal(SONG_PRESETS.length, 6);
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

  // (a) Test sur les 6 morceaux de demonstration
  for (const preset of SONG_PRESETS) {
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

console.log('Tests chip.js reussis avec succes.');
