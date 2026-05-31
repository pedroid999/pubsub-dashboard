import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectBrowser } from '../../src/client/components/ProjectBrowser.js';
import type { GcpProject } from '../../src/server/schemas/pubsub.js';

afterEach(cleanup);

const projects: GcpProject[] = [
  { projectId: 'payments-proj', displayName: 'Payments Project', state: 'ACTIVE' },
  { projectId: 'orders-proj', displayName: 'Orders Project', state: 'ACTIVE' },
];

describe('ProjectBrowser', () => {
  it('renders all project display names after load', async () => {
    const loadProjects = vi.fn().mockResolvedValue(projects);
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('project-item-payments-proj')).toBeTruthy();
      expect(screen.getByTestId('project-item-orders-proj')).toBeTruthy();
    });
  });

  it('filters projects by search query (case-insensitive)', async () => {
    const loadProjects = vi.fn().mockResolvedValue(projects);
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => screen.getByTestId('project-item-payments-proj'));

    const input = screen.getByTestId('project-search');
    fireEvent.change(input, { target: { value: 'orders' } });

    expect(screen.queryByTestId('project-item-payments-proj')).toBeNull();
    expect(screen.getByTestId('project-item-orders-proj')).toBeTruthy();
  });

  it('shows no-match message when filter yields nothing', async () => {
    const loadProjects = vi.fn().mockResolvedValue(projects);
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => screen.getByTestId('project-item-payments-proj'));

    const input = screen.getByTestId('project-search');
    fireEvent.change(input, { target: { value: 'nonexistent' } });

    expect(screen.getByText(/no matching projects/i)).toBeTruthy();
  });

  it('shows empty state when no projects returned', async () => {
    const loadProjects = vi.fn().mockResolvedValue([]);
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no projects found/i)).toBeTruthy();
    });
  });

  it('calls onSelectProject with projectId on item click', async () => {
    const onSelectProject = vi.fn();
    const loadProjects = vi.fn().mockResolvedValue(projects);
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={onSelectProject} />);

    await waitFor(() => screen.getByTestId('project-item-payments-proj'));
    fireEvent.click(screen.getByTestId('project-item-payments-proj'));

    expect(onSelectProject).toHaveBeenCalledWith('payments-proj');
  });

  it('shows PERMISSION_DENIED error state with missing permission name (FR-010)', async () => {
    const loadProjects = vi.fn().mockRejectedValue(
      Object.assign(new Error('No permission'), { code: 'PERMISSION_DENIED' }),
    );
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('resourcemanager.projects.list')).toBeTruthy();
    });
  });

  it('shows QUOTA_EXCEEDED error state', async () => {
    const loadProjects = vi.fn().mockRejectedValue(
      Object.assign(new Error('Quota exceeded'), { code: 'QUOTA_EXCEEDED' }),
    );
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/wait for quota reset/i)).toBeTruthy();
    });
  });

  it('uses fallback message when error has no message property (line 33 branch)', async () => {
    const loadProjects = vi.fn().mockRejectedValue({ code: 'INTERNAL_ERROR' });
    render(<ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Failed to load projects.')).toBeTruthy();
    });
  });

  it('ignores error after unmount (cancelled = true branch, line 28)', async () => {
    let reject!: (err: unknown) => void;
    const promise = new Promise<GcpProject[]>((_, rej) => {
      reject = rej;
    });
    const loadProjects = vi.fn().mockReturnValue(promise);
    const { unmount } = render(
      <ProjectBrowser loadProjects={loadProjects} onSelectProject={vi.fn()} />,
    );
    unmount();
    reject(Object.assign(new Error('too late'), { code: 'INTERNAL_ERROR' }));
    await promise.catch(() => undefined);
  });
});
