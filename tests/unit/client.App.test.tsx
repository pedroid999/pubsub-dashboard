import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { App } from '../../src/client/App.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App (composition)', () => {
  it('renders the header and both panels, driving them via the default fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(((
      input: RequestInfo | URL,
    ) => {
      const url = String(input);
      const headers = new Headers({ 'x-trace-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
      if (url.includes('/api/session')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              projectId: 'my-cool-project',
              identity: 'dev@example.com',
              bindAddress: '127.0.0.1',
              port: 4321,
              startedAt: '2026-05-29T20:00:00.000Z',
              lastTraceId: null,
              version: '0.1.0',
              nodeVersion: 'v20.18.0',
            }),
            { status: 200, headers },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers }));
    }) as typeof fetch);

    render(<App />);

    expect(screen.getByText('Pub/Sub Dashboard')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('my-cool-project')).toBeInTheDocument();
      expect(screen.getByText(/no operations/i)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('renders ProjectBrowser after projects load and shows ResourceBrowser after project selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
      const traceId = 'aaaaaaaa-0001-4000-8000-aaaaaaaaaaaa';
      const headers = new Headers({ 'x-trace-id': traceId, 'content-type': 'application/json' });
      if (url.includes('/api/session')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              projectId: 'my-proj', identity: 'dev@example.com', bindAddress: '127.0.0.1',
              port: 4321, startedAt: '2026-05-29T20:00:00.000Z', lastTraceId: null,
              version: '0.1.0', nodeVersion: 'v20.18.0',
            }),
            { status: 200, headers },
          ),
        );
      }
      if (url.includes('/api/projects') && !url.includes('/topics') && !url.includes('/subscriptions')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              projects: [{ projectId: 'my-proj', displayName: 'My Project', state: 'ACTIVE' }],
              traceId,
            }),
            { status: 200, headers },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ topics: [], subscriptions: [], traceId }), { status: 200, headers }));
    }) as typeof fetch);

    render(<App />);

    await waitFor(() => screen.getByTestId('project-item-my-proj'));
    fireEvent.click(screen.getByTestId('project-item-my-proj'));

    await waitFor(() => {
      expect(screen.getByTestId('topic-search')).toBeTruthy();
    });
  });
});
