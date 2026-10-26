// PixelForge Music Studio — Piano Roll interactif avec aides musicales
import { noteFreq } from '../../audio/chip.js';
import { getIconSvg } from '../../ui/icons.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  chromatic: { name: 'Chromatique (Toutes)', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  major: { name: 'Majeure', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Mineure naturelle', intervals: [0, 2, 3, 5, 7, 8, 10] },
  harmonic_minor: { name: 'Mineure harmonique', intervals: [0, 2, 3, 5, 7, 8, 11] },
  pentatonic_major: { name: 'Pentatonique majeure', intervals: [0, 2, 4, 7, 9] },
  pentatonic_minor: { name: 'Pentatonique mineure', intervals: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues chiptune', intervals: [0, 3, 5, 6, 7, 10] }
};

export const CHORDS = {
  maj: { name: 'Majeur', semitones: [0, 4, 7] },
  min: { name: 'Mineur', semitones: [0, 3, 7] },
  maj7: { name: '7e majeure', semitones: [0, 4, 7, 11] },
  dom7: { name: '7e de dominante', semitones: [0, 4, 7, 10] },
  min7: { name: '7e mineure', semitones: [0, 3, 7, 10] },
  sus4: { name: 'Sus4', semitones: [0, 5, 7] },
  dim: { name: 'Diminue', semitones: [0, 3, 6] }
};

