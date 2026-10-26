// @ts-check
import { test, expect } from '@playwright/test';

test.describe('PixelForge Studio E2E Tests', () => {
  test('chargement du studio et navigation dans les onglets', async ({ page }) => {
    // 1. Chargement de l'application
    await page.goto('/');
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
    await page.evaluate(() => {
      window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
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
    await expect(page.locator('#app')).toBeVisible();

    // Ouvrir l'editeur musical via workspace
    await page.evaluate(() => {
      window.__pfWorkspace.open({ kind: 'music', title: 'Musique' });
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
});
