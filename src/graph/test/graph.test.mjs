// Test du noyau Blueprint : node src/graph/test/graph.test.mjs  (aucun framework)
//  (a) chaque script Blockly de référence (fixtures/legacy-scripts.json : Tetris, pièce et drapeau de l'exemple) : code Blockly == compileGraph(blocklyToGraph(blocs))
//      + les scripts « graph » des jeux de games/ et de l'exemple se recompilent à l'identique de script.code
//  (b) chaque code compilé passe new Function('self','game','input','on', code)
//  (c) blocs synthétiques (un par nœud et par option) + graphes écrits à la main (branch, sequence, for, delay, fn, variables, erreurs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { compileGraph, Order } = await imp('src/graph/compile.js');
const { blocklyToGraph, estimateNodeSize } = await imp('src/graph/fromBlockly.js');
const nodesApi = await imp('src/graph/nodes.js');
const { getSpec, listSpecs, resolvePins, createNode, isCompatible, fieldOptions, CATEGORIES, PIN_COLORS } = nodesApi;

// Blockly (référence, devDependency : uniquement pour ce test). Si l'import échoue sous node, on retombe sur script.code.
let BK = null;
try {
  BK = await imp('src/graph/test/legacy-blocks.js');
} catch (e) {
  console.log('! Blockly indisponible sous node (' + e.message + ') : comparaison avec script.code');
}

let failures = 0;
let checks = 0;
const fail = (msg) => { failures++; console.log('  ECHEC ' + msg); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };

// ---------------------------------------------------------------- aides

const norm = (code) => code.replace(/\s+/g, ' ').trim();

/** Retire de l'en-tête « var a, b; » les noms de paramètres de fonctions (variables Blockly sans objet dans le graphe). */
function stripHeader(code) {
  const params = new Set();
  for (const m of code.matchAll(/function\s+\w+\(([^)]*)\)/g)) for (const p of m[1].split(',')) if (p.trim()) params.add(p.trim());
  return code.replace(/^var ([^;\n]*);/, (all, list) => {
    const keep = list.split(',').map((s) => s.trim()).filter((s) => s && !params.has(s));
    return keep.length ? `var ${keep.join(', ')};` : '';
  });
}

// Différences cosmétiques connues entre les deux générateurs (voir le compte rendu) : appliquées aux DEUX codes
const COSMETIC = [
  [/ else \{ \}/g, ''], // « sinon » vide : Blockly le garde, le graphe ne peut pas le représenter
  [/(\.splice\([^;]*?, 1\);)(?=\S)/g, '$1 '], // Blockly oublie le retour à la ligne après « retirer depuis la fin »
];
// « else { if (…) {…} } » (si imbriqué dans un sinon) == « else if (…) {…} » : le graphe produit toujours la seconde forme
function matching(code, open) {
  const o = code[open];
  const c = o === '(' ? ')' : '}';
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === o) depth++;
    else if (code[i] === c && --depth === 0) return i;
  }
  return -1;
}
function collapseElseIf(code) {
  let i = code.indexOf('else { if (');
  while (i !== -1) {
    const open = i + 5;
    const end = matching(code, open);
    let ok2 = end !== -1;
    if (ok2) {
      // le contenu doit être exactement une chaîne if / else if / else
      let p = open + 2;
      for (;;) {
        const paren = code.indexOf('(', p);
        const pe = matching(code, paren);
        const brace = code.indexOf('{', pe);
        const be = matching(code, brace);
        if (pe === -1 || be === -1) { ok2 = false; break; }
        p = be + 1;
        const rest = code.slice(p, end).trim();
        if (rest === '') break;
        if (rest.startsWith('else if (')) { p = code.indexOf('else if (', p) + 5; continue; }
        if (rest.startsWith('else {')) { const eb = code.indexOf('{', p); const ee = matching(code, eb); ok2 = ee !== -1 && code.slice(ee + 1, end).trim() === ''; break; }
        ok2 = false;
        break;
      }
    }
    if (ok2) code = code.slice(0, i) + 'else ' + code.slice(open + 2, end).trim() + code.slice(end + 1);
    const next = code.indexOf('else { if (', ok2 ? i : i + 1);
    i = next;
  }
  return code;
}
const canon = (code) => collapseElseIf(COSMETIC.reduce((c, [re, r]) => c.replace(re, r), norm(stripHeader(code))));

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 50);
  return `\n      Blockly : ...${a.slice(from, i + 90)}\n      graphe  : ...${b.slice(from, i + 90)}`;
}

/** Corrige les sérialisations écrites à la main : champs VAR donnés par nom (sans liste `variables`) → ids. */
function withVariables(json) {
  const copy = JSON.parse(JSON.stringify(json));
  const names = new Map((copy.variables || []).map((v) => [v.id, v.name]));
  const byName = new Map((copy.variables || []).map((v) => [v.name, v.id]));
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.fields && typeof n.fields.VAR === 'string' && !names.has(n.fields.VAR)) {
      const name = n.fields.VAR;
      if (!byName.has(name)) { byName.set(name, 'v_' + name); names.set('v_' + name, name); (copy.variables ||= []).push({ name, id: 'v_' + name }); }
      n.fields.VAR = { id: byName.get(name) };
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(copy);
  return copy;
}

function blocklyCode(json, project, objectId) {
  BK.setBlocksContext({ getProject: () => project, objectId, isGlobal: false });
  BK.prepareState(json);
  const ws = new BK.Blockly.Workspace();
  try {
    BK.Blockly.serialization.workspaces.load(json, ws);
    return BK.generateCode(ws);
  } finally {
    ws.dispose();
  }
}

const EMPTY_PROJECT = { objects: [], maps: [], sprites: [], sounds: [] };
const compile = (json, isGlobal = false) => compileGraph(blocklyToGraph(json), { isGlobal });

function checkSyntax(code, label) {
  try {
    new Function('self', 'game', 'input', 'on', code); // eslint-disable-line no-new-func
    checks++;
  } catch (e) {
    fail(`${label} : code compilé invalide (${e.message})`);
  }
}

// ---------------------------------------------------------------- (a) scripts réels

console.log('(a) scripts Blockly de référence');
// { label, script: { mode: 'blocks', code, blocks }, project (allégé), objectId, isGlobal }
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/graph/test/fixtures/legacy-scripts.json'), 'utf8'))
  .map((x) => ({ label: x.label, script: { mode: 'blocks', code: x.code, blocks: x.blocks }, project: x.project, objectId: x.objectId, isGlobal: x.isGlobal }));

let nBlocks = 0;
for (const s of scripts) {
  if (s.script?.mode !== 'blocks' || !s.script.blocks) continue;
  nBlocks++;
  let ref;
  if (BK) {
    try { ref = blocklyCode(withVariables(s.script.blocks), s.project, s.objectId); } catch (e) { console.log(`  ! ${s.label} : Blockly a échoué (${e.message.split('\n')[0]}), on utilise script.code`); }
  }
  ref ??= s.script.code;
  const r = compile(s.script.blocks, s.isGlobal);
  console.log(`  - ${s.label} : ${r.code.split('\n').length} lignes, ${r.errors.length} erreur(s), ${r.warnings.length} avertissement(s)`);
  for (const e of r.errors) console.log('      erreur : ' + e.message);
  ok(r.errors.length === 0, `${s.label} : erreurs de compilation`);
  const a = canon(ref);
  const b = canon(r.code);
  if (a !== b) fail(`${s.label} : code différent de Blockly${firstDiff(a, b)}`);
  else checks++;
  checkSyntax(r.code, s.label);
}
ok(nBlocks > 0, 'aucun script Blockly de référence trouvé');

