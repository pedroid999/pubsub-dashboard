import { describe, it, expect } from 'vitest';
import { parseCliArgs, CliArgsSchema } from '../../src/cli/args.js';

describe('CliArgsSchema (T-SCHEMA-050..053)', () => {
  it('defaults to {port:4321, verbose:false, help:false, version:false}', () => {
    expect(CliArgsSchema.parse({})).toEqual({
      port: 4321,
      verbose: false,
      help: false,
      version: false,
    });
  });

  it('coerces a string port to number', () => {
    expect(CliArgsSchema.parse({ port: '5173' }).port).toBe(5173);
  });

  it('rejects non-numeric port', () => {
    expect(() => CliArgsSchema.parse({ port: 'abc' })).toThrow();
  });

  it('rejects unknown keys (strict)', () => {
    expect(() => CliArgsSchema.parse({ xyz: true })).toThrow();
  });
});

describe('parseCliArgs (argv → CliArgs)', () => {
  it('parses an empty argv to all defaults', () => {
    expect(parseCliArgs([])).toEqual({ port: 4321, verbose: false, help: false, version: false });
  });

  it('parses --port 5173', () => {
    expect(parseCliArgs(['--port', '5173']).port).toBe(5173);
  });

  it('parses --verbose, --help, --version booleans', () => {
    expect(parseCliArgs(['--verbose']).verbose).toBe(true);
    expect(parseCliArgs(['--help']).help).toBe(true);
    expect(parseCliArgs(['--version']).version).toBe(true);
  });

  it('rejects unknown flags with a message pointing at --help', () => {
    expect(() => parseCliArgs(['--xyz'])).toThrow(/--help/);
  });

  it('rejects --port with out-of-range value', () => {
    expect(() => parseCliArgs(['--port', '999999'])).toThrow();
    expect(() => parseCliArgs(['--port', '0'])).toThrow();
  });
});
