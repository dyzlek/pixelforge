# Journal — PixelForge

**But** : moteur / éditeur de jeux 2D dans le navigateur, basé sur Phaser 3 : pixel art, cartes en tuiles, objets avec scripts en code (CodeMirror) ou en blocs (Blockly), test en direct, export HTML autonome.
**Technos** : Vite 6, JS vanilla (modules ES), phaser 3.90, blockly 11, codemirror 6.
**Structure** : voir docs/ARCHITECTURE.md (onglets = modules mount/unmount dans src/editors/* et src/runtime/play.js ; noyau src/core ; API des scripts docs/SCRIPT_API.md).
**Lancer** : `npm install` puis `npm run dev` (ou config `pixelforge` de .claude/launch.json, port 5180). Projet sauvegardé en localStorage (`pixelforge.project`) ; Enregistrer/Ouvrir = fichier .pixelforge.json.

---

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
