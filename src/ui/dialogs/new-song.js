// Boite de dialogue « Nouvelle musique » avec modeles de depart chiptune.
import { createSong, uid } from '../../core/project.js';
import { SONG_PRESETS, getSongPreset } from '../../audio/presets/index.js';

export function showNewSongDialog(store, workspace) {
  const overlay = document.createElement('div');
  overlay.className = 'pf-modal-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const modal = document.createElement('div');
  modal.className = 'panel pf-modal';
  modal.style.width = '480px';
  modal.style.maxWidth = '90vw';
  modal.style.maxHeight = '85vh';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.gap = '12px';
  modal.style.padding = '16px';
  modal.style.background = '#141724';
  modal.style.border = '1px solid #2e3552';
  modal.style.borderRadius = '8px';
  modal.style.color = '#fff';

  const title = document.createElement('h3');
  title.style.margin = '0';
  title.style.fontSize = '15px';
  title.style.fontWeight = '700';
  title.textContent = 'Nouvelle musique chiptune';
  modal.appendChild(title);

  // Champ nom
  const nameLabel = document.createElement('label');
  nameLabel.style.display = 'flex';
  nameLabel.style.flexDirection = 'column';
  nameLabel.style.gap = '4px';
  nameLabel.style.fontSize = '12px';
  nameLabel.style.color = '#8b90a8';
  nameLabel.textContent = 'Nom du morceau :';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = 'Aventure';
  nameInput.className = 'input';
  nameInput.style.padding = '6px 10px';
  nameInput.style.background = '#0e1019';
  nameInput.style.border = '1px solid #2e3552';
  nameInput.style.borderRadius = '4px';
  nameInput.style.color = '#fff';
  nameLabel.appendChild(nameInput);
  modal.appendChild(nameLabel);

  // Modeles de depart
  const tmplLabel = document.createElement('div');
  tmplLabel.style.fontSize = '12px';
  tmplLabel.style.color = '#8b90a8';
  tmplLabel.textContent = 'Choisir un modele de depart :';
  modal.appendChild(tmplLabel);

  const tmplList = document.createElement('div');
  tmplList.style.display = 'flex';
  tmplList.style.flexDirection = 'column';
  tmplList.style.gap = '6px';
  tmplList.style.overflowY = 'auto';
  tmplList.style.maxHeight = '240px';
  tmplList.style.paddingRight = '4px';

  let selectedPresetId = 'adventure';

  const templates = [
    { id: 'empty', name: 'Morceau vide', description: 'Canaux de base (Lead, Accompagnement, Basse, Batterie), page blanche.' },
    ...SONG_PRESETS
  ];

  const updateSelection = () => {
    Array.from(tmplList.children).forEach((card) => {
      const isSel = card.dataset.id === selectedPresetId;
      card.style.borderColor = isSel ? '#41a6f6' : '#262a3f';
      card.style.background = isSel ? '#1e243d' : '#181b29';
    });
  };

  templates.forEach((t) => {
    const card = document.createElement('div');
    card.dataset.id = t.id;
    card.style.padding = '8px 12px';
    card.style.border = '1px solid #262a3f';
    card.style.borderRadius = '6px';
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.15s ease';

    const cardTitle = document.createElement('div');
    cardTitle.style.fontWeight = '600';
    cardTitle.style.fontSize = '12px';
    cardTitle.textContent = t.name;

    const cardDesc = document.createElement('div');
    cardDesc.style.fontSize = '11px';
    cardDesc.style.color = '#8b90a8';
    cardDesc.style.marginTop = '2px';
    cardDesc.textContent = t.description;

    card.appendChild(cardTitle);
    card.appendChild(cardDesc);

    card.onclick = () => {
      selectedPresetId = t.id;
      if (t.id !== 'empty') {
        nameInput.value = t.name.split(' ')[0];
      }
      updateSelection();
    };

    tmplList.appendChild(card);
  });

  updateSelection();
  modal.appendChild(tmplList);

  // Boutons actions
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.gap = '8px';
  btnRow.style.marginTop = '8px';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Annuler';
  cancelBtn.style.padding = '6px 12px';
  cancelBtn.style.background = '#202438';
  cancelBtn.style.border = '1px solid #2e3552';
  cancelBtn.style.color = '#fff';
  cancelBtn.style.borderRadius = '4px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.onclick = () => overlay.remove();

  const createBtn = document.createElement('button');
  createBtn.textContent = 'Creer la musique';
  createBtn.className = 'primary';
  createBtn.style.padding = '6px 14px';
  createBtn.style.background = '#3b5dc9';
  createBtn.style.border = '1px solid #41a6f6';
  createBtn.style.color = '#fff';
  createBtn.style.borderRadius = '4px';
  createBtn.style.cursor = 'pointer';
  createBtn.style.fontWeight = '600';

  const handleCreate = () => {
    const finalName = nameInput.value.trim() || 'Musique';
    let newSong;
    if (selectedPresetId === 'empty') {
      newSong = createSong(finalName);
    } else {
      newSong = getSongPreset(selectedPresetId) || createSong(finalName);
      newSong.id = uid('sng');
      newSong.name = finalName;
    }

    store.update((p) => {
      p.songs = p.songs || [];
      p.songs.push(newSong);
    }, 'song:create');

    workspace.open({ kind: 'song', refId: newSong.id, title: newSong.name });
    overlay.remove();
  };

  createBtn.onclick = handleCreate;
  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') overlay.remove();
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(createBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(() => nameInput.focus(), 50);
}
