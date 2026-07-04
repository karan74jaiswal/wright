import { useCallback } from "react";
import Header from "../components/header";
import { InputBar } from "../components/input-bar";
import { useTheme } from "../providers/theme";
import { useNavigate } from "react-router";

export default function Home() {
  const { colors } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    (text: string) => {
      navigate("/sessions/new", {
        state: {
          message: text,
        },
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <box
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
      position="relative"
      backgroundColor={colors.background}
      flexGrow={1}
      gap={2}
    >
      <Header />
      <box width="100%" maxWidth={78} paddingX={2}>
        <InputBar onSubmit={handleSubmit} />
      </box>
    </box>
  );
}
