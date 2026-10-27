// PixelForge Music Studio — Piano Roll interactif avec aides musicales,
// velocite, quantification, accords, arpegiateur, selection, copier/coller,
// clavier MIDI (Web MIDI) et enregistrement en direct.
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
  blues: { name: 'Blues chiptune', intervals: [0, 3, 5, 6, 7, 10] },
};

export const CHORDS = {
  maj: { name: 'Majeur', semitones: [0, 4, 7] },
  min: { name: 'Mineur', semitones: [0, 3, 7] },
  maj7: { name: '7e majeure', semitones: [0, 4, 7, 11] },
  dom7: { name: '7e de dominante', semitones: [0, 4, 7, 10] },
  min7: { name: '7e mineure', semitones: [0, 3, 7, 10] },
  sus4: { name: 'Sus4', semitones: [0, 5, 7] },
  sus2: { name: 'Sus2', semitones: [0, 2, 7] },
  dim: { name: 'Diminue', semitones: [0, 3, 6] },
  aug: { name: 'Augmente', semitones: [0, 4, 8] },
  octave: { name: 'Octave', semitones: [0, 12] },
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

// Presse-papier interne partagé pour le Piano Roll
let clipboardNotes = [];

export function renderPianoRoll(container, opts) {
  const {
    song,
    activePatternId,
    selectedChannelId,
    chip,
    currentStep = -1,
    getCurrentStep,
    getIsPlaying,
    startPlayback,
    stopPlayback,
    onNotesChange,
    onChannelChange,
  } = opts;

  container.innerHTML = '';
  const cleanups = [];

  const channel = (song.channels || []).find((c) => c.id === selectedChannelId) || song.channels?.[0];
  const pattern = (song.patterns || []).find((p) => p.id === activePatternId) || song.patterns?.[0] || { length: 16, notes: [] };
  const patternLength = pattern.length || 16;

  // Reglage echelle et dimensions
  const KEY_HEIGHT = 18;
  const STEP_WIDTH = 28;
  const MIN_MIDI = 36; // C2
  const MAX_MIDI = 84; // C6
  const TOTAL_KEYS = MAX_MIDI - MIN_MIDI + 1;

  let currentScaleKey = 'chromatic';
  let currentRootNote = 0; // C
  let chordMode = 'none'; // 'none' ou cle de CHORDS
  let currentQuantize = 1; // 1 = 1/16, 2 = 1/8, 4 = 1/4
  let quantizeOnRecord = true;
  let isRecording = false;
  let currentOctave = 4;
  let showVelocityLane = true;

  // Selection de notes
  const selectedNotes = new Set();
  const activeRecordNotes = new Map(); // MIDI -> { note, startStep }

  const root = document.createElement('div');
  root.className = 'pf-pianoroll-root';

  // 1. Barre d'outils du piano roll
  const toolbar = document.createElement('div');
  toolbar.className = 'pf-pianoroll-toolbar';

  // Info canal
  const channelBadge = document.createElement('div');
  channelBadge.className = 'pf-pianoroll-channel-info';
  channelBadge.innerHTML = `<strong>${esc(channel?.name || 'Canal')}</strong> <span class="pf-channel-inst">${esc(channel?.instrument || 'pulse50')}</span>`;
  toolbar.appendChild(channelBadge);

  const sep0 = document.createElement('div');
  sep0.className = 'pf-transport-sep';
  toolbar.appendChild(sep0);

  // Bouton REC (Enregistrement en direct)
  const btnRec = document.createElement('button');
  btnRec.className = 'pf-btn-rec';
  btnRec.innerHTML = '<span style="font-size:12px;line-height:1;">&#9679;</span> Enr.';
  btnRec.title = 'Activer l\'enregistrement en direct au clavier MIDI ou d\'ordinateur';
  btnRec.onclick = () => {
    isRecording = !isRecording;
    btnRec.classList.toggle('active', isRecording);
    if (isRecording && getIsPlaying && !getIsPlaying()) {
      startPlayback?.(0);
    }
  };
  toolbar.appendChild(btnRec);

  const sep1 = document.createElement('div');
  sep1.className = 'pf-transport-sep';
  toolbar.appendChild(sep1);

  // Selecteur de pas de quantification
  const quantizeSelect = document.createElement('select');
  quantizeSelect.className = 'pf-transport-val';
  quantizeSelect.title = 'Grille de quantification';
  quantizeSelect.innerHTML = `
    <option value="1">Grille : 1/16 (1 pas)</option>
    <option value="2">Grille : 1/8 (2 pas)</option>
    <option value="4">Grille : 1/4 (4 pas)</option>
  `;
  quantizeSelect.onchange = (e) => {
    currentQuantize = parseInt(e.target.value, 10);
  };
  toolbar.appendChild(quantizeSelect);

  // Bouton Quantifier (Q)
  const btnQuantize = document.createElement('button');
  btnQuantize.className = 'pf-btn-add-channel';
  btnQuantize.style.padding = '4px 8px';
  btnQuantize.style.fontSize = '11px';
  btnQuantize.innerHTML = getIconSvg('check', 12) + ' Quantifier (Q)';
  btnQuantize.title = 'Quantifier les notes selectionnees ou toutes les notes du canal sur la grille active';
  btnQuantize.onclick = () => quantizeNotes();
  toolbar.appendChild(btnQuantize);

  // Checkbox Quantifier à l'enregistrement
  const quantizeRecLabel = document.createElement('label');
  quantizeRecLabel.style.display = 'inline-flex';
  quantizeRecLabel.style.alignItems = 'center';
  quantizeRecLabel.style.gap = '4px';
  quantizeRecLabel.style.fontSize = '11px';
  quantizeRecLabel.style.color = '#94b0c2';
  quantizeRecLabel.style.cursor = 'pointer';
  quantizeRecLabel.title = 'Quantifier automatiquement lors de l\'enregistrement en direct';
  const quantizeRecCheck = document.createElement('input');
  quantizeRecCheck.type = 'checkbox';
  quantizeRecCheck.checked = quantizeOnRecord;
  quantizeRecCheck.onchange = (e) => { quantizeOnRecord = e.target.checked; };
  quantizeRecLabel.appendChild(quantizeRecCheck);
  quantizeRecLabel.appendChild(document.createTextNode('Quant. REC'));
  toolbar.appendChild(quantizeRecLabel);

  const sep2 = document.createElement('div');
  sep2.className = 'pf-transport-sep';
  toolbar.appendChild(sep2);

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
  btnArp.innerHTML = getIconSvg('music', 12) + ' Arpeger';
  btnArp.title = 'Convertir ou injecter un arpege chiptune rapide dans le canal';
  btnArp.onclick = () => {
    const choice = prompt('Entrez les demi-tons de l\'arpege chiptune separes par des virgules (ex: 0, 4, 7 pour Majeur, 0, 3, 7 pour Mineur) :', '0, 4, 7');
    if (!choice) return;
    const parts = choice.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (parts.length > 0 && channel) {
      onChannelChange?.(channel.id, { arp: parts });
    }
  };
  toolbar.appendChild(btnArp);

  const sep3 = document.createElement('div');
  sep3.className = 'pf-transport-sep';
  toolbar.appendChild(sep3);

  // Controle de l'octave du clavier PC
  const octaveContainer = document.createElement('div');
  octaveContainer.style.display = 'inline-flex';
  octaveContainer.style.alignItems = 'center';
  octaveContainer.style.gap = '2px';
  octaveContainer.title = 'Octave du clavier d\'ordinateur (- / +)';

  const btnOctMinus = document.createElement('button');
  btnOctMinus.className = 'pf-transport-val';
  btnOctMinus.textContent = '-';
  btnOctMinus.style.cursor = 'pointer';
  btnOctMinus.onclick = () => changeOctave(-1);

  const octaveLabel = document.createElement('span');
  octaveLabel.style.fontSize = '11px';
  octaveLabel.style.color = '#fff';
  octaveLabel.style.padding = '0 4px';
  octaveLabel.textContent = `Oct C${currentOctave}`;

  const btnOctPlus = document.createElement('button');
  btnOctPlus.className = 'pf-transport-val';
  btnOctPlus.textContent = '+';
  btnOctPlus.style.cursor = 'pointer';
  btnOctPlus.onclick = () => changeOctave(1);

  octaveContainer.appendChild(btnOctMinus);
  octaveContainer.appendChild(octaveLabel);
  octaveContainer.appendChild(btnOctPlus);
  toolbar.appendChild(octaveContainer);

  // Badge indicateur MIDI
  const midiBadge = document.createElement('div');
  midiBadge.className = 'pf-midi-indicator';
  midiBadge.textContent = 'MIDI : Detection...';
  midiBadge.title = 'Statut du controleur clavier Web MIDI';
  toolbar.appendChild(midiBadge);

  // Bouton pour afficher/masquer la velocite
  const btnVelocity = document.createElement('button');
  btnVelocity.className = 'pf-btn-add-channel';
  btnVelocity.style.padding = '4px 8px';
  btnVelocity.style.fontSize = '11px';
  btnVelocity.textContent = 'Velocite (V)';
  btnVelocity.title = 'Afficher ou masquer le volet de velocite inferieur';
  btnVelocity.onclick = () => {
    showVelocityLane = !showVelocityLane;
    velocityLane.style.display = showVelocityLane ? 'block' : 'none';
  };
  toolbar.appendChild(btnVelocity);

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

  const keyElements = [];
  const gridRows = [];

  function isNoteInScale(midi) {
    if (currentScaleKey === 'chromatic') return true;
    const scale = SCALES[currentScaleKey];
    if (!scale) return true;
    const relSemi = (midi - currentRootNote + 120) % 12;
    return scale.intervals.includes(relSemi);
  }

  function playAudition(midi, vel = 0.8) {
    if (chip) {
      const instType = typeof channel?.instrument === 'string' ? channel.instrument : (channel?.instrument?.type || 'pulse50');
      const v = Math.max(0.1, Math.min(1.0, vel ?? 0.8));
      chip.scheduleNote({
        pitch: midiToPitch(midi),
        instrument: instType,
        preset: channel?.preset || channel?.instrument?.preset,
        params: channel?.params || channel?.instrument?.params,
        duration: 0.22,
        volume: (channel?.volume != null ? channel.volume : 0.8) * v * 0.75,
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
      onNoteDown(m, 0.8);
      const onUp = () => {
        window.removeEventListener('mouseup', onUp);
        onNoteUp(m);
      };
      window.addEventListener('mouseup', onUp);
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
      el.className = 'pf-pianoroll-note' + (selectedNotes.has(note) ? ' selected' : '');
      el.style.top = top + 'px';
      el.style.left = left + 'px';
      el.style.width = width + 'px';
      el.style.height = (KEY_HEIGHT - 2) + 'px';

      const velVal = note.vel != null ? note.vel : 0.8;
      el.style.background = `rgba(65, 166, 246, ${Math.max(0.35, Math.min(1.0, 0.4 + velVal * 0.6))})`;

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

      // Clic et deplacement
      el.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (selectedNotes.has(note)) selectedNotes.delete(note);
          else selectedNotes.add(note);
          renderNotes();
          renderVelocityStems();
          return;
        }

        if (!selectedNotes.has(note)) {
          selectedNotes.clear();
          selectedNotes.add(note);
          renderNotes();
          renderVelocityStems();
        }

        const isResizing = e.target === resizeHandle;
        const startX = e.clientX;
        const startY = e.clientY;

        const initialStates = new Map();
        selectedNotes.forEach((n) => {
          initialStates.set(n, {
            step: n.step,
            midi: pitchToMidi(n.pitch),
            len: n.len || 1,
          });
        });

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          if (isResizing) {
            const stepDelta = Math.round(dx / STEP_WIDTH);
            selectedNotes.forEach((n) => {
              const init = initialStates.get(n);
              if (!init) return;
              const newLen = Math.max(1, Math.min(patternLength - n.step, init.len + stepDelta));
              n.len = newLen;
            });
          } else {
            const stepDelta = Math.round(dx / STEP_WIDTH);
            const midiDelta = -Math.round(dy / KEY_HEIGHT);

            let valid = true;
            selectedNotes.forEach((n) => {
              const init = initialStates.get(n);
              if (!init) return;
              const targetStep = init.step + stepDelta;
              const targetMidi = init.midi + midiDelta;
              if (targetStep < 0 || targetStep + (n.len || 1) > patternLength) valid = false;
              if (targetMidi < MIN_MIDI || targetMidi > MAX_MIDI) valid = false;
            });

            if (valid) {
              selectedNotes.forEach((n) => {
                const init = initialStates.get(n);
                if (!init) return;
                n.step = init.step + stepDelta;
                n.pitch = midiToPitch(init.midi + midiDelta);
              });
            }
          }
          renderNotes();
          renderVelocityStems();
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onNotesChange?.();
          playAudition(pitchToMidi(note.pitch), note.vel);
          renderNotes();
          renderVelocityStems();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      notesContainer.appendChild(el);
    });
  }

  // Volet de velocite inferieur
  const velocityLane = document.createElement('div');
  velocityLane.className = 'pf-pianoroll-velocity-lane';
  velocityLane.style.width = (patternLength * STEP_WIDTH) + 'px';
  if (!showVelocityLane) velocityLane.style.display = 'none';

  const velGridBg = document.createElement('div');
  velGridBg.className = 'pf-velocity-grid-bg';
  for (let s = 0; s < patternLength; s++) {
    const col = document.createElement('div');
    col.className = 'pf-velocity-col' + (s % 4 === 0 ? ' beat-head' : '');
    col.style.width = STEP_WIDTH + 'px';
    velGridBg.appendChild(col);
  }
  velocityLane.appendChild(velGridBg);

  const velStemsLayer = document.createElement('div');
  velStemsLayer.style.position = 'absolute';
  velStemsLayer.style.top = '0';
  velStemsLayer.style.left = '0';
  velStemsLayer.style.bottom = '0';
  velStemsLayer.style.right = '0';
  velocityLane.appendChild(velStemsLayer);

  function renderVelocityStems() {
    velStemsLayer.innerHTML = '';
    const currentNotes = (pattern.notes || []).filter((n) => n.ch === channel?.id);

    currentNotes.forEach((note) => {
      const stem = document.createElement('div');
      const isSelected = selectedNotes.has(note);
      stem.className = 'pf-velocity-stem' + (isSelected ? ' selected' : '');
      const vel = note.vel != null ? note.vel : 0.8;
      const h = Math.max(6, Math.round(vel * 50));
      stem.style.height = h + 'px';
      stem.style.left = ((note.step || 0) * STEP_WIDTH + (STEP_WIDTH / 2) - 3) + 'px';

      const handle = document.createElement('div');
      handle.className = 'pf-velocity-handle';
      stem.appendChild(handle);

      stem.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const laneRect = velocityLane.getBoundingClientRect();
        const updateVel = (moveEv) => {
          const clampedY = Math.max(0, Math.min(50, 50 - (moveEv.clientY - (laneRect.bottom - 50))));
          const newVel = Math.max(0.05, Math.min(1.0, Math.round((clampedY / 50) * 100) / 100));
          if (selectedNotes.has(note)) {
            selectedNotes.forEach((sn) => { sn.vel = newVel; });
          } else {
            note.vel = newVel;
          }
          renderVelocityStems();
          renderNotes();
        };

        const onUp = () => {
          window.removeEventListener('mousemove', updateVel);
          window.removeEventListener('mouseup', onUp);
          onNotesChange?.();
          playAudition(pitchToMidi(note.pitch), note.vel);
        };

        window.addEventListener('mousemove', updateVel);
        window.addEventListener('mouseup', onUp);
      };

      velStemsLayer.appendChild(stem);
    });
  }

  function addNote(midi, step, len = 1, vel = 0.8) {
    if (!channel) return;
    pattern.notes = pattern.notes || [];

    if (chordMode !== 'none' && CHORDS[chordMode]) {
      const chord = CHORDS[chordMode];
      chord.semitones.forEach((offset) => {
        const chordMidi = midi + offset;
        if (chordMidi <= MAX_MIDI) {
          pattern.notes.push({
            ch: channel.id,
            step,
            pitch: midiToPitch(chordMidi),
            len: Math.max(1, len),
            vel: Math.round(vel * 100) / 100,
          });
        }
      });
    } else {
      pattern.notes.push({
        ch: channel.id,
        step,
        pitch: midiToPitch(midi),
        len: Math.max(1, len),
        vel: Math.round(vel * 100) / 100,
      });
    }
    onNotesChange?.();
    playAudition(midi, vel);
    renderNotes();
    renderVelocityStems();
  }

  function deleteNote(note) {
    pattern.notes = (pattern.notes || []).filter((n) => n !== note);
    selectedNotes.delete(note);
    onNotesChange?.();
    renderNotes();
    renderVelocityStems();
  }

  function quantizeNotes() {
    const target = selectedNotes.size > 0
      ? Array.from(selectedNotes)
      : (pattern.notes || []).filter((n) => n.ch === channel?.id);

    target.forEach((n) => {
      n.step = Math.round(n.step / currentQuantize) * currentQuantize;
      n.len = Math.max(currentQuantize, Math.round((n.len || 1) / currentQuantize) * currentQuantize);
      if (n.step + n.len > patternLength) {
        n.len = Math.max(1, patternLength - n.step);
      }
    });

    onNotesChange?.();
    renderNotes();
    renderVelocityStems();
  }

  function copySelection() {
    if (selectedNotes.size === 0) return;
    const notesArr = Array.from(selectedNotes);
    const minStep = Math.min(...notesArr.map((n) => n.step));
    clipboardNotes = notesArr.map((n) => ({
      pitch: n.pitch,
      relStep: n.step - minStep,
      len: n.len || 1,
      vel: n.vel ?? 0.8,
    }));
  }

  function cutSelection() {
    copySelection();
    deleteSelection();
  }

  function pasteSelection() {
    if (clipboardNotes.length === 0 || !channel) return;
    let pasteStep = getCurrentStep ? getCurrentStep() : 0;
    if (pasteStep < 0) pasteStep = 0;

    selectedNotes.clear();
    pattern.notes = pattern.notes || [];

    clipboardNotes.forEach((clip) => {
      const step = Math.min(patternLength - 1, pasteStep + clip.relStep);
      const len = Math.max(1, Math.min(patternLength - step, clip.len));
      const newNote = {
        ch: channel.id,
        step,
        pitch: clip.pitch,
        len,
        vel: clip.vel,
      };
      pattern.notes.push(newNote);
      selectedNotes.add(newNote);
    });

    onNotesChange?.();
    renderNotes();
    renderVelocityStems();
  }

  function duplicateSelection() {
    if (selectedNotes.size === 0 || !channel) return;
    const notesArr = Array.from(selectedNotes);
    const minStep = Math.min(...notesArr.map((n) => n.step));
    const maxEnd = Math.max(...notesArr.map((n) => n.step + (n.len || 1)));
    const duration = maxEnd - minStep;

    selectedNotes.clear();
    notesArr.forEach((n) => {
      const newStep = n.step + duration;
      if (newStep < patternLength) {
        const newLen = Math.min(patternLength - newStep, n.len || 1);
        const dupNote = {
          ch: channel.id,
          step: newStep,
          pitch: n.pitch,
          len: newLen,
          vel: n.vel ?? 0.8,
        };
        pattern.notes.push(dupNote);
        selectedNotes.add(dupNote);
      }
    });

    onNotesChange?.();
    renderNotes();
    renderVelocityStems();
  }

  function deleteSelection() {
    if (selectedNotes.size === 0) return;
    pattern.notes = (pattern.notes || []).filter((n) => !selectedNotes.has(n));
    selectedNotes.clear();
    onNotesChange?.();
    renderNotes();
    renderVelocityStems();
  }

  function selectAll() {
    selectedNotes.clear();
    (pattern.notes || []).filter((n) => n.ch === channel?.id).forEach((n) => selectedNotes.add(n));
    renderNotes();
    renderVelocityStems();
  }

  function changeOctave(delta) {
    currentOctave = Math.max(1, Math.min(7, currentOctave + delta));
    octaveLabel.textContent = `Oct C${currentOctave}`;
  }

  // Evenements Note On / Note Off pour le direct (MIDI + Clavier PC)
  function onNoteDown(midi, vel = 0.8) {
    if (isRecording) {
      if (getIsPlaying && !getIsPlaying()) {
        startPlayback?.(0);
      }
      let step = getCurrentStep ? getCurrentStep() : 0;
      if (step < 0) step = 0;
      if (quantizeOnRecord) {
        step = Math.round(step / currentQuantize) * currentQuantize;
      }
      step = Math.max(0, Math.min(patternLength - 1, step));

      pattern.notes = pattern.notes || [];
      const newNote = {
        ch: channel.id,
        step,
        pitch: midiToPitch(midi),
        len: currentQuantize,
        vel: Math.round(vel * 100) / 100,
      };
      pattern.notes.push(newNote);
      activeRecordNotes.set(midi, { note: newNote, startStep: step });
      renderNotes();
      renderVelocityStems();
    }
  }

  function onNoteUp(midi) {
    if (isRecording && activeRecordNotes.has(midi)) {
      const { note, startStep } = activeRecordNotes.get(midi);
      activeRecordNotes.delete(midi);
      let curStep = getCurrentStep ? getCurrentStep() : startStep;
      if (curStep < startStep) curStep = startStep;
      let len = curStep - startStep + 1;
      if (quantizeOnRecord) {
        len = Math.max(currentQuantize, Math.round(len / currentQuantize) * currentQuantize);
      }
      note.len = Math.max(1, Math.min(patternLength - note.step, len));
      onNotesChange?.();
      renderNotes();
      renderVelocityStems();
    }
  }

  // Clic sur la grille : selection lasso ou ajout de note
  gridArea.onmousedown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.pf-pianoroll-note')) return;

    const rect = gridArea.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    let hasMoved = false;
    let marqueeEl = null;

    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      selectedNotes.clear();
      renderNotes();
      renderVelocityStems();
    }

    const onGridMove = (moveEv) => {
      const curX = moveEv.clientX - rect.left;
      const curY = moveEv.clientY - rect.top;
      const dist = Math.hypot(curX - startX, curY - startY);

      if (dist > 6) {
        hasMoved = true;
        if (!marqueeEl) {
          marqueeEl = document.createElement('div');
          marqueeEl.className = 'pf-pianoroll-marquee';
          gridArea.appendChild(marqueeEl);
        }

        const left = Math.min(startX, curX);
        const top = Math.min(startY, curY);
        const width = Math.abs(curX - startX);
        const height = Math.abs(curY - startY);

        marqueeEl.style.left = left + 'px';
        marqueeEl.style.top = top + 'px';
        marqueeEl.style.width = width + 'px';
        marqueeEl.style.height = height + 'px';

        // Intersection avec les notes
        const currentNotes = (pattern.notes || []).filter((n) => n.ch === channel?.id);
        currentNotes.forEach((n) => {
          const midi = pitchToMidi(n.pitch);
          const nTop = (MAX_MIDI - midi) * KEY_HEIGHT;
          const nLeft = (n.step || 0) * STEP_WIDTH;
          const nWidth = (n.len || 1) * STEP_WIDTH;
          const nHeight = KEY_HEIGHT;

          const intersects = !(left > nLeft + nWidth || left + width < nLeft || top > nTop + nHeight || top + height < nTop);
          if (intersects) selectedNotes.add(n);
        });
        renderNotes();
        renderVelocityStems();
      }
    };

    const onGridUp = () => {
      window.removeEventListener('mousemove', onGridMove);
      window.removeEventListener('mouseup', onGridUp);

      if (marqueeEl) {
        marqueeEl.remove();
      }

      if (!hasMoved) {
        // Clic simple = poser une note
        const step = Math.max(0, Math.min(patternLength - 1, Math.floor(startX / STEP_WIDTH)));
        let midi = MAX_MIDI - Math.floor(startY / KEY_HEIGHT);
        midi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, midi));

        // Aimantation a la gamme active
        if (!isNoteInScale(midi)) {
          if (isNoteInScale(midi - 1)) midi = midi - 1;
          else if (isNoteInScale(midi + 1)) midi = midi + 1;
        }

        addNote(midi, step, currentQuantize, 0.8);
      }
    };

    window.addEventListener('mousemove', onGridMove);
    window.addEventListener('mouseup', onGridUp);
  };

  renderNotes();
  renderVelocityStems();
  gridArea.appendChild(notesContainer);
  scrollWrapper.appendChild(gridArea);
  scrollWrapper.appendChild(velocityLane);

  body.appendChild(keyboardCol);
  body.appendChild(scrollWrapper);
  root.appendChild(body);

  // Centrage vertical initial sur C4 (MIDI 60)
  setTimeout(() => {
    const targetY = (MAX_MIDI - 64) * KEY_HEIGHT;
    scrollWrapper.scrollTop = targetY;
  }, 10);

  // 3. Web MIDI API
  function initMIDI() {
    if (typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function') {
      navigator.requestMIDIAccess().then(
        (access) => {
          const updateInputs = () => {
            const inputs = Array.from(access.inputs.values());
            if (inputs.length > 0) {
              midiBadge.classList.add('connected');
              midiBadge.textContent = `MIDI : ${inputs[0].name || 'Connecté'}`;
            } else {
              midiBadge.classList.remove('connected');
              midiBadge.textContent = 'MIDI : Prêt (0 contrôleur)';
            }

            inputs.forEach((input) => {
              input.onmidimessage = (event) => {
                const [status, noteNumber, velocity] = event.data;
                const cmd = status >> 4;
                if (cmd === 9 && velocity > 0) {
                  // Note On
                  midiBadge.classList.add('active-signal');
                  setTimeout(() => midiBadge.classList.remove('active-signal'), 120);
                  playAudition(noteNumber, velocity / 127);
                  onNoteDown(noteNumber, velocity / 127);
                  const keyEl = keyboardCol.querySelector(`[data-midi="${noteNumber}"]`);
                  if (keyEl) {
                    keyEl.classList.add('playing');
                    setTimeout(() => keyEl.classList.remove('playing'), 150);
                  }
                } else if (cmd === 8 || (cmd === 9 && velocity === 0)) {
                  // Note Off
                  onNoteUp(noteNumber);
                }
              };
            });
          };

          updateInputs();
          access.onstatechange = updateInputs;
        },
        () => {
          midiBadge.textContent = 'MIDI : Non autorisé';
        }
      );
    } else {
      midiBadge.textContent = 'MIDI : Clavier PC actif';
    }
  }
  initMIDI();

  // Expositions globales pour simulation de tests E2E / automatisés
  window.__pfSimulateMidiNoteOn = (midi, vel = 0.8) => {
    midiBadge.classList.add('active-signal');
    setTimeout(() => midiBadge.classList.remove('active-signal'), 120);
    playAudition(midi, vel);
    onNoteDown(midi, vel);
  };
  window.__pfSimulateMidiNoteOff = (midi) => {
    onNoteUp(midi);
  };
  cleanups.push(() => {
    delete window.__pfSimulateMidiNoteOn;
    delete window.__pfSimulateMidiNoteOff;
  });

  // 4. Clavier d'ordinateur comme piano (AZERTY / QWERTY sur 2 octaves)
  const BASE_KEY_MAP = {
    // Octave 1
    KeyQ: 0, KeyA: 0,
    KeyZ: 1, KeyW: 1,
    KeyS: 2,
    KeyE: 3,
    KeyD: 4,
    KeyF: 5,
    KeyT: 6,
    KeyG: 7,
    KeyY: 8,
    KeyH: 9,
    KeyU: 10,
    KeyJ: 11,
    // Octave 2 (+12)
    KeyK: 12,
    KeyO: 13,
    KeyL: 14,
    KeyP: 15,
    Semicolon: 16,
  };

  const activeHeldKeys = new Set();

  const onKeyDown = (e) => {
    if (!container.isConnected || container.getClientRects().length === 0) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    // Raccourcis clavier d'édition
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
      e.preventDefault();
      selectAll();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
      e.preventDefault();
      copySelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
      e.preventDefault();
      cutSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
      e.preventDefault();
      pasteSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
      e.preventDefault();
      duplicateSelection();
      return;
    }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      e.preventDefault();
      deleteSelection();
      return;
    }
    if (e.code === 'KeyQ' && (e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      quantizeNotes();
      return;
    }
    if (e.code === 'BracketLeft' || e.code === 'Minus') {
      changeOctave(-1);
      return;
    }
    if (e.code === 'BracketRight' || e.code === 'Equal') {
      changeOctave(1);
      return;
    }

    if (BASE_KEY_MAP[e.code] !== undefined && !activeHeldKeys.has(e.code) && !e.repeat) {
      e.preventDefault();
      activeHeldKeys.add(e.code);
      const midi = (currentOctave + 1) * 12 + BASE_KEY_MAP[e.code];
      playAudition(midi, 0.85);
      onNoteDown(midi, 0.85);
      const k = keyboardCol.querySelector(`[data-midi="${midi}"]`);
      if (k) k.classList.add('playing');
    }
  };

  const onKeyUp = (e) => {
    if (activeHeldKeys.has(e.code)) {
      activeHeldKeys.delete(e.code);
      const midi = (currentOctave + 1) * 12 + BASE_KEY_MAP[e.code];
      onNoteUp(midi);
      const k = keyboardCol.querySelector(`[data-midi="${midi}"]`);
      if (k) k.classList.remove('playing');
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  cleanups.push(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });

  container.appendChild(root);

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
