// Gabarit d'export HTML autonome pour les jeux 3D PixelForge.
// Fonction pure, sans import pour usage navigateur et Node.
// Three.js (0.186.1, identique a l'editeur) est charge en module ES via importmap (decision V3).
// chip.js et engine3d.js sont inlines.

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildStandaloneHTML3D(project, engine3dSource, chipSource = '') {
  const chip = String(chipSource || '').replace(/^export\s+/gm, '').replace(/<\/script/gi, '<\\/script');
  const engine3d = String(engine3dSource || '').replace(/^export\s+/gm, '').replace(/<\/script/gi, '<\\/script');
  const data = JSON.stringify(project).replace(/</g, '\\u003c');
  const title = escHtml((project && project.name) || 'Jeu 3D');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${title}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; touch-action: none; font-family: monospace; }
  #game { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
  canvas { image-rendering: pixelated; width: 100%; height: 100%; object-fit: contain; }
  #errors { position: fixed; left: 0; right: 0; bottom: 0; max-height: 30%; overflow: hidden; padding: 4px 8px;
    font: 12px/1.4 monospace; color: #ff9aa6; background: rgba(0, 0, 0, .7); pointer-events: none; display: none; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.min.js"
  }
}
<\/script>
</head>
<body>
<div id="game"></div>
<div id="errors"></div>
<script type="module">
import * as THREE from 'three';

${chip ? chip + '\n' : ''}
${engine3d}

const PROJECT = ${data};
const errorsEl = document.getElementById('errors');
const lines = [];

try {
  createGame3D(PROJECT, document.getElementById('game'), THREE, {
    createChipAudio: typeof createChipAudio !== 'undefined' ? createChipAudio : null,
    onLog(msg, level) {
      if (level !== 'error') { console.log(msg); return; }
      console.error(msg);
      lines.push(msg);
      if (lines.length > 4) lines.shift();
      errorsEl.textContent = lines.join('\\n');
      errorsEl.style.display = 'block';
      errorsEl.style.whiteSpace = 'pre-wrap';
    },
  });
} catch (err) {
  errorsEl.textContent = 'Erreur 3D : ' + err.message;
  errorsEl.style.display = 'block';
}
<\/script>
</body>
</html>`;
}
