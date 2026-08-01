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
  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    target: string;
    args: any;
    isBackendPermissionPrompt: boolean;
    interruptId: string;
    resolvedMap: Record<string, any>;
    remainingPayloads: any[];
  } | null>(null);

  useEffect(() => {
    if (!interruptPayload) {
      setPendingApproval(null);
      return;
    }

    const processInterrupts = async () => {
      // Stream.ts now yields an array of { id, value }
      const payloads = Array.isArray(interruptPayload) ? interruptPayload : [{ id: 'single', value: interruptPayload }];
      
      // If there are any generic interrupts, bail out and let InterruptPrompt handle them
      const hasGeneric = payloads.some(p => {
        const payload = p.value || p;
        return payload.type !== "client_tool" && payload.type !== "ask_permission";
      });
      if (hasGeneric) return;

      const resolvedMap: Record<string, any> = {};
      
      let blockedIndex = -1;

      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i];
        const payload = p.value || p;
        const id = p.id;

        // 1. Is it a backend generic ask_permission?
        if (payload.type === "ask_permission") {
          const { target } = payload;
          const checkResult = await PermissionManager.check("ask_permission", target, activeCwd);
          if (checkResult.allowed) {
            resolvedMap[id] = "Yes, approve";
            continue;
          }
          
          setPendingApproval({
            toolName: "ask_permission",
            target,
            args: payload,
            isBackendPermissionPrompt: true,
            interruptId: id,
            resolvedMap,
            remainingPayloads: payloads.slice(i + 1)
          });
          blockedIndex = i;
          break;
        }

        // 2. Is it a client_tool execution?
        if (payload.type === "client_tool") {
          const { name, args } = payload;
          const target = args?.path || args?.command || "";

          const checkResult = await PermissionManager.check(name, target, activeCwd);
          
          if (checkResult.allowed) {
            const output = await executeClientTool(name, args, activeCwd);
            resolvedMap[id] = output;
          } else {
            setPendingApproval({
              toolName: name,
              target,
              args,
              isBackendPermissionPrompt: false,
              interruptId: id,
              resolvedMap,
              remainingPayloads: payloads.slice(i + 1)
            });
            blockedIndex = i;
            break;
          }
        }
      }

      if (blockedIndex === -1) {
        // All auto-approved!
        submitInterrupt(resolvedMap);
      }
    };

    processInterrupts().catch((err) => {
      console.error("Tool interrupt processing error:", err);
      // Submit an error result so the stream doesn't hang
      const payloads = Array.isArray(interruptPayload) ? interruptPayload : [{ id: 'single', value: interruptPayload }];
      const errorMap: Record<string, any> = {};
      for (const p of payloads) {
        errorMap[p.id] = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
      submitInterrupt(errorMap);
    });
  }, [interruptPayload, submitInterrupt, activeCwd]);

  const resolveApproval = async (decision: "allow_once" | "allow_session" | "allow_system" | "deny", wildcardTarget?: string) => {
    if (!pendingApproval) return;
    
    const { toolName, target, args, isBackendPermissionPrompt, interruptId, resolvedMap, remainingPayloads } = pendingApproval;
    const finalTarget = wildcardTarget || target;

    // Handle Deny
    if (decision === "deny") {
      setPendingApproval(null);
      
      const denyResult = isBackendPermissionPrompt ? "No, reject" : "__CANCELLED__";
      const newResolvedMap = { ...resolvedMap, [interruptId]: denyResult };
      
      // Auto-deny the rest since the user aborted this chain
      for (const p of remainingPayloads) {
        newResolvedMap[p.id] = p.value?.type === "ask_permission" ? "No, reject" : "__CANCELLED__";
      }
      
      submitInterrupt(newResolvedMap);
      return;
    }

    // Handle Grant
    if (decision === "allow_session") {
      await PermissionManager.grant(toolName, finalTarget, "session");
    } else if (decision === "allow_system") {
      await PermissionManager.grant(toolName, finalTarget, "system");
    }

    setPendingApproval(null);

    // Execute the blocked one
    const newResolvedMap = { ...resolvedMap };
    if (isBackendPermissionPrompt) {
      newResolvedMap[interruptId] = "Yes, approve";
    } else {
      const output = await executeClientTool(toolName, args, activeCwd);
      newResolvedMap[interruptId] = output;
    }

    // Now execute the rest (we auto-grant them if they are covered, else wait... wait! 
    // To keep it simple, we just pass the rest back to the loop by updating interruptPayload.
    // BUT we don't have access to setInterruptPayload here! 
    // It's fine, we can just execute them here in a loop.)
    
    let nextBlocked: any = null;
    for (let i = 0; i < remainingPayloads.length; i++) {
      const p = remainingPayloads[i];
      const payload = p.value || p;
      const id = p.id;

      if (payload.type === "ask_permission") {
        const checkResult = await PermissionManager.check("ask_permission", payload.target, activeCwd);
        if (checkResult.allowed) {
          newResolvedMap[id] = "Yes, approve";
        } else {
          setPendingApproval({
            toolName: "ask_permission",
            target: payload.target,
            args: payload,
            isBackendPermissionPrompt: true,
            interruptId: id,
            resolvedMap: newResolvedMap,
            remainingPayloads: remainingPayloads.slice(i + 1)
          });
          nextBlocked = true;
          break;
        }
      } else if (payload.type === "client_tool") {
        const target = payload.args?.path || payload.args?.command || "";
        const checkResult = await PermissionManager.check(payload.name, target, activeCwd);
        if (checkResult.allowed) {
          const output = await executeClientTool(payload.name, payload.args, activeCwd);
          newResolvedMap[id] = output;
        } else {
          setPendingApproval({
            toolName: payload.name,
            target,
            args: payload.args,
            isBackendPermissionPrompt: false,
            interruptId: id,
            resolvedMap: newResolvedMap,
            remainingPayloads: remainingPayloads.slice(i + 1)
          });
          nextBlocked = true;
          break;
        }
      } else {
        // Fallback for unhandled types like ask_question in the remaining chain
        setPendingApproval({
          toolName: payload.type,
          target: payload.type,
          args: payload,
          isBackendPermissionPrompt: false,
          interruptId: id,
          resolvedMap: newResolvedMap,
          remainingPayloads: remainingPayloads.slice(i + 1)
        });
        nextBlocked = true;
        break;
      }
    }

    if (!nextBlocked) {
      submitInterrupt(newResolvedMap);
    }
  };

  return { pendingApproval, resolveApproval };
}
