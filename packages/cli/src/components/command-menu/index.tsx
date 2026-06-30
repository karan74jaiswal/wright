import { type RefObject } from "react";

import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";

import { getFilteredCommands } from "./filter-command";
import { COMMANDS } from "./commands";
import type { JSX } from "@opentui/react/jsx-runtime";
import { useTheme } from "../../providers/theme";

const MAX_VISIBLE_COMMANDS = 8;
const COMMAND_COLUMN_WIDTH =
  Math.max(...COMMANDS.map((cmd) => cmd.name.length)) + 4;

interface CommandMenuProps {
  query: string;
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
}

export default function CommandMenu({
  query,
  selectedIndex,
  scrollRef,
  onSelect,
  onExecute,
}: CommandMenuProps): JSX.Element {
  const { colors } = useTheme();
  const filteredCommands = getFilteredCommands(query);

  const commandMenuVisibleHeight = Math.min(
    filteredCommands.length,
    MAX_VISIBLE_COMMANDS,
  );

  if (!filteredCommands.length)
    return (
      <box paddingX={1}>
        <text attributes={TextAttributes.DIM}>No matching Commands</text>
      </box>
    );
  // console.log(selectedIndex);
  return (
    <scrollbox ref={scrollRef} height={commandMenuVisibleHeight}>
      {filteredCommands.map((cmd, index) => {
        const isSelected = index === selectedIndex;
        return (
          <box
            key={cmd.value}
            flexDirection="row"
            paddingX={1}
            height={1}
            overflow="hidden"
            backgroundColor={isSelected ? colors.selection : undefined}
            onMouseMove={() => onSelect(index)}
            onMouseDown={() => onExecute(index)}
          >
            <box width={COMMAND_COLUMN_WIDTH} flexShrink={0}>
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                /{cmd.name}
              </text>
            </box>
            <box flexShrink={0}>
              <text selectable={false} fg={isSelected ? "black" : "white"}>
                {cmd.description}
              </text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}
