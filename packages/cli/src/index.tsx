import { createCliRenderer, ConsolePosition } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import RootLayout from "./layouts/root-layout";
import Home from "./screens/home";
import NewSession from "./screens/new-session";
import Session from "./screens/session";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./lib/api-client";

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
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: process.env.API_URL ?? "http://localhost:3000/api",
    }),
  ],
});
function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
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
