import type { Logger } from 'pino';
import { parseCliArgs } from '../../cli/args.js';
import { createLogger } from '../middleware/trace.js';
import { resolveAdc, type AdcContext } from '../auth/adc.js';
import { resolveIdentity } from '../auth/identity.js';
import { getActiveProject } from '../auth/project.js';
import { CliError } from '../auth/errors.js';
import { stderrLineFor } from '../auth/remediation.js';
import { start as defaultStart, type RunningServer } from '../boot.js';
import { createSessionStore } from '../session.js';
import { BIND_ADDRESS } from '../../shared/port.js';

const HELP_TEXT = `pubsub-dashboard — local-first Google Cloud Pub/Sub dashboard

Usage: pubsub-dashboard [--port <n>] [--verbose] [--help] [--version]

Flags:
  --port <n>   TCP port to bind on 127.0.0.1 (default: 4321)
  --verbose    Raise log level to debug (payloads redacted; credentials always redacted)
  --help       Print this help and exit
  --version    Print the version and exit

The server is loopback-only and authenticates via gcloud ADC.`;

export interface RunCliDeps {
  argv: string[];
  logger?: Logger;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  resolveAdc?: () => Promise<AdcContext>;
  getActiveProject?: () => Promise<string>;
  resolveIdentity?: (adc: AdcContext) => Promise<string>;
  start?: typeof defaultStart;
  open?: (url: string) => Promise<unknown>;
  waitForShutdown?: (server: RunningServer) => Promise<void>;
  clientDir?: string;
  version?: string;
}

/**
 * Orchestrate a full run: parse args, resolve auth + project + identity,
 * start the server, open the browser, then wait for shutdown. All side-effect
 * dependencies are injectable so the orchestration is unit-testable without
 * touching gcloud, the network, or a real browser.
 *
 * @returns the process exit code (the bin wrapper passes this to process.exit).
 */
export async function runCli(deps: RunCliDeps): Promise<number> {
  const logger = deps.logger ?? createLogger();
  const stdout = deps.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = deps.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));

  let args;
  try {
    args = parseCliArgs(deps.argv);
  } catch (err) {
    stderr(err instanceof Error ? err.message : String(err));
    return 2;
  }

  if (args.help) {
    stdout(HELP_TEXT);
    return 0;
  }
  if (args.version) {
    stdout(deps.version ?? '0.0.0');
    return 0;
  }

  const adcFn = deps.resolveAdc ?? resolveAdc;
  const projectFn = deps.getActiveProject ?? getActiveProject;
  const identityFn = deps.resolveIdentity ?? resolveIdentity;
  const startFn = deps.start ?? defaultStart;
  const openFn = deps.open;
  const clientDir = deps.clientDir ?? 'dist/client';
  const runLogger = args.verbose ? logger.child({ verbose: true }) : logger;

  try {
    const adc = await adcFn();
    const projectId = await projectFn();
    const identity = await identityFn(adc);

    const store = createSessionStore({
      projectId,
      identity,
      bindAddress: BIND_ADDRESS,
      port: args.port,
      startedAt: new Date().toISOString(),
      version: deps.version ?? '0.0.0',
      nodeVersion: process.version,
    });

    const server = await startFn({
      port: args.port,
      logger: runLogger,
      clientDir,
      getSession: async (traceId: string) => {
        store.setLastTraceId(traceId);
        return store.snapshot();
      },
    });

    stdout(`pubsub-dashboard listening at ${server.url}`);

    if (openFn) {
      try {
        await openFn(server.url);
      } catch {
        stdout(`Open this URL manually: ${server.url}`);
      }
    }

    const waitForShutdown = deps.waitForShutdown ?? defaultWaitForShutdown;
    await waitForShutdown(server);
    await server.close();
    return 0;
  } catch (err) {
    if (err instanceof CliError) {
      // F4: preserve the verbatim underlying error in structured logs before
      // printing the canonical remediation line on stderr.
      runLogger.error({ err: err.cause ?? err, code: err.code }, err.message);
      stderr(stderrLineFor(err));
      return err.exitCode;
    }
    runLogger.error({ err }, 'unexpected error');
    stderr(
      `[pubsub-dashboard] Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

/** Default: resolve when the process receives SIGINT or SIGTERM. */
function defaultWaitForShutdown(server: RunningServer): Promise<void> {
  return new Promise<void>((resolve) => {
    let closing = false;
    const onSignal = () => {
      if (closing) {
        process.exit(0);
      }
      closing = true;
      resolve();
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    void server;
  });
}
