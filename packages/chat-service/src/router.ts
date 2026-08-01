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
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(rawInput);

  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid or missing sessionId",
    });
  }

  const session = await db.session.findUnique({
    where: { id: parsed.data.sessionId },
  });
  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Session not found",
    });
  }

  return next();
});

// Global map to hold abort controllers for active streams
const activeStreams = new Map<string, AbortController>();

/** Abort all active SSE streams during shutdown */
export function abortAllStreams() {
  for (const [id, controller] of activeStreams) {
    controller.abort();
  }
  activeStreams.clear();
}

export const chatRouter = router({
  streamChat: publicProcedure
    .use(chatValidatorMiddleware)
    .use(sessionValidatorMiddleware)
    .input(chatRequestSchema)
    .subscription(async function* ({ input, signal }) {
      const controller = new AbortController();
      activeStreams.set(input.sessionId, controller);

      if (signal) {
        signal.addEventListener("abort", () => {
          controller.abort();
          activeStreams.delete(input.sessionId);
        });
      }

      try {
        const stream = streamAgent(input, controller.signal);
        for await (const event of stream) {
          yield event;
        }
      } finally {
        activeStreams.delete(input.sessionId);
      }
    }),

  cancelChat: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const controller = activeStreams.get(input.sessionId);
      if (controller) {
        controller.abort();
        activeStreams.delete(input.sessionId);
        return { success: true };
      }
      return { success: false };
    }),
});
