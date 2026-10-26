// Onglet « Objets & code » : liste d'objets, propriétés/physique, script (Blueprint ou code).
import './style.css';
import { createObject, findById, uid } from '../../core/project.js';
import { createScriptEditor } from './editor.js';
import { resolvePins } from '../../graph/index.js';

const GLOBAL_ID = '__global__';
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_ -]*$/;


function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Chaque appel crée une instance indépendante (un onglet = une instance) et renvoie son handle { dispose, onShow, onHide }.
export function mount(container, store, opts = {}) {
  let S = null; // état de cette instance
  let active = false;

  const project = () => S.store.project;
  const isGlobal = () => S.sel === GLOBAL_ID;
  const curObject = () => (isGlobal() ? null : findById(project().objects, S.sel));

  // ---------------------------------------------------------------- noms

  function validateName(name, exceptId) {
    if (!name) return 'Le nom est vide.';
    if (name.length > 32) return 'Le nom est trop long (32 caractères max).';
    if (!NAME_RE.test(name)) return 'Le nom doit commencer par une lettre ou « _ » et ne contenir que lettres, chiffres, espaces, « _ » ou « - ».';
    if (project().objects.some((o) => o.id !== exceptId && o.name.toLowerCase() === name.toLowerCase())) return 'Un objet porte déjà ce nom.';
    return null;
  }

  function askName(message, initial, exceptId) {
    let value = initial;
    for (;;) {
      const r = prompt(message, value);
      if (r == null) return null;
      value = r.trim();
      const err = validateName(value, exceptId);
      if (!err) return value;
      alert(err);
    }
  }

  function uniqueName(base) {
    const taken = new Set(project().objects.map((o) => o.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!taken.has((base + i).toLowerCase())) return base + i;
  }

  // Remplace les références à un objet dans tous les scripts : champs de nœuds de type « objet » (OBJ…),
  // littéraux 'Nom' du code compilé et du code libre (y compris les nœuds JavaScript brut du graphe)
  function rewriteRefs(p, oldName, newName) {
    const swap = (text) => { for (const qt of ["'", '"']) text = text.split(qt + oldName + qt).join(qt + newName + qt); return text; };
    const rewriteGraph = (graph) => {
      for (const n of graph?.nodes || []) {
        for (const [k, v] of Object.entries(n.values || {})) if (v === oldName) n.values[k] = newName; // littéral sur une broche (comme les chaînes du code)
        let fields;
        try { fields = resolvePins(n, graph).fields || []; } catch { continue; }
        for (const f of fields) {
          const v = n.fields?.[f.name];
          if (typeof v !== 'string') continue;
          if (f.kind === 'object') { if (v === oldName) n.fields[f.name] = newName; } else if (f.multiline) n.fields[f.name] = swap(v);
        }
      }
    };
    for (const s of [p.globalScript, ...p.objects.map((o) => o.script)]) {
      if (!s) continue;
      rewriteGraph(s.graph);
      if (s.code) s.code = swap(s.code);
    }
  }

  // ---------------------------------------------------------------- actions sur les objets

  function selectId(id) {
    if (S.sel === id) return;
    S.editor?.flush();
    S.sel = id;
    S.store.ui.selectedObjectId = id;
    renderAll();
  }

  function newObject() {
    const name = askName('Nom du nouvel objet (utilisé dans les scripts) :', uniqueName('Objet'));
    if (!name) return;
    const spr = project().sprites[0] || null;
    const obj = createObject(name, spr?.id || null);
    obj.defaultAnim = spr?.animations[0]?.name || null;
    S.editor?.flush();
    S.store.update((p) => { p.objects.push(obj); }, 'objects');
    S.sel = obj.id;
    S.store.ui.selectedObjectId = obj.id;
    renderAll();
  }

  function duplicateObject() {
    const src = curObject();
    if (!src) return;
    S.editor?.flush();
    const copy = JSON.parse(JSON.stringify(findById(project().objects, src.id)));
    copy.id = uid('obj');
    copy.name = uniqueName(src.name + '_copie');
    S.store.update((p) => {
      const i = p.objects.findIndex((o) => o.id === src.id);
      p.objects.splice(i + 1, 0, copy);
    }, 'objects');
    S.sel = copy.id;
    S.store.ui.selectedObjectId = copy.id;
    renderAll();
  }

  function renameObject() {
    const obj = curObject();
    if (!obj) return;
    const name = askName(
      `Renommer « ${obj.name} »\n\nAttention : le nom sert dans les scripts (game.spawn('${obj.name}'), collisions…). `
      + 'Les références dans les nœuds Blueprint et les chaînes du code seront mises à jour automatiquement, '
      + 'mais vérifiez vos scripts écrits à la main.',
      obj.name, obj.id,
    );
    if (!name || name === obj.name) return;
    S.editor?.flush();
    const old = obj.name;
    S.store.update((p) => {
      findById(p.objects, obj.id).name = name;
      rewriteRefs(p, old, name);
    }, 'objects');
    renderAll();
  }

  function deleteObject() {
    const obj = curObject();
    if (!obj) return;
    const used = project().maps.reduce((n, m) => n + m.entities.filter((e) => e.objectId === obj.id).length, 0);
    if (!confirm(`Supprimer l'objet « ${obj.name} » ?` + (used ? `\n\n${used} instance(s) placée(s) dans les cartes seront aussi supprimées.` : ''))) return;
    S.editor?.dispose(false);
    S.editor = null;
    const idx = project().objects.findIndex((o) => o.id === obj.id);
    S.store.update((p) => {
      p.objects = p.objects.filter((o) => o.id !== obj.id);
      for (const m of p.maps) m.entities = m.entities.filter((e) => e.objectId !== obj.id);
    }, 'objects');
    const next = project().objects[Math.min(idx, project().objects.length - 1)];
    S.sel = next ? next.id : GLOBAL_ID;
    S.store.ui.selectedObjectId = S.sel;
    renderAll();
  }

  // ---------------------------------------------------------------- liste

  function thumb(sprite) {
    if (!sprite?.frames?.[0]) return el('div', 'obj-thumb obj-thumb-empty', '?');
    const img = el('img', 'obj-thumb pixelated');
    img.src = sprite.frames[0];
    img.alt = '';
    return img;
  }

  function renderList() {
    const list = S.listEl;
    list.textContent = '';
    const add = (id, label, sprite, cls) => {
      const item = el('div', 'obj-item' + (S.sel === id ? ' selected' : '') + (cls ? ' ' + cls : ''));
      item.append(sprite === undefined ? el('div', 'obj-thumb obj-thumb-script', '{ }') : thumb(sprite), el('span', 'obj-item-name', label));
      item.onclick = () => selectId(id);
      list.appendChild(item);
    };
    add(GLOBAL_ID, 'Script global', undefined, 'obj-item-global');
    for (const o of project().objects) add(o.id, o.name, findById(project().sprites, o.spriteId));
    if (!project().objects.length) list.appendChild(el('div', 'obj-empty', 'Aucun objet. Créez-en un avec « Nouveau ».'));
    const g = isGlobal();
    for (const b of S.actionBtns) b.disabled = g;
  }

  // ---------------------------------------------------------------- propriétés

  function stopPreview() {
    clearInterval(S.previewTimer);
    S.previewTimer = null;
  }

  function startPreview(img, sprite, animName) {
    stopPreview();
    if (!sprite?.frames?.length) { img.removeAttribute('src'); return; }
    const scale = Math.max(1, Math.floor(96 / Math.max(sprite.width, sprite.height)));
    img.style.width = sprite.width * scale + 'px';
    img.style.height = sprite.height * scale + 'px';
    const anim = sprite.animations.find((a) => a.name === animName);
    const seq = anim?.frames?.length ? anim.frames.filter((f) => sprite.frames[f]) : [0];
    let i = 0;
    const show = () => { img.src = sprite.frames[seq[i % seq.length]] || sprite.frames[0]; };
    show();
    if (seq.length > 1) {
      S.previewTimer = setInterval(() => {
        i++;
        if (!anim.loop && i >= seq.length) { i = seq.length - 1; stopPreview(); }
        show();
      }, 1000 / Math.max(1, anim.fps || 6));
    }
  }

  function field(label, control) {
    const row = el('label', 'obj-field');
    row.append(el('span', null, label), control);
    return row;
  }

  function check(label, value, onChange) {
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!value;
    cb.onchange = () => onChange(cb.checked);
    const row = el('label', 'obj-check');
    row.append(cb, el('span', null, label));
    return row;
  }

  function editObj(fn) {
    const id = S.sel;
    S.store.update((p) => { const o = findById(p.objects, id); if (o) fn(o, p); }, 'obj-prop');
  }

  function renderProps() {
    const box = S.propsEl;
    stopPreview();
    box.textContent = '';
    const obj = curObject();
    if (isGlobal()) {
      box.append(
        el('h3', null, 'Script global'),
        el('p', 'obj-hint', 'Exécuté une fois au démarrage de chaque carte. Ici, self vaut null : les blocs qui utilisent l\'objet courant sont désactivés.'),
        el('p', 'obj-hint', 'Utile pour le score à l\'écran, les timers du niveau, la création d\'ennemis…'),
      );
      return;
    }
    if (!obj) {
      box.append(el('p', 'obj-hint', 'Sélectionnez ou créez un objet.'));
      return;
    }
    const sprites = project().sprites;
    const sprite = findById(sprites, obj.spriteId);

    box.append(el('h3', null, obj.name));
    const prev = el('div', 'obj-preview checker');
    const img = el('img', 'pixelated');
    img.alt = '';
    prev.appendChild(sprite ? img : el('span', 'obj-hint', 'Pas de sprite'));
    box.appendChild(prev);
    startPreview(img, sprite, obj.defaultAnim);

    // Sprite
    const selSprite = el('select');
    selSprite.append(new Option('(aucun)', ''));
    for (const s of sprites) selSprite.append(new Option(s.name, s.id));
    selSprite.value = obj.spriteId || '';
    selSprite.onchange = () => {
      const spr = findById(project().sprites, selSprite.value);
      editObj((o) => { o.spriteId = spr?.id || null; o.defaultAnim = spr?.animations[0]?.name || null; o.hitbox = null; });
      renderProps();
      renderList();
    };
    box.appendChild(field('Sprite', selSprite));

    // Animation par défaut
    const selAnim = el('select');
    selAnim.append(new Option('(aucune)', ''));
    for (const a of sprite?.animations || []) selAnim.append(new Option(a.name, a.name));
    selAnim.value = obj.defaultAnim || '';
    selAnim.onchange = () => {
      editObj((o) => { o.defaultAnim = selAnim.value || null; });
      startPreview(img, sprite, selAnim.value);
    };
    box.appendChild(field('Animation par défaut', selAnim));

    // Hitbox
    box.appendChild(el('h4', null, 'Hitbox'));
    box.appendChild(check('Frame entière', !obj.hitbox, (full) => {
      editObj((o) => { o.hitbox = full ? null : { x: 0, y: 0, w: sprite?.width || 16, h: sprite?.height || 16 }; });
      renderProps();
    }));
    if (obj.hitbox) {
      const grid = el('div', 'obj-hitbox');
      for (const k of ['x', 'y', 'w', 'h']) {
        const inp = el('input');
        inp.type = 'number';
        inp.min = k === 'w' || k === 'h' ? '1' : '0';
        inp.step = '1';
        inp.value = obj.hitbox[k];
        inp.onchange = () => {
          const v = Math.max(Number(inp.min), Math.round(Number(inp.value)) || 0);
          inp.value = v;
          editObj((o) => { if (o.hitbox) o.hitbox[k] = v; });
        };
        grid.appendChild(field(k, inp));
      }
      box.appendChild(grid);
    }

    // Physique
    box.appendChild(el('h4', null, 'Physique'));
    const ph = obj.physics;
    const setPh = (k) => (v) => editObj((o) => { o.physics[k] = v; });
    box.append(
      check('Physique activée', ph.enabled, (v) => { setPh('enabled')(v); renderProps(); }),
    );
    if (ph.enabled) {
      box.append(
        check('Gravité', ph.gravity, setPh('gravity')),
        check('Immobile (ne bouge pas)', ph.immovable, setPh('immovable')),
        check('Collision avec la carte', ph.collideMap, setPh('collideMap')),
        check('Collision avec les bords du monde', ph.collideWorld, setPh('collideWorld')),
      );
      const range = el('input');
      range.type = 'range';
      range.min = '0'; range.max = '1'; range.step = '0.05';
      range.value = ph.bounce;
      const out = el('span', 'obj-val', String(ph.bounce));
      range.oninput = () => { out.textContent = range.value; };
      range.onchange = () => setPh('bounce')(Number(range.value));
      const row = field('Rebond', range);
      row.appendChild(out);
      row.classList.add('obj-field-range');
      box.appendChild(row);
    }
  }

  // ---------------------------------------------------------------- éditeur de script

  function renderEditor() {
    S.editor?.dispose();
    S.editor = null;
    S.edHost.textContent = '';
    const obj = curObject();
    if (!isGlobal() && !obj) {
      S.edHost.appendChild(el('div', 'obj-empty', 'Aucun objet sélectionné.'));
      return;
    }
    S.edTitle.textContent = isGlobal() ? 'Script global' : 'Script de « ' + obj.name + ' »';
    const host = el('div', 'obj-ed-host');
    S.edHost.appendChild(host);
    S.editor = createScriptEditor(host, S.store, { isGlobal: isGlobal(), objectId: obj?.id || null });
  }

  function renderAll() {
    renderList();
    renderProps();
    renderEditor();
  }

    S = { store, sel: null, editor: null, previewTimer: null, offs: [], container };

    const root = el('div', 'obj-root');
    const left = el('div', 'obj-col obj-left');
    const head = el('div', 'obj-head');
    const bNew = el('button', 'primary', '+ Nouveau');
    bNew.onclick = newObject;
    head.append(el('strong', null, 'Objets'), bNew);
    S.listEl = el('div', 'obj-list');
    const actions = el('div', 'obj-actions');
    const mk = (label, fn, cls) => { const b = el('button', cls, label); b.onclick = fn; return b; };
    S.actionBtns = [mk('Dupliquer', duplicateObject), mk('Renommer', renameObject), mk('Supprimer', deleteObject, 'obj-danger')];
    actions.append(...S.actionBtns);
    left.append(head, S.listEl, actions);

    S.propsEl = el('div', 'obj-col obj-props');
    const right = el('div', 'obj-col obj-right');
    S.edTitle = el('div', 'obj-ed-title');
    S.edHost = el('div', 'obj-ed-wrap');
    right.append(S.edTitle, S.edHost);

    root.append(left, S.propsEl, right);
    container.appendChild(root);

    const want = opts.refId ?? store.ui.selectedObjectId;
    const valid = want === GLOBAL_ID || findById(store.project.objects, want);
    S.sel = valid ? want : (store.project.objects[0]?.id || GLOBAL_ID);

    // Changements venus d'ailleurs (hors édition de script) : rafraîchit seulement la liste
    S.offs.push(store.on('change', (reason) => { if (S && reason !== 'script') renderList(); }));

    renderAll();

  return {
    dispose() {
      if (!S) return;
      active = false;
      stopPreview();
      S.offs.forEach((off) => off());
      S.editor?.dispose();
      container.textContent = '';
      S = null;
    },
    onShow() { active = true; store.ui.selectedObjectId = S?.sel ?? null; },
    onHide() { active = false; },
  };
}
