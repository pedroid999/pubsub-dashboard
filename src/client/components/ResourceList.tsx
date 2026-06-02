import { useRef, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { filterByQuery, highlightMatch } from '../lib/resourceFilter.js';
import { move } from '../lib/searchListNav.js';

export interface ResourceItem {
  name: string;
  displayName: string;
  subLabel?: string;
}

export interface ResourceListProps {
  items: ResourceItem[];
  onSelect: (name: string) => void;
  selectedName?: string;
  emptyMessage: string;
  noMatchMessage: string;
  /** testid for the owned filter input (e.g. 'topic-search'). */
  searchTestId: string;
  /** placeholder/aria-label for the owned filter input. */
  searchLabel: string;
}

/**
 * SearchableList (US5) — a keyboard-navigable resource list that owns its own
 * filter input. The input owns `onKeyDown` (FR-017): ↑/↓ move the active row
 * (clamped via the pure `searchListNav` core, shared with the palette), Home/End
 * jump, Enter selects, Esc clears a non-empty filter. The active row is kept in
 * view with manual `scrollTop` (never `scrollIntoView`) inside a bounded-height
 * scroll container so the publisher/receiver editors stay visible (L3). Active
 * index is mirrored in a ref so rapid keypresses never read a stale closure (L10).
 */
export function ResourceList({
  items,
  onSelect,
  selectedName,
  emptyMessage,
  noMatchMessage,
  searchTestId,
  searchLabel,
}: ResourceListProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = filterByQuery(items, query);

  function commitActive(next: number): void {
    activeRef.current = next;
    setActive(next);
    // Manual scroll-into-view (L4): adjust the container's scrollTop only.
    const container = listRef.current;
    const row = rowRefs.current[next];
    if (container && row) {
      const top = row.offsetTop;
      const bottom = top + row.offsetHeight;
      if (top < container.scrollTop) {
        container.scrollTop = top;
      } else if (bottom > container.scrollTop + container.clientHeight) {
        container.scrollTop = bottom - container.clientHeight;
      }
    }
  }

  function onQueryChange(value: string): void {
    setQuery(value);
    // Query change resets the active row to 0 and re-clamps the ref (L11).
    activeRef.current = 0;
    setActive(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        commitActive(move(activeRef.current, { delta: 1 }, filtered.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        commitActive(move(activeRef.current, { delta: -1 }, filtered.length));
        break;
      case 'Home':
        e.preventDefault();
        commitActive(move(activeRef.current, { absolute: 0 }, filtered.length));
        break;
      case 'End':
        e.preventDefault();
        commitActive(move(activeRef.current, { absolute: filtered.length - 1 }, filtered.length));
        break;
      case 'Enter': {
        e.preventDefault();
        const item = filtered[activeRef.current];
        if (item) onSelect(item.name);
        break;
      }
      case 'Escape':
        // L7: clear a non-empty filter (and don't propagate); empty → no-op.
        if (query !== '') {
          e.preventDefault();
          e.stopPropagation();
          onQueryChange('');
        }
        break;
      default:
        break;
    }
  }

  const listboxId = `${searchTestId}-listbox`;
  const activeRowId = filtered.length > 0 ? `${searchTestId}-row-${active}` : undefined;

  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg3" />
        <input
          type="text"
          placeholder={searchLabel}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={searchLabel}
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeRowId}
          data-testid={searchTestId}
          className="w-full rounded-token border border-line bg-inset py-1.5 pl-8 pr-7 font-mono text-xs text-fg0 placeholder-fg3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {query && (
          <button
            type="button"
            aria-label={`Clear ${searchLabel}`}
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-fg3 hover:text-fg1"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[var(--fs-base)] text-fg3">{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-[var(--fs-base)] text-fg3">{noMatchMessage}</p>
      ) : (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          data-testid="resource-list"
          className="max-h-72 divide-y divide-line overflow-y-auto rounded-token border border-line bg-inset"
        >
          {filtered.map((item, i) => {
            const isSelected = item.name === selectedName;
            const isActive = i === active;
            const segments = highlightMatch(item.displayName, query);
            return (
              <li key={item.name} role="presentation">
                <button
                  type="button"
                  id={`${searchTestId}-row-${i}`}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(item.name)}
                  onMouseEnter={() => {
                    activeRef.current = i;
                    setActive(i);
                  }}
                  data-testid={`resource-item-${item.name}`}
                  data-active={isActive}
                  aria-pressed={isSelected}
                  className={`flex w-full flex-col items-start px-4 py-[var(--row-pad-y)] text-left font-mono text-[12.5px] transition-colors ${
                    isActive ? 'bg-bg2' : ''
                  } ${isSelected ? 'font-medium text-accent' : 'text-fg1'} hover:bg-bg2`}
                >
                  <span>
                    {segments.map((seg, si) =>
                      seg.highlight ? (
                        <mark key={si} className="bg-transparent font-semibold text-accent">
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={si}>{seg.text}</span>
                      ),
                    )}
                  </span>
                  {item.subLabel !== undefined && (
                    <span className="mt-0.5 block font-mono text-xs font-normal text-fg3">
                      {item.subLabel}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
