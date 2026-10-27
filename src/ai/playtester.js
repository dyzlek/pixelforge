/**
 * PixelForge Studio — Playtester headless et moteur d'autocorrection autonome
 * Phase H - H6 : l'IA teste le jeu sans ecran et corrige seule les niveaux impossibles
 * ou scripts defaillants jusqu'a 3 tours de correction.
 *
 * Module pur : zero dependance DOM, zero dependance Node.
 */

import { validateProject } from '../core/ops/validate.js';

/**
 * Verifie la validite et la jouabilite complete d'un projet PixelForge (2D ou 3D).
 * Analyse :
 * 1. Validation de schema, liens, noms et sons (validateProject).
 * 2. Presence et positionnement securise du joueur (pas dans un mur, pas au-dessus du vide).
 * 3. Accessibilite physique de la sortie / portail (recherche de chemin BFS platformer).
 * 4. Execution des scripts en bac a sable sans exceptions ni plantages.
 *
 * @param {object} project - Projet PixelForge a tester
 * @param {object} [options] - Options de simulation
 * @returns {{ ok: boolean, issues: Array<object>, stats: object }}
 */
export function playtestGame(project, options = {}) {
  const issues = [];
  const stats = {
    mapsChecked: 0,
    scenes3dChecked: 0,
    scriptsChecked: 0,
    entitiesChecked: 0,
  };

  if (!project || typeof project !== 'object') {
    return {
      ok: false,
      issues: [{ type: 'invalid_project', message: 'Projet null ou non defini' }],
      stats,
    };
  }

  // 1. Validation structurelle
  const valIssues = validateProject(project);
  for (const v of valIssues) {
    if (v.level === 'error') {
      issues.push({
        type: 'validation_error',
        where: v.where,
        message: v.message,
      });
    }
  }

  // 2. Execution securisee des scripts dans un bac a sable
  const objects = project.objects || [];
  for (const obj of objects) {
    const code = obj.script?.code;
    if (code && typeof code === 'string' && code.trim()) {
      stats.scriptsChecked++;
      const scriptErr = testScriptSandbox(code, obj.name);
      if (scriptErr) {
        issues.push(scriptErr);
      }
    }
  }

  const dimension = project.settings?.dimension || '2d';

  if (dimension === '3d') {
    // 3. Simulation 3D
    test3DProject(project, issues, stats, options);
  } else {
    // 4. Simulation 2D
    test2DProject(project, issues, stats, options);
  }

  return {
    ok: issues.length === 0,
    issues,
    stats,
  };
}

/**
 * Execute un script dans un bac a sable isole pour detecter les exceptions au demarrage et a l'update.
 */
function testScriptSandbox(code, objectName) {
  try {
    const fn = new Function('self', 'game', 'input', 'on', code);
    const handlers = {};
    const on = (evt, a, b) => {
      const key = typeof a === 'function' ? evt : `${evt}:${a}`;
      const handler = typeof a === 'function' ? a : b;
      handlers[key] = handler;
    };

    const mockSelf = {
      x: 32, y: 32, vx: 0, vy: 0, width: 16, height: 16,
      flipX: false, flipY: false, onGround: true, depth: 50,
      scale: 1, centerX: 40, centerY: 40, angle: 0, visible: true, alpha: 1,
      vars: {}, props: {},
      play: () => {}, destroy: () => {}, jump: () => {},
      setCollideMap: () => {}, setCollideObjects: () => {}, setHitbox: () => {},
      addFilter: () => {}, clearFilters: () => {}, setTintMode: () => {},
      setPosition: () => {}, setVelocity: () => {},
      moveForward: () => {}, moveRight: () => {}, rotateY: () => {}, lookAt: () => {},
    };

    const mockGame = {
      score: 0,
      vars: {},
      mapWidth: 640,
      mapHeight: 480,
      spawn: () => mockSelf,
      find: () => mockSelf,
      findAll: () => [mockSelf],
      goToMap: () => {},
      restart: () => {},
      setText: () => {},
      playSound: () => {},
      setSongLayer: () => {},
      camera: {
        follow: () => {},
        setMode: () => {},
        addFilter: () => {},
        clearFilters: () => {},
        shake: () => {},
      },
      raycast: () => null,
      random: (min, max) => (min !== undefined ? min : 0),
    };

    const mockInput = {
      isDown: () => false,
      justPressed: () => false,
      justReleased: () => false,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      requestPointerLock: () => {},
    };

    fn(mockSelf, mockGame, mockInput, on);

    if (handlers.create) handlers.create();
    if (handlers.update) handlers.update(0.016);
    return null;
  } catch (err) {
    return {
      type: 'script_runtime_error',
      objectName,
      message: err.message || String(err),
      stack: err.stack,
    };
  }
}

