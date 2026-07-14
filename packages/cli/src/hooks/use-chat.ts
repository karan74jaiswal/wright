import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../lib/api-client";
import { useToast } from "../providers/toast";
import { ToastVariant } from "../providers/toast/types";
import { DEFAULT_CHAT_MODEL_ID } from "@wright/shared";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";

type SessionData = inferRouterOutputs<AppRouter>["session"]["getSession"];
type Message = SessionData["messages"][number];

export type ChatStatus = "idle" | "streaming" | "interrupted" | "error";

export interface UseChatOptions {
  sessionId: string;
  initialMessages: Message[];
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
  initialMessages,
}: UseChatOptions): UseChatReturn {
  const toast = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Data State
  const [history, setHistory] = useState<Message[]>(initialMessages);
  const [streamedContent, setStreamedContent] = useState("");
  const [streamedReasoning, setStreamedReasoning] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<
    Record<string, { name: string; args: string; result?: any }>
  >({});
  const [interruptPayload, setInterruptPayload] = useState<any | null>(null);

  // UI State
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [activeRequest, setActiveRequest] = useState<{
    message?: string;
    resume?: any;
    isAutoResume?: boolean;
  } | null>(null);

  const hasAutoResumedRef = useRef(false);

  // Sync incoming database history (e.g. from invalidations)
  useEffect(() => {
    setHistory(initialMessages);
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
        model: DEFAULT_CHAT_MODEL_ID,
        mode: "BUILD",
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
            setActiveToolCalls((prev) => ({
              ...prev,
              [event.toolCallId]: {
                name: event.toolName,
                args: (prev[event.toolCallId]?.args || "") + event.args,
              },
            }));
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
          } else if (event.type === "done") {
            queryClient
              .invalidateQueries(
                trpc.session.getSession.queryOptions({ id: sessionId }),
              )
              .then(() => {
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
              .then(() => {
                setActiveRequest(null);
                setStreamedContent("");
                setStreamedReasoning("");
                setActiveToolCalls({});
                setStatus("error");
              });
          }
        },
        onError(err) {
          setActiveRequest(null);
          setStreamedContent("");
          setStreamedReasoning("");
          setActiveToolCalls({});
          setStatus("error");
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
        model: DEFAULT_CHAT_MODEL_ID,
        mode: "BUILD",
        status: "COMPLETED",
        duration: null,
        toolCalls: null,
        toolCallId: null,
        createdAt: new Date().toISOString() as any, // Trpc decodes it properly, but types might expect string depending on trpc config
      };

      setHistory((prev) => [...prev, optimisticMsg]);
      setStatus("streaming");
      hasAutoResumedRef.current = true; // Prevent any auto-resume collisions
      setActiveRequest({ message: text, isAutoResume: false });
    },
    [sessionId, status],
  );

  const submitInterrupt = useCallback(
    (answer: string) => {
      if (status !== "interrupted") return;

      setInterruptPayload(null);
      setStatus("streaming");
      setActiveRequest({ resume: answer });
    },
    [status],
  );

  const stop = useCallback(() => {
    // Setting activeRequest to null immediately unsubscribes tRPC
    setActiveRequest(null);
    queryClient
      .invalidateQueries(
        trpc.session.getSession.queryOptions({ id: sessionId }),
      )
      .then(() => {
        setStreamedContent("");
        setStreamedReasoning("");
        setActiveToolCalls({});
        setInterruptPayload(null);
        setStatus("idle");
      });
  }, [sessionId, queryClient, trpc]);

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
    ]
  );
}
