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
import { usePromptConfig } from "../providers/prompt-config";
import { useNavigate } from "react-router";

import FileMenu from "./file-menu";
import { useFileMenu } from "./file-menu/use-file-menu";

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
  const navigate = useNavigate();
  const { isTopLayer, setResponder, push } = useKeyboardLayer();
  const { colors } = useTheme();
  const { currentMode } = usePromptConfig();
  const {
    showCommandMenu,
    commandQuery,
    selectedIndex: commandIndex,
    scrollRef: commandScrollRef,
    handleContentChange: handleCommandContentChange,
    resolveCommand,
    setSelectedIndex: setCommandIndex,
  } = useCommandMenu();

  const {
    showFileMenu,
    fileQuery,
    selectedIndex: fileIndex,
    scrollRef: fileScrollRef,
    candidates: fileCandidates,
    handleContentChange: handleFileContentChange,
    resolveFile,
    setSelectedIndex: setFileIndex,
    close: closeFileMenu,
  } = useFileMenu();

  const handleTextAreaContentChange = useCallback(() => {
    if (!textAreaRef.current) return;
    const text = textAreaRef.current.plainText;

    if (text === "!") {
      textAreaRef.current.setText("");
      push("shell");
      return;
    }

    handleCommandContentChange(text);
    handleFileContentChange(text);
  }, [handleCommandContentChange, handleFileContentChange, push]);

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
          navigate,
        });
      else {
        textAreaRef.current.insertText(`${cmd.value} `);
      }
    },
    [renderer, toast, dialog, navigate],
  );

  const handleCommandExecute = useCallback(
    (index: number) => {
      if (disabled) return;
      const command = resolveCommand(index);
      handleCommand(command);
    },
    [resolveCommand, handleCommand, disabled],
  );

  const handleFileExecute = useCallback(
    (index: number) => {
      if (disabled || !textAreaRef.current) return;
      const file = resolveFile(index);
      if (!file) return;

      const currentText = textAreaRef.current.plainText;
      const match = currentText.match(
        /(?:^|\s)@(?:"([^"]*)"?|([a-zA-Z0-9.\-_/]*))$/,
      );
      if (match) {
        // If it's a directory, don't append a space so they can keep typing inside it
        const isDir = file.endsWith("/");
        const suffix = isDir ? "" : " ";

        // Wrap in quotes if there are spaces. If it's a directory, leave quote open for continuation.
        const hasSpaces = file.includes(" ");
        const formattedFile = hasSpaces ? (isDir ? `"${file}` : `"${file}"`) : file;

        // Preserve the leading space if the match had one
        const prefix = match[0].match(/^\s/) ? match[0].charAt(0) : "";
        const newText =
          currentText.slice(0, currentText.length - match[0].length) +
          `${prefix}@${formattedFile}${suffix}`;

        textAreaRef.current.setText("");
        textAreaRef.current.insertText(newText);

        if (!isDir) {
          closeFileMenu();
        } else {
          // Ensure the file menu updates for the new directory
          handleFileContentChange(newText);
        }
      } else {
        closeFileMenu();
      }
    },
    [resolveFile, disabled, closeFileMenu],
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
      <box
        border={["left"]}
        customBorderChars={SplitBorder.customBorderChars}
        borderColor={currentMode === "PLAN" ? colors.planMode : colors.primary}
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
          {(showCommandMenu || showFileMenu) && (
            <box
              position="absolute"
              left={0}
              width="100%"
              bottom="100%"
              backgroundColor={colors.surface}
              zIndex={10}
            >
              {showCommandMenu && (
                <CommandMenu
                  query={commandQuery}
                  selectedIndex={commandIndex}
                  scrollRef={commandScrollRef}
                  onSelect={setCommandIndex}
                  onExecute={handleCommandExecute}
                />
              )}
              {showFileMenu && (
                <FileMenu
                  query={fileQuery}
                  selectedIndex={fileIndex}
                  scrollRef={fileScrollRef}
                  candidates={fileCandidates}
                  onSelect={setFileIndex}
                  onExecute={handleFileExecute}
                />
              )}
            </box>
          )}

          <textarea
            focused={
              !disabled &&
              (isTopLayer("base") ||
                isTopLayer("command") ||
                isTopLayer("mention"))
            }
            ref={textAreaRef}
            placeholder={`Ask anything... "Fix a bug in the database"`}
            onContentChange={handleTextAreaContentChange}
            onSubmit={() => {
              if (disabled) return;
              if (showCommandMenu) {
                const command = resolveCommand(commandIndex);
                handleCommand(command);
                return;
              }
              if (showFileMenu) {
                handleFileExecute(fileIndex);
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
