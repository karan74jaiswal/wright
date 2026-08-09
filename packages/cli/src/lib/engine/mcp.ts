import { globalMcpClient, incrementMcpToolCall, decrementMcpToolCall, waitForMcpReady } from "../../providers/mcp";

export async function executeMcpTool(
  serverName: string,
  toolName: string,
  args: any,
): Promise<any> {
  await waitForMcpReady();
  incrementMcpToolCall();
  try {
    if (!globalMcpClient) {
      throw new Error("MCP client not initialized on frontend");
    }
    const rawClient = await globalMcpClient.getClient(serverName);
    if (!rawClient) {
      throw new Error(`MCP server ${serverName} not found on frontend`);
    }
    const res = await rawClient.callTool({ name: toolName, arguments: args });
    return res;
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: String(err) }] };
  } finally {
    decrementMcpToolCall();
  }
}
