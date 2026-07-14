import type { DialogContextValue } from "../../providers/dialog";
import type { ToastContextValue } from "../../providers/toast";
import type { NavigateFunction } from "react-router";

export interface CommandContext {
  exit: () => void;
  toast: ToastContextValue;
  dialog: DialogContextValue;
  navigate: NavigateFunction;
}

export interface Command {
  name: string;
  description: string;
  value: string;
  action?: (ctx: CommandContext) => void | Promise<void>;
}
