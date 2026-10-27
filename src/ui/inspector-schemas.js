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
        label: 'Physique 2D & 3D',
        fields: [
          { key: 'physics.enabled', label: 'Activée', type: 'boolean', default: true },
          { key: 'physics.gravity', label: 'Gravité', type: 'boolean', default: true },
          { key: 'physics.immovable', label: 'Immobile / Bloquant', type: 'boolean', default: false },
          { key: 'physics.bounce', label: 'Rebond (0 - 1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0 },
          { key: 'physics.collideMap', label: 'Bloqué par le décor', type: 'boolean', default: true },
          { key: 'physics.collideWorld', label: 'Bloqué par les bords', type: 'boolean', default: true },
          {
            key: 'physics.bodyType',
            label: 'Type de corps (3D Rapier)',
            type: 'enum',
            options: [
              { label: 'Dynamique (subit forces & collisions)', value: 'dynamic' },
              { label: 'Statique (décor fixe non poussable)', value: 'static' },
              { label: 'Cinématique (déplacé par script)', value: 'kinematic' },
            ],
            default: 'dynamic',
          },
          {
            key: 'physics.colliderShape',
            label: 'Forme du collider (3D Rapier)',
            type: 'enum',
            options: [
              { label: 'Boîte (Box)', value: 'box' },
              { label: 'Sphère (Sphere)', value: 'sphere' },
              { label: 'Capsule (Capsule)', value: 'capsule' },
              { label: 'Maillage (Trimesh)', value: 'trimesh' },
            ],
            default: 'box',
          },
          { key: 'physics.mass', label: 'Masse 3D (kg)', type: 'number', min: 0.01, step: 0.5, default: 1 },
          { key: 'physics.friction', label: 'Friction 3D', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
          { key: 'physics.restitution', label: 'Restitution 3D', type: 'number', min: 0, max: 1, step: 0.05, default: 0 },
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

  song: {
    title: 'Musique chiptune',
    groups: [
      {
        id: 'general',
        label: 'Général',
        fields: [
          { key: 'name', label: 'Nom', type: 'string', required: true },
          { key: 'folder', label: 'Dossier', type: 'string' },
          { key: 'bpm', label: 'Tempo (BPM)', type: 'number', min: 20, max: 400, step: 1, default: 130 },
          { key: 'loop.enabled', label: 'Boucler la lecture', type: 'boolean', default: true },
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
          {
            key: 'physics3d',
            label: 'Moteur physique 3D',
            type: 'enum',
            options: [
              { label: 'Simple (AABB rétro rapide)', value: 'simple' },
              { label: 'Rapier 3D (RigidBody complet)', value: 'rapier' },
            ],
            default: 'simple',
          },
        ],
      },
    ],
  },

  environment: {
    title: 'Environnement 3D',
    groups: [
      {
        id: 'sky',
        label: 'Ciel et Ambiance',
        fields: [
          { key: 'environment.skyColor', label: 'Couleur du ciel', type: 'color', default: '#1a1c2c' },
          { key: 'environment.fog.enabled', label: 'Brouillard', type: 'boolean', default: false },
          { key: 'environment.fog.color', label: 'Couleur brouillard', type: 'color', default: '#1a1c2c' },
          { key: 'environment.fog.density', label: 'Densité brouillard', type: 'number', min: 0, max: 0.2, step: 0.005, default: 0.04 },
        ],
      },
      {
        id: 'lighting',
        label: 'Éclairage',
        fields: [
          { key: 'environment.ambientLight.color', label: 'Lumière ambiante', type: 'color', default: '#ffffff' },
          { key: 'environment.ambientLight.intensity', label: 'Intensité ambiante', type: 'number', min: 0, max: 2, step: 0.1, default: 0.7 },
          { key: 'environment.directionalLight.color', label: 'Lumière directionnelle', type: 'color', default: '#ffeedd' },
          { key: 'environment.directionalLight.intensity', label: 'Intensité directionnelle', type: 'number', min: 0, max: 2, step: 0.1, default: 0.9 },
        ],
      },
    ],
  },

  node3d: {
    title: 'Noeud 3D',
    groups: [
      {
        id: 'general',
        label: 'General',
        fields: [
          { key: 'name', label: 'Nom', type: 'string', required: true },
          {
            key: 'kind',
            label: 'Type de noeud',
            type: 'enum',
            options: [
              { label: 'Maillage / Objet', value: 'mesh' },
              { label: 'Lumiere', value: 'light' },
              { label: 'Camera', value: 'camera' },
              { label: 'Collision', value: 'collision' },
              { label: 'Audio 3D', value: 'audio' },
              { label: 'Prefab', value: 'prefab' },
              { label: 'Noeud vide', value: 'empty' },
            ],
          },
          { key: 'objectId', label: 'Modele / Objet lie', type: 'object-ref' },
          { key: 'materialId', label: 'Materiau', type: 'material-ref' },
          { key: 'prefabId', label: 'Prefab source', type: 'string' },
          { key: 'visible', label: 'Visible', type: 'boolean', default: true },
          { key: 'locked', label: 'Verrouille', type: 'boolean', default: false },
        ],
      },
      {
        id: 'position',
        label: 'Position (X, Y, Z)',
        fields: [
          { key: 'position.0', label: 'Position X', type: 'number', step: 0.5, default: 0 },
          { key: 'position.1', label: 'Position Y', type: 'number', step: 0.5, default: 0 },
          { key: 'position.2', label: 'Position Z', type: 'number', step: 0.5, default: 0 },
        ],
      },
      {
        id: 'rotation',
        label: 'Rotation (degres)',
        fields: [
          { key: 'rotation.0', label: 'Rotation X', type: 'number', step: 15, default: 0 },
          { key: 'rotation.1', label: 'Rotation Y', type: 'number', step: 15, default: 0 },
          { key: 'rotation.2', label: 'Rotation Z', type: 'number', step: 15, default: 0 },
        ],
      },
      {
        id: 'scale',
        label: 'Echelle (X, Y, Z)',
        fields: [
          { key: 'scale.0', label: 'Echelle X', type: 'number', step: 0.1, default: 1 },
          { key: 'scale.1', label: 'Echelle Y', type: 'number', step: 0.1, default: 1 },
          { key: 'scale.2', label: 'Echelle Z', type: 'number', step: 0.1, default: 1 },
        ],
      },
      {
        id: 'lightProps',
        label: 'Parametres de Lumiere',
        fields: [
          {
            key: 'props.lightType',
            label: 'Type de lumiere',
            type: 'enum',
            options: [
              { label: 'Ponctuelle (PointLight)', value: 'point' },
              { label: 'Projecteur (SpotLight)', value: 'spot' }
            ],
            default: 'point'
          },
          { key: 'props.color', label: 'Couleur', type: 'color', default: '#ffcd75' },
          { key: 'props.intensity', label: 'Intensite', type: 'number', min: 0, max: 10, step: 0.1, default: 1.5 },
          { key: 'props.distance', label: 'Portee (distance)', type: 'number', min: 0, max: 100, step: 1, default: 12 },
          { key: 'props.decay', label: 'Attenuation (decay)', type: 'number', min: 0, max: 4, step: 0.5, default: 2 },
          { key: 'props.angle', label: 'Angle spot (degres)', type: 'number', min: 5, max: 90, step: 5, default: 45 },
          { key: 'props.penumbra', label: 'Penombre (0-1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.2 },
          { key: 'props.castShadow', label: 'Ombres portees', type: 'boolean', default: false }
        ]
      },
      {
        id: 'instanceProps',
        label: 'Variables d’instance (Props)',
        type: 'instance-props',
      },
    ],
  },

  scene3d: {
    title: 'Scene 3D',
    groups: [
      {
        id: 'general',
        label: 'General',
        fields: [
          { key: 'name', label: 'Nom', type: 'string', required: true },
        ],
      },
      {
        id: 'environment',
        label: 'Environnement & Ciel',
        fields: [
          { key: 'environment.skyColor', label: 'Couleur ciel unie', type: 'color', default: '#1a1c2c' },
          { key: 'environment.skyGradient.enabled', label: 'Degrade de ciel', type: 'boolean', default: false },
          { key: 'environment.skyGradient.topColor', label: 'Ciel haut (zenith)', type: 'color', default: '#0d0f18' },
          { key: 'environment.skyGradient.bottomColor', label: 'Ciel bas (horizon)', type: 'color', default: '#29366f' },
          { key: 'environment.horizonColor', label: 'Couleur horizon classique', type: 'color', default: '#29366f' }
        ],
      },
      {
        id: 'lighting',
        label: 'Eclairage & Ombres',
        fields: [
          { key: 'environment.ambientLight.color', label: 'Ambiante couleur', type: 'color', default: '#ffffff' },
          { key: 'environment.ambientLight.intensity', label: 'Ambiante intensite', type: 'number', min: 0, max: 2, step: 0.05, default: 0.6 },
          { key: 'environment.directionalLight.color', label: 'Soleil couleur', type: 'color', default: '#ffeedd' },
          { key: 'environment.directionalLight.intensity', label: 'Soleil intensite', type: 'number', min: 0, max: 3, step: 0.1, default: 1.0 },
          { key: 'environment.directionalLight.castShadow', label: 'Ombres solaires', type: 'boolean', default: false },
          { key: 'environment.shadows.enabled', label: 'Activer ombres globales', type: 'boolean', default: false }
        ],
      },
      {
        id: 'fog',
        label: 'Brouillard',
        fields: [
          { key: 'environment.fog.enabled', label: 'Brouillard active', type: 'boolean', default: false },
          {
            key: 'environment.fog.type',
            label: 'Type de brouillard',
            type: 'enum',
            options: [
              { label: 'Exponentiel (Exp2)', value: 'exp2' },
              { label: 'Lineaire', value: 'linear' }
            ],
            default: 'exp2'
          },
          { key: 'environment.fog.color', label: 'Couleur brouillard', type: 'color', default: '#1a1c2c' },
          { key: 'environment.fog.density', label: 'Densite (Exp2)', type: 'number', min: 0.001, max: 0.2, step: 0.005, default: 0.04 },
          { key: 'environment.fog.near', label: 'Debut (Lineaire)', type: 'number', min: 0, max: 100, step: 2, default: 10 },
          { key: 'environment.fog.far', label: 'Fin (Lineaire)', type: 'number', min: 5, max: 200, step: 5, default: 50 }
        ],
      },
      {
        id: 'terrain',
        label: 'Terrain sculptable',
        fields: [
          { key: 'terrain.enabled', label: 'Terrain active', type: 'boolean', default: false },
          { key: 'terrain.width', label: 'Largeur (X)', type: 'number', min: 4, max: 128, default: 32 },
          { key: 'terrain.depth', label: 'Profondeur (Z)', type: 'number', min: 4, max: 128, default: 32 },
          { key: 'terrain.defaultHeight', label: 'Hauteur initiale', type: 'number', default: 0 },
        ],
      },
    ],
  },
};
