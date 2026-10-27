# Generation de Ressources par l'IA (PixelForge Phase H - H4)

Ce document decrit le systeme de generation automatique de ressources de PixelForge Studio (`src/ai/generators.js`).
L'IA autonome et les outils du studio permettent de creer instantanement chaque type de ressource a partir d'une simple description textuelle en langage naturel, pret a l'emploi dans le jeu.

---

## 1. Vue d'ensemble

Le module `src/ai/generators.js` fournit des generateurs purs (sans dependance DOM ni Node) qui traduisent des intentions en langage naturel (francais ou anglais) en donnees de jeu valides selon le schema PixelForge :

1. **Sprites pixel art textuels** (`generateSpriteData`) : format ASCII Sweetie 16, dimensions compatibles tuiles (16x16 par defaut), avec frames multiples et animations nommees (`idle`, `walk`, `run`, `jump`).
2. **Musiques chiptune** (`generateSongData`) : partitions au format texte tracker ASCII ou DAW v2, avec detection automatique du BPM et harmonies adaptees au style demande (donjon, combat, aventure, village, victoire, defaite).
3. **Modeles 3D retro** (`generateModelData`) : tranches de voxels le long de l'axe Y (`slices`) ou selection intelligente de modeles low-poly animes de la bibliotheque CC0 (`cc0_adventurer`, `cc0_knight`, `cc0_crate`, `cc0_barrel`).
4. **Effets sonores sfxr** (`generateSoundData`) : deduction automatique du preset sfxr (`jump`, `coin`, `hit`, `powerup`, `explosion`, `laser`, `blip`, `portal`), ajustement fin de la hauteur (`pitch`), du volume et d'une graine deterministe (`seed`).

L'outil unifie `generate_asset` est directement accessible a l'agent IA (`AGENT_TOOLS`) et execute automatiquement l'operation appropriee dans le projet (`upsertSprite`, `upsertSong`, `upsertModel`/`importModel`, `addSound`).

---

## 2. Generateur de Sprites (`generateSpriteData`)

### 2.1 Format et Palette
Chaque frame est representee par un tableau de chaines de caracteres. Chaque caractere represente un pixel :
- `.` : pixel transparent.
- `0` a `f` : index dans la palette standard Sweetie 16 (0: noir bleute, 1: pourpre, 2: rouge, 3: orange/peau, 4: or/jaune, 5: vert clair, 6: vert fonce, 7: sarcelle, 8: bleu nuit, 9: bleu roi, a: bleu ciel, b: cyan, c: blanc, d: gris acier, e: ardoise, f: armure foncee).

### 2.2 Archetypes pris en charge
- **Chevalier / Aventurier / Guerrier** : casque a visiere, armure avec ceinture et bottes, animations completes :
  - `idle` : 2 frames (respiration verticale et posture).
  - `walk` / `run` : 4 frames (stride dynamique des jambes et balancement des bras).
  - `jump` : 2 frames (extension aerienne puis reception au sol).
- **Slime vert** : dome gelatineux avec yeux expressifs et reflets, animations `idle`, `walk`, `jump` avec ecrasement (squash) et etirement (stretch).
- **Chauve-souris** : corps sombre, yeux rougeoyants, ailes articulées avec animation de vol fluide (`fly`).
- **Squelette** : crane detaille, cage thoracique et membres osseux, animations de marche.
- **Piece d'or** : illusion de rotation 3D sur 4 frames (face pleine, vue trois-quarts, tranche fine, angle oppose).
- **Gemme / Cristal** : facettes colorees avec eclat et scintillement lumineux.
- **Cle doree** : flottement vertical et anneau ornemental.
- **Coeur / Vie** : pulsation rythmique de battement de coeur.
- **Coffre aux tresors** : bois sombre, armatures metalliques et brillance de serrure.
- **Boule de feu / Projectile** : coeur incandescent et trainees de flammes rotatives.
- **Plateforme / Herbe / Spikes** : tuiles de sol et pieges tranchants.
- **Generateur procedural de repli** : pour toute autre description, generation procedurale de formes harmonieuses symetriques respectant les couleurs demandees.

### 2.3 Exemple d'appel
```js
import { generateSpriteData } from './ai/generators.js';

const sprite = generateSpriteData('un chevalier en armure', { name: 'Hero' });
// sprite.width = 16, sprite.height = 16
// sprite.frames = [ [...], [...], ... ] (6 frames)
// sprite.animations = [ { name: 'idle', ... }, { name: 'walk', ... }, { name: 'jump', ... } ]
```

---

## 3. Generateur de Musique (`generateSongData`)

