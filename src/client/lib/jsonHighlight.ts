/**
 * Pure JSON tokenizer for the display-only highlight overlay (US6, FR-018/FR-019).
 * No React, no DOM. The tokenizer is total: it covers EVERY character of the
 * input, so `tokens.map(t => t.value).join('') === input` always holds — the
 * overlay must render exactly the bytes the textarea holds, never altering the
 * payload. It is best-effort on malformed JSON (the composer still blocks publish
 * via the separate validator); coloring degrades gracefully without dropping text.
 */

export type JsonTokenKind =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punctuation'
  | 'whitespace'
  | 'plain';

export interface JsonToken {
  kind: JsonTokenKind;
  value: string;
}

const WHITESPACE = /\s/;
const NUMBER = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const PUNCTUATION = new Set(['{', '}', '[', ']', ':', ',']);

/** Read a JSON string literal starting at `i` (input[i] === '"'). Returns the
 * end index (exclusive). Tolerates an unterminated string by consuming to EOF. */
function readString(input: string, i: number): number {
  let j = i + 1;
  while (j < input.length) {
    const ch = input[j];
    if (ch === '\\') {
      j += 2; // skip the escaped character
      continue;
    }
    if (ch === '"') {
      return j + 1;
    }
    j += 1;
  }
  return input.length; // unterminated — best effort
}

/** Is the next non-whitespace character after `i` a colon? (string → key) */
function isKey(input: string, end: number): boolean {
  let k = end;
  while (k < input.length && WHITESPACE.test(input[k] ?? '')) k += 1;
  return input[k] === ':';
}

function matchWord(input: string, i: number, word: string): boolean {
  return input.startsWith(word, i);
}

export function tokenizeJson(input: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i] ?? '';

    // Whitespace run.
    if (WHITESPACE.test(ch)) {
      let j = i + 1;
      while (j < input.length && WHITESPACE.test(input[j] ?? '')) j += 1;
      tokens.push({ kind: 'whitespace', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // String (key or value).
    if (ch === '"') {
      const end = readString(input, i);
      const value = input.slice(i, end);
      tokens.push({ kind: isKey(input, end) ? 'key' : 'string', value });
      i = end;
      continue;
    }

    // Punctuation.
    if (PUNCTUATION.has(ch)) {
      tokens.push({ kind: 'punctuation', value: ch });
      i += 1;
      continue;
    }

    // Literals.
    if (matchWord(input, i, 'true')) {
      tokens.push({ kind: 'boolean', value: 'true' });
      i += 4;
      continue;
    }
    if (matchWord(input, i, 'false')) {
      tokens.push({ kind: 'boolean', value: 'false' });
      i += 5;
      continue;
    }
    if (matchWord(input, i, 'null')) {
      tokens.push({ kind: 'null', value: 'null' });
      i += 4;
      continue;
    }

    // Number.
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(input);
      if (m && m.index === i && m[0].length > 0) {
        tokens.push({ kind: 'number', value: m[0] });
        i += m[0].length;
        continue;
      }
    }

    // Anything else: a single plain character (keeps the tokenizer total).
    tokens.push({ kind: 'plain', value: ch });
    i += 1;
  }

  return tokens;
}
