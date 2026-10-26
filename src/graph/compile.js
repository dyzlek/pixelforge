// Compilation d'un graphe Blueprint en JavaScript (docs/BLUEPRINTS.md).
// Le code produit est équivalent à celui que générait Blockly (mêmes appels d'API, mêmes gardes, mêmes noms de boucle) :
// les priorités d'opérateurs et l'allocation des noms reprennent celles de blockly/javascript.
import { getSpec, resolvePins, paramList } from './nodes.js';

// Priorités d'opérateurs (mêmes valeurs que Blockly.JavaScript Order)
export const Order = {
  ATOMIC: 0, NEW: 1.1, MEMBER: 1.2, FUNCTION_CALL: 2, INCREMENT: 3, DECREMENT: 3, BITWISE_NOT: 4.1, UNARY_PLUS: 4.2,
  UNARY_NEGATION: 4.3, LOGICAL_NOT: 4.4, TYPEOF: 4.5, VOID: 4.6, DELETE: 4.7, AWAIT: 4.8, EXPONENTIATION: 5.0,
  MULTIPLICATION: 5.1, DIVISION: 5.2, MODULUS: 5.3, SUBTRACTION: 6.1, ADDITION: 6.2, BITWISE_SHIFT: 7, RELATIONAL: 8,
  IN: 8, INSTANCEOF: 8, EQUALITY: 9, BITWISE_AND: 10, BITWISE_XOR: 11, BITWISE_OR: 12, LOGICAL_AND: 13, LOGICAL_OR: 14,
  CONDITIONAL: 15, ASSIGNMENT: 16, YIELD: 17, COMMA: 18, NONE: 99,
};
const O = Order;

// Parenthèses inutiles : (outer, inner) qui s'associent sans changer le sens
const OVERRIDES = [
  [O.FUNCTION_CALL, O.MEMBER], [O.FUNCTION_CALL, O.FUNCTION_CALL], [O.MEMBER, O.MEMBER], [O.MEMBER, O.FUNCTION_CALL],
  [O.LOGICAL_NOT, O.LOGICAL_NOT], [O.MULTIPLICATION, O.MULTIPLICATION], [O.ADDITION, O.ADDITION],
  [O.LOGICAL_AND, O.LOGICAL_AND], [O.LOGICAL_OR, O.LOGICAL_OR],
];

// Noms interdits pour les variables / fonctions du script (mots réservés JS, globales courantes, API du moteur)
const RESERVED = ('break,case,catch,class,const,continue,debugger,default,delete,do,else,export,extends,finally,for,function,if,import,in,'
  + 'instanceof,new,return,super,switch,this,throw,try,typeof,var,void,while,with,yield,enum,implements,interface,let,package,private,'
  + 'protected,public,static,await,null,true,false,arguments,undefined,NaN,Infinity,eval,'
  + 'Array,Boolean,Date,Error,Function,JSON,Map,Math,Number,Object,Promise,RegExp,Set,String,Symbol,'
  + 'parseInt,parseFloat,isNaN,isFinite,console,window,document,globalThis,localStorage,setTimeout,setInterval,clearTimeout,clearInterval,'
  + 'requestAnimationFrame,Phaser,self,game,input,on,dt,other,tile,data,_pfRay').split(',');

const INDENT = '  ';

// ---------------------------------------------------------------- noms (comme Blockly.Names)

function safeName(name) {
  if (!name) return 'unnamed';
  let s = encodeURI(String(name).replace(/ /g, '_')).replace(/[^\w]/g, '_');
  if ('0123456789'.includes(s[0])) s = 'my_' + s;
  return s;
}

class Names {
  constructor() {
    this.reserved = new Set(RESERVED);
    this.db = { var: new Map(), proc: new Map() };
    this.used = new Set();
  }

  /** Nom distinct (jamais déjà attribué) : count, count2, count3… */
  distinct(name) {
    const safe = safeName(name);
    let i = '';
    while (this.used.has(safe + i) || this.reserved.has(safe + i)) i = i ? i + 1 : 2;
    this.used.add(safe + i);
    return safe + i;
  }

  /** Nom stable d'une variable ('var') ou d'une fonction ('proc') du script. */
  get(name, type) {
    const key = String(name).toLowerCase();
    const db = this.db[type];
    if (!db.has(key)) db.set(key, this.distinct(name));
    return db.get(key);
  }
}

// ---------------------------------------------------------------- code

const isNumber = (s) => /^\s*-?\d+(\.\d+)?([eE][-+]?\d+)?\s*$/.test(s);
const isIdent = (s) => /^[A-Za-z_$][\w$]*$/.test(s);

/** Chaîne JS entre apostrophes (échappe \, ', retours à la ligne et séparateurs Unicode de ligne). */
const ESC = { '\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r', [String.fromCharCode(0x2028)]: '\\u2028', [String.fromCharCode(0x2029)]: '\\u2029' };
const ESC_RE = new RegExp(`[${Object.keys(ESC).map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}]`, 'g');
export function quote(s) {
  return "'" + String(s ?? '').replace(ESC_RE, (ch) => ESC[ch]) + "'";
}
const q = quote;

// Indente un bloc d'instructions (comme prefixLines de Blockly : la dernière fin de ligne n'est pas suivie d'espaces)
const indent = (code) => (code ? INDENT + code.replace(/(?!\n$)\n/g, '\n' + INDENT) : code);

/** Ajoute des parenthèses si la priorité de l'expression est plus faible que celle attendue (comme Blockly.valueToCode). */
function paren([code, inner], outer) {
  const oc = Math.floor(outer);
  const ic = Math.floor(inner);
  if (oc > ic) return code;
  if (oc === ic && (oc === 0 || oc === 99)) return code;
  for (const [a, b] of OVERRIDES) if (a === outer && b === inner) return code;
  return `(${code})`;
}

const TYPE_FALLBACK = { number: '0', string: "''", boolean: 'false', color: "'#ffffff'" };

/** Littéral JS d'une valeur de broche → [code, priorité]. */
function literal(v, type) {
  switch (type) {
    case 'number': {
      let n = Number(v);
      if (Number.isNaN(n)) n = 0;
      return [String(n), n >= 0 ? O.ATOMIC : O.UNARY_NEGATION];
    }
    case 'boolean': return [v === true || v === 'true' || v === 'TRUE' ? 'true' : 'false', O.ATOMIC];
    case 'string': case 'color': return [q(v), O.ATOMIC];
    default:
      if (typeof v === 'number') return literal(v, 'number');
      if (typeof v === 'boolean') return [String(v), O.ATOMIC];
      if (typeof v === 'string') return [q(v), O.ATOMIC];
      if (v == null) return ['null', O.ATOMIC];
      return [JSON.stringify(v), O.ATOMIC];
  }
}

// Fonctions utilitaires que Blockly ajoutait en tête du code (texte identique)
const HELPERS = {
  mathRandomInt: [
    'function $(a, b) {', '  if (a > b) {', '    // Swap a and b to ensure a is smaller.', '    var c = a;', '    a = b;', '    b = c;', '  }',
    '  return Math.floor(Math.random() * (b - a + 1) + a);', '}',
  ],
  mathIsPrime: [
    'function $(n) {', '  // https://en.wikipedia.org/wiki/Primality_test#Naive_methods', '  if (n == 2 || n == 3) {', '    return true;', '  }',
    '  // False if n is NaN, negative, is 1, or not whole.', '  // And false if n is divisible by 2 or 3.',
    '  if (isNaN(n) || n <= 1 || n % 1 !== 0 || n % 2 === 0 || n % 3 === 0) {', '    return false;', '  }',
    '  // Check all the numbers of form 6k +/- 1, up to sqrt(n).', '  for (var x = 6; x <= Math.sqrt(n) + 1; x += 6) {',
    '    if (n % (x - 1) === 0 || n % (x + 1) === 0) {', '      return false;', '    }', '  }', '  return true;', '}',
  ],
  listsGetRandomItem: [
    'function $(list, remove) {', '  var x = Math.floor(Math.random() * list.length);', '  if (remove) {', '    return list.splice(x, 1)[0];',
    '  } else {', '    return list[x];', '  }', '}',
  ],
};

