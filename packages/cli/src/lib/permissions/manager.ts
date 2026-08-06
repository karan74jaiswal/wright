import type { PermissionRule, PermissionScope, PermissionCheckResult } from "./types";
import { matchRule } from "./matcher";
import * as fs from "node:fs/promises";
import * as path from "path";
import * as os from "os";

export class PermissionManager {
  private static sessionRules: PermissionRule[] = [];
  
  private static get systemConfigPath(): string {
    return path.join(os.homedir(), ".wright", "permissions.json");
  }

  private static async loadSystemRules(): Promise<PermissionRule[]> {
    try {
      const data = await fs.readFile(this.systemConfigPath, "utf-8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        console.error("Failed to load system permissions", e);
      }
      return [];
    }
  }

  private static async saveSystemRules(rules: PermissionRule[]) {
    try {
      const dir = path.dirname(this.systemConfigPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.systemConfigPath, JSON.stringify(rules, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save system permissions", e);
    }
  }

  public static async grant(toolName: string, targetPattern: string, scope: PermissionScope) {
    const rule: PermissionRule = {
      toolName,
      targetPattern,
      scope,
      grantedAt: Date.now()
    };

    if (scope === "session") {
      this.sessionRules.push(rule);
    } else if (scope === "system") {
      const sysRules = await this.loadSystemRules();
      sysRules.push(rule);
      await this.saveSystemRules(sysRules);
    }
  }

  /**
   * Checks if a specific tool and target are allowed.
   */
  public static async check(toolName: string, target: string, activeCwd: string): Promise<PermissionCheckResult> {
    // 1. Safe auto-grant for read operations inside the workspace
    if ((toolName === "read_file" || toolName === "list_directory") && target) {
      // Very basic sanity check: if the path resolves inside activeCwd
      // This allows the agent to read freely without annoying the user
      const resolvedTarget = path.resolve(activeCwd, target);
      const resolvedActive = path.resolve(activeCwd);
      if (resolvedTarget.startsWith(resolvedActive + path.sep) || resolvedTarget === resolvedActive) {
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
    const sysRules = await this.loadSystemRules();
    for (const rule of sysRules) {
      if (rule.toolName === toolName && matchRule(rule.targetPattern, target)) {
        return { allowed: true, rule };
      }
    }

    return { allowed: false };
  }
}
