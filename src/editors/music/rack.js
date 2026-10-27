// PixelForge Music Studio — Channel Rack (FL Studio style)
import { getIconSvg } from '../../ui/icons.js';
import { DRUM_PATTERNS } from '../../audio/presets/drums.js';
import { INSTRUMENT_PRESETS } from '../../audio/chip.js';

const DRUM_KIT_VOICES = [
  { id: 'kick', name: 'Grosse caisse (Kick)', pitch: 'C3' },
  { id: 'snare', name: 'Caisse claire (Snare)', pitch: 'D3' },
  { id: 'hat_closed', name: 'Charleston ferme (Closed Hat)', pitch: 'F#3' },
  { id: 'hat_open', name: 'Charleston ouvert (Open Hat)', pitch: 'A#3' },
  { id: 'tom', name: 'Tom basse', pitch: 'G3' }
];

const INSTRUMENT_OPTIONS = [
  { id: 'pulse50', name: 'Pulse 50% (Lead NES standard)' },
  { id: 'pulse25', name: 'Pulse 25% (Lead carillon / brillant)' },
  { id: 'pulse12', name: 'Pulse 12.5% (Pluck fin / nasal)' },
  { id: 'triangle', name: 'Triangle (Basse NES)' },
  { id: 'saw', name: 'Dent de scie (Lead epique)' },
  { id: 'noise', name: 'Bruit LFSR (Batterie / Percussion)' },
  { id: 'wave', name: 'Table d\'onde (SCC / Game Boy)' },
  { id: 'synth_sub', name: 'Synthe Soustractif (2 Osc + Filtre + LFO)' },
  { id: 'synth_fm', name: 'Synthe FM 4 Operateurs (DX)' },
  { id: 'drum_machine', name: 'Boite a Rythmes (Pads)' },
  { id: 'sampler', name: 'Sampler Polyphonique' }
];

