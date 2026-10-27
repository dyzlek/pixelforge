// Catalogue des morceaux et motifs de batterie de demonstration PixelForge.
import { createAdventureSong } from './adventure.js';
import { createDungeonSong } from './dungeon.js';
import { createBossSong } from './boss.js';
import { createMenuSong } from './menu.js';
import { createVictorySong } from './victory.js';
import { createGameOverSong } from './gameover.js';
import { createEpic2MinSong } from './epic-2min.js';
import { DRUM_PATTERNS } from './drums.js';

export { DRUM_PATTERNS } from './drums.js';
export { createEpic2MinSong } from './epic-2min.js';

export const SONG_PRESETS = [
  {
    id: 'adventure',
    name: 'Aventure (Overworld)',
    description: 'Theme joyeux et dynamique pour phases de plateforme.',
    create: createAdventureSong
  },
  {
    id: 'dungeon',
    name: 'Donjon (Souterrain)',
    description: 'Ambiance mysterieuse et sombre en la mineur.',
    create: createDungeonSong
  },
  {
    id: 'boss',
    name: 'Combat de Boss',
    description: 'Theme rapide, intense et agressif en re mineur.',
    create: createBossSong
  },
  {
    id: 'menu',
    name: 'Menu Principal',
    description: 'Melodie douce et accueillante pour ecran titre.',
    create: createMenuSong
  },
  {
    id: 'victory',
    name: 'Victoire (Stage Clear)',
    description: 'Fanfare heroique triomphante de fin de niveau.',
    create: createVictorySong
  },
  {
    id: 'gameover',
    name: 'Defaite (Game Over)',
    description: 'Chute melancolique et triste en do mineur.',
    create: createGameOverSong
  },
  {
    id: 'epic_2min',
    name: 'Odyssee (2 minutes)',
    description: 'Morceau complet de demonstration avec intro, couplets, refrain et fin.',
    create: createEpic2MinSong
  }
];

export function getSongPreset(id) {
  const p = SONG_PRESETS.find((x) => x.id === id);
  return p ? p.create() : null;
}
