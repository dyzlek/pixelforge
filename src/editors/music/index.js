// PixelForge Music Studio — Editeur musical Chiptune (FL Studio style)
import './music.css';
import { createSong, uid } from '../../core/project.js';
import { createChipAudio, MASTER_GAIN } from '../../audio/chip.js';
import { renderChannelRack } from './rack.js';
import { renderPianoRoll } from './pianoroll.js';
import { renderPlaylist } from './playlist.js';
import { renderMixer } from './mixer.js';
import { getIconSvg } from '../../ui/icons.js';
import { DRUM_PATTERNS } from '../../audio/presets/drums.js';

let sharedAudioCtx = null;
let sharedMasterGain = null;
let sharedChipAudio = null;

function getSharedChip() {
  if (sharedChipAudio) return sharedChipAudio;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    sharedAudioCtx = new AC();
    sharedMasterGain = sharedAudioCtx.createGain();
    sharedMasterGain.gain.value = MASTER_GAIN;
    sharedMasterGain.connect(sharedAudioCtx.destination);
    sharedChipAudio = createChipAudio(sharedAudioCtx, sharedMasterGain);
  } catch (e) {
    return null;
  }
  return sharedChipAudio;
}

// Instance par onglet ; renvoie un handle { dispose, onShow, onHide }.
export function mount(container, store, { refId = null } = {}) {
  const cleanups = [];
  let active = false;
  container.innerHTML = '';

  const songs = () => store.project.songs || [];
  let song = (refId && songs().find((s) => s.id === refId)) || songs()[0];

  if (!song) {
    const created = createSong('Musique 1');
    store.update((p) => {
      p.songs = p.songs || [];
      p.songs.push(created);
    }, 'song:create');
    song = created;
  }
  // Le morceau est relu dans store.project par son id a chaque rendu (le projet est remplace par annuler / retablir)
  let songId = song.id;
  const resolveSong = () => songs().find((s) => s.id === songId) || null;
  let viewCleanup = null;

  let activePatternId = song.patterns?.[0]?.id || null;
  let selectedChannelId = song.channels?.[0]?.id || null;
  let isPlaying = false;
  let playMode = 'pattern'; // 'pattern' ou 'song'
  let activeView = 'rack'; // 'rack' ou 'pianoroll'
  let currentStep = -1;
  let metronome = false;
  let activeController = null;
  let cursorAnimFrame = null;

  const root = document.createElement('div');
  root.className = 'pf-music-root';

  // 1. Barre de transport
  const transport = document.createElement('div');
  transport.className = 'pf-music-transport';

  const btnGroup = document.createElement('div');
  btnGroup.className = 'pf-transport-btn-group';

  const btnPlay = document.createElement('button');
  btnPlay.className = 'pf-transport-btn';
  btnPlay.innerHTML = getIconSvg('play', 14);
  btnPlay.title = 'Lire / Mettre en pause (Espace)';

  const btnStop = document.createElement('button');
  btnStop.className = 'pf-transport-btn';
  btnStop.innerHTML = getIconSvg('stop', 14);
  btnStop.title = 'Arreter (Echap)';

  btnGroup.appendChild(btnPlay);
  btnGroup.appendChild(btnStop);
  transport.appendChild(btnGroup);

  // Mode Pattern / Song
  const modeGroup = document.createElement('div');
  modeGroup.className = 'pf-transport-btn-group';

  const btnPatMode = document.createElement('button');
  btnPatMode.className = 'pf-transport-btn active';
  btnPatMode.style.width = 'auto';
  btnPatMode.style.padding = '0 8px';
  btnPatMode.style.fontSize = '11px';
  btnPatMode.style.fontWeight = 'bold';
  btnPatMode.textContent = 'PAT';
  btnPatMode.title = 'Mode Pattern';

  const btnSongMode = document.createElement('button');
  btnSongMode.className = 'pf-transport-btn';
  btnSongMode.style.width = 'auto';
  btnSongMode.style.padding = '0 8px';
  btnSongMode.style.fontSize = '11px';
  btnSongMode.style.fontWeight = 'bold';
  btnSongMode.textContent = 'SONG';
  btnSongMode.title = 'Mode Morceau complet (Playlist)';

  btnPatMode.onclick = () => {
    playMode = 'pattern';
    btnPatMode.classList.add('active');
    btnSongMode.classList.remove('active');
    if (isPlaying) { stopPlayback(); startPlayback(); }
  };

  btnSongMode.onclick = () => {
    playMode = 'song';
    btnSongMode.classList.add('active');
    btnPatMode.classList.remove('active');
    if (isPlaying) { stopPlayback(); startPlayback(); }
  };

  modeGroup.appendChild(btnPatMode);
  modeGroup.appendChild(btnSongMode);
  transport.appendChild(modeGroup);

  // Vue Rack / Piano Roll / Playlist
  const viewGroup = document.createElement('div');
  viewGroup.className = 'pf-transport-btn-group';

  const btnViewRack = document.createElement('button');
  btnViewRack.className = 'pf-transport-btn active';
  btnViewRack.style.width = 'auto';
  btnViewRack.style.padding = '0 8px';
  btnViewRack.style.fontSize = '11px';
  btnViewRack.style.fontWeight = 'bold';
  btnViewRack.textContent = 'RACK';
  btnViewRack.title = 'Vue Channel Rack';

  const btnViewRoll = document.createElement('button');
  btnViewRoll.className = 'pf-transport-btn';
  btnViewRoll.style.width = 'auto';
  btnViewRoll.style.padding = '0 8px';
  btnViewRoll.style.fontSize = '11px';
  btnViewRoll.style.fontWeight = 'bold';
  btnViewRoll.textContent = 'PIANO ROLL';
  btnViewRoll.title = 'Vue Piano Roll interactif';

  const btnViewList = document.createElement('button');
  btnViewList.className = 'pf-transport-btn';
  btnViewList.style.width = 'auto';
  btnViewList.style.padding = '0 8px';
  btnViewList.style.fontSize = '11px';
  btnViewList.style.fontWeight = 'bold';
  btnViewList.textContent = 'PLAYLIST';
  btnViewList.title = 'Vue Playlist (Arrangement)';

  const btnViewMixer = document.createElement('button');
  btnViewMixer.className = 'pf-transport-btn';
  btnViewMixer.style.width = 'auto';
  btnViewMixer.style.padding = '0 8px';
  btnViewMixer.style.fontSize = '11px';
  btnViewMixer.style.fontWeight = 'bold';
  btnViewMixer.textContent = 'MIXER';
  btnViewMixer.title = 'Vue Console de mixage & Export';

  const setView = (v) => {
    activeView = v;
    btnViewRack.classList.toggle('active', v === 'rack');
    btnViewRoll.classList.toggle('active', v === 'pianoroll');
    btnViewList.classList.toggle('active', v === 'playlist');
    btnViewMixer.classList.toggle('active', v === 'mixer');
    render();
  };

  btnViewRack.onclick = () => setView('rack');
  btnViewRoll.onclick = () => setView('pianoroll');
  btnViewList.onclick = () => setView('playlist');
  btnViewMixer.onclick = () => setView('mixer');

  viewGroup.appendChild(btnViewRack);
  viewGroup.appendChild(btnViewRoll);
  viewGroup.appendChild(btnViewList);
  viewGroup.appendChild(btnViewMixer);
  transport.appendChild(viewGroup);

  const sep1 = document.createElement('div');
  sep1.className = 'pf-transport-sep';
  transport.appendChild(sep1);

  // BPM
  const bpmItem = document.createElement('div');
  bpmItem.className = 'pf-transport-item';
  bpmItem.innerHTML = '<span>BPM</span>';

  const bpmInput = document.createElement('input');
  bpmInput.type = 'number';
  bpmInput.className = 'pf-transport-val';
  bpmInput.style.width = '50px';
  bpmInput.min = '30';
  bpmInput.max = '300';
  bpmInput.value = String(song.bpm || 140);
  bpmInput.onchange = (e) => {
    const v = Math.max(30, Math.min(300, parseInt(e.target.value, 10) || 140));
    bpmInput.value = String(v);
    store.update((p) => {
      const cur = (p.songs || []).find((s) => s.id === song.id);
      if (cur) cur.bpm = v;
    }, 'song:bpm');
    if (isPlaying) { stopPlayback(); startPlayback(); }
  };

  bpmItem.appendChild(bpmInput);
  transport.appendChild(bpmItem);

  // Metronome
  const btnMetro = document.createElement('button');
  btnMetro.className = 'pf-transport-btn';
  btnMetro.textContent = 'TIC';
  btnMetro.style.fontSize = '10px';
  btnMetro.style.fontWeight = 'bold';
  btnMetro.title = 'Activer / Desactiver le metronome';
  btnMetro.onclick = () => {
    metronome = !metronome;
    btnMetro.classList.toggle('active', metronome);
  };
  transport.appendChild(btnMetro);

  const sep2 = document.createElement('div');
  sep2.className = 'pf-transport-sep';
  transport.appendChild(sep2);

  // Pattern selector
  const patItem = document.createElement('div');
  patItem.className = 'pf-transport-item';
  patItem.innerHTML = '<span>Pattern</span>';

  const patSelect = document.createElement('select');
  patSelect.className = 'pf-transport-val';

  const refreshPatternSelect = () => {
    patSelect.innerHTML = '';
    (song.patterns || []).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || 'Pattern';
      opt.selected = p.id === activePatternId;
      patSelect.appendChild(opt);
    });
  };
  refreshPatternSelect();

  patSelect.onchange = (e) => {
    activePatternId = e.target.value;
    render();
    if (isPlaying && playMode === 'pattern') { stopPlayback(); startPlayback(); }
  };
  patItem.appendChild(patSelect);

  // Bouton ajouter pattern
  const btnAddPat = document.createElement('button');
  btnAddPat.className = 'pf-transport-btn';
  btnAddPat.innerHTML = getIconSvg('plus', 12);
  btnAddPat.title = 'Nouveau pattern';
  btnAddPat.onclick = () => {
    const newId = uid();
    const count = (song.patterns || []).length + 1;
    const newPat = { id: newId, name: 'Pattern ' + count, length: 16, notes: [] };
    store.update((p) => {
      const cur = (p.songs || []).find((s) => s.id === song.id);
      if (cur) {
        cur.patterns = cur.patterns || [];
        cur.patterns.push(newPat);
      }
    }, 'song:add_pattern');
    activePatternId = newId;
    refreshPatternSelect();
    render();
  };
  patItem.appendChild(btnAddPat);

  // Selecteur de longueur de pas (16, 32, 64)
  const lenSelect = document.createElement('select');
  lenSelect.className = 'pf-transport-val';
  [16, 32, 64].forEach((len) => {
    const opt = document.createElement('option');
    opt.value = String(len);
    opt.textContent = len + ' pas';
    lenSelect.appendChild(opt);
  });

  const updateLenSelectValue = () => {
    const curPat = (song.patterns || []).find((p) => p.id === activePatternId);
    lenSelect.value = String(curPat?.length || 16);
  };
  updateLenSelectValue();

  lenSelect.onchange = (e) => {
    const len = parseInt(e.target.value, 10);
    store.update((p) => {
      const cur = (p.songs || []).find((s) => s.id === song.id);
      const pat = (cur?.patterns || []).find((pt) => pt.id === activePatternId);
      if (pat) pat.length = len;
    }, 'song:pattern_length');
    render();
  };
  patItem.appendChild(lenSelect);

  transport.appendChild(patItem);

  root.appendChild(transport);

  // 2. Zone principale
  const mainArea = document.createElement('div');
  mainArea.className = 'pf-music-main';
  root.appendChild(mainArea);
  container.appendChild(root);

  // Fonctions de controle de lecture
  function startPlayback(seekStep = 0) {
    const chip = getSharedChip();
    if (!chip) return;
    if (sharedAudioCtx && sharedAudioCtx.state !== 'running') {
      sharedAudioCtx.resume();
    }
    stopPlayback();

    isPlaying = true;
    btnPlay.classList.add('playing');
    btnPlay.innerHTML = getIconSvg('pause', 14);

    let songObj = song;
    let pLen = 16;
    if (playMode === 'pattern') {
      const curPat = (song.patterns || []).find((p) => p.id === activePatternId) || song.patterns?.[0];
      pLen = curPat?.length || 16;
      songObj = {
        ...song,
        patterns: [curPat],
        playlist: [{ pattern: curPat?.id || 'p0', start: 0, track: 0 }],
        loop: true
      };
    } else {
      pLen = Math.max(16, ...((song.playlist || []).map((it) => {
        const pat = (song.patterns || []).find((p) => p.id === it.pattern);
        return (it.start || 0) + (pat?.length || 16);
      })));
    }

    activeController = chip.playSong(songObj, {
      loop: true,
      volume: 1,
      startStep: seekStep,
      onBeat(beat) {
        if (metronome && sharedChipAudio) {
          sharedChipAudio.playSfx('blip', 0, 0.3, beat % 4 === 0 ? 1.5 : 1);
        }
      }
    });

    const trackSweep = () => {
      if (!isPlaying || !activeController) return;
      const step = activeController.getCurrentStep() % pLen;
      if (step !== currentStep) {
        currentStep = step;
        updateCursorInDOM(currentStep);
      }
      cursorAnimFrame = requestAnimationFrame(trackSweep);
    };
    cursorAnimFrame = requestAnimationFrame(trackSweep);
  }

  function stopPlayback() {
    isPlaying = false;
    currentStep = -1;
    if (cursorAnimFrame) {
      cancelAnimationFrame(cursorAnimFrame);
      cursorAnimFrame = null;
    }
    if (activeController) {
      activeController.stop();
      activeController = null;
    }
    btnPlay.classList.remove('playing');
    btnPlay.innerHTML = getIconSvg('play', 14);
    updateCursorInDOM(-1);
  }

  btnPlay.onclick = () => {
    if (isPlaying) stopPlayback();
    else startPlayback(0);
  };

  btnStop.onclick = () => stopPlayback();

  function updateCursorInDOM(step) {
    const allStepButtons = mainArea.querySelectorAll('.pf-step-btn');
    allStepButtons.forEach((btn) => btn.classList.remove('cursor-now'));
    const playhead = mainArea.querySelector('.pf-playlist-playhead');
    if (playhead) {
      if (step >= 0) {
        playhead.style.display = 'block';
        playhead.style.left = (step * 12) + 'px';
      } else {
        playhead.style.display = 'none';
      }
    }
    if (step >= 0) {
      const activeStepButtons = mainArea.querySelectorAll(`.pf-step-ruler-num:nth-child(${step + 1}), .pf-rack-steps button:nth-child(${step + 1}), .pf-pianoroll-col:nth-child(${step + 1})`);
      activeStepButtons.forEach((btn) => btn.classList.add('cursor-now'));
    }
  }

  // Rendu du Channel Rack, Piano Roll, Playlist ou Mixeur
  function render() {
    song = resolveSong() || song;
    if (viewCleanup) { try { viewCleanup(); } catch (e) { console.error(e); } }
    viewCleanup = null;
    updateLenSelectValue();
    refreshPatternSelect();

    if (activeView === 'mixer') {
      viewCleanup = renderMixer(mainArea, {
        song,
        chip: getSharedChip(),
        onChannelChange(chId, patch) {
          store.update((p) => {
            const curSong = (p.songs || []).find((s) => s.id === song.id);
            const curCh = (curSong?.channels || []).find((c) => c.id === chId);
            if (curCh) Object.assign(curCh, patch);
          }, 'song:channel_patch');
          render();
        },
        onSongImport(importedSong) {
          store.update((p) => {
            p.songs = p.songs || [];
            p.songs.push(importedSong);
          }, 'song:import_midi');
          song = importedSong;
          songId = importedSong.id;
          activePatternId = importedSong.patterns?.[0]?.id || null;
          selectedChannelId = importedSong.channels?.[0]?.id || null;
          render();
        }
      });
      return;
    }

    if (activeView === 'playlist') {
      // Copie de travail : la playlist la modifie, puis onPlaylistChange l'ecrit dans le projet via store.update
      const viewSong = structuredClone(song);
      viewCleanup = renderPlaylist(mainArea, {
        song: viewSong,
        activePatternId,
        currentStep,
        onPlaylistChange() {
          store.update((p) => {
            const cur = (p.songs || []).find((s) => s.id === song.id);
            if (cur) {
              cur.playlist = structuredClone(viewSong.playlist || []);
              cur.clips = structuredClone(viewSong.clips || []);
              cur.tracks = structuredClone(viewSong.tracks || []);
              cur.channels = structuredClone(viewSong.channels || []);
              cur.markers = structuredClone(viewSong.markers || []);
              cur.timeSignature = structuredClone(viewSong.timeSignature || [4, 4]);
              cur.bpm = viewSong.bpm;
              cur.loop = { ...(cur.loop || {}), ...(viewSong.loop || {}) };
            }
          }, 'song:playlist');
        },
        onPatternSelect(patId) {
          activePatternId = patId;
          refreshPatternSelect();
        },
        onSeek(step) {
          currentStep = step;
          if (isPlaying) {
            stopPlayback();
            startPlayback(step);
          } else {
            updateCursorInDOM(step);
          }
        }
      });
      return;
    }

    if (activeView === 'pianoroll') {
      const viewSong = structuredClone(song);
      viewCleanup = renderPianoRoll(mainArea, {
        song: viewSong,
        activePatternId,
        selectedChannelId,
        chip: getSharedChip(),
        currentStep,
        onNotesChange() {
          store.update((p) => {
            const cur = (p.songs || []).find((s) => s.id === song.id);
            if (cur) cur.patterns = structuredClone(viewSong.patterns || []);
          }, 'song:notes');
        },
        onChannelChange(chId, patch) {
          store.update((p) => {
            const curSong = (p.songs || []).find((s) => s.id === song.id);
            const curCh = (curSong?.channels || []).find((c) => c.id === chId);
            if (curCh) Object.assign(curCh, patch);
          }, 'song:channel_patch');
          render();
        }
      });
      return;
    }

    viewCleanup = renderChannelRack(mainArea, {
      song,
      activePatternId,
      currentStep,
      selectedChannelId,
      onAudition(ch) {
        if (!sharedChipAudio) return;
        const instType = typeof ch.instrument === 'string' ? ch.instrument : (ch.instrument?.type || 'pulse50');
        const presetKey = ch.preset || ch.instrument?.preset;
        if (presetKey && sharedChipAudio.previewPreset) {
          sharedChipAudio.previewPreset(presetKey, ch.defaultPitch || 'C4');
        } else {
          sharedChipAudio.scheduleNote({
            time: sharedAudioCtx.currentTime,
            duration: 0.35,
            instrument: instType,
            preset: presetKey,
            params: ch.params || ch.instrument?.params,
            pitch: ch.defaultPitch || 'C4',
            volume: (ch.volume != null ? ch.volume : 0.8) * 0.85,
            drumKit: ch.drumKit
          });
        }
      },
      onChannelSelect(chId) {
        selectedChannelId = chId;
        setView('pianoroll');
      },
      onApplyDrumPattern(patternId, chId) {
        const tmpl = DRUM_PATTERNS[patternId];
        if (!tmpl) return;
        store.update((p) => {
          const curSong = (p.songs || []).find((s) => s.id === song.id);
          const curPat = (curSong?.patterns || []).find((pt) => pt.id === activePatternId);
          if (!curPat) return;
          curPat.notes = (curPat.notes || []).filter((n) => n.ch !== chId);
          const pLen = curPat.length || 16;
          for (const n of tmpl.notes) {
            if (n.step < pLen) {
              curPat.notes.push({ ch: chId, step: n.step, pitch: n.pitch, len: 1, vel: 1 });
            }
          }
        }, 'song:apply_drum_pattern');
        render();
      },
      onStepToggle(chId, stepIndex, pitch, active) {
        store.update((p) => {
          const curSong = (p.songs || []).find((s) => s.id === song.id);
          const curPat = (curSong?.patterns || []).find((pt) => pt.id === activePatternId);
          if (!curPat) return;
          curPat.notes = curPat.notes || [];

          if (active) {
            const exists = curPat.notes.some((n) => n.ch === chId && n.step === stepIndex && (!pitch || n.pitch === pitch));
            if (!exists) {
              curPat.notes.push({
                ch: chId,
                step: stepIndex,
                len: 1,
                pitch: pitch || 'C4',
                vel: 1
              });
            }
          } else {
            curPat.notes = curPat.notes.filter((n) => !(n.ch === chId && n.step === stepIndex && (!pitch || n.pitch === pitch)));
          }
        }, 'song:step_toggle');

        // Apercu sonore de la note activee
        if (active && sharedChipAudio) {
          const ch = (song.channels || []).find((c) => c.id === chId);
          if (ch) {
            const instType = typeof ch.instrument === 'string' ? ch.instrument : (ch.instrument?.type || 'pulse50');
            const presetKey = ch.preset || ch.instrument?.preset;
            sharedChipAudio.scheduleNote({
              time: sharedAudioCtx.currentTime,
              duration: 0.1,
              instrument: instType,
              preset: presetKey,
              params: ch.params || ch.instrument?.params,
              pitch: pitch || ch.defaultPitch || 'C4',
              volume: (ch.volume != null ? ch.volume : 0.8) * 0.7,
              drumKit: ch.drumKit
            });
          }
        }
        render();
      },
      onChannelChange(chId, patch) {
        store.update((p) => {
          const curSong = (p.songs || []).find((s) => s.id === song.id);
          const curCh = (curSong?.channels || []).find((c) => c.id === chId);
          if (curCh) Object.assign(curCh, patch);
        }, 'song:channel_patch');
        render();
      },
      onAddChannel(instrument, name, extra = {}) {
        const newId = uid();
        const ch = {
          id: newId,
          name,
          instrument,
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          env: { a: 0.005, d: 0.08, s: 0.6, r: 0.05 },
          ...extra
        };
        if (instrument === 'noise' || instrument === 'drum_machine') ch.drumKit = true;

        store.update((p) => {
          const curSong = (p.songs || []).find((s) => s.id === song.id);
          if (curSong) {
            curSong.channels = curSong.channels || [];
            curSong.channels.push(ch);
          }
        }, 'song:add_channel');
        selectedChannelId = newId;
        render();
      },
      onDeleteChannel(chId) {
        store.update((p) => {
          const curSong = (p.songs || []).find((s) => s.id === song.id);
          if (curSong) {
            curSong.channels = (curSong.channels || []).filter((c) => c.id !== chId);
            (curSong.patterns || []).forEach((pt) => {
              pt.notes = (pt.notes || []).filter((n) => n.ch !== chId);
            });
          }
        }, 'song:delete_channel');
        if (selectedChannelId === chId) {
          selectedChannelId = song.channels?.[0]?.id || null;
        }
        render();
      }
    });
  }

  // Raccourcis clavier (Espace pour Play/Stop)
  const handleKeyDown = (e) => {
    if (!active) return;
    // Espace sur un bouton focalise : on laisse le bouton reagir (pas de double action)
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (isPlaying) stopPlayback();
      else startPlayback();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      stopPlayback();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  cleanups.push(() => window.removeEventListener('keydown', handleKeyDown));

  // Annuler / retablir / rechargement : relire le morceau et redessiner
  cleanups.push(store.on('load', () => {
    if (!resolveSong()) return;
    if (isPlaying) stopPlayback();
    render();
  }));

  render();

  if (typeof window !== 'undefined') {
    window.__pfMusicEditor = {
      isPlaying: () => isPlaying,
      getCurrentStep: () => currentStep,
      getController: () => activeController,
      play: () => startPlayback(0),
      stop: () => stopPlayback(),
    };
  }

  return {
    dispose() {
      active = false;
      stopPlayback();
      if (typeof window !== 'undefined' && window.__pfMusicEditor?.getController() === activeController) {
        window.__pfMusicEditor = null;
      }
      for (const fn of cleanups) fn();
      if (viewCleanup) viewCleanup();
      viewCleanup = null;
    },
    onShow() { active = true; store.ui.selectedSongId = song.id; },
    onHide() { active = false; stopPlayback(); },
  };
}
