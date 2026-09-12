import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { formatConversationHistory, formatOpenAITools } from "../app/services/openai-format.js";

function loadAnthropicServiceSource(fetch) {
  const source = readFileSync(new URL("../app/services/anthropic.server.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replace(/^export \{.*;\r?\n/gm, "")
    .replace(/export function buildAnthropicMessages/, "function buildAnthropicMessages")
    .replace(/export async function readAnthropicStream/, "async function readAnthropicStream")
    .replace(/export function formatAnthropicTools/, "function formatAnthropicTools")
    .replace(/export function createAnthropicService/, "function createAnthropicService")
    .replace(
      /export default \{[\s\S]*$/,
      "globalThis.buildAnthropicMessages = buildAnthropicMessages;\nglobalThis.readAnthropicStream = readAnthropicStream;\nglobalThis.formatAnthropicTools = formatAnthropicTools;\nglobalThis.createAnthropicService = createAnthropicService;",
    );

  const context = vm.createContext({
    AppConfig: { api: { defaultPromptType: "standardAssistant", maxTokens: 2000 } },
    TextDecoder,
    fetch,
    process: { env: {} },
    systemPrompts: { systemPrompts: { standardAssistant: { content: "Base prompt" } } },
  });
  vm.runInContext(source, context);
  return context;
}

test("OpenAI history migration preserves text and drops legacy tool-result records", () => {
  const history = formatConversationHistory([
    { role: "user", content: "I want a cozy hoodie" },
    { role: "assistant", content: JSON.stringify([{ type: "text", text: "I can help." }]) },
    { role: "user", content: JSON.stringify([{ type: "tool_result", content: "old result" }]) },
  ]);

  assert.deepEqual(history, [
    { role: "user", content: "I want a cozy hoodie" },
    { role: "assistant", content: "I can help." },
  ]);
});

test("Shopify MCP schemas become OpenAI Responses function tools", () => {
  const tools = formatOpenAITools([{
    name: "search_catalog",
    description: "Search products",
    input_schema: { type: "object", properties: { catalog: { type: "object" } } },
  }]);

  assert.equal(tools[0].type, "function");
  assert.equal(tools[0].name, "search_catalog");
  assert.equal(tools[0].parameters.properties.catalog.type, "object");
  assert.equal(tools[0].strict, false);
});

test("Shopify MCP schemas become Anthropic client tools", () => {
  const { formatAnthropicTools } = loadAnthropicServiceSource(async () => assert.fail("Unexpected network request"));
  const tools = formatAnthropicTools([{
    name: "search_catalog",
    description: "Search products",
    input_schema: { type: "object", properties: { catalog: { type: "object" } } },
  }]);

  assert.equal(tools[0].name, "search_catalog");
  assert.equal(tools[0].description, "Search products");
  assert.equal(tools[0].input_schema.properties.catalog.type, "object");
  assert.equal("strict" in tools[0], false);
});

test("Anthropic vision messages place a base64 image before the text turn", () => {
  const { buildAnthropicMessages } = loadAnthropicServiceSource(async () => assert.fail("Unexpected network request"));
  const messages = [{ role: "user", content: "Describe this artwork" }];
  const built = buildAnthropicMessages(messages, {
    mediaType: "image/png",
    data: "aW1hZ2U=",
  });

  assert.equal(messages[0].content, "Describe this artwork");
  assert.deepEqual(JSON.parse(JSON.stringify(built[0].content)), [
    {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" },
    },
    { type: "text", text: "Describe this artwork" },
  ]);
});

test("Anthropic streaming parser preserves text and tool inputs", async () => {
  const { readAnthropicStream } = loadAnthropicServiceSource(async () => assert.fail("Unexpected network request"));
  const chunks = [];
  const response = new Response([
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I will search. "}}',
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
    'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"search_catalog","input":{}}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"catalog\\":"}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"query\\":\\"hoodie\\"}}"}}',
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
    'event: message_stop\ndata: {"type":"message_stop"}',
  ].join("\n\n"));

  const parsed = await readAnthropicStream(response, (text) => chunks.push(text));

  assert.deepEqual(chunks, ["I will search. "]);
  assert.equal(parsed.outputText, "I will search. ");
  assert.equal(parsed.stopReason, "tool_use");
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.toolUses)), [{
    type: "tool_use",
    id: "toolu_1",
    name: "search_catalog",
    input: { catalog: { query: "hoodie" } },
  }]);
});

test("Anthropic service sends Messages API requests with system prompt and tools", async () => {
  let request;
  const { createAnthropicService } = loadAnthropicServiceSource(async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return new Response([
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Done"}}',
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      'event: message_stop\ndata: {"type":"message_stop"}',
    ].join("\n\n"));
  });

  const service = createAnthropicService("test-key");
  const result = await service.streamResponse({
    messages: [{ role: "user", content: "Find a hoodie" }],
    promptType: "standardAssistant",
    tools: [{ name: "search_catalog", input_schema: { type: "object" } }],
  });

  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.options.headers["x-api-key"], "test-key");
  assert.equal(request.options.headers["anthropic-version"], "2023-06-01");
  assert.equal(request.body.model, "claude-sonnet-5");
  assert.equal(request.body.messages[0].content, "Find a hoodie");
  assert.match(request.body.system, /Base prompt/);
  assert.equal(request.body.tools[0].name, "search_catalog");
  assert.equal(result.outputText, "Done");
});

test("Anthropic non-streaming vision requests preserve the documented image block shape", async () => {
  let request;
  const { createAnthropicService } = loadAnthropicServiceSource(async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return Response.json({
      content: [{ type: "text", text: '{"description":"A design"}' }],
      stop_reason: "end_turn",
    });
  });

  const result = await createAnthropicService("test-key").completeResponse({
    messages: [{ role: "user", content: "Return JSON" }],
    promptType: "standardAssistant",
    image: { mediaType: "image/png", data: "aW1hZ2U=" },
    systemAddon: "Vision only",
  });

  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.body.stream, false);
  assert.equal(request.body.messages[0].content[0].type, "image");
  assert.equal(request.body.messages[0].content[1].text, "Return JSON");
  assert.match(request.body.system, /Vision only/);
  assert.equal(result.outputText, '{"description":"A design"}');
});

test("active chat route uses provider router and keeps both tool protocols", () => {
  const route = readFileSync(new URL("../app/routes/chat.jsx", import.meta.url), "utf8");
  const service = readFileSync(new URL("../app/services/openai.server.js", import.meta.url), "utf8");
  const anthropicService = readFileSync(new URL("../app/services/anthropic.server.js", import.meta.url), "utf8");
  const router = readFileSync(new URL("../app/services/ai.server.js", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

  assert.match(route, /createAIService/);
  assert.match(route, /runOpenAIToolLoop/);
  assert.match(route, /runAnthropicToolLoop/);
  assert.match(route, /type: "function_call_output"/);
  assert.match(route, /type: "tool_result"/);
  assert.match(service, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(service, /previous_response_id/);
  assert.match(anthropicService, /https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.match(anthropicService, /content_block_delta/);
  assert.match(router, /AI_TEXT_PROVIDER/);
  assert.match(router, /createAnthropicService/);
  assert.match(router, /createOpenAIService/);
  assert.doesNotMatch(packageJson, /anthropic/i);
});
