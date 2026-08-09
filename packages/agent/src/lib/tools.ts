import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";

// -----------------------------------------
// CORE EXECUTION TOOLS (Client-Side)
// -----------------------------------------

export const readFileTool = tool(
  async ({ path }) => {
    const result = interrupt({
      type: "client_tool",
      name: "read_file",
      args: { path },
    });
    const resStr = String(result);
    if (resStr === "Cancel" || resStr === "__CANCELLED__")
      return `User denied permission for read_file(${path})`;
    return resStr;
  },
  {
    name: "read_file",
    description: "Read the contents of a file on the user's local machine.",
    schema: z.object({
      path: z
        .string()
        .describe("The absolute or relative path to the file to read."),
    }),
  },
);

export const writeFileTool = tool(
  async ({ path, content }) => {
    const result = interrupt({
      type: "client_tool",
      name: "write_file",
      args: { path, content },
    });
    const resStr = String(result);
    if (resStr === "Cancel" || resStr === "__CANCELLED__")
      return `User denied permission for write_file(${path})`;
    return resStr;
  },
  {
    name: "write_file",
    description:
      "Write or overwrite a file on the user's local machine with the provided content.",
    schema: z.object({
      path: z
        .string()
        .describe("The absolute or relative path to the file to write."),
      content: z.string().describe("The entire content to write to the file."),
    }),
  },
);

export const runCommandTool = tool(
  async ({ command }) => {
    const result = interrupt({
      type: "client_tool",
      name: "run_command",
      args: { command },
    });
    const resStr = String(result);
    if (resStr === "Cancel" || resStr === "__CANCELLED__")
      return `User denied permission for run_command(${command})`;
    return resStr;
  },
  {
    name: "run_command",
    description:
      "Run a bash/shell command on the user's local machine. Use this for testing, building, or executing git operations.",
    schema: z.object({
      command: z
        .string()
        .describe("The command to execute (e.g. 'npm run test', 'ls -la')."),
    }),
  },
);

export const listDirectoryTool = tool(
  async ({ path }) => {
    const result = interrupt({
      type: "client_tool",
      name: "list_directory",
      args: { path },
    });
    const resStr = String(result);
    if (resStr === "Cancel" || resStr === "__CANCELLED__")
      return `User denied permission for list_directory(${path})`;
    return resStr;
  },
  {
    name: "list_directory",
    description:
      "List the contents of a directory on the user's local machine.",
    schema: z.object({
      path: z
        .string()
        .describe("The absolute or relative path to the directory to list."),
    }),
  },
);

export const invokeSkillTool = tool(
  async ({ name, args }) => {
    const result = interrupt({
      type: "invoke_skill",
      name,
      args,
    });
    return String(result);
  },
  {
    name: "invoke_skill",
    description:
      "Invoke a specialized workflow skill. Returns instructions or dynamic data from the skill.",
    schema: z.object({
      name: z.string().describe("The exact name of the skill to invoke"),
      args: z
        .string()
        .optional()
        .describe(
          "Optional arguments to pass to the skill for dynamic rendering, formatted as a JSON string",
        ),
    }),
  },
);

// -----------------------------------------
// USER INTERACTION TOOLS
// -----------------------------------------

export const askPermission = tool(
  async ({ target, reason }) => {
    const humanDecision = interrupt({
      type: "ask_permission",
      target,
      reason,
    });
    const resStr = String(humanDecision);
    if (resStr === "No, reject" || resStr === "Cancel")
      return `User denied permission for ask_permission(${target})`;
    return resStr;
  },
  {
    name: "ask_permission",
    description: "Ask the user for permission to execute a dangerous action.",
    schema: z.object({
      target: z
        .string()
        .describe("The exact command or action you want to execute"),
      reason: z.string().describe("Why you need to execute this action"),
    }),
  },
);

// -----------------------------------------
// MCP PROXY TOOLS
// -----------------------------------------

/**
 * Creates LangChain proxy tools for MCP execution.
 * We use @langchain/mcp-adapters strictly to convert MCP JSON schemas into Zod schemas.
 * We override the actual execution to throw an interrupt so the frontend can execute it.
 */
export async function createMcpProxyTools(serverName: string, mcpToolsPayload: any[]) {
  const { loadMcpTools } = await import("@langchain/mcp-adapters");
    
    // A dummy client is required to initialize the adapter
    const dummyClient = {
      listTools: async () => ({ tools: mcpToolsPayload }),
      callTool: async () => {
        throw new Error("This should not be called because we override invoke");
      },
    };

    const tools = await loadMcpTools(serverName, dummyClient as any);
    
    for (const t of tools) {
      // Override invoke to bypass mcp-adapters' internal try/catch that swallows GraphInterrupt
      t.invoke = async (input: any) => {
        // LangGraph's ToolNode passes the full ToolCall object to t.invoke()
        // We need to extract just the args to pass to the MCP server.
        const actualArgs = (input && typeof input === 'object' && input.type === 'tool_call' && 'args' in input) 
          ? input.args 
          : input;

        const validatedArgs = await t.schema.parseAsync(actualArgs);

        const res = interrupt({
          type: "invoke_mcp",
          serverName,
          toolName: t.name,
          args: validatedArgs,
        });

        let finalOutput = res;
        if (res === "__CANCELLED__" || res === "Cancel") {
          finalOutput = `User denied permission for ${t.name}`;
        }

        if (input && typeof input === "object" && input.id) {
          return new ToolMessage({
            content: typeof finalOutput === "string" ? finalOutput : JSON.stringify(finalOutput),
            name: t.name,
            tool_call_id: input.id,
          });
        }
        return finalOutput;
      };
    }
    return tools;
}

export const askQuestion = tool(
  async ({ question, options }) => {
    const humanDecision = interrupt({
      type: "ask_question",
      question,
      options,
    });
    return String(humanDecision);
  },
  {
    name: "ask_question",
    description:
      "Ask the user a multiple-choice question to clarify requirements, solicit feedback, or pick an option.",
    schema: z.object({
      question: z.string().describe("The question to ask"),
      options: z
        .array(z.string())
        .min(1)
        .describe("The options to present to the user"),
    }),
  },
);