// scripts en mode graph (jeux de games/ + exemple) : le code enregistré est celui que produit le compilateur
console.log('(a2) scripts graphe des jeux');
{
  // createSampleProject utilise un canvas : on le simule
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(v) {} }), toDataURL: () => 'data:image/png;base64,' }),
  };
  const { createSampleProject } = await imp('src/core/sample.js');
  const projects = [['sample', createSampleProject()]];
  const gamesDir = path.join(ROOT, 'games');
  for (const f of fs.readdirSync(gamesDir).filter((x) => x.endsWith('.pixelforge.json'))) projects.push([f, JSON.parse(fs.readFileSync(path.join(gamesDir, f), 'utf8'))]);
  let n = 0;
  for (const [name, p] of projects) {
    const list = [...(p.objects || []).map((o) => [o.name, o.script, false]), ['global', p.globalScript, true]];
    for (const [label, script, isGlobal] of list) {
      if (script?.mode !== 'graph') continue;
      n++;
      const r = compileGraph(script.graph, { isGlobal });
      ok(r.errors.length === 0, `${name} / ${label} : erreurs de compilation`);
      ok(r.code === script.code, `${name} / ${label} : script.code différent du code compilé`);
      checkSyntax(r.code, `${name} / ${label}`);
    }
  }
  ok(n > 0, 'aucun script graphe trouvé');
  console.log(`  ${n} scripts graphe vérifiés`);
}

// ---------------------------------------------------------------- (c1) blocs synthétiques : un par nœud et par option

console.log('(c1) blocs synthétiques (comparaison avec Blockly)');
const PROJECT = {
  objects: [{ id: 'o1', name: 'Foo', spriteId: 's1' }, { id: 'o2', name: 'Bar', spriteId: 's1' }],
  maps: [{ id: 'm1', name: 'Niveau 1', layers: [{ name: 'Sol' }, { name: 'Déco' }] }, { id: 'm2', name: 'Niveau 2', layers: [] }],
  sprites: [{ id: 's1', animations: [{ name: 'idle' }, { name: 'run' }] }],
  sounds: [{ name: 'boum' }],
};
const num = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const txt = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
const bool = (v) => ({ block: { type: 'logic_boolean', fields: { BOOL: v ? 'TRUE' : 'FALSE' } } });
const find = { block: { type: 'pf_find', fields: { OBJ: 'Foo' } } };
const col = (v) => ({ shadow: { type: 'pf_colour', fields: { COL: v } } });
const B = (type, fields, inputs, extraState) => ({ block: { type, ...(fields && { fields }), ...(inputs && { inputs }), ...(extraState && { extraState }) } });
const top = (...blocks) => ({ blocks: { languageVersion: 0, blocks } });
const event = (type, fields, body) => ({ type, x: 0, y: 0, ...(fields && { fields }), inputs: { DO: body } });
const chainBlocks = (...bs) => bs.reduceRight((next, b) => (next ? { block: { ...b.block, next } } : b), null);

/** Entrée (Blockly) pour une broche d'un nœud, d'après la spec. */
function inputFor(pin) {
  switch (pin.type) {
    case 'number': return num(pin.default ?? 0);
    case 'string': return txt(pin.default ?? 'x');
    case 'boolean': return bool(pin.default ?? false);
    case 'color': return col(pin.default ?? '#ffffff');
    case 'object': return find;
    case 'list': return B('lists_create_empty');
    default:
      if (typeof pin.default === 'number') return num(pin.default);
      if (typeof pin.default === 'string') return txt(pin.default);
      return txt('v');
  }
}
const FIELD_DEFAULT = { object: 'Foo', map: 'Niveau 1', anim: 'run', sound: 'coin', layer: 'Sol', key: 'SPACE', variable: 'a' };

// Blocs à envelopper dans un événement particulier / entrées spéciales
const CTX = { pf_destroy_other: 'pf_on_collide', pf_tile_info: 'pf_on_hit_tile' };

function variantsOf(spec) {
  // une variante par option de chaque liste déroulante (les autres champs au défaut)
  const out = [{}];
  for (const f of spec.fields) {
    if (f.kind === 'dropdown') for (const o of f.options) out.push({ [f.name]: o[1] });
    else if (f.kind === 'layer') for (const l of ['', '@tile', 'Sol']) out.push({ [f.name]: l });
  }
  return out;
}

let nSynth = 0;
const synthFailures = [];
function synth(type, spec) {
  if (spec.kind === 'event') return; // couverts par les événements ci-dessous
  for (const variant of variantsOf(spec)) {
    const fields = {};
    for (const f of spec.fields) fields[f.name] = variant[f.name] ?? (f.kind === 'dropdown' ? f.default : FIELD_DEFAULT[f.kind] ?? f.default);
    const inputs = {};
    for (const p of spec.inputs) if (p.type !== 'exec' && !p.optional && p.name !== 'TILE' && p.name !== 'OTHER') inputs[p.name] = inputFor(p);
    let extra;
    if (type === 'pf_dict') {
      extra = { items: 2 };
      Object.assign(fields, { K0: 'a', K1: 'b' });
      Object.assign(inputs, { V0: num(1), V1: txt('z') });
    }
    if (type === 'pf_wait') inputs.DO = { block: { type: 'pf_log', inputs: { VALUE: txt('apres') } } };
    // pf_wait attend DO (instructions)
    const blk = B(type, fields, inputs, extra);
    let body;
    if (spec.kind === 'pure') body = { block: { type: 'pf_log', inputs: { VALUE: blk } } };
    else body = blk;
    const ev = CTX[type] || 'pf_on_update';
    const evFields = ev === 'pf_on_collide' ? { OBJ: 'Foo' } : undefined;
    const json = top(event(ev, evFields, body));
    let ref;
    try { ref = blocklyCode(json, PROJECT, 'o1'); } catch (e) { synthFailures.push(`${type} ${JSON.stringify(variant)} : Blockly a refusé (${e.message.split('\n')[0]})`); continue; }
    nSynth++;
    const r = compile(json);
    if (r.errors.length) { synthFailures.push(`${type} ${JSON.stringify(variant)} : erreurs ${r.errors.map((e) => e.message).join(' | ')}`); continue; }
    const a = canon(ref);
    const b = canon(r.code);
    if (a !== b) synthFailures.push(`${type} ${JSON.stringify(variant)} : différent${firstDiff(a, b)}`);
    else checks++;
    try { new Function('self', 'game', 'input', 'on', r.code); checks++; } catch (e) { synthFailures.push(`${type} : syntaxe (${e.message})`); }
  }
}

