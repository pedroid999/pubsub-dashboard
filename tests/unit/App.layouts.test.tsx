import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { ComposeDraftProvider } from '../../src/client/components/ComposeDraftProvider.js';
import { AppearanceProvider, useAppearance } from '../../src/client/lib/appearance.js';
import { WorkspaceBody } from '../../src/client/App.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function mockFetch(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(((input: RequestInfo | URL) => {
    const url = String(input);
    const headers = new Headers({ 'x-trace-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (url.includes('/topics')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            topics: [{ name: 'projects/p1/topics/orders', displayName: 'orders' }],
            traceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          }),
          { status: 200, headers },
        ),
      );
    }
    if (url.includes('/subscriptions')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ subscriptions: [], traceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
          { status: 200, headers },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers }));
  }) as typeof fetch);
}

/** Test harness exposing layout switching + the live layout value. */
function LayoutHarness(): JSX.Element {
  const { prefs, setLayout } = useAppearance();
  return (
    <>
      <div data-testid="active-layout">{prefs.layout}</div>
      <button onClick={() => setLayout('rail')}>go-rail</button>
      <button onClick={() => setLayout('triptych')}>go-triptych</button>
      <button onClick={() => setLayout('console')}>go-console</button>
      <WorkspaceBody projectId="p1" />
    </>
  );
}

function renderWorkspace(): void {
  render(
    <AppearanceProvider>
      <ResourceContextProvider>
        <ComposeDraftProvider>
          <LayoutHarness />
        </ComposeDraftProvider>
      </ResourceContextProvider>
    </AppearanceProvider>,
  );
}

describe('WorkspaceBody layouts (US3)', () => {
  it('renders the Rail layout by default with resources + publisher + receiver', async () => {
    mockFetch();
    renderWorkspace();
    expect(screen.getByTestId('active-layout')).toHaveTextContent('rail');
    expect(document.querySelector('[data-layout="rail"]')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('topic-search')).toBeInTheDocument());
    expect(screen.getByText(/Select a topic to publish/)).toBeInTheDocument();
    expect(screen.getByText(/Select a subscription to pull/)).toBeInTheDocument();
  });

  it('renders each layout with all panels present', async () => {
    mockFetch();
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('topic-search')).toBeInTheDocument());

    fireEvent.click(screen.getByText('go-triptych'));
    expect(screen.getByTestId('active-layout')).toHaveTextContent('triptych');
    expect(document.querySelector('[data-layout="triptych"]')).toBeInTheDocument();
    // Triptych uses a tabbed resources panel (FR-011).
    expect(screen.getByTestId('resource-tab-topics')).toBeInTheDocument();
    expect(screen.getByTestId('resource-tab-subscriptions')).toBeInTheDocument();

    fireEvent.click(screen.getByText('go-console'));
    expect(screen.getByTestId('active-layout')).toHaveTextContent('console');
    expect(document.querySelector('[data-layout="console"]')).toBeInTheDocument();
    expect(screen.getByTestId('topic-search')).toBeInTheDocument();
  });

  it('keeps the active topic selection and compose draft across layout switches (SC-003)', async () => {
    mockFetch();
    renderWorkspace();

    const topicBtn = await screen.findByTestId('resource-item-projects/p1/topics/orders');
    fireEvent.click(topicBtn);

    // With a topic selected the publisher editor is live; type a draft.
    const body = await screen.findByTestId('publish-body');
    fireEvent.change(body, { target: { value: '{"hello":"world"}' } });
    expect((body as HTMLTextAreaElement).value).toBe('{"hello":"world"}');

    // Switch Rail → Triptych → Console: selection + draft must survive.
    fireEvent.click(screen.getByText('go-triptych'));
    const bodyTri = screen.getByTestId('publish-body') as HTMLTextAreaElement;
    expect(bodyTri.value).toBe('{"hello":"world"}');

    fireEvent.click(screen.getByText('go-console'));
    const bodyCon = screen.getByTestId('publish-body') as HTMLTextAreaElement;
    expect(bodyCon.value).toBe('{"hello":"world"}');

    // The selected topic id is still shown in the publisher header.
    const publishHeader = bodyCon.closest('.panel') as HTMLElement;
    expect(within(publishHeader).getByText('orders')).toBeInTheDocument();
  });

  it('persists the chosen layout to localStorage', async () => {
    mockFetch();
    renderWorkspace();
    fireEvent.click(screen.getByText('go-console'));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('pubsub-dashboard:appearance') ?? '{}');
      expect(stored.layout).toBe('console');
    });
  });
});
