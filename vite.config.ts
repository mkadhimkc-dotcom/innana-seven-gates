import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Build config. `npm run build` emits into `dist/`, which Cloudflare Pages
 * serves (SPEC 51). Performance budget is 5 MB uncompressed (SPEC 31).
 */
export default defineConfig({
  base: './',
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
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
