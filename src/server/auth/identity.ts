import type { AdcContext } from './adc.js';

const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const UNRESOLVED_IDENTITY = 'adc:user (email unresolved)';

export interface ResolveIdentityOptions {
  fetchImpl?: typeof fetch;
}

/**
 * Resolve the human/service identity behind the active ADC, per research.md R2:
 *   1. Service-account creds → `client_email` directly (no network).
 *   2. User creds → one GET to Google's userinfo endpoint, parse `email`.
 *   3. Any failure → literal fallback (boot does NOT fail).
 *
 * The userinfo endpoint is `*.googleapis.com`, so this stays within the
 * loopback/Google-only network boundary (Constitution Principle I).
 */
export async function resolveIdentity(
  adc: AdcContext,
  opts: ResolveIdentityOptions = {},
): Promise<string> {
  const creds = await adc.getCredentials().catch(() => ({}) as { client_email?: string | null });
  if (creds.client_email) {
    return creds.client_email;
  }

  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const token = await adc.getAccessToken();
    const res = await doFetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return UNRESOLVED_IDENTITY;
    }
    const body = (await res.json()) as { email?: unknown };
    if (typeof body.email === 'string' && body.email.length > 0) {
      return body.email;
    }
    return UNRESOLVED_IDENTITY;
  } catch {
    return UNRESOLVED_IDENTITY;
  }
}
