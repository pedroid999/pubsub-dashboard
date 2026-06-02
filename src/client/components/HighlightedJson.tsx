import { tokenizeJson, type JsonTokenKind } from '../lib/jsonHighlight.js';

/** Map tokenizer kinds onto the `.tok-*` classes defined in styles.css. */
const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: 'tok-key',
  string: 'tok-str',
  number: 'tok-num',
  boolean: 'tok-bool',
  null: 'tok-null',
  punctuation: 'tok-punct',
  whitespace: '',
  plain: '',
};

/**
 * Display-only JSON syntax highlight (US6, FR-018/FR-019). Renders the exact
 * input text as colored token spans — the concatenated spans reproduce the input
 * char-for-char, so it never alters bytes. Shared by the publisher overlay and
 * the receiver payload view (reuses the single `jsonHighlight` tokenizer).
 */
export function HighlightedJson({ text }: { text: string }): JSX.Element {
  return (
    <>
      {tokenizeJson(text).map((tok, i) => (
        <span key={i} className={TOKEN_CLASS[tok.kind]}>
          {tok.value}
        </span>
      ))}
    </>
  );
}
