import { describe, it, expect, vi } from 'vitest';
import { getActiveProject } from '../../src/server/auth/project.js';
import { GcloudMissingError, NoActiveProjectError } from '../../src/server/auth/errors.js';

type ExecResult = { stdout: string; stderr: string };
type ExecFn = (cmd: string, args: readonly string[]) => Promise<ExecResult>;

describe('auth/project — getActiveProject (T035)', () => {
  it('returns the trimmed gcloud config value', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: 'my-cool-project\n', stderr: '' }));
    await expect(getActiveProject({ exec })).resolves.toBe('my-cool-project');
    expect(exec).toHaveBeenCalledWith('gcloud', ['config', 'get-value', 'project']);
  });

  it('throws NoActiveProjectError when gcloud returns empty', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: '\n', stderr: '' }));
    await expect(getActiveProject({ exec })).rejects.toBeInstanceOf(NoActiveProjectError);
  });

  it('throws NoActiveProjectError when gcloud returns "(unset)"', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: '(unset)\n', stderr: '' }));
    await expect(getActiveProject({ exec })).rejects.toBeInstanceOf(NoActiveProjectError);
  });

  it('throws GcloudMissingError when gcloud is not on PATH (ENOENT)', async () => {
    const exec: ExecFn = vi.fn(async () => {
      const err = new Error('spawn gcloud ENOENT') as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    });
    await expect(getActiveProject({ exec })).rejects.toBeInstanceOf(GcloudMissingError);
  });

  it('ignores GOOGLE_CLOUD_PROJECT env var entirely (clarification: gcloud only)', async () => {
    const prev = process.env.GOOGLE_CLOUD_PROJECT;
    process.env.GOOGLE_CLOUD_PROJECT = 'env-project-should-be-ignored';
    try {
      const exec: ExecFn = vi.fn(async () => ({ stdout: 'gcloud-project\n', stderr: '' }));
      await expect(getActiveProject({ exec })).resolves.toBe('gcloud-project');
    } finally {
      if (prev === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
      else process.env.GOOGLE_CLOUD_PROJECT = prev;
    }
  });

  it('rejects a project id that fails the GCP format regex', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: 'BadProject\n', stderr: '' }));
    await expect(getActiveProject({ exec })).rejects.toBeInstanceOf(NoActiveProjectError);
  });

  it('maps a generic (non-ENOENT) gcloud failure to NoActiveProjectError', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('gcloud exited with code 1');
    });
    await expect(getActiveProject({ exec })).rejects.toBeInstanceOf(NoActiveProjectError);
  });
});
