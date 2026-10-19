import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));
const repoNodeModules = path.join(frontendDir, '..', 'node_modules');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Hoisted to the repo root when dev runs from frontend/.
      '@fontsource-variable/jost': path.join(repoNodeModules, '@fontsource-variable/jost'),
    },
  },
  server: {
    port: 5173,
    // If another terminal already runs Vite (common with npm run dev:frontend), use 5174+ instead of failing.
    strictPort: false,
    // Same-origin in development: the browser talks to Vite, which forwards /api to NestJS.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
