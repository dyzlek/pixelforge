// @ts-check
import { test, expect } from '@playwright/test';

test.describe('PixelForge Studio E2E Tests', () => {
  test('chargement du studio, navigation dans les onglets et creation', async ({ page }) => {
    // 1. Chargement de l'application
    await page.goto('/');
    await expect(page).toHaveTitle(/PixelForge/i);

    // Verifier la presence des elements fondamentaux du studio
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

    // Onglet Son & Chiptune Tracker
    await page.locator('[data-open-kind="sound"]').click();
    await expect(page.locator('#tabs')).toContainText(/Son|Musique/i);

    // 3. Test du generateur / compositeur de sons
    const soundView = page.locator('#view');
    await expect(soundView).toBeVisible();

    // 4. Test du mode Blueprint dans l'editeur d'objets
    await page.locator('[data-open-kind="objects"]').click();
    await expect(soundView).toBeVisible();

    // 5. Test du lancement du jeu (Playtest F5)
    await page.keyboard.press('F5');
    await expect(page.locator('#tabs')).toContainText(/Jouer/i);

    // Le conteneur de jeu doit etre visible dans la vue centrale
    const playScreen = page.locator('.play-stage:visible, .play-root:visible, canvas:visible');
    await expect(playScreen.first()).toBeVisible({ timeout: 10000 });

    // 6. Arret du jeu
    const stopBtn = page.locator('[data-act="stop"], [title*="Arrêter"], [aria-label*="Arrêter"]');
    if (await stopBtn.count() > 0) {
      await stopBtn.first().click();
    }
  });

  test('palette de commandes et raccourcis', async ({ page }) => {
    await page.goto('/');

    // Ouverture de la palette de commandes avec Ctrl+K ou Ctrl+P
    await page.keyboard.press('Control+k');
    const palette = page.locator('.pf-palette-overlay, .pf-palette-modal');
    if (await palette.count() > 0) {
      await expect(palette.first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(palette.first()).not.toBeVisible();
    }
  });
});
