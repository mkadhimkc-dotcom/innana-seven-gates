import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The short commit SHA the running build was built from, so a stale service
 * worker is visible rather than silent (shown in the menu, MenuScene.ts).
 * Prefers the CI/host env var each build platform already sets — Cloudflare
 * Pages' git-connected build (CF_PAGES_COMMIT_SHA) and GitHub Actions
 * (GITHUB_SHA) both build in a shallow checkout where `git` may not see full
 * history — and falls back to `git rev-parse` for local dev/build.
 */
function readBuildSha(): string {
  const fromEnv = process.env['CF_PAGES_COMMIT_SHA'] ?? process.env['GITHUB_SHA'];
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Build config. `npm run build` emits into `dist/`, which Cloudflare Pages
 * serves (SPEC 51). Performance budget is 5 MB uncompressed (SPEC 31).
 */
export default defineConfig({
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(readBuildSha()),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    // Warn well before the SPEC 31 budget, so growth is noticed early.
    chunkSizeWarningLimit: 2_000,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Inanna: Seven Gates',
        short_name: 'Inanna',
        description: 'A deadlock-free 2D Mesopotamian puzzle-platformer.',
        theme_color: '#1c2b4a',
        background_color: '#1c2b4a',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // The game is fully playable offline once installed (SPEC 2).
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // A waiting worker takes over immediately instead of waiting for every
        // tab to close, so `registerType: 'autoUpdate'`'s silent refresh
        // actually serves the new build rather than the stale cached one.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
