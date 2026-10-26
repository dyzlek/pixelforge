// Scripts Blueprint côté Node : contrôle et mise en page d'un graphe écrit par une IA, compilation, catalogue des nœuds.
// Le noyau (src/graph/) est pur : il tourne ici comme dans le navigateur.
import { compileGraph, getSpec, listSpecs, resolvePins, createNode, CATEGORIES } from '../../src/graph/index.js';

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Problèmes de structure d'un graphe (types inconnus, ids en double, fils vers des broches qui n'existent pas…)
export function checkGraph(graph) {
  const out = [];
  if (!isObj(graph)) return ['graph must be an object { nodes: [...], links: [...] }'];
  if (!Array.isArray(graph.nodes)) return ['graph.nodes must be an array'];
  if (graph.links !== undefined && !Array.isArray(graph.links)) return ['graph.links must be an array'];
  const byId = new Map();
  for (const n of graph.nodes) {
    if (!isObj(n) || typeof n.id !== 'string' || !n.id) { out.push('every node needs a string "id"'); continue; }
    if (byId.has(n.id)) out.push(`duplicate node id "${n.id}"`);
    byId.set(n.id, n);
    if (!getSpec(n.type)) out.push(`node ${n.id}: unknown type "${n.type}" (see list_nodes)`);
  }
  for (const [i, l] of (graph.links || []).entries()) {
    const w = `link #${i}`;
    if (!isObj(l)) { out.push(`${w}: must be { from, fromPin, to, toPin }`); continue; }
    const a = byId.get(l.from), b = byId.get(l.to);
    if (!a) { out.push(`${w}: "from" node "${l.from}" does not exist`); continue; }
    if (!b) { out.push(`${w}: "to" node "${l.to}" does not exist`); continue; }
    if (!getSpec(a.type) || !getSpec(b.type)) continue; // déjà signalé
    const outs = resolvePins(a, graph).outputs.map((p) => p.name);
    const ins = resolvePins(b, graph).inputs.map((p) => p.name);
    if (!outs.includes(l.fromPin)) out.push(`${w}: node ${a.id} (${a.type}) has no output pin "${l.fromPin}" (outputs: ${outs.join(', ') || 'none'})`);
    if (!ins.includes(l.toPin)) out.push(`${w}: node ${b.id} (${b.type}) has no input pin "${l.toPin}" (inputs: ${ins.join(', ') || 'none'})`);
  }
  return out;
}

// Place les nœuds sans coordonnées : colonnes selon la longueur du chemin depuis les nœuds sans entrée (gauche → droite)
function autoLayout(nodes, links) {
  const depth = new Map(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const l of links) {
      const d = (depth.get(l.from) ?? 0) + 1;
      if (depth.has(l.to) && depth.get(l.to) < d && d <= nodes.length) { depth.set(l.to, d); changed = true; }
    }
    if (!changed) break;
  }
  const rows = new Map();
  for (const n of nodes) {
    if (Number.isFinite(n.x) && Number.isFinite(n.y)) continue;
    const col = depth.get(n.id);
    const row = rows.get(col) || 0;
    rows.set(col, row + 1);
    n.x = 60 + col * 300;
    n.y = 60 + row * 170;
  }
}

// Graphe complet au format du projet (champs par défaut, ids de fils, positions)
export function normalizeGraph(graph) {
  const nodes = graph.nodes.map((n) => ({
    id: n.id, type: n.type, x: n.x, y: n.y,
    fields: isObj(n.fields) ? { ...n.fields } : {}, values: isObj(n.values) ? { ...n.values } : {}, extra: isObj(n.extra) ? { ...n.extra } : {},
  }));
  const links = (graph.links || []).map((l, i) => ({ id: l.id || 'l' + (i + 1), from: l.from, fromPin: l.fromPin, to: l.to, toPin: l.toPin }));
  autoLayout(nodes, links);
  return {
    version: 1, nodes, links,
    variables: (graph.variables || []).map((v) => (typeof v === 'string' ? { name: v } : v)),
    comments: Array.isArray(graph.comments) ? graph.comments : [],
  };
}

