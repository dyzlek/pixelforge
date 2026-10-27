/**
 * PixelForge Studio — Agent IA autonome avec outils de creation
 * Permet a l'IA de modifier le projet directement en memoire (sprites, objets,
 * scripts, cartes, sons, modeles 3D, musiques).
 * Toute action est appliquee de maniere atomique a store.update (un seul Ctrl+Z annule tout).
 */

import {
  setSettings,
  upsertSprite,
  getSprite,
  upsertObject,
  setScript,
  getScript,
  upsertMap,
  paintMap,
  setLayer,
  upsertModel,
  importModel,
  getModel,
  setMaterial,
  upsertScene3D,
  upsertNode3D,
  setTransform,
  addLight,
  paintGridMap,
  placeEntities,
  addSound,
  upsertSong,
  getSongText,
  summarize,
  renderMap,
  renderScene3D,
  validateProject,
  formatIssues,
  listNodes,
  SOUND_PRESETS,
} from '../core/ops/index.js';

import { sendAgentChatRequest, DEFAULT_AI_CONFIG } from './client.js';
import { GAMEDESIGN_PRINCIPLES } from './gamedesign.js';
import { PIXELFORGE_SCRIPT_API, BLUEPRINT_SCHEMA_GUIDE } from './knowledge.js';
import {
  generateAsset,
  generateSpriteData,
  generateSongData,
  generateModelData,
  generateSoundData,
} from './generators.js';
import {
  generateFullGame,
  generateGameDesignDocument,
} from './game-generator.js';

export {
  generateAsset,
  generateSpriteData,
  generateSongData,
  generateModelData,
  generateSoundData,
  generateFullGame,
  generateGameDesignDocument,
};

/**
 * Definition des outils au format OpenAI Function Calling
 */
