// Blocs Blockly personnalisés + générateur JavaScript (API : docs/SCRIPT_API.md).
// Ce module ne touche pas au DOM : il peut être testé sous node.
import * as Blockly from 'blockly';
import * as Fr from 'blockly/msg/fr';
import 'blockly/blocks';
import { javascriptGenerator as G, Order } from 'blockly/javascript';

Blockly.setLocale(Fr);

export const KEYS = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE', 'ENTER', 'SHIFT', 'Z', 'X', 'C', 'A', 'W', 'S', 'D', 'Q', 'E'];

// Teintes par catégorie
const HUE = { event: 45, move: 210, look: 290, self: 165, input: 330, game: 20, mouse: 350, tile: 95, sound: 75, msg: 0 };

// ---------------------------------------------------------------- contexte

// Contexte de l'éditeur courant (objet édité) : les listes déroulantes lisent le projet à l'affichage.
let ctx = { getProject: () => null, objectId: null, isGlobal: false };
// Valeurs lues dans un script sauvegardé mais absentes du projet (objet supprimé…) : on les garde dans les listes.
const extras = { OBJ: new Set(), MAP: new Set(), ANIM: new Set(), LAYER: new Set(), SOUND: new Set(), SONG: new Set() };

export function setBlocksContext(c) {
  ctx = { ...ctx, ...c };
}

/** À appeler avant de charger un état sérialisé : retient les valeurs de listes dynamiques. */
export function prepareState(state) {
  for (const s of Object.values(extras)) s.clear();
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.fields && typeof n.type === 'string' && n.type.startsWith('pf_')) {
      for (const k of Object.keys(extras)) if (typeof n.fields[k] === 'string' && n.fields[k]) extras[k].add(n.fields[k]);
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(state);
}

function dynOptions(kind, names) {
  const list = names.slice();
  for (const v of extras[kind]) if (!list.includes(v)) list.push(v);
  return list.length ? list.map((n) => [n, n]) : [['(aucun)', '']];
}

const objectNames = () => (ctx.getProject()?.objects || []).map((o) => o.name);
const mapNames = () => (ctx.getProject()?.maps || []).map((m) => m.name);
function animNames() {
  const p = ctx.getProject();
  const obj = p?.objects.find((o) => o.id === ctx.objectId);
  const spr = p?.sprites.find((s) => s.id === obj?.spriteId);
  return (spr?.animations || []).map((a) => a.name);
}

export const SOUND_PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'];
function layerNames() {
  const out = [];
  for (const m of ctx.getProject()?.maps || []) for (const l of m.layers || []) if (!out.includes(l.name)) out.push(l.name);
  return out;
}
function soundNames() {
  const out = (ctx.getProject()?.sounds || []).map((x) => x.name).filter(Boolean);
  for (const p of SOUND_PRESETS) if (!out.includes(p)) out.push(p);
  return out;
}

const fObj = () => new Blockly.FieldDropdown(() => dynOptions('OBJ', objectNames()));
const fMap = () => new Blockly.FieldDropdown(() => dynOptions('MAP', mapNames()));
const fAnim = () => new Blockly.FieldDropdown(() => dynOptions('ANIM', animNames()));
const fSound = () => new Blockly.FieldDropdown(() => dynOptions('SOUND', soundNames()));
const songNames = () => (ctx.getProject()?.songs || []).map((x) => x.name).filter(Boolean);
const fSong = () => new Blockly.FieldDropdown(() => dynOptions('SONG', songNames()));
const fLayer = (withTile = true) => new Blockly.FieldDropdown(() => {
  const list = [['(premier calque solide)', '']];
  if (withTile) list.push(['(calque de la tuile touchée)', '@tile']);
  for (const n of new Set([...layerNames(), ...extras.LAYER])) list.push([n, n]);
  return list;
});
const fKey = () => new Blockly.FieldDropdown(KEYS.map((k) => [k, k]));

// Champ couleur : texte « #rrggbb » ; le bloc prend la couleur choisie ; sélecteur natif du navigateur à l'édition.
const HEX_RE = /^#[0-9a-f]{6}$/i;
class FieldHexColour extends Blockly.FieldTextInput {
  constructor(value = '#ff0000') {
    super(value, (v) => (HEX_RE.test(String(v)) ? String(v).toLowerCase() : null));
  }

  // Le bloc prend la couleur choisie
  doValueUpdate_(v) {
    super.doValueUpdate_(v);
    const blk = this.sourceBlock_;
    if (blk && HEX_RE.test(String(v))) {
      try { blk.setColour(String(v)); } catch { /* couleur refusée : on garde celle du thème */ }
    }
  }

  showEditor_() {
    if (typeof document === 'undefined') return;
    Blockly.WidgetDiv.show(this, this.sourceBlock_.RTL, () => {}, this.workspace_);
    const div = Blockly.WidgetDiv.getDiv();
    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.getValue();
    input.style.cssText = 'width:64px;height:32px;padding:0;border:0;background:none;cursor:pointer';
    input.oninput = () => this.setValue(input.value);
    input.onchange = () => Blockly.WidgetDiv.hideIfOwner(this);
    div.appendChild(input);
    const r = this.getClickTarget_().getBoundingClientRect();
    div.style.left = `${r.left + window.scrollX}px`;
    div.style.top = `${r.bottom + window.scrollY + 2}px`;
    try { input.showPicker(); } catch { /* ouverture au clic suivant */ }
  }
}

// ---------------------------------------------------------------- définition des blocs

function def(type, hue, tip, build, kind) {
  Blockly.Blocks[type] = {
    init() {
      build(this);
      this.setColour(hue);
      this.setTooltip(tip);
      if (kind === 'stmt') { this.setPreviousStatement(true); this.setNextStatement(true); }
    },
  };
}
const stmt = (t, h, tip, b) => def(t, h, tip, b, 'stmt');
const event = (t, tip, b) => def(t, HUE.event, tip, (blk) => { b(blk); blk.appendStatementInput('DO'); }, 'event');
function value(t, h, tip, b, check = null) {
  def(t, h, tip, (blk) => { b(blk); blk.setOutput(true, check); }, 'value');
}
const num = (blk, name, label, check = 'Number') => blk.appendValueInput(name).setCheck(check).appendField(label);

// Événements --------------------------------------------------------------
event('pf_on_create', 'Exécuté une fois, à l\'apparition.', (b) => b.appendDummyInput().appendField('quand créé'));
event('pf_on_update', 'Exécuté à chaque image ; dt = secondes écoulées.', (b) =>
  b.appendDummyInput().appendField('à chaque image (avec dt)'));
event('pf_on_collide', 'Contact avec un objet (bloquant). « l\'autre » = l\'objet touché.', (b) =>
  b.appendDummyInput().appendField('quand collision avec').appendField(fObj(), 'OBJ'));
event('pf_on_overlap', 'Chevauchement sans blocage, à chaque image. « l\'autre » = l\'objet touché.', (b) =>
  b.appendDummyInput().appendField('quand chevauche').appendField(fObj(), 'OBJ'));
event('pf_on_overlap_start', 'Une seule fois, quand le chevauchement commence. « l\'autre » = l\'objet touché.', (b) =>
  b.appendDummyInput().appendField('quand commence à chevaucher').appendField(fObj(), 'OBJ'));
event('pf_on_overlap_end', 'Une seule fois, quand le chevauchement se termine. « l\'autre » = l\'objet quitté.', (b) =>
  b.appendDummyInput().appendField('quand cesse de chevaucher').appendField(fObj(), 'OBJ'));
event('pf_on_key', 'Touche pressée (une fois).', (b) =>
  b.appendDummyInput().appendField('quand touche').appendField(fKey(), 'KEY').appendField('pressée'));
event('pf_on_timer', 'Répété toutes les N millisecondes.', (b) =>
  b.appendDummyInput().appendField('toutes les').appendField(new Blockly.FieldNumber(1000, 10, 3600000, 10), 'MS').appendField('ms'));
event('pf_on_destroy', 'Juste avant la destruction.', (b) => b.appendDummyInput().appendField('quand détruit'));

// Valeurs liées au contexte d'événement
value('pf_dt', HUE.event, 'Secondes écoulées depuis la dernière image (dans « à chaque image »).', (b) =>
  b.appendDummyInput().appendField('dt'), 'Number');
value('pf_other', HUE.event, 'L\'objet touché (dans « collision » / « chevauche »).', (b) =>
  b.appendDummyInput().appendField('l\'autre'));

// Mouvement ---------------------------------------------------------------
const SET_PROPS = [['x', 'x'], ['y', 'y'], ['vx (vitesse horizontale)', 'vx'], ['vy (vitesse verticale)', 'vy'],
  ['angle', 'angle'], ['alpha (opacité 0-1)', 'alpha'], ['miroir (vrai/faux)', 'flipX'], ['visible (vrai/faux)', 'visible'],
  ['profondeur (depth)', 'depth'], ['échelle (1 = normal)', 'scale'], ['miroir vertical (vrai/faux)', 'flipY'],
  ['collision avec la carte (vrai/faux)', 'collideMap'], ['collision avec les objets (vrai/faux)', 'collideObjects']];
const GET_PROPS = [...SET_PROPS, ['numéro (id)', 'id'], ['au sol ?', 'onGround'], ['largeur', 'width'], ['hauteur', 'height'], ['nom', 'name'],
  ['centre x', 'centerX'], ['centre y', 'centerY']];
const CHANGE_PROPS = [['x', 'x'], ['y', 'y'], ['vx', 'vx'], ['vy', 'vy'], ['angle', 'angle'], ['échelle', 'scale']];

stmt('pf_self_set', HUE.move, 'Fixe une propriété de l\'objet.', (b) =>
  num(b, 'VALUE', 'fixer', null).appendField(new Blockly.FieldDropdown(SET_PROPS), 'PROP').appendField('à'));
stmt('pf_self_change', HUE.move, 'Ajoute une valeur à une propriété de l\'objet.', (b) =>
  num(b, 'VALUE', 'ajouter à').appendField(new Blockly.FieldDropdown(CHANGE_PROPS), 'PROP'));
