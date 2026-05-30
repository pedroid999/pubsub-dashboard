/**
 * Build the pino redaction path list (research.md R8).
 *
 * Credentials are ALWAYS redacted. Message payload bodies (`*.message.data`)
 * are redacted in normal mode and revealed only in verbose mode — switching
 * modes mid-session never retroactively reveals data captured while redacted.
 */
export const CREDENTIAL_REDACT_PATHS = [
  '*.authorization',
  '*.credentials',
  'req.headers.authorization',
  'authorization',
  'credentials',
] as const;

export const PAYLOAD_REDACT_PATHS = ['*.message.data', 'message.data'] as const;

export const REDACT_CENSOR = '[REDACTED]' as const;

export function redactPaths(verbose: boolean): string[] {
  return verbose
    ? [...CREDENTIAL_REDACT_PATHS]
    : [...PAYLOAD_REDACT_PATHS, ...CREDENTIAL_REDACT_PATHS];
}