// Événements : [arguments de on(...) après le nom, paramètre du callback]
const EVENT_HEAD = {
  pf_on_create: () => [q('create'), ''],
  pf_on_update: () => [q('update'), 'dt'],
  pf_on_collide: (c) => [`${q('collide')}, ${q(c.f('OBJ'))}`, 'other'],
  pf_on_overlap: (c) => [`${q('overlap')}, ${q(c.f('OBJ'))}`, 'other'],
  pf_on_overlap_start: (c) => [`${q('overlapStart')}, ${q(c.f('OBJ'))}`, 'other'],
  pf_on_overlap_end: (c) => [`${q('overlapEnd')}, ${q(c.f('OBJ'))}`, 'other'],
  pf_on_key: (c) => [`${q('keydown')}, ${q(c.f('KEY'))}`, ''],
  pf_on_timer: (c) => [`${q('timer')}, ${Number(c.f('MS')) || 1000}`, ''],
  pf_on_destroy: () => [q('destroy'), ''],
  pf_on_hit_tile: () => [q('hitTile'), 'tile'],
  pf_on_click: () => [q('click'), ''],
  pf_on_mousedown: (c) => [`${q('mousedown')}, ${q(c.f('BTN'))}`, ''],
  pf_on_message: (c) => [`${q('message')}, ${q(c.f('NAME'))}`, 'data'],
  pf_on_beat: () => [q('beat'), 'beat'],
};
const COLLIDE_EVENTS = ['pf_on_collide', 'pf_on_overlap', 'pf_on_overlap_start', 'pf_on_overlap_end'];

// ---------------------------------------------------------------- générateurs de nœuds
// GEN[type](c) → instructions (finissent par \n) ; PURE[type](c) → [code, priorité]. c : voir Compiler.ctxFor.

const GEN = {};
const PURE = {};
const F = O.FUNCTION_CALL;

// Cible évaluée une seule fois, sans effet si elle est vide
const onTarget = (c, call) => `{ const _t = ${c.v('TARGET', O.NONE, 'null')}; if (_t) ${call}; }\n`;

// Calque optionnel : '' = premier solide (argument omis), '@tile' = calque de la tuile touchée
function layerArg(c) {
  const l = c.f('LAYER');
  if (l === '@tile') return c.cur?.type === 'pf_on_hit_tile' ? ', tile.layer' : '';
  return l ? `, ${q(l)}` : '';
}
const RAY_OPTS = { '': '', objs: ', { objects: true, ignore: self }', all: ', { objects: true }' };
const rayOpts = (c) => RAY_OPTS[c.f('MODE') || ''] || '';
const rayCall = (c) => `game.raycast(${c.v('X')}, ${c.v('Y')}, ${c.v('ANGLE')}, ${c.v('DIST', O.NONE, '600')}${rayOpts(c)})`;
const RAY_DEFAULT = { hit: 'false', side: 'null', layer: 'null', instance: 'null', objectName: 'null' };
const rayField = (f, src) => `((_r) => (_r ? _r.${f} : ${RAY_DEFAULT[f] ?? '0'}))(${src})`;
const spawnCall = (c) => {
  const p = c.o('PROPS');
  return `game.spawn(${q(c.f('OBJ'))}, ${c.v('X')}, ${c.v('Y')}${p ? ', ' + p : ''})`;
};

// -- Flux
GEN.flow_branch = (c) => c.genIf();
GEN.flow_sequence = (c) => {
  let code = '';
  const n = Math.max(1, Number(c.n.extra?.outs) || 2);
  for (let i = 0; i < n; i++) code += c.chain('then' + i);
  return code;
};
GEN.flow_while = (c) => {
  const cond = c.v('COND', O.NONE, 'false');
  return `while (${cond}) {\n${c.body('body')}}\n`;
};
GEN.flow_repeat = (c) => {
  const repeats = c.v('TIMES', O.ASSIGNMENT, '0');
  const branch = c.body('body');
  let code = '';
  const loopVar = c.names.distinct('count');
  let endVar = repeats;
  if (!/^\w+$/.test(repeats) && !isNumber(repeats)) {
    endVar = c.names.distinct('repeat_end');
    code += `var ${endVar} = ${repeats};\n`;
  }
  return code + `for (var ${loopVar} = 0; ${loopVar} < ${endVar}; ${loopVar}++) {\n${branch}}\n`;
};
GEN.flow_for = (c) => {
  const v0 = c.loopVar();
  const from = c.v('FROM', O.ASSIGNMENT, '0');
  const to = c.v('TO', O.ASSIGNMENT, '0');
  const by = c.v('BY', O.ASSIGNMENT, '1');
  const branch = c.body('body');
  if (isNumber(from) && isNumber(to) && isNumber(by)) {
    const up = Number(from) <= Number(to);
    let code = `for (${v0} = ${from}; ${v0}${up ? ' <= ' : ' >= '}${to}; ${v0}`;
    const step = Math.abs(Number(by));
    if (step === 1) code += up ? '++' : '--';
    else code += (up ? ' += ' : ' -= ') + step;
    return code + `) {\n${branch}}\n`;
  }
  let code = '';
  let startVar = from;
  if (!/^\w+$/.test(from) && !isNumber(from)) {
    startVar = c.names.distinct(v0 + '_start');
    code += `var ${startVar} = ${from};\n`;
  }
  let endVar = to;
  if (!/^\w+$/.test(to) && !isNumber(to)) {
    endVar = c.names.distinct(v0 + '_end');
    code += `var ${endVar} = ${to};\n`;
  }
  const incVar = c.names.distinct(v0 + '_inc');
  code += `var ${incVar} = ${isNumber(by) ? Math.abs(Number(by)) : `Math.abs(${by})`};\n`;
  code += `if (${startVar} > ${endVar}) {\n${INDENT}${incVar} = -${incVar};\n}\n`;
  return code + `for (${v0} = ${startVar}; ${incVar} >= 0 ? ${v0} <= ${endVar} : ${v0} >= ${endVar}; ${v0} += ${incVar}) {\n${branch}}\n`;
};
GEN.flow_for_each = (c) => {
  const v0 = c.loopVar();
  const list = c.v('LIST', O.ASSIGNMENT, '[]');
  let branch = c.body('body');
  let code = '';
  let listVar = list;
  if (!/^\w+$/.test(list)) {
    listVar = c.names.distinct(v0 + '_list');
    code += `var ${listVar} = ${list};\n`;
  }
  const indexVar = c.names.distinct(v0 + '_index');
  branch = `${INDENT}${v0} = ${listVar}[${indexVar}];\n` + branch;
  return code + `for (var ${indexVar} in ${listVar}) {\n${branch}}\n`;
};
GEN.flow_break = () => 'break;\n';
GEN.flow_continue = () => 'continue;\n';
GEN.pf_wait = (c) => `game.wait(${c.v('MS', O.NONE, '1000')}, () => {\n${c.body('done')}});\n`;

// -- Variables
PURE.var_get = (c) => [c.varRef(true), O.ATOMIC];
GEN.var_set = (c) => `${c.varRef(true)} = ${c.v('VALUE', O.ASSIGNMENT, '0')};\n`;
GEN.var_change = (c) => {
  const name = c.varRef(true);
  return `${name} = (typeof ${name} === 'number' ? ${name} : 0) + ${c.v('DELTA', O.ADDITION, '0')};\n`;
};

