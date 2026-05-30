export type CliErrorCode = 'GCLOUD_MISSING' | 'ADC_MISSING' | 'NO_ACTIVE_PROJECT' | 'PORT_IN_USE';

/**
 * Base class for all errors that map to a process exit code + a canonical
 * stderr remediation line (see `auth/remediation.ts` and `contracts/cli.md`).
 */
export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: number;

  constructor(
    code: CliErrorCode,
    exitCode: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class GcloudMissingError extends CliError {
  constructor(cause?: unknown) {
    super('GCLOUD_MISSING', 11, 'gcloud not found on PATH', { cause });
  }
}

export class AdcMissingError extends CliError {
  constructor(cause?: unknown) {
    super('ADC_MISSING', 12, 'ADC not configured', { cause });
  }
}

export class NoActiveProjectError extends CliError {
  constructor(cause?: unknown) {
    super('NO_ACTIVE_PROJECT', 13, 'No active gcloud project', { cause });
  }
}

export class PortInUseError extends CliError {
  readonly port: number;

  constructor(port: number) {
    super('PORT_IN_USE', 14, `Port ${port} already in use`);
    this.port = port;
  }
}
