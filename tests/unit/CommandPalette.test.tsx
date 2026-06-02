import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { useResourceContext } from '../../src/client/lib/resourceContext.js';
import { CommandPalette } from '../../src/client/components/CommandPalette.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TRACE = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const HEADERS = new Headers({ 'x-trace-id': TRACE, 'content-type': 'application/json' });

interface MockData {
  projects?: Array<{ projectId: string; displayName: string }>;
  topics?: Array<{ name: string; displayName: string }>;
  subscriptions?: Array<{
    name: string;
    displayName: string;
    topicName: string;
    deliveryType: 'pull' | 'push';
  }>;
}

function mockFetch({ projects = [], topics = [], subscriptions = [] }: MockData) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(((url: string) => {
    const body = (obj: unknown) =>
      Promise.resolve(new Response(JSON.stringify(obj), { status: 200, headers: HEADERS }));
    if (url.includes('/topics')) return body({ topics, traceId: TRACE });
    if (url.includes('/subscriptions')) return body({ subscriptions, traceId: TRACE });
    return body({
      projects: projects.map((p) => ({ ...p, state: 'ACTIVE' })),
      traceId: TRACE,
    });
  }) as typeof fetch);
}

/** Surfaces context state + lets a test pre-select a project. */
function Harness({ initialProject }: { initialProject?: string }): JSX.Element {
  const { state, dispatch } = useResourceContext();
  useEffect(() => {
    if (initialProject) dispatch({ type: 'SELECT_PROJECT', projectId: initialProject });
  }, [dispatch, initialProject]);
  return (
    <>
      <div data-testid="active-project">{state.activeProjectId ?? 'none'}</div>
      <div data-testid="active-topic">
        {(state.activeProjectId &&
          state.contextMap.get(state.activeProjectId)?.selectedTopicName) ||
          'none'}
      </div>
      <CommandPalette />
    </>
  );
}

function renderPalette(initialProject?: string) {
  return render(
    <ResourceContextProvider>
      <Harness initialProject={initialProject} />
    </ResourceContextProvider>,
  );
}

function openWithShortcut() {
  fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
}

