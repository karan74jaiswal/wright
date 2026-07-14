import { createCliRenderer, ConsolePosition } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import RootLayout from "./layouts/root-layout";
import Home from "./screens/home";
import NewSession from "./screens/new-session";
import Session from "./screens/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpSubscriptionLink, splitLink, createTRPCClient } from "@trpc/client";
import { TRPCProvider } from "./lib/api-client";
import type { AppRouter } from "@wright/api-gateway";
import { EventSource } from "eventsource";

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
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({ url, EventSource: EventSource as any }),
      false: httpBatchLink({ url }),
    }),
  ],
});
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* @ts-expect-error type mismatch with older @types/react */}
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <RouterProvider router={router} />
      </TRPCProvider>
    </QueryClientProvider>
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

createRoot(renderer).render(<App />);