### 3.1 Analyse du style et extraction du BPM
L'analyseur detecte automatiquement la vitesse en BPM depuis la requete (ex: `90 BPM`, `145 bpm`, `tempo 120`). En l'absence de mention explicite, un tempo coherent est applique selon le style :
- **Donjon / Mystere / Inquietant** (defaut : 90 BPM) : gamme re mineur / dorienne / phrygienne, basse profonde en triangle, arpeges hypnotiques pulse25, percussions eparses et solennelles.
- **Combat / Boss / Epique** (defaut : 145 BPM) : gamme mi mineur pentatonique, basse continue en double-croches, theme heroic punchy, batterie complete (kick, snare, charleston).
- **Aventure / Plateforme / Plaine** (defaut : 124 BPM) : gamme do majeur / lydienne, walking bass rebondissante, theme enjoue et swing drums.
- **Calme / Village / Taverne** (defaut : 100 BPM) : gamme sol majeur pastorale, flute triangle chaleureuse, accords doux.
- **Victoire / Fanfare** (defaut : 130 BPM) : triade majeure ascendante, roulement de caisse claire et accord tenu.
- **Game Over / Defaite** (defaut : 75 BPM) : descente chromatique mineure lugubre a extinction lente.

### 3.2 Exemple d'appel
```js
import { generateSongData } from './ai/generators.js';

const song = generateSongData('theme de donjon inquietant, 90 BPM', { name: 'Dungeon' });
// song.bpm = 90
// song.style = 'dungeon'
// song.text = "NAME \"Dungeon\"\nBPM 90\nCHANNELS\n..."
```

---

## 4. Generateur de Modeles 3D (`generateModelData`)

### 4.1 Selection de Modeles CC0
Si la requete mentionne un personnage ou un objet couvert par le catalogue CC0 integre (`src/core/cc0-models.js`) :
- `aventurier` / `adventurer` -> `preset: 'cc0_adventurer'` (Quaternius, animations squelettiques idle et walk).
- `chevalier` / `knight` -> `preset: 'cc0_knight'` (Quaternius).
- `caisse` / `crate` -> `preset: 'cc0_crate'` (Kenney).
- `baril` / `barrel` -> `preset: 'cc0_barrel'` (Kenney).

### 4.2 Tranches Voxels Stylisees
Pour les elements de decor personnalises, le generateur produit des tranches voxels Y-up indexees en Sweetie 16 :
- `Coffre` (6x5x5 voxels) : fond solide, parois, serrure et couvercle voute.
- `Arbre` (6x8x6 voxels) : tronc robuste et cime touffue.
- `Torche` (2x6x2 voxels) : hampe en bois et flamme etincelante.
- `Totem` (4x8x4 voxels) : pierre gravee et yeux illuminés.
- `Pilier` (4x8x4 voxels) : socle elargi, colonne et chapiteau.

### 4.3 Exemple d'appel
```js
import { generateModelData } from './ai/generators.js';

const model = generateModelData('coffre aux tresors en bois', { name: 'Chest' });
// model.width = 6, model.height = 5, model.depth = 5
// model.slices = [ [ 'eeeeee', ... ], ... ] (5 tranches)
```

---

## 5. Generateur de Sons SFXR (`generateSoundData`)

### 5.1 Analyse Semantique
L'analyseur lexical identifie les intentions sonores :
- **Categorie** :
  - `jump` : mots-cles saut, jump, hop, bondir, rebond.
  - `coin` : mots-cles piece, coin, ding, or, tintement.
  - `hit` : mots-cles coup, hit, degat, choc, impact, blesse.
  - `explosion` : mots-cles explosion, boum, boom, bombe, fracas.
  - `laser` : mots-cles laser, tir, shoot, blaster, rayon.
  - `powerup` : mots-cles powerup, bonus, potion, magique, levelup.
  - `blip` : mots-cles blip, bip, clic, menu, bouton.
  - `portal` : mots-cles portail, teleport, warp, dimension.
- **Hauteur (Pitch)** :
  - Aigu / leger : mots-cles leger, aigu, petit, rapide, crisp (`pitch: 1.35`).
  - Grave / lourd : mots-cles lourd, grave, profond, puissant, massif (`pitch: 0.70`).
  - Standard : 1.00.
- **Volume** :
  - Doux / discret : 0.40.
  - Puissant / assourdissant / lourd : 0.90.
  - Standard : 0.65.

### 5.2 Exemple d'appel
```js
import { generateSoundData } from './ai/generators.js';

const sound = generateSoundData('un saut leger', { name: 'JumpLight' });
// sound.preset = 'jump'
// sound.pitch = 1.35
// sound.volume = 0.40
```

---

## 6. Utilisation par l'Agent IA

L'agent IA dispose du nouvel outil `generate_asset` :
```json
{
  "tool": "generate_asset",
  "args": {
    "type": "sprite",
    "name": "Slime",
    "description": "slime vert rebondissant"
  }
}
```

De plus, les outils standards `upsert_sprite`, `upsert_song`, `upsert_model` et `add_sound` prennent automatiquement le relais si seule une `description` est fournie par l'utilisateur ou l'assistant.
Toute modification reste strictement atomique et reversible via `store.update` et le bouton Annuler (Ctrl+Z).

---

## 7. Generation de Jeu Complet (Phase H - H5)

