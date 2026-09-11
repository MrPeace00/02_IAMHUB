/**
 * Chat API Route
 * Handles streamed AI chat interactions and Shopify tools
 */
import MCPClient from "../mcp-client";
import { saveMessage, getConversationHistory, storeCustomerAccountUrls, getCustomerAccountUrls as getCustomerAccountUrlsFromDb } from "../db.server";
import AppConfig from "../services/config.server";
import { createSseStream } from "../services/streaming.server";
import { createAIService } from "../services/ai.server";
import { createToolService } from "../services/tool.server";
import { getCorsHeaders, isAllowedOrigin } from "../services/cors.server";

const QUIZ_AUDIENCES = new Set(["man", "woman", "child"]);
const QUIZ_SEASONS = new Set(["summer", "winter", "fall", "spring"]);
const QUIZ_CUSTOMIZATION_MODES = new Set(["text-only", "image-only", "text-on-image"]);
const QUIZ_DYNAMIC_FACT_BLOCKLIST = new Set(["api_key", "password", "secret", "system", "token", "tool"]);
const QUIZ_TAG_LIMIT = 8;

function sanitizeQuizText(value, maxLength) {
  return typeof value === "string"
    ? value
      .replace(/[<>[\]{}"`\\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength)
      .trim()
    : "";
}

function sanitizeQuizTag(value) {
  const tag = sanitizeQuizText(value, 40)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

  return tag.length >= 2 ? tag : "";
}

function collectQuizTagCandidates(value) {
  if (Array.isArray(value)) return value.flatMap(collectQuizTagCandidates);
  if (typeof value === "string") return value.split(/[,;]/);
  return [];
}

function sanitizeQuizTags(...values) {
  const tags = [];
  const seen = new Set();

  for (const candidate of values.flatMap(collectQuizTagCandidates)) {
    const tag = sanitizeQuizTag(candidate);
    if (!tag || seen.has(tag)) continue;
    tags.push(tag);
    seen.add(tag);
    if (tags.length >= QUIZ_TAG_LIMIT) break;
  }

  return tags;
}

function setFact(facts, key, value) {
  if (value !== "" && value !== null && value !== undefined) facts.set(key, value);
}

function setEnumFact(facts, key, value, allowedValues) {
  if (allowedValues.has(value)) facts.set(key, value);
}

function setAgeFact(facts, value) {
  const parsedAge = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedAge)) return;
  facts.set("age", String(Math.min(Math.max(parsedAge, 0), 120)));
}

function sanitizeQuizFactKey(value) {
  const key = sanitizeQuizTag(value).replace(/-/g, "_").slice(0, 32);
  return key && !QUIZ_DYNAMIC_FACT_BLOCKLIST.has(key) ? key : "";
}

function applyDynamicQuizFacts(facts, dynamicFacts) {
  if (!dynamicFacts || typeof dynamicFacts !== "object" || Array.isArray(dynamicFacts)) return;

  for (const [key, value] of Object.entries(dynamicFacts).slice(0, 8)) {
    const factKey = sanitizeQuizFactKey(key);
    if (!factKey) continue;

    if (factKey === "age") {
      setAgeFact(facts, value);
    } else if (factKey === "audience") {
      setEnumFact(facts, factKey, value, QUIZ_AUDIENCES);
    } else if (factKey === "season") {
      setEnumFact(facts, factKey, value, QUIZ_SEASONS);
    } else if (factKey === "customization") {
      setEnumFact(facts, factKey, value, QUIZ_CUSTOMIZATION_MODES);
    } else {
      setFact(facts, factKey, sanitizeQuizText(String(value), 80));
    }
  }
}

/**
 * Turns homepage quiz answers into an explicit, current-turn context tag so the
 * assistant filters search_catalog on structured facts instead of guessing them
 * back out of prose. These facts are hints, not a persistent customer profile.
 */