// -- Fonctions
const callArgs = (c) => paramList(c.n).map((_, i) => c.v('ARG' + i, O.NONE, 'null')).join(', ');
GEN.fn_call = (c) => `${c.names.get(c.n.extra?.name || '', 'proc')}(${callArgs(c)});\n`;
PURE.fn_call_value = (c) => [`${c.names.get(c.n.extra?.name || '', 'proc')}(${callArgs(c)})`, F];
GEN.fn_return = (c) => {
  const e = c.input('VALUE');
  return e ? `return ${paren(e, O.NONE)};\n` : 'return;\n';
};

// -- Événements : contexte de lecture
PURE.pf_tile_info = (c) => {
  const e = c.implicit('TILE', 'tile', ['pf_on_hit_tile'], 'Tuile touchée : à utiliser dans « Tuile solide touchée ».');
  return [`${paren(e, O.MEMBER)}.${c.id('PROP')}`, O.MEMBER];
};
GEN.pf_destroy_other = (c) => {
  const e = c.implicit('OTHER', 'other', COLLIDE_EVENTS, 'Détruire l\'autre : à utiliser dans « Collision » / « Chevauche ».');
  return `${paren(e, O.MEMBER)}.destroy();\n`;
};

// -- Mouvement
GEN.pf_self_set = (c) => `self.${c.id('PROP')} = ${c.v('VALUE', O.ASSIGNMENT)};\n`;
GEN.pf_self_change = (c) => `self.${c.id('PROP')} += ${c.v('VALUE', O.ASSIGNMENT)};\n`;
GEN.pf_jump = (c) => `self.jump(${c.v('SPEED')});\n`;
GEN.pf_move_towards = (c) => `{ const _t = ${c.v('TARGET', O.NONE, 'null')}; if (_t) self.moveTowards(_t, ${c.v('SPEED')}); }\n`;
GEN.pf_flip = (c) => `self.flipX = ${c.on()};\n`;
GEN.pf_gravity = (c) => `self.setGravity(${c.on()});\n`;
PURE.pf_distance_to = (c) => [`((_o) => (_o ? self.distanceTo(_o) : 99999))(${c.v('TARGET', O.NONE, 'null')})`, F];
GEN.pf_set_position = (c) => `self.setPosition(${c.v('X')}, ${c.v('Y')});\n`;
GEN.pf_set_velocity = (c) => `self.setVelocity(${c.v('VX')}, ${c.v('VY')});\n`;
GEN.pf_set_vel_angle = (c) => `self.setVelocityAngle(${c.v('ANGLE')}, ${c.v('SPEED')});\n`;
PURE.pf_angle_to_obj = (c) => [`((_o) => (_o ? self.angleTo(_o) : 0))(${c.v('TARGET', O.NONE, 'null')})`, F];
PURE.pf_angle_to_point = (c) => [`self.angleTo({ x: ${c.v('X')}, y: ${c.v('Y')} })`, F];
PURE.pf_angle_to_mouse = () => ['self.angleTo({ x: input.mouseX, y: input.mouseY })', F];
PURE.pf_speed = (c) => (c.f('PROP') === 'dir'
  ? ['(Math.atan2(self.vy, self.vx) * 180 / Math.PI)', O.ATOMIC]
  : ['Math.hypot(self.vx, self.vy)', F]);
PURE.pf_atan2 = (c) => [`(Math.atan2(${c.v('DY')}, ${c.v('DX')}) * 180 / Math.PI)`, O.ATOMIC];
PURE.pf_blocked = (c) => [`self.blocked.${c.id('SIDE')}`, O.MEMBER];

// -- Mouvement 3D
GEN.pf_self_set_3d = (c) => `self.${c.id('PROP')} = ${c.v('VALUE', O.ASSIGNMENT)};\n`;
PURE.pf_self_get_3d = (c) => [`self.${c.id('PROP')}`, O.MEMBER];
GEN.pf_jump_3d = (c) => `self.jump(${c.v('FORCE')});\n`;
GEN.pf_move_forward_3d = (c) => `self.moveForward(${c.v('SPEED')});\n`;
GEN.pf_move_right_3d = (c) => `self.moveRight(${c.v('SPEED')});\n`;
GEN.pf_look_at_3d = (c) => `self.lookAt(${c.v('X')}, ${c.v('Y')}, ${c.v('Z')});\n`;
GEN.pf_rotate_y_3d = (c) => `self.rotateY(${c.v('ANGLE')});\n`;
PURE.pf_distance_3d = (c) => [`Math.hypot(${c.v('X1')} - ${c.v('X2')}, ${c.v('Y1')} - ${c.v('Y2')}, ${c.v('Z1')} - ${c.v('Z2')})`, F];
GEN.pf_tween_to = (c) => {
  const parts = [];
  for (const [inp, key] of [['X', 'x'], ['Y', 'y'], ['ALPHA', 'alpha'], ['ANGLE', 'angle'], ['SCALE', 'scale']]) {
    const e = c.o(inp);
    if (e) parts.push(`${key}: ${e}`);
  }
  return `self.tweenTo({ ${parts.join(', ')} }, ${c.v('MS', O.NONE, '400')});\n`;
};

// -- Apparence
GEN.pf_play = (c) => `self.play(${q(c.f('ANIM'))});\n`;
GEN.pf_visible = (c) => `self.visible = ${c.on()};\n`;
GEN.pf_alpha = (c) => `self.alpha = ${c.v('VALUE', O.ASSIGNMENT, '1')};\n`;
GEN.pf_tint_set = (c) => `self.tint = ${c.v('COLOR', O.ASSIGNMENT, "'#ffffff'")};\n`;
GEN.pf_tint_none = () => 'self.tint = null;\n';
PURE.pf_colour = (c) => [q(c.f('COL')), O.ATOMIC];

// -- Objet
PURE.pf_self_get = (c) => [`self.${c.id('PROP')}`, O.MEMBER];
PURE.pf_self_id = () => ['self.id', O.MEMBER];
PURE.pf_props_get = (c) => [`self.props[${q(c.f('KEY'))}]`, O.MEMBER];
GEN.pf_props_set = (c) => `self.props[${q(c.f('KEY'))}] = ${c.v('VALUE', O.ASSIGNMENT)};\n`;
PURE.pf_obj_prop = (c) => [`((_o) => (_o && _o.props ? _o.props[${q(c.f('KEY'))}] : null))(${c.v('TARGET', O.NONE, 'null')})`, F];
GEN.pf_selfvar_set = (c) => `self.vars[${q(c.f('NAME'))}] = ${c.v('VALUE', O.ASSIGNMENT)};\n`;
PURE.pf_selfvar_get = (c) => [`self.vars[${q(c.f('NAME'))}]`, O.MEMBER];
PURE.pf_find = (c) => [`game.find(${q(c.f('OBJ'))})`, F];
PURE.pf_find_all = (c) => [`game.findAll(${q(c.f('OBJ'))})`, F];
PURE.pf_obj_get = (c) => [`((_o) => (_o ? _o.${c.id('PROP')} : null))(${c.v('TARGET', O.NONE, 'null')})`, F];
GEN.pf_obj_set = (c) => `{ const _t = ${c.v('TARGET', O.NONE, 'null')}; if (_t) _t.${c.id('PROP')} = ${c.v('VALUE', O.ASSIGNMENT)}; }\n`;
GEN.pf_destroy_target = (c) => onTarget(c, '_t.destroy()');
PURE.pf_count_of = (c) => [`game.countOf(${q(c.f('OBJ'))})`, F];
PURE.pf_self_ref = () => ['self', O.ATOMIC];
PURE.pf_exists = (c) => [`(${c.v('TARGET', O.NONE, 'null')} != null)`, O.ATOMIC];
GEN.pf_t_set_position = (c) => onTarget(c, `_t.setPosition(${c.v('X')}, ${c.v('Y')})`);
GEN.pf_t_set_velocity = (c) => onTarget(c, `_t.setVelocity(${c.v('VX')}, ${c.v('VY')})`);
GEN.pf_t_set_vel_angle = (c) => onTarget(c, `_t.setVelocityAngle(${c.v('ANGLE')}, ${c.v('SPEED')})`);
GEN.pf_t_orient = (c) =>
  onTarget(c, `_t.angle = Math.atan2(${c.v('NY')}, ${c.v('NX')}) * 180 / Math.PI + ${c.v('OFFSET', O.ADDITION)}`);
