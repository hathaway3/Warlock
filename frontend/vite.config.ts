import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/dist/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      // Baseline floor set a few points below current coverage to catch regressions
      // without blocking on the existing gap; raise these as coverage improves.
      thresholds: {
        statements: 30,
        branches: 30,
        functions: 18,
        lines: 30,
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3077',
        changeOrigin: true,
      },
      '/assets/media': {
        target: 'http://127.0.0.1:3077',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
    // Ship sourcemaps for local/dev builds only — production bundles shouldn't expose original source.
    sourcemap: mode !== 'production',
  },
}));
