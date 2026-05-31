import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { MessagePublisher } from '../../src/client/components/MessagePublisher.js';
import { useResourceContext } from '../../src/client/lib/resourceContext.js';

afterEach(cleanup);

const TRACE = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const HEADERS = new Headers({ 'x-trace-id': TRACE, 'content-type': 'application/json' });

function Seed({ projectId, topicName }: { projectId: string; topicName?: string }) {
  const { dispatch } = useResourceContext();
  useEffect(() => {
    dispatch({ type: 'SELECT_PROJECT', projectId });
    if (topicName) dispatch({ type: 'SELECT_TOPIC', projectId, topicName });
  }, [dispatch, projectId, topicName]);
  return null;
}

function renderWithTopic(topicName?: string) {
  return render(
    <ResourceContextProvider>
      <Seed projectId="my-proj" topicName={topicName} />
      <MessagePublisher projectId="my-proj" />
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
});
