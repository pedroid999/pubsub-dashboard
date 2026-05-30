import { serve } from '@hono/node-server';
import type { Logger } from 'pino';
import { buildServer } from './server.js';
import { PortInUseError } from './auth/errors.js';
import { BIND_ADDRESS } from '../shared/port.js';
import type { GetSession } from './routes/session.js';

export interface StartOptions {
  port: number;
  logger: Logger;
  clientDir: string;
  getSession: GetSession;
}

export interface RunningServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

/**
 * Bind the assembled Hono app to a real Node HTTP server on the loopback
 * interface. Rejects with {@link PortInUseError} (exit 14) if the port is busy.
 */
export function start(opts: StartOptions): Promise<RunningServer> {
  const app = buildServer({
    logger: opts.logger,
    port: opts.port,
    clientDir: opts.clientDir,
    getSession: opts.getSession,
    startedAtMs: Date.now(),
  });

  return new Promise<RunningServer>((resolve, reject) => {
    let settled = false;

    const server = serve({ fetch: app.fetch, hostname: BIND_ADDRESS, port: opts.port }, (info) => {
      settled = true;
      opts.logger.info({ port: info.port, bind: BIND_ADDRESS }, 'listening');
      resolve({
        url: `http://${BIND_ADDRESS}:${info.port}`,
        port: info.port,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      if (err.code === 'EADDRINUSE') {
        reject(new PortInUseError(opts.port));
      } else {
        reject(err);
      }
    });
  });
}