/**
 * Teste la jouabilite 2D de toutes les cartes du projet.
 */
function test2DProject(project, issues, stats, options) {
  const maps = project.maps || [];
  const startMapId = project.settings?.startMapId || maps[0]?.id;
  const tileSize = project.settings?.tileSize || 16;
  const gravity = project.settings?.gravity ?? 500;

  for (const map of maps) {
    stats.mapsChecked++;
    const isStartMap = map.id === startMapId;
    test2DMap(project, map, isStartMap, tileSize, gravity, issues, stats, options);
  }
}

/**
 * Analyse une carte 2D specifique (spawns, collision et accessibilite BFS).
 */
function test2DMap(project, map, isStartMap, tileSize, gravity, issues, stats, options) {
  const entities = map.entities || [];
  stats.entitiesChecked += entities.length;

  const objectsById = new Map((project.objects || []).map((o) => [o.id, o]));
  const objectsByName = new Map((project.objects || []).map((o) => [o.name, o]));

  // Trouver le joueur
  const playerEntity = entities.find((e) => {
    const obj = objectsById.get(e.objectId);
    return obj && /player|joueur|hero|adventurer/i.test(obj.name);
  });

  if (!playerEntity) {
    if (isStartMap) {
      issues.push({
        type: 'missing_player',
        mapId: map.id,
        mapName: map.name,
        message: `La carte de depart "${map.name}" ne contient aucune entite Joueur.`,
      });
    }
    return;
  }

  // Grille de collision
  const collisionLayer = (map.layers || []).find((l) => l.collides) || map.layers?.[0];
  if (!collisionLayer) {
    issues.push({
      type: 'missing_collision_layer',
      mapId: map.id,
      mapName: map.name,
      message: `La carte "${map.name}" n'a aucun calque de collision actif.`,
    });
    return;
  }

  const width = map.width;
  const height = map.height;
  const data = collisionLayer.data || [];

  const isSolid = (c, r) => {
    if (c < 0 || c >= width) return true; // Murs lateraux infranchissables
    if (r < 0) return false;              // Ciel ouvert
    if (r >= height) return false;        // Fosse / abime sans fond
    const idx = r * width + c;
    return data[idx] >= 0;
  };

  const pCol = Math.floor(playerEntity.x / tileSize);
  const pRow = Math.floor(playerEntity.y / tileSize);

  // Verification 1 : Joueur dans un mur solide
  if (isSolid(pCol, pRow)) {
    issues.push({
      type: 'player_in_wall',
      mapId: map.id,
      mapName: map.name,
      entityId: playerEntity.id,
      col: pCol,
      row: pRow,
      message: `Le joueur sur la carte "${map.name}" apparait a l'interieur d'un mur solide (colonne ${pCol}, ligne ${pRow}).`,
    });
  }

  // Verification 2 : Joueur au-dessus d'un abime sans fond (aucune terre ferme sous lui)
  let hasGroundUnder = false;
  for (let r = pRow + 1; r < height; r++) {
    if (isSolid(pCol, r)) {
      hasGroundUnder = true;
      break;
    }
  }
  if (!hasGroundUnder && !isSolid(pCol, pRow)) {
    issues.push({
      type: 'player_in_pit',
      mapId: map.id,
      mapName: map.name,
      entityId: playerEntity.id,
      col: pCol,
      row: pRow,
      message: `Le joueur sur la carte "${map.name}" apparait au-dessus du vide sans sol sous ses pieds.`,
    });
  }

  // Trouver les cibles (portails, sorties, boss)
  const exitEntities = entities.filter((e) => {
    const obj = objectsById.get(e.objectId);
    if (!obj) return false;
    const name = obj.name.toLowerCase();
    const hasExitScript = obj.script?.code && /goToMap|victoire|win/i.test(obj.script.code);
    return /portal|portail|exit|sortie|flag|drapeau|door|porte|boss/i.test(name) || hasExitScript;
  });

  if (exitEntities.length === 0) {
    // Si la carte n'est pas la derniere, il faut une sortie
    const isLastMap = project.maps[project.maps.length - 1]?.id === map.id;
    if (!isLastMap) {
      issues.push({
        type: 'missing_exit',
        mapId: map.id,
        mapName: map.name,
        message: `La carte "${map.name}" ne possede aucun portail ou point de sortie menant au niveau suivant.`,
      });
    }
    return;
  }

  // Verification 3 : Accessibilite physique BFS de la sortie
  for (const exit of exitEntities) {
    const exitCol = Math.floor(exit.x / tileSize);
    const exitRow = Math.floor(exit.y / tileSize);

    const reachResult = checkPlatformerReachability({
      width,
      height,
      tileSize,
      gravity,
      isSolid,
      startCol: pCol,
      startRow: pRow,
      targetCol: exitCol,
      targetRow: exitRow,
    });

    if (!reachResult.reachable) {
      const exitObj = objectsById.get(exit.objectId);
      issues.push({
        type: 'unreachable_exit',
        mapId: map.id,
        mapName: map.name,
        layerId: collisionLayer.id,
        exitId: exit.id,
        exitName: exitObj ? exitObj.name : 'Exit',
        playerPos: { col: pCol, row: pRow, x: playerEntity.x, y: playerEntity.y },
        exitPos: { col: exitCol, row: exitRow, x: exit.x, y: exit.y },
        closestReachable: reachResult.closestReachable,
        gapCol: exitCol - reachResult.closestReachable.col,
        gapRow: exitRow - reachResult.closestReachable.row,
        message: `La sortie "${exitObj ? exitObj.name : 'Exit'}" sur la carte "${map.name}" est inatteignable depuis le point de depart (fosse trop large de ${Math.abs(exitCol - reachResult.closestReachable.col)} tuiles ou mur infranchissable).`,
      });
    }
  }
}

