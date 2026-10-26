// Conversion d'une sérialisation Blockly (ancien format des scripts) en graphe Blueprint, avec mise en page automatique.
import { getSpec, resolvePins, defaultExtra } from './nodes.js';

const COLLIDE_EVENTS = ['pf_on_collide', 'pf_on_overlap', 'pf_on_overlap_start', 'pf_on_overlap_end'];

// ---------------------------------------------------------------- taille des nœuds (partagée avec l'éditeur)

const HEADER_H = 26;
const ROW_H = 22;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Taille estimée d'un nœud, en unités du graphe : { w, h } (en-tête 26, 22 par ligne de broche ou de champ, largeur 180-260). */
export function estimateNodeSize(node, graph) {
  const spec = getSpec(node.type);
  if (!spec) return { w: 180, h: HEADER_H + ROW_H + 10 };
  const { inputs, outputs, fields } = resolvePins(node, graph);
  const linked = new Set();
  for (const l of graph?.links || []) if (l.to === node.id) linked.add(l.toPin);
  const rows = Math.max(inputs.length, outputs.length);
  let w = 28 + spec.title.length * 7.5;
  for (let i = 0; i < rows; i++) {
    const a = inputs[i];
    const b = outputs[i];
    const wi = a ? 24 + a.label.length * 6.4 + (a.type !== 'exec' && !linked.has(a.name) ? 48 : 0) : 0;
    const wo = b ? 24 + b.label.length * 6.4 : 0;
    w = Math.max(w, wi + wo + (a && b ? 20 : 0));
  }
  let fieldRows = 0;
  for (const f of fields) {
    fieldRows += f.multiline ? 2 : 1;
    w = Math.max(w, 28 + f.label.length * 6.4 + (f.kind === 'dropdown' || f.kind === 'text' ? 120 : 90));
  }
  return { w: Math.round(clamp(w, 180, 260)), h: HEADER_H + ROW_H * (rows + fieldRows) + 10 };
}

// ---------------------------------------------------------------- tables

// Valeur d'une entrée de valeur laissée VIDE dans Blockly quand elle diffère du défaut du nœud
// (le générateur Blockly utilisait ces valeurs ; les défauts des nœuds suivent les « shadows » de la toolbox).
const EMPTY = {
  pf_self_change: { VALUE: 0 }, pf_jump: { SPEED: 0 }, pf_move_towards: { SPEED: 0 }, pf_score_add: { VALUE: 0 },
  pf_set_text: { TEXT: '', X: 0, Y: 0 }, pf_set_text_opts: { TEXT: '', X: 0, Y: 0 }, pf_random: { MIN: 0, MAX: 10 }, pf_log: { VALUE: '' },
  pf_t_set_vel_angle: { SPEED: 0 }, pf_t_orient: { NY: 0 }, pf_set_vel_angle: { SPEED: 0 }, pf_atan2: { DX: 0 },
  pf_tint_set: { COLOR: '#ffffff' }, pf_particles: { COLOR: '#ffffff' }, pf_save: { VALUE: null }, pf_load: { DEFAULT: null },
  pf_cam_deadzone: { W: 0, H: 0 },
  math_arithmetic: { A: 0, B: 0 }, math_single: { NUM: 0 }, math_trig: { NUM: 0 }, math_modulo: { DIVIDEND: 0, DIVISOR: 0 }, math_round: { NUM: 0 },
  math_random_int: { FROM: 0, TO: 0 }, math_constrain: { VALUE: 0, LOW: 0, HIGH: 'Infinity' }, math_number_property: { DIVISOR: 0 },
  text_length: { VALUE: '' }, lists_length: { VALUE: [] }, lists_isEmpty: { VALUE: [] }, lists_getIndex: { VALUE: [] },
  lists_removeIndex: { VALUE: [] }, lists_setIndex: { LIST: [], TO: null },
  var_change: { DELTA: 0 }, flow_repeat: { TIMES: 0 }, flow_for: { FROM: 0, TO: 0 }, flow_for_each: { LIST: [] },
};

// Types Blockly dont le nom change dans le graphe
const RENAME = { controls_repeat_ext: 'flow_repeat', controls_repeat: 'flow_repeat', variables_get: 'var_get', procedures_callreturn: 'fn_call_value' };

