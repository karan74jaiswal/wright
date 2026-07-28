import "opentui-spinner/react";
import type { ReactNode } from "react";
import { useTheme } from "../providers/theme";

const ThinkingSpinner = (): ReactNode => {
  const { colors } = useTheme();
  return <spinner name="dots" color={colors.dimSeparator} />;
};

export default ThinkingSpinner;
