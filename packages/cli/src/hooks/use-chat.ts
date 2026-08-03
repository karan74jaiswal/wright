import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../lib/api-client";
import { useToast } from "../providers/toast";
import { ToastVariant } from "../providers/toast/types";
import { usePromptConfig } from "../providers/prompt-config";
import { DEFAULT_CHAT_MODEL_ID } from "@wright/shared";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";

type SessionData = inferRouterOutputs<AppRouter>["session"]["getSession"];
type Message = SessionData["messages"][number];

export type ChatStatus = "idle" | "streaming" | "interrupted" | "error";

export interface UseChatOptions {
  sessionId: string;
  toolsHash?: string;
  initialMessages: Message[];
  forceSync?: () => Promise<void>;
}

export interface UseChatReturn {
  history: Message[];
  streamedContent: string;
  streamedReasoning: string;
  activeToolCalls: Record<string, { name: string; args: string; result?: any }>;
  interruptPayload: any | null;
  status: ChatStatus;
  isLoading: boolean;
  sendMessage: (text: string) => void;
  submitInterrupt: (answer: string) => void;
  stop: () => void;
}

export function useChat({
  sessionId,
  toolsHash,
  initialMessages,
  forceSync,
}: UseChatOptions): UseChatReturn {
  const toast = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { currentMode, currentModel, reasoningEffort, providerApiKeys } =
    usePromptConfig();

  // Data State
  const [history, setHistory] = useState<Message[]>(initialMessages);
  const [streamedContent, setStreamedContent] = useState("");
  const streamedContentRef = useRef(streamedContent);
  const [streamedReasoning, setStreamedReasoning] = useState("");
  const streamedReasoningRef = useRef(streamedReasoning);
  const [activeToolCalls, setActiveToolCalls] = useState<
    Record<string, { name: string; args: string; result?: any }>
  >({});
  const activeToolCallsRef = useRef(activeToolCalls);
  const [interruptPayload, setInterruptPayload] = useState<any | null>(null);

  // UI State
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [activeRequest, setActiveRequest] = useState<{
    message?: string;
    resume?: any;
    activeCwd?: string;
    isAutoResume?: boolean;
    timestamp?: number;
  } | null>(null);

  const hasAutoResumedRef = useRef(false);

  const cancelChatMutation = useMutation(
    trpc.chat.cancelChat.mutationOptions(),
  );

  // Keep refs in sync
  useEffect(() => {
    streamedContentRef.current = streamedContent;
  }, [streamedContent]);

  useEffect(() => {
    streamedReasoningRef.current = streamedReasoning;
  }, [streamedReasoning]);

  useEffect(() => {
    activeToolCallsRef.current = activeToolCalls;
  }, [activeToolCalls]);

  // Sync incoming database history
  useEffect(() => {
    setHistory((prevHistory) => {
      // Create a map of DB messages by ID
      const dbMessageIds = new Set(initialMessages.map((m) => m.id));
      const dbMessageContents = new Set(
        initialMessages.map((m) => m.content.trim()),
      );

      // Keep any optimistic user messages (e.g. temp-user-) that haven't been saved to DB yet.
      // We aggressively purge temp-ai-interrupt- messages because initialMessages only updates
      // after the run is fully done and the DB has the canonical messages.
      const optimisticMessages = prevHistory.filter(
        (m) =>
          m.id.startsWith("temp-") &&
          !m.id.startsWith("temp-ai-interrupt-") &&
          !dbMessageIds.has(m.id) &&
          !dbMessageContents.has(m.content.trim()),
      );

      // Merge DB messages with remaining optimistic messages
      return [...initialMessages, ...optimisticMessages];
    });
  }, [initialMessages]);

  useEffect(() => {
    hasAutoResumedRef.current = false;
  }, [sessionId]);

  // Auto-resume if the last message was from the user and we haven't answered it yet
  useEffect(() => {
    // console.log("history");
    // console.log(history);
    // console.log("hasAutoResumedRef");
    // console.log(hasAutoResumedRef);
    if (history.length > 0 && !hasAutoResumedRef.current) {
      const lastMsg = history[history.length - 1];
      if (lastMsg && lastMsg.role === "USER" && status === "idle") {
        hasAutoResumedRef.current = true;
        setStatus("streaming");
        setActiveRequest({
          message: lastMsg.content,
          activeCwd: process.cwd(),
          isAutoResume: true,
        });
      }
    }
  }, [history, status]);

  // The Streaming Subscription
  const streamSub = useSubscription(
    trpc.chat.streamChat.subscriptionOptions(
      {
        sessionId,
        model: currentModel,
        mode: currentMode,
        reasoningEffort,
        providerApiKeys,
        toolsHash,
        ...(activeRequest || {}),
      },
      {
        enabled: !!activeRequest && !!sessionId,
        onData(event) {
          if (event.type === "text-delta") {
            setStreamedContent((prev) => prev + event.text);
          } else if (event.type === "reasoning-delta") {
            setStreamedReasoning((prev) => prev + event.text);
          } else if (event.type === "tool-call") {
            setActiveToolCalls((prev) => {
              const existingName = prev[event.toolCallId]?.name;
              const newName =
                event.toolName !== "unknown"
                  ? event.toolName
                  : existingName || "unknown";
              return {
                ...prev,
                [event.toolCallId]: {
                  name: newName,
                  args: (prev[event.toolCallId]?.args || "") + event.args,
                },
              };
            });
          } else if (event.type === "tool-result") {
            setActiveToolCalls((prev) => ({
              ...prev,
              [event.toolCallId]: {
                ...(prev[event.toolCallId] || { name: "Unknown", args: "" }),
                result: event.result,
              },
            }));
          } else if (event.type === "interrupt") {
            setInterruptPayload(event.payload);
            setStatus("interrupted");

            // Step 1: Snapshot streaming state to optimistic history
            setHistory((prev) => {
              const toolCallsObj = activeToolCallsRef.current;
              const hasToolCalls = Object.keys(toolCallsObj).length > 0;
              const optimisticMsg: Message = {
                id: `temp-ai-interrupt-${Date.now()}`,
                sessionId,
                role: "ASSISTANT",
                content: streamedContentRef.current,
                reasoning: streamedReasoningRef.current || null,
                reasoningEffort,
                reasoningDuration: 0,
                duration: 0,
                status: "COMPLETED",
                model: currentModel,
                mode: currentMode,
                toolCalls: hasToolCalls ? toolCallsObj : null,
                toolCallId: null,
                createdAt: new Date(),
              };
              return [...prev, optimisticMsg];
            });

            setActiveToolCalls({}); // Clear synchronously so next stream starts fresh
            setStreamedContent("");
            setStreamedReasoning("");
          } else if (event.type === "done") {
            queryClient
              .invalidateQueries(
                trpc.session.getSession.queryOptions({ id: sessionId }),
              )
              .catch((e) => console.error("Failed to invalidate queries:", e))
              .finally(() => {
                setActiveRequest(null);
                setStreamedContent("");
                setStreamedReasoning("");
                setActiveToolCalls({});
                setStatus("idle");
              });
          } else if (event.type === "error") {
            queryClient
              .invalidateQueries(
                trpc.session.getSession.queryOptions({ id: sessionId }),
              )
              .catch((e) => console.error("Failed to invalidate queries:", e))
              .finally(() => {
                setActiveRequest(null);
                setStreamedContent("");
                setStreamedReasoning("");
                setActiveToolCalls({});
                setStatus("error");
              });
          }
        },
        onError(err) {
          if (
            (err.message === "CACHE_MISS_RESYNC_REQUIRED" ||
              err.message === "SESSION_CONFIG_NOT_SYNCED") &&
            activeRequest &&
            forceSync
          ) {
            console.log("[useChat] Cache miss in backend, forcing tools resync...");
            forceSync()
              .then(() => {
                // Retry the request by updating the timestamp to trigger a new subscription
                setActiveRequest((prev) =>
                  prev ? { ...prev, timestamp: Date.now() } : null,
                );
              })
              .catch((syncErr) => {
                console.error("Failed to resync tools:", syncErr);
                setStatus("error");
              });
            return; // Don't show toast or reset state yet
          }

          console.error("Subscription Error:", err);
          toast.show({
            variant: ToastVariant.ERROR,
            message: err.message || "Failed to connect to chat service",
          });
          queryClient
            .invalidateQueries(
              trpc.session.getSession.queryOptions({ id: sessionId }),
            )
            .catch((e) => console.error("Failed to invalidate queries:", e))
            .finally(() => {
              setActiveRequest(null);
              setStreamedContent("");
              setStreamedReasoning("");
              setActiveToolCalls({});
              setStatus("error");
            });
        },
      },
    ),
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (status !== "idle" && status !== "error") return;

      // Optimistically append the user's message so it renders instantly
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        sessionId,
        role: "USER",
        content: text,
        model: currentModel,
        mode: currentMode,
        status: "COMPLETED",
        duration: null,
        reasoning: null,
        reasoningDuration: null,
        reasoningEffort: null,
        toolCalls: null,
        toolCallId: null,
        createdAt: new Date().toISOString() as any, // Trpc decodes it properly, but types might expect string depending on trpc config
      };

      setHistory((prev) => [...prev, optimisticMsg]);
      setStatus("streaming");
      hasAutoResumedRef.current = true; // Prevent any auto-resume collisions
      setActiveRequest({
        message: text,
        activeCwd: process.cwd(),
        isAutoResume: false,
        timestamp: Date.now(),
      });
    },
    [sessionId, status, currentModel, currentMode],
  );

  const submitInterrupt = useCallback(
    (answerMap: Record<string, any> | any) => {
      if (status !== "interrupted") return;

      // Ensure answer is formatted as a Record mapping interrupt ID to answer.
      // If we only have a primitive value (e.g., from an older integration), fallback to treating it as a single payload.
      let resumePayload = answerMap;
      if (
        interruptPayload &&
        Array.isArray(interruptPayload) &&
        interruptPayload.length === 1 &&
        (typeof answerMap === "string" ||
          typeof answerMap === "number" ||
          typeof answerMap === "boolean")
      ) {
        resumePayload = { [interruptPayload[0].id]: answerMap };
      }

      // Optimistically update the tool call result in the history
      setHistory((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (
          lastMsg &&
          lastMsg.id.startsWith("temp-ai-interrupt-") &&
          lastMsg.toolCalls
        ) {
          const updatedToolCalls: Record<string, any> = {
            ...(lastMsg.toolCalls as Record<string, any>),
          };
          let changed = false;

          for (const [tcId, tcData] of Object.entries(updatedToolCalls)) {
            // Find if this tool call ID matches any key in our resumePayload
            // (Assuming tcId maps to the interrupt ID, or if there's only 1 we just apply it)
            if (resumePayload[tcId] !== undefined) {
              updatedToolCalls[tcId] = {
                ...(tcData as any),
                result: resumePayload[tcId],
              };
              changed = true;
            } else if (Object.keys(resumePayload).length === 1) {
              // Fallback: if there's only 1 tool call and 1 payload, assume they match
              const singleKey = Object.keys(resumePayload)[0];
              updatedToolCalls[tcId] = {
                ...(tcData as any),
                result: resumePayload[singleKey!],
              };
              changed = true;
            }
          }

          if (changed) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, toolCalls: updatedToolCalls },
            ];
          }
        }
        return prev;
      });

      setInterruptPayload(null);
      setStatus("streaming");
      setActiveRequest({ resume: resumePayload, timestamp: Date.now() });
    },
    [status, interruptPayload],
  );

  const stop = useCallback(() => {
    // 1. Explicitly notify the backend to abort the LangGraph run
    cancelChatMutation.mutate({ sessionId });

    // 2. Setting activeRequest to null immediately unsubscribes tRPC
    setActiveRequest(null);

    // Optimistically push the partial text to history to prevent UI flicker
    // before the backend has time to save it to PostgreSQL.
    if (
      streamedContent.trim().length > 0 ||
      streamedReasoning.trim().length > 0
    ) {
      const optimisticMsg: Message = {
        id: `temp-interrupt-${Date.now()}`,
        sessionId,
        role: "ASSISTANT",
        content: streamedContent,
        model: currentModel,
        mode: currentMode,
        status: "INTERRUPTED",
        duration: null,
        reasoning: streamedReasoning || null,
        reasoningDuration: null,
        reasoningEffort: reasoningEffort || null,
        toolCalls:
          Object.keys(activeToolCalls).length > 0
            ? (activeToolCalls as any)
            : null,
        toolCallId: null,
        createdAt: new Date().toISOString() as any,
      };
      setHistory((prev) => [...prev, optimisticMsg]);
    }

    // 3. Clear streaming state synchronously so we don't render 2 BotMsgs while refetching
    setStreamedContent("");
    setStreamedReasoning("");
    setActiveToolCalls({});
    setInterruptPayload(null);
    setStatus("idle");

    // 4. Refetch history from DB
    queryClient
      .invalidateQueries(
        trpc.session.getSession.queryOptions({ id: sessionId }),
      )
      .catch((e) => console.error("Failed to invalidate queries:", e));
  }, [
    sessionId,
    queryClient,
    trpc,
    streamedContent,
    streamedReasoning,
    activeToolCalls,
    cancelChatMutation,
    currentModel,
    currentMode,
    reasoningEffort,
  ]);

  const isLoading = status === "streaming" || status === "interrupted";

  return useMemo(
    () => ({
      history,
      streamedContent,
      streamedReasoning,
      activeToolCalls,
      interruptPayload,
      status,
      isLoading,
      sendMessage,
      submitInterrupt,
      stop,
    }),
    [
      history,
      streamedContent,
      streamedReasoning,
      activeToolCalls,
      interruptPayload,
      status,
      isLoading,
      sendMessage,
      submitInterrupt,
      stop,
    ],
  );
}
