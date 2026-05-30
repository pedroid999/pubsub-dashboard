import type { Session } from './schemas/session.js';

export type SessionSeed = Omit<Session, 'lastTraceId'>;

/**
 * In-memory holder for the ActiveSession. The session is fixed at boot except
 * for `lastTraceId`, which the per-request layer updates. No disk persistence.
 */
export interface SessionStore {
  snapshot(): Session;
  setLastTraceId(traceId: string): void;
}

export function createSessionStore(seed: SessionSeed): SessionStore {
  let lastTraceId: string | null = null;
  return {
    snapshot(): Session {
      return { ...seed, lastTraceId };
    },
    setLastTraceId(traceId: string): void {
      lastTraceId = traceId;
    },
  };
}
