import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { McpFileSchema, type McpServerConfig } from "./types";

// Priority order (Highest to Lowest)
// Project Scope:
// 1. <workspace>/.wright/mcp.json (Highest)
// 2. <workspace>/.agents/mcp_config.json
// 3. <workspace>/.mcp.json (Lowest Project)
// Global Scope:
// 4. ~/.wright/mcp.json (Highest Global)
// 5. ~/.mcp.json (Lowest Global)

export interface DiscoveredServer {
  name: string;
  config: McpServerConfig;
  source: string;
  scope: "project" | "global";
  tools?: any[];
}

export async function discoverMcpServers(
  workspaceRoot: string,
  homeDirOverride?: string,
): Promise<Map<string, DiscoveredServer>> {
  const homeDir = homeDirOverride || os.homedir();

  const searchPaths = [
    {
      path: path.join(workspaceRoot, ".wright", "mcp.json"),
      scope: "project" as const,
    },
    {
      path: path.join(workspaceRoot, ".agents", "mcp_config.json"),
      scope: "project" as const,
    },
    { path: path.join(workspaceRoot, ".mcp.json"), scope: "project" as const },
    {
      path: path.join(homeDir, ".wright", "mcp.json"),
      scope: "global" as const,
    },
    { path: path.join(homeDir, ".mcp.json"), scope: "global" as const },
  ];

  const servers = new Map<string, DiscoveredServer>();

  // Process from lowest priority (end of list) to highest priority (start of list)
  // This way, higher priority items overwrite lower priority items in the Map
  for (let i = searchPaths.length - 1; i >= 0; i--) {
    const { path: configPath, scope } = searchPaths[i]!;
    try {
      const content = await fs.readFile(configPath, "utf-8");
      const json = JSON.parse(content);
      const parsed = McpFileSchema.parse(json);

      if (parsed.mcpServers) {
        for (const [name, config] of Object.entries(parsed.mcpServers)) {
          servers.set(name, {
            name,
            config: expandEnvVarsInConfig(config as McpServerConfig),
            source: configPath,
            scope,
          });
        }
      }
    } catch (error: any) {
      // Ignore ENOENT (file not found)
      if (error.code !== "ENOENT") {
        console.warn(
          `[Wright MCP] Failed to parse MCP config at ${configPath}:`,
          error.message,
        );
      }
    }
  }

  return servers;
}

export function expandEnvVarsInConfig(
  config: McpServerConfig,
): McpServerConfig {
  const result = { ...config };

  const expandString = (str: string) =>
    str.replace(/\${([^}]+)}/g, (_, match) => {
      const [key, defaultVal] = match.split(":-");
      return process.env[key] !== undefined
        ? process.env[key]
        : defaultVal !== undefined
          ? defaultVal
          : `\${${match}}`;
    });

  if (result.command) result.command = expandString(result.command);
  if (result.url) result.url = expandString(result.url);
  if (result.headersHelper)
    result.headersHelper = expandString(result.headersHelper);

  if (result.args) {
    result.args = result.args.map(expandString);
  }

  if (result.env) {
    const newEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.env)) {
      newEnv[k] = expandString(v as string);
    }
    result.env = newEnv;
  }

  if (result.headers) {
    const newHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.headers)) {
      newHeaders[k] = expandString(v as string);
    }
    result.headers = newHeaders;
  }

  return result;
}
