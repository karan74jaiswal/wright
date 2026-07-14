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
    if (payload?.questions && Array.isArray(payload.questions)) {
      // It's an ask_question interrupt
      const q = payload.questions[0];
      return {
        title: "Question from Agent",
        description: q?.question || "Please select an option:",
        options: q?.options || ["Continue"],
      };
    } else if (payload?.Action || payload?.Target) {
      // It's an ask_permission interrupt
      return {
        title: "Permission Required",
        description: `Agent wants to perform action: ${payload.Action}\nTarget: ${payload.Target}\nReason: ${payload.Reason}`,
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
