import { router } from "@wright/shared";
import { sessionRouter } from "./router";

export { sessionRouter } from "./router";

// The router for this service
export const appRouter = router({
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
