import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { SessionBadge } from '../../src/client/components/SessionBadge.js';
import { ApiError } from '../../src/client/lib/api.js';
import type { Session } from '../../src/server/schemas/session.js';

const session: Session = {
  projectId: 'my-cool-project',
  identity: 'dev@example.com',
  bindAddress: '127.0.0.1',
  port: 4321,
  startedAt: '2026-05-29T20:00:00.000Z',
  lastTraceId: null,
  version: '0.1.0',
  nodeVersion: 'v20.18.0',
};

afterEach(cleanup);

describe('SessionBadge (T054)', () => {
  it('shows a loading state, then the project id and identity', async () => {
    let resolve!: (s: Session) => void;
    const load = () => new Promise<Session>((r) => (resolve = r));
    render(<SessionBadge load={load} />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

    resolve(session);
    await waitFor(() => {
      expect(screen.getByText('my-cool-project')).toBeInTheDocument();
      expect(screen.getByText('dev@example.com')).toBeInTheDocument();
    });
  });

  it('shows the active project (not the gcloud default) once one is selected', async () => {
    const load = () => Promise.resolve(session);
    render(<SessionBadge load={load} activeProjectId="picked-project" />);

    await waitFor(() => {
      expect(screen.getByTestId('session-project')).toHaveTextContent('picked-project');
    });
    // The gcloud default must NOT be shown while a project is active.
    expect(screen.queryByText('my-cool-project')).toBeNull();
    // Identity stays bound to the ADC session, not the selected project.
    expect(screen.getByText('dev@example.com')).toBeInTheDocument();
  });

  it('falls back to the gcloud default project at startup (no active project)', async () => {
    const load = () => Promise.resolve(session);
    render(<SessionBadge load={load} />);

    await waitFor(() => {
      expect(screen.getByTestId('session-project')).toHaveTextContent('my-cool-project');
    });
  });

  it('shows the error message + remediation when the session load fails (503)', async () => {
    const load = () =>
      Promise.reject(
        new ApiError('ADC_MISSING', 'ADC not configured', 'gcloud auth application-default login'),
      );
    render(<SessionBadge load={load} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ADC not configured');
      expect(screen.getByRole('alert')).toHaveTextContent('gcloud auth application-default login');
    });
  });
});
