# Journal des modifications (Changelog)

Toutes les modifications notables apportées au projet PixelForge seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et ce projet adhère à [Semantic Versioning](https://semver.org/lang/fr/).

## [2.0.0] - 2026-10-26

### Ajouté
- **Scripting visuel Blueprint** : éditeur de graphes de nœuds façon Unreal Engine avec fils d'exécution et fils de données typés.
- Compilateur de graphes vers JavaScript (`src/graph/compile.js`) avec vérification des types et 0 dépendance DOM (fonctionne sous Node.js et dans le navigateur).
- Migration automatique des anciens projets Blockly vers le format Blueprint.
- Intégration complète MCP et CLI : outils `list_nodes`, `compile`, inspection et manipulation des graphes.
- Déploiement GitHub Pages automatisé avec export des jeux d'exemple dans IndexedDB.
- Intégration continue (CI) avec validation exhaustive de la suite de tests et des jeux du projet.
- Documentation communautaire complète : `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE` (MIT).

## [1.2.0] - 2026-10-26

### Ajouté
- Événements `overlapStart` et `overlapEnd` pour les détections de franchissement et zones de déclenchement.
- Méthodes physiques avancées : `setCollideMap`, `setCollideObjects`, `flipY`, `setHitbox`.
- Lancer de rayons (`game.raycast`) capable d'intercepter les instances d'objets, avec détection de calques.
- Prise en charge des mécanismes de portails et téléportations.

## [1.1.0] - 2026-10-26

### Ajouté
- Bibliothèque de jeux intégrée avec stockage sur disque (API REST + SSE) en mode dev et bascule IndexedDB en statique.
- Serveur MCP (Model Context Protocol) 20 outils pour génération et pilotage par IA.
- CLI PixelForge (`npm run pf`) pour lister, afficher, valider, compiler, dessiner et exporter des jeux.
- Synthétiseur audio WebAudio pour effets sonores rétro et musiques chiptune.
- Support du tactile mobile et des manettes de jeu (gamepad).
- Jeu de démonstration complet « Monde 1-1 ».

## [1.0.0] - 2026-10-26

### Ajouté
- Version initiale de PixelForge : éditeur de sprites pixel art, éditeur de cartes en tuiles avec calques de collision.
- Intégration du moteur Phaser 3 et éditeur de script avec CodeMirror.
- Export autonome en page HTML unique (`dist/exports/<jeu>.html`).
- Jeu de démonstration « Exemple : plateforme » et Tetris rétro.
