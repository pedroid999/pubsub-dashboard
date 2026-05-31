/**
 * If `text` parses as a JSON object or array, return it pretty-printed
 * (2-space indent) with `isJson: true`; otherwise return the original text with
 * `isJson: false`. Display-only (FR-027) — never used to edit or re-serialise a
 * payload for sending. Primitive JSON values (numbers, booleans, bare strings)
 * are shown as-is rather than "formatted".
 */
export function tryPrettyPrintJson(text: string): { formatted: string; isJson: boolean } {
  if (text.length === 0) return { formatted: text, isJson: false };
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object') {
      return { formatted: text, isJson: false };
    }
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { formatted: text, isJson: false };
  }
}
