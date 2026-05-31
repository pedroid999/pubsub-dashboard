import { describe, it, expect } from 'vitest';
import { tryPrettyPrintJson } from '../../src/client/lib/jsonFormat.js';

describe('client/lib/jsonFormat — tryPrettyPrintJson (T020)', () => {
  it('pretty-prints a JSON object with 2-space indent and isJson true', () => {
    const res = tryPrettyPrintJson('{"orderId":42,"status":"paid"}');
    expect(res.isJson).toBe(true);
    expect(res.formatted).toBe('{\n  "orderId": 42,\n  "status": "paid"\n}');
  });

  it('pretty-prints a JSON array', () => {
    const res = tryPrettyPrintJson('[1,2,3]');
    expect(res.isJson).toBe(true);
    expect(res.formatted).toBe('[\n  1,\n  2,\n  3\n]');
  });

  it('returns non-JSON text unchanged with isJson false', () => {
    const res = tryPrettyPrintJson('hello world');
    expect(res.isJson).toBe(false);
    expect(res.formatted).toBe('hello world');
  });

  it('treats primitive JSON (numbers) as non-formatted, shown as-is', () => {
    const res = tryPrettyPrintJson('42');
    expect(res.isJson).toBe(false);
    expect(res.formatted).toBe('42');
  });

  it('handles an empty string', () => {
    const res = tryPrettyPrintJson('');
    expect(res.isJson).toBe(false);
    expect(res.formatted).toBe('');
  });
});
