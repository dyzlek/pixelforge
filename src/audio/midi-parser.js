// Parseur de fichiers Standard MIDI (.mid type 0 et 1) et convertisseur en morceaux chiptune PixelForge.
// Zero dependance externe, pur JavaScript.

import { midiToPitch } from '../editors/music/pianoroll.js';

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
          if (us > 0) detectedBpm = Math.round(60000000 / us);
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

  return { format, numTracks, division, bpm: detectedBpm, tracks };
}

export function midiToSong(arrayBuffer, name = 'Musique MIDI') {
  const midi = parseMidi(arrayBuffer);
  const division = midi.division || 480;
  // En chiptune 4 pas par temps (double croches)
  const ticksPerStep = Math.max(1, Math.round(division / 4));

  // Extraction de toutes les notes avec leur duree
  const notesByTrack = [];
  const instrumentPresets = ['pulse50', 'triangle', 'pulse25', 'noise', 'saw', 'wave'];

  midi.tracks.forEach((track, tIdx) => {
    const activeNotes = {};
    const notes = [];

    track.events.forEach((ev) => {
      const key = `${ev.channel}:${ev.note}`;
      if (ev.type === 'noteOn') {
        if (activeNotes[key]) {
          // Note On precedente non fermee : fermeture automatique
          const prev = activeNotes[key];
          notes.push({
            step: Math.round(prev.time / ticksPerStep),
            len: Math.max(1, Math.round((ev.time - prev.time) / ticksPerStep)),
            pitch: midiToPitch(prev.note),
            vel: prev.velocity
          });
        }
        activeNotes[key] = ev;
      } else if (ev.type === 'noteOff' && activeNotes[key]) {
        const prev = activeNotes[key];
        delete activeNotes[key];
        notes.push({
          step: Math.round(prev.time / ticksPerStep),
          len: Math.max(1, Math.round((ev.time - prev.time) / ticksPerStep)),
          pitch: midiToPitch(prev.note),
          vel: prev.velocity
        });
      }
    });

    if (notes.length > 0) {
      notesByTrack.push({ name: track.name, notes, trackIdx: tIdx });
    }
  });

  // Si aucune piste n'a de notes, on retourne un morceau vide standard
  if (notesByTrack.length === 0) {
    return {
      id: 'song_' + Date.now(),
      name,
      bpm: midi.bpm,
      stepsPerBeat: 4,
      loop: true,
      channels: [
        { id: 'ch_lead', name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 }
      ],
      patterns: [
        { id: 'pat_1', name: 'Pattern 1', length: 16, notes: [] }
      ],
      playlist: [
        { pattern: 'pat_1', start: 0, track: 0 }
      ]
    };
  }

  // Generation des canaux et de la pattern
  const channels = [];
  const patternNotes = [];
  let maxStep = 16;

  notesByTrack.forEach((t, i) => {
    const chId = 'ch_' + (i + 1);
    const inst = instrumentPresets[i % instrumentPresets.length];
    const isDrum = inst === 'noise';

    channels.push({
      id: chId,
      name: t.name || ('Piste ' + (i + 1)),
      instrument: inst,
      volume: 0.8,
      pan: 0,
      drumKit: isDrum
    });

    t.notes.forEach((n) => {
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

  // Arrondi de la longueur du pattern a la mesure de 16 pas
  const totalLength = Math.ceil(maxStep / 16) * 16;

  return {
    id: 'song_' + Date.now(),
    name,
    bpm: midi.bpm,
    stepsPerBeat: 4,
    loop: true,
    channels,
    patterns: [
      { id: 'pat_main', name: 'Pattern Principal', length: Math.max(16, totalLength), notes: patternNotes }
    ],
    playlist: [
      { pattern: 'pat_main', start: 0, track: 0 }
    ]
  };
}
