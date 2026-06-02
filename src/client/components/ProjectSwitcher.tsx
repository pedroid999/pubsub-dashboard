import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FolderGit2 } from 'lucide-react';
import type { GcpProject } from '../../server/schemas/pubsub.js';
import { useResourceContext } from '../lib/resourceContext.js';

export interface ProjectSwitcherProps {
  loadProjects: () => Promise<GcpProject[]>;
}

/**
 * Header project switcher (US8 / FR-022). Shows the active project and a dropdown
 * to switch to another without leaving the workspace. Only rendered once a
 * project is active; the first-run picker stays in the body (ProjectBrowser).
 */
export function ProjectSwitcher({ loadProjects }: ProjectSwitcherProps): JSX.Element | null {
  const { state, dispatch } = useResourceContext();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<GcpProject[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadProjects()
      .then((p) => {
        if (!cancelled) setProjects(p);
      })
      .catch(() => {
        /* keep the current project; switching is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadProjects]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (!state.activeProjectId) return null;
  const activeProjectId = state.activeProjectId;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="project-switcher"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-token border border-line px-2 py-1 font-mono text-[11px] text-fg1 hover:border-accent hover:text-accent"
      >
        <FolderGit2 className="h-3 w-3" aria-hidden="true" />
        {activeProjectId}
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Switch project"
          data-testid="project-switcher-list"
          className="panel !absolute left-0 z-50 mt-2 max-h-72 w-64 overflow-y-auto p-1 shadow-glow"
        >
          {projects.map((p) => (
            <li key={p.projectId} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={p.projectId === activeProjectId}
                data-testid={`project-switch-${p.projectId}`}
                onClick={() => {
                  dispatch({ type: 'SELECT_PROJECT', projectId: p.projectId });
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start rounded-token px-2 py-1.5 text-left font-mono text-[12px] hover:bg-bg2 ${
                  p.projectId === activeProjectId ? 'text-accent' : 'text-fg1'
                }`}
              >
                <span>{p.displayName}</span>
                <span className="text-[10px] text-fg3">{p.projectId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
