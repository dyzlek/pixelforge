// Theme Victoire / Niveau reussi — Fanfare heroique triomphante et festive en do majeur.
import { uid } from '../../core/project.js';

export function createVictorySong() {
  const chLead = uid('ch');
  const chHarmony = uid('ch');
  const chBass = uid('ch');
  const chDrums = uid('ch');

  const patFanfare = uid('pat');

  return {
    id: uid('sng'),
    name: 'Victoire',
    bpm: 150,
    channels: [
      { id: chLead, name: 'Trompette Lead', instrument: 'pulse50', volume: 0.9, pan: 0 },
      { id: chHarmony, name: 'Harmonie', instrument: 'pulse25', volume: 0.7, pan: -0.2 },
      { id: chBass, name: 'Basse triomphale', instrument: 'triangle', volume: 0.8, pan: 0 },
      { id: chDrums, name: 'Roulement victoire', instrument: 'noise', volume: 0.8, pan: 0.2, drumKit: true }
    ],
    patterns: [
      {
        id: patFanfare,
        name: 'Fanfare Triomphe',
        length: 16,
        notes: [
          // Fanfare triomphante
          { ch: chLead, step: 0, pitch: 'G4', len: 1 },
          { ch: chLead, step: 2, pitch: 'C5', len: 1 },
          { ch: chLead, step: 4, pitch: 'E5', len: 1 },
          { ch: chLead, step: 6, pitch: 'G5', len: 2 },
          { ch: chLead, step: 9, pitch: 'E5', len: 1 },
          { ch: chLead, step: 10, pitch: 'G5', len: 4 },
          // Harmonie tierces
          { ch: chHarmony, step: 0, pitch: 'E4', len: 1 },
          { ch: chHarmony, step: 2, pitch: 'G4', len: 1 },
          { ch: chHarmony, step: 4, pitch: 'C5', len: 1 },
          { ch: chHarmony, step: 6, pitch: 'E5', len: 2 },
          { ch: chHarmony, step: 9, pitch: 'C5', len: 1 },
          { ch: chHarmony, step: 10, pitch: 'E5', len: 4 },
          // Basse
          { ch: chBass, step: 0, pitch: 'C3', len: 2 },
          { ch: chBass, step: 4, pitch: 'G2', len: 2 },
          { ch: chBass, step: 6, pitch: 'C3', len: 2 },
          { ch: chBass, step: 10, pitch: 'C3', len: 4 },
          // Batterie roulement & frappes
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 2, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 6, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 9, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 10, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 10, pitch: 'A#3', len: 2 }
        ]
      }
    ],
    playlist: [
      { pattern: patFanfare, start: 0, track: 0 }
    ],
    loop: { enabled: false, start: 0, end: 16 }
  };
}
