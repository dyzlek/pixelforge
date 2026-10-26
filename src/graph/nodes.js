// Catalogue des nœuds Blueprint (docs/BLUEPRINTS.md). Sans DOM ni dépendance : tourne sous node et dans le navigateur.
// Les nœuds PixelForge reprennent les noms des anciens blocs Blockly (src/graph/test/legacy-blocks.js).

export const PIN_COLORS = {
  exec: '#ffffff', number: '#9cf06a', boolean: '#e04848', string: '#f05ad0',
  object: '#41a6f6', color: '#ffcd75', list: '#73eff7', any: '#94b0c2',
};

// Ordre d'affichage de la palette ; couleurs d'en-tête façon Unreal
export const CATEGORIES = [
  { id: 'event', label: 'Événements', color: '#b13e53' },
  { id: 'flow', label: 'Flux', color: '#566c86' },
  { id: 'func', label: 'Fonctions', color: '#3b5dc9' },
  { id: 'var', label: 'Variables', color: '#257179' },
  { id: 'move', label: 'Mouvement', color: '#2f7fc4' },
  { id: 'look', label: 'Apparence', color: '#8a4fb3' },
  { id: 'self', label: 'Objet', color: '#2f9e6b' },
  { id: 'input', label: 'Entrée', color: '#c94f8a' },
  { id: 'mouse', label: 'Souris', color: '#b5476a' },
  { id: 'tile', label: 'Tuiles & rayons', color: '#6d9a2e' },
  { id: 'sound', label: 'Son', color: '#b0912a' },
  { id: 'msg', label: 'Messages', color: '#a8553b' },
  { id: 'game', label: 'Jeu', color: '#d4682f' },
  { id: 'cam', label: 'Caméra & texte', color: '#c47f2a' },
  { id: 'logic', label: 'Logique', color: '#4a6fd0' },
  { id: 'math', label: 'Maths', color: '#3f8f5a' },
  { id: 'text', label: 'Texte', color: '#2f8f84' },
  { id: 'list', label: 'Listes', color: '#7a5fc4' },
];

export const KEYS = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE', 'ENTER', 'SHIFT', 'Z', 'X', 'C', 'A', 'W', 'S', 'D', 'Q', 'E'];
export const SOUND_PRESETS = ['jump', 'coin', 'hit', 'powerup', 'explosion', 'laser', 'blip', 'portal'];

// ---------------------------------------------------------------- aides de déclaration

const EXEC_IN = { name: 'exec', label: '', type: 'exec' };
const THEN = { name: 'then', label: '', type: 'exec' };
const pin = (name, type, label = '', extra = {}) => ({ name, label, type, ...extra });
const withDef = (p, def) => (def === undefined ? p : { ...p, default: def });
const num = (name, label, def) => withDef(pin(name, 'number', label), def);
const any = (name, label, def, extra) => withDef(pin(name, 'any', label, extra), def);
const str = (name, label, def) => withDef(pin(name, 'string', label), def);
const bool = (name, label, def) => withDef(pin(name, 'boolean', label), def);
const col = (name, label, def) => withDef(pin(name, 'color', label), def);
const lst = (name, label, def) => withDef(pin(name, 'list', label), def);
const target = (label = 'cible') => pin('TARGET', 'object', label);
const execOut = (name, label) => pin(name, 'exec', label);

const dd = (name, label, options, def) => ({ name, label, kind: 'dropdown', options, default: def ?? options[0][1] });
const txt = (name, label, def, extra = {}) => ({ name, label, kind: 'text', default: def, ...extra });
const fnum = (name, label, def) => ({ name, label, kind: 'number', default: def });
const fdyn = (name, label, kind, def = '') => ({ name, label, kind, default: def });
const fObj = () => fdyn('OBJ', 'objet', 'object');
const fKey = () => fdyn('KEY', 'touche', 'key', 'SPACE');
const fOn = (label, on, off) => dd('ON', label, [[on, 'true'], [off, 'false']], 'true');
const fSide = () => dd('SIDE', 'côté', [['gauche', 'left'], ['droite', 'right'], ['haut', 'up'], ['bas', 'down']], 'left');

const SET_PROPS = [['x', 'x'], ['y', 'y'], ['vx (vitesse horizontale)', 'vx'], ['vy (vitesse verticale)', 'vy'],
  ['angle', 'angle'], ['alpha (opacité 0-1)', 'alpha'], ['miroir (vrai/faux)', 'flipX'], ['visible (vrai/faux)', 'visible'],
  ['profondeur (depth)', 'depth'], ['échelle (1 = normal)', 'scale'], ['miroir vertical (vrai/faux)', 'flipY'],
  ['collision avec la carte (vrai/faux)', 'collideMap'], ['collision avec les objets (vrai/faux)', 'collideObjects']];
const GET_PROPS = [...SET_PROPS, ['numéro (id)', 'id'], ['au sol ?', 'onGround'], ['largeur', 'width'], ['hauteur', 'height'], ['nom', 'name'],
  ['centre x', 'centerX'], ['centre y', 'centerY']];
const CHANGE_PROPS = [['x', 'x'], ['y', 'y'], ['vx', 'vx'], ['vy', 'vy'], ['angle', 'angle'], ['échelle', 'scale']];
const SET_PROPS_3D = [
  ['x', 'x'], ['y', 'y'], ['z', 'z'],
  ['vx (vitesse X)', 'vx'], ['vy (vitesse Y)', 'vy'], ['vz (vitesse Z)', 'vz'],
  ['rotationY (angle °)', 'rotationY'], ['rotationX (angle °)', 'rotationX'], ['rotationZ (angle °)', 'rotationZ'],
];
const CAM_3D_MODES = [
  ['3e personne', 'third-person'],
  ['1re personne (FPS)', 'first-person'],
  ['vue de dessus', 'top-down'],
  ['isométrique', 'isometric'],
  ['défilement 2.5D', 'side-scroll'],
];
const RAY_MODES = [['tuiles seulement', ''], ['tuiles + objets (sauf moi)', 'objs'], ['tuiles + objets (moi compris)', 'all']];
const RAY_FIELDS = [
  ['touché ?', 'hit'], ['x (impact)', 'x'], ['y (impact)', 'y'], ['colonne tuile (tx)', 'tx'], ['ligne tuile (ty)', 'ty'],
  ['normale x', 'normalX'], ['normale y', 'normalY'], ['côté touché', 'side'], ['distance', 'distance'],
  ['calque touché', 'layer'], ['instance touchée', 'instance'], ['nom de l\'objet touché', 'objectName'],
];
const MOUSE_BTNS = [['gauche', 'LEFT'], ['droit', 'RIGHT']];
const BOOL_VALUES = [['vrai', 'TRUE'], ['faux', 'FALSE']];

// ---------------------------------------------------------------- catalogue

const SPECS = new Map();

/**
 * Déclare un nœud. kind : event (pas d'exec en entrée), exec (exec en entrée + « then »), pure (une sortie « out »).
 * o.inputs / o.outputs : broches de données ; o.exec : sorties d'exécution en plus de « then » ; o.noThen : pas de « then ».
 */
function add(type, title, category, kind, tooltip, o = {}) {
  const inputs = [...(kind === 'exec' ? [EXEC_IN] : []), ...(o.inputs || [])];
  let outputs;
  if (kind === 'pure') outputs = [pin('out', o.out || 'any')];
  else outputs = [...(o.noThen ? [] : [THEN]), ...(o.exec || []), ...(o.outputs || [])];
  const spec = { type, title, category, tooltip, kind, inputs, outputs, fields: o.fields || [], dims: o.dims || ['2d', '3d'] };
  if (o.selfOnly) spec.selfOnly = true;
  if (o.keywords) spec.keywords = o.keywords;
  if (o.dynamic) spec.dynamic = o.dynamic;
  if (o.extra) spec.extra = o.extra;
  SPECS.set(type, spec);
}
const ev = (type, title, tooltip, o) => add(type, title, 'event', 'event', tooltip, o);
const ex = (type, title, cat, tooltip, o) => add(type, title, cat, 'exec', tooltip, o);
const pu = (type, title, cat, out, tooltip, o) => add(type, title, cat, 'pure', tooltip, { ...o, out });

