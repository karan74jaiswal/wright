import { useCallback, useRef } from "react";
import { usePromptConfig } from "../providers/prompt-config";
import { useDialog } from "../providers/dialog";
import { useKeyboardLayer } from "../providers/keyboard";
import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "../providers/theme";

interface ApiKeyInputDialogProps {
  providerId: string;
  onSuccess: () => void;
}

export default function ApiKeyInputDialog({ providerId, onSuccess }: ApiKeyInputDialogProps) {
  const { providerApiKeys, setApiKeys } = usePromptConfig();
  const { close } = useDialog();
  const { isTopLayer } = useKeyboardLayer();
  const { colors } = useTheme();

  const inputRef = useRef<any>(null);

  const handleSave = useCallback(() => {
    const newValue = inputRef.current?.value?.trim();
    const isConfigured = !!providerApiKeys[providerId as keyof typeof providerApiKeys];

    if (newValue) {
      setApiKeys({
        ...providerApiKeys,
        [providerId]: newValue,
      });
      close();
      onSuccess();
    } else if (isConfigured) {
      close();
      onSuccess();
    }
  }, [setApiKeys, close, providerApiKeys, providerId, onSuccess]);

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;
    
    if (key.name === "return") {
      handleSave();
    }
  });

  const providerName = providerId.charAt(0).toUpperCase() + providerId.slice(1);
  const isConfigured = !!providerApiKeys[providerId as keyof typeof providerApiKeys];

  return (
    <box flexDirection="column" gap={1} padding={1}>
      <text attributes={TextAttributes.DIM}>Press ENTER to save and continue.</text>
      
      <box flexDirection="column">
        <text fg={colors.primary}>
          {providerName} API Key {isConfigured ? "[✓ Configured]" : ""}:
        </text>
        <box paddingLeft={2} width="100%">
          <input
            ref={inputRef}
            focused={true}
            placeholder={isConfigured ? "(Leave blank to keep existing key)" : "Paste your API key here..."}
            value=""
          />
        </box>
      </box>
    </box>
  );
}
