// PixelForge Music Studio — Playlist (Arrangement des patterns musicaux)
import { getIconSvg } from '../../ui/icons.js';

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

  const STEP_WIDTH = 12; // 12px par pas, soit 192px par mesure de 16 pas
  const TRACK_HEIGHT = 44;
  const NUM_TRACKS = 8;
  const TOTAL_STEPS = Math.max(128, ...((song.playlist || []).map((it) => {
    const pat = (song.patterns || []).find((p) => p.id === it.pattern);
    return (it.start || 0) + (pat?.length || 16);
  }))) + 32;

  let snapSteps = 16; // aimantation par defaut a 1 mesure (16 pas)
  let selectedPatternId = activePatternId || song.patterns?.[0]?.id || null;

  const root = document.createElement('div');
  root.className = 'pf-playlist-root';

  // 1. Barre d'outils de la playlist
  const toolbar = document.createElement('div');
  toolbar.className = 'pf-playlist-toolbar';

  // Selecteur de pattern a placer
  const patLabel = document.createElement('div');
  patLabel.className = 'pf-transport-item';
  patLabel.innerHTML = '<span>Pinceau :</span>';

  const patSelect = document.createElement('select');
  patSelect.className = 'pf-transport-val';
  (song.patterns || []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || 'Pattern';
    opt.selected = p.id === selectedPatternId;
    patSelect.appendChild(opt);
  });
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
  snapLabel.innerHTML = '<span>Aimantation :</span>';

  const snapSelect = document.createElement('select');
  snapSelect.className = 'pf-transport-val';
  [
    { val: 16, label: '1 mesure (16 pas)' },
    { val: 8, label: '1/2 mesure (8 pas)' },
    { val: 4, label: '1 temps (4 pas)' },
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

  // Marqueurs de boucle (Loop Start / Loop End)
  const loopItem = document.createElement('div');
  loopItem.className = 'pf-transport-item';
  loopItem.innerHTML = '<span>Boucle debut (pas) :</span>';

  const loopStartInput = document.createElement('input');
  loopStartInput.type = 'number';
  loopStartInput.className = 'pf-transport-val';
  loopStartInput.style.width = '48px';
  loopStartInput.min = '0';
  loopStartInput.value = String(song.loopStart || 0);
  loopStartInput.onchange = (e) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    song.loopStart = val;
    onPlaylistChange?.();
    renderMarkers();
  };
  loopItem.appendChild(loopStartInput);
  toolbar.appendChild(loopItem);

  const btnClear = document.createElement('button');
  btnClear.className = 'pf-transport-btn';
  btnClear.style.width = 'auto';
  btnClear.style.padding = '0 8px';
  btnClear.style.fontSize = '11px';
  btnClear.textContent = 'Effacer tout';
  btnClear.title = 'Vider tous les blocs de la playlist';
  btnClear.onclick = () => {
    if (confirm('Voulez-vous effacer tous les blocs de la playlist ?')) {
      song.playlist = [];
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

  // Espaceur superieur pour aligner avec la reglette temporelle
  const cornerSpacer = document.createElement('div');
  cornerSpacer.className = 'pf-playlist-corner';
  cornerSpacer.textContent = 'Pistes';
  trackHeaders.appendChild(cornerSpacer);

  for (let t = 0; t < NUM_TRACKS; t++) {
    const th = document.createElement('div');
    th.className = 'pf-playlist-track-head';
    th.style.height = TRACK_HEIGHT + 'px';
    th.innerHTML = `<span>Piste ${t + 1}</span>`;
    trackHeaders.appendChild(th);
  }
  body.appendChild(trackHeaders);

  // Timeline scrollable
  const timelineScroll = document.createElement('div');
  timelineScroll.className = 'pf-playlist-scroll';

  const timelineContent = document.createElement('div');
  timelineContent.className = 'pf-playlist-content';
  timelineContent.style.width = (TOTAL_STEPS * STEP_WIDTH) + 'px';

  // Reglette temporelle en haut
  const ruler = document.createElement('div');
  ruler.className = 'pf-playlist-ruler';
  const numBars = Math.ceil(TOTAL_STEPS / 16);

  for (let b = 0; b < numBars; b++) {
    const barEl = document.createElement('div');
    barEl.className = 'pf-playlist-bar-num';
    barEl.style.left = (b * 16 * STEP_WIDTH) + 'px';
    barEl.style.width = (16 * STEP_WIDTH) + 'px';
    barEl.textContent = 'Mesure ' + (b + 1);
    ruler.appendChild(barEl);
  }

  // Marqueurs visuels de boucle
  const loopMarkerEl = document.createElement('div');
  loopMarkerEl.className = 'pf-playlist-loop-marker';
  function renderMarkers() {
    const loopStep = song.loopStart || 0;
    loopMarkerEl.style.left = (loopStep * STEP_WIDTH) + 'px';
    loopMarkerEl.innerHTML = `<span class="pf-loop-flag">LOOP</span>`;
  }
  renderMarkers();
  ruler.appendChild(loopMarkerEl);

  ruler.onclick = (e) => {
    const rect = ruler.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScroll.scrollLeft;
    const clickedStep = Math.max(0, Math.floor(x / STEP_WIDTH));
    onSeek?.(clickedStep);
  };

  timelineContent.appendChild(ruler);

  // Grille des pistes
  const tracksArea = document.createElement('div');
  tracksArea.className = 'pf-playlist-tracks-area';
  tracksArea.style.height = (NUM_TRACKS * TRACK_HEIGHT) + 'px';

  for (let t = 0; t < NUM_TRACKS; t++) {
    const lane = document.createElement('div');
    lane.className = 'pf-playlist-lane' + (t % 2 === 1 ? ' alt' : '');
    lane.dataset.track = String(t);
    lane.style.top = (t * TRACK_HEIGHT) + 'px';
    lane.style.height = TRACK_HEIGHT + 'px';
    tracksArea.appendChild(lane);
  }

  // Tete de lecture (balayage vertical)
  const playhead = document.createElement('div');
  playhead.className = 'pf-playlist-playhead';
  if (currentStep >= 0) {
    playhead.style.display = 'block';
    playhead.style.left = (currentStep * STEP_WIDTH) + 'px';
  } else {
    playhead.style.display = 'none';
  }
  tracksArea.appendChild(playhead);

  // Couche des blocs de patterns places
  const blocksLayer = document.createElement('div');
  blocksLayer.className = 'pf-playlist-blocks-layer';

  function renderBlocks() {
    blocksLayer.innerHTML = '';
    const playlist = song.playlist || [];

    playlist.forEach((item, index) => {
      const pat = (song.patterns || []).find((p) => p.id === item.pattern);
      const patName = pat?.name || 'Pattern';
      const patLength = pat?.length || 16;
      const trackIdx = item.track || 0;

      const block = document.createElement('div');
      block.className = 'pf-playlist-block';
      block.style.left = ((item.start || 0) * STEP_WIDTH) + 'px';
      block.style.top = (trackIdx * TRACK_HEIGHT + 3) + 'px';
      block.style.width = (patLength * STEP_WIDTH - 2) + 'px';
      block.style.height = (TRACK_HEIGHT - 6) + 'px';

      const title = document.createElement('div');
      title.className = 'pf-playlist-block-title';
      title.textContent = patName;
      block.appendChild(title);

      // Apercu mini des notes du pattern
      const miniView = document.createElement('div');
      miniView.className = 'pf-playlist-miniview';
      (pat?.notes || []).forEach((n) => {
        const dot = document.createElement('div');
        dot.className = 'pf-playlist-minidot';
        dot.style.left = ((n.step / patLength) * 100) + '%';
        miniView.appendChild(dot);
      });
      block.appendChild(miniView);

      // Clic droit = supprimer le bloc
      block.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        song.playlist.splice(index, 1);
        onPlaylistChange?.();
        renderBlocks();
      };

      // Glisser le bloc (deplacement temporel et entre pistes)
      block.onmousedown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const isDuplicate = e.ctrlKey || e.altKey;
        let targetItem = item;

        if (isDuplicate) {
          targetItem = { pattern: item.pattern, start: item.start, track: item.track };
          song.playlist.push(targetItem);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const initialStart = targetItem.start || 0;
        const initialTrack = targetItem.track || 0;

        const onMouseMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          const stepDelta = Math.round(dx / STEP_WIDTH);
          const trackDelta = Math.round(dy / TRACK_HEIGHT);

          const rawStart = Math.max(0, initialStart + stepDelta);
          const snappedStart = Math.round(rawStart / snapSteps) * snapSteps;
          const newTrack = Math.max(0, Math.min(NUM_TRACKS - 1, initialTrack + trackDelta));

          targetItem.start = snappedStart;
          targetItem.track = newTrack;

          block.style.left = (snappedStart * STEP_WIDTH) + 'px';
          block.style.top = (newTrack * TRACK_HEIGHT + 3) + 'px';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          onPlaylistChange?.();
          renderBlocks();
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

    const rect = tracksArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const track = Math.max(0, Math.min(NUM_TRACKS - 1, Math.floor(y / TRACK_HEIGHT)));
    const rawStep = Math.max(0, Math.floor(x / STEP_WIDTH));
    const step = Math.floor(rawStep / snapSteps) * snapSteps;

    song.playlist = song.playlist || [];
    song.playlist.push({
      pattern: selectedPatternId,
      start: step,
      track
    });

    onPlaylistChange?.();
    renderBlocks();
  };

  renderBlocks();
  tracksArea.appendChild(blocksLayer);
  timelineContent.appendChild(tracksArea);
  timelineScroll.appendChild(timelineContent);
  body.appendChild(timelineScroll);
  root.appendChild(body);

  container.appendChild(root);

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
