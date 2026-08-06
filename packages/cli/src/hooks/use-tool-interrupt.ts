import { useState, useEffect, useRef } from "react";
import { PermissionManager } from "../lib/permissions";
import type { PermissionScope } from "../lib/permissions";
import { executeClientTool } from "../lib/engine";
import { executeSkill } from "../lib/engine/skills";
import { executeMcpTool } from "../lib/engine/mcp";
import type { DiscoveredSkill } from "../lib/skills/types";
import { usePromptConfig } from "../providers/prompt-config";

export interface PendingToolApproval {
  toolName: string;
  target: string;
  args: any;
  isBackendPermissionPrompt: boolean;
}

export function useToolInterrupt(
  interruptPayload: any | null,
  submitInterrupt: (result: any) => void,
  activeCwd: string,
  skills?: Map<string, DiscoveredSkill>,
) {
  const skillsRef = useRef(skills);
  useEffect(() => {
    skillsRef.current = skills;
  }, [skills]);

  const { disableSkillShellExecution } = usePromptConfig();

  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    target: string;
    args: any;
    isBackendPermissionPrompt: boolean;
    interruptId: string;
    resolvedMap: Record<string, any>;
    remainingPayloads: any[];
  } | null>(null);

  const lastProcessedPayloadRef = useRef<any>(null);

  useEffect(() => {
    if (!interruptPayload) {
      setPendingApproval(null);
      lastProcessedPayloadRef.current = null;
      return;
    }

    if (lastProcessedPayloadRef.current === interruptPayload) {
      return;
    }
    lastProcessedPayloadRef.current = interruptPayload;

    let isMounted = true;

    const processInterrupts = async () => {
      // Stream.ts now yields an array of { id, value }
      const payloads = Array.isArray(interruptPayload)
        ? interruptPayload
        : [{ id: "single", value: interruptPayload }];

      // If there are any generic interrupts, bail out and let InterruptPrompt handle them
      const hasGeneric = payloads.some((p) => {
        const payload = p.value || p;
        return (
          payload.type !== "client_tool" &&
          payload.type !== "ask_permission" &&
          payload.type !== "invoke_skill" &&
          payload.type !== "invoke_mcp"
        );
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
          const checkResult = await PermissionManager.check(
            "ask_permission",
            target,
            activeCwd,
          );
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
            remainingPayloads: payloads.slice(i + 1),
          });
          blockedIndex = i;
          break;
        }

        // 2. Is it a client_tool execution?
        if (payload.type === "client_tool") {
          const { name, args } = payload;
          const target = args?.path || args?.command || "";

          const checkResult = await PermissionManager.check(
            name,
            target,
            activeCwd,
          );

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
              remainingPayloads: payloads.slice(i + 1),
            });
            blockedIndex = i;
            break;
          }
        }

        // 3. Is it an invoke_skill?
        if (payload.type === "invoke_skill") {
          const { name, args } = payload;
          const output = await executeSkill(
            name,
            args,
            activeCwd,
            skillsRef.current,
          );
          resolvedMap[id] = output;
          continue;
        }

        // 4. Is it an invoke_mcp?
        if (payload.type === "invoke_mcp") {
          const { serverName, toolName, args } = payload;
          const target = `${serverName}.${toolName}`;

          const checkResult = await PermissionManager.check(
            "invoke_mcp",
            target,
            activeCwd,
          );

          if (checkResult.allowed) {
            const output = await executeMcpTool(serverName, toolName, args);
            resolvedMap[id] = output;
          } else {
            setPendingApproval({
              toolName: "invoke_mcp",
              target,
              args: payload,
              isBackendPermissionPrompt: false,
              interruptId: id,
              resolvedMap,
              remainingPayloads: payloads.slice(i + 1),
            });
            blockedIndex = i;
            break;
          }
        }
      }

      if (blockedIndex === -1 && isMounted) {
        // All auto-approved!
        submitInterrupt(resolvedMap);
      }
    };

    processInterrupts().catch((err) => {
      if (!isMounted) return;
      console.error("Tool interrupt processing error:", err);
      // Submit an error result so the stream doesn't hang
      const payloads = Array.isArray(interruptPayload)
        ? interruptPayload
        : [{ id: "single", value: interruptPayload }];
      const errorMap: Record<string, any> = {};
      for (const p of payloads) {
        errorMap[p.id] =
          `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
      submitInterrupt(errorMap);
    });

    return () => {
      isMounted = false;
    };
  }, [
    interruptPayload,
    submitInterrupt,
    activeCwd,
    disableSkillShellExecution,
  ]);

  const resolveApproval = async (
    decision: "allow_once" | "allow_session" | "allow_system" | "deny",
    wildcardTarget?: string,
  ) => {
    if (!pendingApproval) return;

    const {
      toolName,
      target,
      args,
      isBackendPermissionPrompt,
      interruptId,
      resolvedMap,
      remainingPayloads,
    } = pendingApproval;
    const finalTarget = wildcardTarget || target;

    try {
      // Handle Deny
      if (decision === "deny") {
        setPendingApproval(null);

        const denyResult = isBackendPermissionPrompt
          ? "No, reject"
          : "__CANCELLED__";
        const newResolvedMap = { ...resolvedMap, [interruptId]: denyResult };

        // Auto-deny the rest since the user aborted this chain
        for (const p of remainingPayloads) {
          newResolvedMap[p.id] =
            p.value?.type === "ask_permission" ? "No, reject" : "__CANCELLED__";
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
      } else if (toolName === "invoke_mcp") {
        const output = await executeMcpTool(
          args.serverName,
          args.toolName,
          args.args,
        );
        newResolvedMap[interruptId] = output;
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
          const checkResult = await PermissionManager.check(
            "ask_permission",
            payload.target,
            activeCwd,
          );
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
              remainingPayloads: remainingPayloads.slice(i + 1),
            });
            nextBlocked = true;
            break;
          }
        } else if (payload.type === "client_tool") {
          const target = payload.args?.path || payload.args?.command || "";
          const checkResult = await PermissionManager.check(
            payload.name,
            target,
            activeCwd,
          );
          if (checkResult.allowed) {
            const output = await executeClientTool(
              payload.name,
              payload.args,
              activeCwd,
            );
            newResolvedMap[id] = output;
          } else {
            setPendingApproval({
              toolName: payload.name,
              target,
              args: payload.args,
              isBackendPermissionPrompt: false,
              interruptId: id,
              resolvedMap: newResolvedMap,
              remainingPayloads: remainingPayloads.slice(i + 1),
            });
            nextBlocked = true;
            break;
          }
        } else if (payload.type === "invoke_skill") {
          const output = await executeSkill(
            payload.name,
            payload.args,
            activeCwd,
            skillsRef.current,
            "default-session",
            disableSkillShellExecution,
          );
          newResolvedMap[id] = output;
        } else if (payload.type === "invoke_mcp") {
          const target = `${payload.serverName}.${payload.toolName}`;
          const checkResult = await PermissionManager.check(
            "invoke_mcp",
            target,
            activeCwd,
          );
          if (checkResult.allowed) {
            const output = await executeMcpTool(
              payload.serverName,
              payload.toolName,
              payload.args,
            );
            newResolvedMap[id] = output;
          } else {
            setPendingApproval({
              toolName: "invoke_mcp",
              target,
              args: payload,
              isBackendPermissionPrompt: false,
              interruptId: id,
              resolvedMap: newResolvedMap,
              remainingPayloads: remainingPayloads.slice(i + 1),
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
            remainingPayloads: remainingPayloads.slice(i + 1),
          });
          nextBlocked = true;
          break;
        }
      }

      if (!nextBlocked) {
        submitInterrupt(newResolvedMap);
      }
    } catch (err: any) {
      console.error("Tool interrupt execution error:", err);
      const errorMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;

      const errorMap: Record<string, any> = {
        ...resolvedMap,
        [interruptId]: errorMsg,
      };
      for (const p of remainingPayloads) {
        errorMap[p.id] = "__CANCELLED__";
      }
      setPendingApproval(null);
      submitInterrupt(errorMap);
    }
  };

  return { pendingApproval, resolveApproval };
}
