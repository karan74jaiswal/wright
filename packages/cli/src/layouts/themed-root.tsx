import type { PropsWithChildren } from "react";

import { useTheme } from "../providers/theme";

export default function ThemedRoot({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <box
      height="100%"
      width="100%"
      backgroundColor={colors.background}
      flexGrow={1}
    >
      {children}
    </box>
  );
}
