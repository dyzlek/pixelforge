// PixelForge Music Studio — Playlist & Timeline DAW v2
// Multi-pistes, arrangement de clips, decoupage, etirement, boucle, marqueurs, zoom
import { createEpic2MinSong } from '../../audio/presets/epic-2min.js';

export function renderPlaylist(container, opts) {
  const {
    song,
    activePatternId,
    currentStep = -1,
    onPlaylistChange,
    onPatternSelect,
    onSeek
  } = opts;

  container.innerHTML = '';
  const cleanups = [];

  let stepWidth = 12; // 12px par pas par defaut
  const TRACK_HEIGHT = 44;
  let snapSteps = 16; // aimantation par defaut a 1 mesure (16 pas)
  let activeTool = 'pointer'; // 'pointer' ou 'split'
  let selectedPatternId = activePatternId || song.patterns?.[0]?.id || null;

  // Initialisation des collections DAW v2
  song.tracks = Array.isArray(song.tracks) ? song.tracks : [];
  song.clips = Array.isArray(song.clips) ? song.clips : [];
  song.markers = Array.isArray(song.markers) ? song.markers : [];
  song.playlist = Array.isArray(song.playlist) ? song.playlist : [];
  song.loop = song.loop && typeof song.loop === 'object' ? song.loop : { enabled: true, start: 0, end: 64 };
  song.timeSignature = Array.isArray(song.timeSignature) && song.timeSignature.length === 2 ? song.timeSignature : [4, 4];
  song.bpm = Number(song.bpm) || 120;

  function getTracksList() {
    return (song.tracks && song.tracks.length > 0) ? song.tracks : (song.channels || []);
  }

  function getNumTracks() {
    return Math.max(8, getTracksList().length);
  }

  function computeTotalSteps() {
    const playlistMax = (song.playlist || []).map((it) => {
      const pat = (song.patterns || []).find((p) => p.id === it.pattern);
      return (it.start || 0) + (pat?.length || 16);
    });
    const clipsMax = (song.clips || []).map((c) => (c.start || 0) + (c.length || 16));
    const markersMax = (song.markers || []).map((m) => m.step || 0);
    const loopMax = [song.loop?.end || 0];
    const maxVal = Math.max(128, ...playlistMax, ...clipsMax, ...markersMax, ...loopMax);
    return maxVal + 64;
  }

  const root = document.createElement('div');
  root.className = 'pf-playlist-root';

  // 1. Barre d'outils
  const toolbar = document.createElement('div');
  toolbar.className = 'pf-playlist-toolbar';

  // Mode Outil : Pointeur ou Decouper (Ciseaux / Split)
  const toolItem = document.createElement('div');
  toolItem.className = 'pf-transport-item';
  toolItem.innerHTML = '<span>Outil :</span>';

  const btnToolPointer = document.createElement('button');
  btnToolPointer.className = 'pf-transport-btn' + (activeTool === 'pointer' ? ' active' : '');
  btnToolPointer.style.width = 'auto';
  btnToolPointer.style.padding = '0 6px';
  btnToolPointer.style.fontSize = '11px';
  btnToolPointer.textContent = 'Deplacer';
  btnToolPointer.title = 'Deplacer et redimensionner les clips';

  const btnToolSplit = document.createElement('button');
  btnToolSplit.className = 'pf-transport-btn' + (activeTool === 'split' ? ' active' : '');
  btnToolSplit.style.width = 'auto';
  btnToolSplit.style.padding = '0 6px';
  btnToolSplit.style.fontSize = '11px';
  btnToolSplit.textContent = 'Decouper';
  btnToolSplit.title = 'Cliquer sur un clip pour le scinder en deux';

  btnToolPointer.onclick = () => {
    activeTool = 'pointer';
    btnToolPointer.classList.add('active');
    btnToolSplit.classList.remove('active');
    timelineContent.classList.remove('tool-split');
  };

  btnToolSplit.onclick = () => {
    activeTool = 'split';
    btnToolSplit.classList.add('active');
    btnToolPointer.classList.remove('active');
    timelineContent.classList.add('tool-split');
  };

  toolItem.appendChild(btnToolPointer);
  toolItem.appendChild(btnToolSplit);
  toolbar.appendChild(toolItem);

  const sepTool = document.createElement('div');
  sepTool.className = 'pf-transport-sep';
  toolbar.appendChild(sepTool);

  // Selecteur de pattern a placer (Pinceau)
  const patLabel = document.createElement('div');
  patLabel.className = 'pf-transport-item';
  patLabel.innerHTML = '<span>Motif :</span>';

  const patSelect = document.createElement('select');
  patSelect.className = 'pf-transport-val';
  function refreshPatternOptions() {
    patSelect.innerHTML = '';
    (song.patterns || []).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || 'Pattern';
      opt.selected = p.id === selectedPatternId;
      patSelect.appendChild(opt);
    });
  }
  refreshPatternOptions();
  patSelect.onchange = (e) => {
    selectedPatternId = e.target.value;
    onPatternSelect?.(selectedPatternId);
  };
  patLabel.appendChild(patSelect);
  toolbar.appendChild(patLabel);

  const sep1 = document.createElement('div');
  sep1.className = 'pf-transport-sep';
  toolbar.appendChild(sep1);

  // Aimantation (Snap)
  const snapLabel = document.createElement('div');
  snapLabel.className = 'pf-transport-item';
  snapLabel.innerHTML = '<span>Snap :</span>';

  const snapSelect = document.createElement('select');
  snapSelect.className = 'pf-transport-val';
  [
    { val: 16, label: '1 mes (16p)' },
    { val: 8, label: '1/2 mes (8p)' },
    { val: 4, label: '1 temps (4p)' },
    { val: 1, label: '1 pas (libre)' }
  ].forEach((s) => {
    const opt = document.createElement('option');
    opt.value = String(s.val);
    opt.textContent = s.label;
    snapSelect.appendChild(opt);
  });
  snapSelect.onchange = (e) => { snapSteps = parseInt(e.target.value, 10); };
  snapLabel.appendChild(snapSelect);
  toolbar.appendChild(snapLabel);

  const sep2 = document.createElement('div');
  sep2.className = 'pf-transport-sep';
  toolbar.appendChild(sep2);

  // Zoom horizontal
  const zoomLabel = document.createElement('div');
  zoomLabel.className = 'pf-transport-item';
  zoomLabel.innerHTML = '<span>Zoom :</span>';

  const btnZoomOut = document.createElement('button');
  btnZoomOut.className = 'pf-transport-btn';
  btnZoomOut.style.width = '24px';
  btnZoomOut.style.fontSize = '12px';
  btnZoomOut.textContent = '-';
  btnZoomOut.title = 'Dezoomer la timeline';
  btnZoomOut.onclick = () => {
    stepWidth = Math.max(6, stepWidth - 2);
    applyLayout();
  };

  const zoomDisplay = document.createElement('span');
  zoomDisplay.style.fontSize = '11px';
  zoomDisplay.style.color = '#8b90a8';
  zoomDisplay.style.minWidth = '28px';
  zoomDisplay.style.textAlign = 'center';
  zoomDisplay.textContent = stepWidth + 'px';

  const btnZoomIn = document.createElement('button');
  btnZoomIn.className = 'pf-transport-btn';
  btnZoomIn.style.width = '24px';
  btnZoomIn.style.fontSize = '12px';
  btnZoomIn.textContent = '+';
  btnZoomIn.title = 'Zoomer la timeline';
  btnZoomIn.onclick = () => {
    stepWidth = Math.min(28, stepWidth + 2);
    applyLayout();
  };

  zoomLabel.appendChild(btnZoomOut);
  zoomLabel.appendChild(zoomDisplay);
  zoomLabel.appendChild(btnZoomIn);
  toolbar.appendChild(zoomLabel);

  const sep3 = document.createElement('div');
  sep3.className = 'pf-transport-sep';
  toolbar.appendChild(sep3);

  // Boucle : Debut et Fin (en pas)
  const loopItem = document.createElement('div');
  loopItem.className = 'pf-transport-item';
  loopItem.innerHTML = '<span>Boucle :</span>';

  const loopStartInput = document.createElement('input');
  loopStartInput.type = 'number';
  loopStartInput.className = 'pf-transport-val';
  loopStartInput.style.width = '42px';
  loopStartInput.min = '0';
  loopStartInput.value = String(song.loop?.start || 0);
  loopStartInput.title = 'Pas de debut de boucle';
  loopStartInput.onchange = (e) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    song.loop = { ...(song.loop || { enabled: true }), start: val };
    onPlaylistChange?.();
    renderMarkers();
  };
  loopItem.appendChild(loopStartInput);

  const loopEndInput = document.createElement('input');
  loopEndInput.type = 'number';
  loopEndInput.className = 'pf-transport-val';
  loopEndInput.style.width = '46px';
  loopEndInput.min = '1';
  loopEndInput.value = String(song.loop?.end || 64);
  loopEndInput.title = 'Pas de fin de boucle';
  loopEndInput.onchange = (e) => {
    const val = Math.max((song.loop?.start || 0) + 1, parseInt(e.target.value, 10) || 64);
    song.loop = { ...(song.loop || { enabled: true }), end: val };
    onPlaylistChange?.();
    renderMarkers();
  };
  loopItem.appendChild(loopEndInput);
  toolbar.appendChild(loopItem);

  const sep4 = document.createElement('div');
  sep4.className = 'pf-transport-sep';
  toolbar.appendChild(sep4);

  // Bouton Ajouter Marqueur
  const btnAddMarker = document.createElement('button');
  btnAddMarker.className = 'pf-transport-btn';
  btnAddMarker.style.width = 'auto';
  btnAddMarker.style.padding = '0 6px';
  btnAddMarker.style.fontSize = '11px';
  btnAddMarker.textContent = '+ Marqueur';
  btnAddMarker.title = 'Ajouter un marqueur de section a la position courante';
  btnAddMarker.onclick = () => {
    const targetStep = currentStep >= 0 ? currentStep : (song.loop?.start || 0);
    const name = prompt('Nom du marqueur de section :', 'Section ' + (song.markers.length + 1));
    if (name) {
      song.markers.push({ step: targetStep, name: name.trim() });
      song.markers.sort((a, b) => a.step - b.step);
      onPlaylistChange?.();
      renderMarkers();
    }
  };
  toolbar.appendChild(btnAddMarker);

  const sep5 = document.createElement('div');
  sep5.className = 'pf-transport-sep';
  toolbar.appendChild(sep5);

  // Bouton Charger Odyssee 2 min
  const btnLoadDemo = document.createElement('button');
  btnLoadDemo.className = 'pf-transport-btn';
  btnLoadDemo.style.width = 'auto';
  btnLoadDemo.style.padding = '0 8px';
  btnLoadDemo.style.fontSize = '11px';
  btnLoadDemo.style.background = '#29366f';
  btnLoadDemo.style.borderColor = '#41a6f6';
  btnLoadDemo.textContent = 'Charger Odyssee 2 min';
  btnLoadDemo.title = 'Charger le morceau complet de 2 minutes avec intro, couplets, refrain et fin';
  btnLoadDemo.onclick = () => {
    const demo = createEpic2MinSong();
    song.bpm = demo.bpm;
    song.timeSignature = demo.timeSignature;
    song.channels = structuredClone(demo.channels);
    song.tracks = structuredClone(demo.tracks);
    song.patterns = structuredClone(demo.patterns);
    song.playlist = structuredClone(demo.playlist);
    song.clips = structuredClone(demo.clips);
    song.markers = structuredClone(demo.markers);
    song.loop = structuredClone(demo.loop);

    selectedPatternId = song.patterns[0]?.id || null;
    refreshPatternOptions();
    loopStartInput.value = String(song.loop.start);
    loopEndInput.value = String(song.loop.end);
    onPlaylistChange?.();
    renderTrackHeaders();
    applyLayout();
  };
  toolbar.appendChild(btnLoadDemo);

  // Bouton Effacer tout
  const btnClear = document.createElement('button');
  btnClear.className = 'pf-transport-btn';
  btnClear.style.width = 'auto';
  btnClear.style.padding = '0 8px';
  btnClear.style.fontSize = '11px';
  btnClear.textContent = 'Effacer tout';
  btnClear.title = 'Vider tous les clips et blocs de l arrangement';
  btnClear.onclick = () => {
    if (confirm('Voulez-vous effacer tous les clips et blocs de la timeline ?')) {
      song.playlist = [];
      song.clips = [];
      onPlaylistChange?.();
      renderBlocks();
    }
  };
  toolbar.appendChild(btnClear);

  root.appendChild(toolbar);

  // 2. Zone principale : En-tetes de pistes a gauche + Timeline a droite
  const body = document.createElement('div');
  body.className = 'pf-playlist-body';

  const trackHeaders = document.createElement('div');
  trackHeaders.className = 'pf-playlist-track-headers';

  function renderTrackHeaders() {
    trackHeaders.innerHTML = '';
    const cornerSpacer = document.createElement('div');
    cornerSpacer.className = 'pf-playlist-corner';
    cornerSpacer.textContent = 'Pistes';
    trackHeaders.appendChild(cornerSpacer);

    const tracksList = getTracksList();
    const numT = getNumTracks();

    for (let t = 0; t < numT; t++) {
      const trk = tracksList[t];
      const th = document.createElement('div');
      th.className = 'pf-playlist-track-head';
      th.style.height = TRACK_HEIGHT + 'px';

      const title = document.createElement('span');
      title.className = 'pf-track-head-title';
      title.textContent = trk?.name || `Piste ${t + 1}`;
      title.title = trk?.name || `Piste ${t + 1}`;
      th.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'pf-track-head-actions';

      const btnMute = document.createElement('button');
      btnMute.className = 'pf-track-btn pf-track-mute' + (trk?.mute ? ' active' : '');
      btnMute.textContent = 'M';
      btnMute.title = 'Muter cette piste';
      btnMute.onclick = (e) => {
        e.stopPropagation();
        if (trk) {
          trk.mute = !trk.mute;
          btnMute.classList.toggle('active', trk.mute);
          onPlaylistChange?.();
        }
      };
      actions.appendChild(btnMute);

      const btnSolo = document.createElement('button');
      btnSolo.className = 'pf-track-btn pf-track-solo' + (trk?.solo ? ' active' : '');
      btnSolo.textContent = 'S';
      btnSolo.title = 'Mettre cette piste en solo';
      btnSolo.onclick = (e) => {
        e.stopPropagation();
        if (trk) {
          trk.solo = !trk.solo;
          btnSolo.classList.toggle('active', trk.solo);
          onPlaylistChange?.();
        }
      };
      actions.appendChild(btnSolo);

      th.appendChild(actions);
      trackHeaders.appendChild(th);
    }
  }
  renderTrackHeaders();
  body.appendChild(trackHeaders);

  // Timeline scrollable
  const timelineScroll = document.createElement('div');
  timelineScroll.className = 'pf-playlist-scroll';

  const timelineContent = document.createElement('div');
  timelineContent.className = 'pf-playlist-content';

  // Reglette temporelle en haut
  const ruler = document.createElement('div');
  ruler.className = 'pf-playlist-ruler';

  // Marqueurs de boucle et de section
  const markersContainer = document.createElement('div');
  markersContainer.style.position = 'absolute';
  markersContainer.style.top = '0';
  markersContainer.style.left = '0';
  markersContainer.style.right = '0';
  markersContainer.style.bottom = '0';
  markersContainer.style.pointerEvents = 'none';

  // Zone ombree de boucle
  const loopRangeEl = document.createElement('div');
  loopRangeEl.className = 'pf-playlist-loop-range';

  // Grille des pistes
  const tracksArea = document.createElement('div');
  tracksArea.className = 'pf-playlist-tracks-area';

  // Tete de lecture (balayage vertical)
  const playhead = document.createElement('div');
  playhead.className = 'pf-playlist-playhead';
  if (currentStep >= 0) {
    playhead.style.display = 'block';
    playhead.style.left = (currentStep * stepWidth) + 'px';
  } else {
    playhead.style.display = 'none';
  }

  // Couche des blocs et clips places
  const blocksLayer = document.createElement('div');
  blocksLayer.className = 'pf-playlist-blocks-layer';

  function applyLayout() {
    zoomDisplay.textContent = stepWidth + 'px';
    const totalSteps = computeTotalSteps();
    const contentWidth = totalSteps * stepWidth;
    timelineContent.style.width = contentWidth + 'px';

    const numT = getNumTracks();
    tracksArea.style.height = (numT * TRACK_HEIGHT) + 'px';

    // Rendu de la reglette
    ruler.innerHTML = '';
    const numBars = Math.ceil(totalSteps / 16);
    for (let b = 0; b < numBars; b++) {
      const barEl = document.createElement('div');
      barEl.className = 'pf-playlist-bar-num';
      barEl.style.left = (b * 16 * stepWidth) + 'px';
      barEl.style.width = (16 * stepWidth) + 'px';
      barEl.textContent = 'Mesure ' + (b + 1);
      ruler.appendChild(barEl);
    }

    // Reconstruction des pistes de fond
    tracksArea.innerHTML = '';
    for (let t = 0; t < numT; t++) {
      const lane = document.createElement('div');
      lane.className = 'pf-playlist-lane' + (t % 2 === 1 ? ' alt' : '');
      lane.dataset.track = String(t);
      lane.style.top = (t * TRACK_HEIGHT) + 'px';
      lane.style.height = TRACK_HEIGHT + 'px';
      tracksArea.appendChild(lane);
    }

    tracksArea.appendChild(loopRangeEl);
    tracksArea.appendChild(playhead);
    tracksArea.appendChild(blocksLayer);

    ruler.appendChild(markersContainer);
    renderMarkers();
    renderBlocks();
  }

  function renderMarkers() {
    markersContainer.innerHTML = '';

    const loopStart = song.loop?.start || 0;
    const loopEnd = song.loop?.end || 64;

    // Ombrage de boucle sur les pistes
    loopRangeEl.style.left = (loopStart * stepWidth) + 'px';
    loopRangeEl.style.width = (Math.max(1, loopEnd - loopStart) * stepWidth) + 'px';

    // Drapeau LOOP IN sur la reglette
    const loopInEl = document.createElement('div');
    loopInEl.className = 'pf-playlist-loop-marker';
    loopInEl.style.left = (loopStart * stepWidth) + 'px';
    loopInEl.innerHTML = `<span class="pf-loop-flag">LOOP IN</span>`;
    markersContainer.appendChild(loopInEl);

    // Drapeau LOOP OUT sur la reglette
    const loopOutEl = document.createElement('div');
    loopOutEl.className = 'pf-playlist-loop-marker';
    loopOutEl.style.left = (loopEnd * stepWidth) + 'px';
    loopOutEl.innerHTML = `<span class="pf-loop-flag">LOOP OUT</span>`;
    markersContainer.appendChild(loopOutEl);

    // Drapeaux des marqueurs de section (Intro, Couplet, Refrain, etc.)
    (song.markers || []).forEach((m, idx) => {
      const markerEl = document.createElement('div');
      markerEl.className = 'pf-playlist-marker';
      markerEl.style.left = (m.step * stepWidth) + 'px';
      markerEl.style.pointerEvents = 'auto';

      const flag = document.createElement('span');
      flag.className = 'pf-marker-flag';
      flag.textContent = m.name;
      markerEl.appendChild(flag);

      // Clic pour se positionner
      markerEl.onclick = (e) => {
        e.stopPropagation();
        onSeek?.(m.step);
      };

      // Clic droit pour supprimer
      markerEl.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Supprimer le marqueur "${m.name}" ?`)) {
          song.markers.splice(idx, 1);
          onPlaylistChange?.();
          renderMarkers();
        }
      };

      markersContainer.appendChild(markerEl);
    });
  }

  // Clic sur la reglette pour deplacer la tete de lecture
  ruler.onclick = (e) => {
    const rect = ruler.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScroll.scrollLeft;
    const clickedStep = Math.max(0, Math.floor(x / stepWidth));
    onSeek?.(clickedStep);
  };

  function renderBlocks() {
    blocksLayer.innerHTML = '';
    const tracksList = getTracksList();
    const numT = getNumTracks();

    // 1. Rendu des clips DAW v2 (song.clips)
    (song.clips || []).forEach((clip, index) => {
      let trackIdx = tracksList.findIndex((t) => t.id === clip.trackId);
      if (trackIdx < 0) trackIdx = 0;

      const clipEl = document.createElement('div');
      clipEl.className = 'pf-playlist-block';
      clipEl.dataset.type = 'clip';
      clipEl.dataset.clipId = clip.id;
      clipEl.style.left = ((clip.start || 0) * stepWidth) + 'px';
      clipEl.style.top = (trackIdx * TRACK_HEIGHT + 3) + 'px';
      clipEl.style.width = ((clip.length || 16) * stepWidth - 2) + 'px';
      clipEl.style.height = (TRACK_HEIGHT - 6) + 'px';
      clipEl.style.background = '#29366f';
      clipEl.style.borderColor = '#41a6f6';

      const title = document.createElement('div');
      title.className = 'pf-playlist-block-title';
      title.textContent = clip.name || 'Clip';
      clipEl.appendChild(title);

      // Apercu mini des notes du clip
      const miniView = document.createElement('div');
      miniView.className = 'pf-playlist-miniview';
      (clip.notes || []).forEach((n) => {
        const dot = document.createElement('div');
        dot.className = 'pf-playlist-minidot';
        const nStep = n.step != null ? n.step : 0;
        dot.style.left = ((nStep / (clip.length || 16)) * 100) + '%';
        miniView.appendChild(dot);
      });
      clipEl.appendChild(miniView);

      // Poignee de redimensionnement / etirement sur le bord droit
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'pf-clip-resize-handle';
      resizeHandle.title = 'Glisser pour ajuster la longueur du clip';
      resizeHandle.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const initialLength = clip.length || 16;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const stepDelta = Math.round(dx / stepWidth);
          const rawLength = Math.max(snapSteps, initialLength + stepDelta);
          const snappedLength = Math.max(1, Math.round(rawLength / snapSteps) * snapSteps);

          clip.length = snappedLength;
          clipEl.style.width = (snappedLength * stepWidth - 2) + 'px';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onPlaylistChange?.();
          applyLayout();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };
      clipEl.appendChild(resizeHandle);

      // Clic droit = supprimer le clip
      clipEl.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        song.clips.splice(index, 1);
        onPlaylistChange?.();
        renderBlocks();
      };

      // Clic gauche : Decoupage (Split) ou Deplacement
      clipEl.onmousedown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.pf-clip-resize-handle')) return;

        // Outil Decoupage (Split / Ciseaux)
        if (activeTool === 'split') {
          e.preventDefault();
          e.stopPropagation();

          const rect = clipEl.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickStepInClip = Math.floor(clickX / stepWidth);
          const rawSplitStep = (clip.start || 0) + clickStepInClip;
          const splitStep = Math.round(rawSplitStep / snapSteps) * snapSteps;

          const clipStart = clip.start || 0;
          const clipLength = clip.length || 16;
          const clipEnd = clipStart + clipLength;

          if (splitStep > clipStart && splitStep < clipEnd) {
            const firstPartLength = splitStep - clipStart;
            const secondPartLength = clipLength - firstPartLength;

            const originalNotes = Array.isArray(clip.notes) ? clip.notes : [];
            const notes1 = originalNotes.filter((n) => (n.step || 0) < firstPartLength);
            const notes2 = originalNotes
              .filter((n) => (n.step || 0) >= firstPartLength)
              .map((n) => ({ ...n, step: (n.step || 0) - firstPartLength }));

            clip.length = firstPartLength;
            clip.notes = notes1;

            const newClip = {
              id: 'clp_' + Math.random().toString(36).slice(2, 9),
              name: (clip.name || 'Clip') + ' (suite)',
              trackId: clip.trackId,
              type: clip.type || 'notes',
              start: splitStep,
              length: secondPartLength,
              offset: 0,
              loop: false,
              notes: notes2
            };

            song.clips.splice(index + 1, 0, newClip);
            onPlaylistChange?.();
            renderBlocks();
          }
          return;
        }

        // Outil Deplacement standard
        e.preventDefault();
        e.stopPropagation();

        const isDuplicate = e.ctrlKey || e.altKey;
        let targetClip = clip;

        if (isDuplicate) {
          targetClip = structuredClone(clip);
          targetClip.id = 'clp_' + Math.random().toString(36).slice(2, 9);
          song.clips.push(targetClip);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const initialStart = targetClip.start || 0;
        const initialTrackIdx = trackIdx;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          const stepDelta = Math.round(dx / stepWidth);
          const trackDelta = Math.round(dy / TRACK_HEIGHT);

          const rawStart = Math.max(0, initialStart + stepDelta);
          const snappedStart = Math.round(rawStart / snapSteps) * snapSteps;
          const newTrackIdx = Math.max(0, Math.min(numT - 1, initialTrackIdx + trackDelta));

          targetClip.start = snappedStart;
          if (tracksList[newTrackIdx]) {
            targetClip.trackId = tracksList[newTrackIdx].id;
          }

          clipEl.style.left = (snappedStart * stepWidth) + 'px';
          clipEl.style.top = (newTrackIdx * TRACK_HEIGHT + 3) + 'px';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onPlaylistChange?.();
          applyLayout();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      blocksLayer.appendChild(clipEl);
    });

    // 2. Rendu des patterns de la playlist historique (song.playlist)
    (song.playlist || []).forEach((item, index) => {
      const pat = (song.patterns || []).find((p) => p.id === item.pattern);
      const patName = pat?.name || 'Pattern';
      const patLength = item.length || pat?.length || 16;
      const trackIdx = item.track || 0;

      const block = document.createElement('div');
      block.className = 'pf-playlist-block';
      block.dataset.type = 'pattern';
      block.style.left = ((item.start || 0) * stepWidth) + 'px';
      block.style.top = (trackIdx * TRACK_HEIGHT + 3) + 'px';
      block.style.width = (patLength * stepWidth - 2) + 'px';
      block.style.height = (TRACK_HEIGHT - 6) + 'px';

      const title = document.createElement('div');
      title.className = 'pf-playlist-block-title';
      title.textContent = patName;
      block.appendChild(title);

      const miniView = document.createElement('div');
      miniView.className = 'pf-playlist-miniview';
      (pat?.notes || []).forEach((n) => {
        const dot = document.createElement('div');
        dot.className = 'pf-playlist-minidot';
        dot.style.left = ((n.step / patLength) * 100) + '%';
        miniView.appendChild(dot);
      });
      block.appendChild(miniView);

      // Poignee de redimensionnement sur bloc de playlist
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'pf-clip-resize-handle';
      resizeHandle.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const initialLength = patLength;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const stepDelta = Math.round(dx / stepWidth);
          const rawLength = Math.max(snapSteps, initialLength + stepDelta);
          const snappedLength = Math.max(1, Math.round(rawLength / snapSteps) * snapSteps);

          item.length = snappedLength;
          block.style.width = (snappedLength * stepWidth - 2) + 'px';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onPlaylistChange?.();
          applyLayout();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };
      block.appendChild(resizeHandle);

      // Clic droit = supprimer le bloc
      block.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        song.playlist.splice(index, 1);
        onPlaylistChange?.();
        renderBlocks();
      };

      // Clic gauche : Decoupage ou Deplacement
      block.onmousedown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.pf-clip-resize-handle')) return;

        if (activeTool === 'split') {
          e.preventDefault();
          e.stopPropagation();
          const rect = block.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickStepInBlock = Math.floor(clickX / stepWidth);
          const rawSplitStep = (item.start || 0) + clickStepInBlock;
          const splitStep = Math.round(rawSplitStep / snapSteps) * snapSteps;

          const itemStart = item.start || 0;
          const itemEnd = itemStart + patLength;

          if (splitStep > itemStart && splitStep < itemEnd) {
            const firstPartLength = splitStep - itemStart;
            const secondPartLength = patLength - firstPartLength;

            item.length = firstPartLength;
            song.playlist.splice(index + 1, 0, {
              pattern: item.pattern,
              start: splitStep,
              length: secondPartLength,
              track: item.track
            });
            onPlaylistChange?.();
            renderBlocks();
          }
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const isDuplicate = e.ctrlKey || e.altKey;
        let targetItem = item;

        if (isDuplicate) {
          targetItem = { pattern: item.pattern, start: item.start, track: item.track, length: patLength };
          song.playlist.push(targetItem);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const initialStart = targetItem.start || 0;
        const initialTrack = targetItem.track || 0;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          const stepDelta = Math.round(dx / stepWidth);
          const trackDelta = Math.round(dy / TRACK_HEIGHT);

          const rawStart = Math.max(0, initialStart + stepDelta);
          const snappedStart = Math.round(rawStart / snapSteps) * snapSteps;
          const newTrack = Math.max(0, Math.min(numT - 1, initialTrack + trackDelta));

          targetItem.start = snappedStart;
          targetItem.track = newTrack;

          block.style.left = (snappedStart * stepWidth) + 'px';
          block.style.top = (newTrack * TRACK_HEIGHT + 3) + 'px';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onPlaylistChange?.();
          applyLayout();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      blocksLayer.appendChild(block);
    });
  }

  // Clic sur une piste vide pour placer le pattern selectionne
  tracksArea.onmousedown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.pf-playlist-block')) return;
    if (activeTool === 'split') return;

    const rect = tracksArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const numT = getNumTracks();
    const track = Math.max(0, Math.min(numT - 1, Math.floor(y / TRACK_HEIGHT)));
    const rawStep = Math.max(0, Math.floor(x / stepWidth));
    const step = Math.floor(rawStep / snapSteps) * snapSteps;

    song.playlist = song.playlist || [];
    song.playlist.push({
      pattern: selectedPatternId,
      start: step,
      track
    });

    onPlaylistChange?.();
    applyLayout();
  };

  applyLayout();

  timelineContent.appendChild(ruler);
  timelineContent.appendChild(tracksArea);
  timelineScroll.appendChild(timelineContent);
  body.appendChild(timelineScroll);
  root.appendChild(body);

  container.appendChild(root);

  return () => {
    cleanups.forEach((fn) => fn());
  };
}