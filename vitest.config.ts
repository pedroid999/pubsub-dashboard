import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    environmentMatchGlobs: [
      ['tests/unit/client.**', 'jsdom'],
      ['tests/unit/**/*.test.tsx', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/client/components/ui/**',
        'src/**/*.stories.*',
        'bin/**',
        'dist/**',
      ],
      // Final thresholds are wired in Phase 5 / US2 (task T072).
      // For PR #1 (scaffolding + foundational) the thresholds stay at 0
      // so PR #1 itself can land before US2 ratchets them to 90.
      thresholds: {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    },
  },
  resolve: {
    alias: {
      '@server': resolve(__dirname, 'src/server'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@client': resolve(__dirname, 'src/client'),
      '@cli': resolve(__dirname, 'src/cli'),
    },
  },
});
