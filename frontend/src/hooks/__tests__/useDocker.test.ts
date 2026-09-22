/**
 * @vitest-environment jsdom
 *
 * Set per file rather than globally: the other hook tests in this suite run
 * without a DOM, and switching the project default would change their
 * environment for no reason.
 */
/**
 * T062 (043 / US3): the Docker hooks must never send an endpoint.
 *
 * These assert the *request shape*, not the rendering. The regression they
 * guard is specific: the listing used to accept `?url=` and the action used to
 * carry `dockerUrl`, and the widget supplied `unix:///var/run/docker.sock` as
 * its default — so a widget wired to a remote host stopped local containers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import * as apiClientModule from '../../lib/apiClient.js';
import * as useDockerModule from '../useDocker.js';
import {
  useDockerAction,
  useDockerContainers,
  useDockerHosts,
  classifyDockerError,
} from '../useDocker.js';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useDocker — request shape', () => {
  type ApiGet = typeof apiClientModule.apiClient.get;
  type ApiPost = typeof apiClientModule.apiClient.post;

  let getSpy: MockInstance<Parameters<ApiGet>, ReturnType<ApiGet>>;
  let postSpy: MockInstance<Parameters<ApiPost>, ReturnType<ApiPost>>;
  let fetchSpy: MockInstance<Parameters<typeof fetch>, ReturnType<typeof fetch>>;

  beforeEach(() => {
    getSpy = vi.spyOn(apiClientModule.apiClient, 'get').mockResolvedValue({ containers: [] });
    postSpy = vi.spyOn(apiClientModule.apiClient, 'post').mockResolvedValue({ ok: true });
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists through apiClient, not bare fetch', async () => {
    renderHook(() => useDockerContainers('widget-1', 'connection-1'), { wrapper });
    await waitFor(() => expect(getSpy).toHaveBeenCalled());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads host metadata without exposing endpoint selection', async () => {
    renderHook(() => useDockerHosts('widget-1'), { wrapper });
    await waitFor(() => expect(getSpy).toHaveBeenCalled());

    const path = getSpy.mock.calls[0]![0];
    const query = new URLSearchParams(path.split('?')[1] ?? '');
    expect(path.split('?')[0]).toBe('/api/docker/hosts');
    expect(query.get('widgetInstanceId')).toBe('widget-1');
    expect([...query.keys()]).toEqual(['widgetInstanceId']);
  });

  it('sends widget and connection IDs but never an endpoint', async () => {
    renderHook(() => useDockerContainers('widget-1', 'connection-1'), { wrapper });
    await waitFor(() => expect(getSpy).toHaveBeenCalled());

    const path = getSpy.mock.calls[0]![0];
    const query = new URLSearchParams(path.split('?')[1] ?? '');
    expect(query.get('widgetInstanceId')).toBe('widget-1');
    expect(query.get('connectionId')).toBe('connection-1');
    expect([...query.keys()].sort()).toEqual(['all', 'connectionId', 'widgetInstanceId']);
    expect(path).not.toContain('url=');
    expect(path).not.toContain('docker.sock');
  });

  it('sends an action body with the owning widget and connection IDs', async () => {
    const { result } = renderHook(
      () => useDockerAction('widget-1', 'connection-1'),
      { wrapper },
    );
    result.current.mutate({ containerId: 'abc123', action: 'stop' });

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    expect(postSpy.mock.calls[0]![0]).toBe('/api/docker/action');
    expect(postSpy.mock.calls[0]![1]).toEqual({
      widgetInstanceId: 'widget-1',
      connectionId: 'connection-1',
      containerId: 'abc123',
      action: 'stop',
    });
    expect(JSON.stringify(postSpy.mock.calls[0]![1])).not.toContain('docker.sock');
  });

  it('no longer exports useDockerPing — the route it called is gone', () => {
    expect(useDockerModule).not.toHaveProperty('useDockerPing');
  });
});

describe('classifyDockerError', () => {
  it.each([
    ['DOCKER_ENDPOINT_NOT_CONFIGURED', 'not_configured'],
    ['DOCKER_INVALID_ENDPOINT', 'invalid_endpoint'],
    ['DOCKER_ENDPOINT_UNREACHABLE', 'unreachable'],
    ['DOCKER_REMOTE_UNAVAILABLE', 'unreachable'],
    ['DOCKER_SSH_AUTH_FAILED', 'ssh_auth'],
    ['DOCKER_SSH_HOST_KEY_FAILED', 'ssh_host_key'],
    ['DOCKER_SSH_CLIENT_MISSING', 'ssh_client_missing'],
    ['DOCKER_API_VERSION_UNSUPPORTED', 'api_version'],
    ['UNAUTHORIZED', 'unauthorized'],
  ])('maps %s to %s', (code, kind) => {
    const err = new apiClientModule.ApiRequestError(502, { error: code, message: 'detail' });
    expect(classifyDockerError(err)).toEqual({ kind, message: 'detail' });
  });

  it('keeps misconfiguration and unreachability distinct', () => {
    const notConfigured = new apiClientModule.ApiRequestError(409, {
      error: 'DOCKER_ENDPOINT_NOT_CONFIGURED',
      message: 'no connection',
    });
    const unreachable = new apiClientModule.ApiRequestError(502, {
      error: 'DOCKER_ENDPOINT_UNREACHABLE',
      message: 'no answer',
    });
    expect(classifyDockerError(notConfigured).kind).not.toBe(classifyDockerError(unreachable).kind);
  });

  it('falls back to unknown for an unrecognised code', () => {
    const err = new apiClientModule.ApiRequestError(500, { error: 'INTERNAL', message: 'boom' });
    expect(classifyDockerError(err).kind).toBe('unknown');
  });

  it('handles a non-API error', () => {
    expect(classifyDockerError(new Error('offline'))).toEqual({
      kind: 'unknown',
      message: 'offline',
    });
  });
});
