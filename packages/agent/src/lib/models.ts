import {
  findChatSupportedModel,
  type SupportedChatModel,
  type SupportedChatModelId,
} from "@wright/shared";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

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

interface ModelConfig {
  apiKey?: string;
  reasoningEffort?: string;
}

export function resolveAnthropicModel(
  modelId: AnthropicModelId,
  config?: ModelConfig,
): ResolveModel {
  return new ChatAnthropic({
    model: modelId,
    temperature: 1,
    apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
  });
}

export function resolveOpenAIModel(
  modelId: OpenAIModelId,
  config?: ModelConfig,
): ResolveModel {
  const isReasoningModel =
    modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4") ||
    modelId.startsWith("gpt-5");

  return new ChatOpenAI({
    model: modelId,

    temperature: isReasoningModel ? undefined : 1,
    apiKey: config?.apiKey || process.env.OPENAI_API_KEY,

    ...(isReasoningModel && {
      reasoning_effort: config?.reasoningEffort || "medium",
    }),
  });
}

export function resolveGoogleModel(
  modelId: GoogleModelId,
  config?: ModelConfig,
): ResolveModel {
  // All Gemini 2.5 and 3 models support reasoning steps
  const isReasoningModel =
    modelId.startsWith("gemini-3") ||
    modelId.startsWith("gemini-2.5") ||
    modelId.startsWith("gemini-2.0-flash-thinking");

  // Map universal efforts to Google's supported levels
  let googleEffort = config?.reasoningEffort || "medium";
  if (googleEffort === "none") googleEffort = "low";
  if (googleEffort === "xhigh" || googleEffort === "max") googleEffort = "high";

  return new ChatGoogle({
    model: modelId,
    temperature: isReasoningModel ? undefined : 1,
    apiKey: config?.apiKey || process.env.GOOGLE_API_KEY,
    ...(isReasoningModel && {
      reasoningEffort: googleEffort,
    }),
  });
}

// Main factory router
export function getLangChainModel(
  modelId: SupportedChatModelId,
  config?: ModelConfig,
): ResolveModel {
  const modelInfo = findChatSupportedModel(modelId);

  if (!modelInfo) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  switch (modelInfo.provider) {
    case "anthropic":
      return resolveAnthropicModel(modelInfo.id as AnthropicModelId, config);
    case "openai":
      return resolveOpenAIModel(modelInfo.id as OpenAIModelId, config);
    case "google":
      return resolveGoogleModel(modelInfo.id as GoogleModelId, config);
    default:
      // Exhaustive check
      throw new Error(`Provider not configured for model: ${modelId}`);
  }
}
