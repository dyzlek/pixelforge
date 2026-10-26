// Convertisseur entre notation textuelle tracker ASCII et objet Song PixelForge.
// Zero dependance DOM, conforme au schema JSON et aux specifications chiptune.
import { uid } from '../../src/core/project.js';

export function parseSongText(text, defaultName = 'Song') {
  const lines = String(text || '').split(/\r?\n/);
  let name = defaultName;
  let bpm = 130;
  let loop = { enabled: true, start: 0 };
  let currentSection = null;

  const channels = [];
  const patterns = [];
  const playlist = [];

  let currentPattern = null;
  let currentStep = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Directives dans commentaires (# ou //)
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      const directive = trimmed.replace(/^[#/]+\s*/, '');
      const bpmMatch = directive.match(/^BPM[:\s]+(\d+)/i);
      if (bpmMatch) { bpm = Number(bpmMatch[1]); continue; }
      const nameMatch = directive.match(/^NAME[:\s]+(.+)/i);
      if (nameMatch) { name = nameMatch[1].trim(); continue; }
      continue;
    }

    // Directives generales
    const bpmMatch = trimmed.match(/^BPM[:\s]+(\d+)/i);
    if (bpmMatch) { bpm = Number(bpmMatch[1]); continue; }
    const nameMatch = trimmed.match(/^NAME[:\s]+(.+)/i);
    if (nameMatch) { name = nameMatch[1].trim(); continue; }

    // En-tetes de section
    if (/^CHANNELS[:\s]*$/i.test(trimmed)) {
      currentSection = 'channels';
      continue;
    }
    if (/^PLAYLIST[:\s]*$/i.test(trimmed)) {
      currentSection = 'playlist';
      continue;
    }
    const patMatch = trimmed.match(/^PATTERN[:\s]+([^\s,]+)(?:[,\s]+(\d+))?/i);
    if (patMatch) {
      currentSection = 'pattern';
      const patName = patMatch[1];
      const patLen = patMatch[2] ? Number(patMatch[2]) : 16;
      currentPattern = {
        id: uid('pat'),
        name: patName,
        length: patLen,
        notes: []
      };
      patterns.push(currentPattern);
      currentStep = 0;
      continue;
    }

    if (currentSection === 'channels') {
      // Format: <name>: <instrument> [, options]
      const m = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)(.*)$/);
      if (m) {
        const chName = m[1];
        const inst = m[2].toLowerCase();
        const opts = m[3] || '';
        const ch = {
          id: uid('ch'),
          name: chName,
          instrument: ['pulse12', 'pulse25', 'pulse50', 'triangle', 'saw', 'noise', 'wave', 'sample'].includes(inst) ? inst : 'pulse50',
          volume: 0.8,
          pan: 0,
          drumKit: inst === 'noise' || /drumkit/i.test(opts)
        };
        const volMatch = opts.match(/vol(?:ume)?[:\s]+([0-9.]+)/i);
        if (volMatch) ch.volume = Number(volMatch[1]);
        const panMatch = opts.match(/pan[:\s]+([-0-9.]+)/i);
        if (panMatch) ch.pan = Number(panMatch[1]);
        channels.push(ch);
      }
    } else if (currentSection === 'pattern' && currentPattern) {
      // Ligne d'un pattern : 00 | C4 | C3 | kick ou | C4 | C3 | kick |
      if (trimmed.includes('|')) {
        const parts = trimmed.split('|').map((s) => s.trim());
        let step = currentStep;
        let colIndex = 0;

        if (parts[0] !== '' && /^\d+$/.test(parts[0])) {
          step = Number(parts[0]);
          colIndex = 1;
        } else if (parts[0] === '') {
          if (parts[1] !== '' && /^\d+$/.test(parts[1])) {
            step = Number(parts[1]);
            colIndex = 2;
          } else {
            colIndex = 1;
          }
        }

        let chIdx = 0;
        for (let i = colIndex; i < parts.length; i++) {
          const val = parts[i];
          if (val === '' && i === parts.length - 1) continue; // Pipe final facultatif
          if (chIdx < channels.length) {
            const chId = channels[chIdx].id;
            if (val && val !== '.' && val !== '...' && val !== '-' && val !== '--') {
              const noteParts = val.split(':');
              const pitch = noteParts[0];
              const len = noteParts[1] ? Number(noteParts[1]) : 1;
              const vel = noteParts[2] ? Number(noteParts[2]) : 1;
              currentPattern.notes.push({ ch: chId, step, len, pitch, vel });
            }
          }
          chIdx++;
        }
        currentStep = step + 1;
      }
    } else if (currentSection === 'playlist') {
      let trackIndex = playlist.length;
      let patListStr = trimmed;
      const trackMatch = trimmed.match(/^Track\s*(\d+)[:\s]+(.*)$/i);
      if (trackMatch) {
        trackIndex = Number(trackMatch[1]);
        patListStr = trackMatch[2];
      }
      const patTokens = patListStr.split(/\s+/).filter(Boolean);
      let stepOffset = 0;
      for (const token of patTokens) {
        if (token === '.' || token === '-') {
          stepOffset += 16;
          continue;
        }
        const pat = patterns.find((p) => p.name === token);
        if (pat) {
          playlist.push({
            pattern: pat.id,
            start: stepOffset,
            track: trackIndex
          });
          stepOffset += pat.length || 16;
        }
      }
    }
  }

  // Fallbacks si certaines sections n'ont pas ete specifiees
  if (channels.length === 0) {
    channels.push(
      { id: uid('ch'), name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 },
      { id: uid('ch'), name: 'Bass', instrument: 'triangle', volume: 0.9, pan: 0 },
      { id: uid('ch'), name: 'Drums', instrument: 'noise', volume: 0.8, pan: 0, drumKit: true }
    );
  }

  if (patterns.length === 0) {
    patterns.push({
      id: uid('pat'),
      name: 'Main',
      length: 16,
      notes: []
    });
  }

  if (playlist.length === 0) {
    let stepOffset = 0;
    for (const pat of patterns) {
      playlist.push({
        pattern: pat.id,
        start: stepOffset,
        track: 0
      });
      stepOffset += pat.length || 16;
    }
  }

  return {
    id: uid('sng'),
    name,
    bpm,
    channels,
    patterns,
    playlist,
    loop
  };
}

