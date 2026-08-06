import { minimatch } from "minimatch";

/**
 * Checks if a requested target matches the granted pattern.
 * If the pattern is an exact string, they must match exactly.
 * If the pattern ends with *, it acts as a prefix matcher for commands (e.g. npm * matches npm run).
 * For files, we use minimatch if it looks like a glob.
 */
export function matchRule(pattern: string, actual: string): boolean {
  if (!pattern || !actual) return false;
  if (pattern === actual) return true;

  // Simple wildcard catch-all for extreme cases
  if (pattern === "*") return true;

  // If pattern is a file glob (e.g. /path/to/* or src/**/*.ts)
  if (pattern.includes("/") && pattern.includes("*")) {
    return minimatch(actual, pattern, { dot: true });
  }

  // If pattern is a command prefix (e.g. npm *)
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1); // remove the *
    return actual.startsWith(prefix);
  }

  return false;
}
