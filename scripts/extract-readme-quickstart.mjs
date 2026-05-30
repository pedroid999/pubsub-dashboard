import { readFileSync } from 'node:fs';

const FENCE_RE = /```bash quickstart\r?\n([\s\S]*?)```/g;

/**
 * Extract the single ```bash quickstart fenced block from README markdown.
 * Throws if zero or more than one such block exists, so the README stays the
 * single source of truth for the quickstart (FR-019).
 *
 * @param {string} markdown - README contents.
 * @returns {string} the shell script inside the fence (without the fences).
 */
export function extractQuickstart(markdown) {
  const matches = [...markdown.matchAll(FENCE_RE)];
  if (matches.length === 0) {
    throw new Error('No ```bash quickstart fenced block found in the README.');
  }
  if (matches.length > 1) {
    throw new Error(`Expected exactly one quickstart block, found ${matches.length}.`);
  }
  return matches[0][1];
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const path = process.argv[2] ?? 'README.md';
  process.stdout.write(extractQuickstart(readFileSync(path, 'utf8')));
}
