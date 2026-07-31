import { useEffect, useState } from "react";
import { useTheme } from "../providers/theme";
import { useKeyboardLayer } from "../providers/keyboard";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { SplitBorder } from "./border";
import type { PendingToolApproval } from "../hooks/use-tool-interrupt";

export interface ToolApprovalPromptProps {
  pendingApproval: PendingToolApproval;
  onResolve: (decision: "allow_once" | "allow_session" | "allow_system" | "deny", wildcard?: string) => void;
}

export function ToolApprovalPrompt({ pendingApproval, onResolve }: ToolApprovalPromptProps) {
  const { colors } = useTheme();
  const { push, pop, isTopLayer } = useKeyboardLayer();

  const options = [
    { label: "1. Yes, allow once", value: "allow_once" as const },
    { label: "2. Yes, allow for this session", value: "allow_session" as const },
    { label: "3. Yes, allow permanently", value: "allow_system" as const },
    { label: "4. No, deny", value: "deny" as const },
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    push("tool_approval", () => false);
    return () => {
      pop("tool_approval");
    };
  }, [push, pop]);

  useKeyboard((key: KeyEvent) => {
    if (!isTopLayer("tool_approval")) return;

    if (key.name === "down") {
      if ((key as any).preventDefault) (key as any).preventDefault();
      if ((key as any).stopPropagation) (key as any).stopPropagation();
      setSelectedIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (key.name === "up") {
      if ((key as any).preventDefault) (key as any).preventDefault();
      if ((key as any).stopPropagation) (key as any).stopPropagation();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (key.name === "enter" || key.name === "return") {
      if ((key as any).preventDefault) (key as any).preventDefault();
      if ((key as any).stopPropagation) (key as any).stopPropagation();
      
      const selection = options[selectedIndex];
      if (!selection) return;

      // Automatically construct a wildcard for directory/command rules for session/system saves
      let wildcard: string | undefined = undefined;
      if (selection.value === "allow_session" || selection.value === "allow_system") {
        if (pendingApproval.toolName === "run_command" && pendingApproval.target) {
          // just taking the first word as a prefix wildcard (e.g. `npm install` -> `npm *`)
          const parts = pendingApproval.target.split(" ");
          wildcard = parts.length > 1 ? `${parts[0]} *` : pendingApproval.target;
        } else if (pendingApproval.target && pendingApproval.target.includes("/")) {
           // For files, allow the entire directory
           const dir = pendingApproval.target.substring(0, pendingApproval.target.lastIndexOf("/"));
           wildcard = `${dir}/*`;
        }
      }

      onResolve(selection.value, wildcard);
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
        <text fg={colors.primary}>Requested Permission:</text>
      </box>

      <box paddingBottom={1} flexDirection="column">
        <text fg={colors.info}>
          Agent wants to execute `{pendingApproval.toolName}`
        </text>
        <text fg={colors.info}>
          Target: {pendingApproval.target}
        </text>
      </box>

      <box flexDirection="column">
        {options.map((opt, index: number) => {
          const isSelected = index === selectedIndex;
          return (
            <box
              key={opt.value}
              flexDirection="row"
              backgroundColor={isSelected ? colors.selection : undefined}
              paddingX={1}
            >
              <text fg={isSelected ? "black" : "white"}>{opt.label}</text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