// « node n3 (pf_jump): message »
export function describeIssue(graph, issue) {
  const n = issue.nodeId != null ? (graph.nodes || []).find((x) => x.id === issue.nodeId) : null;
  return (n ? `node ${n.id} (${n.type}): ` : issue.nodeId != null ? `node ${issue.nodeId}: ` : '') + issue.message;
}

// Vérifie, normalise et compile un graphe. Lève une Error (toutes les erreurs listées) si le graphe est invalide.
// → { graph, code, warnings: string[] }
export function buildGraphScript(graph, isGlobal = false, dimension = null) {
  const problems = checkGraph(graph);
  if (problems.length) throw new Error('invalid graph:\n- ' + problems.join('\n- '));
  const g = normalizeGraph(graph);
  const r = compileGraph(g, { isGlobal, dimension });
  if (r.errors.length) throw new Error('graph does not compile:\n- ' + r.errors.map((e) => describeIssue(g, e)).join('\n- '));
  return { graph: g, code: r.code, warnings: r.warnings.map((w) => describeIssue(g, w)) };
}

// ---------- catalogue des nœuds (tool list_nodes) ----------
const pinText = (p) => `${p.name}:${p.type}${p.default !== undefined && p.type !== 'exec' ? '=' + JSON.stringify(p.default) : ''}${p.optional ? '?' : ''}`;

export function listNodes({ category, search } = {}) {
  const q = search ? String(search).toLowerCase() : '';
  const lines = [];
  for (const cat of CATEGORIES) {
    if (category && cat.id !== category) continue;
    const specs = listSpecs().filter((s) => s.category === cat.id && (!q || `${s.type} ${s.title} ${s.keywords || ''}`.toLowerCase().includes(q)));
    if (!specs.length) continue;
    lines.push(`## ${cat.id} - ${cat.label}`);
    for (const s of specs) {
      const node = createNode(s.type, 0, 0, { nodes: [] });
      const pins = resolvePins(node, { nodes: [node], links: [] });
      const parts = [`${s.type} "${s.title}" [${s.kind}${s.selfOnly ? ', self only' : ''}]`];
      if (pins.inputs.length) parts.push('in: ' + pins.inputs.map(pinText).join(' '));
      if (pins.outputs.length) parts.push('out: ' + pins.outputs.map(pinText).join(' '));
      if (pins.fields.length) parts.push('fields: ' + pins.fields.map((f) => `${f.name}(${f.kind})${f.default !== undefined && f.default !== '' ? '=' + JSON.stringify(f.default) : ''}`).join(' '));
      if (s.dynamic) parts.push(`dynamic pins (${s.dynamic}), extra ${JSON.stringify(s.extra || {})}`);
      lines.push('- ' + parts.join(' | '));
    }
  }
  if (!lines.length) return `No node matches${category ? ` category "${category}"` : ''}${search ? ` search "${search}"` : ''}. Categories: ${CATEGORIES.map((c) => c.id).join(', ')}.`;
  return lines.join('\n');
}

// Recompile tous les scripts en mode graph d'un projet (écrit script.code). → { changed: [nom], errors: ['objet: node n3 (type): message'] }
// Un script dont la compilation échoue n'est pas modifié.
export function recompileGraphs(p) {
  const changed = [];
  const errors = [];
  const list = [['global script', p.globalScript, true], ...p.objects.map((o) => [`object "${o.name}"`, o.script, false])];
  for (const [where, script, isGlobal] of list) {
    if (script?.mode !== 'graph' || !script.graph) continue;
    const problems = checkGraph(script.graph);
    if (problems.length) { errors.push(...problems.map((m) => `${where}: ${m}`)); continue; }
    const g = normalizeGraph(script.graph);
    const r = compileGraph(g, { isGlobal, dimension: p.settings?.dimension || '2d' });
    if (r.errors.length) { errors.push(...r.errors.map((e) => `${where}: ${describeIssue(g, e)}`)); continue; }
    if (r.code !== script.code || JSON.stringify(g) !== JSON.stringify(script.graph)) changed.push(where);
    script.graph = g;
    script.code = r.code;
  }
  return { changed, errors };
}
