import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { Outlet } from "react-router";
import { TextAttributes } from "@opentui/core";
import KeyBoardProvider from "../providers/keyboard";
import DialogProvider from "../providers/dialog";
import ToastProvider from "../providers/toast";
import ThemedRoot from "./themed-root";
import PromptConfigProvider, {
  usePromptConfig,
} from "../providers/prompt-config";
import TrustWorkspaceScreen from "../screens/trust-workspace";
import McpProvider from "../providers/mcp";
import SkillsProvider from "../providers/skills";
import { AuthProvider, useAuth } from "../providers/auth-provider";
import { useDialog } from "../providers/dialog";
import { useToast } from "../providers/toast";
import { ToastVariant } from "../providers/toast/types";
import { LogoutDialog } from "../dialogs/logout-dialog";

function AuthEffects() {
  const { remoteLogout, authError, clearAuthError } = useAuth();
  const dialog = useDialog();
  const { show } = useToast();

  useEffect(() => {
    if (remoteLogout) {
      dialog.open({
        title: "Session Expired",
        children: <LogoutDialog />,
      });
    }
  }, [remoteLogout, dialog]);

  useEffect(() => {
    if (authError) {
      show({ variant: ToastVariant.ERROR, message: authError });
      clearAuthError();
    }
  }, [authError, show, clearAuthError]);

  return null;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to stderr to avoid corrupting the TUI
    process.stderr.write(
      `[Wright Error Boundary] ${error.message}\n${info.componentStack || ""}\n`,
    );
  }

  override render() {
    if (this.state.hasError) {
      return (
        <box flexDirection="column" padding={2}>
          <text attributes={TextAttributes.BOLD} fg="red">
            Something went wrong
          </text>
          <text fg="gray">{this.state.error?.message || "Unknown error"}</text>
        </box>
      );
    }
    return this.props.children;
  }
}

function InnerLayout() {
  const { trustedWorkspaces } = usePromptConfig();

  useEffect(() => {
    // Some shells (like Zsh) override the terminal title during preexec.
    // By setting it inside a React effect, we ensure it overrides the shell
    // AFTER OpenTUI has fully initialized the alternate screen buffer.
    process.stdout.write("\x1b]0;wright\x07");

    // A secondary timeout just in case the terminal emulator is slow to switch buffers
    const timer = setTimeout(() => {
      process.stdout.write("\x1b]0;wright\x07");
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!trustedWorkspaces[process.cwd()]) {
    return <TrustWorkspaceScreen />;
  }

  return (
    <KeyBoardProvider>
      <DialogProvider>
        <ToastProvider>
          <ErrorBoundary>
            <ThemedRoot>
              <SkillsProvider>
                <McpProvider>
                  <AuthProvider>
                    <AuthEffects />
                    <Outlet />
                  </AuthProvider>
                </McpProvider>
              </SkillsProvider>
            </ThemedRoot>
          </ErrorBoundary>
        </ToastProvider>
      </DialogProvider>
    </KeyBoardProvider>
  );
}

export default function RootLayout() {
  return <InnerLayout />;
}
