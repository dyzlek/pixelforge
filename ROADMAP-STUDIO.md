# PixelForge Studio : feuille de route v3

Objectif : faire passer PixelForge d'un éditeur à onglets à un **vrai studio de jeu** :
1. **Interface façon Godot / GameMaker** : panneaux ancrés, arbre des ressources, inspecteur, plusieurs documents ouverts, scène éditable à la souris.
2. **Studio musical 8-bit façon FL Studio** : séquenceur pas à pas, piano roll, arrangement, instruments chiptune, utilisable sans connaître la musique.
3. **3D** : jeux 3D rétro (low-poly / voxel / pixel) avec le même principe : un fichier JSON, des Blueprints, test immédiat, export HTML.

Ce document est écrit pour être exécuté **tâche par tâche** par une IA. Chaque tâche indique : pourquoi, fichiers, comment, critères de fin.
La feuille de route précédente (`ROADMAP.md`) reste valable pour ce qui n'est pas repris ici.

---

## 0. Règles pour l'IA qui exécute

1. **Une tâche = une branche + un commit (ou quelques commits) + une PR**. Ne jamais mélanger deux tâches. Message de commit en français, au présent.
2. Avant chaque commit, tout doit passer :
   ```bash
   npm run build
   npm test
   npm run check:doc
   npm run pf -- validate tetris
   npm run pf -- validate exemple-plateforme-qiqv
   npm run pf -- validate monde-1-1
   ```
3. Lire avant de coder : `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/BLUEPRINTS.md`, `docs/SCRIPT_API.md`, puis la section de ce fichier.
4. **Contraintes d'architecture à ne jamais casser** :
   - `src/runtime/engine.js` n'a **aucun import** (il est inliné dans l'export HTML via `?raw`). Tout code partagé avec le runtime doit suivre la même règle (voir B1).
   - `src/graph/` et `mcp/lib/` restent **sans DOM** (ils tournent sous node).
   - Un jeu = **un fichier JSON**. Tout nouveau contenu (chansons, modèles 3D, disposition…) va dans ce fichier ou dans les préférences de l'éditeur (localStorage), jamais ailleurs.
   - Les anciens jeux doivent toujours s'ouvrir : tout nouveau champ a une valeur par défaut dans `normalizeProject` (`src/core/project.js`) et dans `docs/PROJECT_SCHEMA.json`.
5. JavaScript vanilla, modules ES, commentaires courts en français, interface en français. Nouvelle dépendance npm **seulement** si la tâche la nomme.
6. Tester dans le navigateur (`npm run dev`) : chaque tâche visuelle se termine par une capture d'écran jointe à la PR.
7. Mettre à jour `.claude/JOURNAL.md` (entrée en haut) et la doc concernée à la fin de chaque tâche.
8. En cas de doute sur un choix (design, nom, comportement), **demander à l'humain**, ne pas deviner.

---

## 1. Décisions à prendre par l'humain AVANT de commencer

| # | Question | Recommandation |
|---|---|---|
| D1 | Moteur 3D | **Three.js** (r16x, le plus documenté, export CDN facile). Physique : **Rapier** (`@dimforge/rapier3d-compat`, WASM, rapide) ou **cannon-es** (JS pur, plus simple). Recommandé : Rapier. |
| D2 | 2D et 3D dans le même jeu ? | **Non au début** : `settings.dimension: '2d' \| '3d'` par jeu. Mélanger plus tard si besoin. |
| D3 | Style 3D visé | **Rétro** : voxel + low-poly + textures pixel (filtre « nearest »), rendu en basse résolution agrandi. Cohérent avec l'identité pixel art. |
| D4 | Panneaux ancrés | **Code maison** (léger, sans dépendance) plutôt qu'une bibliothèque (Golden Layout, Dockview). |
| D5 | Ordre des chantiers | **A (interface) → B (musique) → C (3D)**. L'interface d'abord, car la musique et la 3D s'y logent. B peut commencer en parallèle de A dès A1 terminé. |

---

## Phase A : interface façon Godot / GameMaker

