// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackupRestoreSection } from '../../src/components/settings/BackupRestoreSection.js';
vi.mock('../../src/state/backupHooks.js', () => ({
  useDownloadBackup: () => ({ isPending: false, mutate: vi.fn() }),
  useDownloadFullBackup: () => ({ isPending: false, mutate: vi.fn() }),
  usePreviewRestore: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useExecuteRestore: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
describe('collection restore compatibility copy', () => {
  it('warns v1 removes collections and v2 needs an upgraded reader', () => {
    render(<BackupRestoreSection />);
    expect(screen.getByText(/Restoring v1 replaces current collections with none/)).toBeTruthy();
    expect(screen.getByText(/older readers must be upgraded/)).toBeTruthy();
  });
});
