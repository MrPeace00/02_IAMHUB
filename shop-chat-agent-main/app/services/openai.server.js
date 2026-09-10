/**
 * OpenAI Responses API service for streamed storefront conversations.
 */
import process from "node:process";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";
import { formatOpenAITools } from "./openai-format.js";

export { formatConversationHistory, formatOpenAITools } from "./openai-format.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function createApiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseEventData(eventBlock) {
  const data = eventBlock
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data || data === "[DONE]") return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function readResponseStream(response, onText) {
  const reader = response.body?.getReader();
  if (!reader) throw createApiError("OpenAI returned an empty response stream", 502);

  const decoder = new TextDecoder();
  const functionCalls = [];
  let responseId = "";
  let outputText = "";
  let buffer = "";

  const handleEvent = (event) => {
    if (!event) return;

    if (event.response?.id) responseId = event.response.id;

    if (event.type === "response.output_text.delta" && event.delta) {
      outputText += event.delta;
      onText?.(event.delta);
    }

    if (event.type === "response.refusal.delta" && event.delta) {
      outputText += event.delta;
      onText?.(event.delta);
    }

    if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
      functionCalls.push(event.item);
    }

    if (event.type === "error" || event.type === "response.failed") {
      const apiError = event.error || event.response?.error;
      throw createApiError(apiError?.message || "OpenAI could not complete the response", 502);
    }
  };

  let streamFinished = false;
  while (!streamFinished) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    blocks.forEach((block) => handleEvent(parseEventData(block)));

    streamFinished = done;
  }

  if (buffer.trim()) handleEvent(parseEventData(buffer));

  return { responseId, functionCalls, outputText };
}

export function createOpenAIService(apiKey = process.env.OPENAI_API_KEY) {
  const getSystemPrompt = (promptType) => {
    const basePrompt = systemPrompts.systemPrompts[promptType]?.content
      || systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;

    return `${basePrompt}\n\nIntent rules: Extract every useful attribute from the customer's natural-language request before replying. Never ask them to repeat details they already supplied. When a request is broad, ask only one short question at a time for the most important missing detail among recipient profile, seasonal or aesthetic vibe, product category, and fit or size. Once there is enough information to search, search immediately instead of continuing a questionnaire.\n\nCommerce rules: Use discovered search_catalog, lookup_catalog, and get_product tools for catalog information, preserving their catalog argument wrapper. Use search_shop_policies_and_faqs for store policy questions and follow its returned policies; never invent policies or promise exceptions. Use discovered get_cart, create_cart, and update_cart tools for cart state and changes, following their live schemas and using actual variant IDs returned by the catalog. Only claim a cart change succeeded when the tool confirms success. If a required tool is unavailable or fails, explain that limitation instead of inventing results. Keep responses concise and conversational.`;
  };

  const streamResponse = async ({ input, previousResponseId, promptType, tools }, handlers = {}) => {
    if (!apiKey) {
      throw createApiError("OPENAI_API_KEY is not configured on the server", 401);
    }

    const body = {
      model: process.env.OPENAI_CHAT_MODEL || AppConfig.api.defaultModel,
      instructions: getSystemPrompt(promptType),
      input,
      tools: formatOpenAITools(tools),
      max_output_tokens: AppConfig.api.maxTokens,
      stream: true,
    };

    if (previousResponseId) body.previous_response_id = previousResponseId;
    if (body.tools.length === 0) delete body.tools;

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw createApiError(
        payload.error?.message || `OpenAI request failed with status ${response.status}`,
        response.status,
      );
    }

    return readResponseStream(response, handlers.onText);
  };

  return { getSystemPrompt, streamResponse };
}

export default { createOpenAIService };
