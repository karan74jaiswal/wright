import path from "node:path";
import { existsSync } from "node:fs";

/**
 * Resolves the path to the nearest `.env` file.
 *
 * Strategy:
 *  1. Check the current working directory (production / Docker).
 *  2. Walk up from `callerDir` (dev mode — finds monorepo root).
 *
 * @param callerDir - Typically `import.meta.dirname` of the calling module.
 * @returns The absolute path to the `.env` file, or `undefined` if none found.
 */
export function findEnvFile(callerDir: string): string | undefined {
  // 1. Standard CWD-based loading (production / Docker)
  const cwdCandidate = path.resolve(process.cwd(), ".env");
  if (existsSync(cwdCandidate)) {
    return cwdCandidate;
  }

  // 2. Walk up from caller's directory to find .env (dev mode)
  let dir = callerDir;
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break; // Hit filesystem root
    dir = parent;
  }

  return undefined;
}

/**
 * Loads environment variables using dotenv with automatic .env discovery.
 * Call this at the top of your service entry point.
 *
 * @param callerDir - Typically `import.meta.dirname` of the calling module.
 */
export function loadEnv(callerDir: string): void {
  // Lazy-import dotenv so that packages that don't use it aren't forced to install it
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv");

  const envPath = findEnvFile(callerDir);
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    // In production, env vars should be injected by the runtime
    dotenv.config();
  }
}
