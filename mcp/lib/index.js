// Point d'entrée de la bibliothèque (partagée par server.js et cli.js)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './store.js';

export * from './store.js';
export * from './ops.js';
export * from './validate.js';
export * from './render.js';
export * from './exporter.js';
export { applyPlatformerTemplate } from './template.js';
export { textToFrames, framesToText } from './sprites.js';
export { encodePNG, decodePNG } from './png.js';

export const readDoc = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