const isDisabled = (b) => b.enabled === false || (Array.isArray(b.disabledReasons) && b.disabledReasons.length > 0);
const asArray = (v) => (Array.isArray(v) ? v : []);
const hasKey = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

// ---------------------------------------------------------------- conversion

/**
 * Convertit une sérialisation JSON Blockly ({ blocks: { blocks: [...] }, variables: [...] }) en graphe Blueprint.
 * Les blocs désactivés sont ignorés (ils ne produisaient pas de code) ; les blocs isolés sont conservés sans être reliés à un événement.
 */
export function blocklyToGraph(json) {
  const tops = asArray(json?.blocks?.blocks ?? (Array.isArray(json?.blocks) ? json.blocks : []));
  const varById = new Map();
  for (const v of asArray(json?.variables)) if (v && v.id != null) varById.set(v.id, v.name);

  const nodes = [];
  const links = [];
  const byId = new Map();
  let nodeCount = 0;
  let linkCount = 0;
  const used = []; // variables du script, dans l'ordre de première utilisation (comme l'en-tête « var » de Blockly)
  const usedKeys = new Set();

  // Procédures : paramètres connus pour les appels sans extraState.params
  const procParams = new Map();
  const paramName = (p) => (typeof p === 'string' ? p : String(p?.name ?? ''));
  for (const b of tops) {
    if (b.type?.startsWith('procedures_def')) procParams.set(String(b.fields?.NAME ?? ''), asArray(b.extraState?.params).map(paramName));
  }

  const varNameOf = (f) => {
    if (f == null) return '';
    if (typeof f === 'object') return String(varById.get(f.id) ?? f.name ?? f.id ?? '');
    return String(varById.has(f) ? varById.get(f) : f);
  };
  const noteVar = (name) => {
    const k = name.toLowerCase();
    if (usedKeys.has(k)) return;
    usedKeys.add(k);
    used.push(name);
  };

  function mk(type, o = {}) {
    const n = { id: 'n' + ++nodeCount, type, x: 0, y: 0, fields: o.fields || {}, values: o.values || {}, extra: o.extra || {} };
    nodes.push(n);
    byId.set(n.id, n);
    return n;
  }
  function link(from, fromPin, to, toPin) {
    links.push({ id: 'l' + ++linkCount, from, fromPin, to, toPin });
  }

  // ---- valeurs

  /** Valeur d'une entrée : { lit } (littéral), { ref: [id, pin] } (fil) ou null (vide). */
  function convValue(inp, scope) {
    const b = inp?.block ?? inp?.shadow;
    if (!b || isDisabled(b)) return null;
    switch (b.type) {
      case 'math_number': {
        const v = Number(b.fields?.NUM);
        return { lit: Number.isFinite(v) ? v : Number.isNaN(v) ? 0 : String(v) }; // ±Infinity ne passe pas en JSON
      }
      case 'text': return { lit: String(b.fields?.TEXT ?? '') };
      case 'logic_boolean': return { lit: b.fields?.BOOL === 'TRUE' };
      case 'pf_colour': return { lit: String(b.fields?.COL ?? '#ff8040') };
      case 'pf_dt': return scope.eventType === 'pf_on_update' ? { ref: [scope.eventId, 'dt'] } : { lit: 0 };
      case 'pf_other': return COLLIDE_EVENTS.includes(scope.eventType) ? { ref: [scope.eventId, 'other'] } : { ref: [mk('logic_null').id, 'out'] };
      case 'pf_msg_data': return scope.eventType === 'pf_on_message' ? { ref: [scope.eventId, 'data'] } : { ref: [mk('logic_null').id, 'out'] };
      case 'variables_get': {
        const name = varNameOf(b.fields?.VAR);
        const p = scope.params?.get(name.toLowerCase());
        if (p) return { ref: [scope.fnId, 'ARG' + p.index] };
        noteVar(name);
        return { ref: [mk('var_get', { fields: { NAME: name } }).id, 'out'] };
      }
      default: return { ref: [convPure(b, scope).id, 'out'] };
    }
  }

  /** Branche une entrée de valeur d'un bloc sur le nœud `n` (pin = nom de la broche). */
  function setInput(n, pin, inp, scope) {
    const v = convValue(inp, scope);
    if (!v) {
      const d = EMPTY[n.type]?.[pin];
      if (d !== undefined) n.values[pin] = d;
      return false;
    }
    if (hasKey(v, 'lit')) n.values[pin] = v.lit;
    else link(v.ref[0], v.ref[1], n.id, pin);
    return true;
  }

  /** Copie les champs connus de la spec ; les champs numériques deviennent des nombres. */
  function copyFields(n, b) {
    for (const f of resolvePins(n, null).fields) {
      const v = b.fields?.[f.name];
      if (v === undefined) continue;
      n.fields[f.name] = f.kind === 'number' ? Number(v) : v;
    }
  }

  /** Extra (broches dynamiques) d'un bloc standard / personnalisé. */
  function dynamicExtra(type, b) {
    const es = b.extraState;
    if (type === 'text_join') return { items: Number(es?.itemCount ?? 2) };
    if (type === 'lists_create_with') return { items: Number(es?.itemCount ?? 3) };
    if (type === 'pf_dict') return { items: Number(es?.items ?? 0) };
    return defaultExtra(type);
  }

  /** Bloc valeur (pur) → nœud ; les entrées sont branchées. */
  function convPure(b, scope) {
    if (b.type === 'variables_get') {
      const name = varNameOf(b.fields?.VAR);
      noteVar(name);
      return mk('var_get', { fields: { NAME: name } });
    }
    let type = RENAME[b.type] || b.type;
    if (getSpec(type)?.kind !== 'pure') type = 'logic_null'; // bloc inconnu : valeur vide
    const n = mk(type);
    n.extra = dynamicExtra(type, b);
    if (type === 'fn_call_value') callExtra(n, b);
    copyFields(n, b);
    if (type === 'pf_tile_info') {
      const v = scope.eventType === 'pf_on_hit_tile' ? { ref: [scope.eventId, 'tile'] } : null;
      if (v) link(v.ref[0], v.ref[1], n.id, 'TILE');
    }
    inputsOf(n, b, scope);
    return n;
  }

  function callExtra(n, b) {
    const name = String(b.extraState?.name ?? b.fields?.NAME ?? '');
    let params = asArray(b.extraState?.params).map(paramName);
    if (!params.length) {
      params = procParams.get(name) || [];
      if (!params.length) for (let i = 0; b.inputs?.['ARG' + i]; i++) params.push('arg' + (i + 1));
    }
    n.extra = { name, params };
  }

  /** Branche toutes les entrées de valeur du nœud depuis les inputs du bloc (dans l'ordre du JSON). */
  function inputsOf(n, b, scope) {
    const { inputs } = resolvePins(n, null);
    const names = new Set(inputs.map((p) => p.name));
    if (n.type === 'logic_operation') return logicOperation(n, b, scope);
    // ordre des entrées du bloc (pour que l'ordre de rencontre des variables suive celui de Blockly)
    const order = Object.keys(b.inputs || {}).filter((k) => names.has(k));
    for (const k of inputs.map((p) => p.name)) if (!order.includes(k) && names.has(k) && inputs.find((p) => p.name === k).type !== 'exec') order.push(k);
    for (const k of order) setInput(n, k, b.inputs?.[k], scope);
  }

  // « et » / « ou » : une entrée vide vaut true (et) / false (ou) si l'autre est remplie
  function logicOperation(n, b, scope) {
    const and = b.fields?.OP !== 'OR';
    const a = convValue(b.inputs?.A, scope);
    // l'évaluation de B se fait après A pour garder l'ordre des variables
    const bb = convValue(b.inputs?.B, scope);
    for (const [pin, v] of [['A', a], ['B', bb]]) {
      if (v == null) n.values[pin] = and && (a != null || bb != null) ? true : false;
      else if (hasKey(v, 'lit')) n.values[pin] = v.lit;
      else link(v.ref[0], v.ref[1], n.id, pin);
    }
  }

  // ---- instructions

  function statementInput(from, pin, inp, scope) {
    const b = inp?.block ?? null;
    if (!b) return;
    const r = convStack(b, scope);
    if (r.entry) link(from, pin, r.entry, 'exec');
  }

  /** Pile d'instructions → { entry, exit: { id, pin } | null }. */
  function convStack(first, scope) {
    let entry = null;
    let exit = null;
    for (let b = first; b; b = b.next?.block) {
      const r = isDisabled(b) ? null : convStmt(b, scope);
      if (!r) continue;
      if (exit) link(exit.id, exit.pin, r.entry, 'exec');
      else entry = r.entry;
      exit = r.exit;
      if (!exit) break;
    }
    return { entry, exit };
  }

  const one = (n) => ({ entry: n.id, exit: { id: n.id, pin: 'then' } });

  function convStmt(b, scope) {
    switch (b.type) {
      case 'controls_if': return convIf(b, scope);
      case 'controls_repeat_ext':
      case 'controls_repeat': {
        const n = mk('flow_repeat');
        if (b.type === 'controls_repeat') n.values.TIMES = Number(b.fields?.TIMES) || 0;
        else setInput(n, 'TIMES', b.inputs?.TIMES, scope);
        statementInput(n.id, 'body', b.inputs?.DO, scope);
        return one(n);
      }
      case 'controls_whileUntil': {
        const n = mk('flow_while');
        const c = convValue(b.inputs?.BOOL, scope);
        if (b.fields?.MODE === 'UNTIL') {
          const neg = mk('logic_negate');
          if (c) { if (hasKey(c, 'lit')) neg.values.BOOL = c.lit; else link(c.ref[0], c.ref[1], neg.id, 'BOOL'); }
          link(neg.id, 'out', n.id, 'COND');
        } else if (c) {
          if (hasKey(c, 'lit')) n.values.COND = c.lit; else link(c.ref[0], c.ref[1], n.id, 'COND');
        }
        statementInput(n.id, 'body', b.inputs?.DO, scope);
        return one(n);
      }
      case 'controls_for': {
        const name = varNameOf(b.fields?.VAR) || 'i';
        noteVar(name);
        const n = mk('flow_for', { fields: { VAR: name } });
        for (const k of ['FROM', 'TO', 'BY']) setInput(n, k, b.inputs?.[k], scope);
        statementInput(n.id, 'body', b.inputs?.DO, scope);
        return one(n);
      }
      case 'controls_forEach': {
        const name = varNameOf(b.fields?.VAR) || 'item';
        noteVar(name);
        const n = mk('flow_for_each', { fields: { VAR: name } });
        setInput(n, 'LIST', b.inputs?.LIST, scope);
        statementInput(n.id, 'body', b.inputs?.DO, scope);
        return one(n);
      }
      case 'controls_flow_statements': {
        const n = mk(b.fields?.FLOW === 'CONTINUE' ? 'flow_continue' : 'flow_break');
        return { entry: n.id, exit: null };
      }
      case 'variables_set':
      case 'math_change': {
        const name = varNameOf(b.fields?.VAR);
        const isSet = b.type === 'variables_set';
        const p = scope.params?.get(name.toLowerCase());
        if (!p) noteVar(name);
        const n = mk(isSet ? 'var_set' : 'var_change', { fields: { NAME: name } });
        setInput(n, isSet ? 'VALUE' : 'DELTA', b.inputs?.[isSet ? 'VALUE' : 'DELTA'], scope);
        return one(n);
      }
      case 'procedures_callnoreturn': {
        const n = mk('fn_call');
        callExtra(n, b);
        inputsOf(n, b, scope);
        return one(n);
      }
      case 'procedures_ifreturn': {
        const n = mk('flow_branch');
        setInput(n, 'COND', b.inputs?.CONDITION, scope);
        const r = mk('fn_return');
        const hasValue = b.extraState && (/value="1"/.test(String(b.extraState)) || b.extraState.hasReturnValue === true || b.extraState.value === true || b.extraState.value === 1);
        if (hasValue || b.inputs?.VALUE) {
          if (!setInput(r, 'VALUE', b.inputs?.VALUE, scope)) r.values.VALUE = null;
        }
        link(n.id, 'true', r.id, 'exec');
        return one(n);
      }
      case 'pf_destroy_other': {
        if (!COLLIDE_EVENTS.includes(scope.eventType)) return null; // hors collision : Blockly ne produisait rien
        const n = mk('pf_destroy_other');
        link(scope.eventId, 'other', n.id, 'OTHER');
        return one(n);
      }
      case 'lists_getIndex': {
        const n = mk('lists_removeIndex');
        copyFields(n, b);
        inputsOf(n, b, scope);
        return one(n);
      }
      default: {
        const type = getSpec(b.type) ? b.type : null;
        if (!type || getSpec(type).kind !== 'exec') return null; // bloc inconnu ou valeur posée comme instruction
        const n = mk(type);
        n.extra = dynamicExtra(type, b);
        copyFields(n, b);
        inputsOf(n, b, scope);
        if (type === 'pf_wait') statementInput(n.id, 'done', b.inputs?.DO, scope);
        return one(n);
      }
    }
  }

  function convIf(b, scope) {
    const inputs = b.inputs || {};
    let count = 0;
    while (inputs['IF' + count] || inputs['DO' + count]) count++;
    count = Math.max(count, 1);
    let first = null;
    let prev = null;
    for (let i = 0; i < count; i++) {
      const n = mk('flow_branch');
      setInput(n, 'COND', inputs['IF' + i], scope);
      statementInput(n.id, 'true', inputs['DO' + i], scope);
      if (prev) link(prev.id, 'false', n.id, 'exec'); else first = n;
      prev = n;
    }
    statementInput(prev.id, 'false', inputs.ELSE, scope);
    return { entry: first.id, exit: { id: first.id, pin: 'then' } };
  }

  // ---- blocs de haut niveau

  const groups = [];
  for (const b of tops) {
    if (isDisabled(b)) continue;
    const g = { x: Number(b.x) || 0, y: Number(b.y) || 0, root: null, isRoot: false };
    const type = b.type;
    if (type === 'procedures_defnoreturn' || type === 'procedures_defreturn') {
      const names = asArray(b.extraState?.params).map(paramName);
      const n = mk('fn_def', { fields: { NAME: String(b.fields?.NAME ?? '') }, extra: { params: names } });
      const params = new Map();
      names.forEach((p, index) => params.set(p.toLowerCase(), { index }));
      const scope = { fnId: n.id, params, eventId: null, eventType: null };
      // les paramètres sont déclarés avant le corps ; le corps puis la valeur de retour
      const r = convStack(b.inputs?.STACK?.block ?? null, scope);
      let exit = { id: n.id, pin: 'then' };
      if (r.entry) { link(n.id, 'then', r.entry, 'exec'); exit = r.exit; }
      const rv = type === 'procedures_defreturn' && exit ? convValue(b.inputs?.RETURN, scope) : null;
      if (rv) {
        const ret = mk('fn_return');
        if (hasKey(rv, 'lit')) ret.values.VALUE = rv.lit; else link(rv.ref[0], rv.ref[1], ret.id, 'VALUE');
        link(exit.id, exit.pin, ret.id, 'exec');
      }
      g.root = n.id;
      g.isRoot = true;
    } else if (getSpec(type)?.kind === 'event') {
      const n = mk(type);
      copyFields(n, b);
      const scope = { eventId: n.id, eventType: type, params: null, fnId: null };
      statementInput(n.id, 'then', b.inputs?.DO, scope);
      g.root = n.id;
      g.isRoot = true;
    } else {
      // bloc isolé : conservé tel quel, sans événement (non compilé)
      const scope = { eventId: null, eventType: null, params: null, fnId: null };
      if (getSpec(RENAME[type] || type)?.kind === 'pure' || type === 'variables_get') g.root = convPure(b, scope).id;
      else g.root = convStack(b, scope).entry;
    }
    if (g.root) groups.push(g);
  }

  // L'en-tête « var » de Blockly suit un parcours en largeur de tous les blocs (getAllBlocks) : on garde cet ordre
  const order = [];
  {
    const queue = [...tops];
    const seen = new Set();
    const add = (name) => {
      const k = name.toLowerCase();
      if (name && !seen.has(k)) { seen.add(k); order.push(k); }
    };
    for (let i = 0; i < queue.length; i++) {
      const b = queue[i];
      if (b.fields && b.fields.VAR !== undefined) add(varNameOf(b.fields.VAR));
      if (b.type?.startsWith('procedures_def')) for (const p of asArray(b.extraState?.params)) add(paramName(p));
      for (const inp of Object.values(b.inputs || {})) {
        const c = inp?.block ?? inp?.shadow;
        if (c) queue.push(c);
      }
      if (b.next?.block) queue.push(b.next.block);
    }
  }
  const names = new Map(used.map((n) => [n.toLowerCase(), n]));
  const variables = [...order.filter((k) => names.has(k)), ...[...names.keys()].filter((k) => !order.includes(k))].map((k) => ({ name: names.get(k) }));

  const graph = { version: 1, nodes, links, variables, comments: [] };
  layout(graph, groups);
  return graph;
}