function buildQuizContext(quiz) {
  if (!quiz || typeof quiz !== "object") return "";

  const facts = new Map();

  setFact(facts, "name", sanitizeQuizText(quiz.name, 60));
  setAgeFact(facts, quiz.age);
  setEnumFact(facts, "audience", quiz.audience, QUIZ_AUDIENCES);
  setEnumFact(facts, "season", quiz.season, QUIZ_SEASONS);
  setFact(facts, "category", sanitizeQuizText(quiz.category, 60));
  setEnumFact(facts, "customization", quiz.customization || quiz.designMode, QUIZ_CUSTOMIZATION_MODES);
  applyDynamicQuizFacts(facts, quiz.facts);

  const tags = sanitizeQuizTags(
    quiz.tags,
    facts.get("audience"),
    facts.get("season"),
    facts.get("category"),
    facts.get("customization"),
  );

  const parts = Array.from(facts, ([key, value]) => `${key}: ${value}`);
  if (tags.length > 0) parts.push(`tags: ${tags.join(", ")}`);

  if (parts.length === 0) return "";
  return `[Customer quiz facts: ${parts.join("; ")}. Treat these as current-turn search hints only; later customer corrections override them. Filter search_catalog by the currently valid facts before answering.]`;
}

function withCurrentQuizContext(messages, quizContext) {
  if (!quizContext) return messages;

  const currentUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (currentUserIndex < 0) return messages;

  return messages.map((message, index) => index === currentUserIndex
    ? { ...message, content: `${quizContext}\n${message.content}` }
    : message);
}

/**
 * Rract Router loader function for handling GET requests
 */
export async function loader({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(request)) {
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers: getCorsHeaders(request, "GET, POST, OPTIONS") });
    }
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request, "GET, POST, OPTIONS")
    });
  }

  const url = new URL(request.url);

  // Lightweight widget reachability check; does not access customer data or call AI.
  if (url.searchParams.get('health') === 'true') {
    if (request.headers.get("Origin") && !isAllowedOrigin(request)) {
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers: getCorsHeaders(request, "GET, POST, OPTIONS") });
    }
    return Response.json({ service: 'shop-chat-agent', status: 'ok' }, {
      headers: { ...getCorsHeaders(request, "GET, POST, OPTIONS"), 'Cache-Control': 'no-store' }
    });
  }

  if (!isAllowedOrigin(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers: getCorsHeaders(request, "GET, POST, OPTIONS") });
  }

  // Handle history fetch requests - matches /chat?history=true&conversation_id=XYZ
  if (url.searchParams.has('history') && url.searchParams.has('conversation_id')) {
    return handleHistoryRequest(request, url.searchParams.get('conversation_id'));
  }

  // Handle SSE requests
  if (!url.searchParams.has('history') && request.headers.get("Accept") === "text/event-stream") {
    return handleChatRequest(request);
  }

  // API-only: reject all other requests
  return new Response(JSON.stringify({ error: AppConfig.errorMessages.apiUnsupported }), { status: 400, headers: getCorsHeaders(request) });
}

/**
 * React Router action function for handling POST requests
 */
export async function action({ request }) {
  if (!isAllowedOrigin(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers: getCorsHeaders(request, "GET, POST, OPTIONS") });
  }
  return handleChatRequest(request);
}

/**
 * Handle history fetch requests
 * @param {Request} request - The request object
 * @param {string} conversationId - The conversation ID
 * @returns {Response} JSON response with chat history
 */
async function handleHistoryRequest(request, conversationId) {
  const messages = await getConversationHistory(conversationId);

  return new Response(JSON.stringify({ messages }), { headers: getCorsHeaders(request) });
}

/**
 * Handle chat requests (both GET and POST)
 * @param {Request} request - The request object
 * @returns {Response} Server-sent events stream
 */
