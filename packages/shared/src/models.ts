export type ModelPricing = {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

export type SupportedProvider = "anthropic" | "openai" | "google";

interface SupportedChatModelDefinition {
  id: string;
  provider: SupportedProvider;
  pricing: ModelPricing;
}

export const SUPPORTED_CHAT_MODELS = [
  // Anthropic Models
  {
    id: "claude-5-sonnet",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 2.0,
      outputUsdPerMillionTokens: 10.0,
    },
  },
  {
    id: "claude-5-fable",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 10.0,
      outputUsdPerMillionTokens: 50.0,
    },
  },
  {
    id: "claude-4.5-haiku",
    provider: "anthropic",
    pricing: {
      inputUsdPerMillionTokens: 1.0,
      outputUsdPerMillionTokens: 5.0,
    },
  },

  // OpenAI Models
  {
    id: "gpt-5.6-sol",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 5.0,
      outputUsdPerMillionTokens: 30.0,
    },
  },
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 1.0,
      outputUsdPerMillionTokens: 6.0,
    },
  },
  {
    id: "gpt-5.4-mini",
    provider: "openai",
    pricing: {
      inputUsdPerMillionTokens: 0.75,
      outputUsdPerMillionTokens: 4.5,
    },
  },

  // Google Models
  {
    id: "gemini-3.1-pro-preview",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 2.0,
      outputUsdPerMillionTokens: 12.0,
    },
  },
  {
    id: "gemini-3.5-flash",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 1.5,
      outputUsdPerMillionTokens: 9.0,
    },
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    pricing: {
      inputUsdPerMillionTokens: 1.25,
      outputUsdPerMillionTokens: 10.0,
    },
  },
] as const satisfies readonly SupportedChatModelDefinition[];

export type SupportedChatModel = (typeof SUPPORTED_CHAT_MODELS)[number];
export type SupportedChatModelId = SupportedChatModel["id"];

export function findChatSupportedModel(modelId: string) {
  return SUPPORTED_CHAT_MODELS.find((model) => model.id === modelId);
}

export const DEFAULT_CHAT_MODEL_ID: SupportedChatModelId =
  "gemini-3.1-pro-preview";
