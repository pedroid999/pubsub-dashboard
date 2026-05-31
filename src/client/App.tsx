import { SessionBadge } from './components/SessionBadge.js';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.js';
import { ResourceContextProvider } from './components/ResourceContextProvider.js';
import { useResourceContext } from './lib/resourceContext.js';
import { ProjectBrowser } from './components/ProjectBrowser.js';
import { ResourceBrowser } from './components/ResourceBrowser.js';
import { ContextIndicator } from './components/ContextIndicator.js';
import { ProjectsResponseSchema } from '../server/schemas/pubsub.js';
import { apiGet } from './lib/api.js';

async function loadProjects() {
  const { data } = await apiGet('/api/projects', ProjectsResponseSchema);
  return data.projects;
}

function AppContent(): JSX.Element {
  const { state, dispatch } = useResourceContext();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {!state.activeProjectId ? (
        <>
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">GCP Projects</h2>
            <ProjectBrowser
              loadProjects={loadProjects}
              onSelectProject={(projectId) => dispatch({ type: 'SELECT_PROJECT', projectId })}
            />
          </section>
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Diagnostics</h2>
            <DiagnosticsPanel />
          </section>
        </>
      ) : (
        <section>
          <button
            type="button"
            onClick={() => dispatch({ type: 'NAVIGATE_BACK' })}
            className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Projects
          </button>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Project:{' '}
            <span className="font-mono font-medium">{state.activeProjectId}</span>
          </h2>
          <ResourceBrowser projectId={state.activeProjectId} />
        </section>
      )}
    </main>
  );
}

export function App(): JSX.Element {
  return (
    <ResourceContextProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-base font-semibold">Pub/Sub Dashboard</h1>
          <SessionBadge />
        </header>
        <ContextIndicator />
        <AppContent />
      </div>
    </ResourceContextProvider>
  );
}
