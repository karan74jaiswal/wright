import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { DiscoveredServer } from "./discovery";

interface McpSecurityState {
  approvedServers: string[]; // e.g. "project:/workspace/.mcp.json:github"
}

export class McpSecurityManager {
  private static get configPath(): string {
    return path.join(os.homedir(), ".wright", "approved_mcps.json");
  }

  private static async loadState(): Promise<McpSecurityState> {
    try {
      const data = await fs.readFile(this.configPath, "utf-8");
      return JSON.parse(data);
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        console.error("Failed to load MCP security state", e);
      }
      return { approvedServers: [] };
    }
  }

  private static async saveState(state: McpSecurityState) {
    try {
      const dir = path.dirname(this.configPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(state, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save MCP security state", e);
    }
  }

  private static getSignature(server: DiscoveredServer): string {
    return `${server.scope}:${server.source}:${server.name}`;
  }

  /**
   * Checks a map of discovered servers and returns those that need explicit user approval.
   * Only Project-Scoped servers require approval.
   */
  public static async getUnapprovedServers(servers: Map<string, DiscoveredServer>): Promise<DiscoveredServer[]> {
    const state = await this.loadState();
    const unapproved: DiscoveredServer[] = [];

    for (const server of servers.values()) {
      if (server.scope === "global") continue; // Global servers are inherently trusted (user put them in ~)

      const signature = this.getSignature(server);
      if (!state.approvedServers.includes(signature)) {
        unapproved.push(server);
      }
    }

    return unapproved;
  }

  /**
   * Approves a specific server so it won't prompt again.
   */
  public static async approveServer(server: DiscoveredServer) {
    const state = await this.loadState();
    const signature = this.getSignature(server);
    
    if (!state.approvedServers.includes(signature)) {
      state.approvedServers.push(signature);
      await this.saveState(state);
    }
  }
}
