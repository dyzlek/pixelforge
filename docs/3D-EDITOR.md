# Conception du Nouvel Editeur et Pipeline 3D PixelForge (Phase F)

Ce document formalise la conception architecturale, le schema de donnees et le pipeline de rendu unifie pour la refonte professionnelle de l'editeur 3D de PixelForge Studio (Issues #69 a #79).

---

## 1. Contexte et Objectifs

### 1.1 Constat de la Phase C
Lors de l'implementation initiale de la 3D (Phase C), des divergences sont apparues entre :
- Les structures de donnees utilisees par l'editeur visuel, les outils MCP et le runtime de jeu.
- Le rendu de la scene dans l'editeur (Three.js standard dans le DOM) et le rendu dans le jeu (`src/runtime3d/engine3d.js` avec shader retro).
- L'absence de hierarchie de noeuds (la scene 3D etait limitee a une grille de blocs et une liste plate d'entites sans possibilite de selectionner ni deplacer les objets poses).

### 1.2 Objectifs de la Phase F
1. **Un seul code de rendu** : `src/runtime3d/render.js` partage a 100% entre le jeu et l'editeur 3D, garantissant un rendu identique pixel pour pixel.
2. **Arbre de scene hierarchique** : structure en arbre de noeuds (`nodes[]`) manipulable dans l'arbre de ressources et l'inspecteur, avec support des materiaux, lumieres et prefabs.
3. **Maniabilite professionnelle facon Godot 4** : navigation fluide (orbite, vol libre ZQSD, touches de vue numeriques), gizmos 3D (`TransformControls`), aimantation et multi-selection.
4. **Physique double mode** : conservation du moteur AABB retro pur JS (`simple`) et integration de Rapier 3D (`rapier`, Decision V2) pour les simulations complexes.
5. **Retrocompatibilite totale** : conversion transparente des scènes existantes par `normalizeProject` sans casser les jeux existants (`cube-runner`, `test-3d`).

---

## 2. Architecture du Rendu Unifie (src/runtime3d/render.js)

### 2.1 Contraintes d'architecture
- **Zero import externe** : `src/runtime3d/render.js` ne contient aucun `import` ES afin d'etre inlinable directement dans les exports HTML autonomes via `?raw`.
- **Injection des dependances** : Three.js est passe en parametre d'initialisation (`window.THREE` ou instance passee a la factory).

### 2.2 Interface de createScene3DRenderer
```javascript
export function createScene3DRenderer({
  THREE,
  canvas,
  width,
  height,
  pixelRatio = 1,
  retroResolution = { width: 320, height: 180 },
  enablePostProcessing = true,
  isEditor = false,
}) { ... }
```

### 2.3 Responsabilites du renderer unifie
1. **Initialisation de la scene et camera** :
   - Creation de la `THREE.Scene`.
   - Creation de la camera perspective (defaut FOV 60) ou orthographique (mode isometrique/editeur).
2. **Pipeline retro double passe** :
   - **Passe 1 (Off-screen)** : Rendu de la scene dans une `THREE.WebGLRenderTarget` a resolution retro native (ex: 320x180 ou 480x270).
   - **Passe 2 (Upscale Nearest)** : Affichage du tampon basse resolution sur le canvas principal avec filtre `THREE.NearestFilter` (aucun flou bilineaire) et shader optionnel de vertex snapping facon PS1.
3. **Gestion des materiaux et maillages** :
   - Application systematique du filtre `NearestFilter` sur toutes les textures pixel art.
   - Generation des maillages voxel par Greedy Meshing.
   - Chargement et instanciation des modeles glTF 2.0.
4. **Gestion de l'eclairage et de l'ambiance** :
   - Lumiere ambiante globale (`ambientLight`).
   - Lumiere directionnelle avec ombres portees optionnelles (`directionalLight`).
   - Jusqu'a 4 lumieres ponctuelles dynamiques (`pointLight`).
   - Brouillard exponentiel ou lineaire (`fog`).
   - Ciel uni ou degrade de couleur (`skyColor`, `horizonColor`).
5. **Couche d'outillage pour l'editeur** (`isEditor: true`) :
   - Grille infinie au sol (`GridHelper`).
   - Boites de selection et surbrillance d'objets (`Outline / Wireframe`).
   - Gizmos de manipulation (`TransformControls`).
   - Visualiseurs de lumieres et de cameras (`CameraHelper`, `DirectionalLightHelper`).

---

## 3. Modele de Donnees du Projet (JSON Schema)

