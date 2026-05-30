import { describe, it, expect, vi, beforeEach } from 'vitest';

const getClient = vi.fn();
const getCredentials = vi.fn();

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getClient,
    getCredentials,
  })),
}));

import { resolveAdc } from '../../src/server/auth/adc.js';
import { AdcMissingError } from '../../src/server/auth/errors.js';

describe('auth/adc — resolveAdc (T033)', () => {
  beforeEach(() => {
    getClient.mockReset();
    getCredentials.mockReset();
  });

  it('returns an AdcContext when a token can be minted', async () => {
    getClient.mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'ya29.test' }),
    });
    const ctx = await resolveAdc();
    await expect(ctx.getAccessToken()).resolves.toBe('ya29.test');
  });

  it('throws AdcMissingError (exit 12) when getClient rejects', async () => {
    getClient.mockRejectedValue(new Error('Could not load the default credentials'));
    await expect(resolveAdc()).rejects.toBeInstanceOf(AdcMissingError);
  });

  it('throws AdcMissingError when the access token is empty', async () => {
    getClient.mockResolvedValue({ getAccessToken: vi.fn().mockResolvedValue({ token: null }) });
    await expect(resolveAdc()).rejects.toBeInstanceOf(AdcMissingError);
  });

  it('exposes getCredentials passthrough', async () => {
    getClient.mockResolvedValue({ getAccessToken: vi.fn().mockResolvedValue({ token: 'tok' }) });
    getCredentials.mockResolvedValue({ client_email: 'sa@project.iam.gserviceaccount.com' });
    const ctx = await resolveAdc();
    await expect(ctx.getCredentials()).resolves.toEqual({
      client_email: 'sa@project.iam.gserviceaccount.com',
    });
  });
});
