import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatConversationHistory, formatOpenAITools } from "../app/services/openai-format.js";

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

test("active chat route uses OpenAI Responses and has no Anthropic dependency", () => {
  const route = readFileSync(new URL("../app/routes/chat.jsx", import.meta.url), "utf8");
  const service = readFileSync(new URL("../app/services/openai.server.js", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");

  assert.match(route, /createOpenAIService/);
  assert.match(service, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(service, /previous_response_id/);
  assert.doesNotMatch(packageJson, /anthropic/i);
});
