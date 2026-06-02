/**
 * Lightweight, non-blocking status-flash bus (US8 / FR-023). A transient chip in
 * the header surfaces brief confirmations (publish success, copy-to-publish) and
 * auto-dismisses. Decoupled via a window CustomEvent — the same seam the command
 * palette uses — so emitters (publisher/receiver) need no shared React context.
 */

export const STATUS_FLASH_EVENT = 'pubsub-dashboard:status-flash';

/** How long a flash stays visible before auto-dismissing (FR-023). */
export const STATUS_FLASH_TTL_MS = 1800;

export interface StatusFlashDetail {
  message: string;
}

/** Emit a transient status flash. No-op outside a browser (SSR/tests guard). */
export function flashStatus(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<StatusFlashDetail>(STATUS_FLASH_EVENT, { detail: { message } }),
  );
}