stmt('pf_jump', HUE.move, 'Saute (seulement si l\'objet touche le sol).', (b) => num(b, 'SPEED', 'sauter de'));
stmt('pf_move_towards', HUE.move, 'Règle la vitesse vers un autre objet.', (b) => {
  num(b, 'TARGET', 'se diriger vers', null);
  num(b, 'SPEED', 'à la vitesse');
});
stmt('pf_flip', HUE.move, 'Retourne l\'image horizontalement.', (b) =>
  b.appendDummyInput().appendField('miroir').appendField(new Blockly.FieldDropdown([['activé', 'true'], ['désactivé', 'false']]), 'ON'));
stmt('pf_gravity', HUE.move, 'Active ou coupe la gravité de cet objet.', (b) =>
  b.appendDummyInput().appendField('gravité').appendField(new Blockly.FieldDropdown([['activée', 'true'], ['coupée', 'false']]), 'ON'));
value('pf_distance_to', HUE.move, 'Distance en pixels jusqu\'à un autre objet.', (b) => num(b, 'TARGET', 'distance jusqu\'à', null), 'Number');

// Apparence ---------------------------------------------------------------
stmt('pf_play', HUE.look, 'Joue une animation du sprite de l\'objet.', (b) =>
  b.appendDummyInput().appendField('jouer l\'animation').appendField(fAnim(), 'ANIM'));
stmt('pf_visible', HUE.look, 'Affiche ou cache l\'objet.', (b) =>
  b.appendDummyInput().appendField(new Blockly.FieldDropdown([['afficher', 'true'], ['cacher', 'false']]), 'ON').appendField('l\'objet'));
stmt('pf_alpha', HUE.look, 'Opacité de l\'objet (0 à 1).', (b) => num(b, 'VALUE', 'opacité'));

// Propriétés / variables d'objet --------------------------------------------
value('pf_self_get', HUE.self, 'Lit une propriété de l\'objet.', (b) =>
  b.appendDummyInput().appendField('mon').appendField(new Blockly.FieldDropdown(GET_PROPS), 'PROP'));
stmt('pf_selfvar_set', HUE.self, 'Variable propre à cette instance (self.vars).', (b) => {
  num(b, 'VALUE', 'variable d\'objet', null).appendField(new Blockly.FieldTextInput('compteur'), 'NAME').appendField('←');
});
value('pf_selfvar_get', HUE.self, 'Variable propre à cette instance (self.vars).', (b) =>
  b.appendDummyInput().appendField('variable d\'objet').appendField(new Blockly.FieldTextInput('compteur'), 'NAME'));
value('pf_find', HUE.self, 'Première instance de cet objet (ou rien).', (b) =>
  b.appendDummyInput().appendField('premier').appendField(fObj(), 'OBJ'));
value('pf_obj_get', HUE.self, 'Lit une propriété d\'un autre objet.', (b) => {
  num(b, 'TARGET', 'de', null).appendField(new Blockly.FieldDropdown(GET_PROPS), 'PROP');
});
stmt('pf_obj_set', HUE.self, 'Fixe une propriété d\'un autre objet.', (b) => {
  num(b, 'TARGET', 'pour', null).appendField(new Blockly.FieldDropdown(SET_PROPS), 'PROP');
  num(b, 'VALUE', 'fixer à', null);
});
stmt('pf_destroy_target', HUE.self, 'Détruit l\'objet donné.', (b) => num(b, 'TARGET', 'détruire', null));

value('pf_self_ref', HUE.self, 'Cet objet lui-même, à brancher sur une entrée « cible ».', (b) => b.appendDummyInput().appendField('moi-même (instance)'));
value('pf_exists', HUE.self, 'Vrai si la cible existe (par exemple « premier Portail » ou « instance touchée par le rayon »).', (b) =>
  num(b, 'TARGET', 'existe ?', null), 'Boolean');
// Actions sur une cible (soi, l'autre, « premier … », variable, instance du rayon…) : sans effet si la cible est vide
stmt('pf_t_set_position', HUE.self, 'Place la cible (coin haut-gauche, en pixels).', (b) => {
  num(b, 'TARGET', 'cible', null);
  num(b, 'X', ': se placer en x');
  num(b, 'Y', 'y');
  b.setInputsInline(true);
});
stmt('pf_t_set_velocity', HUE.self, 'Règle la vitesse de la cible (pixels par seconde).', (b) => {
  num(b, 'TARGET', 'cible', null);
  num(b, 'VX', ': vitesse vx');
  num(b, 'VY', 'vy');
  b.setInputsInline(true);
});
stmt('pf_t_set_vel_angle', HUE.self, 'Vitesse de la cible dans une direction. Angle en degrés : 0 = droite, 90 = bas, -90 = haut.', (b) => {
  num(b, 'TARGET', 'cible', null);
  num(b, 'ANGLE', ': vitesse angle');
  num(b, 'SPEED', '° force');
  b.setInputsInline(true);
});
stmt('pf_t_orient', HUE.self, 'Oriente la cible selon une normale (angle = atan2(ny, nx), en degrés) + un décalage. 0 = le sprite regarde à droite.', (b) => {
  num(b, 'TARGET', 'cible', null);
  num(b, 'NX', ': s\'orienter selon la normale nx');
  num(b, 'NY', 'ny');
  num(b, 'OFFSET', 'décalage °');
  b.setInputsInline(true);
});
stmt('pf_t_collide_map', HUE.self, 'La cible traverse la carte (collision coupée) ou la heurte à nouveau. Nécessite « collision avec la carte » sur l\'objet.', (b) => {
  num(b, 'TARGET', 'cible', null);
  b.appendDummyInput().appendField(': collision avec la carte').appendField(new Blockly.FieldDropdown([['activée', 'true'], ['coupée', 'false']]), 'ON');
  b.setInputsInline(true);
});
stmt('pf_t_collide_objs', HUE.self, 'La cible ne bloque plus (ou bloque à nouveau) les autres objets en « collision ». Les chevauchements ne changent pas.', (b) => {
  num(b, 'TARGET', 'cible', null);
  b.appendDummyInput().appendField(': collision avec les objets').appendField(new Blockly.FieldDropdown([['activée', 'true'], ['coupée', 'false']]), 'ON');
  b.setInputsInline(true);
});
stmt('pf_t_hitbox', HUE.self, 'Boîte de collision de la cible, relative à son image (pixels).', (b) => {
  num(b, 'TARGET', 'cible', null);
  num(b, 'X', ': hitbox x');
  num(b, 'Y', 'y');
  num(b, 'W', 'largeur');
  num(b, 'H', 'hauteur');
  b.setInputsInline(true);
});
stmt('pf_t_prop_set', HUE.self, 'Fixe une propriété (self.props) de la cible.', (b) => {
  num(b, 'TARGET', 'cible', null);
  b.appendDummyInput().appendField(': propriété').appendField(new Blockly.FieldTextInput('cle'), 'KEY').appendField('←');
  num(b, 'VALUE', '', null);
  b.setInputsInline(true);
});

// Entrée ------------------------------------------------------------------
value('pf_key_down', HUE.input, 'Vrai tant que la touche est maintenue.', (b) =>
  b.appendDummyInput().appendField('touche').appendField(fKey(), 'KEY').appendField('maintenue ?'), 'Boolean');
value('pf_key_just', HUE.input, 'Vrai seulement l\'image où la touche est pressée.', (b) =>
  b.appendDummyInput().appendField('touche').appendField(fKey(), 'KEY').appendField('vient d\'être pressée ?'), 'Boolean');

// Jeu ---------------------------------------------------------------------
stmt('pf_score_set', HUE.game, 'Fixe le score.', (b) => num(b, 'VALUE', 'fixer le score à'));
stmt('pf_score_add', HUE.game, 'Ajoute au score.', (b) => num(b, 'VALUE', 'ajouter au score'));
value('pf_score_get', HUE.game, 'Le score.', (b) => b.appendDummyInput().appendField('score'), 'Number');
stmt('pf_gvar_set', HUE.game, 'Variable globale partagée entre les objets et les cartes.', (b) =>
  num(b, 'VALUE', 'variable globale', null).appendField(new Blockly.FieldTextInput('niveau'), 'NAME').appendField('←'));
value('pf_gvar_get', HUE.game, 'Variable globale partagée entre les objets et les cartes.', (b) =>
  b.appendDummyInput().appendField('variable globale').appendField(new Blockly.FieldTextInput('niveau'), 'NAME'));
stmt('pf_spawn', HUE.game, 'Crée une nouvelle instance.', (b) => {
  b.appendDummyInput().appendField('créer').appendField(fObj(), 'OBJ');
  num(b, 'X', 'en x');
  num(b, 'Y', 'y');
  b.setInputsInline(true);
});
stmt('pf_destroy_self', HUE.game, 'Détruit cet objet.', (b) => b.appendDummyInput().appendField('détruire soi-même'));
stmt('pf_destroy_other', HUE.game, 'Détruit l\'objet touché (dans « collision » / « chevauche »).', (b) =>
  b.appendDummyInput().appendField('détruire l\'autre'));
stmt('pf_goto_map', HUE.game, 'Change de carte.', (b) =>
  b.appendDummyInput().appendField('aller à la carte').appendField(fMap(), 'MAP'));
stmt('pf_restart', HUE.game, 'Recharge la carte courante.', (b) => b.appendDummyInput().appendField('recommencer la carte'));
stmt('pf_set_text', HUE.game, 'Texte fixe à l\'écran (créé ou mis à jour par identifiant).', (b) => {
  b.appendDummyInput().appendField('afficher le texte').appendField(new Blockly.FieldTextInput('score'), 'ID');
  num(b, 'TEXT', ':', null);
  num(b, 'X', 'en x');
  num(b, 'Y', 'y');
  b.setInputsInline(true);
});
stmt('pf_remove_text', HUE.game, 'Retire un texte affiché.', (b) =>
  b.appendDummyInput().appendField('effacer le texte').appendField(new Blockly.FieldTextInput('score'), 'ID'));
