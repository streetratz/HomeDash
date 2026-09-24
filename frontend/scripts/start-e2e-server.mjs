import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const e2eRoot = path.join(frontendRoot, '.e2e');
const dataDir = path.join(e2eRoot, 'data');
const authDir = path.join(e2eRoot, 'auth');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

rmSync(e2eRoot, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
mkdirSync(authDir, { recursive: true });

const build = spawnSync(pnpm, ['--filter', 'frontend', 'build'], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawn(pnpm, ['--filter', 'backend', 'exec', 'tsx', 'src/server.ts'], {
  cwd: repositoryRoot,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: '3000',
    COOKIE_SECURE: 'false',
    HOMEDASH_DATA_DIR: dataDir,
  },
  stdio: 'inherit',
});

const stopServer = (signal) => {
  if (!server.killed) {
    server.kill(signal);
  }
};

process.once('SIGINT', () => stopServer('SIGINT'));
process.once('SIGTERM', () => stopServer('SIGTERM'));
server.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