GEN.pf_t_collide_map = (c) => onTarget(c, `_t.setCollideMap(${c.on()})`);
GEN.pf_t_collide_objs = (c) => onTarget(c, `_t.setCollideObjects(${c.on()})`);
GEN.pf_t_hitbox = (c) => onTarget(c, `_t.setHitbox(${c.v('X')}, ${c.v('Y')}, ${c.v('W', O.NONE, '16')}, ${c.v('H', O.NONE, '16')})`);
GEN.pf_t_prop_set = (c) => onTarget(c, `_t.props[${q(c.f('KEY'))}] = ${c.v('VALUE', O.ASSIGNMENT)}`);

// -- Entrée / souris
PURE.pf_key_down = (c) => [`input.isDown(${q(c.f('KEY'))})`, F];
PURE.pf_key_just = (c) => [`input.justPressed(${q(c.f('KEY'))})`, F];
PURE.pf_mouse_pos = (c) => [`input.${c.id('PROP')}`, O.MEMBER];
PURE.pf_mouse_delta = (c) => [c.id('AXIS') === 'y' ? '(input.mouseDeltaY || 0)' : '(input.mouseDeltaX || 0)', O.ATOMIC];
GEN.pf_pointer_lock = () => 'input.requestPointerLock();\n';
PURE.pf_mouse_down = (c) => [`input.isMouseDown(${q(c.f('BTN'))})`, F];
PURE.pf_mouse_just = (c) => [`input.mouseJustPressed(${q(c.f('BTN'))})`, F];

// -- Tuiles & rayons
PURE.pf_get_tile = (c) => [`game.getTile(${c.v('TX')}, ${c.v('TY')}${layerArg(c)})`, F];
GEN.pf_set_tile = (c) => `game.setTile(${c.v('TX')}, ${c.v('TY')}, ${c.v('INDEX', O.NONE, '-1')}${layerArg(c)});\n`;
PURE.pf_is_solid_at = (c) => [`game.isSolidAt(${c.v('X')}, ${c.v('Y')})`, F];
PURE.pf_tile_size = () => ['game.tileSize', O.MEMBER];
PURE.pf_to_tile = (c) => [`game.toTile(${c.v('PX')})`, F];
PURE.pf_raycast = (c) => [rayCall(c), F];
GEN.pf_ray_cast = (c) => `${c.rayVar()} = ${rayCall(c)};\n`;
GEN.pf_ray_cast_mouse = (c) =>
  `${c.rayVar()} = game.raycast(self.centerX, self.centerY, self.angleTo({ x: input.mouseX, y: input.mouseY }), ${c.v('DIST', O.NONE, '600')}${rayOpts(c)});\n`;
PURE.pf_ray_last = (c) => [rayField(c.id('FIELD'), c.rayVar()), F];
PURE.pf_ray_get = (c) => [rayField(c.id('FIELD'), c.v('RAY', O.NONE, 'null')), F];
PURE.pf_side = (c) => [q(c.f('SIDE')), O.ATOMIC];

// -- Son
GEN.pf_play_sound = (c) => `game.playSound(${q(c.f('SOUND'))}, ${c.v('VOL', O.NONE, '1')}, ${c.v('PITCH', O.NONE, '1')});\n`;
GEN.pf_play_music = (c) => `game.playMusic(${q(c.f('SOUND'))});\n`;
GEN.pf_stop_music = () => 'game.stopMusic();\n';
GEN.pf_play_song = (c) => `game.playSong(${q(c.f('SONG'))}, { loop: ${c.v('LOOP', O.NONE, 'true')}, volume: ${c.v('VOL', O.NONE, '1')}, fadeIn: ${c.v('FADE_IN', O.NONE, '0')} });\n`;
GEN.pf_stop_song = (c) => `game.stopSong({ fadeOut: ${c.v('FADE_OUT', O.NONE, '0')} });\n`;
GEN.pf_set_song_volume = (c) => `game.setSongVolume(${c.v('VOL', O.NONE, '1')});\n`;

// -- Messages
GEN.pf_broadcast = (c) => {
  const d = c.o('DATA');
  return `game.broadcast(${q(c.f('NAME'))}${d ? ', ' + d : ''});\n`;
};
PURE.pf_value_field = (c) => [`((_d) => (_d != null ? _d[${q(c.f('KEY'))}] : null))(${c.v('OBJ', O.NONE, 'null')})`, F];
PURE.pf_dict = (c) => {
  const n = Math.max(0, Math.floor(Number(c.n.extra?.items)) || 0);
  const parts = [];
  for (let i = 0; i < n; i++) parts.push(`${q(c.f('K' + i))}: ${c.v('V' + i, O.NONE, 'null')}`);
  return [parts.length ? `{ ${parts.join(', ')} }` : '{}', O.ATOMIC];
};

// -- Jeu
GEN.pf_score_set = (c) => `game.score = ${c.v('VALUE', O.ASSIGNMENT)};\n`;
GEN.pf_score_add = (c) => `game.score += ${c.v('VALUE', O.ASSIGNMENT)};\n`;
PURE.pf_score_get = () => ['game.score', O.MEMBER];
GEN.pf_gvar_set = (c) => `game.vars[${q(c.f('NAME'))}] = ${c.v('VALUE', O.ASSIGNMENT)};\n`;
PURE.pf_gvar_get = (c) => [`game.vars[${q(c.f('NAME'))}]`, O.MEMBER];
GEN.pf_spawn = (c) => `game.spawn(${q(c.f('OBJ'))}, ${c.v('X')}, ${c.v('Y')});\n`;
GEN.pf_spawn_props = (c) => spawnCall(c) + ';\n';
PURE.pf_spawn_val = (c) => [spawnCall(c), F];
GEN.pf_destroy_self = () => 'self.destroy();\n';
GEN.pf_goto_map = (c) => `game.goToMap(${q(c.f('MAP'))});\n`;
GEN.pf_restart = () => 'game.restart();\n';
PURE.pf_current_map = () => ['game.currentMap', O.MEMBER];
GEN.pf_pause = () => 'game.pause();\n';
GEN.pf_resume = () => 'game.resume();\n';
PURE.pf_is_paused = () => ['game.paused', O.MEMBER];
GEN.pf_particles = (c) =>
  `game.particles(${c.v('X')}, ${c.v('Y')}, ${c.v('COLOR', O.NONE, "'#ffffff'")}, ${c.v('COUNT', O.NONE, '12')}, ${c.v('SPEED', O.NONE, '80')}, ${c.v('MS', O.NONE, '500')});\n`;
GEN.pf_save = (c) => `game.save(${q(c.f('KEY'))}, ${c.v('VALUE', O.NONE, 'null')});\n`;
PURE.pf_load = (c) => [`game.load(${q(c.f('KEY'))}, ${c.v('DEFAULT', O.NONE, 'null')})`, F];
PURE.pf_random = (c) => [`game.random(${c.v('MIN')}, ${c.v('MAX', O.NONE, '10')})`, F];
PURE.pf_game_info = (c) => [`game.${c.id('PROP')}`, O.MEMBER];
GEN.pf_log = (c) => `game.log(${c.v('VALUE', O.NONE, "''")});\n`;
GEN.pf_js = (c) => `${c.f('CODE')};\n`;
PURE.pf_js_val = (c) => [c.f('EXPR') || 'null', O.ATOMIC];