export function midiToPitch(midi) {
  const note = NOTE_NAMES[midi % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${note}${oct}`;
}

export function pitchToMidi(pitch) {
  if (typeof pitch === 'number') {
    if (pitch >= 1 && pitch <= 127) return pitch;
    return Math.round(69 + 12 * Math.log2(pitch / 440));
  }
  const str = String(pitch || '').trim();
  const m = /^([A-Ga-g])([#b]?)(-?[0-9])$/.exec(str);
  if (!m) return 60;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()] || 0;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const oct = parseInt(m[3], 10);
  return (oct + 1) * 12 + base + acc;
}

export function isBlackKey(midi) {
  const semi = midi % 12;
  return semi === 1 || semi === 3 || semi === 6 || semi === 8 || semi === 10;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderPianoRoll(container, opts) {
  const {
    song,
    activePatternId,
    selectedChannelId,
    chip,
    currentStep = -1,
    onNotesChange,
    onChannelChange
  } = opts;

  container.innerHTML = '';
  const cleanups = [];

  const channel = (song.channels || []).find((c) => c.id === selectedChannelId) || song.channels?.[0];
  const pattern = (song.patterns || []).find((p) => p.id === activePatternId) || song.patterns?.[0] || { length: 16, notes: [] };
  const patternLength = pattern.length || 16;
  const channelNotes = (pattern.notes || []).filter((n) => n.ch === channel?.id);

  // Reglage echelle et dimensions
  const KEY_HEIGHT = 18;
  const STEP_WIDTH = 28;
  const MIN_MIDI = 36; // C2
  const MAX_MIDI = 84; // C6
  const TOTAL_KEYS = MAX_MIDI - MIN_MIDI + 1;

  let currentScaleKey = 'chromatic';
  let currentRootNote = 0; // C
  let chordMode = 'none'; // 'none' ou cle de CHORDS

  const root = document.createElement('div');
  root.className = 'pf-pianoroll-root';

  // 1. Barre d'outils du piano roll (Aides musicales)
  const toolbar = document.createElement('div');
  toolbar.className = 'pf-pianoroll-toolbar';

  // Info canal
  const channelBadge = document.createElement('div');
  channelBadge.className = 'pf-pianoroll-channel-info';
  channelBadge.innerHTML = `<strong>${esc(channel?.name || 'Canal')}</strong> <span class="pf-channel-inst">${esc(channel?.instrument || 'pulse50')}</span>`;
  toolbar.appendChild(channelBadge);

  const sep1 = document.createElement('div');
  sep1.className = 'pf-transport-sep';
  toolbar.appendChild(sep1);

  // Aides musicales : Tonalite racine
  const rootSelect = document.createElement('select');
  rootSelect.className = 'pf-transport-val';
  rootSelect.title = 'Tonalite racine';
  NOTE_NAMES.forEach((n, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = n;
    rootSelect.appendChild(opt);
  });
  rootSelect.onchange = (e) => {
    currentRootNote = parseInt(e.target.value, 10);
    renderGridBackground();
  };
  toolbar.appendChild(rootSelect);

  // Selecteur de gamme
  const scaleSelect = document.createElement('select');
  scaleSelect.className = 'pf-transport-val';
  scaleSelect.title = 'Gamme musicale (Guide)';
  Object.entries(SCALES).forEach(([k, s]) => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = s.name;
    scaleSelect.appendChild(opt);
  });
  scaleSelect.onchange = (e) => {
    currentScaleKey = e.target.value;
    renderGridBackground();
  };
  toolbar.appendChild(scaleSelect);

  const sep2 = document.createElement('div');
  sep2.className = 'pf-transport-sep';
  toolbar.appendChild(sep2);

  // Generateur d'accords
  const chordSelect = document.createElement('select');
  chordSelect.className = 'pf-transport-val';
  chordSelect.innerHTML = '<option value="none">Notes simples (1 note)</option>'
    + Object.entries(CHORDS).map(([k, c]) => `<option value="${k}">Accord : ${c.name}</option>`).join('');
  chordSelect.onchange = (e) => { chordMode = e.target.value; };
  toolbar.appendChild(chordSelect);

  // Outil Arpeger
  const btnArp = document.createElement('button');
  btnArp.className = 'pf-btn-add-channel';
  btnArp.style.padding = '4px 8px';
  btnArp.style.fontSize = '11px';
  btnArp.innerHTML = getIconSvg('music', 12) + ' Arpeger 60 Hz';
  btnArp.title = 'Convertir ou injecter un arpege chiptune rapide dans le canal';
  btnArp.onclick = () => {
    const choice = prompt('Entrez les demi-tons de l\'arpege chiptune separes par des virgules (ex: 0, 4, 7 pour Majeur, 0, 3, 7 pour Mineur) :', '0, 4, 7');
    if (!choice) return;
    const parts = choice.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (parts.length > 0 && channel) {
      onChannelChange?.(channel.id, { arp: parts });
      alert('Arpege chiptune 60 Hz active sur le canal ' + channel.name + ' : [' + parts.join(', ') + ']');
    }
  };
  toolbar.appendChild(btnArp);

  root.appendChild(toolbar);

  // 2. Zone principale : Clavier vertical a gauche + Grille scrollable a droite
  const body = document.createElement('div');
  body.className = 'pf-pianoroll-body';

  const keyboardCol = document.createElement('div');
  keyboardCol.className = 'pf-pianoroll-keys';

  const gridArea = document.createElement('div');
  gridArea.className = 'pf-pianoroll-grid';
  gridArea.style.width = (patternLength * STEP_WIDTH) + 'px';
  gridArea.style.height = (TOTAL_KEYS * KEY_HEIGHT) + 'px';

  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'pf-pianoroll-scroll';

  // Synchronisation du defilement vertical
  scrollWrapper.onscroll = () => {
    keyboardCol.scrollTop = scrollWrapper.scrollTop;
  };

  // Creation des touches de piano et lignes de la grille
  const keyElements = [];
  const gridRows = [];

  function isNoteInScale(midi) {
    if (currentScaleKey === 'chromatic') return true;
    const scale = SCALES[currentScaleKey];
    if (!scale) return true;
    const relSemi = (midi - currentRootNote + 120) % 12;
    return scale.intervals.includes(relSemi);
  }

  function playAudition(midi) {
    if (chip) {
      chip.scheduleNote({
        pitch: midiToPitch(midi),
        instrument: channel?.instrument || 'pulse50',
        duration: 0.18,
        volume: (channel?.volume != null ? channel.volume : 0.8) * 0.7
      });
    }
  }

  for (let m = MAX_MIDI; m >= MIN_MIDI; m--) {
    const isBlack = isBlackKey(m);
    const pName = midiToPitch(m);

    // Touche
    const key = document.createElement('div');
    key.className = 'pf-piano-key' + (isBlack ? ' black' : ' white');
    key.dataset.midi = String(m);

    const label = document.createElement('span');
    label.className = 'pf-piano-key-label';
    if (!isBlack || m % 12 === 1) label.textContent = pName;
    key.appendChild(label);

    key.onmousedown = (e) => {
      e.preventDefault();
      playAudition(m);
    };
    keyboardCol.appendChild(key);
    keyElements.push(key);

    // Ligne de grille
    const row = document.createElement('div');
    row.className = 'pf-pianoroll-row' + (isBlack ? ' black-row' : ' white-row');
    row.dataset.midi = String(m);
    row.style.height = KEY_HEIGHT + 'px';
    gridArea.appendChild(row);
    gridRows.push(row);
  }

  function renderGridBackground() {
    for (let i = 0; i < gridRows.length; i++) {
      const row = gridRows[i];
      const m = parseInt(row.dataset.midi, 10);
      const inScale = isNoteInScale(m);
      row.classList.toggle('out-of-scale', !inScale);
      keyElements[i].classList.toggle('out-of-scale-key', !inScale);
    }
  }
  renderGridBackground();

  // Dessin des colonnes de pas (quadrillage temporel)
  const stepsOverlay = document.createElement('div');
  stepsOverlay.className = 'pf-pianoroll-steps-overlay';
  for (let s = 0; s < patternLength; s++) {
    const col = document.createElement('div');
    const isBeatHead = s % 4 === 0;
    col.className = 'pf-pianoroll-col' + (isBeatHead ? ' beat-head' : '') + (s === currentStep ? ' cursor-now' : '');
    col.style.left = (s * STEP_WIDTH) + 'px';
    col.style.width = STEP_WIDTH + 'px';
    stepsOverlay.appendChild(col);
  }
  gridArea.appendChild(stepsOverlay);

  // Rendu des notes
  const notesContainer = document.createElement('div');
  notesContainer.className = 'pf-pianoroll-notes-layer';

  function renderNotes() {
    notesContainer.innerHTML = '';
    const currentNotes = (pattern.notes || []).filter((n) => n.ch === channel?.id);

    currentNotes.forEach((note) => {
      const midi = pitchToMidi(note.pitch);
      if (midi < MIN_MIDI || midi > MAX_MIDI) return;

      const top = (MAX_MIDI - midi) * KEY_HEIGHT;
      const left = (note.step || 0) * STEP_WIDTH;
      const width = Math.max(STEP_WIDTH - 2, (note.len || 1) * STEP_WIDTH - 2);

      const el = document.createElement('div');
      el.className = 'pf-pianoroll-note';
      el.style.top = top + 'px';
      el.style.left = left + 'px';
      el.style.width = width + 'px';
      el.style.height = (KEY_HEIGHT - 2) + 'px';

      const label = document.createElement('span');
      label.className = 'pf-note-label';
      label.textContent = midiToPitch(midi);
      el.appendChild(label);

      // Poignee de redimensionnement droite
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'pf-note-resize-handle';
      el.appendChild(resizeHandle);

      // Clic droit = supprimer
      el.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNote(note);
      };

      // Glisser note (deplacement)
      el.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const isResizing = e.target === resizeHandle;
        const startX = e.clientX;
        const startY = e.clientY;
        const initialStep = note.step;
        const initialMidi = midi;
        const initialLen = note.len || 1;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          if (isResizing) {
            const stepDelta = Math.round(dx / STEP_WIDTH);
            const newLen = Math.max(1, Math.min(patternLength - note.step, initialLen + stepDelta));
            note.len = newLen;
            el.style.width = (newLen * STEP_WIDTH - 2) + 'px';
          } else {
            const stepDelta = Math.round(dx / STEP_WIDTH);
            const midiDelta = -Math.round(dy / KEY_HEIGHT);

            const newStep = Math.max(0, Math.min(patternLength - (note.len || 1), initialStep + stepDelta));
            const newMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, initialMidi + midiDelta));

            note.step = newStep;
            note.pitch = midiToPitch(newMidi);
            el.style.left = (newStep * STEP_WIDTH) + 'px';
            el.style.top = ((MAX_MIDI - newMidi) * KEY_HEIGHT) + 'px';
            label.textContent = note.pitch;
          }
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onNotesChange?.();
          playAudition(pitchToMidi(note.pitch));
          renderNotes();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      notesContainer.appendChild(el);
    });
  }

  function addNote(midi, step) {
    if (!channel) return;
    pattern.notes = pattern.notes || [];

    if (chordMode !== 'none' && CHORDS[chordMode]) {
      // Ajout de l'accord
      const chord = CHORDS[chordMode];
      chord.semitones.forEach((offset) => {
        const chordMidi = midi + offset;
        if (chordMidi <= MAX_MIDI) {
          pattern.notes.push({
            ch: channel.id,
            step,
            pitch: midiToPitch(chordMidi),
            len: 2,
            vel: 1
          });
        }
      });
    } else {
      // Note simple
      pattern.notes.push({
        ch: channel.id,
        step,
        pitch: midiToPitch(midi),
        len: 1,
        vel: 1
      });
    }
    onNotesChange?.();
    playAudition(midi);
    renderNotes();
  }

  function deleteNote(note) {
    pattern.notes = (pattern.notes || []).filter((n) => n !== note);
    onNotesChange?.();
    renderNotes();
  }

  // Clic sur la grille pour poser une note
  gridArea.onmousedown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.pf-pianoroll-note')) return;

    const rect = gridArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const step = Math.max(0, Math.min(patternLength - 1, Math.floor(x / STEP_WIDTH)));
    let midi = MAX_MIDI - Math.floor(y / KEY_HEIGHT);
    midi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, midi));

    // Aimantation a la gamme active
    if (!isNoteInScale(midi)) {
      if (isNoteInScale(midi - 1)) midi = midi - 1;
      else if (isNoteInScale(midi + 1)) midi = midi + 1;
    }

    addNote(midi, step);
  };

  renderNotes();
  gridArea.appendChild(notesContainer);
  scrollWrapper.appendChild(gridArea);

  body.appendChild(keyboardCol);
  body.appendChild(scrollWrapper);
  root.appendChild(body);

  // Centrage vertical initial sur C4 (MIDI 60)
  setTimeout(() => {
    const targetY = (MAX_MIDI - 64) * KEY_HEIGHT;
    scrollWrapper.scrollTop = targetY;
  }, 10);

  // 3. Clavier ordinateur interactif (AZERTY / QWERTY)
  const KEY_MAP = {
    KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66, KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72,
    KeyQ: 60, KeyZ: 62, KeyX: 64, KeyC: 65, KeyV: 67, KeyB: 69, KeyN: 71
  };

  const onKeyDown = (e) => {
    if (!container.isConnected || container.getClientRects().length === 0) return; // onglet masqué
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (KEY_MAP[e.code]) {
      e.preventDefault();
      const midi = KEY_MAP[e.code];
      playAudition(midi);
      const k = keyboardCol.querySelector(`[data-midi="${midi}"]`);
      if (k) {
        k.classList.add('playing');
        setTimeout(() => k.classList.remove('playing'), 150);
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);
  cleanups.push(() => window.removeEventListener('keydown', onKeyDown));

  container.appendChild(root);

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
