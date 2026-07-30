import { START, END, StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import type { AgentStateType } from "./state";
import { getLangChainModel } from "./lib/models";
import type { SupportedChatModelId } from "@wright/shared";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { Mode } from "@wright/database/enums";
import { getCheckpointer } from "./lib/checkpointer";
import { buildSystemPrompt } from "./lib/prompts";

import { askPermission, askQuestion, readFileTool, writeFileTool, runCommandTool, listDirectoryTool } from "./lib/tools";

const buildTools = [readFileTool, writeFileTool, runCommandTool, listDirectoryTool, askPermission, askQuestion];
const planTools = [readFileTool, listDirectoryTool, askQuestion]; // Read-only tools + clarification

// Node: Agent
const callModel = async (state: AgentStateType, config?: RunnableConfig) => {
  const modelId = config?.configurable?.modelId as SupportedChatModelId;
  const mode = (config?.configurable?.mode as Mode) || "BUILD";
  const sessionCwd = config?.configurable?.sessionCwd as string;
  const activeCwd = config?.configurable?.activeCwd as string | undefined;
  const reasoningEffort = config?.configurable?.reasoningEffort as string | undefined;
  const providerApiKeys = config?.configurable?.providerApiKeys as Record<string, string | undefined> | undefined;

  if (!modelId) throw new Error("Model ID not provided in configurable config");

  let apiKey: string | undefined = undefined;
  if (providerApiKeys) {
    if (modelId.startsWith("gpt") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) {
      apiKey = providerApiKeys.openai;
    } else if (modelId.startsWith("claude")) {
      apiKey = providerApiKeys.anthropic;
    } else if (modelId.startsWith("gemini")) {
      apiKey = providerApiKeys.google;
    }
  }

  const model = getLangChainModel(modelId, {
    apiKey,
    reasoningEffort
  });
  const tools = mode === "PLAN" ? planTools : buildTools;
  
  if (!model.bindTools) {
    throw new Error(`Model ${modelId} does not support bindTools`);
  }
  
  const modelWithTools = model.bindTools(tools);

  // Always ensure the system prompt matches the current mode.
  // If the first message is a system message, replace it (mode may have changed).
  // Otherwise, prepend the system prompt.
  let messages = state.messages;
  const systemPrompt = buildSystemPrompt({ mode, sessionCwd, activeCwd });
  if (messages.length === 0) {
    messages = [systemPrompt];
  } else if (
    messages[0]?._getType() === "system" ||
    messages[0]?.type === "system"
  ) {
    messages = [systemPrompt, ...messages.slice(1)];
  } else {
    messages = [systemPrompt, ...messages];
  }
  
  const response = await modelWithTools.invoke(messages, config);
  
  // Return partial update (the new message will be appended via messagesStateReducer)
  return { messages: [response] };
};

// Node: Tools
const toolNode = new ToolNode([...buildTools, ...planTools], { handleToolErrors: true });

// Conditional Edge Logic
const shouldContinue = (state: AgentStateType) => {
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (!lastMessage) return END;

  const aiMessage = lastMessage as AIMessage;
  if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
};

// Compile Graph
export const createAgentGraph = () => {
  return new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, ["tools", END])
    .addEdge("tools", "agent")
    .compile({ checkpointer: getCheckpointer() });
};
