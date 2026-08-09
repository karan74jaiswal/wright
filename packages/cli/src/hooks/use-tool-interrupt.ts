import { useState, useEffect, useRef } from "react";
import * as path from "node:path";
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
  sessionId: string = "default-session",
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
  const isResolvingRef = useRef(false);

  const processChain = async (
    payloads: any[],
    initialResolvedMap: Record<string, any>
  ) => {
    const currentResolvedMap = { ...initialResolvedMap };

    for (let i = 0; i < payloads.length; i++) {
      const p = payloads[i];
      const payload = p.value || p;
      const id = p.id;

      if (payload.type === "ask_permission") {
        const { target } = payload;
        const checkResult = await PermissionManager.check("ask_permission", target, activeCwd, sessionId);
        if (checkResult.allowed) {
          currentResolvedMap[id] = "Yes, approve";
        } else {
          return {
            blocked: {
              toolName: "ask_permission",
              target,
              args: payload,
              isBackendPermissionPrompt: true,
              interruptId: id,
              resolvedMap: currentResolvedMap,
              remainingPayloads: payloads.slice(i + 1),
            },
          };
        }
      } else if (payload.type === "client_tool") {
        const { name, args } = payload;
        
        // Resolve path to prevent relative path permission bypasses
        const resolvedArgs = { ...args };
        if (resolvedArgs.path) {
          resolvedArgs.path = path.resolve(activeCwd, resolvedArgs.path);
        }

        const target = resolvedArgs.path || resolvedArgs.command || "";
        const checkResult = await PermissionManager.check(name, target, activeCwd, sessionId);

        if (checkResult.allowed) {
          if (checkResult.resolvedPath && resolvedArgs.path) {
            resolvedArgs.path = checkResult.resolvedPath;
          }
          currentResolvedMap[id] = await executeClientTool(name, resolvedArgs, activeCwd);
        } else {
          return {
            blocked: {
              toolName: name,
              target,
              args: resolvedArgs,
              isBackendPermissionPrompt: false,
              interruptId: id,
              resolvedMap: currentResolvedMap,
              remainingPayloads: payloads.slice(i + 1),
            },
          };
        }
      } else if (payload.type === "invoke_skill") {
        const { name, args } = payload;
        currentResolvedMap[id] = await executeSkill(
          name,
          args,
          activeCwd,
          skillsRef.current,
          "default-session",
          disableSkillShellExecution,
        );
      } else if (payload.type === "invoke_mcp") {
        const { serverName, toolName, args } = payload;
        const target = `${serverName}.${toolName}`;
        const checkResult = await PermissionManager.check("invoke_mcp", target, activeCwd, sessionId);

        if (checkResult.allowed) {
          currentResolvedMap[id] = await executeMcpTool(serverName, toolName, args);
        } else {
          return {
            blocked: {
              toolName: "invoke_mcp",
              target,
              args: payload,
              isBackendPermissionPrompt: false,
              interruptId: id,
              resolvedMap: currentResolvedMap,
              remainingPayloads: payloads.slice(i + 1),
            },
          };
        }
      } else {
        currentResolvedMap[id] = `Error: Unsupported tool or interrupt payload type '${payload.type}'`;
      }
    }

    return { resolvedMap: currentResolvedMap };
  };

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

      const result = await processChain(payloads, {});
      
      if (result.blocked && isMounted) {
        setPendingApproval(result.blocked);
      } else if (result.resolvedMap && isMounted) {
        submitInterrupt(result.resolvedMap);
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
    if (!pendingApproval || isResolvingRef.current) return;
    isResolvingRef.current = true;

    try {
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
        await PermissionManager.grant(toolName, finalTarget, "session", sessionId);
      } else if (decision === "allow_system") {
        await PermissionManager.grant(toolName, finalTarget, "system", sessionId);
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

      const result = await processChain(remainingPayloads, newResolvedMap);
      if (result.blocked) {
        setPendingApproval(result.blocked);
      } else if (result.resolvedMap) {
        submitInterrupt(result.resolvedMap);
      }
    } catch (err: any) {
      console.error("Tool interrupt execution error:", err);
      const errorMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;

      const { resolvedMap, interruptId, remainingPayloads } = pendingApproval!;
      const errorMap: Record<string, any> = {
        ...resolvedMap,
        [interruptId]: errorMsg,
      };
      for (const p of remainingPayloads) {
        errorMap[p.id] = "__CANCELLED__";
      }
      setPendingApproval(null);
      submitInterrupt(errorMap);
    } finally {
      isResolvingRef.current = false;
    }
  };

  return { pendingApproval, resolveApproval };
}
