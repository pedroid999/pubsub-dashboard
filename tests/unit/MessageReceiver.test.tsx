import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { ComposeDraftProvider } from '../../src/client/components/ComposeDraftProvider.js';
import { MessageReceiver } from '../../src/client/components/MessageReceiver.js';
import { useResourceContext } from '../../src/client/lib/resourceContext.js';
import type { ReceivedMessage } from '../../src/server/schemas/messaging.js';

afterEach(cleanup);

const TRACE = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const HEADERS = new Headers({ 'x-trace-id': TRACE, 'content-type': 'application/json' });

function Seed({ projectId, subscriptionName }: { projectId: string; subscriptionName?: string }) {
  const { dispatch } = useResourceContext();
  useEffect(() => {
    dispatch({ type: 'SELECT_PROJECT', projectId });
    if (subscriptionName) dispatch({ type: 'SELECT_SUBSCRIPTION', projectId, subscriptionName });
  }, [dispatch, projectId, subscriptionName]);
  return null;
}

function renderWithSub(subscriptionName?: string) {
  return render(
    <ResourceContextProvider>
      <ComposeDraftProvider>
        <Seed projectId="my-proj" subscriptionName={subscriptionName} />
        <MessageReceiver projectId="my-proj" />
      </ComposeDraftProvider>
    </ResourceContextProvider>,
  );
}

function msg(over: Partial<ReceivedMessage> = {}): ReceivedMessage {
  return {
    messageId: 'm1',
    ackId: 'ack-1',
    data: '{"k":1}',
    dataEncoding: 'utf-8',
    attributes: { eventType: 'x' },
    publishTime: '2026-05-31T10:00:00.000Z',
    deliveryAttempt: 1,
    ...over,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

describe('MessageReceiver', () => {
  it('shows guidance when no subscription is selected (FR-015)', () => {
    renderWithSub(undefined);
    expect(screen.getByText('Select a subscription to pull messages.')).toBeTruthy();
  });

  it('pulls and renders a message with pretty-printed JSON and attributes (FR-012/FR-027)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { messages: [msg()], traceId: TRACE }),
    );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));

    // The payload is JSON-highlighted (US6) — assert on the <pre> textContent,
    // which concatenates the token spans back into the pretty-printed JSON.
    await waitFor(() => {
      const pre = document.querySelector('pre');
      expect(pre?.textContent).toContain('"k": 1');
    });
    expect(screen.getByText('eventType=x')).toBeTruthy();
    expect(screen.getByText('m1')).toBeTruthy();
  });

  it('shows a distinct empty state when no messages are available (FR-013)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { messages: [], traceId: TRACE }),
    );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => expect(screen.getByText('No messages currently available.')).toBeTruthy());
  });

  it('renders a non-UTF-8 payload as a labelled binary block (FR-014)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        messages: [msg({ data: '//79', dataEncoding: 'base64' })],
        traceId: TRACE,
      }),
    );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => expect(screen.getByText('binary (base64)')).toBeTruthy());
  });

  it('appends successive pulls and clears the running list (FR-026)', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, { messages: [msg({ messageId: 'a' })], traceId: TRACE }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { messages: [msg({ messageId: 'b' })], traceId: TRACE }),
      );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByText('a'));
    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByText('b'));

    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /clear messages/i }));
    expect(screen.queryByText('a')).toBeNull();
    expect(screen.queryByText('b')).toBeNull();
  });

  it('shows an error with retry and permission hint on 401 (FR-021)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, {
        code: 'PERMISSION_DENIED',
        message: 'Missing pubsub.subscriptions.consume permission.',
        traceId: TRACE,
      }),
    );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => expect(screen.getByText('roles/pubsub.subscriber')).toBeTruthy());
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('acknowledges a message and marks it acknowledged (FR-019)', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { messages: [msg()], traceId: TRACE }))
      .mockResolvedValueOnce(
        jsonResponse(200, { acknowledged: ['ack-1'], expired: [], traceId: TRACE }),
      );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByRole('button', { name: /acknowledge/i }));
    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }));

    await waitFor(() => expect(screen.getByText('Acknowledged')).toBeTruthy());
  });

  it('shows a non-fatal hint when the ack window has expired (FR-020)', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { messages: [msg()], traceId: TRACE }))
      .mockResolvedValueOnce(
        jsonResponse(200, { acknowledged: [], expired: ['ack-1'], traceId: TRACE }),
      );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByRole('button', { name: /acknowledge/i }));
    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }));

    await waitFor(() => expect(screen.getByText(/window expired/i)).toBeTruthy());
  });

  it('offers Copy to publish on a utf-8 message and disables it for binary (FR-009/FR-014)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        messages: [msg(), msg({ messageId: 'm2', data: '//79', dataEncoding: 'base64' })],
        traceId: TRACE,
      }),
    );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByText('m2'));

    const copyButtons = screen.getAllByRole('button', { name: /copy to publish/i });
    expect(copyButtons).toHaveLength(2);
    expect((copyButtons[0] as HTMLButtonElement).disabled).toBe(false); // utf-8
    expect((copyButtons[1] as HTMLButtonElement).disabled).toBe(true); // base64
  });
});

