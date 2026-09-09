/**
 * Configuration Service
 * Centralizes all configuration values for the chat service
 */

export const AppConfig = {
  // API Configuration
  api: {
    defaultModel: 'claude-sonnet-5',
    maxTokens: 2000,
    defaultPromptType: 'standardAssistant',
  },

  // Error Message Templates
  errorMessages: {
    missingMessage: "Message is required",
    apiUnsupported: "This endpoint only supports server-sent events (SSE) requests or history requests.",
    authFailed: "Authentication failed with Claude API",
    apiKeyError: "Please check your API key in environment variables",
    rateLimitExceeded: "Rate limit exceeded",
    rateLimitDetails: "Please try again later",
    genericError: "Failed to get response from Claude"
  },

  // Tool Configuration
  tools: {
    // "search_shop_catalog" was the pre-migration name; catalog search now lives
    // on the UCP MCP endpoint as "search_catalog" (see app/mcp-client.js).
    productSearchName: "search_catalog",
    maxProductsToDisplay: 3
  }
};

export default AppConfig;
