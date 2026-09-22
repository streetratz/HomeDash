import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Exclude Playwright E2E tests — they are run via `pnpm test:e2e`
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    passWithNoTests: true,
  },
});
