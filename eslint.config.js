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
);
