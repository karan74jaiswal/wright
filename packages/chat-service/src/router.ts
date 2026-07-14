import { z } from "zod";
import {
  router,
  publicProcedure,
  middleware,
  chatRequestSchema,
} from "@wright/shared";
import { streamAgent } from "@wright/agent";
import * as Sentry from "@sentry/bun";
import { TRPCError } from "@trpc/server";
import { prisma as db } from "@wright/database/client";

// Middleware to log Zod validation errors to Sentry
const chatValidatorMiddleware = middleware(async ({ next, path }) => {
  const result = await next();
  if (!result.ok && result.error.code === "BAD_REQUEST") {
    let issuesCount = 0;
    // Extract Zod issues if present
    if (result.error.cause instanceof z.ZodError) {
      issuesCount = result.error.cause.issues.length;
    }

    Sentry.captureMessage("Chat request validation failed", {
      level: "warning",
      extra: {
        path: `/api/${path}`,
        issues: issuesCount,
      },
    });
  }
  return result;
});

// Middleware to ensure the provided session ID actually exists
const sessionValidatorMiddleware = middleware(async ({ next, getRawInput }) => {
  const rawInput = await getRawInput();
  const parsed = z.object({ sessionId: z.string() }).safeParse(rawInput);
  
  if (parsed.success) {
    const session = await db.session.findUnique({
      where: { id: parsed.data.sessionId },
    });
    if (!session) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Session not found",
      });
    }
  }
  return next();
});

export const chatRouter = router({
  streamChat: publicProcedure
    .use(chatValidatorMiddleware)
    .use(sessionValidatorMiddleware)
    .input(chatRequestSchema)
    .subscription(async function* ({ input, signal }) {
      const stream = streamAgent(input, signal);
      for await (const event of stream) {
        yield event;
      }
    }),
});