export function songToText(song) {
  if (!song) return '';
  const lines = [];
  lines.push(`NAME ${song.name || 'Song'}`);
  lines.push(`BPM ${song.bpm || 130}`);
  lines.push('');
  lines.push('CHANNELS');
  const chs = song.channels || [];
  for (const ch of chs) {
    const opts = [];
    if (ch.volume != null && ch.volume !== 0.8) opts.push(`vol ${ch.volume}`);
    if (ch.pan) opts.push(`pan ${ch.pan}`);
    if (ch.drumKit) opts.push('drumKit');
    lines.push(`  ${ch.name}: ${ch.instrument}${opts.length ? ', ' + opts.join(', ') : ''}`);
  }
  lines.push('');

  const patterns = song.patterns || [];
  for (const pat of patterns) {
    lines.push(`PATTERN ${pat.name} ${pat.length || 16}`);
    const notesByStep = {};
    for (const n of pat.notes || []) {
      if (!notesByStep[n.step]) notesByStep[n.step] = {};
      notesByStep[n.step][n.ch] = n;
    }
    const len = pat.length || 16;
    for (let s = 0; s < len; s++) {
      const row = notesByStep[s];
      if (!row && s % 4 !== 0) continue;
      const stepStr = String(s).padStart(2, '0');
      const cells = chs.map((ch) => {
        const note = row ? row[ch.id] : null;
        if (!note) return '.';
        return note.len > 1 ? `${note.pitch}:${note.len}` : note.pitch;
      });
      lines.push(`${stepStr} | ` + cells.map((c) => c.padEnd(5)).join(' | '));
    }
    lines.push('');
  }

  lines.push('PLAYLIST');
  const playlist = song.playlist || [];
  const tracks = {};
  for (const item of playlist) {
    const t = item.track || 0;
    if (!tracks[t]) tracks[t] = [];
    const pat = patterns.find((p) => p.id === item.pattern);
    if (pat) tracks[t].push({ name: pat.name, start: item.start || 0 });
  }
  for (const [t, items] of Object.entries(tracks)) {
    items.sort((a, b) => a.start - b.start);
    lines.push(`  Track${t}: ` + items.map((x) => x.name).join(' '));
  }

  return lines.join('\n');
}
