import { describe, it, expect } from 'vitest';
import { ErrorResponseSchema, ErrorCode } from '../../src/server/schemas/errors.js';

describe('ErrorResponseSchema (T-SCHEMA-040..042)', () => {
  const base = {
    code: 'ADC_MISSING' as const,
    message: 'ADC not configured',
    remediation: 'Run: gcloud auth application-default login',
    traceId: '550e8400-e29b-41d4-a716-446655440000',
  };

  it('accepts a valid ADC_MISSING error with remediation containing the gcloud command', () => {
    const parsed = ErrorResponseSchema.parse(base);
    expect(parsed.remediation).toContain('gcloud auth application-default login');
  });

  it('accepts NO_ACTIVE_PROJECT with the gcloud config set project remediation', () => {
    const np = {
      ...base,
      code: 'NO_ACTIVE_PROJECT' as const,
      message: 'No active gcloud project',
      remediation: 'Run: gcloud config set project <PROJECT_ID>',
    };
    expect(ErrorResponseSchema.parse(np).remediation).toContain('gcloud config set project');
  });

  it('allows remediation to be omitted', () => {
    const noRem = { code: 'INTERNAL' as const, message: 'boom', traceId: base.traceId };
    expect(() => ErrorResponseSchema.parse(noRem)).not.toThrow();
  });

  it('rejects unknown error codes', () => {
    expect(() => ErrorResponseSchema.parse({ ...base, code: 'TOTALLY_MADE_UP' })).toThrow();
  });

  it('exposes the canonical ErrorCode enum values', () => {
    expect(ErrorCode.options).toEqual(
      expect.arrayContaining([
        'ADC_MISSING',
        'GCLOUD_MISSING',
        'NO_ACTIVE_PROJECT',
        'INVALID_QUERY',
        'INTERNAL',
      ]),
    );
  });
});
