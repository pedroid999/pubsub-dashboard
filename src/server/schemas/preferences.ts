import { z } from 'zod';

/**
 * Reserved for feature 002+. Bootstrap (feature 001) MUST NOT read or write
 * this file — see `data-model.md` Entity 3 and `tests/integration/preferences.untouched.test.ts`.
 */
export const PreferencesSchema = z
  .object({
    preferredPort: z.number().int().min(1).max(65535).optional(),
    verboseByDefault: z.boolean().optional(),
    recentProjects: z.array(z.string()).max(20).optional(),
  })
  .strict();

export type Preferences = z.infer<typeof PreferencesSchema>;
