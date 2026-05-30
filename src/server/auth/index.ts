/**
 * Public surface of the auth module (FR-020 extension boundary).
 *
 * Feature 002+ code MUST import auth functionality from THIS barrel, never from
 * `auth/adc.ts` or `auth/project.ts` directly — an ESLint `no-restricted-imports`
 * rule enforces this for every file outside `src/server/auth/**`. Keeping the
 * gcloud/ADC resolution behind a single re-export means the boot + auth path
 * can evolve without new dashboard sections reaching into its internals.
 */
export { resolveAdc } from './adc.js';
export type { AdcContext, AdcCredentials } from './adc.js';
export { getActiveProject } from './project.js';
export { resolveIdentity, UNRESOLVED_IDENTITY } from './identity.js';
export type { ResolveIdentityOptions } from './identity.js';
export {
  CliError,
  GcloudMissingError,
  AdcMissingError,
  NoActiveProjectError,
  PortInUseError,
} from './errors.js';
export type { CliErrorCode } from './errors.js';
export { stderrLineFor } from './remediation.js';
