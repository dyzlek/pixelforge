# Corrections — Phases B (musique) et C (3D)

Relecture du 2026-10-26, commits `7ac3163..6e3ba6a` (phase B) et `8b43845..0669ea6` (phase C).

## État des corrections (mis à jour le 2026-10-26, non commité)

**Corrigé** (tests ajoutés : `src/runtime3d/test/sim3d.test.mjs` fait tourner le vrai moteur 3D sur Cube Runner et Donjon 3D avec un faux Three.js ; tests audio de planification réelle ; tests gridmap / mesher / RLE / dimensions Blueprint) :

- **3D, critiques** : C-1 (le runtime lit `gridmap.blocks`), C-2 (l'éditeur de scène lit et écrit `{blockSize, blocks}` ; les anciens fichiers à plat sont convertis par `normalizeProject`), C-3 (les modèles voxel sont rendus en un seul maillage, mis à l'échelle de la boîte de 0,9), C-4 (la couleur 0 est visible : seul `null` est vide), C-5 (collisions sur les 3 axes, en sous-pas contre le tunneling, cases centrées sur les entiers).
- **3D, majeurs** : C-6 (son en jeu, débloqué au premier geste, contexte fermé à l'arrêt), C-7 (`keydown` SPACE/LEFT…), C-8 (ambiance par scène), C-9 (`startScene3DId`, et « Tester la scène » lance la scène ouverte), C-10 (33 nœuds réservés à la 2D, pointeur verrouillé réservé à la 3D, erreur de compilation selon la dimension dans l'éditeur, le MCP et `validate`), C-11 en partie (ajout de `setGravity`, `setPosition`, `setVelocity`, `distanceTo`, `visible`, `game.wait/random/log/pause/save/load/broadcast/countOf/removeText/playMusic`, `on('message')`, `on('beat')` ; doc corrigée ; `rotateY` positif tourne maintenant à droite, comme le supposaient les jeux et les recettes), C-12 (instances détruites retirées, `overlapEnd` émis, restart en fin d'image), C-13 (écouteurs, ResizeObserver, matériaux, contextes WebGL libérés ; rendu arrêté quand l'onglet est caché), C-14 (RLE : le décodage ne ressuscite plus d'ancien contenu, runs corrompus ignorés), C-15 (dimensions `width/height/depth`), C-16 (plus de modification à l'ouverture ni de ressource fantôme), C-17 en partie (annuler / rétablir dans les deux éditeurs 3D), C-18 et B-11 (noms échappés), C-19 (import glTF : en-tête vérifié, 5 Mo max, champ `gltfData` comme le MCP), C-20 (validation 3D durcie : joueur obligatoire dans la scène de départ, blocs mal formés, chute dans le vide prévenue, goToMap 2D interdit en 3D ; paint_gridmap valide les caractères), C-21 (`cameras.js` supprimé car mort/redondant avec la caméra intégrée de `engine3d.js`), C-22 (export 3D aligné sur Three.js 0.186.1 de l'éditeur via importmap en module ES).
- **Musique** : B-1 (batterie par nom puis classe de hauteur General MIDI), B-2 (solo), B-3 (boucle = `loop.enabled` + `loop.start`, fin à la fin de l'arrangement ; anciens formats migrés), B-4 (export WAV planifié d'un coup, avec le même gain maître), B-5 (une note invalide ou un `on('beat')` qui plante ne bloque plus la lecture), B-6 (nettoyage des sous-vues), B-7 (annuler / rétablir : copie de travail écrite par `store.update`, morceau relu après un undo), B-8 (aller-retour texte ↔ musique du MCP sans perte, accords, vélocité, env/vib/arp/wave/mute/solo/loop/swing, guillemets et playlist avec trous/chevauchements conservés), B-9 en partie (`defaultPitch` conservé), B-10 (notes terminées purgées, fin naturelle libérée), onglet en arrière-plan resynchronisé.
- **Divers** : console de débogage alimentée en 3D, plantage du redimensionnement de la zone de jeu en 3D (`state.game.scale` n'existe pas en 3D).

**Pas encore corrigé** : B-9 (normalisation des notes), granularité de l'historique du rack (une entrée par case dessinée), C-17 perfs (un `Mesh` par bloc), glTF non affiché en jeu (cube par défaut), séparation physique entre objets pour `collide`, les mineurs.

**Non vérifié en direct** : le déplacement dans le navigateur (le panneau était caché, le navigateur n'animait pas la page). Le chargement et l'affichage de Cube Runner ont été vérifiés dans l'éditeur, et la physique par la simulation Node.

---

Ci-dessous, la relecture d'origine (les numéros servent de référence).

## Résumé

- **Ce qui passe** : `npm run build`, `npm test` (graphes 2477 vérifs, audio, 3D, MCP e2e), `npm run check:doc`, `validate` des 5 jeux.
- **Le problème de fond** : tout est vert alors que **les deux jeux 3D ne sont pas jouables** dans le vrai moteur. Les tests vérifient surtout que « ça ne lève pas d'erreur » ou cherchent du texte dans le source ; aucun ne charge un jeu 3D dans le moteur, aucun ne vérifie ce que joue le moteur audio.
- **Cause commune** : chaque morceau (modèle, éditeur, MCP, runtime) a été écrit avec son propre format de données. Les formats ne se rejoignent pas (gridmap, modèles voxel, `environment`, `loop`, dimensions).

Légende : **[C]** critique (fonction principale cassée) · **[M]** majeur · **[m]** mineur · ✔ = vérifié dans le code par Opus en plus du relecteur.

---

## Ordre de correction conseillé

1. Phase C, formats de données unifiés + runtime qui les lit (C-1 à C-4) → les jeux 3D s'affichent.
2. Collisions 3D murs/plafonds (C-5) → Donjon jouable.
3. Son 3D et `keydown` 3D (C-6, C-7).
4. Batterie, solo et boucle du moteur audio (B-1 à B-3).
5. Undo et fuites de l'éditeur musical (B-6, B-7).
6. Vrais tests : un jeu 3D chargé dans le moteur avec un faux THREE, planification audio avec horloge simulée, aller-retour `song-text`, test Playwright 3D.

---

## Phase C — 3D

### Critiques

**C-1 [C] ✔ Le runtime ne construit aucun bloc de la gridmap.**
`src/runtime3d/engine3d.js:154-187` parcourt `Object.entries(gridmap)` et attend des clés `"x,y,z"`. Le format réel (`src/core/project.js:123`, `mcp/lib/ops.js` `paintGridMap`, `games/*.pixelforge.json`) est `{ blockSize, blocks: { "x,y,z": indexPalette } }`. Les seules clés vues (`blockSize`, `blocks`) sont ignorées : zéro bloc, pas de sol, le joueur tombe puis `restart()` en boucle. **Cube Runner et Donjon 3D sont injouables.**
Correctif : lire `gridmap.blocks ?? gridmap`, couleur = `palette[Number(v)]` si nombre, `v` si chaîne `#hex`.

**C-2 [C] ✔ L'éditeur de scène 3D utilise un troisième format.**
`src/editors/scene3d/index.js:25-30,142` fait `new GridMap3D(sceneData.gridmap)` puis écrit `grid.toJSON()` (map plate `{"x,y,z":"#hex"}`). Une scène faite par MCP/template ouverte dans l'éditeur : les vrais blocs ne s'affichent pas, et le premier clic **écrase** toute la gridmap. Inversement une scène faite à la souris est vide pour `render_scene3d` et `validate`.
Correctif : un seul format `{blockSize, blocks}` partout ; l'éditeur lit/écrit `gridmap.blocks` et accepte index ou hex (ou normalisation unique dans `normalizeProject`).

**C-3 [C] ✔ Les modèles voxel ne sont jamais affichés en jeu.**
`engine3d.js:450` n'affiche un modèle que s'il a `slices`. L'éditeur voxel et `upsert_model` ne stockent que `voxels: {"x,y,z": couleur}` → tout objet est un cube par défaut. Les modèles glTF ne sont pas gérés (et le champ s'appelle `dataUrl` dans l'éditeur, `gltfData` côté MCP).
Correctif : construire le mesh depuis `voxels` avec le greedy mesher (`src/editors/voxel/mesher.js`, une seule `BufferGeometry`, pas un mesh par voxel) ; unifier le nom du champ glTF et le charger (`GLTFLoader`).

**C-4 [C] ✔ La couleur 0 de la palette est invisible.**
Le mesher (`mesher.js:71,80,92`) et l'éditeur (`voxel/index.js:297,415`) utilisent `0` pour « vide ». Or 0 = `#1a1c2c` est une vraie couleur : un voxel de couleur 0 est stocké mais jamais dessiné.
Correctif : « vide » = `undefined`/`null`, tester `== null`.

**C-5 [C] ✔ Aucune collision avec les murs ni les plafonds.**
`engine3d.js:650-678` ne teste que le bloc sous les pieds ; `x`/`z` avancent sans contrôle. Dans Donjon 3D, on traverse murs et porte : le niveau se finit sans la clé. `docs/3D.md` promet pourtant une physique AABB.
Correctif : résoudre axe par axe (X, puis Z, puis Y) contre les blocs avec la boîte complète ; sous-pas ou balayage contre le tunneling (une chute de ~8 blocs traverse déjà un sol d'un bloc, `dt` peut aller à 100 ms). Vérifier aussi l'alignement : les blocs sont centrés sur des entiers mais la grille est lue avec `Math.floor` (décalage d'un demi-bloc, à confirmer à l'écran).

### Majeurs

**C-6 [M] ✔ Le son ne marche pas en 3D dans l'éditeur.** `src/runtime/play.js:83` passe `chip: createChipAudio` (la fabrique) ; le moteur appelle `chipAudio.playSfx`, qui est `undefined`. De plus l'appel `playSfx(name, volume, pitch)` (`engine3d.js:341`) ne correspond pas à la signature `playSfx(preset, seed, volume, pitch)` de `chip.js:397`. Dans l'export, l'`AudioContext` n'est jamais `resume()` après un geste utilisateur (muet sous Chrome/Safari) ni fermé au `destroy()`.

**C-7 [M] ✔ `on('keydown', 'SPACE'|'LEFT'…)` ne se déclenche jamais en 3D.** La table des handlers est indexée par `SPACE`/`LEFT`, mais `justPressedKeys` contient `' '` / `ARROWLEFT` (`engine3d.js:440,628`). Seul `input.justPressed` fait la correspondance.

**C-8 [M] `environment` de la scène ignoré.** Le moteur lit `project.environment` (`engine3d.js:75`) alors que `upsert_scene3d` et l'éditeur écrivent `scene.environment` : ciel, brouillard et lumières par scène perdus.

**C-9 [M] ✔ `startScene3DId` ignoré.** `engine3d.js:123` prend toujours `scenes3d[0]`. Les jeux démo marchent par chance.

**C-10 [M] ✔ Nœuds Blueprint 2D proposés en 3D (et l'inverse).** `src/graph/nodes.js:99` met `dims: ['2d','3d']` par défaut à tous les nœuds. En 3D, `pf_random` compile vers `game.random` qui n'existe pas dans `engine3d.js` (TypeError) ; idem raycast 2D, tween, tuiles, caméra shake/zoom… `pf_pointer_lock` est `['2d','3d']` mais `src/runtime/engine.js` n'a pas `requestPointerLock`. Le filtre n'est qu'à l'affichage (`graph-editor.js`) : ni `compile.js` ni `validate.js` ne refusent un nœud de la mauvaise dimension (la roadmap C5 demandait une erreur de compilation).
Correctif : marquer les nœuds 2D-only `dims:['2d']`, `pf_pointer_lock` en `['3d']`, et erreur dans compile/validate.

**C-11 [M] API documentée mais absente** (`docs/SCRIPT_API_3D.md`, `AGENTS.md`) : `self.setGravity`, `on('beat')`, `raycast3D` qui renverrait `instance`/`block`, `scaleX/Y/Z` et `rotationX/Z` jamais appliqués au mesh, `self.play()` vide, `width/height/depth` fixés à 0,9, `collide` qui ne sépare rien (décrit comme « bloquant »). PS1 jitter annoncé mais absent. Sens de rotation : avec `forward = (-sin, -cos)`, la recette `RIGHT → rotateY(3)` tourne à gauche (à confirmer en jeu). Corriger le code ou la doc.

**C-12 [M] Instances détruites jamais retirées** (`engine3d.js:549-560`) : le tableau `instances` grossit sans fin (projectiles), collisions en O(n²) de plus en plus lentes, `overlapEnd` jamais émis à la destruction. Le `return` après `game.restart()` (`:681`) coupe le reste de la frame et modifie `instances` pendant la boucle.

**C-13 [M] Fuites des éditeurs 3D et du runtime.**
- `scene3d/index.js:266` : `window.addEventListener('keydown')` jamais retiré, actif quand l'onglet est caché, et sans filtre des champs de saisie (`Suppr` dans un input supprime l'entité, F6 lance le jeu depuis n'importe quel onglet).
- `dispose` des éditeurs voxel/scene3d : pas de `ResizeObserver.disconnect()`, matériaux recréés à chaque reconstruction sans `dispose()`, géométries/helpers non libérés, pas de `forceContextLoss()`. La boucle `requestAnimationFrame` tourne même onglet caché (`onHide` vide).
- Runtime : pas de `forceContextLoss()` ni `exitPointerLock` à l'arrêt ; ouvrir/fermer Play plusieurs fois épuise les contextes WebGL.

**C-14 [M] ✔ Compression RLE jamais appliquée.** `packProjectVoxels` (`src/core/compression.js:53`) n'est appelée nulle part ; seul le décodage l'est. Si un fichier contient `voxels` et `voxelsRLE`, l'ancien RLE ressuscite après un « tout effacer ». `decodeRLEVoxels` ne borne pas `count` (`count: 1e9` fige l'onglet).

**C-15 [M] Dimensions incohérentes.** Modèle/MCP : `width/height/depth` (défaut 8) ; éditeur voxel : `dimX/dimY/dimZ` (défaut 16, `voxel/index.js:43-45`).

**C-16 [M] Les éditeurs modifient la ressource à l'ouverture** sans `emit` ni undo : socle + personnage ajoutés à un modèle vide (`voxel/index.js:28-41`), sol 17×17 ajouté à une scène vide (`scene3d/index.js:28-31`), ressources fantômes créées si `refId` est introuvable.

**C-17 [M] Pas d'undo/redo** dans les éditeurs voxel et scène 3D (demandé par la roadmap C2). Reconstruction complète à chaque clic (un `Mesh` par bloc au lieu d'un `InstancedMesh`) : lent au-delà de quelques milliers de blocs.

**C-18 [M] XSS via `innerHTML`** avec des noms venant du fichier projet : `voxel/index.js:90`, `scene3d/index.js:78,475`. Un `.pixelforge.json` partagé avec `name: "<img src=x onerror=…>"` exécute du JS.

**C-19 [M] Import glTF non vérifié** : aucun contrôle d'en-tête, au-delà de 2 Mo un simple `alert` puis import quand même, pas de `reader.onerror`.

**C-20 [M] Validation 3D trop permissive** (`mcp/lib/validate.js` ~220-235) : ne vérifie ni le joueur dans la scène de départ (la 2D le fait), ni les blocs mal formés, ni les entités sans sol, ni `goToMap` vers une carte 2D depuis un jeu 3D. `paint_gridmap` accepte n'importe quel caractère (stocké tel quel, couleur invalide).

**C-21 [M] `cameras.js` est du code mort.** `engine3d.js` ne l'utilise pas (il recopie une version différente : pas de vraie caméra orthographique en isométrique, pas de tangage en FPS). `cameras.test.mjs` teste donc un module non livré.

**C-22 [M] Export 3D ≠ aperçu.** L'export charge three **r128** (cdnjs) alors que l'éditeur utilise three **0.186** (éclairage et couleurs différents depuis r155). Pas d'intégrité SRI. Les erreurs de script ne passent jamais par `opts.onLog` : rien ne s'affiche quand un script plante.

### Mineurs

- **[m]** Jeux démo : graphes du `Player` câblés sur `true` ET `false` → code compilé en `if/else` imbriqués (150+ lignes dupliquées). Saut de 12 = ~0,6 bloc d'apogée avec la gravité actuelle (peu de marge pour une marche). Score non remis à zéro au `restart`, pas d'écran de fin dans Cube Runner.
- **[m]** `render_scene3d` : entités placées avec `Math.floor(y)`, sens de Z non documenté, entités hors bornes non signalées.
- **[m]** Titre d'onglet scene3d non synchronisé avec le nom (`documents.js:159,252`).
- **[m]** Accessibilité : palettes en `div` cliquables sans rôle ni clavier, pas d'`aria-pressed` sur les outils.
- **[m]** `normalizeProject` ajoute `models`, `materials`, `scenes3d`, `environment` vides à chaque jeu 2D.
- **[m]** `__debugSnapshot` absent en 3D (le panneau console renvoie `null`). Touche maintenue pendant une perte de focus restée « enfoncée » (pas de `blur`).
- **[m]** Tests : `engine3d.test.mjs` ne fait que des `includes`/regex sur le source ; `studio.spec.js` a un test « palette » qui ne vérifie rien (`if (count() > 0)`), aucun scénario 3D ; `vite.config.js` sans `strictPort` (Playwright échoue si 5173 est pris) ; e2e MCP 3D sans assertion de contenu.
- **[m]** Roadmap pas à jour : Rapier annoncé (C1), AABB maison retenu dans `docs/3D.md`. Ombres, lumières ponctuelles, particules, dithering (C4) non livrés.

---

## Phase B — Musique

### Majeurs

**B-1 [M] ✔ La batterie joue la mauvaise pièce.** `src/audio/chip.js:498-500` décide kick/snare/hat par seuils en Hz, testés avant les noms. `D3` = 146,8 Hz < 150 → kick au lieu de snare ; `F#3` et `A#3` tombent dans la plage snare. `noteFreq('snare')` vaut 0, donc tout nom de pièce devient kick. Les 6 morceaux de démo et `DRUM_PATTERNS` ont une batterie fausse.
Correctif : tester d'abord le nom (`kick`, `snare`, `hat_closed`, `hat_open`), puis une table par numéro MIDI (C3, D3, F#3, A#3).

**B-2 [M] ✔ `solo` sans effet.** `chip.js` ne lit jamais `ch.solo` (`:704` ne teste que `mute`). Les boutons Solo du rack et du mixeur ne font rien.

**B-3 [M] ✔ Boucle : trois formats différents.** Schéma, `normalizeProject` et inspecteur : `loop: {enabled, start, end}`. Moteur (`chip.js:630,649`) : `song.loop !== false` (un objet vaut toujours vrai) et `song.loopStart/loopEnd`. Playlist : écrit `song.loopStart` à la racine (absent du schéma). La case « Boucler » de l'inspecteur et `loop.start/end` n'ont aucun effet.

**B-4 [M] Export WAV non fiable.** `renderOffline` (`chip.js:803-828`) réutilise `playSong`, qui planifie avec `setInterval` sur l'horloge d'un `OfflineAudioContext` (à 0 avant le rendu) : WAV probablement tronqué ou notes empilées (à confirmer dans un navigateur). Le WAV n'a pas le gain maître de 0,6 → plus fort que l'aperçu, risque d'écrêtage.
Correctif : en hors-ligne, boucler synchroniquement sur tous les pas avec des temps absolus.

**B-5 [M] Une note invalide bloque le planificateur.** Pas de `try/catch` autour de `scheduleNote` ni de `onBeat` (`chip.js:697-748`) : un pitch NaN (ou un script `on('beat')` qui plante) fait rejouer le même pas tous les 25 ms, avec des notes dupliquées et le CPU qui monte. `noteFreq(NaN)` renvoie NaN et passe le contrôle `<= 0`.

**B-6 [M] ✔ Éditeur musical : nettoyages jetés, listeners qui s'accumulent.** `src/editors/music/index.js:414,440,471` ignore la fonction de nettoyage renvoyée par `renderMixer`/`renderPlaylist`/`renderPianoRoll`. Après 10 actions dans le piano roll, une touche joue la note 10 fois, y compris après fermeture de l'onglet. Le rack empile ses `mouseup` dans `container.cleanups` à chaque rendu.
Correctif : garder `viewCleanup`, l'appeler au début de `render()` et dans `dispose`.

**B-7 [M] Undo/redo faux pour les musiques.** Piano roll et playlist modifient `song` en place **avant** `store.update` (le snapshot est pris après la modification). Après `store.undo()`, la variable locale `song` pointe sur l'ancien objet et l'éditeur ne se re-rend pas. Scénario : 3 notes, Ctrl+Z, une note → les 3 notes reviennent. Le dessin dans le rack crée une entrée d'historique par case (16 entrées pour un trait, limite 40), chacune avec un `JSON.stringify` du projet entier.
Correctif : muter uniquement dans le callback de `store.update` (comme le rack), relire `song` par id à chaque rendu, écouter `history`, regrouper un trait en une seule entrée.

**B-8 [M] L'aller-retour texte ↔ musique (MCP) perd des données** (`mcp/lib/song-text.js`) : un nom de pattern avec espace casse la lecture (`PATTERN Pattern 1 16` → nom « Pattern », longueur 1 ; c'est le nom par défaut, donc `get_song` puis `upsert_song` réduit les patterns à 1 pas). Les accords sur un même canal sont réduits à une note. `vel`, `mute`, `solo`, `env`, `vibrato`, `arp`, `waveTable`, `loop`, `swing` sont perdus, comme les trous de la playlist. Noms de canal avec espace ou accent ignorés.

**B-9 [M] `normalizeProject` perd ou laisse passer des champs** (`src/core/project.js` ~185-260) : `ch.defaultPitch` (utilisé par le rack) disparaît au rechargement ou à l'undo ; les notes ne sont pas normalisées (`step`, `len`, `vel`, `pitch`) ; `volume`/`pan` non bornés ; `upsert_song` en JSON brut garde des ids fournis (doublons possibles).

**B-10 [M] Fuite pendant la lecture en boucle.** `activeNotes` (`chip.js:677,721`) garde un handle par note jusqu'au `stop()` ; une musique de jeu qui boucle une heure grossit sans fin. À la fin naturelle d'un morceau, `songGain` n'est pas déconnecté et `stop()` ne nettoie plus rien.

**B-11 [M] XSS via `innerHTML`** avec des noms de canal : `pianoroll.js:92`, `mixer.js:146`, `resources.js:134`. Source possible : un nom de piste dans un fichier `.mid` importé (`midi-parser.js:228`).

### Mineurs

- **[m]** Musique de jeu : `engine.js:232-236` relance le morceau à la main à chaque fin (`loop:false` + `onEnd`), ce qui crée un trou audible et une dérive ; `playSong` sait déjà boucler. `playMusic` d'une song force `loop:true` même si la musique ne boucle pas. `onBeat` arrive jusqu'à 100 ms en avance.
- **[m]** Onglet en arrière-plan : au retour, tous les pas manqués sont joués d'un coup (resynchroniser `nextStepTime`).
- **[m]** `noteFreq` : un entier de 1 à 127 est lu comme un numéro MIDI, donc 110 (Hz) joue 2349 Hz.
- **[m]** Instrument `sample` déclaré mais non implémenté (retombe sur un carré). Bruit non accordé. Table d'onde recalculée à chaque note.
- **[m]** `playMusic` sur un son sfxr personnalisé joue `blip` (`engine.js:174` ignore `params`).
- **[m]** Bloc `if (!chip && chipFactory && master) {…}` répété 5 fois dans `engine.js` : factoriser en `getChip()`.
- **[m]** MIDI (`midi-parser.js`) : importe `midiToPitch` depuis un module d'UI (`editors/music/pianoroll.js`) ; dernière note sans `noteOff` perdue ; seul le dernier tempo retenu ; division SMPTE non gérée ; longueur de chunk corrompue → boucle quasi infinie ; canal 10 (batterie) non détecté.
- **[m]** Import MIDI : l'onglet reste lié à l'ancien morceau (`index.js:425-434`), nom importé possiblement en double (erreur de `validate`).
- **[m]** Curseur de lecture en dur (`step * 12`, `index.js:397`) ; Espace sur un bouton focalisé lance la lecture **et** clique le bouton.
- **[m]** Clavier : cases du rack et notes du piano roll inutilisables sans souris, pas d'`aria-label`.
- **[m]** `swing` et `stepsPerBeat` lus par le moteur mais absents du schéma et de l'éditeur. `validate` ne contrôle ni `pitch`, ni `step >= length`, ni `bpm`.
- **[m]** Roadmap B2 : pas de sous-lignes batterie (Kick/Snare/Hat/Tom) avec réglages, seulement des modèles en un clic.
- **[m]** Tests : `chip.test.mjs` utilise une horloge qui n'avance jamais et ne vérifie que l'absence d'erreur (`renderOffline` testé par `typeof`). Aucun test de `song-text`, de normalisation ou de validation des musiques.

---

## Ce qui est bien fait

- Moteur chip réellement **partagé** (éditeur Sons, éditeur Musique, jeu, export) ; `synth.js` supprimé ; `engine.js` et `engine3d.js` restent sans import ; export protégé contre l'injection (`</script` échappé).
- Synthèse NES soignée (pulses par séries de Fourier, LFSR 15 bits), encodeur WAV correct.
- Greedy mesher correct (faces, normales, fusion) et testé ; `GridMap3D` isolé et testé.
- Les éditeurs respectent le contrat `{dispose, onShow, onHide}` ; `three` chargé à la demande avec des chunks séparés.
- Les nœuds Blueprint 3D compilent vers des fonctions qui existent ; `check:doc` et la CI couvrent tous les nouveaux tests et la validation des jeux démo.
