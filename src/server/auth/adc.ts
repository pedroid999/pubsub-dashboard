import { GoogleAuth } from 'google-auth-library';
import { AdcMissingError } from './errors.js';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export interface AdcCredentials {
  client_email?: string | null;
}

/**
 * A resolved Application Default Credentials context. Tokens are fetched
 * lazily so a long-lived session refreshes them transparently.
 */
export interface AdcContext {
  getAccessToken(): Promise<string>;
  getCredentials(): Promise<AdcCredentials>;
}

/**
 * Resolve ADC via google-auth-library. Throws {@link AdcMissingError} (exit 12)
 * if credentials cannot be loaded or no access token can be minted.
 */
export async function resolveAdc(): Promise<AdcContext> {
  const auth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });

  let client: { getAccessToken(): Promise<{ token?: string | null }> };
  try {
    client = await auth.getClient();
  } catch (err) {
    throw new AdcMissingError(err);
  }

  const initial = await client.getAccessToken().catch((err: unknown) => {
    throw new AdcMissingError(err);
  });
  if (!initial.token) {
    throw new AdcMissingError();
  }

  return {
    async getAccessToken(): Promise<string> {
      const res = await client.getAccessToken().catch((err: unknown) => {
        throw new AdcMissingError(err);
      });
      if (!res.token) {
        throw new AdcMissingError();
      }
      return res.token;
    },
    async getCredentials(): Promise<AdcCredentials> {
      return auth.getCredentials();
    },
  };
}