stmt('pf_cam_follow_self', HUE.game, 'La caméra suit cet objet.', (b) => b.appendDummyInput().appendField('caméra : suivre soi-même'));
stmt('pf_cam_follow', HUE.game, 'La caméra suit l\'objet donné.', (b) => num(b, 'TARGET', 'caméra : suivre', null));
stmt('pf_cam_shake', HUE.game, 'Secoue la caméra.', (b) => {
  num(b, 'MS', 'caméra : secouer');
  num(b, 'POWER', 'ms, intensité');
  b.setInputsInline(true);
});
stmt('pf_cam_flash', HUE.game, 'Flash blanc.', (b) => num(b, 'MS', 'caméra : flash (ms)'));
value('pf_random', HUE.game, 'Entier aléatoire (bornes incluses).', (b) => {
  num(b, 'MIN', 'aléatoire entre');
  num(b, 'MAX', 'et');
  b.setInputsInline(true);
}, 'Number');
value('pf_game_info', HUE.game, 'Dimensions de l\'écran et de la carte.', (b) =>
  b.appendDummyInput().appendField(new Blockly.FieldDropdown([
    ['largeur écran', 'width'], ['hauteur écran', 'height'], ['largeur carte', 'mapWidth'], ['hauteur carte', 'mapHeight'],
  ]), 'PROP'), 'Number');
stmt('pf_log', HUE.game, 'Affiche dans la console du jeu.', (b) => num(b, 'VALUE', 'écrire dans la console', null));

// ---- v1.1 : self ----------------------------------------------------------------
value('pf_self_id', HUE.self, 'Numéro unique de cette instance.', (b) => b.appendDummyInput().appendField('mon numéro (id)'), 'Number');
value('pf_props_get', HUE.self, 'Propriété de l\'instance, définie dans la carte ou à la création (« créer … avec propriétés »).', (b) =>
  b.appendDummyInput().appendField('mes propriétés').appendField(new Blockly.FieldTextInput('cle'), 'KEY'));
stmt('pf_props_set', HUE.self, 'Fixe une propriété de l\'instance (self.props).', (b) => {
  num(b, 'VALUE', 'mes propriétés', null).appendField(new Blockly.FieldTextInput('cle'), 'KEY').appendField('←');
});
value('pf_obj_prop', HUE.self, 'Propriété (self.props) d\'un autre objet.', (b) => {
  b.appendDummyInput().appendField('propriété').appendField(new Blockly.FieldTextInput('cle'), 'KEY');
  num(b, 'TARGET', 'de', null);
  b.setInputsInline(true);
});
stmt('pf_set_position', HUE.move, 'Place l\'objet (coin haut-gauche, en pixels).', (b) => {
  num(b, 'X', 'placer en x');
  num(b, 'Y', 'y');
  b.setInputsInline(true);
});
stmt('pf_set_velocity', HUE.move, 'Règle la vitesse (pixels par seconde).', (b) => {
  num(b, 'VX', 'vitesse vx');
  num(b, 'VY', 'vy');
  b.setInputsInline(true);
});
stmt('pf_set_vel_angle', HUE.move, 'Vitesse dans une direction. Angle en degrés : 0 = droite, 90 = bas, -90 = haut.', (b) => {
  num(b, 'ANGLE', 'vitesse : angle');
  num(b, 'SPEED', '°, vitesse');
  b.setInputsInline(true);
});
value('pf_angle_to_obj', HUE.move, 'Angle en degrés (0 = droite, 90 = bas) de cet objet vers un autre objet.', (b) =>
  num(b, 'TARGET', 'angle vers', null), 'Number');
value('pf_angle_to_point', HUE.move, 'Angle en degrés (0 = droite, 90 = bas) de cet objet vers un point du monde.', (b) => {
  num(b, 'X', 'angle vers le point x');
  num(b, 'Y', 'y');
  b.setInputsInline(true);
}, 'Number');
value('pf_angle_to_mouse', HUE.move, 'Angle en degrés (0 = droite, 90 = bas) de cet objet vers la souris.', (b) =>
  b.appendDummyInput().appendField('angle vers la souris'), 'Number');
value('pf_speed', HUE.move, 'Norme ou direction (angle en degrés) de la vitesse actuelle.', (b) =>
  b.appendDummyInput().appendField('ma').appendField(new Blockly.FieldDropdown([['vitesse (norme)', 'speed'], ['direction (angle °)', 'dir']]), 'PROP'), 'Number');
value('pf_atan2', HUE.move, 'Angle en degrés (0 = droite, 90 = bas) d\'un vecteur (dx, dy). Utile avec la normale d\'un rayon.', (b) => {
  num(b, 'DX', 'angle du vecteur dx');
  num(b, 'DY', 'dy');
  b.setInputsInline(true);
}, 'Number');
value('pf_blocked', HUE.move, 'Vrai si l\'objet est bloqué de ce côté par un mur, le sol ou une autre instance qui collide.', (b) =>
  b.appendDummyInput().appendField('bloqué').appendField(new Blockly.FieldDropdown([
    ['en bas ▼', 'down'], ['en haut', 'up'], ['à gauche', 'left'], ['à droite', 'right'],
  ]), 'SIDE').appendField('?'), 'Boolean');
stmt('pf_tint_set', HUE.look, 'Teinte l\'objet avec une couleur.', (b) => num(b, 'COLOR', 'teinte', null));
stmt('pf_tint_none', HUE.look, 'Enlève la teinte.', (b) => b.appendDummyInput().appendField('teinte : aucune'));
value('pf_colour', HUE.look, 'Une couleur (clique pour choisir). Texte « #rrggbb ».', (b) =>
  b.appendDummyInput().appendField('couleur').appendField(new FieldHexColour('#ff8040'), 'COL'), 'String');
{
  const init = Blockly.Blocks.pf_colour.init;
  Blockly.Blocks.pf_colour.init = function () { init.call(this); this.setColour(this.getFieldValue('COL')); };
}
stmt('pf_tween_to', HUE.look, 'Anime l\'objet vers ces valeurs. Les entrées laissées vides ne changent pas. Pour un objet à gravité, coupe d\'abord la gravité.', (b) => {
  b.appendDummyInput().appendField('animer vers');
  num(b, 'X', 'x', null);
  num(b, 'Y', 'y', null);
  num(b, 'ALPHA', 'opacité', null);
  num(b, 'ANGLE', 'angle', null);
  num(b, 'SCALE', 'échelle', null);
  num(b, 'MS', 'en', null);
  b.appendDummyInput().appendField('ms');
  b.setInputsInline(true);
});

// ---- v1.1 : événements ----------------------------------------------------------
event('pf_on_hit_tile', 'Au début du contact avec une tuile solide (l\'objet doit avoir « collision avec la carte »). Utilise « tuile touchée » dans le corps.', (b) =>
  b.appendDummyInput().appendField('quand une tuile solide est touchée'));
event('pf_on_click', 'Clic ou toucher sur cet objet.', (b) => b.appendDummyInput().appendField('quand on clique sur moi'));
event('pf_on_mousedown', 'Bouton de souris pressé n\'importe où.', (b) =>
  b.appendDummyInput().appendField('quand bouton souris').appendField(new Blockly.FieldDropdown([['gauche', 'LEFT'], ['droit', 'RIGHT']]), 'BTN').appendField('pressé'));
event('pf_on_beat', 'Au battement', (b) => b.appendDummyInput().appendField('au battement'));
event('pf_on_message', 'Un objet a diffusé ce message. « données du message » donne ce qui a été envoyé.', (b) =>
  b.appendDummyInput().appendField('quand le message').appendField(new Blockly.FieldTextInput('porte'), 'NAME').appendField('est reçu'));
value('pf_tile_info', HUE.event, 'Information sur la tuile touchée (dans « quand une tuile solide est touchée »). Le côté est celui de l\'objet qui touche.', (b) =>
  b.appendDummyInput().appendField('tuile touchée :').appendField(new Blockly.FieldDropdown([
    ['colonne (tx)', 'tx'], ['ligne (ty)', 'ty'], ['x (pixels)', 'x'], ['y (pixels)', 'y'],
    ['numéro (index)', 'index'], ['côté (up/down/left/right)', 'side'], ['calque', 'layer'],
  ]), 'PROP'));
value('pf_msg_data', HUE.msg, 'Données envoyées avec le message (dans « quand le message … est reçu »).', (b) =>
  b.appendDummyInput().appendField('données du message'));
stmt('pf_broadcast', HUE.msg, 'Envoie un message à tous les objets qui l\'écoutent. Les données sont facultatives.', (b) => {
  b.appendDummyInput().appendField('diffuser le message').appendField(new Blockly.FieldTextInput('porte'), 'NAME');
  num(b, 'DATA', 'avec', null);
  b.setInputsInline(true);
});
value('pf_value_field', HUE.msg, 'Lit un champ d\'un ensemble de propriétés (données de message, résultat…). Vide si absent.', (b) => {
  b.appendDummyInput().appendField('champ').appendField(new Blockly.FieldTextInput('cle'), 'KEY');
  num(b, 'OBJ', 'de', null);
  b.setInputsInline(true);
});

// Ensemble de propriétés « clé = valeur » (avec mutateur : roue crantée pour ajouter / retirer des lignes)
Blockly.Blocks.pf_dict_container = {
  init() {
    this.appendDummyInput().appendField('propriétés');
    this.appendStatementInput('STACK');
    this.setColour(HUE.msg);
    this.setTooltip('Ajoute, retire ou réordonne les lignes.');
    this.contextMenu = false;
  },
};
Blockly.Blocks.pf_dict_item = {
  init() {
    this.appendDummyInput().appendField('clé = valeur');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(HUE.msg);
    this.setTooltip('Une propriété.');
    this.contextMenu = false;
  },
};
Blockly.Blocks.pf_dict = {
  init() {
    this.itemCount_ = 0;
    this.appendDummyInput('HEAD').appendField('propriétés');
    this.setColour(HUE.msg);
    this.setOutput(true, null);
    this.setTooltip('Ensemble de propriétés « clé = valeur » (roue crantée : ajouter des lignes). '
      + 'À brancher sur « créer … avec propriétés » ou « diffuser le message … avec ».');
    this.setMutator(new Blockly.icons.MutatorIcon(['pf_dict_item'], this));
    this.updateShape_(1);
  },
  saveExtraState() { return { items: this.itemCount_ }; },
  loadExtraState(state) { this.updateShape_(Number(state?.items) || 0); },
  decompose(ws) {
    const c = ws.newBlock('pf_dict_container');
    c.initSvg();
    let conn = c.getInput('STACK').connection;
    for (let i = 0; i < this.itemCount_; i++) {
      const it = ws.newBlock('pf_dict_item');
      it.initSvg();
      conn.connect(it.previousConnection);
      conn = it.nextConnection;
    }
    return c;
  },
  compose(c) {
    const items = [];
    for (let it = c.getInputTargetBlock('STACK'); it; it = it.getNextBlock()) items.push(it);
    this.updateShape_(items.length);
    items.forEach((it, i) => {
      if (it.valueConnection_) this.getInput('V' + i).connection.connect(it.valueConnection_);
      if (it.keyValue_ != null) this.setFieldValue(it.keyValue_, 'K' + i);
    });
  },
  saveConnections(c) {
    let i = 0;
    for (let it = c.getInputTargetBlock('STACK'); it; it = it.getNextBlock()) {
      const inp = this.getInput('V' + i);
      it.valueConnection_ = inp?.connection.targetConnection || null;
      it.keyValue_ = inp ? this.getFieldValue('K' + i) : null;
      i++;
    }
  },
  updateShape_(n) {
    for (let i = this.itemCount_; i < n; i++) {
      this.appendValueInput('V' + i).setAlign(Blockly.inputs.Align.RIGHT)
        .appendField(new Blockly.FieldTextInput('cle' + (i + 1)), 'K' + i).appendField('=');
    }
    for (let i = this.itemCount_; i > n; i--) this.removeInput('V' + (i - 1));
    this.itemCount_ = n;
  },
};

