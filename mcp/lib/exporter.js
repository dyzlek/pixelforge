// Export HTML autonome (même résultat que le bouton « Exporter » de l'éditeur).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, exportsDir } from './store.js';

export async function buildHTML(project) {
  const file = path.join(ROOT, 'src', 'runtime', 'export-template.js');
  if (!fs.existsSync(file)) throw new Error('src/runtime/export-template.js not found (it must export buildStandaloneHTML(project, engineSource, chipSource))');
  const { buildStandaloneHTML } = await import(pathToFileURL(file).href);
  const chipFile = path.join(ROOT, 'src', 'audio', 'chip.js');
  const chip = fs.existsSync(chipFile) ? fs.readFileSync(chipFile, 'utf8') : '';
  const engine = fs.readFileSync(path.join(ROOT, 'src', 'runtime', 'engine.js'), 'utf8');
  return buildStandaloneHTML(project, engine, chip);
}

export async function exportGameHTML(project) {
  const html = await buildHTML(project);
  fs.mkdirSync(exportsDir(), { recursive: true });
  const file = path.join(exportsDir(), project.meta.id + '.html');
  fs.writeFileSync(file, html);
  return { file, bytes: Buffer.byteLength(html) };
}
