import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, listSpecs, createNode } from '../src/graph/nodes.js';
import { compileGraph } from '../src/graph/compile.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'docs', 'NODES.md');

function getCompiledExample(spec) {
  try {
    if (spec.kind === 'event') {
      const ev = createNode(spec.type);
      const res = compileGraph({ version: 1, nodes: [ev], links: [] });
      return res.code.trim();
    }
    if (spec.kind === 'action') {
      const ev = createNode('pf_on_create');
      const act = createNode(spec.type);
      act.id = 'n2';
      const res = compileGraph({
        version: 1,
        nodes: [ev, act],
        links: [{ from: ev.id, fromPin: 'then', to: act.id, toPin: 'exec' }],
      });
      return res.code.trim();
    }
    if (spec.kind === 'pure') {
      const ev = createNode('pf_on_create');
      const act = createNode('pf_log');
      act.id = 'n2';
      const pure = createNode(spec.type);
      pure.id = 'n3';
      const outPin = spec.outputs.find((p) => p.type !== 'exec')?.name || 'out';
      const res = compileGraph({
        version: 1,
        nodes: [ev, act, pure],
        links: [
          { from: ev.id, fromPin: 'then', to: act.id, toPin: 'exec' },
          { from: pure.id, fromPin: outPin, to: act.id, toPin: 'TEXT' },
        ],
      });
      return res.code.trim();
    }
  } catch {
    return '';
  }
  return '';
}

function generateMarkdown() {
  const specs = listSpecs();
  const byCat = new Map();
  for (const cat of CATEGORIES) byCat.set(cat.id, []);
  for (const spec of specs) {
    const list = byCat.get(spec.category) || [];
    list.push(spec);
    byCat.set(spec.category, list);
  }

  const lines = [];
  lines.push('# Catalogue des nœuds Blueprint de PixelForge');
  lines.push('');
  lines.push('> Ce document est généré automatiquement par `node scripts/gen-nodes-doc.mjs`.');
  lines.push(`> Total : **${specs.length} nœuds** répartis en **${CATEGORIES.length} catégories**.`);
  lines.push('');
  lines.push('## Sommaire des catégories');
  lines.push('');
  for (const cat of CATEGORIES) {
    const count = (byCat.get(cat.id) || []).length;
    lines.push(`- [${cat.label} (#${cat.id})](#${cat.id}) (${count} nœuds)`);
  }
  lines.push('');

  for (const cat of CATEGORIES) {
    const catSpecs = byCat.get(cat.id) || [];
    lines.push(`---`);
    lines.push('');
    lines.push(`## <a id="${cat.id}"></a>${cat.label}`);
    lines.push('');
    if (!catSpecs.length) {
      lines.push('*Aucun nœud dans cette catégorie.*');
      lines.push('');
      continue;
    }

    for (const spec of catSpecs) {
      const kindLabel = spec.kind === 'event' ? 'Événement' : spec.kind === 'pure' ? 'Pur (expression)' : 'Action';
      lines.push(`### \`${spec.type}\` — ${spec.title}`);
      lines.push('');
      lines.push(`**Type de nœud** : ${kindLabel}  `);
      if (spec.tooltip) lines.push(`**Description** : ${spec.tooltip}  `);
      if (spec.keywords) lines.push(`**Mots-clés de recherche** : \`${spec.keywords}\`  `);
      lines.push('');

      // Broches d'entrée
      if (spec.inputs.length > 0) {
        lines.push('**Entrées (broches) :**');
        lines.push('');
        lines.push('| Broche | Type | Valeur par défaut | Description |');
        lines.push('|---|---|---|---|');
        for (const pin of spec.inputs) {
          const def = pin.default !== undefined ? `\`${JSON.stringify(pin.default)}\`` : '—';
          lines.push(`| \`${pin.name}\` | \`${pin.type}\` | ${def} | ${pin.label || pin.name} |`);
        }
        lines.push('');
      }

      // Broches de sortie
      if (spec.outputs.length > 0) {
        lines.push('**Sorties (broches) :**');
        lines.push('');
        lines.push('| Broche | Type | Description |');
        lines.push('|---|---|---|');
        for (const pin of spec.outputs) {
          lines.push(`| \`${pin.name}\` | \`${pin.type}\` | ${pin.label || pin.name} |`);
        }
        lines.push('');
      }

      // Champs internes (widgets)
      if (spec.fields.length > 0) {
        lines.push('**Champs configurables :**');
        lines.push('');
        lines.push('| Champ | Type de widget | Valeur par défaut | Options / Détails |');
        lines.push('|---|---|---|---|');
        for (const f of spec.fields) {
          const def = f.default !== undefined ? `\`${JSON.stringify(f.default)}\`` : '—';
          const opts = f.options ? f.options.map((o) => `\`${o[1]}\``).join(', ') : '—';
          lines.push(`| \`${f.name}\` | \`${f.kind}\` | ${def} | ${opts} |`);
        }
        lines.push('');
      }

      // Exemple compilé
      const example = getCompiledExample(spec);
      if (example) {
        lines.push('**Exemple de code JavaScript compilé :**');
        lines.push('');
        lines.push('```javascript');
        lines.push(example);
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.join('\n') + '\n';
}

const isCheck = process.argv.includes('--check');
const md = generateMarkdown();

if (isCheck) {
  let existing = '';
  try {
    existing = fs.readFileSync(OUT_FILE, 'utf8');
  } catch {
    existing = '';
  }
  if (existing.trim() !== md.trim()) {
    console.error('Erreur: docs/NODES.md est obsolète. Exécutez "npm run doc:nodes" pour le mettre à jour.');
    process.exit(1);
  }
  console.log('OK: docs/NODES.md est à jour.');
} else {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, md, 'utf8');
  console.log(`Généré : ${OUT_FILE}`);
}
