/**
 * Pure JSON well-formedness + formatting core for the publish composer
 * (feature 005, FR-002..FR-005, FR-008).
 *
 * Distinct from `jsonFormat.tryPrettyPrintJson`, which is the *receive-display*
 * helper (FR-027) where bare primitives are intentionally shown as-is and only
 * objects/arrays count as "JSON". Here, ANY well-formed JSON value is valid —
 * including primitives `"x"`, `42`, `true`, `null` (FR-008) — so do not merge
 * the two modules.
 */

export type JsonValidity = { valid: true } | { valid: false; message: string; position?: number };

export type FormatResult = { ok: true; formatted: string } | { ok: false; message: string };

/**
 * Validate that `text` is a well-formed JSON value. Empty/whitespace-only input
 * is treated as invalid in JSON mode (FR-003 edge case). On a parse error the
 * engine's reason is surfaced and the character position is extracted when the
 * runtime reports one (FR-003).
 */
export function validateJson(text: string): JsonValidity {
  if (text.trim().length === 0) {
    return { valid: false, message: 'Body is empty — enter valid JSON.' };
  }
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (err) {
    const message = (err as Error).message;
    const match = /position (\d+)/i.exec(message);
    return match
      ? { valid: false, message, position: Number(match[1]) }
      : { valid: false, message };
  }
}

/**
 * Pretty-print any well-formed JSON value with 2-space indent (FR-005). Invalid
 * JSON is NOT reformatted — the parse error is returned so the caller can keep
 * the body untouched and surface the failure.
 */
export function formatJson(text: string): FormatResult {
  try {
    const parsed: unknown = JSON.parse(text);
    return { ok: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
