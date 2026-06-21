import type {
  TextareaRenderable,
  KeyBinding,
  SubmitEvent,
} from "@opentui/core";

import { useRenderer } from "@opentui/react";
import StatusBar from "./status-bar";

import { useRef, useCallback } from "react";
import CommandMenu from "./command-menu";
import { useCommandMenu } from "./command-menu/use-command-menu";
import type { Command } from "./command-menu/types";

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

const border = {
  topLeft: "",
  topRight: "",
  bottomLeft: "",
  bottomRight: "",
  horizontal: "",
  topT: "",
  bottomT: "",
  rightT: "",
  leftT: "",
  vertical: "┃",
  cross: "",
};

export function InputBar({ onSubmit, disabled = false }: InputBarProps) {
  const textAreaRef = useRef<TextareaRenderable>(null);
  const renderer = useRenderer();

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
  }, []);

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

      cmd.action
        ? cmd.action({
            exit: () => {
              renderer.destroy();
            },
          })
        : textAreaRef.current.insertText(`${cmd.value} `);
    },
    [renderer],
  );

  const handleCommandExecute = useCallback(
    (index: number) => {
      const command = resolveCommand(index);
      handleCommand(command);
    },
    [resolveCommand, handleCommand],
  );

  return (
    <box width="100%" alignItems="center" justifyContent="center">
      {/* <Commands /> */}
      <box
        border={["left"]}
        borderColor="#14B8A6"
        customBorderChars={border}
        width="100%"
      >
        <box
          position="relative"
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          backgroundColor="#1A1A24"
        >
          {showCommandMenu && (
            <box
              position="absolute"
              left={0}
              width="100%"
              bottom="100%"
              backgroundColor="#1A1A24"
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
            focused={!disabled}
            ref={textAreaRef}
            placeholder={`Ask anything... "Fix a bug in the database"`}
            backgroundColor="#1A1A24"
            textColor="#FFFFFF"
            cursorStyle={{
              cursor: "pointer",
              blinking: true,
              style: "block",
            }}
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
            cursorColor="#fff"
          />
          <text>{commandQuery}</text>
          <StatusBar />
        </box>
      </box>
    </box>
  );
}
