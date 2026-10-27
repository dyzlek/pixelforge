// Parseur de fichiers Standard MIDI (.mid type 0 et 1) et convertisseur en morceaux chiptune PixelForge.
// Zero dependance externe, pur JavaScript.

import { midiToPitch } from '../editors/music/pianoroll.js';
import { drumPiece } from './chip.js';

class MidiReader {
  constructor(arrayBuffer) {
    this.view = new DataView(arrayBuffer);
    this.bytes = new Uint8Array(arrayBuffer);
    this.pos = 0;
  }

  get length() {
    return this.bytes.length;
  }

  readString(len) {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(this.bytes[this.pos++]);
    }
    return str;
  }

  readUint8() {
    return this.bytes[this.pos++];
  }

  readUint16() {
    const val = this.view.getUint16(this.pos, false); // Big endian
    this.pos += 2;
    return val;
  }

  readUint32() {
    const val = this.view.getUint32(this.pos, false); // Big endian
    this.pos += 4;
    return val;
  }

  readVarInt() {
    let result = 0;
    while (this.pos < this.length) {
      const b = this.bytes[this.pos++];
      result = (result << 7) | (b & 0x7F);
      if (!(b & 0x80)) break;
    }
    return result;
  }
}

export function parseMidi(arrayBuffer) {
  const reader = new MidiReader(arrayBuffer);

  const headerTag = reader.readString(4);
  if (headerTag !== 'MThd') throw new Error('Format de fichier MIDI non valide (en-tete MThd manquant)');

  const headerLen = reader.readUint32();
  const format = reader.readUint16();
  const numTracks = reader.readUint16();
  const division = reader.readUint16();

  // Saute d'eventuels octets d'en-tete supplementaires
  if (headerLen > 6) reader.pos += (headerLen - 6);

  let detectedBpm = 120;
  const tempoChanges = [];
  const tracks = [];

  for (let t = 0; t < numTracks; t++) {
    if (reader.pos >= reader.length) break;
    const chunkTag = reader.readString(4);
    const chunkLen = reader.readUint32();
    const endChunk = reader.pos + chunkLen;

    if (chunkTag !== 'MTrk') {
      reader.pos = endChunk;
      continue;
    }

    const events = [];
    let currentTicks = 0;
    let runningStatus = 0;
    let trackName = 'Piste ' + (t + 1);

    while (reader.pos < endChunk) {
      const delta = reader.readVarInt();
      currentTicks += delta;

      let status = reader.bytes[reader.pos];
      if (status >= 0x80) {
        reader.pos++;
        runningStatus = status;
      } else {
        status = runningStatus;
      }

      if (status === 0xFF) {
        // Meta evenement
        const metaType = reader.readUint8();
        const metaLen = reader.readVarInt();
        const metaStart = reader.pos;

        if (metaType === 0x03) {
          // Nom de la piste
          trackName = reader.readString(metaLen);
        } else if (metaType === 0x51 && metaLen === 3) {
          // Set Tempo : microsecondes par noire
          const us = (reader.readUint8() << 16) | (reader.readUint8() << 8) | reader.readUint8();
          if (us > 0) {
            const bpm = Math.round(60000000 / us);
            detectedBpm = bpm;
            tempoChanges.push({ time: currentTicks, bpm });
          }
        } else if (metaType === 0x2F) {
          // Fin de piste
          reader.pos = metaStart + metaLen;
          break;
        } else {
          reader.pos = metaStart + metaLen;
        }
      } else if (status === 0xF0 || status === 0xF7) {
        // Sysex
        const sysexLen = reader.readVarInt();
        reader.pos += sysexLen;
      } else {
        // Evenements vocaux MIDI (0x80 a 0xEF)
        const type = status & 0xF0;
        const channel = status & 0x0F;

        if (type === 0x80 || type === 0x90) {
          const note = reader.readUint8();
          const vel = reader.readUint8();
          const isNoteOn = type === 0x90 && vel > 0;
          events.push({
            type: isNoteOn ? 'noteOn' : 'noteOff',
            time: currentTicks,
            channel,
            note,
            velocity: vel / 127
          });
        } else if (type === 0xC0 || type === 0xD0) {
          reader.pos += 1;
        } else {
          reader.pos += 2;
        }
      }
    }

    tracks.push({ name: trackName, events });
  }

  return { format, numTracks, division, bpm: detectedBpm, tempoChanges, tracks };
}

