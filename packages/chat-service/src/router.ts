import { z } from "zod";
import * as crypto from "node:crypto";
import {
  router,
  publicProcedure,
  protectedProcedure,
  middleware,
  chatRequestSchema,
} from "@wright/shared";
import * as Sentry from "@sentry/bun";
import { TRPCError } from "@trpc/server";
import { prisma as db } from "@wright/database/client";

import { redis, createRedisClient } from "@wright/redis";
import { chatQueue } from "./queue";
import { EventEmitter } from "events";

const streamEmitter = new EventEmitter();
streamEmitter.setMaxListeners(1000); // Support up to 1000 concurrent listeners

const globalSubClient = createRedisClient();
globalSubClient.psubscribe("chat_stream:*").catch(console.error);
globalSubClient.on("pmessage", (pattern, channel, message) => {
  if (process.env.DEBUG === "true") {
    console.log(`[Pub/Sub] Received message on channel ${channel}:`, message);
  }
  streamEmitter.emit(channel, message);
});

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

// Middleware to ensure the provided session ID actually exists and belongs to the user
const sessionValidatorMiddleware = middleware(async ({ ctx, next, getRawInput }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const rawInput = await getRawInput();
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(rawInput);

  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid or missing sessionId",
    });
  }

  const session = await db.session.findUnique({
    where: { id: parsed.data.sessionId, userId: ctx.userId },
  });
  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Session not found",
    });
  }

  return next();
});

// We no longer keep AbortControllers in memory on the API process.
// Aborts are handled by publishing a cancel event to Redis Pub/Sub.

export const chatRouter = router({
  streamChat: protectedProcedure
    .use(chatValidatorMiddleware)
    .use(sessionValidatorMiddleware)
    .input(z.object({ sessionId: z.string(), jobId: z.string() }))
    .subscription(async function* ({ input, signal }) {
      const channel = `chat_stream:${input.sessionId}:${input.jobId}`;
      
      const eventQueue: string[] = [];
      let resolveNext: (() => void) | null = null;
      
      const onMessage = (msg: string) => {
        eventQueue.push(msg);
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
      };

      streamEmitter.on(channel, onMessage);

      // Signal subscriber readiness
      await redis.setex(`chat_ready:${input.sessionId}:${input.jobId}`, 3600, "READY");
      await redis.publish(`chat_ready_pubsub:${input.sessionId}:${input.jobId}`, "READY");

      if (signal) {
        signal.addEventListener("abort", () => {
          streamEmitter.off(channel, onMessage);
          if (resolveNext) {
            resolveNext();
            resolveNext = null;
          }
        });
      }

      try {
        while (true) {
          if (signal?.aborted) break;

          if (eventQueue.length === 0) {
            await new Promise<void>((resolve) => {
              resolveNext = resolve;
            });
            continue; // Wake up and check queue or abort signal
          }

          const event = eventQueue.shift()!;
          const parsedEvent = JSON.parse(event);
          if (parsedEvent.type === "done") {
            yield parsedEvent;
            break;
          }
          if (parsedEvent.type === "error") {
            yield parsedEvent;
            break;
          }

          yield parsedEvent;
        }
      } finally {
        streamEmitter.off(channel, onMessage);
      }
    }),

  submitChatJob: protectedProcedure
    .use(chatValidatorMiddleware)
    .use(sessionValidatorMiddleware)
    .input(chatRequestSchema)
    .mutation(async ({ input }) => {
      const session = await db.session.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const targetHash = input.toolsHash || session.toolsHash;

      if (!targetHash) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SESSION_CONFIG_NOT_SYNCED",
        });
      }

      if (input.toolsHash && input.toolsHash !== session.toolsHash) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "CACHE_MISS_RESYNC_REQUIRED",
        });
      }

      const redisKey = `tools:config_hash_${targetHash}`;
      const cachedPayload = await redis.get(redisKey);

      if (!cachedPayload) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "CACHE_MISS_RESYNC_REQUIRED",
        });
      }

      const parsedTools = JSON.parse(cachedPayload);
      const resolvedSkills = parsedTools.skills || {};
      const resolvedMcps = parsedTools.mcps || {};

      const reqId = input.jobId || crypto.randomUUID();

      // Clear ready state and cancel state
      await redis.del(`chat_ready:${input.sessionId}:${reqId}`);
      await redis.del(`chat_cancel_state:${input.sessionId}:${reqId}`);

      const agentInput = {
        ...input,
        jobId: reqId,
        skills: resolvedSkills,
        mcpServers: resolvedMcps,
      };

      // Add to BullMQ with no delay; the worker will wait for the explicit READY handshake via Pub/Sub or Redis
      const job = await chatQueue.add("chat-job", agentInput, {
        jobId: reqId,
        removeOnComplete: true,
      });
      return { jobId: job.id };
    }),

    cancelChat: protectedProcedure
    .use(sessionValidatorMiddleware)
    .input(z.object({ sessionId: z.string(), jobId: z.string() }))
    .mutation(async ({ input }) => {
      // Persist cancellation so worker doesn't start if it was queued
      await redis.setex(`chat_cancel_state:${input.sessionId}:${input.jobId}`, 3600, "CANCEL");
      // Publish cancellation event to the worker processing this session
      await redis.publish(`chat_cancel:${input.sessionId}:${input.jobId}`, "CANCEL");
      return { success: true };
    }),
});
