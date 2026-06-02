import { Hash, Radio } from 'lucide-react';
import { useResourceContext } from '../lib/resourceContext.js';

export function ContextIndicator(): JSX.Element | null {
  const { state } = useResourceContext();
  const { activeProjectId, contextMap } = state;

  if (!activeProjectId) return null;

  const ctx = contextMap.get(activeProjectId) ?? {};

  return (
    <div
      role="status"
      aria-label="Active context"
      className="flex items-center gap-4 border-b border-line bg-inset px-4 py-1.5 text-xs text-fg2"
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="font-semibold uppercase tracking-[0.1em] text-fg3">Project</span>
        <span className="font-mono text-fg0">{activeProjectId}</span>
      </span>
      <span className="text-line-strong">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Hash className="h-3 w-3 text-cyan" />
        {ctx.selectedTopicName ? (
          <span className="font-mono text-fg0">{ctx.selectedTopicName}</span>
        ) : (
          <span className="italic text-fg3">No topic selected</span>
        )}
      </span>
      <span className="text-line-strong">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Radio className="h-3 w-3 text-magenta" />
        {ctx.selectedSubscriptionName ? (
          <span className="font-mono text-fg0">{ctx.selectedSubscriptionName}</span>
        ) : (
          <span className="italic text-fg3">No subscription selected</span>
        )}
      </span>
    </div>
  );
}
