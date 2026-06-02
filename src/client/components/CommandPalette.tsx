import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder, Hash, Radio, Search } from 'lucide-react';
import {
  ProjectsResponseSchema,
  TopicsResponseSchema,
  SubscriptionsResponseSchema,
} from '../../server/schemas/pubsub.js';
import { apiGet } from '../lib/api.js';
import { useResourceContext } from '../lib/resourceContext.js';
import { filterByQuery, highlightMatch } from '../lib/resourceFilter.js';
import { move, RESET_INDEX } from '../lib/searchListNav.js';

/** Custom event the header ⌘K affordance fires to open the palette (T025). */
export const OPEN_PALETTE_EVENT = 'pubsub:open-palette';

type EntryKind = 'project' | 'topic' | 'subscription';

interface PaletteEntry {
  /** id dispatched on activation (projectId or full resource name). */
  id: string;
  kind: EntryKind;
  /** primary label (used for filtering + highlight). */
  displayName: string;
  /** secondary/parent label (also used for filtering). */
  subLabel?: string;
}

const KIND_META: Record<EntryKind, { Icon: typeof Folder; color: string; tag: string }> = {
  project: { Icon: Folder, color: 'text-amber-400', tag: 'project' },
  topic: { Icon: Hash, color: 'text-cyan', tag: 'topic' },
  subscription: { Icon: Radio, color: 'text-magenta', tag: 'subscription' },
};

function HighlightedLabel({ text, query }: { text: string; query: string }): JSX.Element {
  return (
    <>
      {highlightMatch(text, query).map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="bg-transparent font-semibold text-accent">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

export function CommandPalette(): JSX.Element | null {
  const { state, dispatch } = useResourceContext();
  const activeProjectId = state.activeProjectId;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<PaletteEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(RESET_INDEX);

  // Ref mirror of the active index so keyboard handlers never read a stale
  // state closure on rapid keypresses (contract C10).
  const activeRef = useRef(RESET_INDEX);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(RESET_INDEX);
    activeRef.current = RESET_INDEX;
  }, []);

  // C1/C2: global ⌘K / Ctrl+K toggles the palette (default behavior prevented).
  // Also opens on the header affordance's custom event (T025).
  useEffect(() => {
    function onKeydown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent(): void {
      setOpen(true);
    }
    window.addEventListener('keydown', onKeydown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  // On open: reset, focus, and load navigable entries (projects + active
  // project's topics/subscriptions). Navigation-only (FR-006).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(RESET_INDEX);
    activeRef.current = RESET_INDEX;
    inputRef.current?.focus();

    let cancelled = false;
    void (async () => {
      const next: PaletteEntry[] = [];
      if (activeProjectId) {
        try {
          const { data } = await apiGet(
            `/api/projects/${activeProjectId}/topics`,
            TopicsResponseSchema,
          );
          for (const t of data.topics) {
            next.push({
              id: t.name,
              kind: 'topic',
              displayName: t.displayName,
              subLabel: activeProjectId,
            });
          }
        } catch {
          /* resource section stays empty on error — projects still listed (C6) */
        }
        try {
          const { data } = await apiGet(
            `/api/projects/${activeProjectId}/subscriptions`,
            SubscriptionsResponseSchema,
          );
          for (const s of data.subscriptions) {
            next.push({
              id: s.name,
              kind: 'subscription',
              displayName: s.displayName,
              subLabel: s.topicName,
            });
          }
        } catch {
          /* ignore */
        }
      }
      try {
        const { data } = await apiGet('/api/projects', ProjectsResponseSchema);
        for (const p of data.projects) {
          next.push({
            id: p.projectId,
            kind: 'project',
            displayName: p.displayName,
            subLabel: p.projectId,
          });
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setEntries(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, activeProjectId]);

  const filtered = filterByQuery(entries, query);

  const scrollActiveIntoView = useCallback((index: number) => {
    const list = listRef.current;
    if (!list) return;
    const row = list.children[index] as HTMLElement | undefined;
    if (!row) return;
    // Manual scrollTop (never scrollIntoView) so we don't scroll the page.
    if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, []);

  const setActive = useCallback(
    (index: number) => {
      activeRef.current = index;
      setActiveIndex(index);
      scrollActiveIntoView(index);
    },
    [scrollActiveIntoView],
  );

  function activate(entry: PaletteEntry | undefined): void {
    if (!entry) return; // C9: no match → no dispatch
    if (entry.kind === 'project') {
      dispatch({ type: 'SELECT_PROJECT', projectId: entry.id });
    } else if (entry.kind === 'topic' && activeProjectId) {
      dispatch({ type: 'SELECT_TOPIC', projectId: activeProjectId, topicName: entry.id });
    } else if (entry.kind === 'subscription' && activeProjectId) {
      dispatch({
        type: 'SELECT_SUBSCRIPTION',
        projectId: activeProjectId,
        subscriptionName: entry.id,
      });
    }
    close();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    const len = filtered.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(move(activeRef.current, { delta: 1 }, len));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(move(activeRef.current, { delta: -1 }, len));
        break;
      case 'Home':
        e.preventDefault();
        setActive(move(activeRef.current, { absolute: 0 }, len));
        break;
      case 'End':
        e.preventDefault();
        setActive(move(activeRef.current, { absolute: len - 1 }, len));
        break;
      case 'Enter':
        e.preventDefault();
        activate(filtered[activeRef.current]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  }

  if (!open) return null;

  return (
    <div
      data-testid="command-palette-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        // C3: clicking the backdrop closes with no selection change.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        data-testid="command-palette"
        className="panel ticks w-full max-w-xl overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="h-4 w-4 text-fg3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(RESET_INDEX); // C5/L11: query change resets to top
              activeRef.current = RESET_INDEX;
            }}
            onKeyDown={onInputKeyDown}
            aria-label="Search projects, topics and subscriptions"
            data-testid="command-palette-input"
            placeholder="Jump to project, topic, or subscription…"
            className="w-full bg-transparent font-mono text-sm text-fg0 placeholder-fg3 focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-fg3">
            esc
          </kbd>
        </div>

        {filtered.length === 0 ? (
          <p data-testid="command-palette-empty" className="px-4 py-6 text-center text-sm text-fg3">
            No matching projects, topics, or subscriptions.
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
            {filtered.map((entry, i) => {
              const { Icon, color, tag } = KIND_META[entry.kind];
              const isActive = i === activeIndex;
              return (
                <li key={`${entry.kind}:${entry.id}`}>
                  <button
                    type="button"
                    data-testid={`palette-entry-${entry.id}`}
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => activate(entry)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isActive ? 'bg-bg2' : ''
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-[13px] text-fg0">
                        <HighlightedLabel text={entry.displayName} query={query} />
                      </span>
                      {entry.subLabel !== undefined && (
                        <span className="truncate font-mono text-[11px] text-fg3">
                          {entry.subLabel}
                        </span>
                      )}
                    </span>
                    <span className="ml-auto shrink-0 font-jp text-[10px] uppercase tracking-wide text-fg3">
                      {tag}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
