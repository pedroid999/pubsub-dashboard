import { filterByQuery, highlightMatch } from '../lib/resourceFilter.js';

export interface ResourceItem {
  name: string;
  displayName: string;
  subLabel?: string;
}

export interface ResourceListProps {
  items: ResourceItem[];
  query: string;
  onSelect: (name: string) => void;
  selectedName?: string;
  emptyMessage: string;
  noMatchMessage: string;
}

export function ResourceList({
  items,
  query,
  onSelect,
  selectedName,
  emptyMessage,
  noMatchMessage,
}: ResourceListProps): JSX.Element {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const filtered = filterByQuery(items, query);

  if (filtered.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{noMatchMessage}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {filtered.map((item) => {
        const isSelected = item.name === selectedName;
        const segments = highlightMatch(item.displayName, query);
        return (
          <li key={item.name}>
            <button
              type="button"
              onClick={() => onSelect(item.name)}
              data-testid={`resource-item-${item.name}`}
              aria-pressed={isSelected}
              className={`flex w-full flex-col items-start px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                isSelected ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800'
              }`}
            >
              <span>
                {segments.map((seg, i) =>
                  seg.highlight ? (
                    <mark key={i} className="bg-yellow-100 text-yellow-900">
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </span>
              {item.subLabel !== undefined && (
                <span className="mt-0.5 block font-mono text-xs font-normal text-slate-400">
                  {item.subLabel}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