// -- Caméra & texte
GEN.pf_set_text = (c) => `game.setText(${q(c.f('ID'))}, ${c.v('TEXT', O.NONE, "''")}, ${c.v('X')}, ${c.v('Y')});\n`;
GEN.pf_set_text_opts = (c) =>
  `game.setText(${q(c.f('ID'))}, ${c.v('TEXT', O.NONE, "''")}, ${c.v('X')}, ${c.v('Y')}, `
  + `{ color: ${c.v('COLOR', O.NONE, "'#ffffff'")}, size: ${c.v('SIZE', O.NONE, '1')}, align: ${q(c.f('ALIGN'))} });\n`;
GEN.pf_remove_text = (c) => `game.removeText(${q(c.f('ID'))});\n`;
GEN.pf_cam_follow_self = () => 'game.camera.follow(self);\n';
GEN.pf_cam_follow = (c) => `{ const _t = ${c.v('TARGET', O.NONE, 'null')}; if (_t) game.camera.follow(_t); }\n`;
GEN.pf_camera_mode_3d = (c) => `game.camera.setMode(${q(c.f('MODE'))});\n`;
GEN.pf_camera_follow_3d = (c) => `game.camera.follow(self, { distance: ${c.v('DIST')}, height: ${c.v('HEIGHT')} });\n`;
GEN.pf_cam_shake = (c) => `game.camera.shake(${c.v('MS', O.NONE, '200')}, ${c.v('POWER', O.NONE, '0.01')});\n`;
GEN.pf_cam_flash = (c) => `game.camera.flash(${c.v('MS', O.NONE, '200')});\n`;
GEN.pf_cam_zoom = (c) => `game.camera.setZoom(${c.v('Z', O.NONE, '1')});\n`;
GEN.pf_cam_deadzone = (c) => `game.camera.setDeadzone(${c.v('W')}, ${c.v('H')});\n`;
GEN.pf_cam_offset = (c) => `game.camera.setOffset(${c.v('X')}, ${c.v('Y')});\n`;
PURE.pf_cam_pos = (c) => [`game.camera.${c.id('PROP')}`, O.MEMBER];

// -- Logique
const CMP = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
PURE.logic_compare = (c) => {
  const op = CMP[c.f('OP')] || '==';
  const order = op === '==' || op === '!=' ? O.EQUALITY : O.RELATIONAL;
  return [`${c.v('A', order, '0')} ${op} ${c.v('B', order, '0')}`, order];
};
PURE.logic_operation = (c) => {
  const and = c.f('OP') !== 'OR';
  const order = and ? O.LOGICAL_AND : O.LOGICAL_OR;
  let a = c.v('A', order, '');
  let b = c.v('B', order, '');
  if (!a && !b) { a = 'false'; b = 'false'; } else {
    const d = and ? 'true' : 'false';
    if (!a) a = d;
    if (!b) b = d;
  }
  return [`${a} ${and ? '&&' : '||'} ${b}`, order];
};
PURE.logic_negate = (c) => [`!${c.v('BOOL', O.LOGICAL_NOT, 'true')}`, O.LOGICAL_NOT];
PURE.logic_boolean = (c) => [c.f('BOOL') === 'FALSE' || c.f('BOOL') === 'false' ? 'false' : 'true', O.ATOMIC];
PURE.logic_null = () => ['null', O.ATOMIC];
PURE.logic_ternary = (c) => [`${c.v('IF', O.CONDITIONAL, 'false')} ? ${c.v('THEN', O.CONDITIONAL, 'null')} : ${c.v('ELSE', O.CONDITIONAL, 'null')}`, O.CONDITIONAL];

// -- Maths
PURE.math_number = (c) => literal(c.f('NUM'), 'number');
const ARITH = { ADD: [' + ', O.ADDITION], MINUS: [' - ', O.SUBTRACTION], MULTIPLY: [' * ', O.MULTIPLICATION], DIVIDE: [' / ', O.DIVISION], POWER: [null, O.NONE] };
PURE.math_arithmetic = (c) => {
  const [op, order] = ARITH[c.f('OP')] || ARITH.ADD;
  const a = c.v('A', order, '0');
  const b = c.v('B', order, '0');
  if (!op) return [`Math.pow(${a}, ${b})`, F];
  return [a + op + b, order];
};
PURE.math_single = (c) => {
  const op = c.f('OP');
  if (op === 'NEG') {
    let a = c.v('NUM', O.UNARY_NEGATION, '0');
    if (a[0] === '-') a = ' ' + a;
    return ['-' + a, O.UNARY_NEGATION];
  }
  const a = c.v('NUM', op === 'SIN' || op === 'COS' || op === 'TAN' ? O.DIVISION : O.NONE, '0');
  let code;
  switch (op) {
    case 'ABS': code = `Math.abs(${a})`; break;
    case 'ROOT': code = `Math.sqrt(${a})`; break;
    case 'LN': code = `Math.log(${a})`; break;
    case 'EXP': code = `Math.exp(${a})`; break;
    case 'POW10': code = `Math.pow(10,${a})`; break;
    case 'ROUND': code = `Math.round(${a})`; break;
    case 'ROUNDUP': code = `Math.ceil(${a})`; break;
    case 'ROUNDDOWN': code = `Math.floor(${a})`; break;
    case 'SIN': code = `Math.sin(${a} / 180 * Math.PI)`; break;
    case 'COS': code = `Math.cos(${a} / 180 * Math.PI)`; break;
    case 'TAN': code = `Math.tan(${a} / 180 * Math.PI)`; break;
    default:
  }
  if (code) return [code, F];
  switch (op) {
    case 'LOG10': code = `Math.log(${a}) / Math.log(10)`; break;
    case 'ASIN': code = `Math.asin(${a}) / Math.PI * 180`; break;
    case 'ACOS': code = `Math.acos(${a}) / Math.PI * 180`; break;
    case 'ATAN': code = `Math.atan(${a}) / Math.PI * 180`; break;
    default: c.err('Fonction mathématique inconnue : ' + op); code = '0';
  }
  return [code, O.DIVISION];
};
PURE.math_trig = PURE.math_single;
PURE.math_round = PURE.math_single;
PURE.math_constant = (c) => ({
  PI: ['Math.PI', O.MEMBER], E: ['Math.E', O.MEMBER], GOLDEN_RATIO: ['(1 + Math.sqrt(5)) / 2', O.DIVISION],
  SQRT2: ['Math.SQRT2', O.MEMBER], SQRT1_2: ['Math.SQRT1_2', O.MEMBER], INFINITY: ['Infinity', O.ATOMIC],
}[c.f('CONSTANT')] || ['Math.PI', O.MEMBER]);
PURE.math_modulo = (c) => [`${c.v('DIVIDEND', O.MODULUS, '0')} % ${c.v('DIVISOR', O.MODULUS, '0')}`, O.MODULUS];
PURE.math_random_int = (c) => {
  const a = c.v('FROM', O.NONE, '0');
  const b = c.v('TO', O.NONE, '0');
  return [`${c.helper('mathRandomInt')}(${a}, ${b})`, F];
};
PURE.math_random_float = () => ['Math.random()', F];
PURE.math_constrain = (c) => [`Math.min(Math.max(${c.v('VALUE', O.NONE, '0')}, ${c.v('LOW', O.NONE, '0')}), ${c.v('HIGH', O.NONE, 'Infinity')})`, F];
PURE.math_number_property = (c) => {
  const prop = c.f('PROPERTY');
  const P = {
    EVEN: [' % 2 === 0', O.MODULUS, O.EQUALITY], ODD: [' % 2 === 1', O.MODULUS, O.EQUALITY], WHOLE: [' % 1 === 0', O.MODULUS, O.EQUALITY],
    POSITIVE: [' > 0', O.RELATIONAL, O.RELATIONAL], NEGATIVE: [' < 0', O.RELATIONAL, O.RELATIONAL],
    DIVISIBLE_BY: [null, O.MODULUS, O.EQUALITY], PRIME: [null, O.NONE, F],
  };
  const [suffix, inOrder, outOrder] = P[prop] || P.EVEN;
  const n = c.v('NUMBER_TO_CHECK', inOrder, '0');
  if (prop === 'PRIME') return [`${c.helper('mathIsPrime')}(${n})`, outOrder];
  if (prop === 'DIVISIBLE_BY') {
    const d = c.v('DIVISOR', O.MODULUS, '0');
    if (d === '0') return ['false', O.ATOMIC];
    return [`${n} % ${d} === 0`, outOrder];
  }
  return [n + suffix, outOrder];
};

