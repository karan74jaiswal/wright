import type { PermissionRule, PermissionScope, PermissionCheckResult } from "./types";
import { matchRule } from "./matcher";
import * as fs from "node:fs/promises";
import * as path from "path";
import * as os from "os";

export class PermissionManager {
  private static sessionRules: Record<string, PermissionRule[]> = {};
  
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

  public static async grant(toolName: string, targetPattern: string, scope: PermissionScope, sessionId: string = "default-session") {
    const rule: PermissionRule = {
      toolName,
      targetPattern,
      scope,
      grantedAt: Date.now()
    };

    if (scope === "session") {
      if (!this.sessionRules[sessionId]) this.sessionRules[sessionId] = [];
      this.sessionRules[sessionId].push(rule);
    } else if (scope === "system") {
      const sysRules = await this.loadSystemRules();
      sysRules.push(rule);
      await this.saveSystemRules(sysRules);
    }
  }

  /**
   * Checks if a specific tool and target are allowed.
   */
  public static async check(toolName: string, target: string, activeCwd: string, sessionId: string = "default-session"): Promise<PermissionCheckResult> {
    // 1. Safe auto-grant for read operations inside the workspace
    if ((toolName === "read_file" || toolName === "list_directory") && target) {
      const resolvedTarget = path.resolve(activeCwd, target);
      
      // Explicitly block high-risk files even inside the workspace
      const filename = path.basename(resolvedTarget).toLowerCase();
      const isHighRisk =
        filename === ".env" ||
        filename.startsWith(".env.") ||
        filename.endsWith(".pem") ||
        filename.endsWith(".key") ||
        filename.endsWith(".p12") ||
        filename.endsWith(".pfx") ||
        filename === ".npmrc" ||
        /^id_(rsa|dsa|ecdsa|ed25519)/.test(filename);
      
      if (!isHighRisk) {
        try {
          // Resolve actual physical paths to prevent symlink traversal
          const realTarget = await fs.realpath(resolvedTarget);
          const realActive = await fs.realpath(activeCwd);
          
          if (realTarget.startsWith(realActive + path.sep) || realTarget === realActive) {
            return { allowed: true, resolvedPath: realTarget }; // Auto-granted
          }
        } catch (e) {
          // If realpath fails (e.g. file doesn't exist), fall through to standard rules
        }
      }
    }

    // 2. Check Session Rules (Project-level)
    const activeSessionRules = this.sessionRules[sessionId] || [];
    for (const rule of activeSessionRules) {
      if (rule.toolName === toolName && matchRule(rule.targetPattern, target, toolName === "run_command")) {
        return { allowed: true, rule };
      }
    }

    // 3. Check System Rules
    const sysRules = await this.loadSystemRules();
    for (const rule of sysRules) {
      if (rule.toolName === toolName && matchRule(rule.targetPattern, target, toolName === "run_command")) {
        return { allowed: true, rule };
      }
    }

    return { allowed: false };
  }
}
