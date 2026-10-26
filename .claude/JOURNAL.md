# Journal — PixelForge

**But** : moteur / éditeur de jeux 2D dans le navigateur, basé sur Phaser 3 : pixel art, cartes en tuiles, objets avec scripts en code (CodeMirror) ou en blocs (Blockly), test en direct, export HTML autonome.
**Technos** : Vite 6, JS vanilla (modules ES), phaser 3.90, blockly 11, codemirror 6.
**Structure** : voir docs/ARCHITECTURE.md (onglets = modules mount/unmount dans src/editors/* et src/runtime/play.js ; noyau src/core ; API des scripts docs/SCRIPT_API.md).
**Lancer** : `npm install` puis `npm run dev` (ou config `pixelforge` de .claude/launch.json, port 5180). Projet sauvegardé en localStorage (`pixelforge.project`) ; Enregistrer/Ouvrir = fichier .pixelforge.json.

---

## 2026-10-26 (24) — [Phase A] A5 : Éditeur de scène 2D et arbre de scène (Scene Tree)
- **Fait** :
  - Support de `angle`, `scale`, `locked`, `visible` sur les entités de scène dans `docs/PROJECT_SCHEMA.json`, `src/core/project.js` (`normalizeProject`) et `src/runtime/engine.js` (sans aucun import).
  - Création de `src/ui/panels/scene-tree.js` et `scene-tree.css` : panneau Arbre de scène dans le dock gauche avec gestion des calques et des entités.
  - Bascule de visibilité 👁 et verrouillage 🔒 individuels par calque et par entité.
  - Glisser-déposer d'objets depuis l'explorateur de ressources directement sur la vue 2D pour instanciation rapide alignée sur la grille (ou pixel par pixel avec Alt).
  - Raccourci `Ctrl+D` pour dupliquer l'entité sélectionnée.
  - Synchronisation bidirectionnelle de sélection entre la scène 2D et l'inspecteur unifié.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #6.

## 2026-10-26 (23) — [Phase A] A4 : Inspecteur unifié piloté par schéma
- **Fait** :
  - Création de `src/ui/inspector-schemas.js` : déclarations de schémas par type (objets, entités, cartes, sons, réglages) avec groupes repliables (Général, Physique, Hitbox, Transform, Props).
  - Création de `src/ui/inspector.js` et `src/ui/inspector.css` : inspecteur unifié dans le dock droit.
  - Scrubbing horizontal à la souris sur les champs numériques pour ajuster rapidement les valeurs.
  - Bouton `↺` de réinitialisation automatique à la valeur par défaut pour les champs modifiés.
  - Support des variables d'instance personnalisées `exportedProps: [{ name, type, default }]` façon `@export` Godot dans `src/core/project.js` et `docs/PROJECT_SCHEMA.json`.
  - Intégration de la sélection via `store.ui.selection` et `store.setSelection()`.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #5.

## 2026-10-26 (22) — [Phase A] A3 : Panneau « Ressources » (FileSystem façon Godot)
- **Fait** :
  - Support du champ `folder` pour les dossiers virtuels dans `src/core/project.js` (`normalizeProject`) et `docs/PROJECT_SCHEMA.json`.
  - Création de `src/ui/panels/resources.js` et `resources.css` : explorateur d'arborescence des ressources avec catégories (scènes, objets, sprites, sons).
  - Filtrage et recherche rapide en temps réel.
  - Miniatures graphiques dynamiques pour les sprites et objets.
  - Double-clic pour ouvrir n'importe quelle ressource dans un onglet du workspace.
  - Glisser-déposer (`dragstart`) avec payload structuré `application/pixelforge-resource`.
  - Actions d'ajout, duplication, et suppression avec détection préventive des dépendances (objets placés dans les cartes, sprites utilisés par les objets/tuiles).
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #4.

## 2026-10-26 (21) — [Phase A] A2 : Documents ouverts en onglets (Multi-document workspace)
- **Fait** :
  - Création de `src/ui/documents.js` et `src/ui/documents.css` : gestionnaire d'onglets de documents ouverts (scènes, sprites, scripts, sons, jouer, bibliothèque).
  - Préservation de l'état de vue (zoom, pan, scroll, sélections) lors du basculement d'onglets grâce à la conservation du DOM avec bascule display.
  - Pastille `●` en cas de modifications non sauvegardées.
  - Fermeture d'onglets (bouton `×`, clic molette `auxclick`, raccourci `Ctrl+W`).
  - Navigation rapide au clavier (`Ctrl+Tab` et `Ctrl+Maj+Tab`).
  - Mémorisation des onglets ouverts et de l'onglet actif par projet dans `localStorage`.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #3.

## 2026-10-26 (20) — [Phase A] A1 : Coque à panneaux ancrés (Dock layout)
- **Fait** :
  - Création de `src/ui/dock.js` et `src/ui/dock.css` : gestionnaire de dock inspiré de Godot 4 sans dépendance externe.
  - Zones gauche, droite, bas et centre avec splitters redimensionnables à la souris et contraintes min/max.
  - Panneaux repliables avec boutons chevrons et persistance dans `localStorage` (`pixelforge.layout`).
  - Barre de menus (Jeu, Affichage, Aide) et barre de lancement (Jouer F5, Scène F6, Arrêter F8).
  - Raccourcis clavier globaux F5, F6, F8.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #2.

## 2026-10-26 (19) — [Phase A] A0 : Jetons de design et thème (Design tokens & Theme)
- **Fait** :
  - Création de `src/ui/theme.css` avec les jetons Godot 4 complets : tokens de fond (`--bg-0` à `--bg-3`), texte (`--fg-0` à `--fg-2`), accents (`--accent`, `--danger`, `--warning`, `--success`), rayons, espacements, ombres et polices.
  - Support des thèmes sombre et clair (`[data-theme="light"]`).
  - Remplacement des couleurs en dur dans les feuilles de styles (`src/style.css`, map, objects, pixel, library).
  - Bouton de bascule de thème dans la barre supérieure avec persistance dans `localStorage`.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #1.

## 2026-10-26 (18) — Revue des issues GitHub
- **Fait** : vérifié les 28 issues (#1–#28, une par tâche de ROADMAP-STUDIO, jalons OK) ; #1 réécrite avec accents + critère tests ; #20 critère « validé par l'humain » ajouté ; issue #29 « À lire d'abord » (règles, décisions D1–D5, dépendances) créée et épinglée.
- **État** : aucun changement de code ; rien à commiter côté issues.

## 2026-10-26 (17) — Feuille de route v3 (studio)
- **Fait** : ROADMAP-STUDIO.md — phase A interface façon Godot/GameMaker (dock, documents, ressources, inspecteur, scène, débogage), phase B studio musical 8-bit façon FL Studio (modèle `songs`, moteur chip partagé sans import, rack, piano roll, playlist, sfxr, API/Blueprints/MCP), phase C 3D (Three.js + Rapier, voxel, gridmap, Blueprints 3D, MCP), phase D transversale, jalons et risques.
- **Décisions** : rien codé à la demande de l'utilisateur (une autre IA codera) ; décisions D1–D5 laissées à l'utilisateur.
- **État** : fichier non commité.

## 2026-10-26 (16) — « Charger les jeux d'exemple » demande avant d'écraser
- **Fait (Opus)** : src/library/index.js — télécharge tous les jeux d'abord ; si des ids existent déjà, confirm() qui les liste : OK = remplacer, Annuler = ne charger que les manquants ; le jeu ouvert est fermé avant d'être remplacé puis rouvert (sinon sa sauvegarde auto réécrivait l'ancienne version) ; repli sur l'exemple intégré seulement si games/index.json est introuvable.
- **Vérifié** : build Pages servi en statique : Annuler → rien d'écrasé, OK → remplacés, jeu ouvert rouvert, aucune erreur ; build, npm test.
- **État** : main, commit « Demande avant d'écraser… », poussé. Reste non commité : games/exemple-plateforme-qiqv.pixelforge.json (seul `updatedAt` a changé pendant les tests de l'éditeur ; restauration par `git checkout` refusée par le contrôle de permissions, laissé à l'utilisateur).

## 2026-10-26 (15) — Relecture (Opus) du travail P0 + P1.1 + P1.7
- **Vérifié** : build, build Pages, npm test, check:doc, validate ×3, CI verte ; Ctrl+Z / Ctrl+Y du graphe testés dans le navigateur (suppression → annuler → rétablir, pas de double annulation avec le store) ; build Pages servi en statique sous /pixelforge/ : « Charger les jeux d'exemple » fonctionne.
- **Problèmes relevés** : déploiement Pages en échec (Pages pas activé dans les réglages du dépôt → lien démo du README mort) ; « Charger les jeux d'exemple » écrase sans prévenir les jeux du même id ; commit « miniature de Tetris » contient aussi des changements de sons et de positions de nœuds.
- **État** : rien corrigé, rien commité (seul updatedAt de l'exemple a bougé pendant le test).

## 2026-10-26 (14) — P1.1 Annuler / rétablir dans le graphe (Ctrl+Z / Ctrl+Y)
- **Fait** : pile d'historique locale dans src/editors/objects/graph-editor.js (limite 100 snapshots), pushHistory appelé à chaque action (création, liaison, suppression, déplacement, champ), annulation/rétablissement via Ctrl+Z, Ctrl+Maj+Z et Ctrl+Y ; exclusion du capture store.js sur .bp-canvas et .bp-root.
- **Décisions** : historique isolé au graphe pour une annulation granulaire et fiable de chaque manipulation de nœuds/fils.
- **État** : tests et build OK.

## 2026-10-26 (13) — P1.7 Documentation utilisateur des nœuds
- **Fait** : scripts/gen-nodes-doc.mjs générant docs/NODES.md (161 nœuds, 18 catégories, entrées, sorties, champs, exemples de code compilé), scripts "doc:nodes" et "check:doc" dans package.json et vérification dans la CI ; bouton d'aide "?" dans l'en-tête de chaque nœud du graphe et dans son menu contextuel ouvrant une fiche d'aide.
- **Décisions** : documentation générée automatiquement pour garantir l'absence de dérive avec le catalogue src/graph/nodes.js.
- **État** : tests et build OK.

## 2026-10-26 (12) — P0.6 README présentable et version anglaise
- **Fait** : refonte complète de README.md (badges CI/License/Node/Vite/Phaser, lien démo en ligne GitHub Pages, démarrage rapide en 5 min, architecture Mermaid, fonctionnalités détaillées, raccourcis Blueprints, guide MCP/CLI), création de README.en.md.
- **Décisions** : documentation bilingue accessible à la communauté internationale.
- **État** : tests et build OK.

## 2026-10-26 (11) — Fichiers communautaires et templates
- **Fait** : CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, .github/ISSUE_TEMPLATE/ (bug.yml, feature.yml) et .github/pull_request_template.md.
- **Décisions** : documentation des règles de contribution (tests obligatoires, règles architecturales), politique de sécurité pour l'évaluation new Function, et changelog 1.0 à 2.0.
- **État** : tests et build OK.

## 2026-10-26 (10) — P0.4 Démo en ligne (GitHub Pages)
- **Fait** : base configurable via GITHUB_PAGES dans vite.config.js, copie de games/ dans dist/games/ avec index.json, bouton "Charger les jeux d'exemple" dans la bibliothèque, création de .github/workflows/pages.yml.
- **Décisions** : support statique autonome avec fallback propre.
- **État** : tests et build OK.

## 2026-10-26 (9) — P0.5 Intégration continue (CI)
- **Fait** : ajout du script "test" dans package.json, création de .github/workflows/ci.yml (build, tests, validations des 3 jeux).
- **Décisions** : workflow standard Ubuntu + Node 20 avec cache npm.
- **État** : tests et build OK.

## 2026-10-26 (8) — P0.3 Nettoyer le dépôt
- **Fait** : suppression du doublon games-src/generate_tetris_blocks.mjs, ajout de .gitattributes (* text=auto eol=lf).
- **Décisions** : conservation de tetris.mjs unique.
- **État** : tests et build OK.

## 2026-10-26 (7) — P0.2 Compléter package.json
- **Fait** : description, author, repository, homepage, bugs, keywords, engines, private: true, suppression de main.
- **Décisions** : métadonnées alignées avec le dépôt GitHub dyzlek/pixelforge.
- **État** : tests et build OK.

## 2026-10-26 (6) — P0.1 Licence MIT
- **Fait** : création de LICENSE (MIT 2026, Dylan Belledent), mise à jour de package.json et README.md.
- **Décisions** : licence MIT choisie par l'utilisateur.
- **État** : tests OK, build OK.

## 2026-10-26 (5) — Feuille de route
- **Fait** : ROADMAP.md (P0 public → P3, avec fichiers / comment / vérif, destiné à être exécuté par une autre IA).
- **Essayé** : passer le dépôt en public → bloqué par le contrôle de permissions ; l'utilisateur doit le faire lui-même.
- **Décisions** : licence non choisie (à demander, P0.1).
- **État** : main, commit « Ajoute la feuille de route » poussé ; dépôt encore privé.

## 2026-10-26 (4) — Blueprints (en cours)
- **Fait (Opus)** : contrat du nouveau format graphe de nœuds façon Unreal dans docs/BLUEPRINTS.md ; `git init` + commit de base 429b2ba (.gitignore : node_modules, dist, exports) ; `npm install`.
- **Fait (Sonnet)** : éditeur visuel src/editors/objects/graph-editor.js + graph.css, editor.js sans Blockly (modes Blueprint / Code), rewriteRefs parcourt aussi s.graph ; build OK. Limites : pas de Ctrl+Z propre au graphe, pas de reroute.
- **Fait (Sonnet)** : noyau src/graph/ (161 nœuds, compilateur, blocklyToGraph, test 2264 vérifs OK, code identique à Blockly sur les scripts réels).
- **Vérifié (Opus)** : rendu Unreal correct dans le navigateur (Flag converti, palette « Toutes les actions »).
- **Fait (Sonnet)** : intégration — normalizeProject migre 'blocks' → graphe (code recompilé), sample en graphes, blocks.js → src/graph/test/legacy-blocks.js, blockly en devDependency (bundle −43 %), MCP `graph` dans upsert_object/set_script + outil `list_nodes`, CLI `compile` / `nodes`, validate des graphes, games/ migrés, docs + AGENTS.md + README.md.
- **Vérifié (Opus)** : build, graph.test 2277/0, e2e ALL OK, validate des 3 jeux OK, Tetris converti jouable dans le navigateur.
- **Décisions** : `script.mode: 'graph'`, `script.graph` ; types de nœuds = noms des anciens blocs ; dépôt GitHub **privé** (dyzlek/pixelforge).
- **Limites** : pas de Ctrl+Z propre au graphe ; graphes convertis très larges (Flag ≈ 4400 px) ; games-src/tetris.mjs et generate_tetris_blocks.mjs sont des doublons.
- **État** : branche main, commit Blueprints poussé sur GitHub (privé).

## 2026-10-26 (3) — v1.2 : prêt pour Portal en blocs
- **Fait (Sonnet, effort medium)** : overlapStart/overlapEnd, setCollideMap/setCollideObjects, flipY, setHitbox, raycast contre les instances (+ layer/instance/objectName), camera.setOffset ; blocs correspondants (cibles, rayons, caméra) ; docs v1.2, validate.js, autocomplétion.
- **Vérifié (Opus)** : build, e2e MCP ALL OK, validate monde-1-1 OK, engine.js toujours 1 seul export. Mini Portal en blocs joué en headless par l'agent.
- **Limites** : overlapEnd absent si une instance est détruite ; un portail posé sur le joueur déclenche overlapStart (prévoir une garde) ; glisser-déposer Blockly dans le navigateur non testé ; tetris a des variables non déclarées (heldPiece, gameOver) dans son script.

## 2026-10-26 (2) — v1.1 : API étendue, bibliothèque, MCP, Monde 1-1
- **Fait** : moteur v1.1 (son WebAudio, souris, manette, tactile, tuiles get/set, raycast, hitTile, messages, props, particules, save/load) ; bibliothèque games/ + API REST/SSE dans vite.config.js (synchro live avec le disque) ; serveur MCP 20 outils (mcp/), CLI `npm run pf`, AGENTS.md, llms.txt, docs/PROJECT_SCHEMA.json ; blocs pour toute l'API (107) ; onglet Sons ; éditeur de cartes (props d'instance, calques 'above', mini-carte, copier/coller) ; jeu « Monde 1-1 » généré par games-src/monde-1-1.mjs.
- **Corrigé par Opus** : échappement de l'export HTML (export-template.js). **Par l'agent 1-1** : touching faux sur les overlaps (engine.js).
- **Vérifié** : build ; e2e MCP OK ; validate monde-1-1 OK ; 1-1 joué jusqu'au château par un bot ; bibliothèque affiche les 3 jeux. Un jeu « tetris » est apparu dans games/ (créé hors de cette session, probablement via MCP).
- **À faire (manques pour Portal relevés)** : setPosition/setVelocity sur une autre instance en blocs, overlapStart/overlapEnd, self.setCollideMap, raycast contre les instances, tuiles non portalisables, API caméra (zone morte, position), hitbox par instance, flipY, police HUD pixel, outil MCP play_test headless, upsert_game à id fixe, miniatures des jeux créés par MCP.
- **Duplication à surveiller** : src/editors/sound/synth.js copie la synthèse de engine.js.

## 2026-10-26 — Création du moteur
- **Fait** : noyau + shell (Opus) ; 4 modules en parallèle par Sonnet : pixel (src/editors/pixel), cartes (src/editors/map), objets & code/blocs (src/editors/objects), runtime + exemple (src/runtime, src/core/sample.js). Puis passe Sonnet : Coin/Flag de l'exemple en blocs + correctif espacement HUD.
- **Vérifié** : `npm run build` OK ; les 4 onglets s'affichent dans le navigateur ; dessin + annuler OK ; le jeu d'exemple tourne.
- **Décisions** : un tileset = un sprite dont chaque frame est une tuile ; le runtime n'exécute que `script.code` (les blocs régénèrent le code) ; engine.js sans import pour être inliné dans l'export HTML (`?raw`) ; noms d'objets de l'exemple en anglais (Player, Coin, Enemy, Flag).
- **État / limites connues** : `collide` arrive après séparation physique (vy = 0) → tester « sauter sur la tête » par la géométrie ; calques de tuiles toujours sous les entités ; suppression d'un sprite laisse des spriteId orphelins ; export HTML charge Phaser depuis le CDN jsdelivr ; pas de son.