export function midiToSong(arrayBuffer, name = 'Musique MIDI') {
  const midi = parseMidi(arrayBuffer);
  const division = midi.division || 480;
  // En chiptune 4 pas par temps (double croches)
  const ticksPerStep = Math.max(1, Math.round(division / 4));

  // Extraction et regroupement des notes par canal / piste
  // En General MIDI, canal 9 (1-based: canal 10) est reserve a la batterie
  const groups = new Map();

  midi.tracks.forEach((track, tIdx) => {
    const activeNotes = {};

    track.events.forEach((ev) => {
      const key = `${ev.channel}:${ev.note}`;
      const groupKey = midi.format === 0 ? `ch_${ev.channel}` : `trk_${tIdx}_ch_${ev.channel}`;

      if (ev.type === 'noteOn') {
        if (activeNotes[key]) {
          const prev = activeNotes[key];
          if (!groups.has(groupKey)) {
            groups.set(groupKey, {
              trackName: track.name,
              channel: prev.channel,
              isDrum: prev.channel === 9,
              notes: []
            });
          }
          const isDrum = prev.channel === 9;
          const pitch = isDrum ? (drumPiece(prev.note) || 'snare') : midiToPitch(prev.note);
          groups.get(groupKey).notes.push({
            step: Math.round(prev.time / ticksPerStep),
            len: Math.max(1, Math.round((ev.time - prev.time) / ticksPerStep)),
            pitch,
            vel: prev.velocity
          });
        }
        activeNotes[key] = ev;
      } else if (ev.type === 'noteOff' && activeNotes[key]) {
        const prev = activeNotes[key];
        delete activeNotes[key];
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            trackName: track.name,
            channel: prev.channel,
            isDrum: prev.channel === 9,
            notes: []
          });
        }
        const isDrum = prev.channel === 9;
        const pitch = isDrum ? (drumPiece(prev.note) || 'snare') : midiToPitch(prev.note);
        groups.get(groupKey).notes.push({
          step: Math.round(prev.time / ticksPerStep),
          len: Math.max(1, Math.round((ev.time - prev.time) / ticksPerStep)),
          pitch,
          vel: prev.velocity
        });
      }
    });

    // Fermeture des notes restantes non fermees
    Object.keys(activeNotes).forEach((k) => {
      const prev = activeNotes[k];
      const groupKey = midi.format === 0 ? `ch_${prev.channel}` : `trk_${tIdx}_ch_${prev.channel}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          trackName: track.name,
          channel: prev.channel,
          isDrum: prev.channel === 9,
          notes: []
        });
      }
      const isDrum = prev.channel === 9;
      const pitch = isDrum ? (drumPiece(prev.note) || 'snare') : midiToPitch(prev.note);
      groups.get(groupKey).notes.push({
        step: Math.round(prev.time / ticksPerStep),
        len: 4,
        pitch,
        vel: prev.velocity
      });
    });
  });

  const groupList = Array.from(groups.values()).filter((g) => g.notes.length > 0);

  const convertedTempoChanges = (midi.tempoChanges || []).map((tc) => ({
    step: Math.round(tc.time / ticksPerStep),
    bpm: tc.bpm
  }));

  // Si aucune piste n'a de notes, on retourne un morceau vide standard
  if (groupList.length === 0) {
    return {
      id: 'song_' + Date.now(),
      name,
      bpm: midi.bpm,
      tempoChanges: convertedTempoChanges,
      stepsPerBeat: 4,
      loop: { enabled: true, start: 0, end: 16 },
      channels: [
        { id: 'ch_lead', name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 }
      ],
      tracks: [
        { id: 'ch_lead', name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 }
      ],
      clips: [],
      patterns: [
        { id: 'pat_1', name: 'Pattern 1', length: 16, notes: [] }
      ],
      playlist: [
        { pattern: 'pat_1', start: 0, track: 0 }
      ]
    };
  }

  // Generation des canaux, pistes DAW v2 et des patterns
  const channels = [];
  const tracks = [];
  const patternNotes = [];
  let maxStep = 16;
  const melodicPresets = ['synth_sub', 'pulse50', 'triangle', 'saw', 'pulse25', 'synth_fm', 'wave'];
  let melodicCount = 0;

  groupList.forEach((g, idx) => {
    const chId = 'ch_' + (idx + 1);
    let inst = 'pulse50';
    let nameStr = g.trackName || ('Canal ' + (g.channel + 1));

    if (g.isDrum) {
      inst = 'drum_machine';
      if (!g.trackName || g.trackName.startsWith('Piste')) {
        nameStr = 'Batterie';
      }
    } else {
      inst = melodicPresets[melodicCount % melodicPresets.length];
      melodicCount++;
    }

    channels.push({
      id: chId,
      name: nameStr,
      instrument: inst,
      volume: 0.8,
      pan: 0,
      drumKit: g.isDrum
    });

    tracks.push({
      id: chId,
      name: nameStr,
      color: g.isDrum ? '#ef7d57' : (idx % 2 === 0 ? '#41a6f6' : '#a7f070'),
      volume: 0.8,
      pan: 0,
      instrument: inst,
      drumKit: g.isDrum,
      effects: []
    });

    g.notes.forEach((n) => {
      patternNotes.push({
        ch: chId,
        step: n.step,
        len: n.len,
        pitch: n.pitch,
        vel: n.vel
      });
      if (n.step + n.len > maxStep) maxStep = n.step + n.len;
    });
  });

  const totalLength = Math.ceil(maxStep / 16) * 16;

  const clips = channels.map((ch) => {
    const chNotes = patternNotes
      .filter((n) => n.ch === ch.id)
      .map((n) => ({ step: n.step, pitch: n.pitch, length: n.len, velocity: n.vel }));
    return {
      id: 'clp_' + ch.id,
      name: ch.name,
      trackId: ch.id,
      type: 'notes',
      start: 0,
      length: Math.max(16, totalLength),
      notes: chNotes
    };
  });

  return {
    id: 'song_' + Date.now(),
    name,
    bpm: midi.bpm,
    tempoChanges: convertedTempoChanges,
    stepsPerBeat: 4,
    loop: { enabled: true, start: 0, end: Math.max(16, totalLength) },
    channels,
    tracks,
    clips,
    patterns: [
      { id: 'pat_main', name: 'Pattern Principal', length: Math.max(16, totalLength), notes: patternNotes }
    ],
    playlist: [
      { pattern: 'pat_main', start: 0, track: 0 }
    ]
  };
}
