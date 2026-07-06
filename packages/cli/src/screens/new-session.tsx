import { useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useRef } from "react";
import { UserMsg } from "../components/messages";
import SessionShell from "../components/session-shell";
import { z } from "zod";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/https-errors";
import { DEFAULT_CHAT_MODEL_ID } from "@wright/shared";
import { useToast } from "../providers/toast";
import { ToastVariant } from "../providers/toast/types";

const newSessionsStateSchema = z.object({
  message: z.string(),
});

const NewSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const hasStartedRef = useRef(false);
  const state = useMemo(() => {
    const parsed = newSessionsStateSchema.safeParse(location.state);
    if (!parsed.success) return null;
    return parsed.data;
  }, [location.state]);

  //   const [msgs, setMsgs] = useState([]);
  //   const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state)
      navigate("/", {
        replace: true,
      });
  }, [state, navigate]);

  useEffect(() => {
    if (!state || hasStartedRef.current) return;

    hasStartedRef.current = true;
    let ignore = false;

    const createSession = async () => {
      try {
        const res = await apiClient.sessions["create-session"].$post({
          json: {
            title: "New Message",
            cwd: process.cwd(),
            initialMessage: {
              content: state.message.slice(0, 100),
              model: DEFAULT_CHAT_MODEL_ID,
              mode: "BUILD",
              role: "USER",
            },
          },
        });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        const session = await res.json();
        // console.log(session);
        navigate(`/sessions/${session.id}`, {
          state: { session },
          replace: true,
        });
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: ToastVariant.ERROR,
          message:
            err instanceof Error ? err.message : "Failed to create session",
        });
        navigate(`/`, {
          replace: true,
        });
      }
    };

    createSession();
    return () => {
      ignore = true;
    };
  }, [navigate, state, toast]);

  if (!state?.message) return null;

  const handleSubmit = () => {};

  return (
    <SessionShell onSubmit={handleSubmit} inputDisabled loading>
      <UserMsg message={state.message} />
    </SessionShell>
  );
};

export default NewSession;
