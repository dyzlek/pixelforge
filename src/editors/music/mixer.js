// PixelForge Music Studio — Console de mixage audio avec tranches, rack d'effets et departs auxiliaires
import { getIconSvg } from '../../ui/icons.js';
import { audioBufferToWavBlob } from '../../audio/wav-encoder.js';
import { midiToSong } from '../../audio/midi-parser.js';
import { VALID_EFFECTS } from '../../audio/chip.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EFFECT_NAMES = {
  reverb: 'Reverberation',
  delay: 'Delai / Echo',
  eq3: 'Egaliseur 3 Bandes',
  compressor: 'Compresseur',
  filter: 'Filtre Resonant',
  distortion: 'Distorsion / Overdrive',
  chorus: 'Chorus Stereo',
  bitcrusher: 'Bitcrusher Lofi 8-bit'
};

const EFFECT_DEFAULTS = {
  reverb: { roomSize: 0.7, damp: 1.0, mix: 0.35 },
  delay: { time: '3/16', feedback: 0.35, cutoff: 4000, mix: 0.3 },
  eq3: { low: 0, mid: 0, high: 0 },
  compressor: { threshold: -24, ratio: 4, gain: 0 },
  filter: { filterType: 'lowpass', cutoff: 2000, resonance: 1.5, mix: 1.0 },
  distortion: { drive: 0.4, mix: 0.5 },
  chorus: { rate: 1.5, depth: 0.5, mix: 0.4 },
  bitcrusher: { bits: 8, cutoff: 6000, mix: 0.6 }
};

