/**
 * PixelForge Studio — Inspecteur unifié piloté par schéma (Godot 4 style)
 * Centralise l'édition des propriétés pour n'importe quelle ressource sélectionnée.
 */

import './inspector.css';
import { SCHEMAS } from './inspector-schemas.js';
import { getIconSvg } from './icons.js';

function getDeep(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setDeep(obj, path, value) {
  if (!obj || !path) return;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

export function createInspector(container, store) {
  let curSelection = null;
  let collapsedGroups = new Set();

  function getActiveTarget() {
    const p = store.project;
    if (!p) return null;

    const sel = curSelection || store.ui.selection;
    if (sel) {
      if (sel.type === 'object') {
        const obj = p.objects?.find((o) => o.id === sel.id);
        if (obj) return { type: 'object', data: obj, title: obj.name, subtitle: 'Objet de jeu' };
      } else if (sel.type === 'entity') {
        const map = p.maps?.find((m) => m.id === sel.mapId) || p.maps?.[0];
        const ent = map?.entities?.find((e) => e.id === sel.id);
        const obj = p.objects?.find((o) => o.id === ent?.objectId);
        if (ent) return { type: 'entity', data: ent, mapId: map.id, obj, title: `${obj?.name || 'Entité'} #${ent.id.slice(-4)}`, subtitle: `Instance sur ${map?.name || 'la scène'}` };
      } else if (sel.type === 'map') {
        const map = p.maps?.find((m) => m.id === sel.id);
        if (map) return { type: 'map', data: map, title: map.name, subtitle: 'Carte 2D' };
      } else if (sel.type === 'sound') {
        const snd = p.sounds?.find((s) => s.id === sel.id);
        if (snd) return { type: 'sound', data: snd, title: snd.name, subtitle: 'Effet sonore' };
      } else if (sel.type === 'song') {
        const sng = p.songs?.find((s) => s.id === sel.id);
        if (sng) return { type: 'song', data: sng, title: sng.name, subtitle: 'Musique chiptune' };
      } else if (sel.type === 'node3d') {
        const sc = p.scenes3d?.find((s) => s.id === sel.sceneId) || p.scenes3d?.[0];
        const node = sc?.nodes?.find((n) => n.id === sel.id);
        const obj = p.objects?.find((o) => o.id === node?.objectId);
        if (node) return { type: 'node3d', data: node, scene: sc, obj, title: node.name, subtitle: `Noeud 3D (${node.kind})` };
      } else if (sel.type === 'scene3d') {
        const sc = p.scenes3d?.find((s) => s.id === sel.id);
        if (sc) return { type: 'scene3d', data: sc, title: sc.name, subtitle: 'Scene 3D' };
      } else if (sel.type === 'settings') {
        return { type: 'settings', data: p.settings, title: 'Réglages', subtitle: p.name };
      }
    }

    // Repli : objet ou carte active
    if (store.ui.selectedObjectId) {
      const obj = p.objects?.find((o) => o.id === store.ui.selectedObjectId);
      if (obj) return { type: 'object', data: obj, title: obj.name, subtitle: 'Objet sélectionné' };
    }
    if (store.ui.selectedMapId) {
      const map = p.maps?.find((m) => m.id === store.ui.selectedMapId);
      if (map) return { type: 'map', data: map, title: map.name, subtitle: 'Scène courante' };
    }

    return { type: 'settings', data: p.settings, title: p.name || 'Projet', subtitle: 'Réglages globaux' };
  }

  function render() {
    const target = getActiveTarget();
    if (!target) {
      container.innerHTML = `
        <div class="pf-insp-empty">
          <div style="margin-bottom:8px;color:var(--fg-2);">${getIconSvg('search', 24)}</div>
          <div style="font-weight:600;">Aucun élément sélectionné</div>
          <div style="font-size:11px;color:var(--fg-2);margin-top:4px;">Sélectionnez une ressource ou une entité dans la scène pour inspecter ses propriétés.</div>
        </div>
      `;
      return;
    }

    const schema = SCHEMAS[target.type];
    if (!schema) {
      container.innerHTML = '<div class="pf-insp-empty">Aucun schéma pour ce type de sélection.</div>';
      return;
    }

    container.innerHTML = `
      <div class="pf-inspector">
        <div class="pf-insp-head">
          <div class="pf-insp-title-box">
            <span class="pf-insp-title">${target.title}</span>
            <span class="pf-insp-subtitle">${target.subtitle}</span>
          </div>
        </div>
        <div class="pf-insp-groups"></div>
      </div>
    `;

    const groupsEl = container.querySelector('.pf-insp-groups');

    if (target.type === 'settings') {
      try {
        const bytes = JSON.stringify(store.project).length;
        if (bytes > 10 * 1024 * 1024) {
          const mb = (bytes / (1024 * 1024)).toFixed(1);
          const warnEl = document.createElement('div');
          warnEl.style.cssText = 'margin:8px;padding:8px 12px;background:#b13e5333;border:1px solid #b13e53;border-radius:4px;color:#ef7d57;font-size:11px;line-height:1.4;';
          warnEl.innerHTML = `<strong>Attention :</strong> Projet volumineux (${mb} Mo > 10 Mo). Pensez a compresser vos modeles ou reduire les grilles.`;
          groupsEl.appendChild(warnEl);
        }
      } catch {}
    }

    for (const g of schema.groups) {
      if (g.id === 'lightProps' && target.data?.kind !== 'light') continue;
      const groupEl = document.createElement('div');
      const isCollapsed = collapsedGroups.has(g.id);
      groupEl.className = `pf-insp-group${isCollapsed ? ' collapsed' : ''}`;

      const head = document.createElement('div');
      head.className = 'pf-insp-group-head';
      head.innerHTML = `<span>${g.label}</span><span class="pf-insp-group-chev">${getIconSvg('chevronDown', 10)}</span>`;
      head.onclick = () => {
        if (collapsedGroups.has(g.id)) collapsedGroups.delete(g.id);
        else collapsedGroups.add(g.id);
        groupEl.classList.toggle('collapsed', collapsedGroups.has(g.id));
      };
      groupEl.appendChild(head);

      const body = document.createElement('div');
      body.className = 'pf-insp-group-body';

      if (g.type === 'exported-props') {
        renderExportedProps(body, target.data);
      } else if (g.type === 'instance-props') {
        renderInstanceProps(body, target.data, target.obj);
      } else if (g.fields) {
        for (const f of g.fields) {
          body.appendChild(createFieldRow(target, f));
        }
      }

      groupEl.appendChild(body);
      groupsEl.appendChild(groupEl);
    }
  }

  function createFieldRow(target, f) {
    const row = document.createElement('div');
    row.className = 'pf-insp-row';

    const label = document.createElement('label');
    label.className = `pf-insp-label${f.type === 'number' ? ' pf-insp-num' : ''}`;
    label.textContent = f.label;
    label.title = f.key;
    row.appendChild(label);

    const control = document.createElement('div');
    control.className = 'pf-insp-control';

    const curVal = getDeep(target.data, f.key);
    const isDefault = f.default !== undefined && curVal === f.default;

    if (f.type === 'boolean') {
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'pf-insp-check';
      chk.checked = !!curVal;
      chk.disabled = !!f.readonly;
      chk.onchange = () => {
        commitUpdate(target, f.key, chk.checked);
      };
      control.appendChild(chk);
    } else if (f.type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'pf-insp-input';
      if (f.min !== undefined) input.min = f.min;
      if (f.max !== undefined) input.max = f.max;
      if (f.step !== undefined) input.step = f.step;
      input.value = curVal ?? f.default ?? 0;
      input.disabled = !!f.readonly;

      input.onchange = () => {
        const val = parseFloat(input.value) || 0;
        commitUpdate(target, f.key, val);
      };

      // Scrubbing horizontal à la souris sur le label
      label.title += ' (Glisser pour ajuster)';
      label.addEventListener('pointerdown', (e) => {
        if (f.readonly) return;
        e.preventDefault();
        const startX = e.clientX;
        const startVal = parseFloat(input.value) || 0;
        const step = f.step || 1;

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          let nextVal = startVal + Math.round(dx / 4) * step;
          if (f.min !== undefined) nextVal = Math.max(f.min, nextVal);
          if (f.max !== undefined) nextVal = Math.min(f.max, nextVal);
          input.value = nextVal;
          commitUpdate(target, f.key, nextVal, false);
        };

        const onUp = () => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          commitUpdate(target, f.key, parseFloat(input.value) || 0, true);
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });

      control.appendChild(input);
    } else if (f.type === 'color') {
      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'pf-insp-input';
      input.style.padding = '0';
      input.style.cursor = 'pointer';
      input.value = curVal || f.default || '#000000';
      input.onchange = () => commitUpdate(target, f.key, input.value);
      control.appendChild(input);
    } else if (f.type === 'enum') {
      const sel = document.createElement('select');
      sel.className = 'pf-insp-input';
      for (const opt of f.options || []) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === curVal) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = () => commitUpdate(target, f.key, sel.value);
      control.appendChild(sel);
    } else if (f.type === 'sprite-ref') {
      const sel = document.createElement('select');
      sel.className = 'pf-insp-input';
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = '(Aucun)';
      sel.appendChild(noneOpt);

      for (const spr of store.project.sprites || []) {
        const o = document.createElement('option');
        o.value = spr.id;
        o.textContent = spr.name;
        if (spr.id === curVal) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = () => commitUpdate(target, f.key, sel.value || null);
      control.appendChild(sel);
    } else if (f.type === 'anim-ref') {
      const sel = document.createElement('select');
      sel.className = 'pf-insp-input';
      const spr = store.project.sprites?.find((s) => s.id === target.data.spriteId);
      const anims = spr?.animations?.map((a) => a.name) || ['idle'];
      for (const a of anims) {
        const o = document.createElement('option');
        o.value = a;
        o.textContent = a;
        if (a === curVal) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = () => commitUpdate(target, f.key, sel.value);
      control.appendChild(sel);
    } else if (f.type === 'object-ref') {
      const sel = document.createElement('select');
      sel.className = 'pf-insp-input';
      const optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = '(Aucun)';
      sel.appendChild(optEmpty);
      for (const o of store.project.objects || []) {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.name;
        if (o.id === curVal) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => commitUpdate(target, f.key, sel.value || null);
      control.appendChild(sel);
    } else if (f.type === 'material-ref') {
      const sel = document.createElement('select');
      sel.className = 'pf-insp-input';
      const optEmpty = document.createElement('option');
      optEmpty.value = '';
      optEmpty.textContent = '(Defaut)';
      sel.appendChild(optEmpty);
      for (const m of store.project.materials || []) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === curVal) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => commitUpdate(target, f.key, sel.value || null);
      control.appendChild(sel);
    } else {
      // string
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pf-insp-input';
      input.value = curVal ?? '';
      input.disabled = !!f.readonly;
      input.onchange = () => commitUpdate(target, f.key, input.value.trim());
      control.appendChild(input);
    }

    // Bouton de réinitialisation ↺ à la valeur par défaut
    if (f.default !== undefined && !isDefault && !f.readonly) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'pf-insp-reset';
      resetBtn.title = `Réinitialiser à la valeur par défaut (${f.default})`;
      resetBtn.setAttribute('aria-label', `Réinitialiser ${f.label} à la valeur par défaut`);
      resetBtn.innerHTML = getIconSvg('reset', 10);
      resetBtn.onclick = () => {
        commitUpdate(target, f.key, f.default);
        render();
      };
      control.appendChild(resetBtn);
    }

    row.appendChild(control);
    return row;
  }

  function renderExportedProps(body, obj) {
    const table = document.createElement('div');
    table.className = 'pf-insp-props-table';

    const props = obj.exportedProps || [];
    if (props.length === 0) {
      table.innerHTML = '<div style="color:var(--fg-2);font-size:11px;font-style:italic;">Aucune variable personnalisée définie.</div>';
    } else {
      props.forEach((prop, idx) => {
        const row = document.createElement('div');
        row.className = 'pf-insp-prop-item';
        row.innerHTML = `
          <input type="text" class="pf-insp-input" value="${prop.name}" style="flex:1" placeholder="Nom" />
          <select class="pf-insp-input" style="width:75px">
            <option value="number"${prop.type === 'number' ? ' selected' : ''}>Nombre</option>
            <option value="string"${prop.type === 'string' ? ' selected' : ''}>Texte</option>
            <option value="boolean"${prop.type === 'boolean' ? ' selected' : ''}>Bool</option>
            <option value="color"${prop.type === 'color' ? ' selected' : ''}>Couleur</option>
          </select>
          <input type="text" class="pf-insp-input" value="${prop.default ?? ''}" style="width:60px" placeholder="Défaut" />
          <button class="pf-insp-reset" style="color:var(--danger)">×</button>
        `;

        const nameIn = row.children[0];
        const typeSel = row.children[1];
        const defIn = row.children[2];
        const delBtn = row.children[3];

        const saveProp = () => {
          store.update((p) => {
            const targetObj = p.objects.find((o) => o.id === obj.id);
            if (targetObj && targetObj.exportedProps[idx]) {
              targetObj.exportedProps[idx] = {
                name: nameIn.value.trim() || 'prop',
                type: typeSel.value,
                default: typeSel.value === 'number' ? (parseFloat(defIn.value) || 0) : defIn.value,
              };
            }
          });
        };

        nameIn.onchange = saveProp;
        typeSel.onchange = saveProp;
        defIn.onchange = saveProp;

        delBtn.onclick = () => {
          store.update((p) => {
            const targetObj = p.objects.find((o) => o.id === obj.id);
            if (targetObj) targetObj.exportedProps.splice(idx, 1);
          });
          render();
        };

        table.appendChild(row);
      });
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'pf-insp-add-prop';
    addBtn.textContent = '+ Ajouter une variable (@export)';
    addBtn.onclick = () => {
      store.update((p) => {
        const targetObj = p.objects.find((o) => o.id === obj.id);
        if (targetObj) {
          targetObj.exportedProps = targetObj.exportedProps || [];
          targetObj.exportedProps.push({ name: `var_${targetObj.exportedProps.length + 1}`, type: 'number', default: 0 });
        }
      });
      render();
    };

    body.appendChild(table);
    body.appendChild(addBtn);
  }

  function renderInstanceProps(body, ent, obj) {
    const table = document.createElement('div');
    table.className = 'pf-insp-props-table';

    const expProps = obj?.exportedProps || [];
    ent.props = ent.props || {};

    if (expProps.length === 0) {
      table.innerHTML = '<div style="color:var(--fg-2);font-size:11px;font-style:italic;">Cet objet n’a aucune variable exportée (@export).</div>';
    } else {
      for (const p of expProps) {
        const row = document.createElement('div');
        row.className = 'pf-insp-row';

        const lbl = document.createElement('label');
        lbl.className = 'pf-insp-label';
        lbl.textContent = p.name;
        row.appendChild(lbl);

        const control = document.createElement('div');
        control.className = 'pf-insp-control';

        const val = ent.props[p.name] !== undefined ? ent.props[p.name] : p.default;

        if (p.type === 'boolean') {
          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.className = 'pf-insp-check';
          chk.checked = !!val;
          chk.onchange = () => {
            store.update(() => { ent.props[p.name] = chk.checked; });
          };
          control.appendChild(chk);
        } else if (p.type === 'color') {
          const inCol = document.createElement('input');
          inCol.type = 'color';
          inCol.className = 'pf-insp-input';
          inCol.value = val || '#ffffff';
          inCol.onchange = () => {
            store.update(() => { ent.props[p.name] = inCol.value; });
          };
          control.appendChild(inCol);
        } else {
          const inVal = document.createElement('input');
          inVal.type = p.type === 'number' ? 'number' : 'text';
          inVal.className = 'pf-insp-input';
          inVal.value = val;
          inVal.onchange = () => {
            store.update(() => {
              ent.props[p.name] = p.type === 'number' ? (parseFloat(inVal.value) || 0) : inVal.value;
            });
          };
          control.appendChild(inVal);
        }

        row.appendChild(control);
        table.appendChild(row);
      }
    }

    body.appendChild(table);
  }

  function commitUpdate(target, key, value, recordUndo = true) {
    if (target.type === 'object') {
      store.update((p) => {
        const obj = p.objects.find((o) => o.id === target.data.id);
        if (obj) setDeep(obj, key, value);
      }, 'inspector', recordUndo);
    } else if (target.type === 'entity') {
      store.update((p) => {
        const map = p.maps.find((m) => m.id === target.mapId);
        const ent = map?.entities?.find((e) => e.id === target.data.id);
        if (ent) setDeep(ent, key, value);
      }, 'inspector', recordUndo);
    } else if (target.type === 'map') {
      store.update((p) => {
        const map = p.maps.find((m) => m.id === target.data.id);
        if (map) setDeep(map, key, value);
      }, 'inspector', recordUndo);
    } else if (target.type === 'sound') {
      store.update((p) => {
        const snd = p.sounds.find((s) => s.id === target.data.id);
        if (snd) setDeep(snd, key, value);
      }, 'inspector', recordUndo);
    } else if (target.type === 'node3d') {
      store.update((p) => {
        const sc = p.scenes3d?.find((s) => s.id === target.scene?.id);
        const node = sc?.nodes?.find((n) => n.id === target.data.id);
        if (node) setDeep(node, key, value);
      }, 'inspector', recordUndo);
    } else if (target.type === 'scene3d') {
      store.update((p) => {
        const sc = p.scenes3d?.find((s) => s.id === target.data.id);
        if (sc) setDeep(sc, key, value);
      }, 'inspector', recordUndo);
    } else if (target.type === 'settings') {
      store.update((p) => {
        setDeep(p.settings, key, value);
      }, 'inspector', recordUndo);
    }
  }

  const offSel = store.on('selection', (sel) => {
    curSelection = sel;
    render();
  });

  const offChange = store.on('change', (reason) => {
    if (reason !== 'inspector') render();
  });

  const offLoad = store.on('load', () => {
    curSelection = null;
    render();
  });

  render();

  return () => {
    offSel();
    offChange();
    offLoad();
  };
}
