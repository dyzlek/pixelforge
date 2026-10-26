// PixelForge Music Studio — Console de mixage audio avec vumetres et export WAV / import MIDI
import { getIconSvg } from '../../ui/icons.js';
import { audioBufferToWavBlob } from '../../audio/wav-encoder.js';
import { midiToSong } from '../../audio/midi-parser.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderMixer(container, opts) {
  const {
    song,
    chip,
    onChannelChange,
    onSongImport
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

  // 2. Zone des tranches de console (Strips)
  const stripsContainer = document.createElement('div');
  stripsContainer.className = 'pf-mixer-strips';

  // Tranche Master
  const masterStrip = document.createElement('div');
  masterStrip.className = 'pf-mixer-strip master';

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

  // Tranches pour chaque canal
  (song.channels || []).forEach((ch, idx) => {
    const strip = document.createElement('div');
    strip.className = 'pf-mixer-strip';

    // En-tete : Nom + Instrument
    const head = document.createElement('div');
    head.className = 'pf-strip-head';
    head.innerHTML = `<span class="pf-strip-name" title="${esc(ch.name)}">${esc(ch.name || 'Canal')}</span><span class="pf-channel-inst">${esc(ch.instrument)}</span>`;
    strip.appendChild(head);

    // Boutons Mute et Solo
    const muteSoloRow = document.createElement('div');
    muteSoloRow.className = 'pf-strip-mutesolo';

    const btnM = document.createElement('button');
    btnM.className = 'pf-btn-mute' + (ch.mute ? ' active' : '');
    btnM.textContent = 'M';
    btnM.title = 'Muet';
    btnM.onclick = () => onChannelChange?.(ch.id, { mute: !ch.mute });

    const btnS = document.createElement('button');
    btnS.className = 'pf-btn-solo' + (ch.solo ? ' active' : '');
    btnS.textContent = 'S';
    btnS.title = 'Solo';
    btnS.onclick = () => onChannelChange?.(ch.id, { solo: !ch.solo });

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

  root.appendChild(stripsContainer);
  container.appendChild(root);

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
