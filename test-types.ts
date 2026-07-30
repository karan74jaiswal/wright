import { router } from "./packages/shared/src/trpc";
import type { sessionRouter } from "./packages/session-service/src/router";
import type { chatRouter } from "./packages/chat-service/src/router";

export const appRouter = router({
  session: {} as unknown as typeof sessionRouter,
  chat: {} as unknown as typeof chatRouter,
});

export type AppRouter = typeof appRouter;