// ---- US7: opt-in auto-poll (R1–R7, SC-006) ----------------------------------

describe('MessageReceiver · US7 auto-poll', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('R3: manual Pull is available and Auto is off by default (no indicator)', () => {
    renderWithSub('projects/p/subscriptions/orders-sub');
    expect(screen.getByTestId('pull-button')).toBeInTheDocument();
    expect(screen.getByTestId('auto-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('auto-indicator')).toBeNull();
  });

  it('R1: enabling Auto polls every 2.5s and shows the active indicator', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { messages: [msg()], traceId: TRACE }));
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('auto-toggle'));
    expect(screen.getByTestId('auto-indicator')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2500);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2500);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('R2/R6: disabling Auto stops polling within one interval', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { messages: [msg()], traceId: TRACE }));
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('auto-toggle'));
    await vi.advanceTimersByTimeAsync(2500);
    expect(spy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('auto-toggle')); // disable
    expect(screen.queryByTestId('auto-indicator')).toBeNull();
    await vi.advanceTimersByTimeAsync(7500);
    expect(spy).toHaveBeenCalledTimes(1); // no further polls
  });

  it('R5: unmounting clears the interval (no background polling)', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { messages: [msg()], traceId: TRACE }));
    const { unmount } = renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('auto-toggle'));
    await vi.advanceTimersByTimeAsync(2500);
    expect(spy).toHaveBeenCalledTimes(1);

    unmount();
    await vi.advanceTimersByTimeAsync(7500);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('R7: a failed pull pauses Auto pending user action', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, {
        code: 'PERMISSION_DENIED',
        message: 'Missing pubsub.subscriptions.consume permission.',
        traceId: TRACE,
      }),
    );
    renderWithSub('projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('auto-toggle'));
    await vi.advanceTimersByTimeAsync(2500);
    expect(spy).toHaveBeenCalledTimes(1);
    // Auto paused: indicator gone, no further polling.
    expect(screen.queryByTestId('auto-indicator')).toBeNull();
    await vi.advanceTimersByTimeAsync(7500);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('R4: changing the active subscription stops Auto and clears the list', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse(200, { messages: [msg({ messageId: 'keep' })], traceId: TRACE }),
      );

    const tree = (sub: string) => (
      <ResourceContextProvider>
        <ComposeDraftProvider>
          <Seed projectId="my-proj" subscriptionName={sub} />
          <MessageReceiver projectId="my-proj" />
        </ComposeDraftProvider>
      </ResourceContextProvider>
    );
    const { rerender } = render(tree('projects/p/subscriptions/sub-a'));

    fireEvent.click(screen.getByTestId('auto-toggle'));
    await vi.advanceTimersByTimeAsync(2500);
    expect(screen.getByText('keep')).toBeInTheDocument();

    rerender(tree('projects/p/subscriptions/sub-b'));
    // Auto stopped (indicator gone) and the previous list was cleared.
    expect(screen.queryByTestId('auto-indicator')).toBeNull();
    expect(screen.queryByText('keep')).toBeNull();
    await vi.advanceTimersByTimeAsync(7500);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
