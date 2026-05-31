export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * Case-insensitive partial-match filter.
 * Returns the subset of `items` whose `displayName` OR `subLabel` contains `query`.
 * An empty or blank `query` returns all items unchanged.
 */
export function filterByQuery<T extends { displayName: string; subLabel?: string }>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (q === '') return items;
  return items.filter(
    (item) =>
      item.displayName.toLowerCase().includes(q) ||
      (item.subLabel !== undefined && item.subLabel.toLowerCase().includes(q)),
  );
}

/**
 * Splits `text` into segments marking which parts match `query`.
 * An empty or blank `query` returns a single non-highlighted segment.
 */
export function highlightMatch(text: string, query: string): HighlightSegment[] {
  const q = query.trim();
  if (q === '') return [{ text, highlight: false }];

  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const idx = lower.indexOf(lowerQ);

  if (idx === -1) return [{ text, highlight: false }];

  const segments: HighlightSegment[] = [];
  if (idx > 0) segments.push({ text: text.slice(0, idx), highlight: false });
  segments.push({ text: text.slice(idx, idx + q.length), highlight: true });
  if (idx + q.length < text.length) {
    segments.push({ text: text.slice(idx + q.length), highlight: false });
  }
  return segments;
}
