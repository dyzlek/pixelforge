// Convertisseur entre notation textuelle tracker ASCII et objet Song PixelForge.
// Zero dependance DOM, conforme au schema JSON et aux specifications chiptune.
import { uid } from '../../src/core/project.js';

function quoteName(name) {
  if (!name) return '""';
  if (/^[A-Za-z0-9_-]+$/.test(name)) return name;
  return JSON.stringify(name);
}

function formatNote(note) {
  let s = note.pitch;
  const len = note.len != null ? note.len : 1;
  const vel = note.vel != null ? note.vel : 1;
  if (vel !== 1) {
    s += `:${len}:${vel}`;
  } else if (len !== 1) {
    s += `:${len}`;
  }
  return s;
}

export function parseSongText(text, defaultName = 'Song') {
  const lines = String(text || '').split(/\r?\n/);
  let name = defaultName;
  let bpm = 130;
  let swing = undefined;
  let loop = { enabled: true, start: 0 };
  let currentSection = null;

  const channels = [];
  const patterns = [];
  const playlist = [];

  let currentChannel = null;
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
      if (nameMatch) {
        let n = nameMatch[1].trim();
        if ((n.startsWith('"') && n.endsWith('"')) || (n.startsWith("'") && n.endsWith("'"))) n = n.slice(1, -1);
        name = n;
        continue;
      }
      continue;
    }

    // Directives generales
    const bpmMatch = trimmed.match(/^BPM[:\s]+(\d+)/i);
    if (bpmMatch) { bpm = Number(bpmMatch[1]); continue; }
    const nameMatch = trimmed.match(/^NAME[:\s]+(.+)/i);
    if (nameMatch) {
      let n = nameMatch[1].trim();
      if ((n.startsWith('"') && n.endsWith('"')) || (n.startsWith("'") && n.endsWith("'"))) n = n.slice(1, -1);
      name = n;
      continue;
    }
    const swingMatch = trimmed.match(/^SWING[:\s]+([0-9.]+)/i);
    if (swingMatch) { swing = Number(swingMatch[1]); continue; }

    const loopMatch = trimmed.match(/^LOOP[:\s]+(on|off|true|false)(?:\s+(\d+))?(?:\s+(\d+))?/i);
    if (loopMatch) {
      loop = {
        enabled: loopMatch[1].toLowerCase() === 'on' || loopMatch[1].toLowerCase() === 'true',
        start: loopMatch[2] != null ? Number(loopMatch[2]) : 0
      };
      if (loopMatch[3] != null) loop.end = Number(loopMatch[3]);
      continue;
    }

    // En-tetes de section
    if (/^CHANNELS[:\s]*$/i.test(trimmed)) {
      currentSection = 'channels';
      currentChannel = null;
      continue;
    }
    if (/^PLAYLIST[:\s]*$/i.test(trimmed)) {
      currentSection = 'playlist';
      continue;
    }
    const patHeaderMatch = trimmed.match(/^PATTERN[:\s]+(.*)$/i);
    if (patHeaderMatch) {
      currentSection = 'pattern';
      const patLine = patHeaderMatch[1].trim();
      let patName = 'Pattern';
      let patLen = 16;
      if (patLine.startsWith('"') || patLine.startsWith("'")) {
        const quote = patLine[0];
        const end = patLine.indexOf(quote, 1);
        if (end !== -1) {
          patName = patLine.slice(1, end);
          const rest = patLine.slice(end + 1).trim();
          if (rest) {
            const numMatch = rest.match(/\d+/);
            if (numMatch) patLen = Number(numMatch[0]);
          }
        }
      } else {
        const tokens = patLine.split(/\s+/);
        if (tokens.length >= 2 && /^\d+$/.test(tokens[tokens.length - 1])) {
          patLen = Number(tokens[tokens.length - 1]);
          patName = tokens.slice(0, -1).join(' ');
        } else if (tokens.length === 1) {
          patName = tokens[0];
        } else {
          patName = patLine;
        }
      }
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
      // Sous-lignes de configuration du canal courant (ENV, VIB, ARP, WAVE, MUTE, SOLO)
      if (currentChannel) {
        const envMatch = trimmed.match(/^ENV[:\s]+(.*)$/i);
        if (envMatch) {
          const env = { a: 0.005, d: 0.1, s: 0.6, r: 0.08 };
          const str = envMatch[1];
          const aM = str.match(/a[:\s]+([0-9.]+)/i); if (aM) env.a = Number(aM[1]);
          const dM = str.match(/d[:\s]+([0-9.]+)/i); if (dM) env.d = Number(dM[1]);
          const sM = str.match(/s[:\s]+([0-9.]+)/i); if (sM) env.s = Number(sM[1]);
          const rM = str.match(/r[:\s]+([0-9.]+)/i); if (rM) env.r = Number(rM[1]);
          if (!aM && !dM && !sM && !rM) {
            const nums = str.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
            if (nums.length >= 4) { env.a = nums[0]; env.d = nums[1]; env.s = nums[2]; env.r = nums[3]; }
          }
          currentChannel.env = env;
          continue;
        }
        const vibMatch = trimmed.match(/^VIB(?:RATO)?[:\s]+(.*)$/i);
        if (vibMatch) {
          const vib = { depth: 0, rate: 6 };
          const str = vibMatch[1];
          const depM = str.match(/depth[:\s]+([0-9.]+)/i); if (depM) vib.depth = Number(depM[1]);
          const ratM = str.match(/rate[:\s]+([0-9.]+)/i); if (ratM) vib.rate = Number(ratM[1]);
          if (!depM && !ratM) {
            const nums = str.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
            if (nums.length >= 2) { vib.depth = nums[0]; vib.rate = nums[1]; }
          }
          currentChannel.vibrato = vib;
          continue;
        }
        const arpMatch = trimmed.match(/^ARP[:\s]+(.*)$/i);
        if (arpMatch) {
          currentChannel.arp = arpMatch[1].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
          continue;
        }
        const waveMatch = trimmed.match(/^WAVE(?:TABLE)?[:\s]+(.*)$/i);
        if (waveMatch) {
          currentChannel.waveTable = waveMatch[1].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
          continue;
        }
        if (/^MUTE\b/i.test(trimmed)) {
          currentChannel.mute = true;
          continue;
        }
        if (/^SOLO\b/i.test(trimmed)) {
          currentChannel.solo = true;
          continue;
        }
      }

      // Definition d'un canal : <name>: <instrument> [, options]
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        let chName = trimmed.slice(0, colonIdx).trim();
        if ((chName.startsWith('"') && chName.endsWith('"')) || (chName.startsWith("'") && chName.endsWith("'"))) {
          chName = chName.slice(1, -1);
        }
        const rest = trimmed.slice(colonIdx + 1).trim();
        const instMatch = rest.match(/^([A-Za-z0-9_]+)(.*)$/);
        const inst = instMatch ? instMatch[1].toLowerCase() : 'pulse50';
        const opts = instMatch ? instMatch[2] : '';

        const validInst = ['pulse12', 'pulse25', 'pulse50', 'triangle', 'saw', 'noise', 'wave', 'sample'].includes(inst) ? inst : 'pulse50';
        const ch = {
          id: uid('ch'),
          name: chName,
          instrument: validInst,
          volume: 0.8,
          pan: 0
        };
        const volMatch = opts.match(/vol(?:ume)?[:\s]+([0-9.]+)/i);
        if (volMatch) ch.volume = Number(volMatch[1]);
        const panMatch = opts.match(/pan[:\s]+([-0-9.]+)/i);
        if (panMatch) ch.pan = Number(panMatch[1]);
        if (validInst === 'noise' || /\bdrumkit\b/i.test(opts)) ch.drumKit = true;
        if (/\bmute\b/i.test(opts)) ch.mute = true;
        if (/\bsolo\b/i.test(opts)) ch.solo = true;
        const pitchMatch = opts.match(/pitch[:\s]+([A-G][#b]?\d)/i);
        if (pitchMatch) ch.defaultPitch = pitchMatch[1];
        const sampleMatch = opts.match(/sample[:\s]+([A-Za-z0-9_-]+)/i);
        if (sampleMatch) ch.sampleSoundId = sampleMatch[1];

        channels.push(ch);
        currentChannel = ch;
      }
    } else if (currentSection === 'pattern' && currentPattern) {
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
          if (val === '' && i === parts.length - 1) continue;
          if (chIdx < channels.length) {
            const chId = channels[chIdx].id;
            if (val && val !== '.' && val !== '...' && val !== '-' && val !== '--') {
              const chordParts = val.split('+');
              for (const cp of chordParts) {
                if (!cp) continue;
                const noteParts = cp.split(':');
                const pitch = noteParts[0];
                const noteObj = { ch: chId, step, pitch };
                if (noteParts[1] != null && noteParts[1] !== '') {
                  noteObj.len = Number(noteParts[1]);
                } else {
                  noteObj.len = 1;
                }
                if (noteParts[2] != null && noteParts[2] !== '') {
                  noteObj.vel = Number(noteParts[2]);
                }
                currentPattern.notes.push(noteObj);
              }
            }
          }
          chIdx++;
        }
        currentStep = step + 1;
      }
    } else if (currentSection === 'playlist') {
      let trackIndex = playlist.length ? Math.max(...playlist.map((x) => x.track || 0)) + 1 : 0;
      let patListStr = trimmed;
      const trackMatch = trimmed.match(/^Track\s*(\d+)[:\s]+(.*)$/i);
      if (trackMatch) {
        trackIndex = Number(trackMatch[1]);
        patListStr = trackMatch[2];
      }
      const tokenRegex = /(?:"([^"]+)"|'([^']+)'|(\S+?))(?:@(\d+))?(?:\s+|$)/g;
      let match;
      let stepOffset = 0;
      while ((match = tokenRegex.exec(patListStr)) !== null) {
        const tokenName = match[1] ?? match[2] ?? match[3];
        const explicitStart = match[4] != null ? Number(match[4]) : null;
        if (!tokenName) continue;
        if (tokenName === '.' || tokenName === '-') {
          stepOffset += 16;
          continue;
        }
        const pat = patterns.find((p) => p.name === tokenName);
        if (pat) {
          const start = explicitStart != null ? explicitStart : stepOffset;
          playlist.push({
            pattern: pat.id,
            start,
            track: trackIndex
          });
          stepOffset = start + (pat.length || 16);
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

  const result = {
    id: uid('sng'),
    name,
    bpm,
    channels,
    patterns,
    playlist,
    loop
  };
  if (swing != null) result.swing = swing;
  return result;
}

export function songToText(song) {
  if (!song) return '';
  const lines = [];
  lines.push(`NAME ${quoteName(song.name || 'Song')}`);
  lines.push(`BPM ${song.bpm || 130}`);
  if (song.swing != null) lines.push(`SWING ${song.swing}`);
  if (song.loop) {
    const loopEn = song.loop.enabled !== false;
    const start = song.loop.start || 0;
    const end = song.loop.end != null ? ` ${song.loop.end}` : '';
    lines.push(`LOOP ${loopEn ? 'on' : 'off'} ${start}${end}`.trim());
  }
  lines.push('');

  lines.push('CHANNELS');
  const chs = song.channels || [];
  for (const ch of chs) {
    const opts = [];
    if (ch.volume != null && ch.volume !== 0.8) opts.push(`vol ${ch.volume}`);
    if (ch.pan != null && ch.pan !== 0) opts.push(`pan ${ch.pan}`);
    if (ch.drumKit) opts.push('drumKit');
    if (ch.mute) opts.push('mute');
    if (ch.solo) opts.push('solo');
    if (ch.sampleSoundId) opts.push(`sample ${ch.sampleSoundId}`);
    if (ch.defaultPitch) opts.push(`pitch ${ch.defaultPitch}`);
    lines.push(`  ${quoteName(ch.name)}: ${ch.instrument || 'pulse50'}${opts.length ? ', ' + opts.join(', ') : ''}`);
    if (ch.env) {
      lines.push(`    ENV a:${ch.env.a} d:${ch.env.d} s:${ch.env.s} r:${ch.env.r}`);
    }
    if (ch.vibrato && (ch.vibrato.depth !== 0 || ch.vibrato.rate !== 6)) {
      lines.push(`    VIB depth:${ch.vibrato.depth} rate:${ch.vibrato.rate}`);
    }
    if (Array.isArray(ch.arp) && ch.arp.length > 0) {
      lines.push(`    ARP ${ch.arp.join(', ')}`);
    }
    if (Array.isArray(ch.waveTable) && ch.waveTable.length > 0) {
      lines.push(`    WAVE ${ch.waveTable.join(', ')}`);
    }
  }
  lines.push('');

  const patterns = song.patterns || [];
  for (const pat of patterns) {
    lines.push(`PATTERN ${quoteName(pat.name)} ${pat.length || 16}`);
    const notesByStep = {};
    for (const n of pat.notes || []) {
      if (!notesByStep[n.step]) notesByStep[n.step] = {};
      if (!notesByStep[n.step][n.ch]) notesByStep[n.step][n.ch] = [];
      notesByStep[n.step][n.ch].push(n);
    }
    const len = pat.length || 16;
    for (let s = 0; s < len; s++) {
      const row = notesByStep[s];
      if (!row && s % 4 !== 0) continue;
      const stepStr = String(s).padStart(2, '0');
      const cells = chs.map((ch) => {
        const notes = row ? row[ch.id] : null;
        if (!notes || notes.length === 0) return '.';
        return notes.map(formatNote).join('+');
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
  const trackKeys = Object.keys(tracks).map(Number).sort((a, b) => a - b);
  for (const t of trackKeys) {
    const items = tracks[t].sort((a, b) => a.start - b.start);
    const tokens = items.map((x) => `${quoteName(x.name)}@${x.start}`);
    lines.push(`  Track ${t}: ${tokens.join(' ')}`);
  }

  return lines.join('\n');
}
