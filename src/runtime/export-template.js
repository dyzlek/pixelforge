// Gabarit de l'export HTML autonome. Fonction pure, sans import : utilisable depuis le navigateur ET depuis Node
// (le serveur MCP l'importe). engineSource = contenu de engine.js ; seul Phaser vient d'un CDN.
// Le moteur inclus gère déjà clavier, manette, contrôles tactiles et son.

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildStandaloneHTML(project, engineSource, chipSource = '') {
  // On retire uniquement le mot-cle d'export place en debut de ligne dans engine.js et chip.js
  const chip = String(chipSource || '').replace(/^export\s+/gm, '').replace(/<\/script/gi, '<\\/script');
  const engine = String(engineSource || '').replace(/^export\s+/gm, '').replace(/<\/script/gi, '<\\/script');
  const data = JSON.stringify(project).replace(/</g, '\\u003c');
  const title = escHtml((project && project.name) || 'Jeu');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${title}</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; touch-action: none; }
  #game { position: fixed; inset: 0; }
  #errors { position: fixed; left: 0; right: 0; bottom: 0; max-height: 30%; overflow: hidden; padding: 4px 8px;
    font: 12px/1.4 monospace; color: #ff9aa6; background: rgba(0, 0, 0, .7); pointer-events: none; display: none; }
</style>
</head>
<body>
<div id="game"></div>
<div id="errors"></div>
<script src="https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser.min.js"><\/script>
${chip ? `<script>\n${chip}\n<\/script>` : ''}
<script>
${engine}
</script>
<script>
const PROJECT = ${data};
const errorsEl = document.getElementById('errors');
const lines = [];
createGame(PROJECT, document.getElementById('game'), Phaser, {
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
</script>
</body>
</html>
`;
}
