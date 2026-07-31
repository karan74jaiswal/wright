import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";
import { Mode } from "@wright/database/enums";

export interface UserMsgProps {
  message: string;
  mode?: Mode;
}
export const UserMsg = ({ message, mode }: UserMsgProps) => {
  const { colors } = useTheme();
  return (
    <box width="100%" alignItems="center">
      <box
        border={["left"]}
        borderColor={mode === Mode.PLAN ? colors.planMode : colors.primary}
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
        width="100%"
      >
        <box
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          backgroundColor={colors.surface}
          width="100%"
        >
          <text>{message || ""}</text>
        </box>
      </box>
    </box>
  );
};
