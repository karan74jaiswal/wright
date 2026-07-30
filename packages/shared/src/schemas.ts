import * as z from "zod";
import { SUPPORTED_CHAT_MODELS } from "./models";

export const toolCallArgsSchema = z.record(z.string(), z.unknown());

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
    result: z.unknown(),
  }),
  z.object({
    type: z.literal("interrupt"),
    payload: z.unknown(),
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

const supportedModelIds = SUPPORTED_CHAT_MODELS.map(m => m.id) as [string, ...string[]];

export const chatRequestSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required").max(255),
  message: z.string().optional(),
  activeCwd: z.string().optional(),
  resume: z.unknown().optional(),
  model: z.string().refine((val) => supportedModelIds.includes(val), {
    message: "Invalid or unsupported Model ID",
  }),
  mode: z.enum(["BUILD", "PLAN"]).default("BUILD"),
  reasoningEffort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]).optional(),
  providerApiKeys: z.object({
    openai: z.string().optional(),
    anthropic: z.string().optional(),
    google: z.string().optional(),
  }).optional(),
  isAutoResume: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
