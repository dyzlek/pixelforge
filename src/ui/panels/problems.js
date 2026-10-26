/**
 * PixelForge Studio — Panneau « Problèmes » (Validation continue en temps réel)
 */

import { getIconSvg } from '../icons.js';

export function createProblemsPanel(container, store, workspace) {
  let issues = [];
  let validateTimer = null;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;width:100%;background:var(--bg-1);color:var(--fg-0);font-size:12px;overflow:hidden;">
      <div style="padding:4px 8px;background:var(--bg-2);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <span id="pf-prob-count" style="font-weight:600;font-size:11px;color:var(--fg-1);">Aucun problème détecté</span>
        <button class="pf-dock-btn" data-act="recheck" title="Relancer la vérification" aria-label="Relancer la vérification du projet">${getIconSvg('refresh', 11)} <span>Vérifier</span></button>
      </div>
      <div id="pf-prob-list" style="flex:1;min-height:0;overflow-y:auto;padding:4px 8px;display:flex;flex-direction:column;gap:3px;"></div>
    </div>
  `;

  const countEl = container.querySelector('#pf-prob-count');
  const listEl = container.querySelector('#pf-prob-list');

  function validate() {
    const p = store.project;
    issues = [];
    if (!p) {
      render();
      return;
    }

    // Validation des cartes
    if (!p.maps?.length) {
      issues.push({ level: 'error', text: 'Le projet doit comporter au moins une carte.', kind: 'settings' });
    } else {
      if (!p.maps.some((m) => m.id === p.settings?.startMapId)) {
        issues.push({ level: 'warn', text: `La carte de départ n'existe pas dans le projet.`, kind: 'settings' });
      }
      for (const m of p.maps) {
        if (!m.layers?.some((l) => l.collides)) {
          issues.push({ level: 'warn', text: `Carte « ${m.name} » : aucun calque bloquant (collides: true).`, kind: 'map', refId: m.id });
        }
        for (const e of m.entities || []) {
          if (!p.objects?.some((o) => o.id === e.objectId)) {
            issues.push({ level: 'error', text: `Carte « ${m.name} » : une entité référence un objet inexistant.`, kind: 'map', refId: m.id });
          }
        }
      }
    }

    // Alerte taille volumineuse (> 10 Mo)
    try {
      const approxBytes = JSON.stringify(p).length;
      if (approxBytes > 10 * 1024 * 1024) {
        const mb = (approxBytes / (1024 * 1024)).toFixed(1);
        issues.push({
          level: 'warn',
          text: `Taille du projet élevée (${mb} Mo > 10 Mo) : envisagez de compresser ou nettoyer les modèles 3D.`,
          kind: 'settings',
        });
      }
    } catch {}

    // Validation des objets
    for (const obj of p.objects || []) {
      if (obj.spriteId && !p.sprites?.some((s) => s.id === obj.spriteId)) {
        issues.push({ level: 'warn', text: `Objet « ${obj.name} » : sprite lié introuvable.`, kind: 'objects', refId: obj.id });
      }
    }

    render();
  }

  function render() {
    const errCount = issues.filter((i) => i.level === 'error').length;
    const warnCount = issues.filter((i) => i.level === 'warn').length;

    if (issues.length === 0) {
      countEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;">${getIconSvg('check', 12)} Aucun problème détecté</span>`;
      countEl.style.color = 'var(--success)';
      listEl.innerHTML = `
        <div style="padding:16px;color:var(--fg-2);font-style:italic;display:flex;align-items:center;gap:8px;">
          ${getIconSvg('check', 16)}
          <span>Le projet est valide et prêt à être testé.</span>
        </div>
      `;
      return;
    }

    countEl.textContent = `${errCount} erreur(s), ${warnCount} avertissement(s)`;
    countEl.style.color = errCount > 0 ? 'var(--danger)' : 'var(--warning)';

    listEl.innerHTML = '';
    for (const it of issues) {
      const itemEl = document.createElement('div');
      itemEl.style.cssText = `
        display: flex; align-items: center; gap: 8px; padding: 4px 6px;
        border-radius: var(--radius-sm); cursor: pointer; user-select: none;
        background: var(--bg-0); border: 1px solid var(--border); font-size: 11px;
      `;
      const isErr = it.level === 'error';
      const icon = getIconSvg(isErr ? 'alert' : 'info', 13, isErr ? 'pf-prob-err' : 'pf-prob-warn');
      itemEl.innerHTML = `<span style="color:${isErr ? 'var(--danger)' : 'var(--warning)'};">${icon}</span><span style="flex:1;">${it.text}</span><span style="color:var(--accent);">Aller à →</span>`;

      itemEl.onclick = () => {
        if (it.kind) {
          workspace.open({ kind: it.kind, refId: it.refId });
        }
      };

      listEl.appendChild(itemEl);
    }
  }

  container.querySelector('[data-act="recheck"]').onclick = () => validate();

  const offChange = store.on('change', () => {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(validate, 1000);
  });
  const offLoad = store.on('load', () => validate());

  validate();

  return () => {
    offChange();
    offLoad();
    clearTimeout(validateTimer);
  };
}
