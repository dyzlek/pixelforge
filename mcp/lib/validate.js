// Validation d'un projet PixelForge.
// Re-exporte depuis le module partage src/core/ops/validate.js et enrichit avec les mots-cles des fichiers locaux.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './store.js';
import { setValidationKeywords } from '../../src/core/ops/validate.js';

const read = (...p) => { try { return fs.readFileSync(path.join(ROOT, ...p), 'utf8'); } catch { return ''; } };

const dynamicEvents = [];
for (const m of read('docs', 'SCRIPT_API.md').matchAll(/\bon\(\s*'([A-Za-z]+)'/g)) dynamicEvents.push(m[1]);

const dynamicKeys = [];
const mKeys = /const KEYS\s*=\s*\[([^\]]*)\]/.exec(read('src', 'runtime', 'engine.js'));
if (mKeys) for (const k of mKeys[1].matchAll(/['"]([A-Za-z0-9_]+)['"]/g)) dynamicKeys.push(k[1]);

setValidationKeywords({ events: dynamicEvents, keys: dynamicKeys });

export * from '../../src/core/ops/validate.js';
