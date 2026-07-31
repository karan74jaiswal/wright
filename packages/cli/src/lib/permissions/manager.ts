import type { PermissionRule, PermissionScope, PermissionCheckResult } from "./types";
import { matchRule } from "./matcher";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export class PermissionManager {
  private static sessionRules: PermissionRule[] = [];
  
  private static get systemConfigPath(): string {
    return path.join(os.homedir(), ".wright", "permissions.json");
  }

  private static loadSystemRules(): PermissionRule[] {
    try {
      if (fs.existsSync(this.systemConfigPath)) {
        const data = fs.readFileSync(this.systemConfigPath, "utf-8");
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("Failed to load system permissions", e);
    }
    return [];
  }

  private static saveSystemRules(rules: PermissionRule[]) {
    try {
      const dir = path.dirname(this.systemConfigPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.systemConfigPath, JSON.stringify(rules, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save system permissions", e);
    }
  }

  public static grant(toolName: string, targetPattern: string, scope: PermissionScope) {
    const rule: PermissionRule = {
      toolName,
      targetPattern,
      scope,
      grantedAt: Date.now()
    };

    if (scope === "session") {
      this.sessionRules.push(rule);
    } else if (scope === "system") {
      const sysRules = this.loadSystemRules();
      sysRules.push(rule);
      this.saveSystemRules(sysRules);
    }
  }

  /**
   * Checks if a specific tool and target are allowed.
   */
  public static check(toolName: string, target: string, activeCwd: string): PermissionCheckResult {
    // 1. Safe auto-grant for read operations inside the workspace
    if ((toolName === "read_file" || toolName === "list_directory") && target) {
      // Very basic sanity check: if the path resolves inside activeCwd
      // This allows the agent to read freely without annoying the user
      const resolvedTarget = path.resolve(target);
      const resolvedActive = path.resolve(activeCwd);
      if (resolvedTarget.startsWith(resolvedActive)) {
        return { allowed: true }; // Auto-granted
      }
    }

    // 2. Check Session Rules (Project-level)
    for (const rule of this.sessionRules) {
      if (rule.toolName === toolName && matchRule(rule.targetPattern, target)) {
        return { allowed: true, rule };
      }
    }

    // 3. Check System Rules
    const sysRules = this.loadSystemRules();
    for (const rule of sysRules) {
      if (rule.toolName === toolName && matchRule(rule.targetPattern, target)) {
        return { allowed: true, rule };
      }
    }

    return { allowed: false };
  }
}