// -- Texte
PURE.text = (c) => [q(c.f('TEXT')), O.ATOMIC];
const forceString = (s) => (/^\s*'([^']|\\')*'\s*$/.test(s) ? [s, O.ATOMIC] : [`String(${s})`, F]);
PURE.text_join = (c) => {
  const n = Math.max(0, Math.floor(Number(c.n.extra?.items)) || 0);
  const el = [];
  for (let i = 0; i < n; i++) el.push(c.v('ADD' + i, O.NONE, "''"));
  if (n === 0) return ["''", O.ATOMIC];
  if (n === 1) return forceString(el[0]);
  if (n === 2) return [`${forceString(el[0])[0]} + ${forceString(el[1])[0]}`, O.ADDITION];
  return [`[${el.join(',')}].join('')`, F];
};
PURE.text_length = (c) => [`${c.v('VALUE', F, "''")}.length`, O.MEMBER];
PURE.text_isEmpty = (c) => [`!${c.v('VALUE', O.MEMBER, "''")}.length`, O.LOGICAL_NOT];

// -- Listes
PURE.lists_create_empty = () => ['[]', O.ATOMIC];
PURE.lists_create_with = (c) => {
  const n = Math.max(0, Math.floor(Number(c.n.extra?.items)) || 0);
  const el = [];
  for (let i = 0; i < n; i++) el.push(c.v('ADD' + i, O.NONE, 'null'));
  return [`[${el.join(', ')}]`, O.ATOMIC];
};
PURE.lists_length = (c) => [`${c.v('VALUE', O.MEMBER, '[]')}.length`, O.MEMBER];
PURE.lists_isEmpty = (c) => [`!${c.v('VALUE', O.MEMBER, '[]')}.length`, O.LOGICAL_NOT];

// Index ajusté (les listes se comptent à partir de 1) : copie de getAdjusted de Blockly
function adjusted(c, delta = 0, negate = false, order = O.NONE) {
  delta--;
  let outer = order;
  let inner;
  if (delta > 0) { outer = O.ADDITION; inner = O.ADDITION; } else if (delta < 0) { outer = O.SUBTRACTION; inner = O.SUBTRACTION; } else if (negate) { outer = O.UNARY_NEGATION; inner = O.UNARY_NEGATION; }
  let at = c.v('AT', outer, '1');
  if (isNumber(at)) {
    at = Number(at) + delta;
    if (negate) at = -at;
  } else {
    if (delta > 0) at = `${at} + ${delta}`; else if (delta < 0) at = `${at} - ${-delta}`;
    if (negate) at = delta ? `-(${at})` : `-${at}`;
    inner = Math.floor(inner || 0);
    if (inner && Math.floor(order) >= inner) at = `(${at})`;
  }
  return at;
}
const whereOf = (c) => c.f('WHERE') || 'FROM_START';
function getIndexCode(c, mode) {
  const where = whereOf(c);
  const list = c.v('VALUE', where === 'RANDOM' ? O.NONE : O.MEMBER, '[]');
  switch (where) {
    case 'FIRST':
      if (mode === 'GET') return [`${list}[0]`, O.MEMBER];
      return mode === 'GET_REMOVE' ? [`${list}.shift()`, O.MEMBER] : `${list}.shift();\n`;
    case 'LAST':
      if (mode === 'GET') return [`${list}.slice(-1)[0]`, F];
      return mode === 'GET_REMOVE' ? [`${list}.pop()`, O.MEMBER] : `${list}.pop();\n`;
    case 'FROM_START': {
      const at = adjusted(c);
      if (mode === 'GET') return [`${list}[${at}]`, O.MEMBER];
      return mode === 'GET_REMOVE' ? [`${list}.splice(${at}, 1)[0]`, F] : `${list}.splice(${at}, 1);\n`;
    }
    case 'FROM_END': {
      const at = adjusted(c, 1, true);
      if (mode === 'GET') return [`${list}.slice(${at})[0]`, F];
      return mode === 'GET_REMOVE' ? [`${list}.splice(${at}, 1)[0]`, F] : `${list}.splice(${at}, 1);\n`;
    }
    default: {
      const code = `${c.helper('listsGetRandomItem')}(${list}, ${mode !== 'GET'})`;
      return mode === 'REMOVE' ? code + ';\n' : [code, F];
    }
  }
}
PURE.lists_getIndex = (c) => getIndexCode(c, c.f('MODE') === 'GET_REMOVE' ? 'GET_REMOVE' : 'GET');
GEN.lists_removeIndex = (c) => getIndexCode(c, 'REMOVE');
GEN.lists_setIndex = (c) => {
  let list = c.v('LIST', O.MEMBER, '[]');
  const mode = c.f('MODE') === 'INSERT' ? 'INSERT' : 'SET';
  const where = whereOf(c);
  const value = c.v('TO', O.ASSIGNMENT, 'null');
  const cache = () => {
    if (/^\w+$/.test(list)) return '';
    const v = c.names.distinct('tmpList');
    const code = `var ${v} = ${list};\n`;
    list = v;
    return code;
  };
  switch (where) {
    case 'FIRST': return mode === 'SET' ? `${list}[0] = ${value};\n` : `${list}.unshift(${value});\n`;
    case 'LAST': {
      if (mode === 'INSERT') return `${list}.push(${value});\n`;
      const pre = cache();
      return pre + `${list}[${list}.length - 1] = ${value};\n`;
    }
    case 'FROM_START': {
      const at = adjusted(c);
      return mode === 'SET' ? `${list}[${at}] = ${value};\n` : `${list}.splice(${at}, 0, ${value});\n`;
    }
    case 'FROM_END': {
      const at = adjusted(c, 1, false, O.SUBTRACTION);
      const pre = cache();
      return pre + (mode === 'SET' ? `${list}[${list}.length - ${at}] = ${value};\n` : `${list}.splice(${list}.length - ${at}, 0, ${value});\n`);
    }
    default: {
      let code = cache();
      const x = c.names.distinct('tmpX');
      code += `var ${x} = Math.floor(Math.random() * ${list}.length);\n`;
      return code + (mode === 'SET' ? `${list}[${x}] = ${value};\n` : `${list}.splice(${x}, 0, ${value});\n`);
    }
  }
};

// ---------------------------------------------------------------- compilateur