if (BK) {
  // blocs standard / PixelForge « un par un »
  const STD = new Set(['var_get', 'var_set', 'var_change', 'fn_call', 'fn_call_value', 'fn_return', 'fn_def', 'lists_removeIndex', 'lists_getIndex', 'lists_setIndex', 'math_number_property', 'pf_mouse_delta', 'pf_pointer_lock']);
  for (const spec of listSpecs()) {
    if (spec.type.startsWith('flow_') || STD.has(spec.type) || (spec.dims && !spec.dims.includes('2d'))) continue;
    synth(spec.type, spec);
  }
  // événements
  const events = listSpecs().filter((s) => s.kind === 'event' && s.type.startsWith('pf_on_'));
  for (const spec of events) {
    const fields = {};
    for (const f of spec.fields) fields[f.name] = FIELD_DEFAULT[f.kind] ?? f.default;
    const json = top(event(spec.type, fields, B('pf_log', null, { VALUE: txt('x') })));
    const ref = blocklyCode(json, PROJECT, 'o1');
    const r = compile(json);
    nSynth++;
    const a = canon(ref);
    const b = canon(r.code);
    if (r.errors.length || a !== b) synthFailures.push(`${spec.type} : ${r.errors.map((e) => e.message).join('|') || 'différent' + firstDiff(a, b)}`);
    else checks++;
  }
  // number_property (diviseur seulement pour DIVISIBLE_BY)
  for (const prop of ['EVEN', 'ODD', 'PRIME', 'WHOLE', 'POSITIVE', 'NEGATIVE', 'DIVISIBLE_BY']) {
    const inputs = { NUMBER_TO_CHECK: num(5) };
    if (prop === 'DIVISIBLE_BY') inputs.DIVISOR = num(3);
    const extra = prop === 'DIVISIBLE_BY' ? '<mutation divisor_input="true"></mutation>' : undefined;
    const json = top(event('pf_on_update', null, B('pf_log', null, { VALUE: B('math_number_property', { PROPERTY: prop }, inputs, extra) })));
    const ref = blocklyCode(json, PROJECT, 'o1');
    const r = compile(json);
    nSynth++;
    const a = canon(ref);
    const b = canon(r.code);
    if (r.errors.length || a !== b) synthFailures.push(`math_number_property ${prop} : ${r.errors.map((e) => e.message).join('|') || 'différent' + firstDiff(a, b)}`);
    else checks++;
  }
  console.log(`  ${nSynth} blocs comparés`);
  for (const m of synthFailures) fail(m);
}

// ---------------------------------------------------------------- (c2) programmes Blockly composés (priorités, variables, boucles, listes…)

console.log('(c2) programmes Blockly composés');
const V = (id) => ({ block: { type: 'variables_get', fields: { VAR: { id } } } });
const VARS = [{ name: 'compteur', id: 'v1' }, { name: 'liste', id: 'v2' }, { name: 'i', id: 'v3' }, { name: 'count', id: 'v4' }, { name: 'data', id: 'v5' }];
const arith = (op, a, b) => ({ block: { type: 'math_arithmetic', fields: { OP: op }, inputs: { A: a, B: b } } });
const cmp = (op, a, b) => ({ block: { type: 'logic_compare', fields: { OP: op }, inputs: { A: a, B: b } } });
const logic = (op, a, b) => ({ block: { type: 'logic_operation', fields: { OP: op }, inputs: { A: a, B: b } } });
const log = (v, next) => ({ block: { type: 'pf_log', inputs: { VALUE: v }, ...(next && { next }) } });
const setv = (id, v, next) => ({ block: { type: 'variables_set', fields: { VAR: { id } }, inputs: { VALUE: v }, ...(next && { next }) } });
const listWith = (...items) => ({ block: { type: 'lists_create_with', extraState: { itemCount: items.length }, inputs: Object.fromEntries(items.map((x, i) => ['ADD' + i, x])) } });
const prog = (label, bodyBlock, extraTops = [], vars = VARS, evType = 'pf_on_update', evFields) => ({
  label,
  json: { ...top(...extraTops, event(evType, evFields, bodyBlock)), variables: vars },
});