describe('CommandPalette (US2 — contracts C1–C11)', () => {
  it('C1: opens centered on ⌘K and lists projects', async () => {
    mockFetch({ projects: [{ projectId: 'proj-1', displayName: 'Project One' }] });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('command-palette');
    await waitFor(() => expect(screen.getByTestId('palette-entry-proj-1')).toBeTruthy());
  });

  it('C2: same shortcut toggles it closed', async () => {
    mockFetch({ projects: [{ projectId: 'proj-1', displayName: 'Project One' }] });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('command-palette');
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('C3: Escape and backdrop click close with no selection change', async () => {
    mockFetch({ projects: [{ projectId: 'proj-1', displayName: 'Project One' }] });
    renderPalette();

    openWithShortcut();
    const input = await screen.findByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('command-palette')).toBeNull();
    expect(screen.getByTestId('active-project').textContent).toBe('none');

    openWithShortcut();
    await screen.findByTestId('command-palette');
    fireEvent.mouseDown(screen.getByTestId('command-palette-backdrop'));
    expect(screen.queryByTestId('command-palette')).toBeNull();
    expect(screen.getByTestId('active-project').textContent).toBe('none');
  });

  it('C4: rows show topics, subscriptions and projects with a kind tag', async () => {
    mockFetch({
      projects: [{ projectId: 'p', displayName: 'P' }],
      topics: [{ name: 'projects/p/topics/payments', displayName: 'payments' }],
      subscriptions: [
        {
          name: 'projects/p/subscriptions/pay-sub',
          displayName: 'pay-sub',
          topicName: 'projects/p/topics/payments',
          deliveryType: 'pull',
        },
      ],
    });
    renderPalette('p');
    openWithShortcut();
    await screen.findByTestId('command-palette');
    await waitFor(() => {
      expect(screen.getByTestId('palette-entry-projects/p/topics/payments')).toBeTruthy();
      expect(screen.getByTestId('palette-entry-projects/p/subscriptions/pay-sub')).toBeTruthy();
      expect(screen.getByTestId('palette-entry-p')).toBeTruthy();
    });
    expect(screen.getByText('topic')).toBeTruthy();
    expect(screen.getByText('subscription')).toBeTruthy();
    expect(screen.getByText('project')).toBeTruthy();
  });

  it('C5: typed query filters and hides non-matching rows', async () => {
    mockFetch({
      projects: [
        { projectId: 'payments-proj', displayName: 'Payments' },
        { projectId: 'orders-proj', displayName: 'Orders' },
      ],
    });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('palette-entry-payments-proj');

    fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: 'orders' } });
    expect(screen.queryByTestId('palette-entry-payments-proj')).toBeNull();
    expect(screen.getByTestId('palette-entry-orders-proj')).toBeTruthy();
    expect(document.querySelector('mark')?.textContent?.toLowerCase()).toBe('orders');
  });

  it('C6: with an empty resource section it still opens and shows projects', async () => {
    mockFetch({ projects: [{ projectId: 'p', displayName: 'P' }], topics: [], subscriptions: [] });
    renderPalette('p');
    openWithShortcut();
    await screen.findByTestId('command-palette');
    await waitFor(() => expect(screen.getByTestId('palette-entry-p')).toBeTruthy());
  });

  it('C7: ArrowDown/ArrowUp move the active row (clamped)', async () => {
    mockFetch({
      projects: [
        { projectId: 'a', displayName: 'Aaa' },
        { projectId: 'b', displayName: 'Bbb' },
      ],
    });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('palette-entry-a');
    const input = screen.getByTestId('command-palette-input');

    expect(screen.getByTestId('palette-entry-a').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('palette-entry-b').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // clamp at end
    expect(screen.getByTestId('palette-entry-b').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByTestId('palette-entry-a').getAttribute('aria-selected')).toBe('true');
  });

  it('C8: Enter dispatches the selection and closes', async () => {
    mockFetch({ projects: [{ projectId: 'proj-1', displayName: 'Project One' }] });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('palette-entry-proj-1');

    fireEvent.keyDown(screen.getByTestId('command-palette-input'), { key: 'Enter' });
    expect(screen.queryByTestId('command-palette')).toBeNull();
    expect(screen.getByTestId('active-project').textContent).toBe('proj-1');
  });

  it('C8: Enter on a topic dispatches SELECT_TOPIC for the active project', async () => {
    mockFetch({
      projects: [{ projectId: 'p', displayName: 'P' }],
      topics: [{ name: 'projects/p/topics/payments', displayName: 'payments' }],
    });
    renderPalette('p');
    openWithShortcut();
    await screen.findByTestId('palette-entry-projects/p/topics/payments');
    // topics are listed first → index 0 is the topic
    fireEvent.keyDown(screen.getByTestId('command-palette-input'), { key: 'Enter' });
    expect(screen.getByTestId('active-topic').textContent).toBe('projects/p/topics/payments');
  });

  it('C9: Enter with no matches does nothing and shows an empty state', async () => {
    mockFetch({ projects: [{ projectId: 'proj-1', displayName: 'Project One' }] });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('palette-entry-proj-1');

    fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: 'zzzzzz' } });
    expect(screen.getByTestId('command-palette-empty')).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId('command-palette-input'), { key: 'Enter' });
    expect(screen.getByTestId('command-palette')).toBeTruthy(); // still open
    expect(screen.getByTestId('active-project').textContent).toBe('none');
  });

  it('C10: rapid ArrowDowns then Enter activate the ref-indicated row', async () => {
    mockFetch({
      projects: [
        { projectId: 'a', displayName: 'Aaa' },
        { projectId: 'b', displayName: 'Bbb' },
        { projectId: 'c', displayName: 'Ccc' },
      ],
    });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('palette-entry-a');
    const input = screen.getByTestId('command-palette-input');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('active-project').textContent).toBe('c');
  });

  it('C11: navigation-only — no theme/layout/publish/pull entries', async () => {
    mockFetch({ projects: [{ projectId: 'proj-1', displayName: 'Project One' }] });
    renderPalette();
    openWithShortcut();
    await screen.findByTestId('palette-entry-proj-1');

    for (const banned of ['theme', 'layout', 'publish', 'pull', 'acknowledge']) {
      fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: banned } });
      expect(screen.getByTestId('command-palette-empty')).toBeTruthy();
    }
  });
});
