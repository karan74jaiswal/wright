import { type PropsWithChildren, useCallback } from "react";

import { InputBar } from "./input-bar";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";

import Spinner from "./spinner";
import { useKeyboardLayer } from "../providers/keyboard";
import { usePromptConfig } from "../providers/prompt-config";

export interface SessionShellProps extends PropsWithChildren {
  onSubmit(text: string): void;
  onCancel?(): void;
  inputDisabled?: boolean;
  loading?: boolean;
}

const SessionShell = ({
  children,
  onSubmit,
  onCancel,
  inputDisabled = false,
  loading = false,
}: SessionShellProps) => {
  const { isTopLayer } = useKeyboardLayer();
  const { currentMode, setMode } = usePromptConfig();

  useKeyboard(
    useCallback((key: any) => {
      if (!isTopLayer("base")) return;
      
      if (key.name == "escape" && loading && onCancel) {
        onCancel();
      }
      
      if (key.name == "tab" && !loading && !inputDisabled) {
        setMode(currentMode === "BUILD" ? "PLAN" : "BUILD");
      }
    }, [isTopLayer, loading, onCancel, inputDisabled, setMode, currentMode])
  );

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      width="100%"
      height="100%"
      gap={1}
      paddingX={2}
      paddingY={1}
    >
      <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
        <box gap={1}>{children}</box>
      </scrollbox>
      <box flexShrink={0}>
        <InputBar onSubmit={onSubmit} disabled={inputDisabled} />
      </box>
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        width="100%"
        height={1}
        gap={2}
        paddingLeft={1}
      >
        <box flexDirection="row" gap={2} alignItems="center">
          {loading ? (
            <>
              <Spinner />
              <text>esc to interrupt</text>
            </>
          ) : null}
        </box>
        <box flexDirection="row" gap={1} flexShrink={0} marginLeft="auto">
          <text>tab</text>
          <text attributes={TextAttributes.DIM}>agents</text>
        </box>
      </box>
    </box>
  );
};

export default SessionShell;
