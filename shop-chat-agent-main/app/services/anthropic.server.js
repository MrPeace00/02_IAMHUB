/**
 * Anthropic Messages API service for streamed storefront conversations.
 */
import process from "node:process";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";
import { formatConversationHistory } from "./openai-format.js";

export { formatConversationHistory as formatAnthropicHistory };

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

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

function normalizeToolInput(input) {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof input === "object" ? input : {};
}

function getBlockIndex(event, contentBlocks) {
  return Number.isInteger(event.index) ? event.index : contentBlocks.length;
}

function applyContentBlockStart(event, contentBlocks, toolInputJsonByIndex) {
  const index = getBlockIndex(event, contentBlocks);
  const block = event.content_block || {};

  if (block.type === "tool_use") {
    contentBlocks[index] = {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: normalizeToolInput(block.input),
    };
    toolInputJsonByIndex.set(index, "");
    return;
  }

  if (block.type === "text") {
    contentBlocks[index] = { type: "text", text: block.text || "" };
    return;
  }

  contentBlocks[index] = block;
}

function applyContentBlockDelta(event, contentBlocks, toolInputJsonByIndex, onText) {
  const index = getBlockIndex(event, contentBlocks);
  const delta = event.delta || {};

  if (delta.type === "text_delta") {
    const text = delta.text || "";
    if (!contentBlocks[index]) contentBlocks[index] = { type: "text", text: "" };
    if (contentBlocks[index].type === "text") {
      contentBlocks[index].text = `${contentBlocks[index].text || ""}${text}`;
    }
    onText?.(text);
    return text;
  }

  if (delta.type === "input_json_delta") {
    const partialJson = delta.partial_json || "";
    toolInputJsonByIndex.set(index, `${toolInputJsonByIndex.get(index) || ""}${partialJson}`);
  }

  return "";
}

function applyContentBlockStop(event, contentBlocks, toolInputJsonByIndex) {
  const index = getBlockIndex(event, contentBlocks);
  const block = contentBlocks[index];
  if (block?.type !== "tool_use") return;

  const inputJson = toolInputJsonByIndex.get(index);
  if (!inputJson?.trim()) return;

  try {
    block.input = normalizeToolInput(JSON.parse(inputJson));
  } catch {
    block.input = {};
  }
}

export async function readAnthropicStream(response, onText) {
  const reader = response.body?.getReader();
  if (!reader) throw createApiError("Anthropic returned an empty response stream", 502);

  const decoder = new TextDecoder();
  const contentBlocks = [];
  const toolInputJsonByIndex = new Map();
  let outputText = "";
  let stopReason = "";
  let buffer = "";

  const handleEvent = (event) => {
    if (!event) return;

    if (event.type === "content_block_start") {
      applyContentBlockStart(event, contentBlocks, toolInputJsonByIndex);
    }

    if (event.type === "content_block_delta") {
      outputText += applyContentBlockDelta(event, contentBlocks, toolInputJsonByIndex, onText);
    }

    if (event.type === "content_block_stop") {
      applyContentBlockStop(event, contentBlocks, toolInputJsonByIndex);
    }

    if (event.type === "message_delta" && event.delta?.stop_reason) {
      stopReason = event.delta.stop_reason;
    }

    if (event.type === "error") {
      throw createApiError(event.error?.message || "Anthropic could not complete the response", 502);
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

  const compactContentBlocks = contentBlocks.filter(Boolean);
  return {
    contentBlocks: compactContentBlocks,
    outputText,
    stopReason,
    toolUses: compactContentBlocks.filter((block) => block.type === "tool_use"),
  };
}

export function formatAnthropicTools(tools = []) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description || `Use the ${tool.name} Shopify tool.`,
    input_schema: tool.input_schema || tool.inputSchema || {
      type: "object",
      properties: {},
    },
  }));
}

export function createAnthropicService(apiKey = process.env.ANTHROPIC_API_KEY) {
  const getSystemPrompt = (promptType) => {
    const basePrompt = systemPrompts.systemPrompts[promptType]?.content
      || systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;

    return `${basePrompt}\n\nIntent rules: Extract every useful attribute from the customer's natural-language request before replying. Never ask them to repeat details they already supplied. When a request is broad, ask only one short question at a time for the most important missing detail among recipient profile, seasonal or aesthetic vibe, product category, customization mode, and fit or size. Once there is enough information to search, search immediately instead of continuing a questionnaire.\n\nQuestionnaire rules: When the current user turn starts with [Customer quiz facts:], treat those facts and tags as sanitized search hints for this turn only, not as permanent identity or profile claims. Later customer corrections override earlier quiz facts. Rebuild the search_catalog query around the currently valid facts, including text-only, image-only, or text-on-image customization mode when supplied.\n\nCommerce rules: Use discovered search_catalog, lookup_catalog, and get_product tools for catalog information, preserving their catalog argument wrapper. Use search_shop_policies_and_faqs for store policy questions and follow its returned policies; never invent policies or promise exceptions. Use discovered get_cart, create_cart, and update_cart tools for cart state and changes, following their live schemas and using actual variant IDs returned by the catalog. Treat "buy for them" as curating products, adding confirmed variants to a Shopify cart when requested, and handing the customer to native checkout; do not enter payment details or claim an order was placed unless the live checkout flow confirms it. Only claim a cart change succeeded when the tool confirms success. If a required tool is unavailable or fails, explain that limitation instead of inventing results. Keep responses concise and conversational.`;
  };

  const streamResponse = async ({ messages, promptType, tools }, handlers = {}) => {
    if (!apiKey) {
      throw createApiError("ANTHROPIC_API_KEY is not configured on the server", 401);
    }

    const formattedTools = formatAnthropicTools(tools);
    const body = {
      model: process.env.ANTHROPIC_CHAT_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: AppConfig.api.maxTokens,
      system: getSystemPrompt(promptType),
      messages,
      stream: true,
    };

    if (formattedTools.length > 0) body.tools = formattedTools;

    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw createApiError(
        payload.error?.message || `Anthropic request failed with status ${response.status}`,
        response.status,
      );
    }

    return readAnthropicStream(response, handlers.onText);
  };

  return { getSystemPrompt, streamResponse };
}

export default { createAnthropicService };
