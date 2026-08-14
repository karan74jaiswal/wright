import type { Command, CommandContext } from "./types";

import { COMMANDS } from "./commands";

export const getFilteredCommands = (query: string, isAuthenticated: boolean): Command[] => {
  const visibleCommands = COMMANDS.filter((cmd) => {
    if (cmd.authRequired === true && !isAuthenticated) return false;
    if (cmd.authRequired === "unauthenticatedOnly" && isAuthenticated) return false;
    return true;
  });

  return query
    ? visibleCommands.filter((cmd) =>
        cmd.name.toLowerCase().startsWith(query.toLowerCase()),
      )
    : visibleCommands;
};
