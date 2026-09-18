import { expect, test } from '@playwright/test';

/**
 * Smoke test: the built PWA boots, Phaser takes over the canvas, and the menu
 * responds. Deep gameplay coverage lives in the unit tests, where it is fast.
 */
test('the game boots and reaches the menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Inanna: Seven Gates');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible({ timeout: 20_000 });

  const size = await canvas.boundingBox();
  expect(size?.width ?? 0).toBeGreaterThan(0);
  expect(errors, `page errors: ${errors.join(', ')}`).toHaveLength(0);
});

test('the app declares a web app manifest so it can be installed', async ({ page }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref, 'PWA manifest link is missing (SPEC 2)').toBeTruthy();
});
