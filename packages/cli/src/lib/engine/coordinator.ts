import * as path from "path";
import {
  executeReadFile,
  executeWriteFile,
  executeListDirectory,
  executeRunCommand,
} from "./executors";

/**
 * Route a client_tool payload to the proper native executor.
 */
export async function executeClientTool(
  toolName: string,
  args: any,
  activeCwd: string
): Promise<string> {
  try {

    switch (toolName) {
      case "read_file":
        return await executeReadFile(args);
      case "write_file":
        return await executeWriteFile(args);
      case "list_directory":
        return await executeListDirectory(args);
      case "run_command":
        return await executeRunCommand(args, activeCwd);
      default:
        throw new Error(`Unknown client_tool: ${toolName}`);
    }
  } catch (error: any) {
    // If the executor throws, we return the error as a formatted string to the agent
    let errorMsg = `Error: ${error.message}`;
    
    // Add LLM-friendly hints to prevent agent looping
    if (error.code === "ENOTDIR" && toolName === "list_directory") {
      errorMsg += `\nHint: The path provided is a file, not a directory. Try using the 'read_file' tool instead.`;
    } else if (error.code === "EISDIR" && toolName === "read_file") {
      errorMsg += `\nHint: The path provided is a directory, not a file. Try using the 'list_directory' tool instead.`;
    }

    return errorMsg;
  }
}
