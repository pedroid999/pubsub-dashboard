import { Command, Zap } from 'lucide-react';
import type { GcpProject } from '../../server/schemas/pubsub.js';
import { useResourceContext } from '../lib/resourceContext.js';
import { SessionBadge } from './SessionBadge.js';
import { ThemeToggle } from './ThemeToggle.js';
import { AppearanceSettings } from './AppearanceSettings.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { StatusFlash } from './StatusFlash.js';
import { OPEN_PALETTE_EVENT } from './CommandPalette.js';

export interface HeaderProps {
  loadProjects: () => Promise<GcpProject[]>;
}

/**
 * Application header (US8 / FR-022): brand + JP wordmark, project switcher, a
 * transient status-flash slot, the ⌘K palette affordance, theme toggle,
 * appearance settings, and the ADC session/status badge.
 */
export function Header({ loadProjects }: HeaderProps): JSX.Element {
  const { state } = useResourceContext();
  return (
    <header className="flex items-center gap-3 border-b border-line bg-bg1 px-4 py-2">
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-token border border-accent text-accent shadow-glow">
        <Zap className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-[0.02em] text-fg0">
          PUB<span className="text-accent">/</span>SUB
        </div>
        <div className="jp-tag text-[9.5px]">パブサブ・ダッシュボード</div>
      </div>
      {/* Accessible product name (also satisfies existing smoke tests). */}
      <h1 className="sr-only">Pub/Sub Dashboard</h1>
      <ProjectSwitcher loadProjects={loadProjects} />
      <div className="flex-1" />
      <StatusFlash />
      <button
        type="button"
        data-testid="command-palette-trigger"
        aria-label="Open command palette"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="flex items-center gap-1 rounded-token border border-line px-2 py-1 font-mono text-[11px] text-fg2 hover:border-accent hover:text-accent"
      >
        <Command className="h-3 w-3" /> K
      </button>
      <ThemeToggle />
      <AppearanceSettings />
      <SessionBadge activeProjectId={state.activeProjectId} />
    </header>
  );
}
