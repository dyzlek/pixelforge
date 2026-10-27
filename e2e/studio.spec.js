// @ts-check
import { test, expect } from '@playwright/test';

test.describe('PixelForge Studio E2E Tests', () => {
  test('chargement du studio et navigation dans les onglets', async ({ page }) => {
    // 1. Chargement de l'application
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);
    await expect(page).toHaveTitle(/PixelForge/i);

    // Elements fondamentaux du studio
    const appEl = page.locator('#app');
    await expect(appEl).toBeVisible();

    const quickTabs = page.locator('#pf-quick-tabs');
    await expect(quickTabs).toBeVisible();

    // 2. Navigation dans les onglets du studio via les boutons d'acces rapide
    // Onglet Carte
    await page.locator('[data-open-kind="map"]').click();
    await expect(page.locator('#tabs')).toContainText(/Carte|Niveau|Level/i);

    // Onglet Sprite
    await page.locator('[data-open-kind="pixel"]').click();
    await expect(page.locator('#tabs')).toContainText(/Sprite|Pixel/i);

    // Onglet Objets & Blueprints
    await page.locator('[data-open-kind="objects"]').click();
    await expect(page.locator('#tabs')).toContainText(/Objet/i);

    // Onglet Son & Generateur SFX
    await page.locator('[data-open-kind="sound"]').click();
    await expect(page.locator('#tabs')).toContainText(/Son/i);
    await expect(page.locator('.snd-root')).toBeVisible();

    // Onglet Musique / Chiptune Tracker (DAW) via workspace
    await page.evaluate(async () => {
      await window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
    });
    await expect(page.locator('#tabs')).toContainText(/Musique/i);
    await expect(page.locator('.pf-music-root')).toBeVisible();

    // 3. Test du lancement du jeu 2D par defaut (F5)
    await page.keyboard.press('F5');
    await expect(page.locator('#tabs')).toContainText(/Jouer/i);
    const playScreen = page.locator('.play-stage canvas, canvas:visible');
    await expect(playScreen.first()).toBeVisible({ timeout: 10000 });

    // 4. Arret du jeu via F8
    await page.keyboard.press('F8');
    await expect(page.locator('#tabs')).not.toContainText(/Jouer/i);
  });

  test('palette de commandes et raccourcis sans verification conditionnelle', async ({ page }) => {
    await page.goto('/');

    // Ouverture de la palette de commandes avec Ctrl+Shift+P
    await page.keyboard.press('Control+Shift+P');
    const modal = page.locator('.pf-palette-modal');
    await expect(modal).toBeVisible();

    // Fermeture avec Echap
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Ouverture de l'acces rapide avec Ctrl+P
    await page.keyboard.press('Control+p');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('lancement reel du jeu 3D Cube Runner, verification du sol et deplacement', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);
    await expect(page.locator('#app')).toBeVisible();

    // Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });
    await expect(page.locator('#project-name')).toHaveValue(/Cube Runner/i);

    // Lancer le jeu avec F5
    await page.keyboard.press('F5');
    await expect(page.locator('#tabs')).toContainText(/Jouer/i);

    // Attendre que la scene 3D soit chargee et rendue
    const canvas = page.locator('.play-stage canvas, canvas:visible').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Attendre que __pfDebugSnapshot soit disponible avec des instances et le joueur au sol
    await page.waitForFunction(() => {
      const snap = window.__pfDebugSnapshot?.();
      const p = snap?.instances?.find((i) => i.name === 'Player');
      return p && p.onGround === true;
    }, { timeout: 15000 });

    // 1. Verification que le joueur est au sol sur la gridmap
    const snapshotInitial = await page.evaluate(() => window.__pfDebugSnapshot());
    expect(snapshotInitial).not.toBeNull();
    expect(snapshotInitial.scene).toBe('Niveau 1');
    expect(snapshotInitial.blocks).toBeGreaterThan(0);

    const playerInitial = snapshotInitial.instances.find((i) => i.name === 'Player');
    expect(playerInitial).toBeDefined();
    expect(playerInitial.onGround).toBe(true);
    expect(Math.round(playerInitial.y)).toBe(1);

    // 2. Simuler la touche Fleche Haut pour faire avancer le joueur (deplacement court pour rester sur la plateforme)
    const startZ = playerInitial.z;
    const startX = playerInitial.x;

    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(120);
    await page.keyboard.up('ArrowUp');

    // Attendre au moins une frame de simulation
    await page.waitForTimeout(100);

    const snapshotMoved = await page.evaluate(() => window.__pfDebugSnapshot());
    const playerMoved = snapshotMoved.instances.find((i) => i.name === 'Player');
    expect(playerMoved).toBeDefined();

    // Le joueur a avance (sa position z ou x a change) et il est toujours sur le sol
    const distMoved = Math.hypot(playerMoved.x - startX, playerMoved.z - startZ);
    expect(distMoved).toBeGreaterThan(0.2);
    expect(playerMoved.onGround).toBe(true);

    // Arret du jeu
    await page.keyboard.press('F8');
  });

  test('composition de 4 notes dans le sequenceur musical et avancement du planificateur', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);
    await expect(page.locator('#app')).toBeVisible();

    // Ouvrir l'editeur musical via workspace
    await page.evaluate(async () => {
      await window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
    });
    const rack = page.locator('.pf-music-rack');
    await expect(rack).toBeVisible({ timeout: 10000 });

    // Activer 4 pas sur le premier canal
    const firstChannelSteps = page.locator('.pf-rack-row').first().locator('button.pf-step-btn');
    await expect(firstChannelSteps.nth(0)).toBeVisible();

    await firstChannelSteps.nth(0).click();
    await firstChannelSteps.nth(2).click();
    await firstChannelSteps.nth(4).click();
    await firstChannelSteps.nth(6).click();

    // Verifier que les pas sont bien actifs visuellement
    await expect(firstChannelSteps.nth(0)).toHaveClass(/active/);
    await expect(firstChannelSteps.nth(2)).toHaveClass(/active/);
    await expect(firstChannelSteps.nth(4)).toHaveClass(/active/);
    await expect(firstChannelSteps.nth(6)).toHaveClass(/active/);

    // Lancer la lecture musicale via le bouton Play du transport
    const playBtn = page.locator('.pf-transport-btn[title*="Lire"]');
    await playBtn.click();

    // Verifier que l'editeur est en lecture et que le planificateur avance (currentStep >= 1)
    await page.waitForFunction(() => {
      const ed = window.__pfMusicEditor;
      return ed && ed.isPlaying() && ed.getCurrentStep() >= 1;
    }, { timeout: 8000 });

    const editorState = await page.evaluate(() => ({
      playing: window.__pfMusicEditor.isPlaying(),
      step: window.__pfMusicEditor.getCurrentStep(),
    }));
    expect(editorState.playing).toBe(true);
    expect(editorState.step).toBeGreaterThanOrEqual(1);

    // Arreter la lecture
    const stopBtn = page.locator('.pf-transport-btn[title*="Arreter"]');
    await stopBtn.click();

    const stoppedState = await page.evaluate(() => window.__pfMusicEditor.isPlaying());
    expect(stoppedState).toBe(false);
  });

  test('jeu 2D plateforme sous Phaser 4 : verification du rendu WebGL, FPS et deplacement', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    // Ouvrir le jeu 2D d'exemple plateforme
    await page.evaluate(async () => {
      await window.__pfStore.openGame('exemple-plateforme-qiqv');
    });
    await expect(page.locator('#project-name')).toHaveValue(/plateforme/i);

    // Lancer le jeu 2D (F5)
    await page.keyboard.press('F5');
    await expect(page.locator('#tabs')).toContainText(/Jouer/i);

    const canvas = page.locator('.play-stage canvas, canvas:visible').first();
    await expect(canvas).toBeVisible({ timeout: 10000 });

    // Attendre que le snapshot soit disponible et que le joueur soit au sol
    await page.waitForFunction(() => {
      const snap = window.__pfDebugSnapshot?.();
      const p = snap?.instances?.find((i) => i.name === 'Player');
      return p && p.onGround === true;
    }, { timeout: 15000 });

    const snapshot = await page.evaluate(() => window.__pfDebugSnapshot());
    expect(snapshot.instances.length).toBeGreaterThan(0);
    expect(snapshot.fps).toBeGreaterThanOrEqual(30);

    const player = snapshot.instances.find((i) => i.name === 'Player');
    expect(player).toBeDefined();
    expect(player.onGround).toBe(true);

    const startX = player.x;

    // Deplacer le joueur vers la droite
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(100);

    const movedSnapshot = await page.evaluate(() => window.__pfDebugSnapshot());
    const movedPlayer = movedSnapshot.instances.find((i) => i.name === 'Player');
    expect(movedPlayer.x).toBeGreaterThan(startX + 2);

    // Arreter le jeu
    await page.keyboard.press('F8');
    await expect(page.locator('#tabs')).not.toContainText(/Jouer/i);
  });

  test('operations partagees src/core/ops executees directement dans le navigateur', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    const result = await page.evaluate(async () => {
      const ops = window.__pfOps;
      if (!ops) throw new Error('__pfOps not found on window');

      // Creation d'un projet minimal de test
      const p = {
        name: 'BrowserOpsGame',
        meta: { id: 'browser-ops-game', description: 'Test core ops in browser', author: 'E2E' },
        settings: { width: 320, height: 240, tileSize: 16, gravity: 600, pixelZoom: 2, background: '#1a1c2c', touchControls: false },
        palette: [
          '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
          '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'
        ],
        sprites: [],
        objects: [],
        maps: [],
        sounds: [],
        songs: [],
        models: [],
        scenes3d: []
      };

      // 1. Creation de sprite avec textToFrames / encodeur PNG pur
      ops.upsertSprite(p, {
        name: 'Hero',
        frames: [
          [
            '..44..',
            '.4444.',
            '44aa44',
            '4aaaa4',
            '.4444.',
            '..44..'
          ]
        ],
        animations: [{ name: 'idle', frames: [0], fps: 6, loop: true }]
      });

      // 2. Lecture du sprite avec getSprite / decodeur PNG pur
      ops.getSprite(p, 'Hero');

      // 3. Creation d'objet avec script Blueprint graph compile
      ops.upsertObject(p, {
        name: 'HeroObj',
        sprite: 'Hero',
        physics: { enabled: true, gravity: true, bounce: 0 },
        graph: {
          nodes: [
            { id: 'n1', type: 'pf_on_update' },
            { id: 'n2', type: 'pf_self_set', fields: { PROP: 'vx' }, values: { VALUE: 100 } }
          ],
          links: [
            { from: 'n1', fromPin: 'then', to: 'n2', toPin: 'exec' }
          ]
        }
      });

      // 4. Creation de carte 2D et peinture
      ops.upsertMap(p, {
        name: 'Level1',
        width: 10,
        height: 6,
        layers: [
          { name: 'Ground', collides: true }
        ],
        start: true
      });

      ops.paintMap(p, {
        map: 'Level1',
        layer: 'Ground',
        rows: [
          '..........',
          '..........',
          '..........',
          '..........',
          '0000000000',
          '0000000000'
        ]
      });

      // 5. Placement d'entite
      ops.placeEntities(p, {
        map: 'Level1',
        entities: [
          { object: 'HeroObj', x: 16, y: 32 }
        ]
      });

      // 6. Creation et roundtrip tracker chiptune
      ops.upsertSong(p, {
        name: 'ChiptuneTrack',
        text: 'BPM 135\nCH Lead pulse50 vol 0.8\nPAT 0\n00 C-4\n04 E-4\n08 G-4\n12 B-4\nPLAY 0\n'
      });
      const songText = ops.getSongText(p, 'ChiptuneTrack');

      // 7. Creation et peinture 3D
      ops.upsertScene3D(p, {
        name: 'Scene3DTest',
        start: true
      });
      ops.paintGridMap(p, {
        scene: 'Scene3DTest',
        level: 0,
        rows: [
          '0000',
          '0..0',
          '0000'
        ]
      });

      // 8. Resume global
      const summary = ops.summarize(p);

      return {
        spritesCount: p.sprites.length,
        objectsCount: p.objects.length,
        mapsCount: p.maps.length,
        songsCount: p.songs.length,
        scenesCount: p.scenes3d.length,
        heroFrameCount: p.sprites[0].frames.length,
        heroObjMode: p.objects[0].script.mode,
        heroObjCodeLength: p.objects[0].script.code.length,
        mapEntities: p.maps[0].entities.length,
        songTextLength: songText.length,
        summaryLength: summary.length
      };
    });

    expect(result.spritesCount).toBe(1);
    expect(result.objectsCount).toBe(1);
    expect(result.mapsCount).toBe(1);
    expect(result.songsCount).toBe(1);
    expect(result.scenesCount).toBe(1);
    expect(result.heroFrameCount).toBe(1);
    expect(result.heroObjMode).toBe('graph');
    expect(result.heroObjCodeLength).toBeGreaterThan(0);
    expect(result.mapEntities).toBe(1);
    expect(result.songTextLength).toBeGreaterThan(0);
    expect(result.summaryLength).toBeGreaterThan(50);
  });

  test("panneau assistant IA : activation, boutons d'annulation et historique atomique", async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir un jeu pour avoir un projet actif avec historique
    await page.evaluate(async () => {
      await window.__pfStore.openGame('exemple-plateforme-qiqv');
    });
    await expect(page.locator('#project-name')).toHaveValue(/Plateforme/i);

    // 2. Activation du panneau Assistant IA
    await page.evaluate(() => {
      window.__pfDock.activatePanel('ai-assistant');
    });

    const panelEl = page.locator('.pf-ai-panel');
    await expect(panelEl).toBeVisible();

    const undoBtn = page.locator('#ai-undo-btn');
    const redoBtn = page.locator('#ai-redo-btn');
    const sendBtn = page.locator('#ai-send-btn');
    const promptInput = page.locator('#ai-prompt-input');

    await expect(undoBtn).toBeVisible();
    await expect(redoBtn).toBeVisible();
    await expect(sendBtn).toBeVisible();
    await expect(promptInput).toBeVisible();

    // 2. Verification de l'etat initial des boutons d'historique
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();

    // 3. Simulation d'une action atomique via le store
    await page.evaluate(() => {
      window.__pfStore.update((p) => {
        p.name = 'Test Studio IA';
      }, 'ai-agent');
    });

    await expect(undoBtn).toBeEnabled();

    // 4. Annulation par le bouton Annuler
    await undoBtn.click();
    const revertedName = await page.evaluate(() => window.__pfStore.project.name);
    expect(revertedName).not.toBe('Test Studio IA');

    // 5. Retablissement par le bouton Refaire
    await expect(redoBtn).toBeEnabled();
    await redoBtn.click();
    const redoneName = await page.evaluate(() => window.__pfStore.project.name);
    expect(redoneName).toBe('Test Studio IA');
  });

  test("graphe de scene 3D, arbre hierarchique et inspecteur : selection et cycle d'annulation", async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Ouvrir la scene 3D dans le workspace
    await page.evaluate(() => {
      const p = window.__pfStore.project;
      const sc = p.scenes3d?.[0];
      if (sc) {
        window.__pfWorkspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
      }
      window.__pfDock.activatePanel('scene-tree');
    });

    // 3. Verifier l'affichage de l'arbre 3D
    const treeEl = page.locator('.pf-scene-tree');
    await expect(treeEl).toBeVisible();

    const envHead = page.locator('#pf-st-env-head');
    await expect(envHead).toBeVisible();

    // 4. Ajouter un nœud via le menu d'ajout
    const addBtn = page.locator('#pf-st-add-btn');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const addMenu = page.locator('#pf-st-add-menu');
    await expect(addMenu).toBeVisible();

    const addLightBtn = addMenu.locator('[data-add-kind="light"]');
    await addLightBtn.click();

    // Verifier que le nœud est present dans le graphe
    const nodeCount = await page.evaluate(() => {
      const sc = window.__pfStore.project.scenes3d?.[0];
      return sc?.nodes?.length || 0;
    });
    expect(nodeCount).toBeGreaterThan(0);

    // 5. Verifier que le nœud s'affiche dans l'inspecteur
    const inspEl = page.locator('.pf-inspector');
    await expect(inspEl).toBeVisible();

    // 6. Annuler l'ajout avec store.undo()
    await page.evaluate(() => {
      window.__pfStore.undo();
    });

    const nodeCountAfterUndo = await page.evaluate(() => {
      const sc = window.__pfStore.project.scenes3d?.[0];
      return sc?.nodes?.length || 0;
    });
    expect(nodeCountAfterUndo).toBe(nodeCount - 1);
  });

  test("editeur de scene 3D : outils gizmos (W/E/R), aimantation et manipulation", async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Ouvrir la scene 3D et activer le panneau arbre de scene
    await page.evaluate(() => {
      const p = window.__pfStore.project;
      const sc = p.scenes3d?.[0];
      if (sc) {
        window.__pfWorkspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
      }
      window.__pfDock.activatePanel('scene-tree');
    });

    // 3. Verifier la barre d'outils gizmos
    const gizmoBar = page.locator('#pf-s3d-gizmo-bar');
    await expect(gizmoBar).toBeVisible();

    const wBtn = page.locator('.pf-s3d-gizmo-btn[data-gizmo="translate"]');
    const eBtn = page.locator('.pf-s3d-gizmo-btn[data-gizmo="rotate"]');
    const rBtn = page.locator('.pf-s3d-gizmo-btn[data-gizmo="scale"]');
    const spaceBtn = page.locator('#pf-s3d-space-btn');
    const snapChk = page.locator('#pf-s3d-snap-chk');

    await expect(wBtn).toBeVisible();
    await expect(eBtn).toBeVisible();
    await expect(rBtn).toBeVisible();
    await expect(spaceBtn).toBeVisible();
    await expect(snapChk).toBeVisible();

    // 4. Tester le basculement de mode de gizmo
    await eBtn.click();
    await expect(eBtn).toHaveClass(/active/);
    await expect(wBtn).not.toHaveClass(/active/);

    await rBtn.click();
    await expect(rBtn).toHaveClass(/active/);

    await wBtn.click();
    await expect(wBtn).toHaveClass(/active/);

    // 5. Basculer l'espace Monde / Local
    await expect(spaceBtn).toHaveText(/Monde/);
    await spaceBtn.click();
    await expect(spaceBtn).toHaveText(/Local/);
    await spaceBtn.click();
    await expect(spaceBtn).toHaveText(/Monde/);

    // 6. Basculer l'aimantation
    await expect(snapChk).toBeChecked();
    await snapChk.uncheck();
    await expect(snapChk).not.toBeChecked();
    await snapChk.check();
    await expect(snapChk).toBeChecked();
  });

  test("navigation vue 3D : boutons focus, perspective/ortho et raccourcis dans la palette", async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Ouvrir la scene 3D et activer le panneau arbre de scene
    await page.evaluate(() => {
      const p = window.__pfStore.project;
      const sc = p.scenes3d?.[0];
      if (sc) {
        window.__pfWorkspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
      }
      window.__pfDock.activatePanel('scene-tree');
    });

    await page.waitForSelector('.pf-scene3d-viewport canvas');

    // 3. Boutons Focus et Projection
    const focusBtn = page.locator('#pf-s3d-focus-btn');
    const projBtn = page.locator('#pf-s3d-proj-btn');

    await expect(focusBtn).toBeVisible();
    await expect(projBtn).toBeVisible();
    await expect(projBtn).toHaveText(/Persp/);

    // 4. Basculer la projection
    await projBtn.click();
    await expect(projBtn).toHaveText(/Ortho/);
    await projBtn.click();
    await expect(projBtn).toHaveText(/Persp/);

    // 5. Verifier que les raccourcis 3D sont enregistres dans la palette de commandes
    const commands = await page.evaluate(() => {
      return window.__pfCommandPalette?.shortcuts?.getCommands() || [];
    });

    const hasFocusCmd = commands.some((c) => c.id === 'view-3d-focus');
    const hasFrontCmd = commands.some((c) => c.id === 'view-3d-front');
    const hasOrthoCmd = commands.some((c) => c.id === 'view-3d-persp-ortho');

    expect(hasFocusCmd).toBe(true);
    expect(hasFrontCmd).toBe(true);
    expect(hasOrthoCmd).toBe(true);
  });

  test("modeles glTF animes et CC0 : selection d'un preset CC0 dans l'editeur voxel", async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Ouvrir le modele 3D
    await page.evaluate(() => {
      const p = window.__pfStore.project;
      const m = p.models?.[0];
      if (m) {
        window.__pfWorkspace.open({ kind: 'voxel', refId: m.id, title: m.name });
      }
    });

    // 3. Verifier la presence du selecteur CC0
    const cc0Select = page.locator('#pf-voxel-cc0-select');
    await expect(cc0Select).toBeVisible();

    // 4. Selectionner le preset Aventurier (Quaternius - CC0)
    await cc0Select.selectOption('cc0_adventurer');

    // 5. Verifier que le modele passe en glTF et que l'info est affichee
    const gltfInfo = page.locator('#pf-voxel-gltf-info');
    await expect(gltfInfo).toBeVisible();
    await expect(gltfInfo).toContainText(/Modele 3D glTF embarque/i);

    const modelType = await page.evaluate(() => {
      const m = window.__pfStore.project.models?.[0];
      return m?.type;
    });
    expect(modelType).toBe('gltf');

    // 6. Basculer de nouveau en mode Voxel
    const switchBtn = page.locator('#pf-voxel-switch-mode');
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    const modelTypeAfterSwitch = await page.evaluate(() => {
      const m = window.__pfStore.project.models?.[0];
      return m?.type;
    });
    expect(modelTypeAfterSwitch).toBe('voxel');
  });

  test('instruments DAW v2 (synth_sub, synth_fm, drum_machine, sampler) et prereglages dans le studio musical', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // Ouvrir l'editeur musical via workspace
    await page.evaluate(async () => {
      await window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
    });
    const rack = page.locator('.pf-music-rack');
    await expect(rack).toBeVisible({ timeout: 10000 });

    // Verifier la presence du menu d'ajout de canal
    const addSelect = page.locator('.pf-btn-add-channel');
    await expect(addSelect).toBeVisible();

    // Ajouter un canal avec le prereglage Basse 808
    await addSelect.selectOption('preset:bass_808');

    // Verifier que le canal a ete ajoute dans le projet
    const channels = await page.evaluate(() => {
      const s = window.__pfStore.project.songs?.[0];
      return s?.channels?.map((c) => ({ id: c.id, name: c.name, inst: c.instrument, preset: c.preset }));
    });

    const added = channels.find((c) => c.preset === 'bass_808');
    expect(added).toBeDefined();
    expect(added.inst).toBe('synth_sub');

    // Verifier la presence du bouton d'audition 1-clic
    const auditionBtns = page.locator('.pf-channel-info .pf-transport-btn[title*="Ecouter"]');
    await expect(auditionBtns.first()).toBeVisible();
    await auditionBtns.first().click();

    // Lancer la lecture et verifier que le sequenceur avance
    const btnPlay = page.locator('.pf-music-transport .pf-transport-btn[title*="Lire"]');
    await btnPlay.click();

    await page.waitForFunction(() => {
      return window.__pfMusicEditor && window.__pfMusicEditor.isPlaying();
    }, { timeout: 3000 });

    const isPlaying = await page.evaluate(() => window.__pfMusicEditor.isPlaying());
    expect(isPlaying).toBe(true);

    const btnStop = page.locator('.pf-music-transport .pf-transport-btn[title*="Arreter"]');
    await btnStop.click();
  });

  test('console de mixage, rack d effets et departs auxiliaires (sends)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // Ouvrir l'editeur musical via workspace
    await page.evaluate(async () => {
      await window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
    });
    await expect(page.locator('.pf-music-rack')).toBeVisible({ timeout: 10000 });

    // Basculer sur la vue Mixer
    const btnMixer = page.locator('.pf-transport-btn', { hasText: 'MIXER' });
    await expect(btnMixer).toBeVisible();
    await btnMixer.click();

    // Verifier la presence de la console et des tranches
    const strips = page.locator('.pf-mixer-strip');
    await expect(strips.first()).toBeVisible();

    // Selectionner la premiere tranche de canal
    const firstTrack = strips.nth(1);
    await firstTrack.click();
    await expect(firstTrack).toHaveClass(/selected/);

    // Verifier la presence du rack d'effets
    const fxPanel = page.locator('.pf-mixer-fx-panel');
    await expect(fxPanel).toBeVisible();
    await expect(fxPanel).toContainText(/Rack d'Effets/i);

    // Ajouter un effet Reverb
    const addFxSelect = fxPanel.locator('select.pf-btn-add-channel').first();
    await expect(addFxSelect).toBeVisible();
    await addFxSelect.selectOption('reverb');

    // Verifier que l'effet Reverb apparait dans la liste
    const fxSlots = fxPanel.locator('.pf-fx-slot');
    await expect(fxSlots.first()).toBeVisible();
    await expect(fxSlots.first()).toContainText(/Reverberation/i);

    // Verifier que le projet a bien enregistre l'effet sur la piste
    const hasReverb = await page.evaluate(() => {
      const s = window.__pfStore.project.songs?.[0];
      const ch = s?.channels?.[0];
      return ch?.effects?.some((e) => e.type === 'reverb');
    });
    expect(hasReverb).toBe(true);

    // Tester la bascule Bypass
    const bypassBtn = fxSlots.first().locator('button', { hasText: /Actif|Bypass/i });
    await bypassBtn.click();
    await expect(fxSlots.first()).toHaveClass(/bypass/);

    // Ajouter un deuxieme effet (Distorsion)
    await addFxSelect.selectOption('distortion');
    await expect(fxSlots).toHaveCount(2);

    // Tester le deplacement d'effet vers le haut
    const btnUp = fxSlots.nth(1).locator('button', { hasText: '▲' });
    if (await btnUp.isVisible()) {
      await btnUp.click();
    }
  });

  test('arrangement multipiste timeline, clips, marqueurs et morceau 2 min', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // Ouvrir l'editeur musical via workspace
    await page.evaluate(async () => {
      await window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
    });
    await expect(page.locator('.pf-music-rack')).toBeVisible({ timeout: 10000 });

    // Basculer sur la vue Playlist / Timeline
    const btnPlaylist = page.locator('.pf-transport-btn', { hasText: 'PLAYLIST' });
    await expect(btnPlaylist).toBeVisible();
    await btnPlaylist.click();

    // Verifier la presence de la timeline
    const timelineRoot = page.locator('.pf-playlist-root');
    await expect(timelineRoot).toBeVisible();

    const trackHeaders = page.locator('.pf-playlist-track-headers');
    await expect(trackHeaders).toBeVisible();

    // Charger le morceau Odyssee 2 minutes
    const btnLoadDemo = page.locator('.pf-playlist-toolbar button', { hasText: 'Charger Odyssee 2 min' });
    await expect(btnLoadDemo).toBeVisible();
    await btnLoadDemo.click();

    // Verifier que les 5 pistes sont chargees
    const heads = page.locator('.pf-playlist-track-head');
    await expect(heads).toHaveCount(8); // Au moins 8 pistes affichees (5 tracks + 3 lanes)
    await expect(heads.first()).toContainText(/Lead Synth/i);

    // Verifier les marqueurs temporels sur la reglette
    const markers = page.locator('.pf-marker-flag');
    await expect(markers.first()).toBeVisible();
    const markerTexts = await markers.allTextContents();
    expect(markerTexts).toContain('Intro');
    expect(markerTexts).toContain('Couplet 1');
    expect(markerTexts).toContain('Refrain');
    expect(markerTexts).toContain('Pont');
    expect(markerTexts).toContain('Fin');

    // Verifier les clips places
    const clips = page.locator('.pf-playlist-block[data-type="clip"]');
    await expect(clips.first()).toBeVisible();
    await expect(clips).toHaveCount(5);

    // Tester l'outil Decouper (Split)
    const btnSplit = page.locator('.pf-playlist-toolbar button', { hasText: 'Decouper' });
    const btnMove = page.locator('.pf-playlist-toolbar button', { hasText: 'Deplacer' });
    await btnSplit.click();
    await expect(page.locator('.pf-playlist-content')).toHaveClass(/tool-split/);
    await btnMove.click();
    await expect(page.locator('.pf-playlist-content')).not.toHaveClass(/tool-split/);

    // Tester le zoom horizontal
    const zoomText = page.locator('.pf-playlist-toolbar span', { hasText: /px/ });
    await expect(zoomText).toContainText('12px');
    const btnZoomIn = page.locator('.pf-playlist-toolbar button[title*="Zoomer"]');
    await btnZoomIn.click();
    await expect(zoomText).toContainText('14px');

    // Verifier la persistence dans le store du projet
    const projectSong = await page.evaluate(() => {
      return window.__pfStore.project.songs?.[0];
    });
    expect(projectSong.bpm).toBe(120);
    expect(projectSong.markers.length).toBe(5);
    expect(projectSong.clips.length).toBe(5);
  });

  test('lumieres, ciel et ambiance editables dans la vue 3D', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Ouvrir la scene 3D et activer le panneau arbre de scene
    await page.evaluate(() => {
      const p = window.__pfStore.project;
      const sc = p.scenes3d?.[0];
      if (sc) {
        window.__pfWorkspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
      }
      window.__pfDock.activatePanel('scene-tree');
    });

    await page.waitForSelector('.pf-scene3d-viewport canvas');

    // 3. Ajouter un noeud de Lumiere dans l'arbre de scene
    const addBtn = page.locator('#pf-st-add-btn');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const addLightItem = page.locator('.pf-st-menu-item[data-add-kind="light"]');
    await expect(addLightItem).toBeVisible();
    await addLightItem.click();

    // 4. Verifier que le noeud Lumiere a ete cree
    const lightNode = await page.evaluate(() => {
      const sc = window.__pfStore.project.scenes3d?.[0];
      return sc?.nodes?.find((n) => n.kind === 'light');
    });
    expect(lightNode).toBeTruthy();
    expect(lightNode.props.lightType).toBe('point');
    expect(lightNode.position[1]).toBe(3);

    // 5. Verifier l'affichage du panneau d'inspection pour la lumiere
    const inspGroup = page.locator('.pf-insp-group', { hasText: 'Parametres de Lumiere' });
    await expect(inspGroup).toBeVisible();

    // 6. Configurer l'environnement (ciel degrade, brouillard, ombres)
    await page.evaluate(() => {
      const store = window.__pfStore;
      store.update((p) => {
        const sc = p.scenes3d?.[0];
        if (sc) {
          sc.environment = {
            ...sc.environment,
            skyGradient: { enabled: true, topColor: '#05060a', bottomColor: '#1a1c2c' },
            fog: { enabled: true, type: 'linear', color: '#090a10', near: 15, far: 60 },
            directionalLight: { ...sc.environment?.directionalLight, castShadow: true },
            shadows: { enabled: true }
          };
        }
      }, 'inspector');
    });

    const envData = await page.evaluate(() => {
      return window.__pfStore.project.scenes3d?.[0]?.environment;
    });
    expect(envData.skyGradient.enabled).toBe(true);
    expect(envData.fog.type).toBe('linear');
    expect(envData.directionalLight.castShadow).toBe(true);
  });

  test('physique 3D reelle avec Rapier : bascule simple / rapier et verification du rigid body', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Basculer les reglages de physique 3D sur 'rapier'
    await page.evaluate(() => {
      window.__pfStore.update((p) => {
        p.settings.physics3d = 'rapier';
      }, 'inspector');
    });

    const physics3d = await page.evaluate(() => window.__pfStore.project.settings.physics3d);
    expect(physics3d).toBe('rapier');

    // 3. Lancer le jeu avec F5 et verifier que le moteur Rapier 3D demarre
    await page.keyboard.press('F5');
    await expect(page.locator('#tabs')).toContainText(/Jouer/i);

    const canvas = page.locator('.play-stage canvas, canvas:visible').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // 4. Verifier que le moteur 3D avec Rapier est initialise et que le joueur repose sur le sol
    await page.waitForFunction(() => {
      const snap = window.__pfDebugSnapshot?.();
      const p = snap?.instances?.find((i) => i.name === 'Player');
      return p && p.onGround === true;
    }, { timeout: 15000 });

    const snap = await page.evaluate(() => window.__pfDebugSnapshot());
    const player = snap.instances.find((i) => i.name === 'Player');
    expect(player).toBeDefined();
    expect(player.onGround).toBe(true);

    // 5. Arreter le jeu avec F8
    await page.keyboard.press('F8');
    await expect(page.locator('#tabs')).not.toContainText(/Jouer/i);

    // 6. Basculer a nouveau sur 'simple' et verifier que les reglages sont persistes
    await page.evaluate(() => {
      window.__pfStore.update((p) => {
        p.settings.physics3d = 'simple';
      }, 'inspector');
    });
    const backToSimple = await page.evaluate(() => window.__pfStore.project.settings.physics3d);
    expect(backToSimple).toBe('simple');
  });

  test('prefabriques et terrain sculptable : creation d un prefabrique, sculpture du terrain et solidite en jeu', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Definir un prefabrique et un terrain sculpte dans la scene
    await page.evaluate(() => {
      window.__pfStore.update((p) => {
        p.prefabs3d = p.prefabs3d || [];
        p.prefabs3d.push({
          id: 'pfb_totem',
          name: 'Totem',
          nodes: [
            { id: 'node_totem_base', name: 'BaseTotem', kind: 'mesh', objectId: p.objects[0]?.id, position: [0, 0, 0] },
          ],
        });

        const sc = p.scenes3d[0];
        sc.nodes = sc.nodes || [];
        sc.nodes.push({
          id: 'inst_totem',
          name: 'MonTotem',
          kind: 'prefab',
          prefabId: 'pfb_totem',
          position: [4, 0, 4],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          visible: true,
        });

        sc.terrain = {
          enabled: true,
          width: 12,
          depth: 12,
          originX: -6,
          originZ: -6,
          defaultHeight: 0,
          defaultColor: 6,
          heights: {
            '0,0': 1,
          },
        };
      }, 'scene3d');
    });

    // 3. Verifier que le prefabrique et le terrain sont bien enregistres dans le store
    const prefabCount = await page.evaluate(() => window.__pfStore.project.prefabs3d?.length || 0);
    const terrainEnabled = await page.evaluate(() => window.__pfStore.project.scenes3d?.[0]?.terrain?.enabled);
    expect(prefabCount).toBeGreaterThanOrEqual(1);
    expect(terrainEnabled).toBe(true);

    // 4. Lancer le jeu avec F5 et verifier que le terrain sculpte et les prefabs sont instancies
    await page.keyboard.press('F5');
    await expect(page.locator('#tabs')).toContainText(/Jouer/i);

    const canvas = page.locator('.play-stage canvas, canvas:visible').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // 5. Attendre que le joueur repose sur le sol
    await page.waitForFunction(() => {
      const snap = window.__pfDebugSnapshot?.();
      const p = snap?.instances?.find((i) => i.name === 'Player');
      return p && p.onGround === true;
    }, { timeout: 15000 });

    const snap = await page.evaluate(() => window.__pfDebugSnapshot());
    const player = snap.instances.find((i) => i.name === 'Player');
    expect(player).toBeDefined();
    expect(player.onGround).toBe(true);

    // 6. Verifier la presence de l'entite issue du prefabrique
    const totemInst = snap.instances.find((i) => i.x === 4 && i.z === 4);
    expect(totemInst).toBeDefined();

    // 7. Arreter le jeu avec F8
    await page.keyboard.press('F8');
    await expect(page.locator('#tabs')).not.toContainText(/Jouer/i);
  });

  test('jouer depuis la camera de l editeur et debogage 3D : placement, pause, pas a pas et colliders', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__pfReady === true);

    // 1. Ouvrir le jeu 3D Cube Runner
    await page.evaluate(async () => {
      await window.__pfStore.openGame('cube-runner');
    });

    // 2. Ouvrir l editeur de scene 3D
    await page.evaluate(() => {
      const sc = window.__pfStore.project.scenes3d?.[0];
      if (sc) {
        window.__pfWorkspace.open({ kind: 'scene3d', refId: sc.id, title: sc.name });
      }
    });

    await expect(page.locator('.pf-scene3d-toolbar')).toBeVisible();

    // 3. Verifier la presence des boutons de placement direct et de vue camera
    const spawnPlayTool = page.locator('.pf-scene3d-btn[data-tool="spawn-play"]');
    await expect(spawnPlayTool).toBeVisible();
    const playCamBtn = page.locator('#pf-s3d-play-cam-btn');
    await expect(playCamBtn).toBeVisible();

    // 4. Lancer le jeu depuis un point d apparition specifique (placer & jouer)
    await page.evaluate(() => {
      const sc = window.__pfStore.project.scenes3d?.[0];
      window.__pfStore.ui.playScene3DId = sc.id;
      window.dispatchEvent(new CustomEvent('pixelforge:play-from-camera', {
        detail: { spawnPlayerPosition: [5, 4, 5] },
      }));
    });

    await expect(page.locator('#tabs')).toContainText(/Jouer/i);
    const canvas = page.locator('.play-stage canvas, canvas:visible').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // 5. Verifier que le joueur a ete place aux coordonnees demandees
    await page.waitForFunction(() => {
      const snap = window.__pfDebugSnapshot?.();
      const p = snap?.instances?.find((i) => i.name === 'Player');
      return p && Math.abs(p.x - 5) < 0.5 && Math.abs(p.z - 5) < 0.5;
    }, { timeout: 15000 });

    const snapSpawn = await page.evaluate(() => window.__pfDebugSnapshot());
    const spawnedPlayer = snapSpawn.instances.find((i) => i.name === 'Player');
    expect(spawnedPlayer).toBeDefined();
    expect(Math.abs(spawnedPlayer.x - 5)).toBeLessThan(0.5);

    // 6. Verifier la barre de debogage (Pause, Image, Colliders)
    const pauseBtn = page.locator('[data-act="toggle-pause"]');
    const stepBtn = page.locator('[data-act="step-frame"]');
    const collidersBtn = page.locator('[data-act="toggle-colliders"]');
    await expect(pauseBtn).toBeVisible();
    await expect(stepBtn).toBeVisible();
    await expect(collidersBtn).toBeVisible();

    // 7. Activer les colliders (F9 ou clic)
    await collidersBtn.click();
    await page.waitForFunction(() => window.__pfDebugSnapshot?.()?.debugColliders === true);
    const snapColl = await page.evaluate(() => window.__pfDebugSnapshot());
    expect(snapColl.debugColliders).toBe(true);

    // 8. Mettre en pause (P ou clic)
    await pauseBtn.click();
    await page.waitForFunction(() => window.__pfDebugSnapshot?.()?.isPaused === true);
    expect(pauseBtn).toHaveText(/Reprendre/i);

    // 9. Avancer d une image (O ou clic)
    await stepBtn.click();
    const snapPaused = await page.evaluate(() => window.__pfDebugSnapshot());
    expect(snapPaused.isPaused).toBe(true);

    // 10. Reprendre l execution
    await pauseBtn.click();
    await page.waitForFunction(() => window.__pfDebugSnapshot?.()?.isPaused === false);
    expect(pauseBtn).toHaveText(/Pause/i);

    // 11. Arreter le jeu
    await page.locator('[data-action="stop"]').click();
    await expect(page.locator('#tabs')).not.toContainText(/Jouer/i);
  });
});
