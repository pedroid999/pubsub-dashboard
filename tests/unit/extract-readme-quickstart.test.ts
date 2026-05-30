import { describe, it, expect } from 'vitest';
import { extractQuickstart } from '../../scripts/extract-readme-quickstart.mjs';

describe('extractQuickstart (T081)', () => {
  it('returns the script body of the single quickstart fence', () => {
    const md = ['# Title', '', '```bash quickstart', 'echo hello', 'echo world', '```', ''].join(
      '\n',
    );
    expect(extractQuickstart(md)).toBe('echo hello\necho world\n');
  });

  it('throws when no quickstart fence exists', () => {
    const md = '# Title\n\n```bash\necho not-tagged\n```\n';
    expect(() => extractQuickstart(md)).toThrow(/No .*quickstart/);
  });

  it('throws when more than one quickstart fence exists', () => {
    const md = ['```bash quickstart', 'a', '```', '```bash quickstart', 'b', '```'].join('\n');
    expect(() => extractQuickstart(md)).toThrow(/exactly one/);
  });

  it('ignores plain bash fences that are not tagged quickstart', () => {
    const md = ['```bash', 'echo other', '```', '```bash quickstart', 'echo qs', '```'].join('\n');
    expect(extractQuickstart(md)).toBe('echo qs\n');
  });
});
