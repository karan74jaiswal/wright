import { useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../providers/theme";
import SessionShell from "../components/session-shell";
import { z } from "zod";
import { UserMsg, BotMsg, ErrorMsg } from "../components/messages";
import { useToast } from "../providers/toast";
import { useTRPC } from "../lib/api-client";
import { ToastVariant } from "../providers/toast/types";
import { useChat } from "../hooks/use-chat";
import { InterruptPrompt } from "../components/interrupt-prompt";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";
import { DEFAULT_CHAT_MODEL_ID } from "@wright/shared";

type SessionData = inferRouterOutputs<AppRouter>["session"]["getSession"];

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (val) => val !== null && typeof val === "object" && "id" in val,
  ),
});

interface ChatMessageProps {
  msg: SessionData["messages"][number];
}

const ChatMessage = memo(function ChatMessage({ msg }: ChatMessageProps) {
  if (msg.role === "USER") return <UserMsg message={msg.content} />;
  if (msg.role === "ERROR") return <ErrorMsg message={msg.content} />;
  if (msg.role === "TOOL") return null;
  if (msg.role === "SYSTEM") return null;

  let parsedToolCalls: Record<string, any> | undefined = undefined;
  if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
    parsedToolCalls = msg.toolCalls.reduce((acc: any, tc: any, i) => {
      acc[tc.id || String(i)] = { name: tc.name, args: tc.args, result: true };
      return acc;
    }, {});
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
      toolCalls={parsedToolCalls}
    />
  );
});

const SessionInner = ({ id }: { id: string }) => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    if (!parsed.success) return null;
    return parsed.data.session;
  }, [location.state]);

  const trpc = useTRPC();
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
    initialMessages: session?.messages || [],
  });

  if (!session)
    return <SessionShell onSubmit={(_t) => {}} inputDisabled loading />;

  return (
    <SessionShell
      onSubmit={sendMessage}
      onCancel={stop}
      inputDisabled={isLoading}
      loading={isLoading}
    >
      {[
        ...history.map((msg) => (
          <box
            key={msg.id}
            flexDirection="column"
            width="100%"
            paddingBottom={1}
          >
            <ChatMessage msg={msg} />
          </box>
        )),
        status === "streaming" ||
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
              model={DEFAULT_CHAT_MODEL_ID}
              reasoning={streamedReasoning}
              toolCalls={activeToolCalls}
              streaming={status === "streaming"}
            />
          </box>
        ) : null,
        status === "interrupted" && interruptPayload ? (
          <box key="interrupt" flexDirection="column" width="100%">
            <InterruptPrompt
              payload={interruptPayload}
              onSubmit={submitInterrupt}
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
