/**
 * PixelForge Studio — Registre central des raccourcis clavier (Godot / VS Code style)
 */

export class ShortcutRegistry {
  constructor() {
    this.commands = new Map(); // id -> { id, label, category, key, ctrl, shift, alt, shortcutText, action }
    this.setupListener();
  }

  register({ id, label, category = 'Général', key, ctrl = false, shift = false, alt = false, shortcutText = '', action }) {
    let text = shortcutText;
    if (!text && key) {
      const parts = [];
      if (ctrl) parts.push('Ctrl');
      if (alt) parts.push('Alt');
      if (shift) parts.push('Maj');
      parts.push(key.toUpperCase());
      text = parts.join('+');
    }
    this.commands.set(id, {
      id,
      label,
      category,
      key: key ? key.toLowerCase() : null,
      ctrl: !!ctrl,
      shift: !!shift,
      alt: !!alt,
      shortcutText: text,
      action,
    });
  }

  getCommands() {
    return Array.from(this.commands.values());
  }

  setupListener() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      for (const cmd of this.commands.values()) {
        if (!cmd.key) continue;

        // Commandes globales autorisées même dans les inputs
        const isGlobal = (cmd.id === 'palette' || cmd.id === 'quick-open' || cmd.id === 'save' || cmd.key === 'f5' || cmd.key === 'f6' || cmd.key === 'f8');
        if (isInput && !isGlobal) continue;

        if (cmd.key === k && cmd.ctrl === ctrl && cmd.shift === shift && cmd.alt === alt) {
          e.preventDefault();
          try {
            cmd.action();
          } catch (err) {
            console.error(`Erreur d'exécution du raccourci ${cmd.id}:`, err);
          }
          break;
        }
      }
    });
  }
}

export const shortcuts = new ShortcutRegistry();
