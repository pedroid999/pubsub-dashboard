import { describe, it, expect } from 'vitest';
import { isAbsolute, sep } from 'node:path';
import { defaultClientDir } from '../../src/server/cli/run.js';

describe('defaultClientDir', () => {
  it('resolves to an absolute path (not relative to process.cwd())', () => {
    // Regression: a cwd-relative default like 'dist/client' fails with ENOENT
    // when the package is run via npx from an arbitrary directory.
    expect(isAbsolute(defaultClientDir())).toBe(true);
  });

  it('points at the sibling client directory of the compiled server', () => {
    // Layout `<root>/server/cli/ -> <root>/client` holds in both dist and src.
    expect(defaultClientDir().endsWith(`${sep}client`)).toBe(true);
  });

  it('does not depend on the current working directory', () => {
    const original = process.cwd();
    try {
      process.chdir(sep);
      const fromRoot = defaultClientDir();
      process.chdir(original);
      const fromOriginal = defaultClientDir();
      expect(fromRoot).toBe(fromOriginal);
    } finally {
      process.chdir(original);
    }
  });
});
