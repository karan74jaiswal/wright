import { useState, useEffect } from "react";
import { PermissionManager } from "../lib/permissions";
import type { PermissionScope } from "../lib/permissions";
import { executeClientTool } from "../lib/engine";

export interface PendingToolApproval {
  toolName: string;
  target: string;
  args: any;
  isBackendPermissionPrompt: boolean;
}

export function useToolInterrupt(
  interruptPayload: any | null,
  submitInterrupt: (result: any) => void,
  activeCwd: string
) {
  const [pendingApproval, setPendingApproval] = useState<PendingToolApproval | null>(null);

  useEffect(() => {
    if (!interruptPayload) {
      setPendingApproval(null);
      return;
    }

    const processInterrupt = async () => {
      // 1. Is it a backend generic ask_permission?
      if (interruptPayload.type === "ask_permission") {
        const { target } = interruptPayload;
        // Generic ask_permission has no specific toolName context technically, but we can treat it as a generic "command"
        const checkResult = PermissionManager.check("ask_permission", target, activeCwd);
        if (checkResult.allowed) {
          submitInterrupt("Yes, approve");
          return;
        }
        
        setPendingApproval({
          toolName: "ask_permission",
          target,
          args: interruptPayload,
          isBackendPermissionPrompt: true
        });
        return;
      }

      // 2. Is it a client_tool execution?
      if (interruptPayload.type === "client_tool") {
        const { name, args } = interruptPayload;
        const target = args?.path || args?.command || "";

        const checkResult = PermissionManager.check(name, target, activeCwd);
        
        if (checkResult.allowed) {
          // Auto-execute and return result
          const output = await executeClientTool(name, args, activeCwd);
          submitInterrupt(output);
        } else {
          // Pause and ask user
          setPendingApproval({
            toolName: name,
            target,
            args,
            isBackendPermissionPrompt: false
          });
        }
      }
    };

    processInterrupt();
  }, [interruptPayload, submitInterrupt, activeCwd]);

  const resolveApproval = async (decision: "allow_once" | "allow_session" | "allow_system" | "deny", wildcardTarget?: string) => {
    if (!pendingApproval) return;
    
    const { toolName, target, args, isBackendPermissionPrompt } = pendingApproval;
    const finalTarget = wildcardTarget || target;

    // Handle Deny
    if (decision === "deny") {
      setPendingApproval(null);
      if (isBackendPermissionPrompt) {
        submitInterrupt("No, reject");
      } else {
        submitInterrupt("__CANCELLED__");
      }
      return;
    }

    // Handle Grant
    if (decision === "allow_session") {
      PermissionManager.grant(toolName, finalTarget, "session");
    } else if (decision === "allow_system") {
      PermissionManager.grant(toolName, finalTarget, "system");
    }

    setPendingApproval(null);

    // Execute or Approve
    if (isBackendPermissionPrompt) {
      submitInterrupt("Yes, approve");
    } else {
      const output = await executeClientTool(toolName, args, activeCwd);
      submitInterrupt(output);
    }
  };

  return { pendingApproval, resolveApproval };
}
