import type { Command, CommandContext } from "./types";

import { COMMANDS } from "./commands";

export const getFilteredCommands = (query: string): Command[] =>
  query
    ? COMMANDS.filter((cmd) =>
        cmd.name.toLowerCase().startsWith(query.toLowerCase()),
      )
    : COMMANDS;
