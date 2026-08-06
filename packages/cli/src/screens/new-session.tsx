import { useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserMsg } from "../components/messages";
import SessionShell from "../components/session-shell";
import { z } from "zod";
import { useTRPC } from "../lib/api-client";
import { DEFAULT_CHAT_MODEL_ID } from "@wright/shared";
import { useToast } from "../providers/toast";
import { ToastVariant } from "../providers/toast/types";
import { usePromptConfig } from "../providers/prompt-config";
import { useSkills } from "../providers/skills";
import { useMcp } from "../providers/mcp";

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

  const { currentMode, currentModel, reasoningEffort, providerApiKeys } =
    usePromptConfig();

  const { skills: discoveredSkills, isLoading: isSkillsLoading } = useSkills();
  const { servers, isLoading: isMcpLoading } = useMcp();

  useEffect(() => {
    if (!state)
      navigate("/", {
        replace: true,
      });
  }, [state, navigate]);

  const trpc = useTRPC();
  const createSessionMutation = useMutation(
    trpc.session.createSession.mutationOptions(),
  );
  const syncConfigMutation = useMutation(
    trpc.session.syncSessionConfig.mutationOptions(),
  );

  useEffect(() => {
    if (!state || hasStartedRef.current || isSkillsLoading || isMcpLoading)
      return;
    hasStartedRef.current = true;

    createSessionMutation.mutate(
      {
        title: state.message.slice(0, 100),
        cwd: process.cwd(),
        initialMessage: {
          content: state.message,
          model: currentModel,
          mode: currentMode,
          role: "USER",
        },
      },
      {
        onSuccess: async (session) => {
          try {
            await syncConfigMutation.mutateAsync({
              sessionId: session.id,
              enabledSkills: Object.fromEntries(
                Array.from(discoveredSkills.entries()).map(([key, skill]) => [
                  key,
                  {
                    name: skill.name,
                    path: skill.skillFilePath,
                    description: skill.frontmatter.description || "No description provided.",
                  },
                ])
              ),
              enabledMcps: Object.fromEntries(
                Array.from(servers.entries()).map(([key, server]) => [
                  key,
                  {
                    name: server.name,
                    config: server.config,
                    source: server.source,
                    tools: server.tools || [],
                  },
                ])
              ),
            });
          } catch (e) {
            console.error("Failed to sync session config", e);
          }

          navigate(`/sessions/${session.id}`, {
            state: { session },
            replace: true,
          });
        },
        onError: (err) => {
          toast.show({
            variant: ToastVariant.ERROR,
            message: err.message || "Failed to create session",
          });
          navigate(`/`, {
            replace: true,
          });
        },
      },
    );
  }, [
    navigate,
    state,
    toast,
    createSessionMutation,
    syncConfigMutation,
    discoveredSkills,
    servers,
    currentModel,
    currentMode,
    reasoningEffort,
    isSkillsLoading,
    isMcpLoading,
    providerApiKeys,
  ]);

  if (!state?.message) return null;

  const handleSubmit = () => {};

  return (
    <SessionShell onSubmit={handleSubmit} inputDisabled loading>
      <UserMsg message={state.message} />
    </SessionShell>
  );
};

export default NewSession;
