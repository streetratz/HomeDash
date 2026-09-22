import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

function getGitCommit(): string {
  if (process.env['VITE_GIT_COMMIT'] && process.env['VITE_GIT_COMMIT'] !== 'unknown') {
    return process.env['VITE_GIT_COMMIT'].slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function readChangelog(): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, '../CHANGELOG.md'), 'utf-8');
  } catch {
    return '';
  }
}

function getAppVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(getGitCommit()),
    __GIT_REPO__: JSON.stringify('streetratz/HomeDash'),
    __CHANGELOG__: JSON.stringify(readChangelog()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/favicon.ico': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          grid: ['react-grid-layout'],
        },
      },
    },
  },
});
