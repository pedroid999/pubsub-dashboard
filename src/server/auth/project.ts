import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GcloudMissingError, NoActiveProjectError } from './errors.js';

const defaultExec = promisify(execFile);

const GCP_PROJECT_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export interface GetActiveProjectOptions {
  exec?: (cmd: string, args: readonly string[]) => Promise<{ stdout: string; stderr: string }>;
}

/**
 * Resolve the active GCP project ID by shelling out to
 * `gcloud config get-value project`. This is the ONLY source of truth
 * (clarification): `GOOGLE_CLOUD_PROJECT` and the ADC quota project are
 * deliberately never consulted.
 *
 * @throws GcloudMissingError (exit 11) if `gcloud` is not on PATH.
 * @throws NoActiveProjectError (exit 13) if no valid project is configured.
 */
export async function getActiveProject(opts: GetActiveProjectOptions = {}): Promise<string> {
  const exec = opts.exec ?? defaultExec;

  let stdout: string;
  try {
    ({ stdout } = await exec('gcloud', ['config', 'get-value', 'project']));
  } catch (err) {
    if (isEnoent(err)) {
      throw new GcloudMissingError(err);
    }
    // Any other gcloud failure is treated as "no usable project".
    throw new NoActiveProjectError(err);
  }

  const project = stdout.trim();
  if (project === '' || project === '(unset)') {
    throw new NoActiveProjectError();
  }
  if (!GCP_PROJECT_RE.test(project)) {
    throw new NoActiveProjectError();
  }
  return project;
}

function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}
