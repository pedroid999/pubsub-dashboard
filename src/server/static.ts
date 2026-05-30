import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import type { Hono } from 'hono';
import type { AppEnv } from './app.js';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path)] ?? 'application/octet-stream';
}

/** Resolve a request path inside clientDir, refusing path traversal. */
function safeResolve(clientDir: string, requestPath: string): string | null {
  const rel = normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  if (rel.includes('..')) return null;
  return join(clientDir, rel);
}

export interface StaticDeps {
  clientDir: string;
}

/**
 * Serve the Vite-built client from clientDir:
 *   - `/assets/*` → fingerprinted files with immutable caching (404 if missing).
 *   - everything else (non-`/api/`) → SPA fallback to index.html.
 *
 * MUST be registered AFTER all `/api/*` routes (including the unknown-api 404).
 */
export function registerStatic(app: Hono<AppEnv>, deps: StaticDeps): void {
  app.get('/assets/*', async (c) => {
    const target = safeResolve(deps.clientDir, c.req.path);
    if (target === null) return c.text('Not found', 404);
    try {
      const data = await readFile(target);
      return c.body(data.buffer as ArrayBuffer, 200, {
        'content-type': contentTypeFor(target),
        'cache-control': 'public, max-age=31536000, immutable',
      });
    } catch {
      return c.text('Not found', 404);
    }
  });

  app.get('*', async (c) => {
    const indexPath = join(deps.clientDir, 'index.html');
    const html = await readFile(indexPath, 'utf8');
    return c.html(html);
  });
}