### 3.1 Structure d'une Scene 3D (`scenes3d[]`)
Chaque scene 3D est decrite par un objet contenant son environnement, sa grille de blocs voxel et son arbre de noeuds :

```json
{
  "id": "scene_level1",
  "name": "Niveau 1",
  "environment": {
    "skyColor": "#1a1c2c",
    "horizonColor": "#29366f",
    "ambientLight": { "color": "#ffffff", "intensity": 0.6 },
    "directionalLight": {
      "color": "#ffeedd",
      "intensity": 1.0,
      "position": [15, 25, 20],
      "shadows": true
    },
    "fog": {
      "enabled": true,
      "color": "#1a1c2c",
      "near": 10,
      "far": 60
    }
  },
  "gridmap": {
    "blockSize": 1,
    "blocks": {
      "0,0,0": 1,
      "1,0,0": 1,
      "0,1,0": 2
    }
  },
  "nodes": [
    {
      "id": "node_player_1",
      "name": "Player",
      "kind": "mesh",
      "parent": null,
      "position": [0, 1, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "visible": true,
      "locked": false,
      "objectId": "obj_player",
      "props": { "hp": 3 }
    },
    {
      "id": "node_lamp_1",
      "name": "Lampe",
      "kind": "light",
      "parent": null,
      "position": [4, 3, 2],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "visible": true,
      "locked": false,
      "light": {
        "type": "point",
        "color": "#ffcd75",
        "intensity": 2.5,
        "distance": 8
      }
    }
  ]
}
```

### 3.2 Types de Noeuds (`kind`)
| Type | Description | Donnees specifiques |
|---|---|---|
| `mesh` | Instance d'un objet template (`objects[]`) ou maillage direct | `objectId`, `materialId` |
| `light` | Source lumineuse ponctuelle ou projecteur | `light: { type: 'point'\|'spot', color, intensity, distance, angle }` |
| `camera` | Camera personnalisee de vue ou cinematique | `camera: { fov, near, far, mode }` |
| `collision` | Volume de collision invisible specifique | `shape: { type: 'box'\|'sphere'\|'capsule', size }` |
| `audio` | Source audio positionnelle 3D | `soundId`, `maxDistance`, `volume` |
| `prefab` | Instance de scene imbriquee (prefab) | `prefabId`, `overrides` |
| `empty` | Noeud conteneur pour regrouper des sous-elements | aucun |

### 3.3 Materiaux (`materials[]`)
Le projet dispose d'une collection globale de materiaux :
```json
{
  "id": "mat_brick",
  "name": "Brique Retro",
  "type": "standard",
  "color": "#b13e53",
  "roughness": 0.8,
  "metalness": 0.1,
  "textureSpriteId": "spr_brick_texture",
  "emissive": "#000000",
  "transparent": false,
  "opacity": 1.0,
  "doubleSided": false
}
```

---

## 4. Migration et Retrocompatibilite (normalizeProject)

Pour preserver tous les jeux crees sous la Phase C (`cube-runner`, `test-3d`, tests e2e), `src/core/project.js` implemente la regle suivante :

1. Si une scene 3D possede `entities[]` mais pas de tableau `nodes[]` :
   - Chaque element `{ id, objectId, x, y, z, rotationX, rotationY, rotationZ, props }` est automatiquement converti en noeud :
     ```javascript
     {
       id: entity.id,
       name: object?.name || `Entity_${entity.id}`,
       kind: 'mesh',
       parent: null,
       position: [entity.x || 0, entity.y || 0, entity.z || 0],
       rotation: [entity.rotationX || 0, entity.rotationY || 0, entity.rotationZ || 0],
       scale: [1, 1, 1],
       visible: true,
       locked: false,
       objectId: entity.objectId,
       props: entity.props || {}
     }
     ```
2. La cle `gridmap` existante est conservee telle quelle sans alteration.
3. Les outils MCP et d'export continuent d'accepter les deux formats avec equivalence semantique.

---

## 5. Moteur Physique : Simple AABB vs Rapier 3D (Decision V2)

Le parametre `settings.physics3d` definit le moteur de simulation :

### 5.1 Mode Simple (`simple`, defaut)
- **Principe** : Moteur purement JavaScript integre a `src/runtime3d/engine3d.js` (zero import, zero WASM).
- **Collisions** : Boites alignees sur les axes (AABB) et cylindres/capsules verticaux.
- **Fusion GridMap** : Fusion des blocs voxels adjacents en colliders rectangulaires optimises.
- **Usage** : Plateforme retro, vitesse d'execution maximale, taille d'export minimale (moins de 100 Ko hors Three.js).

