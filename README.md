# PixelForge

**PixelForge** est un éditeur de jeux 2D qui tourne dans le navigateur, avec son moteur de jeu intégré (Phaser 3).
On y dessine ses sprites en pixel art, on construit ses niveaux avec des tuiles, on donne vie aux objets avec des scripts
**Blueprint** (des graphes de nœuds façon Unreal Engine) ou en JavaScript, puis on teste le jeu sur place et on l'exporte en une seule page HTML.

Un jeu = **un seul fichier JSON** (`games/<id>.pixelforge.json`). L'éditeur surveille le dossier `games/` et se recharge quand le fichier change :
un script, une CLI ou une IA peuvent donc construire un jeu pendant que l'éditeur est ouvert.

Pile technique : Vite, JavaScript vanilla (modules ES), Phaser 3, CodeMirror 6.

## Fonctionnalités

### Pixel art
- Éditeur de sprites avec crayon, gomme, pot de peinture, pipette, ligne, rectangle, ellipse et sélection / déplacement (annuler / rétablir).
- Palette de 16 couleurs par projet (« Sweetie 16 » par défaut), préréglages de taille de 8 à 64 pixels, jusqu'à 256.
- Animations par sprite (images, vitesse, boucle). Un *tileset* est simplement un sprite dont chaque image est une tuile.

### Cartes
- Éditeur de tuiles : pinceau, gomme, remplissage, rectangle, pipette, sélection, pose d'entités (instances d'objets).
- Plusieurs calques par carte : collision, plateformes traversables par le bas (*one-way*), défilement parallaxe, affichage devant ou derrière les entités.
- Plusieurs cartes par jeu, avec une carte de départ ; passage d'une carte à l'autre depuis les scripts.

### Objets et scripts
- Un objet = un sprite, une physique (gravité, immobile, rebond, collision avec la carte et avec le monde), une hitbox et un script.
- **Scripts Blueprint** : des nœuds reliés par des fils d'exécution (blancs) et des fils de données (colorés selon le type : nombre, booléen, texte, objet, couleur, liste, tout type).
  Événements (créé, à chaque image, collision, chevauchement, touche, minuteur, message…), branches, boucles, séquences, délais, variables, fonctions,
  maths, texte, listes, caméra, sons, tuiles, rayons… Le graphe est compilé en JavaScript (bouton « Voir le code »).
- **Mode code** : le même script en JavaScript, dans CodeMirror avec autocomplétion de l'API (`self`, `game`, `input`, `on`) et aide intégrée. On passe d'un mode à l'autre
  quand on veut (le texte garde le code compilé ; revenir au Blueprint le regénère).
- **Script global** pour les règles du jeu (HUD, états, fin de niveau). Renommer un objet met à jour les références dans les nœuds et le code.
- Les anciens scripts en blocs (Blockly) sont convertis automatiquement en graphes à l'ouverture d'un jeu.

### Sons
- Effets synthétisés (saut, pièce, coup, bonus, explosion, laser, bip, portail) réglables, ou import de fichiers audio. Le moteur fournit aussi quelques musiques chiptune prêtes à l'emploi (`game.playMusic('tetris')`, `'adventure'`, `'action'`).

### Test, export, bibliothèque
- Onglet **Jouer** : lancement immédiat, rejouer, choix de la carte, plein écran, réglage de la taille d'écran et de la gravité, contrôles tactiles pour mobile.
- **Export HTML** : une page autonome (Phaser chargé depuis un CDN).
- **Bibliothèque** : liste des jeux du dossier `games/` (sauvegarde automatique), création, duplication, renommage, import / export JSON.
  Sans serveur de développement (build statique), les jeux sont gardés dans l'IndexedDB du navigateur.

### Pour les IA : MCP et CLI
- **Serveur MCP** (`npm run mcp`, déclaré dans `.mcp.json` pour Claude Code) : créer un jeu, dessiner des sprites en texte, définir des objets et leurs scripts
  (code ou graphe Blueprint), peindre des cartes, placer des entités, valider, exporter. Outil de départ : `pixelforge_guide`.
- **CLI** : `npm run pf -- list | show | validate | compile | render | export <jeu>` et `npm run pf -- nodes [mot]` (catalogue des nœuds Blueprint).
- Guide pour les agents : [AGENTS.md](AGENTS.md) (y compris comment écrire un graphe en JSON) ; [llms.txt](llms.txt) en est l'index.

## Éditeur de graphe Blueprint : raccourcis

