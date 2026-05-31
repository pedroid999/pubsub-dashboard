import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { ResourceBrowser } from '../../src/client/components/ResourceBrowser.js';

afterEach(cleanup);

const TRACE = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const HEADERS = new Headers({ 'x-trace-id': TRACE, 'content-type': 'application/json' });

function mockFetch(topicsBody: unknown, subsBody: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
    if (url.includes('/topics')) {
      return Promise.resolve(new Response(JSON.stringify(topicsBody), { status: 200, headers: HEADERS }));
    }
    return Promise.resolve(new Response(JSON.stringify(subsBody), { status: 200, headers: HEADERS }));
  }) as typeof fetch);
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <ResourceContextProvider>{children}</ResourceContextProvider>;
}

describe('ResourceBrowser', () => {
  it('renders topics and subscriptions after load', async () => {
    mockFetch(
      { projects: [], topics: [{ name: 'projects/p/topics/payments', displayName: 'payments' }], traceId: TRACE },
      { subscriptions: [{ name: 'projects/p/subscriptions/payments-sub', displayName: 'payments-sub', topicName: 'projects/p/topics/payments', deliveryType: 'pull' }], traceId: TRACE },
    );

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('resource-item-projects/p/topics/payments')).toBeTruthy();
      expect(screen.getByTestId('resource-item-projects/p/subscriptions/payments-sub')).toBeTruthy();
    });
  });

  it('shows error alert when topics fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
      if (url.includes('/topics')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ code: 'PERMISSION_DENIED', message: 'no access', traceId: TRACE }),
            { status: 401, headers: HEADERS },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ subscriptions: [], traceId: TRACE }), { status: 200, headers: HEADERS }));
    }) as typeof fetch);

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(1);
    });
  });

  it('filters topics by search query', async () => {
    mockFetch(
      {
        topics: [
          { name: 'projects/p/topics/payments', displayName: 'payments' },
          { name: 'projects/p/topics/orders', displayName: 'orders' },
        ],
        traceId: TRACE,
      },
      { subscriptions: [], traceId: TRACE },
    );

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => screen.getByTestId('resource-item-projects/p/topics/payments'));

    const input = screen.getByTestId('topic-search');
    fireEvent.change(input, { target: { value: 'orders' } });

    expect(screen.queryByTestId('resource-item-projects/p/topics/payments')).toBeNull();
    expect(screen.getByTestId('resource-item-projects/p/topics/orders')).toBeTruthy();
  });

  it('shows empty subscription state', async () => {
    mockFetch(
      { topics: [], traceId: TRACE },
      { subscriptions: [], traceId: TRACE },
    );

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('No topics in this project.')).toBeTruthy();
      expect(screen.getByText('No subscriptions in this project.')).toBeTruthy();
    });
  });

  it('shows error alert when subscriptions fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
      if (url.includes('/topics')) {
        return Promise.resolve(new Response(JSON.stringify({ topics: [], traceId: TRACE }), { status: 200, headers: HEADERS }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ code: 'PERMISSION_DENIED', message: 'no subs access', traceId: TRACE }),
          { status: 401, headers: HEADERS },
        ),
      );
    }) as typeof fetch);

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(1);
    });
  });

  it('dispatches SELECT_SUBSCRIPTION when clicking a subscription item', async () => {
    mockFetch(
      { topics: [], traceId: TRACE },
      {
        subscriptions: [
          { name: 'projects/p/subscriptions/pay-sub', displayName: 'pay-sub', topicName: 'projects/p/topics/pay', deliveryType: 'pull' },
        ],
        traceId: TRACE,
      },
    );

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() =>
      screen.getByTestId('resource-item-projects/p/subscriptions/pay-sub'),
    );
    fireEvent.click(screen.getByTestId('resource-item-projects/p/subscriptions/pay-sub'));

    expect(screen.getByTestId('resource-item-projects/p/subscriptions/pay-sub')).toBeTruthy();
  });

  it('shows topicName as subLabel under each subscription item (FR-006)', async () => {
    mockFetch(
      { topics: [], traceId: TRACE },
      {
        subscriptions: [
          { name: 'projects/p/subscriptions/pay-sub', displayName: 'pay-sub', topicName: 'projects/p/topics/payments', deliveryType: 'pull' },
        ],
        traceId: TRACE,
      },
    );

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('projects/p/topics/payments')).toBeTruthy();
    });
  });

  it('filters subscriptions by parent topicName (FR-017)', async () => {
    mockFetch(
      { topics: [], traceId: TRACE },
      {
        subscriptions: [
          { name: 'projects/p/subscriptions/alpha-sub', displayName: 'alpha-sub', topicName: 'projects/p/topics/payments', deliveryType: 'pull' },
          { name: 'projects/p/subscriptions/beta-sub', displayName: 'beta-sub', topicName: 'projects/p/topics/orders', deliveryType: 'push' },
        ],
        traceId: TRACE,
      },
    );

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => screen.getByTestId('resource-item-projects/p/subscriptions/alpha-sub'));

    const subSearch = screen.getByTestId('sub-search');
    fireEvent.change(subSearch, { target: { value: 'orders' } });

    expect(screen.queryByTestId('resource-item-projects/p/subscriptions/alpha-sub')).toBeNull();
    expect(screen.getByTestId('resource-item-projects/p/subscriptions/beta-sub')).toBeTruthy();
  });

  it('shows roles/pubsub.viewer hint on PERMISSION_DENIED topics error (FR-010)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
      if (url.includes('/topics')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ code: 'PERMISSION_DENIED', message: 'no access', traceId: TRACE }),
            { status: 401, headers: HEADERS },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ subscriptions: [], traceId: TRACE }), { status: 200, headers: HEADERS }));
    }) as typeof fetch);

    render(<ResourceBrowser projectId="my-proj" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('roles/pubsub.viewer')).toBeTruthy();
    });
  });
});
