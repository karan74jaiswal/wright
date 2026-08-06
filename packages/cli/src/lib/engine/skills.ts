import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import type { DiscoveredSkill } from "../skills/types";

const execAsync = promisify(exec);

export async function executeSkill(
  skillName: string,
  rawArgs: Record<string, any> | string = {},
  activeCwd: string,
  skills?: Map<string, DiscoveredSkill>,
  sessionId: string = "default-session",
  disableSkillShellExecution: boolean = false,
): Promise<string> {
  if (!skills) return `Error: Skills map not provided.`;

  const skill = skills.get(skillName);
  if (!skill) return `Error: Skill '${skillName}' not found.`;

  const argString =
    typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs);
  const argArray =
    typeof rawArgs === "string"
      ? rawArgs
          .match(/(?:[^\s"]+|"[^"]*")+/g)
          ?.map((s) => s.replace(/^"|"$/g, "")) || []
      : Object.values(rawArgs).map((v) => String(v));

  const content = await fs.readFile(skill.skillFilePath, "utf-8");
  const frontmatterRegex =
    /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const fmMatch = content.match(frontmatterRegex);
  let rendered = fmMatch ? (fmMatch[2] || "").trim() : content.trim();

  // 1. Substitute Environment Variables (Supporting both standard CLAUDE_ and our WRIGHT_ aliases)
  rendered = rendered.replace(
    /\$\{(?:CLAUDE|WRIGHT)_SKILL_DIR\}/g,
    skill.sourcePath,
  );
  rendered = rendered.replace(
    /\$\{(?:CLAUDE|WRIGHT)_PROJECT_DIR\}/g,
    activeCwd,
  );
  rendered = rendered.replace(/\$\{(?:CLAUDE|WRIGHT)_SESSION_ID\}/g, sessionId);

  // 2. Substitute Arguments
  // $ARGUMENTS[N]
  rendered = rendered.replace(/\$ARGUMENTS\[(\d+)\]/g, (match, index) => {
    return argArray[Number(index)] !== undefined
      ? String(argArray[Number(index)])
      : "";
  });

  // $N (handling escaping \$N)
  rendered = rendered.replace(/(^|[^\\])\$(\d+)/g, (match, prefix, index) => {
    return (
      prefix +
      (argArray[Number(index)] !== undefined
        ? String(argArray[Number(index)])
        : "")
    );
  });
  // Unescape \$N
  rendered = rendered.replace(/\\\$(\d+)/g, "$$$1");

  // $ARGUMENTS
  const hasArgumentsPlaceholder = rendered.includes("$ARGUMENTS");
  rendered = rendered.replace(/\$ARGUMENTS(?!\.)(?!\[)/g, argString);

  // Custom $ARGUMENTS.key for backwards compatibility
  rendered = rendered.replace(/\$ARGUMENTS\.([a-zA-Z0-9_]+)/g, (match, key) => {
    return typeof rawArgs === "object" && rawArgs[key] !== undefined
      ? String(rawArgs[key])
      : match;
  });

  // Append arguments if they were passed but not explicitly used in the template
  if (
    !hasArgumentsPlaceholder &&
    argString &&
    argString !== "{}" &&
    argString.trim() !== ""
  ) {
    rendered += `\n\nARGUMENTS: ${argString}`;
  }

  // 3. Evaluate Dynamic Context Injection (Shell Execution)

  // Basic heuristic blocklist for destructive commands during preprocessing phase
  const isCommandSafe = (cmd: string) => {
    const dangerousPatterns = [
      /\brm\s+-r/i,
      /\bmkfs\b/i,
      /\bdd\s+if=/i,
      />\s*\/dev\//i,
      /\bmv\s+.*?\s+\//i,
      /\bchmod\s+-R\b/i,
      /\bchown\s+-R\b/i,
    ];
    return !dangerousPatterns.some((pattern) => pattern.test(cmd));
  };

  // Inline: !`command` (only at start of line or after whitespace)
  const inlineRegex = /(^|\s)!`([^`]+)`/g;
  let match;
  const inlineCommands: { matchStr: string; prefix: string; cmd: string }[] =
    [];
  while ((match = inlineRegex.exec(rendered)) !== null) {
    inlineCommands.push({
      matchStr: match[0] || "",
      prefix: match[1] || "",
      cmd: match[2] || "",
    });
  }

  for (const { matchStr, prefix, cmd } of inlineCommands) {
    if (!matchStr || !cmd) continue;
    if (disableSkillShellExecution) {
      rendered = rendered.replace(
        matchStr,
        `${prefix}[shell command execution disabled by policy]`,
      );
      continue;
    }
    if (!isCommandSafe(cmd)) {
      rendered = rendered.replace(
        matchStr,
        `${prefix}[shell command execution disabled due to security risk]`,
      );
      continue;
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: activeCwd });
      const output = (stdout || stderr || "").trim();
      rendered = rendered.replace(matchStr, `${prefix}${output}`);
    } catch (err: any) {
      const output = (
        (err && err.stdout) ||
        (err && err.stderr) ||
        (err && err.message) ||
        ""
      ).trim();
      rendered = rendered.replace(matchStr, `${prefix}${output}`);
    }
  }

  // Fenced block: ```!\ncommand\n```
  const fencedRegex = /```!\s*\n([\s\S]*?)\n```/g;
  const fencedCommands: { matchStr: string; cmd: string }[] = [];
  while ((match = fencedRegex.exec(rendered)) !== null) {
    fencedCommands.push({ matchStr: match[0] || "", cmd: match[1] || "" });
  }

  for (const { matchStr, cmd } of fencedCommands) {
    if (!matchStr || !cmd) continue;
    if (disableSkillShellExecution) {
      rendered = rendered.replace(
        matchStr,
        `[shell command execution disabled by policy]`,
      );
      continue;
    }
    if (!isCommandSafe(cmd)) {
      rendered = rendered.replace(
        matchStr,
        `[shell command execution disabled due to security risk]`,
      );
      continue;
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: activeCwd });
      const output = (stdout || stderr || "").trim();

      rendered = rendered.replace(matchStr, output);
    } catch (err: any) {
      const output = (
        (err && err.stdout) ||
        (err && err.stderr) ||
        (err && err.message) ||
        ""
      ).trim();
      rendered = rendered.replace(matchStr, output);
    }
  }

  // Wrap in structured tags per standard
  const finalOutput = `<skill_content name="${skillName}">
${rendered}

Skill directory: ${skill.sourcePath}
Relative paths in this skill are relative to the skill directory.
</skill_content>`;

  // console.log(`[Skill] '${skillName}' executed. Output:`, finalOutput);

  return finalOutput;
}
