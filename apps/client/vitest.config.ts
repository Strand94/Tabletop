import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Client unit/component test config (jsdom + Testing Library). */
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'client',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
