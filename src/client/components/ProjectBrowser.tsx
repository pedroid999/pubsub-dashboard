import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { GcpProject } from '../../server/schemas/pubsub.js';
import { filterByQuery, highlightMatch } from '../lib/resourceFilter.js';

export interface ProjectBrowserProps {
  loadProjects: () => Promise<GcpProject[]>;
  onSelectProject: (projectId: string) => void;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; projects: GcpProject[] }
  | { status: 'error'; code: string; message: string };

export function ProjectBrowser({ loadProjects, onSelectProject }: ProjectBrowserProps): JSX.Element {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadProjects()
      .then((projects) => {
        if (!cancelled) setState({ status: 'ready', projects });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { code?: string; message?: string };
        setState({
          status: 'error',
          code: e.code ?? 'INTERNAL_ERROR',
          message: e.message ?? 'Failed to load projects.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [loadProjects]);

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return [];
    return filterByQuery(state.projects, query);
  }, [state, query]);

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        Loading projects…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <p className="font-medium">{state.message}</p>
        {state.code === 'PERMISSION_DENIED' && (
          <p className="mt-1 text-xs">
            Missing permission:{' '}
            <span className="font-mono">resourcemanager.projects.list</span>
          </p>
        )}
        {state.code === 'QUOTA_EXCEEDED' && (
          <p className="mt-1 text-xs">Wait for quota reset or try again later.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search projects"
          data-testid="project-search"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {state.projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No projects found.</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No matching projects for &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
          {filtered.map((project) => {
            const segments = highlightMatch(project.displayName, query);
            return (
              <li key={project.projectId}>
                <button
                  type="button"
                  onClick={() => onSelectProject(project.projectId)}
                  data-testid={`project-item-${project.projectId}`}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">
                    {segments.map((seg, i) =>
                      seg.highlight ? (
                        <mark key={i} className="bg-yellow-100 text-yellow-900">
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{project.projectId}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
