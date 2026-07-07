import { useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useMemo } from "react";
import { useTheme } from "../providers/theme";
import SessionShell from "../components/session-shell";
import { z } from "zod";
import { UserMsg, BotMsg, ErrorMsg } from "../components/messages";
import { useToast } from "../providers/toast";
import { trpc } from "../lib/api-client";
import { ToastVariant } from "../providers/toast/types";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@wright/api-gateway";

type SessionData = inferRouterOutputs<AppRouter>["session"]["getSession"];

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (val) => val !== null && typeof val === "object" && "id" in val,
  ),
});

interface ChatMessageProps {
  msg: SessionData["messages"][number];
}

function ChatMessage({ msg }: ChatMessageProps) {
  if (msg.role === "USER") return <UserMsg message={msg.content} />;
  if (msg.role === "ERROR") return <ErrorMsg message={msg.content} />;
  return <BotMsg content={msg.content} model={msg.model} />;
}

const Session = () => {
  const { colors } = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    if (!parsed.success) return null;
    return parsed.data.session;
  }, [location.state]);

  const {
    data: rawSession,
    isError,
    error,
  } = trpc.session.getSession.useQuery(
    { id: id! },
    {
      initialData: prefetched || undefined,
      enabled: !!id,
      staleTime: Infinity,
    },
  );

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

  if (!session)
    return <SessionShell onSubmit={() => {}} inputDisabled loading />;

  return (
    <SessionShell onSubmit={() => {}} inputDisabled>
      {session.messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
    </SessionShell>
  );
};

export default Session;
