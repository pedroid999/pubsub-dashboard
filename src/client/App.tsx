import { SessionBadge } from './components/SessionBadge.js';

export function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-base font-semibold">Pub/Sub Dashboard</h1>
        <SessionBadge />
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-slate-500">
          Local-first Google Cloud Pub/Sub dashboard. Publish, subscribe and inspect messages — all
          on 127.0.0.1, authenticated via gcloud ADC.
        </p>
      </main>
    </div>
  );
}
