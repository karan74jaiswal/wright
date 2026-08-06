import React, { useEffect, useState } from "react";
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

  const options = React.useMemo(() => {
    const opts: Array<{ label: string; value: "allow_once" | "allow_session" | "allow_system" | "deny"; wildcard?: string }> = [];
    
    opts.push({ label: "Yes, allow once", value: "allow_once" });
    opts.push({ label: "Yes, allow for this session (strict match)", value: "allow_session" });
    opts.push({ label: "Yes, allow permanently (strict match)", value: "allow_system" });
    
    let wildcardDesc = "";
    let wildcard: string | undefined = undefined;
    
    if (pendingApproval.toolName === "run_command" && pendingApproval.target) {
      const parts = pendingApproval.target.split(" ");
      if (parts.length > 1) {
        wildcard = `${parts[0]} *`;
        wildcardDesc = `Allow all '${parts[0]}' commands`;
      }
    } else if (pendingApproval.toolName === "invoke_mcp" && pendingApproval.target) {
      const parts = pendingApproval.target.split(".");
      if (parts.length > 1) {
        wildcard = `${parts[0]}.*`;
        wildcardDesc = `Allow all tools on '${parts[0]}' server`;
      }
    } else if (pendingApproval.target && pendingApproval.target.includes("/")) {
      const dir = pendingApproval.target.substring(0, pendingApproval.target.lastIndexOf("/"));
      if (dir) {
        wildcard = `${dir}/*`;
        wildcardDesc = `Allow all files in '${dir}'`;
      }
    }

    if (wildcard && wildcardDesc) {
      opts.push({ label: `Yes, for this session (${wildcardDesc})`, value: "allow_session", wildcard });
      opts.push({ label: `Yes, permanently (${wildcardDesc})`, value: "allow_system", wildcard });
    }
    
    opts.push({ label: "No, deny", value: "deny" });
    
    return opts.map((o, i) => ({ ...o, label: `${i + 1}. ${o.label}` }));
  }, [pendingApproval]);

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

      onResolve(selection.value, selection.wildcard);
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
              key={opt.label}
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
