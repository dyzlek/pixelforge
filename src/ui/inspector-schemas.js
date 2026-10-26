/**
 * PixelForge Studio — Schémas déclaratifs pour l'Inspecteur unifié (Godot 4 style)
 */

export const SCHEMAS = {
  object: {
    title: 'Objet',
    groups: [
      {
        id: 'general',
        label: 'Général',
        fields: [
          { key: 'name', label: 'Nom', type: 'string', required: true },
          { key: 'folder', label: 'Dossier', type: 'string' },
          { key: 'spriteId', label: 'Sprite', type: 'sprite-ref' },
          { key: 'defaultAnim', label: 'Animation', type: 'anim-ref' },
        ],
      },
      {
        id: 'physics',
        label: 'Physique 2D',
        fields: [
          { key: 'physics.enabled', label: 'Activée', type: 'boolean', default: true },
          { key: 'physics.gravity', label: 'Gravité', type: 'boolean', default: true },
          { key: 'physics.immovable', label: 'Immobile / Bloquant', type: 'boolean', default: false },
          { key: 'physics.bounce', label: 'Rebond (0 - 1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0 },
          { key: 'physics.collideMap', label: 'Bloqué par le décor', type: 'boolean', default: true },
          { key: 'physics.collideWorld', label: 'Bloqué par les bords', type: 'boolean', default: true },
        ],
      },
      {
        id: 'hitbox',
        label: 'Hitbox / Boîte de collision',
        fields: [
          { key: 'hitbox.x', label: 'Décalage X (px)', type: 'number', step: 1, default: 0 },
          { key: 'hitbox.y', label: 'Décalage Y (px)', type: 'number', step: 1, default: 0 },
          { key: 'hitbox.w', label: 'Largeur (px)', type: 'number', min: 1, step: 1, default: 16 },
          { key: 'hitbox.h', label: 'Hauteur (px)', type: 'number', min: 1, step: 1, default: 16 },
        ],
      },
      {
        id: 'exportedProps',
        label: 'Propriétés exportées (@export)',
        type: 'exported-props',
      },
    ],
  },

  entity: {
    title: 'Entité placée',
    groups: [
      {
        id: 'transform',
        label: 'Transform (Position)',
        fields: [
          { key: 'x', label: 'Position X (px)', type: 'number', step: 1 },
          { key: 'y', label: 'Position Y (px)', type: 'number', step: 1 },
        ],
      },
      {
        id: 'template',
        label: 'Modèle',
        fields: [
          { key: 'objectId', label: 'Objet lié', type: 'object-ref', readonly: true },
        ],
      },
      {
        id: 'instanceProps',
        label: 'Variables d’instance (Props)',
        type: 'instance-props',
      },
    ],
  },

  map: {
    title: 'Scène / Carte',
    groups: [
      {
        id: 'dimensions',
        label: 'Dimensions',
        fields: [
          { key: 'name', label: 'Nom', type: 'string', required: true },
          { key: 'width', label: 'Largeur (tuiles)', type: 'number', min: 1, max: 512, step: 1 },
          { key: 'height', label: 'Hauteur (tuiles)', type: 'number', min: 1, max: 512, step: 1 },
          { key: 'tileSize', label: 'Taille tuile (px)', type: 'number', min: 4, max: 128, step: 4 },
        ],
      },
      {
        id: 'rendering',
        label: 'Rendu',
        fields: [
          { key: 'tilesetSpriteId', label: 'Tileset (Sprite)', type: 'sprite-ref' },
          { key: 'background', label: 'Couleur de fond', type: 'color', default: '#1a1c2c' },
        ],
      },
    ],
  },

  sound: {
    title: 'Effet sonore',
    groups: [
      {
        id: 'sfx',
        label: 'Synthèse SFX',
        fields: [
          { key: 'name', label: 'Nom', type: 'string', required: true },
          {
            key: 'sfx.preset',
            label: 'Préréglage',
            type: 'enum',
            options: ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'],
          },
          { key: 'sfx.volume', label: 'Volume (0 - 1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
          { key: 'sfx.pitch', label: 'Hauteur / Pitch', type: 'number', min: 0.1, max: 3, step: 0.1, default: 1 },
        ],
      },
    ],
  },

  settings: {
    title: 'Réglages du projet',
    groups: [
      {
        id: 'screen',
        label: 'Écran & Caméra',
        fields: [
          { key: 'width', label: 'Largeur écran (px)', type: 'number', min: 64, max: 1920, step: 16 },
          { key: 'height', label: 'Hauteur écran (px)', type: 'number', min: 64, max: 1080, step: 9 },
          { key: 'pixelZoom', label: 'Zoom pixel par défaut', type: 'number', min: 1, max: 8, step: 1 },
          { key: 'gravity', label: 'Gravité globale', type: 'number', min: 0, max: 5000, step: 50 },
          { key: 'touchControls', label: 'Contrôles tactiles', type: 'boolean', default: true },
        ],
      },
    ],
  },
};
