import { useEffect, useState, useMemo } from "react";
import { useTheme } from "../providers/theme";
import { useKeyboardLayer } from "../providers/keyboard";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { SplitBorder } from "./border";

export interface InterruptPromptProps {
  payload: any;
  onSubmit: (answer: string) => void;
}

export function InterruptPrompt({ payload, onSubmit }: InterruptPromptProps) {
  const { colors } = useTheme();
  const { push, pop, isTopLayer } = useKeyboardLayer();

  // Normalize the payload into a question and a set of options
  const { title, description, options } = useMemo(() => {
    if (payload?.type === "ask_question") {
      // It's an ask_question interrupt
      return {
        title: "Question from Agent",
        description: payload.question || "Please select an option:",
        options: payload.options?.length ? payload.options : ["Continue"],
      };
    } else if (payload?.type === "ask_permission") {
      // It's an ask_permission interrupt
      return {
        title: "Permission Required",
        description: `Agent wants to perform an action.\nTarget: ${payload.target || "Unknown"}\nReason: ${payload.reason || "No reason provided"}`,
        options: ["Yes, approve", "No, reject"],
      };
    }

    // Fallback for unknown interrupt payloads
    return {
      title: "Agent Paused",
      description: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      options: ["Continue", "Cancel"],
    };
  }, [payload]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    push("interrupt", () => false); // Disable default pop on escape
    return () => {
      pop("interrupt");
    };
  }, [push, pop]);

  useKeyboard((key: KeyEvent) => {
    if (!isTopLayer("interrupt")) return;

    if (key.name === "down") {
      setSelectedIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (key.name === "enter" || key.name === "return") {
      onSubmit(options[selectedIndex]);
    }
  });

  return (
    <box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      border={["top", "bottom", "left", "right"]}
      customBorderChars={SplitBorder.customBorderChars}
      borderColor={colors.primary}
      backgroundColor={colors.surface}
      width="100%"
      gap={1}
    >
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={colors.primary}>{title}</text>
      </box>

      <box paddingBottom={1}>
        <text fg={colors.info}>{description}</text>
      </box>

      <box flexDirection="column">
        {options.map((opt: string, index: number) => {
          const isSelected = index === selectedIndex;
          return (
            <box
              key={opt}
              flexDirection="row"
              backgroundColor={isSelected ? colors.selection : undefined}
              paddingX={1}
            >
              <text fg={isSelected ? "black" : "white"}>
                {(isSelected ? "❯ " : "  ") + opt}
              </text>
            </box>
          );
        })}
      </box>

      <box paddingTop={1}>
        <text fg={colors.dimSeparator}>
          Use ↑/↓ to navigate, Enter to select
        </text>
      </box>
    </box>
  );
}
