import { z } from "zod";
import { router, publicProcedure, protectedProcedure, middleware } from "@wright/shared";
import { prisma as db } from "@wright/database/client";
import { Mode, Role, MessageStatus } from "@wright/database/enums";
import { findChatSupportedModel } from "@wright/shared";
import { redis } from "@wright/redis";
import * as Sentry from "@sentry/bun";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

// Middleware to log Zod validation errors to Sentry
const createSessionValidatorMiddleware = middleware(async ({ next, path }) => {
  const result = await next();
  if (!result.ok && result.error.code === "BAD_REQUEST") {
    let issuesCount = 0;
    // Extract Zod issues if present
    if (result.error.cause instanceof z.ZodError) {
      issuesCount = result.error.cause.issues.length;
    }

    Sentry.captureMessage("Session creation validation failed", {
      level: "warning",
      extra: {
        path: `/api/${path}`,
        issues: issuesCount,
      },
    });
  }
  return result;
});

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string().optional(),
  initialMessage: z
    .object({
      role: z.nativeEnum(Role), // Cast to any in case TS complains, though it worked in Hono
      content: z.string(),
      mode: z.nativeEnum(Mode),
      model: z
        .string()
        .refine((id) => !!findChatSupportedModel(id), "Unsupported Model"),
    })
    .optional(),
});

export const sessionRouter = router({
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await db.session.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });

    return sessions;
  }),

  getSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const { id } = input;
      const session = await db.session.findUnique({
        where: { id, userId: ctx.userId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!session) {
        Sentry.captureMessage("Session not found", {
          level: "warning",
          extra: { sessionId: id, userId: ctx.userId },
        });
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return {
        ...session,
        messages: session.messages.map((m) => {
          let content = m.content;
          if (m.role === "TOOL" && content.length > 1000) {
            content =
              content.slice(0, 1000) +
              "\n... [Content truncated for UI performance]";
          }
          return {
            ...m,
            content,
            toolCalls: m.toolCalls as unknown,
          };
        }),
      };
    }),

  createSession: protectedProcedure
    .use(createSessionValidatorMiddleware)
    .input(createSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const { initialMessage, ...data } = input;

      try {
        const session = await db.session.create({
          data: {
            ...data,
            userId: ctx.userId,
            ...(initialMessage && {
              messages: {
                create: {
                  ...initialMessage,
                  status: MessageStatus.COMPLETED,
                },
              },
            }),
          },
          include: { messages: true },
        });

        // return session;

        return {
          ...session,
          messages: session.messages.map((m) => ({
            ...m,
            toolCalls: m.toolCalls as unknown,
          })),
        };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create new session",
        });
      }
    }),

  syncSessionConfig: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        enabledSkills: z.record(z.string(), z.any()),
        enabledMcps: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionId, enabledSkills, enabledMcps } = input;
      // console.log(enabledMcps);
      const sortedSkills = Object.fromEntries(
        Object.entries(enabledSkills).sort((a, b) => a[0].localeCompare(b[0]))
      );
      const sortedMcps = Object.fromEntries(
        Object.entries(enabledMcps).sort((a, b) => a[0].localeCompare(b[0]))
      );
      
      const payloadString = JSON.stringify({
        skills: sortedSkills,
        mcps: sortedMcps,
      });
      const hash = crypto
        .createHash("sha256")
        .update(payloadString)
        .digest("hex");
      const redisKey = `tools:config_hash_${hash}`;

      try {
        await redis.set(redisKey, payloadString, "EX", 604800);

        await db.session.update({
          where: { id: sessionId, userId: ctx.userId },
          data: {
            toolsHash: hash,
          },
        });
        return { success: true, hash };
      } catch (error) {
        Sentry.captureException(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync session config",
        });
      }
    }),
});
