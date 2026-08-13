import { useCallback } from "react";
import Header from "../components/header";
import { InputBar } from "../components/input-bar";
import { ShellBar } from "../components/shell-bar";
import { useTheme } from "../providers/theme";
import { useNavigate } from "react-router";
import { usePromptConfig } from "../providers/prompt-config";
import { useKeyboardLayer } from "../providers/keyboard";
import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";

export default function Home() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { currentMode, setMode } = usePromptConfig();
  const { isTopLayer } = useKeyboardLayer();

  useKeyboard((key) => {
    if (!isTopLayer("base")) return;
    if (key.name === "tab") {
      setMode(currentMode === "BUILD" ? "PLAN" : "BUILD");
    }
  });

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

  const handleExecute = useCallback(
    (text: string) => {
      navigate("/sessions/new", {
        state: {
          message: text,
          isCommand: true,
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
      <box width="100%" maxWidth={78} paddingX={2} flexDirection="column" gap={1}>
        {isTopLayer("shell") ? (
          <ShellBar onExecute={handleExecute} />
        ) : (
          <InputBar onSubmit={handleSubmit} />
        )}
        <box flexDirection="row" gap={1} marginLeft="auto">
          <text>tab</text>
          <text attributes={TextAttributes.DIM}>agents</text>
        </box>
      </box>
    </box>
  );
}
