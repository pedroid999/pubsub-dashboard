import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

const eslint = new ESLint();

describe('FR-020 extension-boundary lint rule (T093b)', () => {
  it('flags a non-auth file importing auth/adc.js internals', async () => {
    const code = "import { resolveAdc } from '../auth/adc.js';\nresolveAdc;\n";
    const [result] = await eslint.lintText(code, {
      filePath: 'src/server/routes/__fixture__.ts',
    });
    const messages = result!.messages.map((m) => m.message).join(' ');
    expect(result!.errorCount).toBeGreaterThan(0);
    expect(messages).toContain('src/server/auth/index.ts');
  });

  it('flags a non-auth file importing auth/project.js internals', async () => {
    const code = "import { getActiveProject } from '../auth/project.js';\ngetActiveProject;\n";
    const [result] = await eslint.lintText(code, {
      filePath: 'src/client/components/__fixture__.tsx',
    });
    expect(result!.messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('does NOT flag files inside src/server/auth/** importing siblings', async () => {
    const code = "import type { AdcContext } from './adc.js';\nexport type X = AdcContext;\n";
    const [result] = await eslint.lintText(code, {
      filePath: 'src/server/auth/__fixture__.ts',
    });
    expect(result!.messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  });

  it('does NOT flag importing the auth barrel from outside auth/**', async () => {
    const code = "import { resolveAdc } from '../auth/index.js';\nresolveAdc;\n";
    const [result] = await eslint.lintText(code, {
      filePath: 'src/server/routes/__fixture__.ts',
    });
    expect(result!.messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(false);
  });
});