Aujourd'hui : une barre d'onglets en haut (Bibliothèque, Pixel art, Cartes, Objets & code, Sons, Jouer), un seul éditeur visible à la fois (`src/main.js`, contrat `mount(container, store)` / `unmount()`).
Cible : la disposition de Godot.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Menu : Jeu  Édition  Affichage  Outils  Aide        ▶ ⏸ ■   (barre d'outils)│
├──────────────┬─────────────────────────────────────────────┬──────────────┤
│ RESSOURCES   │ [Niveau 1 ×] [Player (Blueprint) ×] [Musique ×]│ INSPECTEUR   │
│ ▸ Scènes     │                                             │ Player       │
│ ▸ Objets     │          zone de travail (document actif)   │  Physique    │
│ ▸ Sprites    │                                             │  Hitbox      │
│ ▸ Sons       │                                             │  Propriétés  │
│ ▸ Musiques   │                                             │              │
│ ARBRE SCÈNE  │                                             │              │
├──────────────┴─────────────────────────────────────────────┴──────────────┤
│ Console │ Sortie │ Animation │ Problèmes (validation)                      │
└───────────────────────────────────────────────────────────────────────────┘
```

### A0. Jetons de design et thème
- **Pourquoi** : les styles sont aujourd'hui dispersés (`src/style.css` + un CSS par éditeur, couleurs en dur). Une interface « pro » a besoin d'un système cohérent.
- **Fichiers** : `src/ui/theme.css` (nouveau), tous les `style.css`.
- **Comment** : variables CSS (`--bg-0..3`, `--fg-0..2`, `--accent`, `--danger`, `--border`, `--radius`, `--space-1..6`, `--font-ui`, `--font-mono`, tailles 11/12/13/14 px). Remplacer les couleurs en dur. Prévoir un thème sombre (défaut, proche de Godot 4 : gris-bleu `#202531`, accent `#478cbf`) et un clair, avec un sélecteur dans les préférences.
- **Fini quand** : `grep -rE "#[0-9a-fA-F]{6}" src/**/*.css` ne trouve presque plus rien hors de `theme.css`, et les deux thèmes s'affichent correctement dans tous les éditeurs.

### A1. Coque à panneaux ancrés (dock)
- **Fichiers** : `src/ui/dock.js`, `src/ui/dock.css` (nouveaux), `src/main.js`, `index.html`.
- **Comment** :
  - Disposition : barre de menus + barre d'outils, colonne gauche, centre, colonne droite, panneau bas. Séparateurs déplaçables à la souris (largeurs mini/maxi), panneaux repliables (double-clic sur l'en-tête), chaque colonne pouvant contenir plusieurs panneaux empilés ou en onglets.
  - API : `dock.registerPanel({ id, title, icon, area: 'left'|'right'|'bottom', mount(el, store), unmount() })`.
  - Disposition sauvegardée dans `localStorage` (`pixelforge.layout`), avec un bouton « Réinitialiser la disposition » dans le menu Affichage.
  - Barre d'outils au centre : ▶ Lancer le jeu (F5), ▶ Lancer la scène courante (F6), ⏸ Pause, ■ Arrêter (F8).
  - Menus : Jeu (Nouveau, Ouvrir, Enregistrer sous / Exporter, Réglages du jeu), Édition (Annuler, Rétablir, Préférences), Affichage (panneaux visibles), Outils (Valider le jeu, Compiler les Blueprints), Aide (Aide API, Documentation des nœuds, À propos).
- **Fini quand** : la coque s'affiche avec des panneaux vides, redimensionnables et repliables, et la disposition survit à un rechargement. Les anciens onglets restent accessibles le temps de A2 à A7.

### A2. Documents ouverts en onglets (zone centrale)
- **Pourquoi** : dans Godot on ouvre plusieurs scènes et scripts à la fois. Aujourd'hui, ouvrir un autre éditeur ferme le précédent.
- **Fichiers** : `src/ui/documents.js` (nouveau), adaptation de chaque éditeur.
- **Comment** :
  - Un document = `{ kind: 'scene'|'sprite'|'script'|'sound'|'song'|'model3d', refId }`.
  - Chaque éditeur existant devient un « type de document » : `openDocument(kind, refId)`. Il reçoit l'id de la ressource au lieu de la lire dans `store.ui`.
  - Onglets fermables avec une pastille `●` si non enregistré, Ctrl+Tab pour passer à l'onglet suivant, clic du milieu pour fermer. La liste des documents ouverts est mémorisée par jeu.
  - Un seul `unmount` / `mount` par document visible : les documents cachés sont démontés, mais leur état de vue (zoom, défilement) est gardé.
  - **Attention** : l'éditeur de cartes, l'éditeur de pixels et l'éditeur de graphe gardent aujourd'hui leur état dans des variables de module. Il faut les transformer en **instances** (une fonction `create…Editor(el, store, refId)` qui renvoie `{ dispose }`), sinon deux documents du même type se marchent dessus. C'est la plus grosse partie de A2 : faire un éditeur par commit.