Souris
| Action | Geste |
|---|---|
| Ajouter un nœud | clic droit sur le fond (palette « Toutes les actions » avec recherche), ou bouton « + Nœud » |
| Relier deux broches | glisser d'une broche à une autre (ou sur un nœud : première broche compatible) ; les broches incompatibles sont refusées |
| Relier vers un nouveau nœud | glisser depuis une broche et relâcher dans le vide : la palette ne propose que les nœuds compatibles |
| Reprendre un fil | glisser depuis une entrée de données déjà reliée |
| Couper un lien | Alt + clic sur la broche ou sur le fil ; ou clic droit sur la broche ou le fil, puis « Couper » |
| Sélectionner | clic sur un nœud ou un fil ; glisser sur le fond pour une sélection rectangulaire ; Maj ou Ctrl pour ajouter à la sélection |
| Déplacer | glisser un nœud ou un commentaire (aimantation à la grille de 16 ; Alt = déplacement libre) |
| Déplacer la vue | glisser avec le clic milieu ou le clic droit |
| Zoom | molette (de 25 % à 200 %) |
| Menu d'un nœud | clic droit sur le nœud : dupliquer, commenter la sélection, couper tous les liens, supprimer |
| Variables | glisser une variable du panneau « Mon Blueprint » sur le graphe : menu Obtenir / Définir / Modifier ; Ctrl = Obtenir, Alt = Définir |
| Commentaire | double-clic sur son titre pour le renommer ; poignée en bas à droite pour le redimensionner ; il emporte les nœuds qu'il contient |

Clavier (le curseur doit être sur le graphe)
| Touche | Action |
|---|---|
| Espace ou Tab | ouvrir la palette « Toutes les actions » (↑ ↓ pour choisir, Entrée pour valider, Échap pour fermer) |
| Suppr ou Retour arrière | supprimer la sélection (nœuds, commentaires ou fil) |
| Ctrl + C, Ctrl + V | copier, coller à la position de la souris (d'un objet à un autre aussi) |
| Ctrl + D | dupliquer la sélection |
| Ctrl + A | tout sélectionner |
| F | cadrer la sélection (ou tout le graphe) |
| Origine (Home) | recentrer la vue |
| C | entourer la sélection d'un commentaire |
| Échap | fermer menu et palette |

Le bouton « Carte » affiche une mini-carte du graphe ; le bandeau « n erreurs / n avertissements » en bas de la vue mène au premier nœud fautif.

## Installation et commandes

Il faut Node.js (le projet utilise des modules ES).

```
npm install
npm run dev        # éditeur sur http://localhost:5173 (ou le port affiché par Vite) ; games/ est servi en direct
npm run build      # build de production dans dist/
npm run preview    # sert le build
npm run mcp        # serveur MCP (stdio)
npm run pf -- list | show <jeu> | validate <jeu> | compile <jeu> | render <jeu> [carte] | export <jeu>
npm run pf -- nodes [mot]
```

`<jeu>` est l'identifiant (nom du fichier sans `.pixelforge.json`) ou le nom du jeu. La variable d'environnement `PIXELFORGE_GAMES` change le dossier des jeux.
Les exports vont dans `exports/<id>.html`.

Tests :

```
node src/graph/test/graph.test.mjs   # compilateur Blueprint (comparé à l'ancien générateur Blockly, devDependency)
node mcp/test/e2e.mjs                # scénario complet via le serveur MCP
```

## Structure du dépôt

```
index.html, vite.config.js       page de l'éditeur ; config Vite (+ API REST et SSE qui servent games/)
src/
  main.js                        coque : onglets, nom du projet, sauvegarde
  core/                          schéma du projet (project.js), store, projet d'exemple (sample.js)
  editors/pixel, map, sound      éditeurs de sprites, de cartes et de sons
  editors/objects/               objets et scripts : editor.js (Blueprint / Code), graph-editor.js (éditeur de graphe)
  graph/                         noyau des Blueprints, sans DOM : nodes.js (catalogue), compile.js (graphe -> JS),
                                 fromBlockly.js (conversion de l'ancien format) ; test/ = tests
  library/                       bibliothèque de jeux (stockage disque ou IndexedDB)
  runtime/                       moteur de jeu (engine.js), onglet Jouer, export HTML
mcp/                             serveur MCP (server.js), CLI (cli.js), bibliothèque Node (lib/), test e2e
games/                           les jeux (un fichier JSON chacun) : Tetris, un niveau plateforme façon NES, un exemple
games-src/                       générateurs de jeux (Tetris, Monde 1-1) qui écrivent dans games/
docs/                            ARCHITECTURE.md, BLUEPRINTS.md, SCRIPT_API.md, PROJECT_SCHEMA.json
AGENTS.md, llms.txt              guide pour les IA
```

Documentation : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (architecture et stockage), [docs/BLUEPRINTS.md](docs/BLUEPRINTS.md) (format des graphes et catalogue de nœuds),
[docs/SCRIPT_API.md](docs/SCRIPT_API.md) (API des scripts), [docs/PROJECT_SCHEMA.json](docs/PROJECT_SCHEMA.json) (schéma du fichier de jeu).

## Licence

[MIT](LICENSE).