// ---- v1.1 : souris --------------------------------------------------------------
value('pf_mouse_pos', HUE.mouse, 'Position de la souris : dans le monde (pixels de la carte) ou dans l\'écran du jeu.', (b) =>
  b.appendDummyInput().appendField('souris').appendField(new Blockly.FieldDropdown([
    ['x (monde)', 'mouseX'], ['y (monde)', 'mouseY'], ['x (écran)', 'mouseScreenX'], ['y (écran)', 'mouseScreenY'],
  ]), 'PROP'), 'Number');
const MOUSE_BTNS = [['gauche', 'LEFT'], ['droit', 'RIGHT']];
value('pf_mouse_down', HUE.mouse, 'Vrai tant que le bouton de la souris est maintenu.', (b) =>
  b.appendDummyInput().appendField('bouton souris').appendField(new Blockly.FieldDropdown(MOUSE_BTNS), 'BTN').appendField('maintenu ?'), 'Boolean');
value('pf_mouse_just', HUE.mouse, 'Vrai seulement l\'image où le bouton est pressé.', (b) =>
  b.appendDummyInput().appendField('bouton souris').appendField(new Blockly.FieldDropdown(MOUSE_BTNS), 'BTN').appendField('vient d\'être pressé ?'), 'Boolean');

// ---- v1.1 : tuiles & rayons -----------------------------------------------------
value('pf_get_tile', HUE.tile, 'Numéro de la tuile (-1 si vide ou hors carte).', (b) => {
  num(b, 'TX', 'tuile colonne');
  num(b, 'TY', 'ligne');
  b.appendDummyInput().appendField('calque').appendField(fLayer(), 'LAYER');
  b.setInputsInline(true);
}, 'Number');
stmt('pf_set_tile', HUE.tile, 'Change une tuile (-1 pour la supprimer). Les collisions suivent immédiatement.', (b) => {
  num(b, 'TX', 'tuile colonne');
  num(b, 'TY', 'ligne');
  num(b, 'INDEX', 'devient');
  b.appendDummyInput().appendField('calque').appendField(fLayer(), 'LAYER');
  b.setInputsInline(true);
});
value('pf_is_solid_at', HUE.tile, 'Vrai si le point (en pixels) est dans une tuile solide.', (b) => {
  num(b, 'X', 'solide en x');
  num(b, 'Y', 'y');
  b.appendDummyInput().appendField('?');
  b.setInputsInline(true);
}, 'Boolean');
value('pf_tile_size', HUE.tile, 'Taille d\'une tuile en pixels.', (b) => b.appendDummyInput().appendField('taille des tuiles'), 'Number');
value('pf_to_tile', HUE.tile, 'Convertit une position en pixels en coordonnée de tuile.', (b) => num(b, 'PX', 'pixels → tuile'), 'Number');
const RAY_MODES = [['tuiles seulement', ''], ['tuiles + objets (sauf moi)', 'objs'], ['tuiles + objets (moi compris)', 'all']];
const rayMode = (b) => b.appendDummyInput().appendField(new Blockly.FieldDropdown(RAY_MODES), 'MODE');
value('pf_raycast', HUE.tile, 'Lance un rayon contre les tuiles solides (et, au choix, les objets) et renvoie le résultat. Mets-le dans une variable, puis lis-le avec « du rayon ».', (b) => {
  num(b, 'X', 'rayon depuis x');
  num(b, 'Y', 'y');
  num(b, 'ANGLE', 'angle');
  num(b, 'DIST', 'distance max');
  rayMode(b);
  b.setInputsInline(true);
});
stmt('pf_ray_cast', HUE.tile, 'Lance un rayon contre les tuiles solides (et, au choix, les objets) et mémorise le résultat, à lire avec « résultat du rayon ».', (b) => {
  num(b, 'X', 'lancer un rayon depuis x');
  num(b, 'Y', 'y');
  num(b, 'ANGLE', 'angle');
  num(b, 'DIST', 'distance max');
  rayMode(b);
  b.setInputsInline(true);
});
stmt('pf_ray_cast_mouse', HUE.tile, 'Lance un rayon depuis le centre de l\'objet vers la souris et mémorise le résultat.', (b) => {
  num(b, 'DIST', 'lancer un rayon vers la souris, distance max');
  rayMode(b);
  b.setInputsInline(true);
});
const RAY_FIELDS = [
  ['touché ?', 'hit'], ['x (impact)', 'x'], ['y (impact)', 'y'], ['colonne tuile (tx)', 'tx'], ['ligne tuile (ty)', 'ty'],
  ['normale x', 'normalX'], ['normale y', 'normalY'], ['côté touché', 'side'], ['distance', 'distance'],
  ['calque touché', 'layer'], ['instance touchée', 'instance'], ['nom de l\'objet touché', 'objectName'],
];
value('pf_ray_last', HUE.tile, 'Lit le résultat du dernier rayon lancé par « lancer un rayon ». Sans impact : touché = faux.', (b) =>
  b.appendDummyInput().appendField('résultat du rayon :').appendField(new Blockly.FieldDropdown(RAY_FIELDS), 'FIELD'));
value('pf_ray_get', HUE.tile, 'Lit un champ d\'un résultat de « rayon depuis… » mis dans une variable.', (b) => {
  b.appendDummyInput().appendField(new Blockly.FieldDropdown(RAY_FIELDS), 'FIELD');
  num(b, 'RAY', 'du rayon', null);
  b.setInputsInline(true);
});
value('pf_side', HUE.tile, 'Un côté, à comparer avec « côté touché » ou « tuile touchée : côté ».', (b) =>
  b.appendDummyInput().appendField(new Blockly.FieldDropdown([
    ['gauche', 'left'], ['droite', 'right'], ['haut', 'up'], ['bas', 'down'],
  ]), 'SIDE'), 'String');

// ---- v1.1 : son -----------------------------------------------------------------
stmt('pf_play_sound', HUE.sound, 'Joue un son du projet ou un preset (volume 0-1, pitch 1 = normal).', (b) => {
  b.appendDummyInput().appendField('jouer le son').appendField(fSound(), 'SOUND');
  num(b, 'VOL', 'volume');
  num(b, 'PITCH', 'pitch');
  b.setInputsInline(true);
});
stmt('pf_play_music', HUE.sound, 'Joue en boucle (relancer la même musique ne fait rien).', (b) =>
  b.appendDummyInput().appendField('jouer la musique').appendField(fSound(), 'SOUND'));
stmt('pf_play_song', HUE.sound, 'Lance la lecture d\'un morceau chiptune.', (b) => {
  b.appendDummyInput().appendField('jouer le morceau').appendField(fSong(), 'SONG');
  num(b, 'VOL', 'volume');
  num(b, 'LOOP', 'boucle', 'Boolean');
  num(b, 'FADE_IN', 'fondu entrant (s)');
  b.setInputsInline(true);
});
stmt('pf_stop_song', HUE.sound, 'Arrête la lecture du morceau actuel.', (b) => {
  b.appendDummyInput().appendField('arrêter le morceau');
  num(b, 'FADE_OUT', 'fondu sortant (s)');
  b.setInputsInline(true);
});
stmt('pf_set_song_volume', HUE.sound, 'Modifie le volume du morceau.', (b) => {
  b.appendDummyInput().appendField('volume du morceau');
  num(b, 'VOL', 'volume');
  b.setInputsInline(true);
});
stmt('pf_stop_music', HUE.sound, 'Arrête la musique.', (b) => b.appendDummyInput().appendField('arrêter la musique'));

// ---- v1.1 : divers --------------------------------------------------------------
stmt('pf_spawn_props', HUE.game, 'Crée une instance avec des propriétés, lisibles dès « quand créé » via « mes propriétés ».', (b) => {
  b.appendDummyInput().appendField('créer').appendField(fObj(), 'OBJ');
  num(b, 'X', 'en x');
  num(b, 'Y', 'y');
  num(b, 'PROPS', 'avec', null);
  b.setInputsInline(true);
});
value('pf_spawn_val', HUE.game, 'Crée une instance (avec propriétés facultatives) et renvoie l\'instance : mets-la dans une variable.', (b) => {
  b.appendDummyInput().appendField('créer').appendField(fObj(), 'OBJ');
  num(b, 'X', 'en x');
  num(b, 'Y', 'y');
  num(b, 'PROPS', 'avec', null);
  b.setInputsInline(true);
});
value('pf_find_all', HUE.self, 'Liste de toutes les instances de cet objet.', (b) =>
  b.appendDummyInput().appendField('tous les').appendField(fObj(), 'OBJ'));
value('pf_count_of', HUE.game, 'Nombre d\'instances vivantes de cet objet.', (b) =>
  b.appendDummyInput().appendField('nombre de').appendField(fObj(), 'OBJ'), 'Number');