// Événements ---------------------------------------------------------------
ev('pf_on_create', 'Quand créé', 'Exécuté une fois, à l\'apparition.', { keywords: 'create début start' });
ev('pf_on_update', 'À chaque image', 'Exécuté à chaque image ; dt = secondes écoulées.',
  { outputs: [num('dt', 'dt')], keywords: 'update frame tick boucle' });
const collideOut = [pin('other', 'object', 'l\'autre')];
ev('pf_on_collide', 'Collision avec', 'Contact avec un objet (bloquant). « l\'autre » = l\'objet touché.',
  { fields: [fObj()], outputs: collideOut, selfOnly: true, keywords: 'collide contact' });
ev('pf_on_overlap', 'Chevauche', 'Chevauchement sans blocage, à chaque image. « l\'autre » = l\'objet touché.',
  { fields: [fObj()], outputs: collideOut, selfOnly: true, keywords: 'overlap toucher' });
ev('pf_on_overlap_start', 'Début de chevauchement', 'Une seule fois, quand le chevauchement commence. « l\'autre » = l\'objet touché.',
  { fields: [fObj()], outputs: collideOut, selfOnly: true, keywords: 'overlapStart entrer' });
ev('pf_on_overlap_end', 'Fin de chevauchement', 'Une seule fois, quand le chevauchement se termine. « l\'autre » = l\'objet quitté.',
  { fields: [fObj()], outputs: collideOut, selfOnly: true, keywords: 'overlapEnd sortir' });
ev('pf_on_key', 'Touche pressée', 'Touche pressée (une fois).', { fields: [fKey()], keywords: 'keydown clavier' });
ev('pf_on_timer', 'Minuteur', 'Répété toutes les N millisecondes.', { fields: [fnum('MS', 'toutes les (ms)', 1000)], keywords: 'timer répéter' });
ev('pf_on_destroy', 'Quand détruit', 'Juste avant la destruction.', { selfOnly: true, keywords: 'destroy' });
ev('pf_on_hit_tile', 'Tuile solide touchée',
  'Au début du contact avec une tuile solide (l\'objet doit avoir « collision avec la carte »). Lis « tuile touchée » pour les détails.',
  { outputs: [pin('tile', 'any', 'tuile')], selfOnly: true, keywords: 'hitTile mur sol' });
ev('pf_on_click', 'Clic sur moi', 'Clic ou toucher sur cet objet.', { selfOnly: true, keywords: 'click souris' });
ev('pf_on_mousedown', 'Bouton souris pressé', 'Bouton de souris pressé n\'importe où.',
  { fields: [dd('BTN', 'bouton', MOUSE_BTNS)], keywords: 'mousedown clic' });
ev('pf_on_message', 'Message reçu', 'Un objet a diffusé ce message. « données » donne ce qui a été envoyé.',
  { fields: [txt('NAME', 'message', 'porte')], outputs: [pin('data', 'any', 'données')], keywords: 'message broadcast recevoir' });
ev('pf_on_beat', 'Au battement (rythme)', 'Déclenché à chaque battement / temps musical de la musique en cours.',
  { outputs: [num('beat', 'temps')], keywords: 'beat rythme bpm pulsation musique' });

// Flux ---------------------------------------------------------------------
add('flow_branch', 'Branche', 'flow', 'exec', 'Exécute « Vrai » ou « Faux » selon la condition, puis la suite.',
  { inputs: [bool('COND', 'condition', false)], exec: [execOut('true', 'Vrai'), execOut('false', 'Faux')], keywords: 'if si sinon condition' });
add('flow_sequence', 'Séquence', 'flow', 'exec', 'Exécute chaque sortie l\'une après l\'autre, dans l\'ordre.',
  { noThen: true, dynamic: 'outs', extra: { outs: 2 }, exec: [execOut('then0', '0'), execOut('then1', '1')], keywords: 'sequence ordre' });
add('flow_while', 'Tant que', 'flow', 'exec', 'Répète « Corps » tant que la condition est vraie.',
  { inputs: [bool('COND', 'condition', false)], exec: [execOut('body', 'Corps')], keywords: 'while boucle' });
add('flow_repeat', 'Répéter', 'flow', 'exec', 'Répète « Corps » un nombre de fois.',
  { inputs: [num('TIMES', 'fois', 10)], exec: [execOut('body', 'Corps')], keywords: 'repeat boucle' });
add('flow_for', 'Pour', 'flow', 'exec', 'Compte d\'une valeur à une autre (la variable de boucle est lisible via « index »).',
  { inputs: [num('FROM', 'de', 1), num('TO', 'à', 10), num('BY', 'pas', 1)], fields: [fdyn('VAR', 'variable', 'variable', 'i')],
    exec: [execOut('body', 'Corps')], outputs: [num('index', 'index')], keywords: 'for boucle compter' });
add('flow_for_each', 'Pour chaque', 'flow', 'exec', 'Parcourt une liste (l\'élément courant est lisible via « élément »).',
  { inputs: [lst('LIST', 'liste')], fields: [fdyn('VAR', 'variable', 'variable', 'item')],
    exec: [execOut('body', 'Corps')], outputs: [any('item', 'élément')], keywords: 'foreach boucle liste' });
add('flow_break', 'Interrompre', 'flow', 'exec', 'Sort de la boucle.', { noThen: true, keywords: 'break' });
add('flow_continue', 'Passer au suivant', 'flow', 'exec', 'Passe à l\'itération suivante.', { noThen: true, keywords: 'continue' });
ex('pf_wait', 'Délai', 'flow', 'Continue tout de suite par « Suite » ; « Terminé » s\'exécute une seule fois après ce délai en millisecondes.',
  { inputs: [num('MS', 'ms', 1000)], exec: [execOut('done', 'Terminé')], keywords: 'wait attendre delay timer' });

// Variables -----------------------------------------------------------------
pu('var_get', 'Lire variable', 'var', 'any', 'Valeur d\'une variable du script.', { fields: [fdyn('NAME', 'variable', 'variable')], keywords: 'variable get' });
ex('var_set', 'Définir variable', 'var', 'Affecte une valeur à une variable du script.',
  { inputs: [any('VALUE', 'valeur', 0)], fields: [fdyn('NAME', 'variable', 'variable')], keywords: 'variable set' });
ex('var_change', 'Changer variable de', 'var', 'Ajoute une valeur à une variable du script.',
  { inputs: [num('DELTA', 'delta', 1)], fields: [fdyn('NAME', 'variable', 'variable')], keywords: 'variable incrémenter add' });

// Fonctions -----------------------------------------------------------------
add('fn_def', 'Fonction', 'func', 'event', 'Définit une fonction (appelée avec « Appeler »). Les paramètres sont des sorties.',
  { fields: [txt('NAME', 'nom', 'fonction')], dynamic: 'params', extra: { params: [] }, keywords: 'function procédure définir' });
add('fn_call', 'Appeler', 'func', 'exec', 'Appelle une fonction du script.',
  { dynamic: 'call', extra: { name: '', params: [] }, keywords: 'function appeler call' });
add('fn_call_value', 'Appeler (valeur)', 'func', 'pure', 'Appelle une fonction du script et renvoie son résultat.',
  { dynamic: 'call', extra: { name: '', params: [] }, out: 'any', keywords: 'function appeler call retour' });
