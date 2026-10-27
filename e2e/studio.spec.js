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
});