// ---------------------------------------------------------------- mise en page

const GAP_X = 56; // entre deux nœuds d'exécution
const PURE_GAP = 40; // entre un nœud et les nœuds de données qui l'alimentent
const PURE_DY = 56; // les nœuds de données sont posés sous la rangée des broches d'exécution (le fil blanc reste libre)
const GAP_Y = 24; // entre deux nœuds empilés
const GROUP_MARGIN = 60;
const SCALE = 1.5;
const ORIGIN = 40;

function layout(graph, groups) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const sizes = new Map();
  const size = (n) => {
    let s = sizes.get(n.id);
    if (!s) { s = estimateNodeSize(n, graph); sizes.set(n.id, s); }
    return s;
  };
  const execOut = new Map(); // id -> Map(pin -> id cible)
  const dataIn = new Map(); // id -> [{ from, pin }] dans l'ordre des broches
  for (const l of graph.links) {
    if (l.toPin === 'exec') {
      if (!execOut.has(l.from)) execOut.set(l.from, new Map());
      execOut.get(l.from).set(l.fromPin, l.to);
    } else {
      if (!dataIn.has(l.to)) dataIn.set(l.to, []);
      dataIn.get(l.to).push({ from: l.from, pin: l.toPin });
    }
  }
  const target = (id, pin) => execOut.get(id)?.get(pin) ?? null;

  const pos = new Map(); // positions relatives au groupe courant

  // Arbre de nœuds purs branchés sur les entrées d'un nœud : { id, w, h, kids }
  function measure(id, seen) {
    const n = nodes.get(id);
    const sz = size(n);
    const kids = [];
    for (const d of dataIn.get(id) || []) {
      const src = nodes.get(d.from);
      if (!src || getSpec(src.type)?.kind !== 'pure' || pos.has(d.from) || seen.has(d.from)) continue;
      seen.add(d.from);
      kids.push(measure(d.from, seen));
    }
    const kw = kids.length ? Math.max(...kids.map((k) => k.w)) + PURE_GAP : 0;
    const kh = kids.reduce((a, k) => a + k.h, 0) + Math.max(0, kids.length - 1) * GAP_Y;
    return { id, w: sz.w + kw, h: Math.max(sz.h, kh), kids };
  }
  function place(tree, right, top) {
    const sz = size(nodes.get(tree.id));
    const x = right - sz.w;
    pos.set(tree.id, { x, y: top });
    let y = top;
    for (const k of tree.kids) {
      place(k, x - PURE_GAP, y);
      y += k.h + GAP_Y;
    }
  }
  // Entrées de données (nœuds purs) d'un nœud d'exécution : à gauche, empilées
  function measureInputs(id) {
    const seen = new Set();
    const kids = [];
    for (const d of dataIn.get(id) || []) {
      const src = nodes.get(d.from);
      if (!src || getSpec(src.type)?.kind !== 'pure' || pos.has(d.from) || seen.has(d.from)) continue;
      seen.add(d.from);
      kids.push(measure(d.from, seen));
    }
    const w = kids.length ? Math.max(...kids.map((k) => k.w)) : 0;
    const h = kids.reduce((a, k) => a + k.h, 0) + Math.max(0, kids.length - 1) * GAP_Y;
    return { kids, w, h };
  }

  /** Chaîne d'exécution de gauche à droite ; les corps (Vrai/Faux/Corps/Terminé…) sont empilés à droite du nœud. */
  function chain(startId, x0, y0) {
    let x = x0;
    let h = 0;
    let right = x0;
    let id = startId;
    let placed = false;
    while (id != null && !pos.has(id)) {
      const n = nodes.get(id);
      if (!n) break;
      const sz = size(n);
      const mi = measureInputs(id);
      const nx = x + (mi.w ? mi.w + PURE_GAP : 0);
      pos.set(id, { x: nx, y: y0 });
      let y = y0 + PURE_DY;
      for (const k of mi.kids) {
        place(k, nx - PURE_GAP, y);
        y += k.h + GAP_Y;
      }
      placed = true;
      let rowH = Math.max(sz.h, mi.kids.length ? PURE_DY + mi.h : 0);
      const bodyPins = getSpec(n.type) ? resolvePins(n, graph).outputs.filter((p) => p.type === 'exec' && p.name !== 'then').map((p) => p.name) : [];
      const bx = nx + sz.w + GAP_X;
      let by = y0;
      let bodyW = 0;
      let any = false;
      for (const pin of bodyPins) {
        const t = target(id, pin);
        if (t == null || pos.has(t)) continue;
        const r = chain(t, bx, by);
        if (r.w === 0) continue;
        any = true;
        bodyW = Math.max(bodyW, r.w);
        by += r.h + GAP_Y;
      }
      if (any) rowH = Math.max(rowH, by - GAP_Y - y0);
      right = Math.max(right, nx + sz.w, any ? bx + bodyW : 0);
      h = Math.max(h, rowH);
      x = (any ? bx + bodyW : nx + sz.w) + GAP_X;
      const spec = getSpec(n.type);
      id = spec?.outputs.some((p) => p.name === 'then') ? target(id, 'then') : null;
    }
    return { w: placed ? right - x0 : 0, h };
  }

  const placedRects = [];
  const placedAll = new Set();
  let lastRootY = -Infinity;
  // même ordre que Blockly (getTopBlocks(true)) : le code des événements suit l'ordre vertical des nœuds
  const SCAN = Math.sin((3 * Math.PI) / 180);
  const ordered = [...groups].sort((a, b) => a.y + SCAN * a.x - (b.y + SCAN * b.x));
  for (const g of ordered) {
    pos.clear();
    const root = nodes.get(g.root);
    let rect;
    if (getSpec(root.type)?.kind === 'pure') {
      const tree = measure(g.root, new Set([g.root]));
      place(tree, tree.w, 0);
      rect = { w: tree.w, h: tree.h };
    } else {
      const r = chain(g.root, 0, 0);
      rect = { w: r.w, h: r.h };
    }
    // recadre le groupe sur (0, 0)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;
    for (const [id, p] of pos) {
      const sz = size(nodes.get(id));
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + sz.w);
      maxY = Math.max(maxY, p.y + sz.h);
    }
    if (!pos.size) continue;
    const w = Math.max(rect.w, maxX - minX);
    const h = Math.max(rect.h, maxY - minY);
    let gx = ORIGIN + g.x * SCALE;
    let gy = ORIGIN + g.y * SCALE;
    if (g.isRoot && gy <= lastRootY) gy = lastRootY + 1;
    // pas de chevauchement avec les groupes déjà placés
    for (let guard = 0; guard < 1000; guard++) {
      const hit = placedRects.find((r) => gx < r.x + r.w + GROUP_MARGIN && r.x < gx + w + GROUP_MARGIN && gy < r.y + r.h + GROUP_MARGIN && r.y < gy + h + GROUP_MARGIN);
      if (!hit) break;
      gy = hit.y + hit.h + GROUP_MARGIN;
    }
    if (g.isRoot) lastRootY = gy;
    placedRects.push({ x: gx, y: gy, w, h });
    for (const [id, p] of pos) {
      const n = nodes.get(id);
      n.x = Math.round(gx + p.x - minX);
      n.y = Math.round(gy + p.y - minY);
    }
    for (const id of pos.keys()) placedAll.add(id);
  }
  // nœuds non placés (liens atypiques) : rangés sous le reste
  let bottom = placedRects.reduce((m, r) => Math.max(m, r.y + r.h), 0) + GROUP_MARGIN;
  for (const n of graph.nodes) {
    if (placedAll.has(n.id)) continue;
    n.x = ORIGIN;
    n.y = Math.round(bottom);
    bottom += size(n).h + GAP_Y;
  }
}