export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'upsert_sprite',
      description: 'Cree ou remplace un sprite pixel art a partir de lignes de texte ASCII. Chaque caractere correspond a un pixel ("." = transparent, 0-9a-f = couleur palette Sweetie 16, ou legende personnalisee). animations: [{ name, frames: [0, 1...], fps, loop }].',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom unique du sprite' },
          frames: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            description: 'Tableau de frames (chacune etant un tableau de chaines de caracteres)',
          },
          legend: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Dictionnaire optionnel associant des caracteres a des couleurs hex (#rrggbb)',
          },
          animations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                frames: { type: 'array', items: { type: 'number' } },
                fps: { type: 'number' },
                loop: { type: 'boolean' },
              },
              required: ['name', 'frames'],
            },
            description: 'Animations nommees',
          },
          width: { type: 'number', description: 'Largeur explicite en pixels' },
          height: { type: 'number', description: 'Hauteur explicite en pixels' },
        },
        required: ['name', 'frames'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sprite',
      description: 'Affiche la representation ASCII et les animations d\'un sprite existant.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du sprite a inspecter' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_object',
      description: 'Cree ou configure un objet de jeu (modele visuel, physique, script JavaScript ou graphe Blueprint).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom de l\'objet' },
          sprite: { type: 'string', description: 'Nom du sprite 2D associe' },
          model: { type: 'string', description: 'Nom du modele 3D associe' },
          defaultAnim: { type: 'string', description: 'Animation par defaut' },
          physics: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              gravity: { type: 'boolean' },
              immovable: { type: 'boolean' },
              bounce: { type: 'number' },
              collideMap: { type: 'boolean' },
              collideWorld: { type: 'boolean' },
            },
            description: 'Proprietes physiques Arcade',
          },
          hitbox: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
            description: 'Hitbox relative au sprite',
          },
          code: { type: 'string', description: 'Script JavaScript complet (on(...) au niveau superieur)' },
          graph: {
            type: 'object',
            properties: {
              nodes: { type: 'array', items: { type: 'object' } },
              links: { type: 'array', items: { type: 'object' } },
            },
            description: 'Graphe Blueprint valide',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_script',
      description: 'Met a jour le script d\'un objet ou le script global ("global"). Fournir soit code (JavaScript), soit graph (Blueprint).',
      parameters: {
        type: 'object',
        properties: {
          object: { type: 'string', description: 'Nom de l\'objet cible ou "global"' },
          code: { type: 'string', description: 'Script JavaScript' },
          graph: {
            type: 'object',
            properties: {
              nodes: { type: 'array', items: { type: 'object' } },
              links: { type: 'array', items: { type: 'object' } },
            },
            description: 'Graphe Blueprint',
          },
        },
        required: ['object'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_script',
      description: 'Recupere le script ou le graphe d\'un objet ou du script global.',
      parameters: {
        type: 'object',
        properties: {
          object: { type: 'string', description: 'Nom de l\'objet ou "global"' },
        },
        required: ['object'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_map',
      description: 'Cree ou redimensionne une carte 2D (dimensions en tuiles, tileset, calques).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom de la carte' },
          width: { type: 'number', description: 'Largeur en tuiles' },
          height: { type: 'number', description: 'Hauteur en tuiles' },
          tileset: { type: 'string', description: 'Nom du sprite servant de tileset' },
          background: { type: 'string', description: 'Couleur hex de fond (#rrggbb)' },
          layers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                collides: { type: 'boolean' },
                oneWay: { type: 'boolean' },
                depth: { type: 'string', enum: ['below', 'above'] },
                visible: { type: 'boolean' },
                scrollFactor: { type: 'number' },
              },
              required: ['name'],
            },
            description: 'Configuration des calques',
          },
          start: { type: 'boolean', description: 'Definir comme carte de demarrage' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'paint_map',
      description: 'Dessine des tuiles sur un calque de carte 2D. rows = tableau de chaines (base 36 : 0-9a-z, "." = vide, " " = inchange).',
      parameters: {
        type: 'object',
        properties: {
          map: { type: 'string', description: 'Nom de la carte' },
          layer: { type: 'string', description: 'Nom du calque' },
          rows: { type: 'array', items: { type: 'string' }, description: 'Lignes de tuiles' },
          legend: { type: 'object', description: 'Association caractere -> index tuile (entier >= 0 ou -1 pour vide)' },
          x: { type: 'number', description: 'Decalage horizontal en tuiles' },
          y: { type: 'number', description: 'Decalage vertical en tuiles' },
        },
        required: ['map', 'layer', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_layer',
      description: 'Modifie les parametres d\'un calque d\'une carte 2D (collision, profondeur, visibilite).',
      parameters: {
        type: 'object',
        properties: {
          map: { type: 'string', description: 'Nom de la carte' },
          layer: { type: 'string', description: 'Nom du calque' },
          collides: { type: 'boolean' },
          oneWay: { type: 'boolean' },
          depth: { type: 'string', enum: ['below', 'above'] },
          visible: { type: 'boolean' },
          scrollFactor: { type: 'number' },
        },
        required: ['map', 'layer'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_entities',
      description: 'Place des instances d\'objets sur une carte 2D (coordonnees pixels x, y) ou dans une scene 3D.',
      parameters: {
        type: 'object',
        properties: {
          map: { type: 'string', description: 'Nom de la carte 2D' },
          scene: { type: 'string', description: 'Nom de la scene 3D (si jeu 3D)' },
          mode: { type: 'string', enum: ['append', 'replace'], description: 'append pour ajouter, replace pour ecraser' },
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                object: { type: 'string', description: 'Nom de l\'objet template' },
                x: { type: 'number', description: 'Coordonnee X en pixels' },
                y: { type: 'number', description: 'Coordonnee Y en pixels' },
                z: { type: 'number', description: 'Coordonnee Z en unites 3D' },
                props: { type: 'object' },
              },
              required: ['object', 'x', 'y'],
            },
          },
          rows: { type: 'array', items: { type: 'string' }, description: 'Grille 2D avec caracteres de legende' },
          legend: { type: 'object', description: 'Association caractere -> NomObjet' },
          level: { type: 'number', description: 'Niveau Y pour la 3D' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_sound',
      description: 'Cree ou ajuste un effet sonore sfxr (preset: jump, coin, hit, powerup, explosion, laser, blip, portal).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du son' },
          preset: {
            type: 'string',
            enum: ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal', 'tetris', 'korobeiniki', 'adventure', 'action'],
            description: 'Type de son sfxr',
          },
          volume: { type: 'number', description: 'Volume entre 0 et 1' },
          pitch: { type: 'number', description: 'Hauteur relative' },
        },
        required: ['name', 'preset'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_song',
      description: 'Cree ou modifie une musique chiptune au format texte tracker ASCII.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du morceau' },
          text: { type: 'string', description: 'Partition tracker ASCII' },
          bpm: { type: 'number', description: 'Tempo en BPM' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_song',
      description: 'Recupere la partition tracker ASCII d\'un morceau.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du morceau' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_model',
      description: 'Cree ou modifie un modele 3D voxel par tranches de hauteur Y.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du modele' },
          width: { type: 'number' },
          height: { type: 'number' },
          depth: { type: 'number' },
          slices: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } },
            description: 'Tranches Y contenant des rangees Z et caracteres X (0-9a-f = couleur Sweetie 16, "." = vide)',
          },
          legend: { type: 'object' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_model',
      description: 'Recupere les tranches voxel d\'un modele 3D au format texte ASCII.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du modele' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_scene3d',
      description: 'Cree ou modifie une scene 3D (environnement, ciel, brouillard).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom de la scene' },
          environment: { type: 'object' },
          start: { type: 'boolean' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'paint_gridmap',
      description: 'Peint des blocs voxels dans une scene 3D au niveau Y specifie.',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string', description: 'Nom de la scene 3D' },
          level: { type: 'number', description: 'Niveau Y' },
          rows: { type: 'array', items: { type: 'string' } },
          legend: { type: 'object' },
          x: { type: 'number' },
          z: { type: 'number' },
        },
        required: ['scene', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'upsert_node3d',
      description: 'Cree ou modifie un noeud 3D (mesh, light, camera, group, prefab).',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string', description: 'Nom de la scene 3D' },
          name: { type: 'string', description: 'Nom du noeud' },
          kind: { type: 'string', enum: ['mesh', 'light', 'camera', 'group', 'prefab'] },
          parent: { type: 'string' },
          position: { type: 'array', items: { type: 'number' } },
          rotation: { type: 'array', items: { type: 'number' } },
          scale: { type: 'array', items: { type: 'number' } },
          object: { type: 'string' },
          material: { type: 'string' },
          prefab: { type: 'string' },
          props: { type: 'object' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_transform',
      description: 'Modifie la position, rotation ou echelle d\'un noeud ou entite 3D.',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string' },
          node: { type: 'string', description: 'Nom ou id du noeud' },
          position: { type: 'array', items: { type: 'number' } },
          rotation: { type: 'array', items: { type: 'number' } },
          scale: { type: 'array', items: { type: 'number' } },
        },
        required: ['node'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_model',
      description: 'Importe un modele 3D (preset CC0 ou glTF donnees base64 ou voxel).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom du modele' },
          preset: { type: 'string', description: 'Nom de preset CC0' },
          gltf: { type: 'string', description: 'Data URL glTF' },
          slices: { type: 'array' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_material',
      description: 'Cree ou modifie un materiau 3D (couleur, rugosite, metallicite, emission).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string' },
          roughness: { type: 'number' },
          metalness: { type: 'number' },
          emissive: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_light',
      description: 'Ajoute ou modifie une source lumineuse 3D (point ou spot) dans une scene.',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['point', 'spot'] },
          color: { type: 'string' },
          intensity: { type: 'number' },
          position: { type: 'array', items: { type: 'number' } },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_settings',
      description: 'Modifie les parametres generaux du projet (dimensions ecran, gravite, taille de tuile, palette, carte de depart).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          author: { type: 'string' },
          dimension: { type: 'string', enum: ['2d', '3d'] },
          width: { type: 'number' },
          height: { type: 'number' },
          tileSize: { type: 'number' },
          gravity: { type: 'number' },
          background: { type: 'string' },
          touchControls: { type: 'boolean' },
          startMap: { type: 'string' },
          startScene3D: { type: 'string' },
          palette: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'validate_game',
      description: 'Valide le projet entier et renvoie la liste des erreurs et avertissements (0 erreur attendu).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_map',
      description: 'Renvoie une vue ASCII de la carte avec les tuiles et entites positionnees.',
      parameters: {
        type: 'object',
        properties: {
          map: { type: 'string', description: 'Nom de la carte' },
        },
        required: ['map'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_scene3d',
      description: 'Renvoie une vue ASCII de la scene 3D par tranches de hauteur.',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string', description: 'Nom de la scene 3D' },
        },
        required: ['scene'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_nodes',
      description: 'Liste les noeuds Blueprint disponibles dans le catalogue avec leurs broches et categories.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_asset',
      description: 'Genere et cree instantanement une ressource complete pret a l\'emploi dans le projet depuis une simple description en langage naturel (sprite anime, musique chiptune, modele 3D voxel ou CC0, effet sonore sfxr).',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['sprite', 'song', 'model', 'sound'],
            description: 'Type de ressource a generer',
          },
          name: {
            type: 'string',
            description: 'Nom unique de la ressource a creer dans le projet',
          },
          description: {
            type: 'string',
            description: 'Description en langage naturel du style, de l\'apparence, du tempo ou du son recherche',
          },
          options: {
            type: 'object',
            description: 'Options optionnelles (dimensions, bpm, preset, animations)',
          },
        },
        required: ['type', 'name', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_game',
      description: 'Genere un jeu complet jouable et terminable de 3 niveaux progressifs avec une arene et un boss (en 2D ou en 3D) a partir d\'une description en langage naturel.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Description de l\'univers et du gameplay souhaite (ex: fais-moi un jeu de plateforme avec 3 niveaux et un boss)',
          },
          dimension: {
            type: 'string',
            enum: ['2d', '3d'],
            description: 'Dimension du jeu (2d ou 3d)',
          },
          name: {
            type: 'string',
            description: 'Titre ou nom du jeu a creer',
          },
        },
        required: ['description'],
      },
    },
  },
];

