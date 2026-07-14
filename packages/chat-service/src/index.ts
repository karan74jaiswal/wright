import { router } from "@wright/shared";
import { chatRouter } from "./router";

export { chatRouter } from "./router";

export const appRouter = router({
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
