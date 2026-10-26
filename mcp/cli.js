#!/usr/bin/env node
// CLI : node mcp/cli.js list | validate <jeu> | compile <jeu> | export <jeu> | render <jeu> <carte> | show <jeu> | nodes [mot]
import * as pf from './lib/index.js';

const [cmd, game, map] = process.argv.slice(2);
const NL = String.fromCharCode(10);
const usage = 'usage: node mcp/cli.js list | validate <game> | compile <game> | export <game> | render <game> [map|scene] | render3d <game> [scene] | show <game> | nodes [category|word]';

try {
  if (cmd === 'list') {
    const g = pf.listGames();
    console.log(g.length ? g.map((x) => `${x.id}\t"${x.name}"\t${x.updatedAt}`).join('\n') : 'No games in ' + pf.gamesDir());
  } else if (cmd === 'validate' && game) {
    const issues = pf.validateProject(pf.loadGame(game));
    console.log(pf.formatIssues(issues));
    process.exitCode = issues.some((i) => i.level === 'error') ? 1 : 0;
  } else if (cmd === 'compile' && game) {
    // recompile les scripts Blueprint du jeu (script.code) et sauvegarde
    const p = pf.loadGame(game);
    const { changed, errors } = pf.recompileGraphs(p);
    if (changed.length) pf.saveGame(p);
    console.log(changed.length ? 'Recompiled: ' + changed.join(', ') + '.' : 'Blueprint scripts already up to date.');
    if (errors.length) { console.log('Compile errors:' + NL + '- ' + errors.join(NL + '- ')); process.exitCode = 1; }
  } else if (cmd === 'nodes') {
    // catalogue des nœuds : un mot de catégorie (event, move, flow...) ou une recherche libre
    const known = pf.listNodes({ category: game }).startsWith('##');
    console.log(pf.listNodes(known ? { category: game } : { search: game }));
  } else if (cmd === 'export' && game) {
    const { file, bytes } = await pf.exportGameHTML(pf.loadGame(game));
    console.log(`Exported ${file} (${Math.round(bytes / 1024)} KB)`);
  } else if ((cmd === 'render' || cmd === 'render3d') && game) {
    const p = pf.loadGame(game);
    if (cmd === 'render3d' || p.settings.dimension === '3d') {
      const defaultScene = (p.scenes3d || []).find((s) => s.id === (p.settings.startScene3DId || p.settings.startMapId))?.name || (p.scenes3d || [])[0]?.name;
      console.log(pf.renderScene3D(p, map || defaultScene));
    } else {
      console.log(pf.renderMap(p, map || p.maps.find((m) => m.id === p.settings.startMapId)?.name));
    }
  } else if (cmd === 'show' && game) {
    console.log(pf.summarize(pf.loadGame(game)));
  } else {
    console.log(usage);
    process.exitCode = cmd ? 2 : 0;
  }
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 1;
}