add('fn_return', 'Retourner', 'func', 'exec', 'Quitte la fonction (ou le gestionnaire) en renvoyant une valeur facultative.',
  { inputs: [any('VALUE', 'valeur', undefined, { optional: true })], noThen: true, keywords: 'return retour' });

// Mouvement ------------------------------------------------------------------
ex('pf_self_set', 'Définir', 'move', 'Fixe une propriété de l\'objet.',
  { inputs: [any('VALUE', 'valeur', 0)], fields: [dd('PROP', 'propriété', SET_PROPS, 'vx')], selfOnly: true, keywords: 'set fixer vitesse' });
ex('pf_self_change', 'Ajouter à', 'move', 'Ajoute une valeur à une propriété de l\'objet.',
  { inputs: [num('VALUE', 'valeur', 1)], fields: [dd('PROP', 'propriété', CHANGE_PROPS, 'x')], selfOnly: true, keywords: 'change incrémenter' });
ex('pf_jump', 'Sauter', 'move', 'Saute (seulement si l\'objet touche le sol).',
  { inputs: [num('SPEED', 'vitesse', 260)], selfOnly: true, keywords: 'jump saut' });
ex('pf_move_towards', 'Se diriger vers', 'move', 'Règle la vitesse vers un autre objet.',
  { inputs: [target('objet'), num('SPEED', 'vitesse', 40)], selfOnly: true, keywords: 'suivre poursuivre' });
ex('pf_flip', 'Miroir', 'move', 'Retourne l\'image horizontalement.', { fields: [fOn('miroir', 'activé', 'désactivé')], selfOnly: true, keywords: 'flip' });
ex('pf_gravity', 'Gravité', 'move', 'Active ou coupe la gravité de cet objet.', { fields: [fOn('gravité', 'activée', 'coupée')], selfOnly: true });
pu('pf_distance_to', 'Distance jusqu\'à', 'move', 'number', 'Distance en pixels jusqu\'à un autre objet.', { inputs: [target('objet')], selfOnly: true });
ex('pf_set_position', 'Placer', 'move', 'Place l\'objet (coin haut-gauche, en pixels).',
  { inputs: [num('X', 'x', 0), num('Y', 'y', 0)], selfOnly: true, keywords: 'position téléporter' });
ex('pf_set_velocity', 'Définir vitesse', 'move', 'Règle la vitesse (pixels par seconde).',
  { inputs: [num('VX', 'vx', 0), num('VY', 'vy', 0)], selfOnly: true, keywords: 'velocity' });
ex('pf_set_vel_angle', 'Vitesse par angle', 'move', 'Vitesse dans une direction. Angle en degrés : 0 = droite, 90 = bas, -90 = haut.',
  { inputs: [num('ANGLE', 'angle', 0), num('SPEED', 'vitesse', 100)], selfOnly: true });
pu('pf_angle_to_obj', 'Angle vers objet', 'move', 'number', 'Angle en degrés (0 = droite, 90 = bas) de cet objet vers un autre objet.', { inputs: [target('objet')], selfOnly: true });
pu('pf_angle_to_point', 'Angle vers point', 'move', 'number', 'Angle en degrés (0 = droite, 90 = bas) de cet objet vers un point du monde.',
  { inputs: [num('X', 'x', 0), num('Y', 'y', 0)], selfOnly: true });
pu('pf_angle_to_mouse', 'Angle vers la souris', 'move', 'number', 'Angle en degrés (0 = droite, 90 = bas) de cet objet vers la souris.', { selfOnly: true });
pu('pf_speed', 'Ma vitesse', 'move', 'number', 'Norme ou direction (angle en degrés) de la vitesse actuelle.',
  { fields: [dd('PROP', 'valeur', [['vitesse (norme)', 'speed'], ['direction (angle °)', 'dir']])], selfOnly: true });
pu('pf_atan2', 'Angle du vecteur', 'move', 'number', 'Angle en degrés (0 = droite, 90 = bas) d\'un vecteur (dx, dy). Utile avec la normale d\'un rayon.',
  { inputs: [num('DX', 'dx', 1), num('DY', 'dy', 0)], keywords: 'atan2' });
pu('pf_blocked', 'Bloqué ?', 'move', 'boolean', 'Vrai si l\'objet est bloqué de ce côté par un mur, le sol ou une autre instance qui collide.',
  { fields: [dd('SIDE', 'côté', [['en bas', 'down'], ['en haut', 'up'], ['à gauche', 'left'], ['à droite', 'right']])], selfOnly: true });

ex('pf_self_set_3d', 'Définir propriété 3D', 'move', 'Fixe une coordonnée ou vitesse 3D de cet objet.',
  { inputs: [num('VALUE', 'valeur', 0)], fields: [dd('PROP', 'propriété', SET_PROPS_3D, 'vx')], selfOnly: true, dims: ['3d'], keywords: '3d position vitesse coordonnee' });
pu('pf_self_get_3d', 'Lire propriété 3D', 'move', 'number', 'Lit une coordonnée ou vitesse 3D de cet objet.',
  { fields: [dd('PROP', 'propriété', SET_PROPS_3D, 'x')], selfOnly: true, dims: ['3d'], keywords: '3d position vitesse coordonnee' });
ex('pf_jump_3d', 'Sauter 3D', 'move', 'Fait sauter l\'objet vers le haut (+Y) s\'il touche le sol.',
  { inputs: [num('FORCE', 'force', 10)], selfOnly: true, dims: ['3d'], keywords: '3d saut jump impulsion' });
ex('pf_move_forward_3d', 'Avancer (direction regardée)', 'move', 'Avance dans la direction horizontale actuellement regardée.',
  { inputs: [num('SPEED', 'vitesse', 5)], selfOnly: true, dims: ['3d'], keywords: '3d avancer forward vitesse' });
ex('pf_move_right_3d', 'Déplacement latéral (strafe)', 'move', 'Déplacement latéral perpendiculaire à l\'angle de vue.',
  { inputs: [num('SPEED', 'vitesse', 5)], selfOnly: true, dims: ['3d'], keywords: '3d strafe lateral droite gauche' });
ex('pf_look_at_3d', 'Regarder vers 3D', 'move', 'Oriente l\'objet vers les coordonnées cibles.',
  { inputs: [num('X', 'x', 0), num('Y', 'y', 0), num('Z', 'z', 0)], selfOnly: true, dims: ['3d'], keywords: '3d orientation regarder cibler' });
ex('pf_rotate_y_3d', 'Pivoter horizontalement', 'move', 'Ajoute un angle à l\'orientation horizontale de l\'objet.',
  { inputs: [num('ANGLE', 'angle (°)', 45)], selfOnly: true, dims: ['3d'], keywords: '3d tourner pivoter rotation' });
pu('pf_distance_3d', 'Distance 3D', 'move', 'number', 'Calcule la distance euclidienne entre deux points dans l\'espace 3D.',
  { inputs: [num('X1', 'x1', 0), num('Y1', 'y1', 0), num('Z1', 'z1', 0), num('X2', 'x2', 0), num('Y2', 'y2', 0), num('Z2', 'z2', 0)], dims: ['3d'], keywords: '3d distance euclidienne hypot' });

ex('pf_tween_to', 'Animer vers', 'look', 'Anime l\'objet vers ces valeurs. Les entrées laissées vides ne changent pas. Pour un objet à gravité, coupe d\'abord la gravité.',
  { inputs: [any('X', 'x', undefined, { optional: true }), any('Y', 'y', undefined, { optional: true }),
    any('ALPHA', 'opacité', undefined, { optional: true }), any('ANGLE', 'angle', undefined, { optional: true }),
    any('SCALE', 'échelle', undefined, { optional: true }), any('MS', 'durée (ms)', 400)], selfOnly: true, keywords: 'tween animer' });