- **Fini quand** : on peut ouvrir 2 sprites, 1 carte et 2 scripts Blueprint en même temps, passer de l'un à l'autre sans perte, puis fermer et rouvrir le jeu en retrouvant les mêmes onglets.

### A3. Panneau « Ressources » (FileSystem de Godot)
- **Fichiers** : `src/ui/panels/resources.js` (nouveau).
- **Comment** :
  - Arbre par type : Scènes (= cartes), Objets, Sprites, Tilesets, Sons, Musiques (phase B), Modèles 3D (phase C), Script global. Miniatures (réutiliser les rendus de `src/library/thumbnail.js` et les vignettes d'objets).
  - Recherche filtrante, double-clic = ouvrir le document, clic droit = Nouveau, Renommer, Dupliquer, Supprimer (avec la liste des endroits qui l'utilisent avant suppression).
  - **Dossiers virtuels** : nouveau champ `folder: 'Ennemis/Volants'` sur chaque ressource, à ajouter dans `normalizeProject` et le schéma. Les dossiers se créent et se glissent.
  - **Glisser-déposer** : une ressource Objet sur une scène = placer une instance ; un Sprite sur l'inspecteur d'un objet = changer son sprite ; un Son sur un nœud Blueprint « Jouer le son » = remplir le champ.
- **Fini quand** : on peut ranger les objets dans des dossiers, les retrouver par recherche et les poser dans une carte par glisser-déposer.

### A4. Inspecteur unifié (panneau droit)
- **Pourquoi** : les propriétés sont aujourd'hui éparpillées (colonne « props » de l'onglet Objets, panneau de droite de l'éditeur de cartes…).
- **Fichiers** : `src/ui/inspector.js` (nouveau), `src/ui/inspector-schemas.js`.
- **Comment** :
  - Inspecteur **piloté par schéma** : chaque type de sélection (objet, instance placée, calque, carte, sprite, animation, son, réglages du jeu) déclare ses champs : `{ key, label, type: 'number'|'bool'|'enum'|'color'|'vec2'|'ref:sprite'|..., min, max, step, group }`.
  - Groupes repliables, valeur modifiée en gras avec une flèche « ↺ revenir à la valeur par défaut » (comme Godot), glisser horizontalement sur un champ nombre pour changer sa valeur, sélection multiple qui édite plusieurs éléments à la fois.
  - Le store émet un événement de sélection (`store.select({ kind, id })`) que l'inspecteur écoute. Chaque document peut l'appeler.
  - Les « props » d'une instance placée (`entity.props`) s'éditent ici, avec les champs déclarés par l'objet (nouveau : `object.exportedProps: [{ name, type, default }]`, l'équivalent de `@export` dans Godot), utilisables dans les Blueprints via `pf_props_get`.
- **Fini quand** : sélectionner un objet, une instance ou un calque affiche ses propriétés au même endroit, et toutes les modifications passent par `store.update` (annulables).

### A5. Éditeur de scène façon Godot / GameMaker (remplace l'onglet Cartes)
- **Fichiers** : `src/editors/map/` (refonte), `src/ui/panels/scene-tree.js` (nouveau).
- **Comment** :
  - **Arbre de scène** (panneau gauche, sous Ressources) : calques de tuiles, puis instances groupées par calque d'instances. Visibilité 👁 et verrouillage 🔒 par élément, sélection synchronisée avec la vue.
  - **Calques d'instances** comme GameMaker (« Instance layers ») en plus des calques de tuiles : nouveau champ `map.instanceLayers`, avec une migration qui met les `entities` existantes dans un calque par défaut.
  - Dans la vue : outil Sélection (Q) avec poignées de déplacement, aimantation à la grille (désactivable avec Alt), duplication Ctrl+D, rotation / échelle des instances (nouveaux champs `angle` et `scale` sur les entités, pris en compte par le moteur), règles et guides, zoom à la molette et pan à la molette enfoncée (déjà en partie présents).
  - Outils de tuiles dans une barre à part : pinceau, rectangle, remplissage, pipette ; tampon multi-tuiles (sélection d'un bloc de tuiles dans le tileset).
  - **Autotiling** (option) : règles « 47 tuiles » ou « 16 tuiles » sur un tileset (`sprite.autotile`), comme le Terrain de Godot. Sinon, le reporter à une tâche à part.
- **Fini quand** : on construit le niveau de l'exemple uniquement à la souris (tuiles + instances glissées depuis Ressources), on sélectionne, déplace et duplique des instances, et le jeu se comporte comme avant.

### A6. Lancer, console et débogage dans le dock
- **Fichiers** : `src/runtime/play.js`, `src/ui/panels/console.js`.
- **Comment** :
  - **Mode Jouer** : F5 ouvre le jeu dans un document « Jeu » au centre (ou dans une fenêtre détachable `window.open`), et la console passe dans le panneau bas. F8 arrête et revient au document précédent.
  - **Panneau Problèmes** : sortie de `validateProject` lancée en continu (debounce de 1 s), un clic ouvre la ressource ou le nœud fautif. La fonction est dans `mcp/lib/validate.js`, sans DOM : on peut l'importer côté navigateur.
  - **Inspecteur à distance** (comme le « Remote » de Godot) : pendant le jeu, un onglet « Scène en cours » liste les instances vivantes et leurs variables (`self.vars`, x, y, vx, vy), mises à jour 4 fois par seconde. Le moteur expose `game.__debugSnapshot()` (sans import).
- **Fini quand** : F5 lance, F8 arrête, une erreur de script s'affiche dans la console avec un lien vers l'objet, et l'onglet « Scène en cours » affiche le joueur et sa position qui bouge.

### A7. Gestionnaire de projets (remplace la Bibliothèque)
- **Comment** : un écran d'accueil comme le Project Manager de Godot. Grille de jeux avec miniature, recherche, tri (récents, nom), boutons Nouveau (avec choix d'un modèle : Plateforme, Vue de dessus, Shoot'em up, Puzzle, Vide, puis 3D en phase C), Importer, Exemples. On y revient par le menu Jeu > « Retour aux projets ».
- **Fini quand** : on ne voit plus la barre d'onglets historique et toutes les anciennes fonctions de la bibliothèque sont accessibles.

### A8. Palette de commandes, raccourcis, préférences
- **Comment** :
  - Ctrl+Maj+P : palette de commandes (toutes les actions des menus, avec recherche floue). Ctrl+P : ouverture rapide d'une ressource par son nom.
  - Écran Préférences : thème, taille de l'interface (90 à 150 %), langue (préparer l'i18n), raccourcis modifiables (`src/ui/shortcuts.js`, un registre central qui remplace les `keydown` éparpillés dans les éditeurs), dossier `games/` (lecture seule, information).
- **Fini quand** : toutes les actions des menus sont accessibles au clavier et les raccourcis sont listés dans Aide > Raccourcis.

### A9. Finition « pro »
- Icônes cohérentes : un seul jeu d'icônes SVG en ligne, sous licence libre, par exemple **Lucide** (ajouter la dépendance `lucide` ou copier les SVG utilisés dans `src/ui/icons.js`).
- Infobulles partout, états vides utiles (« Aucun sprite : cliquez ici pour en créer un »), barre d'état en bas (zoom, coordonnées, état d'enregistrement).
- Vérifier le contraste (WCAG AA) et la navigation au clavier.

