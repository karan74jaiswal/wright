import type { ReactNode } from "react";
import type { DialogConfig } from "../../providers/dialog/types";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard";
import { MouseEvent, RGBA, TextAttributes, type KeyEvent } from "@opentui/core";
import { useTheme } from "../../providers/theme";

export interface DialogProps {
  close: () => void;
  currentDialog: DialogConfig | null;
}

export default function Dialog({
  close,
  currentDialog,
}: DialogProps): ReactNode {
  const { isTopLayer } = useKeyboardLayer();
  const { width: terminalWidth, height: terminalHeight } =
    useTerminalDimensions();
  const { colors } = useTheme();
  useKeyboard((key: KeyEvent) => {
    if (!currentDialog || !isTopLayer("dialog")) return;
    if (key.name === "escape") close();
  });

  if (!currentDialog) return null;
  const { title, children } = currentDialog;
  return (
    <box
      position="absolute"
      width={terminalWidth}
      height={terminalHeight}
      left={0}
      top={0}
      justifyContent="center"
      alignItems="center"
      zIndex={100}
      onMouseDown={() => close()}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
    >
      <box
        width={Math.min(60, terminalWidth - 4)}
        height="auto"
        backgroundColor={colors.dialogSurface}
        paddingX={4}
        paddingY={1}
        flexDirection="column"
        gap={1}
        onMouseDown={(e: MouseEvent) => e.stopPropagation()}
      >
        <box
          paddingBottom={1}
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <text attributes={TextAttributes.BOLD}>{title}</text>
          <text attributes={TextAttributes.DIM} onMouseDown={() => close()}>
            X
          </text>
        </box>
        <box flexGrow={1}>{children}</box>
      </box>
    </box>
  );
}
