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
      className="border-b border-slate-200 bg-slate-100 px-6 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
    >
      <span className="inline-flex items-center gap-4">
        <span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">Project </span>
          <span className="font-mono text-slate-800 dark:text-slate-200">{activeProjectId}</span>
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">Topic </span>
          {ctx.selectedTopicName ? (
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {ctx.selectedTopicName}
            </span>
          ) : (
            <span className="italic text-slate-400 dark:text-slate-500">No topic selected</span>
          )}
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">Subscription </span>
          {ctx.selectedSubscriptionName ? (
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {ctx.selectedSubscriptionName}
            </span>
          ) : (
            <span className="italic text-slate-400 dark:text-slate-500">
              No subscription selected
            </span>
          )}
        </span>
      </span>
    </div>
  );
}
