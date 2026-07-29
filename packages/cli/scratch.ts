import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "./packages/api-gateway/src/index";

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "http://localhost:3000/api",
      transformer: superjson,
    }),
  ],
});

async function main() {
  try {
    const res = await client.session.createSession.mutate({
      title: "Test",
      cwd: process.cwd(),
      initialMessage: {
        role: "USER",
        content: "test",
        mode: "BUILD",
        model: "gemini-3.5-flash",
      }
    });
    console.log("Success:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}
main();
