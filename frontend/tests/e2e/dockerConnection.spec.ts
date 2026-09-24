/**
 * T063 (043 / US3): endpoint-format validation messaging in the Docker
 * connection form.
 *
 * The point of these is FR-020/SC-003: a rejected endpoint must tell the user
 * what *is* accepted, at the moment they try to save or test — not a bare
 * "invalid URL". The two rejections covered are the common mistakes: an
 * `http://` URL (Docker's TCP scheme is `tcp://`, and `https://` for TLS), and
 * a bare `host:port` with no scheme.
 *
 * Requires a running HomeDash server with first-run completed:
 *   pnpm dev    # then, in another shell:
 *   pnpm --filter frontend exec playwright test tests/e2e/dockerConnection.spec.ts
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openDockerForm(page: Page) {
  // Docker is the default service panel on the Integrations tab.
  await page.goto('/settings?tab=integrations');
  await expect(page.getByRole('heading', { name: 'Docker', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Docker endpoint')).toBeVisible();
}

test.describe('Docker connection form — endpoint formats', () => {
  test('states the accepted formats and their default ports before any input', async ({ page }) => {
    await openDockerForm(page);
    const help = page.locator('#docker-url-help');
    await expect(help).toContainText('unix://');
    await expect(help).toContainText('tcp://');
    await expect(help).toContainText('https://');
    await expect(help).toContainText('ssh://');
    await expect(help).toContainText('2375');
    await expect(help).toContainText('2376');
    await expect(help).toContainText('22');
  });

  test('rejects an http:// endpoint and says what is accepted', async ({ page }) => {
    await openDockerForm(page);
    await page.getByLabel('Docker endpoint').fill('http://dockerhost:2375');
    await page.getByRole('button', { name: /test connection/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/tcp:\/\//);
  });

  test('rejects a bare host:port', async ({ page }) => {
    await openDockerForm(page);
    await page.getByLabel('Docker endpoint').fill('dockerhost:2375');
    await page.getByRole('button', { name: /test connection/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/tcp:\/\//);
  });

  test('accepts a tcp:// endpoint — reports connectivity, not a format error', async ({ page }) => {
    await openDockerForm(page);
    // Nothing is listening on this port; the endpoint is nonetheless valid, so
    // the message must be about reachability rather than about the format.
    await page.getByLabel('Docker endpoint').fill('tcp://127.0.0.1:2');
    await page.getByRole('button', { name: /test connection/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/not a supported|accepted forms/i);
  });
});
