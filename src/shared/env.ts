export const MIN_NODE_MAJOR = 20 as const;

const NODE_VERSION_RE = /^v(\d+)\.(\d+)\.(\d+)/;

/**
 * Throw if the given Node.js version string is below MIN_NODE_MAJOR.
 *
 * @param version - typically `process.version` (e.g. `"v20.18.0"`).
 * @throws Error with the canonical remediation line from `contracts/cli.md`
 *   when the version is below MIN_NODE_MAJOR or malformed.
 */
export function assertSupportedNode(version: string): void {
  const match = NODE_VERSION_RE.exec(version);
  if (!match || match[1] === undefined) {
    throw new Error(
      `[pubsub-dashboard] Requires Node >= ${MIN_NODE_MAJOR} LTS. Install or switch with: nvm install ${MIN_NODE_MAJOR} && nvm use ${MIN_NODE_MAJOR}`,
    );
  }
  const major = Number.parseInt(match[1], 10);
  if (major < MIN_NODE_MAJOR) {
    throw new Error(
      `[pubsub-dashboard] Requires Node >= ${MIN_NODE_MAJOR} LTS. Install or switch with: nvm install ${MIN_NODE_MAJOR} && nvm use ${MIN_NODE_MAJOR}`,
    );
  }
}
