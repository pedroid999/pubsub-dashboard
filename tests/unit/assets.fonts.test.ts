import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stylesPath = resolve(__dirname, '../../src/client/styles.css');
const fontsDir = resolve(__dirname, '../../src/client/assets/fonts');

/**
 * FR-025 / SC-008: the redesign MUST be local-first with NO third-party CDN font
 * request at runtime. This guard fails if styles.css ever references a remote
 * font CDN (Google Fonts, gstatic, etc.) or any absolute http(s) font URL.
 */
describe('fonts are local-first (no CDN) — FR-025/SC-008', () => {
  const css = readFileSync(stylesPath, 'utf8');

  it('styles.css does not reference any third-party font CDN', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com/i);
    expect(css).not.toMatch(/fonts\.gstatic\.com/i);
    expect(css).not.toMatch(/use\.typekit/i);
  });

  it('styles.css contains no absolute http(s) url() references', () => {
    const urls = css.match(/url\(([^)]+)\)/gi) ?? [];
    for (const u of urls) {
      expect(u).not.toMatch(/https?:\/\//i);
    }
  });

  it('the self-hosted fonts directory exists with documentation', () => {
    expect(existsSync(fontsDir)).toBe(true);
    expect(existsSync(resolve(fontsDir, 'README.md'))).toBe(true);
  });
});
