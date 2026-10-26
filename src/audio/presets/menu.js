// Theme Menu / Ecran titre — Chiptune melodieux, chaleureux et accueillant en fa majeur.
import { uid } from '../../core/project.js';

export function createMenuSong() {
  const chLead = uid('ch');
  const chChords = uid('ch');
  const chBass = uid('ch');
  const chDrums = uid('ch');

  const pat1 = uid('pat');
  const pat2 = uid('pat');

  return {
    id: uid('sng'),
    name: 'Menu Principal',
    bpm: 120,
    channels: [
      { id: chLead, name: 'Melodie douce', instrument: 'pulse25', volume: 0.7, pan: 0 },
      { id: chChords, name: 'Accords calmes', instrument: 'pulse12', volume: 0.5, pan: -0.2 },
      { id: chBass, name: 'Basse ronde', instrument: 'triangle', volume: 0.8, pan: 0 },
      { id: chDrums, name: 'Balais batterie', instrument: 'noise', volume: 0.5, pan: 0.2, drumKit: true }
    ],
    patterns: [
      {
        id: pat1,
        name: 'Accueil A',
        length: 16,
        notes: [
          // Melodie F majeur
          { ch: chLead, step: 0, pitch: 'F4', len: 2 },
          { ch: chLead, step: 2, pitch: 'A4', len: 2 },
          { ch: chLead, step: 4, pitch: 'C5', len: 3 },
          { ch: chLead, step: 8, pitch: 'D5', len: 2 },
          { ch: chLead, step: 10, pitch: 'C5', len: 2 },
          { ch: chLead, step: 12, pitch: 'A4', len: 2 },
          { ch: chLead, step: 14, pitch: 'G4', len: 2 },
          // Accords
          { ch: chChords, step: 0, pitch: 'A3', len: 4 },
          { ch: chChords, step: 4, pitch: 'C4', len: 4 },
          { ch: chChords, step: 8, pitch: 'Bb3', len: 4 },
          { ch: chChords, step: 12, pitch: 'C4', len: 4 },
          // Basse
          { ch: chBass, step: 0, pitch: 'F3', len: 4 },
          { ch: chBass, step: 4, pitch: 'C3', len: 4 },
          { ch: chBass, step: 8, pitch: 'Bb2', len: 4 },
          { ch: chBass, step: 12, pitch: 'C3', len: 4 },
          // Batterie douce
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'F#3', len: 1 }
        ]
      },
      {
        id: pat2,
        name: 'Accueil B',
        length: 16,
        notes: [
          // Melodie variation
          { ch: chLead, step: 0, pitch: 'Bb4', len: 2 },
          { ch: chLead, step: 2, pitch: 'D5', len: 2 },
          { ch: chLead, step: 4, pitch: 'F5', len: 3 },
          { ch: chLead, step: 8, pitch: 'E5', len: 2 },
          { ch: chLead, step: 10, pitch: 'D5', len: 2 },
          { ch: chLead, step: 12, pitch: 'C5', len: 4 },
          // Basse
          { ch: chBass, step: 0, pitch: 'Bb2', len: 4 },
          { ch: chBass, step: 4, pitch: 'D3', len: 4 },
          { ch: chBass, step: 8, pitch: 'C3', len: 4 },
          { ch: chBass, step: 12, pitch: 'F3', len: 4 },
          // Drums
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'F#3', len: 1 }
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
