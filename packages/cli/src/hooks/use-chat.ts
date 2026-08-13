import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as fs from "fs";

const logDebug = (msg: string) => {
  if (process.env.WRIGHT_DEBUG !== "true") return;
  try {
    fs.appendFileSync(
      "use-chat-debug.log",
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch (e) {}
};
import { useSubscription } from "@trpc/tanstack-react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { executeClientTool } from "../lib/engine";

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
  executeCommand: (cmd: string) => Promise<void>;
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
  type ActiveRequestType = {
    message?: string;
    resume?: any;
    activeCwd?: string;
    isAutoResume?: boolean;
    timestamp?: number;
    jobId?: string;
  };
  const [activeRequestState, setActiveRequestState] =
    useState<ActiveRequestType | null>(null);
  const activeRequestRef = useRef(activeRequestState);
  const setActiveRequest = useCallback(
    (
      valOrUpdater:
        | ActiveRequestType
        | null
        | ((prev: ActiveRequestType | null) => ActiveRequestType | null),
    ) => {
      const nextVal =
        typeof valOrUpdater === "function"
          ? valOrUpdater(activeRequestRef.current)
          : valOrUpdater;
      activeRequestRef.current = nextVal;
      setActiveRequestState(nextVal);
    },
    [],
  );
  const activeRequest = activeRequestState;

  const hasAutoResumedRef = useRef(false);
  const retryCountsRef = useRef<Record<string, number>>({});

  const cancelChatMutation = useMutation(
    trpc.chat.cancelChat.mutationOptions(),
  );

  const submitChatJobMutation = useMutation({
    ...trpc.chat.submitChatJob.mutationOptions(),
    onError: (err, variables) => {
      if (
        (err.message === "CACHE_MISS_RESYNC_REQUIRED" ||
          err.message === "SESSION_CONFIG_NOT_SYNCED") &&
        forceSync
      ) {
        const jId = variables.jobId || "unknown";
        const retries = retryCountsRef.current[jId] || 0;
        if (retries >= 1) {
          console.error("Max retries reached for job", jId);
          toast.show({
            variant: ToastVariant.ERROR,
            message: "Backend synchronization failed. Please restart the CLI.",
          });
          setStatus("error");
          return;
        }
        retryCountsRef.current[jId] = retries + 1;

        console.log("[useChat] Cache miss in backend, forcing tools resync...");
        forceSync()
          .then(() => {
            // Retry the mutation with the exact same variables
            setTimeout(() => {
              submitChatJobMutation.mutate(variables);
            }, 0);
          })
          .catch((syncErr) => {
            console.error("Failed to resync tools:", syncErr);
            setStatus("error");
          });
        return;
      }

      console.error("Mutation Error:", err);
      toast.show({
        variant: ToastVariant.ERROR,
        message: err.message || "Failed to submit chat job",
      });
      setStatus("error");
    },
  });

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

  useEffect(() => {
    if (process.env.WRIGHT_DEBUG !== "true") return;
    try {
      fs.writeFileSync("use-chat-debug.log", "");
      logDebug(`--- Session Started / Switched: ${sessionId} ---`);
    } catch (e) {}
  }, [sessionId]);

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
      const merged = [...initialMessages, ...optimisticMessages];
      merged.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
      return merged;
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
        const newJobId = globalThis.crypto.randomUUID();
        logDebug(`[auto-resume] Starting new job: ${newJobId}`);
        
        const mentions: string[] = [];
        const mentionRegex = /(?:^|\s)@(?:(?:"([^"]+)")|([a-zA-Z0-9.\-_/]+))/g;
        const matches = Array.from(lastMsg.content.matchAll(mentionRegex));
        if (matches.length > 0) {
          for (const match of matches) {
            if (match[1]) mentions.push(match[1]);
            else if (match[2]) mentions.push(match[2]);
          }
        }

        setActiveRequest({
          message: lastMsg.content,
          activeCwd: process.cwd(),
          isAutoResume: true,
          jobId: newJobId,
          timestamp: Date.now(),
        });
        submitChatJobMutation.mutate({
          jobId: newJobId,
          sessionId,
          message: lastMsg.content,
          mentions,
          activeCwd: process.cwd(),
          isAutoResume: true,
          toolsHash,
          model: currentModel,
          mode: currentMode,
          reasoningEffort,
        });
      }
    }
  }, [history, status, sessionId, toolsHash]);

  // The Streaming Subscription
  const streamSub = useSubscription(
    trpc.chat.streamChat.subscriptionOptions(
      {
        sessionId,
        jobId: activeRequest?.jobId || "",
      },
      // eslint-disable-next-line react-hooks/refs
      {
        enabled: !!activeRequest && !!sessionId,
        onData(event) {
          logDebug(
            `[onData] Event: ${event.type} | JobId: ${event.jobId} | activeReq: ${activeRequestRef.current?.jobId}`,
          );
          // console.log(
          //   `[use-chat] Received event: ${event.type} (jobId: ${event.jobId}, activeRequest: ${activeRequestRef.current?.jobId})`,
          // );

          if (
            activeRequestRef.current?.jobId &&
            event.jobId &&
            activeRequestRef.current.jobId !== event.jobId
          ) {
            logDebug(
              `[onData] Ignoring event ${event.type} because jobId ${event.jobId} !== ${activeRequestRef.current.jobId}`,
            );
            return;
          }

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
                status: "INTERRUPTED",
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
            if (
              activeRequestRef.current?.jobId &&
              event.jobId &&
              activeRequestRef.current.jobId !== event.jobId
            )
              return;
            queryClient
              .invalidateQueries(
                trpc.session.getSession.queryOptions({ id: sessionId }),
              )
              .catch((e) => console.error("Failed to invalidate queries:", e))
              .finally(() => {
                logDebug(`[done.finally] Executing for jobId: ${event.jobId}`);
                if (
                  activeRequestRef.current?.jobId &&
                  event.jobId &&
                  activeRequestRef.current.jobId !== event.jobId
                ) {
                  logDebug(
                    `[done.finally] Bailing out because activeReq ${activeRequestRef.current.jobId} !== event ${event.jobId}`,
                  );
                  return;
                }
                logDebug(
                  `[done.finally] Setting status to idle and activeRequest to null`,
                );
                setActiveRequest(null);
                setStreamedContent("");
                setStreamedReasoning("");
                setActiveToolCalls({});
                setStatus("idle");
              });
          } else if (event.type === "error") {
            if (
              activeRequestRef.current?.jobId &&
              event.jobId &&
              activeRequestRef.current.jobId !== event.jobId
            )
              return;
            queryClient
              .invalidateQueries(
                trpc.session.getSession.queryOptions({ id: sessionId }),
              )
              .catch((e) => console.error("Failed to invalidate queries:", e))
              .finally(() => {
                logDebug(`[error.finally] Executing for jobId: ${event.jobId}`);
                if (
                  activeRequestRef.current?.jobId &&
                  event.jobId &&
                  activeRequestRef.current.jobId !== event.jobId
                ) {
                  logDebug(
                    `[error.finally] Bailing out because activeReq ${activeRequestRef.current.jobId} !== event ${event.jobId}`,
                  );
                  return;
                }
                logDebug(
                  `[error.finally] Setting status to error and activeRequest to null`,
                );
                setActiveRequest(null);
                setStreamedContent("");
                setStreamedReasoning("");
                setActiveToolCalls({});
                setStatus("error");
              });
          }
        },
        onError(err) {
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

      // Extract file mentions as an array of paths
      const mentions: string[] = [];
      const mentionRegex = /(?:^|\s)@(?:(?:"([^"]+)")|([a-zA-Z0-9.\-_/]+))/g;
      const matches = Array.from(text.matchAll(mentionRegex));

      if (matches.length > 0) {
        for (const match of matches) {
          if (match[1])
            mentions.push(match[1]); // Quoted mention
          else if (match[2]) mentions.push(match[2]); // Unquoted mention
        }
      }

      // Optimistically append the user's un-augmented message so it renders cleanly in UI
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
      const newJobId = globalThis.crypto.randomUUID();
      logDebug(`[sendMessage] Starting new job: ${newJobId}`);
      const newReq = {
        message: text,
        mentions,
        activeCwd: process.cwd(),
        isAutoResume: false,
        timestamp: Date.now(),
        jobId: newJobId,
      };
      setActiveRequest(newReq);
      activeRequestRef.current = newReq;

      submitChatJobMutation.mutate({
        jobId: newJobId,
        sessionId,
        message: text,
        mentions,
        activeCwd: process.cwd(),
        isAutoResume: false,
        toolsHash,
        model: currentModel,
        mode: currentMode,
        reasoningEffort,
      });
    },
    [sessionId, status, currentModel, currentMode, toolsHash],
  );

  const executeCommand = useCallback(
    async (cmd: string) => {
      // Optimistically add command to UI
      const cmdId = `temp-cmd-${Date.now()}`;
      setHistory((prev) => [
        ...prev,
        {
          id: cmdId,
          sessionId,
          role: "USER",
          content: `${cmd}`,
          model: currentModel,
          mode: currentMode,
          status: "COMPLETED",
          duration: null,
          reasoning: null,
          reasoningDuration: null,
          reasoningEffort: null,
          toolCalls: null,
          toolCallId: null,
          createdAt: new Date().toISOString() as any,
        },
      ]);

      try {
        const output = await executeClientTool(
          "run_command",
          { command: cmd },
          process.cwd(),
        );
        setHistory((prev) => [
          ...prev,
          {
            id: `temp-cmd-res-${Date.now()}`,
            sessionId,
            role: "ASSISTANT",
            content: output,
            model: currentModel,
            mode: currentMode,
            status: "COMPLETED",
            duration: null,
            reasoning: null,
            reasoningDuration: null,
            reasoningEffort: null,
            toolCalls: null,
            toolCallId: null,
            createdAt: new Date().toISOString() as any,
          },
        ]);
      } catch (err: any) {
        setHistory((prev) => [
          ...prev,
          {
            id: `temp-cmd-err-${Date.now()}`,
            sessionId,
            role: "ERROR",
            content: String(err.message || err),
            model: currentModel,
            mode: currentMode,
            status: "COMPLETED",
            duration: null,
            reasoning: null,
            reasoningDuration: null,
            reasoningEffort: null,
            toolCalls: null,
            toolCallId: null,
            createdAt: new Date().toISOString() as any,
          },
        ]);
      }
    },
    [sessionId, currentModel, currentMode],
  );

  const submitInterrupt = useCallback(
    (answerMap: Record<string, any> | any) => {
      // console.log(`[use-chat] submitInterrupt called with status=${status}`);
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
      
      let lastUserContent = "";
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg && msg.role === "USER") {
          lastUserContent = msg.content;
          break;
        }
      }
      const mentions: string[] = [];
      if (lastUserContent) {
        const mentionRegex = /(?:^|\s)@(?:(?:"([^"]+)")|([a-zA-Z0-9.\-_/]+))/g;
        const matches = Array.from(lastUserContent.matchAll(mentionRegex));
        if (matches.length > 0) {
          for (const match of matches) {
            if (match[1]) mentions.push(match[1]);
            else if (match[2]) mentions.push(match[2]);
          }
        }
      }
      
      const newJobId = globalThis.crypto.randomUUID();
      logDebug(`[submitInterrupt] Starting new job: ${newJobId}`);
      const newReq = {
        resume: resumePayload,
        timestamp: Date.now(),
        jobId: newJobId,
      };
      setActiveRequest(newReq);
      activeRequestRef.current = newReq;

      submitChatJobMutation.mutate({
        jobId: newJobId,
        sessionId,
        resume: resumePayload,
        mentions,
        toolsHash,
        model: currentModel,
        mode: currentMode,
        reasoningEffort,
      });
    },
    [status, interruptPayload, sessionId, toolsHash],
  );

  const stop = useCallback(() => {
    // 1. Explicitly notify the backend to abort the LangGraph run
    cancelChatMutation.mutate({
      sessionId,
      jobId: activeRequestRef.current?.jobId || "",
    });

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
      executeCommand,
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
      executeCommand,
      submitInterrupt,
      stop,
    ],
  );
}
