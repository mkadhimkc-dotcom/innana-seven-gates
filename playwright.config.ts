import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Escape hatch for environments that ship a pre-installed Chromium instead of
 * running `npx playwright install` (sandboxes, locked-down CI images, the
 * Claude Code cloud environment). `PLAYWRIGHT_CHROMIUM_EXECUTABLE` overrides
 * explicitly; otherwise, when `PLAYWRIGHT_BROWSERS_PATH` points at a browser
 * cache, look for a `chromium-*` revision there. This matters because the
 * pre-installed revision can trail the one `@playwright/test`'s resolved
 * version expects, which makes the default browser resolution fail even
 * though a working Chromium sits right next to it. Local dev and GitHub
 * Actions (which run `npx playwright install`) never set
 * `PLAYWRIGHT_BROWSERS_PATH`, so this is a no-op there.
 */
function findPreinstalledChromium(): string | undefined {
  const explicit = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'];
  if (explicit) return explicit;

  const browsersPath = process.env['PLAYWRIGHT_BROWSERS_PATH'];
  if (!browsersPath || !existsSync(browsersPath)) return undefined;

  const revision = readdirSync(browsersPath).find((name) => /^chromium-\d+$/.test(name));
  if (!revision) return undefined;

  const executable = join(browsersPath, revision, 'chrome-linux', 'chrome');
  return existsSync(executable) ? executable : undefined;
}

const executablePath = findPreinstalledChromium();
const launchOptions = executablePath ? { launchOptions: { executablePath } } : {};

/**
 * `npm run e2e` — gameplay smoke test (SPEC 50) against the production build,
 * so what CI checks is what Cloudflare Pages serves.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...launchOptions } },
    // Phone-first delivery, locked to landscape (SPEC 2, 30), so the smoke
    // test runs at phone size in the orientation the game actually plays in.
    { name: 'phone', use: { ...devices['Pixel 5 landscape'], ...launchOptions } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
