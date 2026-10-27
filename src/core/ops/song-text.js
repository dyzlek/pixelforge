// Convertisseur entre notation textuelle tracker ASCII / DAW v2 et objet Song PixelForge.
// Zero dependance DOM, conforme au schema JSON et aux specifications chiptune.
import { uid } from '../project.js';

function quoteName(name) {
  if (!name) return '""';
  if (/^[A-Za-z0-9_-]+$/.test(name)) return name;
  return JSON.stringify(name);
}

function unquote(str) {
  if (!str) return '';
  const s = String(str).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function formatNote(note) {
  let s = note.pitch;
  const len = note.len != null ? note.len : (note.length != null ? note.length : 1);
  const vel = note.vel != null ? note.vel : (note.velocity != null ? note.velocity : 1);
  if (vel !== 1) {
    s += `:${len}:${vel}`;
  } else if (len !== 1) {
    s += `:${len}`;
  }
  return s;
}

function parseKeyVal(str) {
  const result = {};
  if (!str) return result;
  const tokens = str.trim().split(/[\s,]+/);
  for (const token of tokens) {
    if (!token) continue;
    const colonIdx = token.indexOf(':');
    if (colonIdx !== -1) {
      const key = token.slice(0, colonIdx).trim().toLowerCase();
      const valStr = token.slice(colonIdx + 1).trim();
      const numVal = Number(valStr);
      result[key] = !isNaN(numVal) ? numVal : valStr;
    }
  }
  return result;
}

export function parseSongText(text, defaultName = 'Song') {
  const lines = String(text || '').split(/\r?\n/);
  let name = defaultName;
  let bpm = 130;
  let swing = undefined;
  let loop = { enabled: true, start: 0 };
  let format = undefined;
  let currentSection = null;

  const channels = [];
  const tracks = [];
  const patterns = [];
  const playlist = [];
  const clips = [];
  const automation = [];
  const tempoChanges = [];

  let currentChannel = null;
  let currentTrack = null;
  let currentPattern = null;
  let currentClip = null;
  let currentAuto = null;
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
        name = unquote(nameMatch[1]);
        continue;
      }
      continue;
    }

    // Directives generales
    const bpmMatch = trimmed.match(/^BPM[:\s]+(\d+)/i);
    if (bpmMatch) { bpm = Number(bpmMatch[1]); continue; }
    const nameMatch = trimmed.match(/^NAME[:\s]+(.+)/i);
    if (nameMatch) {
      name = unquote(nameMatch[1]);
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

    const tempoMatch = trimmed.match(/^TEMPO[:\s]+(?:step:)?(\d+)[:\s]+(?:bpm:)?(\d+)/i);
    if (tempoMatch) {
      tempoChanges.push({ step: Number(tempoMatch[1]), bpm: Number(tempoMatch[2]) });
      continue;
    }

    // En-tetes de section
    if (/^TRACKS[:\s]*$/i.test(trimmed)) {
      format = 'v2';
      currentSection = 'tracks';
      currentTrack = null;
      currentChannel = null;
      continue;
    }
    if (/^CHANNELS[:\s]*$/i.test(trimmed)) {
      currentSection = 'channels';
      currentChannel = null;
      currentTrack = null;
      continue;
    }
    if (/^CLIPS[:\s]*$/i.test(trimmed)) {
      format = 'v2';
      currentSection = 'clips';
      currentClip = null;
      continue;
    }
    if (/^AUTOMATION[:\s]*$/i.test(trimmed)) {
      format = 'v2';
      currentSection = 'automation';
      currentAuto = null;
      continue;
    }
    if (/^PLAYLIST[:\s]*$/i.test(trimmed)) {
      currentSection = 'playlist';
      continue;
    }

    // En-tete CLIP
    const clipHeaderMatch = trimmed.match(/^CLIP\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s+@(?:"([^"]+)"|'([^']+)'|(\S+))(?:\s+(\d+))?(?:\s+(\d+))?(.*)$/i);
    if (clipHeaderMatch) {
      format = 'v2';
      currentSection = 'clips';
      const clipName = clipHeaderMatch[1] ?? clipHeaderMatch[2] ?? clipHeaderMatch[3];
      const trackRef = clipHeaderMatch[4] ?? clipHeaderMatch[5] ?? clipHeaderMatch[6];
      const start = clipHeaderMatch[7] != null ? Number(clipHeaderMatch[7]) : 0;
      const len = clipHeaderMatch[8] != null ? Number(clipHeaderMatch[8]) : 16;
      const rest = clipHeaderMatch[9] || '';

      const trk = tracks.find((t) => t.name === trackRef || t.id === trackRef) ||
                  channels.find((c) => c.name === trackRef || c.id === trackRef);
      const trackId = trk ? trk.id : trackRef;

      const clip = {
        id: uid('clp'),
        name: clipName,
        trackId,
        start,
        length: len,
        type: 'notes',
        notes: []
      };

      const typeMatch = rest.match(/type[:\s]+(notes|audio)/i);
      if (typeMatch) clip.type = typeMatch[1].toLowerCase();
      const sampleMatch = rest.match(/sample[:\s]+([A-Za-z0-9_-]+)/i);
      if (sampleMatch) clip.sampleId = sampleMatch[1];

      clips.push(clip);
      currentClip = clip;
      continue;
    }

    // En-tete AUTO
    const autoHeaderMatch = trimmed.match(/^AUTO\s+@(?:"([^"]+)"|'([^']+)'|(\S+))\s+(.*)$/i);
    if (autoHeaderMatch) {
      format = 'v2';
      currentSection = 'automation';
      const trackRef = autoHeaderMatch[1] ?? autoHeaderMatch[2] ?? autoHeaderMatch[3];
      const rest = autoHeaderMatch[4] || '';

      const trk = tracks.find((t) => t.name === trackRef || t.id === trackRef) ||
                  channels.find((c) => c.name === trackRef || c.id === trackRef);
      const trackId = trk ? trk.id : trackRef;

      const targetMatch = rest.match(/target[:\s]+([A-Za-z0-9_.]+)/i);
      const curveMatch = rest.match(/curve[:\s]+([A-Za-z0-9_]+)/i);

      const auto = {
        id: uid('aut'),
        trackId,
        target: targetMatch ? targetMatch[1] : 'volume',
        points: []
      };
      if (curveMatch) auto.curve = curveMatch[1];

      automation.push(auto);
      currentAuto = auto;
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

    if (currentSection === 'tracks' || currentSection === 'channels') {
      const activeItem = currentTrack || currentChannel;
      if (activeItem) {
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
          activeItem.env = env;
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
          activeItem.vibrato = vib;
          continue;
        }
        const arpMatch = trimmed.match(/^ARP[:\s]+(.*)$/i);
        if (arpMatch) {
          activeItem.arp = arpMatch[1].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
          continue;
        }
        const waveMatch = trimmed.match(/^WAVE(?:TABLE)?[:\s]+(.*)$/i);
        if (waveMatch) {
          activeItem.waveTable = waveMatch[1].split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
          continue;
        }
        const fxMatch = trimmed.match(/^FX[:\s]+([A-Za-z0-9_]+)(.*)$/i);
        if (fxMatch) {
          activeItem.effects ||= [];
          const fxType = fxMatch[1].toLowerCase();
          const params = parseKeyVal(fxMatch[2]);
          activeItem.effects.push({ type: fxType, ...params });
          continue;
        }
        const sendMatch = trimmed.match(/^SEND[:\s]+(.*)$/i);
        if (sendMatch) {
          activeItem.sends ||= [];
          const params = parseKeyVal(sendMatch[1]);
          activeItem.sends.push({ busId: params.bus || params.busid || params.target, amount: params.amount != null ? Number(params.amount) : 1 });
          continue;
        }
        if (/^MUTE\b/i.test(trimmed)) {
          activeItem.mute = true;
          continue;
        }
        if (/^SOLO\b/i.test(trimmed)) {
          activeItem.solo = true;
          continue;
        }
      }

      // Definition d'une piste ou canal : <name>: <instrument> [, options]
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        let chName = unquote(trimmed.slice(0, colonIdx).trim());
        const rest = trimmed.slice(colonIdx + 1).trim();
        const instMatch = rest.match(/^([A-Za-z0-9_]+)(.*)$/);
        const inst = instMatch ? instMatch[1].toLowerCase() : 'pulse50';
        const opts = instMatch ? instMatch[2] : '';

        const validInst = [
          'pulse12', 'pulse25', 'pulse50', 'triangle', 'saw', 'noise', 'wave', 'sample',
          'synth_sub', 'synth_fm', 'sampler', 'drum_machine'
        ].includes(inst) ? inst : 'pulse50';

        const item = {
          id: uid('trk'),
          name: chName,
          instrument: validInst,
          volume: 0.8,
          pan: 0
        };

        const volMatch = opts.match(/vol(?:ume)?[:\s]+([0-9.]+)/i);
        if (volMatch) item.volume = Number(volMatch[1]);
        const panMatch = opts.match(/pan[:\s]+([-0-9.]+)/i);
        if (panMatch) item.pan = Number(panMatch[1]);
        const layerMatch = opts.match(/layer[:\s]+([A-Za-z0-9_-]+)/i);
        if (layerMatch) item.layer = layerMatch[1];
        const presetMatch = opts.match(/preset[:\s]+([A-Za-z0-9_-]+)/i);
        if (presetMatch) item.preset = presetMatch[1];
        const kitMatch = opts.match(/kit[:\s]+([A-Za-z0-9_-]+)/i);
        if (kitMatch) item.kit = kitMatch[1];
        const sampleMatch = opts.match(/sample[:\s]+([A-Za-z0-9_-]+)/i);
        if (sampleMatch) { item.sampleId = sampleMatch[1]; item.sampleSoundId = sampleMatch[1]; }
        const busMatch = opts.match(/bus[:\s]+([A-Za-z0-9_-]+)/i);
        if (busMatch) item.outputBusId = busMatch[1];

        if (validInst === 'noise' || /\bdrumkit\b/i.test(opts)) item.drumKit = true;
        if (/\bmute\b/i.test(opts)) item.mute = true;
        if (/\bsolo\b/i.test(opts)) item.solo = true;
        const pitchMatch = opts.match(/pitch[:\s]+([A-G][#b]?\d)/i);
        if (pitchMatch) item.defaultPitch = pitchMatch[1];

        tracks.push(item);
        channels.push(item);
        currentTrack = item;
        currentChannel = item;
      }
    } else if (currentSection === 'clips' && currentClip) {
      if (trimmed.includes('|')) {
        const parts = trimmed.split('|').map((s) => s.trim());
        const step = Number(parts[0]);
        if (!isNaN(step) && parts[1]) {
          const noteTokens = parts[1].split('+');
          for (const nt of noteTokens) {
            const rawNote = nt.trim();
            if (!rawNote || rawNote === '.' || rawNote === '-') continue;
            const nParts = rawNote.split(':');
            const pitch = nParts[0];
            const noteObj = {
              step,
              pitch,
              len: nParts[1] != null && nParts[1] !== '' ? Number(nParts[1]) : 1
            };
            if (nParts[2] != null && nParts[2] !== '') noteObj.vel = Number(nParts[2]);
            currentClip.notes.push(noteObj);
          }
        }
      }
    } else if (currentSection === 'automation' && currentAuto) {
      if (trimmed.includes('|')) {
        const parts = trimmed.split('|').map((s) => s.trim());
        const step = Number(parts[0]);
        if (!isNaN(step) && parts[1]) {
          const valParts = parts[1].split(/\s+/);
          const val = Number(valParts[0]);
          if (!isNaN(val)) {
            const pt = { step, value: val };
            const curveMatch = parts[1].match(/curve[:\s]+([A-Za-z0-9_]+)/i);
            if (curveMatch) pt.curve = curveMatch[1];
            currentAuto.points.push(pt);
          }
        }
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
  if (channels.length === 0 && tracks.length === 0) {
    const dflt = [
      { id: uid('ch'), name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0 },
      { id: uid('ch'), name: 'Bass', instrument: 'triangle', volume: 0.9, pan: 0 },
      { id: uid('ch'), name: 'Drums', instrument: 'noise', volume: 0.8, pan: 0, drumKit: true }
    ];
    channels.push(...dflt);
    tracks.push(...dflt);
  } else if (tracks.length > 0 && channels.length === 0) {
    channels.push(...tracks);
  } else if (channels.length > 0 && tracks.length === 0) {
    tracks.push(...channels);
  }

  // Synchronisation v1 (patterns/playlist) et v2 (clips)
  if (clips.length > 0 && patterns.length === 0) {
    for (const clip of clips) {
      if (clip.type === 'notes') {
        const patId = uid('pat');
        const pat = {
          id: patId,
          name: clip.name || 'Clip',
          length: clip.length || 16,
          notes: (clip.notes || []).map((n) => ({
            ch: clip.trackId,
            step: n.step,
            pitch: n.pitch,
            len: n.len || 1,
            ...(n.vel != null ? { vel: n.vel } : {})
          }))
        };
        patterns.push(pat);
        playlist.push({
          pattern: patId,
          start: clip.start || 0,
          track: 0
        });
      }
    }
  } else if (patterns.length > 0 && clips.length === 0) {
    for (const item of playlist) {
      const pat = patterns.find((p) => p.id === item.pattern);
      if (!pat) continue;
      const notesByCh = {};
      for (const n of pat.notes || []) {
        if (!notesByCh[n.ch]) notesByCh[n.ch] = [];
        notesByCh[n.ch].push(n);
      }
      for (const chId of Object.keys(notesByCh)) {
        clips.push({
          id: uid('clp'),
          name: pat.name,
          trackId: chId,
          start: item.start || 0,
          length: pat.length || 16,
          type: 'notes',
          notes: notesByCh[chId].map((n) => ({
            step: n.step,
            pitch: n.pitch,
            len: n.len || 1,
            ...(n.vel != null ? { vel: n.vel } : {})
          }))
        });
      }
    }
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
  if (format === 'v2') result.format = 'v2';
  if (tracks.length > 0) result.tracks = tracks;
  if (clips.length > 0) result.clips = clips;
  if (automation.length > 0) result.automation = automation;
  if (tempoChanges.length > 0) result.tempoChanges = tempoChanges;
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
  if (Array.isArray(song.tempoChanges)) {
    for (const tc of song.tempoChanges) {
      lines.push(`TEMPO ${tc.step} ${tc.bpm}`);
    }
  }
  lines.push('');

  const isDawV2 = song.format === 'v2' ||
                  (Array.isArray(song.clips) && song.clips.length > 0 && (!song.patterns || song.patterns.length === 0)) ||
                  (Array.isArray(song.tracks) && song.tracks.length > 0 && (!song.channels || song.channels.length === 0)) ||
                  (Array.isArray(song.automation) && song.automation.length > 0 && (!song.patterns || song.patterns.length === 0));

  if (isDawV2) {
    // ---- DAW v2 FORMAT ----
    lines.push('TRACKS');
    const trks = song.tracks || song.channels || [];
    for (const t of trks) {
      const opts = [];
      if (t.volume != null && t.volume !== 0.8) opts.push(`vol ${t.volume}`);
      if (t.pan != null && t.pan !== 0) opts.push(`pan ${t.pan}`);
      if (t.layer) opts.push(`layer ${t.layer}`);
      if (t.preset) opts.push(`preset ${t.preset}`);
      if (t.kit) opts.push(`kit ${t.kit}`);
      if (t.sampleId || t.sampleSoundId) opts.push(`sample ${t.sampleId || t.sampleSoundId}`);
      if (t.outputBusId) opts.push(`bus ${t.outputBusId}`);
      if (t.drumKit) opts.push('drumKit');
      if (t.mute) opts.push('mute');
      if (t.solo) opts.push('solo');
      if (t.defaultPitch) opts.push(`pitch ${t.defaultPitch}`);
      lines.push(`  ${quoteName(t.name)}: ${t.instrument || 'pulse50'}${opts.length ? ', ' + opts.join(', ') : ''}`);
      if (t.env) {
        lines.push(`    ENV a:${t.env.a} d:${t.env.d} s:${t.env.s} r:${t.env.r}`);
      }
      if (t.vibrato && (t.vibrato.depth !== 0 || t.vibrato.rate !== 6)) {
        lines.push(`    VIB depth:${t.vibrato.depth} rate:${t.vibrato.rate}`);
      }
      if (Array.isArray(t.arp) && t.arp.length > 0) {
        lines.push(`    ARP ${t.arp.join(', ')}`);
      }
      if (Array.isArray(t.waveTable) && t.waveTable.length > 0) {
        lines.push(`    WAVE ${t.waveTable.join(', ')}`);
      }
      if (Array.isArray(t.effects)) {
        for (const eff of t.effects) {
          const params = Object.entries(eff).filter(([k]) => k !== 'type').map(([k, v]) => `${k}:${v}`).join(' ');
          lines.push(`    FX ${eff.type}${params ? ' ' + params : ''}`);
        }
      }
      if (Array.isArray(t.sends)) {
        for (const snd of t.sends) {
          lines.push(`    SEND bus:${snd.busId || snd.targetTrackId} amount:${snd.amount != null ? snd.amount : 1}`);
        }
      }
    }
    lines.push('');

    if (Array.isArray(song.clips) && song.clips.length > 0) {
      lines.push('CLIPS');
      for (const clip of song.clips) {
        const trk = trks.find((x) => x.id === clip.trackId || x.name === clip.trackId);
        const trkName = trk ? trk.name : (clip.trackId || 'Track');
        const clipOpts = [];
        if (clip.type && clip.type !== 'notes') clipOpts.push(`type:${clip.type}`);
        if (clip.sampleId) clipOpts.push(`sample:${clip.sampleId}`);
        lines.push(`CLIP ${quoteName(clip.name || 'Clip')} @${quoteName(trkName)} ${clip.start || 0} ${clip.length || 16}${clipOpts.length ? ' ' + clipOpts.join(' ') : ''}`);
        if (clip.type !== 'audio' && Array.isArray(clip.notes) && clip.notes.length > 0) {
          const notesByStep = {};
          for (const n of clip.notes) {
            if (!notesByStep[n.step]) notesByStep[n.step] = [];
            notesByStep[n.step].push(n);
          }
          const steps = Object.keys(notesByStep).map(Number).sort((a, b) => a - b);
          for (const s of steps) {
            const stepStr = String(s).padStart(2, '0');
            const rowNotes = notesByStep[s];
            lines.push(`  ${stepStr} | ${rowNotes.map(formatNote).join(' + ')}`);
          }
        }
      }
      lines.push('');
    }

    if (Array.isArray(song.automation) && song.automation.length > 0) {
      lines.push('AUTOMATION');
      for (const auto of song.automation) {
        const trk = trks.find((x) => x.id === auto.trackId || x.name === auto.trackId);
        const trkName = trk ? trk.name : (auto.trackId || 'Track');
        const autoOpts = [];
        autoOpts.push(`target:${auto.target || 'volume'}`);
        if (auto.curve) autoOpts.push(`curve:${auto.curve}`);
        lines.push(`AUTO @${quoteName(trkName)} ${autoOpts.join(' ')}`);
        for (const pt of (auto.points || []).sort((a, b) => a.step - b.step)) {
          const stepStr = String(pt.step).padStart(2, '0');
          const curveStr = pt.curve ? ` curve:${pt.curve}` : '';
          lines.push(`  ${stepStr} | ${pt.value}${curveStr}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n').trimEnd();
  }

  // ---- TRACKER v1 FORMAT (exact legacy behavior) ----
  lines.push('CHANNELS');
  const chs = song.channels || [];
  for (const ch of chs) {
    const opts = [];
    if (ch.volume != null && ch.volume !== 0.8) opts.push(`vol ${ch.volume}`);
    if (ch.pan != null && ch.pan !== 0) opts.push(`pan ${ch.pan}`);
    if (ch.layer) opts.push(`layer ${ch.layer}`);
    if (ch.preset) opts.push(`preset ${ch.preset}`);
    if (ch.kit) opts.push(`kit ${ch.kit}`);
    if (ch.drumKit) opts.push('drumKit');
    if (ch.mute) opts.push('mute');
    if (ch.solo) opts.push('solo');
    if (ch.sampleSoundId || ch.sampleId) opts.push(`sample ${ch.sampleSoundId || ch.sampleId}`);
    if (ch.outputBusId) opts.push(`bus ${ch.outputBusId}`);
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
    if (Array.isArray(ch.effects)) {
      for (const eff of ch.effects) {
        const params = Object.entries(eff).filter(([k]) => k !== 'type').map(([k, v]) => `${k}:${v}`).join(' ');
        lines.push(`    FX ${eff.type}${params ? ' ' + params : ''}`);
      }
    }
    if (Array.isArray(ch.sends)) {
      for (const snd of ch.sends) {
        lines.push(`    SEND bus:${snd.busId || snd.targetTrackId} amount:${snd.amount != null ? snd.amount : 1}`);
      }
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
  const tracksMap = {};
  for (const item of playlist) {
    const t = item.track || 0;
    if (!tracksMap[t]) tracksMap[t] = [];
    const pat = patterns.find((p) => p.id === item.pattern);
    if (pat) tracksMap[t].push({ name: pat.name, start: item.start || 0 });
  }
  const trackKeys = Object.keys(tracksMap).map(Number).sort((a, b) => a - b);
  for (const t of trackKeys) {
    const items = tracksMap[t].sort((a, b) => a.start - b.start);
    const tokens = items.map((x) => `${quoteName(x.name)}@${x.start}`);
    lines.push(`  Track ${t}: ${tokens.join(' ')}`);
  }

  return lines.join('\n');
}
