#!/usr/bin/env bun
import "./env";
import fsSync from "node:fs";
import pathSync from "node:path";
import osSync from "node:os";
import { createCliRenderer, ConsolePosition } from "@opentui/core";
import { installCapture } from "@anscribe/opentui";
import "@anscribe/mcp/sink";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import RootLayout from "./layouts/root-layout";
import Home from "./screens/home";
import NewSession from "./screens/new-session";
import Session from "./screens/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  httpLink,
  httpSubscriptionLink,
  splitLink,
  createTRPCClient,
  TRPCClientError,
  type TRPCLink,
} from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { TRPCProvider } from "./lib/api-client";
import type { AppRouter } from "@wright/api-gateway";
import { EventSource } from "eventsource";
import superjson from "superjson";
import { forceRefresh } from "./lib/clerk-oauth";

// Set the terminal window/tab title to 'wright'
process.stdout.write("\x1b]0;wright\x07");

const url = process.env.API_URL ?? "http://localhost:3000/api";

const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        element: <Home />,
        index: true,
      },
      {
        path: "sessions/new",
        element: <NewSession />,
      },
      {
        path: "sessions/:id",
        element: <Session />,
      },
    ],
  },
]);

const queryClient = new QueryClient();

import { AuthManager } from "./lib/auth";

const getAuthHeaders = async () => {
  const state = await AuthManager.getState();
  return state.jwt ? { Authorization: `Bearer ${state.jwt}` } : {};
};

const tokenRefreshLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    return observable((observer) => {
      let unsubscribe = () => {};

      const attempt = () => {
        const sub = next(op).subscribe({
          next(value) { observer.next(value); },
          error(err) {
            if (err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED") {
              forceRefresh()
                .then(() => {
                  unsubscribe = next(op).subscribe({
                    next(val) { observer.next(val); },
                    error(retryErr) { observer.error(retryErr); },
                    complete() { observer.complete(); }
                  }).unsubscribe;
                })
                .catch(() => observer.error(err));
            } else {
              observer.error(err);
            }
          },
          complete() { observer.complete(); },
        });
        unsubscribe = sub.unsubscribe;
      };

      attempt();
      return () => unsubscribe();
    });
  };
};

class AuthenticatedEventSource extends EventSource {
  constructor(url: string, init?: any) {
    let jwt = "";
    try {
      const data = fsSync.readFileSync(pathSync.join(osSync.homedir(), ".wright", "auth.json"), "utf-8");
      jwt = JSON.parse(data).jwt;
    } catch (e) {
      // Ignore
    }
    let newUrl = url;
    if (jwt) {
      const char = newUrl.includes("?") ? "&" : "?";
      newUrl = `${newUrl}${char}token=${encodeURIComponent(jwt)}`;
    }
    
    super(newUrl, init);
  }
}

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    tokenRefreshLink,
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        url,
        EventSource: AuthenticatedEventSource as any,
        transformer: superjson,
      }),
      false: httpLink({ 
        url, 
        transformer: superjson,
        headers: getAuthHeaders,
      }),
    }),
  ],
});
import ThemeProvider from "./providers/theme";
import PromptConfigProvider from "./providers/prompt-config";

function App() {
  return (
    <ThemeProvider>
      <PromptConfigProvider>
        <QueryClientProvider client={queryClient}>
          {/* @ts-expect-error type mismatch with older @types/react */}
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <RouterProvider router={router} />
          </TRPCProvider>
        </QueryClientProvider>
      </PromptConfigProvider>
    </ThemeProvider>
  );
}

const renderer = await createCliRenderer({
  onDestroy: () => {
    console.log("Renderer destroyed, performing additional cleanup...");
    process.exit(0);
  },

  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 30,
  },

  targetFps: 60,
  exitOnCtrlC: false,
});

installCapture(renderer, { keybinding: "ctrl+x" });

import { workspaceScanner } from "./lib/scanner";

await workspaceScanner.init();

createRoot(renderer).render(<App />);
