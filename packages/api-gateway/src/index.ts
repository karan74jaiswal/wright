// Create and export the aggregated AppRouter type
import { router } from "@wright/shared";
import { sessionRouter } from "@wright/session-service";

export const appRouter = router({
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
