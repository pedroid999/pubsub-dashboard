import { ChevronLeft } from 'lucide-react';
import { DiagnosticsPanel } from './components/DiagnosticsPanel.js';
import { ResourceContextProvider } from './components/ResourceContextProvider.js';
import { useResourceContext } from './lib/resourceContext.js';
import { ProjectBrowser } from './components/ProjectBrowser.js';
import { ResourceBrowser } from './components/ResourceBrowser.js';
import { MessagePublisher } from './components/MessagePublisher.js';
import { MessageReceiver } from './components/MessageReceiver.js';
import { ComposeDraftProvider } from './components/ComposeDraftProvider.js';
import { ContextIndicator } from './components/ContextIndicator.js';
import { ThemeProvider } from './lib/theme.js';
import { CommandPalette } from './components/CommandPalette.js';
import { AppearanceProvider, useAppearance } from './lib/appearance.js';
import { Header } from './components/Header.js';
import { ProjectsResponseSchema } from '../server/schemas/pubsub.js';
import { apiGet } from './lib/api.js';

async function loadProjects() {
  const { data } = await apiGet('/api/projects', ProjectsResponseSchema);
  return data.projects;
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2 className="mb-2 text-[var(--fs-label)] font-semibold uppercase tracking-[0.12em] text-fg2">
      {children}
    </h2>
  );
}

function AppContent(): JSX.Element {
  const { state, dispatch } = useResourceContext();

  if (!state.activeProjectId) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 overflow-auto px-4 py-8">
        <section className="mb-8">
          <SectionLabel>GCP Projects</SectionLabel>
          <ProjectBrowser
            loadProjects={loadProjects}
            onSelectProject={(projectId) => dispatch({ type: 'SELECT_PROJECT', projectId })}
          />
        </section>
        <section className="mt-8">
          <SectionLabel>Diagnostics</SectionLabel>
          <DiagnosticsPanel />
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 py-3">
      <button
        type="button"
        onClick={() => dispatch({ type: 'NAVIGATE_BACK' })}
        className="mb-2 flex flex-none items-center gap-1 text-[var(--fs-base)] text-fg2 hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Projects
      </button>
      <ComposeDraftProvider>
        <WorkspaceBody projectId={state.activeProjectId} />
      </ComposeDraftProvider>
    </main>
  );
}

/**
 * Workspace body — the publisher/receiver/resources surface, reflowed by the
 * persisted layout (US3). Selection (resourceContext) and the compose draft
 * (ComposeDraftProvider) live in providers above this component, so switching
 * layout never loses them (SC-003).
 *
 * - **Rail** (default): resources rail (topics over subs) beside publisher | receiver.
 * - **Triptych**: three equal columns — tabbed resources | publisher | receiver.
 * - **Console**: resources across the top, publisher | receiver beneath.
 */
export function WorkspaceBody({ projectId }: { projectId: string }): JSX.Element {
  const { prefs } = useAppearance();
  const publisher = <MessagePublisher projectId={projectId} />;
  const receiver = <MessageReceiver projectId={projectId} />;

  if (prefs.layout === 'triptych') {
    return (
      <div data-layout="triptych" className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-3">
        <ResourceBrowser projectId={projectId} orientation="tabs" />
        {publisher}
        {receiver}
      </div>
    );
  }

  if (prefs.layout === 'console') {
    return (
      <div
        data-layout="console"
        className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3"
      >
        <ResourceBrowser projectId={projectId} orientation="split" />
        <div className="grid min-h-0 gap-3 xl:grid-cols-2">
          {publisher}
          {receiver}
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout="rail"
      className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
    >
      <ResourceBrowser projectId={projectId} orientation="stacked" />
      <div className="grid min-h-0 gap-3 xl:grid-cols-2">
        {publisher}
        {receiver}
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <AppearanceProvider>
        <ResourceContextProvider>
          <div className="flex h-screen flex-col overflow-hidden bg-bg0 font-ui text-fg0">
            <Header loadProjects={loadProjects} />
            <ContextIndicator />
            <AppContent />
            {/* ⌘K navigation-only command palette (US2). */}
            <CommandPalette />
            {/* Fixed scanline/grain ambience (FR-014; hidden under reduced motion). */}
            <div className="fx-overlay" aria-hidden="true" />
          </div>
        </ResourceContextProvider>
      </AppearanceProvider>
    </ThemeProvider>
  );
}
