import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@wright/database";
import { Mode, Role, MessageStatus } from "@wright/database/enums";
import { findChatSupportedModel } from "@wright/shared";

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string().optional(),
  initialMessage: z
    .object({
      role: z.enum(Role),
      content: z.string(),
      mode: z.enum(Mode),
      model: z
        .string()
        .refine((id) => !!findChatSupportedModel(id), "Unsupported Model"),
    })
    .optional(),
});

const createSessionValidator = zValidator(
  "json",
  createSessionSchema,
  (result, c) => {
    if (!result.success) return c.json({ error: "Invalid Request Body" }, 400);
  },
);

const app = new Hono()
  .get("/", async (c) => {
    const sessions = await db.session.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });

    return c.json(sessions);
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const session = await db.session.findUnique({
      where: {
        id,
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session)
      throw new HTTPException(404, { message: "Session not found" });
    return c.json(session, 200);
  })
  .post("/create-session", createSessionValidator, async (c) => {
    const { initialMessage, ...data } = c.req.valid("json");

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
    if (!session)
      throw new HTTPException(500, { message: "Failed to create new session" });

    return c.json(session, 201);
  });

export default app;