const PROGS = [
  prog('priorités - / +', log(arith('MINUS', num(1), arith('MINUS', num(2), num(3))))),
  prog('priorités + imbriqué', log(arith('ADD', arith('ADD', num(1), num(2)), arith('MULTIPLY', num(3), arith('ADD', num(4), num(5)))))),
  prog('puissance et division', log(arith('DIVIDE', arith('POWER', num(2), num(3)), arith('MINUS', num(5), num(-1))))),
  prog('négation', log({ block: { type: 'math_single', fields: { OP: 'NEG' }, inputs: { NUM: num(-4) } } })),
  prog('math_single / trig', log(arith('ADD', { block: { type: 'math_single', fields: { OP: 'LOG10' }, inputs: { NUM: num(100) } } }, { block: { type: 'math_trig', fields: { OP: 'SIN' }, inputs: { NUM: arith('ADD', num(30), num(60)) } } }))),
  prog('modulo/round/constrain', log(arith('ADD', { block: { type: 'math_modulo', inputs: { DIVIDEND: arith('ADD', num(5), num(6)), DIVISOR: num(3) } } }, { block: { type: 'math_constrain', inputs: { VALUE: { block: { type: 'math_round', fields: { OP: 'ROUNDUP' }, inputs: { NUM: num(3.2) } } }, LOW: num(0), HIGH: num(9) } } }))),
  prog('constantes & random', log(arith('ADD', { block: { type: 'math_constant', fields: { CONSTANT: 'GOLDEN_RATIO' } } }, arith('ADD', { block: { type: 'math_random_float' } }, { block: { type: 'math_random_int', inputs: { FROM: num(1), TO: num(6) } } })))),
  prog('compare / logique', { block: { type: 'controls_if', inputs: { IF0: logic('OR', logic('AND', cmp('LT', num(1), num(2)), cmp('NEQ', num(3), num(4))), { block: { type: 'logic_negate', inputs: { BOOL: logic('AND', bool(true), bool(false)) } } }), DO0: log(txt('a')) } } }),
  prog('if / sinon si / sinon', { block: { type: 'controls_if', extraState: { elseIfCount: 2, hasElse: true }, inputs: { IF0: bool(true), DO0: log(txt('a')), IF1: cmp('EQ', V('v1'), num(1)), DO1: log(txt('b')), IF2: bool(false), DO2: log(txt('c')), ELSE: log(txt('d')) } } }),
  prog('if avec sinon vide', { block: { type: 'controls_if', extraState: { hasElse: true }, inputs: { IF0: bool(true), DO0: log(txt('a')) } } }),
  prog('bloc désactivé', { block: { type: 'pf_log', inputs: { VALUE: txt('a') }, next: { block: { type: 'pf_log', enabled: false, inputs: { VALUE: txt('cache') }, next: log(txt('c')) } } } }),
  prog('if suivi d\'une suite', { block: { type: 'controls_if', inputs: { IF0: bool(true), DO0: log(txt('a')) }, next: log(txt('apres')) } }),
  prog('ternaire / texte', log({ block: { type: 'logic_ternary', inputs: { IF: bool(true), THEN: { block: { type: 'text_join', extraState: { itemCount: 3 }, inputs: { ADD0: txt('a'), ADD1: num(2), ADD2: V('v1') } } }, ELSE: { block: { type: 'text_length', inputs: { VALUE: txt('abc') } } } } } })),
  prog('text_join 1/2 éléments', log({ block: { type: 'text_join', extraState: { itemCount: 2 }, inputs: { ADD0: V('v1'), ADD1: txt('x') } } }, log({ block: { type: 'text_join', extraState: { itemCount: 1 }, inputs: { ADD0: V('v1') } } }))),
  prog('texte avec apostrophe', log(txt('l\'objet "x"'))),
  prog('variables set/change/get', setv('v1', num(0), { block: { type: 'math_change', fields: { VAR: { id: 'v1' } }, inputs: { DELTA: arith('ADD', num(1), V('v1')) }, next: log(V('v1')) } })),
  prog('repeat ext simple', { block: { type: 'controls_repeat_ext', inputs: { TIMES: num(3), DO: log(txt('x')) } } }),
  prog('repeat imbriqué (count2)', { block: { type: 'controls_repeat_ext', inputs: { TIMES: arith('ADD', num(1), num(2)), DO: { block: { type: 'controls_repeat_ext', inputs: { TIMES: num(3), DO: log(txt('x')) } } } }, next: { block: { type: 'controls_repeat_ext', inputs: { TIMES: V('v1'), DO: log(txt('y')) } } } } }),
  prog('repeat (champ)', { block: { type: 'controls_repeat', fields: { TIMES: 4 }, inputs: { DO: log(txt('x')) } } }),
  prog('while / until', { block: { type: 'controls_whileUntil', fields: { MODE: 'WHILE' }, inputs: { BOOL: cmp('LT', V('v1'), num(10)), DO: { block: { type: 'math_change', fields: { VAR: { id: 'v1' } }, inputs: { DELTA: num(1) } } } }, next: { block: { type: 'controls_whileUntil', fields: { MODE: 'UNTIL' }, inputs: { BOOL: logic('AND', cmp('GT', V('v1'), num(0)), bool(true)), DO: { block: { type: 'controls_flow_statements', fields: { FLOW: 'BREAK' } } } } } } } }),
  prog('for nombres', { block: { type: 'controls_for', fields: { VAR: { id: 'v3' } }, inputs: { FROM: num(1), TO: num(10), BY: num(2), DO: log(V('v3')) }, next: { block: { type: 'controls_for', fields: { VAR: { id: 'v3' } }, inputs: { FROM: num(10), TO: num(1), BY: num(1), DO: log(V('v3')) } } } } }),
  prog('for expressions', { block: { type: 'controls_for', fields: { VAR: { id: 'v3' } }, inputs: { FROM: arith('ADD', num(1), num(1)), TO: { block: { type: 'lists_length', inputs: { VALUE: V('v2') } } }, BY: V('v1'), DO: { block: { type: 'controls_flow_statements', fields: { FLOW: 'CONTINUE' } } } } } }),
  prog('forEach', { block: { type: 'controls_forEach', fields: { VAR: { id: 'v3' } }, inputs: { LIST: V('v2'), DO: log(V('v3')) }, next: { block: { type: 'controls_forEach', fields: { VAR: { id: 'v3' } }, inputs: { LIST: listWith(num(1), num(2)), DO: log(V('v3')) } } } } }),
  prog('variable « count » + repeat', { block: { type: 'controls_repeat_ext', inputs: { TIMES: num(2), DO: setv('v4', num(1)) } } }),
  prog('variable « data » (mot réservé)', setv('v5', num(1), log(V('v5')))),
  prog('listes', log(listWith(num(1), txt('a'), listWith()), log({ block: { type: 'lists_isEmpty', inputs: { VALUE: { block: { type: 'lists_create_empty' } } } } }))),
  ...['FROM_START', 'FROM_END', 'FIRST', 'LAST', 'RANDOM'].flatMap((where) => {
    const at = where.startsWith('FROM');
    const mut = (st) => `<mutation statement="${st}" at="${at}"></mutation>`;
    const inAt = at ? { AT: arith('ADD', num(1), V('v1')) } : {};
    const inAtNum = at ? { AT: num(2) } : {};
    return [
      prog('lists_getIndex GET ' + where, log({ block: { type: 'lists_getIndex', fields: { MODE: 'GET', WHERE: where }, inputs: { VALUE: V('v2'), ...inAt }, extraState: mut(false) } })),
      prog('lists_getIndex GET num ' + where, log({ block: { type: 'lists_getIndex', fields: { MODE: 'GET', WHERE: where }, inputs: { VALUE: V('v2'), ...inAtNum }, extraState: mut(false) } })),
      prog('lists_getIndex GET_REMOVE ' + where, log({ block: { type: 'lists_getIndex', fields: { MODE: 'GET_REMOVE', WHERE: where }, inputs: { VALUE: V('v2'), ...inAtNum }, extraState: mut(false) } })),
      prog('lists_getIndex REMOVE ' + where, { block: { type: 'lists_getIndex', fields: { MODE: 'REMOVE', WHERE: where }, inputs: { VALUE: V('v2'), ...inAtNum }, extraState: mut(true), next: log(txt('apres')) } }),
      prog('lists_setIndex SET ' + where, { block: { type: 'lists_setIndex', fields: { MODE: 'SET', WHERE: where }, inputs: { LIST: V('v2'), ...inAt, TO: num(7) }, extraState: `<mutation at="${at}"></mutation>` } }),
      prog('lists_setIndex INSERT ' + where, { block: { type: 'lists_setIndex', fields: { MODE: 'INSERT', WHERE: where }, inputs: { LIST: V('v2'), ...inAtNum, TO: num(7) }, extraState: `<mutation at="${at}"></mutation>` } }),
      prog('lists_setIndex SET liste calculée ' + where, { block: { type: 'lists_setIndex', fields: { MODE: 'SET', WHERE: where }, inputs: { LIST: { block: { type: 'lists_create_empty' } }, ...inAtNum, TO: num(7) }, extraState: `<mutation at="${at}"></mutation>` } }),
    ];
  }),
  prog('fonctions', { block: { type: 'procedures_callnoreturn', extraState: { name: 'faire', params: ['a', 'b'] }, inputs: { ARG0: num(1), ARG1: V('v1') }, next: log({ block: { type: 'procedures_callreturn', extraState: { name: 'double', params: ['x'] }, inputs: { ARG0: num(4) } } }) } }, [
    { type: 'procedures_defnoreturn', x: 400, y: 0, extraState: { params: [{ name: 'a', id: 'p1' }, { name: 'b', id: 'p2' }] }, fields: { NAME: 'faire' }, inputs: { STACK: log({ block: { type: 'variables_get', fields: { VAR: { id: 'p1' } } } }, setv('p2', arith('ADD', { block: { type: 'variables_get', fields: { VAR: { id: 'p2' } } } }, num(1)))) } },
    { type: 'procedures_defreturn', x: 400, y: 200, extraState: { params: [{ name: 'x', id: 'p3' }] }, fields: { NAME: 'double' }, inputs: { STACK: { block: { type: 'procedures_ifreturn', extraState: '<mutation value="1"></mutation>', inputs: { CONDITION: bool(true), VALUE: num(0) } } }, RETURN: arith('MULTIPLY', { block: { type: 'variables_get', fields: { VAR: { id: 'p3' } } } }, num(2)) } },
  ], [...VARS, { name: 'a', id: 'p1' }, { name: 'b', id: 'p2' }, { name: 'x', id: 'p3' }]),
  prog('collision : l\'autre', { block: { type: 'pf_destroy_other', next: { block: { type: 'pf_t_set_position', inputs: { TARGET: { block: { type: 'pf_other' } }, X: num(1), Y: num(2) } } } } }, [], VARS, 'pf_on_collide', { OBJ: 'Foo' }),
  prog('update : dt', { block: { type: 'pf_self_change', fields: { PROP: 'x' }, inputs: { VALUE: arith('MULTIPLY', { block: { type: 'pf_dt' } }, num(60)) } } }),
  prog('dt hors événement update', log({ block: { type: 'pf_dt' } }), [], VARS, 'pf_on_create'),
  prog('tuile touchée', log({ block: { type: 'pf_tile_info', fields: { PROP: 'tx' } } }, { block: { type: 'pf_set_tile', fields: { LAYER: '@tile' }, inputs: { TX: num(0), TY: num(0), INDEX: num(-1) } } }), [], VARS, 'pf_on_hit_tile'),
  prog('message : données', { block: { type: 'pf_set_text', fields: { ID: 'score' }, inputs: { TEXT: { block: { type: 'pf_value_field', fields: { KEY: 'pts' }, inputs: { OBJ: { block: { type: 'pf_msg_data' } } } } }, X: num(4), Y: num(4) } } }, [], VARS, 'pf_on_message', { NAME: 'porte' }),
  prog('rayon dans une variable', setv('v1', { block: { type: 'pf_raycast', fields: { MODE: 'objs' }, inputs: { X: num(1), Y: num(2), ANGLE: num(3), DIST: num(4) } } }, log({ block: { type: 'pf_ray_get', fields: { FIELD: 'hit' }, inputs: { RAY: V('v1') } } }))),
  prog('rayon mémorisé (_pfRay)', { block: { type: 'pf_ray_cast', fields: { MODE: '' }, inputs: { X: num(1), Y: num(2), ANGLE: num(3), DIST: num(4) }, next: log({ block: { type: 'pf_ray_last', fields: { FIELD: 'x' } } }) } }),
  prog('attendre', { block: { type: 'pf_wait', inputs: { MS: num(500), DO: log(txt('apres')) }, next: log(txt('tout de suite')) } }),
  prog('dict + diffusion', { block: { type: 'pf_broadcast', fields: { NAME: 'porte' }, inputs: { DATA: { block: { type: 'pf_dict', extraState: { items: 2 }, fields: { K0: 'a', K1: 'b' }, inputs: { V0: num(1), V1: txt('z') } } } }, next: { block: { type: 'pf_spawn_props', fields: { OBJ: 'Foo' }, inputs: { X: num(1), Y: num(2), PROPS: { block: { type: 'pf_dict', extraState: { items: 1 }, fields: { K0: 'k' }, inputs: { V0: V('v1') } } } } } } } }),
  prog('tween (entrées vides)', { block: { type: 'pf_tween_to', inputs: { X: num(10), MS: num(400) } } }),
  prog('cible : premier Foo', { block: { type: 'pf_move_towards', inputs: { TARGET: find, SPEED: arith('ADD', num(1), num(2)) } } }),
  prog('entrées vides', chainBlocks(B('pf_self_change', { PROP: 'x' }), B('pf_jump'), B('pf_cam_shake'), B('pf_set_text', { ID: 'a' }), B('pf_log'), B('pf_save', { KEY: 'r' }), B('pf_t_hitbox'))),
  prog('valeurs vides', chainBlocks(...['pf_random', 'lists_length', 'math_constrain', 'text_length', 'lists_isEmpty'].map((t) => ({ block: { type: 'pf_log', inputs: { VALUE: B(t) } } })), B('pf_log', null, { VALUE: B('math_arithmetic', { OP: 'ADD' }) }))),
  prog('js brut', { block: { type: 'pf_js', fields: { CODE: 'score += 1' }, next: log({ block: { type: 'pf_js_val', fields: { EXPR: 'a || b' } } }) } }),
  prog('pf_js_val dans une opération', log(arith('MULTIPLY', { block: { type: 'pf_js_val', fields: { EXPR: 'a + b' } } }, num(2)))),
  prog('mouvement : propriété par objet', { block: { type: 'pf_obj_set', fields: { PROP: 'x' }, inputs: { TARGET: find, VALUE: { block: { type: 'pf_obj_get', fields: { PROP: 'x' }, inputs: { TARGET: find } } } } } }),
  prog('spawn valeur', setv('v1', { block: { type: 'pf_spawn_val', fields: { OBJ: 'Bar' }, inputs: { X: num(1), Y: num(2) } }, })),
  prog('ou/et avec entrées vides', { block: { type: 'controls_if', inputs: { IF0: { block: { type: 'logic_operation', fields: { OP: 'AND' }, inputs: { B: bool(false) } } }, DO0: log(txt('a')) }, next: { block: { type: 'controls_if', inputs: { IF0: { block: { type: 'logic_operation', fields: { OP: 'OR' }, inputs: { A: bool(true) } } }, DO0: log(txt('b')) } } } } }),
  prog('blocs isolés (ignorés)', log(txt('x')), [{ type: 'pf_jump', x: 300, y: 300 }, { type: 'math_number', x: 300, y: 400, fields: { NUM: 5 } }]),
  prog('événements multiples + clavier', { block: { type: 'pf_set_text_opts', fields: { ID: 'a', ALIGN: 'center' }, inputs: { TEXT: txt('Hé'), X: num(1), Y: num(2), COLOR: col('#ff00aa'), SIZE: num(2) } } }, [event('pf_on_key', { KEY: 'SPACE' }, log(txt('espace'))), { ...event('pf_on_timer', { MS: 250 }, log(txt('tic'))), y: 300 }]),
];

