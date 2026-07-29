import { useCallback, useRef, useMemo } from "react";
import { useDialog } from "../providers/dialog";
import DialogSearchList from "../components/dialog/dialog-search-list";
import { usePromptConfig } from "../providers/prompt-config";
import { SUPPORTED_CHAT_MODELS, type SupportedChatModel } from "@wright/shared";
import EffortDialog from "./effort-dialog";
import ApiKeyInputDialog from "./apikey-input-dialog";
import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { useKeyboardLayer } from "../providers/keyboard";

export default function ModelsDialog({ providerId }: { providerId?: string } = {}) {
  const { setModel, currentModel } = usePromptConfig();
  const { close, open } = useDialog();
  const { isTopLayer } = useKeyboardLayer();
  const confirmedRef = useRef(false);

  const sortedModels = useMemo(() => {
    let models = [...SUPPORTED_CHAT_MODELS];
    if (providerId) {
      models = models.filter((m) => m.provider === providerId);
    }
    return models.sort((a, b) => {
      if (a.provider < b.provider) return -1;
      if (a.provider > b.provider) return 1;
      return 0;
    });
  }, [providerId]);

  const handleSelect = useCallback(
    (modelItem: SupportedChatModel) => {
      confirmedRef.current = true;
      setModel(modelItem.id);
      
      const isReasoningModel = 
        modelItem.id.startsWith("o1") || 
        modelItem.id.startsWith("o3") || 
        modelItem.id.startsWith("o4") || 
        modelItem.id.startsWith("gpt-5") ||
        modelItem.id.startsWith("gemini-3") || 
        modelItem.id.startsWith("gemini-2.5") || 
        modelItem.id.startsWith("gemini-2.0-flash-thinking");

      if (isReasoningModel) {
        // Open Effort dialog sequentially
        open({
          title: "Select Reasoning Effort",
          children: <EffortDialog providerId={modelItem.provider} />,
        });
      } else {
        close();
      }
    },
    [close, open, setModel],
  );

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;
    
    if (key.name === "k" && providerId) {
      open({
        title: "Update API Key",
        children: (
          <ApiKeyInputDialog 
            providerId={providerId} 
            onSuccess={() => {
              open({
                title: "Select Model",
                children: <ModelsDialog providerId={providerId} />,
              });
            }} 
          />
        ),
      });
    }
  });

  return (
    <box flexDirection="column" width="100%">
      <DialogSearchList
      items={sortedModels}
      onSelect={handleSelect}
      getKey={(modelItem) => modelItem.id}
      placeholder="Search Models..."
      emptyText="No matching Models"
      filterFn={(modelItem, query) =>
        modelItem.id.toLowerCase().includes(query.toLowerCase()) ||
        modelItem.provider.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(modelItem, isSelected) => (
        <box flexDirection="row" width="100%" justifyContent="space-between" paddingRight={1}>
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {isSelected ? "\u0020\u2022\u0020" : "\u0020\u0020\u0020"}
            {modelItem.id} {currentModel === modelItem.id ? "(Active)" : ""}
          </text>
          <text selectable={false} fg={isSelected ? "black" : "gray"}>
            {modelItem.provider}
          </text>
        </box>
      )}
    />
      {providerId && (
        <box padding={1} paddingBottom={0} paddingTop={0} paddingLeft={0}>
          <text attributes={TextAttributes.DIM}>[K] Update {providerId.charAt(0).toUpperCase() + providerId.slice(1)} API Key</text>
        </box>
      )}
    </box>
  );
}