export function renderMixer(container, opts) {
  const {
    song,
    chip,
    onChannelChange,
    onSongImport,
    selectedTrackId: initialSelectedId = null
  } = opts;

  container.innerHTML = '';
  const cleanups = [];

  const root = document.createElement('div');
  root.className = 'pf-mixer-root';

  // 1. Barre d'outils du mixeur (Actions Export WAV / Import MIDI)
  const toolbar = document.createElement('div');
  toolbar.className = 'pf-mixer-toolbar';

  const btnExportWav = document.createElement('button');
  btnExportWav.className = 'pf-btn-add-channel';
  btnExportWav.innerHTML = getIconSvg('save', 13) + ' Exporter en WAV';
  btnExportWav.title = 'Generer et telecharger le fichier audio .wav (16-bit PCM)';

  btnExportWav.onclick = async () => {
    if (!chip) {
      alert('Moteur audio non initialise');
      return;
    }
    const oldText = btnExportWav.innerHTML;
    btnExportWav.innerHTML = getIconSvg('refresh', 13) + ' Encodage en cours...';
    btnExportWav.disabled = true;

    try {
      // Rendu hors-ligne accelere via OfflineAudioContext
      const audioBuffer = await chip.renderOffline(song);
      const wavBlob = audioBufferToWavBlob(audioBuffer);

      // Declenchement du telechargement dans le navigateur
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (song.name || 'pixelforge-chiptune') + '.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur lors de l\'export WAV : ' + err.message);
    } finally {
      btnExportWav.innerHTML = oldText;
      btnExportWav.disabled = false;
    }
  };
  toolbar.appendChild(btnExportWav);

  // Bouton Import MIDI
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.mid,.midi';
  fileInput.style.display = 'none';

  fileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        const importedSong = midiToSong(buffer, file.name.replace(/\.[^/.]+$/, ''));
        onSongImport?.(importedSong);
      } catch (err) {
        alert('Erreur lors de l\'import MIDI : ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    fileInput.value = '';
  };
  root.appendChild(fileInput);

  const btnImportMidi = document.createElement('button');
  btnImportMidi.className = 'pf-btn-add-channel';
  btnImportMidi.innerHTML = getIconSvg('import', 13) + ' Importer un fichier MIDI (.mid)';
  btnImportMidi.title = 'Convertir un fichier Standard MIDI en morceaux chiptune PixelForge';
  btnImportMidi.onclick = () => fileInput.click();
  toolbar.appendChild(btnImportMidi);

  root.appendChild(toolbar);

  // 2. Zone principale : Tranches (gauche) + Rack d'effets & Departs (droite)
  const mainBody = document.createElement('div');
  mainBody.className = 'pf-mixer-body';

  const stripsContainer = document.createElement('div');
  stripsContainer.className = 'pf-mixer-strips';

  const fxPanel = document.createElement('div');
  fxPanel.className = 'pf-mixer-fx-panel';

  const rawTracks = (song.tracks && song.tracks.length > 0) ? song.tracks : (song.channels || []);
  let selectedTrackId = initialSelectedId || rawTracks[0]?.id || 'master';

  function renderStrips() {
    stripsContainer.innerHTML = '';

    // Tranche Master
    const masterStrip = document.createElement('div');
    masterStrip.className = 'pf-mixer-strip master' + (selectedTrackId === 'master' ? ' selected' : '');
    masterStrip.onclick = () => {
      selectedTrackId = 'master';
      renderStrips();
      renderFxRack();
    };

    const masterHead = document.createElement('div');
    masterHead.className = 'pf-strip-head';
    masterHead.innerHTML = '<strong>MASTER</strong>';
    masterStrip.appendChild(masterHead);

    const masterMeter = document.createElement('div');
    masterMeter.className = 'pf-strip-meter';
    const masterMeterFill = document.createElement('div');
    masterMeterFill.className = 'pf-meter-fill';
    masterMeterFill.style.height = '60%';
    masterMeter.appendChild(masterMeterFill);
    masterStrip.appendChild(masterMeter);

    const masterSliderWrap = document.createElement('div');
    masterSliderWrap.className = 'pf-strip-slider-wrap';

    const masterSlider = document.createElement('input');
    masterSlider.type = 'range';
    masterSlider.className = 'pf-fader-slider';
    masterSlider.min = '0';
    masterSlider.max = '1';
    masterSlider.step = '0.02';
    masterSlider.value = '0.8';
    masterSlider.orient = 'vertical';
    masterSlider.title = 'Volume Master';
    masterSliderWrap.appendChild(masterSlider);
    masterStrip.appendChild(masterSliderWrap);

    const masterFoot = document.createElement('div');
    masterFoot.className = 'pf-strip-foot';
    masterFoot.textContent = 'Sortie';
    masterStrip.appendChild(masterFoot);

    stripsContainer.appendChild(masterStrip);

    // Tranches pour chaque piste / canal
    rawTracks.forEach((ch, idx) => {
      const isSelected = ch.id === selectedTrackId;
      const strip = document.createElement('div');
      strip.className = 'pf-mixer-strip' + (isSelected ? ' selected' : '');
      strip.onclick = () => {
        selectedTrackId = ch.id;
        renderStrips();
        renderFxRack();
      };

      // En-tete : Nom + Instrument
      const head = document.createElement('div');
      head.className = 'pf-strip-head';
      const instName = typeof ch.instrument === 'string' ? ch.instrument : (ch.instrument?.type || 'pulse50');
      head.innerHTML = `<span class="pf-strip-name" title="${esc(ch.name)}">${esc(ch.name || 'Canal')}</span><span class="pf-channel-inst">${esc(instName)}</span>`;
      strip.appendChild(head);

      // Boutons Mute et Solo
      const muteSoloRow = document.createElement('div');
      muteSoloRow.className = 'pf-strip-mutesolo';

      const btnM = document.createElement('button');
      btnM.className = 'pf-btn-mute' + (ch.mute ? ' active' : '');
      btnM.textContent = 'M';
      btnM.title = 'Muet';
      btnM.onclick = (e) => { e.stopPropagation(); onChannelChange?.(ch.id, { mute: !ch.mute }); };

      const btnS = document.createElement('button');
      btnS.className = 'pf-btn-solo' + (ch.solo ? ' active' : '');
      btnS.textContent = 'S';
      btnS.title = 'Solo';
      btnS.onclick = (e) => { e.stopPropagation(); onChannelChange?.(ch.id, { solo: !ch.solo }); };

      muteSoloRow.appendChild(btnM);
      muteSoloRow.appendChild(btnS);
      strip.appendChild(muteSoloRow);

      // Panoramique L / R
      const panRow = document.createElement('div');
      panRow.className = 'pf-strip-pan';

      const panSlider = document.createElement('input');
      panSlider.type = 'range';
      panSlider.className = 'pf-mini-slider';
      panSlider.min = '-1';
      panSlider.max = '1';
      panSlider.step = '0.1';
      panSlider.value = String(ch.pan || 0);

      const panVal = ch.pan || 0;
      panSlider.title = 'Pan : ' + (panVal === 0 ? 'Centre' : panVal < 0 ? `G ${Math.round(-panVal * 100)}%` : `D ${Math.round(panVal * 100)}%`);
      panSlider.oninput = (e) => onChannelChange?.(ch.id, { pan: parseFloat(e.target.value) });

      panRow.appendChild(panSlider);
      strip.appendChild(panRow);

      // Pastilles effets
      const fxCount = (ch.effects || []).length;
      if (fxCount > 0) {
        const fxBadge = document.createElement('div');
        fxBadge.className = 'pf-strip-fx-badge';
        fxBadge.textContent = `${fxCount} FX`;
        fxBadge.title = `${fxCount} effet(s) actif(s) sur cette tranche`;
        strip.appendChild(fxBadge);
      }

      // Vumetre
      const meter = document.createElement('div');
      meter.className = 'pf-strip-meter';
      const meterFill = document.createElement('div');
      meterFill.className = 'pf-meter-fill';
      const volPct = Math.round((ch.volume != null ? ch.volume : 0.8) * 80);
      meterFill.style.height = (ch.mute ? 0 : volPct) + '%';
      meter.appendChild(meterFill);
      strip.appendChild(meter);

      // Fader vertical de volume
      const sliderWrap = document.createElement('div');
      sliderWrap.className = 'pf-strip-slider-wrap';

      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.className = 'pf-fader-slider';
      volSlider.min = '0';
      volSlider.max = '1';
      volSlider.step = '0.02';
      volSlider.value = String(ch.volume != null ? ch.volume : 0.8);
      volSlider.orient = 'vertical';
      volSlider.title = 'Volume : ' + Math.round((ch.volume != null ? ch.volume : 0.8) * 100) + '%';
      volSlider.oninput = (e) => onChannelChange?.(ch.id, { volume: parseFloat(e.target.value) });

      sliderWrap.appendChild(volSlider);
      strip.appendChild(sliderWrap);

      // Pied de tranche
      const foot = document.createElement('div');
      foot.className = 'pf-strip-foot';
      foot.textContent = 'Piste ' + (idx + 1);
      strip.appendChild(foot);

      stripsContainer.appendChild(strip);
    });
  }

  function renderFxRack() {
    fxPanel.innerHTML = '';

    const currentTrack = rawTracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack) {
      const msg = document.createElement('div');
      msg.className = 'pf-fx-empty';
      msg.textContent = 'Selectionnez une tranche pour configurer ses effets audio et departs auxiliaires.';
      fxPanel.appendChild(msg);
      return;
    }

    // 1. En-tete du Rack
    const header = document.createElement('div');
    header.className = 'pf-fx-header';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<strong>Rack d'Effets</strong> — <span style="color:#41a6f6">${esc(currentTrack.name || 'Piste')}</span>`;

    header.appendChild(titleWrap);
    fxPanel.appendChild(header);

    // 2. Liste des effets de la piste
    const effects = Array.isArray(currentTrack.effects) ? [...currentTrack.effects] : [];

    const effectsList = document.createElement('div');
    effectsList.className = 'pf-fx-list';

    if (effects.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'pf-fx-empty-slot';
      emptyNotice.textContent = 'Aucun effet audio. Ajoutez un effet ci-dessous pour enrichir le son.';
      effectsList.appendChild(emptyNotice);
    } else {
      effects.forEach((eff, idx) => {
        const slot = document.createElement('div');
        slot.className = 'pf-fx-slot' + (eff.bypass ? ' bypass' : '');
        slot.draggable = true;

        // Support du glisser-deposer pour ordonner les effets
        slot.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', String(idx));
        };
        slot.ondragover = (e) => {
          e.preventDefault();
        };
        slot.ondrop = (e) => {
          e.preventDefault();
          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (Number.isInteger(fromIdx) && fromIdx !== idx) {
            const reordered = [...effects];
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(idx, 0, moved);
            onChannelChange?.(currentTrack.id, { effects: reordered });
          }
        };

        // En-tete du slot
        const slotHead = document.createElement('div');
        slotHead.className = 'pf-fx-slot-header';

        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.alignItems = 'center';
        leftGroup.style.gap = '6px';

        const dragHandle = document.createElement('span');
        dragHandle.textContent = '::';
        dragHandle.style.cursor = 'grab';
        dragHandle.style.color = '#717791';
        dragHandle.style.fontWeight = 'bold';
        dragHandle.title = 'Glisser-deposer pour reordonner l\'effet dans la chaine';
        leftGroup.appendChild(dragHandle);

        const effTitle = document.createElement('span');
        effTitle.className = 'pf-fx-slot-title';
        effTitle.textContent = `${idx + 1}. ${EFFECT_NAMES[eff.type] || eff.type}`;
        leftGroup.appendChild(effTitle);
        slotHead.appendChild(leftGroup);

        const actionsGroup = document.createElement('div');
        actionsGroup.style.display = 'flex';
        actionsGroup.style.alignItems = 'center';
        actionsGroup.style.gap = '4px';

        // Bouton monter
        if (idx > 0) {
          const btnUp = document.createElement('button');
          btnUp.className = 'pf-transport-btn';
          btnUp.style.width = '18px';
          btnUp.style.height = '18px';
          btnUp.textContent = '▲';
          btnUp.title = 'Deplacer plus haut dans la chaine';
          btnUp.onclick = () => {
            const reordered = [...effects];
            const [moved] = reordered.splice(idx, 1);
            reordered.splice(idx - 1, 0, moved);
            onChannelChange?.(currentTrack.id, { effects: reordered });
          };
          actionsGroup.appendChild(btnUp);
        }

        // Bouton descendre
        if (idx < effects.length - 1) {
          const btnDown = document.createElement('button');
          btnDown.className = 'pf-transport-btn';
          btnDown.style.width = '18px';
          btnDown.style.height = '18px';
          btnDown.textContent = '▼';
          btnDown.title = 'Deplacer plus bas dans la chaine';
          btnDown.onclick = () => {
            const reordered = [...effects];
            const [moved] = reordered.splice(idx, 1);
            reordered.splice(idx + 1, 0, moved);
            onChannelChange?.(currentTrack.id, { effects: reordered });
          };
          actionsGroup.appendChild(btnDown);
        }

        // Bouton Bypass
        const btnBypass = document.createElement('button');
        btnBypass.className = 'pf-transport-btn' + (eff.bypass ? ' active' : '');
        btnBypass.style.fontSize = '10px';
        btnBypass.style.width = 'auto';
        btnBypass.style.padding = '0 6px';
        btnBypass.textContent = eff.bypass ? 'Bypass' : 'Actif';
        btnBypass.title = 'Activer ou desactiver l\'effet';
        btnBypass.onclick = () => {
          const updated = [...effects];
          updated[idx] = { ...eff, bypass: !eff.bypass };
          onChannelChange?.(currentTrack.id, { effects: updated });
        };
        actionsGroup.appendChild(btnBypass);

        // Bouton Supprimer
        const btnDelete = document.createElement('button');
        btnDelete.className = 'pf-transport-btn';
        btnDelete.style.width = '18px';
        btnDelete.style.height = '18px';
        btnDelete.innerHTML = getIconSvg('trash', 10);
        btnDelete.title = 'Supprimer cet effet';
        btnDelete.onclick = () => {
          const updated = effects.filter((_, i) => i !== idx);
          onChannelChange?.(currentTrack.id, { effects: updated });
        };
        actionsGroup.appendChild(btnDelete);

        slotHead.appendChild(actionsGroup);
        slot.appendChild(slotHead);

        // Reglage des parametres selon le type d'effet
        const controls = document.createElement('div');
        controls.className = 'pf-fx-slot-controls';

        // Mix Wet/Dry standard
        const mixRow = document.createElement('div');
        mixRow.className = 'pf-fx-param-row';
        mixRow.innerHTML = `<span>Mix Wet/Dry :</span><input type="range" class="pf-mini-slider" min="0" max="1" step="0.05" value="${eff.mix != null ? eff.mix : 0.5}" style="width:120px" /><span>${Math.round((eff.mix != null ? eff.mix : 0.5) * 100)}%</span>`;
        mixRow.querySelector('input').onchange = (e) => {
          const updated = [...effects];
          updated[idx] = { ...eff, mix: parseFloat(e.target.value) };
          onChannelChange?.(currentTrack.id, { effects: updated });
        };
        controls.appendChild(mixRow);

        if (eff.type === 'reverb') {
          const roomRow = document.createElement('div');
          roomRow.className = 'pf-fx-param-row';
          roomRow.innerHTML = `<span>Taille piece :</span><input type="range" class="pf-mini-slider" min="0.1" max="2" step="0.1" value="${eff.roomSize || 0.7}" style="width:120px" />`;
          roomRow.querySelector('input').onchange = (e) => {
            const updated = [...effects];
            updated[idx] = { ...eff, roomSize: parseFloat(e.target.value) };
            onChannelChange?.(currentTrack.id, { effects: updated });
          };
          controls.appendChild(roomRow);
        } else if (eff.type === 'delay') {
          const fbRow = document.createElement('div');
          fbRow.className = 'pf-fx-param-row';
          fbRow.innerHTML = `<span>Feedback :</span><input type="range" class="pf-mini-slider" min="0" max="0.9" step="0.05" value="${eff.feedback || 0.35}" style="width:120px" />`;
          fbRow.querySelector('input').onchange = (e) => {
            const updated = [...effects];
            updated[idx] = { ...eff, feedback: parseFloat(e.target.value) };
            onChannelChange?.(currentTrack.id, { effects: updated });
          };
          controls.appendChild(fbRow);
        } else if (eff.type === 'distortion') {
          const driveRow = document.createElement('div');
          driveRow.className = 'pf-fx-param-row';
          driveRow.innerHTML = `<span>Saturation :</span><input type="range" class="pf-mini-slider" min="0.05" max="1" step="0.05" value="${eff.drive || 0.4}" style="width:120px" />`;
          driveRow.querySelector('input').onchange = (e) => {
            const updated = [...effects];
            updated[idx] = { ...eff, drive: parseFloat(e.target.value) };
            onChannelChange?.(currentTrack.id, { effects: updated });
          };
          controls.appendChild(driveRow);
        } else if (eff.type === 'bitcrusher') {
          const bitRow = document.createElement('div');
          bitRow.className = 'pf-fx-param-row';
          bitRow.innerHTML = `<span>Bits :</span><input type="range" class="pf-mini-slider" min="2" max="16" step="1" value="${eff.bits || 8}" style="width:120px" /><span>${eff.bits || 8} bits</span>`;
          bitRow.querySelector('input').onchange = (e) => {
            const updated = [...effects];
            updated[idx] = { ...eff, bits: parseInt(e.target.value, 10) };
            onChannelChange?.(currentTrack.id, { effects: updated });
          };
          controls.appendChild(bitRow);
        }

        slot.appendChild(controls);
        effectsList.appendChild(slot);
      });
    }
    fxPanel.appendChild(effectsList);

    // 3. Menu d'ajout d'effet
    const addFxWrap = document.createElement('div');
    addFxWrap.style.marginTop = '6px';

    const addFxSelect = document.createElement('select');
    addFxSelect.className = 'pf-btn-add-channel';
    addFxSelect.style.width = '100%';
    addFxSelect.innerHTML = '<option value="" disabled selected>+ Ajouter un effet audio...</option>'
      + VALID_EFFECTS.map((t) => `<option value="${t}">${EFFECT_NAMES[t] || t}</option>`).join('');

    addFxSelect.onchange = (e) => {
      const type = e.target.value;
      if (!type) return;
      const newEff = {
        type,
        bypass: false,
        ...(EFFECT_DEFAULTS[type] || {})
      };
      const updated = [...effects, newEff];
      onChannelChange?.(currentTrack.id, { effects: updated });
      addFxSelect.selectedIndex = 0;
    };

    addFxWrap.appendChild(addFxSelect);
    fxPanel.appendChild(addFxWrap);

    // 4. Section des Departs auxiliaires (Sends)
    const sendsHeader = document.createElement('div');
    sendsHeader.className = 'pf-fx-header';
    sendsHeader.style.marginTop = '16px';
    sendsHeader.innerHTML = '<strong>Departs Auxiliaires (Sends)</strong>';
    fxPanel.appendChild(sendsHeader);

    const sends = Array.isArray(currentTrack.sends) ? [...currentTrack.sends] : [];
    const sendsList = document.createElement('div');
    sendsList.className = 'pf-fx-list';

    if (sends.length === 0) {
      const emptySends = document.createElement('div');
      emptySends.className = 'pf-fx-empty-slot';
      emptySends.textContent = 'Aucun depart auxiliaire vers une autre piste ou un bus de reverb/delai.';
      sendsList.appendChild(emptySends);
    } else {
      sends.forEach((snd, sIdx) => {
        const destBus = rawTracks.find((t) => t.id === (snd.busId || snd.targetTrackId));
        const sRow = document.createElement('div');
        sRow.className = 'pf-fx-slot';

        const sHead = document.createElement('div');
        sHead.className = 'pf-fx-slot-header';
        sHead.innerHTML = `<span>Vers : <strong>${esc(destBus?.name || snd.busId || 'Bus')}</strong></span>`;

        const btnDelSend = document.createElement('button');
        btnDelSend.className = 'pf-transport-btn';
        btnDelSend.style.width = '18px';
        btnDelSend.style.height = '18px';
        btnDelSend.innerHTML = getIconSvg('trash', 10);
        btnDelSend.onclick = () => {
          const updated = sends.filter((_, i) => i !== sIdx);
          onChannelChange?.(currentTrack.id, { sends: updated });
        };
        sHead.appendChild(btnDelSend);
        sRow.appendChild(sHead);

        const sAmtRow = document.createElement('div');
        sAmtRow.className = 'pf-fx-param-row';
        sAmtRow.innerHTML = `<span>Niveau depart :</span><input type="range" class="pf-mini-slider" min="0" max="1" step="0.05" value="${snd.amount != null ? snd.amount : 0}" style="width:120px" /><span>${Math.round((snd.amount != null ? snd.amount : 0) * 100)}%</span>`;
        sAmtRow.querySelector('input').onchange = (e) => {
          const updated = [...sends];
          updated[sIdx] = { ...snd, amount: parseFloat(e.target.value) };
          onChannelChange?.(currentTrack.id, { sends: updated });
        };
        sRow.appendChild(sAmtRow);

        sendsList.appendChild(sRow);
      });
    }
    fxPanel.appendChild(sendsList);

    // Menu d'ajout de depart
    const otherTracks = rawTracks.filter((t) => t.id !== currentTrack.id);
    if (otherTracks.length > 0) {
      const addSendWrap = document.createElement('div');
      addSendWrap.style.marginTop = '6px';

      const addSendSelect = document.createElement('select');
      addSendSelect.className = 'pf-btn-add-channel';
      addSendSelect.style.width = '100%';
      addSendSelect.innerHTML = '<option value="" disabled selected>+ Ajouter un depart vers...</option>'
        + otherTracks.map((t) => `<option value="${t.id}">${esc(t.name || t.id)}</option>`).join('');

      addSendSelect.onchange = (e) => {
        const busId = e.target.value;
        if (!busId) return;
        const newSend = { busId, amount: 0.3 };
        const updated = [...sends, newSend];
        onChannelChange?.(currentTrack.id, { sends: updated });
        addSendSelect.selectedIndex = 0;
      };

      addSendWrap.appendChild(addSendSelect);
      fxPanel.appendChild(addSendWrap);
    }
  }

  renderStrips();
  renderFxRack();

  mainBody.appendChild(stripsContainer);
  mainBody.appendChild(fxPanel);
  root.appendChild(mainBody);
  container.appendChild(root);

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
