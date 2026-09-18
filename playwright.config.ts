import { defineConfig, devices } from '@playwright/test';

/**
 * Escape hatch for environments that ship a pre-installed Chromium instead of
 * running `npx playwright install` (sandboxes, locked-down CI images). Unset in
 * normal use, where Playwright resolves its own browser.
 */
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'];
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
    // Phone-first delivery (SPEC 2), so the smoke test runs at phone size too.
    { name: 'phone', use: { ...devices['Pixel 5'], ...launchOptions } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
