import type { ChatRequest, ChatStreamEvent } from "@wright/shared";
import { createAgentGraph } from "./graph";
import { setupCheckpointer } from "./lib/checkpointer";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { prisma as db } from "@wright/database/client";
import { Role, MessageStatus, Mode } from "@wright/database/enums";

export async function* streamAgent(
  input: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const { sessionId, message, resume, model, mode, isAutoResume } = input;

  let startTime = Date.now();
  let fullText = "";

  const persistInterruptedMessage = async () => {
    if (fullText.length === 0) return;
    const elapsedMs = Date.now() - startTime;
    try {
      await db.message.create({
        data: {
          sessionId,
          role: Role.ASSISTANT,
          status: MessageStatus.INTERRUPTED,
          model,
          content: fullText,
          mode: mode as Mode,
          duration: Math.round(elapsedMs / 1000),
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  try {
    await setupCheckpointer();

    if (message && !isAutoResume) {
      await db.message.create({
        data: {
          sessionId,
          role: Role.USER,
          content: message,
          model,
          mode: mode as Mode,
          status: MessageStatus.COMPLETED,
        },
      });
    }

    const newMessages = message ? [new HumanMessage(message)] : [];
    const graph = createAgentGraph();

    const config = {
      configurable: { thread_id: sessionId, modelId: model, mode },
    };

    const currentState = await graph.getState(config);
    const hasState = Object.keys(currentState.values).length > 0;

    const runInput = (
      resume
        ? new Command({ resume })
        : (!isAutoResume || !hasState) && message
          ? { messages: newMessages }
          : null
    ) as any;

    const eventStream = (await graph.streamEvents(runInput, {
      version: "v3",
      ...config,
      signal,
    })) as unknown as AsyncGenerator<any, void, unknown>;

    const savedMessageIds = new Set<string>();

    for await (const event of eventStream) {
      if (signal?.aborted) break;

      const method = event.method;
      const data = event.params.data as any;

      if (method === "messages" && data.event === "content-block-delta") {
        const block = data.delta ?? {};
        if (block.type === "text-delta") {
          const text = block.text ?? "";
          fullText += text;
          yield { type: "text-delta", text } as ChatStreamEvent;
        } else if (block.type === "reasoning-delta") {
          const text = block.reasoning ?? "";
          yield { type: "reasoning-delta", text } as ChatStreamEvent;
        } else if (
          block.type === "tool-call-delta" ||
          (block.type === "block-delta" &&
            block.fields?.type === "tool_call_chunk")
        ) {
          const tc = block.type === "tool-call-delta" ? block : block.fields;
          yield {
            type: "tool-call",
            toolCallId: tc.id || tc.index?.toString() || "unknown",
            toolName: tc.name || "unknown",
            args: tc.args || "",
          } as ChatStreamEvent;
        }
      }

      if (method === "values") {
        const messages = data.messages || [];
        const lastMsg = messages[messages.length - 1];

        if (
          lastMsg &&
          lastMsg.id &&
          !savedMessageIds.has(lastMsg.id as string)
        ) {
          savedMessageIds.add(lastMsg.id as string);
          const msgType = lastMsg.getType ? lastMsg.getType() : lastMsg.type;

          if (msgType === "ai") {
            const elapsedMs = Date.now() - startTime;
            const contentToSave =
              typeof lastMsg.content === "string"
                ? lastMsg.content
                : JSON.stringify(lastMsg.content);
            fullText = contentToSave;

            let toolCallsToSave = null;
            if (
              (lastMsg as any).tool_calls &&
              (lastMsg as any).tool_calls.length > 0
            ) {
              toolCallsToSave = (lastMsg as any).tool_calls;
            }

            await db.message.create({
              data: {
                sessionId,
                role: Role.ASSISTANT,
                content: contentToSave || "",
                toolCalls: toolCallsToSave,
                model,
                mode: mode as Mode,
                status: MessageStatus.COMPLETED,
                duration: Math.round(elapsedMs / 1000),
              },
            });
          }

          if (msgType === "tool") {
            const contentToSave =
              typeof lastMsg.content === "string"
                ? lastMsg.content
                : JSON.stringify(lastMsg.content);
            const toolCallId = lastMsg.tool_call_id || "unknown";

            await db.message.create({
              data: {
                sessionId,
                role: Role.TOOL,
                content: contentToSave,
                toolCallId,
                model,
                mode: mode as Mode,
                status: MessageStatus.COMPLETED,
              },
            });

            yield {
              type: "tool-result",
              toolCallId,
              result: contentToSave,
            } as ChatStreamEvent;
          }
        }
      }
    }

    if (signal?.aborted) {
      await persistInterruptedMessage();
      return;
    }

    const finalState = await graph.getState(config);
    const interruptedTask = finalState.tasks?.find(
      (t) => t.interrupts && t.interrupts.length > 0,
    );

    if (interruptedTask) {
      const interrupts = interruptedTask.interrupts;
      if (interrupts && interrupts.length > 0) {
        const payload = interrupts[0]?.value;
        if (payload !== undefined) {
          yield { type: "interrupt", payload } as ChatStreamEvent;
          return;
        }
      }
    }

    yield { type: "done" } as ChatStreamEvent;
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      await persistInterruptedMessage();
      return;
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Agent Error:", err);

    try {
      await db.message.create({
        data: {
          sessionId,
          role: Role.ERROR,
          status: MessageStatus.COMPLETED,
          model,
          content: errorMsg,
          mode: mode as Mode,
        },
      });
    } catch (dbErr) {
      console.error("Failed to persist error message:", dbErr);
    }

    yield { type: "error", message: errorMsg } as ChatStreamEvent;
  }
}
