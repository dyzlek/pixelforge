// Theme Boss / Action — Chiptune rapide et agressif en re mineur pour phases d'action intenses.
import { uid } from '../../core/project.js';

export function createBossSong() {
  const chLead = uid('ch');
  const chRhythm = uid('ch');
  const chBass = uid('ch');
  const chDrums = uid('ch');

  const pat1 = uid('pat');
  const pat2 = uid('pat');

  return {
    id: uid('sng'),
    name: 'Boss',
    bpm: 160,
    channels: [
      { id: chLead, name: 'Lead agressif', instrument: 'saw', volume: 0.8, pan: 0 },
      { id: chRhythm, name: 'Rythmique 16-bit', instrument: 'pulse25', volume: 0.6, pan: 0.2 },
      { id: chBass, name: 'Basse rapide', instrument: 'triangle', volume: 0.9, pan: 0 },
      { id: chDrums, name: 'Batterie rapide', instrument: 'noise', volume: 0.8, pan: 0, drumKit: true }
    ],
    patterns: [
      {
        id: pat1,
        name: 'Riff Boss',
        length: 16,
        notes: [
          // Lead (Riff D mineur rapide)
          { ch: chLead, step: 0, pitch: 'D5', len: 1 },
          { ch: chLead, step: 2, pitch: 'D5', len: 1 },
          { ch: chLead, step: 4, pitch: 'F5', len: 1 },
          { ch: chLead, step: 6, pitch: 'G5', len: 1 },
          { ch: chLead, step: 8, pitch: 'G#5', len: 1 },
          { ch: chLead, step: 10, pitch: 'A5', len: 2 },
          { ch: chLead, step: 13, pitch: 'F5', len: 1 },
          { ch: chLead, step: 14, pitch: 'D5', len: 2 },
          // Rythme pulse
          { ch: chRhythm, step: 0, pitch: 'D4', len: 1 },
          { ch: chRhythm, step: 2, pitch: 'D4', len: 1 },
          { ch: chRhythm, step: 4, pitch: 'D4', len: 1 },
          { ch: chRhythm, step: 6, pitch: 'D4', len: 1 },
          { ch: chRhythm, step: 8, pitch: 'F4', len: 1 },
          { ch: chRhythm, step: 10, pitch: 'F4', len: 1 },
          { ch: chRhythm, step: 12, pitch: 'G4', len: 1 },
          { ch: chRhythm, step: 14, pitch: 'A4', len: 1 },
          // Basse rapide (octaves D)
          { ch: chBass, step: 0, pitch: 'D3', len: 1 },
          { ch: chBass, step: 2, pitch: 'D2', len: 1 },
          { ch: chBass, step: 4, pitch: 'D3', len: 1 },
          { ch: chBass, step: 6, pitch: 'D2', len: 1 },
          { ch: chBass, step: 8, pitch: 'D3', len: 1 },
          { ch: chBass, step: 10, pitch: 'D2', len: 1 },
          { ch: chBass, step: 12, pitch: 'D3', len: 1 },
          { ch: chBass, step: 14, pitch: 'D2', len: 1 },
          // Drums double-time
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 2, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 6, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 10, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 14, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 1, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 3, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 5, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 7, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 9, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 11, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 13, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 15, pitch: 'A#3', len: 1 }
        ]
      },
      {
        id: pat2,
        name: 'Climax Boss',
        length: 16,
        notes: [
          // Climax ascendant
          { ch: chLead, step: 0, pitch: 'Bb5', len: 2 },
          { ch: chLead, step: 3, pitch: 'A5', len: 2 },
          { ch: chLead, step: 6, pitch: 'G5', len: 2 },
          { ch: chLead, step: 9, pitch: 'F5', len: 2 },
          { ch: chLead, step: 12, pitch: 'E5', len: 2 },
          { ch: chLead, step: 14, pitch: 'A5', len: 2 },
          // Basse
          { ch: chBass, step: 0, pitch: 'Bb2', len: 2 },
          { ch: chBass, step: 4, pitch: 'A2', len: 2 },
          { ch: chBass, step: 8, pitch: 'G2', len: 2 },
          { ch: chBass, step: 12, pitch: 'A2', len: 2 },
          // Drums
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 14, pitch: 'D3', len: 1 }
        ]
      }
    ],
    playlist: [
      { pattern: pat1, start: 0, track: 0 },
      { pattern: pat1, start: 16, track: 0 },
      { pattern: pat2, start: 32, track: 0 },
      { pattern: pat1, start: 48, track: 0 }
    ],
    loop: { enabled: true, start: 0, end: 64 }
  };
}
