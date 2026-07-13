import { BaseMessage } from "@langchain/core/messages";
import { Role } from "@wright/database/enums";

export interface DbMessageLike {
  role: Role;
  content: string;
  toolCalls?: unknown;
  [key: string]: any; // Allow other properties
}

/**
 * Builds the conversation history by filtering out 'junk' messages (like errors 
 * or empty assistant responses) to save tokens before sending to the LLM.
 * Adapted from the instructor's strategy for the LangChain ecosystem.
 */
export function buildConversationHistory<T extends DbMessageLike>(dbMessages: T[]): T[] {
  return dbMessages.filter((m) => {
    // 1. Strip out any error messages
    if (m.role === Role.ERROR) return false;

    // 2. Strip out empty assistant messages to save tokens.
    // However, in LangChain, an AI message might have empty text but contain a Tool Call.
    // We MUST NOT strip it if it contains tool calls, otherwise the API will crash.
    if (m.role === Role.ASSISTANT) {
      const hasContent = m.content && m.content.length > 0;
      const hasToolCalls = m.toolCalls && Array.isArray(m.toolCalls) && m.toolCalls.length > 0;
      
      if (!hasContent && !hasToolCalls) {
        return false;
      }
    }

    return true;
  });
}
