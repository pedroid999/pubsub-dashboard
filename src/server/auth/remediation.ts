import { CliError, PortInUseError } from './errors.js';

/**
 * Map a CliError to the single, copy-pastable stderr line documented in
 * `contracts/cli.md`. The bin entrypoint prints this as the last line of
 * output before exiting with `error.exitCode`.
 */
export function stderrLineFor(error: CliError): string {
  switch (error.code) {
    case 'GCLOUD_MISSING':
      return '[pubsub-dashboard] gcloud not found on PATH. Install: https://cloud.google.com/sdk/docs/install';
    case 'ADC_MISSING':
      return '[pubsub-dashboard] ADC not configured. Run: gcloud auth application-default login';
    case 'NO_ACTIVE_PROJECT':
      return '[pubsub-dashboard] No active gcloud project. Run: gcloud config set project <PROJECT_ID>';
    case 'PORT_IN_USE': {
      const port = error instanceof PortInUseError ? error.port : 4321;
      return `[pubsub-dashboard] Port ${port} already in use. Re-run with: pubsub-dashboard --port 5173`;
    }
  }
}