let nProg = 0;
if (BK) {
  for (const p of PROGS) {
    if (!p.json.blocks.blocks.length) continue;
    let ref;
    try { ref = blocklyCode(p.json, PROJECT, 'o1'); } catch (e) { fail(`${p.label} : Blockly a refusé (${e.message.split('\n')[0]})`); continue; }
    nProg++;
    const r = compile(p.json);
    if (r.errors.length) { fail(`${p.label} : erreurs ${r.errors.map((e) => e.message).join(' | ')}`); continue; }
    const a = canon(ref);
    const b = canon(r.code);
    if (a !== b) fail(`${p.label} : différent${firstDiff(a, b)}`);
    else checks++;
    checkSyntax(r.code, p.label);
  }
  console.log(`  ${nProg} programmes comparés`);
}

// ---------------------------------------------------------------- (c3) graphes écrits à la main

console.log('(c3) graphes écrits à la main');
function G() {
  const g = { version: 1, nodes: [], links: [], variables: [], comments: [] };
  g.add = (type, x, y, set = {}) => {
    const n = createNode(type, x, y, g);
    Object.assign(n.fields, set.fields || {});
    Object.assign(n.values, set.values || {});
    Object.assign(n.extra, set.extra || {});
    g.nodes.push(n);
    return n.id;
  };
  g.link = (from, fromPin, to, toPin) => { g.links.push({ id: 'l' + (g.links.length + 1), from, fromPin, to, toPin }); };
  g.exec = (...ids) => { for (let i = 0; i + 1 < ids.length; i++) g.link(ids[i], 'then', ids[i + 1], 'exec'); };
  return g;
}
const code = (g, opts) => compileGraph(g, opts);
const same = (a, b) => norm(a) === norm(b);

