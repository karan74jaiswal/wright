import {
  type TextareaRenderable,
  type KeyBinding,
  TextAttributes,
} from "@opentui/core";
import { useRenderer, useKeyboard } from "@opentui/react";
import { useRef, useCallback, useEffect } from "react";
import { useKeyboardLayer } from "../providers/keyboard";
import { useTheme } from "../providers/theme";
import { SplitBorder } from "./border";
import StatusBar from "./status-bar";
import { usePromptConfig } from "../providers/prompt-config";

interface ShellBarProps {
  onExecute: (command: string) => void;
  disabled?: boolean;
}

const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  {
    name: "return",
    action: "submit",
  },
  {
    name: "enter",
    action: "submit",
  },
];

export function ShellBar({ onExecute, disabled = false }: ShellBarProps) {
  const textAreaRef = useRef<TextareaRenderable>(null);
  const { isTopLayer, setResponder, pop } = useKeyboardLayer();
  const { colors } = useTheme();
  const { currentMode } = usePromptConfig();

  const closeShellMode = useCallback(() => {
    pop("shell");
  }, [pop]);

  const handleSubmit = useCallback(() => {
    if (disabled || !textAreaRef.current) return;
    const userInput = textAreaRef.current?.plainText.trim();
    if (!userInput.length) return;

    onExecute(userInput);
    textAreaRef.current.setText("");
    closeShellMode();
  }, [disabled, onExecute, closeShellMode]);

  useEffect(() => {
    setResponder("shell", () => {
      if (disabled) return false;
      const textArea = textAreaRef.current;
      if (textArea && textArea.plainText.length) {
        textArea.setText("");
        return true;
      }
      closeShellMode();
      return true;
    });

    return () => setResponder("shell", null);
  }, [disabled, setResponder, closeShellMode]);

  useKeyboard(
    useCallback(
      (key: any) => {
        if (!isTopLayer("shell")) return;

        const text = textAreaRef.current?.plainText || "";

        // If empty and backspace is pressed, revert to base layer
        if (key.name === "backspace" && text.length === 0) {
          closeShellMode();
        }
      },
      [isTopLayer, closeShellMode],
    ),
  );

  return (
    <box width="100%" alignItems="center" justifyContent="center">
      <box
        border={["left"]}
        customBorderChars={SplitBorder.customBorderChars}
        borderColor={currentMode === "PLAN" ? colors.planMode : colors.primary}
        width="100%"
      >
        <box
          position="relative"
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          gap={1}
          backgroundColor={colors.surface}
        >
          <box flexDirection="row" width="100%" gap={1} alignItems="flex-start">
            <text attributes={TextAttributes.BOLD}>!</text>
            <textarea
              flexGrow={1}
              focused={!disabled && isTopLayer("shell")}
              ref={textAreaRef}
              placeholder="Execute shell command..."
              onSubmit={() => {
                if (disabled) return;
                handleSubmit();
              }}
              keyBindings={TEXTAREA_KEY_BINDINGS}
            />
          </box>

          <StatusBar />
        </box>
      </box>
    </box>
  );
}
