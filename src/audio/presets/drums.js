// Modeles rythmiques de batterie 8-bit classiques pour PixelForge.
// S'appliquent sur les canaux de type bruit (noise) avec drumKit: true.

export const DRUM_PATTERNS = {
  rock8bit: {
    id: 'rock8bit',
    name: 'Rock 8-bit',
    description: 'Rythme standard pop/rock avec caisse claire sur 2 et 4.',
    notes: [
      { step: 0, pitch: 'C3' },
      { step: 0, pitch: 'F#3' },
      { step: 2, pitch: 'F#3' },
      { step: 4, pitch: 'D3' },
      { step: 4, pitch: 'F#3' },
      { step: 6, pitch: 'F#3' },
      { step: 8, pitch: 'C3' },
      { step: 8, pitch: 'F#3' },
      { step: 10, pitch: 'F#3' },
      { step: 12, pitch: 'D3' },
      { step: 12, pitch: 'F#3' },
      { step: 14, pitch: 'F#3' }
    ]
  },
  discoRetro: {
    id: 'discoRetro',
    name: 'Disco / Techno retro',
    description: 'Pulsation four-on-the-floor avec charleston ouvert sur contretemps.',
    notes: [
      { step: 0, pitch: 'C3' },
      { step: 2, pitch: 'A#3' },
      { step: 4, pitch: 'C3' },
      { step: 4, pitch: 'D3' },
      { step: 6, pitch: 'A#3' },
      { step: 8, pitch: 'C3' },
      { step: 10, pitch: 'A#3' },
      { step: 12, pitch: 'C3' },
      { step: 12, pitch: 'D3' },
      { step: 14, pitch: 'A#3' }
    ]
  },
  march: {
    id: 'march',
    name: 'Marche cadensee',
    description: 'Rythme militaire avec roulements de caisse claire.',
    notes: [
      { step: 0, pitch: 'C3' },
      { step: 0, pitch: 'F#3' },
      { step: 2, pitch: 'D3' },
      { step: 4, pitch: 'D3' },
      { step: 5, pitch: 'D3' },
      { step: 6, pitch: 'D3' },
      { step: 8, pitch: 'C3' },
      { step: 8, pitch: 'F#3' },
      { step: 10, pitch: 'D3' },
      { step: 12, pitch: 'D3' },
      { step: 13, pitch: 'D3' },
      { step: 14, pitch: 'D3' }
    ]
  },
  halfTime: {
    id: 'halfTime',
    name: 'Demi-tempo (Half-Time)',
    description: 'Rythme lourd et pose avec caisse claire sur le 3e temps.',
    notes: [
      { step: 0, pitch: 'C3' },
      { step: 0, pitch: 'F#3' },
      { step: 4, pitch: 'F#3' },
      { step: 8, pitch: 'D3' },
      { step: 8, pitch: 'F#3' },
      { step: 12, pitch: 'F#3' },
      { step: 14, pitch: 'A#3' }
    ]
  }
};