// Apparence ------------------------------------------------------------------
ex('pf_play', 'Jouer l\'animation', 'look', 'Joue une animation du sprite de l\'objet.', { fields: [fdyn('ANIM', 'animation', 'anim')], selfOnly: true, keywords: 'animation play' });
ex('pf_visible', 'Afficher / cacher', 'look', 'Affiche ou cache l\'objet.', { fields: [dd('ON', 'objet', [['afficher', 'true'], ['cacher', 'false']], 'true')], selfOnly: true, keywords: 'visible' });
ex('pf_alpha', 'Opacité', 'look', 'Opacité de l\'objet (0 à 1).', { inputs: [num('VALUE', 'opacité', 1)], selfOnly: true, keywords: 'alpha' });
ex('pf_tint_set', 'Teinter', 'look', 'Teinte l\'objet avec une couleur.', { inputs: [col('COLOR', 'couleur', '#ff8040')], selfOnly: true, keywords: 'tint couleur' });
ex('pf_tint_none', 'Enlever la teinte', 'look', 'Enlève la teinte.', { selfOnly: true });
pu('pf_colour', 'Couleur', 'look', 'color', 'Une couleur (clique pour choisir). Texte « #rrggbb ».', { fields: [fdyn('COL', 'couleur', 'color', '#ff8040')] });

// Objet ----------------------------------------------------------------------
pu('pf_self_get', 'Ma propriété', 'self', 'any', 'Lit une propriété de l\'objet.', { fields: [dd('PROP', 'propriété', GET_PROPS, 'x')], selfOnly: true });
pu('pf_self_id', 'Mon numéro (id)', 'self', 'number', 'Numéro unique de cette instance.', { selfOnly: true });
pu('pf_props_get', 'Mes propriétés', 'self', 'any', 'Propriété de l\'instance, définie dans la carte ou à la création (« créer … avec propriétés »).',
  { fields: [txt('KEY', 'clé', 'cle')], selfOnly: true, keywords: 'props' });
ex('pf_props_set', 'Définir mes propriétés', 'self', 'Fixe une propriété de l\'instance (self.props).',
  { inputs: [any('VALUE', 'valeur', 0)], fields: [txt('KEY', 'clé', 'cle')], selfOnly: true, keywords: 'props' });
pu('pf_obj_prop', 'Propriété d\'un objet', 'self', 'any', 'Propriété (self.props) d\'un autre objet.', { inputs: [target('objet')], fields: [txt('KEY', 'clé', 'cle')], keywords: 'props' });
ex('pf_selfvar_set', 'Définir variable d\'objet', 'self', 'Variable propre à cette instance (self.vars).',
  { inputs: [any('VALUE', 'valeur', 0)], fields: [txt('NAME', 'nom', 'compteur')], selfOnly: true });
pu('pf_selfvar_get', 'Variable d\'objet', 'self', 'any', 'Variable propre à cette instance (self.vars).', { fields: [txt('NAME', 'nom', 'compteur')], selfOnly: true });
pu('pf_find', 'Premier objet', 'self', 'object', 'Première instance de cet objet (ou rien).', { fields: [fObj()], keywords: 'find trouver' });
pu('pf_find_all', 'Tous les objets', 'self', 'list', 'Liste de toutes les instances de cet objet.', { fields: [fObj()], keywords: 'findAll' });
pu('pf_obj_get', 'Propriété d\'un objet', 'self', 'any', 'Lit une propriété d\'un autre objet.', { inputs: [target('objet')], fields: [dd('PROP', 'propriété', GET_PROPS, 'x')] });
ex('pf_obj_set', 'Définir sur un objet', 'self', 'Fixe une propriété d\'un autre objet.',
  { inputs: [target('objet'), any('VALUE', 'valeur', 0)], fields: [dd('PROP', 'propriété', SET_PROPS, 'x')] });
ex('pf_destroy_target', 'Détruire', 'self', 'Détruit l\'objet donné.', { inputs: [target('objet')], keywords: 'destroy supprimer' });
pu('pf_count_of', 'Nombre de', 'self', 'number', 'Nombre d\'instances vivantes de cet objet.', { fields: [fObj()], keywords: 'count' });
pu('pf_self_ref', 'Moi-même', 'self', 'object', 'Cet objet lui-même, à brancher sur une entrée « cible ».', { selfOnly: true, keywords: 'self' });
pu('pf_exists', 'Existe ?', 'self', 'boolean', 'Vrai si la cible existe (par exemple « premier Portail » ou « instance touchée par le rayon »).', { inputs: [target()] });
ex('pf_t_set_position', 'Placer (cible)', 'self', 'Place la cible (coin haut-gauche, en pixels).',
  { inputs: [target(), num('X', 'x', 0), num('Y', 'y', 0)] });
ex('pf_t_set_velocity', 'Vitesse (cible)', 'self', 'Règle la vitesse de la cible (pixels par seconde).',
  { inputs: [target(), num('VX', 'vx', 0), num('VY', 'vy', 0)] });
ex('pf_t_set_vel_angle', 'Vitesse par angle (cible)', 'self', 'Vitesse de la cible dans une direction. Angle en degrés : 0 = droite, 90 = bas, -90 = haut.',
  { inputs: [target(), num('ANGLE', 'angle', 0), num('SPEED', 'vitesse', 100)] });
ex('pf_t_orient', 'Orienter (cible)', 'self', 'Oriente la cible selon une normale (angle = atan2(ny, nx), en degrés) + un décalage. 0 = le sprite regarde à droite.',
  { inputs: [target(), num('NX', 'normale nx', 0), num('NY', 'normale ny', -1), num('OFFSET', 'décalage °', 0)] });
ex('pf_t_collide_map', 'Collision carte (cible)', 'self', 'La cible traverse la carte (collision coupée) ou la heurte à nouveau. Nécessite « collision avec la carte » sur l\'objet.',
  { inputs: [target()], fields: [fOn('collision', 'activée', 'coupée')] });
ex('pf_t_collide_objs', 'Collision objets (cible)', 'self', 'La cible ne bloque plus (ou bloque à nouveau) les autres objets en « collision ». Les chevauchements ne changent pas.',
  { inputs: [target()], fields: [fOn('collision', 'activée', 'coupée')] });
ex('pf_t_hitbox', 'Hitbox (cible)', 'self', 'Boîte de collision de la cible, relative à son image (pixels).',
  { inputs: [target(), num('X', 'x', 0), num('Y', 'y', 0), num('W', 'largeur', 16), num('H', 'hauteur', 16)] });
ex('pf_t_prop_set', 'Propriété (cible)', 'self', 'Fixe une propriété (self.props) de la cible.',
  { inputs: [target(), any('VALUE', 'valeur', 0)], fields: [txt('KEY', 'clé', 'cle')] });

// Entrée / souris ------------------------------------------------------------
pu('pf_key_down', 'Touche maintenue ?', 'input', 'boolean', 'Vrai tant que la touche est maintenue.', { fields: [fKey()], keywords: 'isDown clavier' });
pu('pf_key_just', 'Touche pressée ?', 'input', 'boolean', 'Vrai seulement l\'image où la touche est pressée.', { fields: [fKey()], keywords: 'justPressed clavier' });
pu('pf_mouse_pos', 'Position souris', 'mouse', 'number', 'Position de la souris : dans le monde (pixels de la carte) ou dans l\'écran du jeu.',
  { fields: [dd('PROP', 'valeur', [['x (monde)', 'mouseX'], ['y (monde)', 'mouseY'], ['x (écran)', 'mouseScreenX'], ['y (écran)', 'mouseScreenY']])] });