---

## Phase B : studio musical 8-bit façon FL Studio

Aujourd'hui : des effets synthétisés (presets jump, coin…) dans l'onglet Sons, et 3 musiques en dur dans le moteur (`CHIPTUNE_PRESETS` dans `src/runtime/engine.js` : une seule voix, `notes` + `durations`, onde carrée). La synthèse est **dupliquée** entre `engine.js` et `src/editors/sound/synth.js`.
Cible : composer une vraie musique chiptune à 4 ou 5 voix en quelques minutes, sans connaître le solfège.

### B0. Modèle de données des musiques
- **Fichiers** : `src/core/project.js` (`songs: []` + `normalizeProject`), `docs/PROJECT_SCHEMA.json`, `docs/ARCHITECTURE.md`.
- **Format** (s'inspirer d'un tracker NES et de FL Studio) :
  ```js
  song = {
    id, name, bpm: 140, stepsPerBeat: 4, swing: 0, loop: true,
    channels: [                       // le « Channel rack »
      { id, name: 'Lead', instrument: 'pulse50', volume: 0.8, pan: 0, mute: false, solo: false,
        env: { a: 0.005, d: 0.1, s: 0.6, r: 0.08 }, vibrato: { depth: 0, rate: 6 }, arp: [] },
      { id, name: 'Basse', instrument: 'triangle', ... },
      { id, name: 'Batterie', instrument: 'noise', drumKit: true, ... },
    ],
    patterns: [                       // un pattern = N mesures, des notes par canal
      { id, name: 'Couplet', length: 16 /* pas */, notes: [{ ch, step, len, pitch: 'C4' | 60, vel: 1 }] },
    ],
    playlist: [{ pattern, start /* en pas */, track }],   // l'arrangement
  }
  ```
  Instruments : `pulse12`, `pulse25`, `pulse50` (carrés au rapport cyclique de la NES), `triangle`, `saw`, `noise` (long/court), `wave` (table d'onde de 32 échantillons dessinable), `sample` (un son du projet).
- **Fini quand** : un jeu avec `songs` est validé, un ancien jeu sans `songs` s'ouvre, et le schéma est à jour.

### B1. Moteur audio chiptune partagé (supprime la duplication)
- **Pourquoi** : le même synthétiseur doit servir à l'éditeur, au jeu et à l'export.
- **Fichiers** : `src/audio/chip.js` (nouveau), `src/runtime/engine.js`, `src/runtime/export-template.js`, `mcp/lib/exporter.js`, suppression de `src/editors/sound/synth.js`.
- **Comment** :
  - `chip.js` **sans aucun import** : il définit `function createChipAudio(ctx, destination)` qui renvoie `{ playSfx, playSong, stopSong, scheduleNote, renderOffline }`.
  - Planificateur avec anticipation (motif « A Tale of Two Clocks » : un `setInterval` de 25 ms planifie les notes des 100 ms suivantes sur `ctx.currentTime`), pour un tempo stable même si le jeu rame.
  - Rapport cyclique des carrés via `PeriodicWave`, bruit par buffer pré-généré (LFSR façon NES pour le son « métallique »), enveloppes ADSR par note, vibrato par LFO, arpèges en pas de 1/60 s.
  - **Intégration sans import dans `engine.js`** : l'export HTML concatène `chip.js?raw` avant `engine.js?raw`, et dans l'appli `play.js` importe `chip.js` et le passe à `createGame(..., { chip })`. Le moteur utilise `opts.chip` s'il est fourni, sinon `globalThis.createChipAudio`.
  - Garder les 3 musiques de `CHIPTUNE_PRESETS` en les convertissant au nouveau format (`game.playMusic('tetris')` doit toujours marcher).
- **Fini quand** : `synth.js` n'existe plus, les effets sonnent pareil dans l'éditeur et dans le jeu exporté, et Tetris joue toujours sa musique.

### B2. Channel rack + séquenceur pas à pas
- **Fichiers** : `src/editors/music/index.js`, `rack.js`, `music.css` (nouveaux) : un document « song » (A2).
- **Comment** : comme FL Studio.
  - Une ligne par canal : nom, instrument, bouton muet / solo, volume, puis 16 (ou 32) cases cliquables. Les temps forts sont colorés différemment.
  - Clic = note à la hauteur par défaut du canal, clic droit = effacer, glisser = peindre plusieurs cases.
  - Pour la batterie (canal `noise` + `drumKit`) : sous-lignes Grosse caisse, Caisse claire, Charleston fermé, Charleston ouvert, Tom, chacune avec ses réglages de bruit et de hauteur.
  - Barre de transport : ▶ / ■, BPM (glisser pour changer), métronome, boucler le pattern, choisir le pattern.
- **Fini quand** : on fait un rythme de batterie et une ligne de basse en moins d'une minute, et la lecture est stable à 180 BPM.

### B3. Piano roll
- **Fichiers** : `src/editors/music/pianoroll.js`.
- **Comment** :
  - Grille temps × hauteur avec clavier vertical à gauche (cliquer une touche la joue). Dessiner une note au clic, l'allonger en tirant son bord droit, la déplacer en glissant, sélection rectangulaire, Ctrl+C / Ctrl+V, Suppr.
  - Quantification (1/4, 1/8, 1/16, 1/32), vélocité dans une bande en bas.
  - **Aides pour débutants** : sélecteur de **gamme** (Do majeur, La mineur, pentatonique…) qui grise les notes hors gamme et peut aimanter dessus ; boutons d'**accords** (I, IV, V, vi) qui posent un accord entier ; « Arpéger » qui transforme un accord en arpège à la vitesse choisie (son NES typique).
  - **Clavier de l'ordinateur** = piano (rangées AZERTY et QWERTY détectées : `KeyboardEvent.code`, pas `key`), avec enregistrement en direct quantifié.
- **Fini quand** : on écrit une mélodie de 4 mesures à la souris et au clavier, en restant dans une gamme, et elle se rejoue identique.

### B4. Playlist (arrangement)
- **Fichiers** : `src/editors/music/playlist.js`.
- **Comment** : pistes horizontales sur lesquelles on pose des blocs de patterns (glisser depuis la liste des patterns), redimensionnables, duplicables (Ctrl+glisser). Marqueur de boucle (début et fin de la partie qui boucle dans le jeu), tête de lecture déplaçable, zoom horizontal.
- **Fini quand** : une chanson Intro → Couplet ×2 → Refrain, avec une boucle sur Couplet et Refrain, se joue dans l'éditeur et dans le jeu.

### B5. Mixeur et export audio
- Volume, pan, muet et solo par canal (déjà dans le rack, à regrouper dans une vue Mixeur), volume général, vumètres (`AnalyserNode`).
- **Exporter en WAV** : `OfflineAudioContext` + encodeur WAV maison (~40 lignes, sans dépendance).
- **Importer un MIDI** (option) : parseur MIDI maison (format SMF type 0 et 1). Chaque piste MIDI devient un canal, avec choix de l'instrument chiptune.

### B6. Générateur d'effets façon sfxr / jsfxr
- **Fichiers** : `src/editors/sound/` (refonte).
- **Comment** : paramètres sfxr classiques (attaque, maintien, déclin, fréquence de départ, glissement, rapport cyclique, vibrato, changement de hauteur, répétition, filtres passe-bas et passe-haut). Gros boutons « Pièce, Laser, Explosion, Bonus, Coup, Saut, Bip, **Aléatoire**, **Muter** » qui génèrent un son, comme jsfxr. Historique des 10 derniers sons générés. Les 8 presets actuels deviennent des réglages sfxr équivalents (vérifier à l'oreille).
- **Fini quand** : on obtient un bruit de saut qui convient en 3 clics.

### B7. Musique dans les scripts, les Blueprints et le MCP
- **API** (`docs/SCRIPT_API.md`, `engine.js`) : `game.playSong('Nom', { loop, volume, fadeIn })`, `game.stopSong({ fadeOut })`, `game.setSongVolume(v)`, `game.songPosition`, événement `on('beat', fn(beat))` pour synchroniser le gameplay sur le rythme. `playMusic` reste un alias.
- **Blueprints** : nœuds correspondants dans `src/graph/nodes.js`, plus le cas de compilation dans `compile.js`, le test et `npm run doc:nodes`.
- **MCP** : outil `upsert_song` avec une **notation texte** lisible par une IA, par exemple :
  ```
  bpm 140
  lead pulse50 | C5 . E5 . G5 . E5 . | C5 - - - . . . . |
  bass triangle | C3 . . . G2 . . . |
  drums noise  | K . h . S . h . | K K h . S . h h |
  ```
  (`.` = silence, `-` = tenir la note, `K` = grosse caisse, `S` = caisse claire, `h` = charleston). Parseur et sérialiseur dans `mcp/lib/song-text.js`, testés dans les deux sens. Le validateur vérifie les noms de chansons utilisés dans les scripts.
- **Fini quand** : une IA crée une musique par le MCP, un Blueprint la lance au démarrage du niveau et `validate` signale un nom de chanson inexistant.

### B8. Contenu de départ
- 6 morceaux de démo (aventure, donjon, boss, menu, victoire, game over) et 4 modèles de batterie, proposés dans « Nouvelle musique ». Les écrire en notation texte (B7) dans `src/audio/presets/`.

---

## Phase C : 3D

Cible : des jeux 3D rétro (plateforme 3D, labyrinthe à la première personne, jeu de course simple, vue isométrique) avec les **mêmes concepts** : objets, scripts / Blueprints, scènes, test immédiat, export HTML.

### C0. Architecture 3D (document de conception d'abord, puis seulement le code)
- **Livrable** : `docs/3D.md`, validé par l'humain avant C1.
- **Points à trancher** (recommandations entre parenthèses) :
  - `settings.dimension: '3d'` (D2) ; le runtime choisi selon ce champ.
  - **Nouveau runtime** `src/runtime3d/engine3d.js`, lui aussi **sans import**. Three.js et Rapier sont chargés par le CDN dans l'export, et par npm (Vite) dans l'appli : mêmes règles que Phaser aujourd'hui.
  - **Même API de script** autant que possible : `self.x/y/z`, `vx/vy/vz`, `rotationY`, `jump()`, `onGround`, `game.spawn('Obj', x, y, z)`, `on('collide'|'overlap', 'Nom', fn)`, `input.*`, `game.camera.*`. Ce qui diffère est documenté dans `docs/SCRIPT_API_3D.md`.
  - Unités : 1 unité = 1 tuile (1 mètre), Y vers le haut (convention Three.js).
  - Modèle de projet :
    - `models[]` (voxel ou glTF importé) ;
    - `materials[]` (couleur de la palette ou texture tirée d'un sprite, filtre nearest) ;
    - `scenes3d[]` avec une `gridmap` (cases 3D remplies de blocs, comme le GridMap de Godot) et des `entities` (x, y, z, rotation, échelle) ;
    - `environment` : couleur du ciel, brouillard, lumière directionnelle et ambiante.
- **Fini quand** : `docs/3D.md` est relu et accepté par l'humain.

### C1. Runtime 3D minimal
- **Dépendances** : `three` (+ `@dimforge/rapier3d-compat`, selon D1).
- **Comment** :
  - Scène Three.js, caméra, lumières.
  - Corps physiques par objet : boîte ou capsule, statique, dynamique ou cinématique. Les options `physics` reprennent les noms 2D (`gravity`, `immovable`, `collideMap`).
  - Collisions avec la gridmap : un collider composé, fusionné par blocs pour les performances.
  - Boucle `update(dt)`, événements create / update / collide / overlap / overlapStart / overlapEnd / destroy / timer / keydown.
  - Entrées clavier, souris et manette : réutiliser le code de `engine.js` en le copiant, puisqu'il n'y a pas d'import.
- **Rendu rétro** : rendre dans une cible basse résolution (ex. 320×180), puis l'agrandir en « nearest » ; option de dithering ; option de « vertex snapping » façon PS1 (shader simple).
- **Fini quand** : un cube joueur se déplace et saute sur un sol de blocs, ramasse des pièces (`overlap`) et l'export HTML fonctionne hors de l'éditeur.

### C2. Éditeur de modèles voxel (façon MagicaVoxel, cohérent avec le pixel art)
- **Fichiers** : `src/editors/voxel/` (nouveau document `model3d`).
- **Comment** :
  - Grille 3D jusqu'à 64³, couleurs de la palette du projet.
  - Outils : ajouter, effacer, peindre, remplissage, boîte, pipette, miroir X/Y/Z. Vue orbite (glisser droit), plan de travail déplaçable, annuler / rétablir.
  - Animations par images (comme les sprites).
  - Stockage compact : liste `[x, y, z, couleur]` ou RLE par tranche.
  - **Maillage** par « greedy meshing » (fusion des faces), calculé au chargement et mis en cache.
- **Import glTF / GLB** (modèles low-poly de Kenney, Quaternius…) : stocké en data URL comme les sons importés, avec un avertissement de taille au-delà de 2 Mo.
- **Fini quand** : on modélise un personnage voxel animé de 2 images et il s'affiche dans le jeu.

### C3. Éditeur de scène 3D
- **Comment** :
  - Vue avec caméra orbite / vol libre (WASD + clic droit, comme Godot), grille au sol, gizmos de déplacement / rotation / échelle (`TransformControls` de Three.js), aimantation à la grille.
  - **Pinceau de blocs** pour la gridmap : choisir un bloc dans une palette (modèles voxel 1×1×1 ou matériaux), peindre étage par étage (molette + Maj pour changer d'étage), remplissage rectangulaire.
  - Arbre de scène, inspecteur et glisser-déposer depuis Ressources : réutiliser A3, A4 et A5.
  - Aperçu en jeu (F6) depuis la position de la caméra de l'éditeur (pratique pour tester un passage précis).
- **Fini quand** : on construit un petit niveau de plateforme 3D à la souris et on y joue.

### C4. Caméras, lumières, ambiance
- Préréglages de caméra en nœuds Blueprint et en API :
  - troisième personne (orbite derrière le joueur, collision avec les murs) ;
  - première personne (souris verrouillée, `pointer lock`) ;
  - vue de dessus ;
  - isométrique (caméra orthographique) ;
  - défilement latéral 2.5D.
- Lumière directionnelle avec ombres (option), ambiante, ponctuelles (limiter à 4 en rétro), brouillard, ciel uni ou dégradé, particules 3D simples (sprites face caméra).

### C5. Blueprints et scripts en 3D
- **Fichiers** : `src/graph/nodes.js`, `compile.js`.
- **Comment** :
  - Ajouter `dims: ['2d'] | ['3d'] | ['2d','3d']` à chaque spec. La palette ne montre que les nœuds du bon type de jeu, et le compilateur renvoie une erreur sinon.
  - Nouveaux nœuds 3D : position / vitesse X Y Z, rotation, « Avancer dans la direction regardée », raycast 3D, « Regarder vers », distance 3D, caméra (préréglages de C4), souris verrouillée (delta X/Y).
  - Mêmes tests que pour la 2D : un graphe 3D compile en un code attendu, et ce code passe `new Function`.
- **Fini quand** : le jeu de démo 3D (C7) est écrit entièrement en Blueprints.

### C6. MCP / CLI pour la 3D
- `create_game {dimension: '3d', template: 'platformer3d'}`.
- `upsert_model {name, layers}` : un modèle voxel en texte, une tranche par Y, avec la même légende que les sprites texte.
- `paint_gridmap {level, rows, legend}` : un étage à la fois.
- `place_entities` avec `z`.
- `render_map` : vue de dessus ASCII, étage par étage.
- `validate` étendu : modèles manquants, entités hors de la grille, joueur présent dans la scène de départ.
- Mettre à jour `AGENTS.md` avec une section 3D et des recettes (joueur 3e personne, pièce, ennemi qui suit le joueur).

### C7. Jeux de démo 3D
- « Cube Runner » (plateforme 3D voxel, 3 niveaux), « Donjon » (labyrinthe à la première personne avec clés et portes), « Kart » simple (optionnel). Écrits en Blueprints, avec une musique de la phase B. Ils servent aussi de tests d'intégration (`validate` dans la CI).

---

## Phase D : transversal (à faire au fil de l'eau)

- **Tests de l'interface** : Playwright (`@playwright/test`) avec quelques scénarios de bout en bout : créer un jeu, poser une instance par glisser-déposer, écrire un Blueprint, lancer avec F5, composer 4 notes et les lire. Les ajouter à la CI.
- **Performance** : Phaser et Three.js chargés uniquement quand on lance un jeu (`import()` dynamique), pour ne pas alourdir l'éditeur. Objectif : éditeur interactif en moins de 2 s sur la démo GitHub Pages.
- **Sauvegardes** : avec les musiques et les modèles 3D, les fichiers vont grossir. Compresser les grosses données (voxels en RLE, glTF en base64), afficher la taille du jeu dans les réglages et prévenir au-delà de 10 Mo.
- **Docs** : `docs/ARCHITECTURE.md` (nouvelle coque et documents), `docs/MUSIC.md`, `docs/3D.md`, `docs/SCRIPT_API_3D.md`, README (captures de la nouvelle interface, du piano roll et d'un jeu 3D), `AGENTS.md`.
- **Accessibilité / i18n** : préparer les textes de l'interface dans `src/i18n/fr.js` dès la phase A, pour éviter de tout reprendre plus tard.

---

## Ordre conseillé et jalons

| Jalon | Contenu | Résultat visible |
|---|---|---|
| **v3.0-alpha** | A0, A1, A2 | La nouvelle coque à panneaux, plusieurs documents ouverts |
| **v3.0** | A3 → A9 | Interface façon Godot complète |
| **v3.1** | B0 → B4 | Composer une musique dans le jeu |
| **v3.2** | B5 → B8 | Studio audio complet (export WAV, sfxr, MCP) |
| **v4.0-alpha** | C0, C1 | Un cube qui saute en 3D, export HTML |
| **v4.0** | C2 → C7 | Jeux 3D voxel complets en Blueprints |

Taille estimée : A ≈ 40 % du travail, B ≈ 25 %, C ≈ 35 %. Ne pas lancer la phase C avant que A2 (documents) et A4 (inspecteur) soient terminés : la 3D les réutilise.

## Risques connus

- **A2 est le point dur** : les éditeurs actuels gardent leur état dans des variables de module. Il faut les convertir en instances une par une, avec un test manuel complet après chaque conversion.
- **Audio et onglets cachés** : les navigateurs ralentissent les `setInterval` en arrière-plan. Le planificateur de B1 doit tolérer des retards (rattraper sans jouer toutes les notes en retard d'un coup).
- **Taille des fichiers JSON** avec la 3D : surveiller dès C2.
- **Licences** : n'importer dans les exemples que des modèles et sons sous licence CC0 (Kenney, Quaternius), et le noter dans `CREDITS.md`.
- **Sécurité** : toujours la même remarque (scripts exécutés avec `new Function`). Avant tout partage de jeux entre utilisateurs, mettre le jeu dans une iframe isolée (voir `SECURITY.md`).
