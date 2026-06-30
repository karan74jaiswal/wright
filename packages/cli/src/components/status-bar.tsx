import { TextAttributes } from "@opentui/core";
import type { JSX } from "@opentui/react/jsx-runtime";
import { useTheme } from "../providers/theme";

function StatusBar(): JSX.Element {
  const { colors } = useTheme();
  return (
    <box flexDirection="row" gap={1}>
      <text fg={colors.primary}>Build</text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        &#8250;
      </text>
      <text>opus-4-6</text>
    </box>
  );
}

export default StatusBar;
