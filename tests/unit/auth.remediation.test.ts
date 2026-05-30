import { describe, it, expect } from 'vitest';
import {
  GcloudMissingError,
  AdcMissingError,
  NoActiveProjectError,
  PortInUseError,
} from '../../src/server/auth/errors.js';
import { stderrLineFor } from '../../src/server/auth/remediation.js';

describe('auth/remediation — stderrLineFor (T037, contracts/cli.md)', () => {
  it('maps GcloudMissingError to the install line (exit 11)', () => {
    const e = new GcloudMissingError();
    expect(e.exitCode).toBe(11);
    expect(stderrLineFor(e)).toBe(
      '[pubsub-dashboard] gcloud not found on PATH. Install: https://cloud.google.com/sdk/docs/install',
    );
  });

  it('maps AdcMissingError to the ADC login line (exit 12)', () => {
    const e = new AdcMissingError();
    expect(e.exitCode).toBe(12);
    expect(stderrLineFor(e)).toBe(
      '[pubsub-dashboard] ADC not configured. Run: gcloud auth application-default login',
    );
  });

  it('maps NoActiveProjectError to the set-project line (exit 13)', () => {
    const e = new NoActiveProjectError();
    expect(e.exitCode).toBe(13);
    expect(stderrLineFor(e)).toBe(
      '[pubsub-dashboard] No active gcloud project. Run: gcloud config set project <PROJECT_ID>',
    );
  });

  it('maps PortInUseError to the --port override line (exit 14) naming the port', () => {
    const e = new PortInUseError(4321);
    expect(e.exitCode).toBe(14);
    expect(e.port).toBe(4321);
    expect(stderrLineFor(e)).toBe(
      '[pubsub-dashboard] Port 4321 already in use. Re-run with: pubsub-dashboard --port 5173',
    );
  });
});