pu('pf_mouse_down', 'Bouton souris maintenu ?', 'mouse', 'boolean', 'Vrai tant que le bouton de la souris est maintenu.', { fields: [dd('BTN', 'bouton', MOUSE_BTNS)] });
pu('pf_mouse_just', 'Bouton souris pressé ?', 'mouse', 'boolean', 'Vrai seulement l\'image où le bouton est pressé.', { fields: [dd('BTN', 'bouton', MOUSE_BTNS)] });
pu('pf_mouse_delta', 'Déplacement souris (Delta)', 'mouse', 'number', 'Déplacement de la souris depuis la dernière image (utile pour la vue FPS).',
  { fields: [dd('AXIS', 'axe', [['horizontal (X)', 'x'], ['vertical (Y)', 'y']], 'x')], dims: ['2d', '3d'], keywords: 'souris delta mouse pointer fps' });
ex('pf_pointer_lock', 'Verrouiller le curseur', 'mouse', 'Verrouille le curseur de la souris pour le contrôle FPS subjectif.',
  { dims: ['2d', '3d'], keywords: 'souris pointer lock verrouiller fps' });

// Tuiles & rayons --------------------------------------------------------------
const layerField = () => fdyn('LAYER', 'calque', 'layer');
pu('pf_tile_info', 'Tuile touchée', 'tile', 'any', 'Information sur la tuile touchée (dans « Tuile solide touchée »). Le côté est celui de l\'objet qui touche.',
  { inputs: [pin('TILE', 'any', 'tuile', { implicit: 'tile' })], selfOnly: true, keywords: 'tile',
    fields: [dd('PROP', 'info', [['colonne (tx)', 'tx'], ['ligne (ty)', 'ty'], ['x (pixels)', 'x'], ['y (pixels)', 'y'],
      ['numéro (index)', 'index'], ['côté (up/down/left/right)', 'side'], ['calque', 'layer']])] });
pu('pf_get_tile', 'Numéro de tuile', 'tile', 'number', 'Numéro de la tuile (-1 si vide ou hors carte).', { inputs: [num('TX', 'colonne', 0), num('TY', 'ligne', 0)], fields: [layerField()] });
ex('pf_set_tile', 'Changer une tuile', 'tile', 'Change une tuile (-1 pour la supprimer). Les collisions suivent immédiatement.',
  { inputs: [num('TX', 'colonne', 0), num('TY', 'ligne', 0), num('INDEX', 'devient', -1)], fields: [layerField()] });
pu('pf_is_solid_at', 'Solide en (x, y) ?', 'tile', 'boolean', 'Vrai si le point (en pixels) est dans une tuile solide.', { inputs: [num('X', 'x', 0), num('Y', 'y', 0)] });
pu('pf_tile_size', 'Taille des tuiles', 'tile', 'number', 'Taille d\'une tuile en pixels.');
pu('pf_to_tile', 'Pixels → tuile', 'tile', 'number', 'Convertit une position en pixels en coordonnée de tuile.', { inputs: [num('PX', 'pixels', 0)] });
const rayIn = [num('X', 'x', 0), num('Y', 'y', 0), num('ANGLE', 'angle', 0), num('DIST', 'distance max', 600)];
const rayMode = () => dd('MODE', 'cible', RAY_MODES, '');
pu('pf_raycast', 'Rayon (résultat)', 'tile', 'any', 'Lance un rayon contre les tuiles solides (et, au choix, les objets) et renvoie le résultat. Mets-le dans une variable, puis lis-le avec « Champ du rayon ».',
  { inputs: rayIn, fields: [rayMode()], keywords: 'raycast' });
ex('pf_ray_cast', 'Lancer un rayon', 'tile', 'Lance un rayon contre les tuiles solides (et, au choix, les objets) et mémorise le résultat, à lire avec « Dernier rayon ».',
  { inputs: rayIn, fields: [rayMode()], keywords: 'raycast' });
ex('pf_ray_cast_mouse', 'Rayon vers la souris', 'tile', 'Lance un rayon depuis le centre de l\'objet vers la souris et mémorise le résultat.',
  { inputs: [num('DIST', 'distance max', 600)], fields: [rayMode()], selfOnly: true, keywords: 'raycast' });
pu('pf_ray_last', 'Dernier rayon', 'tile', 'any', 'Lit le résultat du dernier rayon lancé par « Lancer un rayon ». Sans impact : touché = faux.',
  { fields: [dd('FIELD', 'champ', RAY_FIELDS)], keywords: 'raycast' });
pu('pf_ray_get', 'Champ du rayon', 'tile', 'any', 'Lit un champ d\'un résultat de « Rayon (résultat) » mis dans une variable.',
  { inputs: [any('RAY', 'rayon')], fields: [dd('FIELD', 'champ', RAY_FIELDS)], keywords: 'raycast' });
pu('pf_side', 'Côté', 'tile', 'string', 'Un côté, à comparer avec « côté touché » ou « tuile touchée : côté ».', { fields: [fSide()] });

// Son ------------------------------------------------------------------------
ex('pf_play_sound', 'Jouer un son', 'sound', 'Joue un son du projet ou un preset (volume 0-1, pitch 1 = normal).',
  { inputs: [num('VOL', 'volume', 1), num('PITCH', 'pitch', 1)], fields: [fdyn('SOUND', 'son', 'sound')], keywords: 'sound audio' });
ex('pf_play_music', 'Jouer la musique', 'sound', 'Joue en boucle (relancer la même musique ne fait rien).', { fields: [fdyn('SOUND', 'son', 'sound')], keywords: 'music' });
ex('pf_stop_music', 'Arrêter la musique', 'sound', 'Arrête la musique.');
ex('pf_play_song', 'Jouer un morceau', 'sound', 'Lance la lecture d\'un morceau chiptune avec options de volume et fondu.',
  { inputs: [num('VOL', 'volume', 1), bool('LOOP', 'boucle', true), num('FADE_IN', 'fondu entrant (s)', 0)], fields: [fdyn('SONG', 'morceau', 'song')], keywords: 'song music chiptune' });
ex('pf_stop_song', 'Arrêter le morceau', 'sound', 'Arrête la lecture du morceau actuel avec option de fondu sortant.',
  { inputs: [num('FADE_OUT', 'fondu sortant (s)', 0)], keywords: 'stop song music' });
ex('pf_set_song_volume', 'Volume du morceau', 'sound', 'Modifie le volume du morceau en cours de lecture.',
  { inputs: [num('VOL', 'volume', 1)], keywords: 'volume song music' });

// Messages ---------------------------------------------------------------------
ex('pf_broadcast', 'Diffuser un message', 'msg', 'Envoie un message à tous les objets qui l\'écoutent. Les données sont facultatives.',
  { inputs: [any('DATA', 'données', undefined, { optional: true })], fields: [txt('NAME', 'message', 'porte')], keywords: 'broadcast envoyer' });
pu('pf_value_field', 'Champ d\'un ensemble', 'msg', 'any', 'Lit un champ d\'un ensemble de propriétés (données de message, résultat…). Vide si absent.',
  { inputs: [any('OBJ', 'ensemble')], fields: [txt('KEY', 'clé', 'cle')] });
pu('pf_dict', 'Ensemble de propriétés', 'msg', 'any', 'Ensemble de propriétés « clé = valeur ». À brancher sur « Créer … avec propriétés » ou « Diffuser un message ».',
  { dynamic: 'items', extra: { items: 2 }, keywords: 'dict objet clé valeur' });

// Jeu ------------------------------------------------------------------------
ex('pf_score_set', 'Fixer le score', 'game', 'Fixe le score.', { inputs: [num('VALUE', 'score', 0)] });
ex('pf_score_add', 'Ajouter au score', 'game', 'Ajoute au score.', { inputs: [num('VALUE', 'points', 1)] });
pu('pf_score_get', 'Score', 'game', 'number', 'Le score.');
ex('pf_gvar_set', 'Définir variable globale', 'game', 'Variable globale partagée entre les objets et les cartes.',
  { inputs: [any('VALUE', 'valeur', 0)], fields: [txt('NAME', 'nom', 'niveau')] });