/**
 * Normalise un element de plan JSON
 */
function normalizePlanItem(item) {
  if (!item || typeof item !== 'object') return null;
  const toolName = item.tool || item.name || item.function;
  if (!toolName || typeof toolName !== 'string') return null;
  let args = item.args || item.arguments || item.parameters || {};
  if (typeof args === 'string') {
    try { args = JSON.parse(args); } catch { args = {}; }
  }
  return {
    tool: toolName,
    args: typeof args === 'object' && args !== null ? args : {},
  };
}

/**
 * Tente de parser un extrait JSON contenant un tableau ou un objet de plan
 */
function tryExtractPlanArray(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      const list = parsed.map(normalizePlanItem).filter(Boolean);
      return list.length ? list : null;
    }
    if (parsed && typeof parsed === 'object') {
      const arr = parsed.plan || parsed.tools || parsed.actions || parsed.steps;
      if (Array.isArray(arr)) {
        const list = arr.map(normalizePlanItem).filter(Boolean);
        return list.length ? list : null;
      }
      const single = normalizePlanItem(parsed);
      if (single) return [single];
    }
  } catch {
    // JSON invalide
  }
  return null;
}

/**
 * Extrait un plan d'actions JSON d'une reponse textuelle
 * Supporte les blocs ```json ... ``` et les structures brutes
 */
