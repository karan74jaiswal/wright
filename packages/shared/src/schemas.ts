import * as z from "zod";

export const toolCallArgsSchema = z.record(z.string(), z.any());

export const toolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  args: toolCallArgsSchema,
});

export const baseMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  tool_calls: z.array(toolCallSchema).optional(),
  tool_call_id: z.string().optional(), // Used when role === "tool"
  name: z.string().optional(),
});

export type ToolCall = z.infer<typeof toolCallSchema>;
export type BaseMessage = z.infer<typeof baseMessageSchema>;

// Schema for SSE streaming events (ChatStreamEvent)
export const chatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.string(), // Streamed args are often partial JSON strings
  }),
  z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    result: z.any(),
  }),
  z.object({
    type: z.literal("interrupt"),
    payload: z.any(),
  }),
  z.object({
    type: z.literal("done"),
    messageId: z.string().optional(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;

export const chatRequestSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  message: z.string().optional(),
  resume: z.any().optional(),
  model: z.string().min(1, "Model ID is required"),
  mode: z.enum(["BUILD", "PLAN"]).default("BUILD"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
