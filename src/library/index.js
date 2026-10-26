// Écran « Gestionnaire de Projets » (Project Manager façon Godot 4)
import './style.css';
import { createProjectManager } from '../ui/project-manager.js';

let cleanup = null;

export function mount(container, store) {
  cleanup = createProjectManager(container, store);
  return cleanup;
}

export function unmount() {
  if (cleanup) {
    try { cleanup(); } catch {}
    cleanup = null;
  }
}
