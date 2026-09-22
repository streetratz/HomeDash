import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Do not fail when no test files exist (test files are added phase by phase)
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
    // Tests run sequentially to avoid SQLite contention
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