value('pf_current_map', HUE.game, 'Nom de la carte courante.', (b) => b.appendDummyInput().appendField('carte courante'), 'String');
stmt('pf_pause', HUE.game, 'Gèle la physique, les « à chaque image », les timers, les attentes et les animations. Les touches, clics et messages restent actifs.', (b) =>
  b.appendDummyInput().appendField('mettre le jeu en pause'));
stmt('pf_resume', HUE.game, 'Reprend le jeu après une pause.', (b) => b.appendDummyInput().appendField('reprendre le jeu'));
value('pf_is_paused', HUE.game, 'Vrai si le jeu est en pause.', (b) => b.appendDummyInput().appendField('en pause ?'), 'Boolean');
stmt('pf_wait', HUE.game, 'Exécute les blocs une seule fois, après ce délai en millisecondes.', (b) => {
  b.appendValueInput('MS').setCheck('Number').appendField('attendre');
  b.appendStatementInput('DO').appendField('ms puis');
  b.setInputsInline(true);
});
stmt('pf_particles', HUE.game, 'Petites particules carrées à une position du monde.', (b) => {
  num(b, 'X', 'particules en x');
  num(b, 'Y', 'y');
  num(b, 'COLOR', 'couleur', null);
  num(b, 'COUNT', 'nombre');
  num(b, 'SPEED', 'vitesse');
  num(b, 'MS', 'durée (ms)');
  b.setInputsInline(true);
});
stmt('pf_save', HUE.game, 'Sauvegarde une valeur dans le navigateur (propre à ce jeu).', (b) =>
  num(b, 'VALUE', 'sauvegarder', null).appendField(new Blockly.FieldTextInput('record'), 'KEY').appendField('←'));
value('pf_load', HUE.game, 'Relit une valeur sauvegardée (ou la valeur par défaut).', (b) => {
  b.appendDummyInput().appendField('charger').appendField(new Blockly.FieldTextInput('record'), 'KEY');
  num(b, 'DEFAULT', 'défaut', null);
  b.setInputsInline(true);
});
stmt('pf_cam_deadzone', HUE.game, 'Zone morte au centre de l\'écran (px) : la caméra ne bouge que si la cible en sort.', (b) => {
  num(b, 'W', 'caméra : zone morte largeur');
  num(b, 'H', 'hauteur');
  b.setInputsInline(true);
});
stmt('pf_cam_offset', HUE.game, 'Décalage de la caméra par rapport à la cible suivie (px).', (b) => {
  num(b, 'X', 'caméra : décalage x');
  num(b, 'Y', 'y');
  b.setInputsInline(true);
});
stmt('pf_cam_zoom', HUE.game, 'Zoom de la caméra (1 = normal).', (b) => num(b, 'Z', 'caméra : zoom'));
value('pf_cam_pos', HUE.game, 'Coin haut-gauche de la vue dans le monde.', (b) =>
  b.appendDummyInput().appendField('caméra').appendField(new Blockly.FieldDropdown([['x', 'x'], ['y', 'y']]), 'PROP'), 'Number');
stmt('pf_set_text_opts', HUE.game, 'Texte à l\'écran avec couleur, taille (1 = normale) et alignement (avec centré / droite, x est le centre / le bord droit).', (b) => {
  b.appendDummyInput().appendField('afficher le texte').appendField(new Blockly.FieldTextInput('score'), 'ID');
  num(b, 'TEXT', ':', null);
  num(b, 'X', 'en x');
  num(b, 'Y', 'y');
  num(b, 'COLOR', 'couleur', null);
  num(b, 'SIZE', 'taille');
  b.appendDummyInput().appendField('alignement').appendField(new Blockly.FieldDropdown([['gauche', 'left'], ['centré', 'center'], ['droite', 'right']]), 'ALIGN');
  b.setInputsInline(true);
});
stmt('pf_js', HUE.game, 'Exécute une instruction JavaScript.', (b) => {
  b.appendDummyInput().appendField('JavaScript').appendField(new Blockly.FieldTextInput('/* code */'), 'CODE');
});
value('pf_js_val', HUE.game, 'Évalue une expression JavaScript.', (b) => {
  b.appendDummyInput().appendField('js').appendField(new Blockly.FieldTextInput('/* expression */'), 'EXPR');
});

// Avertissement : blocs « l'autre », « dt », « tuile touchée », « données du message » hors de leur événement
const COLLIDE_EVENTS = ['pf_on_collide', 'pf_on_overlap', 'pf_on_overlap_start', 'pf_on_overlap_end'];
const EVENT_OF = {
  pf_other: COLLIDE_EVENTS, pf_destroy_other: COLLIDE_EVENTS, pf_dt: ['pf_on_update'],
  pf_tile_info: ['pf_on_hit_tile'], pf_msg_data: ['pf_on_message'],
};
const EVENT_LABEL = {
  pf_dt: '« à chaque image »', pf_tile_info: '« quand une tuile solide est touchée »', pf_msg_data: '« quand le message … est reçu »',
};

function enclosingEvent(block) {
  for (let p = block.getSurroundParent(); p; p = p.getSurroundParent()) if (p.type.startsWith('pf_on_')) return p.type;
  return null;
}
const inScope = (block) => EVENT_OF[block.type].includes(enclosingEvent(block));

for (const type of Object.keys(EVENT_OF)) {
  Blockly.Blocks[type].onchange = function () {
    if (this.isInFlyout || !this.workspace || this.workspace.isDragging?.()) return;
    this.setWarningText(inScope(this) ? null : 'À utiliser dans ' + (EVENT_LABEL[type] || '« collision » ou « chevauche »') + '.');
  };
}

// « calque de la tuile touchée » n'a de sens que dans « quand une tuile solide est touchée »
for (const type of ['pf_get_tile', 'pf_set_tile']) {
  Blockly.Blocks[type].onchange = function () {
    if (this.isInFlyout || !this.workspace || this.workspace.isDragging?.()) return;
    const bad = this.getFieldValue('LAYER') === '@tile' && enclosingEvent(this) !== 'pf_on_hit_tile';
    this.setWarningText(bad ? '« Calque de la tuile touchée » : à utiliser dans « quand une tuile solide est touchée ».' : null);
  };
}

// ---------------------------------------------------------------- générateur JavaScript

const q = (s) => G.quote_(String(s ?? ''));
const val = (b, name, order = Order.NONE, dflt = '0') => G.valueToCode(b, name, order) || dflt;
const body = (b) => G.statementToCode(b, 'DO');
const handler = (head, args, b) => `on(${head}, (${args}) => {\n${body(b)}});\n`;

G.addReservedWords('self,game,input,on,dt,other,tile,data,_pfRay');

G.forBlock.pf_on_create = (b) => handler(q('create'), '', b);
G.forBlock.pf_on_update = (b) => handler(q('update'), 'dt', b);
G.forBlock.pf_on_collide = (b) => handler(`${q('collide')}, ${q(b.getFieldValue('OBJ'))}`, 'other', b);
G.forBlock.pf_on_overlap = (b) => handler(`${q('overlap')}, ${q(b.getFieldValue('OBJ'))}`, 'other', b);
G.forBlock.pf_on_overlap_start = (b) => handler(`${q('overlapStart')}, ${q(b.getFieldValue('OBJ'))}`, 'other', b);
G.forBlock.pf_on_overlap_end = (b) => handler(`${q('overlapEnd')}, ${q(b.getFieldValue('OBJ'))}`, 'other', b);
G.forBlock.pf_on_key = (b) => handler(`${q('keydown')}, ${q(b.getFieldValue('KEY'))}`, '', b);
G.forBlock.pf_on_timer = (b) => handler(`${q('timer')}, ${Number(b.getFieldValue('MS')) || 1000}`, '', b);
G.forBlock.pf_on_destroy = (b) => handler(q('destroy'), '', b);
G.forBlock.pf_on_hit_tile = (b) => handler(q('hitTile'), 'tile', b);
G.forBlock.pf_on_click = (b) => handler(q('click'), '', b);
G.forBlock.pf_on_mousedown = (b) => handler(`${q('mousedown')}, ${q(b.getFieldValue('BTN'))}`, '', b);
G.forBlock.pf_on_beat = (b) => handler(q('beat'), 'beat', b);
G.forBlock.pf_on_message = (b) => handler(`${q('message')}, ${q(b.getFieldValue('NAME'))}`, 'data', b);

G.forBlock.pf_dt = (b) => (inScope(b) ? ['dt', Order.ATOMIC] : ['0', Order.ATOMIC]);
G.forBlock.pf_other = (b) => (inScope(b) ? ['other', Order.ATOMIC] : ['null', Order.ATOMIC]);
G.forBlock.pf_tile_info = (b) => (inScope(b) ? [`tile.${b.getFieldValue('PROP')}`, Order.MEMBER] : ['null', Order.ATOMIC]);
G.forBlock.pf_msg_data = (b) => (inScope(b) ? ['data', Order.ATOMIC] : ['null', Order.ATOMIC]);

G.forBlock.pf_self_set = (b) => `self.${b.getFieldValue('PROP')} = ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_self_change = (b) => `self.${b.getFieldValue('PROP')} += ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_jump = (b) => `self.jump(${val(b, 'SPEED')});\n`;
G.forBlock.pf_move_towards = (b) =>
  `{ const _t = ${val(b, 'TARGET', Order.NONE, 'null')}; if (_t) self.moveTowards(_t, ${val(b, 'SPEED')}); }\n`;
G.forBlock.pf_flip = (b) => `self.flipX = ${b.getFieldValue('ON')};\n`;
G.forBlock.pf_gravity = (b) => `self.setGravity(${b.getFieldValue('ON')});\n`;
G.forBlock.pf_distance_to = (b) =>
  [`((_o) => (_o ? self.distanceTo(_o) : 99999))(${val(b, 'TARGET', Order.NONE, 'null')})`, Order.FUNCTION_CALL];

G.forBlock.pf_play = (b) => `self.play(${q(b.getFieldValue('ANIM'))});\n`;
G.forBlock.pf_visible = (b) => `self.visible = ${b.getFieldValue('ON')};\n`;
G.forBlock.pf_alpha = (b) => `self.alpha = ${val(b, 'VALUE', Order.ASSIGNMENT, '1')};\n`;

