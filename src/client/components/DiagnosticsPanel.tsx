import { useEffect, useState } from 'react';
import { DiagnosticsListSchema, type DiagnosticsList } from '../../server/schemas/diagnostics.js';
import { apiGet } from '../lib/api.js';

async function defaultLoad(): Promise<DiagnosticsList> {
  const { data } = await apiGet('/api/diagnostics', DiagnosticsListSchema);
  return data;
}

export interface DiagnosticsPanelProps {
  load?: () => Promise<DiagnosticsList>;
}

export function DiagnosticsPanel({ load = defaultLoad }: DiagnosticsPanelProps): JSX.Element {
  const [records, setRecords] = useState<DiagnosticsList | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (records === null) {
    return (
      <div role="status" className="text-sm text-slate-500 dark:text-slate-400">
        Loading diagnostics…
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">No operations recorded yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
      {records.map((rec) => (
        <li key={rec.traceId} className="py-2">
          <details>
            <summary className="flex items-center gap-3">
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {rec.request.method}
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {rec.request.path}
              </span>
              <span className="text-slate-500 dark:text-slate-400">{rec.response.status}</span>
              <span className="ml-auto font-mono text-xs text-slate-400 dark:text-slate-500">
                {rec.traceId}
              </span>
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {JSON.stringify({ request: rec.request, response: rec.response }, null, 2)}
            </pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
