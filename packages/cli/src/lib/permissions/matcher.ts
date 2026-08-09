import { minimatch } from "minimatch";

/**
 * Checks if a requested target matches the granted pattern.
 * If the pattern is an exact string, they must match exactly.
 * If the pattern ends with *, it acts as a prefix matcher for commands (e.g. npm * matches npm run).
 * For files, we use minimatch if it looks like a glob.
 */
export function matchRule(pattern: string, actual: string, isCommand: boolean = false): boolean {
  if (!pattern || !actual) return false;

  if (isCommand) {
    // Reject shell control operators in the actual target to prevent chaining bypasses via pattern match
    const controlOperators = /(&&|\|\||;|\||&|\n|\r|>|<|\$\(|\$\{|`|\{|\})/;
    if (controlOperators.test(actual)) {
      return false;
    }
  }

  if (pattern === actual) return true;

  if (isCommand) {
    // Commands require strict exact matches (which was checked above).
    // Wildcards are fundamentally unsafe for shell execution due to arbitrary arg injection.
    return false;
  }

  // Simple wildcard catch-all for extreme cases
  if (pattern === "*") return true;

  // File matching: route all remaining non-exact patterns through restricted minimatch
  return minimatch(actual, pattern, { 
    dot: true,
    nonegate: true, 
    nocomment: true,
    noext: true
  });
}