G.forBlock.pf_self_get = (b) => [`self.${b.getFieldValue('PROP')}`, Order.MEMBER];
G.forBlock.pf_selfvar_set = (b) => `self.vars[${q(b.getFieldValue('NAME'))}] = ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_selfvar_get = (b) => [`self.vars[${q(b.getFieldValue('NAME'))}]`, Order.MEMBER];
G.forBlock.pf_find = (b) => [`game.find(${q(b.getFieldValue('OBJ'))})`, Order.FUNCTION_CALL];
G.forBlock.pf_obj_get = (b) =>
  [`((_o) => (_o ? _o.${b.getFieldValue('PROP')} : null))(${val(b, 'TARGET', Order.NONE, 'null')})`, Order.FUNCTION_CALL];
G.forBlock.pf_obj_set = (b) =>
  `{ const _t = ${val(b, 'TARGET', Order.NONE, 'null')}; if (_t) _t.${b.getFieldValue('PROP')} = ${val(b, 'VALUE', Order.ASSIGNMENT)}; }\n`;
G.forBlock.pf_destroy_target = (b) => `{ const _t = ${val(b, 'TARGET', Order.NONE, 'null')}; if (_t) _t.destroy(); }\n`;

G.forBlock.pf_key_down = (b) => [`input.isDown(${q(b.getFieldValue('KEY'))})`, Order.FUNCTION_CALL];
G.forBlock.pf_key_just = (b) => [`input.justPressed(${q(b.getFieldValue('KEY'))})`, Order.FUNCTION_CALL];

G.forBlock.pf_score_set = (b) => `game.score = ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_score_add = (b) => `game.score += ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_score_get = () => ['game.score', Order.MEMBER];
G.forBlock.pf_gvar_set = (b) => `game.vars[${q(b.getFieldValue('NAME'))}] = ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_gvar_get = (b) => [`game.vars[${q(b.getFieldValue('NAME'))}]`, Order.MEMBER];
G.forBlock.pf_spawn = (b) => `game.spawn(${q(b.getFieldValue('OBJ'))}, ${val(b, 'X')}, ${val(b, 'Y')});\n`;
G.forBlock.pf_destroy_self = () => 'self.destroy();\n';
G.forBlock.pf_destroy_other = (b) => (inScope(b) ? 'other.destroy();\n' : '');
G.forBlock.pf_goto_map = (b) => `game.goToMap(${q(b.getFieldValue('MAP'))});\n`;
G.forBlock.pf_restart = () => 'game.restart();\n';
G.forBlock.pf_set_text = (b) =>
  `game.setText(${q(b.getFieldValue('ID'))}, ${val(b, 'TEXT', Order.NONE, "''")}, ${val(b, 'X')}, ${val(b, 'Y')});\n`;
G.forBlock.pf_remove_text = (b) => `game.removeText(${q(b.getFieldValue('ID'))});\n`;
G.forBlock.pf_cam_follow_self = () => 'game.camera.follow(self);\n';
G.forBlock.pf_cam_follow = (b) => `{ const _t = ${val(b, 'TARGET', Order.NONE, 'null')}; if (_t) game.camera.follow(_t); }\n`;
G.forBlock.pf_cam_shake = (b) => `game.camera.shake(${val(b, 'MS', Order.NONE, '200')}, ${val(b, 'POWER', Order.NONE, '0.01')});\n`;
G.forBlock.pf_cam_flash = (b) => `game.camera.flash(${val(b, 'MS', Order.NONE, '200')});\n`;
G.forBlock.pf_random = (b) => [`game.random(${val(b, 'MIN')}, ${val(b, 'MAX', Order.NONE, '10')})`, Order.FUNCTION_CALL];
G.forBlock.pf_game_info = (b) => [`game.${b.getFieldValue('PROP')}`, Order.MEMBER];
G.forBlock.pf_log = (b) => `game.log(${val(b, 'VALUE', Order.NONE, "''")});\n`;

// ---- v1.1 -------------------------------------------------------------------------
const F = Order.FUNCTION_CALL;
const nul = (b, name) => val(b, name, Order.NONE, 'null');

G.forBlock.pf_self_id = () => ['self.id', Order.MEMBER];
G.forBlock.pf_props_get = (b) => [`self.props[${q(b.getFieldValue('KEY'))}]`, Order.MEMBER];
G.forBlock.pf_props_set = (b) => `self.props[${q(b.getFieldValue('KEY'))}] = ${val(b, 'VALUE', Order.ASSIGNMENT)};\n`;
G.forBlock.pf_obj_prop = (b) =>
  [`((_o) => (_o && _o.props ? _o.props[${q(b.getFieldValue('KEY'))}] : null))(${nul(b, 'TARGET')})`, F];
// Actions sur une cible : la cible est évaluée une fois, sans effet si elle est vide
const onTarget = (b, call) => `{ const _t = ${nul(b, 'TARGET')}; if (_t) ${call}; }\n`;
G.forBlock.pf_self_ref = () => ['self', Order.ATOMIC];
G.forBlock.pf_exists = (b) => [`(${nul(b, 'TARGET')} != null)`, Order.ATOMIC];
G.forBlock.pf_t_set_position = (b) => onTarget(b, `_t.setPosition(${val(b, 'X')}, ${val(b, 'Y')})`);
G.forBlock.pf_t_set_velocity = (b) => onTarget(b, `_t.setVelocity(${val(b, 'VX')}, ${val(b, 'VY')})`);
G.forBlock.pf_t_set_vel_angle = (b) => onTarget(b, `_t.setVelocityAngle(${val(b, 'ANGLE')}, ${val(b, 'SPEED')})`);
G.forBlock.pf_t_orient = (b) =>
  onTarget(b, `_t.angle = Math.atan2(${val(b, 'NY')}, ${val(b, 'NX')}) * 180 / Math.PI + ${val(b, 'OFFSET', Order.ADDITION)}`);
G.forBlock.pf_t_collide_map = (b) => onTarget(b, `_t.setCollideMap(${b.getFieldValue('ON')})`);
G.forBlock.pf_t_collide_objs = (b) => onTarget(b, `_t.setCollideObjects(${b.getFieldValue('ON')})`);
G.forBlock.pf_t_hitbox = (b) => onTarget(b, `_t.setHitbox(${val(b, 'X')}, ${val(b, 'Y')}, ${val(b, 'W', Order.NONE, '16')}, ${val(b, 'H', Order.NONE, '16')})`);
G.forBlock.pf_t_prop_set = (b) => onTarget(b, `_t.props[${q(b.getFieldValue('KEY'))}] = ${val(b, 'VALUE', Order.ASSIGNMENT)}`);
G.forBlock.pf_cam_deadzone = (b) => `game.camera.setDeadzone(${val(b, 'W')}, ${val(b, 'H')});\n`;
G.forBlock.pf_cam_offset = (b) => `game.camera.setOffset(${val(b, 'X')}, ${val(b, 'Y')});\n`;
G.forBlock.pf_set_position =(b) => `self.setPosition(${val(b, 'X')}, ${val(b, 'Y')});\n`;
G.forBlock.pf_set_velocity = (b) => `self.setVelocity(${val(b, 'VX')}, ${val(b, 'VY')});\n`;
G.forBlock.pf_set_vel_angle = (b) => `self.setVelocityAngle(${val(b, 'ANGLE')}, ${val(b, 'SPEED')});\n`;
G.forBlock.pf_angle_to_obj = (b) => [`((_o) => (_o ? self.angleTo(_o) : 0))(${nul(b, 'TARGET')})`, F];
G.forBlock.pf_angle_to_point = (b) => [`self.angleTo({ x: ${val(b, 'X')}, y: ${val(b, 'Y')} })`, F];
G.forBlock.pf_angle_to_mouse = () => ['self.angleTo({ x: input.mouseX, y: input.mouseY })', F];
G.forBlock.pf_speed = (b) => (b.getFieldValue('PROP') === 'dir'
  ? ['(Math.atan2(self.vy, self.vx) * 180 / Math.PI)', Order.ATOMIC]
  : ['Math.hypot(self.vx, self.vy)', F]);
G.forBlock.pf_atan2 = (b) => [`(Math.atan2(${val(b, 'DY')}, ${val(b, 'DX')}) * 180 / Math.PI)`, Order.ATOMIC];
G.forBlock.pf_blocked = (b) => [`self.blocked.${b.getFieldValue('SIDE')}`, Order.MEMBER];
G.forBlock.pf_tint_set = (b) => `self.tint = ${val(b, 'COLOR', Order.ASSIGNMENT, "'#ffffff'")};\n`;
G.forBlock.pf_tint_none = () => 'self.tint = null;\n';
G.forBlock.pf_colour = (b) => [q(b.getFieldValue('COL')), Order.ATOMIC];
G.forBlock.pf_tween_to = (b) => {
  const parts = [];
  for (const [inp, key] of [['X', 'x'], ['Y', 'y'], ['ALPHA', 'alpha'], ['ANGLE', 'angle'], ['SCALE', 'scale']]) {
    const c = G.valueToCode(b, inp, Order.NONE);
    if (c) parts.push(`${key}: ${c}`);
  }
  return `self.tweenTo({ ${parts.join(', ')} }, ${val(b, 'MS', Order.NONE, '400')});\n`;
};

G.forBlock.pf_broadcast = (b) => {
  const d = G.valueToCode(b, 'DATA', Order.NONE);
  return `game.broadcast(${q(b.getFieldValue('NAME'))}${d ? ', ' + d : ''});\n`;
};
G.forBlock.pf_value_field = (b) =>
  [`((_d) => (_d != null ? _d[${q(b.getFieldValue('KEY'))}] : null))(${nul(b, 'OBJ')})`, F];
G.forBlock.pf_dict = (b) => {
  const parts = [];
  for (let i = 0; i < b.itemCount_; i++) parts.push(`${q(b.getFieldValue('K' + i))}: ${nul(b, 'V' + i)}`);
  return [parts.length ? `{ ${parts.join(', ')} }` : '{}', Order.ATOMIC];
};

G.forBlock.pf_mouse_pos = (b) => [`input.${b.getFieldValue('PROP')}`, Order.MEMBER];
G.forBlock.pf_mouse_down = (b) => [`input.isMouseDown(${q(b.getFieldValue('BTN'))})`, F];
G.forBlock.pf_mouse_just = (b) => [`input.mouseJustPressed(${q(b.getFieldValue('BTN'))})`, F];