/**
 * Algorithme de recherche de chemin physique platformer (BFS sur plateformes standables).
 */
function checkPlatformerReachability({
  width,
  height,
  tileSize,
  gravity,
  isSolid,
  startCol,
  startRow,
  targetCol,
  targetRow,
}) {
  // Une cellule (c, r) est standable si elle est libre et repose sur un bloc solide
  const isStandable = (c, r) => {
    if (c < 0 || c >= width || r < 0 || r >= height) return false;
    if (isSolid(c, r)) return false;             // Les pieds doivent etre dans l'air
    if (r - 1 >= 0 && isSolid(c, r - 1)) return false; // La tete doit avoir du degagement
    return isSolid(c, r + 1);                    // Le sol dessous doit etre solide
  };

  // Trouver le point standable de depart
  let startC = startCol;
  let startR = startRow;
  if (!isStandable(startC, startR)) {
    // Si le joueur commence en l'air, descendre jusqu'au sol
    for (let r = startRow; r < height; r++) {
      if (isStandable(startCol, r)) {
        startR = r;
        break;
      }
    }
  }

  // Capacite de saut physique
  const vJump = 290;
  const vWalk = 90;
  // Hauteur max de saut en tuiles
  const maxJumpHeightTiles = Math.floor((vJump * vJump) / (2 * Math.max(100, gravity) * tileSize)) + 1; // ~5 tuiles
  // Portee horizontale max en tuiles
  const airTime = (2 * vJump) / Math.max(100, gravity);
  const maxJumpSpanTiles = Math.floor((vWalk * airTime) / tileSize) + 2; // ~6-7 tuiles
  const maxSafeFallTiles = 12; // Descente controlee maximale

  const visited = new Set();
  const queue = [];

  const key = (c, r) => `${c},${r}`;

  if (isStandable(startC, startR)) {
    visited.add(key(startC, startR));
    queue.push({ col: startC, row: startR });
  }

  let closestReachable = { col: startC, row: startR, dist: 999999 };

  while (queue.length > 0) {
    const cur = queue.shift();
    const d = Math.hypot(cur.col - targetCol, cur.row - targetRow);
    if (d < closestReachable.dist) {
      closestReachable = { col: cur.col, row: cur.row, dist: d };
    }

    // Victoire : cible atteinte ou voisine immediate (a moins de 1.5 tuiles)
    if (Math.abs(cur.col - targetCol) <= 1 && Math.abs(cur.row - targetRow) <= 2) {
      return { reachable: true, closestReachable: cur };
    }

    // 1. Deplacement horizontal au sol (marche)
    for (const dc of [-1, 1]) {
      const nc = cur.col + dc;
      const nr = cur.row;
      if (isStandable(nc, nr)) {
        const k = key(nc, nr);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push({ col: nc, row: nr });
        }
      } else if (!isSolid(nc, nr) && (!isSolid(nc, nr - 1) || nr - 1 < 0)) {
        // 2. Chute depuis un rebord de plateforme
        for (let fallR = nr + 1; fallR < Math.min(height, nr + maxSafeFallTiles); fallR++) {
          if (isSolid(nc, fallR)) {
            // Impact au sol : la case au-dessus (fallR - 1) est-elle standable ?
            const landR = fallR - 1;
            if (isStandable(nc, landR)) {
              const k = key(nc, landR);
              if (!visited.has(k)) {
                visited.add(k);
                queue.push({ col: nc, row: landR });
              }
            }
            break;
          }
        }
      }
    }

    // 3. Sauts en cloche (arcs vers d'autres plateformes)
    for (let dc = -maxJumpSpanTiles; dc <= maxJumpSpanTiles; dc++) {
      if (dc === 0) continue;
      for (let dr = -maxJumpHeightTiles; dr <= maxSafeFallTiles; dr++) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc < 0 || nc >= width || nr < 0 || nr >= height) continue;

        if (isStandable(nc, nr)) {
          const k = key(nc, nr);
          if (!visited.has(k)) {
            // Verifier que l'arc de saut n'est pas coupe par un mur solide vertical
            const midC = Math.round((cur.col + nc) / 2);
            const peakR = Math.min(cur.row, nr) - Math.max(1, Math.floor(maxJumpHeightTiles / 2));
            if (!isSolid(midC, Math.max(0, peakR))) {
              visited.add(k);
              queue.push({ col: nc, row: nr });
            }
          }
        }
      }
    }
  }

  // Verifier si la cible touche un bloc standable atteint
  return {
    reachable: false,
    closestReachable,
  };
}

