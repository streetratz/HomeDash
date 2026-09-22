/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WidgetView } from '../../../state/dashboards.js';
import { DockerWidget } from '../DockerWidget.js';

const mocks = vi.hoisted(() => ({
  useDockerHosts: vi.fn(),
  useDockerContainers: vi.fn(),
}));

vi.mock('../../../hooks/useDocker.js', () => ({
  useDockerHosts: mocks.useDockerHosts,
  useDockerContainers: mocks.useDockerContainers,
  useDockerAction: () => ({ isPending: false, mutate: vi.fn() }),
  classifyDockerError: (error: unknown) => ({
    kind: 'unreachable',
    message: error instanceof Error ? error.message : 'offline',
  }),
}));

vi.mock('../../../state/bootstrap.js', () => ({
  useBootstrap: () => ({ user: { role: 'standard' } }),
}));

const widget: WidgetView = {
  id: 'widget-1',
  type: 'docker',
  orderIndex: 0,
  config: {},
  links: [],
};

const container = {
  id: 'container-1',
  name: 'watchtower',
  state: 'running' as const,
  status: 'Up 2 hours',
  image: 'containrrr/watchtower',
  ports: [],
  created: Math.floor(Date.now() / 1000) - 120,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DockerWidget multi-host rendering', () => {
  it('keeps a single host visually unchanged without a host heading', () => {
    mocks.useDockerHosts.mockReturnValue({
      data: { hosts: [{ connectionId: 'host-a', name: 'Primary host' }] },
      isLoading: false,
      error: null,
    });
    mocks.useDockerContainers.mockReturnValue({
      data: { containers: [container] },
      isLoading: false,
      error: null,
    });

    render(<DockerWidget widget={widget} />);

    expect(screen.getByText('watchtower')).toBeTruthy();
    expect(screen.queryByText('Primary host')).toBeNull();
  });

  it('shows each host and keeps one host error isolated', () => {
    mocks.useDockerHosts.mockReturnValue({
      data: {
        hosts: [
          { connectionId: 'host-a', name: 'Primary host' },
          { connectionId: 'host-b', name: 'Garage host' },
        ],
      },
      isLoading: false,
      error: null,
    });
    mocks.useDockerContainers.mockImplementation(
      (_widgetInstanceId: string, connectionId: string) =>
        connectionId === 'host-a'
          ? { data: { containers: [container] }, isLoading: false, error: null }
          : { data: undefined, isLoading: false, error: new Error('connection refused') },
    );

    render(<DockerWidget widget={widget} />);

    expect(screen.getByText('Primary host')).toBeTruthy();
    expect(screen.getByText('Garage host')).toBeTruthy();
    expect(screen.getByText('watchtower')).toBeTruthy();
    expect(screen.getByText('Docker host unreachable')).toBeTruthy();
    expect(screen.getByText('connection refused')).toBeTruthy();
  });
});
