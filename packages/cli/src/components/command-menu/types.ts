import type { DialogContextValue } from "../../providers/dialog";
import type { ToastContextValue } from "../../providers/toast";
import type { NavigateFunction } from "react-router";
import type { useAuth } from "../../providers/auth-provider";

export interface CommandContext {
  exit: () => void;
  toast: ToastContextValue;
  dialog: DialogContextValue;
  navigate: NavigateFunction;
  auth: ReturnType<typeof useAuth>;
}

export interface Command {
  name: string;
  description: string;
  value: string;
  authRequired?: boolean | "unauthenticatedOnly";
  action?: (ctx: CommandContext) => void | Promise<void>;
}
