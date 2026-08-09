import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { discoverSkills } from "../lib/skills/discovery";
import type { DiscoveredSkill } from "../lib/skills/types";

interface SkillsContextType {
  skills: Map<string, DiscoveredSkill>;
  isLoading: boolean;
}

const SkillsContext = createContext<SkillsContextType>({
  skills: new Map(),
  isLoading: true,
});

export function useSkills() {
  return useContext(SkillsContext);
}

let currentSkillsList: string[] = [];
export const getCurrentSkills = () => currentSkillsList;

export default function SkillsProvider({ children }: { children: ReactNode }) {
  const { data: skills = new Map(), isLoading } = useQuery({
    queryKey: ["skills", process.cwd()],
    queryFn: async () => {
      const discovered = await discoverSkills(process.cwd());
      currentSkillsList = Array.from(discovered.keys());
      return discovered;
    },
    refetchInterval: 30000,
  });

  const value = useMemo(() => ({ skills, isLoading }), [skills, isLoading]);

  return (
    <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>
  );
}
