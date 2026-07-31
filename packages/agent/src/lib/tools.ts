import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";

// -----------------------------------------
// CORE EXECUTION TOOLS (Client-Side)
// -----------------------------------------

export const readFileTool = tool(
  async ({ path }) => {
    const result = interrupt({
      type: "client_tool",
      name: "read_file",
      args: { path }
    });
    const resStr = String(result);
    if (resStr === "Cancel") throw new Error(`User denied permission for read_file(${path})`);
    return resStr;
  },
  {
    name: "read_file",
    description: "Read the contents of a file on the user's local machine.",
    schema: z.object({
      path: z.string().describe("The absolute or relative path to the file to read.")
    })
  }
);

export const writeFileTool = tool(
  async ({ path, content }) => {
    const result = interrupt({
      type: "client_tool",
      name: "write_file",
      args: { path, content }
    });
    const resStr = String(result);
    if (resStr === "Cancel") throw new Error(`User denied permission for write_file(${path})`);
    return resStr;
  },
  {
    name: "write_file",
    description: "Write or overwrite a file on the user's local machine with the provided content.",
    schema: z.object({
      path: z.string().describe("The absolute or relative path to the file to write."),
      content: z.string().describe("The entire content to write to the file.")
    })
  }
);

export const runCommandTool = tool(
  async ({ command }) => {
    const result = interrupt({
      type: "client_tool",
      name: "run_command",
      args: { command }
    });
    const resStr = String(result);
    if (resStr === "Cancel") throw new Error(`User denied permission for run_command(${command})`);
    return resStr;
  },
  {
    name: "run_command",
    description: "Run a bash/shell command on the user's local machine. Use this for testing, building, or executing git operations.",
    schema: z.object({
      command: z.string().describe("The command to execute (e.g. 'npm run test', 'ls -la').")
    })
  }
);

export const listDirectoryTool = tool(
  async ({ path }) => {
    const result = interrupt({
      type: "client_tool",
      name: "list_directory",
      args: { path }
    });
    const resStr = String(result);
    if (resStr === "Cancel") throw new Error(`User denied permission for list_directory(${path})`);
    return resStr;
  },
  {
    name: "list_directory",
    description: "List the contents of a directory on the user's local machine.",
    schema: z.object({
      path: z.string().describe("The absolute or relative path to the directory to list.")
    })
  }
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
    if (resStr === "No, reject" || resStr === "Cancel") throw new Error(`User denied permission for ask_permission(${target})`);
    return resStr;
  },
  {
    name: "ask_permission",
    description: "Ask the user for permission to execute a dangerous action.",
    schema: z.object({
      target: z.string().describe("The exact command or action you want to execute"),
      reason: z.string().describe("Why you need to execute this action"),
    }),
  }
);

export const askQuestion = tool(
  async ({ question, options, isMultiSelect }) => {
    const humanDecision = interrupt({
      type: "ask_question",
      question,
      options,
      isMultiSelect
    });
    return String(humanDecision);
  },
  {
    name: "ask_question",
    description: "Ask the user a multiple-choice question to clarify requirements, solicit feedback, or pick an option.",
    schema: z.object({
      question: z.string().describe("The question to ask"),
      options: z.array(z.string()).min(1).describe("The options to present to the user"),
      isMultiSelect: z.boolean().optional().describe("If true, the user can select multiple options"),
    })
  }
);
