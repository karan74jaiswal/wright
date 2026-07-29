import { useCallback, useRef } from "react";
import { useDialog } from "../providers/dialog";
import DialogSearchList from "../components/dialog/dialog-search-list";
import { usePromptConfig, type ReasoningEffort } from "../providers/prompt-config";

type EffortOption = { id: ReasoningEffort; name: string; desc: string };

const OPENAI_EFFORTS: EffortOption[] = [
  { id: "none", name: "None", desc: "No reasoning, instant response" },
  { id: "low", name: "Low", desc: "Fastest response, less deep reasoning" },
  { id: "medium", name: "Medium", desc: "Balanced speed and reasoning" },
  { id: "high", name: "High", desc: "Deepest reasoning, slower response" },
  {
    id: "xhigh",
    name: "Extra High",
    desc: "Very deep reasoning for complex tasks",
  },
  { id: "max", name: "Max", desc: "Maximum reasoning effort available" },
];

const GOOGLE_EFFORTS: EffortOption[] = [
  { id: "low", name: "Low", desc: "Minimal reasoning, fastest response" },
  { id: "medium", name: "Medium", desc: "Balanced reasoning" },
  { id: "high", name: "High", desc: "Deepest reasoning" },
];

export default function EffortDialog({ providerId }: { providerId?: string }) {
  const { setReasoningEffort, reasoningEffort } = usePromptConfig();
  const { close } = useDialog();
  const confirmedRef = useRef(false);

  const efforts = providerId === "google" ? GOOGLE_EFFORTS : OPENAI_EFFORTS;

  const handleSelect = useCallback(
    (effort: (typeof OPENAI_EFFORTS)[0]) => {
      confirmedRef.current = true;
      setReasoningEffort(effort.id);
      close();
    },
    [close, setReasoningEffort],
  );

  return (
    <DialogSearchList
      items={efforts}
      onSelect={handleSelect}
      getKey={(e) => e.id}
      placeholder="Select Reasoning Effort..."
      emptyText="No matching efforts"
      filterFn={(e, query) =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.desc.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(e, isSelected) => (
        <box
          flexDirection="row"
          width="100%"
          justifyContent="space-between"
          paddingRight={1}
        >
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {isSelected ? "\u0020\u2022\u0020" : "\u0020\u0020\u0020"}
            {e.name} {reasoningEffort === e.id ? "(Active)" : ""}
          </text>
          <text selectable={false} fg={isSelected ? "black" : "gray"}>
            {e.desc}
          </text>
        </box>
      )}
    />
  );
}
