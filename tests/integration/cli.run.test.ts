import { describe, it, expect, vi } from 'vitest';
import { runCli, type RunCliDeps } from '../../src/server/cli/run.js';
import { createLogger } from '../../src/server/middleware/trace.js';
import {
  AdcMissingError,
  GcloudMissingError,
  NoActiveProjectError,
  PortInUseError,
} from '../../src/server/auth/errors.js';

function baseDeps(over: Partial<RunCliDeps> = {}): RunCliDeps {
  const fakeServer = {
    url: 'http://127.0.0.1:4321',
    port: 4321,
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    argv: [],
    logger: createLogger({ level: 'silent' }),
    stdout: vi.fn(),
    stderr: vi.fn(),
    resolveAdc: vi.fn().mockResolvedValue({
      getAccessToken: vi.fn().mockResolvedValue('tok'),
      getCredentials: vi.fn().mockResolvedValue({ client_email: 'sa@p.iam.gserviceaccount.com' }),
    }),
    getActiveProject: vi.fn().mockResolvedValue('my-cool-project'),
    resolveIdentity: vi.fn().mockResolvedValue('dev@example.com'),
    start: vi.fn().mockResolvedValue(fakeServer),
    open: vi.fn().mockResolvedValue(undefined),
    waitForShutdown: vi.fn().mockResolvedValue(undefined),
    clientDir: 'tests/fixtures/client',
    version: '0.1.0',
    ...over,
  };
}

describe('runCli — flags', () => {
  it('--help prints synopsis and exits 0 without starting the server', async () => {
    const start = vi.fn();
    const stdout = vi.fn();
    const code = await runCli(baseDeps({ argv: ['--help'], start, stdout }));
    expect(code).toBe(0);
    expect(start).not.toHaveBeenCalled();
    expect(stdout.mock.calls.join('\n')).toContain('--port');
  });

  it('--version prints the version and exits 0 without starting the server', async () => {
    const start = vi.fn();
    const stdout = vi.fn();
    const code = await runCli(baseDeps({ argv: ['--version'], start, stdout, version: '0.1.0' }));
    expect(code).toBe(0);
    expect(start).not.toHaveBeenCalled();
    expect(stdout.mock.calls.join('')).toContain('0.1.0');
  });

  it('--help with no injected stdout/logger uses the process defaults (exit 0)', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      const code = await runCli({ argv: ['--help'] });
      expect(code).toBe(0);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('--version with no injected version falls back to 0.0.0', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      const code = await runCli({ argv: ['--version'] });
      expect(code).toBe(0);
      expect(spy.mock.calls.join('')).toContain('0.0.0');
    } finally {
      spy.mockRestore();
    }
  });

  it('unknown flag exits 2 with a message pointing at --help', async () => {
    const stderr = vi.fn();
    const code = await runCli(baseDeps({ argv: ['--nope'], stderr }));
    expect(code).toBe(2);
    expect(stderr.mock.calls.join('')).toContain('--help');
  });
});

describe('runCli — success path (T050, T-CLI-010)', () => {
  it('starts the server and opens the browser at the served URL, exits 0', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const code = await runCli(baseDeps({ open }));
    expect(open).toHaveBeenCalledWith('http://127.0.0.1:4321');
    expect(code).toBe(0);
  });

  it('still exits 0 and prints the URL when open() rejects (no default browser)', async () => {
    const open = vi.fn().mockRejectedValue(new Error('no browser'));
    const stdout = vi.fn();
    const code = await runCli(baseDeps({ open, stdout }));
    expect(code).toBe(0);
    expect(stdout.mock.calls.join('\n')).toContain('http://127.0.0.1:4321');
  });
});

