import { describe, it, expect } from 'vitest';
import { DEFAULT_PORT, BIND_ADDRESS } from '../../src/shared/port.js';

describe('shared/port', () => {
  it('DEFAULT_PORT is 4321', () => {
    expect(DEFAULT_PORT).toBe(4321);
  });

  it('BIND_ADDRESS is loopback only', () => {
    expect(BIND_ADDRESS).toBe('127.0.0.1');
  });
});
