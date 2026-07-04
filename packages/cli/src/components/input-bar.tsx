import type { TextareaRenderable, KeyBinding } from "@opentui/core";

import { useRenderer } from "@opentui/react";
import StatusBar from "./status-bar";

import { useRef, useCallback, useEffect } from "react";
import CommandMenu from "./command-menu";
import { useCommandMenu } from "./command-menu/use-command-menu";
import type { Command } from "./command-menu/types";
import { useToast } from "../providers/toast";
import { SplitBorder } from "./border";
import { useKeyboardLayer } from "../providers/keyboard";
import { useDialog } from "../providers/dialog";

import { useTheme } from "../providers/theme";

interface InputBarProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  {
    name: "return",
    action: "submit",
  },
  {
    name: "enter",
    action: "submit",
  },
  {
    name: "return",
    action: "newline",
    shift: true,
  },
  {
    name: "enter",
    action: "newline",
    shift: true,
  },
];

export function InputBar({ onSubmit, disabled = false }: InputBarProps) {
  const textAreaRef = useRef<TextareaRenderable>(null);
  const renderer = useRenderer();
  const toast = useToast();
  const dialog = useDialog();
  const { isTopLayer, setResponder } = useKeyboardLayer();
  const { colors } = useTheme();
  const {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  } = useCommandMenu();

  const handleTextAreaContentChange = useCallback(() => {
    if (!textAreaRef.current) return;

    handleContentChange(textAreaRef.current.plainText);
  }, [handleContentChange]);

  const handleSubmit = useCallback(() => {
    if (disabled || !textAreaRef.current) return;
    const userInput = textAreaRef.current?.plainText.trim();
    if (!userInput.length) return;

    onSubmit(userInput);
    textAreaRef.current.setText("");
  }, [disabled, onSubmit]);

  const handleCommand = useCallback(
    (cmd: Command | undefined) => {
      if (!textAreaRef.current || !cmd) return;
      textAreaRef.current.setText("");

      if (cmd.action)
        cmd.action({
          exit: () => renderer.destroy(),
          toast,
          dialog,
        });
      else {
        textAreaRef.current.insertText(`${cmd.value} `);
      }
    },
    [renderer, toast, dialog],
  );

  const handleCommandExecute = useCallback(
    (index: number) => {
      if (disabled) return;
      const command = resolveCommand(index);
      handleCommand(command);
    },
    [resolveCommand, handleCommand, disabled],
  );

  useEffect(() => {
    setResponder("base", () => {
      if (disabled) return false;
      const textArea = textAreaRef.current;
      if (textArea && textArea.plainText.length) {
        textArea.setText("");
        return true;
      }
      return false;
    });

    return () => setResponder("base", null);
  }, [disabled, setResponder]);

  return (
    <box width="100%" alignItems="center" justifyContent="center">
      {/* <Commands /> */}
      <box
        border={["left"]}
        customBorderChars={SplitBorder.customBorderChars}
        borderColor={colors.primary}
        width="100%"
      >
        <box
          position="relative"
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          gap={1}
          backgroundColor={colors.surface}
        >
          {showCommandMenu && (
            <box
              position="absolute"
              left={0}
              width="100%"
              bottom="100%"
              backgroundColor={colors.surface}
              zIndex={10}
            >
              <CommandMenu
                query={commandQuery}
                selectedIndex={selectedIndex}
                scrollRef={scrollRef}
                onSelect={setSelectedIndex}
                onExecute={handleCommandExecute}
              />
            </box>
          )}

          <textarea
            focused={!disabled && (isTopLayer("base") || isTopLayer("command"))}
            ref={textAreaRef}
            placeholder={`Ask anything... "Fix a bug in the database"`}
            onContentChange={handleTextAreaContentChange}
            onSubmit={() => {
              if (disabled) return;
              if (showCommandMenu) {
                const command = resolveCommand(selectedIndex);
                handleCommand(command);
                return;
              }
              handleSubmit();
            }}
            keyBindings={TEXTAREA_KEY_BINDINGS}
          />
          <StatusBar />
        </box>
      </box>
    </box>
  );
}