export function renderChannelRack(container, opts) {
  const {
    song,
    activePatternId,
    currentStep = -1,
    onStepToggle,
    onChannelChange,
    onAddChannel,
    onDeleteChannel,
    onChannelSelect,
    selectedChannelId = null,
    onApplyDrumPattern = null,
    onAudition = null
  } = opts;

  container.innerHTML = '';
  const pattern = (song.patterns || []).find((p) => p.id === activePatternId) || song.patterns?.[0] || { length: 16, notes: [] };
  const patternLength = pattern.length || 16;
  const notes = pattern.notes || [];

  const rack = document.createElement('div');
  rack.className = 'pf-music-rack';

  // 1. En-tete avec reglette de pas (ruler)
  const header = document.createElement('div');
  header.className = 'pf-rack-header';

  const colInfo = document.createElement('div');
  colInfo.className = 'pf-rack-col-info';
  colInfo.textContent = 'Canaux / Instruments';

  const colSteps = document.createElement('div');
  colSteps.className = 'pf-rack-col-steps';

  const ruler = document.createElement('div');
  ruler.className = 'pf-step-ruler';
  for (let s = 0; s < patternLength; s++) {
    const num = document.createElement('div');
    const isBeatHead = s % 4 === 0;
    num.className = 'pf-step-ruler-num' + (isBeatHead ? ' beat-head' : '');
    num.textContent = isBeatHead ? String((s / 4) + 1) : String((s % 4) + 1);
    ruler.appendChild(num);
  }
  colSteps.appendChild(ruler);
  header.appendChild(colInfo);
  header.appendChild(colSteps);
  rack.appendChild(header);

  let isPainting = false;
  let paintValue = true; // true pour allumer, false pour eteindre

  const handleStepMouseDown = (e, chId, stepIndex, pitch) => {
    e.preventDefault();
    if (e.button === 2) {
      // Clic droit = effacer
      paintValue = false;
      onStepToggle?.(chId, stepIndex, pitch, false);
    } else {
      // Clic gauche = inverser
      const hasNote = notes.some((n) => n.ch === chId && n.step === stepIndex && (!pitch || n.pitch === pitch));
      paintValue = !hasNote;
      onStepToggle?.(chId, stepIndex, pitch, paintValue);
    }
    isPainting = true;
  };

  const handleStepMouseEnter = (chId, stepIndex, pitch) => {
    if (!isPainting) return;
    onStepToggle?.(chId, stepIndex, pitch, paintValue);
  };

  const stopPainting = () => { isPainting = false; };
  window.addEventListener('mouseup', stopPainting);

  // 2. Lignes de chaque canal
  (song.channels || []).forEach((ch) => {
    const row = document.createElement('div');
    row.className = 'pf-rack-row' + (selectedChannelId === ch.id ? ' active' : '');

    // Info canal (Mute, Solo, Nom, Instrument, Volume, Pan)
    const info = document.createElement('div');
    info.className = 'pf-channel-info';

    const btnMute = document.createElement('button');
    btnMute.className = 'pf-btn-mute' + (ch.mute ? ' active' : '');
    btnMute.textContent = 'M';
    btnMute.title = 'Muet (Mute)';
    btnMute.onclick = (e) => { e.stopPropagation(); onChannelChange?.(ch.id, { mute: !ch.mute }); };

    const btnSolo = document.createElement('button');
    btnSolo.className = 'pf-btn-solo' + (ch.solo ? ' active' : '');
    btnSolo.textContent = 'S';
    btnSolo.title = 'Solo';
    btnSolo.onclick = (e) => { e.stopPropagation(); onChannelChange?.(ch.id, { solo: !ch.solo }); };

    const btnAudition = document.createElement('button');
    btnAudition.className = 'pf-transport-btn';
    btnAudition.style.width = '20px';
    btnAudition.style.height = '20px';
    btnAudition.innerHTML = getIconSvg('play', 10);
    btnAudition.title = 'Ecouter l\'instrument / prereglage (1-clic)';
    btnAudition.onclick = (e) => {
      e.stopPropagation();
      onAudition?.(ch);
    };

    const nameSpan = document.createElement('div');
    nameSpan.className = 'pf-channel-name';
    nameSpan.textContent = ch.name || 'Canal';
    const presetLabel = ch.preset && INSTRUMENT_PRESETS[ch.preset] ? ` [${INSTRUMENT_PRESETS[ch.preset].name}]` : '';
    nameSpan.title = 'Cliquer pour selectionner' + (presetLabel ? ' - ' + presetLabel : '');
    nameSpan.onclick = () => onChannelSelect?.(ch.id);

    // Instrument selector
    const instBadge = document.createElement('select');
    instBadge.className = 'pf-channel-inst';
    const currentInstId = typeof ch.instrument === 'string' ? ch.instrument : (ch.instrument?.type || 'pulse50');
    INSTRUMENT_OPTIONS.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.id;
      o.textContent = opt.id;
      o.selected = currentInstId === opt.id;
      instBadge.appendChild(o);
    });
    instBadge.onchange = (e) => {
      const newInst = e.target.value;
      const patch = { instrument: newInst };
      if ((newInst === 'noise' || newInst === 'drum_machine') && ch.drumKit === undefined) patch.drumKit = true;
      onChannelChange?.(ch.id, patch);
    };

    // Sliders Volume & Pan
    const knobs = document.createElement('div');
    knobs.className = 'pf-channel-knobs';

    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'pf-mini-slider';
    volSlider.min = '0';
    volSlider.max = '1';
    volSlider.step = '0.05';
    volSlider.value = String(ch.volume != null ? ch.volume : 0.8);
    volSlider.title = 'Volume : ' + Math.round((ch.volume != null ? ch.volume : 0.8) * 100) + '%';
    volSlider.oninput = (e) => onChannelChange?.(ch.id, { volume: parseFloat(e.target.value) });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'pf-transport-btn';
    btnDelete.style.width = '20px';
    btnDelete.style.height = '20px';
    btnDelete.innerHTML = getIconSvg('trash', 11);
    btnDelete.title = 'Supprimer le canal';
    btnDelete.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Supprimer le canal ' + ch.name + ' ?')) onDeleteChannel?.(ch.id);
    };

    knobs.appendChild(volSlider);
    knobs.appendChild(btnDelete);

    info.appendChild(btnMute);
    info.appendChild(btnSolo);
    info.appendChild(btnAudition);
    info.appendChild(nameSpan);
    info.appendChild(instBadge);
    info.appendChild(knobs);
    row.appendChild(info);

    // Pas du canal (si pas en drumKit expanse)
    const isDrumKit = (currentInstId === 'noise' || currentInstId === 'drum_machine') && ch.drumKit;
    if (!isDrumKit) {
      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'pf-rack-steps';

      const instClass = currentInstId.startsWith('pulse') ? 'inst-pulse'
        : currentInstId === 'triangle' ? 'inst-triangle'
        : currentInstId === 'saw' ? 'inst-saw'
        : (currentInstId === 'noise' || currentInstId === 'drum_machine') ? 'inst-noise' : '';

      for (let s = 0; s < patternLength; s++) {
        const btn = document.createElement('button');
        const isAlt = Math.floor(s / 4) % 2 === 1;
        const hasNote = notes.some((n) => n.ch === ch.id && n.step === s);
        const isCursor = s === currentStep;

        btn.className = 'pf-step-btn'
          + (isAlt ? ' beat-alt' : '')
          + (hasNote ? ' active ' + instClass : '')
          + (isCursor ? ' cursor-now' : '');

        btn.onmousedown = (e) => handleStepMouseDown(e, ch.id, s, ch.defaultPitch || 'C4');
        btn.onmouseenter = () => handleStepMouseEnter(ch.id, s, ch.defaultPitch || 'C4');
        btn.oncontextmenu = (e) => e.preventDefault();

        stepsDiv.appendChild(btn);
      }
      row.appendChild(stepsDiv);
      rack.appendChild(row);
    } else {
      // Drum Kit : rangée principale + barre de modèles + 5 sous-pistes
      rack.appendChild(row);

      const tmplBar = document.createElement('div');
      tmplBar.className = 'pf-drum-subrow';
      tmplBar.style.padding = '4px 10px';
      tmplBar.style.background = '#151827';
      tmplBar.style.display = 'flex';
      tmplBar.style.alignItems = 'center';
      tmplBar.style.gap = '8px';

      const tmplLabel = document.createElement('span');
      tmplLabel.style.fontSize = '11px';
      tmplLabel.style.color = '#8b90a8';
      tmplLabel.textContent = 'Modèle rythmique :';
      tmplBar.appendChild(tmplLabel);

      const tmplSelect = document.createElement('select');
      tmplSelect.className = 'pf-transport-val';
      tmplSelect.style.fontSize = '11px';
      tmplSelect.style.padding = '2px 6px';
      tmplSelect.innerHTML = '<option value="" disabled selected>Appliquer un modèle (1-clic)...</option>'
        + Object.values(DRUM_PATTERNS).map((p) => `<option value="${p.id}">${p.name}</option>`).join('');

      tmplSelect.onchange = (e) => {
        const patternId = e.target.value;
        if (!patternId) return;
        onApplyDrumPattern?.(patternId, ch.id);
        tmplSelect.selectedIndex = 0;
      };
      tmplBar.appendChild(tmplSelect);
      rack.appendChild(tmplBar);

      DRUM_KIT_VOICES.forEach((voice) => {
        const subRow = document.createElement('div');
        subRow.className = 'pf-drum-subrow';

        const label = document.createElement('div');
        label.className = 'pf-drum-label';
        label.textContent = voice.name;
        subRow.appendChild(label);

        const drumSteps = document.createElement('div');
        drumSteps.className = 'pf-rack-steps';

        for (let s = 0; s < patternLength; s++) {
          const btn = document.createElement('button');
          const isAlt = Math.floor(s / 4) % 2 === 1;
          const hasNote = notes.some((n) => n.ch === ch.id && n.step === s && n.pitch === voice.pitch);
          const isCursor = s === currentStep;

          btn.className = 'pf-step-btn'
            + (isAlt ? ' beat-alt' : '')
            + (hasNote ? ' active inst-noise' : '')
            + (isCursor ? ' cursor-now' : '');

          btn.onmousedown = (e) => handleStepMouseDown(e, ch.id, s, voice.pitch);
          btn.onmouseenter = () => handleStepMouseEnter(ch.id, s, voice.pitch);
          btn.oncontextmenu = (e) => e.preventDefault();

          drumSteps.appendChild(btn);
        }

        subRow.appendChild(drumSteps);
        rack.appendChild(subRow);
      });
    }
  });

  // 3. Barre d'ajout de canal
  const addBar = document.createElement('div');
  addBar.className = 'pf-rack-add-bar';

  const addMenu = document.createElement('select');
  addMenu.className = 'pf-btn-add-channel';
  addMenu.innerHTML = '<option value="" disabled selected>+ Ajouter un canal ou prereglage...</option>'
    + '<optgroup label="Prereglages d\'instruments (1-clic)">'
    + Object.entries(INSTRUMENT_PRESETS).map(([k, p]) => `<option value="preset:${k}">${p.name} (${p.category})</option>`).join('')
    + '</optgroup>'
    + '<optgroup label="Instruments DAW">'
    + '<option value="inst:synth_sub">Synthe Soustractif (2 Osc + Filtre + LFO)</option>'
    + '<option value="inst:synth_fm">Synthe FM 4 Operateurs (DX)</option>'
    + '<option value="inst:drum_machine">Boite a Rythmes (Pads)</option>'
    + '<option value="inst:sampler">Sampler Polyphonique</option>'
    + '</optgroup>'
    + '<optgroup label="Chiptune Authentique">'
    + INSTRUMENT_OPTIONS.slice(0, 7).map((o) => `<option value="inst:${o.id}">${o.name}</option>`).join('')
    + '</optgroup>';

  addMenu.onchange = (e) => {
    const val = e.target.value;
    if (!val) return;
    if (val.startsWith('preset:')) {
      const presetKey = val.slice(7);
      const p = INSTRUMENT_PRESETS[presetKey];
      if (p) {
        onAddChannel?.(p.type, p.name, { preset: presetKey, params: p.params });
      }
    } else if (val.startsWith('inst:')) {
      const inst = val.slice(5);
      const defaultNames = {
        pulse50: 'Lead',
        pulse25: 'Lead 2',
        pulse12: 'Pluck',
        triangle: 'Basse',
        saw: 'Synth Saw',
        noise: 'Batterie 8-bit',
        wave: 'Arpege Wave',
        synth_sub: 'Basse / Lead Sub',
        synth_fm: 'FM Keys',
        drum_machine: 'Boite Rythmes',
        sampler: 'Sampler'
      };
      onAddChannel?.(inst, defaultNames[inst] || 'Canal');
    }
    addMenu.selectedIndex = 0;
  };

  addBar.appendChild(addMenu);
  rack.appendChild(addBar);

  container.appendChild(rack);
  return () => window.removeEventListener('mouseup', stopPainting);
}
