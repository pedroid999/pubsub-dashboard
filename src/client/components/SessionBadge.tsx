import { useEffect, useState } from 'react';
import { SessionSchema, type Session } from '../../server/schemas/session.js';
import { apiGet, ApiError } from '../lib/api.js';

async function defaultLoad(): Promise<Session> {
  const { data } = await apiGet('/api/session', SessionSchema);
  return data;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; session: Session }
  | { status: 'error'; message: string; remediation?: string };

export interface SessionBadgeProps {
  load?: () => Promise<Session>;
}

export function SessionBadge({ load = defaultLoad }: SessionBadgeProps): JSX.Element {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((session) => {
        if (!cancelled) setState({ status: 'ready', session });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setState({ status: 'error', message: err.message, remediation: err.remediation });
        } else {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load session',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        Loading session…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        <p className="font-medium">{state.message}</p>
        {state.remediation ? <p className="mt-1 font-mono text-xs">{state.remediation}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-800">
        {state.session.projectId}
      </span>
      <span className="text-slate-600">{state.session.identity}</span>
    </div>
  );
}
