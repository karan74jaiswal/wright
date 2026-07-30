import { Component, type ErrorInfo, type ReactNode } from "react";
import { Outlet } from "react-router";
import { TextAttributes } from "@opentui/core";
import KeyBoardProvider from "../providers/keyboard";
import DialogProvider from "../providers/dialog";
import ToastProvider from "../providers/toast";
import ThemedRoot from "./themed-root";
import ThemeProvider from "../providers/theme";
import PromptConfigProvider, { usePromptConfig } from "../providers/prompt-config";
import TrustWorkspaceScreen from "../screens/trust-workspace";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
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

  if (!trustedWorkspaces[process.cwd()]) {
    return <TrustWorkspaceScreen />;
  }

  return (
    <KeyBoardProvider>
      <DialogProvider>
        <ToastProvider>
          <ErrorBoundary>
            <ThemedRoot>
              <Outlet />
            </ThemedRoot>
          </ErrorBoundary>
        </ToastProvider>
      </DialogProvider>
    </KeyBoardProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PromptConfigProvider>
        <InnerLayout />
      </PromptConfigProvider>
    </ThemeProvider>
  );
}
