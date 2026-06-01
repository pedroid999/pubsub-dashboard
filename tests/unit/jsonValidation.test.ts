import { describe, it, expect } from 'vitest';
import { validateJson, formatJson } from '../../src/client/lib/jsonValidation.js';

describe('validateJson', () => {
  it('treats empty / whitespace-only input as invalid (FR-003 edge case)', () => {
    expect(validateJson('')).toEqual({
      valid: false,
      message: 'Body is empty — enter valid JSON.',
    });
    expect(validateJson('   ')).toEqual({
      valid: false,
      message: 'Body is empty — enter valid JSON.',
    });
  });

  it('accepts well-formed objects and arrays', () => {
    expect(validateJson('{"a":1}')).toEqual({ valid: true });
    expect(validateJson('[1,2,3]')).toEqual({ valid: true });
  });

  it('accepts bare JSON primitives (FR-008)', () => {
    expect(validateJson('"hello"')).toEqual({ valid: true });
    expect(validateJson('42')).toEqual({ valid: true });
    expect(validateJson('true')).toEqual({ valid: true });
    expect(validateJson('null')).toEqual({ valid: true });
  });

  it('rejects malformed JSON and reports a reason (FR-003)', () => {
    const result = validateJson('{"a":}');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('extracts a character position when the engine reports one (FR-003)', () => {
    const result = validateJson('{"a" "b"}');
    expect(result.valid).toBe(false);
    if (!result.valid && result.position !== undefined) {
      expect(typeof result.position).toBe('number');
      expect(result.position).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('formatJson', () => {
  it('pretty-prints an object with 2-space indent (FR-005)', () => {
    expect(formatJson('{"a":1,"b":2}')).toEqual({
      ok: true,
      formatted: '{\n  "a": 1,\n  "b": 2\n}',
    });
  });

  it('pretty-prints a bare primitive (FR-008)', () => {
    expect(formatJson('42')).toEqual({ ok: true, formatted: '42' });
    expect(formatJson('"x"')).toEqual({ ok: true, formatted: '"x"' });
  });

  it('does not reformat invalid JSON and returns the parse error (FR-005)', () => {
    const result = formatJson('{bad}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
