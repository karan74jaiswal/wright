import { router } from "@wright/shared";
import type { sessionRouter } from "@wright/session-service";
import type { chatRouter } from "@wright/chat-service";

// We use `as unknown as typeof ...` to stitch the types together for the frontend
// WITHOUT importing the actual runtime implementations. This keeps the API Gateway
// completely isolated from heavy backend dependencies like Prisma, LangChain, etc.
export const appRouter = router({
  session: {} as unknown as typeof sessionRouter,
  chat: {} as unknown as typeof chatRouter,
});

export type AppRouter = typeof appRouter;
