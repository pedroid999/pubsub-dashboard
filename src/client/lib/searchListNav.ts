/**
 * Pure keyboard-navigation core shared by the Command Palette (US2) and the
 * SearchableList (US5). No React, no DOM — just clamped index math so the
 * navigation behavior is unit-testable to ≥90% branch (contracts L9, C10).
 */

/** Index a query change resets the active row to. */
export const RESET_INDEX = 0;

/**
 * Clamp `index` into the valid range for a list of `len` items.
 * An empty list always resolves to 0.
 */
export function clampIndex(index: number, len: number): number {
  if (len <= 0) return 0;
  if (index < 0) return 0;
  if (index > len - 1) return len - 1;
  return index;
}

export interface MoveOptions {
  /** Relative step (e.g. +1 for ArrowDown, -1 for ArrowUp). */
  delta?: number;
  /** Absolute target (e.g. 0 for Home, len-1 for End). Takes precedence over delta. */
  absolute?: number;
}

/**
 * Compute the next active index from the current one.
 * - `absolute` wins over `delta` when both are supplied.
 * - With neither, the current index is simply re-clamped (useful after the
 *   list length changes).
 * - All results are clamped to `[0, len-1]`, or 0 for an empty list.
 */
export function move(active: number, options: MoveOptions, len: number): number {
  if (len <= 0) return 0;
  if (options.absolute !== undefined) return clampIndex(options.absolute, len);
  if (options.delta !== undefined) return clampIndex(active + options.delta, len);
  return clampIndex(active, len);
}
