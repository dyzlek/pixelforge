# PixelForge : ce qui manque (feuille de route)

Ce document liste ce qui manque pour que PixelForge soit **vraiment utile** et prêt pour un dépôt public.
Il est écrit pour être exécuté tâche par tâche par une IA (ou un humain). Chaque tâche indique : pourquoi, quels fichiers, comment, et comment vérifier.

## Règles pour l'IA qui exécute ce document

1. **Une tâche = un commit.** Message de commit en français, au présent : `Ajoute la licence MIT`, `Corrige …`.
2. **Avant chaque commit**, ces commandes doivent toutes passer :
   ```bash
   npm run build
   node src/graph/test/graph.test.mjs
   node mcp/test/e2e.mjs
   npm run pf -- validate tetris
   npm run pf -- validate exemple-plateforme-qiqv
   npm run pf -- validate monde-1-1
   ```
3. Lire **avant de coder** : `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/BLUEPRINTS.md`, `docs/SCRIPT_API.md`.
4. Respecter le style existant : JavaScript vanilla, modules ES, commentaires courts en français, **pas de nouvelle dépendance npm** sans raison forte.
5. `src/runtime/engine.js` **ne doit avoir aucun import** (il est inliné dans l'export HTML). `src/graph/` doit rester **sans DOM** (il tourne sous node pour le MCP).
6. Ne jamais modifier les jeux de `games/` à la main sans relancer `validate` ensuite.
7. Si une tâche est floue ou demande un choix (licence, nom, design), **demander à l'humain** au lieu de deviner.
8. Mettre à jour `.claude/JOURNAL.md` (entrée en haut : Fait / Décisions / État) après chaque tâche.

Priorités : **P0** = bloquant pour un dépôt public, **P1** = rend l'outil vraiment utile, **P2** = confort et finition, **P3** = plus tard.

---

## P0 : avant de rendre le dépôt public

### P0.1 Choisir et ajouter une licence
- **Pourquoi** : sans fichier `LICENSE`, personne n'a légalement le droit de réutiliser le code, même sur un dépôt public. `package.json` dit `ISC` mais il n'y a pas de fichier.
- **Comment** : demander à l'humain : **MIT** (simple, permissive, le plus courant) ou **GPL-3.0** (les forks doivent rester libres). Créer `LICENSE` avec le texte officiel (https://choosealicense.com), l'année 2026 et le nom de l'auteur. Mettre le même identifiant dans `package.json` (`"license": "MIT"`) et dans la section Licence du `README.md`.
- **Attention** : les sons, musiques et sprites du dépôt sont générés par le code, donc pas de problème de droits. Vérifier qu'aucune image ni aucun son n'a été copié d'un autre jeu ; « Monde 1-1 » imite Super Mario Bros : garder des noms neutres (« plombier », pas « Mario ») et ne jamais ajouter de sprites officiels.

### P0.2 Compléter `package.json`
- Champs à remplir : `"description"`, `"author"`, `"repository": { "type": "git", "url": "https://github.com/dyzlek/pixelforge" }`, `"homepage"`, `"bugs"`, `"keywords": ["game-engine", "pixel-art", "phaser", "blueprint", "visual-scripting", "mcp"]`, `"engines": { "node": ">=18" }`.
- Retirer `"main": "index.js"` (le fichier n'existe pas).
- Mettre `"private": true` pour éviter une publication npm par erreur.

### P0.3 Nettoyer le dépôt
- **Doublon** : `games-src/tetris.mjs` et `games-src/generate_tetris_blocks.mjs` sont identiques. En garder un seul (`tetris.mjs`) et chercher les références à l'autre (`git grep generate_tetris_blocks`).
- **Fichiers locaux** : décider si `.claude/JOURNAL.md` et `.claude/launch.json` restent dans le dépôt public. Le journal est utile pour l'historique, mais c'est un fichier personnel. Si on l'enlève : `git rm --cached` puis l'ajouter à `.gitignore`.
- **Fins de ligne** : ajouter un `.gitattributes` avec `* text=auto eol=lf` pour arrêter les avertissements LF/CRLF, puis `git add --renormalize .` dans un commit séparé.
- **Vie privée** : l'adresse e-mail des commits devient publique. Pour la cacher dans les futurs commits : `git config user.email "<id>+dyzlek@users.noreply.github.com"` (adresse visible dans GitHub > Settings > Emails).

### P0.4 Démo en ligne (GitHub Pages)
- **Pourquoi** : c'est ce qui fait que les gens essaient. Un lien « Essayer dans le navigateur » en haut du README.
- **Comment** :
  1. Dans `vite.config.js`, ajouter `base: process.env.GITHUB_PAGES ? '/pixelforge/' : '/'`.
  2. Vérifier que l'appli fonctionne **sans le serveur Vite** : la bibliothèque bascule déjà sur IndexedDB (`src/library/storage.js`). Tester avec `npm run build` puis `npm run preview`.
  3. Les jeux de `games/` ne sont pas servis en statique : ajouter au build une copie de `games/*.json` dans `dist/games/` et un bouton « Charger les jeux d'exemple » qui les importe dans IndexedDB.
  4. Créer `.github/workflows/pages.yml` : `actions/checkout`, `actions/setup-node` (node 20), `npm ci`, `GITHUB_PAGES=1 npm run build`, `actions/upload-pages-artifact` (path `dist`), `actions/deploy-pages`.
  5. GitHub > Settings > Pages > Source = « GitHub Actions ».
- **Vérifier** : l'URL `https://dyzlek.github.io/pixelforge/` s'ouvre, on peut ouvrir Tetris, jouer, éditer un Blueprint, recharger la page sans perte.

### P0.5 Intégration continue (tests automatiques)
- Créer `.github/workflows/ci.yml` déclenché sur `push` et `pull_request` : `npm ci`, puis les 6 commandes de la règle 2.
- Ajouter dans `package.json` un script `"test": "node src/graph/test/graph.test.mjs && node mcp/test/e2e.mjs"` et l'utiliser dans le README et la CI.
- Ajouter le badge CI en haut du README (seulement une fois que la CI tourne).

### P0.6 README présentable
- Ajouter **en haut** : une capture de l'éditeur Blueprint, une capture d'un jeu, si possible un GIF de 10 s (créer un graphe → jouer). Mettre les images dans `docs/images/`.
- Ajouter une section « Démarrage rapide en 5 minutes » : créer un jeu, dessiner un perso, ajouter le nœud « À chaque image », brancher « Touche maintenue ? » → « Définir vitesse x », jouer.
- Lien vers la démo en ligne et vers `ROADMAP.md`.
- Une version anglaise (`README.en.md` ou section bilingue) : la majorité des visiteurs GitHub ne lit pas le français.

### P0.7 Rendre public
- GitHub > Settings > General > Danger Zone > Change visibility > Public. Ou en ligne de commande :
  ```bash
  gh repo edit dyzlek/pixelforge --visibility public --accept-visibility-change-consequences
  ```
- Ajouter les *topics* : `gh repo edit dyzlek/pixelforge --add-topic game-engine,pixel-art,phaser3,visual-scripting,blueprint,gamedev,mcp`.

---

## P1 : rendre l'outil vraiment utile

### P1.1 Annuler / rétablir dans le graphe (Ctrl+Z / Ctrl+Y)
- **Pourquoi** : aujourd'hui Ctrl+Z dans le graphe utilise l'historique global (une étape par sauvegarde, tous les 300 ms). Annuler un déplacement ou un fil supprimé n'est pas fiable.
- **Fichier** : `src/editors/objects/graph-editor.js`.
- **Comment** : pile d'instantanés du graphe (`JSON.stringify(graph)`) dans l'éditeur, poussée à la fin de chaque action utilisateur (fin de glisser, création, suppression, liaison, modification de champ), limite de 100. Ctrl+Z / Ctrl+Maj+Z / Ctrl+Y restaurent avec `setGraph` puis `onChange`. Ne pas pousser pendant un glisser, seulement au relâchement.
- **Vérifier** : créer 3 nœuds, en relier 2, déplacer, supprimer, puis 5 × Ctrl+Z → graphe vide ; Ctrl+Y rejoue.

### P1.2 Mise en page plus compacte des graphes convertis
- **Pourquoi** : les graphes issus des anciens blocs sont très larges (le script du drapeau fait ≈ 4400 px). Illisible même au zoom minimum.
- **Fichier** : `src/graph/fromBlockly.js` (fonctions de layout, `estimateNodeSize`).
- **Comment** : (a) replier une longue chaîne d'exécution en plusieurs « lignes » (retour à la ligne au-delà de ~1600 px, avec un nœud de renvoi ou simplement un fil qui redescend) ; (b) placer les nœuds purs **sous** leur consommateur plutôt qu'à gauche quand ils sont simples (un seul niveau) ; (c) ajouter une commande « Réorganiser » dans l'éditeur qui relance ce layout sur la sélection.
- **Vérifier** : `node src/graph/test/graph.test.mjs` (la partie c5 affiche l'étendue de chaque graphe : viser < 2000 px de large pour Flag) et capture d'écran.

### P1.3 Nœuds de renvoi (reroute) et réduire en fonction
- **Reroute** : un petit point sur un fil (double-clic sur un fil) pour l'organiser. Type de nœud `flow_reroute` : 1 entrée, 1 sortie, même type que le fil, compilé de façon transparente. Fichiers : `src/graph/nodes.js`, `src/graph/compile.js`, `graph-editor.js`.
- **Réduire en fonction** (comme « Collapse to Function » d'Unreal) : clic droit sur une sélection → crée un `fn_def` avec les nœuds sélectionnés et les remplace par un `fn_call`. Plus difficile : faire après le reste.

### P1.4 Débogage visuel des Blueprints pendant le jeu
- **Pourquoi** : la force d'Unreal, c'est de voir les fils s'allumer pendant l'exécution. Aujourd'hui, en cas de bug, on doit lire le JS.
- **Comment** :
  1. Dans `src/graph/compile.js`, option `{ debug: true }` qui insère avant chaque nœud exec un appel `__pfTrace('n12')`.
  2. Dans `src/runtime/engine.js`, exposer `__pfTrace` dans le contexte des scripts (sans import !) ; il stocke les ids exécutés pendant la dernière image et les envoie à l'éditeur par un callback.
  3. Dans l'onglet Jouer, une case « Déboguer les Blueprints » ; dans `graph-editor.js`, faire briller pendant ~300 ms les nœuds et fils exécutés.
  4. Bonus : points d'arrêt (F9 sur un nœud) qui mettent le jeu en pause (`game.pause()`) et affichent les valeurs des broches.
- **Attention** : l'export HTML doit être compilé **sans** `debug`.

### P1.5 Afficher les erreurs d'exécution sur le bon nœud
- Quand un script plante (console de l'onglet Jouer), retrouver le nœud responsable : en mode debug, le dernier `__pfTrace` avant l'exception donne l'id. Ajouter dans la console un lien « Voir le nœud » qui ouvre l'objet et appelle `focusNode(id)`.

### P1.6 Tutoriel intégré et modèles de départ
- **Pourquoi** : un débutant qui ouvre un jeu vide ne sait pas quoi faire.
- **Comment** :
  - Au premier lancement, une fenêtre « Choisir un modèle » : Plateforme, Vue de dessus (Zelda-like), Shoot'em up, Puzzle sur grille, Vide. Les modèles existent déjà en partie dans `mcp/lib/template.js` (plateforme) : les déplacer dans un module partagé utilisable par le navigateur et le MCP, et en ajouter.
  - Chaque modèle utilise des **Blueprints** (pas du code), avec des **commentaires** dans le graphe qui expliquent chaque partie.
  - Un tutoriel pas à pas (bulles qui pointent l'onglet Objets, le bouton + Nœud, etc.), désactivable.

### P1.7 Documentation utilisateur des nœuds
- Générer automatiquement `docs/NODES.md` depuis `src/graph/nodes.js` (titre, catégorie, description, broches avec types, exemple de code compilé). Script : `node scripts/gen-nodes-doc.mjs`, appelé dans la CI pour vérifier que le fichier est à jour.
- Dans l'éditeur : un bouton « ? » sur le nœud sélectionné qui ouvre sa fiche.

### P1.8 Partage des jeux
- **Export HTML** existe : ajouter **« Exporter en .zip pour itch.io »** (index.html + Phaser **inclus** au lieu du CDN, pour que le jeu marche hors ligne). Fichiers : `src/runtime/export-template.js`, `mcp/lib/exporter.js`.
- **Lien de partage** : encoder le projet compressé (CompressionStream 'gzip' + base64url) dans l'URL `#play=...` pour les petits jeux ; au-delà de ~32 Ko, proposer le téléchargement.
- Export **PWA** / mobile : manifest + service worker dans l'export, plein écran au toucher.

### P1.9 Robustesse des sauvegardes
- Sauvegarde automatique en local (localStorage / IndexedDB) : afficher clairement « Enregistré » / « Non enregistré ».
- Garder les **5 dernières versions** de chaque jeu (bouton « Restaurer une version précédente »), car une mauvaise manip dans un graphe peut tout casser.
- Avertissement si le jeu ouvert a été modifié sur le disque par une IA pendant qu'on l'éditait (conflit), au lieu d'écraser.

---

## P2 : confort et finition

### P2.1 Éditeur Blueprint
- Auto-défilement quand on glisse un nœud ou un fil au bord de la vue.
- Alignement de la sélection (Q = aligner à gauche, Maj+Q = haut… comme Unreal) et distribution régulière.
- Recherche dans le graphe (Ctrl+F) : trouve les nœuds par titre / valeur, Entrée = centrer dessus.
- Favoris dans la palette et « récemment utilisés » en tête.
- Nœuds « Obtenir / Définir » de variables avec une couleur par type de variable (nombre, booléen, texte, objet, liste) au lieu de `any`.
- Variables **typées** dans « Mon Blueprint » (le type choisit la couleur des broches et le champ littéral).
- Copier / coller **entre deux objets** et vers un autre jeu (presse-papiers système en JSON).
- Groupes de nœuds réutilisables entre objets : macros ou « bibliothèque de fonctions » du jeu (fonctions partagées par tous les objets, dans le script global).
- Performance : culling (ne pas dessiner les nœuds hors écran) au-delà de 500 nœuds.

### P2.2 Conversion Code → Blueprint
- Aujourd'hui on peut passer du Blueprint au code, pas l'inverse. Un convertisseur partiel (parser JS, par exemple `acorn` en dépendance) qui reconnaît `on('event', …)`, `if`, les appels d'API connus, et met le reste dans des nœuds « JS brut » (`pf_js`). Utile pour transformer `monde-1-1` (tout en code) en Blueprints.

### P2.3 Accessibilité et langues
- Traduction de l'interface : extraire les textes dans `src/i18n/fr.js` et `en.js`, sélecteur de langue. Les titres des nœuds aussi (champ `title` → clés).
- Navigation clavier dans la palette et les panneaux (déjà partielle), contrastes suffisants (vérifier avec un outil WCAG), tailles de police réglables.

### P2.4 Mobile et tablette
- L'éditeur de graphe au doigt : pincer pour zoomer, appui long = menu contextuel, glisser à deux doigts = déplacer la vue.

### P2.5 Qualité du code
- ESLint + Prettier (config minimale, sans changer le style existant) et une commande `npm run lint` dans la CI.
- Types JSDoc sur `src/graph/*` et `src/core/*` + `// @ts-check`, vérifiés par `tsc --noEmit` dans la CI (sans convertir en TypeScript).
- Tests de l'éditeur de graphe (Playwright) : créer un nœud, relier, compiler, vérifier le code.
- Découpage du bundle (Phaser en import dynamique, chargé seulement dans l'onglet Jouer) pour supprimer l'avertissement « chunk > 500 kB ».
- `src/editors/sound/synth.js` duplique la synthèse de `engine.js` : garder une seule source (le moteur expose la fonction, l'éditeur de sons l'utilise).

---

## P3 : plus tard (gros chantiers)

- **Éditeur d'interface (UI)** : menus, boutons, barres de vie posés à la souris, au lieu de `game.setText` en coordonnées.
- **Machines à états** visuelles pour les personnages (idle → run → jump), comme les Animation Blueprints.
- **Éditeur de musique** (piste chiptune) : le moteur sait déjà jouer des musiques.
- **Tuiles automatiques** (autotiling) et tuiles animées dans l'éditeur de cartes.
- **Multijoueur local** (deux manettes) et sauvegardes multiples.
- **Collaboration en temps réel** (deux personnes sur le même jeu).
- **Galerie communautaire** : publier un jeu, le jouer, le dupliquer pour l'éditer.

---

## Fichiers communautaires à ajouter (dépôt public)

| Fichier | Contenu |
|---|---|
| `LICENSE` | voir P0.1 |
| `CONTRIBUTING.md` | installer, lancer, tester (règle 2), style de code, une PR = un sujet, comment ajouter un nœud Blueprint (nodes.js → compile.js → test → docs) |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.1 (texte standard, contact = e-mail de l'auteur ou issues) |
| `SECURITY.md` | comment signaler une faille (les scripts des jeux s'exécutent avec `new Function` : ne jamais ouvrir le jeu d'un inconnu en pensant qu'il est isolé ; c'est à documenter) |
| `CHANGELOG.md` | versions : 1.0 création, 1.1 API étendue + MCP, 1.2 Portal, 2.0 Blueprints |
| `.github/ISSUE_TEMPLATE/bug.yml` et `feature.yml` | formulaires : étapes, navigateur, jeu concerné (fichier joint) |
| `.github/pull_request_template.md` | case « les tests passent », capture si changement visuel |

Et une **release GitHub v2.0.0** (`gh release create v2.0.0 --generate-notes`) une fois P0 terminé.

---

## Point de sécurité à ne pas oublier

Les scripts des jeux sont du JavaScript exécuté dans la page (`new Function`). Si un jour on ajoute une galerie ou un lien de partage (P1.8), un jeu malveillant pourrait lire les autres jeux de l'utilisateur ou faire des requêtes. Avant toute fonctionnalité de partage : faire tourner le jeu dans une **iframe `sandbox="allow-scripts"`** sur une autre origine, et communiquer avec l'éditeur par `postMessage`.
