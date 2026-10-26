// Test unitaire du moteur audio chiptune (chip.js).
import assert from 'node:assert/strict';
import { noteFreq, chiptuneToSong, createChipAudio, PRESETS, INSTRUMENTS, MASTER_GAIN } from '../chip.js';
import { pitchToMidi, midiToPitch, SCALES, CHORDS, isBlackKey } from '../../editors/music/pianoroll.js';

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

console.log('Tests chip.js reussis avec succes.');