describe('runCli — error mapping (T-CLI-006..009)', () => {
  it('maps GcloudMissingError to exit 11 + stderr line', async () => {
    const stderr = vi.fn();
    const code = await runCli(
      baseDeps({ getActiveProject: vi.fn().mockRejectedValue(new GcloudMissingError()), stderr }),
    );
    expect(code).toBe(11);
    expect(stderr.mock.calls.join('')).toContain('gcloud not found on PATH');
  });

  it('maps AdcMissingError to exit 12 + stderr line, logging the verbatim error first (F4)', async () => {
    const stderr = vi.fn();
    const logger = createLogger({ level: 'silent' });
    const errSpy = vi.spyOn(logger, 'error');
    const code = await runCli(
      baseDeps({
        resolveAdc: vi
          .fn()
          .mockRejectedValue(new AdcMissingError(new Error('token expired verbatim'))),
        stderr,
        logger,
      }),
    );
    expect(code).toBe(12);
    expect(stderr.mock.calls.join('')).toContain('ADC not configured');
    expect(errSpy).toHaveBeenCalled();
  });

  it('maps NoActiveProjectError to exit 13 + stderr line', async () => {
    const stderr = vi.fn();
    const code = await runCli(
      baseDeps({ getActiveProject: vi.fn().mockRejectedValue(new NoActiveProjectError()), stderr }),
    );
    expect(code).toBe(13);
    expect(stderr.mock.calls.join('')).toContain('No active gcloud project');
  });

  it('maps PortInUseError to exit 14 + stderr line', async () => {
    const stderr = vi.fn();
    const code = await runCli(
      baseDeps({ start: vi.fn().mockRejectedValue(new PortInUseError(4321)), stderr }),
    );
    expect(code).toBe(14);
    expect(stderr.mock.calls.join('')).toContain('Port 4321 already in use');
  });

  it('maps an unexpected (non-CliError) failure to exit 1', async () => {
    const stderr = vi.fn();
    const code = await runCli(
      baseDeps({ getActiveProject: vi.fn().mockRejectedValue(new Error('weird')), stderr }),
    );
    expect(code).toBe(1);
    expect(stderr.mock.calls.join('')).toContain('Unexpected error');
  });
});

describe('runCli — verbose + no-open branches', () => {
  it('runs with --verbose (child logger) and no open() provided', async () => {
    const start = vi.fn().mockResolvedValue({
      url: 'http://127.0.0.1:4321',
      port: 4321,
      close: vi.fn().mockResolvedValue(undefined),
    });
    const code = await runCli(baseDeps({ argv: ['--verbose'], start, open: undefined }));
    expect(code).toBe(0);
    expect(start).toHaveBeenCalled();
  });
});

describe('runCli — session provider closure', () => {
  it('builds a session whose getSession sets the trace id and snapshots project + identity', async () => {
    let captured: { projectId: string; identity: string; lastTraceId: string | null } | undefined;
    const start = vi
      .fn()
      .mockImplementation(async (opts: { getSession: (t: string) => Promise<unknown> }) => {
        captured = (await opts.getSession('trace-abc')) as typeof captured;
        return {
          url: 'http://127.0.0.1:4321',
          port: 4321,
          close: vi.fn().mockResolvedValue(undefined),
        };
      });
    const code = await runCli(
      baseDeps({
        start,
        getActiveProject: vi.fn().mockResolvedValue('my-cool-project'),
        resolveIdentity: vi.fn().mockResolvedValue('dev@example.com'),
      }),
    );
    expect(code).toBe(0);
    expect(captured?.projectId).toBe('my-cool-project');
    expect(captured?.identity).toBe('dev@example.com');
    expect(captured?.lastTraceId).toBe('trace-abc');
  });
});

describe('runCli — demo seam (FR-019)', () => {
  it('boots using PUBSUB_DEMO_PROJECT without any gcloud-backed resolver', async () => {
    let captured: { projectId: string; identity: string } | undefined;
    const start = vi
      .fn()
      .mockImplementation(async (opts: { getSession: (t: string) => Promise<unknown> }) => {
        captured = (await opts.getSession('t')) as typeof captured;
        return {
          url: 'http://127.0.0.1:4321',
          port: 4321,
          close: vi.fn().mockResolvedValue(undefined),
        };
      });
    const code = await runCli({
      argv: [],
      logger: createLogger({ level: 'silent' }),
      stdout: vi.fn(),
      stderr: vi.fn(),
      start,
      clientDir: 'tests/fixtures/client',
      waitForShutdown: vi.fn().mockResolvedValue(undefined),
      env: {
        PUBSUB_DEMO_PROJECT: 'demo-proj',
        PUBSUB_DEMO_IDENTITY: 'ci@demo.local',
      } as NodeJS.ProcessEnv,
    });
    expect(code).toBe(0);
    expect(captured?.projectId).toBe('demo-proj');
    expect(captured?.identity).toBe('ci@demo.local');
  });
});

describe('runCli — default waitForShutdown via SIGINT', () => {
  it('resolves and closes the server when SIGINT arrives', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const start = vi.fn().mockResolvedValue({ url: 'http://127.0.0.1:4321', port: 4321, close });
    const stdout = vi.fn();
    // Omit waitForShutdown so the real default (signal-based) path runs.
    const deps = baseDeps({ start, stdout });
    delete (deps as { waitForShutdown?: unknown }).waitForShutdown;

    const pending = runCli(deps);
    // Allow the server to start and the signal handler to register.
    await new Promise((r) => setTimeout(r, 20));
    process.emit('SIGINT');

    const code = await pending;
    expect(code).toBe(0);
    expect(close).toHaveBeenCalled();
  });
});
