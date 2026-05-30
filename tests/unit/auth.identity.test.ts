import { describe, it, expect, vi } from 'vitest';
import { resolveIdentity } from '../../src/server/auth/identity.js';
import type { AdcContext } from '../../src/server/auth/adc.js';

function fakeAdc(over: Partial<AdcContext> = {}): AdcContext {
  return {
    getAccessToken: vi.fn().mockResolvedValue('ya29.test'),
    getCredentials: vi.fn().mockResolvedValue({}),
    ...over,
  };
}

const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

describe('auth/identity — resolveIdentity (T034b, research.md R2)', () => {
  it('returns client_email directly for service-account creds (no userinfo call)', async () => {
    const fetchImpl = vi.fn();
    const adc = fakeAdc({
      getCredentials: vi.fn().mockResolvedValue({ client_email: 'sa@p.iam.gserviceaccount.com' }),
    });
    await expect(resolveIdentity(adc, { fetchImpl })).resolves.toBe('sa@p.iam.gserviceaccount.com');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls userinfo once for user creds (empty client_email) and returns email', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ email: 'dev@example.com' }),
    });
    const adc = fakeAdc({ getCredentials: vi.fn().mockResolvedValue({ client_email: null }) });
    await expect(resolveIdentity(adc, { fetchImpl })).resolves.toBe('dev@example.com');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(USERINFO);
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer ya29.test' });
  });

  it('falls back to literal when userinfo returns non-ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const adc = fakeAdc();
    await expect(resolveIdentity(adc, { fetchImpl })).resolves.toBe('adc:user (email unresolved)');
  });

  it('falls back to literal when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const adc = fakeAdc();
    await expect(resolveIdentity(adc, { fetchImpl })).resolves.toBe('adc:user (email unresolved)');
  });

  it('falls back to literal when userinfo body has no email', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const adc = fakeAdc();
    await expect(resolveIdentity(adc, { fetchImpl })).resolves.toBe('adc:user (email unresolved)');
  });

  it('only ever contacts a googleapis.com host (Principle I)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ email: 'dev@example.com' }),
    });
    const adc = fakeAdc();
    await resolveIdentity(adc, { fetchImpl });
    for (const call of fetchImpl.mock.calls) {
      expect(new URL(call[0] as string).hostname.endsWith('.googleapis.com')).toBe(true);
    }
  });
});
