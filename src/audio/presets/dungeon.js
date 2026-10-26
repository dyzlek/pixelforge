// Theme Donjon / Souterrain — Chiptune mysterieux et sombre en la mineur.
import { uid } from '../../core/project.js';

export function createDungeonSong() {
  const chLead = uid('ch');
  const chPluck = uid('ch');
  const chBass = uid('ch');
  const chDrums = uid('ch');

  const patMain = uid('pat');
  const patAlt = uid('pat');

  return {
    id: uid('sng'),
    name: 'Donjon',
    bpm: 110,
    channels: [
      { id: chLead, name: 'Lead sombre', instrument: 'pulse12', volume: 0.8, pan: 0 },
      { id: chPluck, name: 'Pluck echo', instrument: 'pulse25', volume: 0.5, pan: 0.3 },
      { id: chBass, name: 'Basse sourde', instrument: 'triangle', volume: 0.9, pan: 0 },
      { id: chDrums, name: 'Percussion', instrument: 'noise', volume: 0.6, pan: -0.2, drumKit: true }
    ],
    patterns: [
      {
        id: patMain,
        name: 'Ambiance Donjon',
        length: 16,
        notes: [
          // Lead mystique (A mineur)
          { ch: chLead, step: 0, pitch: 'A4', len: 3 },
          { ch: chLead, step: 4, pitch: 'C5', len: 2 },
          { ch: chLead, step: 6, pitch: 'B4', len: 2 },
          { ch: chLead, step: 8, pitch: 'E5', len: 4 },
          { ch: chLead, step: 12, pitch: 'D#5', len: 2 },
          { ch: chLead, step: 14, pitch: 'D5', len: 2 },
          // Pluck arpèges
          { ch: chPluck, step: 1, pitch: 'E4', len: 1 },
          { ch: chPluck, step: 3, pitch: 'A4', len: 1 },
          { ch: chPluck, step: 5, pitch: 'C5', len: 1 },
          { ch: chPluck, step: 9, pitch: 'G#4', len: 1 },
          { ch: chPluck, step: 11, pitch: 'B4', len: 1 },
          { ch: chPluck, step: 13, pitch: 'E5', len: 1 },
          // Basse
          { ch: chBass, step: 0, pitch: 'A2', len: 6 },
          { ch: chBass, step: 8, pitch: 'E2', len: 6 },
          // Percussion (Half-time lent)
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'F#3', len: 1 }
        ]
      },
      {
        id: patAlt,
        name: 'Tension',
        length: 16,
        notes: [
          // Lead tension
          { ch: chLead, step: 0, pitch: 'F5', len: 3 },
          { ch: chLead, step: 4, pitch: 'E5', len: 3 },
          { ch: chLead, step: 8, pitch: 'D#5', len: 3 },
          { ch: chLead, step: 12, pitch: 'E5', len: 4 },
          // Pluck
          { ch: chPluck, step: 0, pitch: 'F4', len: 2 },
          { ch: chPluck, step: 4, pitch: 'E4', len: 2 },
          { ch: chPluck, step: 8, pitch: 'B3', len: 2 },
          { ch: chPluck, step: 12, pitch: 'E4', len: 2 },
          // Basse
          { ch: chBass, step: 0, pitch: 'F2', len: 4 },
          { ch: chBass, step: 4, pitch: 'E2', len: 4 },
          { ch: chBass, step: 8, pitch: 'D2', len: 4 },
          { ch: chBass, step: 12, pitch: 'E2', len: 4 },
          // Percussion
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 14, pitch: 'A#3', len: 1 }
        ]
      }
    ],
    playlist: [
      { pattern: patMain, start: 0, track: 0 },
      { pattern: patMain, start: 16, track: 0 },
      { pattern: patAlt, start: 32, track: 0 },
      { pattern: patMain, start: 48, track: 0 }
    ],
    loop: { enabled: true, start: 0, end: 64 }
  };
}
