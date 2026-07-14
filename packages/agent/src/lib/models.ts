import {
  findChatSupportedModel,
  type SupportedChatModel,
  type SupportedChatModelId,
} from "@wright/shared";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
// import dotenv from "dotenv";
// import path from "node:path";

// dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
// Extract the specific model IDs dynamically based on the provider
export type AnthropicModelId = Extract<
  SupportedChatModel,
  { provider: "anthropic" }
>["id"];
export type OpenAIModelId = Extract<
  SupportedChatModel,
  { provider: "openai" }
>["id"];
export type GoogleModelId = Extract<
  SupportedChatModel,
  { provider: "google" }
>["id"];

// The universal interface that all our models must adhere to
export type ResolveModel = BaseChatModel;

export function resolveAnthropicModel(modelId: AnthropicModelId): ResolveModel {
  return new ChatAnthropic({
    model: modelId,
    temperature: 0,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export function resolveOpenAIModel(modelId: OpenAIModelId): ResolveModel {
  // Hardcode reasoning effort for o1 or o3-mini models
  // Reasoning effort controls how deeply the model "thinks" before generating the output.
  const isReasoningModel = modelId.startsWith("o1") || modelId.startsWith("o3");

  return new ChatOpenAI({
    model: modelId,
    temperature: isReasoningModel ? undefined : 0, // Reasoning models often don't support temperature
    apiKey: process.env.OPENAI_API_KEY,
    ...(isReasoningModel && { reasoning_effort: "high" }),
  });
}

export function resolveGoogleModel(modelId: GoogleModelId): ResolveModel {
  return new ChatGoogle({
    model: modelId,
    temperature: 1,
    apiKey: process.env.GOOGLE_API_KEY,
    thinkingLevel: "HIGH",
  });
}

// Main factory router
export function getLangChainModel(modelId: SupportedChatModelId): ResolveModel {
  const modelInfo = findChatSupportedModel(modelId);

  if (!modelInfo) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  switch (modelInfo.provider) {
    case "anthropic":
      return resolveAnthropicModel(modelInfo.id as AnthropicModelId);
    case "openai":
      return resolveOpenAIModel(modelInfo.id as OpenAIModelId);
    case "google":
      return resolveGoogleModel(modelInfo.id as GoogleModelId);
    default:
      // Exhaustive check
      throw new Error(`Provider not configured for model: ${modelId}`);
  }
}
