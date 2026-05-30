import { parseArgs } from 'node:util';
import { z } from 'zod';
import { DEFAULT_PORT } from '../shared/port.js';

export const CliArgsSchema = z
  .object({
    port: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    verbose: z.boolean().default(false),
    help: z.boolean().default(false),
    version: z.boolean().default(false),
  })
  .strict();

export type CliArgs = z.infer<typeof CliArgsSchema>;

/**
 * Parse an argv tail (without `node`/script path) into validated CliArgs.
 *
 * Exits via thrown Error on unknown flags or invalid values — the bin entrypoint
 * maps these to exit code 2 with the canonical stderr line from `contracts/cli.md`.
 */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  let raw: Record<string, string | boolean>;
  try {
    const parsed = parseArgs({
      args: [...argv],
      options: {
        port: { type: 'string' },
        verbose: { type: 'boolean' },
        help: { type: 'boolean' },
        version: { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    });
    raw = parsed.values as Record<string, string | boolean>;
  } catch (err) {
    throw new Error(`[pubsub-dashboard] ${(err as Error).message}. See --help.`);
  }

  const result = CliArgsSchema.safeParse(raw);
  if (!result.success) {
    // A failed safeParse always has at least one issue.
    const issue = result.error.issues[0]!;
    throw new Error(`[pubsub-dashboard] --${issue.path.join('.')} ${issue.message}. See --help.`);
  }
  return result.data;
}
