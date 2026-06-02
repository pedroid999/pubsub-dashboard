import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { Header } from '../../src/client/components/Header.js';
import { ResourceContextProvider } from '../../src/client/components/ResourceContextProvider.js';
import { ThemeProvider } from '../../src/client/lib/theme.js';
import { AppearanceProvider } from '../../src/client/lib/appearance.js';
import { useResourceContext } from '../../src/client/lib/resourceContext.js';
import { flashStatus } from '../../src/client/lib/statusFlash.js';
import type { GcpProject } from '../../src/server/schemas/pubsub.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mockSession(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(((input: RequestInfo | URL) => {
    const headers = new Headers({ 'x-trace-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (String(input).includes('/api/session')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            projectId: 'proj-a',
            identity: 'dev@example.com',
            bindAddress: '127.0.0.1',
            port: 4321,
            startedAt: '2026-06-01T00:00:00.000Z',
            lastTraceId: null,
            version: '0.6.0',
            nodeVersion: 'v20.0.0',
          }),
          { status: 200, headers },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers }));
  }) as typeof fetch);
}

const PROJECTS: GcpProject[] = [
  { projectId: 'proj-a', displayName: 'Project A', state: 'ACTIVE' },
  { projectId: 'proj-b', displayName: 'Project B', state: 'ACTIVE' },
];

function Seed({ projectId }: { projectId?: string }) {
  const { dispatch } = useResourceContext();
  useEffect(() => {
    if (projectId) dispatch({ type: 'SELECT_PROJECT', projectId });
  }, [dispatch, projectId]);
  return null;
}

function ActiveProject() {
  const { state } = useResourceContext();
  return <span data-testid="active-project">{state.activeProjectId ?? 'none'}</span>;
}

function renderHeader(projectId?: string, loadProjects = async () => PROJECTS): void {
  render(
    <ThemeProvider>
      <AppearanceProvider>
        <ResourceContextProvider>
          <Seed projectId={projectId} />
          <ActiveProject />
          <Header loadProjects={loadProjects} />
        </ResourceContextProvider>
      </AppearanceProvider>
    </ThemeProvider>,
  );
}

describe('Header (US8 · FR-022/FR-023)', () => {
  it('renders the ⌘K affordance, theme toggle, and ADC session badge', () => {
    mockSession();
    renderHeader('proj-a');
    expect(screen.getByTestId('command-palette-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('settings-trigger')).toBeInTheDocument();
  });

  it('does not show the project switcher until a project is active', () => {
    mockSession();
    renderHeader(undefined);
    expect(screen.queryByTestId('project-switcher')).toBeNull();
  });

  it('lists projects and switches the active project', async () => {
    mockSession();
    renderHeader('proj-a');
    expect(screen.getByTestId('active-project')).toHaveTextContent('proj-a');

    fireEvent.click(screen.getByTestId('project-switcher'));
    await waitFor(() => expect(screen.getByTestId('project-switch-proj-b')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('project-switch-proj-b'));

    expect(screen.getByTestId('active-project')).toHaveTextContent('proj-b');
  });

  it('badge shows the active project, not the gcloud default, once one is selected', async () => {
    // Session default is 'proj-a'; the user is working in 'proj-b'.
    mockSession();
    renderHeader('proj-b');
    await waitFor(() => expect(screen.getByTestId('session-project')).toHaveTextContent('proj-b'));
  });

  it('badge tracks the switcher: switching project updates the badge', async () => {
    mockSession();
    renderHeader('proj-a');
    await waitFor(() => expect(screen.getByTestId('session-project')).toHaveTextContent('proj-a'));

    fireEvent.click(screen.getByTestId('project-switcher'));
    await waitFor(() => expect(screen.getByTestId('project-switch-proj-b')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('project-switch-proj-b'));

    expect(screen.getByTestId('session-project')).toHaveTextContent('proj-b');
  });

  it('shows a transient status flash that auto-dismisses', async () => {
    vi.useFakeTimers();
    mockSession();
    renderHeader('proj-a');

    expect(screen.queryByTestId('status-flash')).toBeNull();
    act(() => {
      flashStatus('Published · m-1');
    });
    expect(screen.getByTestId('status-flash')).toHaveTextContent('Published · m-1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });
    expect(screen.queryByTestId('status-flash')).toBeNull();
  });
});
