#!/usr/bin/env node
// CLI : node mcp/cli.js list | validate <jeu> | export <jeu> | render <jeu> <carte> | show <jeu>
import * as pf from './lib/index.js';

const [cmd, game, map] = process.argv.slice(2);
const usage = 'usage: node mcp/cli.js list | validate <game> | export <game> | render <game> <map> | show <game>';

try {
  if (cmd === 'list') {
    const g = pf.listGames();
    console.log(g.length ? g.map((x) => `${x.id}\t"${x.name}"\t${x.updatedAt}`).join('\n') : 'No games in ' + pf.gamesDir());
  } else if (cmd === 'validate' && game) {
    const issues = pf.validateProject(pf.loadGame(game));
    console.log(pf.formatIssues(issues));
    process.exitCode = issues.some((i) => i.level === 'error') ? 1 : 0;
  } else if (cmd === 'export' && game) {
    const { file, bytes } = await pf.exportGameHTML(pf.loadGame(game));
    console.log(`Exported ${file} (${Math.round(bytes / 1024)} KB)`);
  } else if (cmd === 'render' && game) {
    const p = pf.loadGame(game);
    console.log(pf.renderMap(p, map || p.maps.find((m) => m.id === p.settings.startMapId).name));
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
