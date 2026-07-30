import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { DEFAULT_CHAT_MODEL_ID, type SupportedChatModelId } from "@wright/shared";
import type { Mode } from "@wright/database/enums";

interface ProviderApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
}

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

interface PromptConfigContextValue {
  currentMode: Mode;
  currentModel: SupportedChatModelId;
  reasoningEffort: ReasoningEffort;
  providerApiKeys: ProviderApiKeys;
  setMode(mode: Mode): void;
  setModel(model: SupportedChatModelId): void;
  setReasoningEffort(effort: ReasoningEffort): void;
  setApiKeys(keys: Partial<ProviderApiKeys>): void;
  trustedWorkspaces: Record<string, boolean>;
  setTrustedWorkspace(path: string, trusted: boolean): void;
}

interface PromptPreferences {
  mode?: Mode;
  model?: SupportedChatModelId;
  reasoningEffort?: ReasoningEffort;
  providerApiKeys?: ProviderApiKeys;
  trustedWorkspaces?: Record<string, boolean>;
}

const PromptConfigContext = createContext<PromptConfigContextValue | null>(null);

const CONFIG_DIR = join(homedir(), ".wright");
const PREFERENCES_PATH = join(CONFIG_DIR, "prefs.json");

function getInitialConfig(): PromptPreferences {
  try {
    const preferences = JSON.parse(
      readFileSync(PREFERENCES_PATH, {
        encoding: "utf-8",
      }),
    ) as Partial<PromptPreferences>;

    return {
      mode: preferences.mode || "BUILD",
      model: preferences.model || DEFAULT_CHAT_MODEL_ID,
      reasoningEffort: (preferences.reasoningEffort as ReasoningEffort) || "high",
      providerApiKeys: preferences.providerApiKeys || {},
      trustedWorkspaces: preferences.trustedWorkspaces || {},
    };
  } catch (err: any) {
    return {
      mode: "BUILD",
      model: DEFAULT_CHAT_MODEL_ID,
      reasoningEffort: "high",
      providerApiKeys: {},
      trustedWorkspaces: {},
    };
  }
}

function persistConfig(config: PromptPreferences) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    
    // Read existing to merge, just in case
    let existing = {};
    try {
      existing = JSON.parse(readFileSync(PREFERENCES_PATH, { encoding: "utf-8" }));
    } catch (e) {}

    writeFileSync(
      PREFERENCES_PATH,
      JSON.stringify({ ...existing, ...config }, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
  } catch (err) {
    console.error("Failed to persist prompt configuration:", err);
  }
}

export default function PromptConfigProvider({
  children,
}: PropsWithChildren): ReactNode {
  const [initialConfig] = useState(() => getInitialConfig());
  const [currentMode, setCurrentMode] = useState<Mode>(initialConfig.mode as Mode);
  const [currentModel, setCurrentModel] = useState<SupportedChatModelId>(initialConfig.model as SupportedChatModelId);
  const [reasoningEffort, setCurrentReasoningEffort] = useState<ReasoningEffort>((initialConfig.reasoningEffort as ReasoningEffort) || "high");
  const [providerApiKeys, setCurrentApiKeys] = useState<ProviderApiKeys>(initialConfig.providerApiKeys || {});
  const [trustedWorkspaces, setTrustedWorkspaces] = useState<Record<string, boolean>>(initialConfig.trustedWorkspaces || {});

  const setMode = useCallback((mode: Mode) => {
    setCurrentMode(mode);
    persistConfig({ mode });
  }, []);

  const setModel = useCallback((model: SupportedChatModelId) => {
    setCurrentModel(model);
    persistConfig({ model });
  }, []);

  const setReasoningEffort = useCallback((effort: ReasoningEffort) => {
    setCurrentReasoningEffort(effort);
    persistConfig({ reasoningEffort: effort });
  }, []);

  const setApiKeys = useCallback((keys: Partial<ProviderApiKeys>) => {
    setCurrentApiKeys((prev) => {
      const next = { ...prev, ...keys };
      persistConfig({ providerApiKeys: next });
      return next;
    });
  }, []);

  const setTrustedWorkspace = useCallback((path: string, trusted: boolean) => {
    setTrustedWorkspaces((prev) => {
      const next = { ...prev, [path]: trusted };
      persistConfig({ trustedWorkspaces: next });
      return next;
    });
  }, []);

  const values = useMemo(
    () => ({ currentMode, setMode, currentModel, setModel, reasoningEffort, setReasoningEffort, providerApiKeys, setApiKeys, trustedWorkspaces, setTrustedWorkspace }),
    [currentMode, setMode, currentModel, setModel, reasoningEffort, setReasoningEffort, providerApiKeys, setApiKeys, trustedWorkspaces, setTrustedWorkspace],
  );
  return (
    <PromptConfigContext.Provider value={values}>{children}</PromptConfigContext.Provider>
  );
}

export const usePromptConfig = () => {
  const values = useContext(PromptConfigContext);
  if (!values) throw new Error("usePromptConfig Must be used within a PromptConfig Provider");
  return values;
};
