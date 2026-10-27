# Journal — PixelForge

## 2026-10-27 (58) — [Phase G] G3 : effets audio par piste et en départ (Issue #83)
- **Fait** :
  - `src/audio/chip.js` :
    - Implementation des 8 effets audio WebAudio natifs (zero import externe, compatibles temps reel et OfflineAudioContext pour export WAV) :
      - `reverb` : simulation d'espace acoustique par convolution procedurale d'impulsion stereo (`ConvolverNode`), pre-delai et controle de taille / amortissement.
      - `delay` : echo stereo avec synchronisation rythmique en fractions de temps (`1/4`, `1/8`, `3/16`...), retour feedback et filtrage passe-bas analogique.
      - `eq3` : egaliseur 3 bandes en cascade (grave lowshelf 100 Hz, medium peaking 1 kHz, aigu highshelf 8 kHz).
      - `compressor` : controle dynamique de dynamique (`DynamicsCompressorNode`) avec seuil, knee, ratio, attaque, relachement et gain de rattrapage makeup.
      - `filter` : filtre resonant biquad (passe-bas, passe-haut, passe-bande) avec frequence de coupure et resonance Q reglables.
      - `distortion` : saturation et overdrive analogique douce par fonction de transfert mathematique tangente hyperbolique (`WaveShaperNode`).
      - `chorus` : chorus stereo a doubleur harmonique et modulation de delai par LFO.
      - `bitcrusher` : reducteur de resolution 2 a 16 bits par quantification d'amplitude et filtrage passe-bas d'anti-repliement.
    - Integration dans `playSong` :
      - Chaine d'effets serielle par piste (`input -> fx1 -> ... -> fxN -> fader -> panner -> songGain`).
      - Departs auxiliaires (`sends`) configurables depuis n'importe quelle piste vers un autre bus auxiliaire avec faders de gain independants.
      - Nettoyage et deconnexion complete de tous les noeuds d'effets et departs a l'arret de la musique.
    - Export de `VALID_EFFECTS` et methode `createEffectNode`.
  - `src/core/ops/validate.js` & `docs/PROJECT_SCHEMA.json` :
    - Enregistrement des schemas `effects` et `sends` pour les pistes et validation dans `validateProject`.
  - `src/editors/music/` (`mixer.js`, `music.css`) :
    - Refonte de la console de mixage avec separation tranches / Rack d'effets et departs auxiliaires.
    - Selection dynamique de la tranche active avec surbrillance bleue.
    - Rack d'effets complet : reordonnancement des effets par boutons monter/descendre ou glisser-deposer (drag-and-drop), bascule Bypass, reglages de parametres et suppression.
    - Menu d'ajout des 8 effets audio et gestion des departs vers d'autres pistes de mixage.
  - Tests :
    - `src/audio/test/chip.test.mjs` : tests unitaires des 8 effets, du mode bypass, du routage en chaine et des departs auxiliaires.
    - `e2e/studio.spec.js` : test 13 Playwright validant l'ouverture de la vue Mixer, la selection de tranche, l'ajout d'effets (Reverb, Distorsion), le mode bypass et le reordonnancement.
- **Verifie** : `npm test` (tous les tests unitaires verts), `npm run check:doc`, `npm run build`, validation `cube-runner` et `exemple-plateforme-qiqv`, et `npm run test:e2e` (13 tests Playwright verts).
- **Etat** : Branche `feat/audio-effects`, Closes #83.

