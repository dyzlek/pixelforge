/**
 * PixelForge Studio — Boîte de dialogue Préférences (Thème, Échelle d'interface, Langue)
 */

const PREFS_KEY = 'pixelforge.preferences';

export function getPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    theme: 'dark',
    scale: '100%',
    lang: 'fr',
    defaultGrid: 16,
  };
}

export function savePreferences(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  applyPreferences(prefs);
}

export function applyPreferences(prefs) {
  // Application du thème
  document.documentElement.dataset.theme = prefs.theme || 'dark';

  // Application de l'échelle d'interface
  if (prefs.scale) {
    document.documentElement.style.zoom = prefs.scale;
  }
}

export function openPreferencesModal({ onThemeChange = () => {} } = {}) {
  const prefs = getPreferences();

  const back = document.createElement('div');
  back.className = 'pf-palette-back';

  back.innerHTML = `
    <div class="pf-pm-modal" style="width:min(480px,92vw);">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:10px;">
        <h3 style="margin:0;font-size:16px;">Préférences Studio</h3>
        <button id="pf-prefs-close" class="pf-dock-btn" style="font-size:16px;">×</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <label style="color:var(--fg-1);font-weight:600;">Thème de l'interface :</label>
          <select id="pf-pref-theme" class="pf-insp-input" style="width:160px;">
            <option value="dark"${prefs.theme === 'dark' ? ' selected' : ''}>Sombre (Godot 4)</option>
            <option value="light"${prefs.theme === 'light' ? ' selected' : ''}>Clair</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <label style="color:var(--fg-1);font-weight:600;">Échelle d'affichage (Zoom) :</label>
          <select id="pf-pref-scale" class="pf-insp-input" style="width:160px;">
            <option value="90%"${prefs.scale === '90%' ? ' selected' : ''}>90 %</option>
            <option value="100%"${prefs.scale === '100%' ? ' selected' : ''}>100 % (Défaut)</option>
            <option value="110%"${prefs.scale === '110%' ? ' selected' : ''}>110 %</option>
            <option value="125%"${prefs.scale === '125%' ? ' selected' : ''}>125 %</option>
            <option value="150%"${prefs.scale === '150%' ? ' selected' : ''}>150 %</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <label style="color:var(--fg-1);font-weight:600;">Langue :</label>
          <select id="pf-pref-lang" class="pf-insp-input" style="width:160px;">
            <option value="fr"${prefs.lang === 'fr' ? ' selected' : ''}>Français</option>
            <option value="en"${prefs.lang === 'en' ? ' selected' : ''}>English</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <label style="color:var(--fg-1);font-weight:600;">Grille par défaut :</label>
          <select id="pf-pref-grid" class="pf-insp-input" style="width:160px;">
            <option value="16"${prefs.defaultGrid === 16 ? ' selected' : ''}>16 × 16 px</option>
            <option value="24"${prefs.defaultGrid === 24 ? ' selected' : ''}>24 × 24 px</option>
            <option value="32"${prefs.defaultGrid === 32 ? ' selected' : ''}>32 × 32 px</option>
          </select>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;border-top:1px solid var(--border);padding-top:10px;">
        <button id="pf-prefs-save" class="primary" style="padding:4px 14px;">Enregistrer</button>
      </div>
    </div>
  `;

  document.body.appendChild(back);

  const close = () => back.remove();

  back.querySelector('#pf-prefs-close').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };

  back.querySelector('#pf-prefs-save').onclick = () => {
    const updated = {
      theme: back.querySelector('#pf-pref-theme').value,
      scale: back.querySelector('#pf-pref-scale').value,
      lang: back.querySelector('#pf-pref-lang').value,
      defaultGrid: parseInt(back.querySelector('#pf-pref-grid').value, 10) || 16,
    };
    savePreferences(updated);
    onThemeChange(updated.theme);
    close();
  };
}
