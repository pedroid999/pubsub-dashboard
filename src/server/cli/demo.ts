import type { AdcContext } from '../auth/index.js';
import type { CreatePubSubClientFn } from '../routes/pubsub.js';
import { createInMemoryPubSubClient } from './demoPubSub.js';

export interface DemoOverrides {
  resolveAdc: () => Promise<AdcContext>;
  getActiveProject: () => Promise<string>;
  resolveIdentity: (adc: AdcContext) => Promise<string>;
  createPubSubClient: CreatePubSubClientFn;
}

/**
 * Documented CI test seam (FR-019): when `PUBSUB_DEMO_PROJECT` is set, the auth
 * resolvers are replaced with offline stubs so the server can boot WITHOUT
 * gcloud, ADC, or network access. This lets the README quickstart be validated
 * end-to-end in CI. It is NOT a runtime feature — without the env var the real
 * gcloud-backed resolvers are used and this returns `null`.
 *
 * `PUBSUB_DEMO_PROJECT` is intentionally distinct from `GOOGLE_CLOUD_PROJECT`
 * (which remains forbidden): this is an explicit demo opt-in, not silent
 * project inference.
 */
export function demoOverridesFromEnv(env: NodeJS.ProcessEnv): DemoOverrides | null {
  const projectId = env.PUBSUB_DEMO_PROJECT;
  if (projectId === undefined || projectId.length === 0) {
    return null;
  }
  const identity = env.PUBSUB_DEMO_IDENTITY ?? 'demo@pubsub-dashboard.local';
  const context: AdcContext = {
    getAccessToken: () => Promise.resolve('demo-access-token'),
    getCredentials: () => Promise.resolve({ client_email: identity }),
  };
  return {
    resolveAdc: () => Promise.resolve(context),
    getActiveProject: () => Promise.resolve(projectId),
    resolveIdentity: () => Promise.resolve(identity),
    createPubSubClient: createInMemoryPubSubClient(),
  };
}
