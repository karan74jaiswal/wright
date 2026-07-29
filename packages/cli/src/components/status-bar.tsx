import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/react/jsx-runtime";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";

function StatusBar(): JSX.Element {
  const { colors } = useTheme();
  const { currentMode, currentModel, reasoningEffort } = usePromptConfig();

  const isReasoningModel = 
    currentModel.startsWith("o1") || 
    currentModel.startsWith("o3") || 
    currentModel.startsWith("o4") || 
    currentModel.startsWith("gpt-5") ||
    currentModel.startsWith("gemini-3") || 
    currentModel.startsWith("gemini-2.5") || 
    currentModel.startsWith("gemini-2.0-flash-thinking");

  const formattedEffort = reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1);

  return (
    <box flexDirection="row" gap={1}>
      <text fg={currentMode === "PLAN" ? colors.planMode : colors.primary}>
        {currentMode === "PLAN" ? "Plan" : "Build"}
      </text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        &#8250;
      </text>
      <text>
        {currentModel}
        {isReasoningModel ? ` (${formattedEffort})` : ""}
      </text>
    </box>
  );
}

export default StatusBar;
