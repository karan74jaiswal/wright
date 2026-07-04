import {
  InputRenderable,
  type KeyEvent,
  type ScrollBoxRenderable,
} from "@opentui/core";
import { useCallback, useRef, useState, type RefObject } from "react";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard";

export interface useDialogSearchListReturn<T> {
  selectedIndex: number;
  handleContentChange: () => void;
  inputRef: RefObject<InputRenderable | null>;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  filtered: T[];
  setSelectedIndex: (index: number) => void;
}

export interface dialogSearchListArgs<T> {
  filterFn: (item: T, query: string) => boolean;
  items: T[];
  onSelect: (item: T) => void;
  onHighlight?: (item: T) => void;
}

export function useDialogSearchList<T>({
  items,
  filterFn,
  onSelect,
  onHighlight,
}: dialogSearchListArgs<T>): useDialogSearchListReturn<T> {
  // 1. Initial values declaration
  const [searchValue, setSearchvalue] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<InputRenderable>(null);
  const scrollRef = useRef<ScrollBoxRenderable>(null);
  const { isTopLayer } = useKeyboardLayer();

  const filtered = searchValue
    ? items.filter((item) => filterFn(item, searchValue))
    : items;

  const handleContentChange = useCallback(() => {
    const text = inputRef.current?.value ?? "";
    setSearchvalue(text);
    setSelectedIndex(0);
    if (scrollRef.current) scrollRef.current.scrollTo(0);
  }, []);

  useKeyboard((key: KeyEvent) => {
    if (!isTopLayer("dialog")) return;
    if (key.name === "enter" || key.name === "return") {
      const item = filtered[selectedIndex];
      if (item) onSelect(item);
    }

    if (key.name === "down") {
      const newIndex =
        filtered.length === 0
          ? 0
          : Math.min(filtered.length - 1, selectedIndex + 1);
      setSelectedIndex(newIndex);
      if (scrollRef.current) {
        const visibleEnd =
          scrollRef.current.scrollTop + scrollRef.current.viewport.height - 1;
        if (newIndex > visibleEnd)
          scrollRef.current.scrollTo(
            newIndex - scrollRef.current.viewport.height + 1,
          );
      }
      if (filtered[newIndex]) onHighlight?.(filtered[newIndex]);
    }

    if (key.name === "up") {
      const newIndex = Math.max(0, selectedIndex - 1);
      setSelectedIndex(newIndex);

      if (scrollRef.current && newIndex < scrollRef.current.scrollTop)
        scrollRef.current.scrollTo(newIndex);
      const item = filtered[newIndex];
      if (item && onHighlight) onHighlight(item);
    }
  });
  return {
    selectedIndex,
    inputRef,
    scrollRef,
    filtered,
    handleContentChange,
    setSelectedIndex,
  };
}
