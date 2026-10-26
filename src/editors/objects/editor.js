// Éditeur de script : bascule Blocs (Blockly) / Code (CodeMirror 6).
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import {
  Blockly, setBlocksContext, prepareState, generateCode, buildToolbox, applySelfRestriction, darkTheme,
} from './blocks.js';
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

/**
 * Monte l'éditeur de script dans `host`.
 * opts : { isGlobal, objectId }. Le script est relu dans store.project à chaque accès.
 * Retourne { flush(), dispose(flush = true) }.
 */
export function createScriptEditor(host, store, { isGlobal, objectId }) {
  const projectRef = store.project; // un autre projet chargé = on n'écrit plus rien
  const scriptOf = (p) => (isGlobal ? p.globalScript : p.objects.find((o) => o.id === objectId)?.script);
  const getScript = () => scriptOf(store.project);

  let ws = null;
  let cm = null;
  let resizeObs = null;
  let saveTimer = null;
  let showGenerated = false;
  let disposed = false;

  // --- DOM
  host.textContent = '';
  const root = el('div', 'obj-ed');
  const bar = el('div', 'obj-ed-bar');
  const seg = el('div', 'obj-seg');
  const bBlocks = el('button', null, 'Blocs');
  const bCode = el('button', null, 'Code');
  seg.append(bBlocks, bCode);
  const note = el('span', 'obj-ed-note');
  const bGen = el('button', null, 'Voir le code');
  const bHelp = el('button', null, 'Aide API');
  bar.append(seg, note, el('span', 'obj-spacer'), bGen, bHelp);
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
  bBlocks.onclick = () => { if (getScript()?.mode !== 'blocks') toBlocks(); };
  bCode.onclick = () => { if (getScript()?.mode !== 'code') toCode(); };

  // --- sauvegarde
  const sameProject = () => !disposed && store.project === projectRef && !!getScript();

  function saveBlocks() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!ws || !sameProject()) return;
    const blocks = Blockly.serialization.workspaces.save(ws);
    const code = generateCode(ws);
    const s = getScript();
    if (JSON.stringify(s.blocks) === JSON.stringify(blocks) && s.code === code) { refreshGenerated(code); return; }
    store.update((p) => { const t = scriptOf(p); t.blocks = blocks; t.code = code; }, 'script');
    refreshGenerated(code);
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
  const flush = () => { if (saveTimer != null) (ws ? saveBlocks : saveCode)(); };

  function refreshGenerated(code) {
    gen.hidden = !(showGenerated && ws);
    bGen.classList.toggle('active', showGenerated);
    if (!gen.hidden) gen.textContent = (code ?? generateCode(ws)) || '// (aucun bloc événement)';
    if (ws) requestAnimationFrame(() => ws && Blockly.svgResize(ws));
  }

  // --- changement de mode
  function toCode() {
    flush();
    if (!confirm('Passer en mode Code ?\n\nLe code généré par les blocs est conservé et devient modifiable.\n'
      + 'Attention : si vous revenez ensuite aux blocs, vos modifications du texte seront perdues '
      + '(les blocs reprennent leur code généré).')) return;
    store.update((p) => { scriptOf(p).mode = 'code'; }, 'script');
    showMode();
  }

  function toBlocks() {
    flush();
    if (!confirm('Revenir aux blocs ?\n\nLe code texte sera remplacé par le code généré à partir des blocs : '
      + 'vos modifications du texte seront perdues.')) return;
    store.update((p) => { scriptOf(p).mode = 'blocks'; }, 'script');
    showMode();
    saveBlocks(); // régénère script.code depuis les blocs
  }

  function destroyViews() {
    resizeObs?.disconnect();
    resizeObs = null;
    if (ws) { try { ws.dispose(); } catch (e) { console.error(e); } ws = null; }
    if (cm) { cm.destroy(); cm = null; }
    body.textContent = '';
  }

  function showMode() {
    destroyViews();
    const s = getScript();
    if (!s) return;
    const blocks = s.mode !== 'code';
    bBlocks.classList.toggle('active', blocks);
    bCode.classList.toggle('active', !blocks);
    bGen.hidden = !blocks;
    note.textContent = '';
    if (blocks) initBlocks(s); else initCode(s);
    refreshGenerated();
  }

  // --- Blockly
  function initBlocks(s) {
    const div = el('div', 'obj-blockly');
    body.appendChild(div);
    setBlocksContext({ getProject: () => store.project, objectId, isGlobal });
    ws = Blockly.inject(div, {
      toolbox: buildToolbox(isGlobal),
      theme: darkTheme,
      renderer: 'zelos',
      sounds: false,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.85, minScale: 0.4, maxScale: 1.6, scaleSpeed: 1.2 },
      grid: { spacing: 24, length: 2, colour: '#2c3047', snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    if (s.blocks) {
      prepareState(s.blocks);
      Blockly.Events.disable();
      try {
        Blockly.serialization.workspaces.load(s.blocks, ws);
      } catch (e) {
        console.error(e);
        note.textContent = 'Blocs illisibles, workspace vide.';
      } finally {
        Blockly.Events.enable();
      }
    } else if (s.code.trim()) {
      note.textContent = 'Ce script contient du code sans blocs : le premier bloc ajouté le remplacera.';
    }
    applySelfRestriction(ws, isGlobal);
    ws.addChangeListener((e) => {
      if (e.isUiEvent) return;
      applySelfRestriction(ws, isGlobal);
      note.textContent = '';
      schedule(saveBlocks);
    });
    resizeObs = new ResizeObserver(() => ws && Blockly.svgResize(ws));
    resizeObs.observe(div);
    requestAnimationFrame(() => ws && Blockly.svgResize(ws));
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
