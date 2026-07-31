import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function executeReadFile(args: any): Promise<string> {
  if (!args?.path) throw new Error("Missing 'path' argument");
  const content = await fs.readFile(args.path, "utf-8");
  return content;
}

export async function executeWriteFile(args: any): Promise<string> {
  if (!args?.path) throw new Error("Missing 'path' argument");
  if (typeof args.content !== "string") throw new Error("Missing 'content' argument");
  
  const dir = path.dirname(args.path);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(args.path, args.content, "utf-8");
  
  return `Successfully wrote to ${args.path}`;
}

export async function executeListDirectory(args: any): Promise<string> {
  if (!args?.path) throw new Error("Missing 'path' argument");
  const files = await fs.readdir(args.path, { withFileTypes: true });
  
  let output = `Directory listing for ${args.path}:\n`;
  for (const file of files) {
    const type = file.isDirectory() ? "DIR" : "FILE";
    output += `[${type}] ${file.name}\n`;
  }
  return output;
}

export async function executeRunCommand(args: any, cwd: string): Promise<string> {
  if (!args?.command) throw new Error("Missing 'command' argument");
  
  try {
    // 30s timeout, max 5MB buffer
    const { stdout, stderr } = await execAsync(args.command, {
      cwd,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 5, 
    });
    
    let result = "";
    if (stdout) result += `STDOUT:\n${stdout}\n`;
    if (stderr) result += `STDERR:\n${stderr}\n`;
    if (!result) result = "(Command executed successfully with no output)";
    return result;
  } catch (err: any) {
    let errResult = `Command failed with error:\n${err.message}\n`;
    if (err.stdout) errResult += `STDOUT:\n${err.stdout}\n`;
    if (err.stderr) errResult += `STDERR:\n${err.stderr}\n`;
    throw new Error(errResult);
  }
}
