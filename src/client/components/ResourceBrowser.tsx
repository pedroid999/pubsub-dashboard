import { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Topic, Subscription } from '../../server/schemas/pubsub.js';
import { TopicsResponseSchema, SubscriptionsResponseSchema } from '../../server/schemas/pubsub.js';
import { apiGet } from '../lib/api.js';
import { useResourceContext } from '../lib/resourceContext.js';
import { ResourceList } from './ResourceList.js';

export interface ResourceBrowserProps {
  projectId: string;
  /**
   * 'split' = topics | subs side by side (default, Console top row);
   * 'stacked' = topics over subs (Rail);
   * 'tabs' = single tabbed panel, one list visible at a time (Triptych, FR-011).
   * Filter state and selection are independent per list in every orientation.
   */
  orientation?: 'split' | 'stacked' | 'tabs';
}

type PanelState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T[] }
  | { status: 'error'; message: string; code: string };

async function fetchTopics(projectId: string): Promise<Topic[]> {
  const { data } = await apiGet(`/api/projects/${projectId}/topics`, TopicsResponseSchema);
  return data.topics;
}

async function fetchSubscriptions(projectId: string): Promise<Subscription[]> {
  const { data } = await apiGet(
    `/api/projects/${projectId}/subscriptions`,
    SubscriptionsResponseSchema,
  );
  return data.subscriptions;
}