async function handleChatRequest(request) {
  try {
    // Get message data from request body
    const body = await request.json();
    const userMessage = body.message;

    // Validate required message
    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: AppConfig.errorMessages.missingMessage }),
        { status: 400, headers: getSseHeaders(request) }
      );
    }

    const quizContext = buildQuizContext(body.quiz);

    // Generate or use existing conversation ID
    const conversationId = body.conversation_id || Date.now().toString();
    const promptType = body.prompt_type || AppConfig.api.defaultPromptType;

    // Create a stream for the response
    const responseStream = createSseStream(async (stream) => {
      await handleChatSession({
        request,
        userMessage,
        quizContext,
        conversationId,
        promptType,
        stream
      });
    });

    return new Response(responseStream, {
      headers: getSseHeaders(request)
    });
  } catch (error) {
    console.error('Error in chat request handler:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

/**
 * Handle a complete chat session
 * @param {Object} params - Session parameters
 * @param {Request} params.request - The request object
 * @param {string} params.userMessage - The user's message
 * @param {string} params.quizContext - Sanitized current-turn quiz facts
 * @param {string} params.conversationId - The conversation ID
 * @param {string} params.promptType - The prompt type
 * @param {Object} params.stream - Stream manager for sending responses
 */
async function handleChatSession({
  request,
  userMessage,
  quizContext,
  conversationId,
  promptType,
  stream
}) {
  // Initialize services
  const { provider, service: aiService, formatHistory } = createAIService();
  const toolService = createToolService();

  // Initialize MCP client
  const shopId = request.headers.get("X-Shopify-Shop-Id");
  const shopDomain = request.headers.get("Origin");
  const { mcpApiUrl } = (await getCustomerAccountUrls(shopDomain, conversationId)) || {};

  const mcpClient = new MCPClient(
    shopDomain,
    conversationId,
    shopId,
    mcpApiUrl,
  );

  // Send conversation ID to client
  stream.sendMessage({ type: 'id', conversation_id: conversationId });

  // Connect to MCP servers and get available tools
  let storefrontMcpTools = [], customerMcpTools = [];

  try {
    storefrontMcpTools = await mcpClient.connectToStorefrontServer();
    customerMcpTools = await mcpClient.connectToCustomerServer();

    console.log(`Connected to MCP with ${storefrontMcpTools.length} tools`);
    console.log(`Connected to customer MCP with ${customerMcpTools.length} tools`);
  } catch (error) {
    console.warn('Failed to connect to MCP servers, continuing without tools:', error.message);
  }

  const productsToDisplay = [];

  // Save user message to the database
  await saveMessage(conversationId, 'user', userMessage);

  // Fetch all messages from the database for this conversation
  const dbMessages = withCurrentQuizContext(await getConversationHistory(conversationId), quizContext);

  let assistantText = "";

  const handleTextDelta = (textDelta) => {
    assistantText += textDelta;
    stream.sendMessage({ type: 'chunk', chunk: textDelta });
  };

  if (provider === "anthropic") {
    await runAnthropicToolLoop({
      aiService,
      messages: formatHistory(dbMessages),
      promptType,
      mcpClient,
      toolService,
      productsToDisplay,
      stream,
      onText: handleTextDelta,
    });
  } else {
    await runOpenAIToolLoop({
      aiService,
      input: formatHistory(dbMessages),
      promptType,
      mcpClient,
      toolService,
      productsToDisplay,
      stream,
      onText: handleTextDelta,
    });
  }

  if (assistantText.trim()) {
    await saveMessage(conversationId, 'assistant', assistantText);
  }

  stream.sendMessage({ type: 'message_complete' });

  // Signal end of turn
  stream.sendMessage({ type: 'end_turn' });

  // Send product results if available
  if (productsToDisplay.length > 0) {
    stream.sendMessage({
      type: 'product_results',
      products: productsToDisplay
    });
  }

}

async function runOpenAIToolLoop({
  aiService,
  input,
  promptType,
  mcpClient,
  toolService,
  productsToDisplay,
  stream,
  onText,
}) {
  let currentInput = input;
  let previousResponseId;

  for (let toolRound = 0; toolRound < AppConfig.api.maxToolRounds; toolRound += 1) {
    const response = await aiService.streamResponse({
      input: currentInput,
      previousResponseId,
      promptType,
      tools: mcpClient.tools,
    }, { onText });

    if ((response.functionCalls || []).length === 0) break;
    if (!response.responseId) throw new Error("OpenAI tool response was missing its response ID");

    const toolOutputs = [];

    for (const toolCall of response.functionCalls) {
      const toolUseResponse = await executeShopifyTool({
        name: toolCall.name,
        args: parseToolArguments(toolCall.arguments),
        mcpClient,
        toolService,
        productsToDisplay,
        stream,
      });

      toolOutputs.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: serializeToolOutput(toolUseResponse),
      });
    }

    previousResponseId = response.responseId;
    currentInput = toolOutputs;
    stream.sendMessage({ type: 'new_message' });

    if (toolRound === AppConfig.api.maxToolRounds - 1) {
      throw new Error("The shopping assistant reached its tool-call limit");
    }
  }
}

