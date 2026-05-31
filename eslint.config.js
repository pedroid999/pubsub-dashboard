// Flat ESLint config. Phase 1 (PR #1) scaffolding only.
// Final ruleset (typescript-eslint strict, no-restricted-imports, import/order)
// is wired in Phase 5 / US2 task T073.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.specify/**',
      '.windsurf/**',
      'specs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Enforce the clarification: the active project comes ONLY from
    // `gcloud config get-value project` (src/server/auth/project.ts).
    // Reading GOOGLE_CLOUD_PROJECT anywhere in src/ is forbidden.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='GOOGLE_CLOUD_PROJECT']",
          message:
            'Forbidden: resolve the project via `gcloud config get-value project` (auth/project.ts), never GOOGLE_CLOUD_PROJECT.',
        },
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true]:has(Literal[value='GOOGLE_CLOUD_PROJECT'])",
          message:
            'Forbidden: resolve the project via `gcloud config get-value project` (auth/project.ts), never GOOGLE_CLOUD_PROJECT.',
        },
      ],
    },
  },
  {
    // FR-020 extension boundary: only `src/server/auth/index.ts` may be consumed
    // from outside the auth module. New dashboard sections (feature 002+) must
    // not reach into auth/adc.ts or auth/project.ts internals.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/auth/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/auth/adc', '**/auth/adc.js', '**/auth/project', '**/auth/project.js'],
              message:
                'Import auth via src/server/auth/index.ts — auth/adc.ts and auth/project.ts internals are off-limits outside src/server/auth/** (FR-020).',
            },
          ],
        },
      ],
    },
  },
);
