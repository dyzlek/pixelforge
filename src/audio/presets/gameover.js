// Theme Defaite / Game Over — Chiptune court et melancolique en do mineur.
import { uid } from '../../core/project.js';

export function createGameOverSong() {
  const chLead = uid('ch');
  const chEcho = uid('ch');
  const chBass = uid('ch');
  const chDrums = uid('ch');

  const patSad = uid('pat');

  return {
    id: uid('sng'),
    name: 'Game Over',
    bpm: 90,
    channels: [
      { id: chLead, name: 'Lead triste', instrument: 'pulse12', volume: 0.8, pan: 0 },
      { id: chEcho, name: 'Echo pleurant', instrument: 'pulse25', volume: 0.5, pan: -0.2 },
      { id: chBass, name: 'Basse tombante', instrument: 'triangle', volume: 0.8, pan: 0 },
      { id: chDrums, name: 'Coup final', instrument: 'noise', volume: 0.6, pan: 0, drumKit: true }
    ],
    patterns: [
      {
        id: patSad,
        name: 'Chute finale',
        length: 16,
        notes: [
          // Ligne melodique descendante chromatique en do mineur
          { ch: chLead, step: 0, pitch: 'C5', len: 2 },
          { ch: chLead, step: 3, pitch: 'B4', len: 2 },
          { ch: chLead, step: 6, pitch: 'A#4', len: 2 },
          { ch: chLead, step: 9, pitch: 'A4', len: 2 },
          { ch: chLead, step: 12, pitch: 'G#4', len: 2 },
          { ch: chLead, step: 14, pitch: 'G4', len: 4 },
          // Echo en tierce mineure
          { ch: chEcho, step: 1, pitch: 'D#4', len: 2 },
          { ch: chEcho, step: 4, pitch: 'D4', len: 2 },
          { ch: chEcho, step: 7, pitch: 'C#4', len: 2 },
          { ch: chEcho, step: 10, pitch: 'C4', len: 2 },
          { ch: chEcho, step: 13, pitch: 'B3', len: 3 },
          // Basse descendante
          { ch: chBass, step: 0, pitch: 'C3', len: 3 },
          { ch: chBass, step: 3, pitch: 'B2', len: 3 },
          { ch: chBass, step: 6, pitch: 'A#2', len: 3 },
          { ch: chBass, step: 9, pitch: 'A2', len: 3 },
          { ch: chBass, step: 12, pitch: 'G#2', len: 2 },
          { ch: chBass, step: 14, pitch: 'G2', len: 4 },
          // Coup de cymbale et chute
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 0, pitch: 'A#3', len: 2 },
          { ch: chDrums, step: 14, pitch: 'D3', len: 2 }
        ]
      }
    ],
    playlist: [
      { pattern: patSad, start: 0, track: 0 }
    ],
    loop: { enabled: false, start: 0, end: 16 }
  };
}