export function parseJsonPlan(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Blocs markdown ```json ... ``` ou ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    const plan = tryExtractPlanArray(candidate);
    if (plan && plan.length > 0) return plan;
  }

  // 2. Texte direct complet au format JSON
  const directPlan = tryExtractPlanArray(text.trim());
  if (directPlan && directPlan.length > 0) return directPlan;

  // 3. Motif regex pour trouver { "plan": [ ... ] } ou similaire dans le texte
  const planObjRegex = /\{\s*"(?:plan|tools|actions|steps)"\s*:\s*(\[[\s\S]*?\])\s*\}/i;
  const planMatch = planObjRegex.exec(text);
  if (planMatch) {
    const plan = tryExtractPlanArray(planMatch[1]);
    if (plan && plan.length > 0) return plan;
  }

  return null;
}

/**
 * Execute un outil sur le projet avec gestion des confirmations de suppression / ecrasement (Decision V6)
 */
export async function executeTool(project, name, rawArgs = {}, options = {}) {
  const { confirm = null } = options;
  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs || {});

  // Verification de confirmation pour ecrasement ou remplacement destructif
  if (typeof confirm === 'function') {
    let overwrite = false;
    let resourceType = '';
    let resourceName = '';

    if (name === 'upsert_sprite' && args.name) {
      if ((project.sprites || []).some((s) => s.name === args.name)) {
        overwrite = true;
        resourceType = 'sprite';
        resourceName = args.name;
      }
    } else if (name === 'upsert_object' && args.name) {
      if ((project.objects || []).some((o) => o.name === args.name)) {
        overwrite = true;
        resourceType = 'objet';
        resourceName = args.name;
      }
    } else if (name === 'upsert_map' && args.name) {
      const existing = (project.maps || []).find((m) => m.name === args.name);
      const isInitialPristine = project.maps?.length === 1 && !project.maps[0].entities?.length && !project.maps[0].tilesetSpriteId;
      if (existing && !isInitialPristine) {
        overwrite = true;
        resourceType = 'carte';
        resourceName = args.name;
      }
    } else if (name === 'upsert_model' && args.name) {
      if ((project.models || []).some((m) => m.name === args.name)) {
        overwrite = true;
        resourceType = 'modele 3D';
        resourceName = args.name;
      }
    } else if (name === 'upsert_scene3d' && args.name) {
      if ((project.scenes3d || []).some((sc) => sc.name === args.name)) {
        overwrite = true;
        resourceType = 'scene 3D';
        resourceName = args.name;
      }
    } else if (name === 'upsert_song' && args.name) {
      if ((project.songs || []).some((s) => s.name === args.name)) {
        overwrite = true;
        resourceType = 'musique';
        resourceName = args.name;
      }
    } else if (name === 'generate_asset' && args.name) {
      if (args.type === 'sprite' && (project.sprites || []).some((s) => s.name === args.name)) {
        overwrite = true;
        resourceType = 'sprite';
        resourceName = args.name;
      } else if (args.type === 'song' && (project.songs || []).some((s) => s.name === args.name)) {
        overwrite = true;
        resourceType = 'musique';
        resourceName = args.name;
      } else if (args.type === 'model' && (project.models || []).some((m) => m.name === args.name)) {
        overwrite = true;
        resourceType = 'modele 3D';
        resourceName = args.name;
      } else if (args.type === 'sound' && (project.sounds || []).some((s) => s.name === args.name)) {
        overwrite = true;
        resourceType = 'effet sonore';
        resourceName = args.name;
      }
    } else if (name === 'set_script' && args.object) {
      const isGlobal = args.object === 'global';
      const existing = isGlobal ? project.globalScript : (project.objects || []).find((o) => o.name === args.object)?.script;
      if (existing && (existing.code?.trim() || existing.graph?.nodes?.length)) {
        overwrite = true;
        resourceType = 'script';
        resourceName = args.object;
      }
    } else if (name === 'place_entities' && args.mode === 'replace') {
      const targetMap = (project.maps || []).find((m) => m.name === args.map || m.id === args.map);
      if (targetMap && targetMap.entities?.length > 0) {
        overwrite = true;
        resourceType = 'entites';
        resourceName = targetMap.name;
      }
    }

    if (overwrite) {
      const ok = await confirm({
        action: 'overwrite',
        type: resourceType,
        name: resourceName,
        tool: name,
        args,
      });
      if (!ok) {
        throw new Error(`Action annulee par l'utilisateur : confirmation refusee pour l'ecrasement de ${resourceType} "${resourceName}"`);
      }
    }
  }

  // Execution de l'operation
  switch (name) {
    case 'generate_game': {
      const res = generateFullGame(args.description, {
        dimension: args.dimension,
        name: args.name,
        baseProject: project,
      });
      return `${res.summary}\n\n${res.gdd.markdown}`;
    }
    case 'generate_asset': {
      const { type, data } = generateAsset(args.type, args.description, {
        name: args.name,
        ...(args.options || {}),
      });
      switch (type) {
        case 'sprite':
          return upsertSprite(project, data);
        case 'song':
          return upsertSong(project, data);
        case 'model':
          return data.preset ? importModel(project, data) : upsertModel(project, data);
        case 'sound':
          return addSound(project, data);
        default:
          throw new Error(`Type de ressource inconnu : "${args.type}"`);
      }
    }
    case 'upsert_sprite': {
      if ((!args.frames || !args.frames.length) && args.description) {
        const generated = generateSpriteData(args.description, args);
        Object.assign(args, generated);
      }
      return upsertSprite(project, args);
    }
    case 'get_sprite':
      return getSprite(project, args.name).text;
    case 'upsert_object':
      return upsertObject(project, args);
    case 'set_script':
      return setScript(project, args.object, args);
    case 'get_script':
      return getScript(project, args.object);
    case 'upsert_map':
      return upsertMap(project, args);
    case 'paint_map':
      return paintMap(project, args);
    case 'set_layer':
      return setLayer(project, args);
    case 'place_entities':
      return placeEntities(project, args);
    case 'add_sound': {
      if ((!args.preset || !SOUND_PRESETS.includes(args.preset)) && (args.description || args.preset)) {
        const generated = generateSoundData(args.description || args.preset, args);
        Object.assign(args, generated);
      }
      return addSound(project, args);
    }
    case 'upsert_song': {
      if (!args.text && args.description) {
        const generated = generateSongData(args.description, args);
        Object.assign(args, generated);
      }
      return upsertSong(project, args);
    }
    case 'get_song':
      return getSongText(project, args.name);
    case 'upsert_model': {
      if ((!args.slices || !args.slices.length) && !args.gltf && !args.preset && args.description) {
        const generated = generateModelData(args.description, args);
        if (generated.preset) {
          return importModel(project, generated);
        }
        Object.assign(args, generated);
      }
      return upsertModel(project, args);
    }
    case 'get_model':
      return getModel(project, args.name);
    case 'upsert_scene3d':
      return upsertScene3D(project, args);
    case 'paint_gridmap':
      return paintGridMap(project, args);
    case 'upsert_node3d':
      return upsertNode3D(project, args);
    case 'set_transform':
      return setTransform(project, args);
    case 'import_model':
      return importModel(project, args);
    case 'set_material':
      return setMaterial(project, args);
    case 'add_light':
      return addLight(project, args);
    case 'set_settings':
      return setSettings(project, args);
    case 'validate_game': {
      const issues = validateProject(project);
      return issues.length ? formatIssues(issues) : 'OK: no issues.';
    }
    case 'render_map':
      return renderMap(project, args.map);
    case 'render_scene3d':
      return renderScene3D(project, args.scene);
    case 'list_nodes':
      return listNodes(args?.category, args?.search);
    default:
      throw new Error(`Outil inconnu : "${name}"`);
  }
}

