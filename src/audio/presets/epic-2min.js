// Morceau de demonstration de 2 minutes PixelForge (DAW v2 Timeline)
// Structure : Intro (16s) -> Couplet 1 (32s) -> Refrain (32s) -> Pont (24s) -> Fin (16s) = 120 secondes a 120 BPM
import { uid } from '../../core/project.js';

export function createEpic2MinSong() {
  const bpm = 120;
  // A 120 BPM avec 4 pas par temps : 1 pas = 0.125s, 16 pas (1 mesure) = 2.0s
  // 60 mesures = 960 pas = 120 secondes (2 minutes)

  const chLead = {
    id: 'ch_lead',
    name: 'Lead Synth',
    instrument: 'synth_sub',
    preset: 'lead_retro',
    volume: 0.85,
    pan: -0.2,
    mute: false,
    solo: false,
    effects: [
      { type: 'distortion', drive: 0.35, mix: 0.25 },
      { type: 'delay', time: '3/16', feedback: 0.35, mix: 0.3 }
    ],
    sends: [{ busId: 'ch_pad', amount: 0.2 }]
  };

  const chPad = {
    id: 'ch_pad',
    name: 'Nappe Espace',
    instrument: 'synth_sub',
    preset: 'pad_warm',
    volume: 0.75,
    pan: 0.2,
    mute: false,
    solo: false,
    effects: [
      { type: 'chorus', rate: 1.2, depth: 0.6, mix: 0.4 },
      { type: 'reverb', roomSize: 1.2, damp: 0.8, mix: 0.45 }
    ]
  };

  const chBass = {
    id: 'ch_bass',
    name: 'Basse 808',
    instrument: 'synth_sub',
    preset: 'bass_808',
    volume: 0.9,
    pan: 0,
    mute: false,
    solo: false,
    effects: [
      { type: 'compressor', threshold: -18, ratio: 4, gain: 2 }
    ]
  };

  const chKeys = {
    id: 'ch_keys',
    name: 'Piano FM',
    instrument: 'synth_fm',
    preset: 'piano_vintage',
    volume: 0.8,
    pan: -0.15,
    mute: false,
    solo: false,
    effects: [
      { type: 'eq3', low: -2, mid: 2, high: 1 }
    ]
  };

  const chDrums = {
    id: 'ch_drums',
    name: 'Batterie 808',
    instrument: 'drum_machine',
    kit: '808',
    volume: 0.95,
    pan: 0,
    drumKit: true,
    mute: false,
    solo: false,
    effects: [
      { type: 'bitcrusher', bits: 12, cutoff: 12000, mix: 0.2 }
    ]
  };

  const channels = [chLead, chPad, chBass, chKeys, chDrums];

  // 1. Patterns musicaux
  // Pattern 1 : Intro Arpege (16 pas)
  const patIntro = {
    id: 'pat_intro',
    name: 'Intro Arpege',
    length: 16,
    notes: [
      { ch: 'ch_lead', step: 0, pitch: 'A4', len: 2, vel: 0.8 },
      { ch: 'ch_lead', step: 4, pitch: 'C5', len: 2, vel: 0.85 },
      { ch: 'ch_lead', step: 8, pitch: 'E5', len: 2, vel: 0.9 },
      { ch: 'ch_lead', step: 12, pitch: 'A5', len: 2, vel: 0.8 },
      { ch: 'ch_pad', step: 0, pitch: 'A3', len: 16, vel: 0.7 }
    ]
  };

  // Pattern 2 : Couplet Rythmique & Basse (16 pas)
  const patCouplet = {
    id: 'pat_couplet',
    name: 'Couplet Theme',
    length: 16,
    notes: [
      { ch: 'ch_bass', step: 0, pitch: 'A2', len: 4, vel: 0.9 },
      { ch: 'ch_bass', step: 6, pitch: 'G2', len: 2, vel: 0.85 },
      { ch: 'ch_bass', step: 8, pitch: 'F2', len: 4, vel: 0.9 },
      { ch: 'ch_bass', step: 14, pitch: 'G2', len: 2, vel: 0.85 },
      { ch: 'ch_keys', step: 0, pitch: 'C4', len: 4, vel: 0.75 },
      { ch: 'ch_keys', step: 8, pitch: 'E4', len: 4, vel: 0.75 },
      { ch: 'ch_drums', step: 0, pitch: 'kick', len: 1, vel: 0.95 },
      { ch: 'ch_drums', step: 4, pitch: 'snare', len: 1, vel: 0.9 },
      { ch: 'ch_drums', step: 8, pitch: 'kick', len: 1, vel: 0.95 },
      { ch: 'ch_drums', step: 12, pitch: 'snare', len: 1, vel: 0.9 },
      { ch: 'ch_drums', step: 2, pitch: 'hat_closed', len: 1, vel: 0.6 },
      { ch: 'ch_drums', step: 6, pitch: 'hat_closed', len: 1, vel: 0.6 },
      { ch: 'ch_drums', step: 10, pitch: 'hat_closed', len: 1, vel: 0.6 },
      { ch: 'ch_drums', step: 14, pitch: 'hat_open', len: 1, vel: 0.7 }
    ]
  };

  // Pattern 3 : Refrain Epique Polyphonique (16 pas)
  const patRefrain = {
    id: 'pat_refrain',
    name: 'Refrain Epique',
    length: 16,
    notes: [
      { ch: 'ch_lead', step: 0, pitch: 'E5', len: 4, vel: 0.95 },
      { ch: 'ch_lead', step: 4, pitch: 'G5', len: 4, vel: 0.95 },
      { ch: 'ch_lead', step: 8, pitch: 'F5', len: 4, vel: 0.95 },
      { ch: 'ch_lead', step: 12, pitch: 'D5', len: 4, vel: 0.9 },
      { ch: 'ch_pad', step: 0, pitch: 'C4', len: 16, vel: 0.85 },
      { ch: 'ch_bass', step: 0, pitch: 'C3', len: 8, vel: 0.95 },
      { ch: 'ch_bass', step: 8, pitch: 'G2', len: 8, vel: 0.95 },
      { ch: 'ch_drums', step: 0, pitch: 'kick', len: 1, vel: 1.0 },
      { ch: 'ch_drums', step: 4, pitch: 'clap', len: 1, vel: 0.95 },
      { ch: 'ch_drums', step: 8, pitch: 'kick', len: 1, vel: 1.0 },
      { ch: 'ch_drums', step: 10, pitch: 'kick', len: 1, vel: 0.85 },
      { ch: 'ch_drums', step: 12, pitch: 'clap', len: 1, vel: 0.95 },
      { ch: 'ch_drums', step: 14, pitch: 'cymbal', len: 2, vel: 0.7 }
    ]
  };

  // Pattern 4 : Pont Atmospherique (16 pas)
  const patPont = {
    id: 'pat_pont',
    name: 'Pont Mystique',
    length: 16,
    notes: [
      { ch: 'ch_keys', step: 0, pitch: 'D4', len: 8, vel: 0.8 },
      { ch: 'ch_keys', step: 8, pitch: 'F4', len: 8, vel: 0.8 },
      { ch: 'ch_pad', step: 0, pitch: 'D3', len: 16, vel: 0.75 },
      { ch: 'ch_drums', step: 4, pitch: 'tom', len: 2, vel: 0.75 },
      { ch: 'ch_drums', step: 12, pitch: 'tom', len: 2, vel: 0.8 }
    ]
  };

  // Pattern 5 : Fin Resolution Accord (16 pas)
  const patFin = {
    id: 'pat_fin',
    name: 'Fin Resolution',
    length: 16,
    notes: [
      { ch: 'ch_lead', step: 0, pitch: 'A5', len: 16, vel: 0.9 },
      { ch: 'ch_pad', step: 0, pitch: 'A3', len: 16, vel: 0.85 },
      { ch: 'ch_bass', step: 0, pitch: 'A2', len: 16, vel: 0.9 },
      { ch: 'ch_drums', step: 0, pitch: 'cymbal', len: 8, vel: 0.9 }
    ]
  };

  const patterns = [patIntro, patCouplet, patRefrain, patPont, patFin];

  // 2. Playlist globale (arrangement temporel total = 60 mesures = 960 pas = 2 minutes)
  const playlist = [];

  // Intro : Mesures 1 - 8 (Pas 0 a 128, 16s)
  for (let b = 0; b < 8; b++) {
    playlist.push({ pattern: 'pat_intro', start: b * 16, track: 0 });
  }

  // Couplet 1 : Mesures 9 - 24 (Pas 128 a 384, 32s)
  for (let b = 8; b < 24; b++) {
    playlist.push({ pattern: 'pat_couplet', start: b * 16, track: 1 });
  }

  // Refrain 1 : Mesures 25 - 40 (Pas 384 a 640, 32s)
  for (let b = 24; b < 40; b++) {
    playlist.push({ pattern: 'pat_refrain', start: b * 16, track: 2 });
  }

  // Pont : Mesures 41 - 52 (Pas 640 a 832, 24s)
  for (let b = 40; b < 52; b++) {
    playlist.push({ pattern: 'pat_pont', start: b * 16, track: 3 });
  }

  // Fin : Mesures 53 - 60 (Pas 832 a 960, 16s)
  for (let b = 52; b < 60; b++) {
    playlist.push({ pattern: 'pat_fin', start: b * 16, track: 0 });
  }

  // 3. Clips DAW v2 avec positions precises, decoupables et deplacables
  const clips = [
    { id: 'clip_intro', name: 'Intro Theme', trackId: 'ch_lead', type: 'notes', start: 0, length: 128, notes: patIntro.notes },
    { id: 'clip_couplet', name: 'Couplet 1', trackId: 'ch_bass', type: 'notes', start: 128, length: 256, notes: patCouplet.notes },
    { id: 'clip_refrain', name: 'Refrain Epique', trackId: 'ch_lead', type: 'notes', start: 384, length: 256, notes: patRefrain.notes },
    { id: 'clip_pont', name: 'Pont Mystique', trackId: 'ch_keys', type: 'notes', start: 640, length: 192, notes: patPont.notes },
    { id: 'clip_fin', name: 'Fin Resolution', trackId: 'ch_lead', type: 'notes', start: 832, length: 128, notes: patFin.notes }
  ];

  // 4. Marqueurs de structure temporelle
  const markers = [
    { step: 0, name: 'Intro' },
    { step: 128, name: 'Couplet 1' },
    { step: 384, name: 'Refrain' },
    { step: 640, name: 'Pont' },
    { step: 832, name: 'Fin' }
  ];

  return {
    id: 'sng_epic_2min',
    name: 'Odyssee 2 Minutes',
    bpm,
    timeSignature: [4, 4],
    swing: 0,
    loop: { enabled: true, start: 128, end: 960 },
    channels,
    tracks: channels,
    patterns,
    playlist,
    clips,
    markers
  };
}