// Calque optionnel : '' = premier solide (argument omis), '@tile' = calque de la tuile touchée
function layerArg(b) {
  const l = b.getFieldValue('LAYER');
  if (l === '@tile') return enclosingEvent(b) === 'pf_on_hit_tile' ? ', tile.layer' : '';
  return l ? `, ${q(l)}` : '';
}
G.forBlock.pf_get_tile = (b) => [`game.getTile(${val(b, 'TX')}, ${val(b, 'TY')}${layerArg(b)})`, F];
G.forBlock.pf_set_tile = (b) => `game.setTile(${val(b, 'TX')}, ${val(b, 'TY')}, ${val(b, 'INDEX', Order.NONE, '-1')}${layerArg(b)});\n`;
G.forBlock.pf_is_solid_at = (b) => [`game.isSolidAt(${val(b, 'X')}, ${val(b, 'Y')})`, F];
G.forBlock.pf_tile_size = () => ['game.tileSize', Order.MEMBER];
G.forBlock.pf_to_tile = (b) => [`game.toTile(${val(b, 'PX')})`, F];
const RAY_OPTS = { '': '', objs: ', { objects: true, ignore: self }', all: ', { objects: true }' };
const rayOpts = (b) => RAY_OPTS[b.getFieldValue('MODE') || ''] || '';
const rayCall = (b) => `game.raycast(${val(b, 'X')}, ${val(b, 'Y')}, ${val(b, 'ANGLE')}, ${val(b, 'DIST', Order.NONE, '600')}${rayOpts(b)})`;
G.forBlock.pf_raycast = (b) => [rayCall(b), F];
// Le dernier rayon est mémorisé dans une variable du script (déclarée en tête du code généré)
const RAY_VAR = () => { G.definitions_.pf_ray = 'var _pfRay = null;'; return '_pfRay'; };
G.forBlock.pf_ray_cast = (b) => `${RAY_VAR()} = ${rayCall(b)};\n`;
G.forBlock.pf_ray_cast_mouse = (b) =>
  `${RAY_VAR()} = game.raycast(self.centerX, self.centerY, self.angleTo({ x: input.mouseX, y: input.mouseY }), ${val(b, 'DIST', Order.NONE, '600')}${rayOpts(b)});\n`;
const RAY_DEFAULT = { hit: 'false', side: 'null', layer: 'null', instance: 'null', objectName: 'null' };
const rayField = (f, src) => `((_r) => (_r ? _r.${f} : ${RAY_DEFAULT[f] ?? '0'}))(${src})`;
G.forBlock.pf_ray_last = (b) => [rayField(b.getFieldValue('FIELD'), RAY_VAR()), F];
G.forBlock.pf_ray_get = (b) => [rayField(b.getFieldValue('FIELD'), nul(b, 'RAY')), F];
G.forBlock.pf_side = (b) => [q(b.getFieldValue('SIDE')), Order.ATOMIC];

G.forBlock.pf_play_sound = (b) =>
  `game.playSound(${q(b.getFieldValue('SOUND'))}, ${val(b, 'VOL', Order.NONE, '1')}, ${val(b, 'PITCH', Order.NONE, '1')});\n`;
G.forBlock.pf_play_music = (b) => `game.playMusic(${q(b.getFieldValue('SOUND'))});\n`;
G.forBlock.pf_stop_music = () => 'game.stopMusic();\n';
G.forBlock.pf_play_song = (b) => `game.playSong(${q(b.getFieldValue('SONG'))}, { loop: ${val(b, 'LOOP', Order.NONE, 'true')}, volume: ${val(b, 'VOL', Order.NONE, '1')}, fadeIn: ${val(b, 'FADE_IN', Order.NONE, '0')} });\n`;
G.forBlock.pf_stop_song = (b) => `game.stopSong({ fadeOut: ${val(b, 'FADE_OUT', Order.NONE, '0')} });\n`;
G.forBlock.pf_set_song_volume = (b) => `game.setSongVolume(${val(b, 'VOL', Order.NONE, '1')});\n`;

const spawnCall = (b) => {
  const p = G.valueToCode(b, 'PROPS', Order.NONE);
  return `game.spawn(${q(b.getFieldValue('OBJ'))}, ${val(b, 'X')}, ${val(b, 'Y')}${p ? ', ' + p : ''})`;
};
G.forBlock.pf_spawn_props = (b) => spawnCall(b) + ';\n';
G.forBlock.pf_spawn_val = (b) => [spawnCall(b), F];
G.forBlock.pf_find_all = (b) => [`game.findAll(${q(b.getFieldValue('OBJ'))})`, F];
G.forBlock.pf_count_of = (b) => [`game.countOf(${q(b.getFieldValue('OBJ'))})`, F];
G.forBlock.pf_current_map = () => ['game.currentMap', Order.MEMBER];
G.forBlock.pf_pause = () => 'game.pause();\n';
G.forBlock.pf_resume = () => 'game.resume();\n';
G.forBlock.pf_is_paused = () => ['game.paused', Order.MEMBER];
G.forBlock.pf_wait = (b) => `game.wait(${val(b, 'MS', Order.NONE, '1000')}, () => {\n${body(b)}});\n`;
G.forBlock.pf_particles = (b) =>
  `game.particles(${val(b, 'X')}, ${val(b, 'Y')}, ${val(b, 'COLOR', Order.NONE, "'#ffffff'")}, ${val(b, 'COUNT', Order.NONE, '12')}, ${val(b, 'SPEED', Order.NONE, '80')}, ${val(b, 'MS', Order.NONE, '500')});\n`;
G.forBlock.pf_save = (b) => `game.save(${q(b.getFieldValue('KEY'))}, ${val(b, 'VALUE', Order.NONE, 'null')});\n`;
G.forBlock.pf_load = (b) => [`game.load(${q(b.getFieldValue('KEY'))}, ${val(b, 'DEFAULT', Order.NONE, 'null')})`, F];
G.forBlock.pf_cam_zoom = (b) => `game.camera.setZoom(${val(b, 'Z', Order.NONE, '1')});\n`;
G.forBlock.pf_cam_pos = (b) => [`game.camera.${b.getFieldValue('PROP')}`, Order.MEMBER];
G.forBlock.pf_set_text_opts = (b) =>
  `game.setText(${q(b.getFieldValue('ID'))}, ${val(b, 'TEXT', Order.NONE, "''")}, ${val(b, 'X')}, ${val(b, 'Y')}, `
  + `{ color: ${val(b, 'COLOR', Order.NONE, "'#ffffff'")}, size: ${val(b, 'SIZE', Order.NONE, '1')}, align: ${q(b.getFieldValue('ALIGN'))} });\n`;
G.forBlock.pf_js = (b) => `${b.getFieldValue('CODE')};\n`;
G.forBlock.pf_js_val = (b) => [b.getFieldValue('EXPR') || 'null', Order.ATOMIC];

/**
 * Code du workspace : seuls les blocs événement de haut niveau (et leurs suites) sont générés,
 * les blocs « orphelins » sont ignorés. Les définitions de procédures sont prises en compte.
 */
export function generateCode(ws) {
  G.init(ws);
  let code = '';
  for (const top of ws.getTopBlocks(true)) {
    if (top.type.startsWith('procedures_def')) {
      G.blockToCode(top);
    }
  }
  for (const top of ws.getTopBlocks(true)) {
    if (!top.type.startsWith('pf_on_')) continue;
    const c = G.blockToCode(top);
    code += Array.isArray(c) ? c[0] : c;
  }
  return G.finish(code).replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trimEnd() + (code ? '\n' : '');
}

// ---------------------------------------------------------------- script global : blocs interdits (self = null)

export const SELF_BLOCKS = new Set([
  'pf_on_collide', 'pf_on_overlap', 'pf_on_destroy',
  'pf_self_set', 'pf_self_change', 'pf_jump', 'pf_move_towards', 'pf_flip', 'pf_gravity', 'pf_distance_to',
  'pf_play', 'pf_visible', 'pf_alpha', 'pf_self_get', 'pf_selfvar_set', 'pf_selfvar_get',
  'pf_destroy_self', 'pf_cam_follow_self', 'pf_other', 'pf_destroy_other',
  // v1.1
  'pf_on_hit_tile', 'pf_on_click', 'pf_tile_info', 'pf_self_id', 'pf_props_get', 'pf_props_set', 'pf_set_position', 'pf_set_velocity',
  'pf_set_vel_angle', 'pf_angle_to_obj', 'pf_angle_to_point', 'pf_angle_to_mouse', 'pf_speed', 'pf_blocked',
  'pf_tint_set', 'pf_tint_none', 'pf_tween_to', 'pf_ray_cast_mouse',
  // v1.2
  'pf_on_overlap_start', 'pf_on_overlap_end', 'pf_self_ref',
  // 3D
  'pf_self_set_3d', 'pf_self_get_3d', 'pf_jump_3d', 'pf_move_forward_3d', 'pf_move_right_3d', 'pf_look_at_3d', 'pf_rotate_y_3d', 'pf_camera_follow_3d',
]);

/** Désactive (ou réactive) les blocs qui utilisent self selon le type de script. */
export function applySelfRestriction(ws, isGlobal) {
  for (const b of ws.getAllBlocks(false)) {
    if (SELF_BLOCKS.has(b.type)) b.setDisabledReason(isGlobal, 'pf-global');
  }
}

// ---------------------------------------------------------------- toolbox

const sh = (type, fields) => ({ shadow: { type, fields } });
const n = (v) => sh('math_number', { NUM: v });
const t = (v) => sh('text', { TEXT: v });
const B = (type, inputs, fields, extraState) => ({ kind: 'block', type, ...(inputs && { inputs }), ...(fields && { fields }), ...(extraState && { extraState }) });
const find = { block: { type: 'pf_find' } };
const me = { block: { type: 'pf_self_ref' } };