### 7.1 Vue d'ensemble

Le module `src/ai/game-generator.js` permet a l'agent autonome de concevoir et generer un jeu complet (2D ou 3D) d'une seule traite a partir d'une description naturelle (ex. « Fais-moi un jeu de plateforme avec 3 niveaux et un boss »).

Le processus suit un pipeline rigoureux en deux phases :
1. **Document de Conception de Jeu (GDD)** : synthese structuree incluant le titre, le pitch, les controles, les regles d'or de Game Feel, la progression en 3 niveaux (philosophie Kishotenketsu), les entites et l'ambiance sonore. Ce document est presente a l'utilisateur et modifiable.
2. **Construction et validation du projet** : assemblage ordonne de toutes les composantes (reglages, sprites/modeles, objets, scripts avec Game Feel, cartes/scenes, musiques et sons, HUD).
3. **Controle qualite** : le projet genere est valide sans aucune erreur (`validateProject`) avant d'etre retourne ou injecte dans le store.

### 7.2 Regles de Game Feel integrees

Les scripts de joueur generes embarquent nativement les principes de Game Feel de `src/ai/knowledge.js` :
- **Coyote Time (100 ms)** : autorise le saut meme apres avoir quitte le rebord d'une plateforme.
- **Jump Buffering (100 ms)** : memorise la touche de saut pressee juste avant de toucher le sol.
- **Saut a hauteur variable** : relacher le bouton reduit immediatement la velocite ascensionnelle pour un controle millimetre.
- **Ecrasement des ennemis (Stomp)** : atterrir au-dessus d'un ennemi le detruit et propulse le joueur vers le haut.
- **Transitions de niveaux et Boss** : portails de progression menant au niveau suivant, avec un boss a 3 points de vie au niveau 3 dont la defaite declenche la victoire.

### 7.3 Structure en 3 Niveaux (Kishotenketsu)

- **Niveau 1 (Introduction / Ki)** : decouverte des deplacements et sauts, plateforme securisee et collecte de pieces.
- **Niveau 2 (Developpement / Sho)** : defis de timing, ennemis en patrouille et plateformes suspendues.
- **Niveau 3 (Climax & Boss / Ten & Ketsu)** : arene de combat avec le Boss, patterns d'attaque sautants et portail de triomphe.

### 7.4 Utilisation via l'Agent IA

L'agent dispose de l'outil `generate_game` :
```json
{
  "tool": "generate_game",
  "args": {
    "description": "jeu de plateforme avec 3 niveaux et un boss",
    "dimension": "2d",
    "name": "Super Plateforme"
  }
}
```
L'outil retourne a la fois le Game Design Document au format Markdown et un resume detaille de tous les elements assembles dans le projet.

---

## 8. Playtest Headless et Autocorrection Autonome (Phase H - H6)

### 8.1 Vue d'ensemble

Le module `src/ai/playtester.js` garantit qu'aucun jeu généré n'est livré cassé ou injouable :
1. **Contrôle d'intégrité structurel** : exécution de `validateProject` (vérification des références d'objets, sons, musiques, calques, compilation des graphes Blueprint et syntaxe des scripts). 0 erreur exigé.
2. **Simulation headless sans écran (2D et 3D)** :
   - *Sécurité du point de départ* : vérifie que le joueur n'apparaît ni dans un mur solide (`player_in_wall`), ni au-dessus d'un abîme sans fond sans sol sous ses pieds (`player_in_pit`).
   - *Accessibilité physique par recherche de chemin BFS (Platformer Reachability)* : calcule les trajectoires de saut (gravité, impulsion, portée horizontale) et vérifie via parcours en largeur (BFS) sur les plateformes si la sortie ou le portail est physiquement atteignable depuis le point de départ (`unreachable_exit`).
   - *Exécution en bac à sable* : instancie les scripts dans un bac à sable isolé simulant les gestionnaires `create` et `update` pour intercepter les exceptions d'exécution (`script_runtime_error`).
3. **Autocorrection ciblée (`autoFixGame`)** :
   - Ajout automatique de plateformes relais solides en cas de fossé trop large ou de dénivelé excessif.
   - Consolidation du sol sous les sorties ou sous le point de réapparition du joueur.
   - Dégagement des cases d'apparition en cas d'enfermement dans un mur.
   - Sécurisation des scripts défaillants.
4. **Boucle autonome (`runPlaytestAndFix`)** :
   - Exécute jusqu'à 3 tours de playtest et correction jusqu'à ce que le jeu soit 100% validé et jouable.
   - Intégrée nativement dans `generateFullGame` et disponible sous l'outil agent `playtest_game`.

### 8.2 Utilisation via l'Agent IA

L'agent dispose de l'outil `playtest_game` :
```json
{
  "tool": "playtest_game",
  "args": {
    "autoFix": true
  }
}
```
L'outil retourne un diagnostic détaillé des contrôles effectués et des réparations appliquées automatiquement.