{ // branch
  const g = G();
  const e = g.add('pf_on_update', 0, 0);
  const br = g.add('flow_branch', 200, 0);
  const cmpN = g.add('logic_compare', 0, 100, { fields: { OP: 'GT' }, values: { A: 1, B: 0 } });
  const a = g.add('pf_log', 400, 0, { values: { VALUE: 'oui' } });
  const b = g.add('pf_log', 400, 100, { values: { VALUE: 'non' } });
  const after = g.add('pf_log', 600, 0, { values: { VALUE: 'fin' } });
  g.link(e, 'then', br, 'exec'); g.link(cmpN, 'out', br, 'COND');
  g.link(br, 'true', a, 'exec'); g.link(br, 'false', b, 'exec'); g.link(br, 'then', after, 'exec');
  const r = code(g);
  ok(r.errors.length === 0, 'branch : pas d\'erreur');
  ok(same(r.code, "on('update', (dt) => { if (1 > 0) { game.log('oui'); } else { game.log('non'); } game.log('fin'); });"), 'branch : code ' + r.code);
  checkSyntax(r.code, 'branch');
}
{ // sequence
  const g = G();
  const e = g.add('pf_on_create', 0, 0);
  const s = g.add('flow_sequence', 100, 0, { extra: { outs: 3 } });
  const l = ['a', 'b', 'c'].map((t, i) => g.add('pf_log', 300, i * 80, { values: { VALUE: t } }));
  g.link(e, 'then', s, 'exec');
  l.forEach((id, i) => g.link(s, 'then' + i, id, 'exec'));
  const r = code(g);
  ok(same(r.code, "on('create', () => { game.log('a'); game.log('b'); game.log('c'); });"), 'sequence : ' + r.code);
}
{ // for / for each / repeat / while / break
  const g = G();
  const e = g.add('pf_on_update', 0, 0);
  const f = g.add('flow_for', 100, 0, { fields: { VAR: 'k' }, values: { FROM: 0, TO: 5, BY: 1 } });
  const lg = g.add('pf_log', 300, 0);
  g.link(e, 'then', f, 'exec'); g.link(f, 'body', lg, 'exec'); g.link(f, 'index', lg, 'VALUE');
  const r = code(g);
  ok(r.errors.length === 0, 'for : ' + JSON.stringify(r.errors));
  ok(same(r.code, "var k; on('update', (dt) => { for (k = 0; k <= 5; k++) { game.log(k); } });"), 'for : ' + r.code);

  const g2 = G();
  const e2 = g2.add('pf_on_update', 0, 0);
  const fe = g2.add('flow_for_each', 100, 0, { fields: { VAR: 'obj' } });
  const all = g2.add('pf_find_all', 0, 100, { fields: { OBJ: 'Foo' } });
  const d = g2.add('pf_destroy_target', 300, 0);
  const br = g2.add('flow_break', 500, 0);
  g2.link(e2, 'then', fe, 'exec'); g2.link(all, 'out', fe, 'LIST'); g2.link(fe, 'body', d, 'exec'); g2.link(fe, 'item', d, 'TARGET');
  g2.link(d, 'then', br, 'exec');
  const r2 = code(g2);
  ok(r2.errors.length === 0, 'for each : ' + JSON.stringify(r2.errors));
  ok(r2.code.includes('for (var obj_index in obj_list)') && r2.code.includes('var obj_list = game.findAll(\'Foo\');') && r2.code.includes('break;'), 'for each : ' + r2.code);
  checkSyntax(r2.code, 'for each');

  const g3 = G();
  const e3 = g3.add('pf_on_update', 0, 0);
  const w = g3.add('flow_while', 100, 0, { values: { COND: true } });
  const rp = g3.add('flow_repeat', 300, 0, { values: { TIMES: 3 } });
  const l3 = g3.add('pf_log', 500, 0);
  g3.link(e3, 'then', w, 'exec'); g3.link(w, 'body', rp, 'exec'); g3.link(rp, 'body', l3, 'exec');
  const r3 = code(g3);
  ok(same(r3.code, "on('update', (dt) => { while (true) { for (var count = 0; count < 3; count++) { game.log('Bonjour'); } } });"), 'while/repeat : ' + r3.code);
}
{ // delay
  const g = G();
  const e = g.add('pf_on_key', 0, 0, { fields: { KEY: 'X' } });
  const d = g.add('pf_wait', 100, 0, { values: { MS: 300 } });
  const a = g.add('pf_log', 300, 0, { values: { VALUE: 'après' } });
  const b = g.add('pf_log', 300, 100, { values: { VALUE: 'tout de suite' } });
  g.link(e, 'then', d, 'exec'); g.link(d, 'done', a, 'exec'); g.link(d, 'then', b, 'exec');
  const r = code(g);
  ok(same(r.code, "on('keydown', 'X', () => { game.wait(300, () => { game.log('après'); }); game.log('tout de suite'); });"), 'delay : ' + r.code);
}
{ // fn_def / fn_call / fn_call_value / return / variables
  const g = G();
  g.variables = [{ name: 'total', default: 0 }, { name: 'liste' }];
  const def = g.add('fn_def', 0, 0, { fields: { NAME: 'ajouter' }, extra: { params: ['n'] } });
  const chg = g.add('var_change', 200, 0, { fields: { NAME: 'total' } });
  const ret = g.add('fn_return', 400, 0);
  const sum = g.add('math_arithmetic', 0, 100, { fields: { OP: 'ADD' }, values: { A: 1, B: 0 } });
  g.link(def, 'then', chg, 'exec'); g.link(chg, 'then', ret, 'exec');
  g.link(def, 'ARG0', chg, 'DELTA'); g.link(def, 'ARG0', sum, 'B'); g.link(sum, 'out', ret, 'VALUE');
  const ev = g.add('pf_on_update', 0, 300);
  const call = g.add('fn_call', 200, 300, { extra: { name: 'ajouter', params: ['n'] }, values: { ARG0: 5 } });
  const callv = g.add('fn_call_value', 0, 400, { extra: { name: 'ajouter', params: ['n'] }, values: { ARG0: 2 } });
  const lg = g.add('pf_log', 400, 300);
  g.link(ev, 'then', call, 'exec'); g.link(call, 'then', lg, 'exec'); g.link(callv, 'out', lg, 'VALUE');
  const r = code(g);
  ok(r.errors.length === 0, 'fonctions : ' + JSON.stringify(r.errors));
  const exp = "var liste; var total = 0; function ajouter(n) { total = (typeof total === 'number' ? total : 0) + n; return 1 + n; } on('update', (dt) => { ajouter(5); game.log(ajouter(2)); });";
  ok(norm(r.code).replace('var liste; var total = 0;', 'var liste; var total = 0;') === norm(exp), 'fonctions : ' + r.code);
  checkSyntax(r.code, 'fonctions');
}
{ // noms sûrs : variable « self » / « data » / « count » / accents / chiffres
  const g = G();
  g.variables = [{ name: 'self' }, { name: 'data' }, { name: 'count' }, { name: 'é à' }, { name: '1er' }, { name: 'class' }];
  const e = g.add('pf_on_update', 0, 0);
  let prev = e;
  g.variables.forEach((v, i) => {
    const s = g.add('var_set', 100 * (i + 1), 0, { fields: { NAME: v.name }, values: { VALUE: i } });
    g.link(prev, 'then', s, 'exec'); prev = s;
  });
  const rp = g.add('flow_repeat', 800, 0, { values: { TIMES: 2 } });
  g.link(prev, 'then', rp, 'exec');
  const r = code(g);
  ok(r.errors.length === 0, 'noms : ' + JSON.stringify(r.errors));
  ok(/var self2, data2, count, _C3_A9__C3_A0, my_1er, class2;/.test(r.code), 'noms : ' + r.code.split('\n')[0]);
  ok(r.code.includes('for (var count2 = 0; count2 < 2; count2++)'), 'noms : boucle ' + r.code);
  checkSyntax(r.code, 'noms');
}
{ // littéraux échappés, priorités avec des fils
  const g = G();
  const e = g.add('pf_on_update', 0, 0);
  const lg = g.add('pf_log', 100, 0, { values: { VALUE: "l'objet \\ \"x\"\nligne 2" } });
  const set = g.add('pf_set_position', 300, 0);
  const a1 = g.add('math_arithmetic', 0, 100, { fields: { OP: 'ADD' }, values: { A: 1, B: 2 } });
  const a2 = g.add('math_arithmetic', 0, 200, { fields: { OP: 'MULTIPLY' }, values: { B: 3 } });
  const neg = g.add('math_number', 0, 300, { fields: { NUM: -2 } });
  const sub = g.add('math_arithmetic', 0, 400, { fields: { OP: 'MINUS' }, values: { A: 5 } });
  g.link(e, 'then', lg, 'exec'); g.link(lg, 'then', set, 'exec');
  g.link(a1, 'out', a2, 'A'); g.link(a2, 'out', set, 'X');
  g.link(neg, 'out', sub, 'B'); g.link(sub, 'out', set, 'Y');
  const r = code(g);
  ok(r.errors.length === 0, 'littéraux : ' + JSON.stringify(r.errors));
  ok(r.code.includes("game.log('l\\'objet \\\\ \"x\"\\nligne 2');"), 'échappement : ' + r.code);
  ok(r.code.includes('self.setPosition((1 + 2) * 3, 5 - -2);'), 'priorités : ' + r.code);
  checkSyntax(r.code, 'littéraux');
}
{ // un nœud pur est réévalué à chaque lecture ; un nœud exec atteint par deux chemins est généré deux fois
  const g = G();
  const e = g.add('pf_on_update', 0, 0);
  const br = g.add('flow_branch', 100, 0, { values: { COND: true } });
  const common = g.add('pf_log', 300, 0, { values: { VALUE: 'x' } });
  const rnd = g.add('pf_random', 0, 100, { values: { MIN: 1, MAX: 6 } });
  g.link(e, 'then', br, 'exec'); g.link(br, 'true', common, 'exec'); g.link(br, 'false', common, 'exec');
  g.link(rnd, 'out', common, 'VALUE');
  const r = code(g);
  ok((r.code.match(/game\.log\(game\.random\(1, 6\)\)/g) || []).length === 2, 'inlining : ' + r.code);
}
{ // erreurs attendues
  let g = G();
  let e = g.add('pf_on_update', 0, 0);
  let a = g.add('pf_log', 100, 0);
  let b = g.add('pf_log', 200, 0);
  g.link(e, 'then', a, 'exec'); g.link(a, 'then', b, 'exec'); g.link(b, 'then', a, 'exec');
  let r = code(g);
  ok(r.errors.some((x) => /cycle/i.test(x.message)), 'cycle : erreur attendue');
  ok(r.code.length < 500, 'cycle : le compilateur ne boucle pas');

  // sortie d'événement lue hors de son événement
  g = G();
  e = g.add('pf_on_update', 0, 0);
  const e2 = g.add('pf_on_create', 0, 100);
  a = g.add('pf_log', 100, 100);
  g.link(e2, 'then', a, 'exec'); g.link(e, 'dt', a, 'VALUE');
  r = code(g);
  ok(r.errors.length === 1 && r.errors[0].nodeId === e, 'sortie d\'événement hors événement : ' + JSON.stringify(r.errors));

  // selfOnly dans le script global
  g = G();
  e = g.add('pf_on_create', 0, 0);
  a = g.add('pf_jump', 100, 0);
  g.link(e, 'then', a, 'exec');
  ok(code(g, { isGlobal: false }).errors.length === 0, 'selfOnly : accepté dans un objet');
  r = code(g, { isGlobal: true });
  ok(r.errors.length === 1 && r.errors[0].nodeId === a, 'selfOnly : refusé dans le global ' + JSON.stringify(r.errors));

  // cycle de données
  g = G();
  e = g.add('pf_on_update', 0, 0);
  a = g.add('pf_log', 100, 0);
  const m1 = g.add('math_arithmetic', 0, 100);
  const m2 = g.add('math_arithmetic', 0, 200);
  g.link(e, 'then', a, 'exec'); g.link(m1, 'out', a, 'VALUE'); g.link(m1, 'out', m2, 'A'); g.link(m2, 'out', m1, 'A');
  r = code(g);
  ok(r.errors.some((x) => /boucle|cycle/i.test(x.message)), 'cycle de données : erreur attendue');

  // nœuds non reliés : ignorés sans erreur ; type inconnu : erreur ; variable non déclarée : avertissement
  g = G();
  g.add('pf_jump', 0, 0);
  r = code(g);
  ok(r.errors.length === 0 && r.code === '', 'nœud isolé ignoré');
  g.nodes.push({ id: 'zz', type: 'inconnu', x: 0, y: 0, fields: {}, values: {}, extra: {} });
  ok(code(g).errors.length === 1, 'type inconnu : erreur');
  g = G();
  e = g.add('pf_on_create', 0, 0);
  a = g.add('var_set', 100, 0, { fields: { NAME: 'neuve' } });
  g.link(e, 'then', a, 'exec');
  r = code(g);
  ok(r.errors.length === 0 && r.warnings.length === 1 && r.code.startsWith('var neuve;'), 'variable non déclarée : ' + JSON.stringify(r));

  // (c3-3d) compilation des nœuds 3D
  const g3 = G();
  const e3 = g3.add('pf_on_create', 0, 0);
  const n1 = g3.add('pf_self_set_3d', 100, 0, { fields: { PROP: 'vz' }, values: { VALUE: 12 } });
  const n2 = g3.add('pf_jump_3d', 200, 0, { values: { FORCE: 15 } });
  const n3 = g3.add('pf_move_forward_3d', 300, 0, { values: { SPEED: 8 } });
  const n4 = g3.add('pf_move_right_3d', 400, 0, { values: { SPEED: -4 } });
  const n5 = g3.add('pf_look_at_3d', 500, 0, { values: { X: 1, Y: 2, Z: 3 } });
  const n6 = g3.add('pf_rotate_y_3d', 600, 0, { values: { ANGLE: 90 } });
  const n7 = g3.add('pf_camera_mode_3d', 700, 0, { fields: { MODE: 'third-person' } });
  const n8 = g3.add('pf_camera_follow_3d', 800, 0, { values: { DIST: 8, HEIGHT: 4 } });
  const n9 = g3.add('pf_pointer_lock', 900, 0);
  g3.exec(e3, n1, n2, n3, n4, n5, n6, n7, n8, n9);

  const r3 = code(g3);
  ok(r3.errors.length === 0, 'noeuds 3D compilent sans erreur');
  ok(r3.code.includes('self.vz = 12;'), 'self_set_3d vz');
  ok(r3.code.includes('self.jump(15);'), 'jump_3d force');
  ok(r3.code.includes('self.moveForward(8);'), 'move_forward_3d');
  ok(r3.code.includes('self.moveRight(-4);'), 'move_right_3d');
  ok(r3.code.includes('self.lookAt(1, 2, 3);'), 'look_at_3d');
  ok(r3.code.includes('self.rotateY(90);'), 'rotate_y_3d');
  ok(r3.code.includes("game.camera.setMode('third-person');"), 'camera_mode_3d');
  ok(r3.code.includes('game.camera.follow(self, { distance: 8, height: 4 });'), 'camera_follow_3d');
  ok(r3.code.includes('input.requestPointerLock();'), 'pointer_lock');

  try {
    new Function('self', 'game', 'input', 'on', r3.code);
    checks++;
  } catch (err) {
    fail('Syntaxe du code 3D genere invalide : ' + err.message);
  }
}

