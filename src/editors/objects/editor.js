// Éditeur de script : bascule Blueprint (graphe de nœuds) / Code (CodeMirror 6).
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import { createGraphEditor } from './graph-editor.js';
import { compileGraph } from '../../graph/index.js';
import { emptyGraph } from '../../core/project.js';
import apiDoc from '../../../docs/SCRIPT_API.md?raw';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---------------------------------------------------------------- autocomplétion de l'API

const opt = (label, detail, type = 'property') => ({ label, detail, type });
const API_MEMBERS = {
  'self.': [
    ...['x', 'y', 'vx', 'vy', 'flipX', 'visible', 'alpha', 'angle', 'name', 'onGround', 'width', 'height', 'vars', 'id', 'props', 'blocked', 'depth', 'tint', 'scale', 'centerX', 'centerY', 'flipY', 'collideMap', 'collideObjects'].map((l) => opt(l, 'propriété')),
    opt('play', "(anim)", 'method'), opt('destroy', '()', 'method'), opt('jump', '(vitesse)', 'method'),
    opt('moveTowards', '(autre, vitesse)', 'method'), opt('distanceTo', '(autre)', 'method'), opt('setGravity', '(bool)', 'method'),
    opt('setPosition', '(x, y)', 'method'), opt('setVelocity', '(vx, vy)', 'method'), opt('angleTo', '(cible)', 'method'),
    opt('setVelocityAngle', '(angle, vitesse)', 'method'), opt('setCollideMap', '(bool)', 'method'),
    opt('setCollideObjects', '(bool)', 'method'), opt('setHitbox', '(x, y, w, h)', 'method'), opt('tweenTo', '({x, y, alpha, angle, scale}, ms)', 'method'),
  ],
  'input.': [
    opt('isDown', "('LEFT')", 'method'), opt('justPressed', "('SPACE')", 'method'),
    ...['mouseX', 'mouseY', 'mouseScreenX', 'mouseScreenY'].map((l) => opt(l, 'souris (px)')),
    opt('isMouseDown', "('LEFT')", 'method'), opt('mouseJustPressed', "('LEFT')", 'method'),
  ],
  'game.': [
    ...['vars', 'score', 'camera', 'width', 'height', 'mapWidth', 'mapHeight', 'tileSize', 'paused', 'currentMap'].map((l) => opt(l, 'propriété')),
    opt('spawn', "('Objet', x, y)", 'method'), opt('find', "('Objet')", 'method'), opt('findAll', "('Objet')", 'method'),
    opt('goToMap', "('Carte')", 'method'), opt('restart', '()', 'method'), opt('setText', "('id', 'texte', x, y)", 'method'),
    opt('removeText', "('id')", 'method'), opt('random', '(min, max)', 'method'), opt('log', '(...)', 'method'),
    opt('toTile', '(px)', 'method'), opt('getTile', '(tx, ty, calque?)', 'method'), opt('setTile', '(tx, ty, index, calque?)', 'method'),
    opt('isSolidAt', '(x, y)', 'method'), opt('raycast', '(x, y, angle, maxDist, { objects, ignore })', 'method'),
    opt('playSound', "('nom', volume?, pitch?)", 'method'), opt('playMusic', "('nom')", 'method'), opt('stopMusic', '()', 'method'),
    opt('broadcast', "('nom', data?)", 'method'), opt('particles', '(x, y, couleur, nombre, vitesse, vieMs)', 'method'),
    opt('wait', '(ms, fn)', 'method'), opt('pause', '()', 'method'), opt('resume', '()', 'method'), opt('countOf', "('Objet')", 'method'),
    opt('save', "('clé', valeur)", 'method'), opt('load', "('clé', défaut)", 'method'),
  ],
  'game.camera.': [
    opt('follow', '(self)', 'method'), opt('setDeadzone', '(w, h)', 'method'), opt('setOffset', '(x, y)', 'method'), opt('shake', '(ms, intensité)', 'method'), opt('flash', '(ms)', 'method'),
    opt('setZoom', '(z)', 'method'), opt('x', 'coin haut-gauche', 'property'), opt('y', 'coin haut-gauche', 'property'),
  ],
};
const TOP_LEVEL = [
  opt('self', 'instance', 'variable'), opt('game', 'jeu', 'variable'), opt('input', 'clavier', 'variable'),
  snippetCompletion("on('create', () => {\n\t${}\n});", { label: "on('create'", detail: 'au démarrage', type: 'function' }),
  snippetCompletion("on('update', (dt) => {\n\t${}\n});", { label: "on('update'", detail: 'chaque image', type: 'function' }),
  snippetCompletion("on('collide', '${Objet}', (other) => {\n\t${}\n});", { label: "on('collide'", detail: 'collision', type: 'function' }),
  snippetCompletion("on('overlap', '${Objet}', (other) => {\n\t${}\n});", { label: "on('overlap'", detail: 'chevauchement', type: 'function' }),
  snippetCompletion("on('overlapStart', '${Objet}', (other) => {\n\t${}\n});", { label: "on('overlapStart'", detail: 'début de chevauchement', type: 'function' }),
  snippetCompletion("on('overlapEnd', '${Objet}', (other) => {\n\t${}\n});", { label: "on('overlapEnd'", detail: 'fin de chevauchement', type: 'function' }),
  snippetCompletion("on('keydown', '${SPACE}', () => {\n\t${}\n});", { label: "on('keydown'", detail: 'touche pressée', type: 'function' }),
  snippetCompletion("on('timer', ${1000}, () => {\n\t${}\n});", { label: "on('timer'", detail: 'toutes les N ms', type: 'function' }),
  snippetCompletion("on('destroy', () => {\n\t${}\n});", { label: "on('destroy'", detail: 'à la destruction', type: 'function' }),
  snippetCompletion("on('hitTile', (tile) => {\n\t${}\n});", { label: "on('hitTile'", detail: 'tuile solide touchée', type: 'function' }),
  snippetCompletion("on('click', () => {\n\t${}\n});", { label: "on('click'", detail: 'clic sur l\'objet', type: 'function' }),
  snippetCompletion("on('mousedown', '${LEFT}', () => {\n\t${}\n});", { label: "on('mousedown'", detail: 'bouton souris', type: 'function' }),
  snippetCompletion("on('message', '${nom}', (data) => {\n\t${}\n});", { label: "on('message'", detail: 'message reçu', type: 'function' }),
];