/**
 * Execute un plan complet d'actions sequentiellement
 */
export async function executePlan(project, plan, options = {}) {
  const { confirm = null, onStep = () => {} } = options;
  if (!Array.isArray(plan)) throw new Error('Le plan doit etre un tableau d\'actions');
  const results = [];
  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    onStep({ type: 'plan_step', index: i, total: plan.length, tool: step.tool, args: step.args, status: 'running' });
    try {
      const output = await executeTool(project, step.tool, step.args, { confirm });
      const record = { tool: step.tool, args: step.args, result: output, status: 'success' };
      results.push(record);
      onStep({ type: 'plan_step', index: i, total: plan.length, ...record });
    } catch (err) {
      const record = { tool: step.tool, args: step.args, error: err.message, status: 'error' };
      results.push(record);
      onStep({ type: 'plan_step', index: i, total: plan.length, ...record });
      throw err;
    }
  }
  return results;
}

/**
 * Construit le system prompt detaille pour l'agent
 */
export function buildAgentSystemPrompt(project) {
  let prompt = `Tu es l'agent IA autonome integre a PixelForge Studio, le moteur de jeu 2D et 3D retro en pixel art et Blueprints.
Ton role est de realiser directement les demandes de creation et de modification du jeu ouvert en appelant les outils mis a ta disposition.

Outils disponibles :
- upsert_sprite : creer ou modifier un sprite pixel art depuis du texte
- get_sprite : inspecter un sprite existant
- upsert_object : creer ou modifier un objet (visuel, physique, script JavaScript ou graphe Blueprint)
- set_script : definir le script d'un objet ou le script global
- get_script : inspecter le script d'un objet ou le script global
- upsert_map : creer ou redimensionner une carte 2D
- paint_map : peindre des tuiles sur une carte 2D
- set_layer : configurer un calque de carte
- place_entities : placer des instances d'objets sur une carte ou dans une scene 3D
- add_sound : ajouter ou modifier un effet sonore sfxr
- upsert_song : creer ou editer une musique tracker
- get_song : recuperer la partition tracker
- upsert_model : creer ou modifier un modele 3D voxel
- get_model : inspecter un modele 3D voxel
- upsert_scene3d : creer ou modifier une scene 3D
- upsert_node3d : creer ou modifier un noeud 3D
- set_transform : modifier la position, rotation ou echelle d'un noeud ou entite 3D
- import_model : importer un modele 3D (preset CC0 ou glTF)
- set_material : configurer un materiau 3D
- add_light : ajouter ou modifier une lumiere 3D
- paint_gridmap : peindre des blocs voxels dans une scene 3D
- set_settings : modifier les reglages generaux du projet
- validate_game : verifier la validite du jeu
- render_map : afficher la vue ASCII d'une carte 2D
- render_scene3d : afficher la vue ASCII d'une scene 3D
- list_nodes : lister les noeuds Blueprint
- generate_asset : generer une ressource complete pret a l'emploi depuis une simple description (sprite anime, musique tracker chiptune, modele 3D voxel ou CC0, son sfxr)
- generate_game : generer un jeu complet jouable et terminable de 3 niveaux avec boss (en 2D ou 3D) depuis une simple description

Regles imperatrices :
1. N'utilise JAMAIS aucun emoji dans tes reponses ou tes outils.
2. Appelle les outils adaptes pour accomplir la requete de l'utilisateur. Tu peux enchainer plusieurs outils en une seule sequence (ex: creer un sprite, creer l'objet associe avec son script, puis placer plusieurs instances sur la carte).
3. Tu peux generer n'importe quelle ressource complete en une seule demande avec "generate_asset" ou meme un jeu complet avec "generate_game" (ex: "fais-moi un jeu de plateforme avec 3 niveaux et un boss").
4. Si ton environnement ne prend pas en charge les appels d'outils natifs (function calling), reponds UNIQUEMENT avec un plan JSON valide au format :
\`\`\`json
{
  "plan": [
    { "tool": "nom_outil", "args": { ... } }
  ]
}
\`\`\`
4. Conventions essentielles du moteur PixelForge :
- Coordonnees x et y en pixels depuis le coin superieur gauche (x=0, y=0).
- Pour les objets de collecte, bonus, pieces, declencheurs : utilise 'overlap' et configure la physique sans gravite et immovable ({ enabled: true, gravity: false, immovable: true, collideMap: false }).
- Pour les obstacles solides bloquants (murs, sols, plateformes) : utilise 'collide'.
- Les scripts d'objets sont executes avec (self, game, input, on). Tous les gestionnaires on('update', ...), on('overlap', ...) DOIVENT etre enregistres au plus haut niveau du script.
- Pour incrementer le score : game.score += valeur.
- Pour detruire l'instance courante : self.destroy().
- Sons presets sfxr disponibles : 'jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'.
- Pour jouer un son : game.playSound('coin').
`;

  if (project) {
    prompt += '\n# ETAT DU PROJET ACTUEL :\n' + summarize(project) + '\n';
  }

  prompt += '\n' + PIXELFORGE_SCRIPT_API;
  prompt += '\n' + BLUEPRINT_SCHEMA_GUIDE;
  prompt += '\n' + GAMEDESIGN_PRINCIPLES;

  return prompt;
}

