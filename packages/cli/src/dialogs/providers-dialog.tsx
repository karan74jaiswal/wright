import { useCallback, useRef } from "react";
import { useDialog } from "../providers/dialog";
import DialogSearchList from "../components/dialog/dialog-search-list";
import ModelsDialog from "./models-dialog";
import { usePromptConfig } from "../providers/prompt-config";
import ApiKeyInputDialog from "./apikey-input-dialog";

const PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google" },
];

export default function ProvidersDialog() {
  const { close, open } = useDialog();
  const { providerApiKeys } = usePromptConfig();
  const confirmedRef = useRef(false);

  const openModelsDialog = useCallback(
    (providerId: string) => {
      open({
        title: "Select Model",
        children: <ModelsDialog providerId={providerId} />,
      });
    },
    [open],
  );

  const handleSelect = useCallback(
    (provider: typeof PROVIDERS[0]) => {
      confirmedRef.current = true;
      const isConfigured = !!providerApiKeys[provider.id as keyof typeof providerApiKeys];
      
      if (!isConfigured) {
        open({
          title: "API Key Required",
          children: (
            <ApiKeyInputDialog 
              providerId={provider.id} 
              onSuccess={() => openModelsDialog(provider.id)} 
            />
          ),
        });
      } else {
        openModelsDialog(provider.id);
      }
    },
    [open, openModelsDialog, providerApiKeys],
  );

  return (
    <DialogSearchList
      items={PROVIDERS}
      onSelect={handleSelect}
      getKey={(p) => p.id}
      placeholder="Select Provider..."
      emptyText="No matching providers"
      filterFn={(p, query) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(p, isSelected) => (
        <box flexDirection="row" width="100%" justifyContent="space-between" paddingRight={1}>
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {isSelected ? "\u0020\u2022\u0020" : "\u0020\u0020\u0020"}
            {p.name}
          </text>
        </box>
      )}
    />
  );
}
