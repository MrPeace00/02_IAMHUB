/**
 * Provider router for Lazy Chat text conversations.
 */
import process from "node:process";
import { createAnthropicService, formatAnthropicHistory } from "./anthropic.server";
import { createOpenAIService, formatConversationHistory } from "./openai.server";

export function createAIService() {
  const provider = process.env.AI_TEXT_PROVIDER?.toLowerCase() || "openai";

  switch (provider) {
    case "anthropic":
    case "claude":
      return {
        provider: "anthropic",
        service: createAnthropicService(),
        formatHistory: formatAnthropicHistory,
      };

    case "openai":
    case "chatgpt":
    default:
      return {
        provider: "openai",
        service: createOpenAIService(),
        formatHistory: formatConversationHistory,
      };
  }
}

export default { createAIService };