// ---------------------------------------------------------------- (c4) catalogue

console.log('(c4) catalogue et mise en page');
{
  const specs = listSpecs();
  console.log(`  ${specs.length} nœuds, ${CATEGORIES.length} catégories`);
  const cats = new Set(CATEGORIES.map((c) => c.id));
  for (const s of specs) {
    ok(cats.has(s.category), `${s.type} : catégorie inconnue ${s.category}`);
    ok(s.kind !== 'pure' || (s.outputs.length === 1 && s.outputs[0].name === 'out'), `${s.type} : sortie pure`);
    ok(s.kind !== 'event' || !s.inputs.some((p) => p.type === 'exec'), `${s.type} : événement avec exec en entrée`);
    ok(s.kind !== 'exec' || s.inputs[0]?.name === 'exec', `${s.type} : exec sans entrée exec`);
    for (const p of [...s.inputs, ...s.outputs]) ok(PIN_COLORS[p.type], `${s.type}.${p.name} : type de broche inconnu ${p.type}`);
    const n = createNode(s.type, 0, 0, null);
    const size = estimateNodeSize(n, { links: [] });
    ok(size.w >= 180 && size.w <= 260 && size.h > 26, `${s.type} : taille ${JSON.stringify(size)}`);
    for (const f of s.fields) ok(Array.isArray(fieldOptions(f, { project: PROJECT, objectId: 'o1', graph: { variables: [{ name: 'a' }] } })), `${s.type}.${f.name} : options`);
  }
  // blocs SELF_BLOCKS de Blockly == nœuds selfOnly
  if (BK) {
    for (const t of BK.SELF_BLOCKS) {
      const s = getSpec(t);
      if (s) ok(s.selfOnly === true, `${t} devrait être selfOnly`);
    }
    for (const s of specs) if (s.selfOnly && !BK.SELF_BLOCKS.has(s.type)) fail(`${s.type} est selfOnly mais absent de SELF_BLOCKS`);
    // priorités identiques à celles de Blockly
    const { Order: BO } = await import('blockly/javascript');
    for (const k of Object.keys(Order)) ok(BO[k] === Order[k], `Order.${k} : ${Order[k]} != ${BO[k]}`);
    // noms de listes dynamiques
    const o = fieldOptions({ kind: 'sound' }, { project: PROJECT });
    ok(o.some((x) => x[1] === 'boum') && o.some((x) => x[1] === 'portal'), 'sons : projet + presets');
    ok(fieldOptions({ kind: 'anim' }, { project: PROJECT, objectId: 'o1' }).length === 2, 'animations du sprite de l\'objet');
    ok(fieldOptions({ kind: 'layer' }, { project: PROJECT }).map((x) => x[1]).join('|') === '|@tile|Sol|Déco', 'calques');
  }
  ok(isCompatible('number', 'string') && isCompatible('color', 'string') && isCompatible('string', 'color') && isCompatible('any', 'object')
    && !isCompatible('string', 'number') && !isCompatible('exec', 'any') && isCompatible('exec', 'exec') && !isCompatible('object', 'number'), 'isCompatible');
  const g = G();
  const n1 = g.add('text_join', 0, 0, { extra: { items: 4 } });
  ok(resolvePins(g.nodes[0], g).inputs.length === 4, 'text_join : 4 broches');
  ok(n1 === 'n1' && createNode('pf_jump', 0, 0, g).id === 'n2', 'createNode : id unique');
}

