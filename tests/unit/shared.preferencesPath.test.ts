import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { preferencesPath } from '../../src/shared/preferences-path.js';

describe('preferencesPath', () => {
  it('uses XDG_CONFIG_HOME when set and non-empty', () => {
    const p = preferencesPath({ XDG_CONFIG_HOME: '/custom/xdg' } as NodeJS.ProcessEnv);
    expect(p).toBe(join('/custom/xdg', 'pubsub-dashboard', 'preferences.json'));
  });

  it('uses HOME/.config when XDG_CONFIG_HOME is absent', () => {
    const p = preferencesPath({ HOME: '/my/home' } as NodeJS.ProcessEnv);
    expect(p).toBe(join('/my/home', '.config', 'pubsub-dashboard', 'preferences.json'));
  });

  it('uses homedir() when neither XDG_CONFIG_HOME nor HOME is set (line 12 fallback)', () => {
    const p = preferencesPath({} as NodeJS.ProcessEnv);
    expect(p).toBe(join(homedir(), '.config', 'pubsub-dashboard', 'preferences.json'));
  });
});