pu('pf_gvar_get', 'Variable globale', 'game', 'any', 'Variable globale partagée entre les objets et les cartes.', { fields: [txt('NAME', 'nom', 'niveau')] });
ex('pf_spawn', 'Créer', 'game', 'Crée une nouvelle instance.', { inputs: [num('X', 'x', 0), num('Y', 'y', 0)], fields: [fObj()], keywords: 'spawn instancier' });
ex('pf_spawn_props', 'Créer avec propriétés', 'game', 'Crée une instance avec des propriétés, lisibles dès « Quand créé » via « Mes propriétés ».',
  { inputs: [num('X', 'x', 0), num('Y', 'y', 0), any('PROPS', 'propriétés', undefined, { optional: true })], fields: [fObj()], keywords: 'spawn instancier' });
pu('pf_spawn_val', 'Créer (instance)', 'game', 'object', 'Crée une instance (avec propriétés facultatives) et renvoie l\'instance : mets-la dans une variable.',
  { inputs: [num('X', 'x', 0), num('Y', 'y', 0), any('PROPS', 'propriétés', undefined, { optional: true })], fields: [fObj()], keywords: 'spawn instancier' });
ex('pf_destroy_self', 'Me détruire', 'game', 'Détruit cet objet.', { selfOnly: true, keywords: 'destroy supprimer' });
ex('pf_destroy_other', 'Détruire l\'autre', 'game', 'Détruit l\'objet touché (dans « Collision » / « Chevauche »).',
  { inputs: [pin('OTHER', 'object', 'l\'autre', { implicit: 'other' })], selfOnly: true, keywords: 'destroy supprimer' });
ex('pf_goto_map', 'Aller à la carte', 'game', 'Change de carte.', { fields: [fdyn('MAP', 'carte', 'map')], keywords: 'map niveau' });
ex('pf_restart', 'Recommencer la carte', 'game', 'Recharge la carte courante.', { keywords: 'restart rejouer' });
pu('pf_current_map', 'Carte courante', 'game', 'string', 'Nom de la carte courante.');
ex('pf_pause', 'Mettre en pause', 'game', 'Gèle la physique, les « à chaque image », les timers, les attentes et les animations. Les touches, clics et messages restent actifs.');
ex('pf_resume', 'Reprendre le jeu', 'game', 'Reprend le jeu après une pause.');
pu('pf_is_paused', 'En pause ?', 'game', 'boolean', 'Vrai si le jeu est en pause.');
ex('pf_particles', 'Particules', 'game', 'Petites particules carrées à une position du monde.',
  { inputs: [num('X', 'x', 0), num('Y', 'y', 0), col('COLOR', 'couleur', '#ffcd75'), num('COUNT', 'nombre', 12), num('SPEED', 'vitesse', 80), num('MS', 'durée (ms)', 500)] });
ex('pf_save', 'Sauvegarder', 'game', 'Sauvegarde une valeur dans le navigateur (propre à ce jeu).',
  { inputs: [any('VALUE', 'valeur', 0)], fields: [txt('KEY', 'clé', 'record')], keywords: 'save stockage' });
pu('pf_load', 'Charger', 'game', 'any', 'Relit une valeur sauvegardée (ou la valeur par défaut).',
  { inputs: [any('DEFAULT', 'défaut', 0)], fields: [txt('KEY', 'clé', 'record')], keywords: 'load stockage' });
pu('pf_random', 'Aléatoire entre', 'game', 'number', 'Entier aléatoire (bornes incluses).', { inputs: [num('MIN', 'min', 1), num('MAX', 'max', 6)], keywords: 'random hasard' });
pu('pf_game_info', 'Dimensions', 'game', 'number', 'Dimensions de l\'écran et de la carte.',
  { fields: [dd('PROP', 'valeur', [['largeur écran', 'width'], ['hauteur écran', 'height'], ['largeur carte', 'mapWidth'], ['hauteur carte', 'mapHeight']])] });
ex('pf_log', 'Écrire dans la console', 'game', 'Affiche dans la console du jeu.', { inputs: [any('VALUE', 'valeur', 'Bonjour')], keywords: 'log print debug' });
ex('pf_js', 'JavaScript', 'game', 'Exécute une instruction JavaScript.', { fields: [txt('CODE', 'code', '/* code */', { multiline: true })], keywords: 'js code script' });
pu('pf_js_val', 'JavaScript (valeur)', 'game', 'any', 'Évalue une expression JavaScript.', { fields: [txt('EXPR', 'expression', '/* expression */', { multiline: true })], keywords: 'js code script' });

// Caméra & texte -----------------------------------------------------------------
ex('pf_set_text', 'Afficher le texte', 'cam', 'Texte fixe à l\'écran (créé ou mis à jour par identifiant).',
  { inputs: [any('TEXT', 'texte', 'Score: '), num('X', 'x', 4), num('Y', 'y', 4)], fields: [txt('ID', 'identifiant', 'score')], keywords: 'text hud' });
ex('pf_set_text_opts', 'Afficher le texte (options)', 'cam', 'Texte à l\'écran avec couleur, taille (1 = normale) et alignement (avec centré / droite, x est le centre / le bord droit).',
  { inputs: [any('TEXT', 'texte', 'Score: '), num('X', 'x', 4), num('Y', 'y', 4), col('COLOR', 'couleur', '#ffffff'), num('SIZE', 'taille', 1)],
    fields: [txt('ID', 'identifiant', 'score'), dd('ALIGN', 'alignement', [['gauche', 'left'], ['centré', 'center'], ['droite', 'right']])], keywords: 'text hud' });
ex('pf_remove_text', 'Effacer le texte', 'cam', 'Retire un texte affiché.', { fields: [txt('ID', 'identifiant', 'score')] });
ex('pf_cam_follow_self', 'Caméra : me suivre', 'cam', 'La caméra suit cet objet.', { selfOnly: true, keywords: 'camera follow' });
ex('pf_cam_follow', 'Caméra : suivre', 'cam', 'La caméra suit l\'objet donné.', { inputs: [target('objet')], keywords: 'camera follow' });
ex('pf_cam_shake', 'Caméra : secouer', 'cam', 'Secoue la caméra.', { inputs: [num('MS', 'durée (ms)', 200), num('POWER', 'intensité', 0.01)], keywords: 'camera shake' });
ex('pf_cam_flash', 'Caméra : flash', 'cam', 'Flash blanc.', { inputs: [num('MS', 'durée (ms)', 200)], keywords: 'camera flash' });
ex('pf_cam_zoom', 'Caméra : zoom', 'cam', 'Zoom de la caméra (1 = normal).', { inputs: [num('Z', 'zoom', 1)], keywords: 'camera zoom' });
ex('pf_cam_deadzone', 'Caméra : zone morte', 'cam', 'Zone morte au centre de l\'écran (px) : la caméra ne bouge que si la cible en sort.',
  { inputs: [num('W', 'largeur', 40), num('H', 'hauteur', 30)], keywords: 'camera deadzone' });
ex('pf_cam_offset', 'Caméra : décalage', 'cam', 'Décalage de la caméra par rapport à la cible suivie (px).', { inputs: [num('X', 'x', 0), num('Y', 'y', 0)], keywords: 'camera offset' });
pu('pf_cam_pos', 'Position caméra', 'cam', 'number', 'Coin haut-gauche de la vue dans le monde.', { fields: [dd('PROP', 'valeur', [['x', 'x'], ['y', 'y']])], keywords: 'camera' });
ex('pf_camera_mode_3d', 'Mode caméra 3D', 'cam', 'Définit le type de caméra 3D active (3e personne, 1re personne / FPS, dessus, isométrique, 2.5D).',
  { fields: [dd('MODE', 'mode', CAM_3D_MODES, 'third-person')], dims: ['3d'], keywords: '3d camera mode fps vue' });
