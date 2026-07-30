import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { usePromptConfig } from "../providers/prompt-config";
import { useTheme } from "../providers/theme";

export default function TrustWorkspaceScreen() {
  const { colors } = useTheme();
  const { setTrustedWorkspace } = usePromptConfig();
  const currentPath = process.cwd();

  useKeyboard((key) => {
    if (key.name === "y") {
      setTrustedWorkspace(currentPath, true);
    } else if (key.name === "n" || key.name === "escape") {
      process.exit(0);
    }
  });

  return (
    <box
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
      backgroundColor={colors.background}
      flexDirection="column"
      gap={1}
    >
      <box
        borderStyle="rounded"
        borderColor={colors.primary}
        paddingX={4}
        paddingY={2}
        flexDirection="column"
        gap={1}
        alignItems="center"
      >
        <text attributes={TextAttributes.BOLD} fg={colors.primary}>
          ⚠️ Untrusted Workspace Detected
        </text>

        <box paddingY={1} flexDirection="column" alignItems="center">
          <text>Wright CLI requires permission to read, edit,</text>
          <text>and execute files in the following directory:</text>
        </box>

        <box paddingY={1}>
          <text attributes={TextAttributes.BOLD} fg="cyan">
            {currentPath}
          </text>
        </box>

        <text fg={colors.dimSeparator}>Do you trust the contents of this project?</text>

        <box flexDirection="row" gap={4} paddingTop={2}>
          <box flexDirection="row" gap={1}>
            <text attributes={TextAttributes.BOLD} fg="green">[Y]</text>
            <text>Yes, I trust this folder</text>
          </box>
          <box flexDirection="row" gap={1}>
            <text attributes={TextAttributes.BOLD} fg="red">[N]</text>
            <text>No, exit</text>
          </box>
        </box>
      </box>
    </box>
  );
}
