# Contribuer à PixelForge

Merci de vous intéresser au développement de PixelForge ! Ce document explique les conventions et les étapes pour contribuer au projet.

## 🚀 Démarrage rapide

1. **Cloner le dépôt** et installer les dépendances :
   ```bash
   git clone https://github.com/dyzlek/pixelforge.git
   cd pixelforge
   npm install
   ```

2. **Lancer l'éditeur en développement** :
   ```bash
   npm run dev
   ```
   L'éditeur s'ouvre par défaut sur [http://localhost:5173](http://localhost:5173). Le dossier `games/` est synchronisé en direct (SSE + REST).

3. **Lancer le serveur MCP** (pour connecter un assistant comme Claude ou Cursor) :
   ```bash
   npm run mcp
   ```

## 🧪 Tests et validation obligatoire

Avant de soumettre une pull request ou d'effectuer un commit, **toutes** ces commandes doivent passer sans erreur :

```bash
npm run build
npm test
npm run pf -- validate tetris
npm run pf -- validate exemple-plateforme-qiqv
npm run pf -- validate monde-1-1
```

Ces vérifications sont automatiquement exécutées par la CI GitHub Actions.

## 📐 Règles architecturales et style de code

1. **Stack minimaliste** : JavaScript vanilla moderne (modules ES), CSS standard, sans framework frontend (pas de React, Vue ou Tailwind).
2. **Pas de nouvelles dépendances npm** sans justification forte et accord préalable.
3. **`src/runtime/engine.js` ne doit comporter aucun `import`** : ce moteur est inliné tel quel (`?raw`) lors de l'export autonome en page HTML unique.
4. **`src/graph/` doit rester strictement sans DOM** : ce module doit pouvoir s'exécuter sous Node.js (utilisé par le serveur MCP et la CLI).
5. **Ne modifiez jamais un jeu dans `games/` à la main** sans exécuter immédiatement `npm run pf -- validate <nom-du-jeu>`.
6. **Une PR = un sujet précis.** Gardez les commits clairs et descriptifs, rédigés au présent en français (ex. : `Ajoute le nœud ...`, `Corrige l'affichage ...`).

## 🧩 Comment ajouter un nœud Blueprint

Pour ajouter un nouveau nœud dans le système de scripting visuel :

1. **Déclarer le nœud** dans [`src/graph/nodes.js`](src/graph/nodes.js) :
   - Définir `type`, `title`, `category`, `kind` (`'pure'`, `'action'`, `'event'`), les broches (`inputs`, `outputs`) et les champs (`fields`).
2. **Implémenter la compilation JS** dans [`src/graph/compile.js`](src/graph/compile.js) :
   - Écrire la fonction de transformation en code JavaScript Phaser/PixelForge.
3. **Tester** dans [`src/graph/test/graph.test.mjs`](src/graph/test/graph.test.mjs) :
   - Ajouter un cas de test et s'assurer que `npm test` passe avec 0 échec.
4. **Valider** :
   - Vérifier avec `npm run pf -- nodes <nom>` que le nœud est bien répertorié.
