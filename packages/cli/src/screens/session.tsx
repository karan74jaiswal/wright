import { useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useMemo, memo, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "../providers/theme";
import SessionShell from "../components/session-shell";
import { z } from "zod";
import { Mode } from "@wright/database/enums";
import { UserMsg, BotMsg, ErrorMsg } from "../components/messages";
import { useToast } from "../providers/toast";
import { useTRPC } from "../lib/api-client";
import { ToastVariant } from "../providers/toast/types";
import { useChat } from "../hooks/use-chat";
import { useToolInterrupt } from "../hooks/use-tool-interrupt";
import { ToolApprovalPrompt } from "../components/tool-approval-prompt";
import { InterruptPrompt } from "../components/interrupt-prompt";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";
import { DEFAULT_CHAT_MODEL_ID } from "@wright/shared";
import { useKeyboardLayer } from "../providers/keyboard";
import { useKeyboard } from "@opentui/react";
import { useMcp } from "../providers/mcp";
import { useSkills } from "../providers/skills";
import crypto from "node:crypto";

type SessionData = inferRouterOutputs<AppRouter>["session"]["getSession"];

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (val) => val !== null && typeof val === "object" && "id" in val,
  ),
});

interface ChatMessageProps {
  msg: SessionData["messages"][number];
  showReasoning: boolean;
  hideFooter?: boolean;
  hideHeader?: boolean;
  groupDuration?: number;
  allMessages?: SessionData["messages"];
}

const ChatMessage = memo(function ChatMessage({
  msg,
  showReasoning,
  hideFooter,
  hideHeader,
  groupDuration,
  allMessages,
}: ChatMessageProps) {
  if (msg.role === "USER")
    return <UserMsg message={msg.content} mode={msg.mode as Mode} />;
  if (msg.role === "ERROR") return <ErrorMsg message={msg.content} />;
  if (msg.role === "TOOL") return null;
  if (msg.role === "SYSTEM") return null;

  let parsedToolCalls: Record<string, any> | undefined = undefined;
  if (msg.toolCalls) {
    let rawToolCalls = msg.toolCalls;
    if (typeof rawToolCalls === "string") {
      try {
        rawToolCalls = JSON.parse(rawToolCalls);
      } catch (e) {
        rawToolCalls = [];
      }
    }

    if (Array.isArray(rawToolCalls)) {
      parsedToolCalls = rawToolCalls.reduce((acc: any, tc: any, i: number) => {
        const tcId = tc.id || String(i);
        let toolMsg = allMessages?.find(
          (m) => m.role === "TOOL" && m.toolCallId === tcId,
        );

        // Fallback for old history where toolCallId was saved as "unknown"
        if (!toolMsg) {
          const myIdx = allMessages?.findIndex((m) => m.id === msg.id) ?? -1;
          if (myIdx !== -1) {
            toolMsg = allMessages
              ?.slice(myIdx + 1)
              .find(
                (m) =>
                  m.role === "TOOL" &&
                  m.toolCallId === "unknown" &&
                  !acc._used?.includes(m.id),
              );
          }
        }

        acc[tcId] = {
          name: tc.name,
          args: tc.args,
          result: toolMsg ? toolMsg.content : true,
        };
        if (toolMsg) {
          acc._used = [...(acc._used || []), toolMsg.id];
        }
        return acc;
      }, {});
      if (parsedToolCalls) {
        delete parsedToolCalls._used;
      }
    } else if (typeof rawToolCalls === "object" && rawToolCalls !== null) {
      // It might already be a Record<string, any> from optimistic updates
      parsedToolCalls = rawToolCalls as Record<string, any>;
    }
  }

  let displayContent = msg.content;
  try {
    const parsed = JSON.parse(msg.content);
    if (Array.isArray(parsed)) {
      displayContent = parsed.map((block: any) => block.text || "").join("");
    } else if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.text === "string"
    ) {
      displayContent = parsed.text;
    }
  } catch (e) {
    // Ignore JSON parse error, use raw content
  }

  return (
    <BotMsg
      content={displayContent}
      model={msg.model}
      reasoning={msg.reasoning || undefined}
      reasoningDuration={msg.reasoningDuration || undefined}
      toolCalls={parsedToolCalls}
      mode={msg.mode}
      status={msg.status}
      duration={groupDuration ?? msg.duration}
      showReasoning={showReasoning}
      reasoningEffort={msg.reasoningEffort}
      hideFooter={hideFooter}
      hideHeader={hideHeader}
    />
  );
});