/**
 * Teste la jouabilite 3D (scenes, voxels et entites).
 */
function test3DProject(project, issues, stats, options) {
  const scenes = project.scenes3d || [];
  const startSceneId = project.settings?.startScene3DId || scenes[0]?.id;

  for (const scene of scenes) {
    stats.scenes3dChecked++;
    const isStart = scene.id === startSceneId;
    const entities = scene.entities || [];
    stats.entitiesChecked += entities.length;

    const objectsById = new Map((project.objects || []).map((o) => [o.id, o]));

    // Trouver le joueur 3D
    const playerEntity = entities.find((e) => {
      const obj = objectsById.get(e.objectId);
      return obj && /player|joueur|hero|adventurer/i.test(obj.name);
    });

    if (!playerEntity && isStart) {
      issues.push({
        type: 'missing_player',
        sceneId: scene.id,
        sceneName: scene.name,
        message: `La scene 3D de depart "${scene.name}" ne contient aucune entite Joueur.`,
      });
    }

    // Trouver la cible (portail, boss, etoile)
    const exitEntity = entities.find((e) => {
      const obj = objectsById.get(e.objectId);
      return obj && /portal|portail|exit|sortie|boss|star/i.test(obj.name);
    });

    const isLastScene = scenes[scenes.length - 1]?.id === scene.id;
    if (!exitEntity && !isLastScene) {
      issues.push({
        type: 'missing_exit',
        sceneId: scene.id,
        sceneName: scene.name,
        message: `La scene 3D "${scene.name}" ne possede aucun portail ou point de sortie.`,
      });
    }
  }
}

/**
 * Corrige automatiquement les problemes detectes lors du playtest.
 *
 * @param {object} project - Projet a corriger
 * @param {Array<object>} issues - Liste des anomalies detectees
 * @param {object} [options]
 * @returns {{ project: object, repairsApplied: Array<object> }}
 */
