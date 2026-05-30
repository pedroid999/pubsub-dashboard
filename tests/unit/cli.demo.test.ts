import { describe, it, expect } from 'vitest';
import { demoOverridesFromEnv } from '../../src/server/cli/demo.js';

describe('demoOverridesFromEnv (CI seam, FR-019)', () => {
  it('returns null when PUBSUB_DEMO_PROJECT is absent', () => {
    expect(demoOverridesFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('returns null when PUBSUB_DEMO_PROJECT is empty', () => {
    expect(demoOverridesFromEnv({ PUBSUB_DEMO_PROJECT: '' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('provides offline stubs resolving the demo project + identity', async () => {
    const overrides = demoOverridesFromEnv({
      PUBSUB_DEMO_PROJECT: 'demo-proj',
      PUBSUB_DEMO_IDENTITY: 'ci@demo.local',
    } as NodeJS.ProcessEnv);
    expect(overrides).not.toBeNull();
    const adc = await overrides!.resolveAdc();
    await expect(overrides!.getActiveProject()).resolves.toBe('demo-proj');
    await expect(overrides!.resolveIdentity(adc)).resolves.toBe('ci@demo.local');
    await expect(adc.getAccessToken()).resolves.toBe('demo-access-token');
    await expect(adc.getCredentials()).resolves.toEqual({ client_email: 'ci@demo.local' });
  });

  it('defaults the identity when PUBSUB_DEMO_IDENTITY is not set', async () => {
    const overrides = demoOverridesFromEnv({
      PUBSUB_DEMO_PROJECT: 'demo-proj',
    } as NodeJS.ProcessEnv);
    await expect(overrides!.resolveIdentity(await overrides!.resolveAdc())).resolves.toContain('@');
  });
});