export function buildToolbox(isGlobal) {
  const keep = (type) => !(isGlobal && SELF_BLOCKS.has(type));
  const cat = (name, colour, contents) => ({ kind: 'category', name, colour: String(colour), contents: contents.filter((c) => c.kind !== 'block' || keep(c.type)) });
  const col = (v) => sh('pf_colour', { COL: v });
  const dict = (k) => ({ block: { type: 'pf_dict', extraState: { items: k } } });
  return {
    kind: 'categoryToolbox',
    contents: [
      cat('Événements', HUE.event, [
        B('pf_on_create'), B('pf_on_update'), B('pf_on_collide'), B('pf_on_overlap'), B('pf_on_overlap_start'), B('pf_on_overlap_end'), B('pf_on_key'), B('pf_on_timer'),
        B('pf_on_destroy'), B('pf_on_hit_tile'), B('pf_on_click'), B('pf_on_mousedown'), B('pf_on_message'),
        B('pf_dt'), B('pf_other'), B('pf_tile_info'), B('pf_msg_data'),
      ]),
      cat('Mouvement', HUE.move, [
        B('pf_self_set', { VALUE: n(0) }, { PROP: 'vx' }), B('pf_self_set', { VALUE: n(0) }, { PROP: 'vy' }),
        B('pf_self_change', { VALUE: n(1) }, { PROP: 'x' }), B('pf_self_change', { VALUE: n(1) }, { PROP: 'y' }),
        B('pf_set_position', { X: n(0), Y: n(0) }), B('pf_set_velocity', { VX: n(0), VY: n(0) }),
        B('pf_set_vel_angle', { ANGLE: n(0), SPEED: n(100) }),
        B('pf_jump', { SPEED: n(260) }), B('pf_move_towards', { TARGET: find, SPEED: n(40) }),
        B('pf_flip'), B('pf_gravity'), B('pf_distance_to', { TARGET: find }),
        B('pf_angle_to_obj', { TARGET: find }), B('pf_angle_to_point', { X: n(0), Y: n(0) }), B('pf_angle_to_mouse'),
        B('pf_speed'), B('pf_atan2', { DX: n(1), DY: n(0) }), B('pf_blocked'),
        B('pf_tween_to', { MS: n(400) }),
      ]),
      cat('Apparence', HUE.look, [
        B('pf_play'), B('pf_visible'), B('pf_alpha', { VALUE: n(1) }),
        B('pf_tint_set', { COLOR: col('#ff8040') }), B('pf_tint_none'), B('pf_colour'),
        B('pf_self_set', { VALUE: n(1) }, { PROP: 'scale' }), B('pf_self_set', { VALUE: n(50) }, { PROP: 'depth' }),
      ]),
      cat('Objet', HUE.self, [
        B('pf_self_get'), B('pf_self_id'), B('pf_props_get'), B('pf_props_set', { VALUE: n(0) }),
        B('pf_obj_prop', { TARGET: find }), B('pf_selfvar_set', { VALUE: n(0) }), B('pf_selfvar_get'),
        B('pf_find'), B('pf_find_all'), B('pf_obj_get', { TARGET: find }), B('pf_obj_set', { TARGET: find, VALUE: n(0) }),
        B('pf_destroy_target', { TARGET: find }), B('pf_count_of'),
        B('pf_self_ref'), B('pf_exists', { TARGET: find }),
        B('pf_t_set_position', { TARGET: me, X: n(0), Y: n(0) }), B('pf_t_set_velocity', { TARGET: me, VX: n(0), VY: n(0) }),
        B('pf_t_set_vel_angle', { TARGET: me, ANGLE: n(0), SPEED: n(100) }),
        B('pf_t_orient', { TARGET: me, NX: n(0), NY: n(-1), OFFSET: n(0) }),
        B('pf_t_collide_map', { TARGET: me }), B('pf_t_collide_objs', { TARGET: me }),
        B('pf_t_hitbox', { TARGET: me, X: n(0), Y: n(0), W: n(16), H: n(16) }), B('pf_t_prop_set', { TARGET: me, VALUE: n(0) }),
      ]),
      cat('Entrée', HUE.input, [B('pf_key_down'), B('pf_key_just')]),
      cat('Souris', HUE.mouse, [
        B('pf_on_click'), B('pf_on_mousedown'),
        B('pf_mouse_pos', null, { PROP: 'mouseX' }), B('pf_mouse_pos', null, { PROP: 'mouseY' }),
        B('pf_mouse_pos', null, { PROP: 'mouseScreenX' }), B('pf_mouse_pos', null, { PROP: 'mouseScreenY' }),
        B('pf_mouse_down'), B('pf_mouse_just'),
      ]),
      cat('Tuiles & rayons', HUE.tile, [
        B('pf_on_hit_tile'), B('pf_tile_info'),
        B('pf_get_tile', { TX: n(0), TY: n(0) }), B('pf_set_tile', { TX: n(0), TY: n(0), INDEX: n(-1) }),
        B('pf_is_solid_at', { X: n(0), Y: n(0) }), B('pf_tile_size'), B('pf_to_tile', { PX: n(0) }),
        B('pf_ray_cast', { X: n(0), Y: n(0), ANGLE: n(0), DIST: n(600) }), B('pf_ray_cast_mouse', { DIST: n(600) }),
        B('pf_ray_last'), B('pf_raycast', { X: n(0), Y: n(0), ANGLE: n(0), DIST: n(600) }), B('pf_ray_get'), B('pf_side'),
      ]),
      cat('Son', HUE.sound, [B('pf_play_sound', { VOL: n(1), PITCH: n(1) }), B('pf_play_music'), B('pf_stop_music')]),
      cat('Messages', HUE.msg, [
        B('pf_on_message'), B('pf_msg_data'), B('pf_broadcast'), B('pf_dict', null, null, { items: 2 }),
        B('pf_value_field', { OBJ: { block: { type: 'pf_msg_data' } } }),
      ]),
      cat('Jeu', HUE.game, [
        B('pf_score_set', { VALUE: n(0) }), B('pf_score_add', { VALUE: n(1) }), B('pf_score_get'),
        B('pf_gvar_set', { VALUE: n(0) }), B('pf_gvar_get'),
        B('pf_spawn', { X: n(0), Y: n(0) }), B('pf_spawn_props', { X: n(0), Y: n(0), PROPS: dict(1) }),
        B('pf_spawn_val', { X: n(0), Y: n(0) }),
        B('pf_destroy_self'), B('pf_destroy_other'),
        B('pf_goto_map'), B('pf_restart'), B('pf_current_map'),
        B('pf_pause'), B('pf_resume'), B('pf_is_paused'),
        B('pf_wait', { MS: n(1000) }),
        B('pf_particles', { X: n(0), Y: n(0), COLOR: col('#ffcd75'), COUNT: n(12), SPEED: n(80), MS: n(500) }),
        B('pf_save', { VALUE: n(0) }), B('pf_load', { DEFAULT: n(0) }),
        B('pf_random', { MIN: n(1), MAX: n(6) }), B('pf_game_info'), B('pf_log', { VALUE: t('Bonjour') }),
        B('pf_js'), B('pf_js_val'),
      ]),
      cat('Caméra & texte', HUE.game, [
        B('pf_set_text', { TEXT: t('Score: '), X: n(4), Y: n(4) }),
        B('pf_set_text_opts', { TEXT: t('Score: '), X: n(4), Y: n(4), COLOR: col('#ffffff'), SIZE: n(1) }),
        B('pf_remove_text'),
        B('pf_cam_follow_self'), B('pf_cam_follow', { TARGET: find }),
        B('pf_cam_shake', { MS: n(200), POWER: n(0.01) }), B('pf_cam_flash', { MS: n(200) }),
        B('pf_cam_zoom', { Z: n(1) }), B('pf_cam_deadzone', { W: n(40), H: n(30) }), B('pf_cam_offset', { X: n(0), Y: n(0) }), B('pf_cam_pos', null, { PROP: 'x' }), B('pf_cam_pos', null, { PROP: 'y' }),
      ]),
      { kind: 'sep' },
      { kind: 'category', name: 'Logique', colour: '210', contents: [
        B('controls_if'), B('logic_compare'), B('logic_operation'), B('logic_negate'), B('logic_boolean'), B('logic_ternary'),
      ] },
      { kind: 'category', name: 'Boucles', colour: '120', contents: [
        B('controls_repeat_ext', { TIMES: n(10) }), B('controls_whileUntil'),
        B('controls_for', { FROM: n(1), TO: n(10), BY: n(1) }), B('controls_forEach'), B('controls_flow_statements'),
      ] },
      { kind: 'category', name: 'Maths', colour: '230', contents: [
        B('math_number'), B('math_arithmetic', { A: n(1), B: n(1) }), B('math_single', { NUM: n(9) }),
        B('math_modulo', { DIVIDEND: n(64), DIVISOR: n(10) }), B('math_round', { NUM: n(3.1) }),
        B('math_random_int', { FROM: n(1), TO: n(100) }), B('math_constrain', { VALUE: n(50), LOW: n(1), HIGH: n(100) }),
        B('math_number_property', { NUMBER_TO_CHECK: n(0) }),
      ] },
      { kind: 'category', name: 'Texte', colour: '160', contents: [
        B('text'), B('text_join'), B('text_length', { VALUE: t('abc') }), B('text_isEmpty', { VALUE: t('') }),
      ] },
      { kind: 'category', name: 'Listes', colour: '260', contents: [
        B('lists_create_with'), B('lists_length'), B('lists_getIndex'), B('lists_setIndex'),
      ] },
      { kind: 'category', name: 'Variables', colour: '330', custom: 'VARIABLE' },
      { kind: 'category', name: 'Fonctions', colour: '290', custom: 'PROCEDURE' },
    ],
  };
}

// ---------------------------------------------------------------- thème sombre

export const darkTheme = Blockly.Theme.defineTheme('pixelforgeDark', {
  name: 'pixelforgeDark',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#15161e',
    toolboxBackgroundColour: '#1e2030',
    toolboxForegroundColour: '#e4e6f0',
    flyoutBackgroundColour: '#262a3d',
    flyoutForegroundColour: '#e4e6f0',
    flyoutOpacity: 0.95,
    scrollbarColour: '#566c86',
    scrollbarOpacity: 0.5,
    insertionMarkerColour: '#ffffff',
    insertionMarkerOpacity: 0.3,
    cursorColour: '#ffcd75',
  },
});

export { Blockly };