export function autoFixGame(project, issues, options = {}) {
  const p = JSON.parse(JSON.stringify(project));
  const repairsApplied = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'unreachable_exit': {
        const map = (p.maps || []).find((m) => m.id === issue.mapId);
        if (!map) break;

        const layer = (map.layers || []).find((l) => l.collides) || map.layers?.[0];
        if (!layer) break;

        const data = layer.data;
        const width = map.width;
        const height = map.height;
        const c1 = issue.closestReachable?.col ?? 0;
        const r1 = issue.closestReachable?.row ?? 8;
        const c2 = issue.exitPos.col;
        const r2 = issue.exitPos.row;

        // Determiner la tuile de sol utilisee
        let groundTile = 1;
        for (const t of data) {
          if (t >= 0) { groundTile = t; break; }
        }

        // Cas 1 : Fosse ou ecart horizontal trop large -> Ajout de plateformes relais
        const distC = c2 - c1;
        if (Math.abs(distC) > 4) {
          const stepSize = distC > 0 ? 4 : -4;
          let currentC = c1 + stepSize;

          while ((distC > 0 && currentC < c2) || (distC < 0 && currentC > c2)) {
            // Interpoler la hauteur Y de la plateforme relais
            const ratio = (currentC - c1) / distC;
            const targetR = Math.min(height - 2, Math.max(2, Math.round(r1 + (r2 - r1) * ratio)));

            // Peindre une plateforme solide de 2 tuiles de large
            for (let dc = 0; dc <= 1; dc++) {
              const col = currentC + dc;
              if (col >= 0 && col < width) {
                // Placer le bloc solide au niveau targetR + 1
                data[(targetR + 1) * width + col] = groundTile;
                // Liberer 2 blocs d'air au-dessus
                if (targetR >= 0) data[targetR * width + col] = -1;
                if (targetR - 1 >= 0) data[(targetR - 1) * width + col] = -1;
              }
            }

            repairsApplied.push({
              type: 'added_stepping_platform',
              map: map.name,
              col: currentC,
              row: targetR + 1,
              message: `Plateforme relais placee a la colonne ${currentC}, ligne ${targetR + 1} sur "${map.name}".`,
            });

            currentC += stepSize;
          }
        }

        // Cas 2 : La sortie flotte dans le vide sans sol solide dessous
        if (r2 + 1 < height) {
          for (let dc = -1; dc <= 1; dc++) {
            const col = c2 + dc;
            if (col >= 0 && col < width) {
              data[(r2 + 1) * width + col] = groundTile;
              data[r2 * width + col] = -1;
            }
          }
          repairsApplied.push({
            type: 'secured_exit_floor',
            map: map.name,
            col: c2,
            row: r2 + 1,
            message: `Sol consolide sous la sortie a la colonne ${c2} sur "${map.name}".`,
          });
        }
        break;
      }

      case 'player_in_wall': {
        const map = (p.maps || []).find((m) => m.id === issue.mapId);
        if (!map) break;
        const layer = (map.layers || []).find((l) => l.collides) || map.layers?.[0];
        if (!layer) break;

        const data = layer.data;
        const width = map.width;
        const c = issue.col;
        const r = issue.row;

        // Liberer l'espace ou apparait le joueur et la case du dessus
        if (r >= 0 && r < map.height) data[r * width + c] = -1;
        if (r - 1 >= 0) data[(r - 1) * width + c] = -1;
        // S'assurer qu'un bloc solide est present en dessous pour reposer dessus
        let groundTile = 1;
        for (const t of data) { if (t >= 0) { groundTile = t; break; } }
        if (r + 1 < map.height) data[(r + 1) * width + c] = groundTile;

        repairsApplied.push({
          type: 'cleared_player_spawn',
          map: map.name,
          col: c,
          row: r,
          message: `Espace libere pour l'apparition du joueur sur "${map.name}".`,
        });
        break;
      }

      case 'player_in_pit': {
        const map = (p.maps || []).find((m) => m.id === issue.mapId);
        if (!map) break;
        const layer = (map.layers || []).find((l) => l.collides) || map.layers?.[0];
        if (!layer) break;

        const data = layer.data;
        const width = map.width;
        const c = issue.col;
        const r = issue.row;

        let groundTile = 1;
        for (const t of data) { if (t >= 0) { groundTile = t; break; } }

        // Peindre 3 blocs solides sous les pieds du joueur
        for (let dc = -1; dc <= 1; dc++) {
          const col = c + dc;
          if (col >= 0 && col < width && r + 1 < map.height) {
            data[(r + 1) * width + col] = groundTile;
            data[r * width + col] = -1;
          }
        }

        repairsApplied.push({
          type: 'created_ground_under_player',
          map: map.name,
          col: c,
          row: r + 1,
          message: `Sol d'atterrissage cree sous le joueur a la colonne ${c} sur "${map.name}".`,
        });
        break;
      }

      case 'missing_player': {
        if (p.dimension === '3d' || p.settings?.dimension === '3d') {
          const scene = (p.scenes3d || []).find((s) => s.id === issue.sceneId) || p.scenes3d?.[0];
          if (scene) {
            let playerObj = (p.objects || []).find((o) => /player|joueur|hero/i.test(o.name));
            if (!playerObj) {
              playerObj = { id: 'obj_player', name: 'Player', script: { code: '' } };
              p.objects.push(playerObj);
            }
            scene.entities = scene.entities || [];
            scene.entities.unshift({
              id: 'ent_player_' + Math.random().toString(36).slice(2, 7),
              objectId: playerObj.id,
              x: 0,
              y: 1,
              z: 0,
            });
            repairsApplied.push({
              type: 'spawned_player_3d',
              scene: scene.name,
              message: `Joueur 3D place a l'origine dans la scene "${scene.name}".`,
            });
          }
        } else {
          const map = (p.maps || []).find((m) => m.id === issue.mapId) || p.maps?.[0];
          if (map) {
            let playerObj = (p.objects || []).find((o) => /player|joueur|hero/i.test(o.name));
            if (!playerObj) {
              playerObj = { id: 'obj_player', name: 'Player', script: { code: '' } };
              p.objects.push(playerObj);
            }
            map.entities = map.entities || [];
            map.entities.unshift({
              id: 'ent_player_' + Math.random().toString(36).slice(2, 7),
              objectId: playerObj.id,
              x: 32,
              y: (map.height - 3) * (p.settings?.tileSize || 16),
            });
            repairsApplied.push({
              type: 'spawned_player_2d',
              map: map.name,
              message: `Joueur 2D place sur la carte "${map.name}".`,
            });
          }
        }
        break;
      }

      case 'missing_exit': {
        const map = (p.maps || []).find((m) => m.id === issue.mapId);
        if (map) {
          let exitObj = (p.objects || []).find((o) => /portal|exit|sortie/i.test(o.name));
          if (!exitObj) {
            exitObj = { id: 'obj_portal', name: 'Portal', script: { code: 'on("overlap", "Player", () => game.restart());' } };
            p.objects.push(exitObj);
          }
          map.entities = map.entities || [];
          const tileSize = p.settings?.tileSize || 16;
          map.entities.push({
            id: 'ent_portal_' + Math.random().toString(36).slice(2, 7),
            objectId: exitObj.id,
            x: (map.width - 3) * tileSize,
            y: (map.height - 3) * tileSize,
          });
          repairsApplied.push({
            type: 'spawned_exit_2d',
            map: map.name,
            message: `Portail place sur la carte "${map.name}".`,
          });
        }
        break;
      }

      case 'script_runtime_error': {
        const obj = (p.objects || []).find((o) => o.name === issue.objectName);
        if (obj && obj.script) {
          // Securisation du script defectueux
          obj.script.code = `// Script securise automatiquement suite a une exception de simulation\n` +
            `on('create', () => {});\n` +
            `on('update', () => {});\n`;
          repairsApplied.push({
            type: 'repaired_script',
            object: obj.name,
            message: `Script de l'objet "${obj.name}" reinitialise avec un modele securise.`,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    project: p,
    repairsApplied,
  };
}

/**
 * Boucle complete de playtest et d'autocorrection (jusqu'a 3 tours max).
 *
 * @param {object} project - Projet PixelForge a tester et corriger
 * @param {object} [options] - Options (maxIterations, etc.)
 * @returns {{ ok: boolean, iterations: number, fixed: boolean, project: object, history: Array<object>, remainingIssues: Array<object> }}
 */
export function runPlaytestAndFix(project, options = {}) {
  const maxIterations = options.maxIterations ?? 3;
  let currentProject = JSON.parse(JSON.stringify(project));
  const history = [];

  for (let iter = 1; iter <= maxIterations; iter++) {
    const report = playtestGame(currentProject, options);

    if (report.ok) {
      return {
        ok: true,
        iterations: iter,
        fixed: history.length > 0,
        project: currentProject,
        history,
        remainingIssues: [],
      };
    }

    // Appliquer les corrections
    const fixResult = autoFixGame(currentProject, report.issues, options);
    history.push({
      iteration: iter,
      issuesFound: report.issues,
      repairsApplied: fixResult.repairsApplied,
    });

    currentProject = fixResult.project;
  }

  // Verification finale
  const finalReport = playtestGame(currentProject, options);
  return {
    ok: finalReport.ok,
    iterations: maxIterations,
    fixed: history.length > 0,
    project: currentProject,
    history,
    remainingIssues: finalReport.issues,
  };
}
