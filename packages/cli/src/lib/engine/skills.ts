import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import type { DiscoveredSkill } from "../skills/types";

const execAsync = promisify(exec);

export async function executeSkill(
  skillName: string,
  rawArgs: Record<string, any> | string = {},
  activeCwd: string,
  skills?: Map<string, DiscoveredSkill>
): Promise<string> {
  if (!skills) return `Error: Skills map not provided.`;
  
  const skill = skills.get(skillName);
  if (!skill) return `Error: Skill '${skillName}' not found.`;

  let args: Record<string, any> = {};
  if (typeof rawArgs === "string") {
    try {
      args = JSON.parse(rawArgs);
    } catch (e) {
      // If it fails to parse, we'll just use empty args
    }
  } else {
    args = rawArgs || {};
  }

  const content = await fs.readFile(skill.skillFilePath, "utf-8");
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const fmMatch = content.match(frontmatterRegex);
  let rendered = fmMatch ? (fmMatch[2] || "").trim() : content.trim();

  // 1. Resolve $ARGUMENTS
  // Find placeholders like $ARGUMENTS.someKey or $ARGUMENTS
  // If $ARGUMENTS is used, we JSON stringify the whole args.
  rendered = rendered.replace(/\$ARGUMENTS\.([a-zA-Z0-9_]+)/g, (match, key) => {
    return args[key] !== undefined ? String(args[key]) : match;
  });
  rendered = rendered.replace(/\$ARGUMENTS/g, () => {
    return JSON.stringify(args, null, 2);
  });

  // 2. Execute `!shell_command` blocks
  // Find blocks like: `!git diff` and execute them
  const shellCommandRegex = /`!([^`]+)`/g;
  
  let match;
  const commandsToRun: { match: string; cmd: string }[] = [];
  while ((match = shellCommandRegex.exec(rendered)) !== null) {
    commandsToRun.push({ match: match[0], cmd: (match[1] || "").trim() });
  }

  for (const { match, cmd } of commandsToRun) {
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: activeCwd });
      const output = stdout || stderr || "No output.";
      rendered = rendered.replace(match, `\n\`\`\`\n$ ${cmd}\n${output.trim()}\n\`\`\`\n`);
    } catch (err: any) {
      const output = (err && err.stdout) || (err && err.stderr) || (err && err.message) || "Failed to execute command.";
      rendered = rendered.replace(match, `\n\`\`\`\n$ ${cmd}\n${String(output).trim()}\n\`\`\`\n`);
    }
  }

  // Wrap in structured tags per standard
  return `<skill_content name="${skillName}">
${rendered}

Skill directory: ${skill.sourcePath}
Relative paths in this skill are relative to the skill directory.
</skill_content>`;
}