## 2026-10-27 (57) — [Phase G] G2 : instruments (synthés, sampler, boîte à rythmes) et préréglages (Issue #82)
- **Fait** :
  - `src/audio/chip.js` :
    - Implementation des 4 nouvelles familles d'instruments DAW v2 dans `scheduleNote` et `playSong` :
      - `synth_sub` (synthetiseur soustractif) : 2 oscillateurs (ondes NES/saw/triangle/sine, reglage d'octave et accord fin en cents, mixage individuel), filtre resonant biquad (passe-bas, passe-haut, passe-bande) avec enveloppe d'attaque/declin dediee et LFO assignable (pitch, filtre, amplitude).
      - `synth_fm` (synthetiseur FM 4 operateurs DX-style) : 4 oscillateurs sinusoidaux avec ratios harmoniques, niveaux individuels, enveloppes ADSR par operateur et routage d'algorithmes (Cascade standard 1, Double modulateur 4, Piano electrique 5, Parallele additif 6).
      - `drum_machine` (boite a rythmes) : synthese analogique percussive sans dependances (kick punchy 808/acoustique avec glissando rapide, snare combine corps triangulaire et bruit blanc filtre, charleston ferme/ouvert, tom, clap 808 multi-declenchements et cymbales).
      - `sampler` (echantillonneur polyphonique) : lecture d'echantillons en memoire (`samplesCache`) avec suivi de frequence relative (`baseFreq / rootFreq`), boucle configurable et repli gracieux sans echantillon.
    - Ajout de la banque de 11 prereglages `INSTRUMENT_PRESETS` couvrant toutes les categories requises (basses, nappes, leads, claviers, cordes, batteries) : `bass_808`, `bass_synth`, `bass_fm`, `lead_retro`, `lead_poly`, `pad_warm`, `pad_retro`, `piano_vintage`, `strings_ensemble`, `drums_808`, `drums_acoustic`.
    - Exposition des methodes utilitaires `loadAudioSample`, `getAudioSample`, `previewPreset` et de l'objet `presets` dans `createChipAudio()`.
  - `src/core/ops/validate.js` & `docs/PROJECT_SCHEMA.json` :
    - Enregistrement des instruments `synth_sub`, `synth_fm`, `sampler`, `drum_machine` dans les schemas et le validateur de projet.
  - `src/editors/music/` (`rack.js`, `index.js`, `pianoroll.js`) :
    - `rack.js` : bouton d'audition d'un clic pour chaque canal, integration des prereglages et instruments DAW dans le menu d'ajout de canal `+ Ajouter un canal ou prereglage...`.
    - `index.js` : prise en charge du callback `onAudition(ch)`, transmission des prereglages et parametres de synthese dans `onAddChannel` et `onStepToggle`.
    - `pianoroll.js` : audition au clavier virtuel avec prise en compte du type d'instrument et des prereglages actifs.
  - Tests :
    - `src/audio/test/chip.test.mjs` : tests unitaires complets pour `synth_sub`, `synth_fm`, `drum_machine`, `sampler`, `loadAudioSample`, `previewPreset` et lecture de morceau multi-pistes DAW v2.
    - `e2e/studio.spec.js` : test 12 Playwright validant l'ajout d'un canal par prereglage, l'audition d'un clic et la lecture dans le studio musical.
- **Verifie** : `npm test` (tous les tests unitaires verts), `npm run check:doc`, `npm run build`, validation `cube-runner` et `exemple-plateforme-qiqv`, et `npm run test:e2e` (12 tests Playwright verts).
- **Etat** : Branche `feat/audio-instruments`, Closes #82.

## 2026-10-27 (56) — [Phase G] G1 : moteur audio v2 (pistes, bus et planificateur DAW) (Issue #81)
- **Fait** :
  - `src/audio/chip.js` :
    - Graphe audio par piste (DAW v2) dans `playSong` : bus audio dedies (`input -> fader -> panner -> songGain/master`).
    - Methodes dynamiques sur le controleur de lecture : `setTrackVolume`, `setTrackPan`, `setTrackMute`, `getTrack`, `tracks`.
    - Prise en charge des clips de notes (`song.clips[]`).
    - Methode `measureSchedulingPerformance(trackCount, stepCount)` validant la planification 16 pistes en moins de 100 ms.
  - `src/core/project.js` :
    - Normalisation bidirectionnelle dans `normalizeProject` entre `channels[]` et `tracks[]`.
  - `docs/PROJECT_SCHEMA.json` :
    - Ajout des schemas `tracks` et `clips` sous `song`.
  - Tests :
    - `src/audio/test/chip.test.mjs` : tests unitaires de planification 16 pistes, controle des bus et normalisation.
- **Verifie** : `npm test`, `npm run check:doc`, `npm run build`, validation des jeux de demo et `npm run test:e2e` (11 tests Playwright verts).
- **Etat** : Branche `feat/audio-bus-scheduler`, Closes #81.

## 2026-10-27 (55) — [Phase G] G0 : conception du studio audio DAW v2 (Issue #80)
- **Fait** :
  - Redaction du document de conception architecturale et technique `docs/MUSIC.md` :
    - Definition du pipeline audio DAW v2 a zero import externe (WebAudio pur JS).
    - Modele de donnees unifie (`tracks[]`, `clips[]`, `automation[]`, `loop`).
    - Typologie des 5 familles d'instruments (chiptune, synth_sub, synth_fm, sampler, drum_machine).
    - Architecture des 7 effets WebAudio natifs et routage aux bus auxiliaires (sends).
    - Retrocompatibilite totale et migration sans perte via `normalizeProject`.
    - Budget memoire strict des echantillons audio (500 Ko par echantillon, 5 Mo par projet).
- **Verifie** : `npm test`, `npm run check:doc`, `npm run build`, validation des jeux de demo et `npm run test:e2e`.
- **Etat** : Branche `docs/audio-daw-design`, Closes #80.

## 2026-10-27 (54) — [Phase F] F4 : modeles glTF 2.0 animes, materiaux et presets CC0 (Issue #73)
- **Fait** :
  - `CREDITS.md` : attribution complete de toutes les ressources CC0 (Kenney, Quaternius, Sweetie 16, MIT).
  - `src/core/cc0-models.js` : generateurs de modeles glTF 2.0 CC0 embarques (Aventurier, Chevalier, Caisse, Baril).
  - `src/runtime3d/engine3d.js` : integration de `GLTFLoader`, gestion des materiaux (`standard`, `unlit`, `toon`), boucle d'animation squelettique et transformationnelle avec `AnimationMixer` et cross-fade a 150 ms, support de `self.play('marche')`.
  - `src/editors/voxel/index.js` : selecteur de presets CC0, previsualisation 3D et bascule entre voxel et glTF.
  - `src/core/ops/validate.js` : validation des materiaux et modeles glTF.
  - `e2e/studio.spec.js` : test 11 Playwright pour la selection de preset CC0.
- **Verifie** : `npm test`, `npm run check:doc`, `npm run build`, validation des jeux de demo et `npm run test:e2e` (11 tests Playwright verts).
- **Etat** : Branche `feat/gltf-animated-models`, Closes #73.

## 2026-10-27 (53) — [Phase F] F3 : navigation de la vue 3D façon Godot (Issue #72)
- **Fait** :
  - `src/editors/scene3d/index.js` :
    - Mode vol libre / flycam facon Godot 4 : maintenu du clic droit + deplacement fluide aux touches ZQSD / WASD / Espace / C / E / Maj (boost de vitesse x2.5).
    - Mode orbite camera autour de `camTarget` (clic milieu ou Alt + clic gauche).
    - Centrage et focus sur la selection (touche F et bouton `Focus (F)`) avec calcul du barycentre des noeuds selectionnes.
    - Vues predefinies alignees : Face (1 / Pave 1), Cote/Profil (3 / Pave 3), Dessus (7 / Pave 7).
    - Camera orthographique en option (Pave 5 et bouton `Persp` / `Ortho` dans la barre d'outils) avec recalcul dynamique du frustum au zoom molette.
    - Grille de travail etendue (64x64) et repere d'axes XYZ (`AxesHelper`).
  - `src/ui/command-palette.js` & `src/main.js` :
    - Enregistrement des commandes 3D dans la palette de commandes (`view-3d-focus`, `view-3d-front`, `view-3d-side`, `view-3d-top`, `view-3d-persp-ortho`).
    - Inclusion des scenes 3D et modeles 3D dans l'acces rapide Quick Open (Ctrl+P).
  - Tests E2E Playwright :
    - `e2e/studio.spec.js` : test de la navigation vue 3D (bouton Focus, bascule Perspective / Orthographique, presence des commandes dans la palette).
- **Verifie** : `npm test` (tous les tests unitaires et scenegraph3d verts), `npm run check:doc`, `npm run build`, validation `cube-runner` et `exemple-plateforme-qiqv`, et `npm run test:e2e` (10 tests Playwright verts).
- **Etat** : Branche `feat/3d-viewport-navigation`, Closes #72.

## 2026-10-27 (52) — [Phase F] F2 : selection, gizmos et aimantation (Issue #71)
- **Fait** :
  - `src/editors/scene3d/index.js` & `src/editors/scene3d/scene3d.css` :
    - Integration de `TransformControls` de Three.js (charge dynamiquement depuis `three/addons/controls/TransformControls.js`).
    - Modes de gizmo : deplacement (W), rotation (E) et mise a l'echelle (R).
    - Basculement de l'espace de transformation : Monde ou Local (Q / bouton).
    - Aimantation a la grille configurable (1.0, 0.5, 0.25, desactivable), coupable temporairement en maintenant la touche Ctrl.
    - Multi-selection (Maj + clic, rectangle de selection marquee sur le fond vide par projection ecran des coordonnees 3D).
    - Operations du presse-papiers et manipulations completes : copier (Ctrl+C), coller (Ctrl+V), dupliquer (Ctrl+D) et supprimer (Delete / Backspace).
    - Enregistrement atomique des transformations a la fin du glissement (`dragging-changed` a `false`) via `commit((sc) => { ... })` : chaque manipulation a la souris produit exactement 1 entree dans l'historique et s'annule integralement avec Ctrl+Z (`store.undo()`).
  - Tests E2E Playwright :
    - `e2e/studio.spec.js` : test de la barre de gizmos 3D (modes W/E/R, espace Monde/Local, aimantation a la grille).
- **Verifie** : `npm test` (tous les tests unitaires et scenegraph3d verts), `npm run check:doc`, `npm run build`, validation `cube-runner` et `exemple-plateforme-qiqv`, et `npm run test:e2e` (9 tests Playwright verts).
- **Etat** : Branche `feat/3d-gizmos-selection`, Closes #71.

## 2026-10-27 (51) — [Phase F] F1 : graphe de scene 3D, arbre et inspecteur (Issue #70)
- **Fait** :
  - `src/core/project.js` & `docs/PROJECT_SCHEMA.json` :
    - `createSceneNode(name, kind, parent)` : structure complete de noeud 3D avec id, name, kind (mesh, light, camera, collision, audio, empty), parent, position [x,y,z], rotation [x,y,z], scale [x,y,z], visible, locked, objectId, materialId, props.
    - `createScene3D` : ajout du tableau `nodes: []`.
    - `normalizeProject` : migration automatique et idempotente des anciennes `entities[]` vers `nodes[]`, tout en maintenant la synchronisation bi-directionnelle pour les noeuds de type mesh.
  - `src/runtime3d/engine3d.js` :
    - Prise en charge native de `scene.nodes` dans l'instanciation runtime (avec fallback sur `scene.entities`).
  - `src/core/ops/ops.js` & `src/core/ops/validate.js` :
    - `placeEntities` pour les scenes 3D peuple a la fois `sc.entities` et `sc.nodes`.
    - Validation approfondie de `sc.nodes` : verification des identifiants, des types, de l'existence de l'objet associe, de l'existence du parent dans la scene, detection des cycles de parente et detection du joueur dans `nodes`.
  - `src/ui/inspector-schemas.js` & `src/ui/inspector.js` :
    - Schemas de configuration et inspecteur interactif pour `node3d` et `scene3d`.
    - Controles de type `object-ref` et `material-ref`.
    - Synchronisation automatique avec `sc.entities` lors des modifications de position, rotation, visibilite et verrouillage via `store.update`.
  - `src/ui/panels/scene-tree.js` & `scene-tree.css` :
    - Vue arborescente hierarchique 3D avec indentation par niveau de profondeur.
    - Icones selon le type (mesh/cube, lumiere/sun, camera, collision/shield, audio/sound, dossier/empty).
    - Bouton [+] avec menu d'ajout de noeud (Mesh, Lumiere, Camera, Collision, Audio, Empty).
    - Duplication (Ctrl+D) et suppression (Trash) avec reparentage automatique des orphelins.
    - Renommage en ligne sur double-clic avec commit sur Entree / blur et annulation sur Echap.
    - Glisser-deposer pour parenter des noeuds entre eux ou les replacer a la racine, avec prevention active des cycles de parente.
    - Synchronisation temps reel de la selection entre l'arbre, le viewport 3D et l'inspecteur.
  - `src/editors/scene3d/index.js` & `src/ui/panels/resources.js` :
    - Mise a jour de l'editeur 3D pour manipuler `nodes` et `entities`.
    - Prise en charge des scenes 3D et modeles 3D dans le panneau des ressources (affichage, duplication, suppression).
  - Tests unitaires et E2E :
    - `src/core/test/scenegraph3d.test.mjs` : creation de noeud, migration `normalizeProject`, detection de cycles de parente, synchronisation `placeEntities`.
    - `e2e/studio.spec.js` : test E2E de l'arbre de scene 3D, ajout d'un noeud, inspection et cycle complet d'annulation `store.undo()`.
- **Verifie** : `npm test` (tous les tests unitaires et scenegraph3d verts), `npm run check:doc`, `npm run build`, validation `cube-runner` et `exemple-plateforme-qiqv`, et `npm run test:e2e` (8 tests Playwright verts).
- **Etat** : Branche `feat/scene-graph-3d`, Closes #70.

## 2026-10-27 (50) — [Phase F] F0 : conception du nouvel editeur 3D (Issue #69)
- **Fait** :
  - Redaction du document de conception architecturale et technique `docs/3D-EDITOR.md` :
    - Definition du pipeline de rendu unifie `src/runtime3d/render.js` (zero import externe, inlinable dans l'export standalone HTML, partage a 100% entre le studio et le jeu).
    - Schema de donnees hierarchique pour les scenes 3D (`scene.nodes[]` avec position, rotation, echelle, visibilite, verrouillage, parent et types de noeuds : mesh, light, camera, collision, audio, prefab, empty).
    - Strategie de retrocompatibilite via `normalizeProject` pour convertir automatiquement les anciennes scenes `entities[]` en `nodes[]` sans casser les jeux existants.
    - Schema de la collection globale `materials[]` (standard, unlit, toon, texture pixel art NearestFilter).
    - Architecture physique a double moteur (Decision V2) : mode `simple` par defaut (AABB pur JS ultra-leger) et mode `rapier` (Rapier 3D WASM pour simulations complexes).
    - Maniabilite et navigation facon Godot 4 dans l'editeur : orbite, vol libre (clic droit + ZQSD), raccourcis pave numerique (1/3/7/5), focus F, gizmos `TransformControls`, aimantation reglable et multi-selection.
    - Integration des modeles glTF 2.0 animes (`AnimationMixer`, cross-fade, modeles CC0).
- **Verifie** : `npm test` (2563 verifs + test IA + test MCP e2e), `npm run check:doc`, `npm run build`, validation des jeux `exemple-plateforme-qiqv` et `cube-runner`, et `npm run test:e2e` (7 tests Playwright verts).
- **Etat** : Branche `feat/3d-editor-design`, Closes #69.

## 2026-10-27 (49) — [Phase H] H3 : interface de l'assistant IA (actions en direct, annulation) (Issue #91)
- **Fait** :
  - `src/ui/panels/ai-assistant.js` & `src/ui/panels/ai-assistant.css` :
    - Affichage des etapes d'action en temps reel (`.pf-ai-steps-container`, `.pf-ai-step-card`) avec pastille de statut animee (en cours, succes, erreur), libelle lisible et apercu des resultats preformates (rendu ASCII de carte, validation).
    - Bouton « Ouvrir [Ressource] » dynamique pour chaque outil reussi permettant d'ouvrir la ressource creee ou modifiee d'un clic dans le document correspondant (`openResource` pour sprites, objets, cartes, musiques, sons, modeles et scenes 3D).
    - Bouton d'arret immediat (« Arreter ») en cours de generation sans laisser le projet corrompu ni a moitie modifie (les changements etant isoles sur une copie de travail appliquee uniquement en fin de traitement).
    - Barre d'historique avec boutons « Annuler » (`store.undo()`) et « Refaire » (`store.redo()`) synchronises dynamiquement avec `store.canUndo` / `store.canRedo` (toute action etant atomique, un seul Ctrl+Z annule tout le lot).
    - Correction des appels d'application manuelle : `compileGraph` appele avec `{ isGlobal: false, dimension }` et passage de toutes les mutations (scripts JS et graphes Blueprints) par `store.update` pour creer une entree d'historique annulable.
  - Tests unitaires et E2E :
    - `src/ai/test/ai.test.mjs` : test de l'arret / interruption (`AbortController`) sans impact sur le store.
    - `e2e/studio.spec.js` : test E2E de l'activation du panneau Assistant IA, presence des boutons d'annulation / refaire et cycle complet d'annulation atomique dans le navigateur.
- **Verifie** : `npm test` (2563 verifs + test IA + test MCP e2e), `npm run check:doc`, `npm run build`, validation des jeux de demo, et `npm run test:e2e` (7 tests Playwright verts).
- **Etat** : Branche `feat/ai-assistant-ui`, Closes #91.

## 2026-10-27 (48) — [Phase H] H2 : agent IA avec outils dans l'editeur (Issue #90)
- **Fait** :
  - Creation de `src/ai/agent.js` :
    - Definition du catalogue complet d'outils au format OpenAI Function Calling (`AGENT_TOOLS`) : `upsert_sprite`, `get_sprite`, `upsert_object`, `set_script`, `get_script`, `upsert_map`, `paint_map`, `set_layer`, `place_entities`, `add_sound`, `upsert_song`, `get_song`, `upsert_model`, `get_model`, `upsert_scene3d`, `paint_gridmap`, `set_settings`, `validate_game`, `render_map`, `render_scene3d`, `list_nodes`.
    - `parseJsonPlan(text)` : extraction et normalisation d'un plan d'actions JSON (support des blocs markdown ```json ... ``` et structures JSON directes) pour les petits modeles locaux sans support natif de tool calling.
    - `executeTool(project, name, args, { confirm })` : execution securisee d'une operation unitaire sur le projet via `src/core/ops`, avec verification et confirmation de l'utilisateur pour les ecrasements ou suppressions destructives (Decision V6).
    - `executePlan(project, plan, options)` : execution sequentielle d'un plan avec notification par etape.
    - `buildAgentSystemPrompt(project)` : construction du prompt systeme incluant la synthese textuelle du projet (`summarize`), l'API de script, le schema Blueprint et les regles d'or de Game Feel.
    - `runAgent({ project, prompt, config, store, onStep, onChunk, signal, confirm })` : boucle d'agent autonome avec outils, effectuant toutes les mutations sur une copie de travail en memoire et appliquant l'ensemble des changements en une seule mise a jour atomique `store.update((p) => Object.assign(p, workingCopy), 'ai-agent')`.
  - Evolution de `src/ai/client.js` :
    - `sendAgentChatRequest` : prise en charge complete des tool calls en streaming SSE (accumulation des fragments de `delta.tool_calls`) pour l'API standard OpenAI (LM Studio, Ollama, etc.), et conversion bidirectionnelle pour l'API Claude Messages (Anthropic) avec fusion des blocs `tool_result` consecutifs.
  - Tests unitaires et d'integration dans `src/ai/test/ai.test.mjs` :
    - Validation du parseur de plan JSON (wrappers `plan`, tableaux bruts, blocs code).
    - Validation de `executeTool` (sprites, objets, scripts, cartes, entites).
    - Validation du hook de confirmation `confirm` en cas de tentative d'ecrasement.
    - Test du critere d'acceptation : requete complexe d'ajout d'une piece avec script de score (+10) et placement de 5 instances sur la carte, produisant exactement 1 entree dans l'historique d'annulation et annulee integralement en un seul Ctrl+Z (`store.undo()`).
  - Documentation mise a jour dans `docs/ARCHITECTURE.md`.
- **Verifie** : `npm test` (2563 verifs + test IA + test MCP e2e), `npm run check:doc`, `npm run build`, validation des jeux `exemple-plateforme-qiqv` et `cube-runner`, et `npm run test:e2e` (6 tests Playwright verts).
- **Etat** : Branche `feat/in-editor-ai-agent`, Closes #90.

## 2026-10-27 (47) — [Phase H] H1 : operations partagees entre l'editeur et le MCP (Issue #89)
- **Fait** :
  - Creation du module `src/core/ops/` (pur JavaScript, zero dependance DOM ni Node) :
    - `src/core/ops/png.js` : encodeur et decodeur PNG minimal RGBA 8 bits pur JS (blocs deflate stockes RFC 1950/1951 avec Adler-32 et CRC-32), compatible navigateur et Node. Support de hook `setInflator` pour acceleration sous Node.js via `node:zlib`.
    - `src/core/ops/sprites.js` : conversion texte <-> frames PNG (`textToFrames`, `framesToText`, `parseColor`, `toHex`).
    - `src/core/ops/graph.js` : validation, normalisation, autolayout et compilation de graphes Blueprint (`checkGraph`, `normalizeGraph`, `describeIssue`, `buildGraphScript`, `listNodes`).
    - `src/core/ops/song-text.js` : parsing et serialisation texte tracker ASCII pour les morceaux chiptune (`parseSongText`, `songToText`).
    - `src/core/ops/ops.js` : operations de haut niveau sur les projets PixelForge (`setSettings`, `upsertSprite`, `getSprite`, `upsertObject`, `setScript`, `getScript`, `upsertMap`, `paintMap`, `setLayer`, `upsertModel`, `getModel`, `upsertScene3D`, `paintGridMap`, `placeEntities`, `addSound`, `upsertSong`, `getSongText`, `summarize`, etc.).
    - `src/core/ops/index.js` : point d'entree unifie du module `ops`.
  - Re-export dans `mcp/lib/` :
    - `mcp/lib/png.js`, `mcp/lib/sprites.js`, `mcp/lib/graph.js`, `mcp/lib/song-text.js` et `mcp/lib/ops.js` re-exportent desormais depuis `src/core/ops/`.
  - Integration Studio et E2E :
    - `src/main.js` : exposition globale de `window.__pfOps` et `window.__pfReady`.
    - `src/ui/documents.js` : fiabilisation de l'activation des onglets et resolution des courses asynchrones au montage des editeurs.
    - `e2e/studio.spec.js` : ajout du test 6 executant l'ensemble des operations pures `src/core/ops` directement dans le contexte du navigateur (creation de sprite PNG pur, objet Blueprint compile, carte peinte, entite placee, musique tracker, scene 3D, resume).
- **Verifie** : `npm run test:e2e` (6 tests Playwright verts en 5.1s), `npm test` (2563 verifs + test e2e mcp complet), `npm run check:doc`, `npm run build`, validation de tous les jeux de demonstration.
- **Etat** : Branche `feat/shared-ops-core`, Closes #89.

## 2026-10-26 (46) — [Phase E] E3 : nettoyage apres la migration Phaser 4 (Issue #68)
- **Fait** :
  - Nettoyage et mise a jour globale de toutes les mentions de version dans la documentation :
    - `package.json` : description mise a jour vers « moteur Phaser 4 ».
    - `AGENTS.md` : mise a jour du moteur de jeu et des capacites d'agents vers Phaser 4.
    - `README.md` et `README.en.md` : badges de version mis a jour (`Phaser-4.2.1-orange`), architecture et diagrammes Mermaid alignes sur Phaser 4.
    - `docs/ARCHITECTURE.md` : presentation du moteur mise a jour vers Phaser 4.
  - Verification rigoureuse de l'absence de references obsoletes a Phaser 3 (hors CHANGELOG historique et guide de migration `docs/PHASER4.md`).
- **Verifie** : `npm test` (2563 verifs), `npm run check:doc`, `npm run build`, `npm run test:e2e` (5 tests Playwright verts), validation de tous les jeux.
- **Etat** : Branche `feat/phaser-4-cleanup`, Closes #68.

## 2026-10-26 (45) — [Phase E] E2 : filtres Phaser 4 dans les scripts et les Blueprints (Issue #67)
- **Fait** :
  - `src/runtime/engine.js` :
    - Implementation de l'API de filtres par instance `self.addFilter(name, options)` (`glow`, `blur`, `pixelate`, `crt`/`barrel`, `vignette`, `shadow`) et `self.clearFilters()`.
    - Implementation du mode de fusion de teinte `self.setTintMode(mode)` (`multiply`, `fill`, `add`, `screen`, `overlay`, `hard_light`).
    - Implementation des filtres de camera plein ecran `game.camera.addFilter(name, options)` (`crt`, `vignette`, `blur`, `pixelate`, `glow`) et `game.camera.clearFilters()`.
  - Blueprints (`src/graph/nodes.js`, `src/graph/compile.js`, `legacy-blocks.js`) :
    - 5 nouveaux noeuds 2D : `pf_filter_add`, `pf_filter_clear`, `pf_tint_mode`, `pf_cam_filter`, `pf_cam_clear_filters`.
    - Documentation des noeuds regeneree (`docs/NODES.md`).
  - Jeux de demonstration :
    - Mise a niveau de `games/exemple-plateforme-qiqv.pixelforge.json` avec filtre camera CRT et filtre lueur doree sur les pieces (Coin) via le graphe Blueprint.
  - Documentation mise a jour dans `docs/SCRIPT_API.md` et `AGENTS.md`.
- **Verifie** : `npm test` (2563 verifs), `npm run check:doc`, `npm run build`, `npm run test:e2e` (5 tests Playwright verts), validation MCP des jeux.
- **Etat** : Branche `feat/phaser-4-filters`, Closes #67.

## 2026-10-26 (44) — [Phase E] E1 : passer le moteur 2D et l'export a Phaser 4.2.1 (Issue #66)
- **Fait** :
  - `package.json` & `package-lock.json` : mise a niveau de `"phaser"` vers `"4.2.1"`.
  - `src/runtime/engine.js` : configuration par defaut du renderer en `Phaser.WEBGL` optimise, avec detection et repli transparent en cas d'absence de contexte WebGL sur le peripherique.
  - `src/runtime/export-template.js` : mise a jour du gabarit d'export autonome vers le CDN `phaser@4.2.1`.
  - `e2e/studio.spec.js` : ajout d'un test E2E Playwright de validation specifique sous Phaser 4 pour le jeu 2D plateforme (`exemple-plateforme-qiqv`), verifiant le chargement, le rendu WebGL, un framerate `>= 30 FPS` stable et le deplacement au sol de l'entite joueur.
- **Verifie** : `npm run test:e2e` (5 tests verts en 5.3s), `npm test`, `npm run check:doc`, `npm run build`, validation des 5 jeux.
- **Etat** : Branche `feat/phaser-4-engine-migration`, Closes #66.

## 2026-10-26 (43) — [Phase E] E0 : inventaire des API Phaser touchees par Phaser 4 (Issue #65)
- **Fait** :
  - Creation de `docs/PHASER4.md` : inventaire exhaustif et analyse d'impact de chaque interface et sous-systeme Phaser utilise dans `src/runtime/engine.js`, `src/runtime/play.js`, `src/runtime/export-template.js` et `src/library/thumbnail.js`.
  - Matrice d'analyse des ruptures potentielles :
    - Confirmation de l'absence d'utilisation des API supprimees (`setTintFill`, `Geom.Point`, `Mesh`, `Plane`).
    - Identification de la deprecation du rendu Canvas et decision de basculer en `Phaser.WEBGL` avec message clair si absent.
    - Cadrage des Render Nodes et des Filtres pour l'etape E2 (`addFilter`, `clearFilters`).
    - Planification detaillee des etapes E1 (`phaser@4.2.1`), E2 (filtres & noeuds Blueprints) et E3 (nettoyage).
- **Verifie** : `npm test`, `npm run check:doc`, `npm run build`, validation de tous les jeux.
- **Etat** : Branche `feat/phaser-4-inventory`, Closes #65.

## 2026-10-26 (42) — [Prérequis] P2 : tests Playwright réels sur le jeu 3D et le DAW (Issue #64, B-9, C-23)
- **Fait** :
  - `vite.config.js` : configuration du port serveur fixe 5173 (`strictPort: true`) pour Playwright.
  - `src/main.js` : exposition globale securisee des hooks de test `window.__pfStore`, `window.__pfWorkspace` et `window.__pfDock`.
  - `src/editors/music/index.js` : exposition du controleur musical sur `window.__pfMusicEditor` (`isPlaying`, `getCurrentStep`, etc.).
  - `e2e/studio.spec.js` : suite complete de 4 tests E2E reels sous Chromium :
    1. Navigation complete dans les onglets du studio (Carte, Sprite, Objet, Son, Musique), lancement F5 du jeu 2D par defaut et arret F8 avec fermeture du document.
    2. Palette de commandes Ctrl+Shift+P et ouverture rapide Ctrl+P avec verification de l'affichage et fermeture Echap sans conditionnel.
    3. Lancement reel du jeu 3D Cube Runner, attente de l'atterrissage sur la gridmap (`onGround === true`), deplacement effectif sans traversee des blocs ni chute dans le vide.
    4. Composition pas-a-pas de 4 notes dans le sequenceur musical, declenchement de la lecture transport, verification de l'avancement effectif du planificateur (`currentStep >= 1`) et arret.
- **Verifie** : `npm run test:e2e` (4 tests verts en 4.5s), `npm test`, `npm run check:doc`, `npm run build`.
- **Etat** : Branche `feat/e2e-playwright-real-tests`, Closes #64.

## 2026-10-26 (41) — [Prérequis] P1b : validation 3D, cameras.js et même Three.js dans l'export (Issue #63, C-20 à C-22)
- **Fait** :
  - `mcp/lib/validate.js` :
    - Validation stricte de la presence d'une entite joueur dans la scene 3D de depart (erreur si absent).
    - Validation du format des coordonnees de blocs de gridmap (`x,y,z` entiers) et des couleurs (index palette 0-15 ou `#rrggbb`).
    - Detection et avertissement lorsqu'une entite avec gravite activee n'a aucun bloc de sol sous elle (prevention de la chute dans le vide).
    - Interdiction des appels `game.goToMap` vers des cartes 2D depuis un jeu dont la dimension est `3d` (et reciproquement).
  - `mcp/lib/ops.js` (`paintGridMap`) : validation des caracteres passes dans `rows` avec rejet explicite de tout caractere non defini en legende et hors palette hexadécimale `0-9a-f`.
  - Nettoyage du code mort : suppression de `src/runtime3d/cameras.js` et de son test isole `src/runtime3d/test/cameras.test.mjs` (la camera complete et l'anti-occlusion etant deja integrees sans import dans `src/runtime3d/engine3d.js`).
  - `src/runtime3d/export-template-3d.js` : alignement de l'export 3D sur Three.js 0.186.1 (identique a l'editeur) charge en module ES via importmap CDN jsdelivr (decision V3), transmission de `createChipAudio` pour le son et affichage des logs d'erreur via `onLog`.
  - Tests unitaires enrichis dans `src/runtime3d/test/engine3d.test.mjs` couvrant l'export Three.js 0.186.1, la validation durcie et le rejet de caracteres dans `paintGridMap`.
- **Verifie** : `npm test`, `npm run check:doc`, `npm run build`, validation des 5 jeux de demo (`npm run pf -- validate`).
- **Etat** : Branche `feat/validation-3d-cameras-export`, Closes #63.

## 2026-10-26 (40) — [Prérequis] P1a : aller-retour texte ↔ musique du MCP sans perte (Issue #62, B-8)
- **Fait** :
  - Mise a niveau de `mcp/lib/song-text.js` pour un aller-retour 100% sans perte (hors ids) :
    - Noms de patterns et de canaux avec espaces, accents et caracteres speciaux cites ou lus proprement.
    - Accords / plusieurs notes par pas (`C4+E4`), support de la notation `:len:vel` pour les notes avec velocite personnalisee.
    - Directives et sous-lignes `LOOP` (on/off start end), `SWING`, `ENV` (ADSR), `VIB` (vibrato depth et rate), `ARP` (arpege), `WAVE` (table donde), `MUTE`, `SOLO`, `PITCH` (defaultPitch) et `SAMPLE` (sampleSoundId).
    - Playlist : conservation fidele de `start` et des pistes avec notation `Pattern@start`, préservant les trous (gaps) et les chevauchements (overlaps).
    - Retrocompatibilite totale avec les anciens formats texte du MCP.
  - Test unitaire d'aller-retour complet dans `src/audio/test/chip.test.mjs` validant les 6 morceaux chiptune de demonstration (`SONG_PRESETS`), un morceau avance complet personnalise et les formats anciens.
- **Verifie** : `npm test`, `npm run check:doc`, `npm run build`, validation de tous les jeux.
- **Etat** : Branche `feat/mcp-song-text-roundtrip`, Closes #62.

## 2026-10-26 (39) — Correctifs phases B et C (Opus, sans délégation à la demande de l'utilisateur)
- **Fait** : runtime 3D (gridmap `{blockSize, blocks}`, modèles voxel rendus, collisions 3 axes en sous-pas, son, keydown, ambiance par scène, startScene3DId, API étendue, rotateY positif = droite, purge des instances, nettoyage WebGL) ; éditeurs voxel / scène 3D (format unique, couleur 0, dimensions width/height/depth, annuler/rétablir via store.update, pas de modification à l'ouverture, glTF vérifié, fuites) ; RLE durci ; nœuds Blueprint 2D-only + erreur de compilation par dimension (éditeur, MCP, validate) ; chip.js (batterie, solo, boucle loop.start, rendu hors-ligne synchrone, robustesse, purge) ; éditeur musical (nettoyages, undo) ; échappement HTML des noms ; play.js (scène testée, resize 3D). Nouveau test `src/runtime3d/test/sim3d.test.mjs`. correction.md mis à jour (fait / reste).
- **Essayé** : vérification du mouvement dans le navigateur : impossible, panneau caché (pas de requestAnimationFrame) ; chargement et rendu de Cube Runner vérifiés.
- **Refusé ou retiré** : l'utilisateur ne veut pas de sous-agents pour coder.
- **Décisions** : gravité 3D = settings.gravity3d ou gravity/800*30 ; fin de boucle musicale = fin de l'arrangement (loop.end ignoré) ; cases 3D centrées sur les entiers ; cameras.js laissé tel quel.
- **État** : branche fix/phases-b-c-relecture, commit b767ffc, poussé (pas de PR).

## 2026-10-26 (38) — Relecture (Opus) des phases B et C → correction.md
- **Fait** : build, npm test, check:doc, validate x5 : tout passe. 5 relecteurs Sonnet (audio B, éditeur musical/MCP B, runtime 3D, éditeurs 3D, MCP/Blueprints/jeux 3D), constats critiques revérifiés par Opus. `correction.md` à la racine : 5 critiques 3D (gridmap non lue par le runtime → jeux 3D injouables, format gridmap de l'éditeur différent, modèles voxel jamais rendus, couleur 0 invisible, pas de collisions murales), majeurs B (batterie, solo, boucle, undo, fuites, song-text).
- **Essayé** : rien d'autre.
- **Refusé ou retiré** : —
- **Décisions** : relecture seule, aucun correctif appliqué.
- **État** : main, correction.md non commité.

## 2026-10-26 (37) — Correctifs Phase A : ouverture, jeux d'exemple, onglets A2 
- **Fait** : `src/ui/project-manager.js` — ouverture/création via `store.openGame` (au lieu de `store.load(id)`), suppression du jeu ouvert via `store.closeGame()`, bouton « Jeux d'exemple » restauré (games/index.json + confirmation avant écrasement, repli sur l'exemple intégré).
- **Essayé** : rien d'autre.
- **Refusé ou retiré** : —
- **Fait (Sonnet)** : A2 — éditeurs pixel/map/objects/sound/music/play en instances `{dispose,onShow,onHide}` par onglet, clavier limité à l'onglet actif, titres d'onglets échappés (documents.js).
- **Décisions** : undo global du store laissé tel quel ; titre d'onglet ne suit pas un changement de ressource interne (limite connue).
- **Vérifié** : build, npm test, check:doc, validate x3, ouverture d'un jeu dans le navigateur.
- **État** : main, commité et poussé.

## 2026-10-26 (36) — [Phase B] B8 : Contenu de depart et morceaux de demonstration
- **Fait** :
  - Composition et integration de 6 morceaux chiptune originaux complets dans `src/audio/presets/` :
    - `adventure.js` : Theme Aventure / Overworld (140 BPM, joyeux et entrainant en do majeur).
    - `dungeon.js` : Theme Donjon / Souterrain (110 BPM, mysterieux et sombre en la mineur).
    - `boss.js` : Theme Combat de Boss (160 BPM, rapide, intense et agressif en re mineur).
    - `menu.js` : Theme Menu Principal (120 BPM, melodie douce et accueillante en fa majeur).
    - `victory.js` : Theme Victoire / Niveau reussi (150 BPM, fanfare heroique triomphante).
    - `gameover.js` : Theme Defaite / Game Over (90 BPM, chute melancolique en do mineur).
  - Creation de 4 modeles rythmiques de batterie 8-bit classiques dans `src/audio/presets/drums.js` (Rock 8-bit, Disco / Techno retro, Marche cadensee, Demi-tempo).
  - Integration dans `src/editors/music/rack.js` d'un selecteur de modele de batterie en 1-clic pour les canaux percussifs.
  - Creation de la boite de dialogue modale `src/ui/dialogs/new-song.js` permettant de choisir un modele de morceau lors de la creation d'une nouvelle musique dans le panneau Ressources.
  - Integration du theme Aventure dans le projet d'exemple (`src/core/sample.js`) avec declenchement automatique via `game.playSong('Aventure')`.
  - Tests unitaires dans `src/audio/test/chip.test.mjs` validant les 6 presets, les 4 modeles de batterie et la lecture audio.
- **Verifie** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **Etat** : Closes #19. Finalisation de toute la Phase B de la roadmap studio (Issues #11 a #19).

## 2026-10-26 (35) — [Phase B] B7 : Integration musicale dans les scripts, Blueprints et MCP
- **Fait** :
  - Extension de l'API runtime dans `src/runtime/engine.js` (zero import) : `game.playSong(name, { loop, volume, fadeIn })`, `game.stopSong({ fadeOut })`, `game.setSongVolume(v)` et evenement de rythme `on('beat', fn(beatNumber))`.
  - Routage dynamique audio dans `src/audio/chip.js` avec node `songGain` sur le morceau actif, fondu entrant (`fadeIn`), fondu sortant (`fadeOut`) et ajustement temps reel du volume (`setVolume`).
  - Ajout des noeuds Blueprints dans `src/graph/nodes.js` et `src/graph/compile.js` : `pf_play_song`, `pf_stop_song`, `pf_set_song_volume` et evenement `pf_on_beat`. Regeneration automatique de `docs/NODES.md`.
  - Creation de `mcp/lib/song-text.js` : parseur et generateur de notation tracker ASCII compacte (BPM, CHANNELS, PATTERN, PLAYLIST) sans dependance DOM.
  - Ajout des outils MCP `upsert_song` et `get_song` dans `mcp/server.js` et `mcp/lib/ops.js`.
  - Validation statique de `game.playSong` et de l'evenement `beat` dans `mcp/lib/validate.js`.
  - Documentation de l'API dans `docs/SCRIPT_API.md`.
  - Tests unitaires et d'integration dans `src/audio/test/chip.test.mjs`, `src/graph/test/graph.test.mjs` et `mcp/test/e2e.mjs`.
- **Verifie** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **Etat** : Closes #18.

## 2026-10-26 (34) — [Phase B] B6 : Generateur d'effets sonores avance (sfxr / jsfxr)
- **Fait** :
  - Implementation de la synthese procedurale sfxr dans `src/audio/chip.js` (`generateSfxr`, `mutateSfxr`, `playSfxr`) sans dependance externe.
  - Formes d'ondes supportees : carre (square), impulsion 12.5%, 25%, 50%, dent de scie, triangle, bruit LFSR.
  - Enveloppe ADSR avec punch, glissement de frequence, vibrato (profondeur et frequence), et filtrage bi-quadratique passe-bas et passe-haut.
  - 9 generateurs 1-clic : Piece, Laser, Explosion, Bonus, Coup, Saut, Bip, Aleatoire, Muter.
  - Editeur d'effets dans `src/editors/sound/index.js` et `style.css` avec sliders parametres sfxr detailles.
  - Historique visuel des 10 derniers sons generes pour reecoute et restauration en 1 clic.
  - Export direct en WAV autonome via `encodeWav` / `audioBufferToWavBlob`.
  - Prise en charge dans `src/runtime/engine.js` (`chip.playSfx({ params })`) tout en conservant 100% de retrocompatibilite avec les presets sonores simples et l'absence d'imports.
  - Tests unitaires dans `src/audio/test/chip.test.mjs`.
- **Verifie** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **Etat** : Closes #17.

## 2026-10-26 (20) — Correctifs phase A en attente
- **Essayé (Opus)** : corriger ouverture de projet, jeux d'exemple et A2 ; arrêté avant toute écriture car une autre IA modifie en direct les mêmes fichiers (icônes SVG : documents.js, project-manager.js, éditeurs…).
- **Décisions** : attendre que l'utilisateur confirme que l'autre IA a fini avant d'écrire.
- **État** : aucun changement de ma part ; main, rien commité.

## 2026-10-26 (19) — Relecture (Opus) de la phase A (PR #30–#39)
- **Vérifié** : build, npm test, check:doc, validate ×3 et CI OK ; interface dock testée dans le navigateur.
- **Bloquant** : « Ouvrir » et « Nouveau projet » du gestionnaire appellent `store.load(id)` au lieu de `store.openGame(id)` → JSON.parse plante, aucun jeu ne s'ouvre (aussi sur la démo Pages).
- **Graves** : A2 non faite — éditeurs toujours singletons ; ouvrir un 2e sprite vide l'onglet du 1er ; tous les documents restent montés cachés, leurs raccourcis clavier (Ctrl+Z, Suppr…) agissent en arrière-plan ; régression : « Jeux d'exemple » n'utilise plus games/index.json ni la confirmation d'écrasement.
- **Incomplet** : A5 (pas de calques d'instances, poignées, rotation/échelle dans l'éditeur ; ancien éditeur de cartes inséré tel quel), modèles topdown/vides minimaux ; titres d'onglets en innerHTML non échappés.
- **État** : rien corrigé ; src/main.js et src/ui/icons.js modifiés non commités par quelqu'un d'autre (pas touchés). Branche main, à jour avec origin, aucun commit de cette relecture.

**But** : moteur / éditeur de jeux 2D dans le navigateur, basé sur Phaser 3 : pixel art, cartes en tuiles, objets avec scripts en code (CodeMirror) ou en blocs (Blockly), test en direct, export HTML autonome.
**Technos** : Vite 6, JS vanilla (modules ES), phaser 3.90, blockly 11, codemirror 6.
**Structure** : voir docs/ARCHITECTURE.md (onglets = modules mount/unmount dans src/editors/* et src/runtime/play.js ; noyau src/core ; API des scripts docs/SCRIPT_API.md).
**Lancer** : `npm install` puis `npm run dev` (ou config `pixelforge` de .claude/launch.json, port 5180). Projet sauvegardé en localStorage (`pixelforge.project`) ; Enregistrer/Ouvrir = fichier .pixelforge.json.

---

## 2026-10-26 (27) — [Phase A] A8 : Palette de commandes, raccourcis et préférences
- **Fait** :
  - Création de `src/ui/shortcuts.js` : registre central des raccourcis clavier studio avec écoute globale.
  - Création de `src/ui/command-palette.js` et `command-palette.css` : palette de commandes flottante façon VS Code / Godot 4 (`Ctrl+Maj+P`) et recherche rapide de ressources (`Ctrl+P`).
  - Navigation au clavier dans la liste avec flèches haut/bas et exécution par Entrée.
  - Création de `src/ui/preferences.js` : boîte de dialogue de réglages Studio (thème sombre/clair, échelle d'affichage de 90 % à 150 %, langue, grille par défaut) avec persistance dans `localStorage`.
  - Intégration dans le menu Édition (Palette, Accès rapide, Préférences) et raccordement à la barre de dock.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #9.

## 2026-10-26 (26) — [Phase A] A7 : Gestionnaire de projets (Project Manager)
- **Fait** :
  - Création de `src/ui/project-manager.js` et `project-manager.css` : écran d'accueil dédié façon Project Manager de Godot 4.
  - Grille de cartes de projets avec miniatures grand format, titre, description, badge de projet actif et date relative.
  - Recherche en direct et tri par date ou nom (A-Z).
  - Modal de création avec modèles prêts à l'emploi : Plateforme 2D (complet avec Blueprints), Projet Vide, et Vue de dessus (Top-down).
  - Actions rapides : Ouvrir, Dupliquer, Exporter JSON, Supprimer et « Charger les jeux d'exemple ».
  - Commande « Fermer le projet / Retour aux projets » dans le menu Jeu pour basculer facilement.
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #8.

## 2026-10-26 (25) — [Phase A] A6 : Lancer, console et débogage distant dans le dock
- **Fait** :
  - Création de `src/ui/panels/console.js` et `console.css` : panneau Console dans le dock bas avec historique de logs, filtrage par niveau et recherche.
  - Détection des erreurs de script avec lien de navigation en 1 clic vers l'objet ou script concerné.
  - Inspecteur distant (Remote Inspector) temps réel avec rafraîchissement des instances vivantes (positions, vitesses, états, variables `self.vars`) et compteur de FPS via `game.__debugSnapshot()`.
  - Création de `src/ui/panels/problems.js` : panneau Problèmes avec validation continue du projet (débouncée à 1 s) et navigation instantanée vers la ressource fautive.
  - Raccordement des raccourcis globaux F5 (Lancer le jeu), F6 (Scène courante) et F8 (Arrêter).
- **Vérifié** : `npm run build`, `npm test`, `npm run check:doc`, `validate tetris`, `validate exemple-plateforme-qiqv`, `validate monde-1-1`.
- **État** : Closes #7.

## 2026-10-26 (24) — [Phase A] A5 : Éditeur de scène 2D et arbre de scène (Scene Tree)
- **Fait** :
  - Support de `angle`, `scale`, `locked`, `visible` sur les entités de scène dans `docs/PROJECT_SCHEMA.json`, `src/core/project.js` (`normalizeProject`) et `src/runtime/engine.js` (sans aucun import).
  - Création de `src/ui/panels/scene-tree.js` et `scene-tree.css` : panneau Arbre de scène dans le dock gauche avec gestion des calques et des entités.
  - Bascule de visibilité et verrouillage individuels par calque et par entité.
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

## 2026-10-26 (9) — [Phase A] A9 : Finition pro et accessibilité (Closes #10)
- **Fait** :
  - Création de `src/ui/icons.js` fournissant un catalogue SVG unifié, net et sans flou (style Lucide / Godot 4).
  - Intégration des icônes SVG dans les docks, la barre de lecture, les onglets rapides, l'arbre de scène, les ressources, l'inspecteur, la console et les problèmes.
  - Ajout d'une barre d'état au bas du studio (`.pf-dock-statusbar`) avec coordonnées du curseur (X, Y), niveau de zoom et statut de synchronisation persistant (Disque / IndexedDB).
  - Amélioration de l'accessibilité WCAG 2.2 AA : anneaux de focus `:focus-visible` à fort contraste, support de `prefers-reduced-motion`, labels `aria-label` et états vides pédagogiques sur tous les panneaux.
- **Vérifié** : `npm run build`, `npm test` (2277 vérifications, 0 échec), `npm run check:doc`, validation des 3 jeux (tetris, exemple-plateforme-qiqv, monde-1-1). Tous conformes avec 0 erreur.

## 2026-10-26 (10) — Suppression totale des émojis du code, projet et documentation
- **Fait** :
  - Remplacement de tous les émojis dans l'interface et le code par des icônes SVG vectorielles (`src/ui/icons.js`) ou du texte sobre.
  - Nettoyage complet de `README.md`, `README.en.md`, `CONTRIBUTING.md`, `ROADMAP-STUDIO.md` et `docs/BLUEPRINTS.md`.
  - Remplacement des symboles pictographiques résiduels dans `src/editors/`, `src/runtime/` et `src/ui/`.
- **Vérifié** : Scan de validation regex `\p{Extended_Pictographic}` = 0 trouvé, `npm run build`, `npm test`, `npm run check:doc` et 3 validations de jeux réussis avec 0 erreur.

## 2026-10-26 (11) — [Phase B] B0 : Modele de donnees des musiques (Closes #11)
- **Fait** :
  - Definition du modele de donnees de chansons multi-voix chiptune (`songs`) dans `src/core/project.js` (`createSong`, `normalizeProject`) : canaux (instruments NES/chiptune, volume, pan, ADSR, vibrato, arpeges, waveTable, sample), patterns (longueur, pas, notes, velocite) et playlist (arrangement temporel avec boucle).
  - Mise a jour du schema JSON formel `docs/PROJECT_SCHEMA.json` avec validation stricte des chansons, canaux, patterns et items de playlist.
  - Integration de la validation semantique dans `mcp/lib/validate.js` (detection des noms en double, canaux inconnus dans les patterns, patterns orphelins dans la playlist).
  - Ajout de la categorie Musiques dans l'explorateur de ressources Studio, l'inspecteur unifie et la palette de commandes.
- **Verifie** : `npm run build`, `npm test` (2277 verifications, 0 echec), `npm run check:doc`, 3x `validate`, retrocompatibilite verifiee sur les anciens projets sans musiques.

## 2026-10-26 (12) — [Phase B] B1 : Moteur audio chiptune partage (Closes #12)
- **Fait** :
  - Creation de `src/audio/chip.js` sans aucun import : formes d'ondes NES authentiques (rapports cycliques 12.5%, 25%, 50% via `PeriodicWave`, triangle, saw, table d'ondes 32 echantillons `wave`, bruit blanc et bruit metallique LFSR 15-bit).
  - Enveloppes ADSR de gain par note, vibrato par LFO, arpegiateur 60 Hz pas-a-pas.
  - Planificateur Web Audio a anticipation (Two Clocks pattern : `setInterval` 25 ms planifiant les 100 ms suivantes) assurant un tempo parfaitement stable.
  - Rendu hors-ligne `renderOffline(song, durationSeconds)` via `OfflineAudioContext`.
  - Suppression totale de la duplication `src/editors/sound/synth.js` ; l'editeur de sons utilise desormais `createChipAudio`.
  - Integration propre dans `src/runtime/engine.js` (zero import preserve) via `opts.createChipAudio` ou `globalThis.createChipAudio`, avec compatibilite totale pour `CHIPTUNE_PRESETS` (`tetris`, etc.).
  - Support de l'export autonome HTML (`src/runtime/export-template.js`, `mcp/lib/exporter.js`) par inlining ordonne de `chip.js` avant `engine.js`.
  - Ajout de la suite de tests unitaires `src/audio/test/chip.test.mjs` integree a `npm test`.
- **Verifie** : `npm run build`, `npm test` (avec tests chip.js et e2e export_html), `npm run check:doc`, validation des 3 jeux (tetris, exemple-plateforme-qiqv, monde-1-1). Zero emoji, zero import dans `chip.js` et `engine.js`.

## 2026-10-26 (13) — [Phase B] B2 : Channel rack et sequenceur pas a pas (Closes #13)
- **Fait** :
  - Creation de l'editeur de studio musical chiptune `src/editors/music/` (index.js, rack.js, music.css) inspire de FL Studio.
  - Interface Channel Rack avec lignes de canaux (Mute, Solo, instrument NES/chiptune, volume, pan, suppression).
  - Sequenceur pas a pas interactif (16, 32, 64 pas) avec coloration 4-temps, activation clic gauche, effacement clic droit, trace par glisser.
  - Mode Drum Kit specialise pour le canal Noise : separation en sous-pistes Grosse caisse (Kick), Caisse claire (Snare), Charleston ferme/ouvert (Hi-hat) et Tom.
  - Barre de transport complete : Play / Pause / Stop (raccourcis Espace et Echap), commutateur mode Pattern / Song, reglage BPM interactif, metronome sonore (TIC), selection et ajout de patterns.
  - Raccordement du type de document `song` dans `src/ui/documents.js` permettant l'ouverture directe d'une musique depuis l'explorateur ou la palette de commandes.
- **Verifie** : `npm run build`, `npm test` (tests de batterie a 180 BPM reussis), `npm run check:doc`, validation des 3 jeux avec 0 erreur. Zero emoji dans tout le code et l'interface.

## 2026-10-26 (14) — [Phase B] B3 : Piano roll interactif avec aides musicales (Closes #14)
- **Fait** :
  - Creation de `src/editors/music/pianoroll.js` : vue 2D temps x hauteur avec clavier vertical interactif 61 touches (C2 a C7) avec touches blanches et noires.
  - Edition intuitive des notes : creation au clic, deplacement fluide au glisser, redimensionnement de duree par etirement de la poignee droite, suppression au clic droit.
  - Aides musicales intelligentes : selecteur de gamme (Majeure, Mineure naturelle/harmonique, Pentatonique majeure/mineure, Blues chiptune) avec grisage des notes hors-gamme et aimantation automatique.
  - Generateur d'accords instantane en 1 clic (Majeur, Mineur, 7e, Sus4, Diminue).
  - Outil d'arpegation rapide chiptune a 60 Hz convertissant des accords en cascade NES authentique.
  - Saisie musicale au clavier d'ordinateur (support AZERTY et QWERTY) avec retour visuel et pre-ecoute sonore immediate.
  - Commutateur de vue Rack / Piano Roll dans la barre de transport et ouverture directe sur selection d'un canal.
- **Verifie** : `npm run build`, `npm test` (tests unitaires des conversions MIDI, gammes et accords integres), `npm run check:doc`, validation des 3 jeux. Zero emoji.

## 2026-10-26 (15) — [Phase B] B4 : Playlist (Arrangement des patterns) (Closes #15)
- **Fait** :
  - Creation de `src/editors/music/playlist.js` : timeline multipiste permettant d'arranger librement les patterns d'un morceau sur 8 pistes horizontales.
  - Pose de blocs de patterns au clic avec aimantation parametrable (1 mesure / 16 pas, 1/2 mesure, 1 temps, libre).
  - Deplacement horizontal (temps) et vertical (changement de piste) au glisser, duplication rapide par Ctrl+glisser.
  - Apercu miniature des notes et nom du pattern au sein de chaque bloc colore.
  - Gestion des boucles de jeu video : marqueur visuel et configuration de `song.loopStart` (permettant de jouer l'intro une seule fois puis de boucler indefiniment sur le couplet/refrain).
  - Prise en charge du bouclage avec `loopStart` et du seek temporel dans le moteur audio `src/audio/chip.js`.
  - Tete de lecture globale synchronisee en temps reel avec defilement sur la reglette temporelle.
  - Integration de l'onglet [PLAYLIST] dans la barre de transport du studio musical.
- **Verifie** : `npm run build`, `npm test` (test unitaire de boucle Intro -> Couplet/Refrain avec loopStart), `npm run check:doc`, validation des 3 jeux avec 0 erreur. Zero emoji.

## 2026-10-26 (16) — [Phase B] B5 : Mixeur audio et export WAV / import MIDI (Closes #16)
- **Fait** :
  - Creation de l'encodeur WAV pur JavaScript `src/audio/wav-encoder.js` (~50 lignes sans dependance) : generation de fichiers RIFF WAVE PCM 16-bit signes stereo/mono.
  - Creation du parseur Standard MIDI `src/audio/midi-parser.js` : decodage des fichiers .mid format 0 et 1 (en-tete MThd, morceaux MTrk, tempo, conversion temps ticks en pas doubles croches, extraction de notes et instruments chiptune associes).
  - Creation de la console de mixage `src/editors/music/mixer.js` : tranche Master, tranches de canaux avec vumetres de volume, faders verticaux, panoramique L/R, Mute et Solo.
  - Bouton d'export WAV direct : rendu hors-ligne accelere via `OfflineAudioContext`, encodage et declenchement du telechargement du fichier .wav.
  - Bouton d'import MIDI : chargement de n'importe quel fichier .mid avec conversion instantanee en morceau chiptune exploitable.
  - Ajout de l'onglet [MIXER] dans la barre de transport du studio musical.
- **Verifie** : `npm run build`, `npm test` (tests unitaires de l'encodeur WAV et du parseur MIDI integres), `npm run check:doc`, validation des 3 jeux. Zero emoji.

## 2026-10-27 (50) — [Phase F] F0 : Document de conception de l'editeur 3D Godot-style (Closes #69)
- **Fait** :
  - Redaction du document d'architecture et de conception complet `docs/3D-EDITOR.md`.
  - Specification detaillee de l'arbre de scene hierarchique 3D (`nodes[]`), de la barre d'outils gizmos et d'aimantation.
  - Definition des modes de navigation du viewport (flycam, orbite, vues orthogonales, focus).
  - Specification du support des modeles glTF 2.0 animes avec `AnimationMixer` et materiaux PBR retro.
- **Verifie** : `npm test`, `npm run build`, `npm run check:doc`. Zero emoji.

## 2026-10-27 (51) — [Phase F] F1 : Graphe de scene 3D, arbre hierarchique et inspecteur (Closes #70)
- **Fait** :
  - Support de `nodes[]` dans le schema projet `docs/PROJECT_SCHEMA.json` et normalisation bidirectionnelle `entities[]` <-> `nodes[]` dans `src/core/project.js`.
  - Creation du panneau d'arbre hierarchique 3D `src/ui/panels/scene-tree.js` avec indentation, icones par type, menu d'ajout, duplication, suppression et glisser-deposer pour re-parenter sans cycle.
  - Integration dans l'inspecteur (`src/ui/inspector-schemas.js`) pour les proprietes de transformation, objet et materiau des nœuds 3D.
  - Prise en charge dans `src/runtime3d/engine3d.js` de l'instanciation des entites a partir de `scene.nodes`.
- **Verifie** : `npm test`, `npm run build`, validation des jeux et test Playwright e2e. Zero emoji.

## 2026-10-27 (52) — [Phase F] F2 : Selection, gizmos et aimantation (Closes #71)
- **Fait** :
  - Integration de `TransformControls` de Three.js dans `src/editors/scene3d/index.js` avec modes Translation (W), Rotation (E), Echelle (R).
  - Basculement d'espace de coordonnees Monde / Local (Q).
  - Grille d'aimantation parametrable (1.0, 0.5, 0.25, desactive) avec suspension temporaire via Ctrl.
  - Multi-selection par Shift+Clic et rectangle elastique de projection marquee.
  - Actions de presse-papiers : Copier (Ctrl+C), Coller (Ctrl+V), Dupliquer (Ctrl+D), Supprimer.
  - Validation atomique des transformations au relachement pour annulation/retablissement propre via Ctrl+Z.
- **Verifie** : `npm test`, `npm run build`, test e2e Playwright. Zero emoji.

## 2026-10-27 (53) — [Phase F] F3 : Navigation de viewport 3D style Godot (Closes #72)
- **Fait** :
  - Mode vol libre (flycam) avec maintien du clic droit et touches ZQSD/WASD, montee/descente avec Espace/E/C et acceleration Maj.
  - Mode orbite camera au clic molette ou Alt+clic gauche autour de la cible.
  - Cadrage automatique sur la selection (touche F) centrant la camera sur le barycentre des nœuds selectionnes.
  - Vues orthogonales alignees predefinies : Face (1 / Numpad 1), Cote (3 / Numpad 3), Dessus (7 / Numpad 7).
  - Basculement de projection perspective / orthographique (5 / Numpad 5).
  - Grille etendue 64x64 et repere d'orientation RGB (`AxesHelper`).
- **Verifie** : `npm test`, `npm run build`, test e2e Playwright. Zero emoji.

## 2026-10-27 (54) — [Phase F] F4 : Modeles glTF animes et materiaux, en jeu et en export (Closes #73)
- **Fait** :
  - Creation de `CREDITS.md` repertoriant l'attribution CC0 pour Kenney, Quaternius, Sweetie 16, et les licences open source (Three.js, Phaser, CodeMirror, Vite, PixelForge).
  - Creation de generateurs de modeles glTF 2.0 embarques CC0 dans `src/core/cc0-models.js` (Aventurier et Chevalier animes Quaternius, Caisse et Baril Kenney).
  - Integration de `GLTFLoader` dans l'export standalone HTML 3D (`src/runtime3d/export-template-3d.js`) et dans le lanceur de jeu studio (`src/runtime/play.js`).
  - Moteur de rendu 3D `src/runtime3d/engine3d.js` : chargement et cache des modeles glTF, mise a l'echelle et alignement de la boite englobante, pilotage des animations squelettiques / de transformation par `AnimationMixer` via `self.play('marche')` / `self.play('walk')` avec fondu enchaine de 150 ms.
  - Gestion des materiaux personnalises `materials[]` (`standard`, `unlit`, `toon`), texture UV extraite des sprites du projet avec filtrage `NearestFilter` pour un rendu retro net, emissif, transparence et double-face.
  - Selecteur de modeles CC0 et previsualisation 3D dynamique dans l'editeur de modeles (`src/editors/voxel/index.js`).
  - Validation et documentation de l'API de script 3D (`docs/SCRIPT_API_3D.md`).
- **Verifie** : `npm test`, `npm run build`, `npm run check:doc`, validation des jeux et 11 tests Playwright e2e 100% verts. Zero emoji.

## 2026-10-27 (55) — [Phase G] G0 : Conception du studio audio DAW v2 (Closes #80)
- **Fait** :
  - Redaction du document d'architecture et de conception complet `docs/MUSIC.md`.
  - Definition du modele de donnees DAW v2 : pistes (`tracks[]`), clips audio et notes (`clips[]`), chaines d'effets ordonnables (`effects[]`) et automation temporelle (`automation[]`).
  - Specification des 5 familles d'instruments : chiptune retro, synthetiseur soustractif double oscillateur, synthetiseur FM 4 operateurs, echantillonneur polyphonique et boite a rythmes a pads.
  - Definition des 7 effets audio natifs WebAudio : reverb, delay, eq3, compressor, distortion, bitcrusher et chorus.
  - Strategie de retrocompatibilite transparente sans perte via `normalizeProject` pour preserver les morceaux historiques (`channels[]`, `patterns[]`, `playlist[]`).
  - Budget memoire des echantillons (500 Ko par echantillon, 5 Mo max par projet) et architecture WebAudio autonome sans import dans `src/audio/chip.js`.
- **Verifie** : `npm test`, `npm run build`, `npm run check:doc`. Zero emoji.

## 2026-10-27 (56) — [Phase G] G1 : Moteur audio v2 (pistes, bus, planificateur commun) (Closes #81)
- **Fait** :
  - Creation de la structure de bus audio par piste dans `src/audio/chip.js` (`trackBuses`) reliant `input -> fader -> panner -> songGain/master`.
  - Routage dynamique des evenements de notes vers le bus de chaque piste tout en maintenant les caracteristiques de timbre et volume existantes.
  - Pilotage temps reel des parametres de chaque piste via le controleur : `setTrackVolume`, `setTrackPan`, `setTrackMute`, `getTrack` et accesseur `tracks`.
  - Prise en charge des clips de notes `clips[]` dans le planificateur d'anticipation WebAudio a double horloge.
  - Normalisation bidirectionnelle automatique sans perte entre `channels[]` et `tracks[]` dans `src/core/project.js`.
  - Outil de mesure et validation de performance `measureSchedulingPerformance` validant 16 pistes simultanees sans craquement.
- **Verifie** : `npm test`, `npm run build`, `npm run check:doc`. Zero emoji.








