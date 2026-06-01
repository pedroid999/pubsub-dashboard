import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { ComposeDraftProvider } from '../../src/client/components/ComposeDraftProvider.js';
import { MessagePublisher } from '../../src/client/components/MessagePublisher.js';
import { MessageReceiver } from '../../src/client/components/MessageReceiver.js';
import { useResourceContext } from '../../src/client/lib/resourceContext.js';

afterEach(cleanup);

const TRACE = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const HEADERS = new Headers({ 'x-trace-id': TRACE, 'content-type': 'application/json' });

function Seed({
  projectId,
  topicName,
  subscriptionName,
}: {
  projectId: string;
  topicName?: string;
  subscriptionName?: string;
}) {
  const { dispatch } = useResourceContext();
  useEffect(() => {
    dispatch({ type: 'SELECT_PROJECT', projectId });
    if (topicName) dispatch({ type: 'SELECT_TOPIC', projectId, topicName });
    if (subscriptionName) dispatch({ type: 'SELECT_SUBSCRIPTION', projectId, subscriptionName });
  }, [dispatch, projectId, topicName, subscriptionName]);
  return null;
}

function renderWithTopic(topicName?: string) {
  return render(
    <ResourceContextProvider>
      <ComposeDraftProvider>
        <Seed projectId="my-proj" topicName={topicName} />
        <MessagePublisher projectId="my-proj" />
      </ComposeDraftProvider>
    </ResourceContextProvider>,
  );
}

function mockPublish(status: number, body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status, headers: HEADERS }));
}