### 5.2 Mode Rapier (`rapier`, avance)
- **Principe** : Moteur physique complet `@dimforge/rapier3d-compat` (WASM).
- **Fonctionnalites** :
  - Corps rigides dynamiques, cinematiques et statiques avec rotation inertielle sur tous les axes.
  - Formes de collision complexes : coques convexes (convex hull) et maillages triangulaires (trimesh).
  - Articulations et contraintes physiques (joints, ressorts, charnieres).
  - Raycasts continus avec retour de normale d'impact et materiau physique (friction, restitution).
- **Integration** : Charge dynamiquement via le CDN pour l'export HTML autonome et via npm dans le studio.

---

## 6. Maniabilite et Navigation facon Godot 4 dans l'Editeur 3D

L'editeur 3D (`src/editors/scene3d/index.js`) propose les memes controles que les moteurs de jeu professionnels :

### 6.1 Controles de la camera de vue
- **Orbite** : Clic droit maintenu + deplacement souris.
- **Panoramique (Pan)** : Clic molette maintenu (ou Maj + Clic droit).
- **Zoom** : Molette de la souris.
- **Mode Vol Libre (Fly mode)** :
  - Maintien du clic droit enfonce.
  - Deplacement : `Z` / `W` (avancer), `S` (reculer), `Q` / `A` (gauche), `D` (droite).
  - Elevation : `E` (monter), `A` / `Q` (descendre).
  - Vitesse : maintien de `Maj` pour accelerer x3.
- **Centrage sur la selection (Focus)** : Touche `F`.
- **Vues orthogonales directes** :
  - `Pave 1` : Vue de face.
  - `Pave 3` : Vue de cote (profil droit).
  - `Pave 7` : Vue de dessus.
  - `Pave 5` : Bascule Perspective / Orthographique.

### 6.2 Gizmos de transformation et Aimantation
- **Outils de transformation** :
  - `W` : Deplacement (Translate).
  - `E` : Rotation.
  - `R` : Echelle (Scale).
- **Repere** : Bascule Repere Local / Repere Monde via la touche `L`.
- **Aimantation (Snapping)** :
  - Pas reglable : 0.25 m, 0.5 m, 1 m, 2 m.
  - Touche `Ctrl` pour suspendre temporairement l'aimantation.
- **Multi-selection** :
  - `Maj` + Clic pour ajouter/retirer un objet de la selection.
  - Cadre de selection rectangulaire par glisser-deposer dans le vide.
- **Duplication rapide** : `Ctrl + D` duplique les noeuds selectionnes et place le gizmo sur la copie.

---

## 7. Modeles glTF 2.0 et Animations

### 7.1 Format et stockage
- Fichiers `.gltf` ou `.glb` importes via glisser-deposer ou bouton dans le gestionnaire de ressources.
- Stockage sous forme de Data URL base64 dans `project.models[]` avec `type: 'gltf'`.
- Verification de taille : avertissement dans l'interface au-dela de 2 Mo pour preserver la reactivite du fichier JSON.

### 7.2 Rendu et animations squelettiques
- Chargement via `THREE.GLTFLoader`.
- Extraction des clips d'animation (`THREE.AnimationClip`).
- Pilotage direct depuis les scripts et Blueprints :
  - `self.play('idle')`, `self.play('walk')`, `self.play('jump')`.
  - Interpolation fluide (cross-fade) automatique de 150 ms entre les animations.
- Attribution de materiaux personnalises pour styliser les modeles low-poly en flat-shading ou toon-shading retro.

---

## 8. Plan de Deploiement par Issue

1. **F0 (Issue #69)** : Document de conception `docs/3D-EDITOR.md` (ce document).
2. **F1 (Issue #70)** : Schema `scene.nodes[]`, migration `normalizeProject`, arbre de scene et inspecteur 3D.
3. **F2 (Issue #71)** : Selection 3D, gizmos de transformation (`TransformControls`), aimantation et multi-selection.
4. **F3 (Issue #72)** : Navigation de la vue 3D facon Godot (orbite, vol libre ZQSD, raccourcis pave numerique, focus F).
5. **F4 (Issue #73)** : Modeles glTF animes (`AnimationMixer`), collection `materials[]` et modeles CC0 integres.
6. **F5-F10 (Issues #74-#79)** : Lumieres et ambiance editables, Rapier 3D, prefabs imbriques, terrain sculptable.
