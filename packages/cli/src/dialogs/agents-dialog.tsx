import { useCallback, useRef } from "react";
import { useDialog } from "../providers/dialog";
import DialogSearchList from "../components/dialog/dialog-search-list";
import { usePromptConfig } from "../providers/prompt-config";
import type { Mode } from "@wright/database/enums";

interface AgentItem {
  id: Mode;
  name: string;
  desc: string;
}

const AGENTS: AgentItem[] = [
  { id: "BUILD", name: "Build Agent", desc: "Expert pair programmer" },
  { id: "PLAN", name: "Plan Agent", desc: "Software Architect" },
];

export default function AgentsDialog() {
  const { setMode, currentMode } = usePromptConfig();
  const { close } = useDialog();
  const confirmedRef = useRef(false);

  const handleSelect = useCallback(
    (agent: AgentItem) => {
      confirmedRef.current = true;
      setMode(agent.id);
      close();
    },
    [close, setMode],
  );

  return (
    <DialogSearchList
      items={AGENTS}
      onSelect={handleSelect}
      getKey={(agent) => agent.id}
      placeholder="Search Agents..."
      emptyText="No matching Agents"
      filterFn={(agent, query) =>
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.desc.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(agent, isSelected) => (
        <box flexDirection="row" width="100%" justifyContent="space-between" paddingRight={1}>
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {isSelected ? "\u0020\u2022\u0020" : "\u0020\u0020\u0020"}
            {agent.name} {currentMode === agent.id ? "(Active)" : ""}
          </text>
          <text selectable={false} fg={isSelected ? "black" : "gray"}>
            {agent.desc}
          </text>
        </box>
      )}
    />
  );
}
