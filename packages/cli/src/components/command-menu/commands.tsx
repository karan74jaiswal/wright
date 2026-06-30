import { ThemeDialog } from "../../dialogs";
import { ToastVariant } from "../../providers/toast/types";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => ctx.toast.show({ message: "Starting a new Conversation" }),
  },

  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action: (ctx) => {
      ctx.toast.show({
        message: "Switching Agents",
      });

      ctx.dialog.open({
        title: "Select Mode",
        children: <text>Agent Selection Coming Soon...</text>,
      });
    },
  },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action: (ctx) => {
      ctx.toast.show({ message: "Selecting Model..." });
      ctx.dialog.open({
        children: <text>Model Selection coming soon...</text>,
        title: "Select Models",
      });
    },
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.toast.show({
        message: "Loading Sessions...",
      });
      ctx.dialog.open({
        title: "Select Mode",
        children: <text>Sessions Selection Coming Soon...</text>,
      });
    },
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",

    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Theme",
        children: <ThemeDialog />,
      });
    },
  },
  {
    name: "login",
    description: "Sign in with your browser",
    value: "/login",
    action: (ctx) =>
      ctx.toast.show({
        message: "Opening Browser to sign in...",
      }),
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
    action: (ctx) =>
      ctx.toast.show({ message: "Signed Out", variant: ToastVariant.SUCCESS }),
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
    action: (ctx) =>
      ctx.toast.show({
        message: "Opening Credits Checkout",
      }),
  },
  {
    name: "usage",
    description: "Open billing portal in your browser",
    value: "/usage",
    action: (ctx) => {
      ctx.toast.show({
        message: "Opening Billing portal",
      });
      ctx.dialog.open({
        title: "Usage",
        children: <text>Usage Monitoring coming soon...</text>,
      });
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => ctx.exit(),
  },
];