// mise en page : pas de chevauchement entre nœuds, exécution de gauche à droite
if (BK) {
  console.log('(c5) lisibilité de la mise en page');
  const targets = scripts.filter((s) => s.script?.blocks);
  for (const s of targets) {
    const gr = blocklyToGraph(s.script.blocks);
    const rects = gr.nodes.map((n) => ({ id: n.id, ...estimateNodeSize(n, gr), x: n.x, y: n.y }));
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
    }
    ok(overlaps === 0, `${s.label} : ${overlaps} chevauchement(s) de nœuds`);
    let backwards = 0;
    for (const l of gr.links) {
      if (l.toPin !== 'exec') continue;
      const a = gr.nodes.find((n) => n.id === l.from);
      const b = gr.nodes.find((n) => n.id === l.to);
      if (b.x <= a.x) backwards++;
    }
    ok(backwards === 0, `${s.label} : ${backwards} fil(s) d'exécution vers la gauche`);
    console.log(`  - ${s.label} : ${gr.nodes.length} nœuds, ${gr.links.length} fils, étendue ${Math.max(...rects.map((r) => r.x + r.w))} x ${Math.max(...rects.map((r) => r.y + r.h))}`);
  }
}

// Dimension du jeu : un nœud 2D est refusé dans un jeu 3D et inversement
{
  const g2d = { nodes: [{ id: 'e', type: 'pf_on_update' }, { id: 'n', type: 'pf_cam_shake' }], links: [{ from: 'e', fromPin: 'then', to: 'n', toPin: 'exec' }] };
  ok(compileGraph(g2d, { dimension: '3d' }).errors.some((e) => e.nodeId === 'n'), 'pf_cam_shake refusé en 3D');
  ok(compileGraph(g2d, { dimension: '2d' }).errors.length === 0, 'pf_cam_shake accepté en 2D');
  ok(compileGraph(g2d).errors.length === 0, 'sans dimension : pas de contrôle');
  const g3d = { nodes: [{ id: 'e', type: 'pf_on_create' }, { id: 'n', type: 'pf_pointer_lock' }], links: [{ from: 'e', fromPin: 'then', to: 'n', toPin: 'exec' }] };
  ok(compileGraph(g3d, { dimension: '2d' }).errors.some((e) => e.nodeId === 'n'), 'pf_pointer_lock refusé en 2D');
}

console.log(`\n${checks} vérifications, ${failures} échec(s)`);
process.exit(failures ? 1 : 0);
