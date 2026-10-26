# PixelForge : feuille de route v4

> Issues GitHub : #96 (à lire d'abord : règles, décisions, dépendances), puis #62 à #95, jalons v4.1 à v5.0.

Quatre chantiers :
1. **Phaser 4** : passer le moteur 2D à la nouvelle version majeure (sortie stable en avril 2026, 4.2.1 aujourd'hui).
2. **Un vrai éditeur 3D** : passer d'un « peintre de blocs » à un éditeur de scène complet (sélection, gizmos, modèles importés, lumières, préfabriqués), avec un rendu en jeu identique à l'éditeur.
3. **Un vrai logiciel de musique** : passer du séquenceur chiptune à une station audio (DAW) : pistes, synthés, échantillons, effets, automation, enregistrement, clavier MIDI.
4. **Une IA qui construit le jeu** : décrire ce qu'on veut, et l'IA crée elle-même les sprites, objets, scripts, cartes, musiques et modèles 3D dans le projet, les vérifie, les teste et corrige.

Même format que `ROADMAP-STUDIO.md` : chaque tâche dit **pourquoi**, **fichiers**, **comment**, **fini quand**. Les règles de la section 0 de `ROADMAP-STUDIO.md` restent valables (une tâche = une branche + une PR, tout passe avant chaque commit, `engine.js` et `engine3d.js` sans import, un jeu = un fichier JSON, `normalizeProject` pour les anciens jeux).

---

## 0. Avant de commencer

| # | À faire | Pourquoi |
|---|---|---|
| P0 | Fusionner la PR #61 (correctifs B et C) | Le code 3D et audio de départ doit être sain : formats unifiés, collisions, solo, boucle. |
| P1 | (#62 pour B-8, #63 pour C-20 à C-22) Finir les points restants de `correction.md` : B-8 (aller-retour texte ↔ musique du MCP), C-20 (validation 3D), C-21 (supprimer ou brancher `cameras.js`), C-22 (même version de Three.js dans l'éditeur et l'export) | Les chantiers F et H s'appuient dessus. |
| P2 | (#64) Un test Playwright par grand écran (ouvrir Cube Runner, F5, une image rendue ; composer 4 notes et les lire) | Aujourd'hui, aucun test ne lance un jeu 3D dans un vrai navigateur. Les chantiers suivants touchent tous l'interface. |

---

## 1. Décisions (validées le 2026-10-26 : toutes les recommandations sont retenues)

| # | Question | Recommandation |
|---|---|---|
| V1 | Version de Phaser | **4.2.x figée** (`"phaser": "4.2.1"`), même version dans l'export (CDN). |
| V2 | Physique 3D | **Rapier** (`@dimforge/rapier3d-compat`, WASM) pour les vrais corps rigides (boîtes, capsules, maillages), avec l'AABB maison gardé comme mode « rétro simple ». Sans Rapier, l'éditeur 3D restera limité aux jeux à blocs. |
| V3 | Three.js dans l'export | **Même version que l'éditeur**, en module ES depuis jsdelivr (`three@0.186.x/build/three.module.min.js` via importmap), au lieu de r128 sur cdnjs. Fin des écarts de rendu. |
| V4 | Moteur audio du DAW | **Garder notre moteur WebAudio** (`chip.js` étendu, sans import, inlinable dans l'export) plutôt que Tone.js : pas de dépendance de 300 Ko dans chaque jeu exporté, et le moteur actuel fonctionne déjà. Ajouter un AudioWorklet seulement si les performances l'exigent. |
| V5 | Fournisseur d'IA | **Les deux** : IA locale compatible OpenAI (LM Studio, Ollama, déjà branchée) **et** API Claude en option (clé saisie par l'utilisateur, stockée en local, jamais dans le jeu). Les petits modèles locaux appellent mal les outils : prévoir un mode « plan JSON » de secours. |
| V6 | Ce que l'IA peut faire sans demander | **Tout ce qui s'annule** (créer, modifier : un seul Ctrl+Z annule l'action complète de l'IA). Supprimer une ressource ou écraser un script existant demande une confirmation. |
| V7 | Ordre des chantiers | **E (Phaser 4) → H1-H3 (IA de base) → F (3D) et G (audio) en parallèle → H4-H7.** E est court et débloque tout. L'IA de base sert ensuite à tester F et G. |

---

## Phase E : migration vers Phaser 4

Le moteur 2D (`src/runtime/engine.js`) n'utilise aucune des API supprimées par Phaser 4 (pipelines, FX, masques bitmap, `setTintFill`, `Geom.Point`, objets Mesh / Plane). La migration devrait donc être courte. Guides officiels : [migration v3 → v4](https://unpkg.com/phaser@4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md), [ce qu'il faut savoir](https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know). Le paquet npm contient aussi `skills/v3-to-v4-migration/SKILL.md`, à lire avant de commencer.

### E0. Inventaire (#65)
- **Comment** : `grep` de toutes les API Phaser utilisées dans `engine.js`, `play.js`, `library/thumbnail.js` et les éditeurs. Comparer avec le guide (rendu, caméras, coordonnées de texture, TileSprite, éclairage, Canvas déprécié).
- **Fini quand** : `docs/PHASER4.md` liste chaque API touchée et le changement prévu.

### E1. Mise à jour du moteur 2D (#66)
- **Fichiers** : `package.json`, `src/runtime/engine.js`, `src/runtime/export-template.js` (CDN `phaser@4.2.1`), `mcp/lib/exporter.js`.
- **Comment** : changer la version, lancer les 3 jeux 2D, laisser les erreurs guider (méthode recommandée par Phaser). `Phaser.AUTO` reste possible mais le rendu Canvas est déprécié : passer en `Phaser.WEBGL`, avec un message clair si WebGL est absent.
- **Fini quand** : Tetris, Monde 1-1 et l'exemple plateforme se jouent à l'identique dans l'éditeur et en export HTML (captures avant / après dans la PR). Mêmes FPS ou mieux.

### E2. Profiter de Phaser 4 (#67)
- **Comment** : exposer quelques nouveautés utiles aux scripts et aux Blueprints : filtres (flou, lueur, contour, pixellisation) sur un objet ou la caméra (`self.addFilter('glow')`, `game.camera.addFilter('crt')`), modes de teinte (`setTintMode`), éclairage 2D si le guide le confirme. Nœuds Blueprint correspondants (dimension `2d`).
- **Fini quand** : un jeu de démo utilise un filtre CRT sur la caméra et une lueur sur les pièces, documentés dans `docs/SCRIPT_API.md`.

### E3. Nettoyage (#68)
- Supprimer les contournements propres à Phaser 3 trouvés en E0, mettre à jour `AGENTS.md`, `README`, `docs/ARCHITECTURE.md`, le test e2e.

---

## Phase F : un vrai éditeur 3D

Aujourd'hui : on peint des blocs étage par étage et on pose des cubes, sans sélection réelle, sans déplacement, et le jeu affiche un cube à la place des modèles glTF. Cible : un éditeur comparable à Godot 3D ou Unity, gardé simple.

### F0. Conception (document d'abord) (#69)
- **Livrable** : `docs/3D-EDITOR.md`, validé par l'humain : schéma des nouvelles données (nœuds de scène, matériaux, lumières, préfabriqués), choix de physique (V2), comment le rendu est partagé entre l'éditeur et le jeu.
- **Point clé** : **un seul code de rendu** (`src/runtime3d/render.js`, sans import, inliné dans l'export) utilisé à la fois par l'éditeur et par le jeu, pour qu'ils affichent toujours la même chose.

### F1. Graphe de scène et inspecteur (#70)
- **Données** : `scene.nodes[]` = `{ id, name, kind: 'entity'|'light'|'camera'|'group'|'model', parent, position, rotation, scale, props }`. Les `entities` actuelles sont converties par `normalizeProject`.
- **Interface** : l'arbre de scène (panneau existant, A5) affiche la hiérarchie 3D ; l'inspecteur (A4) édite position, rotation, échelle, propriétés exportées, matériau.
- **Fini quand** : on renomme, regroupe (glisser un nœud sur un autre), cache, verrouille et duplique des nœuds, avec Ctrl+Z.

### F2. Sélection et gizmos (#71)
- **Comment** : `TransformControls` de Three.js (déplacer W, tourner E, échelle R), aimantation à la grille (configurable, touche Ctrl pour la couper), espace local / monde, sélection multiple (Maj + clic, rectangle), copier / coller / dupliquer (Ctrl+D), supprimer.
- **Fini quand** : on construit une salle avec 20 objets à la souris sans toucher au clavier pour les coordonnées.

### F3. Navigation de la vue (#72)
- Orbite (clic droit), vol libre (clic droit + ZQSD/WASD, comme Godot), centrer sur la sélection (F), vues de face / dessus / côté (pavé numérique), caméra orthographique en option, grille infinie.

### F4. Modèles importés et matériaux (#73)
- **Comment** : afficher les glTF / GLB en jeu et dans l'éditeur (`GLTFLoader` côté éditeur ; pour l'export, inliner le chargeur ou utiliser le module ES de la même version, voir V3). Animations glTF (`AnimationMixer`) exposées par `self.play('marche')`. `materials[]` : couleur, texture tirée d'un sprite (filtre « nearest »), émissif, transparence.
- **Bibliothèque** : un panneau de modèles CC0 intégrés (Kenney, Quaternius) avec `CREDITS.md`.
- **Fini quand** : un personnage glTF animé marche dans un jeu exporté.

### F5. Lumières, ciel, ambiance éditables (#74)
- Placer des lumières ponctuelles et projecteurs (4 max en mode rétro), ombres en option, ciel dégradé, brouillard, sondes simples. Tout visible en direct dans l'éditeur.

### F6. Physique réelle avec Rapier (#75)
- **Comment** : corps statiques, dynamiques, cinématiques ; formes boîte, sphère, capsule, maillage ; la gridmap fusionnée en un seul collider. `collide` sépare vraiment les objets. L'AABB actuel reste disponible (`settings.physics3d: 'simple' | 'rapier'`).
- **Fini quand** : des caisses tombent, s'empilent et se poussent, en jeu et en export.

### F7. Préfabriqués et terrain (#76)
- **Préfabriqués** : un groupe de nœuds enregistré comme ressource, réutilisable dans plusieurs scènes ; modifier le préfabriqué met à jour toutes ses instances.
- **Terrain** : une heightmap sculptable (monter, creuser, lisser, peindre), en plus de la gridmap à blocs.

### F8. Jouer depuis l'éditeur et débogage 3D (#77)
- F6 lance la scène depuis la position de la caméra de l'éditeur. Pendant la partie : boîtes de collision visibles, liste des instances en direct (déjà amorcée par `__debugSnapshot`), pause et image par image.

### F9. Performances (#78)
- `InstancedMesh` pour la gridmap et les objets répétés, mise à jour incrémentale (plus de reconstruction complète à chaque clic), maillage des modèles voxel en cache. Objectif : 20 000 blocs à 60 images/s dans l'éditeur.

### F10. MCP, Blueprints et démo (#79)
- Outils MCP : `upsert_node3d`, `set_transform`, `import_model`, `set_material`, `add_light`. Nœuds Blueprint : transformer, animer un modèle, appliquer une force, raycast contre les objets.
- Démo : une petite aventure 3D low-poly (modèles glTF, lumière, physique, musique) qui sert de test d'intégration en CI.

---

## Phase G : un vrai logiciel de musique

Aujourd'hui : un séquenceur chiptune 8-bit (rack, piano roll, playlist, mixeur), canaux limités aux ondes NES, pas d'effets, pas d'échantillons (l'instrument `sample` n'est pas implémenté). Cible : un DAW simple, façon FL Studio / LMMS, qui reste capable de faire du chiptune.

### G0. Conception (#80)
- **Livrable** : `docs/MUSIC.md`, validé : nouveau modèle de données (pistes, clips, instruments, effets, automation), compatibilité des musiques existantes (`normalizeProject` les convertit, rien n'est perdu), budget de taille (échantillons en data URL, compressés).

### G1. Moteur audio v2 (#81)
- **Fichiers** : `src/audio/` (sans import, comme `chip.js`).
- **Comment** : graphe audio par piste (instrument → effets → volume / pan → bus maître), planificateur commun (celui de `chip.js`, déjà robuste), latence mesurée. AudioWorklet seulement si nécessaire (V4).
- **Fini quand** : 16 pistes jouent sans craquement sur un portable moyen ; les jeux existants sonnent pareil.

### G2. Instruments (#82)
- **Synthé soustractif** (2 oscillateurs, filtre, 2 enveloppes, LFO), **synthé FM** (4 opérateurs), **sampler** (importer un WAV / OGG, zones par note, boucle, ADSR), **boîte à rythmes** (pads avec échantillons), et les instruments chiptune actuels.
- **Préréglages** : une banque de sons prêts à l'emploi (basse, nappe, lead, piano, cordes, batteries), écoutables d'un clic.

### G3. Effets (#83)
- Par piste et en départ (send) : réverbération, écho, égaliseur 3 bandes, compresseur, filtre, distorsion, chorus, bitcrusher. Ordre réglable par glisser-déposer.

### G4. Arrangement multipiste (#84)
- **Comment** : la playlist devient une vraie timeline : pistes, clips de notes (patterns) et clips audio, découpe / déplacement / étirement, boucle de sélection, marqueurs, changements de tempo et de mesure, zoom.
- **Fini quand** : on compose un morceau de 2 minutes avec intro, couplet, refrain et fin.

### G5. Piano roll et saisie (#85)
- Vélocité, quantification, gamme imposée (déjà en partie), accords, arpégiateur, sélection et copier / coller, **clavier MIDI** (Web MIDI), clavier de l'ordinateur comme piano, **enregistrement en direct**.

### G6. Automation (#86)
- Courbes d'automation pour tout paramètre (volume, filtre, effets) dessinées sur la timeline.

### G7. Mixeur, enregistrement, export (#87)
- Vumètres, solo / muet, bus. Enregistrer le micro dans une piste audio (`getUserMedia`, avec l'autorisation du navigateur). Exports WAV, et OGG ou MP3 si le navigateur le permet ; export de chaque piste séparément.
- Import MIDI amélioré (canal 10 = batterie, changements de tempo, tous les canaux).

### G8. Musique dans le jeu (#88)
- Musique adaptative : couches activées selon la situation (`game.setSongLayer('combat', true)`), transitions sur la mesure, `on('beat')` précis. Nœuds Blueprint et outils MCP mis à jour (format texte de la musique v2, aller-retour sans perte, avec test).

---

## Phase H : une IA qui construit le jeu

Aujourd'hui (`src/ai/`, `src/ui/panels/ai-assistant.js`) : une discussion avec une IA locale qui propose du code ; un bouton applique le code ou un graphe à l'objet sélectionné. Défauts : l'IA ne peut rien créer elle-même, l'application ne passe pas par l'historique (pas d'annulation), `compileGraph` est appelé avec de mauvais arguments, et rien n'est vérifié après.

**Idée centrale** : les opérations du serveur MCP (`mcp/lib/ops.js` : créer un sprite, un objet, une carte, une musique, un modèle 3D, peindre, placer, valider) font déjà tout ce qu'il faut et sont testées. On les rend utilisables dans le navigateur, puis on les donne à l'IA de l'éditeur comme outils. L'IA de l'éditeur et Claude Code via MCP utilisent alors exactement les mêmes fonctions.

### H1. Opérations partagées éditeur / MCP (#89)
- **Fichiers** : `mcp/lib/ops.js`, `mcp/lib/png.js` (utilise `node:zlib`), nouveau `src/core/ops/`.
- **Comment** : sortir les opérations pures (sans `fs`) dans `src/core/ops/`, encodeur PNG compatible navigateur (`CompressionStream('deflate')`, ou petite implémentation sans dépendance). `mcp/lib/ops.js` les réutilise.
- **Fini quand** : les tests MCP passent, et un test lance les mêmes opérations dans le navigateur (Playwright).

### H2. Agent avec outils dans l'éditeur (#90)
- **Comment** : boucle d'agent dans `src/ai/agent.js` : l'IA reçoit la liste des outils (créer un objet, dessiner un sprite en texte, écrire un script ou un graphe, peindre une carte, placer des entités, créer une musique, un modèle voxel, `validate`, `render_map`), les appelle, voit les résultats et continue. Appels d'outils au format OpenAI (`tools`) pour les IA locales qui les gèrent, et API Claude en option (V5). Mode de secours pour les petits modèles : l'IA renvoie un plan JSON d'actions que l'éditeur exécute.
- **Sécurité** : toute l'action de l'IA est un seul `store.update` (un Ctrl+Z l'annule entièrement). Suppressions et écrasements demandent une confirmation (V6). Clé d'API seulement en local, jamais dans le JSON du jeu ni dans l'export.
- **Fini quand** : « ajoute une pièce qui rapporte 10 points et place-en 5 sur la carte » crée le sprite, l'objet, son script et les 5 instances, et Ctrl+Z annule tout.

### H3. Interface de l'assistant (#91)
- Chaque action de l'IA s'affiche en direct (« Création du sprite Pièce… », aperçu du sprite, du graphe, de la carte), avec Arrêter, Annuler tout, Refaire. Les ressources créées s'ouvrent d'un clic. Corriger au passage l'appel faux à `compileGraph` et faire passer l'application de code par `store.update`.

### H4. Générer des ressources (#92)
- **Sprites** : l'IA dessine en sprite texte (format déjà connu du MCP), en respectant la palette et la taille de tuile ; variantes et animations (marche, saut).
- **Musiques** : l'IA écrit au format texte de la musique (B-8 corrigé avant), dans un style demandé (« thème de donjon inquiétant, 90 BPM »).
- **Modèles 3D** : modèles voxel par tranches (`upsert_model`) ; plus tard, choix d'un modèle CC0 dans la bibliothèque (F4).
- **Sons** : paramètres sfxr à partir d'une description (« un saut léger », « une explosion lourde »).

### H5. Générer un jeu complet (#93)
- **Comment** : « fais-moi un jeu de plateforme avec 3 niveaux et un boss » → l'agent écrit d'abord un **document de conception** court (montré à l'utilisateur, modifiable), puis construit dans l'ordre : réglages, sprites, objets et scripts, cartes, musique, HUD. Il s'appuie sur la base de game design existante (`src/ai/gamedesign.js`, `knowledge.js`).
- **Fini quand** : un jeu de plateforme de 3 niveaux, jouable et terminable, sort d'une seule demande, en 2D et en 3D.

### H6. Tester et corriger automatiquement (#94)
- **Comment** : après la construction, `validate` (0 erreur exigé), puis une **partie simulée** sans écran (comme `sim3d.test.mjs` pour la 3D ; un équivalent 2D avec Phaser en mode headless) : le joueur tient-il sur le sol, peut-il atteindre la sortie (recherche de chemin sur la carte), les scripts lèvent-ils des erreurs ? Les problèmes sont renvoyés à l'IA, qui corrige, jusqu'à 3 tours.
- **Fini quand** : l'IA signale et corrige seule un niveau impossible à terminer.

### H7. L'IA comme copilote dans chaque éditeur (#95)
- Un bouton « Demander à l'IA » dans chaque éditeur, avec le contexte du document ouvert : « rends cet ennemi plus agressif » (script), « ajoute une basse à ce pattern » (musique), « remplis cette salle de décor » (scène 3D), « explique ce graphe ». Les mêmes outils que H2, limités au document.

---

## Ordre conseillé et jalons

| Jalon | Contenu | Résultat visible |
|---|---|---|
| **v4.1** | P0 → P2, E0 → E3 | Phaser 4, filtres visuels, base saine et testée |
| **v4.2** | H1 → H3 | L'IA crée des objets, sprites et scripts dans l'éditeur, annulables |
| **v4.3** | F0 → F4 | Éditeur 3D avec gizmos, hiérarchie, modèles glTF animés en jeu |
| **v4.4** | G0 → G4 | DAW : synthés, sampler, effets, arrangement multipiste |
| **v4.5** | F5 → F10, G5 → G8 | Physique réelle, préfabriqués, terrain ; MIDI, automation, enregistrement, musique adaptative |
| **v5.0** | H4 → H7 | Un jeu complet généré, testé et corrigé à partir d'une description |

Les jalons v3.x et v4.0 sont ceux de `ROADMAP-STUDIO.md` (phases A à C).

Taille estimée : E ≈ 5 %, F ≈ 35 %, G ≈ 30 %, H ≈ 30 %. F et G touchent des fichiers différents : ils peuvent avancer en parallèle (deux branches, deux sessions).

## Risques connus

- **Taille des jeux** : échantillons audio et modèles glTF en data URL font vite grossir le JSON. Surveiller dès G2 et F4 (avertissement à 10 Mo, compression, et plus tard ressources dans des fichiers à côté du JSON, ce qui changerait la règle « un jeu = un fichier » : à décider par l'humain).
- **IA locale** : beaucoup de petits modèles appellent mal les outils. Garder le mode plan JSON et valider chaque appel (mêmes contrôles que le MCP).
- **Coût et confidentialité** : avec l'API Claude, afficher le coût estimé, ne rien envoyer sans action de l'utilisateur, ne jamais mettre la clé dans le projet.
- **Rendu partagé éditeur / jeu (F0)** : c'est ce qui évite de revoir les bugs de la phase C (le jeu n'affichait pas ce que l'éditeur montrait). Ne pas y déroger.
- **Audio en arrière-plan et latence** : déjà rencontrés en phase B ; mesurer la latence à chaque tâche de G.
- **Sécurité** : l'IA écrit du code exécuté par `new Function`. Avant tout partage de jeux générés, exécuter le jeu dans une iframe isolée (voir `SECURITY.md`).