const sortPos = (a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || (Number(a.x) || 0) - (Number(b.x) || 0);
const MAX_STATEMENTS = 20000;

class Compiler {
  constructor(graph, isGlobal, dimension) {
    this.graph = graph;
    this.isGlobal = isGlobal;
    this.dimension = dimension;
    this.nodes = new Map();
    for (const n of graph.nodes || []) if (n && n.id != null) this.nodes.set(n.id, n);
    this.inLinks = new Map(); // `${to}\0${toPin}` -> lien
    this.outLinks = new Map(); // `${from}\0${fromPin}` -> lien (sorties d'exécution)
    this.errors = [];
    this.warnings = [];
    this.names = new Names();
    this.defs = new Map(); // définitions en tête (fonctions, utilitaires, _pfRay), dans l'ordre d'apparition
    this.helperNames = new Map();
    this.declared = []; // variables { name, default }
    this.declaredKeys = new Set();
    this.path = new Set(); // nœuds exec en cours de génération (détection des cycles)
    this.dataStack = new Set(); // nœuds purs en cours d'évaluation
    this.cur = null; // { node, type, params:Set } : événement / fonction en cours
    this.count = 0;
    this.pinCache = new Map();
    this.fnNames = new Set();
  }

  err(nodeId, message) { this.errors.push({ nodeId, message }); }
  warn(nodeId, message) { this.warnings.push({ nodeId, message }); }

  pins(n) {
    let p = this.pinCache.get(n);
    if (!p) { p = resolvePins(n, this.graph); this.pinCache.set(n, p); }
    return p;
  }

  indexLinks() {
    for (const l of this.graph.links || []) {
      if (!l) continue;
      const from = this.nodes.get(l.from);
      const to = this.nodes.get(l.to);
      if (!from || !to) { this.warn(to ? l.to : l.from, 'Lien vers un nœud inexistant : ignoré.'); continue; }
      const isExec = l.toPin === 'exec';
      if (isExec) {
        const k = l.from + '\0' + l.fromPin;
        if (this.outLinks.has(k)) this.warn(l.from, `La sortie « ${l.fromPin} » est reliée plusieurs fois : seul le premier fil est suivi.`);
        else this.outLinks.set(k, l);
      } else {
        const k = l.to + '\0' + l.toPin;
        if (this.inLinks.has(k)) this.warn(l.to, `L'entrée « ${l.toPin} » est reliée plusieurs fois : seul le premier fil est utilisé.`);
        else this.inLinks.set(k, l);
      }
    }
  }

  // ---- variables / fonctions / utilitaires

  declareVar(name, silent = false, nodeId = null) {
    const key = String(name).toLowerCase();
    if (this.declaredKeys.has(key)) return;
    if (this.cur?.params?.has(key)) return; // paramètre de la fonction en cours
    this.declaredKeys.add(key);
    this.declared.push({ name });
    if (!silent) this.warn(nodeId, `Variable « ${name} » non déclarée : déclarée automatiquement.`);
  }

  helper(name) {
    if (!this.helperNames.has(name)) {
      const fn = this.names.distinct(name);
      this.helperNames.set(name, fn);
      this.defs.set('%' + name, HELPERS[name].join('\n').replace('$', fn));
    }
    return this.helperNames.get(name);
  }

  // ---- évaluation des données

  /** [code, priorité] d'une entrée de données, ou null si elle n'a ni fil, ni valeur, ni défaut. */
  input(n, name) {
    const link = this.inLinks.get(n.id + '\0' + name);
    if (link) {
      const r = this.evalOut(this.nodes.get(link.from), link.fromPin);
      if (r) return r;
    }
    const pin = this.pins(n).inputs.find((p) => p.name === name);
    const type = pin?.type || 'any';
    if (n.values && Object.prototype.hasOwnProperty.call(n.values, name)) return literal(n.values[name], type);
    if (pin && pin.default !== undefined) return literal(pin.default, type);
    return null;
  }

  evalOut(src, pin) {
    const spec = getSpec(src.type);
    if (!spec) { this.err(src.id, 'Type de nœud inconnu : ' + src.type); return ['null', O.ATOMIC]; }
    if (spec.kind === 'pure') {
      if (this.dataStack.has(src.id)) { this.err(src.id, 'Boucle dans les fils de données.'); return ['null', O.ATOMIC]; }
      const gen = PURE[src.type];
      if (!gen) { this.err(src.id, 'Nœud non compilable : ' + src.type); return ['null', O.ATOMIC]; }
      this.dataStack.add(src.id);
      try { return gen(this.ctxFor(src)); } finally { this.dataStack.delete(src.id); }
    }
    return this.outputPin(src, pin);
  }

  /** Lecture d'une sortie de données d'un événement, d'une fonction ou d'une boucle. */
  outputPin(src, pin) {
    if (src.type === 'flow_for' && pin === 'index') return [this.loopVarName(src), O.ATOMIC];
    if (src.type === 'flow_for_each' && pin === 'item') return [this.loopVarName(src), O.ATOMIC];
    const spec = getSpec(src.type);
    if (spec.kind === 'event') {
      if (this.cur?.node !== src) {
        this.err(src.id, `La sortie « ${pin} » de « ${spec.title} » ne peut être lue que dans son propre événement.`);
        return ['null', O.ATOMIC];
      }
      if (src.type === 'fn_def') {
        const m = /^ARG(\d+)$/.exec(pin);
        const p = m ? paramList(src)[Number(m[1])] : null;
        if (p == null) { this.err(src.id, 'Paramètre inconnu : ' + pin); return ['null', O.ATOMIC]; }
        return [this.names.get(p, 'var'), O.ATOMIC];
      }
      if (!spec.outputs.some((o) => o.name === pin && o.type !== 'exec')) { this.err(src.id, 'Sortie inconnue : ' + pin); return ['null', O.ATOMIC]; }
      return [pin, O.ATOMIC];
    }
    this.err(src.id, `La sortie « ${pin} » de « ${spec.title} » ne peut pas être lue.`);
    return ['null', O.ATOMIC];
  }

  loopVarName(n) {
    const name = String(n.fields?.VAR || '').trim() || (n.type === 'flow_for' ? 'i' : 'item');
    this.declareVar(name, true);
    return this.names.get(name, 'var');
  }

  /** Contexte passé aux générateurs de nœuds. */
  ctxFor(n) {
    const g = this;
    const c = {
      n,
      names: g.names,
      get cur() { return g.cur?.node; },
      err: (m) => g.err(n.id, m),
      f: (name) => {
        const v = n.fields?.[name];
        return v == null ? '' : String(v);
      },
      id: (name) => {
        const v = c.f(name);
        if (!isIdent(v)) { g.err(n.id, `Valeur invalide pour « ${name} » : ${v}`); return 'x'; }
        return v;
      },
      on: () => (c.f('ON') === 'false' ? 'false' : 'true'),
      input: (name) => g.input(n, name),
      v: (name, order = O.NONE, dflt) => {
        const e = g.input(n, name);
        if (e) return paren(e, order);
        const pin = g.pins(n).inputs.find((p) => p.name === name);
        return dflt ?? TYPE_FALLBACK[pin?.type] ?? 'null';
      },
      o: (name, order = O.NONE) => {
        const hasLink = g.inLinks.has(n.id + '\0' + name);
        const hasValue = n.values && Object.prototype.hasOwnProperty.call(n.values, name);
        if (!hasLink && !hasValue) {
          const pin = g.pins(n).inputs.find((p) => p.name === name);
          if (!pin || pin.default === undefined) return '';
        }
        const e = g.input(n, name);
        return e ? paren(e, order) : '';
      },
      implicit: (name, varName, events, msg) => {
        const e = g.input(n, name);
        if (g.inLinks.has(n.id + '\0' + name) && e) return e;
        if (g.cur && events.includes(g.cur.type)) return [varName, O.ATOMIC];
        g.err(n.id, msg);
        return ['null', O.ATOMIC];
      },
      varRef: (warn) => {
        const raw = c.f('NAME');
        if (!raw) { g.err(n.id, 'Choisis une variable.'); return 'x'; }
        g.declareVar(raw, !warn, n.id);
        return g.names.get(raw, 'var');
      },
      loopVar: () => g.loopVarName(n),
      rayVar: () => {
        if (!g.defs.has('pf_ray')) g.defs.set('pf_ray', 'var _pfRay = null;');
        return '_pfRay';
      },
      helper: (name) => g.helper(name),
      chain: (pin) => g.chain(g.execTarget(n.id, pin)),
      body: (pin) => indent(g.chain(g.execTarget(n.id, pin))),
      genIf: () => g.genIf(n),
    };
    return c;
  }

  // ---- exécution

  execTarget(id, pin) {
    const l = this.outLinks.get(id + '\0' + pin);
    return l ? l.to : null;
  }

  /** Instructions d'un fil d'exécution à partir de `startId`, en suivant « then ». */
  chain(startId) {
    let out = '';
    const added = [];
    let id = startId;
    while (id != null) {
      const n = this.nodes.get(id);
      if (!n) break;
      if (this.path.has(id)) {
        this.err(id, 'Cycle d\'exécution : ce nœud est atteint depuis lui-même.');
        break;
      }
      if (++this.count > MAX_STATEMENTS) {
        if (this.count === MAX_STATEMENTS + 1) this.err(id, 'Graphe trop gros (trop de chemins d\'exécution).');
        break;
      }
      this.path.add(id);
      added.push(id);
      out += this.genNode(n);
      id = getSpec(n.type)?.outputs.some((p) => p.name === 'then') ? this.execTarget(id, 'then') : null;
    }
    for (const a of added) this.path.delete(a);
    return out;
  }

  genNode(n) {
    const spec = getSpec(n.type);
    if (!spec) { this.err(n.id, 'Type de nœud inconnu : ' + n.type); return ''; }
    if (spec.kind !== 'exec') { this.err(n.id, `« ${spec.title} » n'a pas d'entrée d'exécution.`); return ''; }
    const gen = GEN[n.type];
    if (!gen) { this.err(n.id, 'Nœud non compilable : ' + n.type); return ''; }
    this.warnEmptyFields(n, spec);
    return gen(this.ctxFor(n));
  }

  warnEmptyFields(n, spec) {
    for (const f of spec.fields) {
      if ((f.kind === 'object' || f.kind === 'map') && !n.fields?.[f.name]) this.warn(n.id, `Choisis ${f.kind === 'map' ? 'une carte' : 'un objet'} (« ${f.label} »).`);
    }
  }

  /** if / sinon si / sinon : une branche « Faux » réduite à un autre Branche (sans suite) devient « else if ». */
  genIf(n) {
    let code = '';
    let cur = n;
    const added = [];
    for (;;) {
      const c = this.ctxFor(cur);
      code += (code ? ' else ' : '') + `if (${c.v('COND', O.NONE, 'false')}) {\n${c.body('true')}}`;
      const f = this.execTarget(cur.id, 'false');
      if (f == null) break;
      const fn = this.nodes.get(f);
      if (fn && fn.type === 'flow_branch' && this.execTarget(f, 'then') == null && !this.path.has(f)) {
        this.path.add(f);
        added.push(f);
        cur = fn;
        continue;
      }
      code += ` else {\n${indent(this.chain(f))}}`;
      break;
    }
    for (const a of added) this.path.delete(a);
    return code + '\n';
  }

  genHandler(n) {
    const spec = getSpec(n.type);
    const head = EVENT_HEAD[n.type];
    if (!head) { this.err(n.id, 'Événement non compilable : ' + n.type); return ''; }
    this.cur = { node: n, type: n.type, params: new Set() };
    this.warnEmptyFields(n, spec);
    const [args, param] = head(this.ctxFor(n));
    const body = indent(this.chain(this.execTarget(n.id, 'then')));
    this.cur = null;
    return `on(${args}, (${param}) => {\n${body}});\n`;
  }

  genFunction(n) {
    const params = paramList(n);
    this.cur = { node: n, type: 'fn_def', params: new Set(params.map((p) => p.toLowerCase())) };
    const name = this.names.get(String(n.fields?.NAME || ''), 'proc');
    const args = params.map((p) => this.names.get(p, 'var'));
    const body = indent(this.chain(this.execTarget(n.id, 'then')));
    this.cur = null;
    this.defs.set('%' + name, `function ${name}(${args.join(', ')}) {\n${body}}`);
  }

  run() {
    const graph = this.graph;
    this.indexLinks();
    // types inconnus / nœuds interdits dans le script global
    for (const n of this.nodes.values()) {
      const spec = getSpec(n.type);
      if (!spec) { this.err(n.id, 'Type de nœud inconnu : ' + n.type); continue; }
      if (this.isGlobal && spec.selfOnly) this.err(n.id, `« ${spec.title} » utilise l'objet (self), indisponible dans le script global.`);
      if (this.dimension && spec.dims && !spec.dims.includes(this.dimension)) {
        this.err(n.id, `« ${spec.title} » n'existe pas dans un jeu ${this.dimension.toUpperCase()}.`);
      }
    }
    for (const v of graph.variables || []) {
      if (!v || !v.name) continue;
      const key = String(v.name).toLowerCase();
      if (this.declaredKeys.has(key)) continue;
      this.declaredKeys.add(key);
      this.declared.push({ name: v.name, default: v.default });
      this.names.get(v.name, 'var');
    }
    const all = [...this.nodes.values()].sort(sortPos);
    const defs = all.filter((n) => n.type === 'fn_def');
    const events = all.filter((n) => n.type !== 'fn_def' && getSpec(n.type)?.kind === 'event');
    for (const d of defs) {
      const key = String(d.fields?.NAME || '').toLowerCase();
      if (this.fnNames.has(key)) this.err(d.id, `La fonction « ${d.fields?.NAME} » est définie plusieurs fois.`);
      this.fnNames.add(key);
    }
    for (const n of all) {
      if ((n.type === 'fn_call' || n.type === 'fn_call_value') && !this.fnNames.has(String(n.extra?.name || '').toLowerCase())) {
        this.warn(n.id, `Fonction « ${n.extra?.name || ''} » introuvable dans ce script.`);
      }
    }
    for (const d of defs) this.genFunction(d);
    let code = '';
    for (const e of events) code += this.genHandler(e);

    // variables en tête : sans valeur par défaut → « var a, b; », avec → « var a = 0; »
    const plain = this.declared.filter((v) => v.default === undefined);
    const withDef = this.declared.filter((v) => v.default !== undefined);
    const varLines = [];
    if (plain.length) varLines.push('var ' + plain.map((v) => this.names.get(v.name, 'var')).join(', ') + ';');
    for (const v of withDef) varLines.push(`var ${this.names.get(v.name, 'var')} = ${literal(v.default, 'any')[0]};`);
    const header = [...(varLines.length ? [varLines.join('\n')] : []), ...this.defs.values()].join('\n\n');
    let out = (header ? header + '\n\n' : '') + code;
    out = out.replace(/^\n+/, '').trimEnd();
    return { code: out ? out + '\n' : '', errors: this.errors, warnings: this.warnings };
  }
}

/**
 * Compile un graphe en JavaScript (corps de new Function('self','game','input','on', code)).
 * dimension ('2d' | '3d', optionnel) : refuse les nœuds qui n'existent pas dans ce type de jeu.
 * → { code, errors: [{ nodeId, message }], warnings: [{ nodeId, message }] }
 */
export function compileGraph(graph, { isGlobal = false, dimension = null } = {}) {
  try {
    return new Compiler(graph || {}, isGlobal, dimension).run();
  } catch (e) {
    return { code: '', errors: [{ nodeId: null, message: 'Erreur de compilation : ' + (e && e.message ? e.message : e) }], warnings: [] };
  }
}
