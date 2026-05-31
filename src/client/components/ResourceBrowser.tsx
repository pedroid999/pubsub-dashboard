import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import type { Topic, Subscription } from '../../server/schemas/pubsub.js';
import { TopicsResponseSchema, SubscriptionsResponseSchema } from '../../server/schemas/pubsub.js';
import { apiGet } from '../lib/api.js';
import { useResourceContext } from '../lib/resourceContext.js';
import { ResourceList } from './ResourceList.js';

export interface ResourceBrowserProps {
  projectId: string;
}

type PanelState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T[] }
  | { status: 'error'; message: string; code: string };

async function fetchTopics(projectId: string): Promise<Topic[]> {
  const { data } = await apiGet(
    `/api/projects/${projectId}/topics`,
    TopicsResponseSchema,
  );
  return data.topics;
}

async function fetchSubscriptions(projectId: string): Promise<Subscription[]> {
  const { data } = await apiGet(
    `/api/projects/${projectId}/subscriptions`,
    SubscriptionsResponseSchema,
  );
  return data.subscriptions;
}

function SearchInput({
  value,
  onChange,
  label,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  testId: string;
}): JSX.Element {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        data-testid={testId}
        className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-7 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
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
          Missing IAM role:{' '}
          <span className="font-mono">roles/pubsub.viewer</span>
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

export function ResourceBrowser({ projectId }: ResourceBrowserProps): JSX.Element {
  const { state, dispatch } = useResourceContext();
  const projectCtx = state.contextMap.get(projectId) ?? {};

  const [topicsState, setTopicsState] = useState<PanelState<Topic>>({ status: 'loading' });
  const [subsState, setSubsState] = useState<PanelState<Subscription>>({ status: 'loading' });
  const [topicQuery, setTopicQuery] = useState('');
  const [subQuery, setSubQuery] = useState('');

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
    onRefresh,
  }: {
    title: string;
    onRefresh: () => void;
  }): JSX.Element {
    return (
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <button
          type="button"
          aria-label={`Refresh ${title}`}
          onClick={onRefresh}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <PanelHeader title="Topics" onRefresh={loadTopics} />
        <SearchInput
          value={topicQuery}
          onChange={setTopicQuery}
          label="Filter topics…"
          testId="topic-search"
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
            query={topicQuery}
            onSelect={(name) => dispatch({ type: 'SELECT_TOPIC', projectId, topicName: name })}
            selectedName={projectCtx.selectedTopicName}
            emptyMessage="No topics in this project."
            noMatchMessage={`No topics matching "${topicQuery}".`}
          />
        )}
      </div>

      <div>
        <PanelHeader title="Subscriptions" onRefresh={loadSubs} />
        <SearchInput
          value={subQuery}
          onChange={setSubQuery}
          label="Filter subscriptions…"
          testId="sub-search"
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
            query={subQuery}
            onSelect={(name) =>
              dispatch({ type: 'SELECT_SUBSCRIPTION', projectId, subscriptionName: name })
            }
            selectedName={projectCtx.selectedSubscriptionName}
            emptyMessage="No subscriptions in this project."
            noMatchMessage={`No subscriptions matching "${subQuery}".`}
          />
        )}
      </div>
    </div>
  );
}
