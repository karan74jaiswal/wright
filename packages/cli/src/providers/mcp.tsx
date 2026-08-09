import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  discoverMcpServers,
  type DiscoveredServer,
} from "../lib/mcp/discovery";

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

// Track active tool calls to prevent killing the client mid-execution
export let activeMcpToolCalls = 0;
export const incrementMcpToolCall = () => activeMcpToolCalls++;
export const decrementMcpToolCall = () => activeMcpToolCalls--;

let previousConfigString = "";
let previousDiscovered: Map<string, DiscoveredServer> | null = null;

export default function McpProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mcp", process.cwd()],
    queryFn: async () => {
      const discovered = await discoverMcpServers(process.cwd());
      currentMcpsList = Array.from(discovered.keys());

      if (discovered.size === 0) {
        return { discovered };
      }

      const configObj: Record<string, any> = {};
      const sortedKeys = Array.from(discovered.keys()).sort();
      for (const key of sortedKeys) {
        configObj[key] = discovered.get(key)!.config;
      }
      const configString = JSON.stringify(configObj);

      // Issue 1 Fix: Only recreate the client if the configuration actually changed
      if (configString === previousConfigString && previousDiscovered) {
        return { discovered: previousDiscovered };
      }

      // If the config changed, but a tool is currently running, defer the restart 
      // until the next 30-second polling cycle to avoid killing the in-flight transport.
      if (activeMcpToolCalls > 0 && previousDiscovered) {
        return { discovered: previousDiscovered };
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
      previousConfigString = configString;

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
              
              // Issue 3 Fix: Close the global client before replacing it with the fallback
              if (globalMcpClient) {
                try {
                  await globalMcpClient.close();
                } catch (closeErr) {}
              }
              
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

      previousDiscovered = discovered;
      return { discovered };
    },
    refetchInterval: 30000,
  });

  const servers = data?.discovered;

  const value = useMemo(
    () => ({ servers: servers || new Map(), isLoading }),
    [servers, isLoading],
  );

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}
