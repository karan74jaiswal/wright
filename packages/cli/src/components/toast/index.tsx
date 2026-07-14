import { useTerminalDimensions } from "@opentui/react";
import { ToastVariant, type ToastOptions } from "../../providers/toast/types";
import { SplitBorder } from "../border";
import { useTheme } from "../../providers/theme";

interface ToastProps {
  currentToast: ToastOptions | null;
}

const Toast = ({ currentToast }: ToastProps) => {
  const { colors } = useTheme();
  const { width: terminalWidth } = useTerminalDimensions();
  console.log(currentToast);

  if (!currentToast) return null;

  const variantColors: Record<ToastVariant, string> = {
    error: colors.error,
    info: colors.info,
    success: colors.success,
  };
  const borderColor = currentToast.variant
    ? variantColors[currentToast.variant]
    : variantColors.info;
  return (
    <box
      position="absolute"
      justifyContent="center"
      alignItems="flex-start"
      top={2}
      right={2}
      width={Math.max(1, Math.min(50, terminalWidth - 6))}
      paddingX={2}
      paddingY={1}
      backgroundColor={colors.surface}
      borderColor={borderColor}
      border={["left", "right"]}
      customBorderChars={SplitBorder.customBorderChars}
    >
      <box flexDirection="column" gap={1} width="100%">
        <text width="100%" wrapMode="word" fg="#E1E1E1">
          {currentToast.message}
        </text>
      </box>
    </box>
  );
};

export default Toast;
