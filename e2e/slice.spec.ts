import { expect, test, type Page } from '@playwright/test';
import { parseLevel } from '../src/core/level.js';
import { computeLayout, tileCenter } from '../src/ui/boardLayout.js';
import gate0101 from '../levels/gate-01/gate-01-01.json' with { type: 'json' };

/**
 * The vertical slice, played the way a phone plays it: taps on tiles, nothing
 * else. This is the bar — move, push a block, take the key, open the door,
 * reach the goal — so it is asserted end to end against the production build
 * rather than described in a commit message.
 */

const level = parseLevel(gate0101);
// Matches main.ts's fixed 16:9 viewport (SPEC 30).
const layout = computeLayout(level, { width: 960, height: 540 });

/** Tap the tile at (x, y), converting game coordinates to page coordinates. */
async function tapTile(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator('#game canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  const centre = tileCenter(layout, { x, y });
  await page.mouse.click(
    box.x + (centre.x / 960) * box.width,
    box.y + (centre.y / 540) * box.height,
  );
}

const host = '#game';

async function playerTile(page: Page): Promise<string | null> {
  return page.locator(host).getAttribute('data-player');
}

test('tap through gate-01-01: move, push, take the key, open the door, reach the goal', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });

  // Menu -> level.
  await page.mouse.click(200, 200);
  await expect(page.locator(host)).toHaveAttribute('data-player', '1,1', { timeout: 10_000 });

  // Walk right along the top corridor to the key.
  for (let x = 2; x <= 7; x += 1) {
    await tapTile(page, x, 1);
    await expect(page.locator(host)).toHaveAttribute('data-player', `${x},1`);
  }

  // Take the key: tap yourself.
  await expect(page.locator(host)).toHaveAttribute('data-carrying', '');
  await tapTile(page, 7, 1);
  await expect(page.locator(host)).toHaveAttribute('data-carrying', 'key-lapis');

  // Down the right-hand corridor.
  for (let y = 2; y <= 7; y += 1) {
    await tapTile(page, 7, y);
    await expect(page.locator(host)).toHaveAttribute('data-player', `7,${y}`);
  }

  // Left along the bottom corridor.
  for (let x = 6; x >= 4; x -= 1) {
    await tapTile(page, x, 7);
    await expect(page.locator(host)).toHaveAttribute('data-player', `${x},7`);
  }

  // Push the block: step left into it from 4,7. The block goes 3,7 -> 2,7 and
  // the player takes its place.
  await tapTile(page, 3, 7);
  await expect(page.locator(host)).toHaveAttribute('data-player', '3,7');
  // Step back to the door column.
  await tapTile(page, 4, 7);
  await expect(page.locator(host)).toHaveAttribute('data-player', '4,7');

  // Up through the locked door, which the lapis key opens, then to the goal.
  await tapTile(page, 4, 6);
  await expect(page.locator(host)).toHaveAttribute('data-player', '4,6');
  await tapTile(page, 4, 5);
  await expect(page.locator(host)).toHaveAttribute('data-player', '4,5');
  await tapTile(page, 4, 4);

  await expect(page.locator(host)).toHaveAttribute('data-status', 'won');
  expect(await playerTile(page)).toBe('4,4');
  expect(errors, `page errors: ${errors.join(', ')}`).toHaveLength(0);
});

test('a locked door refuses the player who has no key', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.mouse.click(200, 200);
  await expect(page.locator(host)).toHaveAttribute('data-player', '1,1', { timeout: 10_000 });

  // Straight down the left corridor and along to the door, never taking the key.
  for (let y = 2; y <= 7; y += 1) await tapTile(page, 1, y);
  for (let x = 2; x <= 4; x += 1) await tapTile(page, x, 7);
  await expect(page.locator(host)).toHaveAttribute('data-player', '4,7');

  // The door is at 4,6. Without the key the step is refused and nobody moves.
  await tapTile(page, 4, 6);
  await expect(page.locator(host)).toHaveAttribute('data-player', '4,7');
  await expect(page.locator(host)).toHaveAttribute('data-status', 'playing');
});
