import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as yaml from "yaml";
import { type DiscoveredSkill, skillFrontmatterSchema } from "./types";

export interface ParseSkillResult {
  frontmatter: Record<string, any>;
}

export function parseSkillMarkdown(content: string): ParseSkillResult {
  const frontmatterRegex =
    /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {} };
  }

  try {
    const frontmatterStr = match[1] || "";
    const instructions = (match[2] || "").trim();
    const parsedYaml = yaml.parse(frontmatterStr || "");
    return {
      frontmatter:
        typeof parsedYaml === "object" && parsedYaml !== null ? parsedYaml : {},
    };
  } catch (err) {
    console.warn("Failed to parse SKILL.md frontmatter:", err);
    return { frontmatter: {} };
  }
}

export async function discoverSkills(
  workspaceRoot: string,
): Promise<Map<string, DiscoveredSkill>> {
  const homeDir = os.homedir();

  // Ordered from lowest to highest priority so later discoveries overwrite earlier ones
  const searchPaths = [
    { path: path.join(homeDir, ".wright", "skills"), scope: "global" as const },
    {
      path: path.join(workspaceRoot, ".agents", "skills"),
      scope: "project" as const,
    },
    {
      path: path.join(workspaceRoot, ".wright", "skills"),
      scope: "project" as const,
    },
  ];

  const skills = new Map<string, DiscoveredSkill>();

  for (const { path: searchPath, scope } of searchPaths) {
    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(searchPath, entry.name);
        const skillFile = path.join(skillDir, "SKILL.md");

        try {
          const content = await fs.readFile(skillFile, "utf-8");
          const { frontmatter } = parseSkillMarkdown(content);

          const parsedFrontmatter =
            skillFrontmatterSchema.safeParse(frontmatter);
          if (!parsedFrontmatter.success) {
            console.warn(
              `Invalid frontmatter in ${skillFile}:`,
              parsedFrontmatter.error.message,
            );
            continue;
          }

          const skillName = parsedFrontmatter.data.name || entry.name; // Fallback to folder name

          skills.set(skillName, {
            name: skillName,
            scope,
            sourcePath: skillDir,
            skillFilePath: skillFile,
            frontmatter: parsedFrontmatter.data,
          });
        } catch (err: any) {
          if (err.code !== "ENOENT") {
            console.warn(
              `Error reading SKILL.md for skill ${entry.name}:`,
              err,
            );
          }
        }
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.warn(`Error reading skills directory ${searchPath}:`, err);
      }
    }
  }
  return skills;
}
