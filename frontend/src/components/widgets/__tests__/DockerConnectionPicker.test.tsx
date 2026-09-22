/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DockerConnectionPicker } from '../DockerConnectionPicker.js';

const mocks = vi.hoisted(() => ({
  replace: vi.fn<
    [
      body: { widgetInstanceId: string; connectionIds: string[] },
      options: { onSettled: () => void },
    ],
    void
  >(),
  useDockerConnections: vi.fn(),
  useDockerHosts: vi.fn(),
}));

vi.mock('../../../hooks/useConnections.js', () => ({
  useDockerConnections: mocks.useDockerConnections,
  useReplaceDockerWidgetConnections: () => ({
    isPending: false,
    mutate: mocks.replace,
  }),
}));

vi.mock('../../../hooks/useDocker.js', () => ({
  useDockerHosts: mocks.useDockerHosts,
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useDockerConnections.mockReturnValue({
    data: [
      { id: 'host-a', name: 'Primary host', dockerUrl: 'unix:///a.sock' },
      { id: 'host-b', name: 'Garage host', dockerUrl: 'ssh://garage' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  mocks.useDockerHosts.mockReturnValue({
    data: {
      hosts: [
        { connectionId: 'host-a', name: 'Primary host' },
        { connectionId: 'host-b', name: 'Garage host' },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe('DockerConnectionPicker', () => {
  it('saves the selected host order when a host is moved', () => {
    render(<DockerConnectionPicker widgetInstanceId="widget-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Move Garage host up' }));

    const call = mocks.replace.mock.calls[0];
    expect(call?.[0]).toEqual({
      widgetInstanceId: 'widget-1',
      connectionIds: ['host-b', 'host-a'],
    });
    expect(call?.[1].onSettled).toBeTypeOf('function');
  });

  it('removes a host using its labelled selection control', () => {
    render(<DockerConnectionPicker widgetInstanceId="widget-1" />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Primary host/ }));

    const call = mocks.replace.mock.calls[0];
    expect(call?.[0]).toEqual({
      widgetInstanceId: 'widget-1',
      connectionIds: ['host-b'],
    });
    expect(call?.[1].onSettled).toBeTypeOf('function');
  });
});
