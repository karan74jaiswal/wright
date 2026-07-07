import { z } from "zod";
import { router, publicProcedure, middleware } from "@wright/shared";
import { prisma as db } from "@wright/database/client";
import { Mode, Role, MessageStatus } from "@wright/database/enums";
import { findChatSupportedModel } from "@wright/shared";
import * as Sentry from "@sentry/bun";
import { TRPCError } from "@trpc/server";

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
      role: z.enum(Role), // Cast to any in case TS complains, though it worked in Hono
      content: z.string(),
      mode: z.enum(Mode),
      model: z
        .string()
        .refine((id) => !!findChatSupportedModel(id), "Unsupported Model"),
    })
    .optional(),
});

export const sessionRouter = router({
  listSessions: publicProcedure.query(async () => {
    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });

    Sentry.captureMessage("Listed Sessions", {
      level: "info",
      extra: { count: sessions.length },
    });

    return sessions;
  }),

  getSession: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const { id } = input;
      const session = await db.session.findUnique({
        where: { id },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      if (!session) {
        Sentry.captureMessage("Session not found", {
          level: "warning",
          extra: { sessionId: id, userId: "mock-user" },
        });
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      Sentry.captureMessage("Loaded Session", {
        level: "info",
        extra: {
          sessionId: id,
          userId: "mock-user",
          messageCount: session.messages.length,
        },
      });

      return {
        ...session,
        messages: session.messages.map((m) => ({
          ...m,
          parts: m.parts as unknown,
        })),
      };
    }),

  createSession: publicProcedure
    .use(createSessionValidatorMiddleware)
    .input(createSessionSchema)
    .mutation(async ({ input }) => {
      const { initialMessage, ...data } = input;

      try {
        const session = await db.session.create({
          data: {
            ...data,
            userId: "mock-user",
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

        Sentry.captureMessage("Created Session", {
          level: "info",
          extra: {
            sessionId: session.id,
            userId: "mock-user",
            title: session.title,
            hasInitialMessage: session.messages.length > 0,
            cwd: session.cwd,
          },
        });
        // return session;

        return {
          ...session,
          messages: session.messages.map((m) => ({
            ...m,
            parts: m.parts as unknown,
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
});