ex('pf_camera_follow_3d', 'Suivre avec caméra 3D', 'cam', 'Fait suivre cet objet par la caméra 3D avec distance et hauteur.',
  { inputs: [num('DIST', 'distance', 6), num('HEIGHT', 'hauteur', 3)], selfOnly: true, dims: ['3d'], keywords: '3d camera follow suivre vue' });

// Logique ----------------------------------------------------------------------
pu('logic_compare', 'Comparer', 'logic', 'boolean', 'Compare deux valeurs.',
  { inputs: [any('A', 'A', 0), any('B', 'B', 0)],
    fields: [dd('OP', 'opérateur', [['=', 'EQ'], ['≠', 'NEQ'], ['<', 'LT'], ['≤', 'LTE'], ['>', 'GT'], ['≥', 'GTE']])], keywords: 'égal compare' });
pu('logic_operation', 'Et / Ou', 'logic', 'boolean', 'Combine deux conditions.',
  { inputs: [bool('A', 'A', false), bool('B', 'B', false)], fields: [dd('OP', 'opérateur', [['et', 'AND'], ['ou', 'OR']])], keywords: 'and or' });
pu('logic_negate', 'Non', 'logic', 'boolean', 'Inverse une condition.', { inputs: [bool('BOOL', '', true)], keywords: 'not' });
pu('logic_boolean', 'Booléen', 'logic', 'boolean', 'Vrai ou faux.', { fields: [dd('BOOL', 'valeur', BOOL_VALUES, 'TRUE')], keywords: 'true false' });
pu('logic_null', 'Rien (null)', 'logic', 'any', 'La valeur vide.', { keywords: 'null vide' });
pu('logic_ternary', 'Si ? alors : sinon', 'logic', 'any', 'Renvoie « alors » si la condition est vraie, sinon « sinon ».',
  { inputs: [bool('IF', 'si', false), any('THEN', 'alors'), any('ELSE', 'sinon')], keywords: 'ternaire if' });

// Maths ------------------------------------------------------------------------
pu('math_number', 'Nombre', 'math', 'number', 'Un nombre.', { fields: [fnum('NUM', 'valeur', 0)] });
pu('math_arithmetic', 'Opération', 'math', 'number', 'Addition, soustraction, multiplication, division, puissance.',
  { inputs: [num('A', 'A', 1), num('B', 'B', 1)],
    fields: [dd('OP', 'opérateur', [['+', 'ADD'], ['−', 'MINUS'], ['×', 'MULTIPLY'], ['÷', 'DIVIDE'], ['^', 'POWER']])], keywords: 'add plus moins fois diviser' });
pu('math_single', 'Fonction', 'math', 'number', 'Racine carrée, valeur absolue, opposé, logarithme, exponentielle.',
  { inputs: [num('NUM', '', 9)],
    fields: [dd('OP', 'fonction', [['racine carrée', 'ROOT'], ['valeur absolue', 'ABS'], ['opposé', 'NEG'], ['ln', 'LN'], ['log10', 'LOG10'], ['e^', 'EXP'], ['10^', 'POW10']])], keywords: 'sqrt abs' });
pu('math_trig', 'Trigonométrie', 'math', 'number', 'Sinus, cosinus, tangente (en degrés) et leurs inverses.',
  { inputs: [num('NUM', '', 45)],
    fields: [dd('OP', 'fonction', [['sin', 'SIN'], ['cos', 'COS'], ['tan', 'TAN'], ['asin', 'ASIN'], ['acos', 'ACOS'], ['atan', 'ATAN']])], keywords: 'sin cos tan' });
pu('math_constant', 'Constante', 'math', 'number', 'π, e, nombre d\'or, √2, √½, ∞.',
  { fields: [dd('CONSTANT', 'constante', [['π', 'PI'], ['e', 'E'], ['φ', 'GOLDEN_RATIO'], ['√2', 'SQRT2'], ['√½', 'SQRT1_2'], ['∞', 'INFINITY']])], keywords: 'pi' });
pu('math_modulo', 'Reste de la division', 'math', 'number', 'Reste de la division euclidienne.', { inputs: [num('DIVIDEND', 'dividende', 64), num('DIVISOR', 'diviseur', 10)], keywords: 'modulo %' });
pu('math_round', 'Arrondir', 'math', 'number', 'Arrondi à l\'entier le plus proche, au-dessus ou en dessous.',
  { inputs: [num('NUM', '', 3.1)], fields: [dd('OP', 'sens', [['arrondir', 'ROUND'], ['au-dessus', 'ROUNDUP'], ['en dessous', 'ROUNDDOWN']])], keywords: 'round floor ceil' });
pu('math_random_int', 'Entier aléatoire', 'math', 'number', 'Entier aléatoire entre deux bornes (incluses).', { inputs: [num('FROM', 'de', 1), num('TO', 'à', 100)], keywords: 'random hasard' });
pu('math_random_float', 'Décimal aléatoire', 'math', 'number', 'Nombre aléatoire entre 0 (inclus) et 1 (exclu).', { keywords: 'random hasard' });
pu('math_constrain', 'Limiter', 'math', 'number', 'Limite une valeur entre un minimum et un maximum.',
  { inputs: [num('VALUE', 'valeur', 50), num('LOW', 'min', 1), num('HIGH', 'max', 100)], keywords: 'clamp constrain' });
pu('math_number_property', 'Propriété du nombre', 'math', 'boolean', 'Teste si un nombre est pair, impair, premier, entier, positif, négatif ou divisible.',
  { inputs: [num('NUMBER_TO_CHECK', 'nombre', 0), num('DIVISOR', 'diviseur', 1)], dynamic: 'divisor', keywords: 'pair impair premier',
    fields: [dd('PROPERTY', 'est', [['pair', 'EVEN'], ['impair', 'ODD'], ['premier', 'PRIME'], ['entier', 'WHOLE'], ['positif', 'POSITIVE'], ['négatif', 'NEGATIVE'], ['divisible par', 'DIVISIBLE_BY']])] });

// Texte -----------------------------------------------------------------------
pu('text', 'Texte', 'text', 'string', 'Un texte.', { fields: [txt('TEXT', 'texte', '')] });
pu('text_join', 'Assembler du texte', 'text', 'string', 'Colle plusieurs valeurs bout à bout.', { dynamic: 'items', extra: { items: 2 }, keywords: 'join concat' });
pu('text_length', 'Longueur du texte', 'text', 'number', 'Nombre de caractères.', { inputs: [str('VALUE', '', 'abc')], keywords: 'length' });
pu('text_isEmpty', 'Texte vide ?', 'text', 'boolean', 'Vrai si le texte est vide.', { inputs: [str('VALUE', '', '')], keywords: 'empty' });

// Listes ----------------------------------------------------------------------
const WHERE = [['n° depuis le début', 'FROM_START'], ['n° depuis la fin', 'FROM_END'], ['premier', 'FIRST'], ['dernier', 'LAST'], ['aléatoire', 'RANDOM']];
pu('lists_create_empty', 'Liste vide', 'list', 'list', 'Une liste sans élément.', { keywords: 'array' });
pu('lists_create_with', 'Créer une liste', 'list', 'list', 'Liste avec les éléments donnés.', { dynamic: 'items', extra: { items: 3 }, keywords: 'array' });
pu('lists_length', 'Longueur de la liste', 'list', 'number', 'Nombre d\'éléments.', { inputs: [lst('VALUE', 'liste')], keywords: 'length' });
pu('lists_isEmpty', 'Liste vide ?', 'list', 'boolean', 'Vrai si la liste est vide.', { inputs: [lst('VALUE', 'liste')], keywords: 'empty' });
pu('lists_getIndex', 'Élément de la liste', 'list', 'any', 'Lit un élément (le numéro 1 est le premier), éventuellement en le retirant.',
  { inputs: [lst('VALUE', 'liste'), num('AT', 'n°', 1)], dynamic: 'at', keywords: 'get index',
    fields: [dd('MODE', 'mode', [['lire', 'GET'], ['lire et retirer', 'GET_REMOVE']]), dd('WHERE', 'lequel', WHERE)] });
