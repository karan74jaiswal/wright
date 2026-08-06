import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "./theme";
import {
  discoverMcpServers,
  type DiscoveredServer,
} from "../lib/mcp/discovery";
import { McpSecurityManager } from "../lib/mcp/security";

interface McpContextType {
  servers: Map<string, DiscoveredServer>;
  isLoading: boolean;
}

export const McpContext = createContext<McpContextType>({
  servers: new Map(),
  isLoading: true,
});

export function useMcp() {
  return useContext(McpContext);
}

let currentMcpsList: string[] = [];
export const getCurrentMcps = () => currentMcpsList;

export let globalMcpClient: any = null;

function McpApprovalScreen({
  unapproved,
  onApprove,
}: {
  unapproved: DiscoveredServer[];
  onApprove: (server: DiscoveredServer, allow: boolean) => void;
}) {
  const { colors } = useTheme();
  const current = unapproved[0]; // Show one by one

  useKeyboard((key) => {
    if (!current) return;
    if (key.name === "y") {
      onApprove(current, true);
    } else if (key.name === "n" || key.name === "escape") {
      onApprove(current, false);
    }
  });

  if (!current) return null;

  return (
    <box
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
      backgroundColor={colors.background}
      flexDirection="column"
      gap={1}
    >
      <box
        borderStyle="rounded"
        borderColor={colors.primary}
        paddingX={4}
        paddingY={2}
        flexDirection="column"
        gap={1}
        alignItems="center"
      >
        <text attributes={TextAttributes.BOLD} fg={colors.primary}>
          🛡️ New MCP Server Detected
        </text>

        <box paddingY={1} flexDirection="column" alignItems="center">
          <text>This workspace defines a local MCP server that</text>
          <text>could execute commands on your machine.</text>
        </box>

        <box paddingY={1} flexDirection="column" alignItems="center">
          <text attributes={TextAttributes.BOLD} fg="cyan">
            Server: {current.name}
          </text>
          <text fg="gray">Source: {current.source}</text>
          {current.config.command && (
            <text fg="gray">
              Command: {current.config.command}{" "}
              {(current.config.args || []).join(" ")}
            </text>
          )}
          {current.config.url && (
            <text fg="gray">URL: {current.config.url}</text>
          )}
        </box>

        <text fg={colors.dimSeparator}>
          Do you trust and allow this MCP server?
        </text>

        <box flexDirection="row" gap={4} paddingTop={2}>
          <box flexDirection="row" gap={1}>
            <text attributes={TextAttributes.BOLD} fg="green">
              [Y]
            </text>
            <text>Yes, allow</text>
          </box>
          <box flexDirection="row" gap={1}>
            <text attributes={TextAttributes.BOLD} fg="red">
              [N]
            </text>
            <text>No, ignore it</text>
          </box>
        </box>
      </box>
    </box>
  );
}

export default function McpProvider({ children }: { children: ReactNode }) {
  const [deniedServers, setDeniedServers] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["mcp", process.cwd(), deniedServers],
    queryFn: async () => {
      const discovered = await discoverMcpServers(process.cwd());
      for (const [key, server] of discovered.entries()) {
        if (deniedServers.has(server.name)) {
          discovered.delete(key);
        }
      }
      const needsApproval =
        await McpSecurityManager.getUnapprovedServers(discovered);
      currentMcpsList = Array.from(discovered.keys());

      // If approved, connect and fetch raw tool schemas
      if (needsApproval.length === 0 && discovered.size > 0) {
        const configObj: Record<string, any> = {};
        for (const [key, server] of discovered.entries()) {
          configObj[key] = server.config;
        }

        if (globalMcpClient) {
          try {
            await globalMcpClient.close();
          } catch (e) {
            console.error("Failed to close old MCP client:", e);
          }
        }

        const { MultiServerMCPClient } = await import("@langchain/mcp-adapters");
        globalMcpClient = new MultiServerMCPClient(configObj);

        for (const [key, server] of discovered.entries()) {
          try {
            const rawClient = await globalMcpClient.getClient(key);
            if (rawClient) {
              const res = await rawClient.listTools();
              server.tools = res.tools;
            }
          } catch (e: any) {
            // Dynamic Protocol Negotiation: If SSE fails with 405 Method Not Allowed,
            // the server likely expects the stateless HTTP transport instead.
            if (server.config.type === "sse" && e.message?.includes("405")) {
              try {
                // Mutate the config so the backend will also use the corrected transport
                server.config.type = "http";
                configObj[key] = server.config;
                globalMcpClient = new MultiServerMCPClient(configObj);
                
                const fallbackClient = await globalMcpClient.getClient(key);
                if (fallbackClient) {
                  const res = await fallbackClient.listTools();
                  server.tools = res.tools;
                  continue; // Successfully negotiated
                }
              } catch (fallbackError) {
                console.error(`[Wright MCP] Failed to connect to ${key} after falling back to HTTP transport:`, fallbackError);
              }
            } else {
              console.error(`Failed to fetch tools for ${key}:`, e);
            }
            server.tools = [];
          }
        }
      }

      return { discovered, needsApproval };
    },
    refetchInterval: 30000,
  });

  const handleApprove = async (server: DiscoveredServer, allow: boolean) => {
    if (allow) {
      await McpSecurityManager.approveServer(server);
    } else {
      setDeniedServers((prev) => {
        const next = new Set(prev);
        next.add(server.name);
        return next;
      });
    }
    queryClient.invalidateQueries({ queryKey: ["mcp"] });
  };

  const servers = data?.discovered;
  const unapproved = data?.needsApproval || [];

  const value = useMemo(
    () => ({ servers: servers || new Map(), isLoading }),
    [servers, isLoading],
  );

  if (unapproved.length > 0) {
    return (
      <McpApprovalScreen unapproved={unapproved} onApprove={handleApprove} />
    );
  }

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}
