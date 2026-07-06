import { InputBar } from "../components/input-bar";
import { useLocation, useNavigate, useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../providers/theme";
import SessionShell from "../components/session-shell";
import { z } from "zod";
import { UserMsg, BotMsg, ErrorMsg } from "../components/messages";
import type { InferResponseType } from "hono";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/https-errors";
import { ToastVariant } from "../providers/toast/types";

type SessionData = InferResponseType<
  (typeof apiClient.sessions)[":id"]["$get"],
  200
>;

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

  const [session, setSession] = useState<SessionData | null>(prefetched);

  useEffect(() => {
    if (prefetched) return;
    setSession(null);

    if (!id) return;

    let ignore = false;

    async function getSession() {
      try {
        const res = await apiClient.sessions[":id"].$get({
          param: {
            id: id as string,
          },
        });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        setSession(await res.json());
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: ToastVariant.ERROR,
          message:
            err instanceof Error ? err.message : "Failed to load session",
        });
        navigate("/", { replace: true });
      }
    }

    getSession();
    return () => {
      ignore = true;
    };
  }, [id, navigate, prefetched, toast]);

  if (!session) return <SessionShell onSubmit={() => {}} inputDisabled />;

  return (
    <SessionShell onSubmit={() => {}} inputDisabled>
      {session.messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
    </SessionShell>
  );
};

export default Session;
