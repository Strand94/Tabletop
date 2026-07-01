import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite config. In dev, /api is proxied to the Express server on :5470 so the
 * client and API share an origin. Production build emits to dist/, which the
 * server serves statically.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5470',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
