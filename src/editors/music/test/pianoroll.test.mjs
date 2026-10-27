import { test } from 'node:test';
import assert from 'node:assert';
import {
  midiToPitch,
  pitchToMidi,
  isBlackKey,
  SCALES,
  CHORDS,
} from '../pianoroll.js';

test('conversion MIDI et Hauteur (Pitch)', () => {
  assert.strictEqual(midiToPitch(60), 'C4');
  assert.strictEqual(midiToPitch(69), 'A4');
  assert.strictEqual(midiToPitch(72), 'C5');
  assert.strictEqual(midiToPitch(36), 'C2');

  assert.strictEqual(pitchToMidi('C4'), 60);
  assert.strictEqual(pitchToMidi('A4'), 69);
  assert.strictEqual(pitchToMidi('C5'), 72);
  assert.strictEqual(pitchToMidi('C#4'), 61);
  assert.strictEqual(pitchToMidi('Db4'), 61);

  assert.strictEqual(isBlackKey(60), false); // C
  assert.strictEqual(isBlackKey(61), true);  // C#
  assert.strictEqual(isBlackKey(62), false); // D
  assert.strictEqual(isBlackKey(63), true);  // D#
});

test('gammes et accords musicaux', () => {
  assert.ok(SCALES.major.intervals.includes(0));
  assert.ok(SCALES.major.intervals.includes(4));
  assert.ok(SCALES.major.intervals.includes(7));

  assert.ok(SCALES.minor.intervals.includes(3));
  assert.ok(SCALES.minor.intervals.includes(7));

  assert.deepStrictEqual(CHORDS.maj.semitones, [0, 4, 7]);
  assert.deepStrictEqual(CHORDS.min.semitones, [0, 3, 7]);
  assert.deepStrictEqual(CHORDS.sus4.semitones, [0, 5, 7]);
  assert.deepStrictEqual(CHORDS.sus2.semitones, [0, 2, 7]);
  assert.deepStrictEqual(CHORDS.octave.semitones, [0, 12]);
});

test('quantification des notes', () => {
  const notes = [
    { step: 1.2, len: 1.8, pitch: 'C4' },
    { step: 2.9, len: 0.9, pitch: 'E4' },
    { step: 7.1, len: 3.2, pitch: 'G4' },
  ];

  // Quantification sur grille 1/8 (2 pas)
  const q2 = 2;
  notes.forEach((n) => {
    n.step = Math.round(n.step / q2) * q2;
    n.len = Math.max(q2, Math.round(n.len / q2) * q2);
  });

  assert.strictEqual(notes[0].step, 2);
  assert.strictEqual(notes[0].len, 2);

  assert.strictEqual(notes[1].step, 2); // 2.9 arrondit a 4 ou 2 selon distance
  assert.strictEqual(notes[2].step, 8); // 7.1 arrondit a 8
  assert.strictEqual(notes[2].len, 4);  // 3.2 arrondit a 4
});

test('copier, coller et duplication relative', () => {
  const selected = [
    { pitch: 'C4', step: 4, len: 2, vel: 0.9 },
    { pitch: 'G4', step: 6, len: 1, vel: 0.8 },
  ];

  // Copier : calcul des offsets relatifs
  const minStep = Math.min(...selected.map((n) => n.step));
  const clipboard = selected.map((n) => ({
    pitch: n.pitch,
    relStep: n.step - minStep,
    len: n.len,
    vel: n.vel,
  }));

  assert.strictEqual(clipboard[0].relStep, 0);
  assert.strictEqual(clipboard[1].relStep, 2);

  // Coller au pas 10
  const pasteStep = 10;
  const pasted = clipboard.map((c) => ({
    pitch: c.pitch,
    step: pasteStep + c.relStep,
    len: c.len,
    vel: c.vel,
  }));

  assert.strictEqual(pasted[0].step, 10);
  assert.strictEqual(pasted[1].step, 12);

  // Duplication juste apres la fin de la selection (maxEnd = 7)
  const maxEnd = Math.max(...selected.map((n) => n.step + n.len));
  assert.strictEqual(maxEnd, 7);
  const duration = maxEnd - minStep;
  const duplicated = selected.map((n) => ({
    pitch: n.pitch,
    step: n.step + duration,
    len: n.len,
    vel: n.vel,
  }));

  assert.strictEqual(duplicated[0].step, 7);
  assert.strictEqual(duplicated[1].step, 9);
});

test('gestion et ajustement de velocite', () => {
  const note = { pitch: 'C4', step: 0, len: 1, vel: 0.75 };
  const clampVel = (v) => Math.max(0.05, Math.min(1.0, Math.round(v * 100) / 100));

  assert.strictEqual(clampVel(0.75), 0.75);
  assert.strictEqual(clampVel(1.5), 1.0);
  assert.strictEqual(clampVel(-0.2), 0.05);

  note.vel = clampVel(0.42);
  assert.strictEqual(note.vel, 0.42);
});
