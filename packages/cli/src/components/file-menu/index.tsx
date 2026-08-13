import { type RefObject } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "@opentui/react/jsx-runtime";
import { useTheme } from "../../providers/theme";

const MAX_VISIBLE_FILES = 8;

interface FileMenuProps {
  query: string;
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  candidates: string[];
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
}

export default function FileMenu({
  query,
  selectedIndex,
  scrollRef,
  candidates,
  onSelect,
  onExecute,
}: FileMenuProps): JSX.Element {
  const { colors } = useTheme();

  const menuVisibleHeight = Math.min(candidates.length, MAX_VISIBLE_FILES);

  if (!candidates.length) {
    return (
      <box paddingX={1}>
        <text attributes={TextAttributes.DIM}>No matching files</text>
      </box>
    );
  }

  return (
    <scrollbox ref={scrollRef} height={menuVisibleHeight}>
      {candidates.map((path, index) => {
        const isSelected = index === selectedIndex;
        const isDirectory = path.endsWith("/");
        const icon = isDirectory ? "📁 " : "📄 ";
        
        return (
          <box
            key={path}
            flexDirection="row"
            paddingX={1}
            height={1}
            overflow="hidden"
            backgroundColor={isSelected ? colors.selection : undefined}
            onMouseMove={() => onSelect(index)}
            onMouseDown={() => onExecute(index)}
          >
            <box flexShrink={0}>
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                {icon}{path}
              </text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}
