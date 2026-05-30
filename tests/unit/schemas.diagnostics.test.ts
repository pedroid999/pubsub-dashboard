import { describe, it, expect } from 'vitest';
import {
  DiagnosticsRecordSchema,
  DiagnosticsListSchema,
} from '../../src/server/schemas/diagnostics.js';

const validRecord = {
  traceId: '550e8400-e29b-41d4-a716-446655440000',
  at: '2026-05-29T20:00:00.000Z',
  request: {
    method: 'GET' as const,
    path: '/api/health',
    headers: { 'x-trace-id': '550e8400-e29b-41d4-a716-446655440000' },
    body: null,
  },
  response: {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: { status: 'ok', uptimeMs: 1 },
    durationMs: 4.2,
  },
  error: null,
};

describe('DiagnosticsRecordSchema (T-SCHEMA-030..033)', () => {
  it('round-trips a valid record', () => {
    expect(DiagnosticsRecordSchema.parse(validRecord)).toEqual(validRecord);
  });

  it('rejects negative durationMs', () => {
    expect(() =>
      DiagnosticsRecordSchema.parse({
        ...validRecord,
        response: { ...validRecord.response, durationMs: -1 },
      }),
    ).toThrow();
  });

  it('rejects status outside 100..599', () => {
    expect(() =>
      DiagnosticsRecordSchema.parse({
        ...validRecord,
        response: { ...validRecord.response, status: 99 },
      }),
    ).toThrow();
    expect(() =>
      DiagnosticsRecordSchema.parse({
        ...validRecord,
        response: { ...validRecord.response, status: 600 },
      }),
    ).toThrow();
  });

  it('rejects request.path that does not start with /', () => {
    expect(() =>
      DiagnosticsRecordSchema.parse({
        ...validRecord,
        request: { ...validRecord.request, path: 'api/health' },
      }),
    ).toThrow();
  });
});

describe('DiagnosticsListSchema', () => {
  it('accepts up to 50 entries', () => {
    const fifty = Array.from({ length: 50 }, () => validRecord);
    expect(() => DiagnosticsListSchema.parse(fifty)).not.toThrow();
  });

  it('rejects more than 50 entries', () => {
    const fiftyOne = Array.from({ length: 51 }, () => validRecord);
    expect(() => DiagnosticsListSchema.parse(fiftyOne)).toThrow();
  });
});
