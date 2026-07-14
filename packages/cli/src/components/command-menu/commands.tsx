import { ThemeDialog, SessionsDialog } from "../../dialogs";
import { ToastVariant } from "../../providers/toast/types";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.toast.show({ message: "Starting a new Conversation" });
      ctx.navigate("/sessions/new");
    },
  },
  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Agent Selection",
        children: <box padding={1}><text>Agent Selection Coming Soon...</text></box>,
      });
    },
  },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        children: <box padding={1}><text>Model Selection coming soon...</text></box>,
        title: "Select Model",
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
        title: "Select Session",
        children: <SessionsDialog />,
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
      ctx.dialog.open({
        title: "Usage & Billing",
        children: <box padding={1}><text>Usage Monitoring coming soon...</text></box>,
      });
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => ctx.exit(),
  },
  {
    name: "goal",
    description: "Run a long-running, thorough background task",
    value: "/goal",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Goal Command",
        children: <box padding={1}><text>Goal configuration coming soon...</text></box>,
      });
    },
  },
  {
    name: "schedule",
    description: "Set a recurring schedule or timer",
    value: "/schedule",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Schedule Command",
        children: <box padding={1}><text>Schedule configuration coming soon...</text></box>,
      });
    },
  },
  {
    name: "plan",
    description: "Step-by-step task planning",
    value: "/plan",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Plan Command",
        children: <box padding={1}><text>Planning interface coming soon...</text></box>,
      });
    },
  },
  {
    name: "grill-me",
    description: "Interactive interview for design decisions",
    value: "/grill-me",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Grill Me",
        children: <box padding={1}><text>Interactive interview coming soon...</text></box>,
      });
    },
  },
  {
    name: "teamwork-preview",
    description: "Multi-agent autonomous teamwork",
    value: "/teamwork-preview",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Teamwork Preview",
        children: <box padding={1}><text>Teamwork preview coming soon...</text></box>,
      });
    },
  },
  {
    name: "learn",
    description: "Persist learned context for future tasks",
    value: "/learn",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Learn",
        children: <box padding={1}><text>Learning preferences coming soon...</text></box>,
      });
    },
  },
];

