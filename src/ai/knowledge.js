/**
 * PixelForge Studio — Base de connaissances technique pour l'assistant IA
 * Fournit la documentation complete de l'API de script, du schema Blueprint
 * et des regles d'or du moteur.
 */

import { GAMEDESIGN_PRINCIPLES } from './gamedesign.js';

export const PIXELFORGE_SCRIPT_API = `
# API DE SCRIPT JAVASCRIPT PIXELFORGE

Chaque script d'objet s'execute dans le corps d'une fonction avec les arguments : (self, game, input, on)

## Objet 'self' (l'instance courante) :
- self.x, self.y : coordonnees pixel du coin SUPERIEUR GAUCHE du sprite (pas le centre).
- self.vx, self.vy : velocite en pixels par seconde.
- self.width, self.height : dimensions en pixels.
- self.flipX, self.flipY : booleens pour inverser l'orientation du sprite.
- self.onGround : booleen indiquant si l'objet touche le sol.
- self.jump(force) : declenche un saut vertical de la force indiquee (recommande : 260 a 320 px/s). Fonctionne uniquement si self.onGround.
- self.play(animName) : lance l'animation nommee du sprite (ex: 'idle', 'run', 'jump').
- self.destroy() : supprime l'instance de la scene.
- self.vars : objet pour stocker des variables propres a l'instance (ex: self.vars.hp = 3).
- self.props : proprietes passees lors du placement dans la carte.

## Objet 'input' (controles joueur) :
- input.isDown('LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'SPACE' | 'X' | 'C' | 'Z') : true si maintenu.
- input.justPressed('KEY') : true sur l'unique frame d'appui.
- input.justReleased('KEY') : true sur l'unique frame de relachement.

## Objet 'game' (contexte global du jeu) :
- game.camera.follow(self) : la camera suit l'instance du joueur.
- game.score : nombre representant le score global.
- game.vars : dictionnaire partage entre tous les objets et maps.
- game.spawn(objectName, x, y) : cree une nouvelle instance et renvoie sa reference.
- game.find(objectName) : renvoie la premiere instance de ce type.
- game.findAll(objectName) : renvoie le tableau de toutes les instances.
- game.goToMap(mapName) : change de niveau.
- game.restart() : recharge le niveau courant.
- game.setText(id, text, x, y) : affiche ou met a jour un texte d'interface a l'ecran.
- game.playSound(soundName, volume, pitch) : joue un effet sonore sfxr (jump, coin, hit, explosion, laser...).
- game.playSong(songName, { loop, volume }) : joue une musique chiptune.
- game.stopSong() : arrete la musique.
- game.raycast(x, y, angle, dist, options) : lance un rayon et renvoie l'impact.

## Gestionnaires d'evenements 'on' (A ENREGISTRER AU PLUS HAUT NIVEAU) :
- on('create', () => { ... }) : execute a l'instanciation.
- on('update', (dt) => { ... }) : execute a chaque frame avec le delta-temps en ms.
- on('destroy', () => { ... }) : execute avant la suppression.
- on('collide', 'NomObjet', (other) => { ... }) : collision physique bloquante (ex: sol, plateforme).
- on('overlap', 'NomObjet', (other) => { ... }) : chevauchement sans blocage physique (ex: piece, portail, piege).
- on('overlapStart', 'NomObjet', (other) => { ... }) : entree dans la zone.
- on('overlapEnd', 'NomObjet', (other) => { ... }) : sortie de la zone.
- on('keydown', 'KEY', () => { ... }) : appui touche specifique.
- on('timer', ms, () => { ... }) : minuterie repetee toutes les N millisecondes.
- on('beat', (beatNumber) => { ... }) : synchro sur le rythme de la musique.
`;

