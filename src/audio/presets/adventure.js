// Theme Aventure / Overworld — Chiptune entrainant et joyeux pour jeux de plateforme.
import { uid } from '../../core/project.js';

export function createAdventureSong() {
  const chLead = uid('ch');
  const chArp = uid('ch');
  const chBass = uid('ch');
  const chDrums = uid('ch');

  const pat1 = uid('pat');
  const pat2 = uid('pat');

  return {
    id: uid('sng'),
    name: 'Aventure',
    bpm: 140,
    channels: [
      { id: chLead, name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 },
      { id: chArp, name: 'Accompagnement', instrument: 'pulse25', volume: 0.6, pan: -0.3 },
      { id: chBass, name: 'Basse', instrument: 'triangle', volume: 0.9, pan: 0 },
      { id: chDrums, name: 'Batterie', instrument: 'noise', volume: 0.7, pan: 0.2, drumKit: true }
    ],
    patterns: [
      {
        id: pat1,
        name: 'Couplet A',
        length: 16,
        notes: [
          // Lead
          { ch: chLead, step: 0, pitch: 'E5', len: 1 },
          { ch: chLead, step: 2, pitch: 'E5', len: 1 },
          { ch: chLead, step: 4, pitch: 'G5', len: 2 },
          { ch: chLead, step: 8, pitch: 'C5', len: 1 },
          { ch: chLead, step: 10, pitch: 'D5', len: 1 },
          { ch: chLead, step: 12, pitch: 'E5', len: 2 },
          // Arp / Chords (C Maj -> G Maj)
          { ch: chArp, step: 0, pitch: 'C4', len: 2 },
          { ch: chArp, step: 2, pitch: 'G4', len: 2 },
          { ch: chArp, step: 4, pitch: 'C5', len: 2 },
          { ch: chArp, step: 6, pitch: 'E4', len: 2 },
          { ch: chArp, step: 8, pitch: 'G3', len: 2 },
          { ch: chArp, step: 10, pitch: 'D4', len: 2 },
          { ch: chArp, step: 12, pitch: 'G4', len: 2 },
          { ch: chArp, step: 14, pitch: 'B4', len: 2 },
          // Bass
          { ch: chBass, step: 0, pitch: 'C3', len: 2 },
          { ch: chBass, step: 4, pitch: 'E3', len: 2 },
          { ch: chBass, step: 8, pitch: 'G2', len: 2 },
          { ch: chBass, step: 12, pitch: 'B2', len: 2 },
          // Drums (Rock)
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 0, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 2, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 6, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 10, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 14, pitch: 'F#3', len: 1 }
        ]
      },
      {
        id: pat2,
        name: 'Couplet B',
        length: 16,
        notes: [
          // Lead
          { ch: chLead, step: 0, pitch: 'F5', len: 2 },
          { ch: chLead, step: 4, pitch: 'E5', len: 2 },
          { ch: chLead, step: 8, pitch: 'D5', len: 2 },
          { ch: chLead, step: 12, pitch: 'C5', len: 3 },
          // Arp (F Maj -> C Maj)
          { ch: chArp, step: 0, pitch: 'F4', len: 2 },
          { ch: chArp, step: 2, pitch: 'A4', len: 2 },
          { ch: chArp, step: 4, pitch: 'C5', len: 2 },
          { ch: chArp, step: 6, pitch: 'F4', len: 2 },
          { ch: chArp, step: 8, pitch: 'G3', len: 2 },
          { ch: chArp, step: 10, pitch: 'B3', len: 2 },
          { ch: chArp, step: 12, pitch: 'C4', len: 4 },
          // Bass
          { ch: chBass, step: 0, pitch: 'F3', len: 2 },
          { ch: chBass, step: 4, pitch: 'A2', len: 2 },
          { ch: chBass, step: 8, pitch: 'G2', len: 2 },
          { ch: chBass, step: 12, pitch: 'C3', len: 4 },
          // Drums
          { ch: chDrums, step: 0, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 0, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 2, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 4, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 6, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'C3', len: 1 },
          { ch: chDrums, step: 8, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 10, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'D3', len: 1 },
          { ch: chDrums, step: 12, pitch: 'F#3', len: 1 },
          { ch: chDrums, step: 14, pitch: 'A#3', len: 1 }
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