describe('MessagePublisher', () => {
  it('shows guidance when no topic is selected (FR-009)', () => {
    renderWithTopic(undefined);
    expect(screen.getByText('Select a topic to publish a message.')).toBeTruthy();
  });

  it('publishes a body and shows the returned message ID (FR-004)', async () => {
    const fetchSpy = mockPublish(200, { messageId: 'msg-99', traceId: TRACE });
    renderWithTopic('projects/p/topics/orders');

    await waitFor(() => screen.getByTestId('publish-body'));
    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => expect(screen.getByText(/msg-99/)).toBeTruthy());
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    // FR-007: body preserved after success.
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe('hello');
  });

  it('blocks an empty body with a validation message and no request (FR-003)', async () => {
    const fetchSpy = mockPublish(200, { messageId: 'x', traceId: TRACE });
    renderWithTopic('projects/p/topics/orders');

    await waitFor(() => screen.getByTestId('publish-body'));
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards filled attribute rows on publish (US3)', async () => {
    const fetchSpy = mockPublish(200, { messageId: 'm', traceId: TRACE });
    renderWithTopic('projects/p/topics/orders');

    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
    fireEvent.change(screen.getByLabelText('Attribute 1 key'), { target: { value: 'eventType' } });
    fireEvent.change(screen.getByLabelText('Attribute 1 value'), { target: { value: 'paid' } });
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      data: 'x',
      attributes: { eventType: 'paid' },
    });
  });

  it('blocks a duplicate attribute key (FR-006)', async () => {
    const fetchSpy = mockPublish(200, { messageId: 'm', traceId: TRACE });
    renderWithTopic('projects/p/topics/orders');

    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
    fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
    fireEvent.change(screen.getByLabelText('Attribute 1 key'), { target: { value: 'k' } });
    fireEvent.change(screen.getByLabelText('Attribute 1 value'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Attribute 2 key'), { target: { value: 'k' } });
    fireEvent.change(screen.getByLabelText('Attribute 2 value'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(screen.getByText(/Duplicate attribute key/)).toBeTruthy());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('removes an attribute row (US3 AS5)', async () => {
    renderWithTopic('projects/p/topics/orders');
    fireEvent.click(screen.getByRole('button', { name: /add attribute/i }));
    expect(screen.getByLabelText('Attribute 1 key')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /remove attribute 1/i }));
    expect(screen.queryByLabelText('Attribute 1 key')).toBeNull();
  });

  it('preserves the body and shows a permission hint on a 401 error (FR-008)', async () => {
    mockPublish(401, {
      code: 'PERMISSION_DENIED',
      message: 'Missing pubsub.topics.publish permission.',
      traceId: TRACE,
    });
    renderWithTopic('projects/p/topics/orders');

    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: 'keep-me' } });
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(screen.getByText('roles/pubsub.publisher')).toBeTruthy());
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe('keep-me');
  });

  // ---- US1: JSON composition mode (FR-001..FR-008) ----------------------------

  it('blocks publish on invalid JSON in JSON mode and shows the error (FR-003/FR-004)', async () => {
    const fetchSpy = mockPublish(200, { messageId: 'm', traceId: TRACE });
    renderWithTopic('projects/p/topics/orders');

    fireEvent.click(screen.getByRole('button', { name: /^json$/i }));
    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: '{"a": }' } });

    expect(screen.getByTestId('json-invalid')).toBeTruthy();
    expect((screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('enables publish once the JSON is valid (FR-004)', () => {
    renderWithTopic('projects/p/topics/orders');
    fireEvent.click(screen.getByRole('button', { name: /^json$/i }));
    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: '{"a":1}' } });

    expect(screen.getByTestId('json-valid')).toBeTruthy();
    expect((screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('formats a minified valid JSON body in place (FR-005)', () => {
    renderWithTopic('projects/p/topics/orders');
    fireEvent.click(screen.getByRole('button', { name: /^json$/i }));
    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: '{"a":1,"b":2}' } });
    fireEvent.click(screen.getByRole('button', { name: /format json/i }));

    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe(
      '{\n  "a": 1,\n  "b": 2\n}',
    );
  });

  it('preserves the body when toggling JSON ↔ text mode (FR-007)', () => {
    renderWithTopic('projects/p/topics/orders');
    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: '{"x":1}' } });
    fireEvent.click(screen.getByRole('button', { name: /^json$/i }));
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe('{"x":1}');
    fireEvent.click(screen.getByRole('button', { name: /^text$/i }));
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe('{"x":1}');
  });

  // ---- US2/US3: copy a received message to republish (FR-009..FR-016) ----------

  function renderPublishAndReceive(topicName: string, subscriptionName: string) {
    return render(
      <ResourceContextProvider>
        <ComposeDraftProvider>
          <Seed projectId="my-proj" topicName={topicName} subscriptionName={subscriptionName} />
          <MessagePublisher projectId="my-proj" />
          <MessageReceiver projectId="my-proj" />
        </ComposeDraftProvider>
      </ResourceContextProvider>,
    );
  }

  function pulledMessage(over: Record<string, unknown> = {}) {
    return {
      messageId: 'm1',
      ackId: 'ack-1',
      data: '{"k":1}',
      dataEncoding: 'utf-8',
      attributes: { eventType: 'paid' },
      publishTime: '2026-05-31T10:00:00.000Z',
      deliveryAttempt: 1,
      ...over,
    };
  }

  it('copies a received message into the composer (payload + attributes) (FR-010/FR-011)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messages: [pulledMessage()], traceId: TRACE }), {
        status: 200,
        headers: HEADERS,
      }),
    );
    renderPublishAndReceive('projects/p/topics/orders', 'projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByRole('button', { name: /copy to publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy to publish/i }));

    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe(
      '{\n  "k": 1\n}',
    );
    expect((screen.getByLabelText('Attribute 1 key') as HTMLInputElement).value).toBe('eventType');
    expect((screen.getByLabelText('Attribute 1 value') as HTMLInputElement).value).toBe('paid');
    expect(screen.getByTestId('json-valid')).toBeTruthy();
  });

  it('parks a replace-confirm when copying over a dirty composer; Cancel keeps the draft (FR-012)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messages: [pulledMessage()], traceId: TRACE }), {
        status: 200,
        headers: HEADERS,
      }),
    );
    renderPublishAndReceive('projects/p/topics/orders', 'projects/p/subscriptions/orders-sub');

    fireEvent.change(screen.getByTestId('publish-body'), { target: { value: 'in-progress' } });
    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByRole('button', { name: /copy to publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy to publish/i }));

    // Draft not overwritten; banner asks for confirmation.
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe('in-progress');
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe('in-progress');

    // Copy again and Replace this time.
    fireEvent.click(screen.getByRole('button', { name: /copy to publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /^replace$/i }));
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe(
      '{\n  "k": 1\n}',
    );
  });

  it('disables Copy to publish for a binary (base64) message (FR-014)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [pulledMessage({ data: '//79', dataEncoding: 'base64' })],
          traceId: TRACE,
        }),
        { status: 200, headers: HEADERS },
      ),
    );
    renderPublishAndReceive('projects/p/topics/orders', 'projects/p/subscriptions/orders-sub');

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByRole('button', { name: /copy to publish/i }));
    expect(
      (screen.getByRole('button', { name: /copy to publish/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('keeps the copied draft when the active topic changes (FR-018)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messages: [pulledMessage()], traceId: TRACE }), {
        status: 200,
        headers: HEADERS,
      }),
    );
    const SwitchTopic = () => {
      const { dispatch } = useResourceContext();
      return (
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'SELECT_TOPIC',
              projectId: 'my-proj',
              topicName: 'projects/p/topics/other',
            })
          }
        >
          switch-topic
        </button>
      );
    };
    render(
      <ResourceContextProvider>
        <ComposeDraftProvider>
          <Seed
            projectId="my-proj"
            topicName="projects/p/topics/orders"
            subscriptionName="projects/p/subscriptions/orders-sub"
          />
          <SwitchTopic />
          <MessagePublisher projectId="my-proj" />
          <MessageReceiver projectId="my-proj" />
        </ComposeDraftProvider>
      </ResourceContextProvider>,
    );

    fireEvent.click(screen.getByTestId('pull-button'));
    await waitFor(() => screen.getByRole('button', { name: /copy to publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy to publish/i }));
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe(
      '{\n  "k": 1\n}',
    );

    fireEvent.click(screen.getByRole('button', { name: /switch-topic/i }));

    // Draft persists; target updated to the new topic.
    expect((screen.getByTestId('publish-body') as HTMLTextAreaElement).value).toBe(
      '{\n  "k": 1\n}',
    );
    expect(screen.getByTitle('projects/p/topics/other')).toBeTruthy();
  });
});
