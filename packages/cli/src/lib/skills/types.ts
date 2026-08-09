import { z } from "zod";

export const skillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Invalid name format").max(64).optional(),
  description: z.string().min(1, "Description is required"),
  "allowed-tools": z.preprocess((val) => {
    let arr: string[] = [];
    if (typeof val === "string") {
      arr = val.split(/\s+/).map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(val)) {
      arr = val;
    } else {
      return val;
    }

    // Map common third-party tool names to Wright's native tool registry
    const toolMap: Record<string, string[]> = {
      "Bash": ["run_command"],
      "Read": ["view_file", "read_file"],
      "Edit": ["replace_file_content", "multi_replace_file_content"],
      "Write": ["write_to_file"],
      "Grep": ["grep_search"],
      "Glob": ["list_dir"],
      "WebFetch": ["read_url_content", "search_web"],
      "AskUserQuestion": ["ask_question"]
    };

    const mapped = new Set<string>();
    for (const tool of arr) {
      if (toolMap[tool]) {
        toolMap[tool].forEach(t => mapped.add(t));
      } else {
        mapped.add(tool);
      }
    }
    return Array.from(mapped);
  }, z.array(z.string()).optional()),
  context: z.string().optional(),
}).passthrough();

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

export interface DiscoveredSkill {
  name: string;
  scope: "project" | "global";
  sourcePath: string; // Path to the skill directory
  skillFilePath: string; // Path to the SKILL.md
  frontmatter: SkillFrontmatter;
}
