import { expect, test } from '@playwright/test';
import { computeIntegerScale, gridPixelSize } from '../src/ui/viewport.js';
import { DEMO_PLATFORM_GRID } from '../src/scenes/demoGrid.js';

/**
 * The v2 side-view scene (S-20) has no menu entry yet, so this mounts it
 * directly through the test hook `main.ts` exposes on `window`
 * (`__mountPlatformGame__`) rather than tapping through the app. What it
 * proves: a render target sized to a whole number of 16x16 tiles, scaled by a
 * whole number and letterboxed (SPEC 12, 30), and a two-frame animation that
 * actually swaps over time, driven by the sim clock rather than stalling.
 */

const host = '#platform-game';

test('the v2 scene renders at an integer scale, letterboxed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    (window as unknown as { __mountPlatformGame__: () => unknown }).__mountPlatformGame__();
  });

  const platformCanvas = page.locator(`${host} canvas`);
  await expect(platformCanvas).toBeVisible({ timeout: 20_000 });

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const expected = computeIntegerScale(gridPixelSize(DEMO_PLATFORM_GRID), viewport);

  await expect(page.locator(host)).toHaveAttribute('data-platform-scale', String(expected.scale));
  await expect(page.locator(host)).toHaveAttribute(
    'data-platform-grid',
    `${DEMO_PLATFORM_GRID.width}x${DEMO_PLATFORM_GRID.height}`,
  );
  expect(Number.isInteger(expected.scale)).toBe(true);
  expect(expected.scale).toBeGreaterThanOrEqual(1);

  expect(errors, `page errors: ${errors.join(', ')}`).toHaveLength(0);
});

test('the gate tile swaps between two frames at 8fps, driven by the sim clock', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    (window as unknown as { __mountPlatformGame__: () => unknown }).__mountPlatformGame__();
  });
  await expect(page.locator(`${host} canvas`)).toBeVisible({ timeout: 20_000 });

  const seenFrames = new Set<string>();
  await expect
    .poll(
      async () => {
        const frame = await page.locator(host).getAttribute('data-platform-frame');
        if (frame) seenFrames.add(frame);
        return seenFrames.size;
      },
      { timeout: 5_000, message: 'expected both animation frames to appear' },
    )
    .toBeGreaterThanOrEqual(2);

  expect([...seenFrames].sort()).toEqual(['0', '1']);
});