/**
 * Boucle d'agent autonome
 * Effectue toutes les modifications sur une copie de travail et les applique atomiquement a store.update.
 */
export async function runAgent({
  project = null,
  prompt = '',
  config = {},
  store = null,
  onStep = () => {},
  onChunk = () => {},
  signal = null,
  confirm = null,
  maxSteps = 10,
} = {}) {
  const baseProject = project || (store ? store.project : null);
  if (!baseProject) throw new Error('Aucun projet fourni a runAgent');

  // Copie de travail en memoire pour grouper les modifications de maniere atomique
  const workingCopy = JSON.parse(JSON.stringify(baseProject));
  const steps = [];

  const systemPrompt = buildAgentSystemPrompt(workingCopy);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  let currentStep = 0;
  let finalContent = '';

  while (currentStep < maxSteps) {
    if (signal?.aborted) {
      throw new Error('Operation annulee par le signal');
    }
    currentStep++;

    const res = await sendAgentChatRequest({
      ...config,
      messages,
      tools: AGENT_TOOLS,
      signal,
      onChunk: (chunk, full) => {
        onChunk(chunk, full);
      },
    });

    finalContent = res.content || '';

    // 1. Outils natifs (OpenAI / Claude tool calling)
    if (res.tool_calls && res.tool_calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: res.content || '',
        tool_calls: res.tool_calls,
      });

      for (const tc of res.tool_calls) {
        const fnName = tc.function?.name;
        let fnArgs = {};
        try {
          fnArgs = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function?.arguments || {});
        } catch {
          fnArgs = {};
        }

        const stepRecord = {
          type: 'tool_call',
          name: fnName,
          args: fnArgs,
          id: tc.id,
        };
        steps.push(stepRecord);
        onStep({ ...stepRecord, status: 'running' });

        let resultText = '';
        try {
          resultText = await executeTool(workingCopy, fnName, fnArgs, { confirm });
          stepRecord.result = resultText;
          stepRecord.status = 'success';
          onStep({ ...stepRecord });
        } catch (err) {
          resultText = `Erreur : ${err.message}`;
          stepRecord.error = err.message;
          stepRecord.status = 'error';
          onStep({ ...stepRecord });
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: resultText,
        });
      }
      // Reboucle pour que l'IA puisse constater le resultat ou enchainer d'autres outils
      continue;
    }

    // 2. Mode de repli Plan JSON (pour petits modeles)
    const jsonPlan = parseJsonPlan(res.content);
    if (jsonPlan && jsonPlan.length > 0) {
      for (const planStep of jsonPlan) {
        const stepRecord = {
          type: 'plan_step',
          name: planStep.tool,
          args: planStep.args,
        };
        steps.push(stepRecord);
        onStep({ ...stepRecord, status: 'running' });

        try {
          const resultText = await executeTool(workingCopy, planStep.tool, planStep.args, { confirm });
          stepRecord.result = resultText;
          stepRecord.status = 'success';
          onStep({ ...stepRecord });
        } catch (err) {
          stepRecord.error = err.message;
          stepRecord.status = 'error';
          onStep({ ...stepRecord });
          throw err;
        }
      }
      break;
    }

    // Pas d'appel d'outil ni de plan JSON -> reponse simple terminee
    break;
  }

  // Application atomique au store si des outils ont modifie le projet
  if (steps.length > 0 && store && typeof store.update === 'function') {
    store.update((p) => {
      for (const k of Object.keys(p)) {
        if (!(k in workingCopy)) delete p[k];
      }
      Object.assign(p, JSON.parse(JSON.stringify(workingCopy)));
    }, 'ai-agent');
  }

  return {
    workingCopy,
    messages,
    steps,
    content: finalContent,
  };
}
