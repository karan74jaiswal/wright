import {
  type RefObject,
  useCallback,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";

import {
  TextAttributes,
  type ScrollBoxRenderable,
  type InputRenderable,
} from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../../providers/keyboard";
import type { JSX } from "@opentui/react/jsx-runtime";
import { useDialogSearchList } from "./use-dialog-search-list";
import { useTheme } from "../../providers/theme";

const MAX_VISIBLE_ITEMS = 6;

interface DialogSearchListProps<T> {
  items: T[];
  onSelect: (item: T) => void;
  onHighlight?: (item: T) => void;
  filterFn: (item: T, query: string) => boolean;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getKey: (item: T) => string;
  placeholder?: string;
  emptyText?: string;
}

export default function DialogSearchList<T>({
  items,
  onSelect,
  onHighlight,
  filterFn,
  renderItem,
  getKey,
  placeholder = "Search",
  emptyText = "No results",
}: DialogSearchListProps<T>): JSX.Element {
  const {
    selectedIndex,
    setSelectedIndex,
    filtered: filteredItems,
    scrollRef,
    inputRef,
    handleContentChange,
  } = useDialogSearchList({
    items,
    filterFn,
    onSelect,
    onHighlight,
  });

  const { colors } = useTheme();
  const visibleHeight = Math.min(filteredItems.length, MAX_VISIBLE_ITEMS);

  return (
    <box flexDirection="column" gap={1}>
      <input
        ref={inputRef}
        placeholder={placeholder}
        focused
        onContentChange={handleContentChange}
      />
      {!filteredItems.length ? (
        <text attributes={TextAttributes.DIM}>{emptyText}</text>
      ) : (
        <scrollbox ref={scrollRef} height={visibleHeight}>
          {filteredItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <box
                key={getKey(item)}
                flexDirection="row"
                // paddingX={1}
                height={1}
                overflow="hidden"
                backgroundColor={isSelected ? colors.selection : undefined}
                onMouseMove={() => {
                  setSelectedIndex(index);
                  onHighlight && onHighlight(item);
                }}
                onMouseDown={() => onSelect(item)}
              >
                {renderItem(item, isSelected)}
              </box>
            );
          })}
        </scrollbox>
      )}
    </box>
  );
}
