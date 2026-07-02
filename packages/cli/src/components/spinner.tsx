import "opentui-spinner/react";
import type { ReactNode } from "react";
import { useTheme } from "../providers/theme";

const Spinner = (): ReactNode => {
  const { colors } = useTheme();
  return <spinner name="aesthetic" color={colors.primary} />;
};

export default Spinner;