export const BLUEPRINT_SCHEMA_GUIDE = `
# SCHEMA DE GRAPHE BLUEPRINT PIXELFORGE

Un graphe Blueprint valide est un objet JSON au format :
\`\`\`json
{
  "version": 1,
  "nodes": [
    { "id": "n1", "type": "NOM_DU_NOEUD", "x": 100, "y": 100, "fields": {}, "values": {}, "extra": {} }
  ],
  "links": [
    { "id": "l1", "from": "n1", "fromPin": "then", "to": "n2", "toPin": "exec" }
  ],
  "variables": [],
  "comments": []
}
\`\`\`

## Types de broches (pins) :
- Fils d'execution (blancs) : de la sortie 'then', 'true', 'false', 'body' vers l'entree 'exec' du noeud suivant.
- Fils de donnees : transportent une valeur d'une broche de sortie ('out', 'other', 'dt') vers une entree ('VALUE', 'COND', 'X', 'Y', 'TARGET').

## Noeuds d'evenements courants :
- pf_on_create : demarre a la creation (sortie: then)
- pf_on_update : boucle chaque frame (sorties: then, dt)
- pf_on_overlap : chevauchement (champs: OBJ, sorties: then, other)
- pf_on_collide : collision physique (champs: OBJ, sorties: then, other)
- pf_on_keydown : appui touche (champs: KEY, sortie: then)
- pf_on_timer : minuterie (champs: MS, sortie: then)

## Noeuds d'actions courants :
- pf_self_set : modifie une propriete de self (champs: PROP ['vx'|'vy'|'x'|'y'|'flipX'], entree: VALUE)
- pf_self_get : lit une propriete de self (champs: PROP, sortie: out)
- pf_jump : fait sauter self (entree: FORCE, defaut 290)
- pf_play_anim : joue une animation (champs: ANIM)
- pf_destroy_self : detruit self (entree: exec, sortie: then)
- pf_play_sound : joue un son (champs: SOUND)
- pf_play_song : lance une musique (champs: SONG)
- pf_score_add : incremente le score (valeurs: VALUE)
- pf_camera_follow : suit self avec la camera
- flow_branch : condition IF (entrees: exec, COND ; sorties: true, false)
- pf_key_down : verifie si une touche est pressee (champs: KEY, sortie: out booleen)
`;

export function buildSystemPrompt(options = {}) {
  const {
    includeGameDesign = true,
    includeBlueprints = true,
    activeObject = null,
    activeScript = '',
  } = options;

  let prompt = `Tu es l'assistant IA officiel integre a PixelForge Studio, le moteur de creation de jeux 2D et 3D retro en pixel art et Blueprints.
Ton role est d'aider les createurs a concevoir des jeux exceptionnels : ecrire des scripts en JavaScript, generer des graphes Blueprints valides, repondre aux questions techniques, resoudre les bugs et apporter des conseils de Game Design professionnels.

Règles impératives :
1. N'utilise JAMAIS aucun emoji dans tes reponses ou dans ton code.
2. Pour les scripts JavaScript, fournis TOUJOURS du code complet, pret a l'emploi, place dans un bloc markdown \`\`\`js ... \`\`\`.
3. Pour les graphes Blueprint, fournis TOUJOURS un objet JSON valide contenant "nodes" et "links", place dans un bloc markdown \`\`\`json ... \`\`\`.
4. Respecte strictement les conventions PixelForge : coordonnees x/y en haut a gauche, enregistrement des gestionnaires d'evenements 'on' au niveau superieur, distinction nette entre overlap (collecte, zones) et collide (blocage physique).
5. Applique par defaut les meilleures pratiques de Game Feel (Coyote time, jump buffer, saut variable, telegraphing des ennemis).
`;

  prompt += PIXELFORGE_SCRIPT_API;

  if (includeBlueprints) {
    prompt += '\n' + BLUEPRINT_SCHEMA_GUIDE;
  }

  if (includeGameDesign) {
    prompt += '\n' + GAMEDESIGN_PRINCIPLES;
  }

  if (activeObject) {
    prompt += `\n# CONTEXTE ACTUEL DANS LE STUDIO :
- Objet selectionne : ${activeObject.name}
- Proprietes physiques : ${JSON.stringify(activeObject.physics || {})}
`;
    if (activeScript) {
      prompt += `- Script actuel (${activeObject.script?.mode || 'code'}) :
\`\`\`js
${activeScript.slice(0, 1500)}
\`\`\`
`;
    }
  }

  return prompt;
}
