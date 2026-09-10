function extractMessageText(content) {
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return content;
    try {
      return extractMessageText(JSON.parse(trimmed));
    } catch {
      return content;
    }
  }

  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === "text" || item?.type === "input_text" || item?.type === "output_text")
      .map((item) => item.text || "")
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content.text === "string") return content.text;
  return "";
}

export function formatConversationHistory(messages) {
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = extractMessageText(message.content);
    return content ? [{ role: message.role, content }] : [];
  });
}

export function formatOpenAITools(tools = []) {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description || `Use the ${tool.name} Shopify tool.`,
    parameters: tool.input_schema || tool.inputSchema || {
      type: "object",
      properties: {},
    },
    // Shopify owns the MCP schemas, which may not satisfy OpenAI strict-mode
    // requirements, so preserve them as best-effort function schemas.
    strict: false,
  }));
}
