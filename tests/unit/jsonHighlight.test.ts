import { describe, it, expect } from 'vitest';
import { tokenizeJson, type JsonToken } from '../../src/client/lib/jsonHighlight.js';

function reconstruct(tokens: JsonToken[]): string {
  return tokens.map((t) => t.value).join('');
}
function kinds(tokens: JsonToken[]): string[] {
  return tokens.filter((t) => t.kind !== 'whitespace').map((t) => t.kind);
}

describe('jsonHighlight tokenizer (US6 · FR-018/FR-019)', () => {
  it('emits key/string/number/boolean/null/punctuation for a representative object', () => {
    const input = '{"name":"orders","count":3,"live":true,"meta":null}';
    const tokens = tokenizeJson(input);
    const k = kinds(tokens);
    expect(k).toContain('key');
    expect(k).toContain('string');
    expect(k).toContain('number');
    expect(k).toContain('boolean');
    expect(k).toContain('null');
    expect(k).toContain('punctuation');
  });

  it('distinguishes object keys from string values', () => {
    const tokens = tokenizeJson('{"k":"v"}');
    const keyTokens = tokens.filter((t) => t.kind === 'key');
    const stringTokens = tokens.filter((t) => t.kind === 'string');
    expect(keyTokens.map((t) => t.value)).toEqual(['"k"']);
    expect(stringTokens.map((t) => t.value)).toEqual(['"v"']);
  });

  it('reproduces the input exactly (char-for-char) for valid JSON', () => {
    const input = '{\n  "a": [1, 2.5, -3, 1e3],\n  "b": false\n}';
    expect(reconstruct(tokenizeJson(input))).toBe(input);
  });

  it('reproduces the input exactly for pretty-printed nested JSON', () => {
    const input = JSON.stringify({ a: { b: [1, { c: 'x' }], d: null } }, null, 2);
    expect(reconstruct(tokenizeJson(input))).toBe(input);
  });

  it('handles escaped quotes inside strings without losing characters', () => {
    const input = '{"q":"a\\"b","n":"line\\nbreak"}';
    const tokens = tokenizeJson(input);
    expect(reconstruct(tokens)).toBe(input);
    expect(tokens.some((t) => t.kind === 'string' && t.value === '"a\\"b"')).toBe(true);
  });

  it('tokenizes numbers with sign, fraction and exponent', () => {
    const tokens = tokenizeJson('[-12.5e-3]');
    expect(tokens.some((t) => t.kind === 'number' && t.value === '-12.5e-3')).toBe(true);
    expect(reconstruct(tokens)).toBe('[-12.5e-3]');
  });

  it('is best-effort on invalid JSON yet still reproduces the input', () => {
    const input = '{"a": tru, "b": "unterminated';
    const tokens = tokenizeJson(input);
    expect(reconstruct(tokens)).toBe(input);
  });

  it('reproduces an empty string and pure whitespace', () => {
    expect(reconstruct(tokenizeJson(''))).toBe('');
    expect(reconstruct(tokenizeJson('   \n\t '))).toBe('   \n\t ');
  });

  it('classifies a leading whitespace-only document as whitespace tokens', () => {
    const tokens = tokenizeJson('  ');
    expect(tokens.every((t) => t.kind === 'whitespace')).toBe(true);
  });

  it('treats stray non-JSON characters as plain (full coverage)', () => {
    const input = '@@@';
    const tokens = tokenizeJson(input);
    expect(reconstruct(tokens)).toBe('@@@');
    expect(tokens.some((t) => t.kind === 'plain')).toBe(true);
  });
});