const SessionInner = ({ id }: { id: string }) => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [showReasoning, setShowReasoning] = useState(false);
  const { isTopLayer } = useKeyboardLayer();

  useKeyboard(
    useCallback((key: any) => {
      if (!isTopLayer("base")) return;
      if (key.ctrl && key.name === "o") {
        setShowReasoning((prev) => !prev);
      }
    }, [isTopLayer])
  );

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    if (!parsed.success) return null;
    return parsed.data.session;
  }, [location.state]);

  const { skills: discoveredSkills, isLoading: isSkillsLoading } = useSkills();
  const { servers, isLoading: isMcpLoading } = useMcp();
  const trpc = useTRPC();

  const isPreSynced = useMemo(() => {
    return !!(location.state && typeof location.state === "object" && "session" in location.state);
  }, [location.state]);

  const [synced, setSynced] = useState(isPreSynced);
  const syncConfigMutation = useMutation(trpc.session.syncSessionConfig.mutationOptions());

  const {
    data: rawSession,
    isError,
    error,
  } = useQuery({
    ...trpc.session.getSession.queryOptions({ id: id! }),
    initialData: prefetched || undefined,
    enabled: !!id,
    staleTime: Infinity,
  });

  const session = rawSession as SessionData | undefined;

  const [currentToolsHash, setCurrentToolsHash] = useState<string | undefined>(session?.toolsHash || undefined);

  useEffect(() => {
    if (!id || isSkillsLoading || isMcpLoading || !session) return;

    const optimizedSkills = Object.fromEntries(
      Array.from(discoveredSkills.entries()).map(([key, skill]) => [
        key,
        {
          name: skill.name,
          path: skill.skillFilePath,
          description: skill.frontmatter.description || "No description provided.",
        },
      ])
    );
    const optimizedMcps = Object.fromEntries(
      Array.from(servers.entries()).map(([key, server]) => [
        key,
        {
          name: server.name,
          config: server.config,
          source: server.source,
          tools: server.tools || [],
        },
      ])
    );

    let isMounted = true;

    const syncState = async () => {
      // Compute CAS Hash identical to backend
      const payloadString = JSON.stringify({ skills: optimizedSkills, mcps: optimizedMcps });
      const hashHex = crypto.createHash("sha256").update(payloadString).digest("hex");
      if (isMounted) setCurrentToolsHash(hashHex);

      // If local hash matches DB hash, we are in sync!
      if (session.toolsHash === hashHex) {
        if (isMounted) setSynced(true);
        return;
      }

      // Cache miss / Out of sync -> Push payload to backend
      try {
        await syncConfigMutation.mutateAsync({
          sessionId: id,
          enabledSkills: optimizedSkills,
          enabledMcps: optimizedMcps,
        });
        if (isMounted) setSynced(true);
      } catch (e) {
        console.error("Failed to sync session config on resume:", e);
        if (isMounted) setSynced(true);
      }
    };

    syncState();

    return () => { isMounted = false; };
  }, [id, discoveredSkills, servers, isSkillsLoading, isMcpLoading, session?.toolsHash]);

  useEffect(() => {
    if (isError) {
      toast.show({
        variant: ToastVariant.ERROR,
        message: error?.message || "Failed to load session",
      });
      navigate("/", { replace: true });
    }
  }, [isError, error, navigate, toast]);

  // Handle stream state via our robust useChat hook!
  const initialMessages = useMemo(
    () => session?.messages ?? [],
    [session?.messages],
  );

  const forceSync = useCallback(async () => {
    // Only send the minimal metadata needed by the backend agent for skills
    const optimizedSkills = Object.fromEntries(
      Array.from(discoveredSkills.entries()).map(([key, skill]) => [
        key,
        {
          name: skill.name,
          path: skill.skillFilePath,
          description: skill.frontmatter.description || "No description provided.",
        },
      ])
    );
    const optimizedMcps = Object.fromEntries(
      Array.from(servers.entries()).map(([key, server]) => [
        key,
        {
          name: server.name,
          config: server.config,
          source: server.source,
          tools: server.tools || [],
        },
      ])
    );

    await syncConfigMutation.mutateAsync({
      sessionId: id!,
      enabledSkills: optimizedSkills,
      enabledMcps: optimizedMcps,
    });
    const payloadString = JSON.stringify({ skills: optimizedSkills, mcps: optimizedMcps });
    const hashHex = crypto.createHash("sha256").update(payloadString).digest("hex");
    setCurrentToolsHash(hashHex);
  }, [id, discoveredSkills, servers, syncConfigMutation]);

  const {
    history,
    streamedContent,
    streamedReasoning,
    activeToolCalls,
    isLoading,
    status,
    interruptPayload,
    sendMessage,
    submitInterrupt,
    stop,
  } = useChat({
    sessionId: id!,
    toolsHash: currentToolsHash || session?.toolsHash || undefined,
    initialMessages,
    forceSync,
  });

  const { pendingApproval, resolveApproval } = useToolInterrupt(
    interruptPayload,
    submitInterrupt,
    session?.cwd || process.cwd(),
    discoveredSkills,
  );

  const lastVisibleMsg = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg && msg.role !== "TOOL" && msg.role !== "SYSTEM") {
        return msg;
      }
    }
    return null;
  }, [history]);

  if (!session || !synced)
    return <SessionShell onSubmit={(_t) => {}} inputDisabled loading />;

  const isStreamingAiPresent = !!(
    streamedContent ||
    streamedReasoning ||
    Object.keys(activeToolCalls).length > 0
  );

  return (
    <SessionShell
      onSubmit={sendMessage}
      onCancel={stop}
      inputDisabled={isLoading}
      loading={isLoading}
    >
      {[
        ...history.map((msg, i, arr) => {
          let prevVisibleMsg;
          for (let j = i - 1; j >= 0; j--) {
            const m = arr[j];
            if (m && m.role !== "TOOL" && m.role !== "SYSTEM") {
              prevVisibleMsg = m;
              break;
            }
          }

          let nextVisibleMsg;
          for (let j = i + 1; j < arr.length; j++) {
            const m = arr[j];
            if (m && m.role !== "TOOL" && m.role !== "SYSTEM") {
              nextVisibleMsg = m;
              break;
            }
          }

          const hasToolCalls =
            msg.toolCalls &&
            ((Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) ||
              (typeof msg.toolCalls === "string" && msg.toolCalls.length > 5) ||
              (typeof msg.toolCalls === "object" &&
                Object.keys(msg.toolCalls).length > 0));

          const hideHeader =
            !hasToolCalls &&
            prevVisibleMsg?.role === "ASSISTANT" &&
            msg.role === "ASSISTANT";

          const isNextAi =
            nextVisibleMsg?.role === "ASSISTANT" ||
            (!nextVisibleMsg && isStreamingAiPresent);

          const hideFooter = isNextAi && msg.role === "ASSISTANT";

          // Calculate total duration for the grouped block
          let groupDuration = msg.duration || 0;
          if (!hideFooter && msg.role === "ASSISTANT") {
            for (let j = i - 1; j >= 0; j--) {
              const m = arr[j];
              if (!m) continue;
              if (m.role === "USER" || m.role === "ERROR") break;
              if (m.duration) {
                groupDuration += m.duration;
              }
            }
          }

          // Don't render boxes for invisible messages
          if (msg.role === "TOOL" || msg.role === "SYSTEM") return null;

          return (
            <box
              key={msg.id}
              flexDirection="column"
              width="100%"
              paddingBottom={hideFooter ? 0 : 1}
            >
              <ChatMessage
                msg={msg}
                showReasoning={showReasoning}
                hideFooter={hideFooter}
                hideHeader={hideHeader}
                groupDuration={groupDuration}
                allMessages={arr}
              />
            </box>
          );
        }),
        streamedContent ||
        streamedReasoning ||
        Object.keys(activeToolCalls).length > 0 ? (
          <box
            key="stream"
            flexDirection="column"
            width="100%"
            paddingBottom={1}
          >
            <BotMsg
              content={streamedContent}
              model={lastVisibleMsg?.model || DEFAULT_CHAT_MODEL_ID}
              reasoning={streamedReasoning}
              toolCalls={activeToolCalls}
              streaming={status === "streaming"}
              mode={lastVisibleMsg?.mode}
              status={status === "interrupted" ? "INTERRUPTED" : undefined}
              showReasoning={showReasoning}
              reasoningEffort={lastVisibleMsg?.reasoningEffort}
              hideFooter={false}
              hideHeader={lastVisibleMsg?.role === "ASSISTANT"}
            />
          </box>
        ) : null,
        status === "interrupted" &&
        interruptPayload &&
        (Array.isArray(interruptPayload)
          ? interruptPayload.some((p) => {
              const t = p.value?.type || p.type;
              return (
                t !== "client_tool" &&
                t !== "ask_permission" &&
                t !== "invoke_skill"
              );
            })
          : interruptPayload.type !== "client_tool" &&
            interruptPayload.type !== "ask_permission" &&
            interruptPayload.type !== "invoke_skill") ? (
          <box key="interrupt" flexDirection="column" width="100%">
            <InterruptPrompt
              payload={interruptPayload}
              onSubmit={submitInterrupt}
            />
          </box>
        ) : null,
        pendingApproval ? (
          <box key="tool_approval" flexDirection="column" width="100%">
            <ToolApprovalPrompt
              pendingApproval={pendingApproval}
              onResolve={resolveApproval}
            />
          </box>
        ) : null,
      ].filter(Boolean)}
    </SessionShell>
  );
};

const Session = () => {
  const { id } = useParams();
  if (!id) return null;
  return <SessionInner key={id} id={id} />;
};

export default Session;
