import { z } from "zod";
import * as crypto from "node:crypto";
import {
  router,
  publicProcedure,
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
  console.log(`[Pub/Sub] Received message on channel ${channel}:`, message);
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

// We no longer keep AbortControllers in memory on the API process.
// Aborts are handled by publishing a cancel event to Redis Pub/Sub.

export const chatRouter = router({
  streamChat: publicProcedure
    .use(chatValidatorMiddleware)
    .use(sessionValidatorMiddleware)
    .input(z.object({ sessionId: z.string() }))
    .subscription(async function* ({ input, signal }) {
      const channel = `chat_stream:${input.sessionId}`;
      
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

  submitChatJob: publicProcedure
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
      const agentInput = {
        ...input,
        jobId: reqId,
        skills: resolvedSkills,
        mcpServers: resolvedMcps,
      };

      // Add to BullMQ with a slight delay to allow the frontend SSE to connect 
      // before the worker starts processing and publishing events to Pub/Sub.
      const job = await chatQueue.add("chat-job", agentInput, {
        jobId: reqId,
        removeOnComplete: true,
        delay: 500,
      });
      return { jobId: job.id };
    }),

  cancelChat: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      // Publish cancellation event to the worker processing this session
      await redis.publish(`chat_cancel:${input.sessionId}`, "CANCEL");
      return { success: true };
    }),
});
