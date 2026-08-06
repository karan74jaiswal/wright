import { globalMcpClient } from "../../providers/mcp";

export async function executeMcpTool(
  serverName: string,
  toolName: string,
  args: any,
): Promise<any> {
  try {
    if (!globalMcpClient) {
      throw new Error("MCP client not initialized on frontend");
    }
    const rawClient = await globalMcpClient.getClient(serverName);
    if (!rawClient) {
      throw new Error(`MCP server ${serverName} not found on frontend`);
    }
    const res = await rawClient.callTool({ name: toolName, arguments: args });
    // console.log(`[MCP] Tool '${toolName}' on '${serverName}' executed. Output:`, res);
    return res;
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: String(err) }] };
  }
}
