import "opentui-spinner/react";
import type { ReactNode } from "react";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";

const Spinner = (): ReactNode => {
  const { colors } = useTheme();
  const { currentMode } = usePromptConfig();
  return <spinner name="aesthetic" color={currentMode === "PLAN" ? colors.planMode : colors.primary} />;
};

export default Spinner;