ex('lists_removeIndex', 'Retirer de la liste', 'list', 'Retire un élément de la liste (le numéro 1 est le premier).',
  { inputs: [lst('VALUE', 'liste'), num('AT', 'n°', 1)], dynamic: 'at', keywords: 'remove splice',
    fields: [dd('WHERE', 'lequel', WHERE)] });
ex('lists_setIndex', 'Modifier la liste', 'list', 'Remplace un élément de la liste ou en insère un (le numéro 1 est le premier).',
  { inputs: [lst('LIST', 'liste'), num('AT', 'n°', 1), any('TO', 'valeur', 0)], dynamic: 'at', keywords: 'set insert push',
    fields: [dd('MODE', 'mode', [['remplacer', 'SET'], ['insérer', 'INSERT']]), dd('WHERE', 'lequel', WHERE)] });

// Nœuds interdits dans le script global (self = null)
// (liste reprise de SELF_BLOCKS dans src/graph/test/legacy-blocks.js : le drapeau `selfOnly` est posé ci-dessus)

// ---------------------------------------------------------------- API

export function getSpec(type) {
  return SPECS.get(type) || null;
}

export function listSpecs() {
  return [...SPECS.values()];
}

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

/** Extra par défaut d'un type (broches dynamiques). */
export function defaultExtra(type) {
  const e = SPECS.get(type)?.extra;
  return e ? JSON.parse(JSON.stringify(e)) : {};
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Nombre de broches dynamiques lues dans node.extra (borné). */
function extraCount(node, key, dflt) {
  const v = node.extra?.[key];
  return v == null ? dflt : clamp(Math.floor(Number(v)) || 0, 0, 32);
}

export const paramList = (node) => (Array.isArray(node.extra?.params) ? node.extra.params.map(String) : []);

/**
 * Broches réelles d'un nœud : spec + broches dynamiques (extra / fields).
 * → { inputs, outputs, fields } (listes neuves, modifiables sans effet sur le catalogue).
 */
export function resolvePins(node, graph) {
  void graph;
  const spec = SPECS.get(node.type);
  if (!spec) return { inputs: [], outputs: [], fields: [] };
  let inputs = spec.inputs.map((p) => ({ ...p }));
  let outputs = spec.outputs.map((p) => ({ ...p }));
  let fields = spec.fields.map((f) => ({ ...f }));
  switch (spec.dynamic) {
    case 'items': {
      const n = extraCount(node, 'items', spec.extra?.items ?? 2);
      if (node.type === 'pf_dict') {
        inputs = []; fields = [];
        for (let i = 0; i < n; i++) {
          fields.push({ name: 'K' + i, label: 'clé ' + (i + 1), kind: 'text', default: 'cle' + (i + 1) });
          inputs.push(pin('V' + i, 'any', String(node.fields?.['K' + i] ?? 'cle' + (i + 1))));
        }
      } else {
        inputs = [];
        for (let i = 0; i < n; i++) inputs.push(node.type === 'text_join' ? any('ADD' + i, String(i + 1), '') : any('ADD' + i, String(i + 1)));
      }
      break;
    }
    case 'params': {
      outputs = [THEN, ...paramList(node).map((p, i) => pin('ARG' + i, 'any', p))];
      break;
    }
    case 'call': {
      const params = paramList(node);
      inputs = [...(spec.kind === 'exec' ? [EXEC_IN] : []), ...params.map((p, i) => any('ARG' + i, p))];
      break;
    }
    case 'outs': {
      const n = Math.max(1, extraCount(node, 'outs', 2));
      outputs = [];
      for (let i = 0; i < n; i++) outputs.push(execOut('then' + i, String(i)));
      break;
    }
    case 'at': {
      const w = node.fields?.WHERE ?? 'FROM_START';
      if (w !== 'FROM_START' && w !== 'FROM_END') inputs = inputs.filter((p) => p.name !== 'AT');
      break;
    }
    case 'divisor': {
      if ((node.fields?.PROPERTY ?? 'EVEN') !== 'DIVISIBLE_BY') inputs = inputs.filter((p) => p.name !== 'DIVISOR');
      break;
    }
    default:
  }
  return { inputs, outputs, fields };
}

/** Deux broches peuvent-elles être reliées ? (de la sortie `fromType` vers l'entrée `toType`) */
export function isCompatible(fromType, toType) {
  if (fromType === 'exec' || toType === 'exec') return fromType === toType;
  if (fromType === toType || fromType === 'any' || toType === 'any') return true;
  if (toType === 'string') return fromType === 'number' || fromType === 'boolean' || fromType === 'color';
  if (fromType === 'string') return toType === 'color';
  return false;
}

/**
 * Options d'une liste déroulante : [[libellé, valeur], ...].
 * field = champ de la spec ({ kind, options? }) ; ctx = { project, objectId, graph?, value? } (value = valeur actuelle, conservée si absente).
 */
export function fieldOptions(field, ctx = {}) {
  const project = ctx.project || null;
  const keep = (list) => {
    const out = list.slice();
    if (ctx.value != null && ctx.value !== '' && !out.includes(ctx.value)) out.push(ctx.value);
    return out;
  };
  const dyn = (names) => {
    const list = keep(names);
    return list.length ? list.map((n) => [n, n]) : [['(aucun)', '']];
  };
  switch (field.kind) {
    case 'dropdown': return field.options || [];
    case 'key': return KEYS.map((k) => [k, k]);
    case 'object': return dyn((project?.objects || []).map((o) => o.name));
    case 'map': return dyn((project?.maps || []).map((m) => m.name));
    case 'anim': {
      const obj = (project?.objects || []).find((o) => o.id === ctx.objectId);
      const spr = (project?.sprites || []).find((s) => s.id === obj?.spriteId);
      return dyn((spr?.animations || []).map((a) => a.name));
    }
    case 'sound': {
      const out = (project?.sounds || []).map((x) => x.name).filter(Boolean);
      for (const p of SOUND_PRESETS) if (!out.includes(p)) out.push(p);
      return dyn(out);
    }
    case 'song': {
      const out = (project?.songs || []).map((x) => x.name).filter(Boolean);
      return dyn(out);
    }
    case 'layer': {
      const names = [];
      for (const m of project?.maps || []) for (const l of m.layers || []) if (!names.includes(l.name)) names.push(l.name);
      const list = [['(premier calque solide)', ''], ['(calque de la tuile touchée)', '@tile']];
      for (const n of keep(names)) if (n !== '@tile') list.push([n, n]);
      return list;
    }
    case 'variable': {
      const names = (ctx.graph?.variables || []).map((v) => v.name).filter(Boolean);
      return dyn(names);
    }
    default: return [];
  }
}

/** Nœud neuf : id unique dans le graphe, fields / values / extra par défaut. */
export function createNode(type, x = 0, y = 0, graph = null) {
  const spec = SPECS.get(type);
  if (!spec) throw new Error('Type de nœud inconnu : ' + type);
  const used = new Set((graph?.nodes || []).map((n) => n.id));
  let k = 1;
  for (const id of used) {
    const m = /^n(\d+)$/.exec(String(id));
    if (m) k = Math.max(k, Number(m[1]) + 1);
  }
  while (used.has('n' + k)) k++;
  const fields = {};
  for (const f of spec.fields) fields[f.name] = f.default ?? '';
  const values = {};
  for (const p of spec.inputs) if (p.type !== 'exec' && p.default !== undefined) values[p.name] = p.default;
  return { id: 'n' + k, type, x, y, fields, values, extra: defaultExtra(type) };
}
