import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Resolve the reserved on-disk preferences path (data-model.md Entity 3).
 * Bootstrap (feature 001) MUST NOT read or write this file; the path exists so
 * feature 002+ can begin using it. Uses `$XDG_CONFIG_HOME` when set, else
 * `$HOME/.config` (the Linux convention, intentionally also on macOS).
 */
export function preferencesPath(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(env.HOME ?? homedir(), '.config');
  return join(base, 'pubsub-dashboard', 'preferences.json');
}
