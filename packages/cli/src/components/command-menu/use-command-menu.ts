import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core";
import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { getFilteredCommands } from "./filter-command";
import type { Command } from "./types";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard";

export interface UseCommandMenuReturn {
  showCommandMenu: boolean;
  commandQuery: string;
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  handleContentChange: (text: string) => void;
  resolveCommand: (index: number) => Command | undefined;
  setSelectedIndex: (index: number) => void;
}

export function useCommandMenu(): UseCommandMenuReturn {
  // 1. Initial values declaration
  const [textValue, setTextvalue] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showCommandMenu, setShowCommandMenu] = useState<boolean>(false);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const { push, pop, isTopLayer } = useKeyboardLayer();

  const commandQuery =
    showCommandMenu && textValue.startsWith("/") ? textValue.slice(1) : "";

  const close = useCallback(() => {
    setShowCommandMenu(false);
    pop("command");
  }, [pop]);

  const filteredCommands = useMemo(
    () => getFilteredCommands(commandQuery),
    [commandQuery],
  );

  const handleContentChange = (text: string) => {
    setTextvalue(text);
    setSelectedIndex(0);

    scrollRef.current && scrollRef.current.scrollTo(0);

    const prefix = text.startsWith("/") ? text.slice(1) : null;

    if (prefix !== null && !prefix.includes(" ")) {
      setShowCommandMenu(true);
      push("command", () => {
        close();
        return true;
      });
    } else close();
  };

  const resolveCommand = function (index: number): Command | undefined {
    const cmd = filteredCommands[index];
    if (cmd) close();
    return cmd;
    // cmd?.action && cmd?.action({ exit: () => {} });
  };
  // console.log(selectedIndex);
  useKeyboard((e: KeyEvent) => {
    if (!showCommandMenu || !isTopLayer("command")) return;
    // e.preventDefault();

    if (e.name === "escape") close();

    if (e.name === "down") {
      // console.log("down pressed");
      // console.log(selectedIndex);
      setSelectedIndex((i) => {
        if (filteredCommands.length === 0) return 0;
        const newIndex = Math.min(filteredCommands.length - 1, i + 1);
        if (scrollRef.current) {
          const visibleEnd =
            scrollRef.current.scrollTop + scrollRef.current.viewport.height - 1;
          if (newIndex > visibleEnd)
            scrollRef.current.scrollTo(
              newIndex - scrollRef.current.viewport.height + 1,
            );
        }
        return newIndex;
      });
    }
    if (e.name === "up") {
      setSelectedIndex((i) => {
        const newIndex = Math.max(0, i - 1);
        scrollRef.current &&
          newIndex < scrollRef.current.scrollTop &&
          scrollRef.current.scrollTo(newIndex);

        return newIndex;
      });
    }
  });
  return {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  };
}