function apiCompletions(context) {
  const m = context.matchBefore(/[\w.]*/);
  if (!m || (m.from === m.to && !context.explicit)) return null;
  const dot = m.text.lastIndexOf('.');
  const prefix = m.text.slice(0, dot + 1);
  const options = prefix ? API_MEMBERS[prefix] : TOP_LEVEL;
  if (!options) return null;
  return { from: m.from + dot + 1, options, validFor: /^\w*$/ };
}

// ---------------------------------------------------------------- composant

const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * Monte l'éditeur de script dans `host`.
 * opts : { isGlobal, objectId }. Le script est relu dans store.project à chaque accès.
 * Retourne { flush(), dispose(flush = true) }.
 */
export function createScriptEditor(host, store, { isGlobal, objectId }) {
  const projectRef = store.project; // un autre projet chargé = on n'écrit plus rien
  const scriptOf = (p) => (isGlobal ? p.globalScript : p.objects.find((o) => o.id === objectId)?.script);
  const getScript = () => scriptOf(store.project);

  let ge = null; // éditeur de graphe (mode Blueprint)
  let graph = null; // graphe en cours d'édition (copie : le projet reçoit un clone à chaque sauvegarde)
  let cm = null;
  let saveTimer = null;
  let showGenerated = false;
  let disposed = false;

  // --- DOM
  host.textContent = '';
  const root = el('div', 'obj-ed');
  const bar = el('div', 'obj-ed-bar');
  const seg = el('div', 'obj-seg');
  const bGraph = el('button', null, 'Blueprint');
  const bCode = el('button', null, 'Code');
  seg.append(bGraph, bCode);
  const bGen = el('button', null, 'Voir le code');
  const bHelp = el('button', null, 'Aide API');
  bar.append(seg, el('span', 'obj-spacer'), bGen, bHelp);
  const main = el('div', 'obj-ed-main');
  const body = el('div', 'obj-ed-body');
  const gen = el('pre', 'obj-ed-gen');
  gen.hidden = true;
  main.append(body, gen);
  const help = el('div', 'obj-help');
  help.hidden = true;
  const helpHead = el('div', 'obj-help-head');
  const helpClose = el('button', null, 'Fermer');
  helpHead.append(el('strong', null, 'Aide : API des scripts'), helpClose);
  help.append(helpHead, el('pre', 'obj-help-body', apiDoc));
  root.append(bar, main, help);
  host.appendChild(root);

  bHelp.onclick = () => { help.hidden = !help.hidden; };
  helpClose.onclick = () => { help.hidden = true; };
  bGen.onclick = () => { showGenerated = !showGenerated; refreshGenerated(); };
  bGraph.onclick = () => { if (getScript()?.mode !== 'graph') toGraph(); };
  bCode.onclick = () => { if (getScript()?.mode !== 'code') toCode(); };

  // --- sauvegarde
  const sameProject = () => !disposed && store.project === projectRef && !!getScript();

  function compile() {
    try {
      return compileGraph(graph, { isGlobal, dimension: store.project?.settings?.dimension || '2d' });
    } catch (e) {
      console.error(e);
      return { code: '', errors: [{ nodeId: null, message: 'Compilation impossible : ' + e.message }], warnings: [] };
    }
  }

  function saveGraph() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!ge || !graph || !sameProject()) return;
    const r = compile();
    ge.setDiagnostics(r);
    const s = getScript();
    const snapshot = clone(graph);
    if (s.mode === 'graph' && JSON.stringify(s.graph) === JSON.stringify(snapshot) && s.code === r.code) { refreshGenerated(r.code); return; }
    store.update((p) => { const t = scriptOf(p); t.mode = 'graph'; t.graph = snapshot; t.code = r.code; }, 'script');
    refreshGenerated(r.code);
  }

  function saveCode() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!cm || !sameProject()) return;
    const text = cm.state.doc.toString();
    if (getScript().code === text) return;
    store.update((p) => { scriptOf(p).code = text; }, 'script');
  }

  const schedule = (fn) => { clearTimeout(saveTimer); saveTimer = setTimeout(fn, 300); };
  const flush = () => { if (saveTimer != null) (ge ? saveGraph : saveCode)(); };

  function refreshGenerated(code) {
    gen.hidden = !(showGenerated && ge);
    bGen.classList.toggle('active', showGenerated);
    if (!gen.hidden) gen.textContent = (code ?? compile().code) || '// (aucun nœud événement)';
  }

  // --- changement de mode
  function toCode() {
    flush();
    if (!confirm('Passer en mode Code ?\n\nLe code compilé depuis le Blueprint est conservé et devient modifiable.\n'
      + 'Attention : si vous revenez ensuite au Blueprint, vos modifications du texte seront perdues '
      + '(le graphe reprend son code compilé).')) return;
    store.update((p) => { scriptOf(p).mode = 'code'; }, 'script');
    showMode();
  }

  function toGraph() {
    flush();
    if (!confirm('Revenir au Blueprint ?\n\nLe code texte sera remplacé par le code compilé à partir du graphe : '
      + 'vos modifications du texte seront perdues.')) return;
    store.update((p) => { const t = scriptOf(p); t.mode = 'graph'; if (!t.graph) t.graph = emptyGraph(); }, 'script');
    showMode();
    saveGraph(); // régénère script.code depuis le graphe
  }

  function destroyViews() {
    if (ge) { try { ge.dispose(); } catch (e) { console.error(e); } ge = null; }
    graph = null;
    if (cm) { cm.destroy(); cm = null; }
    body.textContent = '';
  }

  function showMode() {
    destroyViews();
    const s = getScript();
    if (!s) return;
    const isGraph = s.mode === 'graph';
    bGraph.classList.toggle('active', isGraph);
    bCode.classList.toggle('active', !isGraph);
    bGen.hidden = !isGraph;
    if (isGraph) initGraph(s); else initCode(s);
    refreshGenerated();
  }

  // --- Blueprint
  function initGraph(s) {
    const div = el('div', 'obj-graph');
    body.appendChild(div);
    graph = s.graph ? clone(s.graph) : emptyGraph();
    ge = createGraphEditor(div, {
      getGraph: () => graph,
      onChange: (g) => { graph = g; schedule(saveGraph); },
      ctx: { getProject: () => store.project, objectId, isGlobal },
    });
    const r = compile();
    ge.setDiagnostics(r);
    refreshGenerated(r.code);
  }

  // --- CodeMirror
  function initCode(s) {
    cm = new EditorView({
      doc: s.code,
      parent: body,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        autocompletion({ override: [apiCompletions] }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--mono)' } }),
        EditorView.updateListener.of((u) => { if (u.docChanged) schedule(saveCode); }),
      ],
    });
  }

  showMode();

  return {
    flush,
    dispose(doFlush = true) {
      if (disposed) return;
      if (doFlush) { try { flush(); } catch (e) { console.error(e); } }
      disposed = true;
      clearTimeout(saveTimer);
      destroyViews();
      host.textContent = '';
    },
  };
}
