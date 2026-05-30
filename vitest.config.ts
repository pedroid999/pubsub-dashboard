import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    environmentMatchGlobs: [
      ['tests/unit/client.**', 'jsdom'],
      ['tests/unit/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['tests/setup.client.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/client/components/ui/**',
        'src/**/*.stories.*',
        'src/client/main.tsx',
        'bin/**',
        'dist/**',
      ],
      // FR-015 / SC-005: hard gate at 90% line AND branch on src/**.
      // Functions + statements are held to the same bar (stricter than the
      // spec minimum, per the analyze F7 decision).
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
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
