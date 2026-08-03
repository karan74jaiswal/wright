import type { ChatRequest, ChatStreamEvent } from "@wright/shared";
import { createAgentGraph } from "./graph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { prisma as db } from "@wright/database/client";
import { Role, MessageStatus, Mode } from "@wright/database/enums";

export async function* streamAgent(
  input: ChatRequest & {
    skills?: Record<string, any>;
    mcpServers?: Record<string, any>;
  },
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const {
    sessionId,
    message,
    activeCwd,
    resume,
    model,
    mode,
    isAutoResume,
    reasoningEffort,
    providerApiKeys,
  } = input;

  let startTime = Date.now();
  let fullText = "";
  let fullReasoning = "";
  let reasoningDurationMs: number | null = null;

  let graph: ReturnType<typeof createAgentGraph> | null = null;
  let config: any = null;

  const persistInterruptedMessage = async () => {
    if (fullText.length === 0 && fullReasoning.length === 0) return;
    const elapsedMs = Date.now() - startTime;
    try {
      const created = await db.message.create({
        data: {
          sessionId,
          role: Role.ASSISTANT,
          status: MessageStatus.INTERRUPTED,
          model,
          content: fullText,
          reasoning: fullReasoning || null,
          reasoningEffort: reasoningEffort || null,
          reasoningDuration: reasoningDurationMs,
          mode: mode as Mode,
          duration: elapsedMs,
        },
      });

      if (graph && config) {
        // Sync the LangChain message ID with Prisma's generated CUID
        const partialMsg = new AIMessage({
          content: fullText,
          id: created.id,
        });
        await graph.updateState(config, { messages: [partialMsg] }, "agent");
      }
    } catch (e) {
      console.error("Failed to persist interrupted message:", e);
    }
  };

  try {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      select: { cwd: true },
    });

    // If we can't find session cwd (e.g. invalid session), fallback to process.cwd() or activeCwd
    const sessionCwd = session?.cwd || activeCwd || process.cwd();

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
    graph = createAgentGraph();

    let mcpTools: any[] = [];
    if (input.mcpServers && Object.keys(input.mcpServers).length > 0) {
      try {
        const { createMcpProxyTools } = await import("./lib/tools");

        for (const [serverName, serverPayload] of Object.entries(
          input.mcpServers as Record<string, any>,
        )) {
          if (!serverPayload.tools) continue;
          
          const tools = await createMcpProxyTools(serverName, serverPayload.tools);
          mcpTools.push(...tools);
        }
      } catch (err: unknown) {
        console.error("Failed to initialize MCP proxy tools:", err);
      }
    }

    config = {
      configurable: {
        thread_id: sessionId,
        modelId: model,
        mode,
        reasoningEffort,
        providerApiKeys,
        sessionCwd,
        activeCwd,
        mcpTools,
        skills: input.skills,
        mcpServers: input.mcpServers,
      },
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
          fullReasoning += text;
          reasoningDurationMs = Date.now() - startTime;
          yield { type: "reasoning-delta", text } as ChatStreamEvent;
        } else if (
          block.type === "tool-call-delta" ||
          (block.type === "block-delta" &&
            block.fields?.type === "tool_call_chunk")
        ) {
          const tc = block.type === "tool-call-delta" ? block : block.fields;

          // Ignore completely empty tool call chunks which some models emit when transitioning blocks
          if (!tc.id && tc.index === undefined && !tc.name && !tc.args) {
            continue;
          }

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

        // Iterate backwards to find and persist ALL new messages (not just the last one)
        // This handles parallel tool executions where multiple messages are appended at once
        const newMessages: any[] = [];
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (!msg?.id || savedMessageIds.has(msg.id as string)) break;
          newMessages.unshift(msg); // Prepend to maintain order
        }

        for (const msg of newMessages) {
          const msgId = msg.id as string;
          savedMessageIds.add(msgId);
          const msgType = msg.getType ? msg.getType() : msg.type;

          // Cross-run deduplication: Check if this message was already persisted in a prior run
          const existingMsg = await db.message.findUnique({
            where: { id: msgId },
          });

          if (!existingMsg) {
            if (msgType === "ai") {
              const elapsedMs = Date.now() - startTime;
              const contentToSave =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content);
              fullText = contentToSave;

              let toolCallsToSave = null;
              if (msg.tool_calls && msg.tool_calls.length > 0) {
                toolCallsToSave = msg.tool_calls;
              }

              try {
                await db.message.create({
                  data: {
                    id: msgId,
                    sessionId,
                    role: Role.ASSISTANT,
                    content: contentToSave || "",
                    reasoning: fullReasoning || null,
                    reasoningEffort: reasoningEffort || null,
                    reasoningDuration: reasoningDurationMs,
                    toolCalls: toolCallsToSave,
                    model,
                    mode: mode as Mode,
                    status: MessageStatus.COMPLETED,
                    duration: elapsedMs,
                  },
                });
              } catch (dbErr) {
                console.error("Failed to persist AI message:", dbErr);
              }
            }

            if (msgType === "tool") {
              const contentToSave =
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content);
              const toolCallId = msg.tool_call_id || "unknown";

              try {
                await db.message.create({
                  data: {
                    id: msgId,
                    sessionId,
                    role: Role.TOOL,
                    content: contentToSave,
                    toolCallId,
                    model,
                    mode: mode as Mode,
                    status: MessageStatus.COMPLETED,
                  },
                });
              } catch (dbErr) {
                console.error("Failed to persist tool message:", dbErr);
              }

              yield {
                type: "tool-result",
                toolCallId,
                result: contentToSave,
              } as ChatStreamEvent;
            }
          }
        }
      }
    }

    if (signal?.aborted) {
      await persistInterruptedMessage();
      // Cleanup not needed for dummy client
      return;
    }

    const finalState = await graph.getState(config);
    const interruptedTask = finalState.tasks?.find(
      (t) => t.interrupts && t.interrupts.length > 0,
    );

    if (interruptedTask) {
      const interrupts = interruptedTask.interrupts;
      if (interrupts && interrupts.length > 0) {
        const payloads = interrupts.map((i) => ({ id: i.id, value: i.value }));
        yield { type: "interrupt", payload: payloads } as ChatStreamEvent;
        // Cleanup not needed for dummy client
        return;
      }
    }

    yield { type: "done" } as ChatStreamEvent;
    // Cleanup not needed for dummy client
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      await persistInterruptedMessage();
      // Cleanup not needed for dummy client
      return;
    }

    const errorMsg = err instanceof Error ? err.message : String(err);

    // In LangGraph 0.2, calling interrupt() throws GraphInterrupt which propagates through streamEvents.
    if (
      errorMsg.includes("GraphInterrupt") ||
      errorMsg.includes("NodeInterrupt") ||
      (err as any)?.name === "GraphInterrupt" ||
      (err as any)?.name === "NodeInterrupt"
    ) {
      const finalState = await graph!.getState(config!);
      const interruptedTask = finalState.tasks?.find(
        (t) => t.interrupts && t.interrupts.length > 0,
      );

      if (interruptedTask) {
        const interrupts = interruptedTask.interrupts;
        if (interrupts && interrupts.length > 0) {
          const payloads = interrupts.map((i) => ({
            id: i.id,
            value: i.value,
          }));
          yield { type: "interrupt", payload: payloads } as ChatStreamEvent;
          // Cleanup not needed for dummy client
          return;
        }
      }
      // Cleanup not needed for dummy client
      return; // It interrupted but we couldn't find the payload, just gracefully stop.
    }

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
    // Cleanup not needed for dummy client
  }
}
