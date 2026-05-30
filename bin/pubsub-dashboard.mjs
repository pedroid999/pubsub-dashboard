#!/usr/bin/env node
// Node-version guard MUST run before importing any compiled source so that an
// unsupported Node prints a friendly message (exit 10) instead of crashing.
// `PUBSUB_NODE_VERSION_OVERRIDE` is a documented test seam (see boot.node-guard.test.ts).
const rawVersion = process.env.PUBSUB_NODE_VERSION_OVERRIDE ?? process.versions.node;
const major = Number.parseInt(String(rawVersion).replace(/^v/, '').split('.')[0], 10);

if (!Number.isInteger(major) || major < 20) {
  process.stderr.write(
    '[pubsub-dashboard] Requires Node >= 20 LTS. Install or switch with: nvm install 20 && nvm use 20\n',
  );
  process.exit(10);
}

const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const { runCli } = await import('../dist/server/cli/run.js');

const code = await runCli({
  argv: process.argv.slice(2),
  open: async (url) => (await import('open')).default(url),
  version: pkg.version,
});

process.exit(code);