function PanelError({
  message,
  code,
  onRetry,
}: {
  message: string;
  code?: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
    >
      <p className="font-medium">{message}</p>
      {code === 'PERMISSION_DENIED' && (
        <p className="mt-1">
          Missing IAM role: <span className="font-mono">roles/pubsub.viewer</span>
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 text-red-600 underline hover:text-red-800"
      >
        Retry
      </button>
    </div>
  );
}

export function ResourceBrowser({
  projectId,
  orientation = 'split',
}: ResourceBrowserProps): JSX.Element {
  const { state, dispatch } = useResourceContext();
  const projectCtx = state.contextMap.get(projectId) ?? {};

  const [topicsState, setTopicsState] = useState<PanelState<Topic>>({ status: 'loading' });
  const [subsState, setSubsState] = useState<PanelState<Subscription>>({ status: 'loading' });
  // Triptych ('tabs') only: which list is visible. Each ResourceList owns its
  // own filter state, so it survives tab switches regardless (FR-011).
  const [activeTab, setActiveTab] = useState<'topics' | 'subscriptions'>('topics');

  const loadTopics = useCallback(() => {
    setTopicsState({ status: 'loading' });
    fetchTopics(projectId)
      .then((data) => setTopicsState({ status: 'ready', data }))
      .catch((err: unknown) => {
        const e = err as { code?: string; message?: string };
        setTopicsState({
          status: 'error',
          message: e.message ?? 'Failed to load topics.',
          code: e.code ?? 'INTERNAL_ERROR',
        });
      });
  }, [projectId]);

  const loadSubs = useCallback(() => {
    setSubsState({ status: 'loading' });
    fetchSubscriptions(projectId)
      .then((data) => setSubsState({ status: 'ready', data }))
      .catch((err: unknown) => {
        const e = err as { code?: string; message?: string };
        setSubsState({
          status: 'error',
          message: e.message ?? 'Failed to load subscriptions.',
          code: e.code ?? 'INTERNAL_ERROR',
        });
      });
  }, [projectId]);

  useEffect(() => {
    loadTopics();
    loadSubs();
  }, [loadTopics, loadSubs]);

  function PanelHeader({
    title,
    jp,
    count,
    accentClass,
    onRefresh,
  }: {
    title: string;
    jp: string;
    count: number | null;
    accentClass: string;
    onRefresh: () => void;
  }): JSX.Element {
    return (
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] text-fg2">
          {title}
          <span className={`font-jp text-[10px] normal-case tracking-normal ${accentClass}`}>
            {jp}
          </span>
          {count !== null && (
            <span className="rounded-full border border-line px-1.5 font-mono text-[10px] text-fg3">
              {count}
            </span>
          )}
        </h3>
        <button
          type="button"
          aria-label={`Refresh ${title}`}
          onClick={onRefresh}
          className="text-fg3 hover:text-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const topicCount = topicsState.status === 'ready' ? topicsState.data.length : null;
  const subCount = subsState.status === 'ready' ? subsState.data.length : null;

  const topicsPanel = (
    <div className="panel ticks rise p-3">
      <PanelHeader
        title="Topics"
        jp="トピック"
        count={topicCount}
        accentClass="text-cyan"
        onRefresh={loadTopics}
      />
      {topicsState.status === 'loading' && (
        <p className="py-4 text-center text-xs text-slate-400">Loading…</p>
      )}
      {topicsState.status === 'error' && (
        <PanelError message={topicsState.message} code={topicsState.code} onRetry={loadTopics} />
      )}
      {topicsState.status === 'ready' && (
        <ResourceList
          items={topicsState.data}
          onSelect={(name) => dispatch({ type: 'SELECT_TOPIC', projectId, topicName: name })}
          selectedName={projectCtx.selectedTopicName}
          emptyMessage="No topics in this project."
          noMatchMessage="No topics match the filter."
          searchTestId="topic-search"
          searchLabel="Filter topics…"
        />
      )}
    </div>
  );

  const subsPanel = (
    <div className="panel ticks rise p-3">
      <PanelHeader
        title="Subscriptions"
        jp="サブスク"
        count={subCount}
        accentClass="text-magenta"
        onRefresh={loadSubs}
      />
      {subsState.status === 'loading' && (
        <p className="py-4 text-center text-xs text-slate-400">Loading…</p>
      )}
      {subsState.status === 'error' && (
        <PanelError message={subsState.message} code={subsState.code} onRetry={loadSubs} />
      )}
      {subsState.status === 'ready' && (
        <ResourceList
          items={subsState.data.map((s) => ({
            name: s.name,
            displayName: `${s.displayName} [${s.deliveryType}]${s.topicName === '_deleted-topic_' ? ' ⚠ topic deleted' : ''}`,
            subLabel: s.topicName !== '_deleted-topic_' ? s.topicName : undefined,
          }))}
          onSelect={(name) =>
            dispatch({ type: 'SELECT_SUBSCRIPTION', projectId, subscriptionName: name })
          }
          selectedName={projectCtx.selectedSubscriptionName}
          emptyMessage="No subscriptions in this project."
          noMatchMessage="No subscriptions match the filter."
          searchTestId="sub-search"
          searchLabel="Filter subscriptions…"
        />
      )}
    </div>
  );

  // Triptych: a single tabbed resources panel. Both lists stay mounted (their
  // filter state and the global selection survive tab switches — FR-011).
  if (orientation === 'tabs') {
    const tabButton = (
      tab: 'topics' | 'subscriptions',
      label: string,
      count: number | null,
    ): JSX.Element => (
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === tab}
        data-testid={`resource-tab-${tab}`}
        onClick={() => setActiveTab(tab)}
        className={`flex items-center gap-1.5 rounded-token px-3 py-1.5 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] ${
          activeTab === tab ? 'bg-inset text-accent' : 'text-fg2 hover:text-fg0'
        }`}
      >
        {label}
        {count !== null && (
          <span className="rounded-full border border-line px-1.5 font-mono text-[10px] text-fg3">
            {count}
          </span>
        )}
      </button>
    );
    return (
      <div className="flex min-h-0 flex-col gap-3">
        <div
          role="tablist"
          className="flex flex-none gap-1 rounded-token border border-line bg-bg1 p-1"
        >
          {tabButton('topics', 'Topics', topicCount)}
          {tabButton('subscriptions', 'Subscriptions', subCount)}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" hidden={activeTab !== 'topics'}>
          {topicsPanel}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" hidden={activeTab !== 'subscriptions'}>
          {subsPanel}
        </div>
      </div>
    );
  }

  const gridClass =
    orientation === 'stacked'
      ? 'grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto'
      : 'grid min-h-0 grid-cols-2 gap-6';
  return (
    <div className={gridClass}>
      {topicsPanel}
      {subsPanel}
    </div>
  );
}