async function runAnthropicToolLoop({
  aiService,
  messages,
  promptType,
  mcpClient,
  toolService,
  productsToDisplay,
  stream,
  onText,
}) {
  let currentMessages = messages;

  for (let toolRound = 0; toolRound < AppConfig.api.maxToolRounds; toolRound += 1) {
    const response = await aiService.streamResponse({
      messages: currentMessages,
      promptType,
      tools: mcpClient.tools,
    }, { onText });

    const toolUses = response.toolUses || [];
    if (toolUses.length === 0) break;

    const assistantContent = (response.contentBlocks || [])
      .filter((block) => block.type !== "text" || block.text);
    const toolResults = [];

    for (const toolUse of toolUses) {
      const toolUseResponse = await executeShopifyTool({
        name: toolUse.name,
        args: normalizeToolInput(toolUse.input),
        mcpClient,
        toolService,
        productsToDisplay,
        stream,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: serializeToolOutput(toolUseResponse),
        is_error: Boolean(toolUseResponse.error),
      });
    }

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: assistantContent.length ? assistantContent : toolUses },
      { role: "user", content: toolResults },
    ];
    stream.sendMessage({ type: 'new_message' });

    if (toolRound === AppConfig.api.maxToolRounds - 1) {
      throw new Error("The shopping assistant reached its tool-call limit");
    }
  }
}

async function executeShopifyTool({
  name,
  args,
  mcpClient,
  toolService,
  productsToDisplay,
  stream,
}) {
  stream.sendMessage({
    type: 'tool_use',
    tool_use_message: `Calling tool: ${name}`,
  });

  let toolUseResponse;
  try {
    toolUseResponse = await mcpClient.callTool(name, args);
  } catch (error) {
    toolUseResponse = { error: { type: "tool_error", data: error.message } };
  }

  if (toolUseResponse.error?.type === "auth_required") {
    stream.sendMessage({ type: 'auth_required' });
  }

  if (!toolUseResponse.error && name === AppConfig.tools.productSearchName) {
    const products = toolService.processProductSearchResult(toolUseResponse);
    const existingIds = new Set(productsToDisplay.map((product) => product.id));
    productsToDisplay.push(...products.filter((product) => !existingIds.has(product.id)));
  }

  return toolUseResponse;

}

function parseToolArguments(argumentsJson) {
  try {
    const parsed = JSON.parse(argumentsJson || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function serializeToolOutput(toolUseResponse) {
  try {
    return JSON.stringify(toolUseResponse);
  } catch {
    return JSON.stringify({ error: { type: "serialization_error", data: "Tool output could not be serialized" } });
  }
}

function normalizeToolInput(input) {
  if (!input) return {};
  return typeof input === "object" && !Array.isArray(input) ? input : {};
}

/**
 * Get the customer MCP API URL for a shop
 * @param {string} shopDomain - The shop domain
 * @param {string} conversationId - The conversation ID
 * @returns {string} The customer MCP API URL
 */
async function getCustomerAccountUrls(shopDomain, conversationId) {
  try {
    // Check if the customer account URL exists in the DB
    const existingUrls = await getCustomerAccountUrlsFromDb(conversationId);

    // If URL exists, return early with the MCP API URL
    if (existingUrls) return existingUrls;

    // If not, query for it from the Shopify API
    const { hostname } = new URL(shopDomain);

    const urls = await Promise.all([
      fetch(`https://${hostname}/.well-known/customer-account-api`).then(res => res.json()),
      fetch(`https://${hostname}/.well-known/openid-configuration`).then(res => res.json()),
    ]).then(async ([mcpResponse, openidResponse]) => {
      const response = {
        mcpApiUrl: mcpResponse.mcp_api,
        authorizationUrl: openidResponse.authorization_endpoint,
        tokenUrl: openidResponse.token_endpoint,
      };

      await storeCustomerAccountUrls({
        conversationId,
        mcpApiUrl: mcpResponse.mcp_api,
        authorizationUrl: openidResponse.authorization_endpoint,
        tokenUrl: openidResponse.token_endpoint,
      });

      return response;
    });

    return urls;
  } catch (error) {
    console.error("Error getting customer MCP API URL:", error);
    return null;
  }
}

/**
 * Get SSE headers for the response
 * @param {Request} request - The request object
 * @returns {Object} SSE headers object
 */
function getSseHeaders(request) {
  return {
    ...getCorsHeaders(request, "GET, POST, OPTIONS"),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };
}
